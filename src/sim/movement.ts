// Army movement over the province graph.
//
// Each week a moving army gains `speed` movement points (1.0 foot, 1.5 if all
// horse, 0.8 with guns, x technology/policy). Entering a province costs the
// destination terrain's move value (plains 2 … mountains 5), -12% per road
// level (average of both ends), +2 for a sea strait. An army stays located in
// its origin until it arrives, so contact happens on arrival. Armies are
// processed in id order; an army cannot leave a province that holds a hostile
// army (it is pinned), so hostile armies crossing on one edge always meet.
// Paths are revalidated every step; a blocked route is re-planned or halted.

import { TERRAIN } from './config';
import { CostHeap } from './heap';
import { nationMods } from './modifiers';
import { atWar, hasAccess, notify, provName, type Sim } from './state';
import type { Army, NationId, ProvinceId } from './types';
import { edgeKey } from './world';

export function canEnter(sim: Sim, nid: NationId, pid: ProvinceId): boolean {
  const p = sim.state.provinces[pid];
  return hasAccess(sim, nid, p.owner, p.controller);
}

export function enterProblem(sim: Sim, nid: NationId, pid: ProvinceId): string | null {
  if (canEnter(sim, nid, pid)) return null;
  const p = sim.state.provinces[pid];
  const who = sim.world.nationDefs[p.controller ?? p.owner ?? '']?.short ?? 'its owner';
  return `No military access to ${provName(sim, pid)}: ${who} is neither allied nor at war with you.`;
}

/** Extra movement points to cross a sea strait. */
export const STRAIT_COST = 2;

/**
 * Movement points to step from one province into a neighbour. `nid` applies
 * national modifiers (Hrafnmark's longships cross straits at no extra cost).
 */
export function moveCost(sim: Sim, from: ProvinceId, to: ProvinceId, nid?: NationId): number {
  const t = TERRAIN[sim.world.prov[to].terrain].move;
  const infra = (sim.state.provinces[from].infra + sim.state.provinces[to].infra) / 2;
  let c = t * (1 - 0.12 * infra);
  if (sim.world.straitSet.has(edgeKey(from, to))) c += Math.max(0, STRAIT_COST + (nid ? nationMods(sim, nid).straitCost : 0));
  return c;
}

/** True when the border between two provinces is a river. */
export function isRiver(sim: Sim, a: ProvinceId, b: ProvinceId): boolean {
  return sim.world.riverSet.has(edgeKey(a, b));
}

export function armySpeed(sim: Sim, a: Army): number {
  let base = 1.0;
  const types = new Set(a.regiments.map((r) => r.type));
  if (types.has('guns')) base = 0.8;
  else if (types.size === 1 && types.has('horse')) base = 1.5;
  return base * Math.max(0.3, 1 + nationMods(sim, a.nation).moveSpeed);
}

export interface PathResult {
  path: ProvinceId[];
  cost: number;
}

/**
 * Cheapest legal path (movement points). Intermediate and final provinces must
 * be enterable. `avoid` provinces are treated as impassable (used by AI).
 */
export function findPath(sim: Sim, nid: NationId, from: ProvinceId, to: ProvinceId, avoid?: Set<ProvinceId>): PathResult | null {
  if (from === to) return { path: [], cost: 0 };
  if (!canEnter(sim, nid, to)) return null;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, ProvinceId> = {};
  const done = new Set<ProvinceId>();
  const open = new CostHeap();
  open.push(0, from);
  while (open.size) {
    const cur = open.pop();
    if (cur === to) break;
    if (done.has(cur)) continue;
    done.add(cur);
    for (const nb of sim.world.prov[cur].neighbors) {
      if (done.has(nb)) continue;
      if (avoid && avoid.has(nb) && nb !== to) continue;
      if (!canEnter(sim, nid, nb)) continue;
      const nd = dist[cur] + moveCost(sim, cur, nb, nid);
      if (dist[nb] === undefined || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur;
        open.push(nd, nb);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path: ProvinceId[] = [];
  let c = to;
  while (c !== from) {
    path.unshift(c);
    c = prev[c];
  }
  return { path, cost: dist[to] };
}

/** Estimated weeks to walk a path from the army's current position. */
export function etaWeeks(sim: Sim, a: Army, path: ProvinceId[], progress = 0): number {
  const speed = armySpeed(sim, a);
  let from = a.location;
  let weeks = 0;
  let carry = progress;
  for (const step of path) {
    const cost = moveCost(sim, from, step, a.nation);
    const need = Math.max(0, cost - carry);
    weeks += Math.max(1, Math.ceil(need / speed));
    carry = 0;
    from = step;
  }
  return weeks;
}

export function hostilePinned(sim: Sim, a: Army): boolean {
  for (const id in sim.state.armies) {
    const o = sim.state.armies[id];
    if (o.location === a.location && !o.retreating && atWar(sim, a.nation, o.nation)) return true;
  }
  return false;
}

/** Weekly movement for all armies (id order). */
export function weeklyMovement(sim: Sim): void {
  const st = sim.state;
  const ids = Object.keys(st.armies).sort();
  for (const id of ids) {
    const a = st.armies[id];
    if (!a) continue;
    if (a.battle || a.path.length === 0) {
      a.stationary++;
      continue;
    }
    if (!a.retreating && hostilePinned(sim, a)) continue;
    let next = a.path[0];
    if (!a.retreating && !canEnter(sim, a.nation, next)) {
      const dest = a.path[a.path.length - 1];
      const re = findPath(sim, a.nation, a.location, dest);
      if (!re || re.path.length === 0) {
        notify(sim, a.nation, 'normal', 'move', `${a.name} halted in ${provName(sim, a.location)}: the route to ${provName(sim, dest)} is no longer open.`, { army: a.id, province: a.location });
        a.path = [];
        a.progress = 0;
        a.stationary++;
        continue;
      }
      a.path = re.path;
      a.progress = 0;
      next = a.path[0];
    }
    a.progress += armySpeed(sim, a);
    const cost = moveCost(sim, a.location, next, a.nation);
    if (a.progress >= cost) {
      a.progress = Math.min(a.progress - cost, 1);
      a.lastMove = { from: a.location, tick: st.tick };
      a.location = next;
      a.path.shift();
      a.stationary = 0;
      if (a.path.length === 0) {
        a.progress = 0;
        if (a.retreating) a.retreating = false;
      }
    }
  }
}
