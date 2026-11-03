import { writeFile } from 'node:fs/promises';
import { eutilsUrl } from '../src/lib.js';
import { ENTREZ_DBS, QUERY_GROUPS, ERAS, yearRange } from '../src/queries.js';
import {
  parseEinfo,
  parseCount,
  parseGenbankHeader,
  parseGrowth,
  parseOrganisms,
  parseDivisions,
  toModule,
} from './parsers.mjs';

const OUT = new URL('../src/snapshot.js', import.meta.url);
const GBREL = 'https://ftp.ncbi.nlm.nih.gov/genbank/gbrel.txt';
const CTGOV = 'https://clinicaltrials.gov/api/v2';
const GAP_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fetchWithRetry = async (url, as = 'json') => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await fetch(url, { headers: { 'user-agent': 'nlm-stats-snapshot' } });
    if (res.ok) return as === 'json' ? res.json() : res.text();
    await sleep(1000 * 2 ** attempt);
  }
  throw new Error(`failed ${url}`);
};

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
  return out;
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

const genbank = async () => {
  step('genbank');
  const text = await fetchWithRetry(GBREL, 'text');
  const [traditional, wgs, tsa, tls] = parseGrowth(text);
  return {
    ...parseGenbankHeader(text),
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
  return {
    dataTimestamp: version.dataTimestamp,
    total: size.totalStudies,
    averageBytes: size.averageSizeBytes,
    medianBytes: size.percentiles['50%'],
    largest: size.largestStudies.slice(0, 5),
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
  pubmed: await pubmedTimeline(now.getUTCFullYear()),
  genbank: await genbank(),
  clinicaltrials: await clinicaltrials(),
};

await writeFile(OUT, toModule(snapshot));
step(`wrote ${OUT.pathname}`);
