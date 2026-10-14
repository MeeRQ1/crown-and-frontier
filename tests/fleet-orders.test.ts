// Fleet standing orders (format 7): hold, patrol, blockade, raid, escort, shell a
// coast, return to port. Each order sends the fleet to its place by sea, at its
// own speed, and weights what it does there; orders that can no longer be
// carried out lapse with a reason.
//
//   a1 ─ a2 ─ b1 ─ b2        sea zones: West (a1), Middle (a2, b1, i1), East (b2, c1)
//    W     M         E       W–M–E in a row; i1 is b's island off a2

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C } from '../src/sim/config';
import { nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { bombardPlan, createFleet, dutyWeights, fleetSpeed, newShip, provinceBlockaded, raidLoss, touchFleets, weeklyNaval, zoneBlockaded } from '../src/sim/naval';
import { readSave, serialize } from '../src/sim/save';
import { siegeInfo } from '../src/sim/siege';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Fleet, FleetDuty, ShipType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from './helpers';

function fleet(sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null = null): Fleet {
  return createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
}

function fresh(sim: Sim) {
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
}

type Duty = Omit<FleetDuty, 'since'> | null;
const order = (sim: Sim, f: Fleet, duty: Duty) => applyCommand(sim, { type: 'fleetDuty', nation: f.nation, fleet: f.id, duty });

describe('orders and their reasons', () => {
  it('an order the fleet cannot carry out is refused with the reason', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const transports = fleet(sim, 'a', 'zw', ['transport'], 'a1');
    const guns = fleet(sim, 'a', 'zw', ['screen'], 'a1');
    const cruisers = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fresh(sim);
    const why = (f: Fleet, duty: Duty) => checkCommand(sim, { type: 'fleetDuty', nation: 'a', fleet: f.id, duty });
    expect(why(transports, { kind: 'patrol', zone: 'zm' })).toMatch(/Transports alone/);
    expect(why(guns, { kind: 'raid', zone: 'zm' })).toMatch(/submarines and cruisers do/);
    expect(why(guns, { kind: 'bombard', province: 'b1' })).toMatch(/Only battleships and cruisers/);
    expect(why(cruisers, { kind: 'bombard', province: 'i1' })).toBeNull();
    expect(why(cruisers, { kind: 'escort', fleet: cruisers.id })).toMatch(/cannot escort itself/);
    expect(why(cruisers, { kind: 'patrol', zone: 'nowhere' })).toMatch(/Choose a sea zone/);
    expect(checkCommand(sim, { type: 'fleetDuty', nation: 'b', fleet: cruisers.id, duty: { kind: 'hold' } })).toMatch(/Not our fleet/);
  });

  it('a fleet carrying troops keeps out of action', () => {
    const sim = seaGame();
    const f = fleet(sim, 'a', 'zm', ['transport', 'cruiser'], 'a2');
    const army = addArmy(sim, 'a', 'a2', { infantry: 1 });
    fresh(sim);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: f.id, dest: 'a1' }).ok).toBe(true);
    expect(checkCommand(sim, { type: 'fleetDuty', nation: 'a', fleet: f.id, duty: { kind: 'blockade', zone: 'ze' } })).toMatch(/Land the troops aboard first/);
  });
});

