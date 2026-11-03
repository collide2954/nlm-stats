import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUERY_GROUPS, ENTREZ_DBS, yearRange, ERAS, PAPERS } from '../../src/queries.js';

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

test('PAPERS lists landmark PMIDs with a topic', () => {
  assert.ok(PAPERS.length >= 8);
  for (const p of PAPERS) {
    assert.match(p.pmid, /^\d+$/);
    assert.ok(p.topic.length > 1);
  }
  assert.equal(new Set(PAPERS.map((p) => p.pmid)).size, PAPERS.length);
});

test('a MeSH group counts record types', () => {
  const mesh = QUERY_GROUPS.find((g) => g.id === 'mesh');
  assert.ok(mesh);
  assert.ok(mesh.items.every((i) => i.db === 'mesh'));
});

test('ICS lists the 25 NIH institutes and centers RePORTER funds under', async () => {
  const { ICS } = await import('../../src/queries.js');
  assert.equal(ICS.length, 25);
  assert.ok(ICS.includes('NLM'));
  assert.equal(new Set(ICS).size, ICS.length);
});

test('METHODS are PubMed terms with unique ids', async () => {
  const { METHODS } = await import('../../src/queries.js');
  assert.ok(METHODS.length >= 8);
  assert.equal(new Set(METHODS.map((m) => m.id)).size, METHODS.length);
  for (const m of METHODS) assert.match(m.term, /\[(mh|pt)\]$/);
});

test('ENROLLMENT_BANDS are contiguous from 0 to MAX', async () => {
  const { ENROLLMENT_BANDS } = await import('../../src/queries.js');
  assert.equal(ENROLLMENT_BANDS[0].from, 0);
  assert.equal(ENROLLMENT_BANDS.at(-1).to, 'MAX');
  for (let i = 1; i < ENROLLMENT_BANDS.length; i += 1) {
    assert.equal(ENROLLMENT_BANDS[i].from, ENROLLMENT_BANDS[i - 1].to + 1);
  }
});

test('sequence data groups target assembly and sra', () => {
  const seq = QUERY_GROUPS.filter((g) => g.panel === 'seqdata');
  assert.ok(seq.length >= 3);
  assert.ok(seq.some((g) => g.items.every((i) => i.db === 'assembly')));
  assert.ok(seq.some((g) => g.items.every((i) => i.db === 'sra')));
});

test('TYPE_SERIES splits stacked and small-multiple publication types', async () => {
  const { TYPE_SERIES } = await import('../../src/queries.js');
  assert.equal(TYPE_SERIES.stacked.length, 5);
  assert.ok(TYPE_SERIES.multiples.length >= 5);
  const all = [...TYPE_SERIES.stacked, ...TYPE_SERIES.multiples];
  assert.equal(new Set(all.map((t) => t.id)).size, all.length);
  for (const t of all) assert.match(t.term, /\[pt\]$/);
  assert.ok(TYPE_SERIES.from <= 1950);
});

test('GROWTH lists databases with their own date fields', async () => {
  const { GROWTH } = await import('../../src/queries.js');
  assert.ok(GROWTH.dbs.length >= 8);
  for (const g of GROWTH.dbs) {
    assert.ok(ENTREZ_DBS.includes(g.db), g.db);
    assert.match(g.field, /^[A-Z]+$/);
    assert.ok(g.label && g.what);
  }
  assert.ok(GROWTH.from >= 1990);
});

test('ACCESS series and COUNTRIES are PubMed queries', async () => {
  const { ACCESS, COUNTRIES } = await import('../../src/queries.js');
  assert.ok(ACCESS.series.length >= 3);
  for (const s of ACCESS.series) assert.ok(s.id && s.label && s.term);
  assert.ok(COUNTRIES.list.length >= 15);
  assert.equal(new Set(COUNTRIES.list.map((c) => c.name)).size, COUNTRIES.list.length);
  for (const c of COUNTRIES.list) assert.match(c.term, /\[ad\]/);
  assert.equal(COUNTRIES.years.length, 2);
});

test('GENES are verified human Gene IDs with symbols', async () => {
  const { GENES } = await import('../../src/queries.js');
  assert.ok(GENES.length >= 15);
  for (const g of GENES) {
    assert.match(String(g.id), /^\d+$/);
    assert.match(g.symbol, /^[A-Z0-9]+$/);
  }
});

test('variant and access groups exist', () => {
  const panels = new Set(QUERY_GROUPS.map((g) => g.panel));
  assert.ok(panels.has('variants'));
  assert.ok(panels.has('access'));
  const review = QUERY_GROUPS.find((g) => g.id === 'cv-review');
  assert.ok(review.items.every((i) => i.db === 'clinvar' && /\[RVST\]$/.test(i.term)));
});
