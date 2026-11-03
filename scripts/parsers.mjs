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

const STOP_RULES = [
  ['enrollment', 'Enrollment or accrual', /accru|enrol|recruit|inclusion|participation|(few|no|insufficient|lack of|not enough|low number of|limited) (eligible )?(patients|subjects|participants|volunteers)/i],
  ['business', 'Sponsor or business decision', /sponsor|business|company|strateg|commercial|portfolio|priorit|corporate|market/i],
  ['funding', 'Funding', /fund|budget|financ|grant|money|\bcost/i],
  ['investigator', 'Investigator left', /\bpi\b|investigator|left (the )?(institution|university|hospital|company|center|centre)|relocat|retire/i],
  ['efficacy', 'Futility or no efficacy', /futil|efficacy|ineffective|lack of (benefit|effect|response)|no (benefit|effect)|not effective/i],
  ['covid', 'COVID-19', /covid|pandemic|sars-cov|coronavirus/i],
  ['supply', 'Drug or device supply', /supply|manufactur|(drug|device|product|medication) (shortage|not available|unavailab)/i],
  ['safety', 'Safety or toxicity', /safety|adverse|toxic|\bdeaths?\b|\bdied\b|side effect|\bharm/i],
];

const DENIAL = /\b(not|no|unrelated to|nothing to do with|non|never|without)\b[^.;]{0,50}?\b(safety|efficacy|toxicit\w*|adverse\w*)\b(\s*(or|and|nor|\/)\s*(safety|efficacy|toxicit\w*|adverse\w*))?[^.;]{0,20}/gi;
const NOISE = /data (and |& )?safety monitoring|\bdsmb\b|\bdmc\b|safety (data|follow[- ]?up|population|analysis|run[- ]?in)|safety of (the )?(study )?(participants|patients|subjects|staff)|(pi|investigator)[^.;]{0,30}(died|death|passed away)|(death|passing) of (the )?(pi|principal investigator|investigator)/gi;

export const classifyStop = (text) => {
  const denials = text.match(DENIAL) ?? [];
  const notSafety = denials.some((d) => /safety|toxic|adverse/i.test(d));
  const rest = text.replace(DENIAL, ' ').replace(NOISE, ' ');
  return { reasons: STOP_RULES.filter(([, , re]) => re.test(rest)).map(([id]) => id), notSafety };
};

export const stopReasons = (rows) => {
  const tally = new Map(STOP_RULES.map(([id, label]) => [id, { id, label, count: 0, industry: 0 }]));
  let notSafety = 0;
  let unclassified = 0;
  for (const row of rows) {
    const { reasons, notSafety: denied } = classifyStop(row.why);
    if (denied) notSafety += 1;
    if (!reasons.length) unclassified += 1;
    for (const id of reasons) {
      const t = tally.get(id);
      t.count += 1;
      if (row.cls === 'INDUSTRY') t.industry += 1;
    }
  }
  return {
    total: rows.length,
    industry: rows.filter((r) => r.cls === 'INDUSTRY').length,
    notSafety,
    unclassified,
    reasons: [...tally.values()].sort((a, b) => b.count - a.count),
  };
};

const MONTH_DAYS = 30.4375;
const dayOf = (text) => {
  const [y, m, d = '15'] = text.split('-');
  return Date.UTC(Number(y), Number(m) - 1, Number(d)) / 86400000;
};
const middle = (sorted) => {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const resultsLag = (rows, { from, to, cap = 48, minClass = 100 }) => {
  const months = Array(cap + 1).fill(0);
  const spans = [];
  const classes = new Map();
  let negative = 0;
  for (const row of rows) {
    const year = Number(row.pc.slice(0, 4));
    if (year < from || year > to) continue;
    const span = (dayOf(row.submit) - dayOf(row.pc)) / MONTH_DAYS;
    if (span < 0) {
      negative += 1;
      continue;
    }
    months[Math.min(cap, Math.floor(span))] += 1;
    spans.push(span);
    const c = classes.get(row.cls) ?? { cls: row.cls, n: 0, on: 0, spans: [] };
    c.n += 1;
    if (span < 12) c.on += 1;
    c.spans.push(span);
    classes.set(row.cls, c);
  }
  const round = (v) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    from,
    to,
    n: spans.length,
    negative,
    median: round(middle(spans.sort((a, b) => a - b))),
    within12: spans.filter((v) => v < 12).length / spans.length,
    peak: months.slice(0, cap).indexOf(Math.max(...months.slice(0, cap))),
    months,
    byClass: [...classes.values()].filter((c) => c.n >= minClass).sort((a, b) => b.n - a.n)
      .map((c) => ({ cls: c.cls, n: c.n, within12: c.on / c.n, median: round(middle(c.spans.sort((a, b) => a - b))) })),
  };
};

export const retractionYears = (xml) => {
  const out = {};
  for (const chunk of xml.split('<PubmedArticle>').slice(1)) {
    const pmid = chunk.match(/<PMID Version="1">(\d+)<\/PMID>/)?.[1];
    const years = [...chunk.matchAll(/<CommentsCorrections RefType="RetractionIn"[^>]*>\s*<RefSource>([^<]*)<\/RefSource>/g)]
      .map((m) => Number(m[1].match(/\b(1[89]|20)\d{2}\b/)?.[0]))
      .filter(Boolean);
    if (pmid && years.length) out[pmid] = Math.max(...years);
  }
  return out;
};

const CHROMOSOMES = [...Array.from({ length: 22 }, (_, i) => String(i + 1)), 'X', 'Y', 'MT'];

export const geneExtremes = (records) => {
  const placed = records.map((r) => {
    const g = (r.genomicinfo ?? []).find((i) => String(i.chraccver).startsWith('NC_'));
    if (!g) return null;
    return {
      id: String(r.uid),
      symbol: r.name,
      chr: g.chrloc,
      span: Math.abs(Number(g.chrstop) - Number(g.chrstart)) + 1,
      exons: Number(g.exoncount),
      description: r.description,
    };
  }).filter(Boolean);
  const best = (score) => placed.reduce((a, b) => (score(b) > score(a) ? b : a));
  const counts = new Map();
  for (const g of placed) counts.set(g.chr, (counts.get(g.chr) ?? 0) + 1);
  return {
    genes: records.length,
    placed: placed.length,
    longest: best((g) => g.span),
    shortest: best((g) => -g.span),
    mostExons: best((g) => g.exons),
    singleExon: placed.filter((g) => g.exons === 1).length,
    byChromosome: CHROMOSOMES.filter((c) => counts.has(c)).map((chr) => ({ chr, genes: counts.get(chr) })),
  };
};
