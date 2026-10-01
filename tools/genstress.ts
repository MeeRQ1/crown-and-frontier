// Generates a procedural continent as a map package, for measuring how the
// game scales with map size (it is not a designed campaign map).
//
//   npx tsx tools/genstress.ts [--provinces 900] [--nations 24] [--seed 7] [--out path.json]
//
// The output is validated with the same validator as imported maps.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MAP_FORMAT, MAP_FORMAT_VERSION, sizeFor, type MapPackage } from '../src/maps/format';
import { validateMapPackage } from '../src/maps/validate';
import type { NationDef, Personality, ProvinceDef, RegionDef, Resource, Terrain } from '../src/sim/types';
import { buildMap, fillSea, mulberry, pointInPoly, type Pt, type Seed } from './mapgen/core';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const target = Number(get('provinces', '900'));
const nationCount = Number(get('nations', '24'));
const seed = Number(get('seed', '7'));
const out = get('out', `.scratch/stress-${target}.map.json`);
const rnd = mulberry(seed);

// land area for the target province count at Aldmere-like density (≈19k units² per province)
const landArea = target * 19000 * 1.3;
const W = Math.sqrt(landArea / 0.62) * 1.45;
const H = W * 0.62;
const B = { minX: 0, minY: 0, maxX: Math.round(W), maxY: Math.round(H) };

// a lobed continent: a noisy ellipse
const outline: Pt[] = [];
const cx = W / 2;
const cy = H / 2;
const lobes = [rnd() * 6, rnd() * 6, rnd() * 6];
for (let k = 0; k < 180; k++) {
  const a = (k / 180) * Math.PI * 2;
  const r = 1 + 0.12 * Math.sin(3 * a + lobes[0]) + 0.08 * Math.sin(5 * a + lobes[1]) + 0.05 * Math.sin(9 * a + lobes[2]);
  outline.push([cx + Math.cos(a) * W * 0.4 * r, cy + Math.sin(a) * H * 0.4 * r]);
}

// Poisson-disc province seeds inside the outline
const spacing = Math.sqrt(19000) * 0.98;
const seeds: Seed[] = [];
const pts: Pt[] = [];
const cell = spacing / Math.SQRT2;
const grid = new Map<string, Pt>();
const gk = (x: number, y: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
let tries = 0;
while (pts.length < target && tries < target * 400) {
  tries++;
  const p: Pt = [B.minX + rnd() * W, B.minY + rnd() * H];
  if (!pointInPoly(p[0], p[1], outline)) continue;
  const gx = Math.floor(p[0] / cell);
  const gy = Math.floor(p[1] / cell);
  let ok = true;
  for (let dx = -2; dx <= 2 && ok; dx++)
    for (let dy = -2; dy <= 2 && ok; dy++) {
      const q = grid.get(`${gx + dx},${gy + dy}`);
      if (q && Math.hypot(q[0] - p[0], q[1] - p[1]) < spacing) ok = false;
    }
  if (!ok) continue;
  pts.push(p);
  grid.set(gk(p[0], p[1]), p);
}
pts.forEach((p, i) => seeds.push({ kind: 'prov', id: `p${i}`, x: p[0], y: p[1] }));
// a few lakes and peaks inside, away from province seeds
for (let i = 0; i < Math.round(target / 40); i++) {
  const p: Pt = [cx + (rnd() - 0.5) * W * 0.6, cy + (rnd() - 0.5) * H * 0.6];
  if (pts.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < spacing * 0.55)) continue;
  seeds.push({ kind: rnd() < 0.5 ? 'peak' : 'lake', id: `~w${i}`, x: p[0], y: p[1] });
}
fillSea(seeds, B, [outline], { spacing: 100, clearance: 125, seaGap: 60, seed: seed + 11 });

const built = buildMap(seeds, B, []);
const ids = Object.keys(built.provinces);
const nb = built.neighbors;

// keep the largest connected component (stray cells become sea in effect)
const comp = new Map<string, number>();
let best = -1;
let bestSize = 0;
for (const id of ids) {
  if (comp.has(id)) continue;
  const c = comp.size;
  const q = [id];
  comp.set(id, c);
  for (let i = 0; i < q.length; i++) for (const n of nb[q[i]]) if (!comp.has(n)) (comp.set(n, c), q.push(n));
  if (q.length > bestSize) (bestSize = q.length), (best = c);
}
const keep = ids.filter((id) => comp.get(id) === best);
const keepSet = new Set(keep);

// realms: capitals spread out (farthest-point sampling), territory grown breadth-first
const ctr = (id: string): Pt => [built.provinces[id].cx, built.provinces[id].cy];
const capitals: string[] = [keep[Math.floor(rnd() * keep.length)]];
while (capitals.length < nationCount) {
  let far = keep[0];
  let fd = -1;
  for (const id of keep) {
    const d = Math.min(...capitals.map((c) => Math.hypot(ctr(c)[0] - ctr(id)[0], ctr(c)[1] - ctr(id)[1])));
    if (d > fd) (fd = d), (far = id);
  }
  capitals.push(far);
}
const owner = new Map<string, number>();
const quota = Math.floor((keep.length * 0.72) / nationCount);
const fronts = capitals.map((c, i) => {
  owner.set(c, i);
  return [c];
});
const size = capitals.map(() => 1);
for (let round = 0; round < 200; round++) {
  let grew = false;
  fronts.forEach((front, i) => {
    if (size[i] >= quota) return;
    const next: string[] = [];
    for (const p of front)
      for (const n of nb[p]) {
        if (!keepSet.has(n) || owner.has(n) || size[i] >= quota) continue;
        owner.set(n, i);
        size[i]++;
        next.push(n);
        grew = true;
      }
    fronts[i] = next.length ? next : front;
  });
  if (!grew) break;
}

