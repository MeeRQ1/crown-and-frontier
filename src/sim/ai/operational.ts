// Operational + execution layers (weekly; every 2 weeks on Easy):
// recruitment toward the strategic army target, garrisons and rally points in
// peace, and in war: objectives (defend, liberate, attack), strength-based army
// assignment with commitment, staging and merging before attacks (Normal/Hard),
// forecast checks before engaging, and withdrawal from overwhelming threats.

import { C, UNITS, UNIT_TYPES } from '../config';
import { PERSONALITIES } from '../data/personalities';
import { grossIncome } from '../economy';
import { armyStrength, nationStrength, recruitProblem, unitCost, unitUnlocked } from '../military';
import { coalitionAgainst, opinion } from '../diplomacy';
import { nationMods } from '../modifiers';
import { findPath } from '../movement';
import {
  aliveNations,
  armiesOf,
  atWar,
  borders,
  diag,
  hasTreaty,
  enemiesOf,
  isFriendly,
  ownedProvinces,
  provName,
  warsOf,
  type Sim,
} from '../state';
import { supplyDistances } from '../supply';
import type { Army, NationId, ProvinceId, UnitType } from '../types';
import { aiRand, diffOf, hostileArmiesAt, issue, pathVia, reachFrom, sumStrength, threatAround, type Reach } from './common';
import { airOps, navalOps } from './navy';
import { planGround, recordFailures, siegeRegiments, type GroundPolicy, type GroundTarget } from '../ops/ground';
import { memoize } from '../index';

function regimentsByType(sim: Sim, nid: NationId): Record<UnitType, number> {
  const out: Record<UnitType, number> = { infantry: 0, cavalry: 0, artillery: 0, engineers: 0, armour: 0, airborne: 0 };
  for (const a of armiesOf(sim, nid)) for (const r of a.regiments) out[r.type]++;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].recruits) if (o.nation === nid) out[o.unit]++;
  return out;
}

function hopsToEnemy(sim: Sim, nid: NationId, pid: ProvinceId): number {
  const d = enemyField(sim, nid)[sim.world.provIndex.get(pid)!];
  return d === 0xffff ? 99 : Math.min(99, d);
}

/**
 * Hops from every province to the nearest province held by an enemy (provIds
 * order; 0xffff none): the element-wise minimum of the enemy provinces' rows of
 * the hop matrix, worked out once per week and revision instead of per site.
 */
function enemyField(sim: Sim, nid: NationId): Uint16Array {
  return memoize(sim, 'enemyField', nid, () => {
    const n = sim.world.provIds.length;
    const f = new Uint16Array(n).fill(0xffff);
    for (const q of sim.world.provIds) {
      const c = sim.state.provinces[q].controller;
      if (!c || !atWar(sim, nid, c)) continue;
      const row = sim.world.hopRow(q)!;
      for (let j = 0; j < n; j++) if (row[j] < f[j]) f[j] = row[j];
    }
    return f;
  });
}

function recruitSite(sim: Sim, nid: NationId, unit: UnitType): ProvinceId | null {
  const st = sim.state;
  const n = st.nations[nid];
  const war = enemiesOf(sim, nid).length > 0;
  let best: ProvinceId | null = null;
  let bs = -Infinity;
  for (const pid of ownedProvinces(sim, nid)) {
    if (recruitProblem(sim, nid, pid, unit)) continue;
    if (war && threatAround(sim, nid, pid, 1) > 0) continue;
    let s = st.provinces[pid].dev * 0.2;
    if (pid === n.capital) s += 3;
    if (pid === n.ai.rally) s += 2;
    if (war) {
      const h = hopsToEnemy(sim, nid, pid);
      s += h >= 2 ? 6 - Math.min(5, h) : -5;
    }
    if (s > bs) {
      bs = s;
      best = pid;
    }
  }
  return best;
}

