// System-usage counters for AI-only campaigns: does every realm use each system,
// and do the economy's shares stay inside the stage checks? Read-only: it
// samples the state after each step and never changes it.

import { UNIT_TYPES } from '../src/sim/config';
import { TECH_LIST, TECHS } from '../src/sim/data/techs';
import { dateOf, type Sim } from '../src/sim/state';
import type { StrategicResource, UnitType } from '../src/sim/types';

const STRATEGIC: StrategicResource[] = ['coal', 'iron', 'oil', 'rubber', 'nitrates'];
const TRADE_INCOME = ['Resource sales', 'Commerce'];

export interface UsageReport {
  /** Σ trade income / Σ income over living realms in the month the year-25 mark falls */
  tradeShareY25: number | null;
  tradeShareY25Max: number | null;
  /** average treasury / average monthly income over living realms at year 40 */
  treasuryMonthsY40: number | null;
  /** living realms at the end, and how many of them ran factories in their last month */
  aliveEnd: number;
  industryEnd: number;
  /** share of the tree finished by the average living realm at the end */
  techShareEnd: number;
  /** most years before its horizon any technology was finished */
  maxYearsEarly: number;
  /** technologies finished during the campaign */
  techsFinished: number;
  /** factories at the start and end (all realms) */
  factoriesStart: number;
  factoriesEnd: number;
  /** regiment-months by unit type (standing armies at each month end) */
  regimentMonths: Record<UnitType, number>;
  /** realm-months short of each resource */
  shortageMonths: Record<StrategicResource, number>;
  /** realm-months with at least one trade agreement / all realm-months */
  tradeRealmMonths: number;
  realmMonths: number;
}

export class UsageTracker {
  private done = new Map<string, number>();
  private r: UsageReport;
  constructor(private sim: Sim) {
    this.r = {
      tradeShareY25: null,
      tradeShareY25Max: null,
      treasuryMonthsY40: null,
      aliveEnd: 0,
      industryEnd: 0,
      techShareEnd: 0,
      maxYearsEarly: 0,
      techsFinished: 0,
      factoriesStart: this.factories(),
      factoriesEnd: 0,
      regimentMonths: Object.fromEntries(UNIT_TYPES.map((t) => [t, 0])) as Record<UnitType, number>,
      shortageMonths: Object.fromEntries(STRATEGIC.map((t) => [t, 0])) as Record<StrategicResource, number>,
      tradeRealmMonths: 0,
      realmMonths: 0,
    };
    for (const nid of sim.world.nationIds) this.done.set(nid, sim.state.nations[nid].research.done.length);
  }

  private factories(): number {
    let f = 0;
    for (const pid of this.sim.world.provIds) f += this.sim.state.provinces[pid].factories;
    return f;
  }

  private living() {
    return this.sim.world.nationIds.map((n) => this.sim.state.nations[n]).filter((n) => n.alive);
  }

  /** Call after every step. */
  afterStep(): void {
    const st = this.sim.state;
    if (st.tick % 4 !== 0) return; // month ends only
    const year = dateOf(this.sim).year;
    const pacts = new Set<string>();
    for (const t of st.treaties) {
      if (t.type !== 'trade') continue;
      pacts.add(t.a);
      pacts.add(t.b);
    }
    for (const n of this.living()) {
      this.r.realmMonths++;
      if (pacts.has(n.id)) this.r.tradeRealmMonths++;
      for (const s of n.shortages) this.r.shortageMonths[s]++;
      // newly finished technologies (done only grows)
      const prev = this.done.get(n.id) ?? 0;
      for (let i = prev; i < n.research.done.length; i++) {
        const t = TECHS[n.research.done[i]];
        if (!t) continue;
        this.r.techsFinished++;
        this.r.maxYearsEarly = Math.max(this.r.maxYearsEarly, t.year - year);
      }
      this.done.set(n.id, n.research.done.length);
    }
    for (const a of Object.values(st.armies)) for (const g of a.regiments) this.r.regimentMonths[g.type]++;
    if (st.tick === 25 * 48) {
      let trade = 0;
      let income = 0;
      let max = 0;
      for (const n of this.living()) {
        const inc = Object.values(n.lastMonth.income).reduce((s, v) => s + v, 0);
        const tr = TRADE_INCOME.reduce((s, k) => s + (n.lastMonth.income[k] ?? 0), 0);
        trade += tr;
        income += inc;
        if (inc > 0) max = Math.max(max, tr / inc);
      }
      this.r.tradeShareY25 = income > 0 ? trade / income : 0;
      this.r.tradeShareY25Max = max;
    }
    if (st.tick === 40 * 48) {
      const alive = this.living();
      const treasury = alive.reduce((s, n) => s + n.treasury, 0) / Math.max(1, alive.length);
      const income = alive.reduce((s, n) => s + Object.values(n.lastMonth.income).reduce((q, v) => q + v, 0), 0) / Math.max(1, alive.length);
      this.r.treasuryMonthsY40 = income > 0 ? treasury / income : null;
    }
  }

