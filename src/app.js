import snapshot from './snapshot.js';
import {
  SOURCES, TIMELINE, PEOPLE, PROJECTS, ODDITIES, EXAMPLES, TAGS, DIVISIONS, PMC_YEARS, APIS, CADENCES,
} from './facts.js';
import {
  exact, compact, pct, identify, searchUrl, matches, filterTimeline, sortRows,
  logShare, share, niceTicks, decade, labelize, stamp, liveOddities, labelStep,
  LENSES, readLens, inLens, lensSearch, REFSEQ_PREFIXES,
} from './lib.js';
import { CT_DESIGN } from './queries.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const h = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...kids);
  return node;
};

const ext = (href, text, props = {}) => h('a', { href, target: '_blank', rel: 'noopener', ...props }, text);
const cite = (key) => ext(SOURCES[key], 'source', { class: 'src', title: SOURCES[key] });
const track = (percent) => h('span', { class: 'track' }, h('i', { style: `width:${Math.max(percent, 0.4).toFixed(2)}%` }));
const fill = (id, ...nodes) => $(id).replaceChildren(...nodes);

const state = {
  query: '',
  tags: new Set(),
  orgs: new Set(),
  sort: { key: null, dir: null },
  entrez: new Map(snapshot.entrez.map((d) => [d.db, { ...d }])),
  trials: snapshot.clinicaltrials.total,
};

const dbName = (db) => state.entrez.get(db)?.name ?? db;
const dbCount = (db) => state.entrez.get(db)?.count ?? null;
const pubmedTotal = () => dbCount('pubmed');

const HERO = [
  ['pubmed', 'PubMed citations'],
  ['pmc', 'PMC full-text records'],
  ['snp', 'dbSNP reference SNPs'],
  ['protein', 'Protein sequences'],
  ['nuccore', 'Nucleotide sequences'],
  ['ipg', 'Identical protein groups'],
  ['pccompound', 'PubChem compounds'],
  ['pcsubstance', 'PubChem substances'],
  ['gene', 'Gene records'],
  ['biosample', 'BioSamples'],
  ['sra', 'SRA experiments'],
  ['clinvar', 'ClinVar records'],
  ['taxonomy', 'Taxonomy nodes'],
  ['books', 'Bookshelf records'],
  ['assembly', 'Genome assemblies'],
  ['trials', 'CT.gov studies'],
];

const heroCard = ([key, label]) => {
  const isTrials = key === 'trials';
  const count = isTrials ? state.trials : dbCount(key);
  const updated = isTrials ? snapshot.clinicaltrials.dataTimestamp.slice(0, 10) : state.entrez.get(key)?.updated;
  return h('a', { class: 'stat', 'data-hero': key, href: isTrials ? 'https://clinicaltrials.gov/' : searchUrl(key), target: '_blank', rel: 'noopener', title: isTrials ? 'ClinicalTrials.gov registered studies' : dbName(key) },
    h('div', { class: 'lbl' }, label),
    h('div', { class: 'big' }, compact(count)),
    h('div', { class: 'exact' }, exact(count)),
    h('div', { class: 'upd', title: 'Last updated' }, updated ?? '—'));
};

const renderHero = () => fill('#hero', ...HERO.map(heroCard));

const renderStamp = () => {
  const gb = snapshot.genbank;
  $('#stamp').textContent = `Snapshot ${stamp(snapshot.generated)}, rebuilt weekly · ${snapshot.entrez.length} Entrez databases · GenBank ${gb.release} · ClinicalTrials.gov data ${snapshot.clinicaltrials.dataTimestamp.slice(0, 10)}`;
};

const COLS = [
  ['name', 'Database', 'asc'],
  ['description', 'What', 'asc', 'hide-sm'],
  ['count', 'Records', 'desc'],
  ['meter', '', null, 'meter'],
  ['updated', 'Updated', 'desc', 'hide-sm'],
  ['fields', 'Fields', 'desc', 'hide-sm'],
  ['links', 'Links', 'desc', 'hide-sm'],
];

const renderDbTable = () => {
  const rows = [...state.entrez.values()];
  const max = Math.max(...rows.map((r) => r.count ?? 0));
  const sorted = state.sort.key ? sortRows(rows, state.sort.key, state.sort.dir) : rows;
  const head = h('thead', {}, h('tr', {}, COLS.map(([key, label, , cls]) => h('th', { class: cls, scope: 'col' },
    label && h('button', { type: 'button', 'data-sort': key, 'data-dir': state.sort.key === key ? state.sort.dir : null }, label)))));
  const body = h('tbody', {}, sorted.map((d) => h('tr', { 'data-db': d.db, 'data-search': `${d.name} ${d.db} ${d.description}` },
    h('td', { 'data-col': 'name' }, ext(searchUrl(d.db), d.name)),
    h('td', { class: 'hide-sm desc' }, h('span', { class: 'db' }, d.db), d.description || '—'),
    h('td', { class: 'n', 'data-col': 'count' }, exact(d.count)),
    h('td', { class: 'meter' }, track(logShare(d.count, max))),
    h('td', { class: 'n hide-sm', 'data-col': 'updated' }, d.updated ?? '—'),
    h('td', { class: 'n hide-sm' }, d.fields),
    h('td', { class: 'n hide-sm' }, d.links))));
  fill('#db-table', head, body);
  applySearch();
};

