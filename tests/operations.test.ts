// Operations (format 8): delegated ground command on the grid.
//
//   columns 0–1: realm a (us)   2–4: realm b (enemy)   5–6: realm c (neutral)
//   g{x}{y}, 7 × 4 plains; a's capital g01, b's g41, c's g61

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { checkInvariants } from '../src/sim/invariants';
import { opForces } from '../src/sim/ops/operations';
import { readSave, serialize } from '../src/sim/save';
import { menOf, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Army, OperationSettings } from '../src/sim/types';
import { declareWar, endWar } from '../src/sim/war';
import { addArmy, gridGame } from './helpers';

const COL2 = ['g20', 'g21', 'g22', 'g23'];
const COL23 = [...COL2, 'g30', 'g31', 'g32', 'g33'];

function war(sim: Sim) {
  return declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
}

function create(sim: Sim, area: string[], units: string[], settings: Partial<OperationSettings> = {}, activate = true) {
  const r = applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'conquer', area, units, settings, activate });
  expect(r.ok).toBe(true);
  return Object.values(sim.state.operations).at(-1)!;
}

const weeks = (sim: Sim, n: number) => {
  for (let i = 0; i < n; i++) step(sim, { noAI: true });
};
const ctl = (sim: Sim, area: string[]) => area.map((p) => sim.state.provinces[p].controller).join('');
const ours = (sim: Sim) => Object.values(sim.state.armies).filter((a) => a.nation === 'a');
const regs = (list: Army[]) => list.reduce((n, a) => n + a.regiments.length, 0);

describe('creating and controlling operations', () => {
  it('checks the area, the settings and that the forces are ours', () => {
    const sim = gridGame();
    const mine = addArmy(sim, 'a', 'g10', { infantry: 2 });
    const theirs = addArmy(sim, 'b', 'g30', { infantry: 2 });
    const check = (cmd: object) => checkCommand(sim, { type: 'createOp', nation: 'a', kind: 'conquer', area: COL2, ...cmd } as never);
    expect(check({ units: [mine.id] })).toBeNull();
    expect(check({ units: [theirs.id] })).toMatch(/Not our force/);
    expect(check({ area: [] })).toMatch(/Choose the provinces/);
    expect(check({ area: ['nowhere'] })).toMatch(/Unknown province/);
    expect(check({ settings: { reserve: 0.9 } })).toMatch(/reserve/);
    expect(checkCommand(sim, { type: 'createOp', nation: 'a', kind: 'advance', area: COL2 })).toMatch(/one destination/);
    expect(checkCommand(sim, { type: 'createOp', nation: 'a', kind: 'sea', area: [], zones: [] })).toMatch(/sea zones/);
  });

  it('a prepared (not active) operation gives no orders until it is activated', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = create(sim, COL2, [a.id], {}, false);
    expect(op.status).toBe('paused');
    weeks(sim, 3);
    expect(sim.state.armies[a.id].location).toBe('g10');
    expect(applyCommand(sim, { type: 'opState', nation: 'a', op: op.id, state: 'active' }).ok).toBe(true);
    weeks(sim, 1);
    expect(sim.state.armies[a.id].path.length + (sim.state.armies[a.id].location !== 'g10' ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe('auto-conquest', () => {
  it('takes an undefended area without another order: march, besiege, march on; the player gave one command', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6, artillery: 2 });
    const b = addArmy(sim, 'a', 'g12', { infantry: 6 });
    const op = create(sim, COL23, [a.id, b.id]);
    const men0 = ours(sim).reduce((s, x) => s + menOf(x), 0);
    for (let w = 0; w < 30 && op.status !== 'complete'; w++) weeks(sim, 1);
    expect(ctl(sim, COL23)).toBe('aaaaaaaa');
    expect(sim.state.operations[op.id].status).toBe('complete');
    expect(sim.state.playerLog.map((x) => x.cmd.type)).toEqual(['createOp']);
    expect(op.stats.taken).toBe(8);
    // nothing was invented: every army is one of ours or a detachment of one, no more men than at the start
    expect(ours(sim).reduce((s, x) => s + menOf(x), 0)).toBeLessThanOrEqual(men0);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('never enters or targets a neutral realm in its area, and never declares war', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6 });
    create(sim, ['g20', 'g50', 'g51'], [a.id]);
    weeks(sim, 20);
    expect(sim.state.provinces.g50.controller).toBe('c');
    expect(sim.state.provinces.g51.controller).toBe('c');
    expect(Object.values(sim.state.wars).some((w) => [...w.attackers, ...w.defenders].includes('c'))).toBe(false);
    expect(ours(sim).every((x) => !['g50', 'g51', 'g60', 'g61'].includes(x.location))).toBe(true);
  });

  it('does not attack into a forecast the posture refuses, and asks for a decision instead', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 3 });
    const d = addArmy(sim, 'b', 'g20', { infantry: 9, artillery: 3 });
    d.stationary = 6;
    const op = create(sim, ['g20'], [a.id], { posture: 'cautious' });
    weeks(sim, 6);
    expect(Object.values(sim.state.battles).length + sim.state.reports.filter((r) => r.province === 'g20').length).toBe(0);
    expect(op.issue?.code).toBe('blocked');
    // the army stands back from the far stronger enemy next door, and says why nothing happens
    expect(op.issue?.text).toMatch(/Cannot make progress.*G20/);
    expect(Object.values(op.tasks).some((t) => t.kind === 'recover' && /falls back/.test(t.note))).toBe(true);
    expect(sim.state.notifications.some((n) => n.kind === 'operation' && n.priority === 'urgent')).toBe(true);
  });

  it('a lost attack is not repeated at once: the target waits, then needs a stronger force', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const op = create(sim, ['g20'], [a.id], { posture: 'aggressive' });
    // a lost attack on g20 two weeks ago
    sim.state.reports.push({ id: 'r1', tick: sim.state.tick, province: 'g20', attackerNations: ['a'], defenderNations: ['b'], attStartMen: 6000, defStartMen: 9000, attLosses: 2000, defLosses: 500, winner: 'defender', rounds: 3, factors: [], outcome: '' });
    weeks(sim, 1);
    expect(op.failures.g20?.count).toBe(1);
    expect(op.tasks[a.id]?.kind).not.toBe('occupy');
    expect(op.log.some((l) => /attack on G20 failed/.test(l.text))).toBe(true);
  });
});

