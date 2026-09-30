// Research and national policy.
//
// Research points / month = (0.5 + 0.4 * sqrt(sum(dev * integration factor)))
//                           * funding (1.0 / 1.4 / 1.8 / 2.2) * (1 + modifiers) * (1 - overextension/2)
// Funding costs 0% / 8% / 18% / 32% of gross income. Points go into the selected
// technology; with nothing selected up to 60 points are banked.
// Policies: switching costs 20 + half a month's income (free in the first month)
// and is locked for 24 months after each change.

import { C } from './config';
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

export function researchProblem(sim: Sim, nid: NationId, tech: TechId): string | null {
  const t = TECHS[tech];
  const n = sim.state.nations[nid];
  if (!t) return 'Unknown technology.';
  if (n.research.done.includes(tech)) return 'Already researched.';
  const missing = t.requires.filter((r) => !n.research.done.includes(r));
  if (missing.length) return `Requires ${missing.map((m) => TECHS[m].name).join(', ')}.`;
  if (n.research.current === tech) return 'Already researching this.';
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
    if (n.research.progress >= t.cost) {
      n.research.progress -= t.cost;
      n.research.done.push(cur);
      n.research.current = null;
      notify(sim, nid, 'normal', 'research', `Research complete: ${t.name}. Choose the next technology.`);
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