const onSort = (event) => {
  const key = event.target.closest('button[data-sort]')?.dataset.sort;
  if (!key) return;
  const preset = COLS.find((c) => c[0] === key)[2];
  state.sort = state.sort.key === key
    ? { key, dir: state.sort.dir === 'desc' ? 'asc' : 'desc' }
    : { key, dir: preset };
  renderDbTable();
};

const renderEntrezDek = () => {
  const rows = [...state.entrez.values()].filter((r) => r.count !== null);
  const big = rows.reduce((a, b) => (b.count > a.count ? b : a));
  const small = rows.reduce((a, b) => (b.count < a.count ? b : a));
  const stale = rows.reduce((a, b) => ((b.updated ?? '9') < (a.updated ?? '9') ? b : a));
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  $('#entrez-dek').textContent = `${rows.length} databases answer E-utilities einfo, holding ${exact(total)} records between them. Largest: ${big.name}, ${exact(big.count)}. Smallest: ${small.name}, ${exact(small.count)}. Least recently updated: ${stale.name}, ${stale.updated}.`;
};

const tipLink = (text, href, linkText) => [text, ' ', ext(href, linkText)];

const CHART = { H: 230, L: 54, B: 22, T: 8 };

const widthOf = (mount) => Math.round(Math.min(Math.max($(mount).clientWidth || 820, 300), 1240));

const barChart = ({ mount, tip, rows, attr, key, value, overlay, axis, aria, describe, legend }) => {
  const { H, L, B, T } = CHART;
  const W = widthOf(mount);
  const step = labelStep(rows.length, W - L);
  const ticks = niceTicks(Math.max(...rows.map(value)), 4);
  const top = ticks.at(-1) || 1;
  const bw = (W - L) / rows.length;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const x = (i) => L + i * bw;
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': aria },
    ...ticks.map((t) => s('g', {},
      s('line', { class: 'axis', x1: L, x2: W, y1: y(t), y2: y(t) }),
      s('text', { x: L - 6, y: y(t) + 3, 'text-anchor': 'end' }, axis(t)))),
    ...rows.map((r, i) => s('rect', {
      class: r.partial ? 'bar part' : 'bar',
      [`data-${attr}`]: key(r),
      x: (x(i) + 0.5).toFixed(2),
      y: y(value(r)).toFixed(2),
      width: Math.max(bw - 1, 1).toFixed(2),
      height: (H - B - y(value(r))).toFixed(2),
    })),
    ...(overlay ? rows.map((r, i) => s('rect', {
      class: 'bar2',
      x: (x(i) + bw * 0.25).toFixed(2),
      y: y(overlay(r)).toFixed(2),
      width: Math.max(bw * 0.5, 1).toFixed(2),
      height: (H - B - y(overlay(r))).toFixed(2),
    })) : []),
    ...rows.map((r, i) => (key(r) % step === 0 ? s('text', { x: (x(i) + bw / 2).toFixed(2), y: H - 6, 'text-anchor': 'middle' }, key(r)) : null)).filter(Boolean));
  const show = (event) => {
    const rect = event.target.closest(`[data-${attr}]`);
    if (!rect) return;
    $$('.on', $(mount)).forEach((r) => r.classList.remove('on'));
    rect.classList.add('on');
    const i = rows.findIndex((r) => String(key(r)) === rect.getAttribute(`data-${attr}`));
    fill(tip, ...describe(rows[i], rows[i - 1]));
  };
  svgEl.addEventListener('pointerover', show);
  svgEl.addEventListener('click', show);
  fill(mount, ...(legend ? [legend] : []), svgEl);
  fill(tip, 'Hover or tap a bar.');
};

const legendOf = (items) => h('div', { class: 'legend' }, items.map(([name, color]) => h('span', {}, h('i', { style: `background:var(${color})` }), name)));

const signed = (n) => `${n >= 0 ? '+' : ''}${exact(n)}`;

const renderPubmedChart = () => {
  const now = new Date(snapshot.generated).getUTCFullYear();
  const years = snapshot.pubmed.years.map((y) => ({ ...y, partial: y.year === now }));
  barChart({
    mount: '#pubmed-chart',
    tip: '#pubmed-tip',
    rows: years,
    attr: 'year',
    key: (r) => r.year,
    value: (r) => r.count,
    axis: compact,
    aria: 'PubMed records per publication year, 1945 onward',
    describe: (d, prev) => tipLink(
      `${d.year}${d.partial ? ' so far' : ''}: ${exact(d.count)} records${prev ? ` (${signed(d.count - prev.count)} vs ${prev.year})` : ''}.`,
      searchUrl('pubmed', `${d.year}[dp]`), 'Open in PubMed'),
  });
  const done = years.filter((d) => !d.partial);
  const peak = done.reduce((a, b) => (b.count > a.count ? b : a));
  const first = years[0];
  $('#pubmed-dek').textContent = `${exact(pubmedTotal())} records in all. Peak complete year: ${peak.year}, with ${exact(peak.count)}. ${first.year}: ${exact(first.count)}. ${now} so far: ${exact(years.at(-1).count)}.`;
  const eraMax = Math.max(...snapshot.pubmed.eras.map((e) => e.count));
  fill('#eras', ...snapshot.pubmed.eras.map((e) => h('li', {},
    ext(searchUrl('pubmed', `${e.from}:${e.to}[dp]`), `${e.from}–${e.to}`),
    track(share(e.count, eraMax)),
    h('span', { class: 'val' }, exact(e.count)))));
};

