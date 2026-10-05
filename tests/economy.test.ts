import { bump } from '../src/sim/state';
import { describe, expect, it } from 'vitest';
import { UNITS } from '../src/sim/config';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { computeLedger, debtStage, menServing, monthlyEconomy, poolCap, reserveCap } from '../src/sim/economy';
import { armySupplyInfo } from '../src/sim/supply';
import { runTicks } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { setController } from '../src/sim/siege';
import { addArmy, lineGame, totalMen } from './helpers';

describe('economy', () => {
  it('each regiment reduces net income by its upkeep', () => {
    const sim = lineGame();
    const before = computeLedger(sim, 'a').net;
    addArmy(sim, 'a', 'a1', { infantry: 3, cavalry: 1 });
    const after = computeLedger(sim, 'a').net;
    expect(before - after).toBeCloseTo(3 * UNITS.infantry.upkeep + UNITS.cavalry.upkeep, 5);
  });

  it('recruitment is refused with a readable reason when unaffordable', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.treasury = 5;
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'infantry' })).toMatch(/crowns/);
    n.treasury = 500;
    n.manpower = 200;
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'infantry' })).toMatch(/manpower/);
    n.manpower = 5000;
    n.materiel = 0;
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'artillery' })).toMatch(/materiel/);
    n.materiel = 500;
    n.stock.iron = 0;
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'artillery' })).toMatch(/iron/);
    expect(checkCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'armour' })).toMatch(/Tanks/);
  });

  it('a failed command leaves state untouched', () => {
    const sim = lineGame();
    sim.state.nations.a.treasury = 5;
    const before = JSON.stringify(sim.state);
    const r = applyCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'cavalry' });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(sim.state)).toBe(before);
  });

  it('recruiting moves men from the pool into service without duplicating them', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.treasury = 1000;
    n.manpower = 3000;
    const pool0 = n.manpower;
    const serving0 = menServing(sim, 'a');
    expect(applyCommand(sim, { type: 'recruit', nation: 'a', province: 'a1', unit: 'infantry', count: 2 }).ok).toBe(true);
    expect(n.manpower).toBe(pool0 - 2000);
    expect(menServing(sim, 'a')).toBe(serving0 + 2000);
    expect(poolCap(sim, 'a')).toBeCloseTo(reserveCap(sim, 'a') - menServing(sim, 'a'), 6);
    runTicks(sim, 4, { noAI: true });
    expect(totalMen(sim, 'a')).toBe(2000);
    expect(sim.state.provinces.a1.recruits.length).toBe(0);
  });

  it('the manpower pool never exceeds the reserve minus men serving', () => {
    const sim = lineGame();
    addArmy(sim, 'a', 'a1', { infantry: 4 });
    sim.state.nations.a.manpower = 0;
    runTicks(sim, 48 * 6, { noAI: true });
    expect(sim.state.nations.a.manpower).toBeLessThanOrEqual(poolCap(sim, 'a') + 1);
  });

  // Stage A fix: the monthly settlement used to keep a pool that was already above
  // the cap, so a shrinking reserve (occupation, lost integration) never shrank it.
  it('a shrinking reserve shrinks a full manpower pool', () => {
    const sim = lineGame();
    const a = sim.state.nations.a;
    a.manpower = poolCap(sim, 'a');
    // occupation: the occupied province stops adding to the reserve at once
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a3'] });
    setController(sim, 'a3', 'b');
    expect(a.manpower).toBeLessThanOrEqual(poolCap(sim, 'a') + 1e-6);
    // lost integration: the next monthly settlement trims the pool
    for (const pid of ['a1', 'a2']) sim.state.provinces[pid].integration = 30;
    expect(a.manpower).toBeGreaterThan(poolCap(sim, 'a'));
    monthlyEconomy(sim);
    expect(a.manpower).toBeLessThanOrEqual(poolCap(sim, 'a') + 1e-6);
  });

  it('debt is telegraphed in stages before bankruptcy', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.lastMonth = computeLedger(sim, 'a');
    const gross = Object.values(n.lastMonth.income).reduce((a, b) => a + b, 0);
    n.treasury = -1;
    expect(debtStage(sim, 'a')).toBe(1);
    n.debtMonths = 3;
    expect(debtStage(sim, 'a')).toBe(2);
    n.treasury = -(gross * 3 + 10);
    expect(debtStage(sim, 'a')).toBe(3);
    n.treasury = -(gross * 3 + 500);
    monthlyEconomy(sim);
    expect(n.treasury).toBe(0);
    expect(n.stats.bankruptcies).toBe(1);
    expect(n.bankruptUntil).toBeGreaterThan(sim.state.tick);
    expect(sim.state.notifications.some((x) => x.kind === 'bankrupt' && x.nation === 'a')).toBe(true);
  });

  it('occupied provinces pay the owner nothing and the occupier a share', () => {
    const sim = lineGame();
    const before = computeLedger(sim, 'b').income['Provincial taxes'];
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    sim.state.provinces.b3.controller = 'a';
    bump(sim); // direct edit: refresh derived lookups
    const after = computeLedger(sim, 'b').income['Provincial taxes'];
    expect(after).toBeLessThan(before);
    expect(computeLedger(sim, 'a').income['War contributions']).toBeGreaterThan(0);
  });

  it('an empty supply stockpile cuts supply lines and says why', () => {
    const sim = lineGame();
    const army = addArmy(sim, 'a', 'a2', { infantry: 2 });
    expect(armySupplyInfo(sim, army).connected).toBe(true);
    sim.state.nations.a.supplies = 0;
    sim.state.rev++;
    const info = armySupplyInfo(sim, army);
    expect(info.connected).toBe(false);
    expect(info.reasons.join(' ')).toMatch(/stockpile is empty/);
  });
});
