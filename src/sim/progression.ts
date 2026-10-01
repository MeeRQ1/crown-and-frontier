// Research and national policy.
//
// Research points / month = (0.5 + 0.4 * sqrt(sum(dev * integration factor)))
//                           * funding (1.0 / 1.4 / 1.8 / 2.2) * (1 + modifiers) * (1 - overextension/2)
// Funding costs 0% / 8% / 18% / 32% of gross income. Points go into the selected
// technology; with nothing selected up to 60 points are banked.
// Each technology has a horizon year: before it the cost rises 15% per year
// early, and no technology can be finished more than 10 years early.
// Policies: switching costs 20 + half a month's income (free in the first month)
// and is locked for 24 months after each change.

import { C, forceLabel } from './config';
import { POLICIES, POLICY_COOLDOWN_MONTHS } from './data/policies';
import { TECHS } from './data/techs';
import { grossIncome, integrationFactor } from './economy';
import { overextension } from './integration';
import { nationMods } from './modifiers';
import { dateOf, months, notify, ownedProvinces, type Sim } from './state';
import type { NationId, TechId } from './types';

export function researchRate(sim: Sim, nid: NationId): number {
  const st = sim.state;
  const n = st.nations[nid];
  let dev = 0;
  for (const pid of ownedProvinces(sim, nid)) {
    const p = st.provinces[pid];
    if (p.controller === nid) dev += p.dev * integrationFactor(p.integration);
  }
  const base = 0.5 + 0.4 * Math.sqrt(dev);
  return base * C.economy.fundingMul[n.research.funding] * Math.max(0.1, 1 + nationMods(sim, nid).research) * (1 - Math.min(0.5, overextension(sim, nid) / 2));
}

export function techAvailable(sim: Sim, nid: NationId, tech: TechId): boolean {
  const t = TECHS[tech];
  const n = sim.state.nations[nid];
  if (!t || n.research.done.includes(tech)) return false;
  return t.requires.every((r) => n.research.done.includes(r));
}

/** Years before its horizon the current date lies (0 when the horizon has passed). */
export function yearsEarly(sim: Sim, tech: TechId): number {
  const t = TECHS[tech];
  return Math.max(0, t.year - dateOf(sim).year);
}

/** The earliest year a technology can be completed. */
export function earliestYear(tech: TechId): number {
  return TECHS[tech].year - TECH_LEAD_YEARS;
}

export const TECH_LEAD_YEARS = 10;
export const TECH_EARLY_COST = 0.15;

export function researchProblem(sim: Sim, nid: NationId, tech: TechId): string | null {
  const t = TECHS[tech];
  const n = sim.state.nations[nid];
  if (!t) return 'Unknown technology.';
  if (n.research.done.includes(tech)) return 'Already researched.';
  const missing = t.requires.filter((r) => !n.research.done.includes(r));
  if (missing.length) return `Requires ${missing.map((m) => TECHS[m].name).join(', ')}.`;
  if (n.research.current === tech) return 'Already researching this.';
  if (yearsEarly(sim, tech) > TECH_LEAD_YEARS) return `Too far ahead of its time: research can begin, at the earliest, ${TECH_LEAD_YEARS} years before ${t.year} (in ${earliestYear(tech)}).`;
  return null;
}

export function monthlyResearch(sim: Sim): void {
  const st = sim.state;
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive) continue;
    const gain = researchRate(sim, nid);
    n.lastMonth.researchGain = gain;
    n.research.progress += gain;
    const cur = n.research.current;
    if (!cur) {
      n.research.progress = Math.min(n.research.progress, 60);
      continue;
    }
    const t = TECHS[cur];
    const cost = techCost(sim, cur);
    if (n.research.progress >= cost && yearsEarly(sim, cur) <= TECH_LEAD_YEARS) {
      n.research.progress -= cost;
      n.research.done.push(cur);
      n.research.current = null;
      notify(sim, nid, 'normal', 'research', `Research complete: ${t.name}.${t.unlocks ? ` We can now build ${forceLabel(t.unlocks).toLowerCase()}.` : ''} Choose the next technology.`);
    }
  }
}

export function policySwitchCost(sim: Sim, nid: NationId): number {
  if (sim.state.tick < 4) return 0;
  return Math.round(20 + 0.5 * grossIncome(sim.state.nations[nid].lastMonth));
}

export function policyProblem(sim: Sim, nid: NationId, policy: string): string | null {
  const n = sim.state.nations[nid];
  if (!POLICIES[policy]) return 'Unknown policy.';
  if (n.policy === policy) return 'Already the national policy.';
  const ready = n.policySince + months(POLICY_COOLDOWN_MONTHS);
  if (sim.state.tick < ready) return `Policy was changed recently; next change possible in ${dateOf(sim, ready).short}.`;
  const cost = policySwitchCost(sim, nid);
  if (n.treasury < cost) return `Changing policy costs ${cost} crowns.`;
  return null;
}

export function setPolicy(sim: Sim, nid: NationId, policy: string): void {
  const n = sim.state.nations[nid];
  n.treasury -= policySwitchCost(sim, nid);
  n.policy = policy;
  n.policySince = sim.state.tick;
}

/**
 * Research points a technology costs now on the map being played. Larger maps
 * have larger realms that research faster, so their costs are scaled up
 * (ScenarioDef.researchCostMul) to keep the tree lasting a whole campaign;
 * researching before the horizon year costs 15% more per year early.
 */
export function techCost(sim: Sim, id: string): number {
  return Math.round(TECHS[id].cost * (sim.world.scenario.researchCostMul ?? 1) * (1 + TECH_EARLY_COST * yearsEarly(sim, id)));
}
