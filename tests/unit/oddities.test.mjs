import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveOddities, longDate } from '../../src/lib.js';

const snap = {
  entrez: [
    { db: 'pubmed', name: 'PubMed', updated: '2026-11-02' },
    { db: 'proteinclusters', name: 'Protein Clusters', updated: '2017-12-04' },
  ],
  groups: [
    { id: 'clinvar', items: [{ id: 'cv-path', count: 266140 }, { id: 'cv-vus', count: 2434058 }] },
    { id: 'sra-strategy', items: [{ id: 'sra-amplicon', count: 18419145 }, { id: 'sra-wgs', count: 9295254 }] },
  ],
  genbank: { organisms: [{ species: 'Triticum aestivum', bases: 9 }, { species: 'Homo sapiens', bases: 2 }] },
  clinicaltrials: {
    fields: { Condition: { top: [{ value: 'Healthy', count: 11129 }] } },
    biggestEnrollment: { id: 'NCT05697705', count: 188814085 },
  },
  funding: {
    detailFy: 2025,
    detail: { dollars: 479511888, largest: [{ title: 'National Biomedical Information Services', dollars: 357194999, appl: 11410911 }] },
  },
  extremes: {
    uncultured: 6855674,
    stopword: { word: 'however', count: 0, ignored: true },
    trials: {
      latest: { id: 'NCT06739499', title: 'BEready', date: '2100-12-31' },
      farFuture: { year: 2090, count: 86 },
      earliest: { id: 'NCT03591926', title: 'SM04646 in IPF', date: '1900-01', posted: '2018-07-19', status: 'WITHDRAWN' },
      longAgo: { year: 1950, count: 5 },
    },
    awards: { fy: 2025, upTo100: 235, exactlyOne: 228 },
  },
  trialfate: { stops: { total: 31096, notSafety: 1246, reasons: [{ id: 'enrollment', count: 12973 }, { id: 'safety', count: 889 }] } },
};

const texts = (s) => liveOddities(s).map((o) => o.text).join('\n');

test('longDate writes ClinicalTrials.gov dates out in words', () => {
  assert.equal(longDate('1900-01'), 'January 1900');
  assert.equal(longDate('2100-12-31'), '31 December 2100');
  assert.equal(longDate('1916-09-05'), '5 September 1916');
});

test('liveOddities states contradictions and strange records from the snapshot', () => {
  const out = liveOddities(snap);
  const text = out.map((o) => o.text).join('\n');
  assert.match(text, /“however”.*stopword/);
  assert.match(text, /1,246 terminated trials say safety was not the reason\. 889 say it was\./);
  assert.match(text, /NCT03591926.*January 1900.*2018/);
  assert.match(text, /86 studies plan to finish in 2090 or later.*NCT06739499.*31 December 2100/);
  assert.match(text, /228 NIH awards in FY2025 were for exactly \$1/);
  assert.match(text, /6,855,674 GenBank sequences.*uncultured bacterium/);
  assert.match(text, /188,814,085/);
  assert.match(text, /Healthy/);
  assert.match(text, /9\.1 variants of uncertain significance/);
  for (const o of out) assert.match(o.href, /^https:\/\//);
});

test('liveOddities leaves out trivia and facts already used as headlines', () => {
  const text = texts(snap);
  assert.doesNotMatch(text, /Triticum|Amplicon|Protein Clusters|National Biomedical Information Services/);
});

test('liveOddities skips facts that no longer hold', () => {
  const flipped = structuredClone(snap);
  flipped.clinicaltrials.fields.Condition.top[0].value = 'Breast Cancer';
  flipped.extremes.stopword.ignored = false;
  flipped.extremes.awards.exactlyOne = 0;
  flipped.extremes.trials.earliest.date = '1995-01';
  flipped.trialfate.stops.notSafety = 10;
  const text = texts(flipped);
  assert.doesNotMatch(text, /Healthy|however|exactly \$1|1995|safety was not/);
});

test('liveOddities copes with an older snapshot', () => {
  const old = structuredClone(snap);
  delete old.extremes;
  delete old.trialfate;
  assert.ok(liveOddities(old).length >= 3);
});
