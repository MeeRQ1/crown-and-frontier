// Government (format 9): the form of government, the head of government and the
// nations a realm may form. All of it reaches the rules through one path — the
// modifier sources (modifiers.ts) — so what the interface shows is what applies, and
// player and AI realms follow the same eligibility, costs and waits.
//
//  - Forms of government (five) trade strengths for costs and suit different
//    strategies: consolidation (monarchy), trade and research (democracy), a cheap
//    army (authoritarian), conquest by claims at a diplomatic cost (fascism), industry
//    at the expense of commerce (communism). A change costs four months of income,
//    a year of unrest and slower research, needs peace, and then ten years' wait;
//    fascism and communism exist only from their historical dates.
//  - The head of government has one trait with a strength and a cost. A successor
//    comes by the rules of the government (elections every five years in a
//    democracy, otherwise a long tenure); the realm may replace the head early at a
//    price, once in three years. Names are generated, not historical.
//  - Formable nations: a realm that owns and holds the land of the realms a nation
//    unites (as the scenario's map gives it at the start) may proclaim it once a
//    campaign. The new name, colours and modest lasting effects apply; nothing is
//    annexed by it, no technology or force is lost, and every reference (armies,
//    treaties, operations, saves) keeps the realm's id.

import { grossIncome } from './economy';
import type { ModEffects, ModSource } from './modifiers';
import { aliveNations, borders, dateOf, enemiesOf, months, nationName, notify, provName, type Sim } from './state';
import type { FormableId, IdeologyId, Leader, LeaderTrait, NationId, ProvinceId } from './types';

// ───────────────────────────── Forms of government ──────────────────────────

export interface IdeologyDef {
  id: IdeologyId;
  label: string;
  /** what it is for, one line */
  strategy: string;
  effects: ModEffects;
  /** the earliest year it exists; before it, choosing it is not possible */
  fromYear: number;
}

export const IDEOLOGIES: Record<IdeologyId, IdeologyDef> = {
  monarchy: {
    id: 'monarchy',
    label: 'Constitutional monarchy',
    strategy: 'Stability: new provinces settle and integrate faster and unrest stays lower; the court and nobility cost a little income.',
    effects: { integration: 0.15, unrest: -3, trustGain: 0.15, income: -0.03 },
    fromYear: 0,
  },
  democracy: {
    id: 'democracy',
    label: 'Parliamentary democracy',
    strategy: 'Commerce, science and friends abroad; wars weary the public sooner and conscription is limited.',
    effects: { trade: 0.15, research: 0.05, relationGain: 0.2, alarmGen: -0.15, warExhaustion: 0.25, manpower: -0.1, claimCost: 0.25 },
    fromYear: 0,
  },
  authoritarian: {
    id: 'authoritarian',
    label: 'Authoritarian state',
    strategy: 'A large army for less; trade and goodwill abroad suffer.',
    effects: { manpower: 0.1, upkeep: -0.08, unrest: -2, trade: -0.1, opinion: -5 },
    fromYear: 0,
  },
  fascism: {
    id: 'fascism',
    label: 'Fascist dictatorship',
    strategy: 'Expansion by claims and mass mobilisation; neighbours are alarmed, trade and friendships suffer.',
    effects: { manpower: 0.15, claimCost: -0.3, moraleRecovery: 0.1, alarmGen: 0.3, trade: -0.15, opinion: -10, relationGain: -0.2 },
    fromYear: 1922,
  },
  communism: {
    id: 'communism',
    label: 'Communist state',
    strategy: 'Planned industry: factories cheaper and more productive; commerce and private income shrink, others distrust it.',
    effects: { industry: 0.1, factoryCost: -0.15, manpower: 0.05, income: -0.08, trade: -0.2, opinion: -5 },
    fromYear: 1917,
  },
};

export const IDEOLOGY_IDS = Object.keys(IDEOLOGIES) as IdeologyId[];
export const IDEOLOGY_WAIT_WEEKS = 520;

