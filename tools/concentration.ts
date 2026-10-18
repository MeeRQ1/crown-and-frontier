// The "stronger army against a 40,000-man concentration" investigation: a
// representative scenario (clearly labelled: no player save was available)
// built with the real simulation code, played in three workflows from the
// same start and seed, every battle traced.
//
//   Europe 1936. Germany (the player) against Poland alone: Poland's alliances
//   with France and Romania are set aside so the two sides are clear.
//   Germany: 120 regiments in 10 armies of 12 (8 infantry, 2 artillery, 1 cavalry,
//            1 armour) spread one to a border province, 2 fighter and 2 ground-
//            attack wings at a border airfield
//   Poland:  one concentration of 40 regiments (28 infantry, 8 artillery,
//            3 cavalry, 1 engineers: 40,000 men) at Poznań, three garrisons of
//            4 infantry, 2 fighter wings; the AI commands it (Normal)
//   Both realms: the same research, 3,000 crowns and 3,000 materiel.
//
// Workflows (each for --weeks, default 30):
//   auto        Simple Auto-conquer: the current enemies chosen, Activate; defaults
//   delegated   one conquest operation over all of Poland with every German
//               army and wing, default settings (what "auto-conquest" does)
//   greedy      a busy player: each week every idle fit army marches to the
//               nearest enemy-held province
//   massed      a careful player: gather at one border province facing the
//               concentration, merge into three armies, strike it together,
//               then take the land
//
// Every battle is traced: who fought on each side (regiments and men, how many
// fit the frontage), terrain, forts, entrenchment, rivers, supply, morale,
// fire support, reinforcements arriving later, rounds, losses, the winner.
//   npx tsx tools/concentration.ts [--weeks 30] [--seeds 1,2,3,4] [--scenario europe-1936-r1] [--out reports/playability/concentration-before.json]

import { writeFileSync } from 'node:fs';
import { createWing } from '../src/sim/air';
import { reachFrom } from '../src/sim/ai/common';
import { forecastBattle } from '../src/sim/combat';
import { applyCommand, commandStats } from '../src/sim/commands';
import { C, TERRAIN, UNITS } from '../src/sim/config';
import { removeTreaty } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { createArmy, maxMorale, newRegiment } from '../src/sim/military';
import { atWar, menOf, type Sim } from '../src/sim/state';
import { supplyStatus } from '../src/sim/supply';
import { step, weekSlices } from '../src/sim/tick';
import type { Army, Command, ProvinceId, UnitType } from '../src/sim/types';
import { breakTies, declareWar } from '../src/sim/war';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const WEEKS = Number(get('weeks', '30'));
const SEEDS = get('seeds', '1,2,3,4').split(',').map(Number);
const OUT = get('out', '');
const ONLY = get('only', '');
const SETUP = get('setup', 'built');
/** natural setup: 'alone' sets Poland's alliances aside (the stronger-military case), 'allies' keeps them */
const ALLIES = get('allies', 'alone');
/** the map: Europe 1936 as shipped, or its revision 1 (`europe-1936-r1`, the map of the diagnosis) */
const SCENARIO = get('scenario', 'europe-1936');
{
  const { ensureLegacyMap, parseLegacyId } = await import('../src/maps/legacy');
  const legacy = parseLegacyId(SCENARIO);
  if (legacy) await ensureLegacyMap(legacy[0], legacy[1]);
}

export interface Concentration {
  sim: Sim;
  stack: string;
  ger: string[];
}

const TECH = ['aviation', 'fighters', 'ground_attack', 'all_metal_aircraft', 'tanks', 'engineering_corps'];

