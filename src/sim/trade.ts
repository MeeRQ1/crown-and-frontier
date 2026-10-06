// Trade contracts (save format 5). Every good that changes hands between realms
// moves under a signed contract with terms: a seller, a buyer, a resource (one
// of the five strategic resources or food), a quantity a month, a price per
// unit and a term. A trade agreement is the framework both partners need first.
//
// Each monthly settlement, in contract order:
//   1. The seller ships the contracted quantity BEFORE its own use: contracted
//      goods are reserved stock. It ships at most its stock plus this month's
//      production; anything less is a short shipment.
//   2. An enemy blockade holds back the blockaded share of a sea shipment (it
//      stays with the seller; the seller is not at fault). Realms that share a
//      land border or strait trade overland and cannot be blockaded.
//   3. A buyer in debt cannot pay: the seller withholds the shipment.
//   4. Overland goods are delivered in the same settlement; by sea they arrive
//      `C.trade.seaLag` months later. The buyer pays on delivery, at the
//      contract price; the crowns go to the seller (zero-sum).
//   5. Goods under way when the two realms go to war, or when the buyer falls,
//      return to the seller on arrival, unpaid.
// A contract ends when its term is over (goodwill on both sides), at war, when
// the trade agreement ends, or by default: two settlements in a row short
// (seller) or unable to pay (buyer) — the defaulter loses trust and opinion.
// Either side may cancel early by paying the other one month of the contract's
// value. Goods already under way are still delivered and paid for.

import { C, RESOURCE_INFO, STRATEGIC } from './config';
import { addMemory, opinion } from './diplomacy';
import { foodBalance, resourceCap, resourcePlan, stockpileCap, surplusMatches } from './economy';
import { memoize } from './index';
import { sameBloc } from './influence';
import { tradeOpen } from './naval';
import { PERSONALITIES } from './data/personalities';
import { atWar, borders, dateOf, hasTreaty, nationName, notify, type Sim } from './state';
import type { CommandResult, ContractTerms, NationId, Shipment, TradeContract, Tradeable } from './types';

export const TRADEABLE: Tradeable[] = ['food', ...STRATEGIC];
const WEEKS = 4;

export function resLabel(res: Tradeable): string {
  return RESOURCE_INFO[res].label;
}

export function listPrice(res: Tradeable): number {
  return RESOURCE_INFO[res].price;
}

/** The tick of the next monthly settlement (the economy settles at the end of each month). */
export function nextSettlement(tick: number): number {
  return tick + (WEEKS - 1 - (tick % WEEKS));
}

/** Months from shipment to delivery between two realms: overland 0, by sea `seaLag`. */
export function contractLag(sim: Sim, seller: NationId, buyer: NationId): number {
  return borders(sim, seller, buyer) ? 0 : C.trade.seaLag;
}

export function stockOf(sim: Sim, nid: NationId, res: Tradeable): number {
  const n = sim.state.nations[nid];
  return res === 'food' ? n.supplies : n.stock[res];
}

export function capOf(sim: Sim, nid: NationId, res: Tradeable): number {
  return res === 'food' ? stockpileCap(sim, nid) : resourceCap(sim, nid);
}

/** This month's production and own use of a resource (before trade). */
export function monthlyBalance(sim: Sim, nid: NationId, res: Tradeable): { produced: number; need: number } {
  if (res === 'food') {
    const f = foodBalance(sim, nid);
    return { produced: f.produced, need: f.eaten };
  }
  const p = resourcePlan(sim, nid);
  return { produced: p.produced[res], need: p.need[res] };
}

export function contractsOf(sim: Sim, nid: NationId): TradeContract[] {
  return sim.state.contracts.filter((c) => c.seller === nid || c.buyer === nid);
}

export function contractsBetween(sim: Sim, a: NationId, b: NationId): TradeContract[] {
  return sim.state.contracts.filter((c) => (c.seller === a && c.buyer === b) || (c.seller === b && c.buyer === a));
}

/** A contract's value for one month (quantity × price). */
export function monthlyValue(c: ContractTerms): number {
  return c.qty * c.price;
}