function recruit(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  const d = diffOf(sim);
  const counts = regimentsByType(sim, nid);
  let total = UNIT_TYPES.reduce((t, u) => t + counts[u], 0);
  const war = warsOf(sim, nid).length > 0;
  // shrink an army that is too costly for the treasury in peace; when bankruptcy is
  // a few months away at the current deficit, stand down the smallest army even at
  // war (bankruptcy dissolves a fifth of the regiments anyway, and costs far more)
  const net = n.lastMonth.net;
  const broke = n.treasury < 0 && net < 0 && (Math.max(5, grossIncome(n.lastMonth)) * C.economy.creditMonths + n.treasury) / -net <= 4;
  if ((broke || !war) && total > n.ai.armyTarget + (broke ? 0 : 2) && n.lastMonth.net < 0) {
    const smallest = armiesOf(sim, nid)
      .filter((a) => !a.battle && !a.retreating && !a.embarked)
      .sort((a, b) => a.regiments.length - b.regiments.length || (a.id < b.id ? -1 : 1))[0];
    if (smallest && (broke || smallest.regiments.length <= total - n.ai.armyTarget)) issue(sim, { type: 'disband', nation: nid, army: smallest.id }, `Disbanded ${smallest.name} to balance the budget`);
    return;
  }
  if (demobilise(sim, nid, total)) return;
  const comp = targetComposition(sim, nid);
  const buffer = Math.max(15, grossIncome(n.lastMonth) * (war ? 0.2 : 0.4));
  for (let i = 0; i < d.recruitPerWeek; i++) {
    if (total >= n.ai.armyTarget) return;
    const want = UNIT_TYPES.filter((t) => comp[t] > 0)
      .map((t) => ({ t, deficit: comp[t] * (total + 1) - counts[t] }))
      .sort((a, b) => b.deficit - a.deficit || (a.t < b.t ? -1 : 1));
    let placed = false;
    for (const w of want) {
      const cost = unitCost(sim, nid, w.t);
      if (n.treasury - cost.crowns < buffer) continue;
      const site = recruitSite(sim, nid, w.t);
      if (!site) continue;
      const r = issue(sim, { type: 'recruit', nation: nid, province: site, unit: w.t });
      if (r.ok) {
        counts[w.t]++;
        total++;
        placed = true;
        break;
      }
    }
    if (!placed) return;
  }
}

/**
 * After a war, back to the peace-time army (format 9). The war-time army used to stay
 * at its war size for as long as the treasury could carry it, so every war ratcheted
 * the standing army up and it never came down (the progression audit: Turkey 99
 * regiments against a peace target of 57 for years). Now, three months after the last
 * peace, at peace, with no war planned and no neighbour much stronger, a realm stands
 * down what exceeds its own target by a fifth, a sixth of the excess a month (at least
 * two regiments), from an army at home that is not fighting, by the ordinary split and
 * disband orders. The men return to the pool as for anyone who disbands.
 */
function demobilise(sim: Sim, nid: NationId, total: number): boolean {
  const st = sim.state;
  const n = st.nations[nid];
  // (a target of 0 is not yet planned: nothing is stood down before the first budget)
  if (st.tick % 4 !== 0 || !n.ai.armyTarget || warsOf(sim, nid).length || n.ai.warPlan || st.tick - n.ai.lastWarEnd < 13) return false;
  const excess = total - Math.ceil(n.ai.armyTarget * 1.2) - 2;
  if (excess <= 0 || threatenedBy(sim, nid)) return false;
  const home = armiesOf(sim, nid)
    .filter((a) => !a.battle && !a.retreating && !a.embarked && !a.path.length && st.provinces[a.location].owner === nid && !a.op && a.regiments.length >= 2)
    .sort((a, b) => b.regiments.length - a.regiments.length || (a.id < b.id ? -1 : 1))[0];
  if (!home) return false;
  const take = Math.min(home.regiments.length - 1, Math.max(2, Math.ceil(excess / 6)));
  // the regiments the realm has most of, beyond its intended mix, go first
  const comp = targetComposition(sim, nid);
  const counts = regimentsByType(sim, nid);
  const have: Partial<Record<UnitType, number>> = {};
  for (const r of home.regiments) have[r.type] = (have[r.type] ?? 0) + 1;
  const out: Partial<Record<UnitType, number>> = {};
  for (let i = 0; i < take; i++) {
    const t = UNIT_TYPES.filter((u) => (have[u] ?? 0) - (out[u] ?? 0) > 0).sort((a, b) => counts[b] - (out[b] ?? 0) - comp[b] * total - (counts[a] - (out[a] ?? 0) - comp[a] * total) || (a < b ? -1 : 1))[0];
    if (!t) break;
    out[t] = (out[t] ?? 0) + 1;
  }
  if (!Object.keys(out).length) return false;
  const before = new Set(armiesOf(sim, nid).map((a) => a.id));
  const sp = issue(sim, { type: 'split', nation: nid, army: home.id, counts: out });
  if (!sp.ok) return false;
  const part = armiesOf(sim, nid).find((a) => !before.has(a.id));
  if (part) issue(sim, { type: 'disband', nation: nid, army: part.id }, `Stood down ${part.regiments.length} regiments after the war (${total} against a peace-time target of ${n.ai.armyTarget})`);
  return true;
}

