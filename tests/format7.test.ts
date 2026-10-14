// Save format 7 (military control and national scale): a format-6 campaign
// converts with nothing paid out or refilled, and the new state starts empty.

import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { fnv1a, readSave, serialize } from '../src/sim/save';
import { step } from '../src/sim/tick';

/** A format-6 save made from a running campaign: the format-7 fields taken out. */
function asFormat6(text: string): string {
  const obj = JSON.parse(text);
  const st = obj.state;
  for (const n of Object.values<any>(st.nations)) {
    delete n.reserveLost;
    delete n.ai.peace;
    delete n.ai.treatyAnswers;
    delete n.stats.airborneDrops;
  }
  for (const p of Object.values<any>(st.provinces)) delete p.aa;
  for (const f of Object.values<any>(st.fleets)) delete f.duty;
  for (const a of Object.values<any>(st.armies)) delete a.drop;
  for (const w of Object.values<any>(st.wings)) delete w.record;
  obj.schema = 6;
  st.schema = 6;
  obj.checksum = fnv1a(JSON.stringify(st));
  return JSON.stringify(obj);
}

describe('save format 7', () => {
  it('a format-6 campaign converts without windfalls: treasuries, pools, stocks and forces as they were', () => {
    const sim = createGame({ scenario: 'reach', seed: 4, playerNation: 'ser' });
    for (let i = 0; i < 30; i++) step(sim);
    const old = asFormat6(serialize(sim));
    const { sim: back, notices } = readSave(old);
    expect(notices.some((n) => /save format 6\) and was converted to format 7/.test(n))).toBe(true);
    for (const id of Object.keys(sim.state.nations)) {
      const a = sim.state.nations[id];
      const b = back.state.nations[id];
      expect(b.treasury, id).toBe(a.treasury);
      expect(b.manpower, id).toBe(a.manpower);
      expect(b.materiel, id).toBe(a.materiel);
      expect(b.stock, id).toEqual(a.stock);
      expect(b.reserveLost, id).toBe(0);
      expect(b.ai.peace, id).toEqual({});
      expect(b.ai.treatyAnswers, id).toEqual({});
    }
    expect(Object.keys(back.state.armies).sort()).toEqual(Object.keys(sim.state.armies).sort());
    expect(Object.keys(back.state.fleets).sort()).toEqual(Object.keys(sim.state.fleets).sort());
    expect(Object.values(back.state.fleets).every((f) => f.duty === null)).toBe(true);
    expect(Object.values(back.state.provinces).every((p) => p.aa === 0)).toBe(true);
    expect(Object.values(back.state.armies).every((a) => a.drop === null)).toBe(true);
    expect(checkInvariants(back)).toEqual([]);
    // and it plays on
    for (let i = 0; i < 8; i++) step(back);
    expect(checkInvariants(back)).toEqual([]);
  });
});
