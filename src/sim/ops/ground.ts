// The ground planner (format 8), shared by the player's operations and the AI's
// war: given armies and targets it decides, once a week, which armies go where,
// and issues the orders through the command path like any player order. It
// never moves, heals or captures anything itself: armies march, fight and
// besiege under the ordinary rules.
//
//  1. Recovery: armies worn below the readiness limit, unsupplied (when supply
//     is a limit) or threatened by a much stronger enemy fall back to rest; an
//     army besieging an unthreatened province keeps at it.
//  2. Reserve: a share of the strength is held back at the base, committed to
//     battles our armies are losing, or (if allowed) to targets nothing else covers.
//  3. Targets in priority order (defend, liberate, hold, attack by value), with
//     commitment: an army keeps its target until it is taken, lost or hopeless.
//     A task force is the nearest fit armies until their strength meets the
//     need (opposition × margin, plus the regiments a fort needs); short of it,
//     an attack is not made.
//  4. Concentration: a task force of several armies gathers at the last province
//     before the target, merges (when allowed) and strikes together; a forecast
//     the posture does not accept holds it at the staging province.
//  5. Failure memory: a lost attack bars that target for the posture's wait, and
//     after that only a stronger force tries again.
//  6. Detachments (when allowed, bounded): a task force with spare regiments
//     sends a detachment of at least the minimum size to an undefended target
//     nothing else covers; idle armies standing together merge again.
//  7. Armies with nothing to do cover the front posts, else gather at the base.

import { C } from '../config';
import { forecastBattle, type Forecast } from '../combat';
import { armyStrength, maxMorale } from '../military';
import { atWar, isFriendly, menOf, provName, type Sim } from '../state';
import { supplyAt, supplyDistances, supplyRange } from '../supply';
import { findPath } from '../movement';
import type { Army, ArmyId, CommandResult, NationId, OpTask, OpTaskKind, ProvinceId, RealmCommand, UnitType } from '../types';
import { hostileArmiesAt, pathVia, reachFrom, sumStrength, threatAround } from '../ai/common';

export interface GroundTarget {
  pid: ProvinceId;
  kind: 'defend' | 'liberate' | 'hold' | 'attack';
  value: number;
  /** strength needed there (opposition × margin plus what a fort needs) */
  need: number;
  hostile: Army[];
  /** regiments needed to invest its fort (siege rules) */
  siegeRegs: number;
}

export interface GroundPolicy {
  /** strength over the opposition a task force needs */
  margin: number;
  /** forecast verdicts it attacks into */
  accept: ReadonlyArray<Forecast['verdict']>;
  /** below this share of full morale an army rests */
  minReadiness: number;
  /** share of the strength held back */
  reserve: number;
  commitReserve: 'never' | 'battles' | 'freely';
  /** gather and strike together (several armies on one target) */
  coordinate: boolean;
  /** merge armies standing together for one purpose */
  merge: boolean;
  /** detachments it may still create (0: none) */
  maxDetach: number;
  /** smallest detachment, in regiments */
  minDetach: number;
  /** weeks a target is left alone after a lost attack */
  failWait: number;
  /** farthest target, in movement cost */
  maxCost: number;
  /** attack only where supply reaches; unsupplied armies fall back */
  supplyLimit: boolean;
  /** provinces the supply limit does not apply to (a landing's beachhead) */
  supplyExempt?: ReadonlySet<ProvinceId>;
  /** an army facing this many times its strength nearby falls back */
  withdraw: number;
}

export interface GroundMemory {
  assigned: Record<ArmyId, { target: ProvinceId; since: number; kind: string }>;
  failures: Record<ProvinceId, { tick: number; count: number }>;
  reorganized: Record<ArmyId, number>;
}

export interface GroundContext {
  nation: NationId;
  policy: GroundPolicy;
  memory: GroundMemory;
  /** where reserves and resting armies gather (null: the nearest safe province of ours) */
  base: ProvinceId | null;
  /** provinces to cover when nothing else needs an army (a hold operation's border, the AI's front posts) */
  posts: Array<{ pid: ProvinceId; threat: number }>;
  /** issues an order (the operation's or the AI's command path) */
  issue: (cmd: RealmCommand, why?: string) => CommandResult;
  /** an event worth telling (a detachment, a merge, a reserve committed, a target abandoned) */
  note: (text: string, tone?: 'good' | 'bad') => void;
  /** plan without issuing anything: the preview of an operation */
  dry?: boolean;
  /** where an army with nothing to do should stand to join the war (the AI: on the way to the nearest objective) */
  advance?: (a: Army) => ProvinceId | null;
}

export interface GroundOutcome {
  tasks: Record<ArmyId, OpTask>;
  /** targets it could not take on, and why */
  blocked: Array<{ pid: ProvinceId; why: string }>;
  detached: ArmyId[];
  merged: number;
  /** orders issued this pass */
  orders: number;
}

