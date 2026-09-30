// Shared AI helpers: difficulty profiles, order issuing with diagnostics,
// single-source path search, threat estimates.

import { applyCommand } from '../commands';
import { CostHeap } from '../heap';
import { armyStrength } from '../military';
import { canEnter, moveCost } from '../movement';
import { nextFloat } from '../rng';
import { atWar, diag, type Sim } from '../state';
import type { Army, Command, CommandResult, Difficulty, NationId, ProvinceId } from '../types';

export interface DifficultyProfile {
  label: string;
  /** operational layer runs every N weeks */
  opEvery: number;
  /** offensive objectives considered per week (evaluation breadth) */
  objectives: number;
  /** gather and merge armies before attacking */
  coordinate: boolean;
  /** chance that a strategic choice is a random reasonable option instead of the best */
  mistake: number;
  /** required local strength ratio before attacking */
  attackMargin: number;
  /** accept "Uncertain" forecasts */
  acceptUncertain: boolean;
  /** max regiments recruited per week */
  recruitPerWeek: number;
  /** months of planning horizon when judging wars */
  horizon: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: { label: 'Easy', opEvery: 2, objectives: 3, coordinate: false, mistake: 0.3, attackMargin: 0.9, acceptUncertain: true, recruitPerWeek: 1, horizon: 6 },
  normal: { label: 'Normal', opEvery: 1, objectives: 6, coordinate: true, mistake: 0.1, attackMargin: 1.15, acceptUncertain: true, recruitPerWeek: 2, horizon: 12 },
  hard: { label: 'Hard', opEvery: 1, objectives: 12, coordinate: true, mistake: 0, attackMargin: 1.3, acceptUncertain: false, recruitPerWeek: 3, horizon: 24 },
};

export function diffOf(sim: Sim): DifficultyProfile {
  return DIFFICULTY[sim.state.settings.difficulty] ?? DIFFICULTY.normal;
}

export function aiRand(sim: Sim): number {
  return nextFloat(sim.state.aiRng);
}

/** Issues an order through the shared command path; rejected orders are recorded. */
export function issue(sim: Sim, cmd: Command, why?: string): CommandResult {
  const r = applyCommand(sim, cmd);
  if (!r.ok) diag(sim, cmd.nation, 'execution', `Rejected ${cmd.type}: ${r.reason}`);
  else if (why) diag(sim, cmd.nation, 'execution', why);
  return r;
}

export interface Reach {
  dist: Record<ProvinceId, number>;
  prev: Record<ProvinceId, ProvinceId>;
}

/** Single-source cheapest movement cost to every enterable province. */
export function reachFrom(sim: Sim, nid: NationId, from: ProvinceId): Reach {
  const dist: Record<ProvinceId, number> = { [from]: 0 };
  const prev: Record<ProvinceId, ProvinceId> = {};
  const done = new Set<ProvinceId>();
  const open = new CostHeap();
  open.push(0, from);
  while (open.size) {
    const cur = open.pop();
    if (done.has(cur)) continue;
    done.add(cur);
    for (const nb of sim.world.prov[cur].neighbors) {
      if (done.has(nb) || !canEnter(sim, nid, nb)) continue;
      const nd = dist[cur] + moveCost(sim, cur, nb, nid);
      if (dist[nb] === undefined || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur;
        open.push(nd, nb);
      }
    }
  }
  return { dist, prev };
}

export function pathVia(r: Reach, from: ProvinceId, to: ProvinceId): ProvinceId[] | null {
  if (from === to) return [];
  if (r.dist[to] === undefined) return null;
  const path: ProvinceId[] = [];
  let c = to;
  while (c !== from) {
    path.unshift(c);
    c = r.prev[c];
    if (c === undefined) return null;
  }
  return path;
}

export function hostileArmiesAt(sim: Sim, nid: NationId, pid: ProvinceId): Army[] {
  const out: Army[] = [];
  for (const id in sim.state.armies) {
    const a = sim.state.armies[id];
    if (a.location === pid && !a.retreating && atWar(sim, nid, a.nation)) out.push(a);
  }
  return out;
}

/** Hostile strength in a province plus (weighted) its neighbours. */
export function threatAround(sim: Sim, nid: NationId, pid: ProvinceId, adjWeight = 0.7): number {
  let s = 0;
  for (const a of hostileArmiesAt(sim, nid, pid)) s += armyStrength(sim, a);
  for (const nb of sim.world.prov[pid].neighbors) for (const a of hostileArmiesAt(sim, nid, nb)) s += armyStrength(sim, a) * adjWeight;
  return s;
}

export function sumStrength(sim: Sim, armies: Army[]): number {
  let s = 0;
  for (const a of armies) s += armyStrength(sim, a);
  return s;
}
