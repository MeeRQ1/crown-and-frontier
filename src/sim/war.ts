// Wars, war score, peace and territorial transfer.
//
// War score (attacker perspective, −100..100) =
//     occupation of the defenders' land (weighted dev, capitals x2, % of their total)
//   − occupation of the attackers' land
//   + battle score (±30, from battle results)
//   + goal score (±25: +1/month while the attackers hold every war-goal province,
//                  −1/month after the first year if they hold none)
// Peace: ceding a province costs 100 * its weight / the giver's total weight
// (min 5, x1.5 if the receiver does not occupy it); 20 crowns = 1 point.
// Unresolvable wars: a white peace is forced after 96 months, or after 36
// months within ±10; a side holding ≥90 for 12 months imposes its war goal.

import { C } from './config';
import { PERSONALITIES } from './data/personalities';
import {
  addAlarm,
  addMemory,
  alarmForConquest,
  claimsOn,
  claimsOnlyPolicy,
  coalitionAgainst,
  removeTreaty,
  type Evaluation,
  type OpinionPart,
} from './diplomacy';
import { poolCap, stockpileCap } from './economy';
import { cancelRecruits, removeArmy } from './military';
import { pruneBattles } from './combat';
import { nationMods } from './modifiers';
import { canEnter, findPath } from './movement';
import {
  aliveNations,
  alliesOf,
  armiesOf,
  atWar,
  bump,
  dateOf,
  enemiesOf,
  hasTreaty,
  months,
  nationName,
  notify,
  ownedProvinces,
  provName,
  sideOf,
  truceUntil,
  warsOf,
  type Sim,
} from './state';
import type { NationId, PeaceTerms, ProvinceId, War, WarGoal } from './types';

// ───────────────────────────── Goals & declaration ──────────────────────────

export function conquestTargets(sim: Sim, attacker: NationId, target: NationId): ProvinceId[] {
  const st = sim.state;
  return sim.world.provIds
    .filter((pid) => st.provinces[pid].owner === target && sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === attacker))
    .sort((a, b) => st.provinces[b].dev - st.provinces[a].dev || (a < b ? -1 : 1));
}

export function goalOptions(sim: Sim, attacker: NationId, target: NationId): WarGoal[] {
  const out: WarGoal[] = [];
  const claims = claimsOn(sim, attacker, target)
    .sort((a, b) => sim.state.provinces[b].dev - sim.state.provinces[a].dev || (a < b ? -1 : 1))
    .slice(0, 3);
  if (claims.length) out.push({ type: 'claim', provinces: claims });
  if (!claimsOnlyPolicy(sim, attacker)) {
    const cq = conquestTargets(sim, attacker, target).slice(0, 2);
    if (cq.length) out.push({ type: 'conquest', provinces: cq });
  }
  const coal = coalitionAgainst(sim, target);
  if (coal?.members.includes(attacker)) {
    const members = coal.members;
    const provs = sim.world.provIds
      .filter((pid) => sim.state.provinces[pid].owner === target && sim.world.prov[pid].neighbors.some((nb) => members.includes(sim.state.provinces[nb].owner ?? '')))
      .sort((a, b) => sim.state.provinces[b].dev - sim.state.provinces[a].dev || (a < b ? -1 : 1))
      .slice(0, 3);
    if (provs.length) out.push({ type: 'coalition', provinces: provs });
  }
  return out;
}

export function declareWarProblem(sim: Sim, attacker: NationId, target: NationId, goal: WarGoal): string | null {
  const st = sim.state;
  if (!st.nations[attacker]?.alive || !st.nations[target]?.alive) return 'That realm no longer exists.';
  if (attacker === target) return 'Cannot declare war on yourself.';
  if (atWar(sim, attacker, target)) return 'Already at war with them.';
  const truce = truceUntil(sim, attacker, target);
  if (truce > st.tick) return `Truce in force until ${dateOf(sim, truce).short}.`;
  if (hasTreaty(sim, 'nap', attacker, target)) return 'A non-aggression pact forbids war. Cancelling it imposes a 12-month cooling-off period.';
  if (hasTreaty(sim, 'alliance', attacker, target)) return 'Cannot attack an ally.';
  if (!goal || !Array.isArray(goal.provinces) || goal.provinces.length === 0) return 'Choose a war goal.';
  for (const pid of goal.provinces) {
    const p = st.provinces[pid];
    if (!p || p.owner !== target) return 'War-goal provinces must belong to the target.';
  }
  if (goal.type === 'claim') {
    if (goal.provinces.some((pid) => !st.provinces[pid].claims.includes(attacker))) return 'We hold no claim on every goal province.';
  } else if (goal.type === 'conquest') {
    if (claimsOnlyPolicy(sim, attacker)) return 'Concord Diplomacy forbids wars without a claim.';
    const ok = conquestTargets(sim, attacker, target);
    if (goal.provinces.length > 2 || goal.provinces.some((pid) => !ok.includes(pid))) return 'Conquest goals must be up to two provinces bordering our land.';
  } else if (goal.type === 'coalition') {
    if (!coalitionAgainst(sim, target)?.members.includes(attacker)) return 'Only coalition members may declare a coalition war.';
  } else return 'Unknown war goal.';
  return null;
}

