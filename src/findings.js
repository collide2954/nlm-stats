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
    ? `${peak.year} was PubMed’s biggest year yet: ${wordy(peak.count)} records`
    : `PubMed’s biggest year was ${peak.year}: ${wordy(peak.count)} records`;
};

const types = (snap) => {
  const series = (id) => snap.types?.find((t) => t.id === id)?.years.at(-1);
  const [review, rct] = [series('review'), series('rct')];
  const many = (ratio) => (ratio >= 3 ? Math.round(ratio) : fold(ratio));
  if (review && rct && review.year === rct.year) return `Reviews outnumbered randomized trials ${many(review.count / rct.count)} to 1 in ${review.year}`;
  return `Reviews outnumber randomized trials ${many(item(snap, 'types', 'pt-review').count / item(snap, 'types', 'pt-rct').count)} to 1`;
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
  return `${pct(ct.completedInterventionalWithResults / ct.completedInterventional)} of completed trials have posted results`;
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
  return `NLM ranks ${ordinal(list.findIndex((i) => i.ic === 'NLM') + 1)} of ${list.length} NIH institutes and centers by award dollars`;
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
  return `The ${blast.date.slice(0, 4)} BLAST paper has ${exact(blast.citedBy)} citing records in PubMed`;
};

const history = (snap) => `${year(snap) - 1836} years from a $150 book budget`;

const growth = (snap) => {
  const best = snap.growth.map((d) => {
    const last = d.years.at(-1);
    const base = d.years.find((y) => y.year === last.year - 10);
    return { d, last, base, g: base && base.count >= 50 ? last.count / base.count : 0 };
  }).sort((a, b) => b.g - a.g)[0];
  return `${best.d.label} added ${fold(best.g)} times as many records in ${best.last.year} as in ${best.base.year}`;
};

const access = (snap) => {
  const free = snap.access.find((a) => a.id === 'free').years.at(-1);
  const total = snap.pubmed.years.find((y) => y.year === free.year).count;
  return `${pct(free.count / total)} of PubMed records dated ${free.year} are free to read`;
};

const geography = (snap) => {
  const yr = Math.max(...Object.keys(snap.countries[0].counts).map(Number));
  const top = snap.countries.reduce((a, b) => (b.counts[yr] > a.counts[yr] ? b : a));
  return `Authors in ${top.name} appear on ${exact(top.counts[yr])} records dated ${yr}, the most of ${snap.countries.length} countries checked`;
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

const at = (years, when) => years.find((y) => y.year === when)?.count ?? 0;

const vocab = (snap) => {
  const v = snap.vocab;
  const total = (when) => at(v.totals, when);
  const best = v.words.map((w) => {
    const base = at(w.years, v.base) / total(v.base);
    const peak = w.years.filter((y) => y.year < v.partial).reduce((a, b) => (b.count / total(b.year) > a.count / total(a.year) ? b : a));
    return { w, peak, g: at(w.years, v.base) >= 50 ? peak.count / total(peak.year) / base : 0 };
  }).sort((a, b) => b.g - a.g)[0];
  return `‘${best.w.label}’ appeared ${fold(best.g)} times as often in ${best.peak.year} abstracts as in ${v.base}`;
};

const zombies = (snap) => {
  const top = snap.zombies.filter((z) => z.after !== null).reduce((a, b) => (b.after > a.after ? b : a));
  return `${exact(top.after)} later records cite ${top.label}, retracted in ${top.retracted}`;
};

export const classicCounts = (snap) => snap.classics.map((c) => {
  const same = c.pmid && snap.papers?.find((p) => p.pmid === c.pmid);
  return same ? { ...c, citedBy: same.citedBy } : c;
});

const classics = (snap) => {
  const list = classicCounts(snap);
  const blast = list.find((c) => c.pmid === '2231712');
  const top = list.reduce((a, b) => (b.citedBy > a.citedBy ? b : a));
  if (!blast || top === blast) return `BLAST leads ${list.length} classic methods papers by citing records`;
  const [, rest] = top.label.split(', ');
  const born = rest.slice(-4);
  return `A ${born} ${rest.slice(0, -5)} paper has ${fold(top.citedBy / blast.citedBy)} times BLAST’s citing records`;
};

const extremes = (snap) => {
  const { fy, largest } = snap.extremes.awards;
  return largest.ic === 'NLM'
    ? `NIH’s largest FY${fy} award line is NLM’s own: $${compact(largest.dollars)}`
    : `NIH’s largest FY${fy} award line goes to ${largest.ic}: $${compact(largest.dollars)}`;
};

const subjects = (snap) => {
  const [mice, rats] = ['mice', 'rats'].map((id) => snap.subjects.animals.find((a) => a.id === id).years);
  const behind = mice.filter((y) => y.count <= at(rats, y.year));
  if (!behind.length) return `Mice have outnumbered rats in every year since ${mice[0].year}`;
  const last = behind.at(-1).year;
  const next = mice.find((y) => y.year > last);
  return next ? `Mice overtook rats in ${next.year}` : 'Rats still outnumber mice in PubMed';
};

const sex = (snap) => {
  const [women, men] = ['women', 'men'].map((id) => snap.subjects.sex.find((x) => x.id === id).years.at(-1).count);
  return women >= men
    ? `Women-only studies outnumber men-only studies ${fold(women / men)} to 1`
    : `Men-only studies outnumber women-only studies ${fold(men / women)} to 1`;
};

const outbreaks = (snap) => {
  const total = (when) => at(snap.pubmed.years, when);
  const best = snap.subjects.outbreaks.flatMap((o) => o.years.filter((y) => total(y.year)).map((y) => ({ o, y, share: y.count / total(y.year) })))
    .reduce((a, b) => (b.share > a.share ? b : a));
  return `In ${best.y.year}, 1 in ${Math.round(1 / best.share)} PubMed records mentioned ${best.o.label}`;
};

const stops = (snap) => {
  const s = snap.trialfate.stops;
  const top = s.reasons.reduce((a, b) => (b.count > a.count ? b : a));
  const what = top.id === 'enrollment' ? 'Slow enrollment' : top.label;
  return `${what} ends ${pct(top.count / s.total)} of terminated trials that give a reason`;
};

const lag = (snap) => {
  const l = snap.trialfate.lag;
  return l.peak === 11
    ? `${pct(l.months[11] / l.n)} of trial results arrive in the last month before the deadline`
    : `Trial results most often arrive ${l.peak} months after completion`;
};

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
  ...(snap.vocab ? { vocab: vocab(snap) } : {}),
  ...(snap.zombies ? { zombies: zombies(snap) } : {}),
  ...(snap.classics ? { classics: classics(snap) } : {}),
  ...(snap.extremes?.awards ? { extremes: extremes(snap) } : {}),
  ...(snap.subjects ? { subjects: subjects(snap), sex: sex(snap), outbreaks: outbreaks(snap) } : {}),
  ...(snap.trialfate ? { stops: stops(snap), lag: lag(snap) } : {}),
});
