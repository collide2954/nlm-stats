import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUERY_GROUPS, ENTREZ_DBS, yearRange, ERAS } from '../../src/queries.js';

test('there are many query groups', () => {
  assert.ok(QUERY_GROUPS.length >= 5);
});

test('every query has a unique id, a known db, a label and a term', () => {
  const ids = new Set();
  for (const group of QUERY_GROUPS) {
    assert.ok(group.id && group.title);
    for (const q of group.items) {
      assert.ok(ENTREZ_DBS.includes(q.db), `${q.db} unknown`);
      assert.ok(q.label.length > 1);
      assert.ok(q.term.length > 1);
      assert.ok(!ids.has(q.id), `duplicate ${q.id}`);
      ids.add(q.id);
    }
  }
});

test('ENTREZ_DBS lists the 38 Entrez databases', () => {
  assert.equal(ENTREZ_DBS.length, 38);
  assert.ok(ENTREZ_DBS.includes('pubmed'));
  assert.ok(ENTREZ_DBS.includes('gtr'));
});

test('yearRange is inclusive', () => {
  assert.deepEqual(yearRange(1999, 2001), [1999, 2000, 2001]);
});

test('ERAS cover 1781 to 1944 without gaps', () => {
  assert.equal(ERAS[0].from, 1781);
  assert.equal(ERAS.at(-1).to, 1944);
  for (let i = 1; i < ERAS.length; i += 1) {
    assert.equal(ERAS[i].from, ERAS[i - 1].to + 1);
  }
});
