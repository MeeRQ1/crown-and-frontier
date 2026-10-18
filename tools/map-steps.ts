// How long the same ground takes to cross, and how far the same range reaches, on a
// redrawn map and on the revision it replaced: between every two capitals up to six
// provinces apart on the old revision, the provinces on the way, the weeks an infantry
// march takes by the weekly movement rule (speed 1, no modifiers, whoever may pass),
// and the steps an aircraft counts; and the land each realm's supply reaches at the
// start.
//   npx tsx tools/map-steps.ts [--maps europe,europe-1936,earth,earth-1936] [--out file.md]

import { writeFileSync } from 'node:fs';
import '../src/maps/builtin';
import { ensureLegacyMap } from '../src/maps/legacy';
import { landOf } from '../src/sim/construction';
import { createGame } from '../src/sim/game';
import { CostHeap } from '../src/sim/heap';
import { moveCost } from '../src/sim/movement';
import { opDistance } from '../src/sim/reach';
import type { Sim } from '../src/sim/state';
import { supplyDistances, supplyRange } from '../src/sim/supply';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const maps = get('maps', 'europe,europe-1936,earth,earth-1936').split(',');
const out = get('out', '');

/** The cheapest route by movement points from a province to every other, whoever may pass. */
function routes(sim: Sim, from: string): { cost: Record<string, number>; prev: Record<string, string> } {
  const cost: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new CostHeap();
  open.push(0, from);
  while (open.size) {
    const c = open.peekCost();
    const p = open.pop();
    if (c > cost[p]) continue;
    for (const q of sim.world.prov[p].neighbors) {
      const n = c + moveCost(sim, p, q);
      if (n < (cost[q] ?? Infinity)) {
        cost[q] = n;
        prev[q] = p;
        open.push(n, q);
      }
    }
  }
  return { cost, prev };
}

/** Weeks to walk a route at one point a week: a step a week at most, the points left over (up to 1) carried on. */
function weeks(sim: Sim, prev: Record<string, string>, from: string, to: string): number {
  const path: string[] = [];
  for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  let w = 0;
  let p = 0;
  let at = from;
  for (const s of path) {
    const cost = moveCost(sim, at, s);
    do {
      p += 1;
      w++;
    } while (p < cost);
    p = Math.min(p - cost, 1);
    at = s;
  }
  return w;
}

const suppliedLand = (sim: Sim, nid: string) => {
  const d = supplyDistances(sim, nid);
  const r = supplyRange(sim, nid);
  return sim.world.provIds.filter((p) => d[p] <= r).reduce((l, p) => l + landOf(sim, p), 0);
};

const lines = [
  '| Map | Pairs of capitals | Provinces on the way, r1 → r2 | Infantry march (weeks), r1 → r2 | Aircraft steps, r1 → r2 | Land in supply at the start, r2 / r1 (median realm) |',
  '|---|---|---|---|---|---|',
];
for (const id of maps) {
  const alias = (await ensureLegacyMap(id, 1))!;
  const now = createGame({ scenario: id, seed: 1, playerNation: null });
  const before = createGame({ scenario: alias, seed: 1, playerNation: null });
  const caps = before.world.nationIds.map((n) => before.state.nations[n].capital).filter((c): c is string => !!c && !!now.world.prov[c]);
  const sum = { hops: [0, 0], weeks: [0, 0], air: [0, 0] };
  let n = 0;
  for (const a of caps) {
    const [r0, r1] = [routes(before, a), routes(now, a)];
    for (const b of caps) {
      if (b <= a || (before.world.hop(a, b) ?? 99) > 6 || r0.cost[b] === undefined || r1.cost[b] === undefined) continue;
      const air = [opDistance(before, { prov: a }, { prov: b }), opDistance(now, { prov: a }, { prov: b })];
      if (!air.every(Number.isFinite)) continue;
      n++;
      sum.hops[0] += before.world.hop(a, b)!;
      sum.hops[1] += now.world.hop(a, b)!;
      sum.weeks[0] += weeks(before, r0.prev, a, b);
      sum.weeks[1] += weeks(now, r1.prev, a, b);
      sum.air[0] += air[0];
      sum.air[1] += air[1];
    }
  }
  const ratios = now.world.nationIds.filter((x) => before.state.nations[x]?.capital).map((x) => suppliedLand(now, x) / Math.max(1, suppliedLand(before, x))).sort((x, y) => x - y);
  const avg = (x: number[]) => [(x[0] / n).toFixed(2), (x[1] / n).toFixed(2)];
  const pct = (x: number[]) => `${x[1] >= x[0] ? '+' : ''}${Math.round((x[1] / x[0] - 1) * 100)}%`;
  const [h, w, s] = [avg(sum.hops), avg(sum.weeks), avg(sum.air)];
  const name = now.world.scenario.name.replace(/(, \d{4})\1$/, '$1');
  lines.push(`| ${name} | ${n} | ${h[0]} → ${h[1]} (${pct(sum.hops)}) | ${w[0]} → ${w[1]} (${pct(sum.weeks)}) | ${s[0]} → ${s[1]} (${pct(sum.air)}) | ${ratios[Math.floor(ratios.length / 2)].toFixed(2)} |`);
  console.log(lines.at(-1));
}
if (out) writeFileSync(out, lines.join('\n') + '\n');