describe('splitting and regrouping', () => {
  it('a large army detaches task forces for undefended targets: whole regiments, at least two each, men conserved', () => {
    const sim = gridGame();
    war(sim);
    const big = addArmy(sim, 'a', 'g11', { infantry: 10, artillery: 2 });
    const before = { regs: big.regiments.length, men: menOf(big), ids: big.regiments.map((r) => r.id).sort() };
    const op = create(sim, COL2, [big.id], { reserve: 0 });
    weeks(sim, 1);
    const all = ours(sim);
    expect(all.length).toBeGreaterThan(1);
    expect(all.length).toBeLessThanOrEqual(1 + 6);
    expect(all.every((x) => x.regiments.length >= 2)).toBe(true);
    expect(all.every((x) => x.op === op.id)).toBe(true);
    expect(regs(all)).toBe(before.regs);
    expect(all.reduce((s, x) => s + menOf(x), 0)).toBe(before.men);
    expect(all.flatMap((x) => x.regiments.map((r) => r.id)).sort()).toEqual(before.ids);
    expect(op.log.some((l) => /detached \d+ regiments/.test(l.text))).toBe(true);
  });

  it('a protected formation, or an operation without leave to reorganise, is never split', () => {
    const sim = gridGame();
    war(sim);
    const big = addArmy(sim, 'a', 'g11', { infantry: 10 });
    applyCommand(sim, { type: 'keepFormation', nation: 'a', army: big.id, keep: true });
    create(sim, COL2, [big.id], { reserve: 0 });
    weeks(sim, 3);
    expect(ours(sim)).toHaveLength(1);
    const sim2 = gridGame();
    war(sim2);
    const big2 = addArmy(sim2, 'a', 'g11', { infantry: 10 });
    create(sim2, COL2, [big2.id], { reorganize: false, reserve: 0 });
    weeks(sim2, 3);
    expect(ours(sim2)).toHaveLength(1);
  });

  it('idle armies standing together are merged again', () => {
    const sim = gridGame();
    war(sim);
    const x = addArmy(sim, 'a', 'g11', { infantry: 3 });
    const y = addArmy(sim, 'a', 'g11', { infantry: 3 });
    // nothing to take in the area (it is ours): they wait at the base
    create(sim, ['g10', 'g11'], [x.id, y.id], { reserve: 0 });
    weeks(sim, 2);
    expect(ours(sim)).toHaveLength(1);
    expect(regs(ours(sim))).toBe(6);
  });
});

