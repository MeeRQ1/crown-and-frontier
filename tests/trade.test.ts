// Trade contracts (save format 5): terms, reserved stock, delivery by land and
// sea, blockades, war, defaults, cancellation, forecasts, the AI, accounting
// invariants and the exploits they must close.

import { describe, expect, it } from 'vitest';
import { C, RESOURCE_INFO, STRATEGIC } from '../src/sim/config';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { signTreaty } from '../src/sim/diplomacy';
import { computeLedger, monthlyEconomy, resourceCap, resourcePlan, stockpileCap } from '../src/sim/economy';
import { createGame } from '../src/sim/game';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { readSave, serialize } from '../src/sim/save';
import { bump, type Sim } from '../src/sim/state';
import { runTicks, step } from '../src/sim/tick';
import { contractPlan, forecast, listPrice, nextSettlement, signContract, stockOf, TRADEABLE } from '../src/sim/trade';
import type { ContractTerms, Tradeable } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { lineGame, seaGame } from './helpers';

/** Advance to the next settlement and run it (tests edit the state directly). */
function settle(sim: Sim): void {
  const st = sim.state;
  st.tick = nextSettlement(st.tick);
  bump(sim);
  nextMemoEpoch();
  monthlyEconomy(sim);
  st.tick++;
  nextMemoEpoch();
}

const coal = (seller: string, buyer: string, qty = 5, months = 6, price = 1.5): ContractTerms => ({ seller, buyer, res: 'coal', qty, price, months });

describe('contract terms', () => {
  it('needs a trade agreement, a valid quantity, price and term, and no war', () => {
    const sim = lineGame();
    const offer = (t: ContractTerms) => checkCommand(sim, { type: 'offerContract', nation: 'b', terms: t });
    expect(offer(coal('a', 'b'))).toMatch(/trade agreement/);
    signTreaty(sim, 'trade', 'a', 'b');
    expect(offer(coal('a', 'b'))).toBeNull();
    expect(offer(coal('a', 'b', 0))).toMatch(/units a month/);
    expect(offer(coal('a', 'b', C.trade.maxQty + 1))).toMatch(/units a month/);
    expect(offer(coal('a', 'b', 5, 7))).toMatch(/Terms run/);
    expect(offer(coal('a', 'b', 5, 6, 0.5))).toMatch(/price must be between/);
    expect(offer(coal('a', 'b', 5, 6, 9))).toMatch(/price must be between/);
    expect(offer({ ...coal('a', 'b'), seller: 'c', buyer: 'a' })).toMatch(/seller or the buyer/);
    expect(offer({ ...coal('b', 'b') })).toMatch(/itself/);
    sim.state.nations.b.treasury = -1;
    expect(offer(coal('a', 'b'))).toMatch(/in debt/);
  });

  it('one contract per seller, buyer and good at a time', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'a', 'b');
    signContract(sim, coal('a', 'b'));
    expect(checkCommand(sim, { type: 'offerContract', nation: 'b', terms: coal('a', 'b', 3) })).toMatch(/already running/);
    expect(checkCommand(sim, { type: 'offerContract', nation: 'b', terms: { ...coal('a', 'b'), res: 'iron', price: 2 } })).toBeNull();
  });
});