/** The government a realm starts with: its historical form where the scenario's date gives one, otherwise by era. */
const STARTING: Record<string, Partial<Record<string, IdeologyId>>> = {
  // 1910s: most of Europe crowned; republics in France, Switzerland, Portugal, the Americas
  early: { fra: 'democracy', swi: 'democracy', por: 'democracy', usa: 'democracy', rus: 'authoritarian', ott: 'authoritarian', per: 'authoritarian', chn: 'authoritarian', jap: 'monarchy', mex: 'authoritarian' },
  // 1936
  late: {
    ger: 'fascism', ita: 'fascism', sov: 'communism', fra: 'democracy', gbr: 'democracy', irl: 'democracy', usa: 'democracy', ned: 'democracy', bel: 'democracy', lux: 'democracy', swi: 'democracy', swe: 'democracy', nor: 'democracy', den: 'democracy', fin: 'democracy', cze: 'democracy', spa: 'democracy',
    pol: 'authoritarian', hun: 'authoritarian', aut: 'authoritarian', por: 'authoritarian', gre: 'authoritarian', tur: 'authoritarian', est: 'authoritarian', lat: 'authoritarian', lit: 'authoritarian', jap: 'authoritarian', chn: 'authoritarian', irn: 'authoritarian', bra: 'authoritarian',
    rom: 'monarchy', yug: 'monarchy', bul: 'monarchy', alb: 'monarchy', egy: 'monarchy', irq: 'monarchy',
  },
};

export function startingIdeology(sim: Sim, nid: NationId): IdeologyId {
  const year = sim.world.scenario.startYear;
  const table = year >= 1925 ? STARTING.late : year >= 1905 ? STARTING.early : {};
  return table[nid] ?? (year >= 1925 ? 'democracy' : 'monarchy');
}

export function ideologyOf(sim: Sim, nid: NationId): IdeologyId {
  return sim.state.nations[nid].ideology?.id ?? startingIdeology(sim, nid);
}

/** What a change of government costs now (crowns). */
export function ideologyCost(sim: Sim, nid: NationId): number {
  return Math.round(Math.max(50, grossIncome(sim.state.nations[nid].lastMonth) * 4));
}

export function ideologyProblem(sim: Sim, nid: NationId, id: IdeologyId): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const def = IDEOLOGIES[id];
  if (!def) return 'Unknown form of government.';
  if (ideologyOf(sim, nid) === id) return `We already are a ${def.label.toLowerCase()}.`;
  const year = dateOf(sim).year;
  if (year < def.fromYear) return `${def.label} does not exist before ${def.fromYear}.`;
  if (enemiesOf(sim, nid).length > 0) return 'Not while at war: a change of government needs peace.';
  const since = n.ideology?.since ?? -IDEOLOGY_WAIT_WEEKS;
  if (st.tick - since < IDEOLOGY_WAIT_WEEKS && n.ideology) return `The last change was in ${dateOf(sim, since).year}: another is possible from ${dateOf(sim, since + IDEOLOGY_WAIT_WEEKS).label}.`;
  const cost = ideologyCost(sim, nid);
  if (n.treasury < cost) return `Needs ${cost} crowns (treasury ${Math.floor(n.treasury)}).`;
  return null;
}

export function setIdeology(sim: Sim, nid: NationId, id: IdeologyId): string {
  const st = sim.state;
  const n = st.nations[nid];
  const was = ideologyOf(sim, nid);
  n.treasury -= ideologyCost(sim, nid);
  n.ideology = { id, since: st.tick };
  // a year of upheaval: unrest and slower research (a timed effect, shown with its end)
  n.modifiers.push({ id: `gov${st.tick}`, label: 'Change of government', until: st.tick + months(12), effects: { unrestAdd: 8, researchMul: -0.1 } });
  // a new government brings a new head of government
  n.leader = newLeader(sim, nid, n.leader?.trait ?? 'administrator', 'change');
  notify(sim, null, 'normal', 'government', `${nationName(sim, nid)}: ${IDEOLOGIES[was].label} gives way to ${IDEOLOGIES[id].label.toLowerCase()}.`);
  return `${IDEOLOGIES[id].label} proclaimed. A year of upheaval follows (unrest +8, research −10%); the next change is possible in ten years.`;
}

// ───────────────────────────── Head of government ───────────────────────────