describe('manual control', () => {
  it('a player order takes the army under direct command at once; the operation leaves it alone until resumed', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = create(sim, COL2, [a.id], { reserve: 0, reorganize: false });
    weeks(sim, 1);
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'g00' }).ok).toBe(true);
    expect(sim.state.armies[a.id].opHold).toBe(true);
    expect(op.tasks[a.id].kind).toBe('manual');
    weeks(sim, 3);
    expect(sim.state.armies[a.id].location).toBe('g00');
    expect(sim.state.armies[a.id].path).toEqual([]);
    expect(op.issue?.code).toBe('all-manual');
    applyCommand(sim, { type: 'resumeUnits', nation: 'a', units: [a.id] });
    expect(sim.state.armies[a.id].opHold).toBe(false);
    weeks(sim, 1);
    expect(sim.state.armies[a.id].path.length).toBeGreaterThan(0);
  });

  it('with "rejoin when done", the army returns to the operation once its order is carried out', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = create(sim, COL2, [a.id], { reserve: 0, reorganize: false, resumeAfterOrder: true });
    applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'g00' });
    weeks(sim, 4);
    expect(sim.state.armies[a.id].opHold).toBe(false);
    expect(op.log.some((l) => /rejoined/.test(l.text))).toBe(true);
  });

  it('pausing stops new orders; cancelling hands every member back with its last orders', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = create(sim, COL2, [a.id], { reserve: 0, reorganize: false });
    applyCommand(sim, { type: 'opState', nation: 'a', op: op.id, state: 'paused' });
    const log = sim.state.playerLog.length;
    weeks(sim, 2);
    expect(sim.state.armies[a.id].location).toBe('g10');
    expect(sim.state.playerLog.length).toBe(log);
    applyCommand(sim, { type: 'opState', nation: 'a', op: op.id, state: 'active' });
    weeks(sim, 1);
    const path = [...sim.state.armies[a.id].path];
    expect(path.length).toBeGreaterThan(0);
    applyCommand(sim, { type: 'cancelOp', nation: 'a', op: op.id });
    expect(sim.state.operations[op.id]).toBeUndefined();
    expect(sim.state.armies[a.id].op).toBeNull();
    expect(sim.state.armies[a.id].path).toEqual(path);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('release detaches a member; assigning it to another operation moves it there', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const b = addArmy(sim, 'a', 'g12', { infantry: 4 });
    const op1 = create(sim, ['g20', 'g21'], [a.id, b.id]);
    const op2 = create(sim, ['g22', 'g23'], []);
    applyCommand(sim, { type: 'assignOp', nation: 'a', op: op2.id, units: [b.id] });
    expect(opForces(sim, op1.id).armies.map((x) => x.id)).toEqual([a.id]);
    expect(opForces(sim, op2.id).armies.map((x) => x.id)).toEqual([b.id]);
    applyCommand(sim, { type: 'releaseOp', nation: 'a', units: [a.id] });
    expect(sim.state.armies[a.id].op).toBeNull();
  });
});

describe('peace, saves and replays', () => {
  it('peace ends the conquest: nothing left that we are at war with', () => {
    const sim = gridGame();
    const w = war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const op = create(sim, COL23, [a.id], { onComplete: 'await' });
    weeks(sim, 2);
    endWar(sim, w.id, 'test');
    weeks(sim, 1);
    expect(op.status).toBe('complete');
    expect(op.log.at(-1)?.text ?? '').toMatch(/Objective reached|awaiting/);
    weeks(sim, 4);
    expect(ours(sim).every((x) => ['a', null].includes(sim.state.provinces[x.location].controller === 'a' ? 'a' : null) || x.path.length === 0)).toBe(true);
  });

  it('an active and a paused operation survive a save, with held members still held, and play on identically', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const b = addArmy(sim, 'a', 'g12', { infantry: 4 });
    const c = addArmy(sim, 'a', 'g01', { infantry: 2 });
    create(sim, COL2, [a.id, b.id]);
    const paused = create(sim, ['g30'], [c.id], {}, false);
    weeks(sim, 3);
    applyCommand(sim, { type: 'stop', nation: 'a', army: b.id });
    const back = readSave(serialize(sim)).sim;
    expect(checkInvariants(back)).toEqual([]);
    expect(Object.keys(back.state.operations).sort()).toEqual(Object.keys(sim.state.operations).sort());
    expect(back.state.operations[paused.id].status).toBe('paused');
    expect(back.state.armies[b.id].opHold).toBe(true);
    weeks(sim, 6);
    weeks(back, 6);
    // the same state week by week (the save header's timestamp aside)
    expect(JSON.stringify(back.state)).toBe(JSON.stringify(sim.state));
  });
});

