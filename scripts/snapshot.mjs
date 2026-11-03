import { writeFile } from 'node:fs/promises';
import { eutilsUrl, retry } from '../src/lib.js';
import {
  ENTREZ_DBS, QUERY_GROUPS, ERAS, PAPERS, METHODS, METHOD_YEARS, ICS, ENROLLMENT_BANDS, CT_DESIGN, TYPE_SERIES, yearRange,
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
const reporter = async (criteria, fields, offset) => {
  const wait = reporterLast + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  reporterLast = Date.now();
  return retry(async () => {
    const res = await fetch(REPORTER, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'nlm-stats-snapshot' },
      body: JSON.stringify({ criteria, include_fields: fields, offset, limit: 500 }),
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
const LEAN_FIELDS = ['ApplId', 'SubprojectId', 'AwardAmount'];

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
  for (const ic of ICS) {
    step(`reporter ${ic} ${detailFy}`);
    ics.push({ ic, ...summarizeAwards(await allProjects({ agencies: [ic], fiscal_years: [detailFy] }, LEAN_FIELDS)) });
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
    detail: {
      ...summarizeAwards(detailRows),
      newProjects: main.filter((r) => r.award_type === '1').length,
      medianYears: medianYears(detailRows),
      byActivity: groupAwards(detailRows, (r) => r.activity_code).slice(0, 15),
      byMechanism: groupAwards(detailRows, (r) => r.funding_mechanism),
      byCategory: groupAwards(detailRows, (r) => (r.spending_categories_desc ?? '').split(';')).slice(0, 15),
      byOrg: groupAwards(detailRows, (r) => r.organization?.org_name).slice(0, 10),
      byState: groupAwards(detailRows, (r) => r.organization?.org_state).slice(0, 10),
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

const now = new Date();
const SECTIONS = {
  entrez: () => entrez(),
  groups: () => groups(),
  papers: () => papers(),
  pubmed: () => pubmedTimeline(now.getUTCFullYear()),
  types: () => types(now.getUTCFullYear() - 1),
  methods: () => methods(now.getUTCFullYear() - 1),
  genbank: () => genbank(),
  refseq: () => refseq(),
  clinicaltrials: () => clinicaltrials(),
  funding: () => funding(now),
};

const only = process.argv.slice(2).filter((a) => SECTIONS[a]);
const base = only.length ? (await import(`${OUT.href}?t=${now.getTime()}`)).default : {};
const snapshot = { ...base, generated: now.toISOString() };
for (const [key, build] of Object.entries(SECTIONS)) {
  if (!only.length || only.includes(key)) snapshot[key] = await build();
}

await writeFile(OUT, toModule(snapshot));
step(`wrote ${OUT.pathname}`);
