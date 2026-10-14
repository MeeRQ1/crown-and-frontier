// Strategic layer (monthly, staggered per realm): goal, budget, research,
// national focus, construction, diplomacy, war and peace. Utility scores with weights
// from the personality; commitment periods and improvement thresholds prevent
// oscillation; emergencies (being attacked, bankruptcy) interrupt plans.

import { C } from '../config';
import { PERSONALITIES, type PersonalityDef } from '../data/personalities';
import type { FocusTag } from '../data/focus';
import { TECH_LIST } from '../data/techs';
import { activeProjects, buildProblem, buildSlots, projectCost } from '../construction';
import { addMemory, claimsOn, coalitionAgainst, envoySlots, evaluateTreaty, fabricateProblem, memoriesOf, opinion, sharedThreat, treatyProblem } from '../diplomacy';
import { envoyCost, factoryCount, grossIncome, materielCap, poolCap, reserveCap, resourcePlan, totalDev, tradeValue } from '../economy';
import { memoWeek } from '../index';
import { overextension } from '../integration';
import { nationPotential, nationStrength } from '../military';
import { nationMods } from '../modifiers';
import { researchProblem, techAvailable, yearsEarly } from '../progression';
import { focusProblem, focusTree } from '../focus';
import {
  aliveNations,
  alliesOf,
  armiesOf,
  atWar,
  borders,
  dateOf,
  diag,
  nationDistance,
  enemiesOf,
  hasTreaty,
  months,
  nationName,
  ownedProvinces,
  provName,
  treatyPartners,
  truceUntil,
  warsOf,
  endTick,
  type Sim,
} from '../state';
import { supplyDistances } from '../supply';
import { fleetsOf } from '../naval';
import { warReach } from '../reach';
import type { NationId, PeaceTerms, ProjectKind, ProvinceId, TreatyType, VictoryPath, War, WarGoal } from '../types';
import { VICTORY_MONTHS, victoryProgress } from '../victory';
import { canJoin, evaluatePeace, goalOptions, termsCost } from '../war';
import { assessWar, warStanding } from '../assess';
import { buildSettlement, counterOffer, describeDemand, evaluateSettlement, settlementCost } from '../settlement';
import { aiRand, diffOf, issue } from './common';
import { coastalShare, navalStrategy, planInvasion } from './navy';
import { aiTrade } from './trade';
import { dependenceOn } from '../trade';
import {
  blocOf,
  foundBlocProblem,
  guaranteeProblem,
  guaranteesBy,
  guaranteeSlots,
  guarantorsOf,
  influenceOver,
  inviteProblem,
  joinProblem,
  loanProblem,
  sphereOf,
} from '../influence';

const AVG_UPKEEP = 1.45;
const AVG_SUPPLY = 0.62;

function pers(sim: Sim, nid: NationId): PersonalityDef {
  return PERSONALITIES[sim.state.nations[nid].ai.personality];
}

function regimentCount(sim: Sim, nid: NationId): number {
  let r = 0;
  for (const a of armiesOf(sim, nid)) r += a.regiments.length;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].recruits) if (o.nation === nid) r++;
  return r;
}

export function isThreatened(sim: Sim, nid: NationId): NationId | null {
  // a heuristic over every realm: assessed once a week, not after every command
  return memoWeek(sim, 'isThreatened', nid, () => threatOf(sim, nid));
}

function threatOf(sim: Sim, nid: NationId): NationId | null {
  const mine = Math.max(1, nationStrength(sim, nid));
  let worst: NationId | null = null;
  let worstRatio = 1.25;
  for (const o of aliveNations(sim)) {
    if (o === nid || hasTreaty(sim, 'alliance', o, nid)) continue;
    if (!borders(sim, nid, o)) continue;
    if (opinion(sim, o, nid) >= 10 && !atWar(sim, o, nid)) continue;
    const ratio = nationStrength(sim, o) / mine;
    if (ratio > worstRatio) {
      worstRatio = ratio;
      worst = o;
    }
  }
  if (coalitionAgainst(sim, nid)) return coalitionAgainst(sim, nid)!.members[0];
  return worst;
}

// ───────────────────────────── Budget ───────────────────────────────────────

function planBudget(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  const gross = Math.max(5, grossIncome(n.lastMonth));
  const war = warsOf(sim, nid).length > 0;
  const threat = isThreatened(sim, nid);
  let share = war ? p.armyBudget[1] : threat ? (p.armyBudget[0] + p.armyBudget[1]) / 2 : p.armyBudget[0];
  // rival about to win: arm up
  if (rivalLeader(sim, nid)) share = Math.max(share, (p.armyBudget[0] + p.armyBudget[1]) / 2);
  const goldCap = (gross * share) / AVG_UPKEEP;
  const mpCap = (reserveCap(sim, nid) * 0.75) / C.regimentSize;
  const supplyProd = Object.values(n.lastMonth.suppliesIn).reduce((a, b) => a + b, 0);
  const supplyCap = (supplyProd * 1.15) / AVG_SUPPLY;
  let target = Math.floor(Math.min(goldCap, mpCap, supplyCap));
  if (n.treasury < 0) target = Math.min(target, regimentCount(sim, nid) - 1);
  target = Math.max(3, target);
  if (Math.abs(target - n.ai.armyTarget) >= Math.max(2, n.ai.armyTarget * 0.15)) {
    // a marked change, with the binding limit, for the decision log
    const bound = n.treasury < 0 ? 'debt' : goldCap <= mpCap && goldCap <= supplyCap ? `crowns (${Math.round(share * 100)}% of ${gross.toFixed(0)} a month)` : mpCap <= supplyCap ? 'men (three quarters of the reserve)' : 'supplies';
    diag(sim, nid, 'strategic', `Army target ${n.ai.armyTarget} → ${target} regiments, limited by ${bound}`, [
      `Crowns allow ${Math.floor(goldCap)}, men ${Math.floor(mpCap)}, supplies ${Math.floor(supplyCap)}`,
      war ? 'At war' : threat ? `Threatened by ${nationName(sim, threat)}` : 'At peace',
    ]);
  }
  n.ai.armyTarget = target;
  // research funding follows the surplus
  const net = n.lastMonth.net;
  const nothingLeft = !n.research.current && !TECH_LIST.some((t) => techAvailable(sim, nid, t.id));
  const level: 0 | 1 | 2 | 3 = nothingLeft || n.treasury < 0 || net < 0 ? 0 : n.treasury > gross * 10 && net > gross * 0.3 ? 3 : net > gross * 0.25 && n.treasury > gross * 2 ? 2 : 1;
  if (level !== n.research.funding) issue(sim, { type: 'funding', nation: nid, level });
}

// ───────────────────────────── Research & national focus ────────────────────

