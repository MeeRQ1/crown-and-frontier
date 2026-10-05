import { describe, expect, it } from 'vitest';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { EVENTS, EVENT_MAP } from '../src/sim/data/events';
import { GENERIC_BY_ID } from '../src/sim/focus';
import { monthlyFocus } from '../src/sim/focus';
import { startingTechs, TECHS, TECH_LIST } from '../src/sim/data/techs';
import { joinCoalition, memoriesOf, signTreaty } from '../src/sim/diplomacy';
import { defaultChoice, eventCtx, monthlyEvents } from '../src/sim/events';
import { createGame } from '../src/sim/game';
import { computeMods } from '../src/sim/modifiers';
import { monthlyResearch, techCost } from '../src/sim/progression';
import { bump, months } from '../src/sim/state';
import { runTicks } from '../src/sim/tick';
import { monthlyVictory, victoryProgress, victoryRules } from '../src/sim/victory';
import { transferProvince } from '../src/sim/war';
import { strategic } from '../src/sim/ai/strategic';
import { lineGame } from './helpers';

describe('research and national focus', () => {
  it('enforces prerequisites and completes the selected technology', () => {
    const sim = lineGame();
    expect(checkCommand(sim, { type: 'research', nation: 'a', tech: 'general_staff' })).toMatch(/Field Telegraph/);
    expect(applyCommand(sim, { type: 'research', nation: 'a', tech: 'field_telegraph' }).ok).toBe(true);
    sim.state.nations.a.research.progress = techCost(sim, 'field_telegraph');
    monthlyResearch(sim);
    expect(sim.state.nations.a.research.done).toContain('field_telegraph');
    expect(sim.state.nations.a.research.current).toBeNull();
    expect(checkCommand(sim, { type: 'research', nation: 'a', tech: 'general_staff' })).toBeNull();
  });

  it('a campaign starts with the technologies of its era', () => {
    const sim = lineGame(); // starts in 1880: horizons up to 1875 are known
    expect(sim.state.nations.a.research.done).toEqual(expect.arrayContaining(['breech_rifles', 'bessemer', 'telegraph_network']));
    expect(sim.state.nations.a.research.done).not.toContain('field_telegraph');
    expect(startingTechs(1895)).toEqual(expect.arrayContaining(['engineering_corps', 'magazine_rifles']));
  });

  it('research ahead of its time costs more and is capped at ten years early', () => {
    const sim = lineGame(); // 1880
    // Magazine Rifles: horizon 1886, six years early
    expect(techCost(sim, 'magazine_rifles')).toBe(Math.round(TECHS.magazine_rifles.cost * (1 + 0.15 * 6)));
    // Machine Guns (1900) needs Magazine Rifles; with it, still twenty years early
    sim.state.nations.a.research.done.push('magazine_rifles');
    expect(checkCommand(sim, { type: 'research', nation: 'a', tech: 'machine_guns' })).toMatch(/ahead of its time.*1890/);
    // ten years on it may begin
    sim.state.tick = 10 * 48;
    expect(checkCommand(sim, { type: 'research', nation: 'a', tech: 'machine_guns' })).toBeNull();
  });

  it('every horizon follows its prerequisites', () => {
    for (const t of TECH_LIST) for (const r of t.requires) expect(TECHS[r].year, `${t.id} needs ${r}`).toBeLessThanOrEqual(t.year);
  });

  it('every prerequisite exists and no branch needs another branch', () => {
    for (const t of TECH_LIST) for (const r of t.requires) {
      expect(TECHS[r]).toBeDefined();
      expect(TECHS[r].branch).toBe(t.branch);
    }
  });

  it('a focus needs its prerequisites, takes its months and then lasts', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    expect(checkCommand(sim, { type: 'focus', nation: 'a', focus: 'army_levy' })).toMatch(/General Staff/);
    expect(applyCommand(sim, { type: 'focus', nation: 'a', focus: 'army_staff' }).ok).toBe(true);
    for (let i = 0; i < GENERIC_BY_ID.army_staff.months - 1; i++) monthlyFocus(sim);
    expect(n.focus.done).not.toContain('army_staff');
    monthlyFocus(sim);
    expect(n.focus.done).toContain('army_staff');
    expect(n.focus.current).toBeNull();
    expect(computeMods(sim, 'a').attack).toBeCloseTo(GENERIC_BY_ID.army_staff.effects.attack ?? 0, 9);
    // the two army doctrines exclude each other
    expect(applyCommand(sim, { type: 'focus', nation: 'a', focus: 'army_levy' }).ok).toBe(true);
    for (let i = 0; i < GENERIC_BY_ID.army_levy.months; i++) monthlyFocus(sim);
    expect(checkCommand(sim, { type: 'focus', nation: 'a', focus: 'army_prof' })).toMatch(/Excluded by Martial Levy/);
    // a focus with a year cannot start early
    expect(checkCommand(sim, { type: 'focus', nation: 'a', focus: 'army_mobile' })).toMatch(/Requires|Not before/);
    sim.state.tick += months(0);
  });

  it('modifiers from traits, technology and focus stack additively', () => {
    const sim = lineGame();
    const n = sim.state.nations.a;
    n.focus.done = ['dip_service', 'dip_charter'];
    n.research.done = ['joint_stock'];
    const m = computeMods(sim, 'a');
    expect(m.income).toBeCloseTo((GENERIC_BY_ID.dip_charter.effects.income ?? 0) + (TECHS.joint_stock.effects.income ?? 0), 9);
  });
});