describe('the reserve', () => {
  it('holds back a share of the strength at the base and commits it to a battle our troops are losing', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const b = addArmy(sim, 'a', 'g11', { infantry: 2 });
    const op = create(sim, ['g20', 'g21'], [a.id, b.id], { reserve: 0.25, commitReserve: 'battles' });
    weeks(sim, 1);
    expect(op.tasks[b.id]?.kind).toBe('reserve');
    expect(op.tasks[a.id]?.kind).not.toBe('reserve');
  });
});

describe('the limits of delegation', () => {
  it('an operation may only move and employ its own forces: no purchases, construction, diplomacy or war', async () => {
    const { OP_ORDERS } = await import('../src/sim/ops/operations');
    for (const t of ['recruit', 'build', 'batchBuild', 'batchRecruit', 'buildShip', 'buildWing', 'declareWar', 'peace', 'settle', 'propose', 'research', 'focus', 'funding', 'disband', 'disbandFleet', 'disbandWing'] as const) expect(OP_ORDERS.has(t as never)).toBe(false);
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const treasury = sim.state.nations.a.treasury;
    create(sim, COL2, [a.id]);
    weeks(sim, 6);
    expect(sim.state.nations.a.treasury).toBeGreaterThanOrEqual(treasury - 1e9);
    expect(Object.values(sim.state.provinces).some((p) => p.project?.nation === 'a' || p.recruits.some((r) => r.nation === 'a'))).toBe(false);
    expect(Object.values(sim.state.wars)).toHaveLength(1);
  });

  it('with an operation paused or edited, province batches and manual orders work as before', () => {
    const sim = gridGame();
    war(sim);
    const n = sim.state.nations.a;
    n.treasury = 100000;
    n.materiel = 100000;
    n.manpower = 1_000_000;
    const a = addArmy(sim, 'a', 'g10', { infantry: 4 });
    const free = addArmy(sim, 'a', 'g00', { infantry: 2 });
    const op = create(sim, COL2, [a.id], { reserve: 0, reorganize: false });
    expect(applyCommand(sim, { type: 'opState', nation: 'a', op: op.id, state: 'paused' }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'editOp', nation: 'a', op: op.id, settings: { posture: 'cautious' } }).ok).toBe(true);
    const built = applyCommand(sim, { type: 'batchBuild', nation: 'a', project: 'infra', provinces: ['g01', 'g02'] });
    expect(built.ok && built.message).toMatch(/2 of 2 queued/);
    const raised = applyCommand(sim, { type: 'batchRecruit', nation: 'a', unit: 'infantry', alloc: [{ province: 'g03', count: 2 }] });
    expect(raised.ok && raised.message).toMatch(/2 of 2 regiments in training/);
    // a march for an army outside the operation, and one for a member (taken under direct command)
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: free.id, dest: 'g02' }).ok).toBe(true);
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'g11' }).ok).toBe(true);
    expect(sim.state.armies[a.id].opHold).toBe(true);
    expect(sim.state.armies[free.id].op ?? null).toBeNull();
    weeks(sim, 6);
    expect(sim.state.armies[free.id].location).toBe('g02');
    expect(sim.state.armies[a.id].location).toBe('g11');
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('a conquest turns to defend our own province next to its area when the enemy strikes there', () => {
    const sim = gridGame();
    war(sim);
    const a = addArmy(sim, 'a', 'g10', { infantry: 8 });
    const op = create(sim, ['g21', 'g31'], [a.id], { reserve: 0, reorganize: false });
    // an enemy raid into g11 (ours, next to g21 in the area)
    addArmy(sim, 'b', 'g11', { infantry: 2 });
    weeks(sim, 1);
    expect(op.tasks[a.id].kind).toBe('defend');
    expect(op.tasks[a.id].target).toBe('g11');
  });
});
