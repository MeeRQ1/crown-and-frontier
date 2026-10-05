// Peace settlements with several parties and graded demands.
//
// A war leader proposes a settlement to the opposing leader: a list of
// demands, each from a realm on the losing side to a realm on the winning
// side (src/sim/types.ts, Demand). It ends the war for everyone.
//
// Cost of a demand (war-score points, as for separate peace):
//   cede         100 × province weight / giver's total weight (min 5; × 1.5 if the
//                receiver's side does not occupy it; × 0.8 if the receiver claims it)
//   gold         1 per 20 crowns
//   reparations  8 per 10% of the giver's income (paid for five years)
//   disarm       12 (army limited to half its regiments, at least 3, for five years)
//   renounce     5  (claims on the receiver dropped; no war on it for ten years)
//   sphere       15 (the receiver gains 40 influence over the giver; rivals' halved)
// The losing leader accepts when its score is >= 0: minus the cost (demands on
// its allies weighed at 60%), plus the war score against it, its exhaustion, a
// long war, having no army left; minus stubbornness and pride. A refused
// settlement can be answered with a counter-offer: the most expensive demands
// struck out until the rest would be accepted.
//
// Graded by contribution: each winner's contribution (battles won, casualties
// inflicted, ships sunk, enemy land held each month; the leader counts 25% more)
// sets its share of the spoils. The AI fills each winner's share with the
// demands that suit it. A winner given less than half its fair share resents
// the leader; one whose claim was handed to another resents the receiver.

import { C } from './config';
import { PERSONALITIES } from './data/personalities';
import { addMemory, type Evaluation, type OpinionPart } from './diplomacy';
import { grossIncome, totalDev } from './economy';
import { addInfluence, armyCap } from './influence';
import { nationPotential } from './military';
import {
  aliveNations,
  armiesOf,
  borders,
  bump,
  months,
  nationName,
  notify,
  ownedProvinces,
  provName,
  sideOf,
  type Sim,
} from './state';
import type { Demand, DemandKind, NationId, ProvinceId, War } from './types';
import { dropStaleProposals, hasArmies, provinceCost, relocateArmies, restoreControl, scoreFor, transferProvince } from './war';
import { pruneBattles } from './combat';

export const DEMAND_LABELS: Record<DemandKind, string> = {
  cede: 'Cede a province',
  gold: 'Pay crowns',
  reparations: 'Pay reparations',
  disarm: 'Disarm',
  renounce: 'Renounce claims',
  sphere: 'Enter our sphere',
};

export function describeDemand(sim: Sim, d: Demand): string {
  const from = nationName(sim, d.from);
  const to = nationName(sim, d.to);
  switch (d.kind) {
    case 'cede':
      return `${from} cedes ${d.province ? provName(sim, d.province) : '?'} to ${to}`;
    case 'gold':
      return `${from} pays ${to} ${Math.round(d.amount ?? 0)} crowns`;
    case 'reparations':
      return `${from} pays ${to} ${Math.round((d.amount ?? 0) * 100)}% of its income for ${C.settlement.reparationsMonths / 12} years`;
    case 'disarm':
      return `${from} limits its army for ${C.settlement.disarmMonths / 12} years`;
    case 'renounce':
      return `${from} renounces its claims on ${to} and may not attack it for ${C.settlement.renounceMonths / 12} years`;
    case 'sphere':
      return `${from} enters the sphere of influence of ${to}`;
  }
}

/** The side that receives (winners) and the side that gives (losers), from the demands' direction. */
export function settlementSides(w: War, demands: Demand[]): { winners: NationId[]; losers: NationId[] } | null {
  if (!demands.length) return null;
  const s = sideOf(w, demands[0].to);
  if (!s) return null;
  return s === 'attacker' ? { winners: w.attackers, losers: w.defenders } : { winners: w.defenders, losers: w.attackers };
}

/** Each winner's share of the spoils, from its contribution to the war (the leader's counts 25% more). */
export function contributionShares(w: War, side: NationId[]): Record<NationId, number> {
  const lead = side.includes(w.attackerLead) ? w.attackerLead : w.defenderLead;
  const weight: Record<NationId, number> = {};
  let total = 0;
  for (const n of side) {
    const v = (1 + (w.contrib?.[n] ?? 0)) * (n === lead ? 1.25 : 1);
    weight[n] = v;
    total += v;
  }
  const out: Record<NationId, number> = {};
  for (const n of side) out[n] = weight[n] / Math.max(1e-9, total);
  return out;
}

