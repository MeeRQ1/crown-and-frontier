// Research.
//
// Research points / month = (0.5 + 0.4 * sqrt(sum(dev * integration factor)))
//                           * funding (1.0 / 1.4 / 1.8 / 2.2) * (1 + modifiers) * (1 - overextension/2)
// Funding costs 0% / 8% / 18% / 32% of gross income. Points go into the selected
// technology; with nothing selected up to 60 points are banked.
// Each technology has a horizon year: before it the cost rises 15% per year
// early, and no technology can be finished more than 10 years early.

import { C, forceLabel } from './config';
import { TECH_LIST, TECHS } from './data/techs';
import { integrationFactor } from './economy';
import { overextension } from './integration';
import { nationMods } from './modifiers';
import { dateOf, notify, ownedProvinces, type Sim } from './state';
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

/** The pace of research every map is calibrated to: months per technology at the start (see researchPace). */
export const RESEARCH_PACE_MONTHS = 40;

/**
 * How fast research feels at the start of a campaign, in months per technology: the
 * mean of two realms' months for their three cheapest available technologies, the
 * median realm's and the median of the strongest quarter's. The hand-made maps lie
 * between 34 and 52; the generated maps' cost multiplier is set to give
 * RESEARCH_PACE_MONTHS, because a late start leaves only the costly technologies
 * and the realms' research rates do not follow their number of provinces.
 */
export function researchPace(sim: Sim): number {
  const per = sim.world.nationIds.map((nid) => {
    const costs = TECH_LIST.filter((t) => techAvailable(sim, nid, t.id))
      .map((t) => techCost(sim, t.id))
      .sort((a, b) => a - b)
      .slice(0, 3);
    const rate = researchRate(sim, nid);
    return { rate, months: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length / rate : 0 };
  });
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const strongest = [...per].sort((a, b) => b.rate - a.rate).slice(0, Math.max(3, Math.round(per.length / 4)));
  return (median(per.map((x) => x.months)) + median(strongest.map((x) => x.months))) / 2;
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
