// Generates province geometry + adjacency for the Reach (the quick campaign).
//   npm run genmap            -> writes src/data/reach.map.json and reports/map-preview.svg
// Seed positions come from src/data/reach.ts; the Voronoi/noisy-edge core is
// shared with the Aldmere generator (tools/mapgen/core.ts). The output must not
// change: saved Reach campaigns depend on these province ids and neighbours.

import { mkdirSync, writeFileSync } from 'node:fs';
import {
  FORCED_SEA,
  MAP_BOUNDS,
  OUTLINE,
  REACH_NATIONS,
  REACH_PROVINCES,
  REACH_PROVINCE_SEEDS,
  STRAITS,
  WASTE_SEEDS,
} from '../src/data/reach';
import { buildMap, fillSea, previewSvg, type Seed } from './mapgen/core';

const B = MAP_BOUNDS;
const seeds: Seed[] = [];
for (const s of REACH_PROVINCE_SEEDS) seeds.push({ kind: 'prov', id: s.id, x: s.x, y: s.y });
WASTE_SEEDS.forEach(([x, y, k], i) => seeds.push({ kind: k, id: `~${k}${i}`, x, y }));
FORCED_SEA.forEach(([x, y], i) => seeds.push({ kind: 'sea', id: `~fsea${i}`, x, y }));
fillSea(seeds, B, [OUTLINE], { spacing: 72, clearance: 88, seaGap: 40, seed: 1234 });

const built = buildMap(seeds, B, STRAITS);
const { provinces: provincesOut, neighbors, edges: edgesOut, waste: wasteOut, warnings } = built;

const out = {
  generated: 'tools/genmap.ts — do not edit by hand',
  bounds: B,
  provinces: provincesOut,
  neighbors,
  edges: edgesOut,
  waste: wasteOut,
  straits: STRAITS,
};
writeFileSync(new URL('../src/data/reach.map.json', import.meta.url), JSON.stringify(out));
// the simulation only needs adjacency; the browser loads the geometry on demand
writeFileSync(new URL('../src/data/reach.adjacency.json', import.meta.url), JSON.stringify({ generated: out.generated, neighbors }));

{
  const owner = new Map(REACH_PROVINCES.map((p) => [p.id, p.owner]));
  const color = new Map(REACH_NATIONS.map((n) => [n.id, n.color]));
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../reports/map-preview.svg', import.meta.url), previewSvg(B, built, STRAITS, (id) => owner.get(id) ?? null, (n) => color.get(n)!));
}

const areas = Object.entries(provincesOut).map(([id, p]) => [id, p.area] as const).sort((a, b) => a[1] - b[1]);
console.log(`seeds: ${seeds.length} (${built.provIndex.size} provinces)`);
console.log(`smallest: ${areas.slice(0, 5).map((a) => a.join('=')).join(', ')}`);
console.log(`largest: ${areas.slice(-5).map((a) => a.join('=')).join(', ')}`);
if (warnings.length) console.log('WARNINGS:\n  ' + warnings.join('\n  '));
else console.log('no warnings');
