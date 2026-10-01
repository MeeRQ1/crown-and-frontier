// Stage C worked examples (DESIGN.md "Navy" and "Air"): a naval invasion, a
// blockade, and air superiority deciding a land battle, through the real code.

import { describe, expect, it } from 'vitest';
import { C } from '../src/sim/config';
import { airExamples, blockadeExamples, invasionExamples } from '../tools/sea-air-examples';

describe('worked examples — naval invasion', () => {
  const [overland, bySea, amphibious] = invasionExamples();

  it('landing from the sea costs the attackers a quarter of their fire that week', () => {
    expect(bySea.values?.shipped).toBe(true);
    expect(overland.forecast!.verdict).toBe('Likely victory');
    expect(bySea.forecast!.factors).toContain(`Attacker: Landing from the sea −${Math.round((1 - C.naval.landing) * 100)}%`);
    expect(bySea.forecast!.verdict).toBe('Uncertain');
    expect(bySea.forecast!.attLoss).toBeGreaterThan(overland.forecast!.attLoss);
    expect(bySea.forecast!.defLoss).toBeLessThan(overland.forecast!.defLoss);
  });

  it('Amphibious Warfare halves the landing penalty', () => {
    expect(amphibious.forecast!.factors.some((f) => /Landing from the sea −13%/.test(f))).toBe(true);
    expect(amphibious.forecast!.attLoss).toBeLessThan(bySea.forecast!.attLoss);
  });
});

describe('worked examples — blockade', () => {
  const [peace, cruisers, contested, subs] = blockadeExamples();

  it('enemy cruisers alone off a port cut its crowns by a quarter and its trade overseas', () => {
    expect(peace.values).toMatchObject({ blockaded: false, tradeWithIsland: 1, tradeWithNeighbour: 1 });
    expect(cruisers.values?.blockaded).toBe(true);
    expect(cruisers.values!.crowns as number).toBeCloseTo((peace.values!.crowns as number) * (1 - C.naval.blockadeIncome), 1);
    expect(cruisers.values!.tradeWithIsland as number).toBeLessThan(1);
    // the land neighbour still trades overland
    expect(cruisers.values?.tradeWithNeighbour).toBe(1);
  });

  it('one defending cruiser against two is enough to keep the port open', () => {
    expect(contested.values).toMatchObject({ blockaded: false, crowns: peace.values!.crowns, tradeWithIsland: 1 });
  });

  it('submarines blockade without holding the surface', () => {
    expect(subs.values?.blockaded).toBe(true);
  });
});

describe('worked examples — air superiority', () => {
  const [none, support, enemySky, contested] = airExamples();

  it('ground support turns a held line into an attacker’s win with even rolls', () => {
    expect(none.forecast!.outcomes[1]).toBe('defender');
    expect(support.forecast!.factors).toContain('Attacker: Air support +40% (air superiority)');
    expect(support.forecast!.outcomes[1]).toBe('attacker');
    expect(support.forecast!.defLoss).toBeGreaterThan(none.forecast!.defLoss);
  });

  it('enemy air superiority cuts the support to 40% of its value; contesting the sky restores it', () => {
    const cut = Math.round(C.air.supportMax * C.air.contested * 100);
    expect(enemySky.forecast!.factors).toContain(`Attacker: Air support +${cut}% (enemy holds the sky)`);
    expect(enemySky.forecast!.defLoss).toBeLessThan(support.forecast!.defLoss);
    expect(contested.forecast!.factors).toContain('Attacker: Air support +40%');
    expect(contested.forecast!.defLoss).toBe(support.forecast!.defLoss);
  });
});
