// Economy, population and manpower. Settled monthly (every 4 ticks).
//
// Crowns:   province tax = (dev*1.0 + pop*0.012 + goods 2 + capital 3) * efficiency
//           efficiency = integrationFactor * (1 - unrest/200), 0 if occupied or in revolt
// Supplies: province = (dev*0.5*terrainProd + grain 3) * efficiency; armies consume per month.
// Reserve:  military-age men = pop*40 per thousand * (0.2+0.8*integration); the manpower
//           pool can never exceed reserve minus men already serving (no double counting).

import { C, TERRAIN, UNITS } from './config';
import { memoize, ownedBy } from './index';
import { nationMods } from './modifiers';
import { armiesOf, clamp, controlledProvinces, months, notify, ownedProvinces, treatyPartners, type Sim } from './state';
import { armySupplyInfo } from './supply';
import type { MonthlyLedger, NationId, ProvinceId } from './types';

export function integrationFactor(i: number): number {
  return 0.25 + 0.75 * (i / 100);
}

/** Share of a province's output reaching its legal owner. */
export function provinceEfficiency(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  if (!p.owner) return 0;
  if (p.controller !== p.owner) return 0;
  if (p.revoltUntil > sim.state.tick) return 0;
  return integrationFactor(p.integration) * (1 - p.unrest / 200);
}

/** Base crowns before national modifiers and efficiency. */
export function provinceBaseCrowns(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  const def = sim.world.prov[pid];
  let v = p.dev * C.economy.goldPerDev + p.pop * C.economy.goldPerPop;
  if (def.resource === 'goods') v += C.economy.goodsBonus;
  if (p.owner && sim.state.nations[p.owner]?.capital === pid) v += C.economy.capitalBonus;
  return v;
}

export function provinceCrowns(sim: Sim, pid: ProvinceId): number {
  return provinceBaseCrowns(sim, pid) * provinceEfficiency(sim, pid);
}

export function provinceSupplies(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  const def = sim.world.prov[pid];
  let v = p.dev * C.economy.supplyPerDev * TERRAIN[def.terrain].supplyProd;
  if (def.resource === 'grain') v += C.economy.grainBonus;
  return v * provinceEfficiency(sim, pid);
}

export function totalDev(sim: Sim, nid: NationId): number {
  let d = 0;
  for (const pid of ownedProvinces(sim, nid)) d += sim.state.provinces[pid].dev;
  return d;
}

export function stockpileCap(sim: Sim, nid: NationId): number {
  return C.economy.stockpileBase + C.economy.stockpilePerDev * totalDev(sim, nid);
}

/** Total military-age reserve (men). Occupied provinces contribute nothing. */
export function reserveCap(sim: Sim, nid: NationId): number {
  let r = 0;
  for (const pid of ownedProvinces(sim, nid)) {
    const p = sim.state.provinces[pid];
    if (p.controller !== nid) continue;
    r += p.pop * C.population.reservePerPop * (0.2 + 0.8 * (p.integration / 100));
  }
  return Math.max(0, r * (1 + nationMods(sim, nid).manpower));
}

/** Men currently serving: regiments plus recruits in training. */
export function menServing(sim: Sim, nid: NationId): number {
  let m = 0;
  for (const a of armiesOf(sim, nid)) for (const r of a.regiments) m += r.men;
  for (const pid of sim.world.provIds) for (const o of sim.state.provinces[pid].recruits) if (o.nation === nid) m += C.regimentSize;
  return m;
}

export function poolCap(sim: Sim, nid: NationId): number {
  return Math.max(0, reserveCap(sim, nid) - menServing(sim, nid));
}

export function manpowerRegen(sim: Sim, nid: NationId): number {
  return (reserveCap(sim, nid) / C.population.regenMonths) * Math.max(0.1, 1 + nationMods(sim, nid).manpowerRegen);
}

export function popCap(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  return TERRAIN[sim.world.prov[pid].terrain].popCap * (1 + 0.15 * p.dev);
}

export function regimentUpkeep(sim: Sim, nid: NationId, type: 'foot' | 'horse' | 'guns', men: number): number {
  return UNITS[type].upkeep * (0.5 + 0.5 * (men / C.regimentSize)) * Math.max(0.2, 1 + nationMods(sim, nid).upkeep);
}

export function researchFundingCost(gross: number, level: 0 | 1 | 2 | 3): number {
  return gross * C.economy.fundingCost[level];
}

