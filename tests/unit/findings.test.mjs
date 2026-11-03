import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findings } from '../../src/findings.js';
import snapshot from '../../src/snapshot.js';

const group = (id, items) => ({ id, items: items.map(([itemId, count, label]) => ({ id: itemId, count, label })) });

const fixture = {
  generated: '2026-11-03T05:00:00.000Z',
  entrez: [
    { db: 'pubmed', name: 'PubMed', count: 41381383 },
    { db: 'protein', name: 'Protein', count: 1663411801 },
  ],
  groups: [
    group('types', [['pt-review', 4095560], ['pt-rct', 674093]]),
    group('languages', [['la-eng', 36462589]]),
    group('sra-strategy', [['sra-amplicon', 18419145, 'Amplicon'], ['sra-wgs', 9295254, 'WGS']]),
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

test('findings use a common name when one is known', () => {
  const named = structuredClone(fixture);
  named.genbank.organisms[0].common = 'bread wheat';
  assert.equal(findings(named).genbank, 'Bread wheat tops GenBank by bases. Humans rank 3rd');
});

test('findings for growth, access, geography, genes and variants', () => {
  const more = structuredClone(fixture);
  more.pubmed.years = [{ year: 2015, count: 1000000 }, { year: 2025, count: 1882376 }, { year: 2026, count: 5 }];
  more.growth = [
    { label: 'SRA', years: [{ year: 2015, count: 100 }, { year: 2025, count: 900 }] },
    { label: 'Gene', years: [{ year: 2015, count: 100 }, { year: 2025, count: 200 }] },
  ];
  more.access = [{ id: 'free', years: [{ year: 2025, count: 941188 }] }];
  more.countries = [
    { name: 'United States', counts: { 2015: 300, 2025: 354005 } },
    { name: 'China', counts: { 2015: 100, 2025: 502433 } },
  ];
  more.funding.nihStates = [{ key: 'CA', dollars: 5e9 }, { key: 'MD', dollars: 4e9 }];
  more.genes = [{ symbol: 'TNF', pubmed: 30000 }, { symbol: 'TP53', pubmed: 12000 }];
  more.entrez.push({ db: 'clinvar', name: 'ClinVar', count: 4708791 });
  more.groups.push(group('cv-review', [['rv-single', 3350007]]));
  const f = findings(more);
  assert.equal(f.growth, 'SRA grew 9-fold between 2015 and 2025');
  assert.equal(f.access, '50% of papers dated 2025 are free to read');
  assert.equal(f.geography, 'Authors in China appear on 502,433 papers dated 2025, the most of 2 countries checked');
  assert.equal(f.states, 'California draws the most NIH award dollars: $5B');
  assert.equal(f.genes, 'TNF is linked to 30,000 PubMed records, the most of 2 genes here');
  assert.equal(f.variants, '71.1% of ClinVar records rest on a single submitter');
});

const yr = (pairs) => pairs.map(([year, count]) => ({ year, count }));

test('findings for machine text, extremes, subjects and trial fate', () => {
  const more = structuredClone(fixture);
  more.pubmed.years = yr([[2019, 1500000], [2020, 1700000], [2021, 1787550], [2022, 1800000], [2025, 1882376]]);
  more.vocab = {
    base: 2019,
    partial: 2026,
    totals: yr([[2019, 1248394], [2024, 1559752], [2025, 1687551], [2026, 1400000]]),
    words: [
      { id: 'delve', label: 'delve', years: yr([[2019, 215], [2024, 9468], [2025, 4989], [2026, 9000]]) },
      { id: 'nuanced', label: 'nuanced', years: yr([[2019, 870], [2024, 4660], [2025, 5060], [2026, 9000]]) },
    ],
    control: { id: 'patients', label: 'patients', years: yr([[2019, 361000], [2024, 457000], [2025, 485000], [2026, 1]]) },
  };
  more.zombies = [
    { label: 'Wakefield, Lancet 1998', retracted: 2010, after: 341 },
    { label: 'Mehra, N Engl J Med 2020', retracted: 2020, after: 451 },
    { label: 'Gautret, Int J Antimicrob Agents 2020', retracted: 2025, after: 8 },
  ];
  more.classics = [
    { label: 'Livak, qPCR ΔΔCt 2001', citedBy: 89076 },
    { label: 'Altschul, BLAST 1990', pmid: '2231712', citedBy: 40945 },
  ];
  more.extremes = { awards: { fy: 2025, largest: { ic: 'NLM', dollars: 357194999, title: 'National Biomedical Information Services' } } };
  more.subjects = {
    medline: yr([[2000, 100], [2001, 100], [2002, 100], [2003, 100], [2025, 100]]),
    animals: [
      { id: 'mice', label: 'Mice', years: yr([[2000, 31501], [2001, 32595], [2002, 34216], [2003, 36910], [2025, 90000]]) },
      { id: 'rats', label: 'Rats', years: yr([[2000, 35020], [2001, 33588], [2002, 33487], [2003, 34768], [2025, 27000]]) },
    ],
    sex: [
      { id: 'women', label: 'Women only', years: yr([[2000, 90], [2025, 794]]) },
      { id: 'men', label: 'Men only', years: yr([[2000, 70], [2025, 447]]) },
    ],
    outbreaks: [
      { id: 'covid', label: 'COVID-19', years: yr([[2019, 0], [2020, 90000], [2021, 133727], [2022, 120000]]) },
      { id: 'zika', label: 'Zika', years: yr([[2019, 900], [2020, 800], [2021, 700], [2022, 600]]) },
    ],
  };
  more.trialfate = {
    stops: { total: 31096, reasons: [{ id: 'enrollment', label: 'Enrollment or accrual', count: 12973 }, { id: 'safety', count: 889 }] },
    lag: { n: 27584, peak: 11, months: [...Array(11).fill(100), 7053, ...Array(37).fill(100)] },
  };
  const f = findings(more);
  assert.equal(f.vocab, '‘delve’ appeared 35 times as often in 2024 abstracts as in 2019');
  assert.equal(f.zombies, '451 later papers cite Mehra, N Engl J Med 2020, retracted in 2020');
  assert.equal(f.classics, 'A 2001 qPCR ΔΔCt paper has 2.2 times BLAST’s citing records');
  assert.equal(f.extremes, 'NIH’s largest FY2025 award line is NLM’s own: $357.2M');
  assert.equal(f.subjects, 'Mice overtook rats in 2002');
  assert.equal(f.sex, 'Women-only studies outnumber men-only studies 1.8 to 1');
  assert.equal(f.outbreaks, 'In 2021, 1 in 13 papers mentioned COVID-19');
  assert.equal(f.stops, 'Slow enrollment ends 41.7% of terminated trials that give a reason');
  assert.equal(f.lag, '25.6% of trial results arrive in the last month before the deadline');
});

test('subject and trial findings fall back when the pattern changes', () => {
  const more = structuredClone(fixture);
  more.subjects = {
    medline: yr([[2000, 1], [2025, 1]]),
    animals: [
      { id: 'mice', label: 'Mice', years: yr([[2000, 9], [2025, 9]]) },
      { id: 'rats', label: 'Rats', years: yr([[2000, 1], [2025, 1]]) },
    ],
    sex: [{ id: 'women', years: yr([[2025, 400]]) }, { id: 'men', years: yr([[2025, 500]]) }],
    outbreaks: [{ id: 'covid', label: 'COVID-19', years: yr([[2021, 10]]) }],
  };
  more.pubmed.years = yr([[2021, 1000]]);
  more.trialfate = {
    stops: { total: 100, reasons: [{ id: 'business', label: 'Sponsor or business decision', count: 50 }] },
    lag: { n: 100, peak: 5, months: [0, 0, 0, 0, 0, 60, ...Array(43).fill(0)] },
  };
  more.extremes = { awards: { fy: 2025, largest: { ic: 'NCI', dollars: 2e8, title: 'X' } } };
  const f = findings(more);
  assert.equal(f.subjects, 'Mice have outnumbered rats in every year since 2000');
  assert.equal(f.sex, 'Men-only studies outnumber women-only studies 1.3 to 1');
  assert.equal(f.stops, 'Sponsor or business decision ends 50% of terminated trials that give a reason');
  assert.equal(f.lag, 'Trial results most often arrive 5 months after completion');
  assert.equal(f.extremes, 'NIH’s largest FY2025 award line goes to NCI: $200M');
});
