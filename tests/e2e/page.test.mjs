import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { start } from '../../scripts/serve.mjs';
import snapshot from '../../src/snapshot.js';
import { TIMELINE, PROJECTS, ODDITIES, PEOPLE, APIS, CADENCES } from '../../src/facts.js';
import { exact, liveOddities } from '../../src/lib.js';
import { ICS } from '../../src/queries.js';

const { chromium } = createRequire(import.meta.url)('playwright');

let server;
let browser;
let base;

const blockNetwork = async (page) => {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
};

const open = async (viewport = { width: 1280, height: 900 }, search = '') => {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  await blockNetwork(page);
  await page.goto(`${base}${search}`);
  await page.waitForSelector('#db-table tbody tr', { state: 'attached' });
  return { page, errors };
};

before(async () => {
  server = await start(0);
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});

after(async () => {
  await browser.close();
  server.close();
});

test('loads without errors and shows the PubMed total', async () => {
  const { page, errors } = await open();
  assert.match(await page.title(), /NLM/);
  const pubmed = snapshot.entrez.find((d) => d.db === 'pubmed').count;
  assert.equal((await page.textContent('[data-hero="pubmed"] .exact')).trim(), exact(pubmed));
  assert.deepEqual(errors, []);
  await page.close();
});

test('lists every Entrez database and sorts by count', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#db-table tbody tr').count(), snapshot.entrez.length);
  await page.click('#db-table button[data-sort="count"]');
  const first = await page.textContent('#db-table tbody tr:first-child td[data-col="name"]');
  const top = [...snapshot.entrez].sort((a, b) => b.count - a.count)[0];
  assert.equal(first.trim(), top.name);
  await page.click('#db-table button[data-sort="count"]');
  const flipped = await page.textContent('#db-table tbody tr:first-child td[data-col="name"]');
  const bottom = [...snapshot.entrez].sort((a, b) => a.count - b.count)[0];
  assert.equal(flipped.trim(), bottom.name);
  await page.close();
});

test('renders timeline, projects, people and oddities', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#timeline li').count(), TIMELINE.length);
  assert.equal(await page.locator('#projects article').count(), PROJECTS.length);
  assert.equal(await page.locator('#people li').count(), PEOPLE.length);
  assert.equal(await page.locator('#oddities li').count(), ODDITIES.length + liveOddities(snapshot).length);
  await page.close();
});

test('global search filters timeline and projects', async () => {
  const { page } = await open();
  await page.fill('#q', 'blast');
  await page.waitForTimeout(250);
  const visible = await page.locator('#timeline li:visible').count();
  const expected = TIMELINE.filter((t) => /blast/i.test(`${t.date} ${t.org} ${t.tag} ${t.text}`)).length;
  assert.equal(visible, expected);
  assert.ok(await page.locator('#projects article:visible').count() >= 1);
  assert.ok(await page.locator('#projects article:visible').count() < PROJECTS.length);
  await page.fill('#q', '');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#timeline li:visible').count(), TIMELINE.length);
  await page.close();
});

test('timeline tag chips filter entries', async () => {
  const { page } = await open();
  await page.click('#timeline-tags button[data-tag="retired"]');
  const expected = TIMELINE.filter((t) => t.tag === 'retired').length;
  assert.equal(await page.locator('#timeline li:visible').count(), expected);
  await page.click('#timeline-tags button[data-tag="retired"]');
  assert.equal(await page.locator('#timeline li:visible').count(), TIMELINE.length);
  await page.close();
});

test('decoder identifies typed and example identifiers', async () => {
  const { page } = await open();
  await page.fill('#decoder-input', 'rs334');
  await page.waitForSelector('#decoder-out a');
  assert.match(await page.textContent('#decoder-out'), /rsID/);
  assert.equal(await page.getAttribute('#decoder-out a', 'href'), 'https://www.ncbi.nlm.nih.gov/snp/rs334');
  await page.click('#decoder .example[data-id="CID 2244"]');
  assert.equal(await page.inputValue('#decoder-input'), 'CID 2244');
  assert.match(await page.textContent('#decoder-out'), /PubChem CID/);
  await page.fill('#decoder-input', 'not an id');
  assert.match(await page.textContent('#decoder-out'), /No match/);
  await page.close();
});

test('facet tabs switch panels', async () => {
  const { page } = await open();
  await page.click('#facets [role="tab"][data-group="languages"]');
  assert.match(await page.textContent('#facets [role="tabpanel"]'), /Latin/);
  await page.click('#facets [role="tab"][data-group="clinvar"]');
  assert.match(await page.textContent('#facets [role="tabpanel"]'), /Uncertain significance/);
  await page.close();
});

