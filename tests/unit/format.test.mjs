import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exact, compact, pct } from '../../src/lib.js';

test('exact groups thousands with commas', () => {
  assert.equal(exact(41379710), '41,379,710');
  assert.equal(exact(0), '0');
  assert.equal(exact(999), '999');
  assert.equal(exact('609811'), '609,811');
});

test('exact returns a dash for missing values', () => {
  assert.equal(exact(undefined), '—');
  assert.equal(exact(null), '—');
  assert.equal(exact('n/a'), '—');
});

test('compact abbreviates with one decimal', () => {
  assert.equal(compact(41379710), '41.4M');
  assert.equal(compact(1500), '1.5K');
  assert.equal(compact(2_300_000_000), '2.3B');
  assert.equal(compact(4_100_000_000_000), '4.1T');
  assert.equal(compact(950), '950');
  assert.equal(compact(1_000_000), '1M');
});

test('pct formats a ratio as a percentage', () => {
  assert.equal(pct(0.1234), '12.3%');
  assert.equal(pct(1), '100%');
  assert.equal(pct(0), '0%');
});