/** Normalise proposed terms: whole units, prices to the hundredth. */
export function cleanTerms(t: ContractTerms): ContractTerms {
  return { ...t, qty: Math.round(t.qty), price: Math.round(t.price * 100) / 100, months: Math.round(t.months) };
}

// ───────────────────────────── Validation ───────────────────────────────────

/** Why `proposer` cannot propose these terms (null: it can). */
export function contractProblem(sim: Sim, proposer: NationId, t: ContractTerms): string | null {
  const st = sim.state;
  if (!t || typeof t !== 'object') return 'Invalid contract.';
  if (t.seller !== proposer && t.buyer !== proposer) return 'We must be the seller or the buyer.';
  if (t.seller === t.buyer) return 'A realm cannot trade with itself.';
  const other = t.seller === proposer ? t.buyer : t.seller;
  if (!st.nations[t.seller]?.alive || !st.nations[t.buyer]?.alive) return 'That realm no longer exists.';
  if (!TRADEABLE.includes(t.res)) return 'Unknown good.';
  if (!Number.isInteger(t.qty) || t.qty < C.trade.minQty || t.qty > C.trade.maxQty) return `A contract carries ${C.trade.minQty} to ${C.trade.maxQty} units a month.`;
  if (!C.trade.terms.includes(t.months)) return `Terms run ${C.trade.terms.join(', ')} months.`;
  const lp = listPrice(t.res);
  if (!Number.isFinite(t.price) || t.price < lp * C.trade.priceMin - 1e-9 || t.price > lp * C.trade.priceMax + 1e-9) {
    return `The price must be between ${(lp * C.trade.priceMin).toFixed(2)} and ${(lp * C.trade.priceMax).toFixed(2)} crowns (${resLabel(t.res).toLowerCase()} lists at ${lp}).`;
  }
  if (atWar(sim, t.seller, t.buyer)) return 'We are at war with them.';
  if (!hasTreaty(sim, 'trade', t.seller, t.buyer)) return `A trade agreement with ${nationName(sim, other)} comes first: contracts are signed under one.`;
  const running = st.contracts.find((c) => c.seller === t.seller && c.buyer === t.buyer && c.res === t.res);
  if (running) return `A ${resLabel(t.res).toLowerCase()} contract between us is already running (until ${dateOf(sim, running.until).label}).`;
  if (st.proposals.some((p) => p.kind === 'contract' && p.contract && p.contract.res === t.res && ((p.from === proposer && p.to === other) || (p.from === other && p.to === proposer)))) {
    return 'An offer for this good between us is still awaiting an answer.';
  }
  for (const nid of [t.seller, t.buyer]) {
    if (contractsOf(sim, nid).length >= C.trade.maxContracts) return `${nid === proposer ? 'We hold' : `${nationName(sim, nid)} holds`} the most contracts a realm's merchants can manage (${C.trade.maxContracts}).`;
  }
  const buyer = st.nations[t.buyer];
  if (buyer.bankruptUntil > st.tick) return `${t.buyer === proposer ? 'We are' : `${nationName(sim, t.buyer)} is`} bankrupt and cannot sign purchase contracts.`;
  if (buyer.treasury < 0) return `${t.buyer === proposer ? 'We are' : `${nationName(sim, t.buyer)} is`} in debt and cannot sign purchase contracts.`;
  return null;
}

// ───────────────────────────── Forecasts ────────────────────────────────────

export interface ForecastMonth {
  /** settlement tick */
  tick: number;
  /** stock after the settlement */
  stock: number;
  /** own use not covered that month */
  short: number;
  /** goods lost above the stockpile cap */
  wasted: number;
  out: number;
  in: number;
}

/** What a forecast assumes, stated with every forecast shown to the player. */
export const FORECAST_ASSUMPTIONS =
  'Assumes this month’s production and use continue unchanged, every contract (and the one proposed) ships in full for its term and goods under way arrive on time; it does not foresee new wars, blockades, buildings, regiments or research.';

/**
 * A realm's month-by-month stock of one good, from the same settlement rules:
 * this month's production and own use, its contracts (reserved first), goods
 * under way, and optionally an extra contract (signed now).
 */
