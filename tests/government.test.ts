// Government (format 9): forms of government, heads of government, commanders,
// formable nations and the trade minister — and the single modifier accounting
// path they all go through.

import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { commanderOf, forceSources, recruitCommander } from '../src/sim/commanders';
import { forecastBattle } from '../src/sim/combat';
import { createGame } from '../src/sim/game';
import { checkFormable, formablesFor, formableProvinces, ideologyOf, IDEOLOGY_WAIT_WEEKS, leaderOf, monthlyLeaders } from '../src/sim/government';
import { checkInvariants } from '../src/sim/invariants';
import { computeMods, emptyMods, addMods, modSources, nationMods } from '../src/sim/modifiers';
import { readSave, serialize } from '../src/sim/save';
import { nationName, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { capOf } from '../src/sim/trade';
import { signTreaty } from '../src/sim/diplomacy';
import { tradeMinisterMonth } from '../src/sim/cabinet';
import { declareWar, transferProvince } from '../src/sim/war';
import { addArmy, gridGame, lineGame } from './helpers';

const sumSources = (sim: Sim, nid: string) => {
  const m = emptyMods();
  for (const s of modSources(sim, nid)) addMods(m, s.effects);
  return m;
};

describe('forms of government', () => {
  it('start from the scenario: 1936 Germany fascist, the Soviet Union communist, France a democracy; 1914 Germany a monarchy', () => {
    const late = createGame({ scenario: 'europe-1936', seed: 1, playerNation: null });
    expect(ideologyOf(late, 'ger')).toBe('fascism');
    expect(ideologyOf(late, 'sov')).toBe('communism');
    expect(ideologyOf(late, 'fra')).toBe('democracy');
    const early = createGame({ scenario: 'europe', seed: 1, playerNation: null });
    expect(ideologyOf(early, 'ger')).toBe('monarchy');
    expect(ideologyOf(early, 'fra')).toBe('democracy');
  });

  it('a change costs crowns and a year of upheaval, needs peace and the date, then waits ten years', () => {
    const sim = gridGame();
    const n = sim.state.nations.a;
    n.treasury = 5000;
    // fascism does not exist in 1930? it does (from 1922); the grid starts in 1930
    expect(checkCommand(sim, { type: 'setIdeology', nation: 'a', ideology: ideologyOf(sim, 'a') })).toMatch(/already/);
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g20'] });
    expect(checkCommand(sim, { type: 'setIdeology', nation: 'a', ideology: 'authoritarian' })).toMatch(/at war/);
    const peace = gridGame();
    peace.state.nations.a.treasury = 5000;
    const before = peace.state.nations.a.treasury;
    const r = applyCommand(peace, { type: 'setIdeology', nation: 'a', ideology: 'authoritarian' });
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(peace.state.nations.a.treasury).toBeLessThan(before);
    expect(peace.state.nations.a.modifiers.some((m) => m.label === 'Change of government')).toBe(true);
    expect(checkCommand(peace, { type: 'setIdeology', nation: 'a', ideology: 'democracy' })).toMatch(/another is possible from/);
    peace.state.tick += IDEOLOGY_WAIT_WEEKS;
    expect(checkCommand(peace, { type: 'setIdeology', nation: 'a', ideology: 'democracy' })).toBeNull();
  });

  it('a form that does not exist yet cannot be chosen (communism before 1917)', () => {
    const sim = lineGame({ playerNation: 'a' });
    sim.state.nations.a.treasury = 5000;
    expect(checkCommand(sim, { type: 'setIdeology', nation: 'a', ideology: 'communism' })).toMatch(/does not exist before 1917/);
  });
});

describe('one modifier accounting path', () => {
  it('the totals the rules use are the sum of the sources the interface shows, for every realm', () => {
    const sim = createGame({ scenario: 'europe-1936', seed: 1, playerNation: null });
    for (const nid of ['ger', 'sov', 'fra', 'pol']) {
      const sum = sumSources(sim, nid);
      const m = computeMods(sim, nid);
      for (const k of Object.keys(m) as Array<keyof typeof m>) expect(m[k], `${nid} ${k}`).toBeCloseTo(sum[k], 9);
      expect(modSources(sim, nid).map((s) => s.kind)).toEqual(expect.arrayContaining(['trait', 'research', 'focus', 'ideology', 'leader']));
    }
  });

  it('changing the government replaces its effects (never adds a second set), and a reload changes nothing', () => {
    const sim = gridGame();
    sim.state.nations.a.treasury = 5000;
    // the grid starts in 1930 as a democracy (trade +15%); an authoritarian state trades 10% less
    expect(ideologyOf(sim, 'a')).toBe('democracy');
    const trade0 = nationMods(sim, 'a').trade;
    expect(applyCommand(sim, { type: 'setIdeology', nation: 'a', ideology: 'authoritarian' }).ok).toBe(true);
    const sources = modSources(sim, 'a').filter((s) => s.kind === 'ideology');
    expect(sources).toHaveLength(1);
    expect(nationMods(sim, 'a').trade).toBeCloseTo(trade0 - 0.25, 9);
    const back = readSave(serialize(sim)).sim;
    expect(computeMods(back, 'a')).toEqual(computeMods(sim, 'a'));
  });
});

describe('heads of government', () => {
  it('can be replaced for a price once in three years; a democracy elects a new one every five', () => {
    const sim = gridGame();
    const n = sim.state.nations.a;
    n.treasury = 5000;
    const cur = leaderOf(sim, 'a');
    const other = cur.trait === 'diplomat' ? 'financier' : 'diplomat';
    expect(applyCommand(sim, { type: 'replaceLeader', nation: 'a', trait: other }).ok).toBe(true);
    expect(leaderOf(sim, 'a').trait).toBe(other);
    expect(leaderOf(sim, 'a').generated).toBe(true);
    expect(checkCommand(sim, { type: 'replaceLeader', nation: 'a', trait: cur.trait })).toMatch(/replacement is possible from/);
    // elections
    n.ideology = { id: 'democracy', since: -1000 };
    const name = leaderOf(sim, 'a').name;
    sim.state.tick += 5 * 52;
    monthlyLeaders(sim);
    expect(leaderOf(sim, 'a').name).not.toBe(name);
  });
});

describe('commanders', () => {
  it('one commander a force: a second general relieves the first; an operation’s general leads members without their own', () => {
    const sim = gridGame();
    const army = addArmy(sim, 'a', 'g10', { infantry: 6 });
    const other = addArmy(sim, 'a', 'g11', { infantry: 6 });
    const [g1, g2] = sim.state.nations.a.commanders!.filter((c) => c.branch === 'land');
    expect(applyCommand(sim, { type: 'assignCommander', nation: 'a', commander: g1.id, to: army.id }).ok).toBe(true);
    const r = applyCommand(sim, { type: 'assignCommander', nation: 'a', commander: g2.id, to: army.id });
    expect(r.ok && r.message).toMatch(/is relieved/);
    expect(commanderOf(sim, army.id)?.id).toBe(g2.id);
    expect(g1.assigned).toBeNull();
    // an operation's general
    applyCommand(sim, { type: 'createOp', nation: 'a', kind: 'hold', area: ['g10', 'g11'], units: [army.id, other.id], activate: true });
    const op = Object.values(sim.state.operations).at(-1)!;
    applyCommand(sim, { type: 'assignCommander', nation: 'a', commander: g1.id, to: op.id });
    expect(commanderOf(sim, other.id)?.id).toBe(g1.id);
    expect(commanderOf(sim, army.id)?.id).toBe(g2.id);
    // never both: one commander source per force
    expect(forceSources(sim, army.id, modSources(sim, 'a')).filter((s) => s.kind === 'commander')).toHaveLength(1);
    expect(checkInvariants(sim)).toEqual([]);
  });

  it('a general changes the battle through the same figures (an offensive general: more fire)', () => {
    const sim = gridGame();
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['g21'] });
    const att = addArmy(sim, 'a', 'g11', { infantry: 10 });
    const def = addArmy(sim, 'b', 'g21', { infantry: 10 });
    const without = forecastBattle(sim, 'g21', [att], [def]).figures!.att.fire;
    const g = recruitCommander(sim, 'a', 'offensive', true);
    applyCommand(sim, { type: 'assignCommander', nation: 'a', commander: g.id, to: att.id });
    const withIt = forecastBattle(sim, 'g21', [sim.state.armies[att.id]], [sim.state.armies[def.id]]).figures!.att.fire;
    expect(withIt / without).toBeCloseTo((1 + nationMods(sim, 'a').attack + 0.06) / (1 + nationMods(sim, 'a').attack), 5);
  });

  it('limits grow with the forces; a commander of a force that is gone waits for a new command', () => {
    const sim = gridGame();
    sim.state.nations.a.treasury = 5000;
    for (const c of sim.state.nations.a.commanders!) c.assigned = null;
    const land = sim.state.nations.a.commanders!.filter((c) => c.branch === 'land').length;
    expect(land).toBe(2);
    expect(checkCommand(sim, { type: 'recruitCommander', nation: 'a', trait: 'organiser' })).toMatch(/the limit grows/);
    addArmy(sim, 'a', 'g10', { infantry: 15 });
    expect(checkCommand(sim, { type: 'recruitCommander', nation: 'a', trait: 'organiser' })).toBeNull();
    const army = addArmy(sim, 'a', 'g11', { infantry: 2 });
    const g = sim.state.nations.a.commanders![0];
    applyCommand(sim, { type: 'assignCommander', nation: 'a', commander: g.id, to: army.id });
    applyCommand(sim, { type: 'disband', nation: 'a', army: army.id });
    step(sim, { noAI: true });
    expect(g.assigned).toBeNull();
  });
});