function warName(sim: Sim, attacker: NationId, target: NationId, goal: WarGoal): string {
  const a = sim.world.nationDefs[attacker].adjective;
  const t = sim.world.nationDefs[target].adjective;
  if (goal.type === 'coalition') return `Coalition War against ${nationName(sim, target)}`;
  return `${a}–${t} War`;
}

export function declareWar(sim: Sim, attacker: NationId, target: NationId, goal: WarGoal): War {
  const st = sim.state;
  st.counters.war++;
  const w: War = {
    id: `w${st.counters.war}`,
    name: warName(sim, attacker, target, goal),
    attackerLead: attacker,
    defenderLead: target,
    attackers: [attacker],
    defenders: [target],
    goal: { type: goal.type, provinces: [...goal.provinces] },
    startTick: st.tick,
    battleScore: 0,
    goalScore: 0,
    score: 0,
    stalemateMonths: 0,
    dominantMonths: 0,
  };
  st.wars[w.id] = w;
  const an = st.nations[attacker];
  an.stats.warsDeclared++;
  addMemory(sim, target, attacker, 'war', -50, 0.4);
  if (goal.type === 'conquest') {
    an.trust = Math.max(0, an.trust - C.war.conquestTrustLoss);
    for (const nid of aliveNations(sim)) {
      if (nid === attacker || nid === target) continue;
      const near = ownedProvinces(sim, nid).some((q) => ownedProvinces(sim, target).some((p) => (sim.world.hops[q][p] ?? 99) <= 1));
      if (near) addAlarm(sim, nid, attacker, 8);
    }
  }
  // trade between the belligerents ends
  removeTreaty(sim, 'trade', attacker, target);
  notify(sim, null, 'normal', 'war', `${nationName(sim, attacker)} declares war on ${nationName(sim, target)} (${w.name}).`);
  notify(sim, target, 'urgent', 'war', `${nationName(sim, attacker)} has declared war on us! War goal: ${goal.provinces.map((p) => provName(sim, p)).join(', ')}.`);
  notify(sim, attacker, 'normal', 'war', `We declared war on ${nationName(sim, target)}.`);

  if (goal.type === 'coalition') {
    const c = coalitionAgainst(sim, target);
    for (const m of c?.members ?? []) {
      if (m === attacker || !canJoin(sim, m, w, 'attacker')) continue;
      joinWar(sim, w, m, 'attacker');
    }
  }
  callDefenders(sim, w, target);
  bump(sim);
  return w;
}

/** Can `nid` join `w` on `side` without contradicting a treaty? */
export function canJoin(sim: Sim, nid: NationId, w: War, side: 'attacker' | 'defender'): boolean {
  const st = sim.state;
  if (!st.nations[nid]?.alive) return false;
  if (w.attackers.includes(nid) || w.defenders.includes(nid)) return false;
  const opp = side === 'attacker' ? w.defenders : w.attackers;
  const own = side === 'attacker' ? w.attackers : w.defenders;
  for (const o of opp) {
    if (hasTreaty(sim, 'alliance', nid, o) || hasTreaty(sim, 'nap', nid, o)) return false;
    if (truceUntil(sim, nid, o) > st.tick && side === 'attacker') return false;
  }
  for (const o of own) if (atWar(sim, nid, o)) return false;
  return true;
}

export function joinWar(sim: Sim, w: War, nid: NationId, side: 'attacker' | 'defender'): void {
  (side === 'attacker' ? w.attackers : w.defenders).push(nid);
  const opp = side === 'attacker' ? w.defenders : w.attackers;
  for (const o of opp) removeTreaty(sim, 'trade', nid, o);
  notify(sim, null, 'low', 'war', `${nationName(sim, nid)} joins the ${w.name} on the ${side === 'attacker' ? 'attacking' : 'defending'} side.`);
  notify(sim, nid, 'urgent', 'war', `We have entered the ${w.name}.`);
  bump(sim);
}

