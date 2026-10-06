// Atlas update: armies with no objective march to the war (stagingFor), and the
// victory timer outlook states what next month does by monthlyVictory's rule.

import { describe, expect, it } from 'vitest';
import { reachFrom } from '../src/sim/ai/common';
import { stagingFor, type Objective } from '../src/sim/ai/operational';
import { C } from '../src/sim/config';
import { monthlyVictory, timerOutlook, victoryProgress, type PathProgress } from '../src/sim/victory';
import { declareWar } from '../src/sim/war';
import { lineGame } from './helpers';

const attack = (pid: string): Objective => ({ pid, kind: 'attack', value: 5, need: 1, hostile: [] });

describe('armies with no objective march to the war', () => {
  it('stops at the last friendly province before enemy land on the way to the nearest objective', () => {
    const sim = lineGame();
    declareWar(sim, 'c', 'a', { type: 'conquest', provinces: ['a3'] });
    // from c1 the only way into A's land without access through B is the strait c2 → a1
    const stage = stagingFor(sim, 'c', 'c1', reachFrom(sim, 'c', 'c1'), [attack('a3')]);
    expect(stage).toBe('c2');
  });

  it('gives no stage to an army already standing there, or with nothing to attack', () => {
    const sim = lineGame();
    declareWar(sim, 'c', 'a', { type: 'conquest', provinces: ['a3'] });
    expect(stagingFor(sim, 'c', 'c2', reachFrom(sim, 'c', 'c2'), [attack('a3')])).toBeNull();
    expect(stagingFor(sim, 'c', 'c1', reachFrom(sim, 'c', 'c1'), [])).toBeNull();
  });

  it('does not march beyond the advance range', () => {
    const sim = lineGame();
    declareWar(sim, 'c', 'a', { type: 'conquest', provinces: ['a3'] });
    const r = reachFrom(sim, 'c', 'c1');
    const far = { ...r, dist: { ...r.dist, a3: C.ai.advanceRange + 1 } };
    expect(stagingFor(sim, 'c', 'c1', far, [attack('a3')])).toBeNull();
  });
});

describe('victory timer outlook', () => {
  const path = (over: Partial<PathProgress>): PathProgress => ({ met: false, progress: 0.5, near: false, streak: 0, required: 24, lines: [], conditions: [], ...over });

  it('names every state the monthly rule can produce', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.victoryMissed = { territorial: 0, economic: 0, diplomatic: 0 };
    expect(timerOutlook(sim, 'a', 'territorial', path({ streak: 0 })).trend).toBe('idle');
    expect(timerOutlook(sim, 'a', 'territorial', path({ met: true, streak: 10 })).text).toMatch(/14 more months/);
    expect(timerOutlook(sim, 'a', 'territorial', path({ streak: 10 })).trend).toBe('paused');
    expect(timerOutlook(sim, 'a', 'territorial', path({ streak: 10, near: true })).trend).toBe('near');
    n.victoryMissed.territorial = 1;
    expect(timerOutlook(sim, 'a', 'territorial', path({ streak: 10 })).trend).toBe('falling');
    expect(timerOutlook(sim, 'a', 'territorial', path({ streak: 24 })).trend).toBe('won');
  });

  it('agrees with what the monthly settlement then does', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.victoryStreak.territorial = 20;
    n.victoryMissed = { territorial: 0, economic: 0, diplomatic: 0 };
    const p = victoryProgress(sim, 'a').territorial;
    expect(p.met).toBe(false);
    const first = timerOutlook(sim, 'a', 'territorial', p);
    monthlyVictory(sim);
    expect(first.trend).toBe(p.near ? 'near' : 'paused');
    expect(n.victoryStreak.territorial).toBe(20);
    const second = timerOutlook(sim, 'a', 'territorial', victoryProgress(sim, 'a').territorial);
    monthlyVictory(sim);
    if (second.trend === 'falling') expect(n.victoryStreak.territorial).toBe(20 - C.victory.streakDecay);
    else expect(n.victoryStreak.territorial).toBe(20);
  });

  it('lists each condition as a measure against its threshold', () => {
    const sim = lineGame();
    const vp = victoryProgress(sim, 'a');
    expect(vp.territorial.conditions.map((c) => c.label)).toEqual(['Regions dominated (own and control ≥75%)', 'Provinces held, of all on the map']);
    expect(vp.economic.conditions).toHaveLength(4);
    expect(vp.diplomatic.conditions[0].need).toMatch(/^\d+$/);
    for (const k of ['territorial', 'economic', 'diplomatic'] as const) expect(vp[k].met).toBe(vp[k].conditions.every((c) => c.ok));
  });
});

describe('nation distance from realm distance fields', () => {
  it('equals the smallest hop between any two provinces of the realms', async () => {
    const { createGame } = await import('../src/sim/game');
    const { nationDistance, ownedProvinces } = await import('../src/sim/state');
    const sim = createGame({ scenario: 'aldmere', seed: 3, playerNation: null });
    const ids = sim.world.nationIds;
    for (const a of ids)
      for (const b of ids) {
        let best = Infinity;
        for (const x of ownedProvinces(sim, a)) for (const y of ownedProvinces(sim, b)) best = Math.min(best, sim.world.hop(x, y) ?? Infinity);
        expect(nationDistance(sim, a, b)).toBe(best);
      }
  });
});
