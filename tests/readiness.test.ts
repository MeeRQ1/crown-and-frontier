// Army explanations: order status with reasons, and readiness trade-offs.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { orderStatus, readiness } from '../src/sim/readiness';
import { bump } from '../src/sim/state';
import { declareWar } from '../src/sim/war';
import { addArmy, lineGame } from './helpers';

describe('order status', () => {
  it('says an army is marching, with its arrival', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a1', { infantry: 2 });
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: a.id, dest: 'a3' }).ok).toBe(true);
    const s = orderStatus(sim, a);
    expect(s.state).toBe('moving');
    expect(s.text).toMatch(/Marching to A3/);
    expect(s.eta).toBeGreaterThan(0);
  });

  it('says why an army ordered to march does not move: an enemy in its province pins it', () => {
    const sim = lineGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    const a = addArmy(sim, 'a', 'a3', { infantry: 2 });
    a.path = ['a2'];
    addArmy(sim, 'b', 'a3', { infantry: 1 });
    bump(sim);
    const s = orderStatus(sim, a);
    expect(s.state).toBe('pinned');
    expect(s.reasons.join(' ')).toMatch(/cannot march out of a province that holds a hostile army/);
  });

  it('says a route is blocked when access is lost', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a3', { infantry: 2 });
    a.path = ['b3']; // b's land without access
    const s = orderStatus(sim, a);
    expect(s.state).toBe('blocked');
    expect(s.reasons[0]).toMatch(/No access to B3/);
  });
});

describe('readiness', () => {
  it('explains frontage, unscreened guns and terrain for cavalry', () => {
    const sim = lineGame();
    const a = addArmy(sim, 'a', 'a3', { infantry: 1, artillery: 3 }); // a3: hills
    const notes = readiness(sim, a).map((n) => n.text).join(' | ');
    expect(notes).toMatch(/Hills: frontage/);
    expect(notes).toMatch(/unscreened fire at half strength/);
    const c = addArmy(sim, 'a', 'a2', { cavalry: 3, infantry: 2 }); // a2: plains
    expect(readiness(sim, c).some((n) => n.tone === 'good' && /flank/.test(n.text))).toBe(true);
  });
});
