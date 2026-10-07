// System-usage counters for AI-only campaigns: does every realm use each system,
// and do the economy's shares stay inside the stage checks? Read-only: it
// samples the state after each step and never changes it.

import { UNIT_TYPES } from '../src/sim/config';
import { TECH_LIST, TECHS } from '../src/sim/data/techs';
import { atWar, dateOf, enemiesOf, isFriendly, type Sim } from '../src/sim/state';
import { grossIncome } from '../src/sim/economy';
import { activeProjects, buildSlots } from '../src/sim/construction';
import { reachFrom } from '../src/sim/ai/common';
import { getFocus } from '../src/sim/focus';
import { sphereOf } from '../src/sim/influence';
import { victoryProgress } from '../src/sim/victory';
import type { VictoryPath } from '../src/sim/types';
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
  /** surviving realms with no industry in their last month (and their size) */
  industryIdle?: string[];
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
  /** navy: surviving realms with a coast, those that built ships, and those that used fleets (at sea, battles, blockades or landings) */
  coastalEnd?: number;
  navyBuilders?: number;
  navyUsers?: number;
  navyIdle?: string[];
  /** coastal realms that were at war while they and an enemy both had a coast */
  navyWarred?: number;
  /** coastal realms never at war with a coastal realm while coastal themselves */
  navyPeaceful?: string[];
  /** air: surviving realms past era III (any era-IV technology), those that built wings and flew missions */
  eraFourEnd?: number;
  airUsers?: number;
  airIdle?: string[];
  /** totals over all realms */
  forces?: { shipsBuilt: number; navalBattles: number; landings: number; blockadeWeeks: number; seaWeeks: number; wingsBuilt: number; airMissionWeeks: number; bombingWeeks: number };
  /** Stage E: diplomacy and focus */
  diplomacy?: {
    settlements: number;
    settlementsShared: number;
    demands: Record<string, number>;
    guaranteesGiven: number;
    guaranteeCalls: number;
    loansGiven: number;
    loanCrowns: number;
    blocRealmMonths: number;
    sphereRealmMonths: number;
    /** realms that ever gave a guarantee, lent, belonged to a bloc or led a sphere */
    guarantors: number;
    lenders: number;
    blocMembers: number;
    sphereLeaders: number;
    realms: number;
  };
  focus?: {
    /** focuses completed per surviving realm, and the share of them national */
    perRealm: number;
    nationalShare: number;
    /** surviving realms that completed their national ambition, a claim focus, any national focus */
    ambitions: number;
    claims: number;
    anyNational: number;
    aliveEnd: number;
    /** the branches of each surviving realm's first three generic focuses */
    leaning: Record<string, number>;
    /** doctrine choices made (exclusive pairs) */
    doctrines: Record<string, number>;
  };
  /** realm-months in another realm's sphere (at month ends) */
  inSphereMonths?: number;
  /** atlas update: trade contracts — realm-months holding one, contracts in force (summed over months), totals at the end */
  contractRealmMonths?: number;
  contractMonths?: number;
  contracts?: { signed: number; kept: number; defaulted: number; cancelled: number; units: number; holders: number; realms: number };
  /**
   * AI diagnostics (atlas update). Idle in the rear: field armies (2+ regiments)
   * of a realm at war, standing still 8+ weeks on their own side's ground, with
   * no enemy-held province or enemy army next door and not besieging. Pointless
   * wars: wars that ended with no province changing hands between the sides and
   * no crowns, reparations or other demand paid. Idle treasury: realm-months with
   * more than 10 months of gross income in the treasury and a builder free.
   * Idle months are split by whether the army could march to any enemy-held
   * province at all: those that cannot (overseas, or every route barred) need a
   * landing; those that can are the operational AI's to fix.
   */
  armyWarMonths?: number;
  idleRearMonths?: number;
  idleNoRouteMonths?: number;
  warsEnded?: number;
  pointlessWars?: number;
  idleTreasuryMonths?: number;
  /** the closest any realm came to each victory path: peak condition progress (0–1) and peak timer share */
  victoryPeaks?: Record<VictoryPath, { progress: number; timer: number; who: string }>;
}