describe('movement under orders', () => {
  it('a patrol sails to its zone at the fleet’s own speed, never jumping, and stays', () => {
    const sim = seaGame();
    const f = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fresh(sim);
    expect(order(sim, f, { kind: 'patrol', zone: 'ze' }).ok).toBe(true);
    expect(f.path).toEqual(['zm', 'ze']);
    const speed = fleetSpeed(sim, f);
    const seen: string[] = [f.zone];
    for (let w = 0; w < 6; w++) {
      weeklyNaval(sim);
      seen.push(f.zone);
    }
    // one zone at a time: no step skips a zone
    const order3 = ['zw', 'zm', 'ze'];
    for (let i = 1; i < seen.length; i++) expect(order3.indexOf(seen[i]) - order3.indexOf(seen[i - 1])).toBeLessThanOrEqual(Math.ceil(speed));
    expect(f.zone).toBe('ze');
    expect(f.path).toEqual([]);
    expect(f.duty?.kind).toBe('patrol');
    expect(f.report!.notes.join(' ')).toMatch(/Patrolling East Water/);
  });

  it('sailing by hand ends the order; halting puts the fleet on station', () => {
    const sim = seaGame();
    const f = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fresh(sim);
    order(sim, f, { kind: 'patrol', zone: 'ze' });
    expect(applyCommand(sim, { type: 'moveFleet', nation: 'a', fleet: f.id, zone: 'zm' }).ok).toBe(true);
    expect(f.duty).toBeNull();
    order(sim, f, { kind: 'patrol', zone: 'ze' });
    expect(applyCommand(sim, { type: 'stopFleet', nation: 'a', fleet: f.id }).ok).toBe(true);
    expect(f.duty).toBeNull();
    expect(f.path).toEqual([]);
  });

  it('an escort follows the fleet it escorts, and its order lapses when that fleet is gone', () => {
    const sim = seaGame();
    const convoy = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    const guard = fleet(sim, 'a', 'zw', ['cruiser', 'screen'], 'a1');
    fresh(sim);
    expect(order(sim, guard, { kind: 'escort', fleet: convoy.id }).ok).toBe(true);
    applyCommand(sim, { type: 'moveFleet', nation: 'a', fleet: convoy.id, zone: 'ze' });
    for (let w = 0; w < 8 && (convoy.zone !== 'ze' || guard.zone !== 'ze'); w++) weeklyNaval(sim);
    expect(convoy.zone).toBe('ze');
    expect(guard.zone).toBe('ze');
    applyCommand(sim, { type: 'disbandFleet', nation: 'a', fleet: convoy.id });
    weeklyNaval(sim);
    expect(guard.duty).toBeNull();
    expect(guard.report!.notes.join(' ')).toMatch(/Escort order lapsed: the fleet it escorted is gone/);
  });

  it('return to port: the fleet sails home and repairs half as fast again in harbour', () => {
    const repairs = (ordered: boolean) => {
      const sim = seaGame();
      const f = fleet(sim, 'a', ordered ? 'zm' : 'zw', ['cruiser'], 'a1');
      for (const s of f.ships) s.hp = 40;
      fresh(sim);
      if (ordered) order(sim, f, { kind: 'port' });
      for (let w = 0; w < 4 && f.zone !== 'zw'; w++) weeklyNaval(sim);
      expect(f.zone).toBe('zw');
      const before = f.ships[0].hp;
      weeklyNaval(sim);
      return f.ships[0].hp - before;
    };
    const station = repairs(false);
    const harbour = repairs(true);
    expect(station).toBeGreaterThan(0);
    expect(harbour).toBeCloseTo(station * C.naval.harbourRepair, 6);
  });

  it('a fleet beaten in battle is sent to port to repair, and says so', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const weak = fleet(sim, 'a', 'zm', ['screen'], 'a1');
    fleet(sim, 'b', 'zm', ['capital', 'capital', 'cruiser'], 'b1');
    fresh(sim);
    order(sim, weak, { kind: 'blockade', zone: 'zm' });
    weeklyNaval(sim);
    const f = sim.state.fleets[weak.id];
    if (f) {
      expect(f.duty?.kind).toBe('port');
      expect(f.report!.notes.join(' ')).toMatch(/Beaten off in Middle Water \(its order, blockade, is cancelled\): falling back to/);
    }
  });
});

