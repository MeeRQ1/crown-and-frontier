// Stage C: sea zones (generation, upgrade, validation), shipyards, fleets,
// naval battles, straits, blockades and armies carried by sea.

import { describe, expect, it } from 'vitest';
import { BUILTIN_MAPS, builtinPackage } from '../src/maps/builtin';
import { MAP_FORMAT_VERSION } from '../src/maps/format';
import { generateSeaZones } from '../src/maps/seazones';
import { checkMapObject, validateMapPackage } from '../src/maps/validate';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C, SHIPS } from '../src/sim/config';
import { forecastBattle } from '../src/sim/combat';
import { provinceCrowns } from '../src/sim/economy';
import { armiesIn, nextMemoEpoch } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { findPath } from '../src/sim/movement';
import { blockadeShare, createFleet, newShip, provinceBlockaded, straitBlocked, touchFleets, tradeOpen, weeklyNaval } from '../src/sim/naval';
import { readSave, serialize } from '../src/sim/save';
import { bump, type Sim } from '../src/sim/state';
import { runTicks, step } from '../src/sim/tick';
import type { ShipType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { addArmy, seaGame } from './helpers';

function fleet(sim: Sim, nid: string, zone: string, types: ShipType[], home: string | null = null) {
  return createFleet(sim, nid, zone, types.map((t) => newShip(sim, t)), home);
}

function fresh(sim: Sim) {
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
}

describe('sea zones', () => {
  it('the built-in maps have sea zones on every real coast, two-way borders and every strait commanded', async () => {
    for (const id of BUILTIN_MAPS) {
      const pkg = await builtinPackage(id);
      expect(pkg.version).toBe(MAP_FORMAT_VERSION);
      expect(pkg.seaZones.length).toBeGreaterThan(5);
      const byId = new Map(pkg.seaZones.map((z) => [z.id, z]));
      for (const z of pkg.seaZones) for (const n of z.neighbors) expect(byId.get(n)?.neighbors).toContain(z.id);
      const commanded = pkg.seaZones.flatMap((z) => z.straits ?? []).length;
      expect(commanded).toBe(pkg.straits.length);
      const check = validateMapPackage(pkg);
      expect(check.errors).toEqual([]);
      // nearly every province with a sea border lies on some zone's coast
      const coastal = new Set(pkg.seaZones.flatMap((z) => z.coasts));
      const seaSide = new Set(pkg.geometry.edges.filter((e) => e.a === '~sea' || e.b === '~sea').map((e) => (e.a === '~sea' ? e.b : e.a)));
      expect([...seaSide].filter((p) => !coastal.has(p)).length).toBeLessThanOrEqual(2);
    }
  });

  it('generation is deterministic and matches the shipped data', async () => {
    const pkg = await builtinPackage('reach');
    const a = generateSeaZones(pkg);
    const b = generateSeaZones(pkg);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.zones).toEqual(pkg.seaZones);
  });

  it('a format-2 map without sea zones gets them on import', async () => {
    const pkg = structuredClone(await builtinPackage('reach')) as unknown as Record<string, unknown>;
    pkg.id = 'reach-v2';
    pkg.version = 2;
    delete pkg.seaZones;
    (pkg.geometry as Record<string, unknown>).seas = undefined;
    for (const p of pkg.provinces as Array<Record<string, unknown>>) delete p.port;
    const { pkg: up, check } = checkMapObject(pkg);
    expect(check.errors).toEqual([]);
    expect(up!.version).toBe(MAP_FORMAT_VERSION);
    expect(up!.seaZones.length).toBe((await builtinPackage('reach')).seaZones.length);
    expect(up!.provinces.some((p) => (p.port ?? 0) > 0)).toBe(true);
  });

  it('broken sea zones are refused with reasons', async () => {
    const base = await builtinPackage('reach');
    const one = structuredClone(base);
    one.seaZones[0].neighbors.push('nowhere');
    expect(validateMapPackage(one).errors.some((e) => /unknown sea zone "nowhere"/.test(e.message))).toBe(true);
    const two = structuredClone(base);
    two.seaZones[1].neighbors = two.seaZones[1].neighbors.filter((n) => n !== two.seaZones[0].id);
    two.seaZones[0].neighbors = [...new Set([...two.seaZones[0].neighbors, two.seaZones[1].id])];
    expect(validateMapPackage(two).errors.some((e) => /two-way/.test(e.message))).toBe(true);
    const three = structuredClone(base);
    const inland = three.provinces.find((p) => !three.seaZones.some((z) => z.coasts.includes(p.id)))!;
    inland.port = 1;
    expect(validateMapPackage(three).errors.some((e) => /has a port but is not on the coast/.test(e.message))).toBe(true);
  });
});