function callDefenders(sim: Sim, w: War, target: NationId): void {
  const st = sim.state;
  const called = new Set<NationId>();
  const coal = coalitionAgainst(sim, w.attackerLead);
  if (coal?.members.includes(target)) for (const m of coal.members) if (m !== target) called.add(m);
  for (const a of alliesOf(sim, target)) called.add(a);
  for (const nid of [...called].sort()) {
    if (nid === w.attackerLead) continue;
    const isAlly = hasTreaty(sim, 'alliance', nid, target);
    if (!canJoin(sim, nid, w, 'defender')) {
      if (isAlly) {
        notify(sim, target, 'normal', 'war', `${nationName(sim, nid)} cannot answer our call: conflicting commitments with the enemy.`);
        if (st.nations[nid].isPlayer)
          notify(sim, nid, 'normal', 'war', `Our ally ${nationName(sim, target)} is under attack by ${nationName(sim, w.attackerLead)}, but we cannot join: a treaty with their side or a war with ${nationName(sim, target)}'s side prevents it. The alliance stays intact.`);
      }
      continue;
    }
    const n = st.nations[nid];
    if (n.isPlayer && isAlly) {
      st.counters.proposal++;
      st.proposals.push({ id: `pr${st.counters.proposal}`, kind: 'callToArms', from: target, to: nid, tick: st.tick, expires: st.tick + C.diplomacy.proposalWeeks, war: w.id });
      notify(sim, nid, 'urgent', 'callToArms', `Our ally ${nationName(sim, target)} was attacked by ${nationName(sim, w.attackerLead)} and calls us to arms. We join automatically in 4 weeks unless we decline (declining breaks the alliance and costs trust).`);
      continue;
    }
    if (!isAlly || aiHonours(sim, nid, w)) {
      joinWar(sim, w, nid, 'defender');
      if (isAlly) {
        n.trust = Math.min(100, n.trust + 3);
        addMemory(sim, target, nid, 'honored', 20, 0.3);
        addMemory(sim, nid, w.attackerLead, 'allyAttacked', -20, 0.5);
      }
    } else dishonour(sim, nid, target);
  }
}

function aiHonours(sim: Sim, nid: NationId, w: War): boolean {
  const n = sim.state.nations[nid];
  if (n.warExhaustion >= 60) return false;
  const wars = warsOf(sim, nid);
  if (wars.length >= 2) return false;
  // already fighting on another front and tiring: a second front is refused
  if (wars.length && n.warExhaustion >= C.ai.secondFrontExhaustion && !enemiesOf(sim, nid).includes(w.attackerLead)) return false;
  return true;
}

export function dishonour(sim: Sim, nid: NationId, ally: NationId): void {
  const n = sim.state.nations[nid];
  removeTreaty(sim, 'alliance', nid, ally);
  n.trust = Math.max(0, n.trust - 15);
  addMemory(sim, ally, nid, 'dishonored', -35, 0.3);
  notify(sim, ally, 'urgent', 'war', `${nationName(sim, nid)} refused our call to arms. The alliance is broken.`);
  notify(sim, nid, 'normal', 'war', `We declined ${nationName(sim, ally)}'s call to arms; the alliance is broken and our trust suffers.`);
}

export function answerCallToArms(sim: Sim, nid: NationId, warId: string, from: NationId, accept: boolean): void {
  const w = sim.state.wars[warId];
  if (!w) return;
  if (accept && canJoin(sim, nid, w, 'defender')) {
    joinWar(sim, w, nid, 'defender');
    sim.state.nations[nid].trust = Math.min(100, sim.state.nations[nid].trust + 3);
    addMemory(sim, from, nid, 'honored', 20, 0.3);
    addMemory(sim, nid, w.attackerLead, 'allyAttacked', -20, 0.5);
  } else if (!accept) dishonour(sim, nid, from);
}

// ───────────────────────────── War score ────────────────────────────────────

function provWeight(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  let w = p.dev + 1;
  if (p.owner && sim.state.nations[p.owner]?.capital === pid) w *= 2;
  return w;
}

export interface ScoreBreakdown {
  total: number;
  occAtt: number;
  occDef: number;
  battle: number;
  goal: number;
}

