// Province batches (format 8): one existing project, or one regiment type, in
// several selected provinces at once. Nothing new is built or bought: each
// province gets exactly what its own card would give it, by the same rules.
//
// The preview goes through the provinces in the order given (the interface
// says which order: as selected, highest development first or cheapest first)
// with a running budget, so a shared pool (crowns, food, iron, materiel,
// manpower, construction slots, a treaty's army limit) is spent once, not once
// per province: a province is queued only if what is left after the ones
// before it pays for it, otherwise it is skipped with the reason. Confirming
// sends that exact allocation; carrying it out checks each item again against
// the state at that moment (anything that changed is skipped and reported, so
// nothing is ever overspent or queued twice).

import { C, UNITS, RESOURCE_INFO } from './config';
import { activeProjects, buildEligible, buildProblem, buildSlots, PROJECT_LABELS, projectCost, startProject, type ProjectCost } from './construction';
import { armyCap } from './influence';
import { orderRecruit, recruitEligible, recruitProblem, regimentsOf, unitCost } from './military';
import { provName, type Sim } from './state';
import type { NationId, ProjectKind, ProvinceId, StrategicResource, UnitType } from './types';

export type BatchOrder = 'selected' | 'development' | 'cheapest';

export const BATCH_ORDER_LABELS: Record<BatchOrder, string> = {
  selected: 'In the order selected',
  development: 'Highest development first',
  cheapest: 'Cheapest first',
};

export interface BuildRow {
  pid: ProvinceId;
  /** queued in the preview */
  ok: boolean;
  /** why not (ineligible, or the budget ran out before it) */
  reason: string | null;
  /** what it would add (current level → next) */
  change: string;
  cost: ProjectCost | null;
}

export interface BuildPreview {
  kind: ProjectKind;
  rows: BuildRow[];
  queued: ProvinceId[];
  total: { crowns: number; food: number; iron: number; men: number };
  /** recurring cost a month once built (forts and anti-aircraft batteries have upkeep) */
  upkeep: number;
  slots: { free: number; total: number };
  left: { crowns: number; food: number; iron: number };
}

/** The level a project raises, in words ("railway 1 → 2"). */
function levelChange(sim: Sim, pid: ProvinceId, kind: ProjectKind): string {
  const p = sim.state.provinces[pid];
  switch (kind) {
    case 'dev':
      return `development ${p.dev} → ${p.dev + 1}`;
    case 'infra':
      return `railway ${p.infra} → ${p.infra + 1}`;
    case 'fort':
      return `fort ${p.fort} → ${p.fort + 1}`;
    case 'factory':
      return `factories ${p.factories} → ${p.factories + 1}`;
    case 'charter':
      return `integration ${Math.floor(p.integration)} → ${Math.min(100, Math.floor(p.integration) + 25)}`;
    case 'port':
      return `port ${p.port} → ${p.port + 1}`;
    case 'airfield':
      return `airfield ${p.airfield} → ${p.airfield + 1}`;
    case 'flak':
      return `anti-aircraft ${p.aa ?? 0} → ${(p.aa ?? 0) + 1}`;
    case 'settle':
      return 'settled as new frontier';
  }
}

/** Provinces in the batch's order. */
export function orderProvinces(sim: Sim, nid: NationId, provinces: ProvinceId[], order: BatchOrder, cost?: (pid: ProvinceId) => number): ProvinceId[] {
  const list = [...new Set(provinces)].filter((p) => sim.state.provinces[p]);
  if (order === 'development') return list.sort((a, b) => sim.state.provinces[b].dev - sim.state.provinces[a].dev || (a < b ? -1 : 1));
  if (order === 'cheapest' && cost) return list.sort((a, b) => cost(a) - cost(b) || (a < b ? -1 : 1));
  void nid;
  return list;
}