export const LEADER_TRAITS: Record<LeaderTrait, { label: string; effects: ModEffects; summary: string }> = {
  reformer: { label: 'Reformer', effects: { devCost: -0.1, infraCost: -0.1, unrest: 1 }, summary: 'Development and railways 10% cheaper; reforms unsettle (+1 unrest).' },
  industrialist: { label: 'Industrialist', effects: { industry: 0.05, factoryCost: -0.1, factoryCoal: 0.1 }, summary: 'Industry +5%, factories 10% cheaper; they burn 10% more coal.' },
  diplomat: { label: 'Diplomat', effects: { relationGain: 0.25, envoys: 1, manpower: -0.05 }, summary: 'Relations improve 25% faster, one more envoy; the reserve is 5% smaller.' },
  militarist: { label: 'Militarist', effects: { manpower: 0.08, moraleRecovery: 0.1, alarmGen: 0.15, upkeep: 0.05 }, summary: 'Reserve +8%, morale recovers 10% faster; conquests alarm 15% more and upkeep costs 5% more.' },
  financier: { label: 'Financier', effects: { income: 0.04, trade: 0.1, upkeep: 0.05 }, summary: 'Income +4%, trade agreements +10%; the army costs 5% more to keep.' },
  administrator: { label: 'Administrator', effects: { integration: 0.15, adminCapacity: 2, income: -0.02 }, summary: 'Integration 15% faster, administrative capacity +2; income −2%.' },
};
export const LEADER_TRAIT_IDS = Object.keys(LEADER_TRAITS) as LeaderTrait[];

const FIRST = ['Albert', 'Anton', 'Carl', 'Edvard', 'Emil', 'Ferenc', 'Georg', 'Henrik', 'Ivan', 'Jan', 'Józef', 'Karl', 'László', 'Leon', 'Ludwig', 'Marcel', 'Mihai', 'Nikola', 'Oskar', 'Paul', 'Pedro', 'Pierre', 'Stefan', 'Tomás', 'Viktor', 'Walter'];
const LAST = ['Adler', 'Bauer', 'Berger', 'Carvalho', 'Dumont', 'Esterházy', 'Falk', 'Gruber', 'Halvorsen', 'Ionescu', 'Janssen', 'Kovač', 'Lindqvist', 'Marek', 'Moreau', 'Novák', 'Olsen', 'Petrov', 'Reiner', 'Santos', 'Szabó', 'Vidal', 'Weiss', 'Winter', 'Zelenko'];

/** A stable small hash (no game randomness is drawn for names). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function generatedName(seed: string): string {
  const h = hash(seed);
  return `${FIRST[h % FIRST.length]} ${LAST[(h >>> 8) % LAST.length]}`;
}

function newLeader(sim: Sim, nid: NationId, trait: LeaderTrait, why: string): Leader {
  return { name: generatedName(`${nid}|${sim.state.tick}|${why}`), trait, since: sim.state.tick, generated: true };
}

/** The head of government a realm starts with: a trait that suits its national character. */
export function startingLeader(sim: Sim, nid: NationId): Leader {
  const t = sim.world.nationDefs[nid]?.traits ?? {};
  const trait: LeaderTrait = (t.tradeMul ?? 0) > 0 || (t.incomeMul ?? 0) > 0 ? 'financier' : (t.manpowerMul ?? 0) > 0 || (t.moraleAdd ?? 0) > 0 ? 'militarist' : (t.integrationMul ?? 0) > 0 ? 'administrator' : (t.researchMul ?? 0) > 0 ? 'reformer' : (t.envoyAdd ?? 0) > 0 || (t.opinionAdd ?? 0) > 0 ? 'diplomat' : LEADER_TRAIT_IDS[hash(nid) % LEADER_TRAIT_IDS.length];
  return { name: generatedName(`${nid}|start`), trait, since: 0, generated: true };
}

export function leaderOf(sim: Sim, nid: NationId): Leader {
  return sim.state.nations[nid].leader ?? startingLeader(sim, nid);
}

export const LEADER_WAIT_WEEKS = 156;

export function replaceLeaderCost(sim: Sim, nid: NationId): number {
  return Math.round(Math.max(30, grossIncome(sim.state.nations[nid].lastMonth) * 3));
}