export function computeWarScore(sim: Sim, w: War): ScoreBreakdown {
  const st = sim.state;
  let defTotal = 0;
  let attTotal = 0;
  let defOcc = 0;
  let attOcc = 0;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.owner) continue;
    const wt = provWeight(sim, pid);
    if (w.defenders.includes(p.owner)) {
      defTotal += wt;
      if (p.controller && w.attackers.includes(p.controller)) defOcc += wt;
    } else if (w.attackers.includes(p.owner)) {
      attTotal += wt;
      if (p.controller && w.defenders.includes(p.controller)) attOcc += wt;
    }
  }
  const occAtt = defTotal > 0 ? (defOcc / defTotal) * 100 : 0;
  const occDef = attTotal > 0 ? (attOcc / attTotal) * 100 : 0;
  const total = Math.max(-100, Math.min(100, occAtt - occDef + w.battleScore + w.goalScore));
  return { total, occAtt, occDef, battle: w.battleScore, goal: w.goalScore };
}

/** War score from the point of view of `nid`. */
export function scoreFor(w: War, nid: NationId): number {
  return sideOf(w, nid) === 'defender' ? -w.score : w.score;
}

export function weeklyWarScores(sim: Sim): void {
  for (const id of Object.keys(sim.state.wars).sort()) {
    const w = sim.state.wars[id];
    w.score = computeWarScore(sim, w).total;
  }
}

// ───────────────────────────── Peace ────────────────────────────────────────

export function provinceCost(sim: Sim, giver: NationId, receiverSide: NationId[], pid: ProvinceId): number {
  let total = 0;
  for (const q of ownedProvinces(sim, giver)) total += provWeight(sim, q);
  let cost = Math.max(C.war.provinceBaseCost, (100 * provWeight(sim, pid)) / Math.max(1, total));
  const ctrl = sim.state.provinces[pid].controller;
  if (!ctrl || !receiverSide.includes(ctrl)) cost *= C.war.unoccupiedMul;
  return Math.round(cost);
}

export function termsCost(sim: Sim, w: War, giver: NationId, receiver: NationId, terms: PeaceTerms): number {
  if (terms.mode === 'white') return 0;
  const recvSide = sideOf(w, receiver) === 'attacker' ? w.attackers : w.defenders;
  let c = 0;
  for (const pid of terms.provinces) c += provinceCost(sim, giver, recvSide, pid);
  c += Math.max(0, terms.gold) / C.war.goldPerPoint;
  return Math.round(c);
}

export function peaceProblem(sim: Sim, nid: NationId, warId: string, other: NationId, terms: PeaceTerms): string | null {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return 'That war is over.';
  const s1 = sideOf(w, nid);
  const s2 = sideOf(w, other);
  if (!s1 || !s2 || s1 === s2) return 'Peace must be made with a nation on the opposing side.';
  const leaders = [w.attackerLead, w.defenderLead];
  if (!leaders.includes(nid) && !leaders.includes(other)) return 'A separate peace must be made with the opposing war leader.';
  if (sim.state.proposals.some((p) => p.kind === 'peace' && p.war === warId && p.from === other && p.to === nid))
    return `${nationName(sim, other)} has already sent us an offer: answer it first (decisions waiting).`;
  if (sim.state.proposals.some((p) => p.kind === 'peace' && p.war === warId && p.from === nid && p.to === other)) return 'Our offer is still awaiting their answer.';
  if (!terms || !['white', 'demand', 'concede'].includes(terms.mode)) return 'Invalid terms.';
  const giver = terms.mode === 'demand' ? other : nid;
  if (terms.mode !== 'white') {
    if (!Array.isArray(terms.provinces) || !Number.isFinite(terms.gold) || terms.gold < 0) return 'Invalid terms.';
    if (terms.provinces.length === 0 && terms.gold <= 0) return 'Terms must include land or gold (or offer a white peace).';
    for (const pid of terms.provinces) {
      const p = st.provinces[pid];
      if (!p || p.owner !== giver) return `${provName(sim, pid)} is not owned by ${nationName(sim, giver)}.`;
    }
    if (new Set(terms.provinces).size !== terms.provinces.length) return 'Duplicate provinces in terms.';
    if (terms.gold > Math.max(0, st.nations[giver].treasury)) return `${nationName(sim, giver)} cannot pay ${Math.round(terms.gold)} crowns (treasury ${Math.floor(Math.max(0, st.nations[giver].treasury))}).`;
  }
  return null;
}