const facetRow = (item, total) => h('li', { 'data-search': `${item.label} ${item.term}` },
  h('span', { class: 'lab' }, ext(searchUrl(item.db, item.term), item.label), h('code', {}, item.term)),
  track(share(item.count ?? 0, total)),
  h('span', { class: 'val' }, exact(item.count), h('small', {}, total ? `${((item.count / total) * 100).toFixed(item.count / total < 0.001 ? 3 : 1)}%` : '')));

const renderFacet = (id) => {
  const group = snapshot.groups.find((g) => g.id === id);
  $$('#facet-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.group === id)));
  const items = sortRows(group.items, 'count', 'desc');
  const sameDb = items.every((i) => i.db === items[0].db);
  const total = sameDb ? dbCount(items[0].db) : Math.max(...items.map((i) => i.count ?? 0));
  const note = sameDb ? `Share of all ${dbName(items[0].db)} records.` : 'Shares are of the largest bar.';
  fill('#facet-panel', h('p', { class: 'dek' }, `${group.title}. ${note}`), h('ul', { class: 'bars' }, items.map((i) => facetRow(i, total))));
};

const TAB_LABELS = {
  types: 'Publication type',
  languages: 'Language',
  organisms: 'Organism',
  subsets: 'Subsets',
  mesh: 'MeSH records',
  molecular: 'Genes & taxa',
  clinvar: 'ClinVar',
};

const facetGroups = () => snapshot.groups.filter((g) => !g.panel);

const renderFacetTabs = () => {
  fill('#facet-tabs', ...facetGroups().map((g) => h('button', {
    type: 'button', role: 'tab', 'data-group': g.id, 'aria-controls': 'facet-panel', 'aria-selected': 'false', title: g.title,
    onclick: () => renderFacet(g.id),
  }, TAB_LABELS[g.id] ?? g.title)));
  renderFacet(facetGroups()[0].id);
};

const renderPapers = () => {
  fill('#paper-list', ...snapshot.papers.map((p) => h('li', { 'data-search': `${p.topic} ${p.title} ${p.journal} ${p.date} ${p.authors.join(' ')}` },
    h('span', { class: 'topic' }, p.topic),
    h('span', {}, ext(`https://pubmed.ncbi.nlm.nih.gov/${p.pmid}/`, p.title),
      h('span', { class: 'meta' }, ` ${p.authors.join(', ')}${p.authorCount > 3 ? ` +${p.authorCount - 3}` : ''} · ${p.journal} · ${p.date} · PMID ${p.pmid}`)),
    h('span', { class: 'cite' }, h('b', {}, exact(p.citedBy)), h('small', {}, 'citing records')))));
  const max = PMC_YEARS.at(-1).articles;
  fill('#pmc-years', ...PMC_YEARS.map((y) => h('li', {},
    h('span', {}, `FY${String(y.fy).slice(2)}`),
    track(share(y.articles, max)),
    h('span', { class: 'val' }, exact(y.articles), h('small', {}, `${compact(y.sessions)} sessions/wkday`)))));
};

const lineChart = ({ series, id, tip, label }) => {
  const { H, L, B, T } = CHART;
  const W = widthOf(id);
  const years = [...new Set(series.flatMap((x) => x.rows.map((r) => r.year)))].sort((a, b) => a - b);
  const values = series.flatMap((x) => x.rows.map((r) => r.bases));
  const lo = Math.floor(Math.log10(Math.min(...values)));
  const hi = Math.ceil(Math.log10(Math.max(...values)));
  const x = (yr) => L + ((yr - years[0]) / (years.at(-1) - years[0])) * (W - L - 10);
  const y = (v) => T + (H - T - B) * (1 - (Math.log10(v) - lo) / (hi - lo));
  const step = (W - L) / years.length;
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
    ...Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((p) => p % 3 === 0 || hi - lo < 6).map((p) => s('g', {},
      s('line', { class: 'axis', x1: L, x2: W, y1: y(10 ** p), y2: y(10 ** p) }),
      s('text', { x: L - 6, y: y(10 ** p) + 3, 'text-anchor': 'end' }, compact(10 ** p)))),
    ...years.filter((yr) => yr % labelStep(years.length, W - L) === 0).map((yr) => s('text', { x: x(yr), y: H - 6, 'text-anchor': 'middle' }, yr)),
    ...series.map((ser) => s('polyline', { class: `line ${ser.cls}`, points: ser.rows.map((r) => `${x(r.year).toFixed(1)},${y(r.bases).toFixed(1)}`).join(' ') })),
    ...years.map((yr) => s('rect', { class: 'hit', 'data-year': yr, x: (x(yr) - step / 2).toFixed(1), y: T, width: step.toFixed(1), height: H - T - B })));
  const show = (event) => {
    const hit = event.target.closest('[data-year]');
    if (!hit) return;
    const yr = Number(hit.dataset.year);
    const parts = series.map((ser) => {
      const r = ser.rows.find((v) => v.year === yr);
      return r ? `${ser.name} ${compact(r.bases)} bases, ${exact(r.entries)} records (release ${r.release})` : null;
    }).filter(Boolean);
    fill(tip, `${yr}: ${parts.join(' · ')}`);
  };
  svgEl.addEventListener('pointerover', show);
  svgEl.addEventListener('click', show);
  fill(id, legendOf(series.map((ser) => [ser.name, ser.cls === 'l1' ? '--bar' : '--bar-2'])), svgEl);
};