export function concentration(seed: number): Concentration {
  const sim = createGame({ scenario: SCENARIO, seed, playerNation: 'ger' });
  const st = sim.state;
  for (const nid of ['ger', 'pol']) {
    const n = st.nations[nid];
    for (const t of TECH) if (!n.research.done.includes(t)) n.research.done.push(t);
    n.treasury = 3000;
    n.materiel = 3000;
  }
  for (const [a, b] of [['pol', 'fra'], ['pol', 'rom'], ['ger', 'pol']]) {
    breakTies(sim, a, b);
    for (const t of ['nap', 'trade', 'alliance'] as const) removeTreaty(sim, t, a, b);
  }
  const border = (nid: string, other: string) => sim.world.provIds.filter((p) => st.provinces[p].owner === nid && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === other)).sort();
  const gerBorder = border('ger', 'pol');
  declareWar(sim, 'ger', 'pol', { type: 'conquest', provinces: border('pol', 'ger').slice(0, 3) });
  for (const a of Object.values(st.armies)) if (a.nation === 'ger' || a.nation === 'pol') delete st.armies[a.id];
  const regs = (mix: Partial<Record<UnitType, number>>) => Object.entries(mix).flatMap(([t, n]) => Array.from({ length: n ?? 0 }, () => newRegiment(sim, t as UnitType)));
  const ger: string[] = [];
  for (let i = 0; i < 10; i++) ger.push(createArmy(sim, 'ger', gerBorder[i % gerBorder.length], regs({ infantry: 8, artillery: 2, cavalry: 1, armour: 1 })).id);
  const big = createArmy(sim, 'pol', 'poznan', regs({ infantry: 28, artillery: 8, cavalry: 3, engineers: 1 }));
  big.name = 'Army Poznań';
  const stack = big.id;
  for (const p of ['katowice', 'northwarsaw', 'grodno']) createArmy(sim, 'pol', p, regs({ infantry: 4 }));
  const field = gerBorder[Math.floor(gerBorder.length / 2)];
  st.provinces[field].airfield = Math.max(2, st.provinces[field].airfield);
  for (const t of ['fighter', 'fighter', 'attack', 'attack'] as const) createWing(sim, 'ger', field, t);
  st.provinces.warsaw && (st.provinces.warsaw.airfield = Math.max(1, st.provinces.warsaw.airfield));
  const pf = st.provinces.warsaw ? 'warsaw' : 'poznan';
  st.provinces[pf].airfield = Math.max(1, st.provinces[pf].airfield);
  for (const t of ['fighter', 'fighter'] as const) createWing(sim, 'pol', pf, t);
  return { sim, stack, ger };
}

/**
 * The natural case: Europe 1936 as Germany, the first year played by the AI for
 * every realm (Germany included: its buildup as a computer would do it), then
 * Germany becomes the player's again, its army brought to 100 regiments (the
 * player's "stronger military"), and the player declares war on Poland through
 * the ordinary command (the non-aggression pact set aside): Poland's allies
 * France and Romania join by their treaties. Poland's army, as the AI keeps it,
 * stands in one concentration of about 40 regiments.
 */
export function natural(seed: number): Concentration {
  const sim = createGame({ scenario: SCENARIO, seed, playerNation: 'ger' });
  const st = sim.state;
  st.nations.ger.isPlayer = false;
  for (let w = 0; w < 52; w++) step(sim);
  st.nations.ger.isPlayer = true;
  const regs = (mix: Partial<Record<UnitType, number>>) => Object.entries(mix).flatMap(([t, n]) => Array.from({ length: n ?? 0 }, () => newRegiment(sim, t as UnitType)));
  const have = Object.values(st.armies).filter((a) => a.nation === 'ger').reduce((n, a) => n + a.regiments.length, 0);
  const border = sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger' && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === 'pol')).sort();
  for (let i = 0, left = 100 - have; left > 0; i++) {
    const k = Math.min(12, left);
    createArmy(sim, 'ger', border[i % border.length], regs({ infantry: k - 3, artillery: 2, armour: 1 }));
    left -= k;
  }
  st.nations.ger.treasury = Math.max(st.nations.ger.treasury, 1500);
  st.nations.ger.materiel = Math.max(st.nations.ger.materiel, 1500);
  breakTies(sim, 'ger', 'pol');
  removeTreaty(sim, 'nap', 'ger', 'pol');
  if (ALLIES === 'alone')
    for (const b of ['fra', 'rom']) {
      breakTies(sim, 'pol', b);
      for (const t of ['alliance', 'nap'] as const) removeTreaty(sim, t, 'pol', b);
    }
  const goal = sim.world.provIds.filter((p) => st.provinces[p].owner === 'pol' && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === 'ger')).slice(0, 2);
  const r = applyCommand(sim, { type: 'declareWar', nation: 'ger', target: 'pol', goal: { type: 'conquest', provinces: goal } } as Command);
  if (!r.ok) throw new Error(`declare: ${r.reason}`);
  const pol = Object.values(st.armies).filter((a) => a.nation === 'pol').sort((a, b) => b.regiments.length - a.regiments.length);
  return { sim, stack: pol[0].id, ger: Object.values(st.armies).filter((a) => a.nation === 'ger').map((a) => a.id) };
}