export function forecast(sim: Sim, nid: NationId, res: Tradeable, months: number, extra: ContractTerms | null = null): ForecastMonth[] {
  const st = sim.state;
  const { produced, need } = monthlyBalance(sim, nid, res);
  const cap = capOf(sim, nid, res);
  const first = nextSettlement(st.tick);
  const lagOf = (seller: NationId, buyer: NationId) => contractLag(sim, seller, buyer);
  const cs: Array<{ seller: NationId; buyer: NationId; qty: number; until: number; lag: number }> = st.contracts
    .filter((c) => c.res === res && (c.seller === nid || c.buyer === nid))
    .map((c) => ({ seller: c.seller, buyer: c.buyer, qty: c.qty, until: c.until, lag: c.lag }));
  if (extra && extra.res === res && (extra.seller === nid || extra.buyer === nid)) {
    cs.push({ seller: extra.seller, buyer: extra.buyer, qty: extra.qty, until: first + extra.months * WEEKS, lag: lagOf(extra.seller, extra.buyer) });
  }
  const arriving = new Map<number, number>();
  for (const s of st.shipments) if (s.buyer === nid && s.res === res) arriving.set(Math.max(first, s.arrives), (arriving.get(Math.max(first, s.arrives)) ?? 0) + s.qty);
  let stock = stockOf(sim, nid, res);
  const out: ForecastMonth[] = [];
  for (let m = 0; m < months; m++) {
    const t = first + m * WEEKS;
    let inn = arriving.get(t) ?? 0;
    let owe = 0;
    for (const c of cs) {
      if (t >= c.until) continue;
      if (c.seller === nid) owe += c.qty;
      else if (c.lag === 0) inn += c.qty;
      else arriving.set(t + c.lag * WEEKS, (arriving.get(t + c.lag * WEEKS) ?? 0) + c.qty);
    }
    const shipped = Math.min(owe, stock + produced);
    const avail = stock + produced - shipped + inn;
    const used = Math.min(need, avail);
    const after = avail - used;
    const kept = Math.min(cap, after);
    out.push({ tick: t, stock: kept, short: Math.max(0, need - used), wasted: Math.max(0, after - cap), out: shipped, in: inn });
    stock = kept;
  }
  return out;
}

/** The share of a realm's supply of a good (production plus contracted deliveries) that each partner provides. */
export function dependence(sim: Sim, nid: NationId): Array<{ res: Tradeable; partner: NationId; qty: number; share: number }> {
  const out: Array<{ res: Tradeable; partner: NationId; qty: number; share: number }> = [];
  for (const res of TRADEABLE) {
    const buys = sim.state.contracts.filter((c) => c.buyer === nid && c.res === res);
    if (!buys.length) continue;
    const total = monthlyBalance(sim, nid, res).produced + buys.reduce((a, c) => a + c.qty, 0);
    for (const c of buys) out.push({ res, partner: c.seller, qty: c.qty, share: total > 0 ? c.qty / total : 1 });
  }
  return out.sort((a, b) => b.share - a.share);
}

/** How much `nid` depends on `partner` for its largest single good (0..1). */
export function dependenceOn(sim: Sim, nid: NationId, partner: NationId): { res: Tradeable; share: number } | null {
  const d = dependence(sim, nid).find((x) => x.partner === partner);
  return d ? { res: d.res, share: d.share } : null;
}

// ───────────────────────────── Judging an offer ─────────────────────────────

export interface ContractEvaluation {
  accept: boolean;
  score: number;
  reasons: Array<{ label: string; value: number }>;
}

