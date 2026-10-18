// The cabinet (format 9): ministers hired for a fee and a monthly salary who do routine
// work within limits the player sets. The trade minister keeps the realm supplied
// through the ordinary trade system — the same contract rules, forecasts, prices and
// acceptance as an offer by hand — and nothing else:
//
//  - each month it buys the goods it is allowed to buy that the forecast says will
//    fall short of their stockpile targets, from permitted trade partners with a
//    surplus, at no more than the price limit, while all its purchase contracts
//    together stay within the monthly budget and the treasury can carry them;
//  - if allowed, it sells what lies well above a target to a partner who needs it, at
//    no less than the minimum price;
//  - it ends one of its own purchases that only overfills the stockpile when the fee
//    costs less than the goods wasted;
//  - it never turns round on a good it bought or sold within six months, never touches
//    contracts signed by hand, and declares no war, signs no treaty and spends on
//    nothing else; sea routes through blockaded ports are not used;
//  - what it could not do (no seller, over budget, prices too high, blockade) goes to
//    its report, and to a notification at most once a quarter per good.
// Competence (1–3) sets how many contracts it manages (2, 4, 6), how well it bargains,
// and its salary. Pause, dismissal and the limits are the player's; dismissing it
// leaves its contracts running to term under direct management. The AI trades by its
// own monthly routine under the same contract rules and does not hire ministers.

import { C } from './config';
import { grossIncome } from './economy';
import { cancelContract, cancelContractProblem, contractLag, contractProblem, contractsOf, cancelFee, listPrice, monthlyValue, nextSettlement, offerContract, resLabel, surplusOf, TRADEABLE, capOf } from './trade';
import { generatedName } from './government';
import { portsOf, provinceBlockaded } from './naval';
import { atWar, dateOf, months, nationName, notify, treatyPartners, type Sim } from './state';
import type { ContractTerms, NationId, Tradeable, TradeMinister, TradeMinisterSettings } from './types';

export const SALARY = [2, 4, 7];
export const MANAGED = [2, 4, 6];
const LOG_MAX = 30;
const QUIET = 'Every permitted good is forecast at or above its target: nothing to buy.';

export function defaultTradeSettings(sim: Sim, nid: NationId): TradeMinisterSettings {
  return { resources: [...TRADEABLE], partners: [], targets: {}, budget: Math.max(10, Math.round(grossIncome(sim.state.nations[nid].lastMonth) * 0.1)), maxPrice: 1.15, sell: false, minPrice: 0.95 };
}

/** Candidates on offer this year: one of each competence, generated names. */
export function tradeCandidates(sim: Sim, nid: NationId): Array<{ name: string; competence: number; salary: number }> {
  const n = sim.state.nations[nid];
  const year = dateOf(sim).year;
  const cur = n.cabinet?.candidates;
  if (cur && dateOf(sim, cur.tick).year === year) return cur.trade;
  const trade = [1, 2, 3].map((c) => ({ name: generatedName(`${nid}|trade|${year}|${c}`), competence: c, salary: SALARY[c - 1] }));
  n.cabinet = { ...(n.cabinet ?? {}), candidates: { trade, tick: sim.state.tick } };
  return trade;
}

export function hireFee(salary: number): number {
  return salary * 3;
}

export function cabinetSalaries(sim: Sim, nid: NationId): number {
  const t = sim.state.nations[nid]?.cabinet?.trade;
  return t ? t.salary : 0;
}

export function cabinetProblem(sim: Sim, nid: NationId, action: string, candidate?: number, settings?: Partial<TradeMinisterSettings>): string | null {
  const n = sim.state.nations[nid];
  const t = n.cabinet?.trade;
  if (action === 'hire') {
    if (t) return `${t.name} already holds the trade portfolio: dismiss them first.`;
    const c = tradeCandidates(sim, nid)[candidate ?? -1];
    if (!c) return 'Choose a candidate.';
    if (n.treasury < hireFee(c.salary)) return `Needs ${hireFee(c.salary)} crowns to hire (treasury ${Math.floor(n.treasury)}).`;
    return null;
  }
  if (!t) return 'No trade minister.';
  if (action === 'settings') return settingsProblem(sim, settings ?? {});
  if (!['dismiss', 'pause', 'resume'].includes(action)) return 'Unknown action.';
  return null;
}