function hasArmies(sim: Sim, nid: NationId): boolean {
  return armiesOf(sim, nid).length > 0;
}

/** How `target` would judge a peace offer from `proposer`. */
export function evaluatePeace(sim: Sim, warId: string, proposer: NationId, target: NationId, terms: PeaceTerms): Evaluation {
  const st = sim.state;
  const w = st.wars[warId];
  const reasons: OpinionPart[] = [];
  const add = (label: string, value: number) => {
    if (Math.abs(value) >= 0.5) reasons.push({ label, value: Math.round(value) });
  };
  const t = st.nations[target];
  const pers = PERSONALITIES[t.ai.personality];
  const adv = scoreFor(w, target); // target's advantage
  const ageMonths = (st.tick - w.startTick) / 4;
  if (terms.mode === 'white') {
    add(`War score in our favour (${Math.round(adv)})`, -Math.max(0, adv));
    add('Willing to settle', 10);
    add(`War exhaustion (${Math.round(t.warExhaustion)})`, t.warExhaustion * 0.4);
    if (adv < 0) add('We are losing', -adv * 0.5);
    if (ageMonths > 36) add('A long war', 10);
    add(`${pers.label} stubbornness`, -pers.stubborn);
    // the war goal is against the defending leader; a secondary defender cannot meet it
    if (target === w.attackerLead && proposer === w.defenderLead && ageMonths < 12) add('Our war goals are unmet', -15);
  } else if (terms.mode === 'demand') {
    const cost = termsCost(sim, w, target, proposer, terms);
    add(`Cost of their demands (${cost})`, -cost);
    add(`War score in their favour (${Math.round(-adv)})`, Math.max(0, -adv));
    add(`War exhaustion (${Math.round(t.warExhaustion)})`, t.warExhaustion * 0.4);
    if (!hasArmies(sim, target) && adv < 0) add('We have no army left', 20);
    if (ageMonths > 60) add('A long war', 10);
    add(`${pers.label} stubbornness`, -pers.stubborn);
    add('Pride', -5);
  } else {
    const cost = termsCost(sim, w, proposer, target, terms);
    add(`Value of their concessions (${cost})`, cost);
    const want = Math.max(0, adv) * 0.7;
    add(`War score in our favour (${Math.round(adv)})`, -want);
    add(`War exhaustion (${Math.round(t.warExhaustion)})`, t.warExhaustion * 0.3);
    add('Willing to settle', 5);
  }
  if (t.warExhaustion >= 100 && terms.mode !== 'concede') add('Exhausted: must accept', 200);
  const score = reasons.reduce((s, r) => s + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

/** Returns occupied provinces between two groups to their owners. */
function restoreControl(sim: Sim, groupA: NationId[], groupB: NationId[]): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.owner || !p.controller || p.owner === p.controller) continue;
    if ((groupA.includes(p.owner) && groupB.includes(p.controller)) || (groupB.includes(p.owner) && groupA.includes(p.controller))) {
      p.controller = p.owner;
      p.siege = null;
    }
  }
}

