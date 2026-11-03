import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LENSES, readLens, inLens, lensSearch } from '../../src/lib.js';

test('LENSES start with everything and cover the three audiences', () => {
  assert.deepEqual(LENSES.map((l) => l.id), ['all', 'bioinfo', 'stats', 'funding']);
  for (const l of LENSES) assert.ok(l.label.length > 2);
});

test('readLens reads a valid lens from the query string', () => {
  assert.equal(readLens('?lens=stats'), 'stats');
  assert.equal(readLens('?q=1&lens=bioinfo'), 'bioinfo');
  assert.equal(readLens(''), 'all');
  assert.equal(readLens('?lens=nope'), 'all');
});

test('inLens shows tagged sections, and everything under all', () => {
  assert.equal(inLens('bioinfo stats', 'stats'), true);
  assert.equal(inLens('bioinfo', 'funding'), false);
  assert.equal(inLens('bioinfo', 'all'), true);
  assert.equal(inLens('', 'all'), true);
  assert.equal(inLens(undefined, 'stats'), true);
});

test('lensSearch writes the lens into the query string', () => {
  assert.equal(lensSearch('', 'stats'), '?lens=stats');
  assert.equal(lensSearch('?lens=stats&x=1', 'all'), '?x=1');
  assert.equal(lensSearch('?lens=stats', 'all'), '');
});
