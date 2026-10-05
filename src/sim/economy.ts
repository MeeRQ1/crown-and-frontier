// Economy, resources, industry, trade, population and manpower. Settled
// monthly (every 4 ticks).
//
// Crowns:    province tax = (dev*0.8 + pop*0.012 + capital 3) * efficiency
//            efficiency = integrationFactor * (1 - unrest/200), 0 if occupied or in revolt
// Food:      province = (dev*0.5*terrainProd + food deposit 3) * efficiency; armies on
//            supply lines eat it (the `supplies` stockpile, shown as Food).
// Resources: a deposit yields (coal 4, others 3, + dev/4) * efficiency * modifiers a
//            month; stockpiles are capped (40 + 3 per dev).
// Industry:  industrial capacity (IC) = sum(factories * efficiency * (1 - bombing)) *
//            coal factor * (1 + modifiers); factories burn 0.6 coal per level a month and
//            run at 30% + 70% x the share of coal available. Materiel += IC * 4 + workshops (0.15 per
//            integrated dev) up to the cap; output beyond the cap is sold as
//            manufactured goods (0.35 crowns each).
// Trade:     each trade agreement moves resources each month from a partner's
//            surplus (above 40% of its cap after its own use) to the other's need
//            (below 40%), at a fixed price per unit; plus 1 crown of commerce each.
//            Enemy blockades shrink sea trade by the blockaded share of each coast
//            (realms with a land border trade overland); a blockaded province
//            loses a quarter of its crowns. Inside a trade bloc, members buy from
//            members 20% cheaper, earn 50% more commerce from each other, and
//            share blockade losses by the size of their taxes.
// Credit:    loan instalments and reparations (a share of the payer's gross
//            income last month) are paid with the monthly settlement.
// Navy/air:  ships and air wings cost upkeep; ships burn coal (oil after Oil-Fired
//            Boilers; submarines and carriers always oil), aircraft burn oil.
// Reserve:   military-age men = pop*40 per thousand * (0.2+0.8*integration); the manpower
//            pool can never exceed reserve minus men already serving (no double counting).

import { airFuel, airUpkeep, bombingLoss } from './air';
import { C, RESOURCE_INFO, STRATEGIC, TERRAIN, UNITS } from './config';
import { armiesOfNation, memoize, ownedBy } from './index';
import { nationMods, type Mods } from './modifiers';
import { fleetFuel, fleetUpkeep, provinceBlockaded, tradeOpen } from './naval';
import { blocSolidarity, loanInstalment, sameBloc } from './influence';
import { armiesOf, clamp, controlledProvinces, enemiesOf, months, notify, ownedProvinces, treatyPartners, type Sim } from './state';
import { armySupplyInfo } from './supply';
import type { MonthlyLedger, NationId, ProvinceId, ResourceFlow, StrategicResource, UnitType } from './types';

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
  let v = p.dev * C.economy.goldPerDev + p.pop * C.economy.goldPerPop;
  if (p.owner && sim.state.nations[p.owner]?.capital === pid) v += C.economy.capitalBonus;
  return v;
}

export function provinceCrowns(sim: Sim, pid: ProvinceId): number {
  return provinceBaseCrowns(sim, pid) * provinceEfficiency(sim, pid) - provinceBlockadeLoss(sim, pid);
}

/** Crowns an enemy blockade takes from a coastal province this month (before national modifiers). */
export function provinceBlockadeLoss(sim: Sim, pid: ProvinceId): number {
  const v = provinceBaseCrowns(sim, pid) * provinceEfficiency(sim, pid);
  if (v <= 0 || !sim.world.provZones[pid] || !provinceBlockaded(sim, pid)) return 0;
  const owner = sim.state.provinces[pid].owner!;
  return v * C.naval.blockadeIncome * Math.max(0, 1 - nationMods(sim, owner).blockadeResist);
}

/** Crowns blockades take from a realm this month, after its income modifiers. */
export function blockadeLoss(sim: Sim, nid: NationId): number {
  let l = 0;
  for (const pid of ownedBy(sim, nid)) if (sim.world.provZones[pid]) l += provinceBlockadeLoss(sim, pid);
  return l * incomeMultiplier(sim, nid);
}