export function replaceLeaderProblem(sim: Sim, nid: NationId, trait: LeaderTrait): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  if (!LEADER_TRAITS[trait]) return 'Unknown trait.';
  const cur = leaderOf(sim, nid);
  if (cur.trait === trait) return `${cur.name} is already a ${LEADER_TRAITS[trait].label.toLowerCase()}.`;
  if (st.tick - cur.since < LEADER_WAIT_WEEKS && n.leader) return `${cur.name} took office in ${dateOf(sim, cur.since).year}: a replacement is possible from ${dateOf(sim, cur.since + LEADER_WAIT_WEEKS).label}.`;
  const cost = replaceLeaderCost(sim, nid);
  if (n.treasury < cost) return `Needs ${cost} crowns (treasury ${Math.floor(n.treasury)}).`;
  return null;
}

export function replaceLeader(sim: Sim, nid: NationId, trait: LeaderTrait): string {
  const st = sim.state;
  const n = st.nations[nid];
  const was = leaderOf(sim, nid);
  n.treasury -= replaceLeaderCost(sim, nid);
  n.leader = newLeader(sim, nid, trait, 'replace');
  n.modifiers.push({ id: `lead${st.tick}`, label: 'Change of leadership', until: st.tick + months(6), effects: { unrestAdd: 4 } });
  return `${was.name} steps down; ${n.leader.name} (${LEADER_TRAITS[trait].label.toLowerCase()}) takes office. Unrest +4 for six months.`;
}

/** Monthly: a head of government's term ends by the rules of the government (elections, long tenure). */
export function monthlyLeaders(sim: Sim): void {
  const st = sim.state;
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    const cur = leaderOf(sim, nid);
    const term = ideologyOf(sim, nid) === 'democracy' ? 5 * 52 : (12 + (hash(`${nid}|${cur.name}`) % 9)) * 52;
    if (st.tick - cur.since < term || st.tick < 52) continue;
    // an election (or a successor): the trait follows the times — the realm's needs at war, else the national character
    const trait: LeaderTrait = enemiesOf(sim, nid).length > 0 ? 'militarist' : n.lastMonth.net < 0 ? 'financier' : startingLeader(sim, nid).trait;
    n.leader = newLeader(sim, nid, trait, 'term');
    notify(sim, nid, 'normal', 'government', `${ideologyOf(sim, nid) === 'democracy' ? 'Elections' : 'A change of leadership'}: ${n.leader.name} (${LEADER_TRAITS[trait].label.toLowerCase()}) succeeds ${cur.name}. ${LEADER_TRAITS[trait].summary}`);
  }
}

// ───────────────────────────── Formable nations ─────────────────────────────

export interface FormableDef {
  id: FormableId;
  name: string;
  short: string;
  adjective: string;
  color: string;
  /** realms that may proclaim it */
  formers: NationId[];
  /** realms whose starting land (on this map) it unites */
  cores: NationId[];
  /** further regions it needs, where the map has them */
  regions?: string[];
  /** realms that, present at the start, mean it already exists (it cannot be formed) */
  existsAs?: NationId[];
  fromYear: number;
  summary: string;
  effects: ModEffects;
}

export const FORMABLES: Record<FormableId, FormableDef> = {
  'austria-hungary': {
    id: 'austria-hungary',
    name: 'Austro-Hungarian Monarchy',
    short: 'Austria-Hungary',
    adjective: 'Austro-Hungarian',
    color: '#d8c27a',
    formers: ['aut', 'hun'],
    cores: ['aut', 'hun'],
    existsAs: ['aus'],
    fromYear: 1919,
    summary: 'The Dual Monarchy restored: Vienna and Budapest under one crown. Its many peoples give a larger reserve and practice at integration, and some unrest.',
    effects: { manpower: 0.05, integration: 0.1, unrest: 2 },
  },
  scandinavia: {
    id: 'scandinavia',
    name: 'Scandinavian Union',
    short: 'Scandinavia',
    adjective: 'Scandinavian',
    color: '#7fa7c9',
    formers: ['swe', 'nor', 'den'],
    cores: ['swe', 'nor', 'den'],
    fromYear: 0,
    summary: 'The three northern crowns in one union: shared fleets and merchant marine.',
    effects: { trade: 0.08, navalAttack: 0.05, unrest: 1 },
  },
  iberia: {
    id: 'iberia',
    name: 'Iberian Union',
    short: 'Iberia',
    adjective: 'Iberian',
    color: '#c98f5a',
    formers: ['spa', 'por'],
    cores: ['spa', 'por'],
    fromYear: 0,
    summary: 'Spain and Portugal united, as under the Habsburgs: one Atlantic coast and one market.',
    effects: { trade: 0.05, shipCost: -0.05, unrest: 1 },
  },
  yugoslavia: {
    id: 'yugoslavia',
    name: 'Kingdom of Yugoslavia',
    short: 'Yugoslavia',
    adjective: 'Yugoslav',
    color: '#8a9ec7',
    formers: ['ser', 'mon'],
    cores: ['ser', 'mon'],
    regions: ['croatia', 'dalmatia', 'bosnia', 'carniola', 'bosniaherzegovinaandcroatiaslavonia'],
    existsAs: ['yug'],
    fromYear: 0,
    summary: 'The South Slavs in one kingdom: Serbia with Croatia, Bosnia, Dalmatia and Slovenia. A larger reserve, and the strains of union.',
    effects: { manpower: 0.05, integration: 0.05, unrest: 2 },
  },
  baltic: {
    id: 'baltic',
    name: 'Baltic Federation',
    short: 'Baltic Federation',
    adjective: 'Baltic',
    color: '#9bb37d',
    formers: ['est', 'lat', 'lit'],
    cores: ['est', 'lat', 'lit'],
    fromYear: 0,
    summary: 'Estonia, Latvia and Lithuania in one federation: one defence and one port system.',
    effects: { defense: 0.05, trade: 0.05 },
  },
};

