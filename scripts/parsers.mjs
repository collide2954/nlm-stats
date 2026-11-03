export { parseEinfo, parseCount } from '../src/lib.js';

export const parseGenbankHeader = (text) => {
  const release = text.match(/GenBank Flat File Release (\d+\.\d+)/)[1];
  const date = text.match(/Genetic Sequence Data Bank\s*\n\s*([A-Z][a-z]+ \d{1,2} \d{4})/)[1];
  const totals = [...text.matchAll(/^\s*(\d+) sequences,\s+(\d+) bases/gm)].map((m) => ({
    sequences: Number(m[1]),
    bases: Number(m[2]),
  }));
  return { release, date, traditional: totals[0], sets: totals[1] };
};

const ROW = /^\s*(\d+(?:\.\d+)?)\s+([A-Z][a-z]{2} \d{4})\s+(\d+)\s+(\d+)/;

export const parseGrowth = (text) => {
  const lines = text.split('\n');
  const tables = [];
  lines.forEach((line, i) => {
    if (!/^Release\s+Date\s+Base Pairs\s+Entries/.test(line)) return;
    const rows = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const l = lines[j];
      if (!l.trim() || /^\s*n\/a\s/.test(l)) continue;
      const m = l.match(ROW);
      if (!m) break;
      rows.push({ release: Number(m[1]), date: m[2], bases: Number(m[3]), entries: Number(m[4]) });
    }
    tables.push(rows);
  });
  return tables;
};

const section = (text, start, end) => {
  const from = text.lastIndexOf(start);
  if (from < 0) return '';
  const to = text.indexOf(end, from + start.length);
  return text.slice(from, to < 0 ? undefined : to);
};

export const parseOrganisms = (text) =>
  section(text, '2.2.7 Selected Per-Organism Statistics', '2.2.8')
    .split('\n')
    .map((l) => l.match(/^(\d+)\s+(\d+)\s+(\S.*\S)\s*$/))
    .filter(Boolean)
    .map((m) => ({ species: m[3], entries: Number(m[1]), bases: Number(m[2]) }));

export const parseDivisions = (text) => {
  const totals = new Map();
  section(text, '2.2.6 Per-Division Statistics', '2.2.7')
    .split('\n')
    .map((l) => l.match(/^([A-Z]{3})\d+\s+(\d+)\s+(\d+)\s*$/))
    .filter(Boolean)
    .forEach((m) => {
      const t = totals.get(m[1]) ?? { code: m[1], files: 0, entries: 0, bases: 0 };
      t.files += 1;
      t.entries += Number(m[2]);
      t.bases += Number(m[3]);
      totals.set(m[1], t);
    });
  return [...totals.values()];
};

export const toModule = (value) => `export default ${JSON.stringify(value, null, 2)};\n`;

export const lastPerYear = (rows) => {
  const byYear = new Map();
  for (const { release, date, bases, entries } of rows) {
    const year = Number(date.slice(-4));
    byYear.set(year, { year, release, bases, entries });
  }
  return [...byYear.values()];
};

export const uniqueBy = (items, key) => {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item[key])) return false;
    seen.add(item[key]);
    return true;
  });
};

export const parseSummaries = (json) =>
  json.result.uids.map((uid) => {
    const d = json.result[uid];
    const authors = (d.authors ?? []).map((a) => a.name);
    return {
      pmid: uid,
      date: d.pubdate,
      journal: d.source,
      title: d.title,
      authors: authors.slice(0, 3),
      authorCount: authors.length,
    };
  });

export const parseCitedIn = (json) =>
  (json.linksets?.[0]?.linksetdbs ?? [])
    .filter((l) => l.linkname === 'pubmed_pubmed_citedin')
    .reduce((sum, l) => sum + l.links.length, 0);

const primary = (rows) => rows.filter((r) => r.subproject_id === null || r.subproject_id === undefined);

export const summarizeAwards = (rows) => {
  const main = primary(rows);
  return { projects: main.length, dollars: main.reduce((sum, r) => sum + (r.award_amount ?? 0), 0) };
};

export const groupAwards = (rows, keyFn) => {
  const groups = new Map();
  for (const r of primary(rows)) {
    const keys = [keyFn(r)].flat().map((k) => String(k ?? '').trim()).filter(Boolean);
    for (const key of keys) {
      const g = groups.get(key) ?? { key, projects: 0, dollars: 0 };
      g.projects += 1;
      g.dollars += r.award_amount ?? 0;
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort((a, b) => b.dollars - a.dollars || b.projects - a.projects);
};

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export const medianYears = (rows) => {
  const spans = primary(rows)
    .filter((r) => r.project_start_date && r.project_end_date)
    .map((r) => (Date.parse(r.project_end_date) - Date.parse(r.project_start_date)) / YEAR_MS)
    .sort((a, b) => a - b);
  if (!spans.length) return null;
  const mid = Math.floor(spans.length / 2);
  const value = spans.length % 2 ? spans[mid] : (spans[mid - 1] + spans[mid]) / 2;
  return Math.round(value * 10) / 10;
};

export const detailFiscalYear = (date) => {
  const year = date.getUTCFullYear();
  return date.getUTCMonth() >= 3 ? year - 1 : year - 2;
};

export const parseRefseqHeader = (text) => ({
  release: Number(text.match(/Release (\d+)/)[1]),
  date: text.match(/Release \d+\s*\n\s*([A-Z][a-z]+ \d{1,2}, \d{4})/)[1],
  organisms: Number(text.match(/(\d+) organisms/)[1]),
  records: Number(text.match(/(\d+) records/)[1]),
});

export const enumLabels = (json) => {
  const out = {};
  for (const e of json) {
    const map = Object.fromEntries(e.values.map((v) => [v.value, v.legacyValue]));
    for (const piece of e.pieces) out[piece] = { ...(out[piece] ?? {}), ...map };
  }
  return out;
};

export const parseTaxonNames = (json) => Object.fromEntries(
  json.result.uids.map((uid) => json.result[uid]).filter((t) => t.commonname).map((t) => [t.scientificname, t.commonname]),
);

export const parseLinkCount = (json, linkname) =>
  (json.linksets?.[0]?.linksetdbs ?? []).filter((l) => l.linkname === linkname).reduce((sum, l) => sum + l.links.length, 0);