const renderGenbank = () => {
  const gb = snapshot.genbank;
  const first = gb.firstRelease;
  $('#gb-dek').textContent = `Release ${gb.release}, ${gb.date}. Bases in traditional records have doubled roughly every 18 months since 1982. A new release ships every two months.`;
  const stat = (value, label) => h('div', {}, h('b', {}, value), h('span', {}, label));
  fill('#gb-stats',
    stat(exact(gb.traditional.sequences), 'traditional records'),
    stat(compact(gb.traditional.bases), `bases (${exact(gb.traditional.bases)})`),
    stat(exact(gb.sets.sequences), 'WGS/TSA/TLS records'),
    stat(compact(gb.sets.bases), `set-based bases (${exact(gb.sets.bases)})`),
    stat(`${exact(first.entries)}`, `records in Release ${first.release}, ${first.date}`),
    stat(exact(first.bases), `bases in Release ${first.release}`),
    stat(exact(gb.divisions.reduce((n, d) => n + d.files, 0)), 'flat files in this release'),
    stat(`×${compact(Math.round(gb.traditional.bases / first.bases))}`, `bases since Release ${first.release}`));
  lineChart({
    id: '#gb-chart',
    tip: '#gb-tip',
    label: 'GenBank bases per year, log scale',
    series: [
      { name: 'Traditional', cls: 'l1', rows: gb.growth.traditional },
      { name: 'WGS', cls: 'l2', rows: gb.growth.wgs },
    ],
  });
  fill('#gb-tip', 'Log scale. Hover or tap a year.');
  const orgMax = gb.organisms[0].bases;
  fill('#gb-organisms', ...gb.organisms.map((o) => h('li', { 'data-search': o.species },
    h('span', {}, h('i', {}, o.species)),
    track(share(o.bases, orgMax)),
    h('span', { class: 'val' }, compact(o.bases), h('small', {}, `${exact(o.entries)} rec`)))));
  const divMax = gb.divisions[0].bases;
  fill('#gb-divisions', ...gb.divisions.map((d) => h('li', { 'data-search': `${d.code} ${DIVISIONS[d.code]}` },
    h('span', {}, h('b', {}, d.code), ` ${DIVISIONS[d.code]}`),
    track(share(d.bases, divMax)),
    h('span', { class: 'val' }, compact(d.bases), h('small', {}, `${exact(d.files)} files`)))));
};

const CT_FIELDS = [
  ['OverallStatus', 'Overall status', true],
  ['StudyType', 'Study type', true],
  ['Phase', 'Phase', true],
  ['InterventionType', 'Intervention type', true],
  ['LeadSponsorClass', 'Lead sponsor class', true],
  ['Sex', 'Eligible sex', true],
  ['LocationCountry', 'Countries, top 20', false, 'country'],
  ['Condition', 'Conditions, top 20', false, 'cond'],
];

const renderTrials = () => {
  const ct = snapshot.clinicaltrials;
  $('#ct-dek').textContent = `${exact(state.trials)} registered studies, data as of ${ct.dataTimestamp.replace('T', ' ')}. Every value below is an exact count from the ClinicalTrials.gov API.`;
  const stat = (value, label) => h('div', {}, h('b', {}, value), h('span', {}, label));
  fill('#ct-stats',
    stat(exact(ct.total), 'studies'),
    stat(`${exact(ct.averageBytes)} B`, 'average record size'),
    stat(`${exact(ct.medianBytes)} B`, 'median record size'),
    stat(exact(ct.fields.LocationCountry.unique), 'countries with sites'),
    stat(exact(ct.fields.Condition.unique), 'distinct condition names'),
    stat(ct.first.id, `lowest NCT number, posted ${ct.first.posted}`),
    stat(`${(ct.largest[0].bytes / 1e6).toFixed(2)} MB`, `largest record, ${ct.largest[0].id}`),
    stat(exact(ct.fields.Condition.top[0].count), `studies list "${ct.fields.Condition.top[0].value}", the top condition`));
  fill('#ct-fields', ...CT_FIELDS.map(([key, label, enumish, param]) => {
    const f = ct.fields[key];
    const max = f.top[0].count;
    return h('div', {},
      h('h3', {}, label, h('small', {}, `${exact(f.unique)} values`)),
      h('ul', { class: 'bars alt' }, f.top.map((v) => h('li', { 'data-search': v.value },
        param ? ext(`https://clinicaltrials.gov/search?${param}=${encodeURIComponent(v.value)}`, v.value) : h('span', {}, enumish ? ctLabel(key, v.value) : v.value),
        track(share(v.count, max)),
        h('span', { class: 'val' }, exact(v.count))))));
  }));
  fill('#ct-largest', ...ct.largest.map((r) => h('li', {},
    ext(`https://clinicaltrials.gov/study/${r.id}`, r.id), ` ${r.title} `,
    h('small', {}, `${(r.bytes / 1e6).toFixed(2)} MB`))));
};

const spark = (values) => {
  const w = 180;
  const ht = 34;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / Math.max(values.length - 1, 1)) * w).toFixed(1)},${(ht - (v / max) * ht).toFixed(1)}`).join(' ');
  return s('svg', { class: 'spark', viewBox: `0 0 ${w} ${ht}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' },
    s('polygon', { class: 'area', points: `0,${ht} ${pts} ${w},${ht}` }),
    s('polyline', { class: 'line', points: pts }));
};

const statBox = (value, label) => h('div', {}, h('b', {}, value), h('span', {}, label));

