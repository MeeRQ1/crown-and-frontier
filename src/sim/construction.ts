// Province projects: development, roads, forts, and settling unclaimed land.
// One project per province; a realm runs at most `slots` projects at once
// (2 + 1 per 10 provinces + technology). Costs are paid up front; cancelling
// refunds 50%. Projects pause while a province is occupied or in revolt.
//
// Development: 20 * dev * (1 + dev/4) * terrain factor crowns, 16 weeks (needs integration >= 40);
//              beyond the terrain's cap (up to +3) each level costs 2.5x
// Roads:       40 * (level+1) * (1 + level/2), 12 weeks, max 3
// Fort:        60 * (level+1) * (1 + level/2) crowns + 10 supplies, 16 weeks, max 3, upkeep 1/level/month
// Charter:     20 + 6*dev crowns, 8 weeks: +25 integration (frontier provinces below 90)
// Settle:      50 crowns, 500 men, 20 supplies, 16 weeks; unclaimed province next to our land

import { C, TERRAIN } from './config';
import { nationMods } from './modifiers';
import { bump, notify, ownedProvinces, provName, type Sim } from './state';
import type { NationId, ProjectKind, ProvinceId } from './types';

export const PROJECT_LABELS: Record<ProjectKind, string> = {
  dev: 'Develop',
  infra: 'Build roads',
  fort: 'Fortify',
  charter: 'Grant charters',
  settle: 'Settle',
};

export interface ProjectCost {
  crowns: number;
  supplies: number;
  manpower: number;
  weeks: number;
}

export function buildSlots(sim: Sim, nid: NationId): number {
  return C.construction.slotsBase + Math.floor(ownedProvinces(sim, nid).length / C.construction.slotsPerProvinces) + nationMods(sim, nid).buildSlots;
}

export function activeProjects(sim: Sim, nid: NationId): ProvinceId[] {
  return sim.world.provIds.filter((pid) => sim.state.provinces[pid].project?.nation === nid);
}

export function projectCost(sim: Sim, nid: NationId, pid: ProvinceId, kind: ProjectKind): ProjectCost {
  const p = sim.state.provinces[pid];
  const m = nationMods(sim, nid);
  const terr = TERRAIN[sim.world.prov[pid].terrain];
  switch (kind) {
    case 'dev':
      return {
        crowns: Math.round(C.construction.devBase * p.dev * (1 + p.dev / 4) * terr.devCost * Math.max(0.3, 1 + m.devCost) * (p.dev >= terr.devCap ? C.construction.devOvercapMul : 1)),
        supplies: 0,
        manpower: 0,
        weeks: C.construction.devWeeks,
      };
    case 'infra':
      return { crowns: Math.round(C.construction.infraBase * (p.infra + 1) * (1 + p.infra / 2) * Math.max(0.3, 1 + m.infraCost)), supplies: 0, manpower: 0, weeks: C.construction.infraWeeks };
    case 'fort': {
      const ironDiscount = 0;
      return {
        crowns: Math.round(C.construction.fortBase * (p.fort + 1) * (1 + p.fort / 2) * Math.max(0.3, 1 + m.fortCost - ironDiscount)),
        supplies: C.construction.fortSupplies,
        manpower: 0,
        weeks: C.construction.fortWeeks,
      };
    }
    case 'charter':
      return { crowns: Math.round(C.construction.charterBase + C.construction.charterPerDev * p.dev), supplies: 0, manpower: 0, weeks: C.construction.charterWeeks };
    case 'settle':
      return {
        crowns: Math.round(C.construction.settleCost * Math.max(0.3, 1 + m.settleCost)),
        supplies: C.construction.settleSupplies,
        manpower: C.construction.settleManpower,
        weeks: C.construction.settleWeeks,
      };
  }
}

/** Soft cap from terrain; development beyond it costs 2.5x. */
export function devCap(sim: Sim, pid: ProvinceId): number {
  return TERRAIN[sim.world.prov[pid].terrain].devCap;
}

/** Absolute maximum development. */
export function devMax(sim: Sim, pid: ProvinceId): number {
  return devCap(sim, pid) + C.construction.devOvercap;
}