function settingsProblem(sim: Sim, s: Partial<TradeMinisterSettings>): string | null {
  if (s.resources && s.resources.some((r) => !TRADEABLE.includes(r))) return 'Unknown good.';
  if (s.partners && s.partners.some((p) => !sim.state.nations[p])) return 'Unknown realm.';
  if (s.budget !== undefined && !(s.budget >= 0 && s.budget <= 100000)) return 'The budget must be between 0 and 100,000 crowns a month.';
  if (s.maxPrice !== undefined && !(s.maxPrice >= C.trade.priceMin && s.maxPrice <= C.trade.priceMax)) return `The price limit must be between ${C.trade.priceMin}× and ${C.trade.priceMax}× the list price.`;
  if (s.minPrice !== undefined && !(s.minPrice >= C.trade.priceMin && s.minPrice <= C.trade.priceMax)) return `The minimum price must be between ${C.trade.priceMin}× and ${C.trade.priceMax}× the list price.`;
  if (s.targets && Object.entries(s.targets).some(([r, v]) => !TRADEABLE.includes(r as Tradeable) || !(Number(v) >= 0))) return 'Stockpile targets must be zero or more.';
  return null;
}

export function cabinetAction(sim: Sim, nid: NationId, action: 'hire' | 'dismiss' | 'pause' | 'resume' | 'settings', candidate?: number, settings?: Partial<TradeMinisterSettings>): string {
  const st = sim.state;
  const n = st.nations[nid];
  n.cabinet ??= {};
  if (action === 'hire') {
    const c = tradeCandidates(sim, nid)[candidate!];
    n.treasury -= hireFee(c.salary);
    n.cabinet.trade = { name: c.name, competence: c.competence, salary: c.salary, hired: st.tick, paused: false, settings: defaultTradeSettings(sim, nid), managed: [], log: [], recent: {}, told: {} };
    return `${c.name} takes the trade portfolio (competence ${c.competence}, ${c.salary} crowns a month). They act at the next month's settlement, within the limits you set.`;
  }
  const t = n.cabinet.trade!;
  if (action === 'dismiss') {
    n.cabinet.trade = null;
    return `${t.name} is dismissed. The contracts they signed run to term under your direct management.`;
  }
  if (action === 'pause' || action === 'resume') {
    t.paused = action === 'pause';
    return t.paused ? `${t.name} pauses: no new contracts until you resume.` : `${t.name} resumes work.`;
  }
  t.settings = { ...t.settings, ...settings, targets: { ...t.settings.targets, ...(settings?.targets ?? {}) } };
  return 'Trade limits updated.';
}

function log(sim: Sim, t: TradeMinister, text: string): void {
  t.log.push({ tick: sim.state.tick, text });
  if (t.log.length > LOG_MAX) t.log.splice(0, t.log.length - LOG_MAX);
}

/** The stock a good should not fall below: the player's target, else the reserve the realm keeps by default. */
export function stockTarget(sim: Sim, nid: NationId, t: TradeMinister, res: Tradeable): number {
  return t.settings.targets[res] ?? capOf(sim, nid, res) * C.resources.keepShare;
}

/** Monthly need of a good against its target over the forecast (0: none). */
function needOf(sim: Sim, nid: NationId, t: TradeMinister, res: Tradeable): number {
  const f = surplusOf(sim, nid, res);
  const target = stockTarget(sim, nid, t, res);
  const m = C.trade.lookahead;
  return f.short > 0.5 ? f.short / m + Math.max(0, target - Math.max(0, f.minStock)) / m : Math.max(0, (target - f.minStock) / m);
}

function committed(sim: Sim, t: TradeMinister, nid: NationId): number {
  return sim.state.contracts.filter((c) => t.managed.includes(c.id) && c.buyer === nid).reduce((a, c) => a + monthlyValue(c), 0);
}

function seaBlocked(sim: Sim, nid: NationId, other: NationId): boolean {
  if (!contractLag(sim, other, nid)) return false;
  const ports = portsOf(sim, nid);
  return ports.length > 0 && ports.every((p) => provinceBlockaded(sim, p));
}

