// Shared AI helpers: difficulty profiles, order issuing with diagnostics,
// single-source path search, threat estimates.

import { applyCommand } from '../commands';
import { armiesIn, memoize } from '../index';
import { CostHeap } from '../heap';
import { armyStrength } from '../military';
import { canEnter, moveCost, stepClosed } from '../movement';
import { nextFloat } from '../rng';
import { atWar, diag, type Sim } from '../state';
import type { Army, CommandResult, Difficulty, NationId, ProvinceId, RealmCommand } from '../types';

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
}

// AI skill changes decisions only: every realm has the same rules, dice, income,
// production, replacement and combat. (A "planning horizon" field was listed here
// until format 9 but nothing read it; it is gone rather than described.)
export const DIFFICULTY: Record<Difficulty, DifficultyProfile> = {
  easy: { label: 'Easy', opEvery: 2, objectives: 3, coordinate: false, mistake: 0.3, attackMargin: 0.9, acceptUncertain: true, recruitPerWeek: 1 },
  normal: { label: 'Normal', opEvery: 1, objectives: 6, coordinate: true, mistake: 0.1, attackMargin: 1.15, acceptUncertain: true, recruitPerWeek: 2 },
  hard: { label: 'Hard', opEvery: 1, objectives: 12, coordinate: true, mistake: 0, attackMargin: 1.3, acceptUncertain: false, recruitPerWeek: 3 },
};

/** The recommended skill (from the format-9 progression audit: see reports/playability). */
export const RECOMMENDED_DIFFICULTY: Difficulty = 'normal';

/** What a skill level actually changes, in the order a player notices it (setup screen, Help). */
export function difficultyEffects(d: Difficulty): string[] {
  const p = DIFFICULTY[d];
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return [
    `Revises its war plans ${p.opEvery === 1 ? 'every week' : `every ${p.opEvery} weeks`} and weighs ${p.objectives} offensive objectives at a time.`,
    p.coordinate ? 'Gathers and merges its armies before a hard attack, keeps a reserve and commits it to battles.' : 'Attacks piecemeal: it does not gather its armies first and keeps no reserve.',
    `Attacks where it is at least ${p.attackMargin}× as strong locally, ${p.acceptUncertain ? `and accepts an uncertain forecast if ${p.coordinate ? 'two' : 'one'} of three rolls would win` : 'and only on a likely victory'}.`,
    p.mistake ? `${pct(p.mistake)} of its strategic choices (research, focus, war targets) are a reasonable option rather than the best.` : 'Always makes the strategic choice it rates best.',
    `Raises at most ${p.recruitPerWeek} regiment${p.recruitPerWeek === 1 ? '' : 's'} a week (under the same costs, men and limits as you).`,
  ];
}

export function diffOf(sim: Sim): DifficultyProfile {
  return DIFFICULTY[sim.state.settings.difficulty] ?? DIFFICULTY.normal;
}

export function aiRand(sim: Sim): number {
  return nextFloat(sim.state.aiRng);
}

/** Issues an order through the shared command path; rejected orders are recorded. */
export function issue(sim: Sim, cmd: RealmCommand, why?: string): CommandResult {
  const r = applyCommand(sim, cmd);
  if (!r.ok) diag(sim, cmd.nation, 'execution', `Rejected ${cmd.type}: ${r.reason}`);
  else if (why) diag(sim, cmd.nation, 'execution', why);
  return r;
}

export interface Reach {
  dist: Record<ProvinceId, number>;
  prev: Record<ProvinceId, ProvinceId>;
}

/**
 * Single-source cheapest movement cost to every enterable province.
 * Remembered for the week and revision (access and roads only change with
 * a revision bump); callers must treat the result as read-only.
 */
export function reachFrom(sim: Sim, nid: NationId, from: ProvinceId): Reach {
  return memoize(sim, 'reachFrom', `${nid}|${from}`, () => computeReach(sim, nid, from));
}

function computeReach(sim: Sim, nid: NationId, from: ProvinceId): Reach {
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
      if (done.has(nb) || !canEnter(sim, nid, nb) || stepClosed(sim, nid, cur, nb)) continue;
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
  for (const a of armiesIn(sim, pid)) if (!a.retreating && atWar(sim, nid, a.nation)) out.push(a);
  return out;
}

/** Hostile strength in a province plus (weighted) its neighbours. */
export function threatAround(sim: Sim, nid: NationId, pid: ProvinceId, adjWeight = 0.7): number {
  let s = 0;
  for (const a of hostileArmiesAt(sim, nid, pid)) s += armyStrength(sim, a);
  for (const nb of sim.world.prov[pid].neighbors) for (const a of hostileArmiesAt(sim, nid, nb)) s += armyStrength(sim, a) * adjWeight;
  return s;
}

/**
 * Hostile strength that can be at `pid` within about a week: armies standing there,
 * armies whose declared route (public, as everything is) enters it in the next two
 * steps, armies next to it or about to be (weighted `adjWeight`), and large field
 * armies two marches away (weighted 0.4: a concentration roams). What a force
 * sent there must be able to stand.
 */
export function projectedThreat(sim: Sim, nid: NationId, pid: ProvinceId, adjWeight = 0.7): number {
  return memoize(sim, 'projectedThreat', `${nid}|${pid}|${adjWeight}`, () => {
    const near = sim.world.prov[pid].neighbors;
    let s = 0;
    for (const a of hostileField(sim, nid)) {
      const ahead = a.path.slice(0, 2);
      let w = 0;
      if (a.location === pid || ahead.includes(pid)) w = 1;
      else if (near.includes(a.location) || ahead.some((p) => near.includes(p))) w = adjWeight;
      else if (a.regiments.length >= 20 && (sim.world.hop(a.location, pid) ?? 9) <= 2) w = 0.4;
      if (w > 0) s += armyStrength(sim, a) * w;
    }
    return s;
  });
}

/**
 * The strongest enemy field army within `steps` of a province (counted in the ground the
 * steps cover, so the same distance on a map drawn more finely): what can fall on a small
 * force sent there before help arrives.
 */
export function looseThreat(sim: Sim, nid: NationId, pid: ProvinceId, steps = 3.5): number {
  return memoize(sim, 'looseThreat', `${nid}|${pid}|${steps}`, () => {
    const land = sim.world.prov[pid].land;
    const width = land === undefined ? 1 : Math.sqrt(land);
    let s = 0;
    for (const a of hostileField(sim, nid)) {
      const h = sim.world.hop(a.location, pid);
      if (h !== undefined && h * width <= steps) s = Math.max(s, armyStrength(sim, a));
    }
    return s;
  });
}

/** Hostile armies in the field (not retreating, not at sea) of every realm at war with `nid`, once a week. */
function hostileField(sim: Sim, nid: NationId): Army[] {
  return memoize(sim, 'hostileField', nid, () => Object.values(sim.state.armies).filter((a) => !a.retreating && !a.embarked && atWar(sim, nid, a.nation)));
}

/** Provinces an enemy army will enter within two steps of its declared route: marching through one is a battle nobody planned. */
export function enemyRouteSet(sim: Sim, nid: NationId): Set<ProvinceId> {
  return memoize(sim, 'enemyRouteSet', nid, () => {
    const out = new Set<ProvinceId>();
    for (const a of hostileField(sim, nid)) for (const p of a.path.slice(0, 2)) out.add(p);
    return out;
  });
}

export function sumStrength(sim: Sim, armies: Army[]): number {
  let s = 0;
  for (const a of armies) s += armyStrength(sim, a);
  return s;
}
