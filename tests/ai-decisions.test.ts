// The AI's war assessment, peace offers from either side, offer memory,
// personalities, and treaties proposed for stated reasons and judged by the
// recipient's interests. Each case is set up on the line map:
//
//   a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2 ─ a1      (b1 is b's capital)

import { describe, expect, it } from 'vitest';
import { assessWar, warStanding } from '../src/sim/assess';
import { considerPeace, diplomacy, treatyMotive } from '../src/sim/ai/strategic';
import { PERSONALITIES } from '../src/sim/data/personalities';
import { applyCommand } from '../src/sim/commands';
import { evaluateTreaty, signTreaty } from '../src/sim/diplomacy';
import { buildSettlement, settlementCost } from '../src/sim/settlement';
import { months, type Sim } from '../src/sim/state';
import { declareWar } from '../src/sim/war';
import type { War } from '../src/sim/types';
import { addArmy, lineGame } from './helpers';

const peaceTo = (sim: Sim, to: string) => sim.state.proposals.filter((p) => p.to === to && (p.kind === 'peace' || p.kind === 'settlement'));
const said = (sim: Sim, nid: string, re: RegExp) => sim.state.diagnostics.filter((d) => d.nation === nid && re.test(d.summary));

/** The player (a) holds two of b's three provinces with large armies; b keeps a regiment at its capital. */
function halfCountry(): { sim: Sim; w: War } {
  const sim = lineGame({ playerNation: 'a' });
  const st = sim.state;
  st.tick = months(20);
  const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
  st.provinces.b3.controller = 'a';
  st.provinces.b2.controller = 'a';
  addArmy(sim, 'a', 'b3', { infantry: 8 });
  addArmy(sim, 'a', 'b2', { infantry: 8 });
  addArmy(sim, 'b', 'b1', { infantry: 1 });
  st.nations.b.manpower = 0;
  st.nations.b.treasury = 40;
  st.nations.b.warExhaustion = 40;
  w.score = 45;
  return { sim, w };
}

describe('war assessment', () => {
  it('weighs land both ways, forces, depth and whether lost land can be retaken', () => {
    const { sim, w } = halfCountry();
    const b = assessWar(sim, w.id, 'b')!;
    expect(b.lost.sort()).toEqual(['b2', 'b3']);
    expect(b.landLost).toBeGreaterThan(0.4);
    expect(b.capitalLost).toBe(false);
    expect(b.forceBalance).toBeLessThan(-0.5);
    expect(b.recovery).toBeLessThan(0.2);
    expect(warStanding(b)).toBeLessThan(-25);
    const a = assessWar(sim, w.id, 'a')!;
    expect(a.landHeld).toBeCloseTo(b.landLost, 5);
    expect(warStanding(a)).toBeGreaterThan(25);
    expect(b.reasons.join(' ')).toMatch(/Chance to retake/);
  });
});

describe('peace from the losing side', () => {
  it('a realm that cannot retake half its land concedes land to a human, not white peace (the reported regression)', () => {
    const { sim } = halfCountry();
    considerPeace(sim, 'b');
    const [p] = peaceTo(sim, 'a');
    expect(p?.kind).toBe('peace');
    expect(p.terms!.mode).toBe('concede');
    expect(p.terms!.provinces.length).toBeGreaterThan(0);
    expect(p.terms!.provinces).not.toContain('b1');
    const d = said(sim, 'b', /^Offered peace to/)[0];
    expect(d.summary).toMatch(/conceding .* to end a war we cannot turn/);
    expect(d.detail!.join('\n')).toMatch(/Rejected: a white peace/);
  });

  it('a realm that can retake its land fights on, and says why', () => {
    const sim = lineGame({ playerNation: 'a' });
    const st = sim.state;
    st.tick = months(20);
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    st.provinces.b3.controller = 'a';
    addArmy(sim, 'a', 'b3', { infantry: 3 });
    addArmy(sim, 'a', 'a1', { infantry: 3 });
    addArmy(sim, 'b', 'b1', { infantry: 7 });
    st.nations.b.warExhaustion = 15;
    w.score = 80;
    const a = assessWar(sim, w.id, 'b')!;
    expect(a.recovery).toBeGreaterThanOrEqual(0.55);
    considerPeace(sim, 'b');
    expect(peaceTo(sim, 'a')).toEqual([]);
    expect(said(sim, 'b', /^Fighting on against .*: the lost land can be retaken/).length).toBe(1);
  });

  it('a refused concession is not repeated: the next one is larger, or the realm holds out', () => {
    const { sim } = halfCountry();
    considerPeace(sim, 'b');
    const [p] = peaceTo(sim, 'a');
    const first = sim.state.nations.b.ai.peace[p.war!].value;
    expect(applyCommand(sim, { type: 'respond', nation: 'a', proposal: p.id, accept: false }).ok).toBe(true);
    expect(sim.state.nations.b.ai.peace[p.war!].answer).toBe('rejected');
    sim.state.tick += months(1);
    considerPeace(sim, 'b');
    const again = peaceTo(sim, 'a');
    if (again.length) expect(sim.state.nations.b.ai.peace[p.war!].value).toBeGreaterThan(first * 1.05);
    else expect(said(sim, 'b', /already refused/).length).toBe(1);
  });
});

