import { writeFile } from 'node:fs/promises';
import { eutilsUrl, retry } from '../src/lib.js';
import { ENTREZ_DBS, QUERY_GROUPS, ERAS, PAPERS, yearRange } from '../src/queries.js';
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
} from './parsers.mjs';

const OUT = new URL('../src/snapshot.js', import.meta.url);
const GBREL = 'https://ftp.ncbi.nlm.nih.gov/genbank/gbrel.txt';
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
    out.push({ id: group.id, title: group.title, items });
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
  return {
    ...parseGenbankHeader(text),
    firstRelease: tables[0][0],
    growth: { traditional, wgs, tsa, tls },
    organisms: parseOrganisms(text),
    divisions: parseDivisions(text).sort((a, b) => b.bases - a.bases),
  };
};

const CT_FIELDS = ['OverallStatus', 'StudyType', 'Phase', 'LocationCountry', 'InterventionType', 'LeadSponsorClass', 'Sex', 'Condition'];

const clinicaltrials = async () => {
  step('clinicaltrials');
  const version = await fetchWithRetry(`${CTGOV}/version`);
  const size = await fetchWithRetry(`${CTGOV}/stats/size`);
  const fields = await fetchWithRetry(`${CTGOV}/stats/field/values?fields=${CT_FIELDS.join(',')}`);
  const title = async (id) => {
    const study = await fetchWithRetry(`${CTGOV}/studies/${id}?fields=NCTId,BriefTitle,StudyFirstPostDate`);
    const m = study.protocolSection;
    return { id, title: m.identificationModule.briefTitle, posted: m.statusModule?.studyFirstPostDateStruct?.date ?? null };
  };
  const largest = [];
  for (const s of size.largestStudies.slice(0, 5)) largest.push({ ...(await title(s.id)), bytes: s.sizeBytes });
  return {
    dataTimestamp: version.dataTimestamp,
    first: await title('NCT00000102'),
    total: size.totalStudies,
    averageBytes: size.averageSizeBytes,
    medianBytes: size.percentiles['50%'],
    largest,
    fields: Object.fromEntries(fields.map((f) => [f.piece, {
      unique: f.uniqueValuesCount,
      missing: f.missingStudiesCount,
      top: f.topValues.slice(0, 20).map((v) => ({ value: v.value, count: v.studiesCount })),
    }])),
  };
};

const now = new Date();
const snapshot = {
  generated: now.toISOString(),
  entrez: await entrez(),
  groups: await groups(),
  papers: await papers(),
  pubmed: await pubmedTimeline(now.getUTCFullYear()),
  genbank: await genbank(),
  clinicaltrials: await clinicaltrials(),
};

await writeFile(OUT, toModule(snapshot));
step(`wrote ${OUT.pathname}`);
