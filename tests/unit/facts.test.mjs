import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES, TIMELINE, PEOPLE, PROJECTS, ODDITIES, EXAMPLES, TAGS } from '../../src/facts.js';
import { identify } from '../../src/lib.js';
import { ENTREZ_DBS } from '../../src/queries.js';

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

test('every source is an https url', () => {
  for (const [key, url] of Object.entries(SOURCES)) {
    assert.match(url, /^https:\/\//, key);
  }
});

test('timeline is long, dated, tagged, sourced and sorted', () => {
  assert.ok(TIMELINE.length >= 50);
  for (const item of TIMELINE) {
    assert.match(item.date, DATE, item.text);
    assert.ok(['NLM', 'NCBI'].includes(item.org), item.text);
    assert.ok(TAGS.includes(item.tag), item.tag);
    assert.ok(item.text.length > 10 && item.text.length <= 140, item.text);
    assert.ok(SOURCES[item.src], `missing source ${item.src}`);
  }
  const dates = TIMELINE.map((t) => t.date);
  assert.deepEqual(dates, [...dates].sort());
});

test('people have ordered tenures and sources', () => {
  assert.ok(PEOPLE.length >= 9);
  for (const p of PEOPLE) {
    assert.ok(p.name && p.role && p.org);
    assert.ok(p.from <= (p.to ?? 9999), p.name);
    assert.ok(SOURCES[p.src], p.name);
  }
});

test('projects are unique with several facts each', () => {
  assert.ok(PROJECTS.length >= 14);
  assert.equal(new Set(PROJECTS.map((p) => p.name)).size, PROJECTS.length);
  for (const p of PROJECTS) {
    assert.ok(['NLM', 'NCBI'].includes(p.org), p.name);
    assert.match(String(p.since), /^\d{4}$/, p.name);
    assert.ok(p.facts.length >= 3, p.name);
    assert.ok(SOURCES[p.src], p.name);
    assert.match(p.url, /^https:\/\//, p.name);
    if (p.db) assert.ok(ENTREZ_DBS.includes(p.db), p.db);
  }
});

test('oddities are few, sharp and sourced', () => {
  assert.ok(ODDITIES.length >= 3 && ODDITIES.length <= 6, `${ODDITIES.length}`);
  const text = ODDITIES.map((o) => o.text).join('\n');
  assert.match(text, /Ford's Theatre/);
  assert.match(text, /75 tons/);
  assert.match(text, /Index-Catalogue/);
  assert.match(text, /underscore/);
  assert.doesNotMatch(text, /FIND-NLM|D000001|PMID 1 |1781|Basque|golf/);
  for (const o of ODDITIES) {
    assert.ok(o.text.length > 10);
    assert.ok(SOURCES[o.src], o.text);
  }
});

test('every decoder example is recognised', () => {
  assert.ok(EXAMPLES.length >= 12);
  for (const e of EXAMPLES) {
    assert.ok(identify(e.id), e.id);
    assert.ok(e.is.length > 2, e.id);
  }
});

test('every GenBank division in the snapshot has a name', async () => {
  const { DIVISIONS } = await import('../../src/facts.js');
  const { default: snapshot } = await import('../../src/snapshot.js');
  for (const d of snapshot.genbank.divisions) assert.ok(DIVISIONS[d.code], d.code);
});

test('PMC growth runs FY13 to FY25 in order', async () => {
  const { PMC_YEARS } = await import('../../src/facts.js');
  assert.equal(PMC_YEARS[0].fy, 2013);
  assert.equal(PMC_YEARS.at(-1).fy, 2025);
  for (let i = 1; i < PMC_YEARS.length; i += 1) {
    assert.equal(PMC_YEARS[i].fy, PMC_YEARS[i - 1].fy + 1);
    assert.ok(PMC_YEARS[i].articles > PMC_YEARS[i - 1].articles);
  }
});

test('API limits are sourced and specific', async () => {
  const { APIS } = await import('../../src/facts.js');
  assert.ok(APIS.length >= 5);
  for (const a of APIS) {
    assert.ok(a.service && a.limit && a.note, a.service);
    assert.ok(SOURCES[a.src], a.service);
  }
});

test('release cadences are sourced', async () => {
  const { CADENCES } = await import('../../src/facts.js');
  assert.ok(CADENCES.length >= 6);
  for (const c of CADENCES) {
    assert.ok(c.resource && c.cadence, c.resource);
    assert.ok(SOURCES[c.src], c.resource);
  }
});

test('projects are listed by start year', () => {
  const years = PROJECTS.map((p) => p.since);
  assert.deepEqual(years, [...years].sort((a, b) => a - b));
});

test('every source has a readable title in a known group', async () => {
  const { SOURCE_TITLES, SOURCE_GROUPS } = await import('../../src/facts.js');
  for (const key of Object.keys(SOURCES)) {
    const entry = SOURCE_TITLES[key];
    assert.ok(entry, key);
    const [group, title] = entry;
    assert.ok(SOURCE_GROUPS.includes(group), `${key}: ${group}`);
    assert.ok(title.length > 5 && !/^https?:|^www\./.test(title), key);
  }
});