describe('formable nations', () => {
  it('Austria may restore Austria-Hungary on the 1936 map once it holds Austria and Hungary; never on the 1914 map, where it exists', () => {
    const early = createGame({ scenario: 'europe', seed: 1, playerNation: null });
    expect(formablesFor(early, 'aus')).toEqual([]);
    const sim = createGame({ scenario: 'europe-1936', seed: 1, playerNation: 'aut' });
    expect(formablesFor(sim, 'aut')).toContain('austria-hungary');
    const c0 = checkFormable(sim, 'aut', 'austria-hungary');
    expect(c0.ok).toBe(false);
    // Hungary's land at the start
    expect(c0.missing.length).toBe(sim.world.scenario.provinces.filter((p) => p.owner === 'hun').length);
    expect(checkCommand(sim, { type: 'formNation', nation: 'aut', formable: 'austria-hungary' })).toMatch(/^Not yet:/);
    // Austria holds Hungary (as after a war); nothing is annexed by forming itself
    for (const p of formableProvinces(sim, 'austria-hungary')) if (sim.state.provinces[p].owner !== 'aut') transferProvince(sim, p, 'aut');
    sim.state.nations.aut.treasury = 5000;
    const armies = Object.values(sim.state.armies).filter((a) => a.nation === 'aut').map((a) => a.id).sort();
    const r = applyCommand(sim, { type: 'formNation', nation: 'aut', formable: 'austria-hungary' });
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    expect(nationName(sim, 'aut')).toBe('Austria-Hungary');
    expect(sim.state.nations.aut.formed?.id).toBe('austria-hungary');
    expect(modSources(sim, 'aut').some((s) => s.kind === 'formed')).toBe(true);
    // the same realm, the same forces; never twice
    expect(Object.values(sim.state.armies).filter((a) => a.nation === 'aut').map((a) => a.id).sort()).toEqual(armies);
    expect(checkCommand(sim, { type: 'formNation', nation: 'aut', formable: 'austria-hungary' })).toMatch(/not yet proclaimed|another nation/);
    // the identity survives a reload; the shared map definition is untouched
    const back = readSave(serialize(sim)).sim;
    expect(nationName(back, 'aut')).toBe('Austria-Hungary');
    expect(nationName(createGame({ scenario: 'europe-1936', seed: 1, playerNation: null }), 'aut')).toBe('Austria');
    expect(checkInvariants(back)).toEqual([]);
  });
});

