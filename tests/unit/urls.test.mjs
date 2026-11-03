import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchUrl, eutilsUrl } from '../../src/lib.js';

test('searchUrl targets the PubMed site', () => {
  assert.equal(searchUrl('pubmed', 'review[pt]'), 'https://pubmed.ncbi.nlm.nih.gov/?term=review%5Bpt%5D');
});

test('searchUrl targets the PMC site', () => {
  assert.equal(searchUrl('pmc', '"open access"[filter]'), 'https://pmc.ncbi.nlm.nih.gov/search/?term=%22open%20access%22%5Bfilter%5D');
});

test('searchUrl targets classic Entrez for other databases', () => {
  assert.equal(searchUrl('gene', 'alive[prop]'), 'https://www.ncbi.nlm.nih.gov/gene/?term=alive%5Bprop%5D');
});

test('searchUrl without a term opens the database home', () => {
  assert.equal(searchUrl('snp'), 'https://www.ncbi.nlm.nih.gov/snp/');
  assert.equal(searchUrl('pubmed'), 'https://pubmed.ncbi.nlm.nih.gov/');
});

test('eutilsUrl builds json E-utilities requests', () => {
  assert.equal(
    eutilsUrl('einfo', { db: 'gene' }),
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi?db=gene&retmode=json',
  );
  assert.equal(
    eutilsUrl('esearch', { db: 'pubmed', term: '1999[dp]', retmax: 0 }),
    'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=1999%5Bdp%5D&retmax=0&retmode=json',
  );
});