export const FORMABLE_IDS = Object.keys(FORMABLES) as FormableId[];

/** The provinces a formable needs on this map (the cores' starting land and the named regions). */
export function formableProvinces(sim: Sim, id: FormableId): ProvinceId[] {
  const f = FORMABLES[id];
  const cores = new Set(f.cores);
  const regions = new Set(f.regions ?? []);
  return sim.world.scenario.provinces.filter((p) => (p.owner && cores.has(p.owner)) || regions.has(p.region)).map((p) => p.id);
}

/** Formables that exist on this map for this realm at all (it may form them, and they are not already there). */
export function formablesFor(sim: Sim, nid: NationId): FormableId[] {
  const start = new Set(sim.world.scenario.nations.map((n) => n.id));
  return FORMABLE_IDS.filter((id) => {
    const f = FORMABLES[id];
    if (!f.formers.includes(nid) || !start.has(nid)) return false;
    if ((f.existsAs ?? []).some((x) => start.has(x))) return false;
    // needs at least one other core realm or region on this map: a realm cannot "form" its own land
    return formableProvinces(sim, id).some((p) => sim.world.scenario.provinces.find((q) => q.id === p)?.owner !== nid);
  });
}

export interface FormableCheck {
  ok: boolean;
  /** every condition, met or not */
  conditions: Array<{ text: string; met: boolean }>;
  /** required provinces we do not own and hold */
  missing: ProvinceId[];
  cost: number;
}

export function formCost(sim: Sim, id: FormableId): number {
  return Math.round(150 + 3 * formableProvinces(sim, id).length);
}

export function checkFormable(sim: Sim, nid: NationId, id: FormableId): FormableCheck {
  const st = sim.state;
  const n = st.nations[nid];
  const f = FORMABLES[id];
  const need = formableProvinces(sim, id);
  const missing = need.filter((p) => st.provinces[p].owner !== nid || st.provinces[p].controller !== nid);
  const share = need.length ? (need.length - missing.length) / need.length : 0;
  const capitals = f.cores.map((c) => sim.world.nationDefs[c]?.capital).filter((c): c is ProvinceId => !!c && need.includes(c));
  const capsHeld = capitals.filter((c) => st.provinces[c].owner === nid && st.provinces[c].controller === nid);
  const cost = formCost(sim, id);
  const takenBy = aliveNations(sim).find((o) => st.nations[o].formed?.id === id) ?? Object.keys(st.nations).find((o) => st.nations[o].formed?.id === id);
  const conditions = [
    { text: `${f.short} is not yet proclaimed in this campaign${takenBy ? ` (${nationName(sim, takenBy)} did)` : ''}`, met: !takenBy },
    { text: 'We have not proclaimed another nation', met: !n.formed },
    { text: `The year is ${f.fromYear || 'any'} or later`, met: dateOf(sim).year >= f.fromYear },
    { text: `We own and hold ${Math.round(share * 100)}% of the ${need.length} provinces (90% needed)`, met: share >= 0.9 },
    { text: `We own and hold the old capitals (${capsHeld.length} of ${capitals.length}: ${capitals.map((c) => provName(sim, c)).join(', ')})`, met: capsHeld.length === capitals.length },
    { text: 'At peace', met: enemiesOf(sim, nid).length === 0 },
    { text: `${cost} crowns (treasury ${Math.floor(n.treasury)})`, met: n.treasury >= cost },
  ];
  return { ok: formablesFor(sim, nid).includes(id) && conditions.every((c) => c.met), conditions, missing, cost };
}

