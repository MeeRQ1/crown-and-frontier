// The browser runs a long week in slices across animation frames and reads the
// state between them (the map, the panels, a treaty's "Why?"). The week must come
// out exactly as an uninterrupted step(), or replays and AI batches would not
// describe what a player saw.

import { describe, expect, it } from 'vitest';
import { rivalLeader } from '../src/sim/ai/strategic';
import { evaluateTreaty } from '../src/sim/diplomacy';
import { computeLedger } from '../src/sim/economy';
import { createGame } from '../src/sim/game';
import { sphereOf } from '../src/sim/influence';
import { aliveNations } from '../src/sim/state';
import { armySupplyInfo, supplyDistances } from '../src/sim/supply';
import { step, weekSlices } from '../src/sim/tick';

describe('a week run in slices', () => {
  it('ends exactly as step() does, with the interface reading the state between slices', () => {
    const plain = createGame({ scenario: 'reach', seed: 6, playerNation: null });
    const sliced = createGame({ scenario: 'reach', seed: 6, playerNation: null });
    let slices = 0;
    for (let w = 0; w < 96; w++) {
      step(plain);
      const week = weekSlices(sliced);
      while (!week.next().done) {
        slices++;
        // what the map, the ledgers and the diplomacy screen look up while a week is open
        const realms = aliveNations(sliced);
        for (const nid of realms) {
          supplyDistances(sliced, nid);
          computeLedger(sliced, nid);
          rivalLeader(sliced, nid);
          sphereOf(sliced, nid);
          for (const other of realms.slice(0, 4)) if (other !== nid) evaluateTreaty(sliced, nid, other, 'trade');
        }
        for (const a of Object.values(sliced.state.armies)) armySupplyInfo(sliced, a);
      }
    }
    expect(slices).toBeGreaterThan(96 * 10);
    expect(JSON.stringify(sliced.state)).toBe(JSON.stringify(plain.state));
  });
});