function incomeMultiplier(sim: Sim, nid: NationId): number {
  let m = 1 + nationMods(sim, nid).income;
  if (!sim.state.nations[nid].isPlayer && sim.state.settings.aiIncomeBonus) m += sim.state.settings.aiIncomeBonus;
  return m;
}

/** Food a province yields its owner each month. */
export function provinceSupplies(sim: Sim, pid: ProvinceId): number {
  const p = sim.state.provinces[pid];
  const def = sim.world.prov[pid];
  let v = p.dev * C.economy.supplyPerDev * TERRAIN[def.terrain].supplyProd;
  if (def.resource === 'food') v += C.economy.foodBonus;
  return v * provinceEfficiency(sim, pid);
}

const OUTPUT_MOD: Record<StrategicResource, keyof Mods> = {
  coal: 'coalOutput',
  iron: 'ironOutput',
  oil: 'oilOutput',
  rubber: 'rubberOutput',
  nitrates: 'nitratesOutput',
};

/** Strategic resource a province's deposit yields its owner each month (null for none or food). */
export function provinceDeposit(sim: Sim, pid: ProvinceId): { res: StrategicResource; amount: number } | null {
  const res = sim.world.prov[pid].resource;
  if (!res || res === 'food') return null;
  const p = sim.state.provinces[pid];
  const base = C.resources.depositYield[res] + C.resources.depositPerDev * p.dev;
  const owner = p.owner;
  const mul = owner ? Math.max(0, 1 + nationMods(sim, owner).resourceOutput + nationMods(sim, owner)[OUTPUT_MOD[res]]) : 1;
  return { res, amount: base * provinceEfficiency(sim, pid) * mul };
}

export function totalDev(sim: Sim, nid: NationId): number {
  let d = 0;
  for (const pid of ownedProvinces(sim, nid)) d += sim.state.provinces[pid].dev;
  return d;
}

/** Food stockpile limit. */
export function stockpileCap(sim: Sim, nid: NationId): number {
  return C.economy.stockpileBase + C.economy.stockpilePerDev * totalDev(sim, nid);
}

/** Limit of each strategic resource stockpile. */
export function resourceCap(sim: Sim, nid: NationId): number {
  return C.resources.stockBase + C.resources.stockPerDev * totalDev(sim, nid);
}

export function emptyFlows(): Record<StrategicResource, ResourceFlow> {
  const out = {} as Record<StrategicResource, ResourceFlow>;
  for (const r of STRATEGIC) out[r] = { produced: 0, used: 0, imported: 0, exported: 0 };
  return out;
}

// ───────────────────────────── Industry ─────────────────────────────────────

export function factoryCount(sim: Sim, nid: NationId): number {
  let f = 0;
  for (const pid of ownedBy(sim, nid)) f += sim.state.provinces[pid].factories;
  return f;
}

/** Factories weighted by the integration and control of their provinces. */
export function effectiveFactories(sim: Sim, nid: NationId): number {
  let f = 0;
  for (const pid of ownedBy(sim, nid)) {
    const p = sim.state.provinces[pid];
    if (p.factories) f += p.factories * provinceEfficiency(sim, pid) * (1 - bombingLoss(sim, pid));
  }
  return f;
}

export function materielCap(sim: Sim, nid: NationId): number {
  return C.industry.materielBase + C.industry.materielPerFactory * factoryCount(sim, nid);
}

/** Integrated development (workshop output without factories). */
function workshopDev(sim: Sim, nid: NationId): number {
  let d = 0;
  for (const pid of ownedBy(sim, nid)) d += sim.state.provinces[pid].dev * provinceEfficiency(sim, pid);
  return d;
}

/**
 * A realm's planned resource production and use for the month, before trade:
 * deposits, synthetic production by factories, coal for factories, fuel for
 * armour and shells for artillery at war.
 */
export interface ResourcePlan {
  produced: Record<StrategicResource, number>;
  need: Record<StrategicResource, number>;
  factories: number;
  /** coal the factories need at full output */
  factoryCoal: number;
}