/** A bordering realm much stronger than us that is not our ally (the strategic layer's own test, without its side effects). */
function threatenedBy(sim: Sim, nid: NationId): boolean {
  if (coalitionAgainst(sim, nid)) return true;
  const mine = Math.max(1, nationStrength(sim, nid));
  return aliveNations(sim).some((o) => o !== nid && !hasTreaty(sim, 'alliance', o, nid) && borders(sim, nid, o) && (opinion(sim, o, nid) < 10 || atWar(sim, o, nid)) && nationStrength(sim, o) / mine > 1.25);
}

/**
 * The mix the realm aims for: its personality's composition, with units it has
 * not unlocked (or cannot fuel or build) folded into infantry, and cavalry
 * halved once machine guns exist anywhere (era III).
 */
export function targetComposition(sim: Sim, nid: NationId): Record<UnitType, number> {
  const base = PERSONALITIES[sim.state.nations[nid].ai.personality].composition;
  const out = { ...base };
  const n = sim.state.nations[nid];
  const fold = (t: UnitType) => {
    out.infantry += out[t];
    out[t] = 0;
  };
  if (!unitUnlocked(sim, nid, 'engineers')) fold('engineers');
  if (!unitUnlocked(sim, nid, 'armour') || n.shortages.includes('oil') || n.shortages.includes('rubber')) fold('armour');
  if (Object.values(sim.state.nations).some((x) => x.alive && x.research.done.includes('machine_guns'))) {
    out.infantry += out.cavalry / 2;
    out.cavalry /= 2;
  }
  return out;
}

// ───────────────────────────── Movement helpers ─────────────────────────────

function moveTo(sim: Sim, a: Army, dest: ProvinceId, why?: string): void {
  if (a.location === dest) {
    if (a.path.length) issue(sim, { type: 'stop', nation: a.nation, army: a.id });
    return;
  }
  if (a.path.length && a.path[a.path.length - 1] === dest) return;
  // no legal route (for example through realms that deny access): don't reissue it every week
  if (!findPath(sim, a.nation, a.location, dest)) return;
  issue(sim, { type: 'move', nation: a.nation, army: a.id, dest }, why);
}

// ───────────────────────────── Peace-time operations ────────────────────────

