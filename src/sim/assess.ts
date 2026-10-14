// War assessment: where a realm stands in a war, and where the war is heading,
// from what any realm can see (the map, armies on it, its own treasury and
// pools, the enemy's exhaustion and land). It never reads anyone's orders.
//
//   land       weighted share of our side's land the enemy holds, and of theirs
//              we hold (a province weighs dev + 1, a capital twice)
//   forces     field strength of each side's armies (allies at 70%), plus half of
//              what each could still raise from its pool and treasury
//   recovery   whether the land we lost can be retaken: our strength in and next
//              to it (and half of our field armies elsewhere, who can come)
//              against theirs there; 1 when we have lost nothing
//   leverage   where we stand now: the war score, the balance of forces,
//              capitals and exhaustion (−100 losing … +100 winning)
//   outlook    where the war is heading: forces, recovery and exhaustion count
//              more, the land held so far less
//
// The AI decides to fight on or make peace from these, and judges any realm's
// peace terms (the player's included) by the same numbers.

import { memoWeek } from './index';
import { armyStrength, nationStrength } from './military';
import { armiesOf, sideOf, type Sim } from './state';
import type { NationId, ProvinceId, WarId } from './types';

/** What a province counts for in a war: its development, a capital twice. */
export function provinceWeight(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  let w = p.dev + 1;
  if (p.owner && sim.state.nations[p.owner]?.capital === pid) w *= 2;
  return w;
}

export interface WarAssessment {
  war: WarId;
  side: 'attacker' | 'defender';
  enemyLead: NationId;
  ourSide: NationId[];
  theirSide: NationId[];
  /** weighted share (0–1) of our side's land the enemy holds, and of theirs we hold */
  landLost: number;
  landHeld: number;
  /** our provinces the enemy holds */
  lost: ProvinceId[];
  capitalLost: boolean;
  capitalTaken: boolean;
  /** field strength of each side (allies at 70%) and what each could still raise */
  forces: number;
  enemyForces: number;
  depth: number;
  enemyDepth: number;
  /** −1 … 1: our forces and depth against theirs */
  forceBalance: number;
  /** 0 … 1: can we retake what we lost (1 if nothing is lost) */
  recovery: number;
  exhaustion: number;
  enemyExhaustion: number;
  /** the war score from our side */
  score: number;
  leverage: number;
  outlook: number;
  reasons: string[];
}

function depthOf(sim: Sim, nid: NationId): number {
  const n = sim.state.nations[nid];
  // regiments it could still raise: men in the pool, crowns to pay for them
  return Math.min(n.manpower / 1000, Math.max(0, n.treasury) / 20);
}

