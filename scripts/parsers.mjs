const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

const isoDay = (v) => {
  const m = String(v ?? '').match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

export const parseEinfo = (json) => {
  const info = json.einforesult.dbinfo[0];
  return {
    db: info.dbname,
    name: info.menuname,
    description: info.description,
    build: info.dbbuild ?? null,
    count: num(info.count),
    updated: isoDay(info.lastupdate),
    fields: (info.fieldlist ?? []).length,
    links: (info.linklist ?? []).length,
  };
};

export const parseCount = (json) => num(json?.esearchresult?.count);

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
