// Operational + execution layers (weekly; every 2 weeks on Easy):
// recruitment toward the strategic army target, garrisons and rally points in
// peace, and in war: objectives (defend, liberate, attack), strength-based army
// assignment with commitment, staging and merging before attacks (Normal/Hard),
// forecast checks before engaging, and withdrawal from overwhelming threats.

import { C, UNITS, UNIT_TYPES } from '../config';
import { PERSONALITIES } from '../data/personalities';
import { forecastBattle } from '../combat';
import { grossIncome } from '../economy';
import { armyStrength, maxMorale, recruitProblem, unitCost, unitUnlocked } from '../military';
import { nationMods } from '../modifiers';
import { findPath } from '../movement';
import {
  armiesOf,
  atWar,
  diag,
  enemiesOf,
  isFriendly,
  menOf,
  ownedProvinces,
  provName,
  warsOf,
  type Sim,
} from '../state';
import { supplyAt, supplyDistances } from '../supply';
import type { Army, NationId, ProvinceId, UnitType } from '../types';
import { diffOf, hostileArmiesAt, issue, pathVia, reachFrom, sumStrength, threatAround, type Reach } from './common';
import { navalOps } from './navy';

function regimentsByType(sim: Sim, nid: NationId): Record<UnitType, number> {
  const out: Record<UnitType, number> = { infantry: 0, cavalry: 0, artillery: 0, engineers: 0, armour: 0 };
  for (const a of armiesOf(sim, nid)) for (const r of a.regiments) out[r.type]++;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].recruits) if (o.nation === nid) out[o.unit]++;
  return out;
}