/** War-score points a demand costs its giver. */
export function demandCost(sim: Sim, w: War, d: Demand): number {
  const st = sim.state;
  const S = C.settlement;
  switch (d.kind) {
    case 'cede': {
      if (!d.province || !st.provinces[d.province]) return 0;
      const side = sideOf(w, d.to) === 'attacker' ? w.attackers : w.defenders;
      const c = provinceCost(sim, d.from, side, d.province);
      return Math.round(c * (st.provinces[d.province].claims.includes(d.to) ? S.claimDiscount : 1));
    }
    case 'gold':
      return Math.round(Math.max(0, d.amount ?? 0) / C.war.goldPerPoint);
    case 'reparations':
      return Math.round((d.amount ?? 0) * S.reparationsCost);
    case 'disarm':
      return S.disarmCost;
    case 'renounce':
      return S.renounceCost;
    case 'sphere':
      return S.sphereCost;
  }
}

export function settlementCost(sim: Sim, w: War, demands: Demand[]): number {
  return demands.reduce((s, d) => s + demandCost(sim, w, d), 0);
}

/** Why a settlement cannot be proposed (null = it can). */
export function settlementProblem(sim: Sim, nid: NationId, warId: string, demands: Demand[]): string | null {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return 'That war is over.';
  if (nid !== w.attackerLead && nid !== w.defenderLead) return 'Only a war leader can propose a settlement for everyone.';
  if (!Array.isArray(demands) || demands.length === 0) return 'A settlement needs at least one demand (or offer a white peace).';
  if (demands.length > 16) return 'At most 16 demands.';
  const sides = settlementSides(w, demands);
  if (!sides) return 'Every receiver must be on one side of the war.';
  const seen = new Set<string>();
  for (const d of demands) {
    if (!d || !(d.kind in DEMAND_LABELS)) return 'Unknown demand.';
    if (!sides.winners.includes(d.to)) return `${nationName(sim, d.to)} is not on the receiving side.`;
    if (!sides.losers.includes(d.from)) return `${nationName(sim, d.from)} is not on the giving side.`;
    if (!st.nations[d.from]?.alive || !st.nations[d.to]?.alive) return 'A party to the settlement no longer exists.';
    const key = d.kind === 'cede' ? `cede|${d.province}` : `${d.kind}|${d.from}|${d.to}`;
    if (seen.has(key)) return `Duplicate demand: ${DEMAND_LABELS[d.kind].toLowerCase()}.`;
    seen.add(key);
    if (d.kind === 'cede') {
      const p = d.province ? st.provinces[d.province] : undefined;
      if (!p || p.owner !== d.from) return `${d.province ? provName(sim, d.province) : 'That province'} is not owned by ${nationName(sim, d.from)}.`;
    }
    if (d.kind === 'gold') {
      if (!Number.isFinite(d.amount) || (d.amount ?? 0) <= 0) return 'Name the crowns to be paid.';
      if ((d.amount ?? 0) > Math.max(0, st.nations[d.from].treasury)) return `${nationName(sim, d.from)} cannot pay ${Math.round(d.amount!)} crowns (treasury ${Math.floor(Math.max(0, st.nations[d.from].treasury))}).`;
    }
    if (d.kind === 'reparations' && !(Number.isFinite(d.amount) && d.amount! >= 0.05 && d.amount! <= 0.3)) return 'Reparations are 5–30% of income.';
    if (d.kind === 'sphere' && totalDev(sim, d.to) <= totalDev(sim, d.from)) return `${nationName(sim, d.to)} is not larger than ${nationName(sim, d.from)} and cannot hold it in its sphere.`;
  }
  const other = nid === w.attackerLead ? w.defenderLead : w.attackerLead;
  if (st.proposals.some((p) => (p.kind === 'settlement' || p.kind === 'peace') && p.war === warId && p.from === nid && p.to === other)) return 'Our offer is still awaiting their answer.';
  if (st.proposals.some((p) => (p.kind === 'settlement' || p.kind === 'peace') && p.war === warId && p.from === other && p.to === nid))
    return `${nationName(sim, other)} has already sent us an offer: answer it first (decisions waiting).`;
  return null;
}