function chooseResearch(sim: Sim, nid: NationId): void {
  const n = sim.state.nations[nid];
  if (n.research.current) return;
  const p = pers(sim, nid);
  const war = warsOf(sim, nid).length > 0 || !!isThreatened(sim, nid);
  const over = overextension(sim, nid) > 0;
  const shortSupplies = n.supplies < 20;
  const cands = TECH_LIST.filter((t) => !researchProblem(sim, nid, t.id));
  if (!cands.length) return;
  const short = new Set(n.shortages);
  const scored = cands.map((t) => {
    // older technologies first, and those ahead of their time only when cheap enough
    let s = p.research[t.branch] * (1.3 - 0.05 * t.era) / (1 + 0.15 * yearsEarly(sim, t.id));
    if (war && t.branch === 'land') s *= 1.3;
    if (over && ['civil_service', 'telegraph_network', 'mass_politics', 'planning_bureau'].includes(t.id)) s *= 1.5;
    if (shortSupplies && ['rail_logistics', 'refrigeration', 'rubber_plantations'].includes(t.id)) s *= 1.4;
    for (const r of short) if (TECH_HELPS[r]?.includes(t.id)) s *= 1.6;
    if (t.effects.industry || t.effects.factoryCost) s *= 1.15;
    if (t.unlocks) s *= 1.2;
    // a navy matters to coastal realms; aircraft are new arms worth having
    if (t.branch === 'naval') s *= 0.6 + coastalShare(sim, nid);
    if (t.branch === 'air' && t.unlocks) s *= 1.3;
    // flight is the gateway to the whole air branch
    if (t.id === 'aviation') s *= 1.8;
    if (n.ai.goal.victory === 'diplomatic' && t.branch === 'society' && (t.effects.opinion || t.effects.envoys)) s *= 1.3;
    if (n.ai.goal.victory === 'economic' && (t.branch === 'industry' || t.effects.integration)) s *= 1.2;
    s *= 1 + (aiRand(sim) - 0.5) * 0.2;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s || (a.t.id < b.t.id ? -1 : 1));
  let pick = scored[0];
  if (aiRand(sim) < diffOf(sim).mistake && scored.length > 1) pick = scored[Math.floor(aiRand(sim) * Math.min(3, scored.length))];
  issue(sim, { type: 'research', nation: nid, tech: pick.t.id });
  diag(sim, nid, 'strategic', `Research: ${pick.t.name}`, scored.slice(0, 3).map((x) => `${x.t.name} ${x.s.toFixed(2)}`));
}

/** Technologies that ease a shortage of each resource. */
const TECH_HELPS: Record<string, string[]> = {
  coal: ['deep_mining', 'turbines'],
  iron: ['bessemer', 'steel_mills'],
  oil: ['oil_refining', 'synthetic_fuel'],
  rubber: ['rubber_plantations', 'synthetic_rubber'],
  nitrates: ['chemical_industry', 'haber_process'],
};

/**
 * Chooses the next national focus when none is under way: each available focus
 * is scored by the temperament's weight for its branch and by how well its
 * tags fit the realm's situation (war, threat, coast, shortages, frontier load,
 * victory path); the national branch is preferred, and earlier rows first.
 */
function chooseFocus(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (n.focus.current) return;
  const p = pers(sim, nid);
  const war = warsOf(sim, nid).length > 0;
  const threat = !!isThreatened(sim, nid);
  const coast = coastalShare(sim, nid);
  const over = overextension(sim, nid) > 0;
  const victory = n.ai.goal.victory;
  const tagWeight: Record<FocusTag, number> = {
    economy: victory === 'economic' || p.id === 'commercial' ? 1.3 : 1,
    industry: n.shortages.includes('coal') || factoryCount(sim, nid) < 3 ? 1.3 : 1.05,
    war: war ? 1.5 : threat ? 1.25 : 0.9 + 0.1 * p.aggression,
    defence: threat || war ? 1.4 : p.id === 'defensive' ? 1.2 : 0.85,
    navy: 0.5 + coast,
    air: n.research.done.includes('aviation') ? 1.3 : 0.9,
    diplomacy: victory === 'diplomatic' ? 1.5 : p.id === 'diplomat' ? 1.3 : 0.9,
    admin: over ? 1.6 : 1,
    research: 1 + (p.research.society - 1) * 0.5,
    expansion: p.aggression >= 1 ? 1.1 + 0.2 * p.aggression : 0.7,
    trade: p.id === 'commercial' || victory === 'economic' ? 1.3 : 1,
  };
  const scored = focusTree(sim, nid)
    .filter((d) => !focusProblem(sim, nid, d.id))
    .map((d) => {
      let s = p.focus[d.branch];
      for (const t of d.tags) s *= tagWeight[t];
      s *= 1 - 0.06 * d.row;
      s *= 10 / (d.months + 2) / (10 / 12);
      // a claim on the richer region, and the ambition of our victory path
      if (d.template === 'claim') s *= 0.8 + Math.min(0.6, (d.provinces?.reduce((a, q) => a + st.provinces[q].dev, 0) ?? 0) / 40);
      if (d.template === 'ambition') s *= 1.3;
      // a doctrine that fits the temperament
      if (d.claimsOnly && (p.aggression >= 1 || n.ai.warPlan)) s *= 0.3;
      s *= 1 + (aiRand(sim) - 0.5) * 0.2;
      return { d, s };
    })
    .sort((a, b) => b.s - a.s || (a.d.id < b.d.id ? -1 : 1));
  if (!scored.length) return;
  let pick = scored[0];
  if (aiRand(sim) < diffOf(sim).mistake && scored.length > 1) pick = scored[Math.floor(aiRand(sim) * Math.min(3, scored.length))];
  issue(sim, { type: 'focus', nation: nid, focus: pick.d.id }, `Focus → ${pick.d.name}`);
}

// ───────────────────────────── Construction ─────────────────────────────────

function treasuryReserve(sim: Sim, nid: NationId): number {
  const n = sim.state.nations[nid];
  const exp = Object.values(n.lastMonth.expenses).reduce((a, b) => a + b, 0);
  // the army comes first: keep money for regiments still missing from the target
  const missing = Math.max(0, n.ai.armyTarget - regimentCount(sim, nid));
  return Math.max(30, exp * 2) + (warsOf(sim, nid).length ? 40 : 0) + Math.min(missing, 6) * 30;
}

function planConstruction(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  const econWeight = (n.ai.goal.victory === 'economic' ? 1.4 : 1) * (p.id === 'commercial' ? 1.2 : 1);
  const threat = isThreatened(sim, nid);
  let guard = 0;
  while (activeProjects(sim, nid).length < buildSlots(sim, nid) && guard++ < 4) {
    const budget = n.treasury - treasuryReserve(sim, nid);
    if (budget <= 20) return;
    const known = { slots: buildSlots(sim, nid), active: activeProjects(sim, nid).length };
    const plan = resourcePlan(sim, nid);
    const pendingFactories = activeProjects(sim, nid).filter((q) => st.provinces[q].project?.kind === 'factory').length;
    const factoriesNow = factoryCount(sim, nid);
    const cands: Array<{ pid: ProvinceId; kind: ProjectKind; v: number }> = [];
    let forts = 0;
    for (const pid of ownedProvinces(sim, nid)) forts += st.provinces[pid].fort;
    const owned = ownedProvinces(sim, nid);
    // the navy needs a port; aircraft need airfields (counting those being built)
    const building = (k: ProjectKind) => activeProjects(sim, nid).filter((q) => st.provinces[q].project?.kind === k).length;
    const ports = owned.filter((q) => st.provinces[q].port > 0).length + building('port');
    const coastShare = owned.filter((q) => sim.world.provZones[q]).length / Math.max(1, owned.length);
    const fields = owned.filter((q) => st.provinces[q].airfield > 0).length + building('airfield');
    const wantFields = n.research.done.includes('aviation') ? Math.min(3, 1 + Math.floor(owned.length / 14)) : 0;
    // anti-aircraft batteries where enemy aircraft fly over us, or could: factories, airfields, the capital
    const airDefence = n.research.done.includes('air_defence');
    let enemyStrike = 0;
    const overUs = new Set<ProvinceId>();
    if (airDefence) {
      for (const id of Object.keys(st.wings)) {
        const w = st.wings[id];
        if (!atWar(sim, nid, w.nation)) continue;
        if (w.type === 'bomber' || w.type === 'attack') enemyStrike++;
        if (w.target && (w.mission === 'bombing' || w.mission === 'interdiction' || w.mission === 'support')) {
          overUs.add(w.target);
          if (w.mission !== 'bombing') for (const q of sim.world.prov[w.target].neighbors) overUs.add(q);
        }
      }
    }
    for (const pid of owned) {
      const pr = st.provinces[pid];
      if (pr.controller !== nid || pr.project) continue;
      const def = sim.world.prov[pid];
      const border = def.neighbors.some((nb) => st.provinces[nb].owner && st.provinces[nb].owner !== nid);
      const hostileBorder = def.neighbors.some((nb) => {
        const o = st.provinces[nb].owner;
        return !!o && o !== nid && (atWar(sim, nid, o) || opinion(sim, o, nid) < -10 || o === threat);
      });
      for (const kind of ['dev', 'infra', 'factory', 'fort', 'charter', 'port', 'airfield', 'flak'] as ProjectKind[]) {
        if (kind === 'flak' && (!airDefence || (!enemyStrike && !overUs.has(pid)))) continue;
        if (kind === 'port' && (!sim.world.provZones[pid] || (ports > 0 && !(pr.port > 0 && pr.port < 2 && coastShare > 0.4)))) continue;
        if (kind === 'airfield' && (fields >= wantFields || pr.airfield > 0)) continue;
        if (buildProblem(sim, nid, pid, kind, known)) continue;
        const cost = projectCost(sim, nid, pid, kind).crowns;
        if (cost > budget) continue;
        let v = 0;
        if (kind === 'dev') v = ((1.3 * (0.25 + 0.75 * pr.integration / 100)) / cost) * 100 * econWeight;
        if (kind === 'infra') v = ((((100 - pr.integration) / 100) * 1.2 + (border ? 0.3 : 0) + pr.dev * 0.05) / cost) * 100;
        if (kind === 'factory') {
          // industry needs coal: a new factory only when the realm's own coal (and half its
          // imports, which can dry up) feeds it after the factories already being built;
          // a realm without coal still keeps a small industrial base
          const coalMargin = plan.produced.coal + 0.5 * n.lastMonth.resources.coal.imported - plan.need.coal - pendingFactories * C.industry.coalPerFactory;
          const fuelled = !n.shortages.includes('coal') && coalMargin >= C.industry.coalPerFactory * 1.2;
          const smallBase = factoriesNow + pendingFactories < 2 + Math.floor(owned.length / 6);
          if (!fuelled && !smallBase) continue;
          const coal = fuelled ? 1 : C.industry.unpowered;
          // a realm with no industry at all makes no materiel: its first factory comes first
          const none = factoriesNow + pendingFactories === 0 ? 4 : 1;
          const wantMateriel = n.materiel < materielCap(sim, nid) * 0.5 ? 1.3 : 1;
          v = ((2.2 * (0.25 + 0.75 * pr.integration / 100) * coal * wantMateriel * none) / cost) * 100 * (p.id === 'commercial' || n.ai.goal.victory === 'economic' ? 1.2 : 1);
        }
        if (kind === 'port') v = ports === 0 ? ((3 * (pr.dev + 2)) / cost) * 100 : ((0.6 * coastShare) / cost) * 100;
        if (kind === 'airfield') v = ((2.5 * (n.capital === pid ? 2 : 1) * (border ? 1.4 : 1) * (pr.dev + 2) * 0.3) / cost) * 100;
        if (kind === 'flak') {
          // worth guarding: industry, airfields, the capital; more so under the bombs now
          const worth = pr.factories * 1.5 + (pr.airfield > 0 ? 3 : 0) + (n.capital === pid ? 3 : 0) + pr.dev * 0.2;
          const pressure = overUs.has(pid) ? 3 : Math.min(1.5, enemyStrike * 0.3);
          v = ((worth * pressure * (1 - (pr.aa ?? 0) / (C.construction.flakMax + 1))) / cost) * 100;
        }
        if (kind === 'charter') v = pr.integration < 60 ? (((60 - pr.integration) / 60) * (pr.dev + 2) * 0.6 / cost) * 100 * (n.ai.goal.victory === 'territorial' ? 1.3 : 1) : 0;
        if (kind === 'fort') {
          if (!hostileBorder || forts >= 1 + (owned.length * p.fortLove) / 4 + (n.treasury > grossIncome(n.lastMonth) * 12 ? 2 : 0)) continue;
          const choke = def.neighbors.length <= 3 ? 1.5 : 1;
          const capital = n.capital === pid ? 1.5 : 1;
          v = ((p.fortLove * (pr.dev + 2) * choke * capital) / 5 / cost) * 100;
        }
        if (v > 0) cands.push({ pid, kind, v });
      }
    }
    for (const pid of sim.world.provIds) {
      if (st.provinces[pid].owner || buildProblem(sim, nid, pid, 'settle', known)) continue;
      const cost = projectCost(sim, nid, pid, 'settle').crowns;
      if (cost > budget) continue;
      const res = sim.world.prov[pid].resource ? 0.5 : 0;
      cands.push({ pid, kind: 'settle', v: ((p.settle * (2 + res)) / cost) * 100 });
    }
    if (!cands.length) return;
    cands.sort((a, b) => b.v - a.v || (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : a.kind < b.kind ? -1 : 1));
    let pick = cands[0];
    if (aiRand(sim) < diffOf(sim).mistake) pick = cands[Math.floor(aiRand(sim) * Math.min(4, cands.length))];
    const r = issue(sim, { type: 'build', nation: nid, province: pick.pid, project: pick.kind });
    if (!r.ok) return;
  }
}

// ───────────────────────────── Diplomacy ────────────────────────────────────

/**
 * Why a realm wants a treaty with another, in words it can give them, or null.
 *   alliance  a realm both have reason to fear; an enemy both are fighting; a threat
 *             to us that they stand next to (for realms that seek allies); a lasting
 *             friendship (for realms seeking diplomatic leadership)
 *   nap       the realm that threatens us; a stronger neighbour (for cautious realms);
 *             a neighbour whose border should stay quiet while our armies are needed
 *             against someone else
 *   trade     the commerce it would bring
 * The recipient judges the treaty by its own interests (diplomacy.evaluateTreaty).
 */
export function treatyMotive(sim: Sim, nid: NationId, other: NationId, type: TreatyType): string | null {
  // asked for every pair of realms each month (proposals, envoys): once a week, and never for a treaty already signed
  if (hasTreaty(sim, type, nid, other)) return null;
  return memoWeek(sim, 'treatyMotive', `${nid}|${other}|${type}`, () => motive(sim, nid, other, type));
}

function motive(sim: Sim, nid: NationId, other: NationId, type: TreatyType): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  if (n.ai.warPlan?.target === other) return null;
  if (type === 'trade') {
    if (p.treaty.trade < 0.6) return null;
    const v = memoWeek(sim, 'tradeValue', `${nid}|${other}`, () => tradeValue(sim, nid, other));
    return v > 1.5 ? `trade between us would bring us about ${v.toFixed(1)} crowns a month` : null;
  }
  if (type === 'alliance') {
    if (alliesOf(sim, nid).length >= (p.treaty.alliance >= 1.1 ? 4 : 3)) return null;
    if (nationDistance(sim, nid, other) > 2) return null;
    const shared = sharedThreat(sim, nid, other);
    if (shared) return `we both have reason to fear ${nationName(sim, shared)}`;
    const common = enemiesOf(sim, nid).find((e) => atWar(sim, other, e));
    if (common) return `we are both at war with ${nationName(sim, common)}`;
    const threat = isThreatened(sim, nid);
    if (threat && threat !== other && p.treaty.alliance >= 0.9 && nationDistance(sim, other, threat) <= 1) return `${nationName(sim, threat)} threatens us, and you stand next to it`;
    if (n.ai.goal.victory === 'diplomatic' && opinion(sim, nid, other) > 20) return 'our friendship has lasted and should be bound';
    return null;
  }
  const threat = isThreatened(sim, nid);
  if (threat === other) return 'your strength on our border alarms us, and a pact would end the danger';
  if (!borders(sim, nid, other)) return null;
  const mine = Math.max(0.5, nationStrength(sim, nid));
  const theirs = nationStrength(sim, other);
  if (p.treaty.nap >= 1.2 && theirs > mine * 1.2) return 'you are the stronger neighbour, and a pact keeps the peace between us';
  // our armies are needed elsewhere: quiet the border with a neighbour that could strike
  const busy = n.ai.warPlan?.target ?? enemiesOf(sim, nid)[0] ?? null;
  if (busy && busy !== other && theirs >= mine * 0.4 && !hasTreaty(sim, 'alliance', other, busy) && !atWar(sim, other, busy)) return `our armies are needed against ${nationName(sim, busy)}, and a pact keeps this border quiet`;
  return null;
}