const barList = (items, { label, value, small, href, max, cls, format = exact } = {}) => {
  const top = max ?? Math.max(...items.map(value), 1);
  return h('ul', { class: cls ? `bars ${cls}` : 'bars' }, items.map((item) => h('li', { 'data-search': label(item) },
    href ? ext(href(item), label(item)) : h('span', {}, label(item)),
    track(share(value(item), top)),
    h('span', { class: 'val' }, format(value(item)), small ? h('small', {}, small(item)) : null))));
};

const renderMethods = () => {
  const methods = snapshot.methods;
  const from = methods[0].years[0].year;
  const to = methods[0].years.at(-1).year;
  $('#methods-dek').textContent = `PubMed records tagged with each method, per publication year ${from}–${to}. The first year is the earliest year with a tagged record.`;
  fill('#methods-list', ...sortRows(methods, 'total', 'desc').map((m) => {
    const firstYear = m.years.find((y) => y.count > 0)?.year;
    const peak = m.years.reduce((a, b) => (b.count > a.count ? b : a));
    return h('li', { 'data-search': `${m.label} ${m.term}` },
      h('span', { class: 'lab' }, ext(searchUrl('pubmed', m.term), m.label), h('code', {}, m.term)),
      spark(m.years.map((y) => y.count)),
      h('span', { class: 'val' }, exact(m.total), h('small', {}, `first ${firstYear === from ? `≤${from}` : firstYear ?? '—'} · peak ${peak.year}`)));
  }));
};