describe('the monthly settlement', () => {
  it('ships the contracted quantity before the seller’s own use, delivered and paid the same month overland', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    const b = sim.state.nations.b;
    signTreaty(sim, 'trade', 'a', 'b');
    a.stock.coal = 3; // too little for its own factories AND the contract
    b.stock.coal = 0;
    const c = signContract(sim, coal('a', 'b', 5, 6, 1.6));
    expect(c.lag).toBe(0);
    bump(sim);
    nextMemoEpoch();
    const plan = contractPlan(sim);
    const produced = resourcePlan(sim, 'a').produced.coal;
    const can = Math.min(5, 3 + produced);
    expect(plan.lines[0].ship).toBeCloseTo(can, 9);
    const la = computeLedger(sim, 'a');
    const lb = computeLedger(sim, 'b');
    expect(la.resources.coal.exported).toBeCloseTo(can, 9);
    expect(lb.resources.coal.imported).toBeCloseTo(can, 9);
    // zero-sum: what b pays a receives, at the contract price
    expect(la.income['Contract sales']).toBeCloseTo(can * 1.6, 9);
    expect(lb.expenses['Contract purchases']).toBeCloseTo(can * 1.6, 9);
    // the seller's own factories get only what remains
    expect(la.resources.coal.used).toBeCloseTo(Math.min(resourcePlan(sim, 'a').need.coal, 3 + produced - can), 9);
  });

  it('a short shipment counts against the seller; two in a row end the contract in its default', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    signTreaty(sim, 'trade', 'a', 'b');
    signContract(sim, { ...coal('a', 'b'), res: 'rubber', qty: 10, price: 3 }); // a has no rubber deposit
    a.stock.rubber = 0;
    const trust = a.trust;
    settle(sim);
    expect(sim.state.contracts[0].sellerMisses).toBe(1);
    settle(sim);
    expect(sim.state.contracts).toHaveLength(0);
    expect(a.trust).toBe(Math.max(0, trust - C.trade.defaultTrust));
  });

  it('a buyer in debt is not shipped to; two months end the contract in the buyer’s default', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'a', 'b');
    sim.state.nations.a.stock.coal = resourceCap(sim, 'a');
    signContract(sim, coal('a', 'b'));
    sim.state.nations.b.treasury = -50;
    bump(sim);
    nextMemoEpoch();
    expect(contractPlan(sim).lines[0].withheld).toBe(true);
    expect(computeLedger(sim, 'b').resources.coal.imported).toBe(0);
    settle(sim);
    sim.state.nations.b.treasury = Math.min(sim.state.nations.b.treasury, -50);
    settle(sim);
    expect(sim.state.contracts).toHaveLength(0);
  });

  it('runs its term and ends with goodwill', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'a', 'b');
    sim.state.nations.a.stock.coal = resourceCap(sim, 'a');
    signContract(sim, coal('a', 'b', 2, 6));
    for (let i = 0; i < 6; i++) settle(sim);
    expect(sim.state.contracts).toHaveLength(0);
    expect(sim.state.memories.b?.a?.some((m) => m.kind === 'keptContract')).toBe(true);
  });
});

describe('delivery by sea', () => {
  it('goods are under way for a month, then delivered and paid; a blockade holds back its share', () => {
    const sim = seaGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.b.stock.iron = resourceCap(sim, 'b');
    st.nations.c.stock.iron = 0;
    const c = signContract(sim, { seller: 'b', buyer: 'c', res: 'iron', qty: 4, price: 2, months: 6 });
    expect(c.lag).toBe(1);
    const cBefore = st.nations.c.treasury;
    settle(sim);
    expect(st.shipments).toHaveLength(1);
    expect(st.shipments[0].qty).toBeCloseTo(4, 9);
    expect(st.nations.c.stock.iron).toBe(0); // not yet arrived
    expect(st.nations.c.lastMonth.expenses['Contract purchases'] ?? 0).toBe(0); // not yet paid
    settle(sim);
    // the first shipment arrived (and the second is under way)
    expect(st.nations.c.lastMonth.resources.iron.imported).toBeCloseTo(4, 9);
    expect(st.nations.c.lastMonth.expenses['Contract purchases']).toBeCloseTo(8, 9);
    expect(st.shipments).toHaveLength(1);
    void cBefore;
  });

  it('war returns goods under way to the seller, unpaid, and ends the contract at once', () => {
    const sim = seaGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.b.stock.iron = resourceCap(sim, 'b');
    signContract(sim, { seller: 'b', buyer: 'c', res: 'iron', qty: 4, price: 2, months: 6 });
    settle(sim);
    expect(st.shipments).toHaveLength(1);
    declareWar(sim, 'c', 'b', { type: 'conquest', provinces: ['b2'] });
    expect(st.contracts).toHaveLength(0);
    const bIron = st.nations.b.stock.iron;
    const cTreasury = st.nations.c.treasury;
    settle(sim);
    expect(st.shipments).toHaveLength(0);
    const lb = st.nations.b.lastMonth;
    expect(lb.resources.iron.imported).toBeCloseTo(4, 9); // returned
    expect(lb.income['Contract sales'] ?? 0).toBe(0);
    expect(st.nations.c.lastMonth.expenses['Contract purchases'] ?? 0).toBe(0);
    void bIron;
    void cTreasury;
  });
});