function wantsTreaty(sim: Sim, nid: NationId, other: NationId, type: TreatyType): boolean {
  return treatyMotive(sim, nid, other, type) !== null;
}

export function diplomacy(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  const others = aliveNations(sim).filter((o) => o !== nid);
  // proposals: at most one per month
  const order: TreatyType[] = n.ai.goal.victory === 'diplomatic' ? ['trade', 'alliance', 'nap'] : ['alliance', 'nap', 'trade'];
  let proposed = false;
  for (const type of order) {
    if (proposed) break;
    for (const o of others) {
      if (treatyProblem(sim, nid, o, type)) continue;
      const key = `${o}:${type}`;
      const last = n.ai.lastProposal[key] ?? -1e9;
      const isPlayer = st.nations[o].isPlayer;
      if (st.tick - last < months(isPlayer ? 18 : 6)) continue;
      const reason = treatyMotive(sim, nid, o, type);
      if (!reason) continue;
      // a refusal is remembered: the same request for the same reason waits a year or
      // two (by temperament); a new reason may be put after the usual pause
      const ans = n.ai.treatyAnswers[key];
      if (ans && !ans.accepted && ans.reason === reason && st.tick - ans.tick < months((isPlayer ? 24 : 12) * p.patience)) continue;
      if (isPlayer) {
        // do not flood a human: nothing in the first three months of a campaign (let them
        // find their feet), then one open proposal at a time, at most one every 3 months
        if (st.tick < months(3)) continue;
        const inbox = st.nations[o].ai.lastProposal['__incoming'] ?? -1e9;
        if (st.proposals.some((x) => x.to === o) || st.tick - inbox < months(3)) continue;
      }
      // our own interest, by the rules the recipient applies
      if (!evaluateTreaty(sim, o, nid, type).accept) continue;
      n.ai.lastProposal[key] = st.tick;
      if (!isPlayer) {
        // sounded out through our ministers before a formal offer
        const ev = evaluateTreaty(sim, nid, o, type);
        if (!ev.accept) {
          n.ai.treatyAnswers[key] = { tick: st.tick, accepted: false, reason };
          if (type !== 'trade') {
            const top = [...ev.reasons].sort((a, b) => a.value - b.value).slice(0, 3).map((r) => `${r.label}: ${r.value}`);
            diag(sim, nid, 'strategic', `Sounded out ${nationName(sim, o)} on a ${type} (${reason}): they would refuse`, top);
          }
          continue;
        }
      } else st.nations[o].ai.lastProposal['__incoming'] = st.tick;
      const r = issue(sim, { type: 'propose', nation: nid, target: o, treaty: type, reason });
      if (!isPlayer) n.ai.treatyAnswers[key] = { tick: st.tick, accepted: r.ok, reason };
      diag(sim, nid, 'strategic', `Proposed ${type} to ${nationName(sim, o)} (${reason}): ${r.ok ? r.message ?? 'ok' : 'declined'}`);
      proposed = true;
      break;
    }
  }
  reviewAlliances(sim, nid);
  influencePolicy(sim, nid);
  // envoys toward nations we want as partners, or into our sphere
  // envoys only as many as the realm can keep: about a tenth of its income
  const sent = st.envoys.filter((e) => e.from === nid).length;
  const affordable = Math.max(n.lastMonth.net > 0 ? 1 : 0, Math.floor((0.1 * grossIncome(n.lastMonth)) / envoyCost(sim, nid)));
  const free = Math.min(envoySlots(sim, nid), affordable) - sent;
  const sphereMinded = n.ai.goal.victory === 'diplomatic' || pers(sim, nid).id === 'diplomat' || pers(sim, nid).id === 'commercial';
  const myDev = totalDev(sim, nid);
  if (free > 0 && n.treasury > 20) {
    const targets = others
      .filter((o) => !atWar(sim, nid, o) && !st.envoys.some((e) => e.from === nid && e.to === o) && n.ai.warPlan?.target !== o)
      .map((o) => {
        const op = opinion(sim, o, nid);
        let v = 0;
        if (wantsTreaty(sim, nid, o, 'alliance')) v += 3;
        if (wantsTreaty(sim, nid, o, 'trade')) v += 1.5;
        if (n.ai.goal.victory === 'diplomatic') {
          v += 2;
          // a partner that counts toward leadership but whose opinion of us sits near the bar
          if (op < C.victory.diplomaticOpinion + 10 && (hasTreaty(sim, 'alliance', nid, o) || hasTreaty(sim, 'trade', nid, o) || sphereOf(sim, o) === nid)) v += 3;
        }
        if (isThreatened(sim, nid) === o) v += 2;
        // a smaller realm we could draw into our sphere
        if (sphereMinded && totalDev(sim, o) < myDev * 0.7 && !sphereOf(sim, o) && influenceOver(sim, nid, o) < C.influence.sphere * 1.3) v += 1.5;
        if (op >= 50 && !(sphereMinded && influenceOver(sim, nid, o) < C.influence.sphere)) v -= 3;
        return { o, v: v - op / 50 };
      })
      .filter((x) => x.v > 1)
      .sort((a, b) => b.v - a.v || (a.o < b.o ? -1 : 1));
    for (const t of targets.slice(0, free)) issue(sim, { type: 'envoy', nation: nid, target: t.o });
  }
  // coalition war when the coalition is strong enough
  for (const c of st.coalitions) {
    if (!c.members.includes(nid) || warsOf(sim, nid).length) continue;
    if (c.members[0] !== nid) continue; // one member leads the call
    let ours = 0;
    for (const m of c.members) if (!atWar(sim, m, c.target) && !hasTreaty(sim, 'nap', m, c.target)) ours += nationPotential(sim, m);
    let theirs = nationPotential(sim, c.target);
    for (const a of alliesOf(sim, c.target)) theirs += nationPotential(sim, a) * 0.7;
    if (ours >= theirs * 1.3 && truceUntil(sim, nid, c.target) <= st.tick && !hasTreaty(sim, 'nap', nid, c.target)) {
      const r = issue(sim, { type: 'coalitionWar', nation: nid, target: c.target });
      diag(sim, nid, 'strategic', `Coalition war against ${nationName(sim, c.target)}: ${r.ok ? 'declared' : 'failed'} (strength ${ours.toFixed(1)} vs ${theirs.toFixed(1)})`);
    }
  }
}