/** Tell the player about a goal it cannot meet, at most once a quarter per good. */
function blocked(sim: Sim, nid: NationId, t: TradeMinister, res: Tradeable, why: string): void {
  log(sim, t, `${resLabel(res)}: ${why}.`);
  if (sim.state.tick - (t.told[res] ?? -1e9) < months(3)) return;
  t.told[res] = sim.state.tick;
  notify(sim, nid, 'normal', 'cabinet', `Trade minister ${t.name} cannot cover ${resLabel(res).toLowerCase()}: ${why}.`);
}

/** Monthly (after the settlement): the trade minister's routine work. */
export function monthlyCabinet(sim: Sim): void {
  for (const nid of Object.keys(sim.state.nations).sort()) {
    const n = sim.state.nations[nid];
    const t = n.cabinet?.trade;
    if (!t || !n.alive) continue;
    tradeMinisterMonth(sim, nid, t);
  }
}

export function tradeMinisterMonth(sim: Sim, nid: NationId, t: TradeMinister): void {
  const st = sim.state;
  const n = st.nations[nid];
  // contracts that ended leave its list
  t.managed = t.managed.filter((id) => st.contracts.some((c) => c.id === id));
  if (t.paused) return;
  if (n.bankruptUntil > st.tick || n.treasury < 0) {
    log(sim, t, 'No new purchases while the treasury is in debt.');
    return;
  }
  const allowed = new Set(t.settings.resources);
  const partners = treatyPartners(sim, 'trade', nid).filter((o) => st.nations[o]?.alive && !atWar(sim, nid, o) && !st.nations[o].isPlayer && (!t.settings.partners.length || t.settings.partners.includes(o)));
  const recentlySold = (res: Tradeable) => t.recent[res]?.side === 'sell' && st.tick - t.recent[res]!.tick < months(6);
  const recentlyBought = (res: Tradeable) => t.recent[res]?.side === 'buy' && st.tick - t.recent[res]!.tick < months(6);
  const room = () => MANAGED[t.competence - 1] - t.managed.length;
  // 1. buy what will fall short of its target, the largest need (in crowns) first
  const needs = TRADEABLE.filter((r) => allowed.has(r))
    .map((res) => ({ res, need: needOf(sim, nid, t, res), short: surplusOf(sim, nid, res).short }))
    .filter((x) => x.need >= 0.5)
    .sort((a, b) => Number(b.short > 0) - Number(a.short > 0) || b.need * listPrice(b.res) - a.need * listPrice(a.res) || (a.res < b.res ? -1 : 1));
  let bought = 0;
  for (const want of needs) {
    if (bought >= (t.competence >= 2 ? 2 : 1)) break;
    if (room() <= 0) {
      blocked(sim, nid, t, want.res, `it already manages ${t.managed.length} contracts, its most`);
      break;
    }
    if (recentlySold(want.res)) continue;
    if (contractsOf(sim, nid).some((c) => c.buyer === nid && c.res === want.res && !t.managed.includes(c.id))) continue; // the player's own purchase covers it
    if (!partners.length) {
      blocked(sim, nid, t, want.res, 'no permitted trade partner (a trade agreement comes first)');
      continue;
    }
    const sellers = partners
      .map((o) => ({ o, s: surplusOf(sim, o, want.res).surplus }))
      .filter((x) => x.s >= 1)
      .sort((a, b) => b.s - a.s || (a.o < b.o ? -1 : 1))
      .slice(0, 3);
    if (!sellers.length) {
      blocked(sim, nid, t, want.res, 'no permitted partner has a surplus');
      continue;
    }
    const lp = listPrice(want.res);
    const left = t.settings.budget - committed(sim, t, nid);
    let done = false;
    let why = 'every seller declined at our price limit';
    for (const { o, s } of sellers) {
      if (seaBlocked(sim, nid, o)) {
        why = 'our ports are blockaded and the goods come by sea';
        continue;
      }
      // bargain upward from where its competence starts, to the player's limit
      for (let mul = 1 + (3 - t.competence) * 0.05; mul <= t.settings.maxPrice + 1e-9; mul += 0.05) {
        const price = Math.round(Math.max(lp * C.trade.priceMin, Math.min(lp * C.trade.priceMax, lp * mul)) * 100) / 100;
        let qty = Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(Math.min(want.need * 1.1, s))));
        // within the budget
        qty = Math.min(qty, Math.floor(left / price));
        if (qty < C.trade.minQty) {
          why = `its purchases already cost ${Math.round(committed(sim, t, nid))} of the ${t.settings.budget} crowns a month allowed`;
          break;
        }
        const terms: ContractTerms = { seller: o, buyer: nid, res: want.res, qty, price, months: want.short > 0 ? 12 : 6 };
        // the treasury must carry it: no purchase that turns the month into a deficit the treasury cannot cover
        if (n.lastMonth.net - monthlyValue(terms) < 0 && n.treasury < monthlyValue(terms) * terms.months) {
          why = 'the treasury could not carry the contract';
          break;
        }
        if (contractProblem(sim, nid, terms)) {
          why = contractProblem(sim, nid, terms)!.replace(/\.$/, '').toLowerCase();
          break;
        }
        const r = offerContract(sim, nid, terms);
        if (!r.ok) continue;
        const c = st.contracts.at(-1)!;
        t.managed.push(c.id);
        t.recent[want.res] = { side: 'buy', tick: st.tick };
        log(sim, t, `Bought ${qty} ${resLabel(want.res).toLowerCase()} a month from ${nationName(sim, o)} at ${price.toFixed(2)} (list ${lp}) for ${terms.months} months.`);
        bought++;
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) blocked(sim, nid, t, want.res, why);
  }
  // 2. sell what lies well above its target, if allowed
  if (t.settings.sell && room() > 0) {
    for (const res of TRADEABLE.filter((r) => allowed.has(r))) {
      if (recentlyBought(res)) continue;
      const f = surplusOf(sim, nid, res);
      const target = stockTarget(sim, nid, t, res);
      if (f.surplus < 1 || f.minStock < target * 1.2) continue;
      const lp = listPrice(res);
      const buyers = partners.filter((o) => surplusOf(sim, o, res).need >= 0.5 && !seaBlocked(sim, nid, o)).sort();
      let sold = false;
      for (const o of buyers) {
        const price = Math.round(Math.max(lp * t.settings.minPrice, lp * (1 + 0.05 * (t.competence - 1))) * 100) / 100;
        const qty = Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(Math.min(f.surplus, surplusOf(sim, o, res).need * 1.1))));
        const terms: ContractTerms = { seller: nid, buyer: o, res, qty, price: Math.min(price, lp * C.trade.priceMax), months: 6 };
        if (contractProblem(sim, nid, terms)) continue;
        const r = offerContract(sim, nid, terms);
        if (!r.ok) continue;
        t.managed.push(st.contracts.at(-1)!.id);
        t.recent[res] = { side: 'sell', tick: st.tick };
        log(sim, t, `Sold ${qty} ${resLabel(res).toLowerCase()} a month to ${nationName(sim, o)} at ${terms.price.toFixed(2)} for 6 months.`);
        sold = true;
        break;
      }
      if (sold) break;
    }
  }
  if (!needs.length && (t.log.at(-1)?.text ?? '') !== QUIET) log(sim, t, QUIET);
  // 3. end one of its purchases that only overfills the stockpile
  const tick = nextSettlement(st.tick);
  for (const c of st.contracts) {
    if (c.buyer !== nid || !t.managed.includes(c.id)) continue;
    const leftMonths = Math.max(0, Math.round((c.until - tick) / 4));
    if (leftMonths < 3) continue;
    const wasted = c.res === 'food' ? (n.lastMonth.foodWasted ?? 0) : (n.lastMonth.resources[c.res]?.wasted ?? 0);
    if (wasted < c.qty * 0.5) continue;
    if (cancelFee(c) < Math.min(wasted, c.qty) * c.price * leftMonths * 0.5) {
      // through the ordinary cancellation (fee, trust and opinion as for anyone)
      if (!cancelContractProblem(sim, nid, c.id) && cancelContract(sim, nid, c.id).ok) {
        log(sim, t, `Ended the ${resLabel(c.res).toLowerCase()} purchase from ${nationName(sim, c.seller)}: it only overfilled the stockpile (fee ${cancelFee(c).toFixed(1)}).`);
        break;
      }
    }
  }
}