describe('ending early', () => {
  it('the canceller pays a month of the contract’s value and loses trust; goods under way still arrive', () => {
    const sim = seaGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.b.stock.iron = resourceCap(sim, 'b');
    const k = signContract(sim, { seller: 'b', buyer: 'c', res: 'iron', qty: 4, price: 2, months: 12 });
    settle(sim);
    const tc = st.nations.c.treasury;
    const tb = st.nations.b.treasury;
    const trust = st.nations.c.trust;
    const r = applyCommand(sim, { type: 'cancelContract', nation: 'c', contract: k.id });
    expect(r.ok).toBe(true);
    expect(st.nations.c.treasury).toBeCloseTo(tc - 8, 9);
    expect(st.nations.b.treasury).toBeCloseTo(tb + 8, 9);
    expect(st.nations.c.trust).toBe(Math.max(0, trust - C.trade.cancelTrust));
    expect(st.contracts).toHaveLength(0);
    settle(sim);
    expect(st.nations.c.lastMonth.resources.iron.imported).toBeCloseTo(4, 9);
  });

  it('ending the trade agreement ends its contracts at the canceller’s cost', () => {
    const sim = lineGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'a', 'b');
    signContract(sim, coal('a', 'b', 4, 12, 1.5));
    const ta = st.nations.a.treasury;
    expect(applyCommand(sim, { type: 'cancelTreaty', nation: 'a', target: 'b', treaty: 'trade' }).ok).toBe(true);
    expect(st.contracts).toHaveLength(0);
    expect(st.nations.a.treasury).toBeCloseTo(ta - 6, 9);
  });
});

describe('forecasts', () => {
  it('a one-month forecast matches the settlement it describes', () => {
    const sim = lineGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'a', 'b');
    st.nations.a.stock.coal = 20;
    st.nations.b.stock.coal = 2;
    signContract(sim, coal('a', 'b', 6, 6));
    bump(sim);
    nextMemoEpoch();
    const fa = forecast(sim, 'a', 'coal', 1)[0];
    const fb = forecast(sim, 'b', 'coal', 1)[0];
    settle(sim);
    expect(st.nations.a.stock.coal).toBeCloseTo(fa.stock, 6);
    expect(st.nations.b.stock.coal).toBeCloseTo(fb.stock, 6);
  });

  it('a proposed contract shows the shortage it would cause the seller', () => {
    const sim = lineGame();
    signTreaty(sim, 'trade', 'a', 'b');
    sim.state.nations.a.stock.coal = 0;
    bump(sim);
    nextMemoEpoch();
    const without = forecast(sim, 'a', 'coal', 6).reduce((s, m) => s + m.short, 0);
    const withIt = forecast(sim, 'a', 'coal', 6, coal('a', 'b', 20)).reduce((s, m) => s + m.short, 0);
    expect(withIt).toBeGreaterThan(without);
  });
});

/** Totals of every good held or under way, and every crown, to check conservation. */
function holdings(sim: Sim, res: Tradeable): number {
  let v = 0;
  for (const nid of sim.world.nationIds) if (sim.state.nations[nid].alive) v += stockOf(sim, nid, res);
  for (const s of sim.state.shipments) if (s.res === res) v += s.qty;
  return v;
}

describe('accounting invariants', () => {
  it('in an AI campaign, contract crowns are zero-sum every month and the state stays consistent', () => {
    const sim = createGame({ scenario: 'reach', seed: 3, playerNation: null });
    let checked = 0;
    let contracts = 0;
    for (let w = 0; w < 4 * 12 * 4; w++) {
      const settling = (sim.state.tick + 1) % 4 === 0;
      const alive = sim.world.nationIds.filter((n) => sim.state.nations[n].alive);
      step(sim);
      if (!settling) continue;
      contracts += sim.state.contracts.length;
      let sales = 0;
      let purchases = 0;
      for (const nid of alive) {
        const l = sim.state.nations[nid].lastMonth;
        sales += l.income['Contract sales'] ?? 0;
        purchases += l.expenses['Contract purchases'] ?? 0;
      }
      expect(sales).toBeCloseTo(purchases, 6);
      expect(checkInvariants(sim)).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(40);
    // the AI trades through contracts
    expect(contracts).toBeGreaterThan(0);
  });

  it('the settlement conserves every good exactly (stock + under way)', () => {
    const sim = seaGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'b', 'c');
    signTreaty(sim, 'trade', 'a', 'b');
    st.nations.b.stock.iron = resourceCap(sim, 'b');
    st.nations.a.stock.coal = resourceCap(sim, 'a');
    signContract(sim, { seller: 'b', buyer: 'c', res: 'iron', qty: 4, price: 2, months: 6 });
    signContract(sim, { seller: 'a', buyer: 'b', res: 'coal', qty: 3, price: 1.5, months: 6 });
    signContract(sim, { seller: 'b', buyer: 'a', res: 'food', qty: 5, price: 1, months: 6 });
    for (let m = 0; m < 5; m++) {
      const before = new Map(TRADEABLE.map((r) => [r, holdings(sim, r)]));
      settle(sim);
      for (const res of STRATEGIC) {
        let delta = 0;
        for (const nid of sim.world.nationIds) {
          const f = st.nations[nid].lastMonth.resources[res];
          delta += f.produced - f.used - (f.wasted ?? 0);
        }
        expect(holdings(sim, res)).toBeCloseTo(before.get(res)! + delta, 6);
      }
      let food = 0;
      for (const nid of sim.world.nationIds) {
        const l = st.nations[nid].lastMonth;
        food += (l.suppliesIn['Provinces'] ?? 0) - (l.suppliesOut['Armies'] ?? 0) - (l.foodWasted ?? 0);
      }
      expect(holdings(sim, 'food')).toBeCloseTo(before.get('food')! + food, 6);
    }
  });
});

