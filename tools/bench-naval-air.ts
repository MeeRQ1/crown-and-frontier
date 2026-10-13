// Simulation cost of naval and air warfare, per week and per phase, in Node:
// loads campaign saves and runs them on, timing each phase of each week.
//
//   npx tsx tools/bench-naval-air.ts [--weeks 48] [--saves a.json,b.json] [--json out.json]
//
// The default saves are the profiler's World 1936 at week 280 and the naval-and-air
// stress workload made from it (tools/naval-air-stress.ts); both were made with the
// baseline commit, so the same campaign is timed before and after a change.

import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import '../src/maps/builtin';
import { readSave } from '../src/sim/save';
import { step, type PhaseProfile } from '../src/sim/tick';

const args = process.argv.slice(2);
const get = (k: string, d = '') => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const weeks = Number(get('weeks', '48'));
const saves = get('saves', '.scratch/profile-saves/earth-1936-w280.json,.scratch/profile-saves/earth-1936-w280-navalair.json').split(',');
const out: Record<string, unknown> = {};
const pct = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? 0;
for (const file of saves) {
  const { sim } = readSave(readFileSync(file, 'utf8'));
  const prof: PhaseProfile = { now: () => performance.now(), last: {} };
  const totals: number[] = [];
  const phases: Record<string, number[]> = {};
  // one warm-up week (lazy caches)
  step(sim);
  for (let w = 0; w < weeks; w++) {
    const t = performance.now();
    step(sim, { profile: prof });
    totals.push(performance.now() - t);
    for (const [k, v] of Object.entries(prof.last)) (phases[k] ??= []).push(v);
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const row = {
    weeks,
    wings: Object.keys(sim.state.wings).length,
    fleets: Object.keys(sim.state.fleets).length,
    meanMs: +mean(totals).toFixed(1),
    p95Ms: +pct(totals, 0.95).toFixed(1),
    maxMs: +Math.max(...totals).toFixed(1),
    phases: Object.fromEntries(
      Object.entries(phases)
        .map(([k, v]): [string, { mean: number; p95: number }] => [k, { mean: +mean(v).toFixed(2), p95: +pct(v, 0.95).toFixed(2) }])
        .sort((a, b) => b[1].mean - a[1].mean),
    ),
  };
  out[file] = row;
  console.log(file, JSON.stringify(row));
}
if (get('json')) writeFileSync(get('json'), JSON.stringify(out, null, 1));
