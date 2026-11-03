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