export class UsageTracker {
  private done = new Map<string, number>();
  /** wars under way: start owners of every province held by a participant, and settlements counted at the start */
  private wars = new Map<string, { owners: Map<string, string | null>; parties: Set<string>; demands: number }>();
  /** realms that were at some month-end at war while they and an enemy both had a coast */
  private seaWar = new Set<string>();
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
      if (!this.seaWar.has(n.id)) {
        // a war at sea needs a coast on both sides at the time
        const coastal = (nid: string) => this.sim.world.provIds.some((p) => st.provinces[p].owner === nid && this.sim.world.provZones[p]);
        const foes = enemiesOf(this.sim, n.id);
        if (foes.length && coastal(n.id) && foes.some(coastal)) this.seaWar.add(n.id);
      }
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
    let inSphere = 0;
    for (const n of this.living()) if (sphereOf(this.sim, n.id)) inSphere++;
    this.r.inSphereMonths = (this.r.inSphereMonths ?? 0) + inSphere;
    const holders = new Set<string>();
    for (const c of st.contracts ?? []) {
      holders.add(c.seller);
      holders.add(c.buyer);
    }
    this.r.contractRealmMonths = (this.r.contractRealmMonths ?? 0) + this.living().filter((n) => holders.has(n.id)).length;
    this.aiDiagnostics();
    this.r.contractMonths = (this.r.contractMonths ?? 0) + (st.contracts?.length ?? 0);
    // once a year: how close each realm is to each victory path
    if (st.tick % 48 === 0) {
      const peaks = (this.r.victoryPeaks ??= { territorial: { progress: 0, timer: 0, who: '' }, economic: { progress: 0, timer: 0, who: '' }, diplomatic: { progress: 0, timer: 0, who: '' } });
      for (const n of this.living()) {
        const vp = victoryProgress(this.sim, n.id);
        for (const k of ['territorial', 'economic', 'diplomatic'] as VictoryPath[]) {
          const p = peaks[k];
          if (vp[k].progress > p.progress) {
            p.progress = vp[k].progress;
            p.who = n.id;
          }
          p.timer = Math.max(p.timer, vp[k].streak / vp[k].required);
        }
      }
    }
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

  private aiDiagnostics(): void {
    const sim = this.sim;
    const st = sim.state;
    const enemyNear = (nid: string, pid: string) =>
      sim.world.prov[pid].neighbors.some((nb) => {
        const c = st.provinces[nb].controller;
        return (c && atWar(sim, nid, c)) || Object.values(st.armies).some((x) => x.location === nb && atWar(sim, nid, x.nation));
      });
    for (const a of Object.values(st.armies)) {
      if (a.regiments.length < 2 || a.embarked || !enemiesOf(sim, a.nation).length) continue;
      this.r.armyWarMonths = (this.r.armyWarMonths ?? 0) + 1;
      const p = st.provinces[a.location];
      if (!a.path.length && !a.battle && a.stationary >= 8 && isFriendly(sim, a.nation, p.controller) && p.siege?.nation !== a.nation && !enemyNear(a.nation, a.location)) {
        this.r.idleRearMonths = (this.r.idleRearMonths ?? 0) + 1;
        const r = reachFrom(sim, a.nation, a.location);
        const route = sim.world.provIds.some((pid) => r.dist[pid] !== undefined && !!st.provinces[pid].controller && atWar(sim, a.nation, st.provinces[pid].controller!));
        if (!route) this.r.idleNoRouteMonths = (this.r.idleNoRouteMonths ?? 0) + 1;
      }
    }
    // wars: remember who held what when each began; judge each when it ends
    const demandsNow = () => sim.world.nationIds.reduce((s, n) => s + (st.nations[n].stats.demandsWon ?? 0), 0);
    for (const w of Object.values(st.wars)) {
      if (this.wars.has(w.id)) continue;
      const parties = new Set([...w.attackers, ...w.defenders]);
      const owners = new Map<string, string | null>();
      for (const pid of sim.world.provIds) if (parties.has(st.provinces[pid].owner ?? '')) owners.set(pid, st.provinces[pid].owner);
      this.wars.set(w.id, { owners, parties, demands: demandsNow() });
    }
    for (const [id, rec] of this.wars) {
      if (st.wars[id]) continue;
      this.wars.delete(id);
      this.r.warsEnded = (this.r.warsEnded ?? 0) + 1;
      let changed = false;
      for (const [pid, o] of rec.owners) if (st.provinces[pid].owner !== o && rec.parties.has(st.provinces[pid].owner ?? '')) changed = true;
      // demands won anywhere since it began count as an outcome (gold, reparations, sphere…)
      if (!changed && demandsNow() === rec.demands) this.r.pointlessWars = (this.r.pointlessWars ?? 0) + 1;
    }
    for (const n of this.living()) {
      const gross = Math.max(5, grossIncome(n.lastMonth));
      if (n.treasury > gross * 10 && activeProjects(sim, n.id).length < buildSlots(sim, n.id)) this.r.idleTreasuryMonths = (this.r.idleTreasuryMonths ?? 0) + 1;
    }
  }