const renderSeqData = () => {
  const r = snapshot.refseq;
  $('#seq-dek').textContent = `RefSeq release ${r.release} (${r.date}) and current counts from the Assembly and SRA databases. Click a row to run the query.`;
  fill('#refseq-stats',
    statBox(`Release ${r.release}`, `RefSeq, ${r.date}`),
    statBox(exact(r.organisms), 'organisms in RefSeq'),
    statBox(exact(r.records), 'RefSeq records'),
    statBox(exact(dbCount('assembly')), 'genome assemblies in Entrez'));
  fill('#seq-groups', ...snapshot.groups.filter((g) => g.panel === 'seqdata').map((g) => h('div', {},
    h('h3', {}, g.title),
    h('ul', { class: 'bars' }, sortRows(g.items, 'count', 'desc').map((i) => facetRow(i, dbCount(i.db)))))));
  fill('#refseq-prefixes',
    h('thead', {}, h('tr', {}, ['Prefix', 'Molecule', 'Use'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, REFSEQ_PREFIXES.map((p) => h('tr', { 'data-search': `${p.prefix} ${p.molecule} ${p.use}` },
      h('td', {}, h('code', {}, p.prefix)),
      h('td', {}, p.molecule),
      h('td', {}, p.use)))));
};

const renderApis = () => {
  fill('#api-table',
    h('thead', {}, h('tr', {}, ['Service', 'Without a key', 'With an API key', 'Notes', ''].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, APIS.map((a) => h('tr', { 'data-search': `${a.service} ${a.limit} ${a.note}` },
      h('td', {}, h('b', {}, a.service)),
      h('td', { class: 'n' }, a.limit),
      h('td', { class: 'n' }, a.keyed),
      h('td', { class: 'desc' }, a.note),
      h('td', {}, cite(a.src))))));
  fill('#cadence-table',
    h('thead', {}, h('tr', {}, ['Resource', 'Updates', ''].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, CADENCES.map((c) => h('tr', { 'data-search': `${c.resource} ${c.cadence}` },
      h('td', {}, h('b', {}, c.resource)),
      h('td', {}, c.cadence),
      h('td', {}, cite(c.src))))));
};

const ctLabel = (piece, value) => snapshot.clinicaltrials.labels?.[piece]?.[value] ?? labelize(value);

const fieldTop = (key) => snapshot.clinicaltrials.fields[key]?.top ?? [];
const fieldValue = (key, value) => fieldTop(key).find((v) => v.value === value)?.count ?? 0;
const fieldSum = (key) => fieldTop(key).reduce((n, v) => n + v.count, 0);

const DESIGN_LABELS = {
  DesignAllocation: 'Allocation',
  DesignMasking: 'Masking',
  DesignPrimaryPurpose: 'Primary purpose',
  DesignInterventionModel: 'Intervention model',
  EnrollmentType: 'Enrollment figure',
};

const renderDesign = () => {
  const ct = snapshot.clinicaltrials;
  const enrollment = ct.fields.EnrollmentCount;
  const healthy = ct.fields.HealthyVolunteers;
  $('#design-dek').textContent = 'Design fields as registered on ClinicalTrials.gov. Studies with no value for a field are left out of that field.';
  fill('#design-stats',
    statBox(pct(fieldValue('DesignAllocation', 'RANDOMIZED') / fieldSum('DesignAllocation')), 'randomized, of studies stating allocation'),
    statBox(pct(fieldValue('DesignMasking', 'NONE') / fieldSum('DesignMasking')), 'open label (no masking)'),
    statBox(pct(ct.completedInterventionalWithResults / ct.completedInterventional), `of ${exact(ct.completedInterventional)} completed interventional studies post results`),
    statBox(exact(ct.withResults), 'studies with posted results'),
    statBox(exact(Math.round(enrollment.mean)), 'mean enrollment'),
    statBox(exact(enrollment.max), `largest enrollment, ${ct.biggestEnrollment.id}`),
    statBox(pct(healthy.yes / (healthy.yes + healthy.no)), 'accept healthy volunteers'),
    statBox(pct(fieldValue('EnrollmentType', 'ESTIMATED') / fieldSum('EnrollmentType')), 'enrollment still an estimate'));
  barChart({
    mount: '#design-chart',
    tip: '#design-tip',
    rows: ct.timing.map((t) => ({ ...t, partial: t.year === new Date(snapshot.generated).getUTCFullYear() })),
    attr: 'year',
    key: (r) => r.year,
    value: (r) => r.registered,
    overlay: (r) => r.results,
    axis: compact,
    aria: 'Studies first posted and results first posted per year',
    describe: (d) => [`${d.year}${d.partial ? ' so far' : ''}: ${exact(d.registered)} studies first posted, ${exact(d.results)} first posted results.`],
    legend: legendOf([['Studies first posted', '--bar'], ['Results first posted', '--bar-2']]),
  });
  const bandMax = Math.max(...ct.enrollmentBands.map((b) => b.count));
  fill('#enrollment', ...ct.enrollmentBands.map((b) => h('li', {},
    h('span', {}, b.to === 'MAX' ? `${exact(b.from)}+` : b.from === b.to ? exact(b.from) : `${exact(b.from)}–${exact(b.to)}`),
    track(share(b.count, bandMax)),
    h('span', { class: 'val' }, exact(b.count)))));
  fill('#design-fields', ...CT_DESIGN.map((key) => h('div', {},
    h('h3', {}, DESIGN_LABELS[key]),
    barList(fieldTop(key), { label: (v) => ctLabel(key, v.value), value: (v) => v.count, cls: 'alt' }))));
};

const usd = (n) => `$${compact(n)}`;

const renderFunding = () => {
  const f = snapshot.funding;
  const d = f.detail;
  const nih = f.ics.reduce((n, i) => n + i.dollars, 0);
  const rank = f.ics.findIndex((i) => i.ic === 'NLM') + 1;
  $('#funding-dek').textContent = `FY${f.detailFy}: NLM administered ${exact(d.projects)} awards worth $${exact(d.dollars)} in NIH RePORTER, ${pct(d.dollars / nih)} of the ${usd(nih)} listed across ${f.ics.length} NIH institutes and centers. Totals are award amounts for primary projects, excluding subprojects. The step at FY2008 is when NLM's intramural "National Biomedical Information Services" record first appears in RePORTER, not a budget jump.`;
  fill('#funding-stats',
    statBox(usd(d.dollars), `NLM awards, FY${f.detailFy}`),
    statBox(exact(d.projects), 'projects'),
    statBox(exact(d.newProjects), 'new this year'),
    statBox(`${d.medianYears} yr`, 'median project length'),
    statBox(`${rank} of ${f.ics.length}`, 'NLM rank by dollars'),
    statBox(pct(d.dollars / nih), 'of listed NIH dollars'),
    statBox(usd(f.years[0].dollars), `FY${f.years[0].fy} in RePORTER`),
    statBox(`×${(d.dollars / f.years.find((y) => y.fy === 2000).dollars).toFixed(1)}`, 'growth since FY2000'));
  barChart({
    mount: '#funding-chart',
    tip: '#funding-tip',
    rows: f.years,
    attr: 'fy',
    key: (r) => r.fy,
    value: (r) => r.dollars,
    axis: usd,
    aria: 'NLM award dollars per fiscal year in NIH RePORTER',
    describe: (r, prev) => [`FY${r.fy}: $${exact(r.dollars)} across ${exact(r.projects)} NLM awards${prev ? ` (${signed(r.dollars - prev.dollars)} vs FY${prev.fy})` : ''}${r.partial ? '. Data still arriving' : ''}.`],
  });
  $('#ics-title').textContent = `Institutes and centers, FY${f.detailFy}`;
  const icMax = f.ics[0].dollars;
  fill('#funding-ics', ...f.ics.map((i) => h('li', { class: i.ic === 'NLM' ? 'me' : null, 'data-search': i.ic },
    h('span', {}, h('b', {}, i.ic)),
    track(share(i.dollars, icMax)),
    h('span', { class: 'val' }, usd(i.dollars), h('small', {}, `${exact(i.projects)} awards`)))));
  $('#activity-title').textContent = `NLM by activity code, FY${f.detailFy}`;
  const opts = { label: (g) => g.key, value: (g) => g.dollars, small: (g) => `${exact(g.projects)} awards`, format: usd };
  const byAwards = sortRows(d.byCategory, 'projects', 'desc');
  $('#funding-activity').replaceWith(Object.assign(barList(d.byActivity, opts), { id: 'funding-activity' }));
  $('#funding-categories').replaceWith(Object.assign(barList(byAwards, {
    label: (g) => g.key, value: (g) => g.projects, small: (g) => usd(g.dollars), cls: 'alt',
  }), { id: 'funding-categories' }));
  $('#funding-orgs').replaceWith(Object.assign(barList(d.byOrg, { ...opts, cls: 'alt' }), { id: 'funding-orgs' }));
  fill('#funding-largest', ...d.largest.map((a) => h('li', {},
    ext(`https://reporter.nih.gov/project-details/${a.appl}`, a.number), ` ${a.title} `,
    h('small', {}, `${a.org ?? ''} · ${a.activity} · $${exact(a.dollars)}`))));
};

const renderLenses = () => {
  fill('#lenses', ...LENSES.map((l) => h('button', { type: 'button', 'data-lens': l.id, 'aria-pressed': 'false', title: l.hint }, l.label)));
  fill('#jump', ...$$('main > section[data-nav]').map((sec) => h('a', { href: `#${sec.id}`, 'data-for': sec.id }, sec.dataset.nav)));
  $('#lenses').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-lens]');
    if (btn) applyLens(btn.dataset.lens, true);
  });
};

const applyLens = (lens, push) => {
  const current = LENSES.find((l) => l.id === lens);
  $$('#lenses button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lens === lens)));
  $$('main > section').forEach((sec) => { sec.hidden = !inLens(sec.dataset.lens, lens); });
  $$('#jump a').forEach((a) => { a.hidden = $(`#${a.dataset.for}`).hidden; });
  $('#lens-hint').textContent = current.hint;
  if (push) {
    history.replaceState(null, '', `${location.pathname}${lensSearch(location.search, lens)}${location.hash}`);
    drawCharts();
  }
};

const drawCharts = () => {
  renderPubmedChart();
  renderGenbank();
  renderDesign();
  renderFunding();
  applySearch();
};

let resizeTimer;
let lastWidth = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    drawCharts();
  }, 150);
};

