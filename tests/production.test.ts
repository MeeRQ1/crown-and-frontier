// Standing production orders (format 9): several ships, air wings or regiments in one
// order, laid down and paid for as slipways, airfield room, money and men allow; the
// same rules as an order by hand, only repeated for the player.
//
//   sea scenario: realm a's ports a1 (West Water) and a2 (Middle Water); b's b1, b2

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { C, SHIPS, WINGS } from '../src/sim/config';
import { checkInvariants } from '../src/sim/invariants';
import { previewProduction, unitPrice } from '../src/sim/production';
import { readSave, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/state';
import { runTicks } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { seaGame } from './helpers';

const rich = (sim: Sim, nid = 'a') => {
  const n = sim.state.nations[nid];
  n.treasury = 5000;
  n.materiel = 3000;
  n.manpower = 200_000;
  for (const r of ['iron', 'rubber', 'coal', 'oil'] as const) n.stock[r] = 500;
  n.research.done.push('torpedo_boats', 'aviation', 'fighters');
};
const order = (sim: Sim, cmd: Record<string, unknown>) => {
  const r = applyCommand(sim, { type: 'orderProduction', nation: 'a', mode: 'total', ...cmd } as never);
  expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  return sim.state.nations.a.production!.at(-1)!;
};
const ours = <T extends { nation: string }>(o: Record<string, T>) => Object.values(o).filter((x) => x.nation === 'a');
const weeks = (sim: Sim, n: number) => runTicks(sim, n, { noAI: true });

describe('production orders: ships', () => {
  it('ten torpedo boats over two ports in one order: the slipways are kept busy until all ten are afloat, one squadron a port, told once', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.port = 2;
    sim.state.provinces.a2.port = 2;
    const price = unitPrice(sim, 'a', 'ship', 'screen');
    const before = sim.state.nations.a.treasury;
    const o = order(sim, { kind: 'ship', unit: 'screen', places: ['a1', 'a2'], count: 10 });
    // what the slipways allow starts at once, paid for then (nothing in advance)
    expect(sim.state.provinces.a1.dock.length + sim.state.provinces.a2.dock.length).toBe(4);
    expect(sim.state.nations.a.treasury).toBeCloseTo(before - 4 * price.crowns, 5);
    expect(o.blocked?.why).toMatch(/slipway/);
    const notes0 = sim.state.notifications.length;
    weeks(sim, SHIPS.screen.weeks * 3 + 2);
    const ships = ours(sim.state.fleets).flatMap((f) => f.ships.map((s) => s.type));
    expect(ships.filter((t) => t === 'screen')).toHaveLength(10);
    // one squadron per port, not ten
    expect(ours(sim.state.fleets).filter((f) => f.ships.some((s) => s.type === 'screen'))).toHaveLength(2);
    expect(sim.state.nations.a.production).toEqual([]);
    const notes = sim.state.notifications.slice(notes0).filter((n) => n.nation === 'a' && (n.kind === 'navy' || n.kind === 'production'));
    expect(notes.map((n) => n.text)).toEqual([expect.stringMatching(/Production order complete: 10 torpedo boats from 2 places/)]);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('the preview says what the order will do: per place, what starts now, cost and upkeep', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.port = 2;
    const p = previewProduction(sim, 'a', 'ship', 'screen', ['a1', 'a2', 'b1'], 3, 'per');
    expect(p.rows.map((r) => [r.pid, r.target, r.startNow, r.problem !== null])).toEqual([
      ['a1', 3, 2, false],
      ['a2', 3, 1, false],
      ['b1', 0, 0, true],
    ]);
    expect(p.count).toBe(6);
    expect(p.total.crowns).toBe(6 * p.price.crowns);
    expect(p.upkeep).toBeCloseTo(6 * SHIPS.screen.upkeep, 5);
    expect(p.limit).toMatch(/slipway/);
    const o = order(sim, { kind: 'ship', unit: 'screen', places: ['a1', 'a2'], count: 3, mode: 'per' });
    expect(o.started).toEqual({ a1: 2, a2: 1 });
  });

  it('full slipways, missing technology and a foreign port are refused or waited out, never worked around', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.nations.a.research.done = sim.state.nations.a.research.done.filter((t) => t !== 'torpedo_boats');
    expect(checkCommand(sim, { type: 'orderProduction', nation: 'a', kind: 'ship', unit: 'screen', places: ['a1'], count: 2, mode: 'total' })).toMatch(/technology/);
    expect(checkCommand(sim, { type: 'orderProduction', nation: 'a', kind: 'ship', unit: 'cruiser', places: ['b1'], count: 2, mode: 'total' })).toMatch(/own and hold/);
    expect(checkCommand(sim, { type: 'orderProduction', nation: 'a', kind: 'ship', unit: 'cruiser', places: ['a1'], count: 61, mode: 'total' })).toMatch(/Between 1 and 60/);
    // a ship by hand holds the only slipway: the order waits for it
    expect(applyCommand(sim, { type: 'buildShip', nation: 'a', province: 'a1', ship: 'transport' }).ok).toBe(true);
    const o = order(sim, { kind: 'ship', unit: 'cruiser', places: ['a1'], count: 2 });
    expect(o.started).toEqual({});
    expect(o.blocked?.why).toMatch(/every slipway is in use/);
    weeks(sim, SHIPS.transport.weeks + 1);
    expect(o.started.a1).toBe(1);
  });

  it('short of money: what can be paid starts, the rest waits and starts by itself when the treasury allows', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.port = 5;
    const price = unitPrice(sim, 'a', 'ship', 'cruiser');
    sim.state.nations.a.treasury = price.crowns * 2 + 1;
    const o = order(sim, { kind: 'ship', unit: 'cruiser', places: ['a1'], count: 5 });
    expect(o.started.a1).toBe(2);
    expect(o.blocked?.why).toMatch(/crowns/);
    expect(sim.state.nations.a.treasury).toBeGreaterThanOrEqual(0);
    sim.state.nations.a.treasury += price.crowns * 3;
    weeks(sim, 1);
    expect(o.started.a1).toBe(5);
    expect(o.blocked).toBeNull();
  });

  it('cancelling stops what has not started (nothing was paid for it); what is on the slipways is finished as ships by hand', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    const o = order(sim, { kind: 'ship', unit: 'cruiser', places: ['a1'], count: 4 });
    const t0 = sim.state.nations.a.treasury;
    const r = applyCommand(sim, { type: 'productionState', nation: 'a', order: o.id, state: 'cancel' });
    expect(r.ok && r.message).toMatch(/3 not started.*1 already under way/);
    expect(sim.state.nations.a.treasury).toBe(t0);
    expect(sim.state.nations.a.production).toEqual([]);
    weeks(sim, SHIPS.cruiser.weeks + 1);
    expect(ours(sim.state.fleets).flatMap((f) => f.ships).filter((s) => s.type === 'cruiser')).toHaveLength(1);
    expect(sim.state.provinces.a1.dock).toEqual([]);
  });

  it('paused, nothing more starts; resumed, it goes on', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    const o = order(sim, { kind: 'ship', unit: 'transport', places: ['a1'], count: 3 });
    expect(applyCommand(sim, { type: 'productionState', nation: 'a', order: o.id, state: 'paused' }).ok).toBe(true);
    weeks(sim, SHIPS.transport.weeks + 1);
    expect(o.started.a1).toBe(1);
    applyCommand(sim, { type: 'productionState', nation: 'a', order: o.id, state: 'active' });
    expect(o.started.a1).toBe(2);
  });

  it('a port lost to the enemy is dropped from the order (said once); its share not yet started goes with it', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    const o = order(sim, { kind: 'ship', unit: 'transport', places: ['a1', 'a2'], count: 3, mode: 'per' });
    expect(o.total).toBe(6);
    declareWar(sim, 'b', 'a', { type: 'conquest', provinces: ['a2'] });
    sim.state.provinces.a2.controller = 'b';
    weeks(sim, 1);
    expect(o.places).toEqual(['a1']);
    expect(o.total).toBe(3 + 1);
    expect(sim.state.notifications.some((n) => n.nation === 'a' && /can no longer build them/.test(n.text))).toBe(true);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('new ships sail to the chosen zone by ordinary moves and join up there', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.port = 2;
    order(sim, { kind: 'ship', unit: 'transport', places: ['a1', 'a2'], count: 4, assign: { rally: 'ze' } });
    weeks(sim, SHIPS.transport.weeks + 1);
    // moving, not placed: the first squadrons are under way from their ports
    const moving = ours(sim.state.fleets).filter((f) => f.path.length || f.zone === 'ze');
    expect(moving.length).toBeGreaterThan(0);
    weeks(sim, SHIPS.transport.weeks + 12);
    const there = ours(sim.state.fleets).filter((f) => f.zone === 'ze');
    expect(there).toHaveLength(1);
    expect(there[0].ships).toHaveLength(4);
  });
});

