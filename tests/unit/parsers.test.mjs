import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseEinfo,
  parseCount,
  parseGenbankHeader,
  parseGrowth,
  parseOrganisms,
  parseDivisions,
  toModule,
} from '../../scripts/parsers.mjs';

const GBREL = `GBREL.TXT          Genetic Sequence Data Bank
                         October 15 2026

               NCBI-GenBank Flat File Release 274.0

                    Distribution Release Notes

  269895537 sequences,  9384961284424 bases, for traditional GenBank records
 6736062960 sequences, 56003937587326 bases, for set-based (WGS/TSA/TLS) records

2.2.6 Per-Division Statistics

Division     Entries    Bases

BCT1         179382     601491289
BCT10        345        679333600
PRI1         1000       2000
VRL1         5          10
VRL2         7          30

2.2.7 Selected Per-Organism Statistics

Entries         Bases   	Species

1949031		419236647828	Triticum aestivum
29108547	39122845109	Homo sapiens


2.2.8 Growth of GenBank

Release      Date     Base Pairs   Entries

    3    Dec 1982         680338       606
   14    Nov 1983        2274029      2427
  n/a    Feb 2024 n/a             n/a         No GenBank Release delivered in Feb 2024
  227   Aug 2018   260806936411   208831050 (Section 1.3.1 explains decrease)
  271	 Apr 2026 45628511953497  4756526485

  The following table provides WGS numbers.

Release      Date     Base Pairs     Entries

  129    Apr 2002     692266338       172768
  130    Jun 2002    1965637758       397460

Some trailing text.
`;

test('parseEinfo extracts the useful fields', () => {
  const json = {
    einforesult: {
      dbinfo: [{
        dbname: 'snp',
        menuname: 'SNP',
        description: 'Single Nucleotide Polymorphisms',
        dbbuild: 'Build250306-1408.1',
        count: '1197210835',
        lastupdate: '2025/03/11 08:22',
        fieldlist: [{}, {}, {}],
        linklist: [{}, {}],
      }],
    },
  };
  assert.deepEqual(parseEinfo(json), {
    db: 'snp',
    name: 'SNP',
    description: 'Single Nucleotide Polymorphisms',
    build: 'Build250306-1408.1',
    count: 1197210835,
    updated: '2025-03-11',
    fields: 3,
    links: 2,
  });
});

test('parseEinfo tolerates missing lists and counts', () => {
  const json = { einforesult: { dbinfo: [{ dbname: 'x', menuname: 'X', description: '', count: '', lastupdate: '' }] } };
  const out = parseEinfo(json);
  assert.equal(out.count, null);
  assert.equal(out.updated, null);
  assert.equal(out.fields, 0);
  assert.equal(out.links, 0);
});

test('parseCount reads esearch counts', () => {
  assert.equal(parseCount({ esearchresult: { count: '12345' } }), 12345);
  assert.equal(parseCount({ esearchresult: { ERROR: 'bad' } }), null);
});

test('parseGenbankHeader reads release, date and totals', () => {
  assert.deepEqual(parseGenbankHeader(GBREL), {
    release: '274.0',
    date: 'October 15 2026',
    traditional: { sequences: 269895537, bases: 9384961284424 },
    sets: { sequences: 6736062960, bases: 56003937587326 },
  });
});

test('parseGrowth splits growth tables and skips n/a rows', () => {
  const tables = parseGrowth(GBREL);
  assert.equal(tables.length, 2);
  assert.deepEqual(tables[0][0], { release: 3, date: 'Dec 1982', bases: 680338, entries: 606 });
  assert.equal(tables[0].length, 4);
  assert.deepEqual(tables[0][3], { release: 271, date: 'Apr 2026', bases: 45628511953497, entries: 4756526485 });
  assert.equal(tables[1].length, 2);
});

test('parseOrganisms reads the most sequenced organisms', () => {
  assert.deepEqual(parseOrganisms(GBREL), [
    { species: 'Triticum aestivum', entries: 1949031, bases: 419236647828 },
    { species: 'Homo sapiens', entries: 29108547, bases: 39122845109 },
  ]);
});

test('parseDivisions sums files per division', () => {
  assert.deepEqual(parseDivisions(GBREL), [
    { code: 'BCT', files: 2, entries: 179727, bases: 1280824889 },
    { code: 'PRI', files: 1, entries: 1000, bases: 2000 },
    { code: 'VRL', files: 2, entries: 12, bases: 40 },
  ]);
});

test('toModule emits a default export of stable JSON', () => {
  const src = toModule({ b: 1, a: [1, 2] });
  assert.equal(src, 'export default {\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n};\n');
});