function hopsToEnemy(sim: Sim, nid: NationId, pid: ProvinceId): number {
  let best = 99;
  for (const q of sim.world.provIds) {
    const c = sim.state.provinces[q].controller;
    if (c && atWar(sim, nid, c)) best = Math.min(best, sim.world.hop(pid, q) ?? 99);
  }
  return best;
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
  // shrink an army that is too costly for the treasury in peace
  if (!war && total > n.ai.armyTarget + 2 && n.lastMonth.net < 0) {
    const smallest = armiesOf(sim, nid)
      .filter((a) => !a.battle && !a.retreating)
      .sort((a, b) => a.regiments.length - b.regiments.length || (a.id < b.id ? -1 : 1))[0];
    if (smallest && smallest.regiments.length <= total - n.ai.armyTarget) issue(sim, { type: 'disband', nation: nid, army: smallest.id }, `Disbanded ${smallest.name} to balance the budget`);
    return;
  }
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

function setObjective(sim: Sim, a: Army, target: ProvinceId, kind: string, value: number, detail?: string): void {
  const ai = sim.state.nations[a.nation].ai;
  const prev = ai.objectives[a.id];
  if (!prev || prev.target !== target || prev.kind !== kind) {
    ai.objectives[a.id] = { target, since: sim.state.tick, kind, value };
    diag(sim, a.nation, 'operational', `${a.name} → ${kind} ${provName(sim, target)} (value ${value.toFixed(1)})${detail ? ` ${detail}` : ''}`);
  }
  a.task = `${kind}:${target}`;
}

function safeHome(sim: Sim, nid: NationId, from: ProvinceId, reach: Reach): ProvinceId | null {
  const st = sim.state;
  const n = st.nations[nid];
  let best: ProvinceId | null = null;
  let bs = Infinity;
  for (const pid of ownedProvinces(sim, nid)) {
    if (st.provinces[pid].controller !== nid) continue;
    const d = reach.dist[pid];
    if (d === undefined) continue;
    if (threatAround(sim, nid, pid, 0.8) > 0) continue;
    const s = d - (pid === n.capital ? 2 : 0) - (pid === n.ai.rally ? 1 : 0);
    if (s < bs) {
      bs = s;
      best = pid;
    }
  }
  void from;
  return best;
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

interface Objective {
  pid: ProvinceId;
  kind: 'defend' | 'liberate' | 'attack';
  value: number;
  need: number;
  hostile: Army[];
}

function fortNeed(fort: number): number {
  return fort > 0 ? C.siege.minRegimentsPerLevel * fort * 1.0 : 0.6;
}

function warObjectives(sim: Sim, nid: NationId): Objective[] {
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

function warOps(sim: Sim, nid: NationId, armies: Army[]): void {
  const st = sim.state;
  const n = st.nations[nid];
  const d = diffOf(sim);
  const objs = warObjectives(sim, nid);
  const reach = new Map<string, Reach>();
  for (const a of armies) reach.set(a.id, reachFrom(sim, nid, a.location));
  // committed objectives get a bonus (hysteresis against oscillation)
  for (const o of objs) {
    const committed = Object.entries(n.ai.objectives).some(([aid, ob]) => ob.target === o.pid && st.armies[aid]);
    if (committed) o.value *= 1.3;
  }
  objs.sort((a, b) => (a.kind === 'attack' ? 1 : 0) - (b.kind === 'attack' ? 1 : 0) || b.value - a.value || (a.pid < b.pid ? -1 : 1));
  const assigned = new Set<string>();
  const newObjectives: typeof n.ai.objectives = {};
  const mm = maxMorale(sim, nid);
  const fit = (a: Army) => a.morale >= mm * 0.45 && menOf(a) >= a.regiments.length * C.regimentSize * 0.55;
  for (const o of objs) {
    const cands = armies
      .filter((a) => !assigned.has(a.id) && reach.get(a.id)!.dist[o.pid] !== undefined && (fit(a) || a.location === o.pid))
      .sort((a, b) => reach.get(a.id)!.dist[o.pid] - reach.get(b.id)!.dist[o.pid] || (a.id < b.id ? -1 : 1));
    const group: Army[] = [];
    let str = 0;
    for (const a of cands) {
      if (str >= o.need && group.length) break;
      if (reach.get(a.id)!.dist[o.pid] > 16) continue;
      group.push(a);
      str += armyStrength(sim, a);
    }
    if (!group.length) continue;
    if (str < o.need) {
      if (o.kind === 'attack') continue;
      // too weak to defend: do not feed armies in piecemeal unless it is the capital
      if (o.pid !== n.capital) continue;
    }
    for (const a of group) assigned.add(a.id);
    // coordinate: gather at a staging province next to the objective, then strike together
    const lead = group.reduce((x, y) => (armyStrength(sim, y) > armyStrength(sim, x) ? y : x));
    const leadPath = pathVia(reach.get(lead.id)!, lead.location, o.pid) ?? [];
    const staging = leadPath.length <= 1 ? lead.location : leadPath[leadPath.length - 2];
    const together = group.every((a) => a.location === staging && a.path.length === 0) || group.length === 1 || !d.coordinate;
    if (d.coordinate && group.length > 1 && together) {
      const r = issue(sim, { type: 'merge', nation: nid, armies: group.map((a) => a.id) });
      if (r.ok) {
        const merged = group[0];
        group.splice(1);
        reach.set(merged.id, reachFrom(sim, nid, merged.location));
      }
    }
    for (const a of group) {
      if (!st.armies[a.id]) continue;
      newObjectives[a.id] = { target: o.pid, since: n.ai.objectives[a.id]?.target === o.pid ? n.ai.objectives[a.id].since : st.tick, kind: o.kind, value: o.value };
      setObjective(sim, a, o.pid, o.kind, o.value, `need ${o.need.toFixed(1)} have ${str.toFixed(1)}`);
      if (d.coordinate && group.length > 1 && !together) {
        moveTo(sim, a, staging);
        continue;
      }
      if (o.hostile.length && a.location !== o.pid) {
        const f = forecastBattle(sim, o.pid, group.filter((g) => st.armies[g.id]), o.hostile);
        if (f.verdict === 'Likely defeat' || (f.verdict === 'Uncertain' && !d.acceptUncertain)) {
          diag(sim, nid, 'operational', `Attack on ${provName(sim, o.pid)} held back: forecast ${f.verdict}`);
          const path = pathVia(reach.get(a.id)!, a.location, o.pid) ?? [];
          const hold = path.length >= 2 ? path[path.length - 2] : a.location;
          moveTo(sim, a, hold);
          continue;
        }
      }
      moveTo(sim, a, o.pid);
    }
  }
  n.ai.objectives = newObjectives;
  // unassigned armies: recover, withdraw from danger, or cover a front
  const rally = n.ai.rally ?? n.capital;
  const posts = frontPosts(sim, nid);
  const covered = new Map<ProvinceId, number>();
  for (const a of armies) {
    if (!st.armies[a.id] || !assigned.has(a.id)) continue;
    const post = posts.find((p) => p.post === a.location || (sim.world.hop(p.post, a.location) ?? 99) <= 1);
    if (post) covered.set(post.post, (covered.get(post.post) ?? 0) + armyStrength(sim, a));
  }
  for (const a of armies) {
    if (assigned.has(a.id) || !st.armies[a.id]) continue;
    const r = reach.get(a.id)!;
    const danger = threatAround(sim, nid, a.location, 0.8);
    const mine = armyStrength(sim, a);
    const home = safeHome(sim, nid, a.location, r);
    const sup = supplyAt(sim, nid, a.location, 0, false);
    if (danger > mine * 1.6 || !fit(a) || sup.status === 'unsupplied') {
      if (home && home !== a.location) {
        a.task = 'recover';
        moveTo(sim, a, home, danger > mine * 1.6 ? `${a.name} withdraws from superior enemy` : undefined);
        continue;
      }
    }
    if (a.task?.startsWith('garrison:') && st.provinces[a.task.slice(9)]?.controller === nid && danger === 0) continue;
    // cover the front whose threat is least matched by the armies already there
    const mine2 = armyStrength(sim, a);
    let best: { post: ProvinceId; gap: number } | null = null;
    for (const p of posts) {
      if (r.dist[p.post] === undefined || r.dist[p.post] > 20) continue;
      const gap = p.threat - (covered.get(p.post) ?? 0);
      if (gap > 0 && (!best || gap > best.gap)) best = { post: p.post, gap };
    }
    if (best) {
      covered.set(best.post, (covered.get(best.post) ?? 0) + mine2);
      a.task = `front:${best.post}`;
      moveTo(sim, a, best.post);
      continue;
    }
    a.task = 'reserve';
    if (rally && a.location !== rally) moveTo(sim, a, rally);
  }
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
  if (!armies.length) return;
  if (enemiesOf(sim, nid).length) warOps(sim, nid, armies);
  else peaceOps(sim, nid, armies);
  void UNITS;
}