export function applyPeace(sim: Sim, warId: string, proposer: NationId, target: NationId, terms: PeaceTerms): void {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return;
  const giver = terms.mode === 'demand' ? target : proposer;
  const receiver = terms.mode === 'demand' ? proposer : target;
  const full = [w.attackerLead, w.defenderLead].includes(proposer) && [w.attackerLead, w.defenderLead].includes(target);
  if (full) {
    restoreControl(sim, w.attackers, w.defenders);
  } else {
    const minor = [w.attackerLead, w.defenderLead].includes(proposer) ? target : proposer;
    const oppSide = sideOf(w, minor) === 'attacker' ? w.defenders : w.attackers;
    restoreControl(sim, [minor], oppSide);
  }
  if (terms.mode !== 'white') {
    for (const pid of terms.provinces) {
      if (st.provinces[pid].owner === giver) {
        transferProvince(sim, pid, receiver);
        addMemory(sim, giver, receiver, 'conquest', -15, 0.2);
      }
    }
    const gold = Math.min(terms.gold, Math.max(0, st.nations[giver].treasury));
    if (gold > 0 && st.nations[giver].alive) {
      st.nations[giver].treasury -= gold;
      st.nations[receiver].treasury += gold;
    }
  }
  const desc =
    terms.mode === 'white'
      ? 'white peace'
      : `${nationName(sim, giver)} cedes ${terms.provinces.length ? terms.provinces.map((p) => provName(sim, p)).join(', ') : 'no land'}${terms.gold ? ` and pays ${Math.round(terms.gold)} crowns` : ''}`;
  if (st.wars[warId]) {
    if (full) {
      for (const a of w.attackers) for (const d of w.defenders) st.truces.push({ a, b: d, until: st.tick + months(C.diplomacy.truceMonths) });
      for (const n of [...w.attackers, ...w.defenders]) {
        if (!st.nations[n]?.alive) continue;
        st.nations[n].stats.peacesMade++;
        st.nations[n].ai.lastWarEnd = st.tick;
        st.nations[n].ai.warPlan = null;
        notify(sim, n, 'urgent', 'peace', `Peace: the ${w.name} is over (${desc}).`);
      }
      delete st.wars[warId];
    } else {
      const minor = [w.attackerLead, w.defenderLead].includes(proposer) ? target : proposer;
      const lead = minor === proposer ? target : proposer;
      // allies left fighting resent a separate peace
      for (const ally of sideOf(w, minor) === 'attacker' ? w.attackers : w.defenders) {
        if (ally === minor || !hasTreaty(sim, 'alliance', ally, minor)) continue;
        addMemory(sim, ally, minor, 'separatePeace', -15, 0.3);
        notify(sim, ally, 'normal', 'peace', `${nationName(sim, minor)} made a separate peace and left us to fight on.`);
      }
      w.attackers = w.attackers.filter((n) => n !== minor);
      w.defenders = w.defenders.filter((n) => n !== minor);
      st.truces.push({ a: minor, b: lead, until: st.tick + months(C.diplomacy.truceMonths) });
      for (const n of [minor, lead]) {
        if (!st.nations[n]?.alive) continue;
        st.nations[n].stats.peacesMade++;
        notify(sim, n, 'urgent', 'peace', `Separate peace between ${nationName(sim, minor)} and ${nationName(sim, lead)} (${desc}).`);
      }
      st.nations[minor].ai.lastWarEnd = st.tick;
      st.nations[minor].ai.warPlan = null;
    }
  }
  notify(sim, null, 'low', 'peace', `${nationName(sim, proposer)} and ${nationName(sim, target)} made peace: ${desc}.`);
  relocateArmies(sim);
  pruneBattles(sim);
  bump(sim);
}

/** Ends a war outright with a white peace (forced settlements, eliminated leaders). */
export function endWar(sim: Sim, warId: string, reason: string): void {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return;
  restoreControl(sim, w.attackers, w.defenders);
  for (const a of w.attackers) for (const d of w.defenders) st.truces.push({ a, b: d, until: st.tick + months(C.diplomacy.truceMonths) });
  for (const n of [...w.attackers, ...w.defenders]) {
    if (!st.nations[n]?.alive) continue;
    st.nations[n].ai.lastWarEnd = st.tick;
    st.nations[n].ai.warPlan = null;
    notify(sim, n, 'urgent', 'peace', `The ${w.name} has ended: ${reason}`);
  }
  delete st.wars[warId];
  relocateArmies(sim);
  pruneBattles(sim);
  bump(sim);
}

/** Armies standing where they no longer have access return to the nearest controlled province. */
export function relocateArmies(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.armies).sort()) {
    const a = st.armies[id];
    if (!a || canEnter(sim, a.nation, a.location)) {
      if (a && a.path.length && !a.retreating && !canEnter(sim, a.nation, a.path[a.path.length - 1])) {
        notify(sim, a.nation, 'normal', 'move', `${a.name} halted: the peace closed its route to ${provName(sim, a.path[a.path.length - 1])}.`, { army: a.id, province: a.location });
        a.path = [];
        a.progress = 0;
      }
      continue;
    }
    const hops = sim.world.hops[a.location];
    let best: ProvinceId | null = null;
    let bd = Infinity;
    for (const pid of sim.world.provIds) {
      if (st.provinces[pid].controller !== a.nation) continue;
      const d = hops[pid] ?? Infinity;
      if (d < bd || (d === bd && best !== null && pid < best)) {
        bd = d;
        best = pid;
      }
    }
    if (!best) {
      removeArmy(sim, id);
      continue;
    }
    a.location = best;
    a.path = [];
    a.progress = 0;
    a.retreating = false;
    a.battle = null;
    notify(sim, a.nation, 'low', 'move', `${a.name} withdrew to ${provName(sim, best)} after the peace.`, { army: a.id, province: best });
  }
}

