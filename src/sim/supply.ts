// Supply network.
//
// Sources: provinces owned AND controlled by the nation or a friend (ally / same
// war side) that are integrated >= 50, fortified, or a capital, and not in revolt.
// Supply travels through friendly-controlled provinces; each step costs 1
// (+0.5 into mountains/marsh, -0.5 with roads >= 2, minimum 0.5). An army is on a
// supply line when its province is within range (3 + technology) — the final
// step may enter enemy territory. The national stockpile must not be empty.
//
// Level = connected ? min(1, 2*capacity/load) : min(0.6, 0.5*capacity/load)
// capacity = terrain base * (1 + 0.3*roads) + 0.5*dev  (x0.75 in foreign land)
// Supplied >= 0.8 > Strained >= 0.4 > Unsupplied.

import { C, TERRAIN } from './config';
import { CostHeap } from './heap';
import { armiesIn } from './index';
import { nationMods } from './modifiers';
import { fleetEpoch, straitBlocked } from './naval';
import { isFriendly, type Sim } from './state';
import { edgeKey } from './world';
import type { Army, NationId, ProvinceId } from './types';

export type SupplyStatus = 'supplied' | 'strained' | 'unsupplied';

export interface SupplyInfo {
  connected: boolean;
  distance: number;
  range: number;
  capacity: number;
  load: number;
  level: number;
  status: SupplyStatus;
  reasons: string[];
  remedies: string[];
}

const distCache = new WeakMap<object, Map<NationId, { key: string; dist: Record<ProvinceId, number> }>>();

export function isSupplySource(sim: Sim, pid: ProvinceId): boolean {
  const p = sim.state.provinces[pid];
  if (!p.owner || p.controller !== p.owner) return false;
  if (p.revoltUntil > sim.state.tick) return false;
  if (p.integration >= C.integration.supplySourceMin) return true;
  if (p.fort > 0) return true;
  return sim.state.nations[p.owner]?.capital === pid;
}

function stepCost(sim: Sim, pid: ProvinceId): number {
  const t = sim.world.prov[pid].terrain;
  let c = 1;
  if (t === 'mountains' || t === 'marsh') c += 0.5;
  if (sim.state.provinces[pid].infra >= 2) c -= 0.5;
  return Math.max(0.5, c);
}

/** Supply distance from the nearest friendly source to every province (Infinity if unreachable). */
export function supplyDistances(sim: Sim, nid: NationId): Record<ProvinceId, number> {
  let per = distCache.get(sim.state);
  if (!per) {
    per = new Map();
    distCache.set(sim.state, per);
  }
  // sea control changes which straits carry supply
  const key = `${sim.state.tick}|${sim.state.rev}|${fleetEpoch(sim)}`;
  const hit = per.get(nid);
  if (hit && hit.key === key) return hit.dist;

  const dist: Record<ProvinceId, number> = {};
  const friendly = (pid: ProvinceId) => isFriendly(sim, nid, sim.state.provinces[pid].controller);
  const open = new CostHeap();
  for (const pid of sim.world.provIds) {
    dist[pid] = Infinity;
    if (friendly(pid) && isSupplySource(sim, pid)) {
      dist[pid] = 0;
      open.push(0, pid);
    }
  }
  // Dijkstra through friendly-controlled provinces; the heap's (cost, id)
  // order makes the visiting order independent of insertion order.
  while (open.size) {
    const d = open.peekCost();
    const cur = open.pop();
    if (d > dist[cur]) continue;
    for (const nb of sim.world.prov[cur].neighbors) {
      if (sim.world.straitSet.has(edgeKey(cur, nb)) && straitBlocked(sim, nid, cur, nb)) continue;
      const nd = d + stepCost(sim, nb);
      if (nd < dist[nb]) {
        dist[nb] = nd;
        // only friendly provinces relay supply further
        if (friendly(nb)) open.push(nd, nb);
      }
    }
  }
  per.set(nid, { key, dist });
  return dist;
}

export function supplyRange(sim: Sim, nid: NationId): number {
  return C.supply.range + nationMods(sim, nid).supplyRange;
}

export function provinceSupplyCapacity(sim: Sim, nid: NationId, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  const t = TERRAIN[sim.world.prov[pid].terrain];
  let cap = t.supply * (1 + C.supply.infraCapBonus * p.infra) + C.supply.devCapBonus * p.dev;
  if (isFriendly(sim, nid, p.controller)) cap *= 1 + nationMods(sim, nid).supplyCap;
  else cap *= C.supply.foreignMul;
  return cap;
}

export function supplyStatus(level: number): SupplyStatus {
  if (level >= C.supply.strainedBelow) return 'supplied';
  if (level >= C.supply.unsuppliedBelow) return 'strained';
  return 'unsupplied';
}

export function supplyAt(sim: Sim, nid: NationId, pid: ProvinceId, extraRegiments = 0, explain = true): SupplyInfo {
  const dist = supplyDistances(sim, nid)[pid];
  const range = supplyRange(sim, nid);
  const stock = sim.state.nations[nid].supplies;
  const inRange = dist <= range;
  const connected = inRange && stock > 0;
  const capacity = provinceSupplyCapacity(sim, nid, pid);
  let load = extraRegiments;
  for (const a of armiesIn(sim, pid)) if (isFriendly(sim, nid, a.nation)) load += a.regiments.length;
  load = Math.max(1, load);
  const level = connected ? Math.min(1, (2 * capacity) / load) : Math.min(0.6, (C.supply.disconnectedMul * capacity) / load);
  const reasons: string[] = [];
  const remedies: string[] = [];
  if (explain) {
    if (!inRange) {
      reasons.push(dist === Infinity ? 'No friendly supply source can reach this province.' : `Supply line too long: ${dist.toFixed(1)} steps from the nearest source (range ${range}).`);
      remedies.push('Hold provinces back toward home, integrate frontier land to 50+, build a fort nearby, or research Supply Trains.');
    } else if (stock <= 0) {
      reasons.push('The national supply stockpile is empty.');
      remedies.push('Reduce army size, secure grain provinces, or research Refrigeration.');
    }
    const effCap = connected ? 2 * capacity : C.supply.disconnectedMul * capacity;
    if (load > effCap) {
      reasons.push(`Overstacked: ${load} regiments here but the province can feed about ${Math.floor(effCap)}.`);
      remedies.push('Split the army across neighbouring provinces or build roads.');
    }
  }
  return { connected, distance: dist, range, capacity, load, level, status: supplyStatus(level), reasons, remedies };
}

export function armySupplyInfo(sim: Sim, a: Army, quick = false): SupplyInfo {
  return supplyAt(sim, a.nation, a.location, 0, !quick);
}

/** Combat multiplier from supply. */
export function supplyCombatMul(level: number): number {
  const s = supplyStatus(level);
  if (s === 'strained') return 1 - C.supply.strainedPenalty;
  if (s === 'unsupplied') return 1 - C.supply.unsuppliedPenalty;
  return 1;
}