  finish(): UsageReport {
    const alive = this.living();
    this.r.aliveEnd = alive.length;
    this.r.industryEnd = alive.filter((n) => n.lastMonth.industry > 0).length;
    this.r.industryIdle = alive.filter((n) => n.lastMonth.industry <= 0).map((n) => `${n.id} (${this.sim.world.provIds.filter((p) => this.sim.state.provinces[p].owner === n.id).length} provinces)`);
    this.r.techShareEnd = alive.reduce((s, n) => s + n.research.done.filter((t) => TECHS[t]).length, 0) / Math.max(1, alive.length) / TECH_LIST.length;
    this.r.factoriesEnd = this.factories();
    const sim = this.sim;
    const coastal = alive.filter((n) => sim.world.provIds.some((p) => sim.state.provinces[p].owner === n.id && sim.world.provZones[p]));
    this.r.coastalEnd = coastal.length;
    this.r.navyBuilders = coastal.filter((n) => n.stats.shipsBuilt > 0).length;
    const usedNavy = (n: (typeof alive)[number]) => n.stats.seaWeeks > 0 || n.stats.navalBattles > 0 || n.stats.blockadeWeeks > 0 || n.stats.landings > 0;
    // a realm never at war with a coastal realm while it had a coast itself has no use for a
    // fleet beyond its home waters: it counts as a builder only, and is listed separately
    const warred = coastal.filter((n) => this.seaWar.has(n.id));
    this.r.navyWarred = warred.length;
    this.r.navyUsers = warred.filter(usedNavy).length;
    this.r.navyIdle = warred.filter((n) => !usedNavy(n) || n.stats.shipsBuilt === 0).map((n) => n.id);
    this.r.navyPeaceful = coastal.filter((n) => !this.seaWar.has(n.id)).map((n) => n.id);
    const eraFour = alive.filter((n) => n.research.done.some((t) => (TECHS[t]?.era ?? 0) >= 4));
    this.r.eraFourEnd = eraFour.length;
    const usedAir = (n: (typeof alive)[number]) => n.stats.wingsBuilt > 0 && n.stats.airMissionWeeks > 0;
    this.r.airUsers = eraFour.filter(usedAir).length;
    this.r.airIdle = eraFour.filter((n) => !usedAir(n)).map((n) => n.id);
    const f = { shipsBuilt: 0, navalBattles: 0, landings: 0, blockadeWeeks: 0, seaWeeks: 0, wingsBuilt: 0, airMissionWeeks: 0, bombingWeeks: 0 };
    for (const nid of sim.world.nationIds) {
      const st = sim.state.nations[nid].stats;
      for (const k of Object.keys(f) as Array<keyof typeof f>) f[k] += st[k] ?? 0;
    }
    this.r.forces = f;
    // Stage E
    const all = sim.world.nationIds.map((nid) => sim.state.nations[nid]);
    const demands: Record<string, number> = {};
    for (const n of all) for (const [k, v] of Object.entries(n.stats.demands ?? {})) demands[k] = (demands[k] ?? 0) + (v ?? 0);
    const sum = (k: 'settlementsImposed' | 'settlementsShared' | 'guaranteesGiven' | 'guaranteeCalls' | 'loansGiven' | 'loanCrowns' | 'blocMonths' | 'sphereMonths' | 'contractsSigned' | 'contractsKept' | 'contractsDefaulted' | 'contractsCancelled' | 'contractUnits') => all.reduce((s, n) => s + (n.stats[k] ?? 0), 0);
    this.r.diplomacy = {
      settlements: sum('settlementsImposed'),
      settlementsShared: sum('settlementsShared'),
      demands,
      guaranteesGiven: sum('guaranteesGiven'),
      guaranteeCalls: sum('guaranteeCalls'),
      loansGiven: sum('loansGiven'),
      loanCrowns: sum('loanCrowns'),
      blocRealmMonths: sum('blocMonths'),
      sphereRealmMonths: sum('sphereMonths'),
      guarantors: all.filter((n) => n.stats.guaranteesGiven > 0).length,
      lenders: all.filter((n) => n.stats.loansGiven > 0).length,
      blocMembers: all.filter((n) => n.stats.blocMonths > 0).length,
      sphereLeaders: all.filter((n) => n.stats.sphereMonths > 0).length,
      realms: all.length,
    };
    this.r.contracts = {
      // each contract counts once per party in the statistics
      signed: sum('contractsSigned') / 2,
      kept: sum('contractsKept') / 2,
      defaulted: sum('contractsDefaulted'),
      cancelled: sum('contractsCancelled'),
      units: sum('contractUnits'),
      holders: all.filter((n) => (n.stats.contractsSigned ?? 0) > 0).length,
      realms: all.length,
    };
    let done = 0;
    let national = 0;
    const leaning: Record<string, number> = {};
    const doctrines: Record<string, number> = {};
    const pairs = ['army_levy', 'army_prof', 'army_fortress', 'army_offensive', 'dip_concord', 'dip_real', 'ind_war', 'ind_consumer', 'sea_battle', 'sea_raid'];
    for (const n of alive) {
      let generic = 0;
      for (const id of n.focus.done) {
        const d = getFocus(sim, n.id, id);
        if (!d) continue;
        done++;
        if (d.branch === 'national') national++;
        // the branches of each realm's first three generic focuses: what it put first
        else if (generic++ < 3) leaning[d.branch] = (leaning[d.branch] ?? 0) + 1;
        if (pairs.includes(id)) doctrines[id] = (doctrines[id] ?? 0) + 1;
      }
    }
    this.r.focus = {
      perRealm: done / Math.max(1, alive.length),
      nationalShare: done ? national / done : 0,
      ambitions: alive.filter((n) => n.focus.done.includes('nat_ambition')).length,
      claims: alive.filter((n) => n.focus.done.some((x) => x.startsWith('nat_claim_'))).length,
      anyNational: alive.filter((n) => n.focus.done.some((x) => x.startsWith('nat_'))).length,
      aliveEnd: alive.length,
      leaning,
      doctrines,
    };
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
    `- Industry at the end: ${runs.reduce((s, u) => s + u.industryEnd, 0)} of ${runs.reduce((s, u) => s + u.aliveEnd, 0)} surviving realms ran factories in their last month; factories ${runs.reduce((s, u) => s + u.factoriesStart, 0)} → ${runs.reduce((s, u) => s + u.factoriesEnd, 0)} (sum over runs)${runs.some((u) => u.industryIdle?.length) ? `; without industry: ${runs.flatMap((u) => u.industryIdle ?? []).join(', ')}` : ''}.`,
    `- Average treasury at year 40: ${y40 === null ? 'n/a (no run reached year 40)' : `${y40.toFixed(2)}× monthly income`}; check: below 5×.`,
    `- Research: the average surviving realm finished ${pct(avg((u) => u.techShareEnd))} of the tree; ${runs.reduce((s, u) => s + u.techsFinished, 0)} technologies finished in all; at most ${Math.max(...runs.map((u) => u.maxYearsEarly))} years before a horizon (check: at most 10).`,
    `- Army composition (regiment-months): ${UNIT_TYPES.map((t) => `${t} ${pct(regs[t] / Math.max(1, regTotal))}`).join(', ')}.`,
    `- Shortages (share of realm-months): ${short.join(', ')}.`,
    ...(runs.some((u) => u.coastalEnd !== undefined)
      ? [
          `- Navy: ${runs.reduce((s, u) => s + (u.navyBuilders ?? 0), 0)} of ${runs.reduce((s, u) => s + (u.coastalEnd ?? 0), 0)} surviving coastal realms built ships; ${runs.reduce((s, u) => s + (u.navyUsers ?? 0), 0)} of the ${runs.reduce((s, u) => s + (u.navyWarred ?? u.coastalEnd ?? 0), 0)} that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops)${idleList(runs.map((u) => u.navyIdle ?? []))}; check: all. Never at war with a coastal realm while coastal (built only): ${countList(runs.map((u) => u.navyPeaceful ?? [])) || 'none'}.`,
          `- Air: ${runs.reduce((s, u) => s + (u.airUsers ?? 0), 0)} of ${runs.reduce((s, u) => s + (u.eraFourEnd ?? 0), 0)} surviving realms past era III built wings and flew missions${idleList(runs.map((u) => u.airIdle ?? []))}; check: all.`,
          `- Totals per run: ${forceTotals(runs)}.`,
        ]
      : []),
    ...diplomacyLines(runs),
    ...peakLines(runs),
    '',
  ];
}