describe('what orders do where the fleet lies', () => {
  it('a blockade order closes waters that the same ships on station could not', () => {
    const run = (duty: 'blockade' | null) => {
      const sim = seaGame();
      declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a1'] });
      fleet(sim, 'a', 'zw', ['cruiser', 'cruiser'], 'a1');
      const f = fleet(sim, 'b', 'zw', ['cruiser', 'cruiser', 'cruiser'], 'b1');
      fresh(sim);
      if (duty) order(sim, f, { kind: 'blockade', zone: 'zw' });
      fresh(sim);
      return { closed: zoneBlockaded(sim, 'zw', 'a'), cut: provinceBlockaded(sim, 'a1') };
    };
    // three cruisers against two: short of the 2 : 1 a blockade needs, until ordered to it (×1.5)
    expect(run(null)).toEqual({ closed: false, cut: false });
    expect(run('blockade')).toEqual({ closed: true, cut: true });
  });

  it('raiders under a raid order take more of the enemy’s trade; held back, they take none', () => {
    const run = (duty: 'raid' | 'hold' | null) => {
      const sim = seaGame();
      declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a1'] });
      // one submarine against a's torpedo boat: short of the zone's cap on station
      const f = fleet(sim, 'b', 'zm', ['submarine'], 'b1');
      fleet(sim, 'a', 'zm', ['screen'], 'a2');
      fresh(sim);
      if (duty === 'raid') order(sim, f, { kind: 'raid', zone: 'zm' });
      if (duty === 'hold') order(sim, f, { kind: 'hold' });
      fresh(sim);
      return raidLoss(sim, 'a', 'c').share;
    };
    const station = run(null);
    expect(station).toBeGreaterThan(0);
    expect(station).toBeLessThan(C.naval.raidZoneMax);
    expect(run('raid')).toBeGreaterThan(station);
    expect(run('hold')).toBe(0);
  });

  it('a patrol protects our trade half as well again as the same ships on station', () => {
    const run = (duty: 'patrol' | null) => {
      const sim = seaGame();
      declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a1'] });
      fleet(sim, 'b', 'zm', ['submarine', 'submarine'], 'b1');
      const f = fleet(sim, 'a', 'zm', ['screen'], 'a2');
      fresh(sim);
      if (duty) order(sim, f, { kind: 'patrol', zone: 'zm' });
      fresh(sim);
      expect(dutyWeights(sim, f).escort).toBe(duty ? 1.5 : 1);
      return raidLoss(sim, 'a', 'c').share;
    };
    expect(run('patrol')).toBeLessThan(run(null));
  });

  it('a fleet ordered to shell one province shells only it; on station it shells the largest battle', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    // two battles on the Middle Water's coast: a big one at b1, a small one at i1
    addArmy(sim, 'a', 'b1', { infantry: 6 });
    addArmy(sim, 'b', 'b1', { infantry: 6 });
    addArmy(sim, 'a', 'i1', { infantry: 1 });
    addArmy(sim, 'b', 'i1', { infantry: 1 });
    const f = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
    fresh(sim);
    step(sim, { noAI: true });
    const where = () => {
      fresh(sim);
      for (const [bid, sides] of bombardPlan(sim)) if (sides.att.some((x) => x.fleet.id === f.id)) return sim.state.battles[bid].province;
      return null;
    };
    expect(Object.values(sim.state.battles).map((b) => b.province).sort()).toEqual(['b1', 'i1']);
    expect(where()).toBe('b1');
    order(sim, f, { kind: 'bombard', province: 'i1' });
    expect(where()).toBe('i1');
    order(sim, f, { kind: 'hold' });
    expect(where()).toBeNull();
  });

  it('naval guns ordered onto a besieged coast fort speed the siege, and the fort fires back', () => {
    const setup = (ordered: boolean) => {
      const sim = seaGame();
      declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
      sim.state.provinces.b1.fort = 2;
      addArmy(sim, 'a', 'b1', { infantry: 4 });
      const f = fleet(sim, 'a', 'zm', ['capital', 'cruiser'], 'a2');
      fresh(sim);
      if (ordered) order(sim, f, { kind: 'bombard', province: 'b1' });
      fresh(sim);
      return { sim, f };
    };
    const plain = setup(false);
    const shelled = setup(true);
    const a = siegeInfo(plain.sim, 'b1')!;
    const b = siegeInfo(shelled.sim, 'b1')!;
    expect(b.weeklyRate).toBeGreaterThan(a.weeklyRate);
    expect(b.weeklyRate).toBeLessThanOrEqual(a.weeklyRate * (1 + C.naval.siegeMax) + 1e-9);
    expect(b.notes.some((n) => /Naval guns offshore/.test(n))).toBe(true);
    // the siege begins at the end of the first week; the fort answers from the second
    step(shelled.sim, { noAI: true });
    const hp0 = shelled.f.ships.reduce((s, x) => s + x.hp, 0);
    step(shelled.sim, { noAI: true });
    const f = shelled.sim.state.fleets[shelled.f.id];
    expect(f.ships.reduce((s, x) => s + x.hp, 0)).toBeLessThan(hp0);
    expect(f.report!.notes.join(' ')).toMatch(/Shelled the fort at .* for the siege; its guns \(level 2\) hit back/);
  });
});

describe('saves', () => {
  it('orders survive a save and load, and the world stays consistent', () => {
    const sim = seaGame();
    const f = fleet(sim, 'a', 'zw', ['cruiser'], 'a1');
    fresh(sim);
    order(sim, f, { kind: 'patrol', zone: 'ze' });
    const back = readSave(serialize(sim)).sim;
    expect(back.state.fleets[f.id].duty).toEqual(f.duty);
    expect(checkInvariants(back)).toEqual([]);
  });
});