describe('shipyards and fleets', () => {
  it('ships are built in ports, need their technology, and join a squadron off the port', () => {
    const sim = seaGame();
    const a = sim.state.nations.a;
    a.treasury = 1000;
    a.materiel = 500;
    a.stock.iron = 100;
    expect(checkCommand(sim, { type: 'buildShip', nation: 'a', province: 'a1', ship: 'submarine' })).toMatch(/technology/);
    sim.state.provinces.a1.port = 0;
    expect(checkCommand(sim, { type: 'buildShip', nation: 'a', province: 'a1', ship: 'cruiser' })).toMatch(/no port/);
    sim.state.provinces.a1.port = 1;
    expect(applyCommand(sim, { type: 'buildShip', nation: 'a', province: 'a1', ship: 'cruiser' }).ok).toBe(true);
    expect(checkCommand(sim, { type: 'buildShip', nation: 'a', province: 'a1', ship: 'transport' })).toMatch(/slipways/);
    expect(a.materiel).toBe(500 - SHIPS.cruiser.materiel);
    runTicks(sim, SHIPS.cruiser.weeks, { noAI: true });
    const f = Object.values(sim.state.fleets).find((x) => x.nation === 'a')!;
    expect(f.zone).toBe('zw');
    expect(f.ships.map((s) => s.type)).toEqual(['cruiser']);
    expect(a.stats.shipsBuilt).toBe(1);
  });

  it('fleets sail between zones at their speed', () => {
    const sim = seaGame();
    const f = fleet(sim, 'a', 'zw', ['capital']);
    expect(applyCommand(sim, { type: 'moveFleet', nation: 'a', fleet: f.id, zone: 'ze' }).ok).toBe(true);
    expect(f.path).toEqual(['zm', 'ze']);
    runTicks(sim, 1, { noAI: true });
    expect(f.zone).toBe('zm'); // battleships make 1.5 zones a week
    runTicks(sim, 1, { noAI: true });
    expect(f.zone).toBe('ze');
    expect(checkInvariants(sim)).toEqual([]);
  });
});

describe('naval battles', () => {
  /** Two fleets meet in the middle zone at war; returns what is left of each after a week. */
  function clash(attacker: ShipType[], defender: ShipType[], seed = 7) {
    const sim = seaGame({ seed });
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
    const fa = fleet(sim, 'a', 'zm', attacker);
    const fb = fleet(sim, 'b', 'zm', defender);
    fresh(sim);
    weeklyNaval(sim);
    const left = (id: string) => sim.state.fleets[id]?.ships.reduce((s, x) => s + x.hp, 0) ?? 0;
    return { a: left(fa.id) / (attacker.length * 100), b: left(fb.id) / (defender.length * 100), sim };
  }

  it('battleships beat torpedo boats of the same cost', () => {
    // one battleship (90) against three and a half torpedo boats' worth (3 × 25 + a cruiser)
    const r = clash(['capital'], ['screen', 'screen', 'screen']);
    expect(r.a).toBeGreaterThan(r.b);
  });

  it('submarines sink unescorted battleships; torpedo boats hunt submarines', () => {
    const subs = clash(['submarine', 'submarine', 'submarine'], ['capital']);
    expect(subs.a).toBeGreaterThan(subs.b);
    const hunt = clash(['screen', 'screen', 'screen', 'screen'], ['submarine', 'submarine', 'submarine']);
    expect(hunt.a).toBeGreaterThan(hunt.b);
  });

  it('a battle is reported and counted for both sides', () => {
    const r = clash(['cruiser', 'cruiser'], ['cruiser']);
    const rep = r.sim.state.reports.at(-1)!;
    expect(rep.sea).toBe(true);
    expect(rep.province).toBe('zm');
    expect(r.sim.state.nations.a.stats.navalBattles).toBe(1);
    expect(r.sim.state.nations.b.stats.navalBattles).toBe(1);
    expect(checkInvariants(r.sim)).toEqual([]);
  });
});

