import snapshot from './snapshot.js';
import {
  SOURCES, TIMELINE, PEOPLE, PROJECTS, ODDITIES, EXAMPLES, TAGS, DIVISIONS, PMC_YEARS, APIS, CADENCES,
} from './facts.js';
import {
  exact, compact, pct, identify, searchUrl, matches, filterTimeline, sortRows, labelize, liveOddities,
  LENSES, readLens, inLens, lensSearch, REFSEQ_PREFIXES, wordy, yearOf,
} from './lib.js';
import { TYPE_SERIES } from './queries.js';
import { findings } from './findings.js';
import {
  columns, dotplot, stackedArea, miniArea, waffle, treemap, lines, timeline, observeFigures, countUp, tipLines,
} from './charts.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const h = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid !== null && kid !== undefined && kid !== false) node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
};

const ext = (href, text, props = {}) => h('a', { href, target: '_blank', rel: 'noopener', ...props }, text);
const cite = (key) => ext(SOURCES[key], 'source', { class: 'src', title: SOURCES[key] });
const fill = (sel, ...nodes) => $(sel).replaceChildren(...nodes);
const usd = (n) => `$${compact(n)}`;
const CAT = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

const F = findings(snapshot);
const NOW = new Date(snapshot.generated).getUTCFullYear();
const db = (name) => snapshot.entrez.find((d) => d.db === name);
const ct = snapshot.clinicaltrials;
const fund = snapshot.funding;
const ctLabel = (piece, value) => ct.labels?.[piece]?.[value] ?? labelize(value);

const state = { query: '', tags: new Set(), lens: 'all', entrezSort: 'count', facet: null, ctField: 'OverallStatus', fundTab: 'activity' };

const renderHead = () => {
  const day = new Date(snapshot.generated).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('#stamp').textContent = `Data as of ${day}. Rebuilt every Sunday from NCBI, NLM, ClinicalTrials.gov and NIH RePORTER.`;
  for (const node of $$('[data-finding]')) node.textContent = F[node.dataset.finding];
  $('[data-finding-caption="design"]').textContent = `${F.design}, among studies that state masking. Each square is 1%.`;
};

