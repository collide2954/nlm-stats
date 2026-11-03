import { writeFile } from 'node:fs/promises';
import { eutilsUrl, retry } from '../src/lib.js';
import {
  ENTREZ_DBS, QUERY_GROUPS, ERAS, PAPERS, METHODS, METHOD_YEARS, ICS, ENROLLMENT_BANDS, CT_DESIGN, TYPE_SERIES,
  GROWTH, ACCESS, COUNTRIES, GENES, VOCAB, SUBJECTS, RETRACTED, CLASSICS, EXTREMES, TRIALFATE, yearRange,
} from '../src/queries.js';
import {
  parseEinfo,
  parseCount,
  parseGenbankHeader,
  parseGrowth,
  parseOrganisms,
  parseDivisions,
  toModule,
  lastPerYear,
  uniqueBy,
  parseSummaries,
  parseCitedIn,
  summarizeAwards,
  groupAwards,
  medianYears,
  detailFiscalYear,
  parseRefseqHeader,
  enumLabels,
  parseTaxonNames,
  parseLinkCount,
  stopReasons,
  resultsLag,
  retractionYears,
  geneExtremes,
} from './parsers.mjs';

const OUT = new URL('../src/snapshot.js', import.meta.url);
const GBREL = 'https://ftp.ncbi.nlm.nih.gov/genbank/gbrel.txt';
const REFSEQ = 'https://ftp.ncbi.nlm.nih.gov/refseq/release';
const REPORTER = 'https://api.reporter.nih.gov/v2/projects/search';
const CTGOV = 'https://clinicaltrials.gov/api/v2';
const GAP_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchWithRetry = (url, as = 'json') => retry(async () => {
  const res = await fetch(url, { headers: { 'user-agent': 'nlm-stats-snapshot' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return as === 'json' ? res.json() : res.text();
}, { tries: 6, wait: 1000 });

let last = 0;
const eutils = async (tool, params) => {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetchWithRetry(eutilsUrl(tool, { ...params, tool: 'nlm-stats' }));
};

const efetchXml = async (params) => {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  return fetchWithRetry(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${new URLSearchParams({ ...params, retmode: 'xml', tool: 'nlm-stats' })}`, 'text');
};

const count = async (db, term) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const n = parseCount(await eutils('esearch', { db, term, retmax: 0 }));
    if (n !== null) return n;
    await sleep(1500);
  }
  return null;
};

const step = (label) => process.stderr.write(`${label}\n`);

const entrez = async () => {
  const out = [];
  for (const db of ENTREZ_DBS) {
    step(`einfo ${db}`);
    out.push(parseEinfo(await eutils('einfo', { db })));
  }
  return uniqueBy(out, 'db');
};

const pubmedTimeline = async (lastYear) => {
  const eras = [];
  for (const era of ERAS) {
    step(`era ${era.from}`);
    eras.push({ ...era, count: await count('pubmed', `${era.from}:${era.to}[dp]`) });
  }
  const years = [];
  for (const year of yearRange(1945, lastYear)) {
    step(`year ${year}`);
    years.push({ year, count: await count('pubmed', `${year}[dp]`) });
  }
  return { eras, years };
};

const groups = async () => {
  const out = [];
  for (const group of QUERY_GROUPS) {
    const items = [];
    for (const item of group.items) {
      step(`count ${item.id}`);
      items.push({ ...item, count: await count(item.db, item.term) });
    }
    out.push({ id: group.id, title: group.title, panel: group.panel ?? null, items });
  }
  return out;
};

const papers = async () => {
  step('papers');
  const summaries = parseSummaries(await eutils('esummary', { db: 'pubmed', id: PAPERS.map((p) => p.pmid).join(',') }));
  const out = [];
  for (const paper of PAPERS) {
    step(`citedin ${paper.pmid}`);
    const citedBy = parseCitedIn(await eutils('elink', { dbfrom: 'pubmed', linkname: 'pubmed_pubmed_citedin', id: paper.pmid }));
    out.push({ ...paper, ...summaries.find((s) => s.pmid === paper.pmid), citedBy });
  }
  return out;
};

const genbank = async () => {
  step('genbank');
  const text = await fetchWithRetry(GBREL, 'text');
  const tables = parseGrowth(text);
  const [traditional, wgs, tsa, tls] = tables.map(lastPerYear);
  const organisms = parseOrganisms(text);
  const ids = [];
  for (const o of organisms) {
    step(`taxon ${o.species}`);
    const json = await eutils('esearch', { db: 'taxonomy', term: `"${o.species}"[Scientific Name]`, retmax: 1 });
    ids.push(...(json.esearchresult?.idlist ?? []));
  }
  const names = ids.length ? parseTaxonNames(await eutils('esummary', { db: 'taxonomy', id: ids.join(',') })) : {};
  return {
    ...parseGenbankHeader(text),
    firstRelease: tables[0][0],
    growth: { traditional, wgs, tsa, tls },
    organisms: organisms.map((o) => ({ ...o, common: names[o.species] ?? null })),
    divisions: parseDivisions(text).sort((a, b) => b.bases - a.bases),
  };
};

const CT_FIELDS = ['OverallStatus', 'StudyType', 'Phase', 'LocationCountry', 'InterventionType', 'LeadSponsorClass', 'Sex', 'Condition', ...CT_DESIGN, 'HealthyVolunteers', 'EnrollmentCount'];

let ctLast = 0;
const ctget = async (path, params = {}) => {
  const wait = ctLast + 1300 - Date.now();
  if (wait > 0) await sleep(wait);
  ctLast = Date.now();
  const query = new URLSearchParams(params).toString();
  return fetchWithRetry(`${CTGOV}/${path}${query ? `?${query}` : ''}`);
};

const ctCount = async (term, extra = {}) => {
  const params = { countTotal: 'true', pageSize: '1', fields: 'NCTId', ...extra };
  if (term) params['query.term'] = term;
  const json = await ctget('studies', params);
  return json.totalCount;
};

const ctTiming = async (lastYear) => {
  const years = [];
  for (const year of yearRange(1999, lastYear)) {
    step(`trials ${year}`);
    const range = `RANGE[${year}-01-01,${year}-12-31]`;
    years.push({
      year,
      registered: await ctCount(`AREA[StudyFirstPostDate]${range}`),
      results: await ctCount(`AREA[ResultsFirstPostDate]${range}`),
    });
  }
  return years;
};

const ctBands = async () => {
  const out = [];
  for (const band of ENROLLMENT_BANDS) {
    step(`enrollment ${band.from}`);
    out.push({ ...band, count: await ctCount(`AREA[EnrollmentCount]RANGE[${band.from},${band.to}]`) });
  }
  return out;
};

const clinicaltrials = async () => {
  step('clinicaltrials');
  const version = await ctget('version');
  const size = await ctget('stats/size');
  const fields = await ctget('stats/field/values', { fields: CT_FIELDS.join(',') });
  const title = async (id) => {
    const study = await ctget(`studies/${id}`, { fields: 'NCTId,BriefTitle,StudyFirstPostDate' });
    const m = study.protocolSection;
    return { id, title: m.identificationModule.briefTitle, posted: m.statusModule?.studyFirstPostDateStruct?.date ?? null };
  };
  const largest = [];
  for (const s of size.largestStudies.slice(0, 5)) largest.push({ ...(await title(s.id)), bytes: s.sizeBytes });
  return {
    dataTimestamp: version.dataTimestamp,
    labels: enumLabels(await ctget('studies/enums')),
    first: await title('NCT00000102'),
    total: size.totalStudies,
    averageBytes: size.averageSizeBytes,
    medianBytes: size.percentiles['50%'],
    largest,
    fields: Object.fromEntries(fields.map((f) => [f.piece, f.topValues ? {
      unique: f.uniqueValuesCount,
      missing: f.missingStudiesCount,
      top: f.topValues.slice(0, 20).map((v) => ({ value: v.value, count: v.studiesCount })),
    } : {
      missing: f.missingStudiesCount,
      ...(f.type === 'BOOLEAN' ? { yes: f.trueCount, no: f.falseCount } : { min: f.min, max: f.max, mean: f.avg }),
    }])),
    biggestEnrollment: await (async () => {
      const json = await ctget('studies', { pageSize: '1', sort: 'EnrollmentCount:desc', fields: 'NCTId,BriefTitle,EnrollmentCount' });
      const m = json.studies[0].protocolSection;
      return { id: m.identificationModule.nctId, title: m.identificationModule.briefTitle, count: m.designModule.enrollmentInfo.count };
    })(),
    enrollmentBands: await ctBands(),
    completedInterventional: await ctCount('AREA[StudyType]INTERVENTIONAL AND AREA[OverallStatus]COMPLETED'),
    completedInterventionalWithResults: await ctCount('AREA[StudyType]INTERVENTIONAL AND AREA[OverallStatus]COMPLETED', { aggFilters: 'results:with' }),
    withResults: await ctCount('', { aggFilters: 'results:with' }),
    timing: await ctTiming(new Date().getUTCFullYear()),
  };
};

let reporterLast = 0;
const reporter = async (criteria, fields, offset, extra = {}) => {
  const wait = reporterLast + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  reporterLast = Date.now();
  return retry(async () => {
    const res = await fetch(REPORTER, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'nlm-stats-snapshot' },
      body: JSON.stringify({ criteria, include_fields: fields, offset, limit: 500, ...extra }),
    });
    if (!res.ok) throw new Error(`RePORTER HTTP ${res.status}`);
    return res.json();
  }, { tries: 6, wait: 2000 });
};

const allProjects = async (criteria, fields) => {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const json = await reporter(criteria, fields, offset);
    rows.push(...json.results);
    if (json.results.length < 500 || rows.length >= json.meta.total) return rows;
  }
};

const DETAIL_FIELDS = [
  'ApplId', 'SubprojectId', 'AwardAmount', 'ActivityCode', 'FundingMechanism', 'Organization', 'ProjectStartDate',
  'ProjectEndDate', 'AwardType', 'SpendingCategoriesDesc', 'FiscalYear', 'ProjectTitle', 'ProjectNum',
];
const LEAN_FIELDS = ['ApplId', 'SubprojectId', 'AwardAmount', 'Organization'];

const funding = async (now) => {
  const detailFy = detailFiscalYear(now);
  const years = [];
  let detailRows = [];
  for (const fy of yearRange(1985, detailFy + 1)) {
    step(`reporter NLM ${fy}`);
    const rows = await allProjects({ agencies: ['NLM'], fiscal_years: [fy] }, fy === detailFy ? DETAIL_FIELDS : LEAN_FIELDS);
    years.push({ fy, ...summarizeAwards(rows), partial: fy > detailFy });
    if (fy === detailFy) detailRows = rows;
  }
  const ics = [];
  const nihRows = [];
  for (const ic of ICS) {
    step(`reporter ${ic} ${detailFy}`);
    const rows = await allProjects({ agencies: [ic], fiscal_years: [detailFy] }, LEAN_FIELDS);
    ics.push({ ic, ...summarizeAwards(rows) });
    nihRows.push(...rows);
  }
  const main = detailRows.filter((r) => r.subproject_id === null);
  const largest = [...main].sort((a, b) => (b.award_amount ?? 0) - (a.award_amount ?? 0)).slice(0, 5).map((r) => ({
    appl: r.appl_id,
    number: r.project_num,
    title: r.project_title,
    org: r.organization?.org_name ?? null,
    activity: r.activity_code,
    dollars: r.award_amount,
  }));
  return {
    detailFy,
    years,
    ics: ics.sort((a, b) => b.dollars - a.dollars),
    nihStates: groupAwards(nihRows, (r) => (r.organization?.org_country === 'UNITED STATES' ? r.organization?.org_state : 'Outside U.S.')),
    detail: {
      ...summarizeAwards(detailRows),
      newProjects: main.filter((r) => r.award_type === '1').length,
      medianYears: medianYears(detailRows),
      byActivity: groupAwards(detailRows, (r) => r.activity_code).slice(0, 15),
      byMechanism: groupAwards(detailRows, (r) => r.funding_mechanism),
      byCategory: groupAwards(detailRows, (r) => (r.spending_categories_desc ?? '').split(';')).slice(0, 15),
      byOrg: groupAwards(detailRows, (r) => r.organization?.org_name).slice(0, 10),
      byState: groupAwards(detailRows, (r) => r.organization?.org_state),
      largest,
    },
  };
};

const methods = async (lastYear) => {
  const out = [];
  for (const method of METHODS) {
    step(`method ${method.id}`);
    const total = await count('pubmed', method.term);
    const years = [];
    for (const year of yearRange(METHOD_YEARS.from, lastYear)) {
      years.push({ year, count: await count('pubmed', `${method.term} AND ${year}[dp]`) });
    }
    out.push({ ...method, total, years });
  }
  return out;
};

const refseq = async () => {
  step('refseq');
  const release = (await fetchWithRetry(`${REFSEQ}/RELEASE_NUMBER`, 'text')).trim();
  const text = await fetchWithRetry(`${REFSEQ}/release-notes/RefSeq-release${release}.txt`, 'text');
  return parseRefseqHeader(text);
};

const types = async (lastYear) => {
  const out = [];
  for (const series of [...TYPE_SERIES.stacked, ...TYPE_SERIES.multiples]) {
    step(`type ${series.id}`);
    const years = [];
    for (const year of yearRange(TYPE_SERIES.from, lastYear)) {
      years.push({ year, count: await count('pubmed', `${series.term} AND ${year}[dp]`) });
    }
    out.push({ id: series.id, years });
  }
  return out;
};

const growth = async (lastYear) => {
  const out = [];
  for (const d of GROWTH.dbs) {
    step(`growth ${d.db}`);
    const years = [];
    for (const year of yearRange(GROWTH.from, lastYear)) {
      years.push({ year, count: await count(d.db, `${year}/01/01:${year}/12/31[${d.field}]`) });
    }
    out.push({ ...d, years });
  }
  return out;
};

const access = async (lastYear) => {
  const out = [];
  for (const series of ACCESS.series) {
    step(`access ${series.id}`);
    const years = [];
    for (const year of yearRange(ACCESS.from, lastYear)) {
      years.push({ year, count: await count('pubmed', `${series.term} AND ${year}[dp]`) });
    }
    out.push({ id: series.id, years });
  }
  return out;
};

const countries = async () => {
  const out = [];
  for (const country of COUNTRIES.list) {
    step(`country ${country.name}`);
    const counts = {};
    for (const year of COUNTRIES.years) counts[year] = await count('pubmed', `${country.term} AND ${year}[dp]`);
    out.push({ ...country, counts });
  }
  return out;
};

const genes = async () => {
  step('genes');
  const summary = await eutils('esummary', { db: 'gene', id: GENES.map((x) => x.id).join(',') });
  const out = [];
  for (const gene of GENES) {
    step(`gene ${gene.symbol}`);
    const info = summary.result[String(gene.id)];
    const links = await eutils('elink', { dbfrom: 'gene', db: 'pubmed', linkname: 'gene_pubmed', id: gene.id });
    out.push({
      id: gene.id,
      symbol: info.name,
      description: info.description,
      chromosome: info.chromosome,
      pubmed: parseLinkCount(links, 'gene_pubmed'),
      clinvar: await count('clinvar', `${info.name}[gene] AND 9606[taxid]`),
    });
  }
  return out;
};

const perYear = async (term, years) => {
  const out = [];
  for (const year of years) out.push({ year, count: await count('pubmed', `${term} AND ${year}[dp]`) });
  return out;
};

const vocab = async (thisYear) => {
  const years = yearRange(VOCAB.from, thisYear);
  step('vocab totals');
  const totals = await perYear('hasabstract', years);
  const words = [];
  for (const word of [...VOCAB.words, VOCAB.control]) {
    step(`vocab ${word.id}`);
    words.push({ ...word, years: await perYear(`${word.term} AND hasabstract`, years) });
  }
  return { base: VOCAB.base, partial: thisYear, totals, words: words.slice(0, -1), control: words.at(-1) };
};

const subjects = async (lastYear) => {
  const years = yearRange(SUBJECTS.animals.from, lastYear);
  step('subjects medline');
  const medline = await perYear('medline[sb]', years);
  const series = async (list) => {
    const out = [];
    for (const item of list) {
      step(`subject ${item.id}`);
      out.push({ ...item, years: await perYear(`${item.term} AND medline[sb]`, years) });
    }
    return out;
  };
  const ages = [];
  for (const age of SUBJECTS.ages.list) {
    step(`age ${age.id}`);
    const counts = {};
    for (const year of SUBJECTS.ages.years) counts[year] = await count('pubmed', `${age.term} AND ${year}[dp] AND medline[sb]`);
    ages.push({ ...age, counts });
  }
  const outbreaks = [];
  for (const o of SUBJECTS.outbreaks.list) {
    step(`outbreak ${o.id}`);
    outbreaks.push({ ...o, years: await perYear(o.term, yearRange(SUBJECTS.outbreaks.from, lastYear)) });
  }
  return {
    medline,
    animals: await series(SUBJECTS.animals.list),
    sex: await series(SUBJECTS.sex.list),
    ages: { years: SUBJECTS.ages.years, list: ages },
    outbreaks,
  };
};

const citedIn = async (pmid, term) => parseCitedIn(await eutils('elink', {
  dbfrom: 'pubmed', db: 'pubmed', linkname: 'pubmed_pubmed_citedin', id: pmid, ...(term ? { term } : {}),
}));

const zombies = async () => {
  step('zombies');
  const ids = RETRACTED.map((p) => p.pmid).join(',');
  const years = retractionYears(await efetchXml({ db: 'pubmed', id: ids }));
  const summaries = parseSummaries(await eutils('esummary', { db: 'pubmed', id: ids }));
  const out = [];
  for (const paper of RETRACTED) {
    step(`zombie ${paper.pmid}`);
    const retracted = years[paper.pmid] ?? null;
    const s = summaries.find((x) => x.pmid === paper.pmid);
    out.push({
      ...paper,
      title: s.title,
      date: s.date,
      retracted,
      citedBy: await citedIn(paper.pmid),
      after: retracted ? await citedIn(paper.pmid, `${retracted + 1}:3000[dp]`) : null,
    });
  }
  return out;
};

const classics = async () => {
  step('classics');
  const summaries = parseSummaries(await eutils('esummary', { db: 'pubmed', id: CLASSICS.map((p) => p.pmid).join(',') }));
  const out = [];
  for (const paper of CLASSICS) {
    step(`classic ${paper.pmid}`);
    const s = summaries.find((x) => x.pmid === paper.pmid);
    out.push({ ...paper, title: s.title, journal: s.journal, date: s.date, citedBy: await citedIn(paper.pmid) });
  }
  return out;
};

const proteinExtreme = async () => {
  step('largest protein');
  const ids = (await eutils('esearch', { db: 'protein', term: EXTREMES.protein, retmax: 200 })).esearchresult.idlist;
  const json = await eutils('esummary', { db: 'protein', id: ids.join(',') });
  const top = ids.map((id) => json.result[id]).reduce((a, b) => (b.slen > a.slen ? b : a));
  return { accession: top.accessionversion, length: top.slen, title: top.title, candidates: ids.length };
};

const geneRecords = async () => {
  const search = await eutils('esearch', { db: 'gene', term: EXTREMES.genes, retmax: 0, usehistory: 'y' });
  const { count: total, webenv, querykey } = search.esearchresult;
  const out = [];
  for (let start = 0; start < Number(total); start += 500) {
    step(`genes ${start}`);
    const json = await eutils('esummary', { db: 'gene', query_key: querykey, WebEnv: webenv, retstart: start, retmax: 500 });
    out.push(...json.result.uids.map((uid) => json.result[uid]));
  }
  return out;
};

const trialExtremes = async () => {
  step('trial extremes');
  const pick = async (sort, fields) => (await ctget('studies', { sort, pageSize: '1', fields })).studies[0].protocolSection;
  const late = await pick('CompletionDate:desc', 'NCTId,BriefTitle,CompletionDate');
  const early = await pick('StartDate:asc', 'NCTId,BriefTitle,StartDate,StudyFirstPostDate,OverallStatus');
  return {
    latest: { id: late.identificationModule.nctId, title: late.identificationModule.briefTitle, date: late.statusModule.completionDateStruct.date },
    farFuture: { year: EXTREMES.farFuture, count: await ctCount(`AREA[CompletionDate]RANGE[${EXTREMES.farFuture}-01-01,MAX]`) },
    earliest: {
      id: early.identificationModule.nctId,
      title: early.identificationModule.briefTitle,
      date: early.statusModule.startDateStruct.date,
      posted: early.statusModule.studyFirstPostDateStruct?.date ?? null,
      status: early.statusModule.overallStatus,
    },
    longAgo: { year: EXTREMES.longAgo, count: await ctCount(`AREA[StartDate]RANGE[MIN,${EXTREMES.longAgo - 1}-12-31]`) },
  };
};

const awardExtremes = async (fy) => {
  step('award extremes');
  const fields = ['ApplId', 'ProjectNum', 'ProjectTitle', 'AwardAmount', 'Organization', 'AgencyIcAdmin', 'ActivityCode'];
  const top = (await reporter({ fiscal_years: [fy] }, fields, 0, { limit: 1, sort_field: 'award_amount', sort_order: 'desc' })).results[0];
  const range = async (min, max) => (await reporter({ fiscal_years: [fy], award_amount_range: { min_amount: min, max_amount: max } }, ['ApplId'], 0, { limit: 1 })).meta.total;
  return {
    fy,
    largest: {
      appl: top.appl_id,
      number: top.project_num,
      title: top.project_title,
      dollars: top.award_amount,
      ic: top.agency_ic_admin?.abbreviation ?? null,
      org: top.organization?.org_name ?? null,
      activity: top.activity_code,
    },
    upTo100: await range(1, 100),
    exactlyOne: await range(1, 1),
  };
};

const extremes = async (now) => {
  const stop = await eutils('esearch', { db: 'pubmed', term: EXTREMES.stopword, retmax: 0 });
  return {
    protein: await proteinExtreme(),
    genes: geneExtremes(await geneRecords()),
    uncultured: await count('nuccore', EXTREMES.uncultured),
    stopword: {
      word: EXTREMES.stopword,
      count: parseCount(stop),
      ignored: (stop.esearchresult.warninglist?.phrasesignored ?? []).includes(EXTREMES.stopword),
    },
    trials: await trialExtremes(),
    awards: await awardExtremes(detailFiscalYear(now)),
  };
};

const ctAll = async (params) => {
  const rows = [];
  let token;
  do {
    step(`ct page ${rows.length}`);
    const json = await ctget('studies', { ...params, pageSize: '1000', ...(token ? { pageToken: token } : {}) });
    rows.push(...json.studies.map((x) => x.protocolSection));
    token = json.nextPageToken;
  } while (token);
  return rows;
};

const trialfate = async (now) => {
  const stopped = await ctAll({ 'query.term': TRIALFATE.stopped, fields: 'NCTId,WhyStopped,LeadSponsorClass' });
  const reported = await ctAll({ aggFilters: 'results:with', fields: 'NCTId,PrimaryCompletionDate,ResultsFirstSubmitDate,LeadSponsorClass,StudyType' });
  const lagRows = reported
    .filter((m) => m.designModule?.studyType === 'INTERVENTIONAL' && m.statusModule?.primaryCompletionDateStruct?.date && m.statusModule?.resultsFirstSubmitDate)
    .map((m) => ({ pc: m.statusModule.primaryCompletionDateStruct.date, submit: m.statusModule.resultsFirstSubmitDate, cls: m.sponsorCollaboratorsModule?.leadSponsor?.class ?? 'UNKNOWN' }));
  return {
    terminated: await ctCount(TRIALFATE.terminated),
    stops: stopReasons(stopped.map((m) => ({ why: m.statusModule.whyStopped, cls: m.sponsorCollaboratorsModule?.leadSponsor?.class ?? 'UNKNOWN' }))),
    lag: resultsLag(lagRows, { from: 2018, to: now.getUTCFullYear() - 4 }),
  };
};

const now = new Date();
const SECTIONS = {
  entrez: () => entrez(),
  groups: () => groups(),
  papers: () => papers(),
  pubmed: () => pubmedTimeline(now.getUTCFullYear()),
  types: () => types(now.getUTCFullYear() - 1),
  methods: () => methods(now.getUTCFullYear() - 1),
  growth: () => growth(now.getUTCFullYear() - 1),
  access: () => access(now.getUTCFullYear() - 1),
  countries: () => countries(),
  genes: () => genes(),
  genbank: () => genbank(),
  refseq: () => refseq(),
  clinicaltrials: () => clinicaltrials(),
  funding: () => funding(now),
  vocab: () => vocab(now.getUTCFullYear()),
  subjects: () => subjects(now.getUTCFullYear() - 1),
  zombies: () => zombies(),
  classics: () => classics(),
  extremes: () => extremes(now),
  trialfate: () => trialfate(now),
};

const only = process.argv.slice(2).filter((a) => SECTIONS[a]);
const base = only.length ? (await import(`${OUT.href}?t=${now.getTime()}`)).default : {};
const snapshot = { ...base, generated: now.toISOString() };
for (const [key, build] of Object.entries(SECTIONS)) {
  if (!only.length || only.includes(key)) snapshot[key] = await build();
}

await writeFile(OUT, toModule(snapshot));
step(`wrote ${OUT.pathname}`);