/**
 * Once a year a realm reviews its alliances: it leaves one whose partner it has come
 * to fear, who claims its land, or with whom relations have soured, unless they share
 * a threat or fight a war together. Leaving costs trust (diplomacy.cancelTreaty).
 */
function reviewAlliances(sim: Sim, nid: NationId): void {
  const st = sim.state;
  if (dateOf(sim).month !== 6) return;
  for (const a of alliesOf(sim, nid)) {
    if (warsOf(sim, nid).some((w) => w.attackers.includes(a) || w.defenders.includes(a))) continue;
    if (sharedThreat(sim, nid, a)) continue;
    const why: string[] = [];
    if ((st.alarm[nid]?.[a] ?? 0) >= 40) why.push(`we have come to fear ${nationName(sim, a)}`);
    if (claimsOn(sim, a, nid).length) why.push('they claim our land');
    if (opinion(sim, nid, a) < -25) why.push(`relations have soured (${opinion(sim, nid, a)})`);
    if (!why.length) continue;
    const r = issue(sim, { type: 'cancelTreaty', nation: nid, target: a, treaty: 'alliance' });
    diag(sim, nid, 'strategic', `Left the alliance with ${nationName(sim, a)}: ${why.join('; ')}${r.ok ? '' : ' (failed)'}`, ['Rejected: keeping an ally we no longer trust (no shared threat, no war together)']);
  }
}

/**
 * Guarantees, loans and trade blocs: once a year at most each, a realm at
 * peace guarantees a smaller neighbour threatened by a realm it fears, lends
 * from a large treasury to a realm in debt or one it wants in its sphere, and
 * founds, joins or grows a trade bloc on its trade agreements.
 */
function influencePolicy(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  const last = (k: string) => n.ai.lastProposal[k] ?? -1e9;
  const others = aliveNations(sim).filter((o) => o !== nid);
  // guarantees that no longer make sense
  for (const g of guaranteesBy(sim, nid)) {
    if (opinion(sim, nid, g.of) < -30 || enemiesOf(sim, nid).some((e) => hasTreaty(sim, 'alliance', g.of, e)))
      issue(sim, { type: 'revokeGuarantee', nation: nid, target: g.of }, `Revoked the guarantee of ${nationName(sim, g.of)}`);
  }
  if (warsOf(sim, nid).length) return;
  const mine = Math.max(1, nationStrength(sim, nid));
  // a guarantee for a smaller neighbour that a realm we fear threatens
  if (st.tick - last('guarantee') >= months(12) && guaranteesBy(sim, nid).length < guaranteeSlots(sim, nid)) {
    const cands = others
      .filter((o) => nationDistance(sim, nid, o) <= 2 && nationStrength(sim, o) <= mine && n.ai.warPlan?.target !== o && !guaranteeProblem(sim, nid, o) && !claimsOn(sim, nid, o).length)
      .map((o) => {
        let v = 0;
        if (nationStrength(sim, o) <= mine * 0.6) v += 1;
        const threat = isThreatened(sim, o);
        if (threat && threat !== nid && ((st.alarm[nid]?.[threat] ?? 0) >= 15 || rivalLeader(sim, nid)?.nid === threat)) v += 2;
        if (threat && borders(sim, nid, threat) && borders(sim, o, threat)) v += 0.5;
        if (p.id === 'diplomat' || p.id === 'defensive') v += 0.5;
        if (n.ai.goal.victory === 'diplomatic') v += 0.5;
        v += opinion(sim, nid, o) / 50;
        return { o, v };
      })
      .filter((x) => x.v >= 2)
      .sort((a, b) => b.v - a.v || (a.o < b.o ? -1 : 1));
    if (cands[0]) {
      n.ai.lastProposal['guarantee'] = st.tick;
      issue(sim, { type: 'guarantee', nation: nid, target: cands[0].o }, `Guaranteed the independence of ${nationName(sim, cands[0].o)}`);
    }
  }
  // a loan from a large treasury
  const gross = Math.max(5, grossIncome(n.lastMonth));
  if (st.tick - last('loan') >= months(12) && n.treasury > 150 && n.treasury > gross * 4) {
    const sphereMinded = n.ai.goal.victory === 'diplomatic' || p.id === 'diplomat' || p.id === 'commercial';
    const cands = others
      .filter((o) => nationDistance(sim, nid, o) <= 3 && !atWar(sim, nid, o) && n.ai.warPlan?.target !== o && opinion(sim, o, nid) >= -10)
      .map((o) => {
        const on = st.nations[o];
        let v = 0;
        if (on.treasury < 0) v += 3;
        else if (on.treasury < Object.values(on.lastMonth.expenses).reduce((a, b) => a + b, 0) * 2) v += 1;
        if (sphereMinded && totalDev(sim, o) < totalDev(sim, nid) * 0.8 && !sphereOf(sim, o)) v += 1.5;
        if (hasTreaty(sim, 'alliance', nid, o)) v += 1;
        return { o, v };
      })
      .filter((x) => x.v >= 2)
      .sort((a, b) => b.v - a.v || (a.o < b.o ? -1 : 1));
    for (const c of cands.slice(0, 2)) {
      const og = Math.max(5, grossIncome(st.nations[c.o].lastMonth));
      const amount = Math.max(C.loan.min, Math.min(Math.floor(n.treasury * 0.25), Math.round((og * 3) / 10) * 10));
      if (loanProblem(sim, nid, c.o, amount)) continue;
      n.ai.lastProposal['loan'] = st.tick;
      const r = issue(sim, { type: 'loan', nation: nid, target: c.o, amount });
      if (r.ok) break;
    }
  }
  // trade blocs
  const bloc = blocOf(sim, nid);
  if (bloc) {
    if (bloc.leader !== nid && opinion(sim, nid, bloc.leader) < -30) {
      issue(sim, { type: 'leaveBloc', nation: nid }, `Left the ${bloc.name}`);
      return;
    }
    if (bloc.leader === nid && bloc.members.length < C.bloc.maxMembers && st.tick - last('bloc') >= months(6)) {
      n.ai.lastProposal['bloc'] = st.tick;
      const cands = treatyPartners(sim, 'trade', nid)
        .filter((o) => !inviteProblem(sim, nid, o) && !st.nations[o].isPlayer)
        .sort((a, b) => tradeValue(sim, nid, b) - tradeValue(sim, nid, a) || (a < b ? -1 : 1));
      for (const o of cands.slice(0, 2)) {
        const r = issue(sim, { type: 'inviteBloc', nation: nid, target: o });
        if (r.ok) break;
      }
    }
    return;
  }
  if (st.tick - last('bloc') < months(12)) return;
  n.ai.lastProposal['bloc'] = st.tick;
  const joinable = st.blocs
    .filter((b) => !joinProblem(sim, nid, b.id) && !st.nations[b.leader].isPlayer && hasTreaty(sim, 'trade', nid, b.leader) && opinion(sim, nid, b.leader) >= 0)
    .sort((a, b) => b.members.length - a.members.length || (a.id < b.id ? -1 : 1));
  for (const b of joinable) {
    const r = issue(sim, { type: 'joinBloc', nation: nid, bloc: b.id });
    if (r.ok) return;
  }
  const founder = p.id === 'commercial' || p.id === 'diplomat' || n.ai.goal.victory === 'economic';
  if (founder && treatyPartners(sim, 'trade', nid).length >= 2 && n.treasury >= 150) {
    const partner = treatyPartners(sim, 'trade', nid)
      .filter((o) => !foundBlocProblem(sim, nid, o) && !st.nations[o].isPlayer)
      .sort((a, b) => tradeValue(sim, nid, b) - tradeValue(sim, nid, a) || (a < b ? -1 : 1))[0];
    if (partner) issue(sim, { type: 'foundBloc', nation: nid, target: partner }, `Founded a trade bloc with ${nationName(sim, partner)}`);
  }
}

