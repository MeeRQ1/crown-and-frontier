// Province batches (format 8): one project or regiment type in many provinces,
// previewed with a running budget (shared pools spent once), confirmed as a
// single command, and checked again province by province when carried out.
//
//   grid: columns 0–1 realm a (8 provinces), 2–4 realm b, 5–6 realm c

import { describe, expect, it } from 'vitest';
import { previewBatchBuild, previewBatchRecruit } from '../src/sim/batch';
import { applyCommand } from '../src/sim/commands';
import { C, UNITS } from '../src/sim/config';
import { buildSlots, projectCost } from '../src/sim/construction';
import { unitCost } from '../src/sim/military';
import type { Sim } from '../src/sim/state';
import { gridGame } from './helpers';

const OURS = ['g00', 'g01', 'g02', 'g03', 'g10', 'g11', 'g12', 'g13'];

function rich(sim: Sim) {
  const n = sim.state.nations.a;
  n.treasury = 100000;
  n.materiel = 100000;
  n.manpower = 1_000_000;
  n.supplies = 10000;
  n.stock.iron = 10000;
  return n;
}

describe('batch construction', () => {
  it('previews each province: what it gets, or why not; other realms’ provinces are skipped', () => {
    const sim = gridGame();
    rich(sim);
    sim.state.provinces.g00.infra = C.construction.infraMax;
    const pv = previewBatchBuild(sim, 'a', 'infra', ['g00', 'g01', 'g20']);
    const by = Object.fromEntries(pv.rows.map((r) => [r.pid, r]));
    expect(by.g00.ok).toBe(false);
    expect(by.g00.reason).toMatch(/maximum level/);
    expect(by.g20.ok).toBe(false);
    expect(by.g20.reason).toMatch(/Not our province/);
    expect(by.g01.ok).toBe(true);
    expect(by.g01.change).toMatch(/railway 0 → 1/);
    expect(pv.queued).toEqual(['g01']);
  });

  it('spends the shared pools once: slots and crowns run out in the disclosed order, the rest are listed as skipped', () => {
    const sim = gridGame();
    const n = rich(sim);
    const slots = buildSlots(sim, 'a');
    const pv = previewBatchBuild(sim, 'a', 'infra', OURS);
    expect(pv.queued).toHaveLength(Math.min(slots, OURS.length));
    expect(pv.rows.filter((r) => !r.ok).every((r) => /no construction slot left/.test(r.reason!))).toBe(true);
    // money for only one: the first in the order given is queued, the next is skipped for want of crowns
    const each = projectCost(sim, 'a', 'g01', 'infra').crowns;
    n.treasury = each + 1;
    const tight = previewBatchBuild(sim, 'a', 'infra', ['g03', 'g01', 'g02']);
    expect(tight.queued).toEqual(['g03']);
    expect(tight.rows.find((r) => r.pid === 'g01')!.reason).toMatch(/needs \d+ crowns, \d+ left after the provinces above/);
    expect(tight.total.crowns).toBe(each);
  });

  it('orders by development or by cost when asked', () => {
    const sim = gridGame();
    rich(sim);
    sim.state.provinces.g12.dev = 7;
    const byDev = previewBatchBuild(sim, 'a', 'dev', ['g01', 'g12', 'g02'], 'development');
    expect(byDev.rows[0].pid).toBe('g12');
    const cheap = previewBatchBuild(sim, 'a', 'dev', ['g12', 'g01'], 'cheapest');
    expect(cheap.rows[0].pid).toBe('g01');
  });

  it('confirming queues exactly the previewed provinces; a repeat queues nothing twice; a change in between is caught', () => {
    const sim = gridGame();
    const n = rich(sim);
    const slots = buildSlots(sim, 'a');
    const pv = previewBatchBuild(sim, 'a', 'infra', ['g01', 'g02', 'g03']);
    expect(pv.queued).toHaveLength(Math.min(3, slots));
    const r = applyCommand(sim, { type: 'batchBuild', nation: 'a', project: 'infra', provinces: pv.queued });
    expect(r.ok && r.message).toMatch(new RegExp(`${pv.queued.length} of ${pv.queued.length} queued`));
    const again = applyCommand(sim, { type: 'batchBuild', nation: 'a', project: 'infra', provinces: pv.queued });
    expect(again.ok && again.message).toMatch(new RegExp(`0 of ${pv.queued.length} queued`));
    expect(again.ok && again.details!.every((d) => /already under way/.test(d))).toBe(true);
    // the treasury empties between the preview and the confirmation: nothing is overspent
    for (const p of pv.queued) applyCommand(sim, { type: 'cancelBuild', nation: 'a', province: p });
    const pv2 = previewBatchBuild(sim, 'a', 'fort', ['g10', 'g11']);
    expect(pv2.queued.length).toBeGreaterThan(0);
    n.treasury = 0;
    const r2 = applyCommand(sim, { type: 'batchBuild', nation: 'a', project: 'fort', provinces: pv2.queued });
    expect(r2.ok && r2.message).toMatch(/0 of/);
    expect(n.treasury).toBe(0);
  });
});

