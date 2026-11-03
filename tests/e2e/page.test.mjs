import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { start } from '../../scripts/serve.mjs';
import snapshot from '../../src/snapshot.js';
import { TIMELINE, PROJECTS, ODDITIES, PEOPLE, APIS, CADENCES } from '../../src/facts.js';
import {
  exact, liveOddities, sortRows, doublingMonths, medianBand,
} from '../../src/lib.js';
import { findings } from '../../src/findings.js';
import {
  ICS, METHODS, GROWTH, COUNTRIES, GENES, VOCAB, SUBJECTS, RETRACTED, CLASSICS,
} from '../../src/queries.js';
import { US_TILES } from '../../src/tiles.js';

const { chromium, devices } = createRequire(import.meta.url)('playwright');

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

const openPhone = async () => {
  const context = await browser.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.goto(base);
  await page.waitForSelector('#entrez-chart [data-db]', { state: 'attached' });
  return { page, context };
};

const tapAt = async (page, selector, fx = 0.5, fy = 0.5) => {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  await page.touchscreen.tap(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(250);
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

test('on a phone a tap pins the popup near the nearest bar and it stays', async () => {
  const { page, context } = await openPhone();
  await tapAt(page, '#pubmed-chart svg', 0.5, 0.85);
  assert.equal(await page.isVisible('#tip'), true);
  await page.waitForTimeout(600);
  assert.equal(await page.isVisible('#tip'), true);
  assert.equal(await page.getAttribute('#tip', 'data-pinned'), 'true');
  assert.match(await page.textContent('#tip'), /\d{4}/);
  assert.ok(await page.locator('#tip a[href*="pubmed.ncbi.nlm.nih.gov"]').count() >= 1);
  const tip = await page.locator('#tip').boundingBox();
  const vw = page.viewportSize().width;
  assert.ok(tip.x >= 0 && tip.x + tip.width <= vw, `tip ${tip.x}+${tip.width} outside ${vw}`);
  await context.close();
});

test('on a phone tapping a dot plot row opens a popup with the link, not a new tab', async () => {
  const { page, context } = await openPhone();
  const opened = [];
  context.on('page', (p) => opened.push(p));
  await tapAt(page, '#entrez-chart [data-db="gene"]', 0.6, 0.5);
  assert.equal(opened.length, 0);
  assert.equal(await page.isVisible('#tip'), true);
  assert.match(await page.textContent('#tip'), /Gene/);
  assert.ok(await page.locator('#tip a[href="https://www.ncbi.nlm.nih.gov/gene/"]').count() === 1);
  await context.close();
});

test('on a phone a tap outside closes the popup and it scrolls with the page', async () => {
  const { page, context } = await openPhone();
  await tapAt(page, '#ic-treemap [data-ic="NCI"]');
  const chartTop = await page.evaluate(() => document.querySelector('#ic-treemap').getBoundingClientRect().top);
  const tipTop = await page.evaluate(() => document.querySelector('#tip').getBoundingClientRect().top);
  await page.evaluate(() => window.scrollBy(0, 120));
  await page.waitForTimeout(150);
  const chartTop2 = await page.evaluate(() => document.querySelector('#ic-treemap').getBoundingClientRect().top);
  const tipTop2 = await page.evaluate(() => document.querySelector('#tip').getBoundingClientRect().top);
  assert.ok(Math.abs((tipTop2 - chartTop2) - (tipTop - chartTop)) < 2, 'popup moved relative to its chart');
  await tapAt(page, '#funding .dek', 0.5, 0.5);
  assert.equal(await page.isVisible('#tip'), false);
  await context.close();
});

test('on desktop hover previews, click pins and Escape closes', async () => {
  const { page } = await open();
  await page.hover('#funding-chart [data-fy="2010"]');
  assert.equal(await page.isVisible('#tip'), true);
  assert.notEqual(await page.getAttribute('#tip', 'data-pinned'), 'true');
  await page.click('#funding-chart [data-fy="2010"]');
  assert.equal(await page.getAttribute('#tip', 'data-pinned'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#tip'), false);
  await page.close();
});

test('database growth draws one panel per database', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#growth-multiples .panel').count(), GROWTH.dbs.length);
  assert.equal((await page.textContent('#growth h2')).trim(), findings(snapshot).growth);
  await page.close();
});

test('access and integrity charts render', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#access-chart path.line').count() >= 2);
  assert.ok(await page.locator('#integrity-chart path.line').count() >= 3);
  assert.equal(await page.locator('#preprints-chart [data-row]').count(), 4);
  await page.close();
});

test('chart row labels are never cut off', async () => {
  for (const width of [1280, 375]) {
    const { page } = await open({ width });
    const cut = await page.$$eval('.chart text.lab', (ts) => ts.map((t) => t.textContent).filter((s) => s.endsWith('…')));
    assert.deepEqual(cut, [], `${width}px`);
    await page.close();
  }
});

test('line chart end labels never overlap', async () => {
  for (const width of [1280, 375]) {
    const { page } = await open({ width });
    const clashes = await page.$$eval('.chart svg:has(path.line)', (svgs) => svgs.flatMap((svg) => {
      const boxes = [...svg.querySelectorAll('text.lab')].map((t) => ({ id: `${svg.closest('[id]')?.id}:${t.textContent}`, b: t.getBBox() }));
      return boxes.flatMap((a, i) => boxes.slice(i + 1)
        .filter((c) => a.b.x < c.b.x + c.b.width && c.b.x < a.b.x + a.b.width && a.b.y < c.b.y + c.b.height - 1 && c.b.y < a.b.y + a.b.height - 1)
        .map((c) => `${a.id} / ${c.id}`));
    }));
    assert.deepEqual(clashes, [], `${width}px`);
    await page.close();
  }
});

test('geography shows a state tile map with a toggle and author countries', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#state-map [data-state]').count(), Object.keys(US_TILES).length);
  const initialStyle = await page.getAttribute('#state-map [data-state="MD"] rect', 'style');
  await page.click('#state-tabs [role="tab"][data-scope="nlm"]');
  assert.notEqual(await page.getAttribute('#state-map [data-state="MD"] rect', 'style'), initialStyle);
  await page.hover('#state-map [data-state="CA"]');
  assert.match(await page.textContent('#tip'), /California/);
  assert.equal(await page.locator('#countries-chart [data-row]').count(), COUNTRIES.list.length);
  await page.close();
});

test('genes and variants render', async () => {
  const { page } = await open();
  assert.equal(await page.locator('#genes-chart [data-row]').count(), GENES.length);
  assert.equal(await page.locator('#review-chart [data-row]').count(), 7);
  assert.ok(await page.locator('#vtype-chart [data-row]').count() >= 5);
  assert.ok(await page.locator('#origin-chart [data-row]').count() >= 5);
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

test('machine text shows the vocabulary curve and retracted papers still cited', async () => {
  const { page, errors } = await open();
  const f = findings(snapshot);
  assert.equal((await page.textContent('#machine h2')).trim(), f.vocab);
  assert.equal((await page.textContent('#machine h3')).trim(), f.zombies);
  assert.equal(await page.locator('#vocab-chart path.line').count(), VOCAB.words.length + 1);
  assert.equal(await page.locator('#zombie-chart [data-row]').count(), RETRACTED.length);
  assert.deepEqual(errors, []);
  await page.close();
});

test('who gets studied draws animals, sex, ages and outbreaks', async () => {
  const { page } = await open();
  const f = findings(snapshot);
  assert.equal((await page.textContent('#subjects h2')).trim(), f.subjects);
  assert.equal(await page.locator('#animal-multiples .panel').count(), SUBJECTS.animals.list.length);
  assert.equal(await page.locator('#mice-rats path.line').count(), 2);
  assert.equal(await page.locator('#sex-chart path.line').count(), 2);
  assert.equal(await page.locator('#ages-chart [data-row]').count(), SUBJECTS.ages.list.length);
  assert.equal(await page.locator('#outbreak-multiples .panel').count(), SUBJECTS.outbreaks.list.length);
  assert.equal((await page.textContent('[data-finding="sex"]')).trim(), f.sex);
  assert.equal((await page.textContent('[data-finding="outbreaks"]')).trim(), f.outbreaks);
  await page.close();
});

test('why trials stop shows reasons, the results deadline pile-up and sponsors', async () => {
  const { page } = await open();
  const f = findings(snapshot);
  assert.equal((await page.textContent('#stops h2')).trim(), f.stops);
  assert.equal((await page.textContent('[data-finding="lag"]')).trim(), f.lag);
  assert.equal(await page.locator('#stop-chart [data-row]').count(), snapshot.trialfate.stops.reasons.length);
  assert.equal(await page.locator('#lag-chart [data-month]').count(), snapshot.trialfate.lag.months.length);
  assert.equal(await page.locator('#sponsor-lag [data-row]').count(), snapshot.trialfate.lag.byClass.length);
  await page.close();
});

test('record extremes show cards, genes per chromosome and classic papers', async () => {
  const { page } = await open();
  const f = findings(snapshot);
  assert.equal((await page.textContent('#extremes h2')).trim(), f.extremes);
  assert.equal((await page.textContent('[data-finding="classics"]')).trim(), f.classics);
  assert.ok(await page.locator('#records > div').count() >= 6);
  assert.match(await page.textContent('#records'), new RegExp(exact(snapshot.extremes.protein.length)));
  assert.equal(await page.locator('#chrom-chart [data-chr]').count(), snapshot.extremes.genes.byChromosome.length);
  assert.equal(await page.locator('#classics-chart [data-row]').count(), CLASSICS.length);
  await page.close();
});

test('new charts open pinned popups with links on a phone', async () => {
  const { page, context } = await openPhone();
  for (const sel of ['#stop-chart [data-row]', '#zombie-chart [data-row]', '#classics-chart [data-row]']) {
    const row = page.locator(sel).first();
    await row.scrollIntoViewIfNeeded();
    await row.tap();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#tip').getAttribute('data-pinned'), 'true', sel);
    assert.ok(await page.locator('#tip a').count() >= 1, sel);
    await page.locator('#sources h2').tap();
  }
  await context.close();
});

test('vocabulary chart stops at the last complete year and sponsor classes read as words', async () => {
  const { page } = await open();
  const years = await page.$$eval('#vocab-chart svg text', (ts) => ts.map((t) => t.textContent).filter((s) => /^\d{4}$/.test(s)).map(Number));
  assert.ok(Math.max(...years) < snapshot.vocab.partial);
  const labels = await page.$$eval('#sponsor-lag text.lab', (ts) => ts.map((t) => t.textContent));
  assert.ok(labels.includes('Industry'));
  assert.ok(labels.every((l) => !/^[A-Z_]+$/.test(l) || l === 'NIH'), labels.join());
  await page.close();
});

test('chart annotations stay inside their charts on a phone', async () => {
  const { page } = await open({ width: 375 });
  const outside = await page.$$eval('.chart svg', (svgs) => svgs.flatMap((svg) => {
    const width = svg.viewBox.baseVal.width;
    return [...svg.querySelectorAll('text.note')].map((t) => ({ id: svg.closest('[id]')?.id, text: t.textContent, b: t.getBBox() }))
      .filter((n) => n.b.x < -1 || n.b.x + n.b.width > width + 1).map((n) => `${n.id}: ${n.text}`);
  }));
  assert.deepEqual(outside, []);
  await page.close();
});

test('dragging the timeline pans it by the distance dragged', async () => {
  const { page } = await open();
  const svg = page.locator('#timeline-svg svg');
  await svg.scrollIntoViewIfNeeded();
  await page.click('#zoom-in');
  await page.waitForTimeout(100);
  const span = (t) => t.split('–').map(Number);
  const [a0, b0] = span(await page.textContent('#timeline-range'));
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width * 0.7, box.y + 100);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * 0.7 - i * 15, box.y + 100);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const [a1, b1] = span(await page.textContent('#timeline-range'));
  const expected = (300 / box.width) * (b0 - a0);
  assert.ok(Math.abs(a1 - a0 - expected) < expected * 0.35, `moved ${a1 - a0}, expected about ${expected.toFixed(1)}`);
  assert.ok(Math.abs((b1 - a1) - (b0 - a0)) <= 1);
  assert.equal(await page.evaluate(() => document.getElementById('tip').dataset.pinned), 'false');
  await page.close();
});

test('the filter box reaches outbreak panels and the slices text matches the interaction', async () => {
  const { page } = await open();
  await page.fill('#q', 'zebrafish');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#outbreak-multiples .panel:visible').count(), 0);
  await page.fill('#q', 'ebola');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#outbreak-multiples .panel:visible').count(), 1);
  assert.doesNotMatch(await page.textContent('#facets .dek'), /Click a label/);
  await page.close();
});

test('the countries popup states the real gap between the two years', async () => {
  const { page } = await open();
  const row = page.locator('#countries-chart [data-row]').first();
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const [y0, y1] = Object.keys(snapshot.countries[0].counts).map(Number);
  assert.match(await page.textContent('#tip'), new RegExp(`in ${y1 - y0} years`));
  await page.close();
});

test('captions carry the caveats a careful reader needs', async () => {
  const { page } = await open();
  const text = (sel) => page.textContent(sel);
  assert.match(await text('#papers .dek'), /may be incomplete/);
  assert.match(await text('#extremes figure:last-of-type figcaption'), /Cited by/);
  assert.match(await text('#machine figure:last-of-type figcaption'), /not endorsing/);
  assert.match(await text('#methods figcaption'), /automated in April 2022/);
  const gb = snapshot.genbank;
  const months = Math.round(doublingMonths(Date.parse(gb.firstRelease.date), gb.firstRelease.bases, Date.parse(gb.date), gb.traditional.bases));
  assert.match(await text('#gb-dek'), new RegExp(`doubled about every ${months} months`));
  const band = medianBand(snapshot.clinicaltrials.enrollmentBands);
  assert.match(await text('#enrollment-caption'), new RegExp(`median study plans ${band.from} to ${band.to}`));
  assert.match(await text('#trials figure:first-of-type figcaption'), /applicable clinical trials/);
  assert.doesNotMatch(await text('#timeline-list'), /scheduled start/);
  assert.match(await text('#records'), /intramural/);
  assert.match(await text('#subjects'), /Case reports are left out/);
  await page.close();
});

const CHAPTERS = {
  collections: ['entrez', 'growth', 'seqdata', 'variants', 'extremes'],
  literature: ['pubmed', 'types', 'facets', 'methods', 'subjects', 'access', 'machine', 'papers'],
  clinical: ['trials', 'stops'],
  money: ['funding', 'geography'],
  reference: ['history', 'projects', 'odd', 'decoder', 'reference', 'sources'],
};

test('sections sit in five chapters with a reading guide up front', async () => {
  const { page } = await open();
  const layout = await page.evaluate(() => {
    const out = {};
    let current = null;
    for (const n of document.querySelectorAll('main > .chapter, main > section.story')) {
      if (n.classList.contains('chapter')) {
        current = n.dataset.chapter;
        out[current] = [];
      } else out[current].push(n.id);
    }
    return out;
  });
  assert.deepEqual(layout, CHAPTERS);
  assert.ok(await page.locator('#readme li').count() >= 5);
  assert.match(await page.textContent('#readme'), /Cited by/);
  assert.equal(await page.locator('#jump a.jump-ch').count(), 5);
  await page.close();
});

test('a lens hides chapters that have nothing left to show', async () => {
  const { page } = await open({ search: '?lens=funding' });
  assert.equal(await page.isVisible('[data-chapter="literature"]'), false);
  assert.equal(await page.isVisible('[data-chapter="money"]'), true);
  assert.equal(await page.isVisible('#jump a[data-for="ch-literature"]'), false);
  await page.close();
});

test('sources are titled and grouped, not bare URLs', async () => {
  const { page } = await open();
  assert.ok(await page.locator('#sources .srcgroup').count() >= 5);
  const texts = await page.$$eval('#sources .srcgroup a', (as) => as.map((a) => a.textContent.trim()));
  assert.ok(texts.length >= 50);
  assert.deepEqual(texts.filter((t) => /^(https?:|www\.|[a-z0-9.-]+\.(gov|org|com)\/)/.test(t)), []);
  await page.close();
});