// ───────────────────────────── Victory awareness ────────────────────────────

/** A rival that is visibly close to winning (timer at 35%+ of what it needs). */
export function rivalLeader(sim: Sim, nid: NationId): { nid: NationId; path: VictoryPath } | null {
  let best: { nid: NationId; path: VictoryPath; f: number } | null = null;
  for (const o of aliveNations(sim)) {
    if (o === nid) continue;
    const s = sim.state.nations[o].victoryStreak;
    for (const k of ['territorial', 'economic', 'diplomatic'] as VictoryPath[]) {
      const f = s[k] / VICTORY_MONTHS[k];
      if (f >= C.victory.rivalReaction && (!best || f > best.f)) best = { nid: o, path: k, f };
    }
  }
  return best ? { nid: best.nid, path: best.path } : null;
}

// ───────────────────────────── War ──────────────────────────────────────────

function sideStrength(sim: Sim, nid: NationId, against: NationId): number {
  let s = nationPotential(sim, nid);
  // defensive allies that would be called, weighted by whether they can reach the fight
  for (const a of alliesOf(sim, nid)) {
    if (a === against || hasTreaty(sim, 'alliance', a, against) || hasTreaty(sim, 'nap', a, against)) continue;
    const an = sim.state.nations[a];
    if (an.warExhaustion >= 60 || warsOf(sim, a).length >= 2) continue;
    const reach = borders(sim, a, against) ? 0.6 : borders(sim, a, nid) ? 0.35 : 0.15;
    s += nationPotential(sim, a) * reach * (warsOf(sim, a).length ? 0.5 : 1);
  }
  // realms that guarantee us or hold us in their sphere would come too
  const protectors = new Set(guarantorsOf(sim, nid));
  const patron = sphereOf(sim, nid);
  if (patron) protectors.add(patron);
  for (const g of [...protectors].sort()) {
    if (g === against || alliesOf(sim, nid).includes(g) || hasTreaty(sim, 'alliance', g, against) || hasTreaty(sim, 'nap', g, against)) continue;
    const gn = sim.state.nations[g];
    if (gn.warExhaustion >= 60 || warsOf(sim, g).length >= 2) continue;
    const reach = borders(sim, g, against) ? 0.5 : borders(sim, g, nid) ? 0.3 : 0.12;
    s += nationPotential(sim, g) * reach * (warsOf(sim, g).length ? 0.5 : 1);
  }
  const c = coalitionAgainst(sim, against);
  if (c?.members.includes(nid)) for (const m of c.members) if (m !== nid && !alliesOf(sim, nid).includes(m)) s += nationPotential(sim, m) * 0.6;
  return s;
}

export interface WarCandidate {
  t: NationId;
  goal: WarGoal;
  score: number;
  ratio: number;
  need: number;
  value: number;
  notes: string[];
}

/** Why the AI is not considering war right now (null = it may). */
export function warGate(sim: Sim, nid: NationId): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  if (warsOf(sim, nid).length) return 'already at war';
  if (st.tick < months(C.ai.openingMonths)) return 'opening phase';
  const cooldown = months(p.aggression >= 1.2 ? 12 : 24);
  if (st.tick - n.ai.lastWarEnd < cooldown) return 'recovering from the last war';
  if (n.warExhaustion > 15) return 'war-weary';
  if (n.treasury < 0.5 * grossIncome(n.lastMonth)) return 'treasury too low';
  if (st.tick >= endTick(sim) - months(18)) return 'campaign ending';
  if (regimentCount(sim, nid) < n.ai.armyTarget * 0.75) return 'army below target';
  // a realm holding the conditions of a peaceful victory (or with its timer paused just
  // short of them) does not throw them away
  const s = n.victoryStreak;
  if (s.diplomatic > 0 || s.economic > 0) {
    const vp = victoryProgress(sim, nid);
    const holds = (k: 'diplomatic' | 'economic') => (vp[k].met || vp[k].near) && s[k] > 0;
    if (holds('diplomatic') || holds('economic')) return 'holding the conditions of a peaceful victory';
  }
  return null;
}

