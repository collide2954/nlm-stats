export const ENTREZ_DBS = [
  'pubmed', 'protein', 'nuccore', 'ipg', 'nucleotide', 'structure', 'genome', 'gap', 'grasp',
  'annotinfo', 'assembly', 'bioproject', 'biosample', 'blastdbinfo', 'books', 'cdd', 'clinvar',
  'dbvar', 'gene', 'gds', 'geoprofiles', 'medgen', 'mesh', 'nlmcatalog', 'omim', 'orgtrack',
  'pmc', 'proteinclusters', 'pcassay', 'protfam', 'pccompound', 'pcsubstance', 'seqannot', 'snp',
  'sra', 'taxonomy', 'biocollections', 'gtr',
];

const q = (id, db, label, term) => ({ id, db, label, term });

export const QUERY_GROUPS = [
  {
    id: 'types',
    title: 'PubMed by publication type',
    items: [
      q('pt-journal', 'pubmed', 'Journal Article', 'journal article[pt]'),
      q('pt-review', 'pubmed', 'Review', 'review[pt]'),
      q('pt-case', 'pubmed', 'Case Reports', 'case reports[pt]'),
      q('pt-letter', 'pubmed', 'Letter', 'letter[pt]'),
      q('pt-comment', 'pubmed', 'Comment', 'comment[pt]'),
      q('pt-trial', 'pubmed', 'Clinical Trial', 'clinical trial[pt]'),
      q('pt-editorial', 'pubmed', 'Editorial', 'editorial[pt]'),
      q('pt-rct', 'pubmed', 'Randomized Controlled Trial', 'randomized controlled trial[pt]'),
      q('pt-historical', 'pubmed', 'Historical Article', 'historical article[pt]'),
      q('pt-systematic', 'pubmed', 'Systematic Review', 'systematic review[pt]'),
      q('pt-meta', 'pubmed', 'Meta-Analysis', 'meta-analysis[pt]'),
      q('pt-biography', 'pubmed', 'Biography', 'biography[pt]'),
      q('pt-erratum', 'pubmed', 'Published Erratum', 'published erratum[pt]'),
      q('pt-preprint', 'pubmed', 'Preprint', 'preprint[pt]'),
      q('pt-portrait', 'pubmed', 'Portrait', 'portrait[pt]'),
      q('pt-retracted', 'pubmed', 'Retracted Publication', 'retracted publication[pt]'),
      q('pt-retraction', 'pubmed', 'Retraction Notice', 'retraction notice[pt]'),
      q('pt-concern', 'pubmed', 'Expression of Concern', '"expression of concern"[pt]'),
      q('pt-duplicate', 'pubmed', 'Duplicate Publication', 'duplicate publication[pt]'),
    ],
  },
  {
    id: 'languages',
    title: 'PubMed by language',
    items: [
      q('la-eng', 'pubmed', 'English', 'english[la]'),
      q('la-ger', 'pubmed', 'German', 'german[la]'),
      q('la-fre', 'pubmed', 'French', 'french[la]'),
      q('la-rus', 'pubmed', 'Russian', 'russian[la]'),
      q('la-jpn', 'pubmed', 'Japanese', 'japanese[la]'),
      q('la-spa', 'pubmed', 'Spanish', 'spanish[la]'),
      q('la-chi', 'pubmed', 'Chinese', 'chinese[la]'),
      q('la-ita', 'pubmed', 'Italian', 'italian[la]'),
      q('la-pol', 'pubmed', 'Polish', 'polish[la]'),
      q('la-por', 'pubmed', 'Portuguese', 'portuguese[la]'),
      q('la-dut', 'pubmed', 'Dutch', 'dutch[la]'),
      q('la-cze', 'pubmed', 'Czech', 'czech[la]'),
      q('la-hun', 'pubmed', 'Hungarian', 'hungarian[la]'),
      q('la-swe', 'pubmed', 'Swedish', 'swedish[la]'),
      q('la-dan', 'pubmed', 'Danish', 'danish[la]'),
      q('la-tur', 'pubmed', 'Turkish', 'turkish[la]'),
      q('la-kor', 'pubmed', 'Korean', 'korean[la]'),
      q('la-lat', 'pubmed', 'Latin', 'latin[la]'),
    ],
  },
  {
    id: 'organisms',
    title: 'PubMed by organism (MeSH)',
    items: [
      q('mh-humans', 'pubmed', 'Humans', 'humans[mh]'),
      q('mh-mice', 'pubmed', 'Mice', 'mice[mh]'),
      q('mh-rats', 'pubmed', 'Rats', 'rats[mh]'),
      q('mh-dogs', 'pubmed', 'Dogs', 'dogs[mh]'),
      q('mh-cattle', 'pubmed', 'Cattle', 'cattle[mh]'),
      q('mh-swine', 'pubmed', 'Swine', 'swine[mh]'),
      q('mh-rabbits', 'pubmed', 'Rabbits', 'rabbits[mh]'),
      q('mh-ecoli', 'pubmed', 'Escherichia coli', '"escherichia coli"[mh]'),
      q('mh-yeast', 'pubmed', 'Saccharomyces cerevisiae', '"saccharomyces cerevisiae"[mh]'),
      q('mh-fly', 'pubmed', 'Drosophila', 'drosophila[mh]'),
      q('mh-zebrafish', 'pubmed', 'Zebrafish', 'zebrafish[mh]'),
      q('mh-arabidopsis', 'pubmed', 'Arabidopsis', 'arabidopsis[mh]'),
      q('mh-worm', 'pubmed', 'Caenorhabditis elegans', '"caenorhabditis elegans"[mh]'),
      q('mh-macaque', 'pubmed', 'Macaca mulatta', '"macaca mulatta"[mh]'),
    ],
  },
  {
    id: 'subsets',
    title: 'PubMed subsets',
    items: [
      q('sb-medline', 'pubmed', 'MEDLINE-indexed', 'medline[sb]'),
      q('sb-abstract', 'pubmed', 'Has an abstract', 'hasabstract'),
      q('sb-free', 'pubmed', 'Free full text', 'free full text[sb]'),
      q('sb-pmc', 'pubmed', 'Linked to PMC', 'pubmed pmc[sb]'),
      q('sb-covid', 'pubmed', 'Mentions COVID-19', 'covid-19'),
      q('sb-pre1900', 'pubmed', 'Published before 1900', '1781:1899[dp]'),
      q('sb-1781', 'pubmed', 'Published in 1781', '1781[dp]'),
      q('nlm-indexed', 'nlmcatalog', 'Journals currently indexed for MEDLINE', 'currentlyindexed[All]'),
      q('pmc-oa', 'pmc', 'PMC open access articles', '"open access"[filter]'),
    ],
  },
  {
    id: 'mesh',
    title: 'MeSH records by type',
    items: [
      q('mesh-mh', 'mesh', 'Main headings (descriptors)', '"main heading"[TYPE]'),
      q('mesh-sh', 'mesh', 'Subheadings (qualifiers)', '"subheading"[TYPE]'),
      q('mesh-pt', 'mesh', 'Publication types', '"publication type"[TYPE]'),
      q('mesh-pa', 'mesh', 'Pharmacological actions', '"pharmacological action"[TYPE]'),
      q('mesh-sn', 'mesh', 'Substance names (supplementary)', '"substance name"[TYPE]'),
    ],
  },
  {
    id: 'molecular',
    title: 'Genes, taxa and variants',
    items: [
      q('gene-live', 'gene', 'Live Gene records, all species', 'alive[prop]'),
      q('gene-human', 'gene', 'Live human Gene records', '9606[taxid] AND alive[prop]'),
      q('gene-human-pc', 'gene', 'Human protein-coding genes', '9606[taxid] AND alive[prop] AND genetype protein coding[prop]'),
      q('tax-species', 'taxonomy', 'Taxonomy nodes at species rank', 'species[rank]'),
      q('tax-genus', 'taxonomy', 'Taxonomy nodes at genus rank', 'genus[rank]'),
      q('sra-human', 'sra', 'Human SRA experiments', '"homo sapiens"[orgn]'),
    ],
  },
  {
    id: 'clinvar',
    title: 'ClinVar by clinical significance',
    items: [
      q('cv-path', 'clinvar', 'Pathogenic', '"clinsig pathogenic"[Properties]'),
      q('cv-lpath', 'clinvar', 'Likely pathogenic', '"clinsig likely pathogenic"[Properties]'),
      q('cv-vus', 'clinvar', 'Uncertain significance', '"clinsig vus"[Properties]'),
      q('cv-lben', 'clinvar', 'Likely benign', '"clinsig likely benign"[Properties]'),
      q('cv-ben', 'clinvar', 'Benign', '"clinsig benign"[Properties]'),
    ],
  },
];