/** How `judge` (the seller or the buyer) weighs a contract, with its reasons. */
export function evaluateContract(sim: Sim, judge: NationId, t: ContractTerms): ContractEvaluation {
  const st = sim.state;
  const reasons: Array<{ label: string; value: number }> = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.5) reasons.push({ label, value: Math.round(v) });
  };
  const other = judge === t.seller ? t.buyer : t.seller;
  const name = resLabel(t.res).toLowerCase();
  const lp = listPrice(t.res);
  const cap = capOf(sim, judge, t.res);
  const keep = cap * C.resources.keepShare;
  const months = Math.min(t.months, C.trade.lookahead + 6);
  const without = forecast(sim, judge, t.res, months);
  const withIt = forecast(sim, judge, t.res, months, t);
  const shortBefore = without.reduce((a, m) => a + m.short, 0);
  const shortAfter = withIt.reduce((a, m) => a + m.short, 0);
  const minAfter = Math.min(...withIt.map((m) => m.stock));
  const wasteAfter = withIt.reduce((a, m) => a + m.wasted, 0);
  const wasteBefore = without.reduce((a, m) => a + m.wasted, 0);
  if (judge === t.seller) {
    if (shortAfter > shortBefore + 0.5) {
      const firstShort = withIt.findIndex((m) => m.short > 0);
      add(`We would run short of ${name} ourselves (in ${firstShort + 1} month${firstShort ? 's' : ''})`, -40 - (shortAfter - shortBefore));
    } else if (minAfter < keep) add(`Our ${name} stock would fall below the reserve we keep (${Math.round(keep)})`, -15 * (1 - minAfter / Math.max(1, keep)));
    if (wasteBefore > 0.5) add(`Our ${name} stock is full: unsold surplus is lost`, Math.min(15, 5 + (wasteBefore - wasteAfter) / months));
    add(`Price ${t.price.toFixed(2)} against the list price of ${lp}`, (t.price / lp - 1) * 40);
  } else {
    if (shortBefore > 0.5) {
      const firstShort = without.findIndex((m) => m.short > 0);
      add(`We are running short of ${name} (in ${firstShort + 1} month${firstShort ? 's' : ''})`, 25 + Math.min(20, (shortBefore - shortAfter) * 2));
    } else if (Math.min(...without.map((m) => m.stock)) < keep) add(`Our ${name} stock is below the reserve we keep`, 12);
    else add(`We have no need of more ${name}`, -12);
    if (wasteAfter > wasteBefore + 0.5) add(`Much of it would be lost above our stockpile cap`, -Math.min(30, ((wasteAfter - wasteBefore) / Math.max(1, t.qty * months)) * 40));
    add(`Price ${t.price.toFixed(2)} against the list price of ${lp}`, -(t.price / lp - 1) * 40);
    const n = st.nations[judge];
    const net = n.lastMonth.net;
    if (net - monthlyValue(t) < 0 && n.treasury < monthlyValue(t) * t.months) add(`It would put our treasury into deficit (${monthlyValue(t).toFixed(1)} crowns a month)`, -20);
  }
  // relations
  const op = opinion(sim, judge, other);
  add(`Opinion of ${nationName(sim, other)} (${Math.round(op)})`, op * 0.15);
  if (sameBloc(sim, judge, other)) add('A partner in our trade bloc', 6);
  const dep = dependenceOn(sim, judge, other);
  if (judge === t.buyer && dep && dep.share >= C.trade.dependence && dep.res !== t.res) add(`We already rely on them for ${resLabel(dep.res).toLowerCase()}`, 3);
  const pers = PERSONALITIES[st.nations[judge].ai.personality];
  if (pers.id === 'commercial') add('Commercial outlook', 6);
  const score = reasons.reduce((a, r) => a + r.value, 0);
  return { accept: score >= 0, score, reasons };
}

// ───────────────────────────── Signing and ending ───────────────────────────

export function signContract(sim: Sim, t: ContractTerms, quiet = false): TradeContract {
  const st = sim.state;
  st.counters.contract++;
  const first = nextSettlement(st.tick);
  const c: TradeContract = {
    ...cleanTerms(t),
    id: `k${st.counters.contract}`,
    start: st.tick,
    until: first + t.months * WEEKS,
    lag: contractLag(sim, t.seller, t.buyer),
    shipped: 0,
    sellerMisses: 0,
    buyerMisses: 0,
  };
  st.contracts.push(c);
  st.nations[c.seller].stats.contractsSigned++;
  st.nations[c.buyer].stats.contractsSigned++;
  if (quiet) return c;
  const terms = describeTerms(sim, c);
  notify(sim, c.seller, 'normal', 'contract', `Contract signed: we sell ${nationName(sim, c.buyer)} ${terms}.`);
  notify(sim, c.buyer, 'normal', 'contract', `Contract signed: ${nationName(sim, c.seller)} sells us ${terms}.`);
  return c;
}