/**
 * How `judge` (the opposing war leader) regards a settlement. A judge on the
 * giving side weighs what it loses; a judge on the receiving side (a
 * settlement offered by the losers) weighs what it gains against its advantage.
 */
export function evaluateSettlement(sim: Sim, warId: string, judge: NationId, demands: Demand[]): Evaluation {
  const st = sim.state;
  const w = st.wars[warId];
  const reasons: OpinionPart[] = [];
  const add = (label: string, value: number) => {
    if (Math.abs(value) >= 0.5) reasons.push({ label, value: Math.round(value) });
  };
  if (!w) return { accept: false, score: -999, reasons: [{ label: 'The war is over', value: -999 }] };
  const t = st.nations[judge];
  const pers = PERSONALITIES[t.ai.personality];
  const adv = scoreFor(w, judge);
  const ageMonths = (st.tick - w.startTick) / 4;
  const giving = demands.some((d) => (sideOf(w, d.from) ?? '') === sideOf(w, judge));
  if (giving) {
    let own = 0;
    let allies = 0;
    for (const d of demands) {
      const c = demandCost(sim, w, d);
      if (d.from === judge) own += c;
      else allies += c;
    }
    add(`Cost of their demands on us (${own})`, -own);
    if (allies) add(`Cost of their demands on our allies (${allies})`, -allies * C.settlement.allyWeight);
    add(`War score in their favour (${Math.round(-adv)})`, Math.max(0, -adv));
    add(`War exhaustion (${Math.round(t.warExhaustion)})`, t.warExhaustion * 0.4);
    if (!hasArmies(sim, judge) && adv < 0) add('We have no army left', 20);
    if (ageMonths > 60) add('A long war', 10);
    add(`${pers.label} stubbornness`, -pers.stubborn);
    add('Pride', -5);
    if (demands.some((d) => d.from === judge && d.kind === 'disarm')) add('Disarmament humiliates us', -5);
    if (demands.some((d) => d.from === judge && d.kind === 'sphere')) add('Our independence', -5);
    if (t.warExhaustion >= 100) add('Exhausted: must accept', 200);
  } else {
    const value = settlementCost(sim, w, demands);
    add(`Value of their concessions (${value})`, value);
    add(`War score in our favour (${Math.round(adv)})`, -Math.max(0, adv) * 0.7);
    add(`War exhaustion (${Math.round(t.warExhaustion)})`, t.warExhaustion * 0.3);
    add('Willing to settle', 5);
  }
  const score = reasons.reduce((s, r) => s + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

/**
 * The settlement `judge` (on the giving side) would accept instead: the demands
 * that cost it most struck out one by one. Null when nothing worth keeping is
 * left (less than 40% of the original value).
 */
export function counterOffer(sim: Sim, warId: string, judge: NationId, demands: Demand[]): Demand[] | null {
  const w = sim.state.wars[warId];
  if (!w) return null;
  const full = settlementCost(sim, w, demands);
  let rest = [...demands];
  while (rest.length && !evaluateSettlement(sim, warId, judge, rest).accept) {
    let worst = 0;
    let wv = -Infinity;
    rest.forEach((d, i) => {
      const v = demandCost(sim, w, d) * (d.from === judge ? 1 : C.settlement.allyWeight);
      if (v > wv) {
        wv = v;
        worst = i;
      }
    });
    rest = rest.filter((_, i) => i !== worst);
  }
  if (!rest.length || settlementCost(sim, w, rest) < full * 0.4) return null;
  return rest;
}

// ───────────────────────────── The AI's settlement ──────────────────────────

/**
 * The demands a winning war leader makes, for itself and its allies: a budget
 * from the war score and the losers' exhaustion, shared by contribution, each
 * share filled with the demands that suit that winner.
 */
export function buildSettlement(sim: Sim, warId: string, leader: NationId): Demand[] {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return [];
  const mySide = sideOf(w, leader) === 'attacker' ? w.attackers : w.defenders;
  const theirSide = mySide === w.attackers ? w.defenders : w.attackers;
  const theirLead = mySide === w.attackers ? w.defenderLead : w.attackerLead;
  const adv = scoreFor(w, leader);
  const budget = adv * 0.9 + st.nations[theirLead].warExhaustion * 0.3 - 3;
  if (budget <= 3) return [];
  const shares = contributionShares(w, mySide);
  const order = [...mySide].filter((n) => st.nations[n]?.alive).sort((a, b) => shares[b] - shares[a] || (a < b ? -1 : 1));
  const worried = aliveNations(sim).filter((o) => (st.alarm[o]?.[leader] ?? 0) >= 30).length;
  const maxProvs = worried >= 2 ? 3 : 4;
  const out: Demand[] = [];
  const used = new Set<ProvinceId>();
  let carry = 0;
  let provs = 0;
  for (const win of order) {
    let left = budget * shares[win] + carry;
    const pers = PERSONALITIES[st.nations[win].ai.personality];
    const mine = new Set(ownedProvinces(sim, win));
    const take = (d: Demand): boolean => {
      const c = demandCost(sim, w, d);
      if (c > left) return false;
      out.push(d);
      left -= c;
      return true;
    };
    // land: occupied by our side, next to the winner's land or claimed by it; war goals for the leader
    const land: Array<{ pid: ProvinceId; from: NationId; v: number }> = [];
    for (const from of theirSide) {
      for (const pid of ownedProvinces(sim, from)) {
        const p = st.provinces[pid];
        if (used.has(pid) || !p.controller || !mySide.includes(p.controller)) continue;
        const claim = p.claims.includes(win);
        const goal = win === leader && w.goal.provinces.includes(pid);
        const adj = sim.world.prov[pid].neighbors.some((nb) => mine.has(nb));
        if (!claim && !goal && !adj) continue;
        if (st.nations[from].capital === pid && !claim) continue;
        land.push({ pid, from, v: (goal ? 20 : 0) + (claim ? 10 : 0) + (p.controller === win ? 5 : 0) + p.dev });
      }
    }
    land.sort((a, b) => b.v - a.v || (a.pid < b.pid ? -1 : 1));
    const myCap = win === leader ? 3 : 2;
    let mineTaken = 0;
    for (const l of land) {
      if (provs >= maxProvs || mineTaken >= myCap) break;
      if (take({ kind: 'cede', from: l.from, to: win, province: l.pid })) {
        used.add(l.pid);
        provs++;
        mineTaken++;
      }
    }
    // the leader of the losers renounces its claims on a winner it claimed land from
    if (ownedProvinces(sim, win).some((pid) => st.provinces[pid].claims.includes(theirLead))) take({ kind: 'renounce', from: theirLead, to: win });
    // disarm a dangerous neighbour
    if (borders(sim, win, theirLead) && nationPotential(sim, theirLead) > nationPotential(sim, win) * 0.5 && armyCap(sim, theirLead) === null && left >= C.settlement.disarmCost)
      take({ kind: 'disarm', from: theirLead, to: win });
    // a sphere for a diplomatic realm larger than the loser
    if ((pers.id === 'diplomat' || st.nations[win].ai.goal.victory === 'diplomatic') && totalDev(sim, win) > totalDev(sim, theirLead) * 1.2)
      take({ kind: 'sphere', from: theirLead, to: win });
    // reparations from the loser's leader
    if (grossIncome(st.nations[theirLead].lastMonth) >= 20 && !out.some((d) => d.kind === 'reparations' && d.from === theirLead)) {
      if (left >= C.settlement.reparationsCost * 0.2) take({ kind: 'reparations', from: theirLead, to: win, amount: 0.2 });
      else if (left >= C.settlement.reparationsCost * 0.1) take({ kind: 'reparations', from: theirLead, to: win, amount: 0.1 });
    }
    // what is left, in crowns
    const purse = Math.floor(Math.max(0, st.nations[theirLead].treasury) * 0.5) - out.filter((d) => d.kind === 'gold' && d.from === theirLead).reduce((s, d) => s + (d.amount ?? 0), 0);
    const gold = Math.min(purse, Math.floor(left * C.war.goldPerPoint), 300);
    if (gold >= 40) take({ kind: 'gold', from: theirLead, to: win, amount: gold });
    carry = Math.max(0, left) * 0.5;
  }
  return out;
}

// ───────────────────────────── Applying ─────────────────────────────────────

export function applySettlement(sim: Sim, warId: string, proposer: NationId, target: NationId, demands: Demand[]): void {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return;
  const sides = settlementSides(w, demands);
  const winners = sides?.winners ?? [];
  const winLead = winners.includes(w.attackerLead) ? w.attackerLead : w.defenderLead;
  const loseLead = winLead === w.attackerLead ? w.defenderLead : w.attackerLead;
  const shares = contributionShares(w, winners);
  const total = settlementCost(sim, w, demands);
  const got: Record<NationId, number> = {};
  for (const d of demands) got[d.to] = (got[d.to] ?? 0) + demandCost(sim, w, d);
  restoreControl(sim, w.attackers, w.defenders);
  const lines: string[] = [];
  for (const d of demands) {
    if (!st.nations[d.from]?.alive || !st.nations[d.to]?.alive) continue;
    switch (d.kind) {
      case 'cede': {
        const pid = d.province!;
        if (st.provinces[pid]?.owner !== d.from) continue;
        // a winner whose claim goes to someone else resents the receiver
        for (const c of st.provinces[pid].claims) if (c !== d.to && winners.includes(c)) addMemory(sim, c, d.to, 'spoils', -10, 0.3);
        transferProvince(sim, pid, d.to);
        addMemory(sim, d.from, d.to, 'conquest', -15, 0.2);
        break;
      }
      case 'gold': {
        const gold = Math.min(d.amount ?? 0, Math.max(0, st.nations[d.from].treasury));
        if (gold <= 0) continue;
        st.nations[d.from].treasury -= gold;
        st.nations[d.to].treasury += gold;
        break;
      }
      case 'reparations':
        st.reparations.push({ from: d.from, to: d.to, share: d.amount ?? 0.1, until: st.tick + months(C.settlement.reparationsMonths) });
        break;
      case 'disarm': {
        let regs = 0;
        for (const a of armiesOf(sim, d.from)) regs += a.regiments.length;
        st.disarmaments.push({ nation: d.from, by: d.to, cap: Math.max(C.settlement.disarmMin, Math.floor(regs * C.settlement.disarmShare)), until: st.tick + months(C.settlement.disarmMonths) });
        break;
      }
      case 'renounce': {
        const theirs = new Set(ownedProvinces(sim, d.to));
        for (const pid of theirs) {
          const p = st.provinces[pid];
          if (p.claims.includes(d.from)) p.claims = p.claims.filter((c) => c !== d.from);
        }
        st.fabrications = st.fabrications.filter((f) => !(f.nation === d.from && theirs.has(f.province)));
        st.truces.push({ a: d.from, b: d.to, until: st.tick + months(C.settlement.renounceMonths) });
        break;
      }
      case 'sphere': {
        for (const h of Object.keys(st.influence)) if (h !== d.to && st.influence[h][d.from]) st.influence[h][d.from] /= 2;
        addInfluence(sim, d.to, d.from, C.influence.settlement);
        break;
      }
    }
    const ds = st.nations[d.to].stats;
    ds.demandsWon++;
    ds.demands[d.kind] = (ds.demands[d.kind] ?? 0) + 1;
    lines.push(describeDemand(sim, d));
  }
  // allies given less than half their fair share resent the leader
  for (const n of winners) {
    if (n === winLead || !st.nations[n]?.alive) continue;
    const fair = shares[n] * total;
    if (fair >= 5 && (got[n] ?? 0) < fair * C.settlement.resent) addMemory(sim, n, winLead, 'spoils', -Math.min(25, 8 + fair - (got[n] ?? 0)), 0.3);
  }
  if (total > 0) addMemory(sim, loseLead, winLead, 'settlement', -Math.min(30, total / 4), 0.2);
  st.nations[winLead].stats.settlementsImposed++;
  if (new Set(demands.map((d) => d.to)).size > 1) st.nations[winLead].stats.settlementsShared++;
  for (const a of w.attackers) for (const d of w.defenders) st.truces.push({ a, b: d, until: st.tick + months(C.diplomacy.truceMonths) });
  const summary = lines.length ? lines.join('; ') : 'no terms';
  for (const n of [...w.attackers, ...w.defenders]) {
    if (!st.nations[n]?.alive) continue;
    st.nations[n].stats.peacesMade++;
    st.nations[n].ai.lastWarEnd = st.tick;
    st.nations[n].ai.warPlan = null;
    notify(sim, n, 'urgent', 'peace', `Peace settlement: the ${w.name} is over. ${summary}.`);
  }
  notify(sim, null, 'low', 'peace', `${nationName(sim, proposer)} and ${nationName(sim, target)} settle the ${w.name}: ${summary}.`);
  delete st.wars[warId];
  bump(sim);
  dropStaleProposals(sim);
  relocateArmies(sim);
  pruneBattles(sim);
  bump(sim);
}