/** Scored war options against bordering realms (same public information as the player). */
export function warCandidates(sim: Sim, nid: NationId): { cands: WarCandidate[]; napBlocked: Array<{ t: NationId; ratio: number; need: number }> } {
  const st = sim.state;
  const p = pers(sim, nid);
  const mine = nationPotential(sim, nid);
  const rival = rivalLeader(sim, nid);
  const cands: WarCandidate[] = [];
  const napBlocked: Array<{ t: NationId; ratio: number; need: number }> = [];
  const worried = aliveNations(sim).filter((o) => (st.alarm[o]?.[nid] ?? 0) >= 35).length;
  const dist = supplyDistances(sim, nid);
  const range = C.supply.range + nationMods(sim, nid).supplyRange + 1;
  for (const t of aliveNations(sim)) {
    if (t === nid || !borders(sim, nid, t)) continue;
    const goals = goalOptions(sim, nid, t).filter((g) => g.type !== 'coalition');
    if (!goals.length) continue;
    const goal = goals.find((g) => g.type === 'claim') ?? goals[0];
    if (issueCheck(sim, nid, t, goal)) {
      if (hasTreaty(sim, 'nap', nid, t) && !hasTreaty(sim, 'alliance', nid, t)) napBlocked.push({ t, ratio: mine / Math.max(0.5, sideStrength(sim, t, nid)), need: p.warRatio });
      continue;
    }
    const notes: string[] = [];
    const theirs = sideStrength(sim, t, nid);
    // coalition members against us would join them
    let extra = 0;
    const c = coalitionAgainst(sim, nid);
    if (c?.members.includes(t)) for (const m of c.members) if (m !== t) extra += nationPotential(sim, m) * 0.6;
    // exposure: a realm with more open borders than it can watch must fear a
    // stab in the back. Neighbours not bound to us by treaty and not friendly
    // count, once there are more than two of them (a crossroads realm).
    let exposure = 0;
    let open = 0;
    for (const o of aliveNations(sim)) {
      if (o === nid || o === t || !borders(sim, nid, o)) continue;
      if (hasTreaty(sim, 'alliance', o, nid) || hasTreaty(sim, 'nap', o, nid) || opinion(sim, o, nid) >= 25) continue;
      open++;
      exposure += nationPotential(sim, o) * C.ai.exposureWeight;
    }
    exposure *= Math.max(0, open - 2) / Math.max(1, open);
    if (exposure > mine * 0.3) notes.push('exposed on other borders');
    const ratio = mine / Math.max(0.5, theirs + extra + exposure);
    let need = p.warRatio;
    if (p.id === 'opportunist' && warsOf(sim, t).length) need *= 0.75;
    if (rival?.nid === t) need *= 0.85;
    // ambition grows with long peace and as the campaign advances (for aggressive temperaments)
    if (p.aggression >= 1) {
      const peaceYears = Math.max(0, (st.tick - Math.max(0, st.nations[nid].ai.lastWarEnd)) / 48);
      const progress = st.tick / Math.max(1, endTick(sim));
      need *= Math.max(0.75, 1 - 0.02 * peaceYears - 0.15 * progress);
    }
    let value = 0;
    for (const pid of goal.provinces) value += st.provinces[pid].dev + 3;
    if (goal.type === 'claim') value *= 1.2;
    if (rival?.nid === t) {
      value += 12;
      notes.push('rival close to victory');
    }
    if (worried >= 2) {
      value *= 0.6;
      notes.push('neighbours alarmed');
    }
    if (warsOf(sim, t).some((w) => w.defenders.includes(t)) && p.id !== 'opportunist') {
      value *= 0.5;
      notes.push('already beset');
    }
    // war ends our contracts with them: a realm that depends on their goods thinks twice
    const dep = dependenceOn(sim, nid, t);
    if (dep && dep.share >= C.trade.dependence) {
      value *= Math.max(0.3, 1 - dep.share);
      notes.push(`we depend on their ${dep.res}`);
    }
    const reachable = goal.provinces.filter((pid) => dist[pid] <= range).length;
    if (!reachable) continue;
    const score = value * (ratio / need - 1) * p.aggression;
    cands.push({ t, goal, score, ratio, need, value, notes });
  }
  cands.push(...overseasCandidates(sim, nid, mine));
  cands.sort((a, b) => b.score - a.score || (a.t < b.t ? -1 : 1));
  return { cands, napBlocked };
}

/**
 * Wars on realms we do not border, reached by sea: only with transports afloat
 * for a real landing force, a navy that outweighs theirs (with their allies'),
 * and a short sea route; the value is discounted for the trouble of holding a
 * beach overseas. The same assessment the player sees (reach.ts).
 */
function overseasCandidates(sim: Sim, nid: NationId, mine: number): WarCandidate[] {
  const st = sim.state;
  const p = pers(sim, nid);
  if (p.aggression < 1) return [];
  let lift = 0;
  let guns = 0;
  for (const f of fleetsOf(sim, nid)) for (const s of f.ships) s.type === 'transport' ? (lift += 2) : (guns += 1);
  if (lift < C.ai.overseasLift || guns < 3) return [];
  // the waters within a short voyage of our ports: only realms with a coast on them are candidates
  const near = new Set<string>();
  let frontier: string[] = [];
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (p.port > 0 && p.owner === nid && p.controller === nid) for (const z of sim.world.provZones[pid] ?? []) if (!near.has(z)) (near.add(z), frontier.push(z));
  }
  for (let d = 0; d < C.ai.overseasZones && frontier.length; d++) {
    const next: string[] = [];
    for (const z of frontier) for (const nb of sim.world.zones[z].neighbors) if (!near.has(nb)) (near.add(nb), next.push(nb));
    frontier = next;
  }
  const reachable = new Set<NationId>();
  for (const z of near) for (const pid of sim.world.zones[z].coasts) {
    const o = st.provinces[pid].owner;
    if (o && o !== nid) reachable.add(o);
  }
  const out: WarCandidate[] = [];
  for (const t of aliveNations(sim)) {
    if (t === nid || !reachable.has(t) || borders(sim, nid, t) || atWar(sim, nid, t)) continue;
    const goals = goalOptions(sim, nid, t).filter((g) => g.type !== 'coalition');
    const goal = goals.find((g) => g.type === 'claim') ?? goals.find((g) => g.type === 'conquest');
    if (!goal || issueCheck(sim, nid, t, goal)) continue;
    // their coasts first: a goal inland of an overseas realm cannot be taken from a beach
    if (!goal.provinces.every((pid) => sim.world.provZones[pid]?.length)) continue;
    const r = warReach(sim, nid, t);
    if (r.overland || r.seaZones === null || r.seaZones > C.ai.overseasZones) continue;
    if (r.ourNavy < r.theirNavy * 1.2 || r.liftRegiments < C.ai.overseasLift) continue;
    const theirs = sideStrength(sim, t, nid);
    const ratio = mine / Math.max(0.5, theirs);
    const need = p.warRatio * 1.3;
    let value = 0;
    for (const pid of goal.provinces) value += st.provinces[pid].dev + 3;
    value *= 0.6;
    const score = value * (ratio / need - 1) * p.aggression;
    out.push({ t, goal, score, ratio, need, value, notes: [`overseas: ${r.seaZones} sea zone${r.seaZones === 1 ? '' : 's'}, transports for ${r.liftRegiments} regiments`] });
  }
  return out;
}

function considerWar(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  const d = diffOf(sim);
  if (warGate(sim, nid)) return;
  const { cands, napBlocked } = warCandidates(sim, nid);
  if (!cands.length || cands.every((c) => c.score < 2)) {
    // an ambitious realm may renounce a pact to prepare a war (12-month cooling-off, trust loss)
    const blocked = napBlocked.filter((b) => b.ratio >= b.need * 1.3).sort((a, b) => b.ratio - a.ratio || (a.t < b.t ? -1 : 1))[0];
    if (blocked && p.aggression >= 1.1 && n.trust >= 40 && st.tick - (n.ai.lastProposal['napCancel'] ?? -1e9) >= months(24)) {
      n.ai.lastProposal['napCancel'] = st.tick;
      issue(sim, { type: 'cancelTreaty', nation: nid, target: blocked.t, treaty: 'nap' }, `Renounced the pact with ${nationName(sim, blocked.t)} to prepare for war (ratio ${blocked.ratio.toFixed(2)})`);
      return;
    }
  }
  if (!cands.length) return;
  let pick = cands[0];
  if (aiRand(sim) < d.mistake) {
    const ok = cands.filter((c) => c.ratio >= c.need * 0.9);
    if (ok.length) pick = ok[Math.floor(aiRand(sim) * ok.length)];
  }
  const threshold = 2;
  if (pick.score < threshold) {
    // once a year per realm (strategic turns are staggered across the weeks of a month)
    if (pick.score > 0 && dateOf(sim).month === 0)
      diag(sim, nid, 'strategic', `War considered but not worth it`, cands.slice(0, 3).map((c) => `${nationName(sim, c.t)}: ratio ${c.ratio.toFixed(2)}/${c.need.toFixed(2)} score ${c.score.toFixed(1)}`));
    // prepare: fabricate a claim on the best target if we lack one
    if (p.aggression >= 1 && !claimsOn(sim, nid, pick.t).length) {
      const target = pick.goal.provinces[0];
      if (!fabricateProblem(sim, nid, target)) issue(sim, { type: 'fabricate', nation: nid, province: target }, `Fabricating claim on ${provName(sim, target)}`);
    }
    return;
  }
  const r = issue(sim, { type: 'declareWar', nation: nid, target: pick.t, goal: pick.goal });
  if (r.ok) {
    n.ai.warPlan = { target: pick.t, since: st.tick, provinces: pick.goal.provinces };
    n.ai.goal = { kind: 'expand', target: pick.t, since: st.tick, score: pick.score, victory: n.ai.goal.victory };
    diag(
      sim,
      nid,
      'strategic',
      `Declared war on ${nationName(sim, pick.t)} (${pick.goal.type}: ${pick.goal.provinces.map((x) => provName(sim, x)).join(', ')})`,
      cands.slice(0, 4).map((c) => `${nationName(sim, c.t)}: ratio ${c.ratio.toFixed(2)} need ${c.need.toFixed(2)} score ${c.score.toFixed(1)}`),
    );
  }
}

function issueCheck(sim: Sim, nid: NationId, t: NationId, goal: WarGoal): boolean {
  const st = sim.state;
  if (truceUntil(sim, nid, t) > st.tick) return true;
  if (hasTreaty(sim, 'nap', nid, t) || hasTreaty(sim, 'alliance', nid, t)) return true;
  void goal;
  return false;
}

// ───────────────────────────── Peace ────────────────────────────────────────

/**
 * Peace, war by war, reconsidered once a month: the realm weighs where it stands
 * and where the war is heading (assess.ts) and compares its options: fight on, a
 * white peace, giving up land, or demanding terms (a settlement when it leads the
 * winners). It offers the option the other side could plausibly take, remembers
 * the offer and its answer, and does not repeat a refused offer until its standing
 * has moved or its patience runs out; a refused concession is raised next time.
 * Every decision is logged with the assessment and the options it set aside.
 */