QUERY_GROUPS.push(
  {
    id: 'assembly',
    title: 'Genome assemblies by level',
    panel: 'seqdata',
    items: [
      q('asm-complete', 'assembly', 'Complete genome', '"complete genome"[Assembly Level]'),
      q('asm-chromosome', 'assembly', 'Chromosome', 'chromosome[Assembly Level]'),
      q('asm-scaffold', 'assembly', 'Scaffold', 'scaffold[Assembly Level]'),
      q('asm-contig', 'assembly', 'Contig', 'contig[Assembly Level]'),
      q('asm-refseq', 'assembly', 'Latest RefSeq assemblies', '"latest refseq"[filter]'),
    ],
  },
  {
    id: 'sra-platform',
    title: 'SRA experiments by platform',
    panel: 'seqdata',
    items: [
      q('sra-illumina', 'sra', 'Illumina', 'illumina[Platform]'),
      q('sra-ont', 'sra', 'Oxford Nanopore', '"oxford nanopore"[Platform]'),
      q('sra-pacbio', 'sra', 'PacBio SMRT', '"pacbio smrt"[Platform]'),
      q('sra-ion', 'sra', 'Ion Torrent', '"ion torrent"[Platform]'),
      q('sra-454', 'sra', '454 (LS454)', 'ls454[Platform]'),
      q('sra-capillary', 'sra', 'Capillary', 'capillary[Platform]'),
      q('sra-bgi', 'sra', 'BGISEQ / DNBSEQ', 'bgiseq[Platform]'),
      q('sra-element', 'sra', 'Element', 'element[Platform]'),
      q('sra-ultima', 'sra', 'Ultima', 'ultima[Platform]'),
    ],
  },
  {
    id: 'sra-strategy',
    title: 'SRA experiments by library strategy',
    panel: 'seqdata',
    items: [
      q('sra-amplicon', 'sra', 'Amplicon', 'amplicon[Strategy]'),
      q('sra-wgs', 'sra', 'WGS', 'wgs[Strategy]'),
      q('sra-rnaseq', 'sra', 'RNA-Seq', '"rna seq"[Strategy]'),
      q('sra-wxs', 'sra', 'Whole exome (WXS)', 'wxs[Strategy]'),
      q('sra-chip', 'sra', 'ChIP-Seq', '"chip seq"[Strategy]'),
      q('sra-bisulfite', 'sra', 'Bisulfite-Seq', '"bisulfite seq"[Strategy]'),
      q('sra-atac', 'sra', 'ATAC-seq', '"atac seq"[Strategy]'),
    ],
  },
);