// ───────────────────────────── Territory ────────────────────────────────────

export function transferProvince(sim: Sim, pid: ProvinceId, to: NationId): void {
  const st = sim.state;
  const p = st.provinces[pid];
  const from = p.owner;
  if (from === to) return;
  cancelRecruits(sim, pid);
  if (p.project && p.project.nation !== to) p.project = null;
  p.owner = to;
  p.controller = to;
  p.siege = null;
  p.integration = p.claims.includes(to) ? C.integration.conqueredClaim : C.integration.conquered;
  p.unrest = Math.max(p.unrest, 30);
  p.revoltUntil = 0;
  p.lastOwnerChange = st.tick;
  if (from && !p.claims.includes(from)) p.claims.push(from);
  p.claims = p.claims.filter((c) => c !== to);
  const tn = st.nations[to];
  tn.stats.provincesGained++;
  tn.stats.peakProvinces = Math.max(tn.stats.peakProvinces, ownedProvinces(sim, to).length);
  if (from) {
    const fn = st.nations[from];
    fn.stats.provincesLost++;
    alarmForConquest(sim, to, pid);
    if (fn.capital === pid) relocateCapital(sim, from);
    fn.manpower = Math.min(fn.manpower, poolCap(sim, from));
    fn.supplies = Math.min(fn.supplies, stockpileCap(sim, from));
    if (ownedProvinces(sim, from).length === 0) eliminate(sim, from, to);
  }
  bump(sim);
}

export function relocateCapital(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const owned = ownedProvinces(sim, nid);
  const n = st.nations[nid];
  if (!owned.length) {
    n.capital = null;
    return;
  }
  const best = [...owned].sort((a, b) => {
    const pa = st.provinces[a];
    const pb = st.provinces[b];
    const sa = (pa.controller === nid ? 100 : 0) + (pa.integration >= 50 ? 50 : 0) + pa.dev;
    const sb = (pb.controller === nid ? 100 : 0) + (pb.integration >= 50 ? 50 : 0) + pb.dev;
    return sb - sa || (a < b ? -1 : 1);
  })[0];
  n.capital = best;
  st.provinces[best].integration = Math.max(st.provinces[best].integration, 50);
  for (const pid of owned) st.provinces[pid].unrest = Math.min(100, st.provinces[pid].unrest + 10);
  n.treasury -= 50;
  notify(sim, nid, 'urgent', 'capital', `Our capital has fallen into foreign hands. The court moves to ${provName(sim, best)} (unrest +10, 50 crowns).`, { province: best });
}

export function eliminate(sim: Sim, nid: NationId, by: NationId | null): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (!n.alive) return;
  n.alive = false;
  n.eliminatedTick = st.tick;
  n.capital = null;
  for (const a of armiesOf(sim, nid)) removeArmy(sim, a.id);
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    p.recruits = p.recruits.filter((r) => r.nation !== nid);
    if (p.project?.nation === nid) p.project = null;
    if (p.controller === nid) p.controller = p.owner;
    if (p.siege?.nation === nid) p.siege = null;
  }
  st.treaties = st.treaties.filter((t) => t.a !== nid && t.b !== nid);
  st.envoys = st.envoys.filter((e) => e.from !== nid && e.to !== nid);
  st.fabrications = st.fabrications.filter((f) => f.nation !== nid);
  st.proposals = st.proposals.filter((p) => p.from !== nid && p.to !== nid);
  st.coalitions = st.coalitions.filter((c) => c.target !== nid);
  for (const c of st.coalitions) c.members = c.members.filter((m) => m !== nid);
  st.coalitions = st.coalitions.filter((c) => c.members.length >= 2);
  for (const id of Object.keys(st.wars).sort()) {
    const w = st.wars[id];
    if (w.attackerLead === nid || w.defenderLead === nid) {
      w.attackers = w.attackers.filter((x) => x !== nid);
      w.defenders = w.defenders.filter((x) => x !== nid);
      endWar(sim, id, `${nationName(sim, nid)} has ceased to exist.`);
    } else {
      w.attackers = w.attackers.filter((x) => x !== nid);
      w.defenders = w.defenders.filter((x) => x !== nid);
    }
  }
  notify(sim, null, 'urgent', 'eliminated', `${sim.world.nationDefs[nid].name} has been destroyed${by ? ` by ${nationName(sim, by)}` : ''}.`);
  bump(sim);
}

// ───────────────────────────── Monthly war upkeep ───────────────────────────

