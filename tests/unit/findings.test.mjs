import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../../src/findings.js';
import snapshot from '../../src/snapshot.js';

const group = (id, items) => ({ id, items: items.map(([itemId, count]) => ({ id: itemId, count })) });

const fixture = {
  generated: '2026-11-03T05:00:00.000Z',
  entrez: [
    { db: 'pubmed', name: 'PubMed', count: 41381383 },
    { db: 'protein', name: 'Protein', count: 1663411801 },
  ],
  groups: [
    group('types', [['pt-review', 4095560], ['pt-rct', 674093]]),
    group('languages', [['la-eng', 36462589]]),
    group('sra-strategy', [['sra-amplicon', 18419145], ['sra-wgs', 9295254]]),
  ],
  papers: [{ topic: 'BLAST', citedBy: 40937, date: '1990 Oct 5' }],
  pubmed: { years: [{ year: 2024, count: 1740230 }, { year: 2025, count: 1882376 }, { year: 2026, count: 1636618 }] },
  methods: [
    { label: 'Mendelian randomization', total: 14596, years: [{ year: 2020, count: 300 }, { year: 2025, count: 3600 }] },
    { label: 'Logistic models', total: 163867, years: [{ year: 2020, count: 9000 }, { year: 2025, count: 7000 }] },
  ],
  genbank: { organisms: [{ species: 'Triticum aestivum' }, { species: 'Hordeum vulgare' }, { species: 'Homo sapiens' }] },
  clinicaltrials: {
    completedInterventional: 261165,
    completedInterventionalWithResults: 63019,
    fields: { DesignMasking: { top: [{ value: 'NONE', count: 555 }, { value: 'DOUBLE', count: 445 }] } },
  },
  funding: {
    detailFy: 2025,
    detail: { dollars: 479511888, byMechanism: [{ key: 'Intramural Research', dollars: 391497695 }] },
    ics: [{ ic: 'NCI' }, { ic: 'NLM' }, { ic: 'FIC' }],
  },
};

test('findings states each section as a fact', () => {
  const f = findings(fixture);
  assert.equal(f.entrez, 'Protein alone holds 1.66 billion records');
  assert.equal(f.pubmed, '2025 was PubMed’s biggest year yet: 1.88 million papers');
  assert.equal(f.types, 'Reviews outnumber randomized trials 6 to 1');
  assert.equal(f.facets, '88.1% of PubMed is in English');
  assert.equal(f.methods, 'Mendelian randomization papers grew 12-fold in five years');
  assert.equal(f.trials, 'Only 24.1% of finished trials have posted results');
  assert.equal(f.design, '55.5% of trials are open label');
  assert.equal(f.funding, '81.6% of NLM’s FY2025 award dollars stay inside NLM');
  assert.equal(f.ics, 'NLM ranks 2nd of 3 NIH institutes by award dollars');
  assert.equal(f.genbank, 'Triticum aestivum tops GenBank by bases. Humans rank 3rd');
  assert.equal(f.seqdata, 'Amplicon runs outnumber whole genomes in SRA');
  assert.equal(f.papers, 'The 1990 BLAST paper has 40,937 citing records');
  assert.equal(f.history, '190 years from a $150 book budget');
});

test('findings fall back when a pattern no longer holds', () => {
  const flipped = structuredClone(fixture);
  flipped.pubmed.years[1].count = 1;
  flipped.groups[2].items[0].count = 1;
  flipped.genbank.organisms = [{ species: 'Homo sapiens' }];
  const f = findings(flipped);
  assert.equal(f.pubmed, 'PubMed’s biggest year was 2024: 1.74 million papers');
  assert.equal(f.seqdata, 'WGS leads SRA library strategies');
  assert.equal(f.genbank, 'Homo sapiens tops GenBank by bases');
});

test('findings work on the real snapshot', () => {
  const f = findings(snapshot);
  for (const [key, text] of Object.entries(f)) {
    assert.equal(typeof text, 'string', key);
    assert.ok(text.length > 10 && text.length < 90, `${key}: ${text}`);
    assert.doesNotMatch(text, /undefined|NaN|null/, key);
  }
});