describe('sea control', () => {
  it('enemy warships close a strait to our armies until we outgun them there', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['i1'] });
    fresh(sim);
    expect(findPath(sim, 'a', 'a2', 'i1')).not.toBeNull();
    fleet(sim, 'b', 'zm', ['cruiser']);
    fresh(sim);
    expect(straitBlocked(sim, 'a', 'a2', 'i1')).toBe(true);
    expect(findPath(sim, 'a', 'a2', 'i1')).toBeNull();
    fleet(sim, 'a', 'zm', ['capital']);
    fresh(sim);
    expect(straitBlocked(sim, 'a', 'a2', 'i1')).toBe(false);
    expect(findPath(sim, 'a', 'a2', 'i1')).not.toBeNull();
  });

  it('a blockade cuts a coast’s crowns and the realm’s sea trade', () => {
    const sim = seaGame();
    sim.state.provinces.a1.port = 1;
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a1'] });
    fresh(sim);
    const before = provinceCrowns(sim, 'a1');
    fleet(sim, 'b', 'zw', ['cruiser', 'cruiser']);
    fresh(sim);
    expect(provinceBlockaded(sim, 'a1')).toBe(true);
    expect(provinceCrowns(sim, 'a1')).toBeCloseTo(before * (1 - C.naval.blockadeIncome), 9);
    // a2 still looks onto the middle water, which nobody holds
    expect(provinceBlockaded(sim, 'a2')).toBe(false);
    expect(blockadeShare(sim, 'a')).toBeGreaterThan(0);
  });

  it('a blockade shrinks trade with partners overseas, not with land neighbours', () => {
    const sim = seaGame();
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a1'] });
    fresh(sim);
    expect(tradeOpen(sim, 'a', 'c')).toBe(1);
    // b holds both waters off a's coast: every coast of a is blockaded
    fleet(sim, 'b', 'zw', ['cruiser', 'cruiser']);
    fleet(sim, 'b', 'zm', ['cruiser', 'cruiser']);
    fresh(sim);
    expect(blockadeShare(sim, 'a')).toBe(1);
    expect(tradeOpen(sim, 'a', 'c')).toBeCloseTo(1 - 0.7, 9);
    // c reaches a only by sea; a land neighbour (were they at peace) would trade overland
    expect(tradeOpen(sim, 'a', 'b')).toBe(1);
  });
});

