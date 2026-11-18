// Money trouble is told before it bites: an order that leaves upkeep above income is
// flagged when it is given; a treasury that will be empty within three months is
// forecast while it is still in funds; bankruptcy names the armies that lost regiments;
// an army that runs out of supply and starts wasting away is reported, with why, once.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { bankrupt, computeLedger, monthlyEconomy, treasuryOutlook } from '../src/sim/economy';
import { weeklyArmyCare } from '../src/sim/military';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

describe('warnings about the treasury', () => {
  it('an order that leaves upkeep above income is flagged when it is given', () => {
    const sim = lineGame({ playerNation: 'a' });
    const n = sim.state.nations.a;
    n.treasury = 5000;
    n.manpower = 100000;
    n.materiel = 5000;
    const out = treasuryOutlook(sim, 'a');
    expect(out.net).toBeGreaterThan(0);
    // as many regiments as it takes to outspend the income (in training: paid once they are ready)
    const per = 1.2;
    const count = Math.ceil(out.net / per) + 8;
    let warned: string | undefined;
    for (let i = 0; i < count && !warned; i++) {
      const r = applyCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'infantry' });
      if (!r.ok) break;
      warned = r.warning;
    }
    expect(warned).toMatch(/Upkeep will exceed income: the treasury falls by about \d+ crowns a month once everything ordered is ready/);
    expect(treasuryOutlook(sim, 'a').net).toBeLessThan(0);
    expect(treasuryOutlook(sim, 'a').committed).toBeGreaterThan(0);
    // an order that adds no monthly cost says nothing
    const army = addArmy(sim, 'a', 'a2', { infantry: 1 });
    const mv = applyCommand(sim, { type: 'move', nation: 'a', army: army.id, dest: 'a1' });
    expect(mv.ok && mv.warning).toBeFalsy();
  });

  it('a treasury that will be empty within three months is forecast while it is still in funds', () => {
    const sim = lineGame({ playerNation: 'a' });
    const n = sim.state.nations.a;
    // a large standing army: upkeep well above income
    addArmy(sim, 'a', 'a1', { infantry: 40 });
    const deficit = -computeLedger(sim, 'a').net;
    expect(deficit).toBeGreaterThan(0);
    n.treasury = deficit * 3.5;
    monthlyEconomy(sim);
    const note = sim.state.notifications.find((x) => x.nation === 'a' && x.kind === 'debt');
    expect(note?.text).toMatch(/The treasury falls by \d+ crowns a month \(army upkeep \d+.*\): at this rate it is empty in about \d+ months?/);
    // once, not every month
    const count = () => sim.state.notifications.filter((x) => x.nation === 'a' && x.kind === 'debt' && /at this rate/.test(x.text)).length;
    monthlyEconomy(sim);
    expect(count()).toBe(1);
  });

  it('bankruptcy names the armies that lost regiments', () => {
    const sim = lineGame({ playerNation: 'a' });
    const big = addArmy(sim, 'a', 'a1', { infantry: 12 });
    const small = addArmy(sim, 'a', 'a2', { infantry: 3 });
    bankrupt(sim, 'a');
    const note = sim.state.notifications.find((x) => x.kind === 'bankrupt' && x.nation === 'a')!;
    expect(note.text).toMatch(/Unpaid, 3 regiments deserted \(/);
    expect(note.text).toContain(`${big.name} 3`);
    expect(big.regiments.length + small.regiments.length).toBe(12);
  });
});

describe('an army wasting away', () => {
  it('is reported once when it runs out of supply, with why and what to do', () => {
    const sim = lineGame({ playerNation: 'a' });
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    // the stockpile empty and more men than the land feeds
    const army = addArmy(sim, 'a', 'b3', { infantry: 30 });
    sim.state.nations.a.supplies = 0;
    weeklyArmyCare(sim);
    const notes = () => sim.state.notifications.filter((x) => x.nation === 'a' && x.kind === 'attrition');
    expect(notes()).toHaveLength(1);
    expect(notes()[0].text).toMatch(new RegExp(`Out of supply, losing about 2% of their men a week until supplied again: ${army.name} \\(B3\\)\\.`));
    expect(notes()[0].text).toMatch(/The national supply stockpile is empty\. Reduce army size/);
    weeklyArmyCare(sim);
    weeklyArmyCare(sim);
    expect(notes()).toHaveLength(1);
    expect(army.starving).toBeDefined();
  });
});
