// Strategic layer (monthly, staggered per realm): goal, budget, research,
// policy, construction, diplomacy, war and peace. Utility scores with weights
// from the personality; commitment periods and improvement thresholds prevent
// oscillation; emergencies (being attacked, bankruptcy) interrupt plans.

import { C } from '../config';
import { PERSONALITIES, type PersonalityDef } from '../data/personalities';
import { POLICIES, POLICY_LIST } from '../data/policies';
import { TECH_LIST } from '../data/techs';
import { activeProjects, buildProblem, buildSlots, projectCost } from '../construction';
import { addMemory, claimsOn, coalitionAgainst, envoySlots, evaluateTreaty, fabricateProblem, memoriesOf, opinion, sharedThreat, treatyProblem } from '../diplomacy';
import { grossIncome, poolCap, reserveCap, tradeValue } from '../economy';
import { overextension } from '../integration';
import { nationPotential, nationStrength } from '../military';
import { nationMods } from '../modifiers';
import { policyProblem, techAvailable } from '../progression';
import {
  aliveNations,
  alliesOf,
  armiesOf,
  atWar,
  borders,
  diag,
  nationDistance,
  enemiesOf,
  hasTreaty,
  months,
  nationName,
  ownedProvinces,
  provName,
  truceUntil,
  warsOf,
  endTick,
  type Sim,
} from '../state';
import { supplyDistances } from '../supply';
import type { NationId, PeaceTerms, ProjectKind, ProvinceId, TreatyType, VictoryPath, War, WarGoal } from '../types';
import { VICTORY_MONTHS } from '../victory';
import { canJoin, evaluatePeace, goalOptions, provinceCost, scoreFor, termsCost } from '../war';
import { aiRand, diffOf, issue } from './common';

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
  n.ai.armyTarget = Math.max(3, target);
  // research funding follows the surplus
  const net = n.lastMonth.net;
  const nothingLeft = !n.research.current && !TECH_LIST.some((t) => techAvailable(sim, nid, t.id));
  const level: 0 | 1 | 2 | 3 = nothingLeft || n.treasury < 0 || net < 0 ? 0 : n.treasury > gross * 10 && net > gross * 0.3 ? 3 : net > gross * 0.25 && n.treasury > gross * 2 ? 2 : 1;
  if (level !== n.research.funding) issue(sim, { type: 'funding', nation: nid, level });
}

// ───────────────────────────── Research & policy ────────────────────────────

function chooseResearch(sim: Sim, nid: NationId): void {
  const n = sim.state.nations[nid];
  if (n.research.current) return;
  const p = pers(sim, nid);
  const war = warsOf(sim, nid).length > 0 || !!isThreatened(sim, nid);
  const over = overextension(sim, nid) > 0;
  const shortSupplies = n.supplies < 20;
  const cands = TECH_LIST.filter((t) => !n.research.done.includes(t.id) && t.requires.every((r) => n.research.done.includes(r)));
  if (!cands.length) return;
  const scored = cands.map((t) => {
    let s = p.research[t.branch] * (1.3 - 0.1 * t.tier);
    if (war && t.branch === 'arms') s *= 1.3;
    if (over && ['bureaucracy', 'colonial', 'law'].includes(t.id)) s *= 1.5;
    if (shortSupplies && ['trains', 'rotation'].includes(t.id)) s *= 1.4;
    if (n.ai.goal.victory === 'diplomatic' && ['corps', 'embassies', 'concert'].includes(t.id)) s *= 1.3;
    if (n.ai.goal.victory === 'economic' && ['surveys', 'charters', 'law'].includes(t.id)) s *= 1.3;
    s *= 1 + (aiRand(sim) - 0.5) * 0.2;
    return { t, s };
  });
  scored.sort((a, b) => b.s - a.s || (a.t.id < b.t.id ? -1 : 1));
  let pick = scored[0];
  if (aiRand(sim) < diffOf(sim).mistake && scored.length > 1) pick = scored[Math.floor(aiRand(sim) * Math.min(3, scored.length))];
  issue(sim, { type: 'research', nation: nid, tech: pick.t.id });
  diag(sim, nid, 'strategic', `Research: ${pick.t.name}`, scored.slice(0, 3).map((x) => `${x.t.name} ${x.s.toFixed(2)}`));
}

