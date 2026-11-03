import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  squarify, waffle, scaleLinear, scaleLog, logTicks, stack, zoomDomain, panDomain, wordy, easeOut,
} from '../../src/lib.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

test('squarify tiles the box with areas proportional to value', () => {
  const items = [6, 6, 4, 3, 2, 2, 1].map((value, i) => ({ id: i, value }));
  const rects = squarify(items, 600, 400);
  const total = 24;
  assert.equal(rects.length, 7);
  let area = 0;
  for (const r of rects) {
    assert.ok(r.x >= -1e-9 && r.y >= -1e-9 && r.x + r.w <= 600 + 1e-6 && r.y + r.h <= 400 + 1e-6, JSON.stringify(r));
    assert.ok(close(r.w * r.h, (r.value / total) * 240000, 1e-3));
    area += r.w * r.h;
  }
  assert.ok(close(area, 240000, 1e-3));
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      const a = rects[i];
      const b = rects[j];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert.ok(ox * oy < 1e-6, `${i} overlaps ${j}`);
    }
  }
  assert.equal(rects.find((r) => r.id === 6).value, 1);
});

test('squarify keeps rectangles close to square', () => {
  const rects = squarify([5, 5, 5, 5].map((value) => ({ value })), 400, 400);
  for (const r of rects) assert.ok(Math.max(r.w / r.h, r.h / r.w) <= 2.01);
});

test('waffle splits 100 cells by largest remainder', () => {
  const cells = waffle([{ key: 'yes', value: 24.1 }, { key: 'no', value: 75.9 }]);
  assert.equal(cells.length, 100);
  assert.equal(cells.filter((c) => c === 'yes').length, 24);
  assert.equal(cells[0], 'yes');
  const thirds = waffle([{ key: 'a', value: 33.4 }, { key: 'b', value: 33.3 }, { key: 'c', value: 33.3 }]);
  assert.deepEqual(['a', 'b', 'c'].map((k) => thirds.filter((c) => c === k).length), [34, 33, 33]);
});

test('scales map linearly and logarithmically', () => {
  assert.equal(scaleLinear([0, 10], [0, 100])(5), 50);
  assert.equal(scaleLinear([0, 10], [100, 0])(10), 0);
  assert.ok(close(scaleLog([1, 1000], [0, 300])(10), 100));
});

test('logTicks lists powers of ten inside the range', () => {
  assert.deepEqual(logTicks(56, 41381383), [100, 1000, 10000, 100000, 1000000, 10000000]);
});

test('stack accumulates series per row', () => {
  const rows = [{ year: 1, a: 1, b: 2 }, { year: 2, a: 3, b: 1 }];
  assert.deepEqual(stack(rows, ['a', 'b']), [
    { key: 'a', points: [[0, 1], [0, 3]] },
    { key: 'b', points: [[1, 3], [3, 4]] },
  ]);
});

test('zoomDomain zooms around a point and stays inside limits', () => {
  assert.deepEqual(zoomDomain([1800, 2000], 1900, 0.5, [1800, 2026]), [1850, 1950]);
  assert.deepEqual(zoomDomain([1950, 2026], 2026, 4, [1800, 2026]), [1800, 2026]);
  assert.deepEqual(zoomDomain([1900, 2000], 2000, 2, [1800, 2026]), [1800, 2000]);
  assert.deepEqual(zoomDomain([1900, 1902], 1901, 0.1, [1800, 2026], 4), [1899, 1903]);
});

test('panDomain shifts and clamps', () => {
  assert.deepEqual(panDomain([1900, 1950], 100, [1800, 2026]), [1976, 2026]);
  assert.deepEqual(panDomain([1900, 1950], -200, [1800, 2026]), [1800, 1850]);
});

test('wordy writes big numbers in words', () => {
  assert.equal(wordy(1663411801), '1.66 billion');
  assert.equal(wordy(41381383), '41.4 million');
  assert.equal(wordy(12000000), '12 million');
  assert.equal(wordy(609811), '609,811');
  assert.equal(wordy(9384961284424), '9.38 trillion');
});

test('easeOut eases toward one', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  assert.equal(easeOut(0.5), 0.875);
});

test('waffle always fills every cell when several parts round down', () => {
  const cells = waffle([1, 1, 1, 1, 1, 1].map((value, key) => ({ key, value })));
  assert.equal(cells.length, 100);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => cells.filter((c) => c === k).length), [17, 17, 17, 17, 16, 16]);
});
