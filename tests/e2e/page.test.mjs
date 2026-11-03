import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { start } from '../../scripts/serve.mjs';
import snapshot from '../../src/snapshot.js';
import { TIMELINE, PROJECTS, ODDITIES, PEOPLE, APIS, CADENCES } from '../../src/facts.js';
import { exact, liveOddities, sortRows } from '../../src/lib.js';
import { findings } from '../../src/findings.js';
import { ICS, METHODS } from '../../src/queries.js';

const { chromium } = createRequire(import.meta.url)('playwright');

let server;
let browser;
let base;

const open = async ({ width = 1280, height = 900, search = '', motion = 'reduce' } = {}) => {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED|fonts\.g/.test(m.text()) && errors.push(m.text()));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(`${base}${search}`);
  await page.waitForSelector('#entrez-chart [data-db]', { state: 'attached' });
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

test('loads without errors, leads with the PubMed total and states findings', async () => {
  const { page, errors } = await open();
  assert.match(await page.title(), /NLM/);
  const pubmed = snapshot.entrez.find((d) => d.db === 'pubmed').count;
  assert.equal((await page.textContent('[data-hero="pubmed"]')).trim(), exact(pubmed));
  const f = findings(snapshot);
  assert.equal((await page.textContent('#funding h2')).trim(), f.funding);
  assert.equal((await page.textContent('#trials h2')).trim(), f.trials);
  assert.deepEqual(errors, []);
  await page.close();
});

test('entrez dot plot lists every database and re-sorts', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#entrez-chart [data-db]').count(), snapshot.entrez.length);
  const firstByRank = () => page.$eval('#entrez-chart [data-rank="0"]', (n) => n.dataset.db);
  assert.equal(await firstByRank(), sortRows(snapshot.entrez, 'count', 'desc')[0].db);
  await page.click('#entrez-sort button[data-sort="name"]');
  assert.equal(await firstByRank(), sortRows(snapshot.entrez, 'name', 'asc')[0].db);
  await page.click('#entrez-sort button[data-sort="updated"]');
  assert.equal(await firstByRank(), sortRows(snapshot.entrez, 'updated', 'desc')[0].db);
  assert.equal(await page.locator('#entrez table tbody tr').count(), snapshot.entrez.length);
  await page.close();
});

test('bar charts show a tooltip on hover', async () => {
  const { page } = await open();
  await page.hover('#pubmed-chart [data-year="2020"]');
  const count = snapshot.pubmed.years.find((y) => y.year === 2020).count;
  assert.match(await page.textContent('#tip'), new RegExp(`${exact(count)}[\\s\\S]*2020`));
  assert.equal(await page.isVisible('#tip'), true);
  await page.close();
});

test('publication types chart stacks five series with small multiples', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#types-chart path[data-key]').count(), 5);
  assert.equal(await page.locator('#types-multiples .panel').count(), 6);
  await page.hover('#types-chart .hit');
  assert.match(await page.textContent('#tip'), /Review/);
  await page.close();
});

test('facet tabs switch dot plots', async () => {
  const { page } = await open();
  await page.click('#facets [role="tab"][data-group="languages"]');
  assert.match(await page.textContent('#facets [role="tabpanel"]'), /Latin/);
  await page.click('#facets [role="tab"][data-group="clinvar"]');
  assert.match(await page.textContent('#facets [role="tabpanel"]'), /Uncertain significance/);
  await page.close();
});

test('methods, papers and PMC charts render', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#methods-list li svg').count(), METHODS.length);
  assert.equal(await page.locator('#papers-chart [data-pmid]').count(), snapshot.papers.length);
  assert.ok(await page.locator('#pmc-chart [data-fy]').count() >= 13);
  await page.close();
});

test('trial figures render waffles, timing and enrollment', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#results-waffle .cell').count(), 100);
  assert.equal(await page.locator('#masking-waffle .cell').count(), 100);
  assert.equal(await page.locator('#design-chart [data-year]').count(), snapshot.clinicaltrials.timing.length);
  assert.equal(await page.locator('#enrollment-chart [data-band]').count(), snapshot.clinicaltrials.enrollmentBands.length);
  await page.click('#ct-tabs [role="tab"][data-field="Phase"]');
  assert.match(await page.textContent('#ct-panel'), /Phase 2/);
  await page.close();
});

