// Simple Auto-conquer (format 9): one order against realms we are at war with; every
// free force joins; the enemies' land is taken, ours defended against anyone at war
// with us; it never declares war, adds an enemy, makes peace or reclaims a force the
// player keeps.
//
//   grid: columns 0–1 realm a (us), 2–4 realm b, 5–6 realm c; g{x}{y}

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { checkInvariants } from '../src/sim/invariants';
import { opForces } from '../src/sim/ops/operations';
import { readSave, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar, endWar } from '../src/sim/war';
import { addArmy, gridGame } from './helpers';

const weeks = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) step(sim, { noAI: true });
};
const auto = (sim: Sim, enemies: string[], settings = {}) => {
  const r = applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'war', area: [], enemies, settings, activate: true });
  expect(r.ok, r.ok ? '' : r.reason).toBe(true);
  return Object.values(sim.state.operations).at(-1)!;
};
const held = (sim: Sim, nid: string) => sim.world.provIds.filter((p) => sim.state.provinces[p].owner === 'b' && sim.state.provinces[p].controller === nid).length;

describe('Simple Auto-conquer', () => {
  it('needs a realm we are at war with: it never starts a war', () => {
    const sim = gridGame();
    const r = applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'war', area: [], enemies: ['b'], activate: true });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/not at war with .*never starts a war/);
    expect(Object.keys(sim.state.wars)).toHaveLength(0);
  });

  it('one order: every free army joins and the enemy land is taken without another order', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    const x = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const y = addArmy(sim, 'a', 'g12', { infantry: 6 });
    const op = auto(sim, ['b']);
    expect(opForces(sim, op.id).armies.map((a) => a.id).sort()).toEqual([x.id, y.id].sort());
    const log = sim.state.playerLog.length;
    weeks(sim, 30);
    expect(held(sim, 'a')).toBeGreaterThanOrEqual(6);
    // the operation's orders are not the player's
    expect(sim.state.playerLog.length).toBe(log);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('a force kept for direct command, or one in another operation, is never taken; released forces are not reclaimed', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    const kept = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const other = addArmy(sim, 'a', 'g11', { infantry: 4 });
    const free = addArmy(sim, 'a', 'g12', { infantry: 4 });
    applyCommand(sim, { type: 'reserveUnits', nation: 'a', units: [kept.id], reserved: true });
    applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'hold', area: ['g11'], units: [other.id], activate: true });
    const op = auto(sim, ['b']);
    weeks(sim, 1);
    const members = () => opForces(sim, op.id).armies.map((a) => a.id);
    // the free army (and any detachment it made) serves; the others do not
    expect(members()).toContain(free.id);
    expect(members()).not.toContain(kept.id);
    expect(members()).not.toContain(other.id);
    expect(sim.state.armies[kept.id].op ?? null).toBeNull();
    expect(sim.state.armies[other.id].op).not.toBe(op.id);
    // the player takes the mandate's armies out: they are kept for direct command from then on
    const out = members();
    applyCommand(sim, { type: 'releaseOp', nation: 'a', units: out });
    expect(out.every((id) => sim.state.armies[id].reserved)).toBe(true);
    weeks(sim, 2);
    expect(members()).toEqual([]);
    // allowed again: it joins at the next planning
    applyCommand(sim, { type: 'reserveUnits', nation: 'a', units: [free.id], reserved: false });
    weeks(sim, 1);
    expect(members()).toContain(free.id);
  });

  it('new forces join as they appear (auto-assignment policy)', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = auto(sim, ['b']);
    const late = addArmy(sim, 'a', 'g01', { infantry: 3 });
    weeks(sim, 1);
    expect(sim.state.armies[late.id].op).toBe(op.id);
    // with the policy off, a new army stays under direct command
    applyCommand(sim, { type: 'editOp', nation: 'a', op: op.id, settings: { autoAssign: false } });
    const later = addArmy(sim, 'a', 'g01', { infantry: 3 });
    weeks(sim, 1);
    expect(sim.state.armies[later.id].op ?? null).toBeNull();
  });

  it('defends our land against a realm outside the mandate, but never attacks that realm', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    declareWar(sim, 'c', 'a', { type: 'conquest', provinces: ['g13'] });
    const army = addArmy(sim, 'a', 'g11', { infantry: 10 });
    const op = auto(sim, ['b']);
    // c's raid into our land: defended first
    addArmy(sim, 'c', 'g13', { infantry: 2 });
    weeks(sim, 1);
    expect(op.tasks[army.id].kind).toBe('defend');
    expect(op.tasks[army.id].target).toBe('g13');
    // c's own land is never a target
    weeks(sim, 20);
    const cLand = sim.world.provIds.filter((p) => sim.state.provinces[p].owner === 'c');
    expect(cLand.every((p) => sim.state.provinces[p].controller === 'c')).toBe(true);
    for (const t of Object.values(op.tasks)) if (t.target && sim.state.provinces[t.target]) expect(sim.state.provinces[t.target].owner).not.toBe('c');
  });

  it('peace with the enemy completes the mandate; it does not make peace or add an enemy', () => {
    const sim = gridGame();
    const war = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    addArmy(sim, 'a', 'g10', { infantry: 6 });
    const op = auto(sim, ['b']);
    weeks(sim, 3);
    expect(op.status).toBe('active');
    expect(Object.keys(sim.state.wars)).toHaveLength(1);
    endWar(sim, war.id, 'white');
    weeks(sim, 1);
    expect(op.status).toBe('complete');
    expect(op.enemies).toEqual([]);
    expect(op.log.some((l) => /No longer at war with/.test(l.text))).toBe(true);
    expect(Object.keys(sim.state.wars)).toHaveLength(0);
  });

  it('concentrating on one enemy changes what it goes for first', () => {
    const pick = (focus: string | null) => {
      const sim = gridGame();
      declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
      declareWar(sim, 'a', 'c', { type: 'conquest', provinces: ['g60'] });
      // our army stands in b's land next to c's (supply set aside: the choice is the priority's)
      sim.state.provinces.g40.controller = 'a';
      const army = addArmy(sim, 'a', 'g40', { infantry: 8 });
      const op = auto(sim, ['b', 'c'], { supplyLimit: false, reorganize: false, ...(focus ? { strategy: 'focus', focus } : {}) });
      weeks(sim, 1);
      return { sim, t: op.tasks[army.id] };
    };
    const toC = pick('c');
    expect(toC.sim.state.provinces[toC.t.target!].owner).toBe('c');
    const toB = pick('b');
    expect(toB.sim.state.provinces[toB.t.target!].owner).toBe('b');
  });

  it('an active mandate survives a save and plays on identically', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    addArmy(sim, 'a', 'g10', { infantry: 6 });
    addArmy(sim, 'a', 'g12', { infantry: 4 });
    auto(sim, ['b']);
    weeks(sim, 4);
    const back = readSave(serialize(sim)).sim;
    expect(checkInvariants(back)).toEqual([]);
    weeks(sim, 6);
    weeks(back, 6);
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(sim.state));
  });
});