const m = (id, label, term) => ({ id, label, term });

export const METHODS = [
  m('meta', 'Meta-analysis', 'meta-analysis[pt]'),
  m('survival', 'Survival analysis', '"survival analysis"[mh]'),
  m('cox', 'Proportional hazards', '"proportional hazards models"[mh]'),
  m('logistic', 'Logistic models', '"logistic models"[mh]'),
  m('bayes', 'Bayes theorem', '"bayes theorem"[mh]'),
  m('montecarlo', 'Monte Carlo', '"monte carlo method"[mh]'),
  m('propensity', 'Propensity score', '"propensity score"[mh]'),
  m('mr', 'Mendelian randomization', '"mendelian randomization analysis"[mh]'),
  m('ml', 'Machine learning', '"machine learning"[mh]'),
  m('dl', 'Deep learning', '"deep learning"[mh]'),
];

export const METHOD_YEARS = { from: 1985 };

export const ICS = [
  'NCI', 'NIAID', 'NHLBI', 'NIGMS', 'NIA', 'NINDS', 'NIDDK', 'NICHD', 'NIMH', 'NIDA',
  'NEI', 'NIAMS', 'NIEHS', 'NIAAA', 'NIDCD', 'NIBIB', 'NIDCR', 'NIMHD', 'OD', 'NHGRI',
  'NCATS', 'FIC', 'NCCIH', 'NINR', 'NLM',
];