  finish(): UsageReport {
    const alive = this.living();
    this.r.aliveEnd = alive.length;
    this.r.industryEnd = alive.filter((n) => n.lastMonth.industry > 0).length;
    this.r.techShareEnd = alive.reduce((s, n) => s + n.research.done.filter((t) => TECHS[t]).length, 0) / Math.max(1, alive.length) / TECH_LIST.length;
    this.r.factoriesEnd = this.factories();
    return this.r;
  }
}

/** Markdown lines summarising usage over several runs. */
export function usageLines(runs: UsageReport[]): string[] {
  if (!runs.length) return [];
  const avg = (f: (u: UsageReport) => number | null) => {
    const v = runs.map(f).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
  const regs = Object.fromEntries(UNIT_TYPES.map((t) => [t, runs.reduce((s, u) => s + (u.regimentMonths[t] ?? 0), 0)])) as Record<UnitType, number>;
  const regTotal = Object.values(regs).reduce((a, b) => a + b, 0);
  const realmMonths = runs.reduce((s, u) => s + u.realmMonths, 0);
  const short = STRATEGIC.map((r) => `${r} ${pct(runs.reduce((s, u) => s + u.shortageMonths[r], 0) / Math.max(1, realmMonths))}`);
  const y40 = avg((u) => u.treasuryMonthsY40);
  return [
    '## System usage and stage checks',
    '',
    avg((u) => u.tradeShareY25) === null
      ? '- Trade income at year 25: n/a (no run reached year 25).'
      : `- Trade income at year 25: ${pct(avg((u) => u.tradeShareY25))} of all income on average (highest single realm ${pct(Math.max(...runs.map((u) => u.tradeShareY25Max ?? 0)))}); check: at most 30%.`,
    `- Realms with a trade agreement: ${pct(runs.reduce((s, u) => s + u.tradeRealmMonths, 0) / Math.max(1, realmMonths))} of realm-months.`,
    `- Industry at the end: ${runs.reduce((s, u) => s + u.industryEnd, 0)} of ${runs.reduce((s, u) => s + u.aliveEnd, 0)} surviving realms ran factories in their last month; factories ${runs.reduce((s, u) => s + u.factoriesStart, 0)} → ${runs.reduce((s, u) => s + u.factoriesEnd, 0)} (sum over runs).`,
    `- Average treasury at year 40: ${y40 === null ? 'n/a (no run reached year 40)' : `${y40.toFixed(2)}× monthly income`}; check: below 5×.`,
    `- Research: the average surviving realm finished ${pct(avg((u) => u.techShareEnd))} of the tree; ${runs.reduce((s, u) => s + u.techsFinished, 0)} technologies finished in all; at most ${Math.max(...runs.map((u) => u.maxYearsEarly))} years before a horizon (check: at most 10).`,
    `- Army composition (regiment-months): ${UNIT_TYPES.map((t) => `${t} ${pct(regs[t] / Math.max(1, regTotal))}`).join(', ')}.`,
    `- Shortages (share of realm-months): ${short.join(', ')}.`,
    '',
  ];
}