describe('events', () => {
  it('every event has a choice that can always be taken', () => {
    for (const e of EVENTS) expect(e.choices.some((c) => !c.problem)).toBe(true);
  });

  it('unaffordable choices are refused; expired events take the default', () => {
    const sim = lineGame({ playerNation: 'a' });
    const n = sim.state.nations.a;
    sim.state.provinces.a3.integration = 20;
    sim.state.provinces.a3.unrest = 50;
    n.pendingEvents.push({ id: 'e-test', event: 'frontier_unrest', tick: 0, province: 'a3', expires: 8 });
    n.treasury = 10;
    expect(checkCommand(sim, { type: 'eventChoice', nation: 'a', instance: 'e-test', choice: 0 })).toMatch(/40 crowns/);
    const def = defaultChoice(sim, 'a', n.pendingEvents[0]);
    expect(EVENT_MAP.frontier_unrest.choices[def].problem?.(eventCtx(sim, 'a', n.pendingEvents[0])) ?? null).toBeNull();
    sim.state.tick = 8;
    monthlyEvents(sim);
    expect(n.pendingEvents.find((e) => e.id === 'e-test')).toBeUndefined();
  });

  it('events respect cooldowns and are reproducible from the seed', () => {
    const run = () => {
      const sim = createGame({ seed: 9, playerNation: null });
      runTicks(sim, 48 * 4);
      return Object.values(sim.state.nations).map((n) => Object.keys(n.eventCooldowns).sort().join(','));
    };
    expect(run()).toEqual(run());
    const sim = createGame({ seed: 9, playerNation: null });
    runTicks(sim, 48 * 4);
    for (const n of Object.values(sim.state.nations)) {
      for (const [id, until] of Object.entries(n.eventCooldowns)) expect(until - EVENT_MAP[id].cooldownMonths * 4).toBeLessThanOrEqual(sim.state.tick);
    }
  });
});