export function describeTerms(sim: Sim, t: ContractTerms): string {
  const lag = contractLag(sim, t.seller, t.buyer);
  return `${t.qty} ${resLabel(t.res).toLowerCase()} a month at ${t.price.toFixed(2)} crowns for ${t.months} months (${lag ? `by sea, delivered ${lag} month${lag === 1 ? '' : 's'} after shipping` : 'overland, delivered the same month'})`;
}

/** The fee for ending a contract early, paid by the canceller to the other side. */
export function cancelFee(c: ContractTerms): number {
  return Math.round(monthlyValue(c) * C.trade.cancelFeeMonths * 100) / 100;
}

export function cancelContractProblem(sim: Sim, nid: NationId, id: string): string | null {
  const c = sim.state.contracts.find((x) => x.id === id);
  if (!c) return 'That contract has already ended.';
  if (c.seller !== nid && c.buyer !== nid) return 'That is not our contract.';
  return null;
}

/** Ends a contract early at `nid`'s request: the fee, trust and opinion. */
export function cancelContract(sim: Sim, nid: NationId, id: string): CommandResult {
  const st = sim.state;
  const c = st.contracts.find((x) => x.id === id)!;
  const other = c.seller === nid ? c.buyer : c.seller;
  const fee = cancelFee(c);
  st.nations[nid].treasury -= fee;
  st.nations[other].treasury += fee;
  st.nations[nid].trust = Math.max(0, st.nations[nid].trust - C.trade.cancelTrust);
  st.nations[nid].stats.contractsCancelled++;
  addMemory(sim, other, nid, 'brokeContract', C.trade.cancelOpinion, 0.5);
  st.contracts = st.contracts.filter((x) => x.id !== id);
  notify(sim, other, 'normal', 'contract', `${nationName(sim, nid)} ended our ${resLabel(c.res).toLowerCase()} contract early and paid us ${fee.toFixed(1)} crowns in compensation.`);
  return { ok: true, message: `Contract ended: we paid ${fee.toFixed(1)} crowns in compensation.` };
}

/** War between two realms ends their contracts (no fee); goods under way go back to the seller on arrival. */
export function endContractsByWar(sim: Sim, a: NationId, b: NationId): void {
  const st = sim.state;
  const ending = contractsBetween(sim, a, b);
  if (!ending.length) return;
  for (const c of ending) {
    const label = resLabel(c.res).toLowerCase();
    notify(sim, c.buyer, 'normal', 'contract', `Our ${label} contract with ${nationName(sim, c.seller)} ended with the war.`);
    notify(sim, c.seller, 'normal', 'contract', `Our ${label} contract with ${nationName(sim, c.buyer)} ended with the war.`);
  }
  const ids = new Set(ending.map((c) => c.id));
  st.contracts = st.contracts.filter((c) => !ids.has(c.id));
}

/** Ends every contract between two realms (their trade agreement ended): the realm that ended it pays the fees. */
export function endContractsBetween(sim: Sim, by: NationId, other: NationId): number {
  let fees = 0;
  for (const c of contractsBetween(sim, by, other)) {
    fees += cancelFee(c);
    cancelContract(sim, by, c.id);
  }
  return fees;
}

