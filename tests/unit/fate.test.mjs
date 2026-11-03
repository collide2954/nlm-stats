import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStop, stopReasons, resultsLag, retractionYears, geneExtremes,
} from '../../scripts/parsers.mjs';

const reasons = (text) => classifyStop(text).reasons;

test('classifyStop sorts common stated reasons', () => {
  assert.deepEqual(reasons('Slow accrual'), ['enrollment']);
  assert.deepEqual(reasons('Sponsor decision'), ['business']);
  assert.deepEqual(reasons('Lack of funding'), ['funding']);
  assert.deepEqual(reasons('PI left institution'), ['investigator']);
  assert.deepEqual(reasons('COVID pandemic'), ['covid']);
  assert.deepEqual(reasons('Drug supply issues'), ['supply']);
  assert.deepEqual(reasons('Lack of efficacy'), ['efficacy']);
  assert.deepEqual(reasons('The study was stopped due to an unanticipated serious adverse event.'), ['safety']);
  assert.deepEqual(reasons('ethical issues'), []);
});

test('classifyStop gives several reasons when a text names several', () => {
  assert.deepEqual(reasons('Sponsor decision due to slow enrollment'), ['enrollment', 'business']);
});

test('classifyStop reads denials of safety problems as denials', () => {
  const a = classifyStop('Business Decision; No Safety or Efficacy Concerns');
  assert.deepEqual(a.reasons, ['business']);
  assert.equal(a.notSafety, true);
  const b = classifyStop('Company decision not related to safety.');
  assert.deepEqual(b.reasons, ['business']);
  assert.equal(b.notSafety, true);
  const c = classifyStop('Study discontinued as DSMB determined it was futile. No safety concerns were noted.');
  assert.deepEqual(c.reasons, ['efficacy']);
  assert.equal(c.notSafety, true);
  assert.equal(classifyStop('Slow accrual').notSafety, false);
});

test('classifyStop ignores monitoring board names and safety follow-up', () => {
  assert.deepEqual(reasons('Data Safety Monitoring Board (DSMB) recommended stopping study due to futility'), ['efficacy']);
  assert.deepEqual(reasons('Accrual was halted on the basis of the Data and Safety Monitoring Board review of a futility analysis.'), ['enrollment', 'efficacy']);
  assert.deepEqual(reasons('DSMB recommended stopping due to safety concerns'), ['safety']);
});

test('stopReasons tallies reasons, denials and sponsor classes', () => {
  const rows = [
    { why: 'Slow accrual', cls: 'OTHER' },
    { why: 'Low enrollment', cls: 'INDUSTRY' },
    { why: 'Business decision, not due to safety', cls: 'INDUSTRY' },
    { why: 'Toxicity', cls: 'OTHER' },
    { why: 'ethical issues', cls: 'OTHER' },
  ];
  const out = stopReasons(rows);
  assert.equal(out.total, 5);
  assert.equal(out.notSafety, 1);
  assert.equal(out.unclassified, 1);
  assert.deepEqual(out.reasons[0], { id: 'enrollment', label: 'Enrollment or accrual', count: 2, industry: 1 });
  assert.equal(out.reasons.find((r) => r.id === 'safety').count, 1);
  assert.equal(out.reasons.find((r) => r.id === 'business').industry, 1);
  assert.equal(out.industry, 2);
});