export const ENROLLMENT_BANDS = [
  { from: 0, to: 0 },
  { from: 1, to: 20 },
  { from: 21, to: 50 },
  { from: 51, to: 100 },
  { from: 101, to: 500 },
  { from: 501, to: 1000 },
  { from: 1001, to: 10000 },
  { from: 10001, to: 'MAX' },
];

export const CT_DESIGN = ['DesignAllocation', 'DesignMasking', 'DesignPrimaryPurpose', 'DesignInterventionModel', 'EnrollmentType'];

export const PAPERS = [
  { pmid: '1', topic: 'PMID 1' },
  { pmid: '2231712', topic: 'BLAST' },
  { pmid: '9254694', topic: 'Gapped BLAST / PSI-BLAST' },
  { pmid: '8743683', topic: 'Entrez' },
  { pmid: '8412823', topic: 'UMLS' },
  { pmid: '10928714', topic: 'MeSH' },
  { pmid: '11125122', topic: 'dbSNP' },
  { pmid: '11752295', topic: 'GEO' },
  { pmid: '15608248', topic: 'RefSeq' },
  { pmid: '17898773', topic: 'dbGaP' },
  { pmid: '24234437', topic: 'ClinVar' },
  { pmid: '26400175', topic: 'PubChem' },
];

export const yearRange = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const ERAS = [
  { from: 1781, to: 1799 },
  ...yearRange(180, 193).map((d) => ({ from: d * 10, to: d * 10 + 9 })),
  { from: 1940, to: 1944 },
];

const ts = (id, label, term) => ({ id, label, term });

export const TYPE_SERIES = {
  from: 1950,
  stacked: [
    ts('review', 'Review', 'review[pt]'),
    ts('case', 'Case report', 'case reports[pt]'),
    ts('letter', 'Letter', 'letter[pt]'),
    ts('comment', 'Comment', 'comment[pt]'),
    ts('editorial', 'Editorial', 'editorial[pt]'),
  ],
  multiples: [
    ts('rct', 'Randomized controlled trial', 'randomized controlled trial[pt]'),
    ts('meta', 'Meta-analysis', 'meta-analysis[pt]'),
    ts('systematic', 'Systematic review', 'systematic review[pt]'),
    ts('preprint', 'Preprint', 'preprint[pt]'),
    ts('retracted', 'Retracted publication', 'retracted publication[pt]'),
    ts('retraction', 'Retraction notice', 'retraction notice[pt]'),
  ],
};