export function resourcePlan(sim: Sim, nid: NationId): ResourcePlan {
  return memoize(sim, 'resourcePlan', nid, () => {
    const produced = { coal: 0, iron: 0, oil: 0, rubber: 0, nitrates: 0 } as Record<StrategicResource, number>;
    const need = { coal: 0, iron: 0, oil: 0, rubber: 0, nitrates: 0 } as Record<StrategicResource, number>;
    for (const pid of ownedBy(sim, nid)) {
      const d = provinceDeposit(sim, pid);
      if (d) produced[d.res] += d.amount;
    }
    const m = nationMods(sim, nid);
    const factories = effectiveFactories(sim, nid);
    // synthetic production (chemistry): factories turn coal into nitrates, oil and rubber
    const synth: Array<[StrategicResource, number]> = [
      ['nitrates', m.syntheticNitrates],
      ['oil', m.syntheticOil],
      ['rubber', m.syntheticRubber],
    ];
    let synthCoal = 0;
    for (const [r, per] of synth) {
      if (per <= 0) continue;
      produced[r] += per * factories;
      synthCoal += per * factories;
    }
    const factoryCoal = factories * C.industry.coalPerFactory * Math.max(0.2, 1 + m.factoryCoal);
    need.coal += factoryCoal + synthCoal;
    // fleets burn coal (oil after Oil-Fired Boilers); aircraft burn oil
    const fuel = fleetFuel(sim, nid);
    need.coal += fuel.coal;
    need.oil += fuel.oil + airFuel(sim, nid);
    const atWar = enemiesOf(sim, nid).length > 0;
    for (const a of armiesOfNation(sim, nid)) {
      for (const r of a.regiments) {
        const burn = UNITS[r.type].burn;
        const share = 0.5 + 0.5 * (r.men / C.regimentSize);
        if (burn.oil) need.oil += burn.oil * share;
        if (burn.nitrates && atWar) need.nitrates += burn.nitrates * share;
      }
    }
    return { produced, need, factories, factoryCoal };
  });
}

// ───────────────────────────── Trade ────────────────────────────────────────

export interface TradeLine {
  res: StrategicResource | 'food';
  from: NationId;
  to: NationId;
  amount: number;
  price: number;
}

/** Projected stock at the end of the month without trade, and the level a realm keeps. */
function tradeBalance(sim: Sim, nid: NationId): { surplus: Record<string, number>; keep: Record<string, number> } {
  const n = sim.state.nations[nid];
  const plan = resourcePlan(sim, nid);
  const cap = resourceCap(sim, nid);
  const surplus: Record<string, number> = {};
  const keep: Record<string, number> = {};
  for (const r of STRATEGIC) {
    surplus[r] = n.stock[r] + plan.produced[r] - plan.need[r];
    keep[r] = cap * C.resources.keepShare;
  }
  // food: provinces minus what armies eat
  let food = 0;
  for (const pid of ownedBy(sim, nid)) food += provinceSupplies(sim, pid);
  let eat = 0;
  for (const a of armiesOfNation(sim, nid)) for (const r of a.regiments) eat += UNITS[r.type].supplyUse * (0.5 + 0.5 * (r.men / C.regimentSize));
  surplus.food = n.supplies + food - eat;
  keep.food = stockpileCap(sim, nid) * C.resources.keepShare;
  return { surplus, keep };
}

/**
 * This month's resource trade over every trade agreement: from each partner's
 * surplus to the other's need, agreement by agreement in order (the same result
 * whichever realm asks). A realm in debt does not buy.
 */
export function tradeFlows(sim: Sim): TradeLine[] {
  return memoize(sim, 'tradeFlows', '', () => {
    const st = sim.state;
    const bal = new Map<NationId, ReturnType<typeof tradeBalance>>();
    const get = (nid: NationId) => {
      let b = bal.get(nid);
      if (!b) bal.set(nid, (b = tradeBalance(sim, nid)));
      return b;
    };
    const lines: TradeLine[] = [];
    const pacts = st.treaties.filter((t) => t.type === 'trade' && st.nations[t.a]?.alive && st.nations[t.b]?.alive);
    for (const t of pacts) {
      for (const res of ['food', ...STRATEGIC] as Array<StrategicResource | 'food'>) {
        for (const [from, to] of [
          [t.a, t.b],
          [t.b, t.a],
        ]) {
          if (st.nations[to].treasury < 0) continue;
          const A = get(from);
          const B = get(to);
          const offer = A.surplus[res] - A.keep[res];
          const want = B.keep[res] - B.surplus[res];
          // enemy blockades choke sea trade (land neighbours trade overland)
          const amount = Math.min(offer, want) * tradeOpen(sim, from, to);
          if (amount < 0.5) continue;
          const price = RESOURCE_INFO[res].price * Math.max(0.5, 1 + nationMods(sim, from).trade);
          lines.push({ res, from, to, amount, price });
          A.surplus[res] -= amount;
          B.surplus[res] += amount;
        }
      }
    }
    return lines;
  });
}