function peaceOps(sim: Sim, nid: NationId, armies: Army[]): void {
  const st = sim.state;
  const n = st.nations[nid];
  const rally = n.ai.rally ?? n.capital;
  if (!rally) return;
  const totalRegs = armies.reduce((s, a) => s + a.regiments.length, 0);
  const needs = ownedProvinces(sim, nid)
    .filter((pid) => {
      const p = st.provinces[pid];
      return p.controller === nid && p.integration < 60 && (p.unrest >= 35 || p.integration < 40) && pid !== rally;
    })
    .sort((a, b) => st.provinces[b].unrest - st.provinces[a].unrest || (a < b ? -1 : 1));
  const maxGarrisons = Math.floor(totalRegs / 3);
  const garrisoned = new Set<ProvinceId>();
  const free: Army[] = [];
  for (const a of armies) {
    const t = a.task?.startsWith('garrison:') ? a.task.slice(9) : null;
    if (t && needs.includes(t) && !garrisoned.has(t) && garrisoned.size < maxGarrisons) {
      garrisoned.add(t);
      moveTo(sim, a, t);
      continue;
    }
    free.push(a);
  }
  for (const pid of needs) {
    if (garrisoned.size >= maxGarrisons) break;
    if (garrisoned.has(pid)) continue;
    // detach one regiment from the nearest army with at least 3 regiments
    const donor = free
      .filter((a) => a.regiments.length >= 3 && !a.battle && !a.retreating)
      .sort((a, b) => (sim.world.hop(a.location, pid) ?? 99) - (sim.world.hop(b.location, pid) ?? 99) || (a.id < b.id ? -1 : 1))[0];
    if (!donor) break;
    const type: UnitType = donor.regiments.some((r) => r.type === 'infantry') ? 'infantry' : donor.regiments[0].type;
    const r = issue(sim, { type: 'split', nation: nid, army: donor.id, counts: { [type]: 1 } });
    if (!r.ok) break;
    const g = st.armies[`a${st.counters.army}`];
    if (!g) break;
    g.task = `garrison:${pid}`;
    garrisoned.add(pid);
    moveTo(sim, g, pid, `${g.name} sent to garrison ${provName(sim, pid)}`);
  }
  // everything else gathers at the rally point and merges
  const atRally = free.filter((a) => a.location === rally && a.path.length === 0 && !a.task?.startsWith('garrison:'));
  if (atRally.length >= 2) {
    const total = atRally.reduce((s, a) => s + a.regiments.length, 0);
    if (total <= C.army.maxRegiments) issue(sim, { type: 'merge', nation: nid, armies: atRally.map((a) => a.id) });
  }
  for (const a of free) {
    if (!st.armies[a.id]) continue;
    if (a.task?.startsWith('garrison:') && !needs.includes(a.task.slice(9))) a.task = null;
    if (a.task?.startsWith('garrison:')) continue;
    a.task = 'rally';
    moveTo(sim, a, rally);
  }
  n.ai.objectives = {};
}

// ───────────────────────────── War-time operations ──────────────────────────

export interface Objective {
  pid: ProvinceId;
  kind: 'defend' | 'liberate' | 'attack';
  value: number;
  need: number;
  hostile: Army[];
}

function fortNeed(fort: number): number {
  return fort > 0 ? C.siege.minRegimentsPerLevel * fort * 1.0 : 0.6;
}

export function warObjectives(sim: Sim, nid: NationId): Objective[] {
  const st = sim.state;
  const n = st.nations[nid];
  const d = diffOf(sim);
  const dist = supplyDistances(sim, nid);
  const range = C.supply.range + nationMods(sim, nid).supplyRange;
  const goalProvs = new Set<ProvinceId>();
  for (const w of warsOf(sim, nid)) if (w.attackers.includes(nid)) for (const p of w.goal.provinces) goalProvs.add(p);
  const defend: Objective[] = [];
  const attack: Objective[] = [];
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    const hostile = hostileArmiesAt(sim, nid, pid);
    const hs = sumStrength(sim, hostile);
    const capitalMul = n.capital === pid ? 3 : 1;
    if (p.owner === nid || (p.controller && isFriendly(sim, nid, p.controller) && p.controller === nid)) {
      if (p.controller === nid && hostile.length) {
        defend.push({ pid, kind: 'defend', value: (p.dev + 3) * capitalMul + p.fort * 2, need: hs * d.attackMargin, hostile });
      } else if (p.owner === nid && p.controller && atWar(sim, nid, p.controller)) {
        defend.push({ pid, kind: 'liberate', value: (p.dev + 4) * capitalMul, need: hs * d.attackMargin + fortNeed(p.fort) * 0.5, hostile });
      }
    } else if (p.controller && atWar(sim, nid, p.controller)) {
      if (!(dist[pid] <= range + 1)) continue;
      const enemyCap = p.owner && st.nations[p.owner]?.capital === pid;
      const value = p.dev + 2 + (goalProvs.has(pid) ? 10 : 0) + (enemyCap ? 6 : 0) - p.fort * 1.5 + (p.owner && isFriendly(sim, nid, p.owner) ? 4 : 0);
      attack.push({ pid, kind: 'attack', value, need: hs * d.attackMargin + fortNeed(p.fort), hostile });
    }
  }
  // enemy field armies standing in allied land are worth hunting too
  defend.sort((a, b) => b.value - a.value || (a.pid < b.pid ? -1 : 1));
  attack.sort((a, b) => b.value - a.value || (a.pid < b.pid ? -1 : 1));
  return [...defend, ...attack.slice(0, d.objectives)];
}