interface Side {
  nations: string[];
  armies: number;
  regs: number;
  men: number;
  line: number;
  support: number;
  /** regiments that fit the frontage at the start */
  engaged: number;
  supply: string;
  morale: number;
}
interface BattleTrace {
  id: string;
  week: number;
  province: string;
  terrain: string;
  frontage: number;
  fort: number;
  river: boolean;
  defEntrenchWeeks: number;
  stack: boolean;
  big: boolean;
  gerSide: 'att' | 'def';
  att: Side;
  def: Side;
  forecast?: string;
  joins: Array<{ week: number; side: 'att' | 'def'; regs: number }>;
  support: { att: number; def: number };
  rounds?: number;
  winner?: string;
  attLoss?: number;
  defLoss?: number;
}

function side(sim: Sim, ids: string[], pid: ProvinceId): Side {
  const arm = ids.map((i) => sim.state.armies[i]).filter((a): a is Army => !!a);
  const terr = TERRAIN[sim.world.prov[pid].terrain];
  let line = 0;
  let support = 0;
  for (const a of arm) for (const r of a.regiments) (UNITS[r.type].role === 'support' ? support++ : line++);
  const men = arm.reduce((s, a) => s + menOf(a), 0);
  const mm = arm.length ? maxMorale(sim, arm[0].nation) : 1;
  return {
    nations: [...new Set(arm.map((a) => a.nation))],
    armies: arm.length,
    regs: line + support,
    men,
    line,
    support,
    engaged: Math.min(line, terr.frontage) + Math.min(support, Math.ceil(terr.frontage / 2)),
    supply: arm.length ? supplyStatus(Math.min(...arm.map((a) => a.supply))) : '-',
    morale: arm.length ? +(arm.reduce((s, a) => s + (a.morale / mm) * menOf(a), 0) / Math.max(1, men)).toFixed(2) : 0,
  };
}

interface Run {
  workflow: string;
  seed: number;
  inputs: number;
  autoOrders: number;
  taken: number;
  polLand: number;
  /** German provinces held by an enemy at the end */
  gerLandLost: number;
  /** battles against an enemy army of 30+ regiments (any enemy) */
  bigStack: { battles: number; won: number };
  gerMenLost: number;
  polMenLost: number;
  stackMenEnd: number;
  stackDestroyedWeek: number | null;
  battles: { total: number; gerWon: number; gerLost: number; gerAttacks: number; gerAttacksOutnumbered: number; stackBattles: number; stackWon: number };
  /** German regiments in battle against the concentration, per stack battle, against the regiments Germany had */
  stackCommit: Array<{ week: number; province: string; gerRegs: number; gerEngaged: number; polRegs: number; joinsLater: number; winner: string | undefined }>;
  idleArmyWeeks: number;
  armyWeeks: number;
  issues: string[];
  traces: BattleTrace[];
  invariantFailures: string[];
}