/**
 * Estimated crowns a month a realm gains from a trade agreement with `partner`
 * (sales, the value of what it can buy, and commerce), for treaty evaluation.
 */
export function tradeValue(sim: Sim, nid: NationId, partner: NationId): number {
  // an estimate for treaty decisions: balances are cached for the phase (read-only here)
  const A = memoize(sim, 'tradeBalance', nid, () => tradeBalance(sim, nid));
  const B = memoize(sim, 'tradeBalance', partner, () => tradeBalance(sim, partner));
  let v = C.economy.tradeCommerce * Math.max(0, 1 + nationMods(sim, nid).trade);
  for (const res of ['food', ...STRATEGIC]) {
    const sell = Math.max(0, Math.min(A.surplus[res] - A.keep[res], B.keep[res] - B.surplus[res]));
    const buy = Math.max(0, Math.min(B.surplus[res] - B.keep[res], A.keep[res] - A.surplus[res]));
    const price = RESOURCE_INFO[res as StrategicResource | 'food'].price;
    // a sale earns its price; a purchase we need is worth about half its price to us
    v += sell * price + buy * price * 0.5;
  }
  return v;
}

// ───────────────────────────── Manpower ─────────────────────────────────────

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

export function regimentUpkeep(sim: Sim, nid: NationId, type: UnitType, men: number): number {
  return UNITS[type].upkeep * (0.5 + 0.5 * (men / C.regimentSize)) * Math.max(0.2, 1 + nationMods(sim, nid).upkeep);
}

export function researchFundingCost(gross: number, level: 0 | 1 | 2 | 3): number {
  return gross * C.economy.fundingCost[level];
}

// ───────────────────────────── Monthly ledger ───────────────────────────────

/**
 * Computes (without applying) the monthly budget for a nation: crowns, food,
 * strategic resources, industry and materiel. `trade` defaults to this month's
 * trade over all agreements.
 */