describe('exploits', () => {
  it('declaring war on a seller does not keep the goods under way', () => {
    const sim = seaGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.b.stock.iron = resourceCap(sim, 'b');
    signContract(sim, { seller: 'b', buyer: 'c', res: 'iron', qty: 4, price: 2, months: 6 });
    settle(sim);
    const ironC = st.nations.c.stock.iron;
    declareWar(sim, 'c', 'b', { type: 'conquest', provinces: ['b2'] });
    settle(sim);
    expect(st.nations.c.stock.iron).toBeLessThanOrEqual(ironC + resourcePlan(sim, 'c').produced.iron + 1e-6);
  });

  it('signing and cancelling at once costs the canceller and moves nothing', () => {
    const sim = lineGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'a', 'b');
    const k = signContract(sim, coal('a', 'b', 10, 12, 2.4));
    const ta = st.nations.a.treasury;
    const tb = st.nations.b.treasury;
    applyCommand(sim, { type: 'cancelContract', nation: 'b', contract: k.id });
    expect(st.nations.b.treasury).toBeLessThan(tb);
    expect(st.nations.a.treasury + st.nations.b.treasury).toBeCloseTo(ta + tb, 9);
  });

  it('a stockpile cap cannot be dodged: deliveries above it are lost, not stored', () => {
    const sim = lineGame();
    const st = sim.state;
    signTreaty(sim, 'trade', 'a', 'b');
    st.nations.a.stock.coal = resourceCap(sim, 'a');
    st.nations.b.stock.coal = resourceCap(sim, 'b');
    signContract(sim, coal('a', 'b', 20, 6));
    settle(sim);
    expect(st.nations.b.stock.coal).toBeLessThanOrEqual(resourceCap(sim, 'b') + 1e-9);
    expect(st.nations.b.lastMonth.resources.coal.wasted ?? 0).toBeGreaterThan(0);
    void stockpileCap;
  });
});

describe('save format 5', () => {
  it('a format-4 save keeps its automatic exchanges as 12-month contracts and says so', () => {
    const sim = createGame({ scenario: 'reach', seed: 9, playerNation: 'ser' });
    runTicks(sim, 4 * 6);
    const st = sim.state;
    // make one exchange certain: Aurel and Serrata trade, Serrata has no coal
    signTreaty(sim, 'trade', 'aur', 'ser');
    st.nations.aur.stock.coal = resourceCap(sim, 'aur');
    st.nations.ser.stock.coal = 0;
    const text = serialize(sim);
    const obj = JSON.parse(text);
    obj.schema = 4;
    delete obj.checksum;
    delete obj.state.contracts;
    delete obj.state.shipments;
    obj.state.schema = 4;
    delete obj.state.counters.contract;
    const loaded = readSave(JSON.stringify(obj));
    expect(loaded.sim.state.schema ?? 5).toBe(5);
    // Serrata's coal need is met by its partners' surplus, agreement by agreement
    const coalIn = loaded.sim.state.contracts.filter((c) => c.buyer === 'ser' && c.res === 'coal');
    expect(coalIn.length).toBeGreaterThan(0);
    expect(coalIn.every((c) => c.months === 12 && (c.price === listPrice('coal') || c.price === Math.round(listPrice('coal') * (1 - C.bloc.buyDiscount) * 100) / 100))).toBe(true);
    expect(loaded.notices.join(' ')).toMatch(/trade contracts/);
    expect(loaded.notices.join(' ')).toMatch(/of them ours \(buying/);
    expect(checkInvariants(loaded.sim)).toEqual([]);
    void RESOURCE_INFO;
  });
});