function choosePolicy(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (st.tick - n.ai.lastPolicyEval < months(12) && st.tick >= 4) return;
  n.ai.lastPolicyEval = st.tick;
  const p = pers(sim, nid);
  const war = warsOf(sim, nid).length > 0;
  const score = (id: string) => {
    const idx = p.policies.indexOf(id);
    let s = idx === 0 ? 1 : idx === 1 ? 0.8 : idx === 2 ? 0.6 : 0.3;
    if (id === 'frontier' && overextension(sim, nid) > 0.1) s += 0.8;
    if (id === 'levy' && war && n.manpower < 3000) s += 0.6;
    if (id === 'concord' && (war || n.ai.warPlan)) s -= 1;
    if (id === 'fortress' && isThreatened(sim, nid)) s += 0.3;
    return s;
  };
  const cur = score(n.policy);
  const best = POLICY_LIST.map((x) => ({ id: x.id, s: score(x.id) })).sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1))[0];
  if (best.id !== n.policy && best.s > cur + 0.3 && !policyProblem(sim, nid, best.id)) {
    issue(sim, { type: 'policy', nation: nid, policy: best.id }, `Policy → ${POLICIES[best.id].name}`);
  }
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
    const cands: Array<{ pid: ProvinceId; kind: ProjectKind; v: number }> = [];
    let forts = 0;
    for (const pid of ownedProvinces(sim, nid)) forts += st.provinces[pid].fort;
    const owned = ownedProvinces(sim, nid);
    for (const pid of owned) {
      const pr = st.provinces[pid];
      if (pr.controller !== nid || pr.project) continue;
      const def = sim.world.prov[pid];
      const border = def.neighbors.some((nb) => st.provinces[nb].owner && st.provinces[nb].owner !== nid);
      const hostileBorder = def.neighbors.some((nb) => {
        const o = st.provinces[nb].owner;
        return !!o && o !== nid && (atWar(sim, nid, o) || opinion(sim, o, nid) < -10 || o === threat);
      });
      for (const kind of ['dev', 'infra', 'fort', 'charter'] as ProjectKind[]) {
        if (buildProblem(sim, nid, pid, kind)) continue;
        const cost = projectCost(sim, nid, pid, kind).crowns;
        if (cost > budget) continue;
        let v = 0;
        if (kind === 'dev') v = ((1.3 * (0.25 + 0.75 * pr.integration / 100)) / cost) * 100 * econWeight;
        if (kind === 'infra') v = ((((100 - pr.integration) / 100) * 1.2 + (border ? 0.3 : 0) + pr.dev * 0.05) / cost) * 100;
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
      if (st.provinces[pid].owner || buildProblem(sim, nid, pid, 'settle')) continue;
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

function wantsTreaty(sim: Sim, nid: NationId, other: NationId, type: TreatyType): boolean {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  if (n.ai.warPlan?.target === other) return false;
  if (type === 'trade') return p.treaty.trade >= 0.6 && tradeValue(sim, nid, other) > 1.5;
  if (type === 'alliance') {
    if (alliesOf(sim, nid).length >= 3) return false;
    if (nationDistance(sim, nid, other) > 2) return false;
    return !!sharedThreat(sim, nid, other) || (!!isThreatened(sim, nid) && p.treaty.alliance >= 0.9) || (n.ai.goal.victory === 'diplomatic' && opinion(sim, nid, other) > 20);
  }
  const threat = isThreatened(sim, nid);
  return threat === other || (p.treaty.nap >= 1.2 && borders(sim, nid, other) && nationStrength(sim, other) > nationStrength(sim, nid) * 1.2);
}

function diplomacy(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const others = aliveNations(sim).filter((o) => o !== nid);
  // proposals: at most one per month
  const order: TreatyType[] = n.ai.goal.victory === 'diplomatic' ? ['trade', 'alliance', 'nap'] : ['alliance', 'nap', 'trade'];
  let proposed = false;
  for (const type of order) {
    if (proposed) break;
    for (const o of others) {
      if (treatyProblem(sim, nid, o, type) || !wantsTreaty(sim, nid, o, type)) continue;
      const last = n.ai.lastProposal[`${o}:${type}`] ?? -1e9;
      const isPlayer = st.nations[o].isPlayer;
      if (st.tick - last < months(isPlayer ? 18 : 6)) continue;
      if (isPlayer) {
        // do not flood a human: one open proposal at a time, at most one every 3 months
        const inbox = st.nations[o].ai.lastProposal['__incoming'] ?? -1e9;
        if (st.proposals.some((x) => x.to === o) || st.tick - inbox < months(3)) continue;
        st.nations[o].ai.lastProposal['__incoming'] = st.tick;
      }
      // mutual interest: would we accept the same from them?
      if (!evaluateTreaty(sim, o, nid, type).accept) continue;
      if (!isPlayer && !evaluateTreaty(sim, nid, o, type).accept) continue;
      n.ai.lastProposal[`${o}:${type}`] = st.tick;
      const r = issue(sim, { type: 'propose', nation: nid, target: o, treaty: type });
      diag(sim, nid, 'strategic', `Proposed ${type} to ${nationName(sim, o)}: ${r.ok ? r.message ?? 'ok' : 'declined'}`);
      proposed = true;
      break;
    }
  }
  // envoys toward nations we want as partners
  const free = envoySlots(sim, nid) - st.envoys.filter((e) => e.from === nid).length;
  if (free > 0 && n.treasury > 20) {
    const targets = others
      .filter((o) => !atWar(sim, nid, o) && !st.envoys.some((e) => e.from === nid && e.to === o) && n.ai.warPlan?.target !== o)
      .map((o) => {
        const op = opinion(sim, o, nid);
        let v = 0;
        if (wantsTreaty(sim, nid, o, 'alliance')) v += 3;
        if (wantsTreaty(sim, nid, o, 'trade')) v += 1.5;
        if (n.ai.goal.victory === 'diplomatic') v += 2;
        if (isThreatened(sim, nid) === o) v += 2;
        if (op >= 50) v -= 3;
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
    const reachable = goal.provinces.filter((pid) => dist[pid] <= range).length;
    if (!reachable) continue;
    const score = value * (ratio / need - 1) * p.aggression;
    cands.push({ t, goal, score, ratio, need, value, notes });
  }
  cands.sort((a, b) => b.score - a.score || (a.t < b.t ? -1 : 1));
  return { cands, napBlocked };
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
    if (pick.score > 0 && (st.tick / 4) % 12 === 0)
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

function occupiedBy(sim: Sim, owner: NationId, side: NationId[]): ProvinceId[] {
  return ownedProvinces(sim, owner).filter((pid) => {
    const c = sim.state.provinces[pid].controller;
    return !!c && side.includes(c);
  });
}

function considerPeace(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const p = pers(sim, nid);
  for (const w of warsOf(sim, nid)) {
    const last = n.ai.lastPeaceTry[w.id] ?? -1e9;
    if (st.tick - last < months(3)) continue;
    const lead = w.attackerLead === nid || w.defenderLead === nid;
    const myAdv = scoreFor(w, nid);
    const age = (st.tick - w.startTick) / 4;
    const other = lead ? (w.attackerLead === nid ? w.defenderLead : w.attackerLead) : w.attackers.includes(nid) ? w.defenderLead : w.attackerLead;
    const mySide = w.attackers.includes(nid) ? w.attackers : w.defenders;
    const tryPeace = (terms: PeaceTerms, why: string) => {
      n.ai.lastPeaceTry[w.id] = st.tick;
      const target = st.nations[other];
      if (target.isPlayer) {
        if (st.proposals.some((x) => x.kind === 'peace' && x.war === w.id)) return false;
        const r = issue(sim, { type: 'peace', nation: nid, war: w.id, with: other, terms });
        diag(sim, nid, 'strategic', `Offered peace to ${nationName(sim, other)} (${why}): ${r.ok ? 'sent' : 'invalid'}`);
        return r.ok;
      }
      const ev = evaluatePeace(sim, w.id, nid, other, terms);
      if (!ev.accept) {
        diag(sim, nid, 'strategic', `Peace ${terms.mode} to ${nationName(sim, other)} would be refused (${Math.round(ev.score)})`);
        return false;
      }
      const r = issue(sim, { type: 'peace', nation: nid, war: w.id, with: other, terms });
      diag(sim, nid, 'strategic', `Peace with ${nationName(sim, other)} (${why}): ${r.ok ? 'agreed' : 'failed'}`);
      return r.ok;
    };
    if (myAdv >= 15) {
      // winning: demand occupied land, war-goal provinces first
      const occ = occupiedBy(sim, other, mySide);
      const goalFirst = [...occ].sort((a, b) => {
        const ga = w.goal.provinces.includes(a) ? 1 : 0;
        const gb = w.goal.provinces.includes(b) ? 1 : 0;
        return gb - ga || st.provinces[b].dev - st.provinces[a].dev || (a < b ? -1 : 1);
      });
      const recvSide = mySide;
      const budget = myAdv * 0.9 + st.nations[other].warExhaustion * 0.3 - 3;
      const provs: ProvinceId[] = [];
      let cost = 0;
      // restraint: large annexations alarm everyone
      const worried = aliveNations(sim).filter((o) => (st.alarm[o]?.[nid] ?? 0) >= 30).length;
      const maxProvs = worried >= 2 ? 2 : 3;
      for (const pid of goalFirst) {
        if (provs.length >= maxProvs) break;
        const c = provinceCost(sim, other, recvSide, pid);
        if (cost + c > budget) continue;
        provs.push(pid);
        cost += c;
      }
      const gold = Math.max(0, Math.min(Math.floor(Math.max(0, st.nations[other].treasury) * 0.5), Math.floor((budget - cost) * C.war.goldPerPoint)));
      if (provs.length || gold >= 50) {
        const terms: PeaceTerms = { mode: 'demand', provinces: provs, gold: provs.length ? Math.min(gold, 200) : gold };
        if (lead || other === w.attackerLead || other === w.defenderLead) if (tryPeace(terms, `winning, score ${Math.round(myAdv)}`)) return;
      }
      continue;
    }
    const tired = n.warExhaustion > 45 || (age > 36 && myAdv < 10) || (!lead && (n.warExhaustion > 30 || myAdv < -10));
    if (myAdv <= -25 || tired) {
      if (tryPeace({ mode: 'white', provinces: [], gold: 0 }, `losing/tired, score ${Math.round(myAdv)}`)) return;
      if (myAdv <= -35 && lead) {
        // concede occupied land to end a losing war
        const theirSide = w.attackers.includes(nid) ? w.defenders : w.attackers;
        const lost = occupiedBy(sim, nid, theirSide).filter((pid) => pid !== n.capital).sort((a, b) => st.provinces[a].dev - st.provinces[b].dev || (a < b ? -1 : 1));
        const provs: ProvinceId[] = [];
        let cost = 0;
        const want = -myAdv * 0.75 + p.stubborn * -0.2;
        for (const pid of lost) {
          if (cost >= want) break;
          provs.push(pid);
          cost = termsCost(sim, w, nid, other, { mode: 'concede', provinces: provs, gold: 0 });
        }
        if (provs.length) tryPeace({ mode: 'concede', provinces: provs, gold: 0 }, 'conceding to end a lost war');
      }
    }
  }
}

// ───────────────────────────── Goal & rally ─────────────────────────────────

function chooseGoal(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
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
  choosePolicy(sim, nid);
  considerPeace(sim, nid);
  planConstruction(sim, nid);
  diplomacy(sim, nid);
  considerWar(sim, nid);
  // rivals close to victory make everyone nervous
  const rival = rivalLeader(sim, nid);
  if (rival) {
    if (rival.path === 'diplomatic') {
      // a peaceful bid breeds wariness (opinion), not fear of conquest (alarm, coalitions)
      const m = memoriesOf(sim, nid, rival.nid).find((x) => x.kind === 'rivalBid');
      if (!m || m.value > -C.diplomacy.rivalBidCap) addMemory(sim, nid, rival.nid, 'rivalBid', -1, 0.3);
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