export function computeLedger(sim: Sim, nid: NationId, trade: TradeLine[] = tradeFlows(sim)): MonthlyLedger {
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
  income['Provincial taxes'] = tax * incomeMultiplier(sim, nid);
  // a trade bloc shares its members' blockade losses
  if (sim.state.blocs.length) {
    const share = memoize(sim, 'blocSolidarity', '', () => blocSolidarity(sim, (m) => blockadeLoss(sim, m))).get(nid);
    if (share) income['Bloc solidarity'] = share;
  }

  let contributions = 0;
  for (const pid of controlledProvinces(sim, nid)) {
    const p = sim.state.provinces[pid];
    if (p.owner && p.owner !== nid) contributions += provinceBaseCrowns(sim, pid) * C.economy.occupierShare;
  }
  if (contributions) income['War contributions'] = contributions;

  // resources and trade
  const plan = resourcePlan(sim, nid);
  const resources = emptyFlows();
  let sales = 0;
  let purchases = 0;
  let foodIn = 0;
  let foodOut = 0;
  for (const line of trade) {
    if (line.from !== nid && line.to !== nid) continue;
    const value = line.amount * line.price;
    if (line.from === nid) {
      sales += value;
      if (line.res === 'food') foodOut += line.amount;
      else resources[line.res].exported += line.amount;
    } else {
      purchases += sameBloc(sim, line.from, nid) ? value * (1 - C.bloc.buyDiscount) : value;
      if (line.res === 'food') foodIn += line.amount;
      else resources[line.res].imported += line.amount;
    }
  }
  let pacts = 0;
  for (const o of treatyPartners(sim, 'trade', nid)) pacts += tradeOpen(sim, nid, o) * (sameBloc(sim, nid, o) ? 1 + C.bloc.commerceBonus : 1);
  if (pacts) income['Commerce'] = pacts * C.economy.tradeCommerce * Math.max(0, 1 + mods.trade);
  if (sales) income['Resource sales'] = sales;
  // credit: loans repaid to us, reparations paid to us
  let repaid = 0;
  let owed = 0;
  for (const l of sim.state.loans) {
    if (l.from === nid) repaid += loanInstalment(sim, l);
    if (l.to === nid) owed += loanInstalment(sim, l);
  }
  if (repaid) income['Loans repaid to us'] = repaid;
  let repIn = 0;
  let repOut = 0;
  for (const r of sim.state.reparations) {
    if (r.until <= sim.state.tick) continue;
    const pay = reparationPayment(sim, r.from, r.share);
    if (r.to === nid) repIn += pay;
    if (r.from === nid) repOut += pay;
  }
  if (repIn) income['Reparations received'] = repIn;

  // what is used: coal first goes to the factories; fuel and shells to the army
  let coalFactor = 1;
  for (const r of STRATEGIC) {
    const f = resources[r];
    f.produced = plan.produced[r];
    const available = Math.max(0, n.stock[r] + f.produced + f.imported - f.exported);
    f.used = Math.min(plan.need[r], available);
    if (r === 'coal' && plan.need.coal > 0) coalFactor = Math.min(1, available / plan.need.coal);
  }
  const ic = plan.factories * (C.industry.unpowered + (1 - C.industry.unpowered) * coalFactor) * Math.max(0, 1 + mods.industry);
  const materielMade = ic * C.industry.materielPerIC + workshopDev(sim, nid) * C.industry.workshopPerDev;
  const room = Math.max(0, materielCap(sim, nid) - n.materiel);
  const sold = Math.max(0, materielMade - room);
  if (sold > 0) income['Manufactured goods'] = sold * C.industry.goodsPerMateriel * Math.max(0, 1 + mods.income);

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
  const navy = fleetUpkeep(sim, nid);
  if (navy) expenses['Fleet upkeep'] = navy;
  const airUp = airUpkeep(sim, nid);
  if (airUp) expenses['Air wing upkeep'] = airUp;

  let forts = 0;
  for (const pid of ownedProvinces(sim, nid)) forts += sim.state.provinces[pid].fort;
  if (forts) expenses['Fort upkeep'] = forts * C.construction.fortUpkeep * Math.max(0, 1 + mods.fortUpkeep);

  const envoys = sim.state.envoys.filter((e) => e.from === nid).length;
  if (envoys) expenses['Envoys'] = envoys * C.diplomacy.envoyCost;

  const funding = researchFundingCost(gross, n.research.funding);
  if (funding) expenses['Research funding'] = funding;

  if (purchases) expenses['Resource purchases'] = purchases;
  if (owed) expenses['Loan repayments'] = owed;
  if (repOut) expenses['Reparations'] = repOut;

  if (n.treasury < 0) expenses['Debt interest'] = -n.treasury * C.economy.interestRate;

  suppliesIn['Provinces'] = sup * Math.max(0, 1 + mods.supplyProd);
  if (foodIn) suppliesIn['Imports'] = foodIn;
  suppliesOut['Armies'] = supUse;
  if (foodOut) suppliesOut['Exports'] = foodOut;
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
    resources,
    industry: ic,
    materielIn: Math.min(materielMade, room),
  };
}

