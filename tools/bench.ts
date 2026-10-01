// Reproducible simulation benchmarks: campaign creation, weekly tick cost
// (average, percentiles, slowest weeks) with a per-phase breakdown, the cost of
// pathfinding, supply and diplomacy calls, state size and heap over a long
// AI-only campaign.
//
//   npx tsx tools/bench.ts --scenario aldmere --seeds 1-2 --years 30 [--json out.json] [--label "before"]
//
// Run with nothing else busy on the machine; the report records the machine,
// Node version and settings so numbers can be compared between revisions.

import { cpus, platform, release, totalmem } from 'node:os';
import { readFileSync, writeFileSync } from 'node:fs';
import { reachFrom } from '../src/sim/ai/common';
import { evaluateTreaty } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/game';
import { findPath } from '../src/sim/movement';
import { seedState, nextFloat } from '../src/sim/rng';
import { aliveNations, type Sim } from '../src/sim/state';
import { supplyDistances } from '../src/sim/supply';
import { step, isOver, type PhaseProfile } from '../src/sim/tick';
import { buildWorld, getWorld, registerMapScenario, scenarioIds } from '../src/sim/world';
import { parseMapPackage } from '../src/maps/validate';

const args = process.argv.slice(2);
const get = (k: string, d?: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
// a map package file (e.g. from tools/genstress.ts) can be benchmarked too
const mapFile = get('map');
let mapScenario: string | undefined;
if (mapFile) {
  const { pkg, check } = parseMapPackage(readFileSync(mapFile, 'utf8'));
  if (!pkg) {
    console.error(`invalid map ${mapFile}: ${check.errors.map((e) => e.message).join('; ')}`);
    process.exit(2);
  }
  registerMapScenario(pkg);
  mapScenario = pkg.id;
}
const scenario = mapScenario ?? get('scenario', 'aldmere')!;
const [s0, s1] = get('seeds', '1-2')!.split('-').map(Number);
const years = Number(get('years', '30'));
const label = get('label', '')!;
const jsonOut = get('json');
const now = () => performance.now();
const gc = (globalThis as { gc?: () => void }).gc;

function pct(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
}
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => pct(xs, 0.5);
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

if (!scenarioIds().includes(scenario)) {
  console.error(`unknown scenario ${scenario}; known: ${scenarioIds().join(', ')}`);
  process.exit(2);
}

// ── creation ──────────────────────────────────────────────────────────────
const worldMs: number[] = [];
const createMs: number[] = [];
for (let i = 0; i < 5; i++) {
  const scen = getWorld(scenario).scenario;
  let t = now();
  buildWorld(scen);
  worldMs.push(now() - t);
  t = now();
  createGame({ scenario, seed: 100 + i, playerNation: null });
  createMs.push(now() - t);
}

// ── call costs on a mid-campaign state ────────────────────────────────────
function callCosts(sim: Sim) {
  const r = seedState(99);
  const ids = sim.world.provIds;
  const nations = aliveNations(sim);
  // routes a realm could actually march: from one of its provinces to any province it may enter
  const pairs: Array<[string, string, string]> = [];
  for (let i = 0; i < 200; i++) {
    const n = nations[Math.floor(nextFloat(r) * nations.length)];
    const own = ids.filter((p) => sim.state.provinces[p].controller === n);
    const reach = reachFrom(sim, n, own[0] ?? ids[0]);
    const targets = Object.keys(reach.dist);
    pairs.push([n, own[Math.floor(nextFloat(r) * own.length)] ?? ids[0], targets[Math.floor(nextFloat(r) * targets.length)]]);
  }
  void ids;
  let t = now();
  let found = 0;
  for (const [n, a, b] of pairs) if (findPath(sim, n, a, b)) found++;
  const findPathMs = (now() - t) / pairs.length;
  t = now();
  for (const [n, a] of pairs.slice(0, 50)) reachFrom(sim, n, a);
  const reachMs = (now() - t) / 50;
  // supply distances are cached per state revision: force cold computation
  t = now();
  for (const n of nations) {
    sim.state.rev++;
    supplyDistances(sim, n);
  }
  const supplyMs = (now() - t) / nations.length;
  t = now();
  let evals = 0;
  for (const a of nations) for (const b of nations) if (a !== b) {
    evaluateTreaty(sim, a, b, 'alliance');
    evals++;
  }
  const treatyMs = (now() - t) / Math.max(1, evals);
  return { findPathMs: r2(findPathMs), pathsFound: found, reachFromMs: r2(reachMs), supplyDistancesMs: r2(supplyMs), evaluateTreatyMs: r2(treatyMs) };
}

// ── campaigns ─────────────────────────────────────────────────────────────
interface Run {
  seed: number;
  weeks: number;
  tick: { avg: number; p50: number; p95: number; p99: number; max: number; maxAt: number };
  phases: Record<string, { avg: number; p99: number; max: number }>;
  slowest: Array<{ tick: number; ms: number; parts: string }>;
  stateKB: Record<string, number>;
  heapMB: Record<string, number>;
  counts: Record<string, { armies: number; wars: number; battles: number; notifications: number; diagnostics: number; memories: number }>;
  calls: ReturnType<typeof callCosts> | null;
}

const runs: Run[] = [];
for (let seed = s0; seed <= (s1 ?? s0); seed++) {
  const sim = createGame({ scenario, seed, playerNation: null, campaignYears: years + 1 });
  const prof: PhaseProfile = { now, last: {} };
  const totals: number[] = [];
  const phaseSeries: Record<string, number[]> = {};
  const slow: Array<{ tick: number; ms: number; parts: Record<string, number> }> = [];
  const stateKB: Record<string, number> = {};
  const heapMB: Record<string, number> = {};
  const counts: Run['counts'] = {};
  let calls: Run['calls'] = null;
  const mark = (k: string) => {
    stateKB[k] = Math.round(JSON.stringify(sim.state).length / 1024);
    gc?.();
    heapMB[k] = r1(process.memoryUsage().heapUsed / 1048576);
    let memories = 0;
    for (const a in sim.state.memories) for (const b in sim.state.memories[a]) memories += sim.state.memories[a][b].length;
    counts[k] = {
      armies: Object.keys(sim.state.armies).length,
      wars: Object.keys(sim.state.wars).length,
      battles: Object.keys(sim.state.battles).length,
      notifications: sim.state.notifications.length,
      diagnostics: sim.state.diagnostics.length,
      memories,
    };
  };
  mark('y0');
  const weeks = years * 48;
  for (let w = 0; w < weeks && !isOver(sim); w++) {
    const t = now();
    step(sim, { profile: prof });
    const ms = now() - t;
    totals.push(ms);
    for (const [k, v] of Object.entries(prof.last)) (phaseSeries[k] ??= []).push(v);
    slow.push({ tick: sim.state.tick, ms, parts: { ...prof.last } });
    if (slow.length > 40) {
      slow.sort((a, b) => b.ms - a.ms);
      slow.length = 20;
    }
    const y = (w + 1) / 48;
    if (Number.isInteger(y) && (y === 1 || y % 10 === 0 || y === years)) mark(`y${y}`);
    if (w + 1 === Math.floor(weeks / 2)) calls = callCosts(sim);
  }
  slow.sort((a, b) => b.ms - a.ms);
  const phases: Run['phases'] = {};
  for (const [k, xs] of Object.entries(phaseSeries)) {
    // monthly phases run every 4th week: report their per-run cost
    phases[k] = { avg: r2(avg(xs)), p99: r2(pct(xs, 0.99)), max: r1(Math.max(...xs)) };
  }
  const maxIdx = totals.indexOf(Math.max(...totals));
  runs.push({
    seed,
    weeks: totals.length,
    tick: { avg: r2(avg(totals)), p50: r2(median(totals)), p95: r2(pct(totals, 0.95)), p99: r2(pct(totals, 0.99)), max: r1(Math.max(...totals)), maxAt: maxIdx },
    phases,
    slowest: slow.slice(0, 5).map((s) => ({
      tick: s.tick,
      ms: r1(s.ms),
      parts: Object.entries(s.parts)
        .filter(([, v]) => v >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${r1(v)}`)
        .join(', '),
    })),
    stateKB,
    heapMB,
    counts,
    calls,
  });
  console.error(`seed ${seed}: ${totals.length} weeks, avg ${r2(avg(totals))} ms, p99 ${r2(pct(totals, 0.99))} ms, max ${r1(Math.max(...totals))} ms`);
}

const world = getWorld(scenario);
const env = {
  label,
  scenario,
  provinces: world.provIds.length,
  realms: world.nationIds.length,
  years,
  seeds: `${s0}-${s1 ?? s0}`,
  node: process.version,
  cpu: `${cpus()[0]?.model ?? '?'} ×${cpus().length}`,
  os: `${platform()} ${release()}`,
  memoryGB: Math.round(totalmem() / 1073741824),
  gcExposed: !!gc,
  date: new Date().toISOString().slice(0, 10),
};
const result = { env, creation: { buildWorldMs: r1(median(worldMs)), createGameMs: r1(median(createMs)) }, runs };
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 1));

const lines: string[] = [];
lines.push(`### ${scenario} (${env.provinces} provinces, ${env.realms} realms)${label ? ` — ${label}` : ''}`, '');
lines.push(`Node ${env.node}, ${env.cpu}, ${env.os}; AI-only, ${years} years, seeds ${env.seeds}; GC exposed: ${env.gcExposed}.`, '');
lines.push(`Creation: world build ${result.creation.buildWorldMs} ms, new campaign ${result.creation.createGameMs} ms (median of 5).`, '');
lines.push('| Seed | Weeks | Avg | p50 | p95 | p99 | Max (week) |', '|---|---|---|---|---|---|---|');
for (const r of runs) lines.push(`| ${r.seed} | ${r.weeks} | ${r.tick.avg} | ${r.tick.p50} | ${r.tick.p95} | ${r.tick.p99} | ${r.tick.max} (${r.tick.maxAt}) |`);
lines.push('', 'Per phase (ms per week it runs; monthly phases run every 4th week), first seed:', '');
lines.push('| Phase | Avg | p99 | Max |', '|---|---|---|---|');
for (const [k, v] of Object.entries(runs[0].phases).sort((a, b) => b[1].avg - a[1].avg)) lines.push(`| ${k} | ${v.avg} | ${v.p99} | ${v.max} |`);
lines.push('', 'Slowest weeks, first seed:', '');
for (const s of runs[0].slowest) lines.push(`- week ${s.tick}: ${s.ms} ms (${s.parts})`);
const c = runs[0].calls;
if (c) lines.push('', `Call costs at mid-campaign: findPath ${c.findPathMs} ms (${c.pathsFound}/200 found), reachFrom ${c.reachFromMs} ms, supply distances (cold, per realm) ${c.supplyDistancesMs} ms, evaluateTreaty ${c.evaluateTreatyMs} ms.`);
lines.push('', `State size (KB): ${Object.entries(runs[0].stateKB).map(([k, v]) => `${k} ${v}`).join(', ')}. Heap (MB): ${Object.entries(runs[0].heapMB).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
lines.push(`Counts: ${Object.entries(runs[0].counts).map(([k, v]) => `${k}: ${v.armies} armies, ${v.wars} wars, ${v.memories} memories`).join('; ')}.`);
console.log(lines.join('\n'));