describe('peace from the winning side', () => {
  it('a winning AI holding its goal offers the human a settlement', () => {
    const sim = lineGame({ playerNation: 'b' });
    const st = sim.state;
    st.tick = months(20);
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    st.provinces.b3.controller = 'a';
    addArmy(sim, 'a', 'b3', { infantry: 10 });
    addArmy(sim, 'b', 'b1', { infantry: 2 });
    st.nations.b.manpower = 0;
    w.score = 50;
    considerPeace(sim, 'a');
    const [p] = peaceTo(sim, 'b');
    expect(p?.kind).toBe('settlement');
    expect(said(sim, 'a', /^Proposed a settlement to .*our war goals are held/).length).toBe(1);
  });

  it('a winner still advancing presses on and logs the settlement it set aside', () => {
    const sim = lineGame({ playerNation: 'b' });
    const st = sim.state;
    st.tick = months(20);
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b2'] });
    st.provinces.b3.controller = 'a';
    w.startTick = st.tick - months(2);
    addArmy(sim, 'a', 'b3', { infantry: 10 });
    addArmy(sim, 'b', 'b1', { infantry: 3 });
    w.score = 25;
    considerPeace(sim, 'a');
    expect(peaceTo(sim, 'b')).toEqual([]);
    const d = said(sim, 'a', /^Pressing on against/)[0];
    expect(d.detail!.join('\n')).toMatch(/Rejected: a settlement now/);
  });
});

describe('stalemate', () => {
  it('two worn-out sides with nothing taken settle for a white peace', () => {
    const sim = lineGame({ playerNation: 'a' });
    const st = sim.state;
    st.tick = months(40);
    const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    w.startTick = st.tick - months(30);
    addArmy(sim, 'a', 'a3', { infantry: 4 });
    addArmy(sim, 'b', 'b3', { infantry: 4 });
    st.nations.a.warExhaustion = 40;
    st.nations.b.warExhaustion = 40;
    considerPeace(sim, 'b');
    const [p] = peaceTo(sim, 'a');
    expect(p?.terms?.mode).toBe('white');
    expect(said(sim, 'b', /^Offered peace to .*a stalemate/).length).toBe(1);
  });
});

describe('personality', () => {
  it('a bold winner asks for more than a cautious one in the same position', () => {
    const cost = (personality: 'expansionist' | 'defensive') => {
      // a has the better of it, but no more: its demands are limited by its daring
      const sim = lineGame();
      const st = sim.state;
      st.tick = months(20);
      const w = declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
      st.provinces.b3.controller = 'a';
      addArmy(sim, 'a', 'b3', { infantry: 5 });
      addArmy(sim, 'b', 'b1', { infantry: 3 });
      st.nations.b.warExhaustion = 20;
      st.nations.b.treasury = 300;
      w.score = 30;
      st.nations.a.ai.personality = personality;
      return settlementCost(sim, w, buildSettlement(sim, w.id, 'a'));
    };
    expect(cost('expansionist')).toBeGreaterThan(cost('defensive'));
  });
});