export function previewBatchBuild(sim: Sim, nid: NationId, kind: ProjectKind, provinces: ProvinceId[], order: BatchOrder = 'selected'): BuildPreview {
  const n = sim.state.nations[nid];
  const total = buildSlots(sim, nid);
  let free = Math.max(0, total - activeProjects(sim, nid).length);
  let crowns = n.treasury;
  let food = n.supplies;
  let iron = n.stock.iron;
  let men = n.manpower;
  const rows: BuildRow[] = [];
  const queued: ProvinceId[] = [];
  const sum = { crowns: 0, food: 0, iron: 0, men: 0 };
  const list = orderProvinces(sim, nid, provinces, order, (p) => (buildEligible(sim, nid, p, kind) ? Infinity : projectCost(sim, nid, p, kind).crowns));
  for (const pid of list) {
    const why = buildEligible(sim, nid, pid, kind);
    if (why) {
      rows.push({ pid, ok: false, reason: why, change: '', cost: null });
      continue;
    }
    const c = projectCost(sim, nid, pid, kind);
    const change = levelChange(sim, pid, kind);
    let reason: string | null = null;
    if (free <= 0) reason = `no construction slot left (all ${total} in use${queued.length ? ` with the ${queued.length} above` : ''})`;
    else if (crowns < c.crowns) reason = `needs ${c.crowns} crowns, ${Math.floor(crowns)} left${queued.length ? ' after the provinces above' : ''}`;
    else if (food < c.supplies) reason = `needs ${c.supplies} food, ${Math.floor(food)} left`;
    else if (iron < c.iron) reason = `needs ${c.iron} iron, ${Math.floor(iron)} left`;
    else if (men < c.manpower) reason = `needs ${c.manpower} men, ${Math.floor(men)} left`;
    if (reason) {
      rows.push({ pid, ok: false, reason, change, cost: c });
      continue;
    }
    free--;
    crowns -= c.crowns;
    food -= c.supplies;
    iron -= c.iron;
    men -= c.manpower;
    sum.crowns += c.crowns;
    sum.food += c.supplies;
    sum.iron += c.iron;
    sum.men += c.manpower;
    queued.push(pid);
    rows.push({ pid, ok: true, reason: null, change, cost: c });
  }
  const upkeep = kind === 'fort' ? queued.length * C.construction.fortUpkeep : kind === 'flak' ? queued.length * C.construction.flakUpkeep : 0;
  return { kind, rows, queued, total: sum, upkeep, slots: { free: Math.max(0, total - activeProjects(sim, nid).length), total }, left: { crowns, food, iron } };
}

/** Carries out a batch of projects in the order given: each is checked again first. */
export function runBatchBuild(sim: Sim, nid: NationId, kind: ProjectKind, provinces: ProvinceId[]): { done: ProvinceId[]; details: string[] } {
  const done: ProvinceId[] = [];
  const details: string[] = [];
  for (const pid of provinces) {
    const why = buildProblem(sim, nid, pid, kind);
    if (why) {
      details.push(`${provName(sim, pid)}: skipped (${why.replace(/\.$/, '')})`);
      continue;
    }
    startProject(sim, nid, pid, kind);
    done.push(pid);
    details.push(`${provName(sim, pid)}: ${PROJECT_LABELS[kind].toLowerCase()} queued`);
  }
  return { done, details };
}

export interface RecruitRow {
  pid: ProvinceId;
  /** regiments asked of it, and queued in the preview */
  asked: number;
  queued: number;
  reason: string | null;
  /** already training there */
  inQueue: number;
}

export interface RecruitPreview {
  unit: UnitType;
  rows: RecruitRow[];
  alloc: Array<{ province: ProvinceId; count: number }>;
  queued: number;
  asked: number;
  cost: { crowns: number; materiel: number; men: number; resources: Partial<Record<StrategicResource, number>> };
  /** recurring cost a month once raised */
  upkeep: number;
  /** what ran out first, if anything */
  limit: string | null;
}

export const RECRUIT_MAX_PER_PROVINCE = 10;

/**
 * Regiments in the selected provinces: `count` in each (per province), or
 * `count` in all, spread one at a time over the eligible provinces in order
 * (total). The shared pools are spent once, in that order.
 */