describe('batch recruitment', () => {
  it('per province: the number in each eligible province, the shared pools spent once', () => {
    const sim = gridGame();
    const n = rich(sim);
    const c = unitCost(sim, 'a', 'infantry');
    // men for exactly five regiments
    n.manpower = c.manpower * 5;
    const pv = previewBatchRecruit(sim, 'a', 'infantry', ['g00', 'g01', 'g02', 'g20'], 2, 'per');
    expect(pv.asked).toBe(6);
    expect(pv.queued).toBe(5);
    expect(pv.limit).toMatch(/men/);
    expect(pv.alloc).toEqual([
      { province: 'g00', count: 2 },
      { province: 'g01', count: 2 },
      { province: 'g02', count: 1 },
    ]);
    expect(pv.rows.find((r) => r.pid === 'g20')!.reason).toMatch(/own provinces/);
    expect(pv.cost.men).toBe(c.manpower * 5);
    expect(pv.upkeep).toBeCloseTo(UNITS.infantry.upkeep * 5, 6);
  });

  it('a total is spread over the provinces one at a time, in order', () => {
    const sim = gridGame();
    rich(sim);
    const pv = previewBatchRecruit(sim, 'a', 'infantry', ['g00', 'g01', 'g02'], 5, 'total');
    expect(pv.alloc).toEqual([
      { province: 'g00', count: 2 },
      { province: 'g01', count: 2 },
      { province: 'g02', count: 1 },
    ]);
  });

  it('confirming raises the previewed allocation once; what is already training is shown, and checked again', () => {
    const sim = gridGame();
    const n = rich(sim);
    const pv = previewBatchRecruit(sim, 'a', 'infantry', ['g00', 'g01'], 3, 'per');
    const r = applyCommand(sim, { type: 'batchRecruit', nation: 'a', unit: 'infantry', alloc: pv.alloc });
    expect(r.ok && r.message).toMatch(/6 of 6 regiments in training/);
    expect(sim.state.provinces.g00.recruits.filter((x) => x.nation === 'a')).toHaveLength(3);
    const next = previewBatchRecruit(sim, 'a', 'infantry', ['g00'], 1, 'per');
    expect(next.rows[0].inQueue).toBe(3);
    // the money is gone before the next confirmation: the command stops where it must
    n.treasury = unitCost(sim, 'a', 'infantry').crowns;
    const r2 = applyCommand(sim, { type: 'batchRecruit', nation: 'a', unit: 'infantry', alloc: [{ province: 'g00', count: 3 }] });
    expect(r2.ok && r2.message).toMatch(/1 of 3 regiments/);
    expect(n.treasury).toBeGreaterThanOrEqual(0);
  });
});
