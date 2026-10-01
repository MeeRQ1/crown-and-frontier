// Stage C check: equal-cost compositions through the real combat code. No army
// composition wins every pairing on every terrain (at either technology level),
// no fleet wins every pairing, and every fleet type has something it beats.

import { describe, expect, it } from 'vitest';
import { combatMatrix } from '../tools/matrix';

describe('combat matrix', () => {
  const m = combatMatrix();

  it('has no dominant land composition at either technology level', () => {
    expect(m.land.map((x) => x.level)).toEqual(['early', 'full']);
    for (const level of m.land) {
      expect(level.dominant).toEqual([]);
      for (const n of level.names) expect(level.wins[n].wins).toBeLessThan(level.wins[n].bouts);
    }
    expect(m.dominantLand).toEqual([]);
  });

  it('has no dominant fleet, and every fleet type wins somewhere', () => {
    expect(m.dominantSea).toEqual([]);
    for (const [name, v] of Object.entries(m.sea)) {
      expect(v.wins, name).toBeGreaterThan(0);
      expect(v.wins, name).toBeLessThan(v.bouts);
    }
  });
});