export function considerPeace(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  for (const w of warsOf(sim, nid)) {
    const a = assessWar(sim, w.id, nid);
    if (!a) continue;
    const mem = (n.ai.peace[w.id] ??= { tick: -1e9, mode: null, value: 0, standing: 0, answer: null, outlooks: [], next: 0 });
    if (st.tick < mem.next) continue;
    mem.next = st.tick + months(1);
    mem.outlooks = [...mem.outlooks, Math.round(a.outlook)].slice(-4);
    if (st.proposals.some((x) => (x.kind === 'peace' || x.kind === 'settlement') && x.war === w.id && (x.from === nid || x.to === nid))) continue;
    const lead = w.attackerLead === nid || w.defenderLead === nid;
    const other = a.enemyLead;
    const mySide = a.ourSide;
    const standing = warStanding(a);
    const age = (st.tick - w.startTick) / 4;
    const momentum = mem.outlooks.length >= 3 ? (mem.outlooks[mem.outlooks.length - 1] - mem.outlooks[0]) / (mem.outlooks.length - 1) : 0;
    const shifted = Math.abs(standing - mem.standing) >= 10;
    const waited = (st.tick - mem.tick) / 4 >= 6 * p.patience;
    const refused = mem.answer === 'rejected';
    const trace = [...a.reasons, `Standing ${Math.round(standing)} (leverage ${Math.round(a.leverage)}, outlook ${Math.round(a.outlook)}, momentum ${momentum.toFixed(1)}/month)`];
    const decide = (summary: string, extra: string[] = []) => diag(sim, nid, 'strategic', summary, [...trace, ...extra]);
    const losing = a.outlook <= -20 || standing <= -25;
    const winning = a.outlook >= 20 && standing >= 15;

    // ── winning: settle when the war has given what it can, before total conquest
    if (winning) {
      if (!lead) continue; // an ally on the winning side leaves the spoils to the leader's settlement
      const goalHeld = w.goal.provinces.length > 0 && w.goal.provinces.every((pid) => mySide.includes(st.provinces[pid].controller ?? ''));
      const collapse = a.landHeld >= 0.5 || a.enemyForces < Math.max(1, a.forces) * 0.15;
      const elsewhere = warsOf(sim, nid).length > 1 || (!!isThreatened(sim, nid) && isThreatened(sim, nid) !== other);
      const tired = a.exhaustion >= 45 * p.patience;
      const stalled = mem.outlooks.length >= 3 && momentum <= 1 && age >= 6;
      const why = [goalHeld && 'our war goals are held', collapse && 'the enemy is close to collapse', elsewhere && 'another threat needs our armies', tired && 'our own exhaustion', stalled && 'the advance has stalled'].filter(Boolean) as string[];
      if (!why.length) {
        if (mem.tick < 0 || st.tick - mem.tick >= months(6)) decide(`Pressing on against ${nationName(sim, other)}: winning and still advancing`, ['Rejected: a settlement now (nothing yet makes stopping better than advancing)']);
        continue;
      }
      if (refused && !shifted && !waited) continue;
      // a refused settlement comes back more moderate unless our position improved
      const scale = refused && !shifted ? 0.75 : 1;
      trySettlement(sim, nid, w.id, other, standing, scale, `winning (${why.join(', ')})`, trace);
      continue;
    }

    // ── losing: concede land if the war cannot be turned, fight on if it can
    if (losing) {
      const recoverable = a.lost.length > 0 && a.recovery >= 0.55 && a.exhaustion < 70 * p.patience && !(a.capitalLost && a.recovery < 0.7);
      const holding = a.lost.length === 0 && a.outlook > -35 && a.exhaustion < 50;
      if (recoverable || holding) {
        if (st.tick - mem.tick >= months(6)) {
          decide(`Fighting on against ${nationName(sim, other)}: ${recoverable ? 'the lost land can be retaken' : 'we still hold our land'}`, ['Rejected: conceding land while the war can still be turned']);
          mem.tick = st.tick;
          mem.standing = standing;
        }
        continue;
      }
      if (!lead && other !== w.attackerLead && other !== w.defenderLead) continue;
      // what it would take: our deficit, more when exhausted, less for the stubborn
      let needed = Math.max(5, (-standing * 0.6) / p.risk + (a.exhaustion > 60 ? 10 : 0) - p.stubborn);
      if (refused && mem.mode === 'concede' && !shifted) needed = Math.max(needed, mem.value * 1.35);
      const lostLand = a.lost.filter((pid) => st.provinces[pid].owner === nid && pid !== n.capital).sort((x, y) => st.provinces[x].dev - st.provinces[y].dev || (x < y ? -1 : 1));
      const capital = n.capital && a.lost.includes(n.capital) && a.exhaustion >= 85 ? [n.capital] : [];
      const provinces: ProvinceId[] = [];
      let value = 0;
      for (const pid of [...lostLand, ...capital]) {
        if (value >= needed) break;
        provinces.push(pid);
        value = termsCost(sim, w, nid, other, { mode: 'concede', provinces, gold: 0 });
      }
      let gold = 0;
      if (value < needed) {
        gold = Math.min(Math.floor(Math.max(0, n.treasury) * 0.3), Math.ceil((needed - value) * C.war.goldPerPoint));
        if (gold < 20) gold = 0;
        value = termsCost(sim, w, nid, other, { mode: 'concede', provinces, gold });
      }
      if (!provinces.length && !gold) {
        // nothing of ours left to give (only the capital, or nothing occupied, and an empty
        // treasury): ask for a white peace now and then; the enemy decides
        if (mem.mode === 'white' && (refused || mem.answer === 'pending') && !shifted && !waited) {
          if (st.tick - mem.tick >= months(6)) {
            decide(`Holding out against ${nationName(sim, other)}: nothing left to concede, and our white peace was refused`, ['Rejected: repeating the same offer']);
            mem.tick = st.tick;
          }
          continue;
        }
        offerPeace(sim, nid, w.id, other, { mode: 'white', provinces: [], gold: 0 }, 'nothing left to concede but the capital: asking for a white peace', standing, 0, trace, ['Rejected: ceding the capital (not yet exhausted enough to give up the realm)', 'Rejected: paying (the treasury is empty)']);
        continue;
      }
      if (refused && mem.mode === 'concede' && value <= mem.value * 1.05 && !waited) {
        decide(`Holding out against ${nationName(sim, other)}: our best concession (${value}) was already refused`, ['Rejected: repeating the same offer']);
        mem.tick = st.tick;
        mem.standing = standing;
        continue;
      }
      const terms: PeaceTerms = { mode: 'concede', provinces, gold };
      const desc = `${provinces.map((x) => provName(sim, x)).join(', ') || 'no land'}${gold ? ` and ${gold} crowns` : ''}`;
      offerPeace(sim, nid, w.id, other, terms, `conceding ${desc} to end a war we cannot turn`, standing, value, trace, ['Rejected: fighting on (the lost land cannot be retaken)', 'Rejected: a white peace, which a winning enemy would refuse']);
      continue;
    }

    // ── stalemate: a white peace once both sides are worn down
    const long = age >= 18 * p.patience;
    if ((long && a.exhaustion >= 30 && a.enemyExhaustion >= 25) || a.exhaustion >= 70) {
      if (refused && mem.mode === 'white' && !shifted && !waited) continue;
      if (!lead && other !== w.attackerLead && other !== w.defenderLead) continue;
      offerPeace(sim, nid, w.id, other, { mode: 'white', provinces: [], gold: 0 }, `a stalemate: ${long ? `${Math.round(age)} months of war` : 'exhaustion'}, neither side gaining`, standing, 0, trace, ['Rejected: demanding terms (no leverage)', 'Rejected: conceding land (the enemy cannot take it)']);
    }
  }
}