function compute(sim: Sim, warId: WarId, nid: NationId): WarAssessment | null {
  const st = sim.state;
  const w = st.wars[warId];
  if (!w) return null;
  const side = sideOf(w, nid);
  if (!side) return null;
  const ourSide = side === 'attacker' ? w.attackers : w.defenders;
  const theirSide = side === 'attacker' ? w.defenders : w.attackers;
  const enemyLead = side === 'attacker' ? w.defenderLead : w.attackerLead;
  const ours = new Set(ourSide);
  const theirs = new Set(theirSide);
  let ourTotal = 0;
  let ourLost = 0;
  let theirTotal = 0;
  let theirHeld = 0;
  const lost: ProvinceId[] = [];
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.owner) continue;
    if (ours.has(p.owner)) {
      const wt = provinceWeight(sim, pid);
      ourTotal += wt;
      if (p.controller && theirs.has(p.controller)) {
        ourLost += wt;
        lost.push(pid);
      }
    } else if (theirs.has(p.owner)) {
      const wt = provinceWeight(sim, pid);
      theirTotal += wt;
      if (p.controller && ours.has(p.controller)) theirHeld += wt;
    }
  }
  const landLost = ourTotal > 0 ? ourLost / ourTotal : 0;
  const landHeld = theirTotal > 0 ? theirHeld / theirTotal : 0;
  const cap = st.nations[nid].capital;
  const capitalLost = !!cap && theirs.has(st.provinces[cap].controller ?? '');
  const ecap = st.nations[enemyLead].capital;
  const capitalTaken = !!ecap && ours.has(st.provinces[ecap].controller ?? '');
  const weigh = (n: NationId, lead: NationId) => (n === lead ? 1 : 0.7);
  let forces = 0;
  let depth = 0;
  for (const n of ourSide) if (st.nations[n]?.alive) (forces += nationStrength(sim, n) * weigh(n, nid)), (depth += depthOf(sim, n) * weigh(n, nid));
  let enemyForces = 0;
  let enemyDepth = 0;
  for (const n of theirSide) if (st.nations[n]?.alive) (enemyForces += nationStrength(sim, n) * weigh(n, enemyLead)), (enemyDepth += depthOf(sim, n) * weigh(n, enemyLead));
  const a = forces + 0.5 * depth;
  const b = enemyForces + 0.5 * enemyDepth;
  const forceBalance = a + b > 0 ? (a - b) / (a + b) : 0;
  // recovery: who stands in and around the land we lost
  let recovery = 1;
  if (lost.length) {
    const area = new Set<ProvinceId>(lost);
    for (const pid of lost) for (const q of sim.world.prov[pid].neighbors) area.add(q);
    let near = 0;
    let enemyNear = 0;
    for (const n of ourSide) for (const x of armiesOf(sim, n)) if (area.has(x.location)) near += armyStrength(sim, x) * weigh(n, nid);
    for (const n of theirSide) for (const x of armiesOf(sim, n)) if (area.has(x.location)) enemyNear += armyStrength(sim, x) * weigh(n, enemyLead);
    const available = near + 0.5 * Math.max(0, forces - near) + 0.25 * depth;
    recovery = available + enemyNear > 0 ? available / (available + enemyNear) : 0.5;
  }
  const exhaustion = st.nations[nid].warExhaustion;
  const enemyExhaustion = st.nations[enemyLead].warExhaustion;
  const score = side === 'defender' ? -w.score : w.score;
  const capitals = (capitalTaken ? 8 : 0) - (capitalLost ? 8 : 0);
  const clamp = (v: number) => Math.max(-100, Math.min(100, v));
  const leverage = clamp(0.6 * score + 30 * forceBalance + 0.1 * (enemyExhaustion - exhaustion) + capitals);
  const outlook = clamp(0.35 * score + 45 * forceBalance + (lost.length ? (recovery - 0.5) * 40 : 0) + 0.1 * (enemyExhaustion - exhaustion) + capitals);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const reasons: string[] = [];
  reasons.push(`They hold ${pct(landLost)} of our land; we hold ${pct(landHeld)} of theirs${capitalLost ? '; our capital is lost' : ''}${capitalTaken ? '; we hold their capital' : ''}`);
  reasons.push(`Field strength ${forces.toFixed(0)} against ${enemyForces.toFixed(0)}; still to raise ${depth.toFixed(0)} against ${enemyDepth.toFixed(0)}`);
  if (lost.length) reasons.push(`Chance to retake the lost land: ${pct(recovery)}`);
  reasons.push(`Exhaustion ${Math.round(exhaustion)} against ${Math.round(enemyExhaustion)}; war score ${Math.round(score)}`);
  return { war: warId, side, enemyLead, ourSide, theirSide, landLost, landHeld, lost, capitalLost, capitalTaken, forces, enemyForces, depth, enemyDepth, forceBalance, recovery, exhaustion, enemyExhaustion, score, leverage, outlook, reasons };
}

/** The assessment of a war from `nid`'s side (worked out once a week). Null if it is not in that war. */
export function assessWar(sim: Sim, warId: WarId, nid: NationId): WarAssessment | null {
  return memoWeek(sim, 'assessWar', `${warId}|${nid}`, () => compute(sim, warId, nid));
}

/** One number for judging terms: halfway between where a realm stands and where the war is heading. */
export function warStanding(a: WarAssessment): number {
  return (a.leverage + a.outlook) / 2;
}
