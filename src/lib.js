const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return NaN;
  return typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
};

export const exact = (v) => {
  const n = toNumber(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
};

const UNITS = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

export const compact = (v) => {
  const n = toNumber(v);
  if (!Number.isFinite(n)) return '—';
  const scaledBy = (size) => Math.round((n / size) * 10) / 10;
  for (const [i, [size, unit]] of UNITS.entries()) {
    if (Math.abs(n) >= size) {
      const scaled = scaledBy(size);
      return Math.abs(scaled) >= 1000 && i > 0 ? `${scaledBy(UNITS[i - 1][0])}${UNITS[i - 1][1]}` : `${scaled}${unit}`;
    }
  }
  return Math.abs(Math.round(n)) >= 1000 ? `${scaledBy(1e3)}K` : String(Math.round(n));
};

export const pct = (ratio) => {
  const v = Math.round(ratio * 1000) / 10;
  return `${v}%`;
};

const NCBI = 'https://www.ncbi.nlm.nih.gov';

const REFSEQ = {
  NC: ['RefSeq chromosome', 'nuccore', 'DNA', 'Chromosomes; linkage groups'],
  AC: ['RefSeq chromosome (AC_)', 'nuccore', 'DNA', 'Chromosomes; linkage groups'],
  NZ: ['RefSeq WGS genome', 'nuccore', 'DNA', 'Chromosomes and scaffolds, mostly prokaryotic genomes'],
  NT: ['RefSeq scaffold', 'nuccore', 'DNA', 'Scaffolds'],
  NW: ['RefSeq scaffold (NW_)', 'nuccore', 'DNA', 'Scaffolds'],
  NG: ['RefSeq genomic region', 'nuccore', 'DNA', 'Genomic regions such as RefSeqGene and rRNA loci'],
  NM: ['RefSeq mRNA', 'nuccore', 'mRNA', 'Protein-coding transcripts, curated ("known")'],
  XM: ['RefSeq predicted mRNA', 'nuccore', 'mRNA', 'Protein-coding transcripts from the annotation pipeline ("model")'],
  NR: ['RefSeq non-coding RNA', 'nuccore', 'RNA', 'Non-protein-coding transcripts, curated ("known")'],
  XR: ['RefSeq predicted ncRNA', 'nuccore', 'RNA', 'Non-protein-coding transcripts from the pipeline ("model")'],
  NP: ['RefSeq protein', 'protein', 'protein', 'Proteins on NM_ transcripts ("known")'],
  AP: ['RefSeq protein (AP_)', 'protein', 'protein', 'Proteins on AC_ genomic accessions'],
  XP: ['RefSeq predicted protein', 'protein', 'protein', 'Proteins on XM_ transcripts ("model")'],
  YP: ['RefSeq protein (YP_)', 'protein', 'protein', 'Proteins on genomic molecules with no transcript record'],
  WP: ['RefSeq non-redundant protein', 'protein', 'protein', 'Non-redundant across strains and species; always version .1'],
};

export const REFSEQ_PREFIXES = Object.entries(REFSEQ).map(([code, [type, , molecule, use]]) => ({
  prefix: `${code}_`,
  type,
  molecule,
  use,
}));

const SRA_KIND = { R: 'run', X: 'experiment', S: 'sample', P: 'study' };
const GEO_KIND = { SE: 'series', SM: 'sample', PL: 'platform', DS: 'dataset' };
const PUBCHEM = {
  CID: ['PubChem CID', 'compound', 'Compound: one unique chemical structure'],
  SID: ['PubChem SID', 'substance', 'Substance: one depositor-supplied record'],
  AID: ['PubChem AID', 'bioassay', 'BioAssay: one deposited experiment'],
};

const rule = (re, build) => ({ re, build });

const RULES = [
  rule(/^PMC(\d+)$/i, (m) => ({
    type: 'PMCID', id: `PMC${m[1]}`, db: 'PubMed Central',
    url: `https://pmc.ncbi.nlm.nih.gov/articles/PMC${m[1]}/`,
    note: 'Full-text article in the PMC archive',
  })),
  rule(/^NCT(\d{8})$/i, (m) => ({
    type: 'NCT Number', id: `NCT${m[1]}`, db: 'ClinicalTrials.gov',
    url: `https://clinicaltrials.gov/study/NCT${m[1]}`,
    note: 'NCT plus 8 digits, one per registered study',
  })),
  rule(/^rs(\d+)$/i, (m) => ({
    type: 'rsID', id: `rs${m[1]}`, db: 'dbSNP',
    url: `${NCBI}/snp/rs${m[1]}`,
    note: 'Reference SNP cluster',
  })),
  rule(/^(AC|NC|NG|NT|NW|NZ|NM|NR|XM|XR|AP|NP|YP|XP|WP)_(\d+(?:\.\d+)?)$/i, (m) => {
    const prefix = m[1].toUpperCase();
    const [type, db, , note] = REFSEQ[prefix];
    const id = `${prefix}_${m[2]}`;
    return { type, id, db: `RefSeq (${db})`, url: `${NCBI}/${db}/${id}`, note };
  }),
  rule(/^GC([AF])_(\d{9}(?:\.\d+)?)$/i, (m) => {
    const src = m[1].toUpperCase();
    const id = `GC${src}_${m[2]}`;
    return {
      type: src === 'F' ? 'RefSeq assembly' : 'GenBank assembly', id, db: 'Datasets / Assembly',
      url: `${NCBI}/datasets/genome/${id}/`,
      note: src === 'F' ? 'GCF = RefSeq copy of an assembly' : 'GCA = submitted INSDC assembly',
    };
  }),
  rule(/^PRJ([NED][A-Z])(\d+)$/i, (m) => {
    const id = `PRJ${m[1].toUpperCase()}${m[2]}`;
    return { type: 'BioProject', id, db: 'BioProject', url: `${NCBI}/bioproject/${id}`, note: 'Umbrella record for a research effort' };
  }),
  rule(/^SAM(N|EA|D)(\d+)$/i, (m) => {
    const id = `SAM${m[1].toUpperCase()}${m[2]}`;
    return { type: 'BioSample', id, db: 'BioSample', url: `${NCBI}/biosample/${id}`, note: 'One biological source material' };
  }),
  rule(/^([SED])R([RXSP])(\d{6,})$/i, (m) => {
    const id = `${m[1].toUpperCase()}R${m[2].toUpperCase()}${m[3]}`;
    return {
      type: `SRA ${SRA_KIND[m[2].toUpperCase()]}`, id, db: 'Sequence Read Archive',
      url: `${NCBI}/sra/${id}`,
      note: 'S = NCBI, E = EBI, D = DDBJ origin',
    };
  }),
  rule(/^G(SE|SM|PL|DS)(\d+)$/i, (m) => {
    const id = `G${m[1].toUpperCase()}${m[2]}`;
    return {
      type: `GEO ${GEO_KIND[m[1].toUpperCase()]}`, id, db: 'Gene Expression Omnibus',
      url: `${NCBI}/geo/query/acc.cgi?acc=${id}`,
      note: 'Functional genomics submission',
    };
  }),
  rule(/^phs(\d{6})((?:\.v\d+\.p\d+)?)$/i, (m) => {
    const id = `phs${m[1]}${m[2].toLowerCase()}`;
    return {
      type: 'dbGaP study', id, db: 'dbGaP',
      url: `${NCBI}/projects/gap/cgi-bin/study.cgi?study_id=${id}`,
      note: 'Controlled-access genotype/phenotype study',
    };
  }),
  rule(/^(VCV|RCV|SCV)(\d{9}(?:\.\d+)?)$/i, (m) => {
    const kind = { VCV: 'variation', RCV: 'record', SCV: 'submission' }[m[1].toUpperCase()];
    const id = `${m[1].toUpperCase()}${m[2]}`;
    return { type: `ClinVar ${kind}`, id, db: 'ClinVar', url: `${NCBI}/clinvar/?term=${id}`, note: 'Variant interpretation accession' };
  }),
  rule(/^([DQ])(\d{6}|\d{9})$/i, (m) => {
    const id = `${m[1].toUpperCase()}${m[2]}`;
    const type = m[1].toUpperCase() === 'D' ? 'MeSH descriptor' : 'MeSH qualifier';
    return { type, id, db: 'MeSH', url: `https://meshb.nlm.nih.gov/record/ui?ui=${id}`, note: 'Medical Subject Headings unique ID' };
  }),
  rule(/^C(\d{6}|\d{9})$/i, (m) => {
    const id = `C${m[1]}`;
    return { type: 'MeSH supplementary concept', id, db: 'MeSH', url: `https://meshb.nlm.nih.gov/record/ui?ui=${id}`, note: 'Supplementary Concept Record, mostly chemicals' };
  }),
  rule(/^C(\d{7})$/i, (m) => {
    const id = `C${m[1]}`;
    return { type: 'UMLS CUI', id, db: 'UMLS Metathesaurus', url: `https://uts.nlm.nih.gov/uts/umls/concept/${id}`, note: 'Concept Unique Identifier: C plus 7 digits' };
  }),
  rule(/^cd(\d{5})$/i, (m) => {
    const id = `cd${m[1]}`;
    return { type: 'CDD', id, db: 'Conserved Domain Database', url: `${NCBI}/Structure/cdd/${id}`, note: 'NCBI-curated conserved domain' };
  }),
  rule(/^([nde])sv(\d+)$/i, (m) => {
    const id = `${m[1].toLowerCase()}sv${m[2]}`;
    return { type: 'dbVar variant', id, db: 'dbVar', url: `${NCBI}/dbvar/variants/${id}/`, note: 'Structural variant region' };
  }),
  rule(/^NBK(\d+)$/i, (m) => {
    const id = `NBK${m[1]}`;
    return { type: 'Bookshelf ID', id, db: 'Bookshelf', url: `${NCBI}/books/${id}/`, note: 'Book, chapter or report' };
  }),
  rule(/^(CID|SID|AID)\s*:?\s*(\d+)$/i, (m) => {
    const [type, path, note] = PUBCHEM[m[1].toUpperCase()];
    return { type, id: m[2], db: 'PubChem', url: `https://pubchem.ncbi.nlm.nih.gov/${path}/${m[2]}`, note };
  }),
  rule(/^(?:txid|taxid|taxon)\s*:?\s*(\d+)$/i, (m) => ({
    type: 'Taxonomy ID', id: m[1], db: 'Taxonomy',
    url: `${NCBI}/Taxonomy/Browser/wwwtax.cgi?id=${m[1]}`,
    note: 'Node in the NCBI Taxonomy tree',
  })),
  rule(/^GeneID\s*:?\s*(\d+)$/i, (m) => ({
    type: 'Gene ID', id: m[1], db: 'Gene', url: `${NCBI}/gene/${m[1]}`, note: 'Integer ID for one gene record',
  })),
  rule(/^RXCUI\s*:?\s*(\d+)$/i, (m) => ({
    type: 'RxNorm RXCUI', id: m[1], db: 'RxNorm',
    url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${m[1]}`,
    note: 'RxNorm concept unique identifier',
  })),
  rule(/^(\d{4}-\d{3}[\dX])$/i, (m) => {
    const id = m[1].toUpperCase();
    return { type: 'ISSN', id, db: 'NLM Catalog', url: `${NCBI}/nlmcatalog/?term=${id}%5Bissn%5D`, note: 'Serial number, looked up in the NLM Catalog' };
  }),
  rule(/^(10\.\d{4,9}\/\S+)$/, (m) => ({
    type: 'DOI', id: m[1], db: 'PubMed',
    url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(m[1])}%5Bdoi%5D`,
    note: 'Digital Object Identifier, searched in PubMed',
  })),
  rule(/^(?=[1-9][A-Z0-9]{3}$)(?=.*[A-Z])([1-9][A-Z0-9]{3})$/i, (m) => {
    const id = m[1].toUpperCase();
    return { type: 'PDB ID', id, db: 'Structure (MMDB)', url: `${NCBI}/Structure/pdb/${id}`, note: '4-character Protein Data Bank code' };
  }),
  rule(/^([A-Z]{3}\d{5}(?:\d{2})?(?:\.\d+)?)$/i, (m) => {
    const id = m[1].toUpperCase();
    return { type: 'GenBank protein', id, db: 'Protein', url: `${NCBI}/protein/${id}`, note: '3 letters + 5 or 7 digits' };
  }),
  rule(/^((?:[A-Z]\d{5}|[A-Z]{2}\d{6}|[A-Z]{2}\d{8}|[A-Z]{4}\d{8,10}|[A-Z]{6}\d{9,11})(?:\.\d+)?)$/i, (m) => {
    const id = m[1].toUpperCase();
    return { type: 'GenBank nucleotide', id, db: 'Nucleotide', url: `${NCBI}/nuccore/${id}`, note: 'INSDC accession shared by GenBank, ENA and DDBJ' };
  }),
  rule(/^(?:PMID\s*:?\s*)?(\d{1,9})$/i, (m) => {
    const id = String(Number(m[1]));
    return { type: 'PMID', id, db: 'PubMed', url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, note: 'PubMed unique identifier' };
  }),
];

export const identify = (input) => {
  const value = String(input ?? '').trim();
  if (!value) return null;
  for (const { re, build } of RULES) {
    const m = value.match(re);
    if (m) return build(m);
  }
  return null;
};

const SEARCH_HOME = {
  pubmed: 'https://pubmed.ncbi.nlm.nih.gov/',
  pmc: 'https://pmc.ncbi.nlm.nih.gov/search/',
};

export const searchUrl = (db, term) => {
  const home = SEARCH_HOME[db] ?? `${NCBI}/${db}/`;
  return term ? `${home}?term=${encodeURIComponent(term)}` : db === 'pmc' ? 'https://pmc.ncbi.nlm.nih.gov/' : home;
};

const EUTILS_ONLY = new Set(['annotinfo', 'blastdbinfo', 'grasp', 'orgtrack', 'seqannot']);

export const dbHome = (db) => (EUTILS_ONLY.has(db) ? `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?db=${db}` : searchUrl(db));

export const eutilsUrl = (tool, params) => {
  const query = Object.entries({ ...params, retmode: 'json' })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${tool}.fcgi?${query}`;
};

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const matches = (text, query) => {
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const hay = fold(text);
  return terms.every((t) => hay.includes(t));
};

export const filterTimeline = (items, { tags, orgs, query } = {}) =>
  items.filter((i) =>
    (!tags?.length || tags.includes(i.tag)) &&
    (!orgs?.length || orgs.includes(i.org)) &&
    matches(`${i.date} ${i.org} ${i.tag} ${i.text}`, query));

export const sortRows = (rows, key, dir = 'asc') => {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null || x === undefined) return y === null || y === undefined ? 0 : 1;
    if (y === null || y === undefined) return -1;
    if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
    return String(x).localeCompare(String(y)) * sign;
  });
};

export const logShare = (value, max) => {
  if (!value || value <= 0 || !max) return 0;
  return Math.min(100, (Math.log10(value + 1) / Math.log10(max + 1)) * 100);
};

export const share = (value, max) => (max > 0 ? Math.min(100, (value / max) * 100) : 0);

export const niceTicks = (max, count) => {
  if (!max || max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
};

export const yearOf = (date) => Number(String(date).slice(0, 4));

export const decade = (date) => `${Math.floor(yearOf(date) / 10) * 10}s`;

const KEEP = new Set(['NIH', 'FED']);

export const labelize = (value) => {
  if (value === 'NA') return 'Not applicable';
  if (KEEP.has(value)) return value;
  const words = value.replace(/([A-Z])(\d)/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const stamp = (iso) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

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

export const retry = async (fn, { tries = 3, wait = 1000 } = {}) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= tries) throw error;
      await new Promise((r) => setTimeout(r, wait * 2 ** (attempt - 1)));
    }
  }
};

export const LENSES = [
  { id: 'all', label: 'Everything', hint: 'Every section, for biomedical researchers' },
  { id: 'bioinfo', label: 'Bioinformatics', hint: 'Databases, sequence data, APIs, identifiers' },
  { id: 'stats', label: 'Biostatistics', hint: 'Literature counts, methods, trial design' },
  { id: 'funding', label: 'Funding & time', hint: 'NIH dollars, release cadences, history' },
];

const LENS_IDS = new Set(LENSES.map((l) => l.id));

export const readLens = (search) => {
  const value = new URLSearchParams(search).get('lens');
  return LENS_IDS.has(value) ? value : 'all';
};

export const inLens = (tags, lens) => {
  if (lens === 'all') return true;
  const list = String(tags ?? '').split(/\s+/).filter(Boolean);
  return list.length === 0 || list.includes(lens);
};

export const lensSearch = (search, lens) => {
  const params = new URLSearchParams(search);
  if (lens === 'all') params.delete('lens');
  else params.set('lens', lens);
  const out = params.toString();
  return out ? `?${out}` : '';
};

export const ordinal = (n) => {
  const suffix = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
};

const itemCount = (snap, group, id) =>
  snap.groups?.find((g) => g.id === group)?.items.find((i) => i.id === id)?.count ?? null;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const longDate = (text) => {
  const [y, m, d] = text.split('-');
  const month = MONTHS[Number(m) - 1];
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
};

const CT = 'https://clinicaltrials.gov';

export const liveOddities = (snap) => {
  const out = [];
  const add = (text, href) => out.push({ text, href });
  const ex = snap.extremes;
  const stop = ex?.stopword;
  if (stop?.ignored) {
    add(`Search PubMed for “${stop.word}” and you get ${exact(stop.count)} results. It is a stopword, dropped from every query.`,
      searchUrl('pubmed', stop.word));
  }
  const stops = snap.trialfate?.stops;
  const safety = stops?.reasons.find((r) => r.id === 'safety')?.count;
  if (stops && safety && stops.notSafety > safety) {
    add(`${exact(stops.notSafety)} terminated trials say safety was not the reason. ${exact(safety)} say it was.`,
      `${CT}/search?aggFilters=status:ter`);
  }
  const early = ex?.trials?.earliest;
  if (early && yearOf(early.date) < ex.trials.longAgo.year) {
    const status = (snap.clinicaltrials?.labels?.OverallStatus?.[early.status] ?? labelize(early.status)).toLowerCase();
    add(`${early.id}, ${/^[aeiou]/.test(status) ? 'an' : 'a'} ${status} study, gives its start date as ${longDate(early.date)}. It was first posted in ${yearOf(early.posted)}.`,
      `${CT}/study/${early.id}`);
  }
  const late = ex?.trials;
  if (late?.farFuture?.count) {
    add(`${exact(late.farFuture.count)} studies plan to finish in ${late.farFuture.year} or later. ${late.latest.id} runs to ${longDate(late.latest.date)}.`,
      `${CT}/study/${late.latest.id}`);
  }
  const awards = ex?.awards;
  if (awards?.exactlyOne) {
    add(`${exact(awards.exactlyOne)} NIH awards in FY${awards.fy} were for exactly $1.`, 'https://reporter.nih.gov/');
  }
  if (ex?.uncultured) {
    add(`${exact(ex.uncultured)} GenBank sequences come from “uncultured bacterium”: microbes known only from their DNA.`,
      searchUrl('nuccore', '"uncultured bacterium"[orgn]'));
  }
  const ct = snap.clinicaltrials ?? {};
  if (ct.biggestEnrollment) {
    add(`The largest stated enrollment on ClinicalTrials.gov is ${exact(ct.biggestEnrollment.count)} people, in ${ct.biggestEnrollment.id}.`,
      `${CT}/study/${ct.biggestEnrollment.id}`);
  }
  const topCondition = ct.fields?.Condition?.top?.[0];
  if (topCondition?.value === 'Healthy') {
    add(`"Healthy" is the most listed condition on ClinicalTrials.gov: ${exact(topCondition.count)} studies give it, word for word.`,
      `${CT}/api/v2/stats/field/values?fields=Condition`);
  }
  const vus = itemCount(snap, 'clinvar', 'cv-vus');
  const path = itemCount(snap, 'clinvar', 'cv-path');
  if (vus && path && vus > path) {
    add(`ClinVar holds ${(vus / path).toFixed(1)} variants of uncertain significance for every pathogenic one.`,
      'https://www.ncbi.nlm.nih.gov/clinvar/');
  }
  return out;
};

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

export const labelStep = (count, width, gap = 32) =>
  STEPS.find((step) => Math.ceil(count / step) * gap <= width) ?? STEPS.at(-1);

export const squarify = (items, width, height) => {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const scale = (width * height) / total;
  const queue = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: item.value * scale }));
  const out = [];
  const box = { x: 0, y: 0, w: width, h: height };
  const worst = (row, side) => {
    const sum = row.reduce((a, r) => a + r.area, 0);
    const max = Math.max(...row.map((r) => r.area));
    const min = Math.min(...row.map((r) => r.area));
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };
  const place = (row) => {
    const sum = row.reduce((a, r) => a + r.area, 0);
    if (box.w >= box.h) {
      const cw = sum / box.h;
      let cy = box.y;
      for (const r of row) {
        const ch = r.area / cw;
        out.push({ ...r.item, x: box.x, y: cy, w: cw, h: ch });
        cy += ch;
      }
      box.x += cw;
      box.w -= cw;
    } else {
      const rh = sum / box.w;
      let cx = box.x;
      for (const r of row) {
        const cw = r.area / rh;
        out.push({ ...r.item, x: cx, y: box.y, w: cw, h: rh });
        cx += cw;
      }
      box.y += rh;
      box.h -= rh;
    }
  };
  let row = [];
  while (queue.length) {
    const side = Math.min(box.w, box.h);
    if (!row.length || worst([...row, queue[0]], side) <= worst(row, side)) {
      row.push(queue.shift());
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
};

export const waffle = (parts, cells = 100) => {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const raw = parts.map((p) => (p.value / total) * cells);
  const counts = raw.map(Math.floor);
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  const missing = cells - counts.reduce((a, b) => a + b, 0);
  for (let k = 0; k < missing; k += 1) counts[order[k].i] += 1;
  return parts.flatMap((p, i) => Array(counts[i]).fill(p.key));
};

export const scaleLinear = ([d0, d1], [r0, r1]) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

export const scaleLog = ([d0, d1], [r0, r1]) => {
  const l0 = Math.log10(d0);
  const l1 = Math.log10(d1);
  return (v) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0);
};

export const logTicks = (min, max) => {
  const out = [];
  for (let k = Math.ceil(Math.log10(min)); k <= Math.floor(Math.log10(max)); k += 1) out.push(10 ** k);
  return out;
};

export const stack = (rows, keys) => {
  const base = rows.map(() => 0);
  return keys.map((key) => ({
    key,
    points: rows.map((r, i) => {
      const point = [base[i], base[i] + r[key]];
      base[i] += r[key];
      return point;
    }),
  }));
};

const clampSpan = ([a, b], [lo, hi]) => {
  const span = b - a;
  if (a < lo) return [lo, lo + span];
  if (b > hi) return [hi - span, hi];
  return [a, b];
};

export const zoomDomain = ([a, b], center, factor, [lo, hi], minSpan = 1) => {
  const span = Math.min(Math.max((b - a) * factor, minSpan), hi - lo);
  const ratio = (center - a) / (b - a);
  const start = center - ratio * span;
  return clampSpan([start, start + span], [lo, hi]);
};

export const panDomain = ([a, b], delta, limits) => clampSpan([a + delta, b + delta], limits);

const WORD_UNITS = [[1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];

export const wordy = (n) => {
  const unit = WORD_UNITS.find(([size]) => n >= size);
  if (!unit) return exact(n);
  const v = n / unit[0];
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${Number(v.toFixed(digits))} ${unit[1]}`;
};

export const easeOut = (t) => 1 - (1 - t) ** 3;

export const spread = (positions, gap, lo, hi) => {
  const order = positions.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  let blocks = order.map((o) => ({ items: [o], top: o.p }));
  const fit = (b) => Math.min(Math.max(b.top, lo), hi - (b.items.length - 1) * gap);
  let merged = true;
  while (merged) {
    merged = false;
    const next = [];
    for (const b of blocks) {
      const prev = next.at(-1);
      if (prev && fit(prev) + prev.items.length * gap > fit(b)) {
        const items = [...prev.items, ...b.items];
        const mean = items.reduce((n, o) => n + o.p, 0) / items.length;
        next[next.length - 1] = { items, top: mean - ((items.length - 1) * gap) / 2 };
        merged = true;
      } else next.push(b);
    }
    blocks = next;
  }
  const out = [];
  for (const b of blocks) b.items.forEach((o, k) => { out[o.i] = fit(b) + k * gap; });
  return out;
};

export const doublingMonths = (fromMs, fromValue, toMs, toValue) => {
  const months = (toMs - fromMs) / (1000 * 3600 * 24 * 30.4375);
  return months / Math.log2(toValue / fromValue);
};

export const medianBand = (bands) => {
  const half = bands.reduce((n, b) => n + b.count, 0) / 2;
  let seen = 0;
  return bands.find((b) => {
    seen += b.count;
    return seen >= half;
  });
};