test('pubmed chart shows a tooltip for a year', async () => {
  const { page } = await open();
  await page.hover('#pubmed-chart [data-year="2020"]');
  const count = snapshot.pubmed.years.find((y) => y.year === 2020).count;
  assert.match(await page.textContent('#pubmed-tip'), new RegExp(`2020[\\s\\S]*${exact(count)}`));
  await page.close();
});

test('genbank and trials sections render data', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#gb-organisms li').count(), snapshot.genbank.organisms.length);
  assert.match(await page.textContent('#gb-organisms'), /Triticum aestivum/);
  assert.ok(await page.locator('#ct-fields li').count() > 30);
  await page.close();
});

test('theme toggle flips the color scheme', async () => {
  const { page } = await open();
  const initial = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#theme');
  const toggled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(initial, toggled);
  await page.close();
});

test('shuffle highlights an oddity', async () => {
  const { page } = await open();
  await page.click('#shuffle');
  assert.equal(await page.locator('#oddities li.lit').count(), 1);
  await page.close();
});

test('data comes from the weekly snapshot only', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#refresh').count(), 0);
  assert.match(await page.textContent('#stamp'), /Snapshot \d{4}-\d{2}-\d{2}/);
  assert.match(await page.textContent('#stamp'), /weekly/i);
  await page.close();
});

test('lens buttons hide sections outside the lens and update the URL', async () => {
  const { page } = await open();
  await page.click('#lenses button[data-lens="stats"]');
  assert.equal(await page.isVisible('#entrez'), false);
  assert.equal(await page.isVisible('#methods'), true);
  assert.equal(await page.isVisible('#counts'), true);
  assert.equal(await page.isVisible('.jump a[href="#entrez"]'), false);
  assert.match(page.url(), /\?lens=stats$/);
  assert.equal(await page.getAttribute('#lenses button[data-lens="stats"]', 'aria-pressed'), 'true');
  await page.click('#lenses button[data-lens="all"]');
  assert.equal(await page.isVisible('#entrez'), true);
  assert.doesNotMatch(page.url(), /lens=/);
  await page.close();
});

test('a lens in the URL is applied on load', async () => {
  const { page } = await open(undefined, '?lens=funding');
  assert.equal(await page.isVisible('#funding'), true);
  assert.equal(await page.isVisible('#decoder'), false);
  assert.equal(await page.getAttribute('#lenses button[data-lens="funding"]', 'aria-pressed'), 'true');
  await page.close();
});

test('funding section charts NLM by fiscal year and compares institutes', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#funding-chart [data-fy]').count(), snapshot.funding.years.length);
  assert.equal(await page.locator('#funding-ics li').count(), ICS.length);
  assert.equal(await page.locator('#funding-ics li.me').count(), 1);
  assert.match(await page.textContent('#funding-dek'), new RegExp(exact(snapshot.funding.detail.projects)));
  await page.hover(`#funding-chart [data-fy="${snapshot.funding.detailFy}"]`);
  assert.match(await page.textContent('#funding-tip'), new RegExp(`FY${snapshot.funding.detailFy}`));
  await page.close();
});

test('methods section draws one sparkline per method', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#methods-list li').count(), snapshot.methods.length);
  assert.equal(await page.locator('#methods-list li svg').count(), snapshot.methods.length);
  await page.close();
});

test('trial design and timing render', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#design-fields li').count() > 20);
  assert.equal(await page.locator('#design-chart [data-year]').count(), snapshot.clinicaltrials.timing.length);
  assert.equal(await page.locator('#enrollment li').count(), snapshot.clinicaltrials.enrollmentBands.length);
  await page.close();
});

test('sequence data, RefSeq prefixes, API limits and cadences render', async () => {
  const { page } = await open();
  const seqItems = snapshot.groups.filter((g) => g.panel === 'seqdata').reduce((n, g) => n + g.items.length, 0);
  assert.equal(await page.locator('#seq-groups li').count(), seqItems);
  assert.equal(await page.locator('#refseq-prefixes tbody tr').count(), 15);
  assert.equal(await page.locator('#api-table tbody tr').count(), APIS.length);
  assert.equal(await page.locator('#cadence-table tbody tr').count(), CADENCES.length);
  await page.close();
});

for (const width of [320, 375, 414, 768]) {
  test(`no horizontal scroll at ${width}px`, async () => {
    const { page } = await open({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `overflow ${overflow}px`);
    await page.close();
  });
}