/** How close realms came to each victory path (for campaigns that ended on score). */
function peakLines(runs: UsageReport[]): string[] {
  const r = runs.filter((u) => u.victoryPeaks);
  if (!r.length) return [];
  const fmt = (k: VictoryPath) => r.map((u) => `${Math.round(u.victoryPeaks![k].progress * 100)}%${u.victoryPeaks![k].timer > 0 ? `/${Math.round(u.victoryPeaks![k].timer * 100)}%` : ''} ${u.victoryPeaks![k].who}`).join(', ');
  return [`- Closest approach to each victory (best condition progress / best timer share, by run): territorial ${fmt('territorial')}; economic ${fmt('economic')}; diplomatic ${fmt('diplomatic')}.`];
}

/** Stage E: peace settlements, guarantees, loans, blocs, spheres and focus. */
function aiLines(runs: UsageReport[]): string[] {
  if (!runs.some((u) => u.armyWarMonths !== undefined)) return [];
  const sum = (f: (u: UsageReport) => number | undefined) => runs.reduce((s, u) => s + (f(u) ?? 0), 0);
  const realmMonths = sum((u) => u.realmMonths);
  return [
    `- AI diagnostics: field armies idle in the rear while at war ${((sum((u) => u.idleRearMonths) / Math.max(1, sum((u) => u.armyWarMonths))) * 100).toFixed(1)}% of army-months at war (${((sum((u) => (u.idleRearMonths ?? 0) - (u.idleNoRouteMonths ?? 0)) / Math.max(1, sum((u) => u.armyWarMonths))) * 100).toFixed(1)}% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) ${sum((u) => u.pointlessWars)} of ${sum((u) => u.warsEnded)} ended (${((sum((u) => u.pointlessWars) / Math.max(1, sum((u) => u.warsEnded))) * 100).toFixed(0)}%); idle treasuries (over 10 months of income with a builder free) ${((sum((u) => u.idleTreasuryMonths) / Math.max(1, realmMonths)) * 100).toFixed(1)}% of realm-months.`,
  ];
}