export function buildProblem(sim: Sim, nid: NationId, pid: ProvinceId, kind: ProjectKind): string | null {
  const st = sim.state;
  const n = st.nations[nid];
  const p = st.provinces[pid];
  if (!n?.alive) return 'Your realm has fallen.';
  if (!p) return 'Unknown province.';
  if (!(kind in PROJECT_LABELS)) return 'Unknown project.';
  if (p.project) return `A project is already under way here (${PROJECT_LABELS[p.project.kind]}).`;
  if (kind === 'settle') {
    if (p.owner) return 'Only unclaimed land can be settled.';
    const adj = sim.world.prov[pid].neighbors.some((nb) => st.provinces[nb].owner === nid && st.provinces[nb].controller === nid);
    if (!adj) return 'Settlers need a province of ours next to this land.';
  } else {
    if (p.owner !== nid) return 'Not our province.';
    if (p.controller !== nid) return 'The province is occupied.';
    if (p.revoltUntil > st.tick) return 'The province is in revolt.';
    if (kind === 'dev') {
      if (p.dev >= devMax(sim, pid)) return `Development is at its maximum (${devMax(sim, pid)}).`;
      if (p.integration < C.integration.developMin) return `Integrate the province first (${Math.floor(p.integration)}/${C.integration.developMin}).`;
    }
    if (kind === 'infra' && p.infra >= C.construction.infraMax) return 'Roads are already at the maximum level.';
    if (kind === 'fort' && p.fort >= C.construction.fortMax) return 'The fort is already at the maximum level.';
    if (kind === 'charter' && p.integration >= 90) return 'The province is already well integrated (charters need integration below 90).';
  }
  const slots = buildSlots(sim, nid);
  if (activeProjects(sim, nid).length >= slots) return `All ${slots} construction slots are in use.`;
  const cost = projectCost(sim, nid, pid, kind);
  if (n.treasury < cost.crowns) return `Needs ${cost.crowns} crowns (treasury ${Math.floor(n.treasury)}).`;
  if (n.supplies < cost.supplies) return `Needs ${cost.supplies} supplies.`;
  if (n.manpower < cost.manpower) return `Needs ${cost.manpower} men from the manpower pool.`;
  return null;
}

export function startProject(sim: Sim, nid: NationId, pid: ProvinceId, kind: ProjectKind): void {
  const n = sim.state.nations[nid];
  const cost = projectCost(sim, nid, pid, kind);
  n.treasury -= cost.crowns;
  n.supplies -= cost.supplies;
  n.manpower -= cost.manpower;
  sim.state.provinces[pid].project = { kind, progress: 0, total: cost.weeks, cost: cost.crowns, nation: nid };
}

export function cancelProblem(sim: Sim, nid: NationId, pid: ProvinceId): string | null {
  const p = sim.state.provinces[pid];
  if (!p?.project || p.project.nation !== nid) return 'No project of ours here.';
  return null;
}

export function cancelProject(sim: Sim, pid: ProvinceId): void {
  const p = sim.state.provinces[pid];
  if (!p.project) return;
  const n = sim.state.nations[p.project.nation];
  if (n?.alive) n.treasury += Math.round(p.project.cost * C.construction.refund);
  p.project = null;
}

export function weeklyConstruction(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    const pr = p.project;
    if (!pr) continue;
    if (!st.nations[pr.nation]?.alive) {
      p.project = null;
      continue;
    }
    if (pr.kind === 'settle') {
      if (p.owner) {
        // someone else claimed the land first
        notify(sim, pr.nation, 'normal', 'build', `Settlement of ${provName(sim, pid)} abandoned: the land is no longer unclaimed.`, { province: pid });
        cancelProject(sim, pid);
        continue;
      }
    } else if (p.owner !== pr.nation || p.controller !== pr.nation || p.revoltUntil > st.tick) continue;
    pr.progress++;
    if (pr.progress < pr.total) continue;
    p.project = null;
    switch (pr.kind) {
      case 'dev':
        p.dev = Math.min(devMax(sim, pid), p.dev + 1);
        notify(sim, pr.nation, 'low', 'build', `${provName(sim, pid)} has developed to level ${p.dev}.`, { province: pid });
        break;
      case 'infra':
        p.infra = Math.min(C.construction.infraMax, p.infra + 1);
        notify(sim, pr.nation, 'low', 'build', `Roads in ${provName(sim, pid)} improved to level ${p.infra}.`, { province: pid });
        bump(sim);
        break;
      case 'fort':
        p.fort = Math.min(C.construction.fortMax, p.fort + 1);
        notify(sim, pr.nation, 'low', 'build', `The fort at ${provName(sim, pid)} is now level ${p.fort}.`, { province: pid });
        bump(sim);
        break;
      case 'charter':
        p.integration = Math.min(100, p.integration + C.construction.charterGain);
        p.unrest = Math.max(0, p.unrest - 10);
        notify(sim, pr.nation, 'low', 'build', `Charters granted in ${provName(sim, pid)}: integration +${C.construction.charterGain}.`, { province: pid });
        break;
      case 'settle':
        p.owner = pr.nation;
        p.controller = pr.nation;
        p.integration = C.integration.settled;
        p.unrest = 10;
        p.lastOwnerChange = st.tick;
        if (!p.claims.includes(pr.nation)) p.claims.push(pr.nation);
        st.nations[pr.nation].stats.provincesGained++;
        notify(sim, pr.nation, 'normal', 'build', `Settlers have founded a new frontier province: ${provName(sim, pid)}.`, { province: pid });
        bump(sim);
        break;
    }
  }
}
