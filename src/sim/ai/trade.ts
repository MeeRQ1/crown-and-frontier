// AI trade, through the same `offerContract` and `cancelContract` commands and
// the same forecasts the player sees. Once a month each AI realm:
//   1. buys what its own forecast says it will lack (a shortfall, or stock below
//      the reserve it keeps), from the trade partner with the largest forecast
//      surplus — one new purchase a month, two when a shortfall is forecast;
//   2. offers its surplus to a human partner whose forecast shows a shortfall
//      (one open offer at a time, at most one every four months per realm);
//   3. ends a purchase that only spills over its stockpile cap, paying the fee,
//      when that costs less than the goods it would waste.

import { C } from '../config';
import { evaluateContract, contractProblem, listPrice, monthlyValue, surplusOf, TRADEABLE, nextSettlement, cancelFee } from '../trade';
import { sameBloc } from '../influence';
import { opinion } from '../diplomacy';
import { atWar, diag, months, nationName, treatyPartners, type Sim } from '../state';
import type { ContractTerms, NationId, Tradeable } from '../types';
import { issue } from './common';

function priceFor(sim: Sim, seller: NationId, buyer: NationId, res: Tradeable, premium: number): number {
  const lp = listPrice(res);
  const raw = lp * (sameBloc(sim, seller, buyer) ? 1 - C.bloc.buyDiscount : 1) * premium;
  return Math.round(Math.max(lp * C.trade.priceMin, Math.min(lp * C.trade.priceMax, raw)) * 100) / 100;
}

export function aiTrade(sim: Sim, nid: NationId): void {
  const st = sim.state;
  const n = st.nations[nid];
  if (n.bankruptUntil > st.tick) return;
  const partners = treatyPartners(sim, 'trade', nid).filter((o) => st.nations[o]?.alive && !atWar(sim, nid, o));
  if (!partners.length) return;

  // 1. buy what we will lack
  if (n.treasury >= 0) {
    const needs = TRADEABLE.map((res) => ({ res, ...surplusOf(sim, nid, res) }))
      .filter((x) => x.need >= 0.5)
      .sort((a, b) => Number(b.short > 0) - Number(a.short > 0) || b.need * listPrice(b.res) - a.need * listPrice(a.res) || (a.res < b.res ? -1 : 1));
    let bought = 0;
    for (const want of needs) {
      if (bought >= (want.short > 0 ? 2 : 1)) break;
      const sellers = partners
        .map((o) => ({ o, s: surplusOf(sim, o, want.res).surplus }))
        .filter((x) => x.s >= 1)
        .sort((a, b) => b.s - a.s || opinion(sim, nid, b.o) - opinion(sim, nid, a.o) || (a.o < b.o ? -1 : 1))
        .slice(0, 3);
      for (const { o, s } of sellers) {
        const urgent = want.short > 0;
        const terms: ContractTerms = {
          seller: o,
          buyer: nid,
          res: want.res,
          qty: Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(Math.min(want.need * 1.1, s)))),
          price: priceFor(sim, o, nid, want.res, urgent ? 1.1 : 1),
          months: urgent ? 12 : 6,
        };
        if (contractProblem(sim, nid, terms)) continue;
        if (!evaluateContract(sim, nid, terms).accept) continue;
        if (st.nations[o].isPlayer) {
          if (!mayOfferPlayer(sim, nid, o)) continue;
          markOffer(sim, nid, o);
        }
        const r = issue(sim, { type: 'offerContract', nation: nid, terms }, `Contract: buy ${terms.qty} ${want.res} a month from ${nationName(sim, o)}`);
        if (r.ok) {
          bought++;
          break;
        }
      }
    }
  }

  // 2. offer our surplus to a human partner who is running short
  for (const o of partners) {
    if (!st.nations[o].isPlayer || !mayOfferPlayer(sim, nid, o)) continue;
    for (const res of TRADEABLE) {
      const them = surplusOf(sim, o, res);
      if (them.short <= 0.5) continue;
      const ours = surplusOf(sim, nid, res).surplus;
      if (ours < 1) continue;
      const terms: ContractTerms = {
        seller: nid,
        buyer: o,
        res,
        qty: Math.max(C.trade.minQty, Math.min(C.trade.maxQty, Math.round(Math.min(them.need * 1.1, ours)))),
        price: priceFor(sim, nid, o, res, 1.1),
        months: 12,
      };
      if (contractProblem(sim, nid, terms) || !evaluateContract(sim, nid, terms).accept) continue;
      markOffer(sim, nid, o);
      issue(sim, { type: 'offerContract', nation: nid, terms }, `Offered ${nationName(sim, o)} ${terms.qty} ${res} a month`);
      return;
    }
  }

  // 3. end a purchase that only spills over our stockpile cap
  const tick = nextSettlement(st.tick);
  for (const c of st.contracts) {
    if (c.buyer !== nid) continue;
    const left = Math.max(0, Math.round((c.until - tick) / 4));
    if (left < 3) continue;
    const wasted = c.res === 'food' ? n.lastMonth.foodWasted ?? 0 : n.lastMonth.resources[c.res]?.wasted ?? 0;
    if (wasted < c.qty * 0.5) continue;
    // the fee is one month's value; the waste over the rest of the term costs more
    if (cancelFee(c) < Math.min(wasted, c.qty) * c.price * left * 0.5) {
      const r = issue(sim, { type: 'cancelContract', nation: nid, contract: c.id }, `Ended a ${c.res} contract that overfills our stockpile`);
      if (r.ok) return;
    }
  }
  void monthlyValue;
}

/** Humans are not flooded: one open contract offer at a time, and none from this realm within 4 months. */
function mayOfferPlayer(sim: Sim, nid: NationId, player: NationId): boolean {
  const st = sim.state;
  if (st.proposals.some((p) => p.to === player && p.kind === 'contract')) return false;
  const last = st.nations[nid].ai.lastProposal[`${player}:contract`] ?? -1e9;
  if (st.tick - last < months(4)) return false;
  const inbox = st.nations[player].ai.lastProposal['__incomingContract'] ?? -1e9;
  return st.tick - inbox >= months(2);
}

function markOffer(sim: Sim, nid: NationId, player: NationId): void {
  const st = sim.state;
  st.nations[nid].ai.lastProposal[`${player}:contract`] = st.tick;
  st.nations[player].ai.lastProposal['__incomingContract'] = st.tick;
  diag(sim, nid, 'strategic', `Contract offer to ${nationName(sim, player)}`);
}