export function formProblem(sim: Sim, nid: NationId, id: FormableId): string | null {
  if (!FORMABLES[id]) return 'Unknown nation.';
  if (!formablesFor(sim, nid).includes(id)) return `${FORMABLES[id].short} cannot be formed by us on this map.`;
  const c = checkFormable(sim, nid, id);
  const first = c.conditions.find((x) => !x.met);
  return first ? `Not yet: ${first.text.charAt(0).toLowerCase()}${first.text.slice(1)}.` : null;
}

export function formNation(sim: Sim, nid: NationId, id: FormableId): string {
  const st = sim.state;
  const n = st.nations[nid];
  const f = FORMABLES[id];
  const old = nationName(sim, nid);
  n.treasury -= formCost(sim, id);
  n.formed = { id, tick: st.tick };
  // the united land settles faster: provinces still foreign in spirit gain integration
  for (const p of formableProvinces(sim, id)) {
    const s = st.provinces[p];
    if (s.owner === nid && s.integration < 60) s.integration = Math.min(60, s.integration + 20);
  }
  // neighbours take note
  for (const o of aliveNations(sim)) {
    if (o === nid || !borders(sim, nid, o)) continue;
    st.alarm[o] = { ...st.alarm[o], [nid]: (st.alarm[o]?.[nid] ?? 0) + 10 };
  }
  applyIdentities(sim);
  notify(sim, null, 'urgent', 'government', `${old} proclaims the ${f.name}.`);
  return `${f.name} proclaimed. ${f.summary}`;
}

/**
 * The names and colours shown for realms that formed a nation: the campaign's own view
 * of the map's realms (the shared map definition is never changed). Called when a
 * nation is formed and when a campaign is loaded.
 */
export function applyIdentities(sim: Sim): void {
  const formed = Object.values(sim.state.nations).filter((n) => n.formed);
  if (!formed.length) return;
  const defs = { ...sim.world.nationDefs };
  for (const n of formed) {
    const f = FORMABLES[n.formed!.id];
    const base = defs[n.id];
    if (!f || !base) continue;
    defs[n.id] = { ...base, name: f.name, short: f.short, adjective: f.adjective, color: f.color };
  }
  sim.world = { ...sim.world, nationDefs: defs };
}

/**
 * Gives every realm without them its starting government and head of government (a
 * new campaign, or one saved before format 9 had them); idempotent. A starting
 * government may be changed at once (the ten-year wait counts from a change).
 */
export function initGovernment(sim: Sim): void {
  for (const nid of Object.keys(sim.state.nations)) {
    const n = sim.state.nations[nid];
    n.ideology ??= { id: startingIdeology(sim, nid), since: -IDEOLOGY_WAIT_WEEKS };
    n.leader ??= { ...startingLeader(sim, nid), since: -LEADER_WAIT_WEEKS };
  }
}

// ───────────────────────────── Modifier sources ─────────────────────────────

/** The government's part of a realm's modifiers (see modifiers.ts modSources). */
export function governmentSources(sim: Sim, nid: NationId): ModSource[] {
  const n = sim.state.nations[nid];
  const out: ModSource[] = [];
  const ideo = IDEOLOGIES[ideologyOf(sim, nid)];
  out.push({ kind: 'ideology', label: ideo.label, effects: ideo.effects });
  if (n.formed) {
    const f = FORMABLES[n.formed.id];
    if (f) out.push({ kind: 'formed', label: `${f.short} (proclaimed)`, effects: f.effects });
  }
  const l = leaderOf(sim, nid);
  out.push({ kind: 'leader', label: `${l.name} (${LEADER_TRAITS[l.trait].label.toLowerCase()})`, effects: LEADER_TRAITS[l.trait].effects });
  return out;
}