/** Sends (to a player) or settles (with an AI) a peace offer, and remembers it and its answer. */
function offerPeace(sim: Sim, nid: NationId, warId: string, other: NationId, terms: PeaceTerms, why: string, standing: number, value: number, trace: string[], rejected: string[]): boolean {
  const st = sim.state;
  const n = st.nations[nid];
  const mem = n.ai.peace[warId];
  n.ai.lastPeaceTry[warId] = st.tick;
  mem.tick = st.tick;
  mem.mode = terms.mode;
  mem.value = value;
  mem.standing = standing;
  const target = st.nations[other];
  if (target.isPlayer) {
    const r = issue(sim, { type: 'peace', nation: nid, war: warId, with: other, terms });
    mem.answer = r.ok ? 'pending' : null;
    // how the offer looks from their side, by what can be seen of the war
    const appeal = evaluatePeace(sim, warId, nid, other, terms);
    diag(sim, nid, 'strategic', `Offered peace to ${nationName(sim, other)} (${why}): ${r.ok ? 'sent' : 'invalid'}; we expect them to ${appeal.accept ? 'accept' : 'hesitate'} (${Math.round(appeal.score)})`, [...trace, ...rejected]);
    return r.ok;
  }
  const ev = evaluatePeace(sim, warId, nid, other, terms);
  if (!ev.accept) {
    mem.answer = 'rejected';
    diag(sim, nid, 'strategic', `Peace ${terms.mode} to ${nationName(sim, other)} would be refused (${Math.round(ev.score)}): ${why}`, [...trace, ...ev.reasons.map((r) => `${r.label}: ${r.value}`)]);
    return false;
  }
  const r = issue(sim, { type: 'peace', nation: nid, war: warId, with: other, terms });
  mem.answer = r.ok ? 'accepted' : null;
  diag(sim, nid, 'strategic', `Peace with ${nationName(sim, other)} (${why}): ${r.ok ? 'agreed' : 'failed'}`, [...trace, ...rejected]);
  return r.ok;
}

/**
 * A winning war leader dictates a settlement (src/sim/settlement.ts). An AI
 * opponent accepts it, or offers the part it would accept; the AI takes a
 * counter-offer worth at least half of its demands. A player gets a proposal.
 * `scale` moderates the demands after a refusal.
 */
function trySettlement(sim: Sim, nid: NationId, warId: string, other: NationId, standing: number, scale: number, why: string, trace: string[]): boolean {
  const st = sim.state;
  const n = st.nations[nid];
  const mem = n.ai.peace[warId];
  n.ai.lastPeaceTry[warId] = st.tick;
  const demands = buildSettlement(sim, warId, nid, scale);
  if (!demands.length) {
    // nothing we could ask of them (no land we may take, nothing to pay): say so, not silently
    if (st.tick - mem.tick >= months(6)) {
      diag(sim, nid, 'strategic', `No terms to ask of ${nationName(sim, other)} (${why}): no land we may take and nothing they can pay; fighting on`, trace);
      mem.tick = st.tick;
    }
    return false;
  }
  const w = st.wars[warId];
  mem.tick = st.tick;
  mem.mode = 'settlement';
  mem.value = settlementCost(sim, w, demands);
  mem.standing = standing;
  const lines = demands.map((d) => describeDemand(sim, d));
  if (st.nations[other].isPlayer) {
    const r = issue(sim, { type: 'settle', nation: nid, war: warId, demands });
    mem.answer = r.ok ? 'pending' : null;
    const appeal = evaluateSettlement(sim, warId, other, demands);
    diag(sim, nid, 'strategic', `Proposed a settlement to ${nationName(sim, other)} (${why}; ${demands.length} demands${scale < 1 ? ', moderated after a refusal' : ''}): ${r.ok ? 'sent' : 'invalid'}; we expect them to ${appeal.accept ? 'accept' : 'hesitate'}`, [...trace, ...lines]);
    return r.ok;
  }
  let terms = demands;
  if (!evaluateSettlement(sim, warId, other, demands).accept) {
    const counter = counterOffer(sim, warId, other, demands);
    if (!counter || settlementCost(sim, w, counter) < settlementCost(sim, w, demands) * 0.5) {
      mem.answer = 'rejected';
      diag(sim, nid, 'strategic', `Settlement with ${nationName(sim, other)} would be refused; fighting on`, [...trace, ...lines]);
      return false;
    }
    terms = counter;
  }
  const r = issue(sim, { type: 'settle', nation: nid, war: warId, demands: terms });
  mem.answer = r.ok ? 'accepted' : null;
  diag(sim, nid, 'strategic', `Settlement with ${nationName(sim, other)} (${why}, standing ${Math.round(standing)}): ${r.ok ? 'agreed' : 'failed'}${terms !== demands ? ' (their counter-offer)' : ''}`, terms.map((d) => describeDemand(sim, d)));
  return r.ok;
}

// ───────────────────────────── Goal & rally ─────────────────────────────────

/**
 * Once a year a realm pursues the victory it is closest to among its
 * temperament's path and the two material ones (territorial and economic):
 * condition progress plus half the timer it has built, with a lean toward its
 * temperament's path. Only diplomatic temperaments pursue diplomatic leadership,
 * whose conditions many realms meet now and then. The path steers research,
 * construction, focus and diplomacy.
 */
function chooseVictoryPath(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (dateOf(sim).month !== 0 && st.tick > 4) return;
  const vp = victoryProgress(sim, nid);
  const home = pers(sim, nid).victory;
  const score = (k: VictoryPath) => vp[k].progress + (vp[k].streak / vp[k].required) * 0.5 + (k === home ? 0.1 : 0);
  const paths = [...new Set<VictoryPath>([home, 'territorial', 'economic'])];
  const best = paths.sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))[0];
  if (best !== n.ai.goal.victory && score(best) > score(n.ai.goal.victory) + 0.05) {
    diag(sim, nid, 'strategic', `Victory path → ${best} (${Math.round(vp[best].progress * 100)}% of the conditions)`);
    n.ai.goal = { ...n.ai.goal, victory: best };
  }
}

function chooseGoal(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  chooseVictoryPath(sim, nid);
  const war = warsOf(sim, nid);
  const prev = n.ai.goal.kind;
  let kind: typeof n.ai.goal.kind = 'develop';
  let target: NationId | null = null;
  if (war.some((w) => w.defenders.includes(nid))) {
    kind = 'defend';
    target = enemiesOf(sim, nid)[0] ?? null;
  } else if (war.length) {
    kind = 'expand';
    target = n.ai.warPlan?.target ?? enemiesOf(sim, nid)[0] ?? null;
  } else if (overextension(sim, nid) > 0) kind = 'consolidate';
  else if (n.ai.goal.victory === 'diplomatic') kind = 'diplomacy';
  if (kind !== prev) {
    n.ai.goal = { ...n.ai.goal, kind, target, since: st.tick };
    diag(sim, nid, 'strategic', `Goal → ${kind}${target ? ` (${nationName(sim, target)})` : ''}`);
  }
  // rally: the border province facing the main threat, else the capital
  const threat = isThreatened(sim, nid) ?? enemiesOf(sim, nid)[0] ?? null;
  let rally = n.capital;
  if (threat) {
    const candidates = ownedProvinces(sim, nid).filter(
      (pid) => st.provinces[pid].controller === nid && sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === threat),
    );
    candidates.sort((a, b) => st.provinces[b].fort * 3 + st.provinces[b].dev - (st.provinces[a].fort * 3 + st.provinces[a].dev) || (a < b ? -1 : 1));
    if (candidates[0]) rally = candidates[0];
  }
  n.ai.rally = rally;
  void poolCap;
  void canJoin;
}

/** Monthly strategic pass for one AI realm. */
export function strategic(sim: Sim, nid: NationId): void {
  chooseGoal(sim, nid);
  planBudget(sim, nid);
  chooseResearch(sim, nid);
  chooseFocus(sim, nid);
  considerPeace(sim, nid);
  planConstruction(sim, nid);
  navalStrategy(sim, nid, treasuryReserve(sim, nid));
  planInvasion(sim, nid);
  diplomacy(sim, nid);
  aiTrade(sim, nid);
  considerWar(sim, nid);
  // rivals close to victory make everyone nervous
  const rival = rivalLeader(sim, nid);
  if (rival) {
    if (rival.path === 'diplomatic') {
      // a peaceful bid breeds wariness (opinion), not fear of conquest (alarm, coalitions);
      // its allies and the realms in its sphere share in its standing and are not wary
      const m = memoriesOf(sim, nid, rival.nid).find((x) => x.kind === 'rivalBid');
      const friend = hasTreaty(sim, 'alliance', nid, rival.nid) || sphereOf(sim, nid) === rival.nid;
      if (!friend && (!m || m.value > -C.diplomacy.rivalBidCap)) addMemory(sim, nid, rival.nid, 'rivalBid', -1, 0.3);
    } else {
      const row = (sim.state.alarm[nid] ??= {});
      row[rival.nid] = Math.min(100, (row[rival.nid] ?? 0) + 2);
    }
    // deny a diplomatic winner our trade unless we are close friends
    const leadStreak = sim.state.nations[rival.nid].victoryStreak.diplomatic / VICTORY_MONTHS.diplomatic;
    if (rival.path === 'diplomatic' && leadStreak >= 0.5 && hasTreaty(sim, 'trade', nid, rival.nid) && opinion(sim, nid, rival.nid) < 60 && aiRand(sim) < 0.15) {
      issue(sim, { type: 'cancelTreaty', nation: nid, target: rival.nid, treaty: 'trade' }, `Cancelled trade with ${nationName(sim, rival.nid)} to deny them diplomatic leadership`);
    }
  }
}

export type { War };