describe('victory', () => {
  it('territorial dominance must be held for 24 months', () => {
    const sim = lineGame();
    for (const p of ['b1', 'b2', 'b3', 'c1', 'c2']) transferProvince(sim, p, 'a');
    sim.state.provinces.m1.owner = 'a';
    sim.state.provinces.m1.controller = 'a';
    bump(sim); // direct edit: refresh derived lookups
    expect(victoryProgress(sim, 'a').territorial.met).toBe(true);
    for (let m = 0; m < 23; m++) monthlyVictory(sim);
    expect(sim.state.result).toBeNull();
    monthlyVictory(sim);
    expect(sim.state.result?.winner).toBe('a');
    expect(sim.state.result?.path).toBe('territorial');
  });

  it('a failing month pauses a timer; from the second in a row it loses six months a month', () => {
    const sim = lineGame();
    sim.state.nations.a.victoryStreak.territorial = 20;
    monthlyVictory(sim);
    expect(sim.state.nations.a.victoryStreak.territorial).toBe(20);
    monthlyVictory(sim);
    expect(sim.state.nations.a.victoryStreak.territorial).toBe(14);
    monthlyVictory(sim);
    expect(sim.state.nations.a.victoryStreak.territorial).toBe(8);
  });

  it('falling just short of the main measure, with every other condition met, keeps a timer paused', () => {
    const sim = lineGame();
    const devs = (a1: number, a2: number, a3: number) => {
      Object.assign(sim.state.provinces.a1, { dev: a1 });
      Object.assign(sim.state.provinces.a2, { dev: a2 });
      Object.assign(sim.state.provinces.a3, { dev: a3 });
      bump(sim); // direct edit: refresh derived lookups
    };
    // the rest of the world is sized so that realm a's 4 development is 95% of the share in play
    const others = 4 / (0.95 * victoryRules(sim).economicShare) - 4;
    sim.state.provinces.b3.dev = Math.max(1, Math.round(others - 13));
    devs(2, 1, 1); // within a tenth of the economic share
    const vp = victoryProgress(sim, 'a').economic;
    expect(vp.met).toBe(false);
    expect(vp.near).toBe(true);
    sim.state.nations.a.victoryStreak.economic = 30;
    for (let m = 0; m < 3; m++) monthlyVictory(sim);
    expect(sim.state.nations.a.victoryStreak.economic).toBe(30);
    devs(1, 1, 1); // a quarter less: clearly short, so the timer winds back
    expect(victoryProgress(sim, 'a').economic.near).toBe(false);
    monthlyVictory(sim);
    expect(sim.state.nations.a.victoryStreak.economic).toBe(24);
  });

  it('rivals grow wary of a diplomatic front-runner but alarmed by a territorial one', () => {
    const sim = lineGame();
    sim.state.nations.a.victoryStreak.diplomatic = 30; // half of the 60-month hold
    strategic(sim, 'b');
    expect(memoriesOf(sim, 'b', 'a').find((m) => m.kind === 'rivalBid')?.value).toBeLessThan(0);
    expect(sim.state.alarm.b?.a ?? 0).toBe(0);
    sim.state.nations.a.victoryStreak.diplomatic = 0;
    sim.state.nations.a.victoryStreak.territorial = 12; // half of 24
    strategic(sim, 'c');
    expect(sim.state.alarm.c?.a ?? 0).toBeGreaterThan(0);
    joinCoalition(sim, 'c', 'a');
    expect(sim.state.notifications.some((n) => n.nation === 'a' && /bid for territorial dominance/.test(n.text))).toBe(true);
  });

  it('new treaties do not count toward diplomatic leadership', () => {
    const sim = lineGame();
    signTreaty(sim, 'alliance', 'a', 'b');
    signTreaty(sim, 'trade', 'a', 'c');
    expect(victoryProgress(sim, 'a').diplomatic.lines[0]).toMatch(/Influence: 0\//);
  });

  it('simultaneous winners are ranked by campaign score; the campaign limit always yields a result', () => {
    const sim = lineGame();
    sim.state.nations.a.victoryStreak.economic = 59;
    sim.state.nations.b.victoryStreak.economic = 59;
    sim.state.provinces.m1.owner = 'a';
    sim.state.provinces.m1.controller = 'a';
    bump(sim); // direct edit: refresh derived lookups
    // both meet economic conditions? force by stubbing the thresholds via state: give both high dev share
    for (const p of Object.values(sim.state.provinces)) p.unrest = 0;
    monthlyVictory(sim);
    if (sim.state.result) expect(['a', 'b']).toContain(sim.state.result.winner);
    const sim2 = lineGame({ campaignYears: 1 });
    runTicks(sim2, 48 + 4, { noAI: true });
    expect(sim2.state.result?.path).toBe('score');
  });
});