describe('treaties for stated reasons', () => {
  it('realms that fear the same neighbour propose an alliance and say so; a human sees the reason', () => {
    const sim = lineGame({ playerNation: 'c' });
    const st = sim.state;
    st.tick = months(6); // a human hears no proposals in the first three months
    st.alarm.b = { a: 40 };
    st.alarm.c = { a: 40 };
    st.memories = {};
    expect(treatyMotive(sim, 'b', 'c', 'alliance')).toBe('we both have reason to fear A');
    // b's own interest must favour it: a good opinion of c
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.c.trust = 90;
    st.nations.b.trust = 90;
    diplomacy(sim, 'b');
    const p = st.proposals.find((x) => x.to === 'c' && x.kind === 'alliance');
    expect(p?.reason).toBe('we both have reason to fear A');
    expect(said(sim, 'b', /^Proposed alliance to C \(we both have reason to fear A\)/).length).toBe(1);
  });

  it('a realm at war asks a strong neighbour for a pact to keep that border quiet', () => {
    const sim = lineGame();
    declareWar(sim, 'b', 'c', { type: 'conquest', provinces: ['c1'] });
    addArmy(sim, 'a', 'a3', { infantry: 6 });
    addArmy(sim, 'b', 'b1', { infantry: 6 });
    expect(treatyMotive(sim, 'b', 'a', 'nap')).toMatch(/our armies are needed against C,/);
  });

  it('the recipient weighs being drawn into the proposer’s wars', () => {
    // b fears a strong a; c does not: an alliance with b would set c against a
    const sim = lineGame();
    addArmy(sim, 'a', 'a1', { infantry: 12 });
    addArmy(sim, 'b', 'b1', { infantry: 3 });
    addArmy(sim, 'c', 'c1', { infantry: 3 });
    sim.state.alarm.b = { a: 40 };
    sim.state.alarm.c = {};
    const ev = evaluateTreaty(sim, 'b', 'c', 'alliance');
    expect(ev.reasons.some((r) => /^We would be drawn against A$/.test(r.label) && r.value < 0)).toBe(true);
    // a pact that frees the proposer's armies against a realm the recipient is allied to
    declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['b3'] });
    signTreaty(sim, 'alliance', 'c', 'b');
    const nap = evaluateTreaty(sim, 'a', 'c', 'nap');
    expect(nap.reasons.some((r) => /free their armies against B,/.test(r.label) && r.value < 0)).toBe(true);
  });

  it('a human hears no treaty proposals in the first three months of a campaign', () => {
    const sim = lineGame({ playerNation: 'c' });
    const st = sim.state;
    st.alarm.b = { a: 40 };
    st.alarm.c = { a: 40 };
    st.memories = {};
    signTreaty(sim, 'trade', 'b', 'c');
    st.nations.b.trust = 90;
    st.nations.c.trust = 90;
    diplomacy(sim, 'b');
    expect(st.proposals.filter((x) => x.to === 'c')).toEqual([]);
    st.tick = months(3);
    diplomacy(sim, 'b');
    expect(st.proposals.filter((x) => x.to === 'c' && x.kind === 'alliance').length).toBe(1);
  });

  it('a refused proposal is not put again for the same reason until patience runs out', () => {
    const run = (refusedMonthsAgo: number | null) => {
      const sim = lineGame({ playerNation: 'c' });
      const st = sim.state;
      st.tick = months(40);
      st.alarm.b = { a: 40 };
      st.alarm.c = { a: 40 };
      st.memories = {};
      signTreaty(sim, 'trade', 'b', 'c');
      st.nations.b.trust = 90;
      st.nations.c.trust = 90;
      if (refusedMonthsAgo !== null) st.nations.b.ai.treatyAnswers['c:alliance'] = { tick: st.tick - months(refusedMonthsAgo), accepted: false, reason: 'we both have reason to fear A' };
      diplomacy(sim, 'b');
      return st.proposals.filter((x) => x.to === 'c' && x.kind === 'alliance').length;
    };
    const patience = PERSONALITIES.commercial.patience;
    expect(run(null)).toBe(1);
    expect(run(Math.floor(24 * patience) - 1)).toBe(0);
    expect(run(Math.ceil(24 * patience) + 1)).toBe(1);
  });
});

describe('national management', () => {
  it('a small realm keeps only the envoys it can afford', () => {
    const sim = lineGame();
    const st = sim.state;
    const b = st.nations.b;
    b.treasury = 500;
    b.lastMonth = { ...b.lastMonth, income: { Taxes: 8 }, net: 1 };
    // a realm seeking diplomatic leadership wants envoys at every court
    b.ai.goal.victory = 'diplomatic';
    diplomacy(sim, 'b');
    expect(st.envoys.filter((e) => e.from === 'b').length).toBe(1);
    // the same realm with a large income sends more
    const rich = lineGame();
    rich.state.nations.b.treasury = 500;
    rich.state.nations.b.lastMonth = { ...rich.state.nations.b.lastMonth, income: { Taxes: 80 }, net: 20 };
    rich.state.nations.b.ai.goal.victory = 'diplomatic';
    diplomacy(rich, 'b');
    expect(rich.state.envoys.filter((e) => e.from === 'b').length).toBe(2);
  });
});