function contractLines(runs: UsageReport[]): string[] {
  const c = runs.map((u) => u.contracts).filter((x): x is NonNullable<UsageReport['contracts']> => !!x);
  if (!c.length) return [];
  const realmMonths = runs.reduce((s, u) => s + u.realmMonths, 0);
  const tot = (k: keyof (typeof c)[number]) => c.reduce((s, x) => s + x[k], 0);
  return [
    `- Trade contracts: ${(tot('signed') / c.length).toFixed(1)} signed per run (${tot('holders')} of ${tot('realms')} realms signed at least one); realms held one in ${((runs.reduce((s, u) => s + (u.contractRealmMonths ?? 0), 0) / Math.max(1, realmMonths)) * 100).toFixed(1)}% of realm-months, ${(runs.reduce((s, u) => s + (u.contractMonths ?? 0), 0) / Math.max(1, runs.reduce((s, u) => s + u.realmMonths, 0)) ).toFixed(2)} contracts in force per realm-month; per run ${(tot('kept') / c.length).toFixed(1)} ran their term, ${(tot('defaulted') / c.length).toFixed(1)} ended in default, ${(tot('cancelled') / c.length).toFixed(1)} were cancelled; ${Math.round(tot('units') / c.length)} units shipped per run.`,
  ];
}