/** Regiments a fort of this level needs to be invested (siege rules). */
export function siegeRegiments(fort: number): number {
  return Math.max(1, C.siege.minRegimentsPerLevel * fort);
}

/** The strength a force needs to take a province held by `hostile` behind a fort. */
export function targetNeed(sim: Sim, hostile: Army[], fort: number, margin: number): number {
  return sumStrength(sim, hostile) * margin + (fort > 0 ? C.siege.minRegimentsPerLevel * fort : 0.6);
}

/** Targets in an area: enemy-held provinces to take, ours under attack or occupied. Only realms we are at war with. */
export function areaTargets(sim: Sim, nid: NationId, area: Iterable<ProvinceId>, margin: number, holdOnly = false): GroundTarget[] {
  const st = sim.state;
  const out: GroundTarget[] = [];
  for (const pid of area) {
    const p = st.provinces[pid];
    if (!p) continue;
    const hostile = hostileArmiesAt(sim, nid, pid);
    const ctrl = p.controller;
    const ours = !!ctrl && isFriendly(sim, nid, ctrl);
    if (ours) {
      if (hostile.length) out.push({ pid, kind: 'defend', value: p.dev + 4 + p.fort * 2 + (st.nations[nid].capital === pid ? 10 : 0), need: targetNeed(sim, hostile, 0, margin) * 0.9, hostile, siegeRegs: 1 });
      else if (holdOnly) out.push({ pid, kind: 'hold', value: p.dev + 1, need: 0, hostile, siegeRegs: 1 });
      continue;
    }
    if (!ctrl || !atWar(sim, nid, ctrl)) continue;
    const mineByRight = p.owner === nid || (!!p.owner && isFriendly(sim, nid, p.owner));
    const enemyCap = !!p.owner && st.nations[p.owner]?.capital === pid;
    out.push({
      pid,
      kind: mineByRight ? 'liberate' : 'attack',
      value: p.dev + 2 + (enemyCap ? 6 : 0) + (mineByRight ? 4 : 0) - p.fort * 1.5,
      need: targetNeed(sim, hostile, p.fort, margin),
      hostile,
      siegeRegs: siegeRegiments(p.fort),
    });
  }
  return out;
}

const RANK: Record<GroundTarget['kind'], number> = { defend: 0, liberate: 1, hold: 2, attack: 3 };

/** The nearest province of ours (or a friend's) with no enemy close by: where an army rests. */
export function restingPlace(sim: Sim, nid: NationId, from: ProvinceId, base: ProvinceId | null): ProvinceId | null {
  const st = sim.state;
  const r = reachFrom(sim, nid, from);
  const safe = (p: ProvinceId) => {
    const c = st.provinces[p]?.controller;
    return !!c && isFriendly(sim, nid, c) && threatAround(sim, nid, p, 0.8) === 0;
  };
  if (base && safe(base) && r.dist[base] !== undefined && r.dist[base] <= 12) return base;
  let best: ProvinceId | null = null;
  let bs = Infinity;
  for (const [p, d] of Object.entries(r.dist)) {
    if (d >= bs || !safe(p)) continue;
    // supply matters for a rest: prefer provinces in supply
    const s = d + (supplyAt(sim, nid, p, 0, false).status === 'supplied' ? 0 : 6);
    if (s < bs || (s === bs && best !== null && p < best)) {
      bs = s;
      best = p;
    }
  }
  return best;
}

/** Regiment counts for a detachment of `size`: line troops first, the guns stay with the main body. */
function detachCounts(a: Army, size: number): Partial<Record<UnitType, number>> {
  const order: UnitType[] = ['infantry', 'cavalry', 'armour', 'engineers', 'artillery', 'airborne'];
  const have: Partial<Record<UnitType, number>> = {};
  for (const r of a.regiments) have[r.type] = (have[r.type] ?? 0) + 1;
  const out: Partial<Record<UnitType, number>> = {};
  let left = size;
  for (const t of order) {
    if (left <= 0) break;
    const n = Math.min(have[t] ?? 0, left);
    if (n > 0) {
      out[t] = n;
      left -= n;
    }
  }
  return out;
}

function task(sim: Sim, kind: OpTaskKind, target: string | null, note: string, prev?: OpTask): OpTask {
  return { kind, target, note, since: prev && prev.kind === kind && prev.target === target ? prev.since : sim.state.tick };
}