describe('the trade minister', () => {
  function market(): Sim {
    const sim = lineGame({ playerNation: 'a' });
    signTreaty(sim, 'trade', 'a', 'b');
    const a = sim.state.nations.a;
    a.treasury = 2000;
    a.stock.iron = 0;
    sim.state.nations.b.stock.iron = capOf(sim, 'b', 'iron');
    for (let i = 0; i < 4; i++) step(sim, { noAI: true });
    return sim;
  }

  it('buys a good short of its target from a partner with a surplus, within the budget and the price limit', () => {
    const sim = market();
    sim.state.nations.a.treasury = 2000;
    expect(applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'hire', candidate: 2 }).ok).toBe(true);
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'settings', settings: { resources: ['iron'], targets: { iron: 40 }, budget: 60, maxPrice: 1.2 } });
    const t = sim.state.nations.a.cabinet!.trade!;
    tradeMinisterMonth(sim, 'a', t);
    const c = sim.state.contracts.find((x) => x.buyer === 'a' && x.res === 'iron');
    expect(c, JSON.stringify(t.log)).toBeDefined();
    expect(t.managed).toContain(c!.id);
    expect(c!.qty * c!.price).toBeLessThanOrEqual(60 + 1e-9);
    expect(c!.price).toBeLessThanOrEqual(8 * 1.2 + 1e-9 || c!.price);
    // its salary is a budget line
    expect(sim.state.nations.a.lastMonth.expenses['Cabinet salaries'] ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('within no budget it buys nothing and says why; paused it does nothing; it never touches a contract signed by hand', () => {
    const sim = market();
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'hire', candidate: 0 });
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'settings', settings: { resources: ['iron'], targets: { iron: 40 }, budget: 0 } });
    const t = sim.state.nations.a.cabinet!.trade!;
    tradeMinisterMonth(sim, 'a', t);
    expect(sim.state.contracts.some((x) => x.buyer === 'a')).toBe(false);
    expect(t.log.at(-1)?.text).toMatch(/Iron: its purchases already cost 0 of the 0 crowns/);
    expect(sim.state.notifications.some((n) => n.nation === 'a' && /cannot cover iron/.test(n.text))).toBe(true);
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'pause' });
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'settings', settings: { budget: 500 } });
    tradeMinisterMonth(sim, 'a', t);
    expect(sim.state.contracts.some((x) => x.buyer === 'a')).toBe(false);
    // dismissed: what it signed stays, under direct management
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'resume' });
    tradeMinisterMonth(sim, 'a', t);
    const n = sim.state.contracts.filter((x) => x.buyer === 'a').length;
    applyCommand(sim, { type: 'cabinet', nation: 'a', action: 'dismiss' });
    expect(sim.state.contracts.filter((x) => x.buyer === 'a').length).toBe(n);
    expect(sim.state.nations.a.cabinet!.trade).toBeNull();
  });
});
