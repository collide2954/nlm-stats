import { test } from 'node:test';
import assert from 'node:assert/strict';
import { US_TILES } from '../../src/tiles.js';

const STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');

test('US_TILES places every state, DC and Puerto Rico once', () => {
  const codes = Object.keys(US_TILES);
  for (const s of [...STATES, 'DC', 'PR']) assert.ok(US_TILES[s], s);
  assert.equal(codes.length, 52);
  const cells = codes.map((k) => `${US_TILES[k].col},${US_TILES[k].row}`);
  assert.equal(new Set(cells).size, 52);
  for (const k of codes) {
    assert.ok(US_TILES[k].name.length > 3, k);
    assert.ok(US_TILES[k].col >= 0 && US_TILES[k].col < 12 && US_TILES[k].row >= 0 && US_TILES[k].row < 8, k);
  }
});