QUERY_GROUPS.push(
  {
    id: 'cv-review',
    title: 'ClinVar records by review status',
    panel: 'variants',
    items: [
      q('rv-guideline', 'clinvar', 'Practice guideline', '"practice guideline"[RVST]'),
      q('rv-panel', 'clinvar', 'Reviewed by expert panel', '"reviewed by expert panel"[RVST]'),
      q('rv-multi', 'clinvar', 'Multiple submitters, no conflicts', '"criteria provided, multiple submitters, no conflicts"[RVST]'),
      q('rv-single', 'clinvar', 'Single submitter', '"criteria provided, single submitter"[RVST]'),
      q('rv-conflict', 'clinvar', 'Conflicting classifications', '"criteria provided, conflicting classifications"[RVST]'),
      q('rv-nocriteria', 'clinvar', 'No assertion criteria provided', '"no assertion criteria provided"[RVST]'),
      q('rv-noclass', 'clinvar', 'No classification provided', '"no classification provided"[RVST]'),
    ],
  },
  {
    id: 'cv-type',
    title: 'ClinVar records by variation type',
    panel: 'variants',
    items: [
      q('vt-snv', 'clinvar', 'Single nucleotide variant', '"single nucleotide variant"[VRTP]'),
      q('vt-del', 'clinvar', 'Deletion', 'deletion[VRTP]'),
      q('vt-dup', 'clinvar', 'Duplication', 'duplication[VRTP]'),
      q('vt-micro', 'clinvar', 'Microsatellite', 'microsatellite[VRTP]'),
      q('vt-gain', 'clinvar', 'Copy number gain', '"copy number gain"[VRTP]'),
      q('vt-loss', 'clinvar', 'Copy number loss', '"copy number loss"[VRTP]'),
      q('vt-indel', 'clinvar', 'Indel', 'indel[VRTP]'),
      q('vt-ins', 'clinvar', 'Insertion', 'insertion[VRTP]'),
      q('vt-inv', 'clinvar', 'Inversion', 'inversion[VRTP]'),
    ],
  },
  {
    id: 'cv-origin',
    title: 'ClinVar records by allele origin',
    panel: 'variants',
    items: [
      q('or-germline', 'clinvar', 'Germline', 'germline[ORIG]'),
      q('or-unknown', 'clinvar', 'Unknown', 'unknown[ORIG]'),
      q('or-denovo', 'clinvar', 'De novo', '"de novo"[ORIG]'),
      q('or-inherited', 'clinvar', 'Inherited', 'inherited[ORIG]'),
      q('or-maternal', 'clinvar', 'Maternal', 'maternal[ORIG]'),
      q('or-somatic', 'clinvar', 'Somatic', 'somatic[ORIG]'),
      q('or-paternal', 'clinvar', 'Paternal', 'paternal[ORIG]'),
    ],
  },
  {
    id: 'preprints',
    title: 'Preprints in PubMed by server',
    panel: 'access',
    items: [
      q('pp-biorxiv', 'pubmed', 'bioRxiv', '"biorxiv"[ta]'),
      q('pp-medrxiv', 'pubmed', 'medRxiv', '"medrxiv"[ta]'),
      q('pp-resq', 'pubmed', 'Research Square', '"res sq"[ta]'),
      q('pp-arxiv', 'pubmed', 'arXiv', '"arxiv"[ta]'),
    ],
  },
);

const gr = (db, field, label, what) => ({ db, field, label, what });

export const GROWTH = {
  from: 2000,
  dbs: [
    gr('sra', 'PDAT', 'SRA', 'experiments by publication date'),
    gr('biosample', 'PDAT', 'BioSample', 'samples by publication date'),
    gr('gds', 'PDAT', 'GEO DataSets', 'records by publication date'),
    gr('bioproject', 'DATE', 'BioProject', 'projects by registration date'),
    gr('assembly', 'SRDT', 'Assembly', 'assemblies by sequence release date'),
    gr('clinvar', 'CDAT', 'ClinVar', 'records by creation date'),
    gr('gene', 'CDAT', 'Gene', 'records by creation date'),
    gr('pmc', 'PDAT', 'PMC', 'articles by publication date'),
    gr('structure', 'DDAT', 'Structure', 'MMDB entries by entry date'),
  ],
};