/**
 * Armies left in foreign land they may no longer stand in, or with no legal
 * route home (for example after a war ended or an alliance lapsed), return
 * under safe conduct, as after a peace.
 */
export function returnStrandedArmies(sim: Sim): void {
  const st = sim.state;
  for (const id of Object.keys(st.armies).sort()) {
    const a = st.armies[id];
    if (a.battle || a.retreating || a.path.length) continue;
    const ctrl = st.provinces[a.location].controller;
    if (ctrl === a.nation || (ctrl && atWar(sim, a.nation, ctrl))) continue;
    const hops = sim.world.hops[a.location];
    const home = sim.world.provIds
      .filter((pid) => st.provinces[pid].controller === a.nation)
      .sort((x, y) => (hops[x] ?? Infinity) - (hops[y] ?? Infinity) || (x < y ? -1 : 1));
    if (!home.length) continue;
    if (canEnter(sim, a.nation, a.location) && home.some((pid) => findPath(sim, a.nation, a.location, pid))) continue;
    const from = a.location;
    a.location = home[0];
    a.progress = 0;
    notify(sim, a.nation, 'normal', 'move', `${a.name} had no legal route home from ${provName(sim, from)} and returned to ${provName(sim, home[0])} under safe conduct.`, { army: a.id, province: home[0] });
    bump(sim);
  }
}

export function monthlyWars(sim: Sim): void {
  const st = sim.state;
  returnStrandedArmies(sim);
  const atWarSet = new Set<NationId>();
  for (const id of Object.keys(st.wars).sort()) {
    const w = st.wars[id];
    if (!st.wars[id]) continue;
    for (const n of [...w.attackers, ...w.defenders]) atWarSet.add(n);
    // goal score
    const held = w.goal.provinces.filter((pid) => {
      const c = st.provinces[pid].controller;
      return !!c && w.attackers.includes(c);
    }).length;
    const age = (st.tick - w.startTick) / 4;
    if (held === w.goal.provinces.length && held > 0) w.goalScore = Math.min(C.war.goalScoreCap, w.goalScore + 1);
    else if (held === 0 && age >= C.war.goalTickMonths) w.goalScore = Math.max(-C.war.goalScoreCap, w.goalScore - 1);
    w.score = computeWarScore(sim, w).total;
    if (Math.abs(w.score) <= C.war.stalemateBand) w.stalemateMonths++;
    else w.stalemateMonths = 0;
    if (Math.abs(w.score) >= 90) w.dominantMonths++;
    else w.dominantMonths = 0;
    if (age >= C.war.forcedPeaceMonths) {
      endWar(sim, id, 'after eight years of fighting, exhaustion forces a white peace.');
      continue;
    }
    if (w.stalemateMonths >= C.war.stalemateMonths) {
      endWar(sim, id, 'three years of stalemate force a white peace.');
      continue;
    }
    if (w.dominantMonths >= 12) {
      // the dominant side imposes its terms
      if (w.score > 0) {
        const terms: PeaceTerms = { mode: 'demand', provinces: w.goal.provinces.filter((p) => st.provinces[p].owner === w.defenderLead), gold: 0 };
        notify(sim, null, 'normal', 'peace', `${nationName(sim, w.defenderLead)} capitulates after a year of total defeat.`);
        applyPeace(sim, id, w.attackerLead, w.defenderLead, terms);
      } else {
        const gold = Math.floor(Math.max(0, st.nations[w.attackerLead].treasury) * 0.5);
        notify(sim, null, 'normal', 'peace', `${nationName(sim, w.attackerLead)} capitulates after a year of total defeat.`);
        applyPeace(sim, id, w.defenderLead, w.attackerLead, { mode: 'demand', provinces: [], gold });
      }
      continue;
    }
  }
  // exhaustion
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    const mul = Math.max(0.1, 1 + nationMods(sim, nid).warExhaustion);
    if (atWarSet.has(nid)) {
      let total = 0;
      let occ = 0;
      for (const pid of ownedProvinces(sim, nid)) {
        const p = st.provinces[pid];
        total += p.dev;
        if (p.controller !== nid) occ += p.dev;
      }
      n.warExhaustion = Math.min(100, n.warExhaustion + (C.war.exhaustionPerMonth + (total ? (occ / total) * C.war.exhaustionOccupation : 0)) * mul);
    } else n.warExhaustion = Math.max(0, n.warExhaustion - C.war.exhaustionDecay);
  }
}
