// Occupation on a redrawn map: an undefended province takes the time its ground takes
// (2 weeks for the ground of an old province), and the work a week gives beyond the 100
// goes on with the besiegers to the next undefended province they invest, so a march of
// conquest over the same ground takes as long however finely it is drawn.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { bump } from '../src/sim/state';
import { CARRY_WEEKS, occupationGround, siegeInfo, weeklySieges } from '../src/sim/siege';
import { declareWar } from '../src/sim/war';
import { registerScenario } from '../src/sim/world';
import { addArmy, lineGame, lineScenario } from './helpers';

// the line scenario, drawn as a redrawn map: b3 and b1 hold 0.7 of an old province's ground, b2 1.44
registerScenario('test-line-redrawn', () => {
  const s = lineScenario();
  const widths: Record<string, number> = { b3: 0.84, b1: 0.84, b2: 1.2 };
  return { ...s, id: 'test-line-redrawn', provinces: s.provinces.map((p) => ({ ...p, width: widths[p.id] ?? 0.9 })) };
});

function redrawnGame() {
  const sim = createGame({ scenario: 'test-line-redrawn', seed: 42, playerNation: null });
  sim.state.armies = {};
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  return sim;
}

/** Moves an army as if it had marched there (siege phase only). */
function moveTo(sim: ReturnType<typeof redrawnGame>, id: string, pid: string): void {
  sim.state.armies[id].location = pid;
  bump(sim);
}

describe('occupation on a redrawn map', () => {
  it('an undefended province takes the time its ground takes', () => {
    const sim = redrawnGame();
    expect(occupationGround(sim, 'b3')).toBeCloseTo(0.7056, 6);
    addArmy(sim, 'a', 'b3', { infantry: 2 });
    const info = siegeInfo(sim, 'b3')!;
    expect(info.weeklyRate).toBeCloseTo(100 / (2 * 0.7056), 6);
    expect(info.notes.join(' ')).toMatch(/A smaller province than the old ones here \(71% of their ground\): 1\.4 weeks base/);
    // a larger one takes longer: 1.44 of the old ground, 2.9 weeks
    addArmy(sim, 'a', 'b2', { infantry: 2 });
    expect(siegeInfo(sim, 'b2')!.weeklyRate).toBeCloseTo(100 / (2 * 1.44), 6);
    expect(siegeInfo(sim, 'b2')!.notes.join(' ')).toMatch(/A larger province/);
    // forts take what they always took
    sim.state.provinces.b2.fort = 1;
    expect(siegeInfo(sim, 'b2')!.weeklyRate).toBeCloseTo(10, 6);
  });

  it('the work beyond the 100 goes on to the next undefended province, so two take the time of their ground', () => {
    const sim = redrawnGame();
    const army = addArmy(sim, 'a', 'b3', { infantry: 2 });
    const rate = 100 / (2 * 0.7056);
    weeklySieges(sim);
    expect(sim.state.provinces.b3.controller).toBe('b');
    weeklySieges(sim);
    expect(sim.state.provinces.b3.controller).toBe('a');
    expect(army.carry!.progress).toBeCloseTo(2 * rate - 100, 6);
    // it marches on (two weeks) and invests b1: the work in hand and a week's take it at once
    sim.state.tick += 2;
    moveTo(sim, army.id, 'b1');
    weeklySieges(sim);
    expect(sim.state.provinces.b1.controller).toBe('a');
    expect(army.carry!.progress).toBeCloseTo(3 * rate - 200, 6);
    // four weeks of 1.41 provinces' ground: about two weeks for each old province's worth
    expect(3 * 0.7056 * 2).toBeCloseTo(4.23, 2);
  });

  it('work in hand is spent once, lapses after a few weeks, and never counts against a fort', () => {
    const sim = redrawnGame();
    const army = addArmy(sim, 'a', 'b1', { infantry: 4 });
    army.carry = { progress: 60, tick: sim.state.tick };
    // too old
    sim.state.tick += CARRY_WEEKS + 1;
    weeklySieges(sim);
    expect(sim.state.provinces.b1.siege!.progress).toBeCloseTo(100 / (2 * 0.7056), 6);
    expect(army.carry).toBeNull();
    // a fort: the work is not spent there
    const other = addArmy(sim, 'a', 'b2', { infantry: 4 });
    other.carry = { progress: 60, tick: sim.state.tick };
    sim.state.provinces.b2.fort = 1;
    weeklySieges(sim);
    expect(sim.state.provinces.b2.siege!.progress).toBeCloseTo(10, 6);
    expect(other.carry!.progress).toBe(60);
  });

  it('a map never redrawn occupies in two weeks and carries nothing', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const army = addArmy(sim, 'a', 'b3', { infantry: 1 });
    expect(occupationGround(sim, 'b3')).toBe(1);
    expect(siegeInfo(sim, 'b3')!.weeklyRate).toBe(50);
    expect(siegeInfo(sim, 'b3')!.notes.join(' ')).not.toMatch(/province than the old ones/);
    weeklySieges(sim);
    weeklySieges(sim);
    expect(sim.state.provinces.b3.controller).toBe('a');
    expect(army.carry).toBeUndefined();
  });
});