export const ACCESS = {
  from: 1990,
  series: [
    { id: 'free', label: 'Free full text', term: 'free full text[sb]' },
    { id: 'pmc', label: 'Linked to PMC', term: 'pubmed pmc[sb]' },
    { id: 'erratum', label: 'Published erratum', term: 'published erratum[pt]' },
    { id: 'concern', label: 'Expression of concern', term: '"expression of concern"[pt]' },
  ],
};

const c = (name, term) => ({ name, term });

export const COUNTRIES = {
  years: [2015, 2025],
  list: [
    c('China', 'china[ad]'),
    c('United States', '(usa[ad] OR "united states"[ad])'),
    c('Japan', 'japan[ad]'),
    c('Germany', 'germany[ad]'),
    c('United Kingdom', '("united kingdom"[ad] OR uk[ad] OR england[ad] OR scotland[ad] OR wales[ad])'),
    c('India', 'india[ad]'),
    c('Italy', 'italy[ad]'),
    c('South Korea', 'korea[ad]'),
    c('Canada', 'canada[ad]'),
    c('France', 'france[ad]'),
    c('Spain', 'spain[ad]'),
    c('Australia', 'australia[ad]'),
    c('Brazil', 'brazil[ad]'),
    c('Iran', 'iran[ad]'),
    c('Turkey', '(turkey[ad] OR turkiye[ad])'),
    c('Netherlands', 'netherlands[ad]'),
    c('Saudi Arabia', '"saudi arabia"[ad]'),
    c('Pakistan', 'pakistan[ad]'),
    c('Egypt', 'egypt[ad]'),
    c('Switzerland', 'switzerland[ad]'),
  ],
};

const g = (id, symbol) => ({ id, symbol });

export const GENES = [
  g(7157, 'TP53'), g(7124, 'TNF'), g(1956, 'EGFR'), g(348, 'APOE'), g(7422, 'VEGFA'), g(3569, 'IL6'),
  g(672, 'BRCA1'), g(675, 'BRCA2'), g(2099, 'ESR1'), g(207, 'AKT1'), g(4524, 'MTHFR'), g(1080, 'CFTR'),
  g(3043, 'HBB'), g(3845, 'KRAS'), g(673, 'BRAF'), g(5728, 'PTEN'), g(4609, 'MYC'), g(1636, 'ACE'),
  g(3630, 'INS'), g(920, 'CD4'), g(351, 'APP'), g(1029, 'CDKN2A'),
];

const w = (id, label, term) => ({ id, label, term: `${term}[tiab]` });

export const VOCAB = {
  from: 2010,
  base: 2019,
  control: w('patients', 'patients', 'patients'),
  words: [
    w('delve', 'delve', 'delve*'),
    w('showcasing', 'showcasing', 'showcasing'),
    w('underscore', 'underscore', 'underscore*'),
    w('intricate', 'intricate', 'intricate'),
    w('meticulous', 'meticulous', 'meticulous*'),
    w('commendable', 'commendable', 'commendable'),
    w('leveraging', 'leveraging', 'leveraging'),
    w('nuanced', 'nuanced', 'nuanced'),
  ],
};

const s = (id, label, term) => ({ id, label, term });