function run(workflow: 'delegated' | 'auto' | 'greedy' | 'massed', seed: number): Run {
  const { sim, stack, ger } = SETUP === 'natural' ? natural(seed) : concentration(seed);
  const st = sim.state;
  const polStart = sim.world.provIds.filter((p) => st.provinces[p].controller === 'pol');
  const men0 = { ger: st.nations.ger.stats.menLost, pol: st.nations.pol.stats.menLost };
  const bw0 = st.nations.ger.stats.battlesWon;
  const bl0 = st.nations.ger.stats.battlesLost;
  const aw0 = { a: st.nations.ger.stats.armyWeeks, i: st.nations.ger.stats.idleArmyWeeks };
  const auto0 = commandStats.auto;
  let inputs = 0;
  const cmd = (c: Command, cost: number) => {
    const r = applyCommand(sim, c);
    inputs += cost;
    return r;
  };
  const issues: string[] = [];
  const traces = new Map<string, BattleTrace>();
  const res: Run = {
    workflow,
    seed,
    inputs: 0,
    autoOrders: 0,
    taken: 0,
    polLand: polStart.length,
    gerLandLost: 0,
    bigStack: { battles: 0, won: 0 },
    gerMenLost: 0,
    polMenLost: 0,
    stackMenEnd: 0,
    stackDestroyedWeek: null,
    battles: { total: 0, gerWon: 0, gerLost: 0, gerAttacks: 0, gerAttacksOutnumbered: 0, stackBattles: 0, stackWon: 0 },
    stackCommit: [],
    idleArmyWeeks: 0,
    armyWeeks: 0,
    issues,
    traces: [],
    invariantFailures: [],
  };
  const gerArmies = () => Object.values(st.armies).filter((a) => a.nation === 'ger');
  const wings = Object.values(st.wings).filter((w) => w.nation === 'ger');
  let opId: string | null = null;
  if (workflow === 'auto') {
    // Simple Auto-conquer: the current enemies chosen, Activate (every free force joins); defaults
    const enemies = Object.keys(st.nations).filter((e) => st.nations[e].alive && atWar(sim, 'ger', e));
    const r = cmd({ type: 'createOp', nation: 'ger', kind: 'war', area: [], enemies, activate: true }, 3);
    if (!r.ok) issues.push(`createOp: ${r.reason}`);
    opId = Object.keys(st.operations).at(-1) ?? null;
  } else if (workflow === 'delegated') {
    const r = cmd({ type: 'createOp', nation: 'ger', kind: 'conquer', area: polStart, units: [...ger, ...wings.map((w) => w.id)], activate: true, name: 'Poland' }, 4);
    if (!r.ok) issues.push(`createOp: ${r.reason}`);
    opId = Object.keys(st.operations).at(-1) ?? null;
  } else {
    // the wings: fighters keep the sky, attack wings support (one order each, 3 inputs)
    const front = 'poznan';
    for (const w of wings) cmd({ type: 'airMission', nation: 'ger', wing: w.id, mission: w.type === 'fighter' ? 'superiority' : 'support', target: front }, 3);
  }
  // massed: the gathering point is the German border province next to the concentration
  let rally: ProvinceId | null = null;
  let phase: 'gather' | 'strike' | 'occupy' = 'gather';
  const traceBattles = (w: number) => {
      for (const b of Object.values(st.battles)) {
        const gerSide = b.attackerNations.includes('ger') ? 'att' : b.defenderNations.includes('ger') ? 'def' : null;
        if (!gerSide) continue;
        let t = traces.get(b.id);
        if (!t) {
          const defArm = b.defenders.map((i) => st.armies[i]).filter(Boolean);
          t = {
            id: b.id,
            week: w,
            province: b.province,
            terrain: sim.world.prov[b.province].terrain,
            frontage: TERRAIN[sim.world.prov[b.province].terrain].frontage,
            fort: st.provinces[b.province].fort,
            river: !!b.river,
            defEntrenchWeeks: defArm.length ? Math.max(...defArm.map((a) => a.stationary)) : 0,
            stack: b.attackers.includes(stack) || b.defenders.includes(stack),
          big: [...b.attackers, ...b.defenders].some((i) => st.armies[i] && st.armies[i].nation !== 'ger' && st.armies[i].regiments.length >= 30),
            gerSide,
            att: side(sim, b.attackers, b.province),
            def: side(sim, b.defenders, b.province),
            joins: [],
            support: { att: 0, def: 0 },
          };
          const att = b.attackers.map((i) => st.armies[i]).filter(Boolean);
          const def = b.defenders.map((i) => st.armies[i]).filter(Boolean);
          t.forecast = forecastBattle(sim, b.province, att, def).verdict;
          traces.set(b.id, t);
        } else {
          const now = { att: b.attackers.length, def: b.defenders.length };
          const had = { att: t.att.armies + t.joins.filter((j) => j.side === 'att').length, def: t.def.armies + t.joins.filter((j) => j.side === 'def').length };
          for (const sd of ['att', 'def'] as const)
            if (now[sd] > had[sd]) {
              const ids = sd === 'att' ? b.attackers : b.defenders;
              const added = ids.slice(had[sd]).map((i) => st.armies[i]).filter(Boolean);
              t.joins.push({ week: w, side: sd, regs: added.reduce((n, a) => n + a.regiments.length, 0) });
            }
        }
        const sum = (l?: { value: number }[]) => (l ?? []).reduce((s, x) => s + x.value, 0);
        t.support.att = Math.max(t.support.att, +sum(b.support?.att).toFixed(2));
        t.support.def = Math.max(t.support.def, +sum(b.support?.def).toFixed(2));
      }
  };
  for (let w = 1; w <= WEEKS; w++) {
    const mm = maxMorale(sim, 'ger');
    const fit = (a: Army) => !a.battle && !a.retreating && !a.embarked && a.morale >= mm * 0.5;
    const nearestEnemy = (a: Army): ProvinceId | null => {
      const r = reachFrom(sim, 'ger', a.location);
      let best: ProvinceId | null = null;
      let bd = Infinity;
      for (const [p, d] of Object.entries(r.dist)) {
        const c = st.provinces[p].controller;
        if (!c || !atWar(sim, 'ger', c)) continue;
        if (d < bd || (d === bd && best && p < best)) (bd = d), (best = p);
      }
      return best;
    };
    if (workflow === 'greedy') {
      for (const a of gerArmies()) {
        if (a.path.length || !fit(a)) continue;
        const ctrl = st.provinces[a.location].controller;
        if (ctrl && atWar(sim, 'ger', ctrl)) continue;
        const best = nearestEnemy(a);
        if (best) cmd({ type: 'move', nation: 'ger', army: a.id, dest: best }, 2);
      }
    } else if (workflow === 'massed') {
      const s = st.armies[stack];
      if (!rally) {
        // the German border province nearest the concentration
        const loc = s?.location ?? 'poznan';
        rally = sim.world.provIds.filter((p) => st.provinces[p].controller === 'ger' && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === 'pol')).sort((x, y) => (sim.world.hop(x, loc) ?? 99) - (sim.world.hop(y, loc) ?? 99) || (x < y ? -1 : 1))[0];
        for (const a of gerArmies()) if (a.location !== rally) cmd({ type: 'move', nation: 'ger', army: a.id, dest: rally }, 2);
      }
      const here = gerArmies().filter((a) => a.location === rally && !a.battle);
      if (phase === 'gather') {
        // merge whatever has arrived into armies of up to 40 regiments (select the armies there, Merge: 2 inputs)
        if (here.length >= 2) {
          const groups: Army[][] = [];
          for (const a of here.sort((x, y) => y.regiments.length - x.regiments.length)) {
            const g = groups.find((x) => x.reduce((n, y) => n + y.regiments.length, 0) + a.regiments.length <= C.army.maxRegiments);
            if (g) g.push(a);
            else groups.push([a]);
          }
          for (const g of groups) if (g.length > 1) cmd({ type: 'merge', nation: 'ger', armies: g.map((a) => a.id) }, 2);
        }
        const all = gerArmies().reduce((n, a) => n + a.regiments.length, 0);
        const at = gerArmies().filter((a) => a.location === rally).reduce((n, a) => n + a.regiments.length, 0);
        if (at >= all * 0.9) phase = 'strike';
      }
      if (phase === 'strike') {
        if (!s || menOf(s) < 12000) phase = 'occupy';
        else {
          const mass = gerArmies().filter((a) => fit(a) && !a.path.length);
          // strike together when it stands next to us; otherwise step towards it together
          const target = s.location;
          for (const a of mass) {
            const r = reachFrom(sim, 'ger', a.location);
            if (r.dist[target] === undefined) continue;
            cmd({ type: 'move', nation: 'ger', army: a.id, dest: target }, 2);
          }
        }
      }
      if (phase === 'occupy') {
        for (const a of gerArmies()) {
          if (a.path.length || !fit(a)) continue;
          const ctrl = st.provinces[a.location].controller;
          if (ctrl && atWar(sim, 'ger', ctrl)) continue;
          // split the big armies into two for the occupation (2 inputs)
          if (a.regiments.length >= 24) {
            const inf = a.regiments.filter((r) => r.type === 'infantry').length;
            cmd({ type: 'split', nation: 'ger', army: a.id, counts: { infantry: Math.floor(inf / 2), artillery: 1 } }, 2);
          }
          const best = nearestEnemy(a);
          if (best) cmd({ type: 'move', nation: 'ger', army: a.id, dest: best }, 2);
        }
      }
    }
    // the week slice by slice: battles are traced as soon as contact is made, before they are fought
    const slices = weekSlices(sim);
    while (!slices.next().done) traceBattles(w);
    traceBattles(w);
    for (const rep of st.reports) {
      const t = traces.get(rep.id);
      if (t && t.winner === undefined && rep.tick <= st.tick) {
        t.winner = rep.winner;
        t.rounds = rep.rounds;
        t.attLoss = rep.attLosses;
        t.defLoss = rep.defLosses;
      }
    }
    if (res.stackDestroyedWeek === null && !st.armies[stack]) res.stackDestroyedWeek = w;
    const bad = checkInvariants(sim);
    if (bad.length) res.invariantFailures.push(`week ${w}: ${bad.slice(0, 2).join('; ')}`);
    if (opId && st.operations[opId]?.issue && w % 5 === 0) issues.push(`week ${w}: ${st.operations[opId].issue!.text}`);
  }
  res.inputs = inputs;
  res.autoOrders = commandStats.auto - auto0;
  res.taken = polStart.filter((p) => st.provinces[p].controller === 'ger').length;
  res.gerLandLost = sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger' && st.provinces[p].controller && atWar(sim, 'ger', st.provinces[p].controller!)).length;
  res.gerMenLost = st.nations.ger.stats.menLost - men0.ger;
  res.polMenLost = st.nations.pol.stats.menLost - men0.pol;
  res.stackMenEnd = st.armies[stack] ? menOf(st.armies[stack]) : 0;
  res.idleArmyWeeks = st.nations.ger.stats.idleArmyWeeks - aw0.i;
  res.armyWeeks = st.nations.ger.stats.armyWeeks - aw0.a;
  const tr = [...traces.values()];
  res.traces = tr;
  res.battles.total = tr.length;
  res.battles.gerWon = st.nations.ger.stats.battlesWon - bw0;
  res.battles.gerLost = st.nations.ger.stats.battlesLost - bl0;
  res.battles.gerAttacks = tr.filter((t) => t.gerSide === 'att').length;
  res.battles.gerAttacksOutnumbered = tr.filter((t) => t.gerSide === 'att' && t.att.men < t.def.men).length;
  res.battles.stackBattles = tr.filter((t) => t.stack).length;
  res.bigStack.battles = tr.filter((t) => t.big).length;
  res.bigStack.won = tr.filter((t) => t.big && t.winner === (t.gerSide === 'att' ? 'attacker' : 'defender')).length;
  res.battles.stackWon = tr.filter((t) => t.stack && t.winner === t.gerSide.replace('att', 'attacker').replace('def', 'defender')).length;
  res.stackCommit = tr
    .filter((t) => t.stack)
    .map((t) => {
      const g = t.gerSide === 'att' ? t.att : t.def;
      const p = t.gerSide === 'att' ? t.def : t.att;
      return { week: t.week, province: t.province, gerRegs: g.regs, gerEngaged: g.engaged, polRegs: p.regs, joinsLater: t.joins.filter((j) => j.side === t.gerSide).reduce((n, j) => n + j.regs, 0), winner: t.winner };
    });
  return res;
}