const timelineNodes = new Map();

const renderTimeline = () => {
  const counts = Object.fromEntries(TAGS.map((t) => [t, TIMELINE.filter((i) => i.tag === t).length]));
  fill('#timeline-tags', ...TAGS.map((t) => h('button', { type: 'button', 'data-tag': t, 'aria-pressed': 'false' }, t, h('b', {}, counts[t]))));
  fill('#timeline-orgs', ...['NLM', 'NCBI'].map((o) => h('button', { type: 'button', 'data-org': o, 'aria-pressed': 'false' }, o, h('b', {}, TIMELINE.filter((i) => i.org === o).length))));
  const groups = new Map();
  for (const item of TIMELINE) {
    const key = decade(item.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  fill('#timeline', ...[...groups].map(([key, items]) => h('div', { class: 'decade-group', 'data-decade': key },
    h('p', { class: 'decade' }, key),
    h('ol', { class: 'events' }, items.map((item) => {
      const li = h('li', { 'data-tag': item.tag, 'data-org': item.org },
        h('time', { datetime: item.date }, item.date),
        h('span', { class: `org ${item.org.toLowerCase()}` }, item.org),
        h('span', {}, item.text, cite(item.src)));
      timelineNodes.set(item, li);
      return li;
    })))));
};

const applyTimeline = () => {
  const keep = new Set(filterTimeline(TIMELINE, { tags: [...state.tags], orgs: [...state.orgs], query: state.query }));
  for (const [item, li] of timelineNodes) li.hidden = !keep.has(item);
  $$('#timeline .decade-group').forEach((g) => { g.hidden = !$$('li', g).some((li) => !li.hidden); });
};

const toggleChip = (set, attr) => (event) => {
  const btn = event.target.closest(`button[${attr}]`);
  if (!btn) return;
  const value = btn.getAttribute(attr);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  btn.setAttribute('aria-pressed', String(set.has(value)));
  applyTimeline();
};

const renderProjects = () => {
  fill('#projects', ...PROJECTS.map((p) => {
    const count = p.name === 'ClinicalTrials.gov' ? state.trials : p.db ? dbCount(p.db) : null;
    return h('article', { 'data-search': `${p.name} ${p.org} ${p.since} ${p.id ?? ''} ${p.facts.join(' ')}` },
      h('header', {}, h('h3', {}, p.name), h('span', { class: 'since' }, `${p.org} · since ${p.since}`)),
      count !== null && h('div', { class: 'count' }, exact(count), h('small', {}, p.db ? `in ${dbName(p.db)}` : 'studies')),
      h('ul', {}, p.facts.map((f) => h('li', {}, f))),
      h('footer', {},
        ext(p.url, 'Open'),
        p.id && h('button', { type: 'button', class: 'example', 'data-id': p.id, onclick: () => decodeAndJump(p.id) }, p.id),
        cite(p.src)));
  }));
};

const AXIS = [1860, 2026];

const renderPeople = () => {
  const span = AXIS[1] - AXIS[0];
  const pos = (yr) => ((yr - AXIS[0]) / span) * 100;
  $('#people').before(h('div', { class: 'axis-row', 'aria-hidden': 'true' }, ...[1860, 1900, 1940, 1980, 2026].map((y) => h('span', {}, y))));
  fill('#people', ...PEOPLE.map((p) => {
    const to = p.to ?? AXIS[1];
    return h('li', { 'data-org': p.org, 'data-search': `${p.name} ${p.role} ${p.org} ${p.from} ${p.to ?? ''} ${p.note}` },
      h('span', { class: 'who' }, h('b', {}, p.name), h('small', {}, `${p.role} · ${p.note} `), cite(p.src)),
      h('span', { class: `org ${p.org.toLowerCase()}` }, p.org),
      h('span', { class: 'span', title: `${p.from}–${p.to ?? 'present'}` }, h('i', { style: `left:${pos(p.from).toFixed(2)}%;width:${(pos(to) - pos(p.from)).toFixed(2)}%` })),
      h('span', { class: 'yrs' }, `${p.from}–${p.to ?? 'now'}`));
  }));
};

const renderOddities = () => {
  fill('#oddities',
    ...ODDITIES.map((o) => h('li', { 'data-search': o.text }, o.text, cite(o.src))),
    ...liveOddities(snapshot).map((o) => h('li', { 'data-search': o.text, class: 'computed' }, o.text, ext(o.href, 'source', { class: 'src', title: o.href }))));
};

const shuffle = () => {
  const items = $$('#oddities li').filter((li) => !li.hidden);
  if (!items.length) return;
  const current = items.findIndex((li) => li.classList.contains('lit'));
  let next = Math.floor(Math.random() * items.length);
  if (items.length > 1 && next === current) next = (next + 1) % items.length;
  items.forEach((li) => li.classList.remove('lit'));
  items[next].classList.add('lit');
  items[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

const knownAs = (hit) => EXAMPLES.find((e) => identify(e.id)?.id === hit.id && identify(e.id)?.type === hit.type);

const decode = () => {
  const value = $('#decoder-input').value;
  if (!value.trim()) {
    fill('#decoder-out', h('span', { class: 'none' }, 'Type an identifier or pick an example.'));
    return;
  }
  const hit = identify(value);
  if (!hit) {
    fill('#decoder-out', h('span', { class: 'none' }, `No match for “${value.trim()}”. Try one of the examples.`));
    return;
  }
  const known = knownAs(hit);
  fill('#decoder-out', h('dl', {},
    h('dt', {}, 'Type'), h('dd', {}, h('span', { class: 'type' }, hit.type)),
    h('dt', {}, 'ID'), h('dd', {}, h('code', {}, hit.id)),
    h('dt', {}, 'Database'), h('dd', {}, hit.db),
    h('dt', {}, 'Format'), h('dd', {}, hit.note),
    known && h('dt', {}, 'Known as'), known && h('dd', {}, known.is),
    h('dt', {}, 'Open'), h('dd', {}, ext(hit.url, hit.url))));
};

const decodeAndJump = (id) => {
  $('#decoder-input').value = id;
  decode();
  $('#decoder').scrollIntoView({ behavior: 'smooth' });
};

const renderDecoder = () => {
  fill('#examples', ...EXAMPLES.map((e) => h('button', { type: 'button', class: 'example', 'data-id': e.id, title: e.is }, e.id)));
  $('#examples').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-id]');
    if (!btn) return;
    $('#decoder-input').value = btn.dataset.id;
    decode();
  });
  $('#decoder-input').addEventListener('input', decode);
  decode();
};

const API = [
  ['E-utilities einfo, esearch, esummary, elink', 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi'],
  ['ClinicalTrials.gov API v2', 'https://clinicaltrials.gov/data-api/api'],
  ['GenBank release notes', 'https://ftp.ncbi.nlm.nih.gov/genbank/gbrel.txt'],
];

const renderSources = () => {
  const label = (url) => url.replace(/^https:\/\//, '').replace(/\/$/, '');
  fill('#source-list',
    ...API.map(([name, url]) => h('li', {}, h('b', {}, `${name}: `), ext(url, label(url)))),
    ...Object.values(SOURCES).map((url) => h('li', {}, ext(url, label(url)))));
  fill('#foot', `Built from public NLM, NCBI and NIH data. Snapshot ${stamp(snapshot.generated)}, rebuilt every week. Not an official NLM or NCBI site.`);
};

const SEARCHABLE = [
  '#projects article', '#people li', '#oddities li', '#paper-list li', '#db-table tbody tr', '#gb-organisms li',
  '#gb-divisions li', '#methods-list li', '#api-table tbody tr', '#cadence-table tbody tr', '#refseq-prefixes tbody tr',
  '#funding-ics li', '#funding-categories li', '#funding-orgs li',
];

const applySearch = () => {
  for (const sel of SEARCHABLE) {
    for (const node of $$(sel)) node.hidden = !matches(node.dataset.search ?? node.textContent, state.query);
  }
  applyTimeline();
};

let searchTimer;
const onSearch = (event) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = event.target.value;
    applySearch();
  }, 120);
};