/** Offers a contract: an AI partner answers at once, a player gets a proposal. */
export function offerContract(sim: Sim, from: NationId, terms: ContractTerms): CommandResult {
  const st = sim.state;
  const t = cleanTerms(terms);
  const to = t.seller === from ? t.buyer : t.seller;
  if (st.nations[to].isPlayer) {
    st.counters.proposal++;
    st.proposals.push({ id: `pr${st.counters.proposal}`, kind: 'contract', from, to, tick: st.tick, expires: st.tick + C.diplomacy.proposalWeeks, contract: t });
    notify(sim, to, 'normal', 'proposal', `${nationName(sim, from)} offers a contract: ${t.seller === from ? 'they sell us' : 'they buy from us'} ${describeTerms(sim, t)}.`);
    return { ok: true, message: 'Offer sent.' };
  }
  const ev = evaluateContract(sim, to, t);
  if (!ev.accept) {
    const top = [...ev.reasons].sort((x, y) => x.value - y.value).slice(0, 3).map((r) => `${r.label} (${r.value > 0 ? '+' : ''}${r.value})`);
    return { ok: false, reason: `${nationName(sim, to)} declines (score ${Math.round(ev.score)}): ${top.join('; ')}.` };
  }
  signContract(sim, t);
  return { ok: true, message: `${nationName(sim, to)} signs the contract.` };
}

// ───────────────────────────── The monthly settlement ───────────────────────

export interface ContractLine {
  c: TradeContract;
  /** shipped this settlement */
  ship: number;
  /** held back by a blockade (stays with the seller) */
  blocked: number;
  /** the seller could not supply this much */
  short: number;
  /** withheld because the buyer is in debt */
  withheld: boolean;
  /** the two are at war: nothing moves and the contract ends */
  war: boolean;
}

export interface Delivery {
  contract: string;
  seller: NationId;
  buyer: NationId;
  res: Tradeable;
  qty: number;
  price: number;
  /** returned to the seller unpaid (war, or the buyer has fallen) */
  returned: boolean;
}

export interface ContractPlan {
  tick: number;
  lines: ContractLine[];
  deliveries: Delivery[];
  /** per realm and good: shipped out, received (deliveries and returns) */
  out: Map<NationId, Map<Tradeable, number>>;
  in: Map<NationId, Map<Tradeable, number>>;
  sales: Map<NationId, number>;
  purchases: Map<NationId, number>;
}

function bump(m: Map<NationId, Map<Tradeable, number>>, nid: NationId, res: Tradeable, v: number): void {
  let r = m.get(nid);
  if (!r) m.set(nid, (r = new Map()));
  r.set(res, (r.get(res) ?? 0) + v);
}

export function planAmount(m: Map<NationId, Map<Tradeable, number>>, nid: NationId, res: Tradeable): number {
  return m.get(nid)?.get(res) ?? 0;
}

/**
 * The next settlement's shipments and deliveries, computed without changing
 * anything (the ledgers preview it; the settlement applies it). The same for
 * whichever realm asks.
 */
export function contractPlan(sim: Sim): ContractPlan {
  return memoize(sim, 'contractPlan', '', () => {
    const st = sim.state;
    const tick = nextSettlement(st.tick);
    const plan: ContractPlan = { tick, lines: [], deliveries: [], out: new Map(), in: new Map(), sales: new Map(), purchases: new Map() };
    // what each seller can ship of each good: its stock and this month's production
    const room = new Map<string, number>();
    const capacity = (nid: NationId, res: Tradeable) => {
      const k = `${nid}|${res}`;
      let v = room.get(k);
      if (v === undefined) room.set(k, (v = Math.max(0, stockOf(sim, nid, res) + monthlyBalance(sim, nid, res).produced)));
      return v;
    };
    const ordered = [...st.contracts].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : 1));
    for (const c of ordered) {
      if (!st.nations[c.seller]?.alive || !st.nations[c.buyer]?.alive) continue;
      if (tick >= c.until) continue;
      const line: ContractLine = { c, ship: 0, blocked: 0, short: 0, withheld: false, war: false };
      plan.lines.push(line);
      if (atWar(sim, c.seller, c.buyer)) {
        line.war = true;
        continue;
      }
      if (st.nations[c.buyer].treasury < 0) {
        line.withheld = true;
        continue;
      }
      const k = `${c.seller}|${c.res}`;
      const can = Math.min(c.qty, capacity(c.seller, c.res));
      room.set(k, capacity(c.seller, c.res) - can);
      line.short = c.qty - can;
      const open = c.lag > 0 ? tradeOpen(sim, c.seller, c.buyer) : 1;
      line.ship = can * open;
      line.blocked = can - line.ship;
      if (line.ship > 1e-9) {
        bump(plan.out, c.seller, c.res, line.ship);
        if (c.lag === 0) plan.deliveries.push({ contract: c.id, seller: c.seller, buyer: c.buyer, res: c.res, qty: line.ship, price: c.price, returned: false });
      }
    }
    for (const s of st.shipments) {
      if (s.arrives > tick) continue;
      const returned = !st.nations[s.buyer]?.alive || atWar(sim, s.seller, s.buyer);
      plan.deliveries.push({ contract: s.contract, seller: s.seller, buyer: s.buyer, res: s.res, qty: s.qty, price: s.price, returned });
    }
    for (const d of plan.deliveries) {
      if (d.returned) {
        if (st.nations[d.seller]?.alive) bump(plan.in, d.seller, d.res, d.qty);
        continue;
      }
      bump(plan.in, d.buyer, d.res, d.qty);
      const value = d.qty * d.price;
      plan.sales.set(d.seller, (plan.sales.get(d.seller) ?? 0) + value);
      plan.purchases.set(d.buyer, (plan.purchases.get(d.buyer) ?? 0) + value);
    }
    return plan;
  });
}