/** How a realm conducts its war, by difficulty and personality (the shared ground planner's policy). */
export function aiGroundPolicy(sim: Sim, nid: NationId): GroundPolicy {
  const d = diffOf(sim);
  const pers = sim.state.nations[nid].ai.personality;
  const reserve = !d.coordinate ? 0 : pers === 'defensive' ? 0.2 : pers === 'expansionist' ? 0.05 : pers === 'opportunist' ? 0.1 : 0.15;
  const regs = armiesOf(sim, nid).reduce((n, a) => n + a.regiments.length, 0);
  const armies = armiesOf(sim, nid).length;
  // detachments: never more armies than one per four regiments (plus two), at most three new a week
  const room = Math.max(0, Math.ceil(regs / 4) + 2 - armies);
  return {
    margin: d.attackMargin,
    accept: d.acceptUncertain ? ['Likely victory', 'Uncertain'] : ['Likely victory'],
    // an uncertain attack must win with even luck; on Easy one lucky roll in three will do
    uncertainWins: d.coordinate ? 2 : 1,
    minReadiness: 0.45,
    reserve,
    commitReserve: d.coordinate ? 'battles' : 'never',
    coordinate: d.coordinate,
    merge: d.coordinate,
    maxDetach: d.coordinate ? Math.min(3, room) : 0,
    minDetach: 3,
    failWait: d.coordinate ? (d.mistake === 0 ? 10 : 8) : 4,
    maxCost: 16,
    supplyLimit: true,
    withdraw: 1.6,
  };
}

/**
 * The war, planned with the same ground planner as the player's operations
 * (sim/ops/ground.ts): defence and liberation first, attack objectives by value
 * with commitment (an army keeps its target until it is taken, lost or
 * hopeless), task forces sized to the opposition, staging and merging before a
 * strike, the forecast gate by difficulty, a memory of failed attacks, a reserve
 * by personality committed to battles we are losing, bounded detachments for
 * undefended targets, regrouping, recovery and withdrawal; armies with nothing
 * to do cover the fronts or march toward the war. Small seeded variation in the
 * objectives' value keeps realms from being predictable without breaking replays.
 */
function warOps(sim: Sim, nid: NationId, armies: Army[]): void {
  const st = sim.state;
  const n = st.nations[nid];
  const objs = warObjectives(sim, nid);
  for (const o of objs) if (o.kind === 'attack') o.value *= 0.95 + aiRand(sim) * 0.1;
  const targets: GroundTarget[] = objs.map((o) => ({ pid: o.pid, kind: o.kind, value: o.value, need: o.need, hostile: o.hostile, siegeRegs: siegeRegiments(st.provinces[o.pid].fort) }));
  n.ai.failures ??= {};
  n.ai.reorganized ??= {};
  const memory = { assigned: n.ai.objectives, failures: n.ai.failures, reorganized: n.ai.reorganized };
  for (const p of recordFailures(sim, nid, memory, st.tick - 2)) diag(sim, nid, 'operational', `Attack on ${provName(sim, p)} failed: not again for a while, and then only stronger`);
  const posts = frontPosts(sim, nid).map((p) => ({ pid: p.post, threat: p.threat }));
  const before = new Map(Object.entries(n.ai.objectives).map(([id, o]) => [id, o.target]));
  const out = planGround(sim, armies, targets, {
    nation: nid,
    policy: aiGroundPolicy(sim, nid),
    memory,
    base: n.ai.rally ?? n.capital,
    posts,
    issue: (cmd, why) => issue(sim, cmd, why),
    note: (text) => diag(sim, nid, 'operational', text),
    advance: (a) => stagingFor(sim, nid, a.location, reachFrom(sim, nid, a.location), objs),
  });
  // the record the rest of the AI reads (air support, diagnostics): target, kind and value
  const value = new Map(objs.map((o) => [o.pid, o.value]));
  for (const [id, o] of Object.entries(n.ai.objectives)) {
    (o as { value?: number }).value = value.get(o.target) ?? 0;
    const a = st.armies[id];
    if (a) a.task = `${o.kind}:${o.target}`;
    if (before.get(id) !== o.target && a) diag(sim, nid, 'operational', `${a.name} → ${o.kind} ${provName(sim, o.target)}${value.has(o.target) ? ` (value ${value.get(o.target)!.toFixed(1)})` : ''}`);
  }
  for (const [id, t] of Object.entries(out.tasks)) {
    const a = st.armies[id];
    if (a && !n.ai.objectives[id]) a.task = t.kind === 'recover' ? 'recover' : t.kind === 'hold' ? `front:${t.target}` : t.kind === 'stage' ? `advance:${t.target}` : t.kind;
  }
  for (const b of out.blocked.slice(0, 2)) if (b.why.startsWith('an attack failed')) diag(sim, nid, 'operational', `${provName(sim, b.pid)} left alone: ${b.why}`);
}