export function previewBatchRecruit(sim: Sim, nid: NationId, unit: UnitType, provinces: ProvinceId[], count: number, mode: 'per' | 'total', order: BatchOrder = 'selected'): RecruitPreview {
  const n = sim.state.nations[nid];
  const c = unitCost(sim, nid, unit);
  const list = orderProvinces(sim, nid, provinces, order, () => c.crowns);
  const eligible = list.filter((p) => !recruitEligible(sim, nid, p, unit));
  const asked = new Map<ProvinceId, number>();
  if (mode === 'per') for (const p of eligible) asked.set(p, Math.min(RECRUIT_MAX_PER_PROVINCE, count));
  else {
    let left = count;
    while (left > 0 && eligible.some((p) => (asked.get(p) ?? 0) < RECRUIT_MAX_PER_PROVINCE)) {
      for (const p of eligible) {
        if (left <= 0) break;
        if ((asked.get(p) ?? 0) >= RECRUIT_MAX_PER_PROVINCE) continue;
        asked.set(p, (asked.get(p) ?? 0) + 1);
        left--;
      }
    }
  }
  let crowns = n.treasury;
  let materiel = n.materiel;
  let men = n.manpower;
  const stock: Partial<Record<StrategicResource, number>> = { ...n.stock };
  const cap = armyCap(sim, nid);
  let regs = regimentsOf(sim, nid);
  let limit: string | null = null;
  const queuedAt = new Map<ProvinceId, number>();
  const shortOf = (): string | null => {
    if (cap !== null && regs >= cap) return `the treaty limit of ${cap} regiments`;
    if (crowns < c.crowns) return `crowns (${c.crowns} a regiment, ${Math.floor(crowns)} left)`;
    if (materiel < c.materiel) return `materiel (${c.materiel} a regiment, ${Math.floor(materiel)} left)`;
    if (men < c.manpower) return `men (${c.manpower.toLocaleString()} a regiment, ${Math.floor(men).toLocaleString()} left)`;
    for (const [r, amt] of Object.entries(c.resources) as Array<[StrategicResource, number]>) if ((stock[r] ?? 0) < amt) return `${RESOURCE_INFO[r].label.toLowerCase()} (${amt} a regiment, ${Math.floor(stock[r] ?? 0)} left)`;
    return null;
  };
  // one regiment at a time in the province order (per province: each province's share before the next)
  const rounds = mode === 'per' ? eligible.map((p) => [p, asked.get(p) ?? 0] as const) : null;
  const spend = (p: ProvinceId): boolean => {
    const s = shortOf();
    if (s) {
      limit ??= s;
      return false;
    }
    crowns -= c.crowns;
    materiel -= c.materiel;
    men -= c.manpower;
    for (const [r, amt] of Object.entries(c.resources) as Array<[StrategicResource, number]>) stock[r] = (stock[r] ?? 0) - amt;
    regs++;
    queuedAt.set(p, (queuedAt.get(p) ?? 0) + 1);
    return true;
  };
  if (rounds) {
    outer: for (const [p, k] of rounds) for (let i = 0; i < k; i++) if (!spend(p)) break outer;
  } else {
    // total: the same round-robin as the allocation, until the pools run dry
    const want = new Map(asked);
    let any = true;
    while (any) {
      any = false;
      for (const p of eligible) {
        if ((want.get(p) ?? 0) <= 0) continue;
        if (!spend(p)) {
          any = false;
          break;
        }
        want.set(p, want.get(p)! - 1);
        any = true;
      }
    }
  }
  const rows: RecruitRow[] = list.map((p) => {
    const inQueue = sim.state.provinces[p].recruits.filter((r) => r.nation === nid).length;
    const e = recruitEligible(sim, nid, p, unit);
    const a = asked.get(p) ?? 0;
    const q = queuedAt.get(p) ?? 0;
    return { pid: p, asked: a, queued: q, inQueue, reason: e ?? (a === 0 ? (mode === 'total' ? 'not needed for the total' : null) : q < a ? `${a - q} not affordable: short of ${limit}` : null) };
  });
  const alloc = list.filter((p) => (queuedAt.get(p) ?? 0) > 0).map((p) => ({ province: p, count: queuedAt.get(p)! }));
  const queued = alloc.reduce((s, x) => s + x.count, 0);
  const totalAsked = [...asked.values()].reduce((s, x) => s + x, 0);
  const res: Partial<Record<StrategicResource, number>> = {};
  for (const [r, amt] of Object.entries(c.resources) as Array<[StrategicResource, number]>) res[r] = amt * queued;
  return {
    unit,
    rows,
    alloc,
    queued,
    asked: totalAsked,
    cost: { crowns: c.crowns * queued, materiel: c.materiel * queued, men: c.manpower * queued, resources: res },
    upkeep: UNITS[unit].upkeep * queued,
    limit: queued < totalAsked ? limit : null,
  };
}

/** Carries out a recruitment allocation in order: each regiment is checked again first. */
export function runBatchRecruit(sim: Sim, nid: NationId, unit: UnitType, alloc: Array<{ province: ProvinceId; count: number }>): { done: number; details: string[] } {
  let done = 0;
  const details: string[] = [];
  for (const { province, count } of alloc) {
    let k = 0;
    let why: string | null = null;
    for (let i = 0; i < count; i++) {
      why = recruitProblem(sim, nid, province, unit);
      if (why) break;
      orderRecruit(sim, nid, province, unit);
      k++;
    }
    done += k;
    details.push(`${provName(sim, province)}: ${k} of ${count} ${UNITS[unit].label.toLowerCase()} in training${why && k < count ? ` (${why.replace(/\.$/, '')})` : ''}`);
  }
  return { done, details };
}