/**
 * After the ledgers are applied: goods put under way, delivered shipments
 * removed, contract bookkeeping, defaults, completed terms and the notices.
 */
export function settleContracts(sim: Sim, plan: ContractPlan): void {
  const st = sim.state;
  const tick = plan.tick;
  // deliveries done: drop the shipments that arrived
  st.shipments = st.shipments.filter((s) => s.arrives > tick);
  for (const d of plan.deliveries) {
    if (d.returned && st.nations[d.seller]?.alive) notify(sim, d.seller, 'low', 'contract', `${d.qty.toFixed(1)} ${resLabel(d.res).toLowerCase()} on its way to ${nationName(sim, d.buyer)} came back unpaid.`);
  }
  const ended = new Set<string>();
  for (const line of plan.lines) {
    const c = line.c;
    const label = resLabel(c.res).toLowerCase();
    if (line.war) {
      ended.add(c.id);
      notify(sim, c.buyer, 'normal', 'contract', `Our ${label} contract with ${nationName(sim, c.seller)} ended with the war.`);
      notify(sim, c.seller, 'normal', 'contract', `Our ${label} contract with ${nationName(sim, c.buyer)} ended with the war.`);
      continue;
    }
    if (!hasTreaty(sim, 'trade', c.seller, c.buyer)) {
      ended.add(c.id);
      continue;
    }
    if (line.ship > 1e-9 && c.lag > 0) {
      st.counters.contract++;
      const s: Shipment = { id: `s${st.counters.contract}`, contract: c.id, seller: c.seller, buyer: c.buyer, res: c.res, qty: line.ship, price: c.price, sent: tick, arrives: tick + c.lag * WEEKS };
      st.shipments.push(s);
    }
    c.shipped += line.ship;
    st.nations[c.seller].stats.contractUnits += line.ship;
    c.buyerMisses = line.withheld ? c.buyerMisses + 1 : 0;
    c.sellerMisses = line.short > 0.05 ? c.sellerMisses + 1 : 0;
    if (line.withheld) {
      notify(sim, c.buyer, 'urgent', 'contract', `${nationName(sim, c.seller)} withheld this month's ${label}: we are in debt and cannot pay.${c.buyerMisses >= C.trade.missLimit ? '' : ' A second month ends the contract in our default.'}`);
    }
    if (line.short > 0.05) {
      notify(sim, c.buyer, 'normal', 'contract', `${nationName(sim, c.seller)} shipped ${(c.qty - line.short).toFixed(1)} of ${c.qty} ${label} this month.`);
      notify(sim, c.seller, 'urgent', 'contract', `We could ship only ${(c.qty - line.short).toFixed(1)} of the ${c.qty} ${label} owed to ${nationName(sim, c.buyer)}.${c.sellerMisses >= C.trade.missLimit ? '' : ' A second short month ends the contract in our default.'}`);
    }
    if (line.blocked > 0.05) notify(sim, c.buyer, 'normal', 'contract', `A blockade held back ${line.blocked.toFixed(1)} of ${nationName(sim, c.seller)}'s ${label} this month.`);
    if (c.sellerMisses >= C.trade.missLimit) {
      defaulted(sim, c, c.seller, c.buyer, 'could not deliver');
      ended.add(c.id);
    } else if (c.buyerMisses >= C.trade.missLimit) {
      defaulted(sim, c, c.buyer, c.seller, 'could not pay');
      ended.add(c.id);
    } else if (tick + WEEKS >= c.until) {
      ended.add(c.id);
      st.nations[c.seller].stats.contractsKept++;
      st.nations[c.buyer].stats.contractsKept++;
      addMemory(sim, c.buyer, c.seller, 'keptContract', C.trade.keptOpinion, 0.5);
      addMemory(sim, c.seller, c.buyer, 'keptContract', C.trade.keptOpinion, 0.5);
      notify(sim, c.buyer, 'normal', 'contract', `Our ${label} contract with ${nationName(sim, c.seller)} has run its term (${Math.round(c.shipped)} delivered or under way).`);
      notify(sim, c.seller, 'low', 'contract', `Our ${label} contract with ${nationName(sim, c.buyer)} has run its term.`);
    }
  }
  // contracts with fallen realms end too
  for (const c of st.contracts) if (!st.nations[c.seller]?.alive || !st.nations[c.buyer]?.alive) ended.add(c.id);
  if (ended.size) st.contracts = st.contracts.filter((c) => !ended.has(c.id));
}