/**
 * Where an army with no objective of its own should stand to join the war: on
 * the way to the nearest attack objective it can reach, the last province held
 * by us or a friend before enemy land. Null when no objective can be reached
 * (overseas, or every route is barred) or the army already stands there.
 */
export function stagingFor(sim: Sim, nid: NationId, from: ProvinceId, r: Reach, objs: Objective[]): ProvinceId | null {
  const st = sim.state;
  let target: ProvinceId | null = null;
  let best = Infinity;
  for (const o of objs) {
    if (o.kind !== 'attack') continue;
    const d = r.dist[o.pid];
    if (d !== undefined && d < best) (best = d), (target = o.pid);
  }
  if (!target || best > C.ai.advanceRange) return null;
  const path = pathVia(r, from, target) ?? [];
  let stage: ProvinceId = from;
  for (const p of path) {
    const c = st.provinces[p].controller;
    if (c && atWar(sim, nid, c)) break;
    if (c && isFriendly(sim, nid, c)) stage = p;
  }
  return stage === from ? null : stage;
}

/**
 * Fronts in war: for each enemy, the province of ours best placed to face
 * its armies (a fortified or developed border province), with the strength
 * of that enemy's armies within three marches of our land.
 */
export function frontPosts(sim: Sim, nid: NationId): Array<{ enemy: NationId; post: ProvinceId; threat: number }> {
  const st = sim.state;
  const mine = ownedProvinces(sim, nid).filter((p) => st.provinces[p].controller === nid);
  const out: Array<{ enemy: NationId; post: ProvinceId; threat: number }> = [];
  for (const e of enemiesOf(sim, nid)) {
    const border = mine.filter((p) => sim.world.prov[p].neighbors.some((nb) => st.provinces[nb].controller === e));
    if (!border.length) continue;
    let threat = 0;
    const near: ProvinceId[] = [];
    for (const a of armiesOf(sim, e)) {
      if (a.retreating) continue;
      let d = 99;
      for (const p of border) d = Math.min(d, sim.world.hop(a.location, p) ?? 99);
      if (d <= 3) {
        threat += armyStrength(sim, a);
        near.push(a.location);
      }
    }
    if (threat <= 0) continue;
    // the post: closest border province to their armies, preferring forts and development
    const score = (p: ProvinceId) => {
      let d = 99;
      for (const q of near) d = Math.min(d, sim.world.hop(p, q) ?? 99);
      return d * 3 - st.provinces[p].fort * 2 - st.provinces[p].dev * 0.3;
    };
    const post = [...border].sort((x, y) => score(x) - score(y) || (x < y ? -1 : 1))[0];
    out.push({ enemy: e, post, threat });
  }
  return out.sort((a, b) => b.threat - a.threat || (a.post < b.post ? -1 : 1));
}

/** Weekly operational pass for one AI realm. */
export function operational(sim: Sim, nid: NationId): void {
  recruit(sim, nid);
  navalOps(sim, nid);
  const armies = armiesOf(sim, nid)
    .filter((a) => !a.battle && !a.retreating && !a.embarked && a.task !== 'invasion')
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (armies.length) {
    if (enemiesOf(sim, nid).length) warOps(sim, nid, armies);
    else peaceOps(sim, nid, armies);
  }
  // after the armies' orders: wings go on call where those orders bring a battle
  airOps(sim, nid);
  void UNITS;
}