/** Crowns another nation gains from a trade agreement with `partner`. */
export function tradeValue(sim: Sim, nid: NationId, partner: NationId): number {
  // province output changes only between weeks or with a revision bump
  const partnerIncome = memoize(sim, 'partnerIncome', partner, () => {
    let v = 0;
    for (const pid of ownedBy(sim, partner)) v += provinceCrowns(sim, pid);
    return v;
  });
  return (C.economy.tradeBase + C.economy.tradeShare * partnerIncome) * Math.max(0, 1 + nationMods(sim, nid).trade);
}

/** Computes (without applying) the monthly budget for a nation. */
export function computeLedger(sim: Sim, nid: NationId): MonthlyLedger {
  const n = sim.state.nations[nid];
  const mods = nationMods(sim, nid);
  const income: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const suppliesIn: Record<string, number> = {};
  const suppliesOut: Record<string, number> = {};

  let tax = 0;
  let sup = 0;
  for (const pid of ownedProvinces(sim, nid)) {
    tax += provinceCrowns(sim, pid);
    sup += provinceSupplies(sim, pid);
  }
  let incomeMul = 1 + mods.income;
  if (!n.isPlayer && sim.state.settings.aiIncomeBonus) incomeMul += sim.state.settings.aiIncomeBonus;
  income['Provincial taxes'] = tax * incomeMul;

  let contributions = 0;
  for (const pid of controlledProvinces(sim, nid)) {
    const p = sim.state.provinces[pid];
    if (p.owner && p.owner !== nid) contributions += provinceBaseCrowns(sim, pid) * C.economy.occupierShare;
  }
  if (contributions) income['War contributions'] = contributions;

  let trade = 0;
  for (const partner of treatyPartners(sim, 'trade', nid)) trade += tradeValue(sim, nid, partner);
  if (trade) income['Trade agreements'] = trade;

  const gross = Object.values(income).reduce((a, b) => a + b, 0);

  let upkeep = 0;
  let supUse = 0;
  let foraging = 0;
  for (const a of armiesOf(sim, nid)) {
    let use = 0;
    for (const r of a.regiments) {
      upkeep += regimentUpkeep(sim, nid, r.type, r.men);
      use += UNITS[r.type].supplyUse * (0.5 + 0.5 * (r.men / C.regimentSize));
    }
    const info = armySupplyInfo(sim, a, true);
    if (info.connected) supUse += use;
    else foraging += use;
  }
  expenses['Army upkeep'] = upkeep;

  let forts = 0;
  for (const pid of ownedProvinces(sim, nid)) forts += sim.state.provinces[pid].fort;
  if (forts) expenses['Fort upkeep'] = forts * C.construction.fortUpkeep * Math.max(0, 1 + mods.fortUpkeep);

  const envoys = sim.state.envoys.filter((e) => e.from === nid).length;
  if (envoys) expenses['Envoys'] = envoys * C.diplomacy.envoyCost;

  const funding = researchFundingCost(gross, n.research.funding);
  if (funding) expenses['Research funding'] = funding;

  if (n.treasury < 0) expenses['Debt interest'] = -n.treasury * C.economy.interestRate;

  suppliesIn['Provinces'] = sup * Math.max(0, 1 + mods.supplyProd);
  suppliesOut['Armies'] = supUse;
  if (foraging) suppliesOut['(Foraging, not drawn)'] = 0;

  const totalIn = gross;
  const totalOut = Object.values(expenses).reduce((a, b) => a + b, 0);
  const sIn = Object.values(suppliesIn).reduce((a, b) => a + b, 0);
  const sOut = Object.values(suppliesOut).reduce((a, b) => a + b, 0);
  const pool = poolCap(sim, nid);
  return {
    tick: sim.state.tick,
    income,
    expenses,
    suppliesIn,
    suppliesOut,
    manpowerIn: Math.min(manpowerRegen(sim, nid), Math.max(0, pool - n.manpower)),
    researchGain: 0,
    net: totalIn - totalOut,
    netSupplies: sIn - sOut,
  };
}

export function grossIncome(l: MonthlyLedger): number {
  return Object.values(l.income).reduce((a, b) => a + b, 0);
}

export type DebtStage = 0 | 1 | 2 | 3;

export function debtStage(sim: Sim, nid: NationId): DebtStage {
  const n = sim.state.nations[nid];
  if (n.treasury >= 0) return 0;
  const gross = Math.max(5, grossIncome(n.lastMonth));
  if (-n.treasury > gross * C.economy.creditMonths) return 3;
  if (n.debtMonths >= C.economy.severeDebtMonths || -n.treasury > gross) return 2;
  return 1;
}