export function planGround(sim: Sim, armies: Army[], targets: GroundTarget[], ctx: GroundContext, prevTasks: Record<string, OpTask> = {}): GroundOutcome {
  const st = sim.state;
  const nid = ctx.nation;
  const pol = ctx.policy;
  const mem = ctx.memory;
  const out: GroundOutcome = { tasks: {}, blocked: [], detached: [], merged: 0, orders: 0 };
  const mm = maxMorale(sim, nid);
  const strength = new Map<ArmyId, number>();
  const str = (a: Army) => {
    let s = strength.get(a.id);
    if (s === undefined) strength.set(a.id, (s = armyStrength(sim, a)));
    return s;
  };
  const give = (a: Army, t: OpTask) => (out.tasks[a.id] = t);
  const order = (cmd: RealmCommand, why?: string): boolean => {
    if (ctx.dry) return true;
    const r = ctx.issue(cmd, why);
    if (r.ok) out.orders++;
    return r.ok;
  };
  // enemy troops on the way (not at the destination): marching through them is a battle nobody planned
  const held = (p: ProvinceId) => hostileArmiesAt(sim, nid, p).length > 0;
  const blockedAt = (path: readonly ProvinceId[]) => path.slice(0, -1).find(held) ?? null;
  const routeNotes = new Map<ArmyId, string>();
  const moveTo = (a: Army, dest: ProvinceId, why?: string) => {
    if (a.location === dest) {
      if (a.path.length) order({ type: 'stop', nation: nid, army: a.id });
      return;
    }
    if (a.path.length && a.path[a.path.length - 1] === dest && !blockedAt(a.path)) return;
    const direct = findPath(sim, nid, a.location, dest);
    if (!direct) return;
    const bad = blockedAt(direct.path);
    if (!bad) {
      if (a.path.length && a.path[a.path.length - 1] === dest) return;
      order({ type: 'move', nation: nid, army: a.id, dest }, why);
      return;
    }
    // a way round the enemy troops: march to the farthest point of the detour the ordinary route follows
    const avoid = new Set<ProvinceId>();
    for (const p of direct.path.slice(0, -1)) if (held(p)) avoid.add(p);
    for (const p of sim.world.prov[a.location].neighbors) if (p !== dest && held(p)) avoid.add(p);
    const alt = findPath(sim, nid, a.location, dest, avoid);
    if (alt && !blockedAt(alt.path)) {
      let way: ProvinceId | null = null;
      for (let i = Math.min(alt.path.length - 1, 6); i >= 0 && !way; i--) {
        const leg = findPath(sim, nid, a.location, alt.path[i]);
        if (leg && leg.path.join() === alt.path.slice(0, i + 1).join() && !leg.path.some((p, k) => k < i && held(p))) way = alt.path[i];
      }
      if (way) {
        if (!(a.path.length && a.path[a.path.length - 1] === way)) order({ type: 'move', nation: nid, army: a.id, dest: way }, why);
        routeNotes.set(a.id, `going round the enemy troops at ${provName(sim, bad)}`);
        return;
      }
    }
    // no safe way: stay put rather than blunder into them
    if (a.path.length) order({ type: 'stop', nation: nid, army: a.id });
    routeNotes.set(a.id, `the way to ${provName(sim, dest)} is held by enemy troops at ${provName(sim, bad)}`);
  };
  const hostileCtrl = (p: ProvinceId) => {
    const c = st.provinces[p]?.controller;
    return !!c && atWar(sim, nid, c);
  };
  const recently = (id: ArmyId) => st.tick - (mem.reorganized[id] ?? -99) < 4;
  const dist = supplyDistances(sim, nid);
  const range = supplyRange(sim, nid);

  // ── 1. recovery ──
  const avail = armies.filter((a) => st.armies[a.id] && !a.battle && !a.retreating && !a.embarked && !a.drop);
  const fit: Army[] = [];
  for (const a of avail) {
    const full = a.regiments.length * C.regimentSize;
    const menShare = full > 0 ? menOf(a) / full : 0;
    const danger = threatAround(sim, nid, a.location, 0.8);
    const besieging = hostileCtrl(a.location) && hostileArmiesAt(sim, nid, a.location).length === 0;
    const tired = a.morale < mm * pol.minReadiness || menShare < 0.5;
    const starving = pol.supplyLimit && !besieging && !pol.supplyExempt?.has(a.location) && supplyAt(sim, nid, a.location, 0, false).status === 'unsupplied';
    const outmatched = danger > str(a) * pol.withdraw;
    if (besieging && danger === 0) {
      fit.push(a);
      continue;
    }
    if (tired || starving || outmatched) {
      const why = outmatched
        ? `falls back: enemy strength ${danger.toFixed(1)} nearby against our ${str(a).toFixed(1)}`
        : tired
          ? `rests: morale ${Math.round((a.morale / mm) * 100)}% of full, ${Math.round(menShare * 100)}% of its men`
          : 'falls back into supply';
      const home = restingPlace(sim, nid, a.location, ctx.base);
      give(a, task(sim, 'recover', home, why, prevTasks[a.id]));
      if (home) moveTo(a, home, `${a.name} ${why}`);
      delete mem.assigned[a.id];
      continue;
    }
    fit.push(a);
  }

  // ── 1b. armies below the smallest useful size (fresh recruits, worn remnants) join a larger one ──
  if (pol.merge) {
    const small = fit.filter((a) => a.regiments.length < pol.minDetach && !a.keep && !(hostileCtrl(a.location) && !hostileArmiesAt(sim, nid, a.location).length));
    for (const a of small) {
      const r = reachFrom(sim, nid, a.location);
      const host = fit
        .filter((b) => b.id !== a.id && b.regiments.length >= pol.minDetach && r.dist[b.location] !== undefined && r.dist[b.location] <= 12 && b.regiments.length + a.regiments.length <= C.army.maxRegiments)
        .sort((x, y) => r.dist[x.location] - r.dist[y.location] || (x.id < y.id ? -1 : 1))[0];
      if (!host) continue;
      fit.splice(fit.indexOf(a), 1);
      delete mem.assigned[a.id];
      if (host.location === a.location && !a.path.length && !host.path.length && !host.keep && !ctx.dry) {
        if (order({ type: 'merge', nation: nid, armies: [host.id, a.id] })) {
          out.merged++;
          strength.delete(host.id);
          continue;
        }
      }
      give(a, task(sim, 'regroup', host.location, `${a.regiments.length === 1 ? 'one regiment' : `${a.regiments.length} regiments`}, too few to fight alone: joining ${host.name} at ${provName(sim, host.location)}`, prevTasks[a.id]));
      moveTo(a, host.location);
    }
  }

  // ── 2. reserve ──
  const reserve = new Set<ArmyId>();
  const total = fit.reduce((s, a) => s + str(a), 0);
  if (pol.reserve > 0 && fit.length >= 2) {
    const want = total * pol.reserve;
    const nearest = (a: Army) => {
      const r = reachFrom(sim, nid, a.location);
      let d = Infinity;
      for (const t of targets) if (r.dist[t.pid] !== undefined) d = Math.min(d, r.dist[t.pid]);
      return d;
    };
    const live = new Set(targets.map((t) => t.pid));
    const order2 = fit
      // never an army on its way to a target that still stands (that would undo a commitment)
      .filter((a) => !hostileCtrl(a.location) && !(mem.assigned[a.id] && mem.assigned[a.id].kind !== 'reserve' && live.has(mem.assigned[a.id].target)))
      .map((a) => ({ a, was: mem.assigned[a.id]?.kind === 'reserve' ? 0 : mem.assigned[a.id] ? 2 : 1, d: nearest(a) }))
      .sort((x, y) => x.was - y.was || y.d - x.d || (x.a.id < y.a.id ? -1 : 1));
    let have = 0;
    for (const { a } of order2) {
      if (have >= want) break;
      // a whole army only if it is about the size of the reserve wanted
      if (have + str(a) > want * 1.8) continue;
      if (fit.length - reserve.size <= 1) break;
      reserve.add(a.id);
      have += str(a);
    }
    // no army that size: (with leave to reorganise) a reserve detached from the largest idle army
    if (have < want * 0.5 && pol.maxDetach > 0 && !ctx.dry) {
      const donor = fit
        .filter((a) => !a.keep && !recently(a.id) && !hostileCtrl(a.location) && !reserve.has(a.id))
        .sort((x, y) => y.regiments.length - x.regiments.length || (x.id < y.id ? -1 : 1))[0];
      const size = donor ? Math.max(pol.minDetach, Math.round((donor.regiments.length * (want - have)) / Math.max(0.01, str(donor)))) : 0;
      if (donor && donor.regiments.length - size >= pol.minDetach) {
        const before = st.counters.army;
        if (order({ type: 'split', nation: nid, army: donor.id, counts: detachCounts(donor, size) }) && st.counters.army !== before) {
          const det = st.armies[`a${st.counters.army}`];
          if (det) {
            mem.reorganized[det.id] = st.tick;
            mem.reorganized[donor.id] = st.tick;
            strength.delete(donor.id);
            out.detached.push(det.id);
            reserve.add(det.id);
            fit.push(det);
            pol.maxDetach--;
            ctx.note(`${donor.name} detached ${det.regiments.length} regiments (${det.name}) as the reserve.`);
          }
        }
      }
    }
  }

  // ── 3. targets ──
  const committed = new Map<ProvinceId, number>();
  for (const v of Object.values(mem.assigned)) committed.set(v.target, (committed.get(v.target) ?? 0) + 1);
  // nearer targets first among equals: the value less half a point a march from our nearest fit army
  const near = new Map<ProvinceId, number>();
  for (const t of targets) {
    let d = 99;
    for (const a of fit) d = Math.min(d, sim.world.hop(a.location, t.pid) ?? 99);
    near.set(t.pid, d);
  }
  const score = (t: GroundTarget) => t.value * (committed.has(t.pid) ? 1.5 : 1) - 0.5 * Math.min(20, near.get(t.pid) ?? 20);
  const ranked = [...targets].sort((a, b) => RANK[a.kind] - RANK[b.kind] || score(b) - score(a) || (a.pid < b.pid ? -1 : 1));
  const assigned = new Set<ArmyId>();
  const groups: Array<{ t: GroundTarget; group: Army[]; have: number }> = [];
  const pool = () => fit.filter((a) => !assigned.has(a.id) && !reserve.has(a.id));
  for (const t of ranked) {
    if (t.kind === 'hold') continue;
    const fail = mem.failures[t.pid];
    // enemy troops next to the target can strike whoever takes it: a force must be able to stand
    const exposure = t.kind === 'defend' ? 0 : threatAround(sim, nid, t.pid, 1) - sumStrength(sim, t.hostile);
    let need = Math.max(t.need, exposure * 0.6);
    if (fail && t.kind !== 'defend') {
      const waited = st.tick - fail.tick;
      if (waited < pol.failWait) {
        out.blocked.push({ pid: t.pid, why: `an attack failed ${waited} week${waited === 1 ? '' : 's'} ago (${fail.count} so far): waiting ${pol.failWait - waited} more` });
        continue;
      }
      need *= 1 + 0.3 * fail.count;
    }
    // beyond supply: not attacked (unless our troops already stand there, or it is the beachhead)
    if (pol.supplyLimit && t.kind === 'attack' && !(dist[t.pid] <= range + 1) && !pol.supplyExempt?.has(t.pid) && !fit.some((a) => a.location === t.pid)) {
      out.blocked.push({ pid: t.pid, why: 'beyond our supply lines' });
      continue;
    }
    const cands = pool()
      .map((a) => ({ a, d: reachFrom(sim, nid, a.location).dist[t.pid] }))
      .filter((x) => x.d !== undefined && x.d <= pol.maxCost)
      .sort((x, y) => (mem.assigned[x.a.id]?.target === t.pid ? -1 : 0) - (mem.assigned[y.a.id]?.target === t.pid ? -1 : 0) || x.d - y.d || (x.a.id < y.a.id ? -1 : 1));
    const group: Army[] = [];
    let have = 0;
    let regs = 0;
    for (const { a } of cands) {
      if (have >= need && regs >= t.siegeRegs && group.length) break;
      group.push(a);
      have += str(a);
      regs += a.regiments.length;
    }
    if (!group.length) {
      out.blocked.push({ pid: t.pid, why: !pool().length ? 'no army free' : 'no army can reach it' });
      continue;
    }
    if (have < need || regs < t.siegeRegs) {
      const short = regs < t.siegeRegs ? `needs ${t.siegeRegs} regiments to invest the fort (${regs} free)` : `needs strength ${need.toFixed(1)}, ${have.toFixed(1)} free`;
      if (t.kind !== 'defend' || st.nations[nid].capital !== t.pid) {
        out.blocked.push({ pid: t.pid, why: short });
        continue;
      }
    }
    for (const a of group) assigned.add(a.id);
    groups.push({ t, group, have });
  }

  // ── 6a. detachments: spare regiments to undefended targets nothing covers ──
  let budget = pol.maxDetach;
  if (budget > 0) {
    const open = out.blocked.filter((b) => b.why === 'no army free').map((b) => targets.find((t) => t.pid === b.pid)!).filter((t) => t && t.hostile.length === 0 && t.kind !== 'defend');
    for (const t of open) {
      if (budget <= 0) break;
      // a detachment must be able to hold what it takes against the enemy next door (no defeat in detail)
      const nearby = threatAround(sim, nid, t.pid, 1);
      // the task force with the most to spare within reach
      let best: { g: (typeof groups)[number]; a: Army; spare: number } | null = null;
      for (const g of groups) {
        const spareStr = g.have - g.t.need;
        for (const a of g.group) {
          if (a.keep || recently(a.id) || a.regiments.length < pol.minDetach * 2 || hostileCtrl(a.location)) continue;
          const d = reachFrom(sim, nid, a.location).dist[t.pid];
          if (d === undefined || d > pol.maxCost * 0.6) continue;
          const perReg = str(a) / a.regiments.length;
          const want = Math.max(pol.minDetach, t.siegeRegs, Math.ceil((nearby * 0.8) / Math.max(0.01, perReg)));
          if (want > a.regiments.length - pol.minDetach) continue;
          const regsLeft = g.group.reduce((n, x) => n + x.regiments.length, 0) - want;
          const spare = spareStr - perReg * want;
          if (spare <= 0 || regsLeft < g.t.siegeRegs) continue;
          if (!best || spare > best.spare) best = { g, a, spare };
        }
      }
      if (!best) continue;
      const size = Math.max(pol.minDetach, t.siegeRegs, Math.ceil((nearby * 0.8) / Math.max(0.01, str(best.a) / best.a.regiments.length)));
      const counts = detachCounts(best.a, size);
      if (ctx.dry) {
        out.blocked = out.blocked.filter((b) => b.pid !== t.pid);
        give(best.a, task(sim, 'attack', best.g.t.pid, `would detach ${size} regiments to take ${provName(sim, t.pid)}`));
        budget--;
        continue;
      }
      const before = st.counters.army;
      const ok = order({ type: 'split', nation: nid, army: best.a.id, counts });
      if (!ok || st.counters.army === before) continue;
      const det = st.armies[`a${st.counters.army}`];
      if (!det) continue;
      budget--;
      mem.reorganized[det.id] = st.tick;
      mem.reorganized[best.a.id] = st.tick;
      strength.delete(best.a.id);
      best.g.have -= str(det);
      out.detached.push(det.id);
      out.blocked = out.blocked.filter((b) => b.pid !== t.pid);
      ctx.note(`${best.a.name} detached ${det.regiments.length} regiments (${det.name}) to take ${provName(sim, t.pid)}, which no other army covers.`);
      assigned.add(det.id);
      groups.push({ t, group: [det], have: str(det) });
    }
  }

  // ── 4. concentration, forecasts, orders ──
  for (const { t, group } of groups) {
    const live = group.filter((a) => st.armies[a.id]);
    if (!live.length) continue;
    const lead = live.reduce((x, y) => (str(y) > str(x) ? y : x));
    const leadPath = pathVia(reachFrom(sim, nid, lead.location), lead.location, t.pid) ?? [];
    const staging = leadPath.length <= 1 ? lead.location : leadPath[leadPath.length - 2];
    const attackKind: OpTaskKind = t.kind === 'defend' ? 'defend' : t.hostile.length ? 'attack' : 'occupy';
    let together = live.length === 1 || !pol.coordinate || live.every((a) => a.location === staging && a.path.length === 0);
    // several armies already at the staging province: merge them into one before the strike
    if (pol.coordinate && pol.merge && live.length > 1 && together && !ctx.dry) {
      const ids = live.filter((a) => !a.keep && !recently(a.id)).map((a) => a.id);
      const regs = live.reduce((n, a) => n + a.regiments.length, 0);
      if (ids.length > 1 && regs <= C.army.maxRegiments) {
        const ok = order({ type: 'merge', nation: nid, armies: ids });
        if (ok) {
          out.merged++;
          mem.reorganized[ids[0]] = st.tick;
          ctx.note(`${live.length} armies merged at ${provName(sim, staging)} to strike ${provName(sim, t.pid)} together.`);
          live.splice(0, live.length, ...live.filter((a) => st.armies[a.id]));
          together = true;
        }
      }
    }
    const hostile = t.hostile.filter((h) => st.armies[h.id]);
    let held: string | null = null;
    if (hostile.length && live.some((a) => a.location !== t.pid)) {
      const f = forecastBattle(sim, t.pid, live, hostile);
      if (!pol.accept.includes(f.verdict)) held = `held at ${provName(sim, staging)}: forecast ${f.verdict.toLowerCase()} (${f.attMen.toLocaleString()} men against ${f.defMen.toLocaleString()})`;
    }
    for (const a of live) {
      mem.assigned[a.id] = { target: t.pid, since: mem.assigned[a.id]?.target === t.pid ? mem.assigned[a.id].since : st.tick, kind: t.kind };
      if (pol.coordinate && live.length > 1 && !together) {
        give(a, task(sim, 'stage', staging, `gathering at ${provName(sim, staging)} with ${live.length - 1} other arm${live.length === 2 ? 'y' : 'ies'} to strike ${provName(sim, t.pid)} together`, prevTasks[a.id]));
        moveTo(a, staging);
        continue;
      }
      if (held) {
        give(a, task(sim, 'stage', staging, held, prevTasks[a.id]));
        moveTo(a, staging);
        continue;
      }
      const note =
        attackKind === 'occupy'
          ? `taking ${provName(sim, t.pid)} (no defenders${st.provinces[t.pid].fort ? `; fort ${st.provinces[t.pid].fort}` : ''})`
          : attackKind === 'defend'
            ? `defending ${provName(sim, t.pid)} against ${sumStrength(sim, hostile).toFixed(1)} enemy strength`
            : `attacking ${provName(sim, t.pid)} (enemy strength ${sumStrength(sim, hostile).toFixed(1)})`;
      give(a, task(sim, attackKind, t.pid, note, prevTasks[a.id]));
      moveTo(a, t.pid);
    }
  }

  // ── 2b. the reserve: into battles we are fighting, or (freely) to targets left open ──
  const battles = Object.values(st.battles).filter((b) => b.attackerNations.includes(nid) || b.defenderNations.includes(nid));
  for (const id of reserve) {
    const a = st.armies[id];
    if (!a) continue;
    const r = reachFrom(sim, nid, a.location);
    let sent = false;
    if (pol.commitReserve !== 'never') {
      for (const b of battles) {
        const d = r.dist[b.province];
        if (d === undefined || d > 4) continue;
        const ourSide = b.attackerNations.includes(nid) ? b.attackers : b.defenders;
        const theirSide = b.attackerNations.includes(nid) ? b.defenders : b.attackers;
        const ours = ourSide.reduce((s, x) => s + (st.armies[x] ? menOf(st.armies[x]) : 0), 0);
        const theirs = theirSide.reduce((s, x) => s + (st.armies[x] ? menOf(st.armies[x]) : 0), 0);
        if (ours >= theirs * 1.2) continue;
        // only where the reserve tips the balance: the battle with it must be one the posture would fight
        const side = (ids: string[]) => ids.map((x) => st.armies[x]).filter((x): x is Army => !!x);
        const joined = b.attackerNations.includes(nid) ? forecastBattle(sim, b.province, [...side(ourSide), a], side(theirSide)) : null;
        if (joined && !pol.accept.includes(joined.verdict)) continue;
        give(a, task(sim, 'attack', b.province, `reserve committed to the battle at ${provName(sim, b.province)} (${ours.toLocaleString()} men of ours against ${theirs.toLocaleString()})`, prevTasks[a.id]));
        if (prevTasks[a.id]?.target !== b.province) ctx.note(`Reserve ${a.name} committed to the battle at ${provName(sim, b.province)}.`);
        moveTo(a, b.province);
        mem.assigned[a.id] = { target: b.province, since: st.tick, kind: 'battle' };
        sent = true;
        break;
      }
    }
    if (!sent && pol.commitReserve === 'freely') {
      const open = out.blocked.find((b) => b.why === 'no army free' || b.why.startsWith('needs strength'));
      const t = open && targets.find((x) => x.pid === open.pid);
      if (t && r.dist[t.pid] !== undefined && str(a) >= t.need * 0.5) {
        give(a, task(sim, t.hostile.length ? 'attack' : 'occupy', t.pid, `reserve sent to ${provName(sim, t.pid)}, which nothing else covers`, prevTasks[a.id]));
        moveTo(a, t.pid);
        mem.assigned[a.id] = { target: t.pid, since: st.tick, kind: t.kind };
        out.blocked = out.blocked.filter((b) => b.pid !== t.pid);
        sent = true;
      }
    }
    if (sent) continue;
    const home = ctx.base && reachFrom(sim, nid, a.location).dist[ctx.base] !== undefined ? ctx.base : a.location;
    give(a, task(sim, 'reserve', home, `in reserve at ${provName(sim, home)}${pol.commitReserve === 'never' ? '' : pol.commitReserve === 'battles' ? ': goes in where our battles need it' : ': goes in wherever a target needs it'}`, prevTasks[a.id]));
    mem.assigned[a.id] = { target: home, since: mem.assigned[a.id]?.kind === 'reserve' ? mem.assigned[a.id].since : st.tick, kind: 'reserve' };
    moveTo(a, home);
  }

  // ── 7. armies with nothing to do: cover posts, wait near blocked targets, or gather at the base ──
  const covered = new Map<ProvinceId, number>();
  for (const a of fit) if (assigned.has(a.id)) for (const p of ctx.posts) if ((sim.world.hop(p.pid, a.location) ?? 99) <= 1) covered.set(p.pid, (covered.get(p.pid) ?? 0) + str(a));
  for (const a of fit) {
    if (assigned.has(a.id) || reserve.has(a.id) || !st.armies[a.id]) continue;
    delete mem.assigned[a.id];
    const r = reachFrom(sim, nid, a.location);
    let post: { pid: ProvinceId; gap: number } | null = null;
    // an army already covering a post that still needs it stays there
    const was = prevTasks[a.id]?.kind === 'hold' ? ctx.posts.find((p) => p.pid === prevTasks[a.id].target) : undefined;
    if (was && was.threat - (covered.get(was.pid) ?? 0) > 0) post = { pid: was.pid, gap: was.threat - (covered.get(was.pid) ?? 0) };
    else
      for (const p of ctx.posts) {
        if (r.dist[p.pid] === undefined || r.dist[p.pid] > pol.maxCost) continue;
        const gap = p.threat - (covered.get(p.pid) ?? 0);
        if (gap > 0 && (!post || gap > post.gap || (gap === post.gap && p.pid < post.pid))) post = { pid: p.pid, gap };
      }
    if (post) {
      covered.set(post.pid, (covered.get(post.pid) ?? 0) + str(a));
      give(a, task(sim, 'hold', post.pid, `covering ${provName(sim, post.pid)} (enemy strength ${post.gap.toFixed(1)} nearby not yet matched)`, prevTasks[a.id]));
      moveTo(a, post.pid);
      continue;
    }
    // a target we cannot take yet: wait at the province before it
    const wait = out.blocked.map((b) => ({ b, d: r.dist[b.pid] })).filter((x) => x.d !== undefined).sort((x, y) => x.d - y.d)[0];
    if (wait) {
      const path = pathVia(r, a.location, wait.b.pid) ?? [];
      const stop = path.length >= 2 ? path[path.length - 2] : a.location;
      const safeStop = hostileCtrl(stop) ? a.location : stop;
      give(a, task(sim, 'wait', safeStop, `waiting before ${provName(sim, wait.b.pid)}: ${wait.b.why}`, prevTasks[a.id]));
      moveTo(a, safeStop);
      continue;
    }
    const forward = ctx.advance?.(a) ?? null;
    if (forward && forward !== a.location) {
      give(a, task(sim, 'stage', forward, `marching to the front at ${provName(sim, forward)}`, prevTasks[a.id]));
      moveTo(a, forward, `${a.name} marches to the front at ${provName(sim, forward)}`);
      continue;
    }
    const home = ctx.base && r.dist[ctx.base] !== undefined ? ctx.base : null;
    if (home) {
      give(a, task(sim, 'stage', home, targets.length ? `gathering at ${provName(sim, home)}` : `standing by at ${provName(sim, home)}: nothing to take`, prevTasks[a.id]));
      moveTo(a, home);
    } else give(a, task(sim, 'wait', a.location, 'standing by', prevTasks[a.id]));
  }

  // ── 6b. regroup: idle armies standing together merge (bounded, never fresh detachments) ──
  if (pol.merge && !ctx.dry) {
    const idle = new Map<ProvinceId, Army[]>();
    for (const a of fit) {
      const tk = out.tasks[a.id];
      // the reserve stays a reserve (merging it away would only have it detached again)
      if (!st.armies[a.id] || a.keep || a.path.length || recently(a.id) || !tk || !['stage', 'wait', 'hold'].includes(tk.kind) || reserve.has(a.id)) continue;
      if (a.regiments.every((r) => r.type === 'airborne')) continue;
      (idle.get(a.location) ?? idle.set(a.location, []).get(a.location)!).push(a);
    }
    for (const [pid, list] of idle) {
      if (list.length < 2) continue;
      const regs = list.reduce((n, a) => n + a.regiments.length, 0);
      if (regs > C.army.maxRegiments) continue;
      const keep = list.sort((x, y) => (x.id < y.id ? -1 : 1))[0];
      if (order({ type: 'merge', nation: nid, armies: list.map((a) => a.id) })) {
        out.merged++;
        mem.reorganized[keep.id] = st.tick;
        for (const a of list.slice(1)) {
          delete out.tasks[a.id];
          delete mem.assigned[a.id];
        }
        ctx.note(`${list.length} idle armies at ${provName(sim, pid)} regrouped into ${keep.name}.`);
      }
    }
  }
  for (const [id, note] of routeNotes) if (out.tasks[id]) out.tasks[id] = { ...out.tasks[id], note: `${out.tasks[id].note}; ${note}` };
  for (const id of Object.keys(mem.assigned)) if (!st.armies[id]) delete mem.assigned[id];
  for (const [id, t] of Object.entries(mem.reorganized)) if (!st.armies[id] || st.tick - t > 12) delete mem.reorganized[id];
  return out;
}

/** Lost attacks of ours since `since` at these provinces (battle reports): the failure memory. */
export function recordFailures(sim: Sim, nid: NationId, mem: GroundMemory, since: number, where?: Set<ProvinceId>): ProvinceId[] {
  const out: ProvinceId[] = [];
  for (const r of sim.state.reports) {
    if (r.sea || r.tick < since || r.winner !== 'defender' || !r.attackerNations.includes(nid)) continue;
    if (where && !where.has(r.province)) continue;
    const f = mem.failures[r.province];
    if (f && f.tick >= r.tick) continue;
    mem.failures[r.province] = { tick: r.tick, count: (f?.count ?? 0) + 1 };
    out.push(r.province);
  }
  // forgotten after a year, or once the province is ours
  for (const [p, f] of Object.entries(mem.failures)) {
    const c = sim.state.provinces[p]?.controller;
    if (sim.state.tick - f.tick > 52 || (c && isFriendly(sim, nid, c))) delete mem.failures[p];
  }
  return out;
}
