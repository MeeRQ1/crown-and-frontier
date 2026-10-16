// The 100-regiment demonstration (simulation, deterministic): the large-force
// campaign (tools/qol-scenario.ts: Europe 1936 as Germany, 13 armies with 110
// regiments, 3 fleets, 8 wings, at war with Poland, Romania and France) played
// for 26 weeks in two workflows from the same start and seed:
//
//  manual     a diligent player commanding every unit: each week every idle fit
//             army is ordered to the nearest enemy-held province (select + right-
//             click: 2 inputs an order); wings and fleets get one order at the
//             start (3 inputs each) and keep it
//  delegated  operations: East (conquer the Polish border land, airborne mandate
//             for one drop), West (hold the French border), Baltic (keep the seas)
//             and a landing on the Polish coast; then the player intervenes as a
//             player would: a direct order (override) and its resumption, a pause
//             and resume, a change of posture; a save and load half way, checked
//             to play on identically
//
// Measured: inputs, provinces taken, losses, battles, what the operations did
// (orders, detachments, merges, drops, landings, issues), planning cost per week,
// invariants each week. Writes reports/qol/demo.json and prints a summary.
//   npx tsx tools/qol-demo.ts [--weeks 26] [--seed 3] [--out reports/qol/demo.json]

import { writeFileSync } from 'node:fs';
import { reachFrom, threatAround } from '../src/sim/ai/common';
import { applyCommand, commandStats } from '../src/sim/commands';
import { checkInvariants } from '../src/sim/invariants';
import { maxMorale } from '../src/sim/military';
import { pathToCoast, portsOf } from '../src/sim/naval';
import { opForces } from '../src/sim/ops/operations';
import { readSave, serialize } from '../src/sim/save';
import { atWar, type Sim } from '../src/sim/state';
import { step, type PhaseProfile } from '../src/sim/tick';
import type { Command, ProvinceId } from '../src/sim/types';
import { largeForce } from './qol-scenario';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const WEEKS = Number(get('weeks', '26'));
const SEED = Number(get('seed', '3'));
const OUT = get('out', 'reports/qol/demo.json');

interface RunResult {
  workflow: string;
  inputs: number;
  inputsByWeek: number[];
  taken: number;
  lost: number;
  gerMenLost: number;
  enemyMenLost: number;
  battlesWon: number;
  battlesLost: number;
  regimentsEnd: number;
  ops?: Record<string, unknown>;
  autoOrders?: number;
  planMs: { mean: number; max: number };
  stepMs: { mean: number; max: number };
  invariantFailures: string[];
  events: string[];
}

const ENEMIES = ['pol', 'rom', 'fra'];

function enemyHeld(sim: Sim): Set<ProvinceId> {
  return new Set(sim.world.provIds.filter((p) => ENEMIES.includes(sim.state.provinces[p].controller ?? '')));
}

function gerHeldFromEnemies(sim: Sim, start: Set<ProvinceId>): number {
  let n = 0;
  for (const p of start) if (sim.state.provinces[p].controller === 'ger' || sim.state.provinces[p].controller === 'ita') n++;
  return n;
}