const renderLede = () => {
  countUp($('[data-hero="pubmed"]'), db('pubmed').count);
  const b = (text) => h('b', {}, text);
  fill('#lede-text',
    'Alongside them sit ', b(`${wordy(db('protein').count)} protein sequences`), ', ',
    b(`${wordy(db('snp').count)} reference SNPs`), ', ',
    b(`${wordy(db('pccompound').count)} chemical compounds`), ' and ',
    b(`${exact(ct.total)} registered clinical studies`), '. NIH RePORTER lists ',
    b(`${usd(fund.detail.dollars)} in NLM awards`), ` for FY${fund.detailFy}, ${pct(fund.detail.dollars / fund.ics.reduce((n, i) => n + i.dollars, 0))} of what it lists for NIH.`);
  const items = [
    ['Nucleotide sequences', db('nuccore').count],
    ['Gene records', db('gene').count],
    ['BioSamples', db('biosample').count],
    ['SRA experiments', db('sra').count],
    ['PMC full text', db('pmc').count],
    ['Taxonomy nodes', db('taxonomy').count],
  ];
  fill('#ticker', ...items.map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', { title: exact(value) }, compact(value)))));
};

const ENTREZ_SORT = { count: ['count', 'desc'], name: ['name', 'asc'], updated: ['updated', 'desc'] };
let entrezPlot;

const renderEntrez = () => {
  const total = snapshot.entrez.reduce((n, d) => n + (d.count ?? 0), 0);
  const stale = snapshot.entrez.reduce((a, d) => (d.updated < a.updated ? d : a));
  $('#entrez-dek').textContent = `${snapshot.entrez.length} databases answer E-utilities, holding ${wordy(total)} records between them. The least recently updated is ${stale.name}, last touched ${stale.updated}.`;
  const rows = sortRows(snapshot.entrez, ...ENTREZ_SORT[state.entrezSort]).map((d) => ({ key: d.db, label: d.name, value: d.count, hi: d.db === 'pubmed', d }));
  entrezPlot = dotplot({
    mount: $('#entrez-chart'),
    rows,
    attr: 'db',
    rowH: 22,
    aria: 'Records per Entrez database, log scale',
    href: (r) => searchUrl(r.key),
    linkText: (r) => `Open ${r.label}`,
    describe: (r) => tipLines(exact(r.value), r.label, r.d.description, `Updated ${r.d.updated} · ${r.d.fields} search fields · ${r.d.links} link types`),
  });
  fill('#entrez-table',
    h('thead', {}, h('tr', {}, ['Database', 'Code', 'What', 'Records', 'Updated', 'Fields', 'Links'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, snapshot.entrez.map((d) => h('tr', { 'data-search': `${d.name} ${d.db} ${d.description}` },
      h('td', {}, ext(searchUrl(d.db), d.name)), h('td', {}, h('code', {}, d.db)), h('td', {}, d.description || '—'),
      h('td', { class: 'n' }, exact(d.count)), h('td', { class: 'n' }, d.updated), h('td', { class: 'n' }, d.fields), h('td', { class: 'n' }, d.links)))));
};

const sortEntrez = (key) => {
  state.entrezSort = key;
  $$('#entrez-sort button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === key)));
  entrezPlot.order(sortRows(snapshot.entrez, ...ENTREZ_SORT[key]).map((d) => d.db));
};

const renderPubmed = () => {
  const years = snapshot.pubmed.years.map((y) => ({ ...y, partial: y.year === NOW }));
  const done = years.filter((y) => !y.partial);
  const peak = done.reduce((a, b) => (b.count > a.count ? b : a));
  const jumps = done.slice(1).map((y, i) => ({ year: y.year, delta: y.count - done[i].count }));
  const jump = jumps.reduce((a, b) => (b.delta > a.delta ? b : a));
  $('#pubmed-dek').textContent = `${exact(db('pubmed').count)} records in all. ${NOW} has ${exact(years.at(-1).count)} so far. The biggest one-year jump came in ${jump.year}, up ${exact(jump.delta)} on the year before.`;
  const notes = [{ key: peak.year, text: `${peak.year}: ${wordy(peak.count)}` }];
  if (jump.year !== peak.year) notes.push({ key: jump.year, text: `${jump.year}: +${compact(jump.delta)}` });
  columns({
    mount: $('#pubmed-chart'),
    rows: years,
    key: (r) => r.year,
    value: (r) => r.count,
    highlight: (r) => r.year === peak.year,
    annotations: notes,
    aria: 'PubMed citations by publication year',
    describe: (r, prev) => tipLines(exact(r.count), `${r.year}${r.partial ? ' so far' : ''}`, prev ? `${r.count >= prev.count ? '+' : ''}${exact(r.count - prev.count)} on ${prev.year}` : null,
      { href: searchUrl('pubmed', `${r.year}[dp]`), text: 'Open in PubMed' }),
  });
  columns({
    mount: $('#eras-chart'),
    rows: snapshot.pubmed.eras,
    key: (r) => r.from,
    attr: 'era',
    label: (r) => (r.from === 1781 ? '1781–99' : r.from === 1940 ? '1940–44' : `${r.from}s`),
    value: (r) => r.count,
    height: 150,
    aria: 'PubMed citations before 1945 by decade',
    describe: (r) => tipLines(exact(r.count), `${r.from}–${r.to}`),
  });
};

const renderTypes = () => {
  const years = snapshot.types[0].years.map((y) => y.year);
  const valuesOf = (id) => snapshot.types.find((t) => t.id === id).years.map((y) => y.count);
  stackedArea({
    mount: $('#types-chart'),
    years,
    series: TYPE_SERIES.stacked.map((t, i) => ({ key: t.id, label: t.label, color: CAT[i], values: valuesOf(t.id) })),
    aria: 'Publication types per year, stacked',
  });
  fill('#types-multiples', ...TYPE_SERIES.multiples.map((t) => {
    const values = valuesOf(t.id);
    const first = years[values.findIndex((v) => v > 0)];
    const total = values.reduce((a, b) => a + b, 0);
    return h('div', { class: 'panel', 'data-search': t.label },
      h('h4', {}, ext(searchUrl('pubmed', t.term), t.label)),
      h('p', {}, `${exact(total)} since ${first} · ${years.at(-1)}: ${exact(values.at(-1))}`),
      miniArea({
        years,
        values,
        color: /retract/.test(t.id) ? 'var(--accent)' : 'var(--ink)',
        describe: (yr, v) => tipLines(exact(v), `${t.label}, ${yr}`),
      }));
  }));
};

const FACET_LABELS = {
  types: 'Publication type', languages: 'Language', organisms: 'Organism', subsets: 'Subsets', mesh: 'MeSH records', molecular: 'Genes and taxa', clinvar: 'ClinVar',
};

const facetGroups = () => snapshot.groups.filter((g) => !g.panel);

const groupPlot = (mount, group, labelShare = 0.34) => {
  const total = db(group.items[0].db)?.count;
  const same = group.items.every((i) => i.db === group.items[0].db);
  return dotplot({
    mount,
    rows: sortRows(group.items, 'count', 'desc').map((i) => ({ key: i.id, label: i.label, value: i.count, term: i.term, db: i.db })),
    labelShare,
    href: (r) => searchUrl(r.db, r.term),
    linkText: () => 'Run this query',
    aria: group.title,
    describe: (r) => tipLines(exact(r.value), r.label, same && total ? `${pct(r.value / total)} of ${db(r.db).name}` : null, r.term),
  });
};

const renderFacet = (id) => {
  state.facet = id;
  $$('#facet-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.group === id)));
  groupPlot($('#facet-panel'), snapshot.groups.find((g) => g.id === id));
};

const renderFacets = () => {
  fill('#facet-tabs', ...facetGroups().map((g) => h('button', {
    type: 'button', role: 'tab', 'data-group': g.id, 'aria-controls': 'facet-panel', 'aria-selected': 'false', onclick: () => renderFacet(g.id),
  }, FACET_LABELS[g.id] ?? g.title)));
  renderFacet(state.facet ?? facetGroups()[0].id);
};

const renderMethods = () => {
  const from = snapshot.methods[0].years[0].year;
  const to = snapshot.methods[0].years.at(-1).year;
  $('#methods-dek').textContent = `Ten methods biostatisticians reach for, counted by MeSH tag in PubMed, ${from}–${to}. A line starting late marks the year a tag first appears.`;
  fill('#methods-list', ...sortRows(snapshot.methods, 'total', 'desc').map((m) => {
    const first = m.years.find((y) => y.count > 0)?.year;
    const peak = m.years.reduce((a, b) => (b.count > a.count ? b : a));
    return h('li', { 'data-search': `${m.label} ${m.term}` },
      h('h4', {}, ext(searchUrl('pubmed', m.term), m.label)),
      h('p', {}, `${exact(m.total)} records · first ${first === from ? `≤${from}` : first} · peak ${peak.year}`),
      miniArea({ years: m.years.map((y) => y.year), values: m.years.map((y) => y.count), describe: (yr, v) => tipLines(exact(v), `${m.label}, ${yr}`) }),
      h('code', {}, m.term));
  }));
};

const renderPapers = () => {
  dotplot({
    mount: $('#papers-chart'),
    rows: sortRows(snapshot.papers, 'citedBy', 'desc').map((p) => ({ key: p.pmid, label: `${p.topic} (${p.date.slice(0, 4)})`, value: p.citedBy, hi: p.topic === 'BLAST', p })),
    attr: 'pmid',
    href: (r) => `https://pubmed.ncbi.nlm.nih.gov/${r.key}/`,
    linkText: () => 'Open in PubMed',
    aria: 'Citing records per landmark paper',
    describe: (r) => tipLines(exact(r.value), r.p.title, `${r.p.journal} · ${r.p.date}`, `${r.p.authors.join(', ')}${r.p.authorCount > 3 ? ` +${r.p.authorCount - 3}` : ''}`),
  });
  columns({
    mount: $('#pmc-chart'),
    rows: PMC_YEARS,
    key: (r) => r.fy,
    attr: 'fy',
    label: (r) => `FY${String(r.fy).slice(2)}`,
    value: (r) => r.articles,
    height: 170,
    aria: 'PMC articles available by fiscal year',
    describe: (r) => tipLines(exact(r.articles), `FY${r.fy} articles`, `${compact(r.sessions)} sessions per weekday`),
  });
};

const CT_TABS = [
  ['OverallStatus', 'Status'], ['Phase', 'Phase'], ['StudyType', 'Study type'], ['InterventionType', 'Intervention'],
  ['LeadSponsorClass', 'Sponsor'], ['Sex', 'Sex'], ['LocationCountry', 'Countries'], ['Condition', 'Conditions'],
  ['DesignAllocation', 'Allocation'], ['DesignPrimaryPurpose', 'Purpose'], ['DesignInterventionModel', 'Model'],
];

const renderCtTab = (key) => {
  state.ctField = key;
  $$('#ct-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.field === key)));
  const free = key === 'LocationCountry' || key === 'Condition';
  const field = ct.fields[key];
  dotplot({
    mount: $('#ct-panel'),
    rows: field.top.map((v) => ({ key: v.value, label: free ? v.value : ctLabel(key, v.value), value: v.count })),
    scale: 'linear',
    href: free ? (r) => `https://clinicaltrials.gov/search?${key === 'Condition' ? 'cond' : 'country'}=${encodeURIComponent(r.key)}` : null,
    linkText: () => 'Search ClinicalTrials.gov',
    aria: `Studies by ${key}`,
    describe: (r) => tipLines(exact(r.value), r.label, `${pct(r.value / ct.total)} of all studies`, `${exact(field.unique)} distinct values`),
  });
};

const renderTrials = () => {
  $('#ct-dek').textContent = `${exact(ct.total)} studies are registered, data as of ${ct.dataTimestamp.slice(0, 10)}. Of ${exact(ct.completedInterventional)} completed interventional studies, ${exact(ct.completedInterventionalWithResults)} have results posted.`;
  waffle({
    mount: $('#results-waffle'),
    parts: [
      { label: 'Results posted', value: ct.completedInterventionalWithResults },
      { label: 'No results posted', value: ct.completedInterventional - ct.completedInterventionalWithResults },
    ],
    aria: F.trials,
  });
  waffle({
    mount: $('#masking-waffle'),
    parts: ['NONE', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUADRUPLE'].map((v) => ({ label: ctLabel('DesignMasking', v), value: ct.fields.DesignMasking.top.find((t) => t.value === v)?.count ?? 0 })),
    aria: F.design,
  });
  const timing = ct.timing.map((t) => ({ ...t, partial: t.year === NOW }));
  const firstResults = timing.find((t) => t.results > 0);
  columns({
    mount: $('#design-chart'),
    rows: timing,
    key: (r) => r.year,
    value: (r) => r.registered,
    overlay: (r) => r.results,
    annotations: firstResults ? [{ key: firstResults.year, text: `Results first posted: ${firstResults.year}` }] : [],
    aria: 'Studies and results first posted per year',
    describe: (r) => tipLines(exact(r.registered), `studies first posted in ${r.year}${r.partial ? ' so far' : ''}`, `${exact(r.results)} first posted results`),
  });
  const bandLabel = (b) => {
    if (b.to === 'MAX') return `${compact(b.from - 1)}+`;
    if (b.from === b.to) return String(b.from);
    return `${compact(b.from)}–${compact(b.to)}`;
  };
  columns({
    mount: $('#enrollment-chart'),
    rows: ct.enrollmentBands,
    key: (r) => r.from,
    attr: 'band',
    label: bandLabel,
    value: (r) => r.count,
    height: 170,
    aria: 'Studies by stated enrollment',
    describe: (r) => tipLines(exact(r.count), `studies enrolling ${bandLabel(r)}`),
  });
  const enr = ct.fields.EnrollmentCount;
  $('#enrollment-caption').textContent = `Studies by stated enrollment. The mean is ${exact(Math.round(enr.mean))}; the largest claims ${exact(enr.max)} (${ct.biggestEnrollment.id}).`;
  fill('#ct-tabs', ...CT_TABS.map(([key, label]) => h('button', {
    type: 'button', role: 'tab', 'data-field': key, 'aria-controls': 'ct-panel', 'aria-selected': 'false', onclick: () => renderCtTab(key),
  }, label)));
  renderCtTab(state.ctField);
  fill('#ct-largest',
    h('li', {}, ext(`https://clinicaltrials.gov/study/${ct.first.id}`, ct.first.id), ` is the lowest NCT number: “${ct.first.title}”, posted ${ct.first.posted}. `, h('small', {}, 'First record')),
    h('li', {}, ext(`https://clinicaltrials.gov/study/${ct.biggestEnrollment.id}`, ct.biggestEnrollment.id), ` states ${exact(ct.biggestEnrollment.count)} participants: “${ct.biggestEnrollment.title}”. `, h('small', {}, 'Largest enrollment')),
    ...ct.largest.slice(0, 3).map((r) => h('li', {}, ext(`https://clinicaltrials.gov/study/${r.id}`, r.id), ` “${r.title}” `, h('small', {}, `${(r.bytes / 1e6).toFixed(2)} MB record`))));
};

const FUND_TABS = [['activity', 'Activity code'], ['category', 'Spending category'], ['orgs', 'Recipients']];

const renderFundTab = (key) => {
  state.fundTab = key;
  $$('#funding-tabs [role="tab"]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)));
  const d = fund.detail;
  const byAwards = key === 'category';
  const list = key === 'activity' ? d.byActivity : key === 'category' ? sortRows(d.byCategory, 'projects', 'desc') : d.byOrg;
  dotplot({
    mount: $('#funding-panel'),
    rows: list.map((g) => ({ key: g.key, label: g.key, value: byAwards ? g.projects : g.dollars, g })),
    scale: byAwards ? 'linear' : 'log',
    format: byAwards ? exact : usd,
    labelShare: 0.42,
    aria: `NLM awards by ${key}`,
    describe: (r) => tipLines(byAwards ? `${exact(r.g.projects)} awards` : `$${exact(r.g.dollars)}`, r.label, byAwards ? usd(r.g.dollars) : `${exact(r.g.projects)} awards`),
  });
  $('#funding-caption').textContent = byAwards
    ? `NLM awards by NIH spending category, FY${fund.detailFy}. One award can carry several categories.`
    : `NLM award dollars by ${key === 'activity' ? 'activity code' : 'recipient organization'}, FY${fund.detailFy}, log scale.`;
};

const renderFunding = () => {
  const d = fund.detail;
  const total = fund.ics.reduce((n, i) => n + i.dollars, 0);
  $('#funding-dek').textContent = `NLM administered ${exact(d.projects)} awards worth $${exact(d.dollars)} in FY${fund.detailFy}, ${exact(d.newProjects)} of them new. The median project runs ${d.medianYears} years. ${F.ics}.`;
  treemap({
    mount: $('#ic-treemap'),
    items: fund.ics.map((i) => ({ key: i.ic, label: i.ic, value: i.dollars, sub: usd(i.dollars), hi: i.ic === 'NLM', i })),
    aria: 'NIH award dollars by institute',
    describe: (r) => tipLines(`$${exact(r.value)}`, r.label, `${exact(r.i.projects)} awards`, `${pct(r.value / total)} of ${usd(total)}`),
  });
  $('#ic-caption').textContent = `Award dollars by NIH institute or center, FY${fund.detailFy}: ${usd(total)} across ${fund.ics.length}. NLM in red. Source: NIH RePORTER API.`;
  columns({
    mount: $('#funding-chart'),
    rows: fund.years,
    key: (r) => r.fy,
    attr: 'fy',
    value: (r) => r.dollars,
    highlight: (r) => r.fy === fund.detailFy,
    yFormat: usd,
    annotations: [{ key: 2008, text: 'FY2008: the intramural services record appears' }],
    aria: 'NLM award dollars per fiscal year',
    describe: (r) => tipLines(`$${exact(r.dollars)}`, `FY${r.fy}${r.partial ? ', still arriving' : ''}`, `${exact(r.projects)} awards`),
  });
  const mech = (name) => d.byMechanism.find((m) => m.key === name)?.dollars ?? 0;
  const intramural = mech('Intramural Research');
  const grants = mech('Non-SBIR/STTR');
  waffle({
    mount: $('#intramural-waffle'),
    parts: [
      { label: 'Intramural', value: intramural },
      { label: 'Research grants', value: grants },
      { label: 'Everything else', value: d.dollars - intramural - grants },
    ],
    format: (v) => `$${exact(v)}`,
    aria: F.funding,
  });
  fill('#funding-tabs', ...FUND_TABS.map(([key, label]) => h('button', {
    type: 'button', role: 'tab', 'data-tab': key, 'aria-controls': 'funding-panel', 'aria-selected': 'false', onclick: () => renderFundTab(key),
  }, label)));
  renderFundTab(state.fundTab);
  fill('#funding-largest', ...d.largest.map((a) => h('li', {},
    ext(`https://reporter.nih.gov/project-details/${a.appl}`, a.number), ` ${a.title} `,
    h('small', {}, `${a.org ?? ''} · ${a.activity} · $${exact(a.dollars)}`))));
};

const renderSeq = () => {
  const gb = snapshot.genbank;
  const first = gb.firstRelease;
  $('#gb-dek').textContent = `GenBank release ${gb.release}, ${gb.date}: ${exact(gb.traditional.sequences)} traditional records and ${wordy(gb.traditional.bases)} bases, plus ${wordy(gb.sets.bases)} bases in WGS, TSA and TLS sets. Bases have doubled about every 18 months since 1982.`;
  const trad = gb.growth.traditional.map((r) => ({ x: r.year, y: r.bases, r }));
  const wgs = gb.growth.wgs.map((r) => ({ x: r.year, y: r.bases, r }));
  lines({
    mount: $('#genbank-chart'),
    series: [{ label: 'Traditional', rows: trad }, { label: 'WGS', rows: wgs, alt: true }],
    annotations: [{ x: 1982, text: `Release ${first.release}: ${exact(first.entries)} records` }],
    aria: 'GenBank bases per year, log scale',
    describe: (yr) => {
      const t = trad.find((p) => p.x === yr);
      const w = wgs.find((p) => p.x === yr);
      return tipLines(String(yr), t ? `Traditional ${wordy(t.y)} bases, release ${t.r.release}` : 'Traditional —', w ? `WGS ${wordy(w.y)} bases` : null);
    },
  });
  dotplot({
    mount: $('#organisms-chart'),
    rows: gb.organisms.map((o) => ({ key: o.species, label: o.common ?? o.species, value: o.bases, hi: o.species === 'Homo sapiens', o })),
    format: compact,
    labelShare: 0.42,
    aria: 'Most sequenced organisms by bases',
    describe: (r) => tipLines(`${wordy(r.value)} bases`, r.o.species, r.o.common, `${exact(r.o.entries)} records`),
  });
  dotplot({
    mount: $('#divisions-chart'),
    rows: gb.divisions.map((d) => ({ key: d.code, label: `${d.code} ${DIVISIONS[d.code]}`, value: d.bases, d })),
    format: compact,
    labelShare: 0.42,
    aria: 'Bases by GenBank division',
    describe: (r) => tipLines(`${wordy(r.value)} bases`, r.label, `${exact(r.d.entries)} records in ${exact(r.d.files)} files`),
  });
  const group = (id) => snapshot.groups.find((g) => g.id === id);
  groupPlot($('#sra-strategy-chart'), group('sra-strategy'), 0.42);
  groupPlot($('#sra-platform-chart'), group('sra-platform'), 0.42);
  groupPlot($('#assembly-chart'), group('assembly'), 0.42);
  const r = snapshot.refseq;
  $('#refseq-line').textContent = `RefSeq release ${r.release} (${r.date}) holds ${exact(r.records)} records from ${exact(r.organisms)} organisms.`;
};

const table = (sel, caption, head, rows) => fill(sel,
  h('caption', {}, caption),
  h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col' }, t)))),
  h('tbody', {}, rows));

const renderReference = () => {
  table('#api-table', 'Published rate limits', ['Service', 'Without a key', 'With a key', 'Notes', ''],
    APIS.map((a) => h('tr', { 'data-search': `${a.service} ${a.limit} ${a.note}` },
      h('td', {}, h('b', {}, a.service)), h('td', {}, a.limit), h('td', {}, a.keyed), h('td', {}, a.note), h('td', {}, cite(a.src)))));
  table('#cadence-table', 'How often things change', ['Resource', 'Updates', ''],
    CADENCES.map((c) => h('tr', { 'data-search': `${c.resource} ${c.cadence}` },
      h('td', {}, h('b', {}, c.resource)), h('td', {}, c.cadence), h('td', {}, cite(c.src)))));
  table('#refseq-prefixes', 'RefSeq accession prefixes', ['Prefix', 'Molecule', 'Use'],
    REFSEQ_PREFIXES.map((p) => h('tr', { 'data-search': `${p.prefix} ${p.molecule} ${p.use}` },
      h('td', {}, h('code', {}, p.prefix)), h('td', {}, p.molecule), h('td', {}, p.use))));
};

let tl;

const showDetail = (type, i) => {
  if (type === 'event') {
    const e = TIMELINE[i];
    fill('#timeline-detail', h('time', {}, e.date), e.text, ' ', cite(e.src));
  } else if (type === 'person') {
    const p = PEOPLE[i];
    fill('#timeline-detail', h('time', {}, `${p.from}–${p.to ?? 'now'}`), `${p.name}, ${p.role}, ${p.org}. ${p.note}.`, ' ', cite(p.src));
  } else {
    const p = PROJECTS[i];
    fill('#timeline-detail', h('time', {}, String(p.since)), `${p.name} (${p.org}): ${p.facts.join('; ')}.`, ' ', cite(p.src));
  }
};

const ERAS = [[1815, 1900], [1900, 1950], [1950, 2000], [2000, 2027]];

const renderTimeline = () => {
  tl = timeline({
    mount: $('#timeline-svg'),
    events: TIMELINE,
    people: PEOPLE,
    projects: PROJECTS,
    limits: [1815, 2027],
    onSelect: showDetail,
    onRange: (d) => { $('#timeline-range').textContent = `${Math.round(d[0])}–${Math.round(d[1])}`; },
  });
  fill('#timeline-eras', ...ERAS.map(([from, to]) => h('button', { type: 'button', 'data-from': from, onclick: () => tl.set([from, to]) }, from === 1815 ? '1800s' : `${from}–${String(to).slice(2)}`)));
  fill('#timeline-detail', h('time', {}, 'Tip'), 'Tap a circle, bar or diamond. Circles are events, bars are tenures, diamonds are launches.');
  const counts = Object.fromEntries(TAGS.map((t) => [t, TIMELINE.filter((e) => e.tag === t).length]));
  fill('#timeline-tags', ...TAGS.map((t) => h('button', { type: 'button', 'data-tag': t, 'aria-pressed': 'false' }, t, h('b', {}, counts[t]))));
  fill('#timeline-list', ...TIMELINE.map((e, i) => h('li', { 'data-i': i },
    h('time', { datetime: e.date }, e.date),
    h('span', {}, h('span', { class: 'org' }, e.org), e.text, ' ', cite(e.src)))));
  $('#timeline-list').addEventListener('click', (event) => {
    const li = event.target.closest('li');
    if (!li || event.target.closest('a')) return;
    const i = Number(li.dataset.i);
    tl.focus(yearOf(TIMELINE[i].date), 'event', i);
    showDetail('event', i);
    $('#timeline-svg').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
};

const applyTimeline = () => {
  const keep = new Set(filterTimeline(TIMELINE, { tags: [...state.tags], query: state.query }));
  $$('#timeline-list li').forEach((li) => { li.hidden = !keep.has(TIMELINE[Number(li.dataset.i)]); });
};

const decode = () => {
  const value = $('#decoder-input').value;
  if (!value.trim()) {
    fill('#decoder-out', h('p', { class: 'none' }, 'Type an identifier, or try one of the examples below.'));
    return;
  }
  const hit = identify(value);
  if (!hit) {
    fill('#decoder-out', h('p', { class: 'none' }, `No match for “${value.trim()}”.`));
    return;
  }
  const known = EXAMPLES.find((e) => identify(e.id)?.id === hit.id && identify(e.id)?.type === hit.type);
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

const renderProjects = () => {
  const count = (p) => (p.name === 'ClinicalTrials.gov' ? ct.total : p.db ? db(p.db)?.count : null);
  table('#projects-table', 'Fifteen NLM and NCBI resources', ['Project', 'Since', 'Org', 'Records now', 'What stands out', 'Try'],
    PROJECTS.map((p) => h('tr', { 'data-search': `${p.name} ${p.org} ${p.since} ${p.id ?? ''} ${p.facts.join(' ')}` },
      h('td', {}, ext(p.url, p.name)),
      h('td', { class: 'n' }, p.since),
      h('td', {}, p.org),
      h('td', { class: 'n' }, count(p) === null ? '—' : exact(count(p))),
      h('td', {}, p.facts.join('. '), '. ', cite(p.src)),
      h('td', {}, p.id ? h('button', { type: 'button', class: 'textbtn example', 'data-id': p.id, onclick: () => decodeAndJump(p.id) }, p.id) : ''))));
};

const renderOddities = () => fill('#oddities',
  ...ODDITIES.map((o) => h('li', { 'data-search': o.text }, h('span', {}, o.text, ' ', cite(o.src)))),
  ...liveOddities(snapshot).map((o) => h('li', { 'data-search': o.text }, h('span', {}, o.text, ' ', ext(o.href, 'source', { class: 'src' })))));

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

const API_SOURCES = [
  ['E-utilities', 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/einfo.fcgi'],
  ['ClinicalTrials.gov API v2', 'https://clinicaltrials.gov/data-api/api'],
  ['NIH RePORTER API', 'https://api.reporter.nih.gov/'],
  ['GenBank release notes', 'https://ftp.ncbi.nlm.nih.gov/genbank/gbrel.txt'],
  ['RefSeq release notes', 'https://ftp.ncbi.nlm.nih.gov/refseq/release/release-notes/'],
];

const renderSources = () => {
  const label = (url) => url.replace(/^https:\/\//, '').replace(/\/$/, '');
  fill('#source-list',
    ...API_SOURCES.map(([name, url]) => h('li', { 'data-search': `${name} ${url}` }, h('b', {}, `${name}: `), ext(url, label(url)))),
    ...Object.values(SOURCES).map((url) => h('li', { 'data-search': url }, ext(url, label(url)))));
  fill('#foot', `Built from public NLM, NCBI and NIH data. Snapshot ${snapshot.generated.slice(0, 16).replace('T', ' ')} UTC. Not an official NLM or NCBI site.`);
};

const SEARCHABLE = [
  '#projects-table tbody tr', '#oddities li', '#entrez-table tbody tr', '#source-list li', '#api-table tbody tr',
  '#cadence-table tbody tr', '#refseq-prefixes tbody tr', '#methods-list li', '#types-multiples .panel',
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
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const theme = () => document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');

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

const drawCharts = () => {
  renderEntrez();
  renderPubmed();
  renderTypes();
  renderFacets();
  renderMethods();
  renderPapers();
  renderTrials();
  renderFunding();
  renderSeq();
  tl?.redraw();
  applySearch();
};

const paintTheme = () => {
  $('#theme').textContent = theme() === 'dark' ? 'Light' : 'Dark';
  $('#theme').setAttribute('aria-pressed', String(theme() === 'dark'));
};

const initTheme = () => {
  const saved = store.get(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  paintTheme();
  darkQuery.addEventListener('change', () => {
    paintTheme();
    drawCharts();
  });
  $('#theme').addEventListener('click', () => {
    const next = theme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set(THEME_KEY, next);
    paintTheme();
    drawCharts();
  });
};

const applyLens = (lens, push) => {
  state.lens = lens;
  $$('#lenses button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lens === lens)));
  $$('main > section').forEach((sec) => { sec.hidden = !inLens(sec.dataset.lens, lens); });
  $$('#jump a').forEach((a) => { a.hidden = $(`#${a.dataset.for}`).hidden; });
  $('#lens-hint').textContent = LENSES.find((l) => l.id === lens).hint;
  if (push) {
    history.replaceState(null, '', `${location.pathname}${lensSearch(location.search, lens)}${location.hash}`);
    drawCharts();
  }
};

const renderLenses = () => {
  fill('#lenses', ...LENSES.map((l) => h('button', { type: 'button', 'data-lens': l.id, 'aria-pressed': 'false', title: l.hint }, l.label)));
  fill('#jump', ...$$('main > section[data-nav]').map((sec) => h('a', { href: `#${sec.id}`, 'data-for': sec.id }, sec.dataset.nav)));
  $('#lenses').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-lens]');
    if (btn) applyLens(btn.dataset.lens, true);
  });
};

let resizeTimer;
let lastWidth = 0;
const onResize = () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    drawCharts();
  }, 160);
};

const init = () => {
  initTheme();
  renderLenses();
  renderHead();
  renderLede();
  renderReference();
  renderTimeline();
  renderProjects();
  renderOddities();
  renderDecoder();
  renderSources();
  drawCharts();
  applyLens(readLens(location.search), false);
  observeFigures();
  lastWidth = window.innerWidth;
  window.addEventListener('resize', onResize);
  $('#entrez-sort').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-sort]');
    if (btn) sortEntrez(btn.dataset.sort);
  });
  $('#q').addEventListener('input', onSearch);
  $('#timeline-tags').addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-tag]');
    if (!btn) return;
    const tag = btn.dataset.tag;
    if (state.tags.has(tag)) state.tags.delete(tag);
    else state.tags.add(tag);
    btn.setAttribute('aria-pressed', String(state.tags.has(tag)));
    applyTimeline();
  });
  $('#zoom-in').addEventListener('click', () => tl.zoom(0.6));
  $('#zoom-out').addEventListener('click', () => tl.zoom(1.6));
  $('#zoom-reset').addEventListener('click', () => tl.reset());
  $('#shuffle').addEventListener('click', shuffle);
};

init();