describe('Auto-conquer across the sea', () => {
  it('enemy land overseas: a landing is organised under the ordinary rules, and its forces come back when it is done', async () => {
    const { createGame } = await import('../src/sim/game');
    const { createFleet, newShip, touchFleets } = await import('../src/sim/naval');
    const sim = createGame({ scenario: 'test-longsea', seed: 3, playerNation: 'a' });
    sim.state.armies = {};
    sim.state.fleets = {};
    for (const n of Object.values(sim.state.nations)) {
      n.treasury = 5000;
      n.materiel = 3000;
    }
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['q5'] });
    const army = addArmy(sim, 'a', 'p0', { infantry: 6 });
    const lift = createFleet(sim, 'a', 'z0', ['transport', 'transport', 'transport', 'cruiser'].map((t) => newShip(sim, t as never)), 'p0');
    touchFleets(sim);
    const op = auto(sim, ['b']);
    weeks(sim, 1);
    const sub = Object.values(sim.state.operations).find((o) => o.parent === op.id);
    expect(sub?.kind).toBe('landing');
    expect(sub?.area[0]).toBe('q5');
    expect(sim.state.armies[army.id].op).toBe(sub!.id);
    expect(sim.state.fleets[lift.id].op).toBe(sub!.id);
    expect(op.log.some((l) => /lies overseas: a landing at Q5 is organised/.test(l.text))).toBe(true);
    for (let w = 0; w < 30 && sim.state.provinces.q5.controller !== 'a'; w++) weeks(sim, 1);
    expect(sim.state.provinces.q5.controller).toBe('a');
    weeks(sim, 2);
    // done: the landing is gone and its forces serve the mandate again
    expect(Object.values(sim.state.operations).some((o) => o.parent === op.id)).toBe(false);
    expect(sim.state.armies[army.id]?.op).toBe(op.id);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('no transports: the mandate says what is missing instead of pretending', async () => {
    const { createGame } = await import('../src/sim/game');
    const sim = createGame({ scenario: 'test-longsea', seed: 3, playerNation: 'a' });
    sim.state.armies = {};
    sim.state.fleets = {};
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['q5'] });
    addArmy(sim, 'a', 'p0', { infantry: 6 });
    const op = auto(sim, ['b']);
    weeks(sim, 1);
    expect(Object.values(sim.state.operations).some((o) => o.parent === op.id)).toBe(false);
    expect(op.issue?.text).toMatch(/Q5 lie overseas: Auto-conquer needs a fleet with transports/);
  });
});
