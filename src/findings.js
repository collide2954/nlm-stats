import { pct, wordy, exact, ordinal, compact } from './lib.js';
import { US_TILES } from './tiles.js';

const item = (snap, group, id) => snap.groups.find((g) => g.id === group)?.items.find((i) => i.id === id);
const db = (snap, name) => snap.entrez.find((d) => d.db === name);
const year = (snap) => new Date(snap.generated).getUTCFullYear();
const fold = (n) => (n >= 10 ? `${Math.round(n)}` : `${Number(n.toFixed(1))}`);

const entrez = (snap) => {
  const top = snap.entrez.reduce((a, b) => ((b.count ?? 0) > (a.count ?? 0) ? b : a));
  return `${top.name} alone holds ${wordy(top.count)} records`;
};

const pubmed = (snap) => {
  const done = snap.pubmed.years.filter((y) => y.year < year(snap));
  const peak = done.reduce((a, b) => (b.count > a.count ? b : a));
  return peak.year === year(snap) - 1
    ? `${peak.year} was PubMed’s biggest year yet: ${wordy(peak.count)} papers`
    : `PubMed’s biggest year was ${peak.year}: ${wordy(peak.count)} papers`;
};

const types = (snap) => {
  const ratio = item(snap, 'types', 'pt-review').count / item(snap, 'types', 'pt-rct').count;
  return `Reviews outnumber randomized trials ${ratio >= 3 ? Math.round(ratio) : fold(ratio)} to 1`;
};

const facets = (snap) => `${pct(item(snap, 'languages', 'la-eng').count / db(snap, 'pubmed').count)} of PubMed is in English`;

const methods = (snap) => {
  const growth = snap.methods.map((m) => {
    const last = m.years.at(-1);
    const base = m.years.find((y) => y.year === last.year - 5);
    return { m, g: base && base.count >= 50 ? last.count / base.count : 0 };
  }).sort((a, b) => b.g - a.g);
  if (growth[0].g >= 1.5) return `${growth[0].m.label} papers grew ${fold(growth[0].g)}-fold in five years`;
  const top = snap.methods.reduce((a, b) => (b.total > a.total ? b : a));
  return `${top.label} leads with ${exact(top.total)} tagged papers`;
};

const trials = (snap) => {
  const ct = snap.clinicaltrials;
  return `Only ${pct(ct.completedInterventionalWithResults / ct.completedInterventional)} of finished trials have posted results`;
};

const design = (snap) => {
  const top = snap.clinicaltrials.fields.DesignMasking.top;
  const none = top.find((v) => v.value === 'NONE')?.count ?? 0;
  return `${pct(none / top.reduce((n, v) => n + v.count, 0))} of trials are open label`;
};

const funding = (snap) => {
  const f = snap.funding;
  const intramural = f.detail.byMechanism.find((m) => m.key === 'Intramural Research')?.dollars ?? 0;
  return `${pct(intramural / f.detail.dollars)} of NLM’s FY${f.detailFy} award dollars stay inside NLM`;
};

const ics = (snap) => {
  const list = snap.funding.ics;
  return `NLM ranks ${ordinal(list.findIndex((i) => i.ic === 'NLM') + 1)} of ${list.length} NIH institutes by award dollars`;
};

const genbank = (snap) => {
  const orgs = snap.genbank.organisms;
  const human = orgs.findIndex((o) => o.species === 'Homo sapiens');
  const name = orgs[0].common ? orgs[0].common.charAt(0).toUpperCase() + orgs[0].common.slice(1) : orgs[0].species;
  const lead = `${name} tops GenBank by bases`;
  return human > 0 ? `${lead}. Humans rank ${ordinal(human + 1)}` : lead;
};

const seqdata = (snap) => {
  const amplicon = item(snap, 'sra-strategy', 'sra-amplicon');
  const wgs = item(snap, 'sra-strategy', 'sra-wgs');
  if (amplicon && wgs && amplicon.count > wgs.count) return 'Amplicon runs outnumber whole genomes in SRA';
  const top = snap.groups.find((g) => g.id === 'sra-strategy').items.reduce((a, b) => (b.count > a.count ? b : a));
  return `${top.label} leads SRA library strategies`;
};

const papers = (snap) => {
  const blast = snap.papers.find((p) => p.topic === 'BLAST');
  return `The ${blast.date.slice(0, 4)} BLAST paper has ${exact(blast.citedBy)} citing records`;
};

const history = (snap) => `${year(snap) - 1836} years from a $150 book budget`;

const growth = (snap) => {
  const best = snap.growth.map((d) => {
    const last = d.years.at(-1);
    const base = d.years.find((y) => y.year === last.year - 10);
    return { d, last, base, g: base && base.count >= 50 ? last.count / base.count : 0 };
  }).sort((a, b) => b.g - a.g)[0];
  return `${best.d.label} grew ${fold(best.g)}-fold between ${best.base.year} and ${best.last.year}`;
};

const access = (snap) => {
  const free = snap.access.find((a) => a.id === 'free').years.at(-1);
  const total = snap.pubmed.years.find((y) => y.year === free.year).count;
  return `${pct(free.count / total)} of papers dated ${free.year} are free to read`;
};

const geography = (snap) => {
  const yr = Math.max(...Object.keys(snap.countries[0].counts).map(Number));
  const top = snap.countries.reduce((a, b) => (b.counts[yr] > a.counts[yr] ? b : a));
  return `Authors in ${top.name} appear on ${exact(top.counts[yr])} papers dated ${yr}, the most of ${snap.countries.length} countries checked`;
};

const states = (snap) => {
  const top = snap.funding.nihStates.filter((s) => US_TILES[s.key]).reduce((a, b) => (b.dollars > a.dollars ? b : a));
  return `${US_TILES[top.key].name} draws the most NIH award dollars: $${compact(top.dollars)}`;
};

const genes = (snap) => {
  const top = snap.genes.reduce((a, b) => (b.pubmed > a.pubmed ? b : a));
  return `${top.symbol} is linked to ${exact(top.pubmed)} PubMed records, the most of ${snap.genes.length} genes here`;
};

const variants = (snap) => `${pct(item(snap, 'cv-review', 'rv-single').count / db(snap, 'clinvar').count)} of ClinVar records rest on a single submitter`;

export const findings = (snap) => ({
  entrez: entrez(snap),
  pubmed: pubmed(snap),
  types: types(snap),
  facets: facets(snap),
  methods: methods(snap),
  trials: trials(snap),
  design: design(snap),
  funding: funding(snap),
  ics: ics(snap),
  genbank: genbank(snap),
  seqdata: seqdata(snap),
  papers: papers(snap),
  history: history(snap),
  ...(snap.growth ? { growth: growth(snap) } : {}),
  ...(snap.access ? { access: access(snap) } : {}),
  ...(snap.countries ? { geography: geography(snap) } : {}),
  ...(snap.funding?.nihStates ? { states: states(snap) } : {}),
  ...(snap.genes ? { genes: genes(snap) } : {}),
  ...(snap.groups.some((g) => g.id === 'cv-review') ? { variants: variants(snap) } : {}),
});