// regions: about ten provinces each, grown from spread-out centres
const regionOf = new Map<string, number>();
const rCount = Math.max(4, Math.round(keep.length / 10));
const rSeeds = [...keep].sort((a, b) => (Math.sin(Number(a.slice(1)) * 12.9898) % 1) - (Math.sin(Number(b.slice(1)) * 12.9898) % 1)).slice(0, rCount);
let rf = rSeeds.map((r, i) => {
  regionOf.set(r, i);
  return [r];
});
while (regionOf.size < keep.length) {
  let grew = false;
  rf = rf.map((front, i) => {
    const next: string[] = [];
    for (const p of front) for (const n of nb[p]) if (keepSet.has(n) && !regionOf.has(n)) (regionOf.set(n, i), next.push(n), (grew = true));
    return next;
  });
  if (!grew) break;
}
for (const id of keep) if (!regionOf.has(id)) regionOf.set(id, 0);

const syll = ['al', 'bar', 'cor', 'dun', 'el', 'fen', 'gar', 'hal', 'ir', 'kel', 'lor', 'mar', 'nor', 'os', 'pel', 'ran', 'sel', 'tor', 'ul', 'val', 'wen', 'yar', 'zed'];
const name = (i: number) => {
  const a = syll[i % syll.length];
  const b = syll[Math.floor(i / syll.length) % syll.length];
  const c = syll[Math.floor(i / (syll.length * syll.length)) % syll.length];
  const s = `${a}${b}${i >= syll.length * syll.length ? c : ''}`;
  return s[0].toUpperCase() + s.slice(1);
};
const terrains: Terrain[] = ['plains', 'plains', 'forest', 'hills', 'steppe', 'marsh', 'mountains'];
const resources: Array<Resource> = [null, null, null, null, null, 'grain', 'iron', 'horses', 'goods'];
const personalities: Personality[] = ['expansionist', 'defensive', 'commercial', 'opportunist', 'diplomat'];
const palette = ['#9a7fb8', '#c46a5c', '#6f9d7a', '#d0a24b', '#5f8fb0', '#b5794a', '#8aa05a', '#c0607e', '#4f9a9a', '#a39060', '#7a86b8', '#c4834f'];

const remap = new Map(keep.map((id, i) => [id, `s${i}`]));
const provinces: ProvinceDef[] = keep.map((id, i) => {
  const t = terrains[Math.floor(rnd() * terrains.length)];
  const o = owner.get(id);
  return {
    id: remap.get(id)!,
    name: name(i),
    terrain: t,
    resource: resources[Math.floor(rnd() * resources.length)],
    owner: o === undefined ? null : `n${o}`,
    dev: Math.max(1, Math.min(t === 'mountains' ? 4 : 6, 1 + Math.floor(rnd() * 5))),
    pop: Math.round(10 + rnd() * 40),
    region: `r${regionOf.get(id)}`,
    infra: rnd() < 0.2 ? 1 : 0,
    fort: capitals.includes(id) ? 1 : 0,
    integration: o === undefined ? 0 : 70 + Math.floor(rnd() * 31),
    claims: [],
    neighbors: nb[id].filter((n) => keepSet.has(n)).map((n) => remap.get(n)!),
  };
});
const nations: NationDef[] = capitals.map((c, i) => ({
  id: `n${i}`,
  name: `Realm of ${name(i * 7 + 3)}`,
  short: name(i * 7 + 3),
  adjective: name(i * 7 + 3),
  color: palette[i % palette.length],
  capital: remap.get(c)!,
  personality: personalities[i % personalities.length],
  emblem: 'none',
  summary: 'A procedurally generated realm.',
  strength: '',
  constraint: '',
  traits: {},
}));
const regions: RegionDef[] = Array.from({ length: rCount }, (_, i) => ({ id: `r${i}`, name: `Region ${i + 1}` }));
const edges = built.edges
  .filter((e) => (e.a.startsWith('~') || keepSet.has(e.a)) && (e.b.startsWith('~') || keepSet.has(e.b)))
  .map((e) => ({ a: remap.get(e.a) ?? e.a, b: remap.get(e.b) ?? e.b, pts: e.pts }));
const centers: MapPackage['geometry']['centers'] = {};
for (const id of keep) centers[remap.get(id)!] = { cx: built.provinces[id].cx, cy: built.provinces[id].cy, area: built.provinces[id].area };

const pkg: MapPackage = {
  format: MAP_FORMAT,
  version: MAP_FORMAT_VERSION,
  id: `stress-${target}`,
  revision: 1,
  meta: {
    name: `Stress ${keep.length}`,
    description: 'A procedurally generated continent for performance measurement.',
    size: sizeFor(keep.length),
    difficulty: 'standard',
    style: 'Procedural benchmark',
    mechanics: [],
    origin: 'generated',
  },
  rules: { startYear: 1640, campaignYears: { options: [40, 60], default: 60 }, researchCostMul: 2 },
  regions,
  nations,
  provinces,
  straits: [],
  rivers: [],
  geometry: { bounds: B, centers, edges, waste: built.waste },
};
const check = validateMapPackage(pkg);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(pkg));
console.log(`${pkg.id}: ${provinces.length} provinces (${provinces.filter((p) => p.owner).length} owned), ${nations.length} realms, ${regions.length} regions, ${(JSON.stringify(pkg).length / 1048576).toFixed(2)} MB → ${out}`);
console.log(`validation: ${check.errors.length} error(s), ${check.warnings.length} warning(s)`);
for (const e of check.errors.slice(0, 10)) console.log('  ERR', e.message);
if (!check.ok) process.exitCode = 1;