function diplomacyLines(runs: UsageReport[]): string[] {
  const d = runs.map((u) => u.diplomacy).filter((x): x is NonNullable<UsageReport['diplomacy']> => !!x);
  const f = runs.map((u) => u.focus).filter((x): x is NonNullable<UsageReport['focus']> => !!x);
  if (!d.length) return [];
  const per = (k: keyof (typeof d)[number]) => (d.reduce((s, x) => s + (x[k] as number), 0) / d.length).toFixed(1);
  const tot = (k: keyof (typeof d)[number]) => d.reduce((s, x) => s + (x[k] as number), 0);
  const demands: Record<string, number> = {};
  for (const x of d) for (const [k, v] of Object.entries(x.demands)) demands[k] = (demands[k] ?? 0) + v;
  const dl = Object.entries(demands).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
  const realms = tot('realms');
  const realmMonths = runs.reduce((s, u) => s + u.realmMonths, 0);
  const lines = [
    `- Peace settlements per run: ${per('settlements')} (${tot('settlementsShared')} of ${tot('settlements')} shared among several winners); demands won: ${dl}.`,
    `- Guarantees given per run ${per('guaranteesGiven')} (${tot('guarantors')} of ${realms} realms gave one), honoured by joining a war ${tot('guaranteeCalls')} times; loans per run ${per('loansGiven')} (${tot('lenders')} lenders, ${Math.round(tot('loanCrowns') / d.length)} crowns lent per run).`,
    ...contractLines(runs),
    ...aiLines(runs),
    `- Trade blocs: ${tot('blocMembers')} of ${realms} realms were members (${(tot('blocRealmMonths') / Math.max(1, realmMonths) * 100).toFixed(1)}% of realm-months); spheres: ${tot('sphereLeaders')} realms led one, and realms spent ${(runs.reduce((s, u) => s + (u.inSphereMonths ?? 0), 0) / Math.max(1, realmMonths) * 100).toFixed(1)}% of realm-months in another's sphere.`,
  ];
  if (f.length) {
    const alive = f.reduce((s, x) => s + x.aliveEnd, 0);
    const lean: Record<string, number> = {};
    const doc: Record<string, number> = {};
    for (const x of f) {
      for (const [k, v] of Object.entries(x.leaning)) lean[k] = (lean[k] ?? 0) + v;
      for (const [k, v] of Object.entries(x.doctrines)) doc[k] = (doc[k] ?? 0) + v;
    }
    lines.push(
      `- National focus: ${(f.reduce((s, x) => s + x.perRealm * x.aliveEnd, 0) / Math.max(1, alive)).toFixed(1)} focuses completed per surviving realm (${(f.reduce((s, x) => s + x.nationalShare * x.perRealm * x.aliveEnd, 0) / Math.max(1, f.reduce((s, x) => s + x.perRealm * x.aliveEnd, 0)) * 100).toFixed(0)}% national); ${f.reduce((s, x) => s + x.anyNational, 0)} of ${alive} completed national focuses, ${f.reduce((s, x) => s + x.claims, 0)} a claim, ${f.reduce((s, x) => s + x.ambitions, 0)} their ambition. First generic focuses by branch: ${Object.entries(lean).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}. Doctrines: ${Object.entries(doc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    );
  }
  return lines;
}

function countList(lists: string[][]): string {
  const c = new Map<string, number>();
  for (const x of lists.flat()) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k} ×${v}`).join(', ');
}

function idleList(lists: string[][]): string {
  const all = lists.flat();
  if (!all.length) return '';
  const c = new Map<string, number>();
  for (const x of all) c.set(x, (c.get(x) ?? 0) + 1);
  return ` (not: ${[...c].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join(', ')})`;
}

function forceTotals(runs: UsageReport[]): string {
  const keys = ['shipsBuilt', 'navalBattles', 'landings', 'blockadeWeeks', 'seaWeeks', 'wingsBuilt', 'airMissionWeeks', 'bombingWeeks'] as const;
  const labels: Record<(typeof keys)[number], string> = { shipsBuilt: 'ships built', navalBattles: 'naval battle sides', landings: 'landings', blockadeWeeks: 'blockade weeks', seaWeeks: 'fleet weeks at sea', wingsBuilt: 'wings built', airMissionWeeks: 'wing-weeks on missions', bombingWeeks: 'bombing wing-weeks' };
  return keys.map((k) => `${labels[k]} ${(runs.reduce((s, u) => s + (u.forces?.[k] ?? 0), 0) / runs.length).toFixed(1)}`).join(', ');
}
