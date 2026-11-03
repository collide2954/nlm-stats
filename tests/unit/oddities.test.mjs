import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveOddities } from '../../src/lib.js';

const snap = {
  entrez: [
    { db: 'pubmed', name: 'PubMed', updated: '2026-11-02' },
    { db: 'proteinclusters', name: 'Protein Clusters', updated: '2017-12-04' },
  ],
  groups: [
    { id: 'clinvar', items: [{ id: 'cv-path', count: 266140 }, { id: 'cv-vus', count: 2434058 }] },
    { id: 'sra-strategy', items: [{ id: 'sra-amplicon', count: 18419145 }, { id: 'sra-wgs', count: 9295254 }] },
  ],
  genbank: {
    organisms: [
      { species: 'Triticum aestivum', bases: 9 },
      { species: 'Hordeum vulgare', bases: 8 },
      { species: 'Homo sapiens', bases: 2 },
    ],
  },
  clinicaltrials: {
    fields: { Condition: { top: [{ value: 'Healthy', count: 11129 }] } },
    biggestEnrollment: { id: 'NCT05697705', count: 188814085 },
    enrollmentBands: [{ from: 0, to: 0, count: 16909 }],
  },
};

test('liveOddities derives sourced oddities from the snapshot', () => {
  const out = liveOddities(snap);
  assert.ok(out.length >= 5);
  const text = out.map((o) => o.text).join('\n');
  assert.match(text, /Triticum aestivum/);
  assert.match(text, /Homo sapiens.*3rd/);
  assert.match(text, /188,814,085/);
  assert.match(text, /Healthy/);
  assert.match(text, /9\.1 variants of uncertain significance/);
  assert.match(text, /Amplicon.*WGS/i);
  assert.match(text, /Protein Clusters.*2017-12-04/);
  for (const o of out) assert.match(o.href, /^https:\/\//);
});

test('liveOddities skips facts that no longer hold', () => {
  const flipped = structuredClone(snap);
  flipped.groups[1].items[0].count = 1;
  flipped.clinicaltrials.fields.Condition.top[0].value = 'Breast Cancer';
  const text = liveOddities(flipped).map((o) => o.text).join('\n');
  assert.doesNotMatch(text, /Amplicon/);
  assert.doesNotMatch(text, /Healthy/);
});