function run(workflow: 'manual' | 'delegated'): RunResult {
  const force = largeForce(SEED);
  const sim = force.sim;
  const st = sim.state;
  const start = enemyHeld(sim);
  const gerStart = sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger');
  const prof: PhaseProfile = { now: () => performance.now(), last: {} };
  const res: RunResult = { workflow, inputs: 0, inputsByWeek: [], taken: 0, lost: 0, gerMenLost: 0, enemyMenLost: 0, battlesWon: 0, battlesLost: 0, regimentsEnd: 0, planMs: { mean: 0, max: 0 }, stepMs: { mean: 0, max: 0 }, invariantFailures: [], events: [] };
  const men0 = { ger: st.nations.ger.stats.menLost, enemy: ENEMIES.reduce((s, n) => s + st.nations[n].stats.menLost, 0) };
  const bw0 = st.nations.ger.stats.battlesWon;
  const bl0 = st.nations.ger.stats.battlesLost;
  let inputs = 0;
  const cmd = (c: Command, cost: number) => {
    const r = applyCommand(sim, c);
    inputs += cost;
    return r;
  };
  const auto0 = commandStats.auto;
  const ger = () => Object.values(st.armies).filter((a) => a.nation === 'ger');
  const opIds: Record<string, string> = {};
  if (workflow === 'manual') {
    // wings: one mission each at the start; fleets: one standing order each
    for (const w of Object.values(st.wings).filter((x) => x.nation === 'ger')) {
      const target = w.type === 'fighter' ? 'superiority' : w.type === 'attack' ? 'support' : w.type === 'bomber' ? 'interdiction' : null;
      if (!target) continue;
      const near = [...start].sort((a, b) => (sim.world.hop(w.base, a) ?? 99) - (sim.world.hop(w.base, b) ?? 99) || (a < b ? -1 : 1))[0];
      cmd({ type: 'airMission', nation: 'ger', wing: w.id, mission: target, target: near }, 3);
    }
    for (const f of Object.values(st.fleets).filter((x) => x.nation === 'ger')) cmd({ type: 'fleetDuty', nation: 'ger', fleet: f.id, duty: { kind: 'patrol', zone: f.zone } }, 3);
  } else {
    // the operations, as the interface creates them: select (a box: 1), New operation (1), the area (1-3), Activate (1)
    const eastArmies = force.east.filter((id) => st.armies[id]);
    const westArmies = force.west.filter((id) => st.armies[id]);
    const wings = Object.values(st.wings).filter((w) => w.nation === 'ger');
    const fleets = Object.values(st.fleets).filter((f) => f.nation === 'ger');
    const baltic = fleets.find((f) => /Baltic/.test(f.name))!;
    const polLand = sim.world.provIds.filter((p) => st.provinces[p].controller === 'pol' && force.east.some((a) => (sim.world.hop(st.armies[a].location, p) ?? 99) <= 5));
    // the landing force: four infantry regiments split off an eastern army at a Baltic port (one split: 2 inputs)
    const port = portsOf(sim, 'ger').find((p) => (sim.world.provZones[p] ?? []).includes(baltic.zone))!;
    const donor = st.armies[eastArmies[1]];
    st.armies[donor.id].location = port;
    cmd({ type: 'split', nation: 'ger', army: donor.id, counts: { infantry: 4 } }, 2);
    const landingArmy = `a${st.counters.army}`;
    // the beach: an enemy coast the Baltic Squadron can sail to (nearest first)
    const beach =
      sim.world.provIds
        // overseas: an enemy coast not next to land of ours (the armies would take that anyway)
        .filter((p) => ENEMIES.includes(st.provinces[p].controller ?? '') && (sim.world.provZones[p] ?? []).length && !sim.world.prov[p].neighbors.some((n) => ['ger', 'ita'].includes(st.provinces[n].controller ?? '')))
        .map((p) => ({ p, route: pathToCoast(sim, baltic.zone, p), threat: threatAround(sim, 'ger', p, 1) }))
        // as a player would: a coast with no enemy army on it or next to it
        .filter((x) => x.route && x.threat === 0)
        .sort((a, b) => a.route!.length - b.route!.length || (a.p < b.p ? -1 : 1))[0]?.p ?? null;
    const transports = fleets.filter((f) => f.ships.some((s) => s.type === 'transport') && f.id === baltic.id);
    const make = (c: Command, cost: number, key: string) => {
      const r = cmd(c, cost);
      if (!r.ok) res.events.push(`${key}: ${r.reason}`);
      else opIds[key] = Object.values(st.operations).map((o) => o.id).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).at(-1)!;
    };
    make({ type: 'createOp', nation: 'ger', kind: 'conquer', area: polLand, units: [...eastArmies.filter((id) => st.armies[id]), ...wings.filter((w) => w.type !== 'bomber').map((w) => w.id)], settings: { airborne: 'once', airborneRisk: 0.35, rebase: true }, activate: true, name: 'East' }, 5, 'east');
    const westArea = sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger' && sim.world.prov[p].neighbors.some((n) => ['fra', 'bel', 'lux'].includes(st.provinces[n].owner ?? '')));
    make({ type: 'createOp', nation: 'ger', kind: 'hold', area: westArea, units: [...westArmies, ...wings.filter((w) => w.type === 'bomber').map((w) => w.id)], settings: { rebase: true }, activate: true, name: 'West' }, 5, 'west');
    const balticZones = [...new Set(fleets.map((f) => f.zone))];
    make({ type: 'createOp', nation: 'ger', kind: 'sea', area: [], zones: balticZones, units: fleets.filter((f) => !transports.includes(f)).map((f) => f.id), activate: true, name: 'Baltic' }, 5, 'sea');
    if (beach) make({ type: 'createOp', nation: 'ger', kind: 'landing', area: [beach], units: [landingArmy, ...transports.map((f) => f.id)], activate: true, name: 'Landing' }, 5, 'landing');
    res.events.push(`operations created: ${Object.keys(opIds).join(', ')}${beach ? `; beach ${beach}` : '; no Polish beach found'}`);
  }
  const plan: number[] = [];
  const total: number[] = [];
  let checkedReload = false;
  for (let w = 1; w <= WEEKS; w++) {
    const before = inputs;
    if (workflow === 'manual') {
      // each idle fit army to the nearest enemy-held province (2 inputs an order)
      const mm = maxMorale(sim, 'ger');
      for (const a of ger()) {
        if (a.path.length || a.battle || a.retreating || a.embarked || a.morale < mm * 0.5) continue;
        const ctrl = st.provinces[a.location].controller;
        if (ctrl && atWar(sim, 'ger', ctrl)) continue; // besieging
        const r = reachFrom(sim, 'ger', a.location);
        let best: ProvinceId | null = null;
        let bd = Infinity;
        for (const [p, d] of Object.entries(r.dist)) {
          const c = st.provinces[p].controller;
          if (!c || !atWar(sim, 'ger', c)) continue;
          if (d < bd || (d === bd && best && p < best)) (bd = d), (best = p);
        }
        if (best) cmd({ type: 'move', nation: 'ger', army: a.id, dest: best }, 2);
      }
    } else {
      const east = opIds.east ? st.operations[opIds.east] : undefined;
      const west = opIds.west ? st.operations[opIds.west] : undefined;
      if (w === 6 && east) {
        // a direct order to an army of East: taken under direct command at once
        const a = opForces(sim, east.id).armies[0];
        const home = st.nations.ger.capital!;
        if (a && cmd({ type: 'move', nation: 'ger', army: a.id, dest: home }, 2).ok) res.events.push(`week 6: ${a.name} ordered home by the player: held ${st.armies[a.id].opHold}`);
      }
      if (w === 9 && east) {
        const held = opForces(sim, east.id).armies.filter((a) => a.opHold).map((a) => a.id);
        if (held.length) cmd({ type: 'resumeUnits', nation: 'ger', units: held }, 1);
        res.events.push(`week 9: resumed ${held.length}`);
      }
      if (w === 10 && west) cmd({ type: 'opState', nation: 'ger', op: west.id, state: 'paused' }, 1), res.events.push('week 10: West paused');
      if (w === 12 && west) cmd({ type: 'opState', nation: 'ger', op: west.id, state: 'active' }, 1), res.events.push('week 12: West resumed');
      if (w === 14 && east) cmd({ type: 'editOp', nation: 'ger', op: east.id, settings: { posture: 'aggressive' } }, 2), res.events.push('week 14: East aggressive');
      // half way: a save and load must play on identically
      if (w === Math.floor(WEEKS / 2) && !checkedReload) {
        checkedReload = true;
        const copy = readSave(serialize(sim)).sim;
        const a = JSON.parse(JSON.stringify(sim.state));
        for (let k = 0; k < 4; k++) step(copy);
        const b = readSave(serialize(sim)).sim;
        for (let k = 0; k < 4; k++) step(b);
        res.events.push(`week ${w}: save and load, 4 weeks played twice from the save: ${JSON.stringify(copy.state) === JSON.stringify(b.state) ? 'identical' : 'DIFFERENT'}; operations in the save ${Object.keys(a.operations).length}`);
      }
    }
    res.inputsByWeek.push(inputs - before);
    const t = performance.now();
    step(sim, { profile: prof });
    total.push(performance.now() - t);
    plan.push(prof.last.operations ?? 0);
    const bad = checkInvariants(sim);
    if (bad.length) res.invariantFailures.push(`week ${w}: ${bad.slice(0, 3).join('; ')}`);
  }
  res.inputs = inputs;
  res.taken = gerHeldFromEnemies(sim, start);
  res.lost = gerStart.filter((p) => st.provinces[p].controller !== 'ger').length;
  res.gerMenLost = Math.round(st.nations.ger.stats.menLost - men0.ger);
  res.enemyMenLost = Math.round(ENEMIES.reduce((s, n) => s + st.nations[n].stats.menLost, 0) - men0.enemy);
  res.battlesWon = st.nations.ger.stats.battlesWon - bw0;
  res.battlesLost = st.nations.ger.stats.battlesLost - bl0;
  res.regimentsEnd = ger().reduce((n, a) => n + a.regiments.length, 0);
  res.planMs = { mean: +(plan.reduce((s, x) => s + x, 0) / plan.length).toFixed(2), max: +Math.max(...plan).toFixed(2) };
  res.stepMs = { mean: +(total.reduce((s, x) => s + x, 0) / total.length).toFixed(1), max: +Math.max(...total).toFixed(1) };
  if (workflow === 'delegated') {
    res.autoOrders = commandStats.auto - auto0;
    res.ops = Object.fromEntries(
      Object.values(st.operations).map((o) => {
        const f = opForces(sim, o.id);
        const text = o.log.map((l) => l.text).join('\n');
        return [
          o.name,
          {
            kind: o.kind,
            status: o.status,
            armies: f.armies.length,
            regiments: f.armies.reduce((n, a) => n + a.regiments.length, 0),
            fleets: f.fleets.length,
            wings: f.wings.length,
            stats: o.stats,
            detachedLive: o.detached.length,
            detachedLogged: (text.match(/detached \d+ regiments/g) ?? []).length,
            merges: (text.match(/merged|regrouped/g) ?? []).length,
            rebases: (text.match(/moved to the airfield/g) ?? []).length,
            issue: o.issue?.text ?? null,
            tasks: Object.values(o.tasks).reduce<Record<string, number>>((m, t) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {}),
            lastLog: o.log.slice(-6).map((l) => `wk ${l.tick}: ${l.text}`),
          },
        ];
      }),
    );
  }
  return res;
}

const manual = run('manual');
const delegated = run('delegated');
const out = { weeks: WEEKS, seed: SEED, manual, delegated };
writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
for (const r of [manual, delegated]) {
  console.log(`${r.workflow}: inputs ${r.inputs} (${r.inputsByWeek.slice(0, 8).join(',')}…), taken ${r.taken}, lost ${r.lost}, men lost ${r.gerMenLost} vs enemy ${r.enemyMenLost}, battles ${r.battlesWon}/${r.battlesLost}, regiments at the end ${r.regimentsEnd}, ops plan ${r.planMs.mean}/${r.planMs.max} ms, step ${r.stepMs.mean}/${r.stepMs.max} ms, invariant failures ${r.invariantFailures.length}${r.autoOrders !== undefined ? `, orders by operations ${r.autoOrders}` : ''}`);
  for (const e of r.events) console.log('  ', e);
}
console.log(JSON.stringify(delegated.ops, null, 1).slice(0, 4000));