/** Monthly settlement for all living nations. */
export function monthlyEconomy(sim: Sim): void {
  const st = sim.state;
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive) continue;
    const ledger = computeLedger(sim, nid);
    const prevStage = debtStage(sim, nid);
    n.treasury += ledger.net;
    const cap = stockpileCap(sim, nid);
    n.supplies += ledger.netSupplies;
    if (n.supplies < 0) {
      n.supplies = 0;
      notify(sim, nid, 'urgent', 'supplies', 'Supply stockpile exhausted: armies on supply lines are short of supplies until production recovers.');
    }
    n.supplies = Math.min(n.supplies, cap);
    // the pool never exceeds the reserve minus the men serving: a shrinking reserve
    // (occupation, lost integration, casualties) shrinks it too
    n.manpower = clamp(n.manpower + ledger.manpowerIn, 0, poolCap(sim, nid));
    n.lastMonth = ledger;

    if (n.treasury < 0) n.debtMonths++;
    else n.debtMonths = 0;
    const stage = debtStage(sim, nid);
    if (stage === 3) bankrupt(sim, nid);
    else if (stage > prevStage) {
      if (stage === 1) notify(sim, nid, 'urgent', 'debt', 'The treasury is in debt. Interest accrues at 2% a month; new projects and recruitment need positive funds.');
      if (stage === 2) notify(sim, nid, 'urgent', 'debt', 'Severe debt: morale recovery is halved and unrest rises. Bankruptcy follows if debt exceeds three months of income.');
    } else if (stage >= 1 && ledger.net < 0) {
      const gross = Math.max(5, grossIncome(ledger));
      const monthsLeft = (gross * C.economy.creditMonths + n.treasury) / -ledger.net;
      if (monthsLeft <= 3) notify(sim, nid, 'urgent', 'debt', `Bankruptcy in about ${Math.max(1, Math.floor(monthsLeft))} month(s) at the current deficit. Disband regiments, cancel envoys or lower research funding.`);
    }
  }
  populationGrowth(sim);
}

export function bankrupt(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  n.treasury = 0;
  n.debtMonths = 0;
  n.bankruptUntil = st.tick + months(C.economy.bankruptcyMonths);
  n.stats.bankruptcies++;
  n.trust = Math.max(0, n.trust - 10);
  n.research.progress = Math.floor(n.research.progress / 2);
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (p.project && p.project.nation === nid) p.project = null;
    p.recruits = p.recruits.filter((r) => r.nation !== nid);
    if (p.owner === nid) p.unrest = Math.min(100, p.unrest + 15);
  }
  // Unpaid soldiers desert: one regiment in five, largest armies first.
  const armies = armiesOf(sim, nid).sort((a, b) => b.regiments.length - a.regiments.length || (a.id < b.id ? -1 : 1));
  let total = 0;
  for (const a of armies) total += a.regiments.length;
  let desert = Math.floor(total / 5);
  for (const a of armies) {
    a.morale *= 0.5;
    while (desert > 0 && a.regiments.length > 1) {
      const r = a.regiments.pop()!;
      n.stats.menLost += r.men;
      desert--;
    }
  }
  notify(sim, nid, 'urgent', 'bankrupt', 'BANKRUPTCY! Debts are repudiated: construction halted, regiments deserted, morale halved and income reduced by 25% for two years.');
}

export function populationGrowth(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    const cap = popCap(sim, pid);
    let rate = C.population.growth;
    if (p.owner) rate *= Math.max(0, 1 + nationMods(sim, p.owner).popGrowth);
    p.pop += p.pop * rate * (1 - p.pop / cap);
    if (p.owner && p.controller !== p.owner) p.pop -= p.pop * C.population.occupationLoss;
    p.pop = Math.max(1, p.pop);
  }
}

/** Removes killed soldiers from the population of a nation's provinces (proportional to population). */
export function removePopulation(sim: Sim, nid: NationId, men: number): void {
  const owned = ownedProvinces(sim, nid);
  let total = 0;
  for (const pid of owned) total += sim.state.provinces[pid].pop;
  if (total <= 0) return;
  const thousands = men / 1000;
  for (const pid of owned) {
    const p = sim.state.provinces[pid];
    p.pop = Math.max(1, p.pop - (thousands * p.pop) / total);
  }
}

/** Month-by-month projection of the treasury under the current ledger (for UI sustainability). */
export function monthsOfFunds(sim: Sim, nid: NationId): number {
  const n = sim.state.nations[nid];
  const net = n.lastMonth.net;
  if (net >= 0) return Infinity;
  const gross = Math.max(5, grossIncome(n.lastMonth));
  return (n.treasury + gross * C.economy.creditMonths) / -net;
}
