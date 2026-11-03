import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matches,
  filterTimeline,
  sortRows,
  logShare,
  share,
  niceTicks,
  decade,
  yearOf,
  labelize,
  stamp,
} from '../../src/lib.js';

test('matches needs every term, ignoring case and accents', () => {
  assert.equal(matches('Peter Embí, Vanderbilt', 'embi vanderbilt'), true);
  assert.equal(matches('GenBank release', 'genbank pubmed'), false);
  assert.equal(matches('anything', ''), true);
  assert.equal(matches('anything', '   '), true);
});

const ITEMS = [
  { date: '1836', org: 'NLM', tag: 'origins', text: 'First funds' },
  { date: '1988', org: 'NCBI', tag: 'law', text: 'NCBI established' },
  { date: '1990', org: 'NCBI', tag: 'molecular', text: 'BLAST published' },
];

test('filterTimeline filters by tag, org and query', () => {
  assert.equal(filterTimeline(ITEMS, {}).length, 3);
  assert.deepEqual(filterTimeline(ITEMS, { tags: ['law'] }).map((i) => i.date), ['1988']);
  assert.deepEqual(filterTimeline(ITEMS, { orgs: ['NCBI'] }).map((i) => i.date), ['1988', '1990']);
  assert.deepEqual(filterTimeline(ITEMS, { query: 'blast' }).map((i) => i.date), ['1990']);
  assert.deepEqual(filterTimeline(ITEMS, { query: '1836' }).map((i) => i.date), ['1836']);
  assert.equal(filterTimeline(ITEMS, { tags: [] }).length, 3);
});

test('sortRows sorts numbers and strings with nulls last', () => {
  const rows = [{ n: 2, s: 'b' }, { n: null, s: 'c' }, { n: 10, s: 'a' }];
  assert.deepEqual(sortRows(rows, 'n', 'desc').map((r) => r.n), [10, 2, null]);
  assert.deepEqual(sortRows(rows, 'n', 'asc').map((r) => r.n), [2, 10, null]);
  assert.deepEqual(sortRows(rows, 's', 'asc').map((r) => r.s), ['a', 'b', 'c']);
  assert.deepEqual(rows.map((r) => r.n), [2, null, 10]);
});

test('logShare maps onto a log scale between 0 and 100', () => {
  assert.equal(logShare(0, 1000), 0);
  assert.equal(logShare(1000, 1000), 100);
  assert.ok(Math.abs(logShare(31, 1023) - 50) < 0.01);
  assert.equal(logShare(null, 1000), 0);
});

test('share maps linearly and clamps', () => {
  assert.equal(share(5, 10), 50);
  assert.equal(share(20, 10), 100);
  assert.equal(share(1, 0), 0);
});

test('niceTicks returns round steps up to max', () => {
  assert.deepEqual(niceTicks(1_882_376, 4), [0, 500000, 1000000, 1500000, 2000000]);
  assert.deepEqual(niceTicks(9, 3), [0, 5, 10]);
  assert.deepEqual(niceTicks(0, 3), [0]);
});

test('decade and yearOf read partial dates', () => {
  assert.equal(yearOf('1956-08-03'), 1956);
  assert.equal(yearOf('1836'), 1836);
  assert.equal(decade('1956-08-03'), '1950s');
  assert.equal(decade('1801'), '1800s');
});

test('labelize humanizes API enums', () => {
  assert.equal(labelize('NOT_YET_RECRUITING'), 'Not yet recruiting');
  assert.equal(labelize('PHASE2'), 'Phase 2');
  assert.equal(labelize('EARLY_PHASE1'), 'Early phase 1');
  assert.equal(labelize('NA'), 'Not applicable');
  assert.equal(labelize('OTHER_GOV'), 'Other gov');
  assert.equal(labelize('NIH'), 'NIH');
});

test('stamp formats an ISO timestamp in UTC', () => {
  assert.equal(stamp('2026-11-03T04:55:10.229Z'), '2026-11-03 04:55 UTC');
});