describe('armies by sea', () => {
  it('an army embarks, sails and lands on an enemy coast, fighting at a disadvantage that week', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    const tr = fleet(sim, 'a', 'zm', ['transport', 'transport', 'cruiser'], 'a2');
    const army = addArmy(sim, 'a', 'a2', { infantry: 3 });
    const def = addArmy(sim, 'b', 'b2', { infantry: 1 }, 600);
    fresh(sim);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'b2' }).ok).toBe(true);
    expect(sim.state.armies[army.id].embarked).toBe(tr.id);
    expect(armiesIn(sim, 'a2').some((a) => a.id === army.id)).toBe(false);
    expect(checkCommand(sim, { type: 'move', nation: 'a', army: army.id, dest: 'a1' })).toMatch(/at sea/);
    // the forecast for troops still aboard includes the landing penalty
    const f = forecastBattle(sim, 'b2', [sim.state.armies[army.id]], [def]);
    expect(f.factors.some((x) => /Landing from the sea/.test(x))).toBe(true);
    let landed = false;
    for (let w = 0; w < 6 && !landed; w++) {
      step(sim, { noAI: true });
      landed = !sim.state.armies[army.id]?.embarked;
    }
    expect(landed).toBe(true);
    expect(sim.state.nations.a.stats.landings).toBe(1);
    // the battle on the beach opened with the landing penalty
    const beach = Object.values(sim.state.battles).find((b) => b.province === 'b2');
    const factors = beach?.factors ?? sim.state.reports.find((r) => !r.sea && r.province === 'b2')?.factors ?? [];
    expect(factors.some((x) => /Landing from the sea/.test(x))).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);
  });

  // found by the fuzzer: an embarked army still has the port it left as its
  // location, and an enemy marching into that port used to start a battle with it
  it('troops at sea do not fight in the port they left', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    const tr = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    const army = addArmy(sim, 'a', 'a1', { infantry: 3 });
    fresh(sim);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'b2' }).ok).toBe(true);
    addArmy(sim, 'b', 'a1', { infantry: 2 });
    fresh(sim);
    step(sim, { noAI: true });
    expect(sim.state.armies[army.id].embarked).toBe(tr.id);
    expect(sim.state.armies[army.id].battle ?? null).toBeNull();
    expect(Object.values(sim.state.battles).some((b) => b.attackers.includes(army.id) || b.defenders.includes(army.id))).toBe(false);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('troops are lost with the transports that carried them', () => {
    const sim = seaGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    // from the west water to the east, through the middle water the enemy holds
    const tr = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    const army = addArmy(sim, 'a', 'a1', { infantry: 4 });
    fresh(sim);
    expect(applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'b2' }).ok).toBe(true);
    fleet(sim, 'b', 'zm', ['capital', 'capital', 'cruiser']);
    fresh(sim);
    const menBefore = sim.state.armies[army.id].regiments.reduce((s, r) => s + r.men, 0);
    weeklyNaval(sim);
    const left = sim.state.armies[army.id]?.regiments.reduce((s, r) => s + r.men, 0) ?? 0;
    expect(left).toBeLessThan(menBefore);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('regiments that no longer fit after a transport sinks are lost; the rest stay aboard (isles seed 2 regression)', () => {
    // found by an AI campaign on the Sundered Isles: troops were thinned in proportion
    // and a fleet ended up carrying 6 regiments with room for 4
    let partial = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const sim = seaGame({ seed });
      declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b1'] });
      // a convoy lying off its own coast with six regiments aboard, one transport already damaged
      const tr = fleet(sim, 'a', 'zm', ['transport', 'transport', 'transport'], 'a2');
      tr.ships[seed % 3].hp = 8;
      const army = addArmy(sim, 'a', 'a2', { infantry: 6 });
      army.embarked = tr.id;
      tr.cargo = [army.id];
      fleet(sim, 'b', 'zm', ['screen']);
      fresh(sim);
      const menBefore = army.regiments.map((r) => r.men);
      weeklyNaval(sim);
      expect(checkInvariants(sim)).toEqual([]);
      const f = sim.state.fleets[tr.id];
      const a = sim.state.armies[army.id];
      const room = f ? f.ships.reduce((s, x) => s + SHIPS[x.type].capacity, 0) : 0;
      const regs = a?.regiments.length ?? 0;
      expect(regs).toBeLessThanOrEqual(room);
      if (a && room < 6 && room > 0) {
        partial++;
        // whole regiments go down; those still aboard keep their men
        expect(regs).toBe(room);
        expect(a.regiments.map((r) => r.men)).toEqual(menBefore.slice(0, regs));
      }
    }
    expect(partial).toBeGreaterThan(0);
  });

  it('a campaign saved with troops at sea continues exactly like the original', () => {
    const sim = seaGame();
    const tr = fleet(sim, 'a', 'zw', ['transport', 'transport'], 'a1');
    const army = addArmy(sim, 'a', 'a1', { infantry: 2 });
    fresh(sim);
    applyCommand(sim, { type: 'shipArmies', nation: 'a', armies: [army.id], fleet: tr.id, dest: 'a2' });
    step(sim, { noAI: true });
    const { sim: copy } = readSave(serialize(sim));
    for (let i = 0; i < 6; i++) {
      step(sim, { noAI: true });
      step(copy, { noAI: true });
    }
    const strip = (s: string) => s.replace(/"savedAt":"[^"]+"/, '');
    expect(strip(serialize(copy))).toBe(strip(serialize(sim)));
    expect(sim.state.armies[army.id].location).toBe('a2');
  });

  it('AI realms on a coast build, sail and fight with fleets over a few years', () => {
    const sim = seaGame();
    sim.state.armies = {};
    for (const n of Object.values(sim.state.nations)) n.treasury = 2000;
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['i1'] });
    runTicks(sim, 48 * 3);
    const built = Object.values(sim.state.nations).reduce((s, n) => s + n.stats.shipsBuilt, 0);
    expect(built).toBeGreaterThan(0);
    expect(checkInvariants(sim)).toEqual([]);
  });
});