test('funding treemap, history and waffle render', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#ic-treemap [data-ic]').count(), ICS.length);
  assert.equal(await page.locator('#ic-treemap [data-ic="NLM"].me').count(), 1);
  assert.equal(await page.locator('#funding-chart [data-fy]').count(), snapshot.funding.years.length);
  assert.equal(await page.locator('#intramural-waffle .cell').count(), 100);
  await page.hover('#ic-treemap [data-ic="NCI"]');
  assert.match(await page.textContent('#tip'), /NCI/);
  await page.close();
});

test('sequence section renders charts and reference tables', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#organisms-chart [data-row]').count(), snapshot.genbank.organisms.length);
  assert.ok(await page.locator('#genbank-chart path.line').count() >= 2);
  assert.equal(await page.locator('#refseq-prefixes tbody tr').count(), 15);
  assert.equal(await page.locator('#api-table tbody tr').count(), APIS.length);
  assert.equal(await page.locator('#cadence-table tbody tr').count(), CADENCES.length);
  await page.close();
});

test('timeline draws every event, person and project and zooms', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#timeline-svg [data-event]').count(), TIMELINE.length);
  assert.equal(await page.locator('#timeline-svg [data-person]').count(), PEOPLE.length);
  assert.equal(await page.locator('#timeline-svg [data-project]').count(), PROJECTS.length);
  const initial = await page.textContent('#timeline-range');
  await page.click('#zoom-in');
  assert.notEqual(await page.textContent('#timeline-range'), initial);
  await page.click('#timeline-eras button[data-from="1950"]');
  assert.match(await page.textContent('#timeline-range'), /1950/);
  await page.click('#zoom-reset');
  assert.equal(await page.textContent('#timeline-range'), initial);
  await page.close();
});

test('timeline tag chips filter the event list', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#timeline-list li').count(), TIMELINE.length);
  await page.click('#timeline-tags button[data-tag="retired"]');
  assert.equal(await page.locator('#timeline-list li:visible').count(), TIMELINE.filter((t) => t.tag === 'retired').length);
  await page.close();
});

test('global filter narrows lists', async () => {
  const { page } = await open();
  await page.fill('#q', 'blast');
  await page.waitForTimeout(250);
  const expected = TIMELINE.filter((t) => /blast/i.test(`${t.date} ${t.org} ${t.tag} ${t.text}`)).length;
  assert.equal(await page.locator('#timeline-list li:visible').count(), expected);
  const projects = await page.locator('#projects-table tbody tr:visible').count();
  assert.ok(projects >= 1 && projects < PROJECTS.length);
  await page.close();
});

test('oddities include snapshot-derived facts and shuffle', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#oddities li').count(), ODDITIES.length + liveOddities(snapshot).length);
  await page.click('#shuffle');
  assert.equal(await page.locator('#oddities li.lit').count(), 1);
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

test('lens buttons hide sections and update the URL', async () => {
  const { page } = await open();
  await page.click('#lenses button[data-lens="stats"]');
  assert.equal(await page.isVisible('#entrez'), false);
  assert.equal(await page.isVisible('#methods'), true);
  assert.equal(await page.isVisible('#jump a[data-for="entrez"]'), false);
  assert.match(page.url(), /\?lens=stats$/);
  await page.click('#lenses button[data-lens="all"]');
  assert.equal(await page.isVisible('#entrez'), true);
  assert.doesNotMatch(page.url(), /lens=/);
  await page.close();
});

test('a lens in the URL is applied on load', async () => {
  const { page } = await open({ search: '?lens=funding' });
  assert.equal(await page.isVisible('#funding'), true);
  assert.equal(await page.isVisible('#decoder'), false);
  assert.equal(await page.getAttribute('#lenses button[data-lens="funding"]', 'aria-pressed'), 'true');
  await page.close();
});

test('theme toggle flips the color scheme', async () => {
  const { page } = await open();
  const initial = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#theme');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), initial);
  await page.close();
});

test('figures animate in when scrolled into view', async () => {
  const { page } = await open({ motion: 'no-preference' });
  assert.equal(await page.locator('#funding .fig.in').count(), 0);
  await page.locator('#funding-chart').scrollIntoViewIfNeeded();
  await page.waitForSelector('#funding .fig.in');
  await page.locator('[data-hero="pubmed"]').scrollIntoViewIfNeeded();
  const pubmed = snapshot.entrez.find((d) => d.db === 'pubmed').count;
  await page.waitForFunction((v) => document.querySelector('[data-hero="pubmed"]').textContent.trim() === v, exact(pubmed));
  await page.close();
});

for (const width of [320, 375, 414, 768, 1280]) {
  test(`no horizontal scroll at ${width}px`, async () => {
    const { page } = await open({ width, height: 800 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 0, `overflow ${overflow}px`);
    await page.close();
  });
}
