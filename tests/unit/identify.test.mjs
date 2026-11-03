import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identify } from '../../src/lib.js';

const cases = [
  ['1', 'PMID', 'https://pubmed.ncbi.nlm.nih.gov/1/'],
  ['41379710', 'PMID', 'https://pubmed.ncbi.nlm.nih.gov/41379710/'],
  ['PMC176545', 'PMCID', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC176545/'],
  ['pmc176545', 'PMCID', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC176545/'],
  ['NCT00000102', 'NCT Number', 'https://clinicaltrials.gov/study/NCT00000102'],
  ['rs334', 'rsID', 'https://www.ncbi.nlm.nih.gov/snp/rs334'],
  ['NM_000518.5', 'RefSeq mRNA', 'https://www.ncbi.nlm.nih.gov/nuccore/NM_000518.5'],
  ['NP_000509.1', 'RefSeq protein', 'https://www.ncbi.nlm.nih.gov/protein/NP_000509.1'],
  ['NC_000011.10', 'RefSeq chromosome', 'https://www.ncbi.nlm.nih.gov/nuccore/NC_000011.10'],
  ['XM_011520186', 'RefSeq predicted mRNA', 'https://www.ncbi.nlm.nih.gov/nuccore/XM_011520186'],
  ['WP_000001', 'RefSeq non-redundant protein', 'https://www.ncbi.nlm.nih.gov/protein/WP_000001'],
  ['GCF_000001405.40', 'RefSeq assembly', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000001405.40/'],
  ['GCA_000001405.29', 'GenBank assembly', 'https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000001405.29/'],
  ['PRJNA31257', 'BioProject', 'https://www.ncbi.nlm.nih.gov/bioproject/PRJNA31257'],
  ['SAMN00000001', 'BioSample', 'https://www.ncbi.nlm.nih.gov/biosample/SAMN00000001'],
  ['SRR000001', 'SRA run', 'https://www.ncbi.nlm.nih.gov/sra/SRR000001'],
  ['ERX000001', 'SRA experiment', 'https://www.ncbi.nlm.nih.gov/sra/ERX000001'],
  ['GSE1', 'GEO series', 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE1'],
  ['GPL570', 'GEO platform', 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GPL570'],
  ['phs000001', 'dbGaP study', 'https://www.ncbi.nlm.nih.gov/projects/gap/cgi-bin/study.cgi?study_id=phs000001'],
  ['VCV000012345', 'ClinVar variation', 'https://www.ncbi.nlm.nih.gov/clinvar/?term=VCV000012345'],
  ['D000001', 'MeSH descriptor', 'https://meshb.nlm.nih.gov/record/ui?ui=D000001'],
  ['Q000000981', 'MeSH qualifier', 'https://meshb.nlm.nih.gov/record/ui?ui=Q000000981'],
  ['C000002', 'MeSH supplementary concept', 'https://meshb.nlm.nih.gov/record/ui?ui=C000002'],
  ['C0000005', 'UMLS CUI', 'https://uts.nlm.nih.gov/uts/umls/concept/C0000005'],
  ['CID 2244', 'PubChem CID', 'https://pubchem.ncbi.nlm.nih.gov/compound/2244'],
  ['cid:2244', 'PubChem CID', 'https://pubchem.ncbi.nlm.nih.gov/compound/2244'],
  ['txid9606', 'Taxonomy ID', 'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=9606'],
  ['GeneID:7157', 'Gene ID', 'https://www.ncbi.nlm.nih.gov/gene/7157'],
  ['NBK1116', 'Bookshelf ID', 'https://www.ncbi.nlm.nih.gov/books/NBK1116/'],
  ['0028-0836', 'ISSN', 'https://www.ncbi.nlm.nih.gov/nlmcatalog/?term=0028-0836%5Bissn%5D'],
  ['10.1016/S0022-2836(05)80360-2', 'DOI', 'https://pubmed.ncbi.nlm.nih.gov/?term=10.1016%2FS0022-2836(05)80360-2%5Bdoi%5D'],
  ['RXCUI 1191', 'RxNorm RXCUI', 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=1191'],
  ['J00001', 'GenBank nucleotide', 'https://www.ncbi.nlm.nih.gov/nuccore/J00001'],
  ['AB123456.1', 'GenBank nucleotide', 'https://www.ncbi.nlm.nih.gov/nuccore/AB123456.1'],
  ['AAA12345', 'GenBank protein', 'https://www.ncbi.nlm.nih.gov/protein/AAA12345'],
  ['1TUP', 'PDB ID', 'https://www.ncbi.nlm.nih.gov/Structure/pdb/1TUP'],
  ['cd00001', 'CDD', 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cd00001'],
  ['nsv1234', 'dbVar variant', 'https://www.ncbi.nlm.nih.gov/dbvar/variants/nsv1234/'],
];

for (const [input, type, url] of cases) {
  test(`identify ${input} as ${type}`, () => {
    const hit = identify(input);
    assert.ok(hit, `no match for ${input}`);
    assert.equal(hit.type, type);
    assert.equal(hit.url, url);
    assert.ok(hit.db.length > 0);
    assert.ok(hit.note.length > 0);
  });
}

test('identify trims whitespace', () => {
  assert.equal(identify('  rs334  ').type, 'rsID');
});

test('identify returns null for unknown or empty input', () => {
  assert.equal(identify(''), null);
  assert.equal(identify('   '), null);
  assert.equal(identify('hello world'), null);
  assert.equal(identify('NCT123'), null);
});

test('identify exposes the normalized id', () => {
  assert.equal(identify('pmc176545').id, 'PMC176545');
  assert.equal(identify('CID 2244').id, '2244');
});

test('REFSEQ_PREFIXES mirrors the 15 official RefSeq prefixes', async () => {
  const { REFSEQ_PREFIXES } = await import('../../src/lib.js');
  assert.equal(REFSEQ_PREFIXES.length, 15);
  for (const p of REFSEQ_PREFIXES) {
    assert.match(p.prefix, /^[A-Z]{2}_$/);
    assert.ok(['DNA', 'mRNA', 'RNA', 'protein'].includes(p.molecule), p.prefix);
    assert.ok(p.use.length > 5, p.prefix);
  }
  assert.match(REFSEQ_PREFIXES.find((p) => p.prefix === 'WP_').use, /\.1/);
});