function defaulted(sim: Sim, c: TradeContract, by: NationId, other: NationId, what: string): void {
  const st = sim.state;
  st.nations[by].trust = Math.max(0, st.nations[by].trust - C.trade.defaultTrust);
  st.nations[by].stats.contractsDefaulted++;
  addMemory(sim, other, by, 'brokeContract', C.trade.defaultOpinion, 0.5);
  const label = resLabel(c.res).toLowerCase();
  notify(sim, by, 'urgent', 'contract', `Our ${label} contract with ${nationName(sim, other)} ended in our default: we ${what} two months running (trust −${C.trade.defaultTrust}).`);
  notify(sim, other, 'normal', 'contract', `${nationName(sim, by)} ${what} two months running: our ${label} contract with them has ended.`);
}

/** Every realm's position in one good, for AI matching: forecast surplus or need a month. */
export function surplusOf(sim: Sim, nid: NationId, res: Tradeable, months = C.trade.lookahead): { surplus: number; need: number; minStock: number; short: number } {
  return memoize(sim, 'tradeSurplus', `${nid}|${res}|${months}`, () => {
    const f = forecast(sim, nid, res, months);
    const keep = capOf(sim, nid, res) * C.resources.keepShare;
    const minStock = Math.min(...f.map((m) => m.stock));
    const short = f.reduce((a, m) => a + m.short, 0);
    // a surplus is what stays above the reserve every month; a need is a shortfall or a stock below it
    const surplus = Math.max(0, (minStock - keep) / months);
    const need = short > 0.5 ? short / months + (keep - Math.min(keep, minStock)) / months : Math.max(0, (keep - minStock) / months);
    return { surplus, need, minStock, short };
  });
}

/**
 * Save formats 1–4 moved goods automatically between trade partners. A loaded
 * campaign keeps those exchanges going as 12-month contracts at list price (bloc
 * price inside a bloc), so nothing stops the month it is converted. Returns the
 * contracts made.
 */
export function convertLegacyTrade(sim: Sim): TradeContract[] {
  const made: TradeContract[] = [];
  for (const line of surplusMatches(sim)) {
    const qty = Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(line.amount)));
    const price = Math.round(listPrice(line.res) * (sameBloc(sim, line.from, line.to) ? 1 - C.bloc.buyDiscount : 1) * 100) / 100;
    const t: ContractTerms = { seller: line.from, buyer: line.to, res: line.res, qty, price, months: 12 };
    if (contractProblem(sim, line.from, t)) continue;
    made.push(signContract(sim, t, true));
  }
  return made;
}