function main(): void {
  const flows = (ONLY ? ONLY.split(',') : ['auto', 'delegated', 'greedy', 'massed']) as Array<'delegated' | 'auto' | 'greedy' | 'massed'>;
  const out: Run[] = [];
  for (const seed of SEEDS)
    for (const f of flows) {
      const r = run(f, seed);
      out.push(r);
      const sc = r.stackCommit.map((x) => `w${x.week} ${x.gerRegs}v${x.polRegs}${x.joinsLater ? `+${x.joinsLater}` : ''}→${x.winner?.[0] ?? '?'}`).join(' ');
      console.log(
        `seed ${seed} ${f.padEnd(9)} inputs ${String(r.inputs).padStart(3)} auto ${String(r.autoOrders).padStart(3)} taken ${r.taken}/${r.polLand} lost ${r.gerLandLost} big ${r.bigStack.won}/${r.bigStack.battles} men lost ger ${r.gerMenLost} pol ${r.polMenLost} stack ${r.stackMenEnd}${r.stackDestroyedWeek ? ` (gone wk ${r.stackDestroyedWeek})` : ''} battles ${r.battles.gerWon}W/${r.battles.gerLost}L attacks ${r.battles.gerAttacks} (${r.battles.gerAttacksOutnumbered} outnumbered) stack: ${sc} idle ${r.idleArmyWeeks}/${r.armyWeeks}`,
      );
      if (r.invariantFailures.length) console.log('  invariants:', r.invariantFailures.slice(0, 2));
    }
  if (OUT) writeFileSync(OUT, `${JSON.stringify({ weeks: WEEKS, seeds: SEEDS, runs: out }, null, 1)}\n`);
}

if (process.argv[1]?.endsWith('concentration.ts')) main();