describe('production orders: air wings and regiments', () => {
  it('wings fill an airfield as room allows; the preview says when they cannot all stay there, and a move frees the room', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.airfield = 1;
    sim.state.provinces.a2.airfield = 2;
    const pv = previewProduction(sim, 'a', 'wing', 'fighter', ['a1'], 4, 'total');
    expect(pv.capacity).toMatch(/room for 2 more wings/);
    expect(pv.weeks).toBeNull();
    // sent on to a2 when ready: a1's room frees for the next
    const o = order(sim, { kind: 'wing', unit: 'fighter', places: ['a1'], count: 4, assign: { rally: 'a2' } });
    expect(o.started.a1).toBe(2);
    weeks(sim, (WINGS.fighter.weeks + 2) * 2 + 4);
    const wings = ours(sim.state.wings);
    expect(wings).toHaveLength(4);
    expect(wings.every((w) => w.base === 'a2')).toBe(true);
    expect(checkCommand(sim, { type: 'orderProduction', nation: 'a', kind: 'wing', unit: 'fighter', places: ['a1'], count: 2, mode: 'total', assign: { rally: 'b1' } })).toMatch(/airfield we own/);
    expect(C.air.wingsPerAirfield).toBe(2);
  });

  it('regiments per place: each province raises its count and they form one army there; they join the operation chosen', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    const op = applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'hold', area: ['a1', 'a2'], activate: true });
    expect(op.ok).toBe(true);
    const opId = Object.keys(sim.state.operations).at(-1)!;
    const o = order(sim, { kind: 'regiment', unit: 'infantry', places: ['a1', 'a2'], count: 3, mode: 'per', assign: { op: opId } });
    expect(o.started).toEqual({ a1: 3, a2: 3 });
    weeks(sim, 20);
    const armies = ours(sim.state.armies);
    expect(armies.reduce((s, a) => s + a.regiments.length, 0)).toBe(6);
    expect(armies.length).toBeLessThanOrEqual(2);
    expect(armies.every((a) => a.op === opId)).toBe(true);
  });

  it('an order under way survives a save and plays on identically', () => {
    const sim = seaGame({ playerNation: 'a' });
    rich(sim);
    sim.state.provinces.a1.port = 2;
    order(sim, { kind: 'ship', unit: 'transport', places: ['a1', 'a2'], count: 6, assign: { rally: 'zm' } });
    weeks(sim, 5);
    const back = readSave(serialize(sim)).sim;
    expect(checkInvariants(back)).toEqual([]);
    weeks(sim, 25);
    weeks(back, 25);
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(sim.state));
  });
});