const THEME_KEY = 'nlm-stats-theme';
const dark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => document.documentElement.dataset.theme || (dark.matches ? 'dark' : 'light');

const store = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      return false;
    }
    return true;
  },
};

const paintThemeButton = () => {
  const btn = $('#theme');
  const isDark = theme() === 'dark';
  btn.textContent = isDark ? 'Light' : 'Dark';
  btn.setAttribute('aria-pressed', String(isDark));
};

const initTheme = () => {
  const saved = store.get(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  paintThemeButton();
  dark.addEventListener('change', paintThemeButton);
  $('#theme').addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set(THEME_KEY, next);
    paintThemeButton();
  });
};

const init = () => {
  initTheme();
  renderLenses();
  renderStamp();
  renderHero();
  renderEntrezDek();
  renderDbTable();
  renderPubmedChart();
  renderFacetTabs();
  renderPapers();
  renderSeqData();
  renderGenbank();
  renderApis();
  renderMethods();
  renderTrials();
  renderDesign();
  renderFunding();
  renderTimeline();
  renderProjects();
  renderPeople();
  renderOddities();
  renderDecoder();
  renderSources();
  applySearch();
  applyLens(readLens(location.search), false);
  lastWidth = window.innerWidth;
  window.addEventListener('resize', onResize);
  $('#db-table').addEventListener('click', onSort);
  $('#q').addEventListener('input', onSearch);
  $('#timeline-tags').addEventListener('click', toggleChip(state.tags, 'data-tag'));
  $('#timeline-orgs').addEventListener('click', toggleChip(state.orgs, 'data-org'));
  $('#shuffle').addEventListener('click', shuffle);
};

init();