export const SUBJECTS = {
  animals: {
    from: 1975,
    list: [
      s('mice', 'Mice', 'mice[mh]'),
      s('rats', 'Rats', 'rats[mh]'),
      s('dogs', 'Dogs', 'dogs[mh]'),
      s('rabbits', 'Rabbits', 'rabbits[mh]'),
      s('swine', 'Pigs', 'swine[mh]'),
      s('zebrafish', 'Zebrafish', 'zebrafish[mh]'),
      s('drosophila', 'Fruit flies', 'drosophila[mh]'),
      s('elegans', 'C. elegans', 'caenorhabditis elegans[mh]'),
      s('yeast', 'Baker’s yeast', 'saccharomyces cerevisiae[mh]'),
      s('arabidopsis', 'Arabidopsis', 'arabidopsis[mh]'),
    ],
  },
  sex: {
    from: 1975,
    list: [
      s('women', 'Women only', 'humans[mh] AND female[mh] NOT male[mh]'),
      s('men', 'Men only', 'humans[mh] AND male[mh] NOT female[mh]'),
    ],
  },
  ages: {
    years: [2005, 2025],
    list: [
      s('newborn', 'Newborn', '"infant, newborn"[mh]'),
      s('infant', 'Infant', 'infant[mh:noexp]'),
      s('preschool', 'Preschool child', '"child, preschool"[mh]'),
      s('child', 'Child', 'child[mh:noexp]'),
      s('adolescent', 'Adolescent', 'adolescent[mh]'),
      s('young', 'Young adult', '"young adult"[mh]'),
      s('adult', 'Adult', 'adult[mh:noexp]'),
      s('middle', 'Middle aged', '"middle aged"[mh]'),
      s('aged', 'Aged', 'aged[mh:noexp]'),
      s('oldest', 'Aged 80 and over', '"aged, 80 and over"[mh]'),
    ],
  },
  outbreaks: {
    from: 2000,
    list: [
      s('covid', 'COVID-19', '(covid-19[tiab] OR sars-cov-2[tiab])'),
      s('h1n1', 'H1N1 influenza', 'h1n1[tiab]'),
      s('ebola', 'Ebola', 'ebola[tiab]'),
      s('zika', 'Zika', 'zika[tiab]'),
      s('mers', 'MERS', '(mers-cov[tiab] OR "middle east respiratory syndrome"[tiab])'),
      s('mpox', 'Mpox', '(mpox[tiab] OR monkeypox[tiab])'),
    ],
  },
};

const p = (pmid, label) => ({ pmid, label });

export const RETRACTED = [
  p('9500320', 'Wakefield, Lancet 1998'),
  p('14963337', 'Hwang, Science 2004'),
  p('15905366', 'Hwang, Science 2005'),
  p('22999595', 'Séralini, Food Chem Toxicol 2012'),
  p('24476887', 'Obokata, Nature 2014'),
  p('32205204', 'Gautret, Int J Antimicrob Agents 2020'),
  p('32356626', 'Mehra, N Engl J Med 2020'),
  p('32450107', 'Mehra, Lancet 2020'),
];

export const CLASSICS = [
  p('11846609', 'Livak, qPCR ΔΔCt 2001'),
  p('5432063', 'Laemmli, SDS gels 1970'),
  p('14907713', 'Lowry, protein assay 1951'),
  p('942051', 'Bradford, protein assay 1976'),
  p('2231712', 'Altschul, BLAST 1990'),
  p('9254694', 'Altschul, Gapped BLAST 1997'),
  p('271968', 'Sanger, DNA sequencing 1977'),
  p('10592173', 'Kanehisa, KEGG 2000'),
  p('7984417', 'Thompson, CLUSTAL W 1994'),
  p('3802833', 'DerSimonian, meta-analysis 1986'),
  p('2440339', 'Chomczynski, RNA isolation 1987'),
  p('2868172', 'Bland, agreement 1986'),
  p('13428781', 'Folch, lipid extraction 1957'),
];

export const EXTREMES = {
  protein: 'Homo sapiens[orgn] AND refseq[filter] AND 30000:100000[slen]',
  genes: 'Homo sapiens[orgn] AND "genetype protein coding"[prop] AND alive[prop]',
  uncultured: '"uncultured bacterium"[orgn]',
  stopword: 'however',
  farFuture: 2090,
  longAgo: 1950,
};
