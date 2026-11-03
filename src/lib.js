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
  for (const [size, unit] of UNITS) {
    if (Math.abs(n) >= size) {
      const scaled = Math.round((n / size) * 10) / 10;
      return `${scaled}${unit}`;
    }
  }
  return String(Math.round(n));
};

export const pct = (ratio) => {
  const v = Math.round(ratio * 1000) / 10;
  return `${v}%`;
};

const NCBI = 'https://www.ncbi.nlm.nih.gov';

const REFSEQ = {
  AC: ['RefSeq alternate genomic', 'nuccore', 'Complete genomic molecule from an alternate assembly'],
  NC: ['RefSeq chromosome', 'nuccore', 'Complete genomic molecule, reference assembly'],
  NG: ['RefSeq genomic region', 'nuccore', 'Incomplete genomic region'],
  NT: ['RefSeq contig', 'nuccore', 'Genomic contig or scaffold, clone-based'],
  NW: ['RefSeq WGS contig', 'nuccore', 'Genomic contig or scaffold, primarily WGS'],
  NZ: ['RefSeq WGS genome', 'nuccore', 'Complete genome or unfinished WGS collection'],
  NM: ['RefSeq mRNA', 'nuccore', 'Curated or known transcript'],
  NR: ['RefSeq non-coding RNA', 'nuccore', 'Curated or known non-coding transcript'],
  XM: ['RefSeq predicted mRNA', 'nuccore', 'Computed by the eukaryotic annotation pipeline'],
  XR: ['RefSeq predicted ncRNA', 'nuccore', 'Computed by the eukaryotic annotation pipeline'],
  AP: ['RefSeq alternate protein', 'protein', 'Protein on an alternate assembly'],
  NP: ['RefSeq protein', 'protein', 'Curated or known protein'],
  YP: ['RefSeq genome-annotated protein', 'protein', 'Protein annotated on a genome without a transcript record'],
  XP: ['RefSeq predicted protein', 'protein', 'Computed by the eukaryotic annotation pipeline'],
  WP: ['RefSeq non-redundant protein', 'protein', 'One protein record shared by many prokaryotic genomes'],
};

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
    const [type, db, note] = REFSEQ[prefix];
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