/** A reparation payment: a share of the payer's gross income last month. */
export function reparationPayment(sim: Sim, payer: NationId, share: number): number {
  const n = sim.state.nations[payer];
  if (!n?.alive) return 0;
  return Math.max(0, grossIncome(n.lastMonth) - (n.lastMonth.income['Reparations received'] ?? 0)) * share;
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
  // one set of trade flows and ledgers for everyone, from the state at the start of the settlement
  const trade = tradeFlows(sim);
  const ledgers = new Map<NationId, MonthlyLedger>();
  const plans = new Map<NationId, ResourcePlan>();
  for (const nid of sim.world.nationIds) {
    if (!st.nations[nid].alive) continue;
    ledgers.set(nid, computeLedger(sim, nid, trade));
    plans.set(nid, resourcePlan(sim, nid));
  }
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive) continue;
    const ledger = ledgers.get(nid)!;
    const plan = plans.get(nid)!;
    const prevStage = debtStage(sim, nid);
    n.treasury += ledger.net;
    const cap = stockpileCap(sim, nid);
    n.supplies += ledger.netSupplies;
    if (n.supplies < 0) {
      n.supplies = 0;
      notify(sim, nid, 'urgent', 'supplies', 'Food stockpile exhausted: armies on supply lines go hungry until production recovers.');
    }
    n.supplies = Math.min(n.supplies, cap);
    // strategic resources and industry
    const rcap = resourceCap(sim, nid);
    const short: typeof n.shortages = [];
    for (const r of STRATEGIC) {
      const f = ledger.resources[r];
      n.stock[r] = clamp(n.stock[r] + f.produced + f.imported - f.exported - f.used, 0, rcap);
      // a realm is short when it covers less than 95% of what it needs
      if (f.used < plan.need[r] * 0.95 - 1e-6) short.push(r);
    }
    const newShort = short.filter((r) => !n.shortages.includes(r));
    n.shortages = short;
    if (newShort.length) {
      const what = newShort.map((r) => RESOURCE_INFO[r].label.toLowerCase()).join(', ');
      notify(sim, nid, 'urgent', 'shortage', `Shortage of ${what}. ${newShort.map(shortageEffect).join(' ')} Trade for it, take a deposit or research a substitute.`);
    }
    n.materiel = Math.min(materielCap(sim, nid), n.materiel + ledger.materielIn);
    // the pool never exceeds the reserve minus the men serving: a shrinking reserve
    // (occupation, lost integration, casualties) shrinks it too
    n.manpower = clamp(n.manpower + ledger.manpowerIn, 0, poolCap(sim, nid));
    n.lastMonth = ledger;

    if (n.treasury < 0) n.debtMonths++;
    else n.debtMonths = 0;
    // loans: what was paid this month comes off the debt
    for (const l of st.loans) if (l.to === nid) l.remaining = Math.max(0, l.remaining - loanInstalment(sim, l));
    const stage = debtStage(sim, nid);
    if (stage === 3) bankrupt(sim, nid);
    else if (stage > prevStage) {
      if (stage === 1) notify(sim, nid, 'urgent', 'debt', 'The treasury is in debt. Interest accrues at 2% a month; new projects, recruitment and imports need positive funds.');
      if (stage === 2) notify(sim, nid, 'urgent', 'debt', 'Severe debt: morale recovery is halved and unrest rises. Bankruptcy follows if debt exceeds three months of income.');
    } else if (stage >= 1 && ledger.net < 0) {
      const gross = Math.max(5, grossIncome(ledger));
      const monthsLeft = (gross * C.economy.creditMonths + n.treasury) / -ledger.net;
      if (monthsLeft <= 3) notify(sim, nid, 'urgent', 'debt', `Bankruptcy in about ${Math.max(1, Math.floor(monthsLeft))} month${Math.max(1, Math.floor(monthsLeft)) === 1 ? '' : 's'} at the current deficit. Disband regiments, cancel envoys or lower research funding.`);
    }
  }
  const paid = st.loans.filter((l) => l.remaining <= 0.01);
  if (paid.length) {
    st.loans = st.loans.filter((l) => l.remaining > 0.01);
    for (const l of paid) {
      notify(sim, l.to, 'low', 'loan', `Our loan from ${sim.world.nationDefs[l.from]?.name ?? l.from} is repaid.`);
      notify(sim, l.from, 'low', 'loan', `${sim.world.nationDefs[l.to]?.name ?? l.to} has repaid our loan.`);
    }
  }
  populationGrowth(sim);
}

export function shortageEffect(r: StrategicResource): string {
  switch (r) {
    case 'coal':
      return `Factories without coal run at ${Math.round(C.industry.unpowered * 100)}% of capacity.`;
    case 'iron':
      return 'Artillery, armour, factories, forts and railways need iron to be built.';
    case 'oil':
      return 'Armour fights at half strength.';
    case 'rubber':
      return 'Armour needs rubber to be built.';
    case 'nitrates':
      return 'Artillery is short of shells (−40% fire).';
  }
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

/** Whether a realm lacks a resource right now (last settlement). */
export function isShort(sim: Sim, nid: NationId, r: StrategicResource): boolean {
  return sim.state.nations[nid].shortages.includes(r);
}
