// Battle explanations (format 9): the report ranks what decided a battle from the
// figures the combat actually resolved (fire, frontage, supply, morale, support, the
// defender's bonus), and the forecast shows the same figures before a commitment.

import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { averageFigures, battleReasons, forecastBattle, tallyFigures } from '../src/sim/combat';
import type { Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { addArmy, gridGame } from './helpers';

function attackDugIn(sim: Sim, attackers: number) {
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g21'] });
  const att = addArmy(sim, 'a', 'g11', { infantry: attackers });
  const def = addArmy(sim, 'b', 'g21', { infantry: 12 });
  def.stationary = 10;
  return { att, def };
}

describe('what decided a battle', () => {
  it('the report ranks the resolved figures: the balance of fire, then frontage, the defence and the rest', () => {
    const sim = gridGame();
    const { att } = attackDugIn(sim, 40);
    expect(applyCommand(sim, { type: 'move', nation: 'a', army: att.id, dest: 'g21' }).ok).toBe(true);
    for (let i = 0; i < 20 && !sim.state.reports.length; i++) step(sim, { noAI: true });
    const r = sim.state.reports.at(-1)!;
    expect(r.figures).toBeDefined();
    expect(r.figures!.att.engaged + r.figures!.att.held).toBeGreaterThan(r.figures!.att.engaged);
    expect(r.decisive![0]).toMatch(/^Fire a round: attackers [\d.]+ \([\d.]+ after the defence\) against defenders [\d.]+$/);
    expect(r.decisive!.some((x) => /^Frontage: \d+ of 40 attackers' regiments could fight at once/.test(x))).toBe(true);
    expect(r.decisive!.some((x) => /ground, works and entrenchment absorbed \d+%/.test(x))).toBe(true);
    expect(r.decisive!.length).toBeLessThanOrEqual(5);
  });

  it('the forecast carries the same figures before the attack (who fights at once, supply at the target)', () => {
    const sim = gridGame();
    const { att, def } = attackDugIn(sim, 40);
    const f = forecastBattle(sim, 'g21', [sim.state.armies[att.id]], [sim.state.armies[def.id]]);
    expect(f.figures).not.toBeNull();
    expect(f.figures!.att.engaged).toBeLessThan(40);
    expect(f.figures!.att.held).toBe(40 - f.figures!.att.engaged);
    expect(f.figures!.defence).toBeGreaterThan(0);
  });

  it('reasons are ranked by how much each changed the damage', () => {
    const side = { fire: 10, engaged: 16, held: 0, supply: 1, morale: 1, support: 0 };
    const t = tallyFigures(undefined, { att: { ...side, supply: 0.75 }, def: { ...side, support: 0.1 }, defence: 0.05 });
    const r = battleReasons(averageFigures(t));
    // unsupplied (×0.75) outweighs +10% support and a 5% defence
    expect(r[1]).toMatch(/^Attackers short of supply: their fire ×0\.75/);
    expect(r.indexOf(r.find((x) => /fire support/.test(x))!)).toBeGreaterThan(1);
  });
});