test('resultsLag bins months from completion to results and finds the pile-up', () => {
  const rows = [
    { pc: '2019-01-01', submit: '2019-12-20', cls: 'INDUSTRY' },
    { pc: '2019-01-01', submit: '2019-12-25', cls: 'INDUSTRY' },
    { pc: '2019-01-01', submit: '2019-04-01', cls: 'OTHER' },
    { pc: '2019-01-01', submit: '2023-06-01', cls: 'OTHER' },
    { pc: '2019-01-01', submit: '2018-12-01', cls: 'OTHER' },
    { pc: '2016-01-01', submit: '2016-12-01', cls: 'OTHER' },
    { pc: '2019-05', submit: '2020-05-10', cls: 'OTHER' },
  ];
  const out = resultsLag(rows, { from: 2018, to: 2022, cap: 48, minClass: 1 });
  assert.equal(out.n, 5);
  assert.equal(out.negative, 1);
  assert.equal(out.months.length, 49);
  assert.equal(out.months[11], 2);
  assert.equal(out.months[2], 1);
  assert.equal(out.months[48], 1);
  assert.equal(out.months[12], 1);
  assert.equal(out.within12, 3 / 5);
  assert.equal(out.peak, 11);
  assert.deepEqual(out.byClass.map((c) => [c.cls, c.n, c.within12]), [['OTHER', 3, 1 / 3], ['INDUSTRY', 2, 1]]);
});

const XML = `<PubmedArticleSet>
<PubmedArticle><MedlineCitation Status="MEDLINE" Owner="NLM"><PMID Version="1">9500320</PMID>
<CommentsCorrectionsList>
<CommentsCorrections RefType="RetractionIn"><RefSource>Lancet. 2004 Mar 6;363(9411):750.</RefSource><PMID Version="1">15016483</PMID></CommentsCorrections>
<CommentsCorrections RefType="RetractionIn"><RefSource>Lancet. 2010 Feb 6;375(9713):445.</RefSource><PMID Version="1">20137807</PMID></CommentsCorrections>
<CommentsCorrections RefType="CommentIn"><RefSource>Lancet. 2012 Jan 1;1(1):1.</RefSource></CommentsCorrections>
</CommentsCorrectionsList></MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">32205204</PMID>
<CommentsCorrectionsList><CommentsCorrections RefType="RetractionIn"><RefSource>Int J Antimicrob Agents. 2025 Jan;65(1):107416.</RefSource><PMID Version="1">39730229</PMID></CommentsCorrections></CommentsCorrectionsList>
</MedlineCitation></PubmedArticle>
<PubmedArticle><MedlineCitation><PMID Version="1">1</PMID></MedlineCitation></PubmedArticle>
</PubmedArticleSet>`;

test('retractionYears takes the latest retraction notice per article', () => {
  assert.deepEqual(retractionYears(XML), { 9500320: 2010, 32205204: 2025 });
});

const gene = (uid, name, chr, start, stop, exons, acc = 'NC_000001.11') => ({
  uid, name, description: `${name} gene`, genomicinfo: [{ chrloc: chr, chraccver: acc, chrstart: start, chrstop: stop, exoncount: exons }],
});

test('geneExtremes finds the longest, shortest and most exons, and counts per chromosome', () => {
  const records = [
    gene('26047', 'CNTNAP2', '7', 146116800, 148420997, 25),
    gene('1756', 'DMD', 'X', 33339387, 31119221, 89),
    gene('7273', 'TTN', '2', 178807422, 178525988, 363),
    gene('4508', 'MT-ATP8', 'MT', 8366, 8572, 1),
    gene('9', 'ONE', '1', 1000, 5000, 1),
    gene('10', 'ALT', '1', 1, 100000000, 4, 'NT_187361.1'),
    { uid: '11', name: 'NOWHERE', description: 'x', genomicinfo: [] },
  ];
  const out = geneExtremes(records);
  assert.equal(out.genes, 7);
  assert.equal(out.placed, 5);
  assert.deepEqual(out.longest, { id: '26047', symbol: 'CNTNAP2', chr: '7', span: 2304198, exons: 25, description: 'CNTNAP2 gene' });
  assert.equal(out.shortest.symbol, 'MT-ATP8');
  assert.equal(out.shortest.span, 207);
  assert.equal(out.mostExons.symbol, 'TTN');
  assert.equal(out.singleExon, 2);
  assert.deepEqual(out.byChromosome, [
    { chr: '1', genes: 1 }, { chr: '2', genes: 1 }, { chr: '7', genes: 1 }, { chr: 'X', genes: 1 }, { chr: 'MT', genes: 1 },
  ]);
});
