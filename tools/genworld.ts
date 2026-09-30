// Generates Aldmere, the standard campaign map, from the authored geography in
// tools/aldmere.spec.ts.
//   npm run genworld  -> src/data/aldmere.provinces.json (simulation data)
//                        src/data/aldmere.map.json       (drawn geometry)
//                        reports/aldmere-preview.svg, reports/aldmere-map.md
//
// Steps:
//  1. Rasterise land, lakes and mountain walls on a fine grid.
//  2. Grow regions from their anchors across the grid (walls and water block
//     growth, so ranges and seas become region borders).
//  3. Split each region into its province count with k-means (capitals and
//     landmarks stay pinned); islands are split on their own.
//  4. Add mountain peaks along each ridge (leaving the passes open), lake and
//     sea cells, then build Voronoi borders with the shared core.
//  5. Close any border that leaks through a ridge, route rivers along province
//     borders, link islands to the mainland with straits.
//  6. Derive terrain, resources, development, forts, claims and names.
// Everything is deterministic; the output is checked in.

import { mkdirSync, writeFileSync } from 'node:fs';
import { ALDMERE_LABELS, ALDMERE_NATIONS, ALDMERE_REGIONS } from '../src/data/aldmere';
import type { ProvinceDef, Resource, Terrain } from '../src/sim/types';
import * as S from './aldmere.spec';
import { buildMap, fillSea, hashStr, MinHeap, mulberry, pointInPoly, polylineDist, previewSvg, segIntersect, type BuiltMap, type Pt, type Seed } from './mapgen/core';

const K = S.SCALE;
const G = 14; // grid step in design units
const B = S.BOUNDS;
const NX = Math.ceil((B.maxX - B.minX) / G);
const NY = Math.ceil((B.maxY - B.minY) / G);
const cx = (i: number) => B.minX + (i + 0.5) * G;
const cy = (j: number) => B.minY + (j + 0.5) * G;
const warnings: string[] = [];
const notes: string[] = [];
const fail = (m: string): never => {
  throw new Error(m);
};

// ───────────────────────────── 1. raster ───────────────────────────────────

const lakePolys: Pt[][] = S.LAKES.map((l) => {
  const rnd = mulberry(hashStr(l.name));
  const pts: Pt[] = [];
  const n = 36;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + (rnd() - 0.5) * 0.18;
    const x = Math.cos(a) * l.rx * w;
    const y = Math.sin(a) * l.ry * w;
    pts.push([l.cx + x * Math.cos(l.rot) - y * Math.sin(l.rot), l.cy + x * Math.sin(l.rot) + y * Math.cos(l.rot)]);
  }
  return pts;
});
const lands: Pt[][] = [S.MAINLAND, ...S.ISLANDS.map((i) => i.poly)];

/** -1 sea, -2 lake, -3 mountain wall, else land polygon index (0 = mainland) */
const cell = new Int16Array(NX * NY).fill(-1);
for (let j = 0; j < NY; j++) {
  for (let i = 0; i < NX; i++) {
    const x = cx(i);
    const y = cy(j);
    let v = -1;
    for (let k = 0; k < lands.length; k++) if (pointInPoly(x, y, lands[k])) v = k;
    if (v >= 0 && lakePolys.some((p) => pointInPoly(x, y, p))) v = -2;
    if (v === 0 && S.RANGES.some((r) => polylineDist([x, y], r.pts) < r.half)) v = -3;
    cell[j * NX + i] = v;
  }
}
const idx = (x: number, y: number) => {
  const i = Math.max(0, Math.min(NX - 1, Math.floor((x - B.minX) / G)));
  const j = Math.max(0, Math.min(NY - 1, Math.floor((y - B.minY) / G)));
  return j * NX + i;
};
/** nearest cell with the given land index (spiral search) */
function nearestCell(x: number, y: number, land: number): number {
  const c0 = idx(x, y);
  if (cell[c0] === land) return c0;
  const i0 = c0 % NX;
  const j0 = Math.floor(c0 / NX);
  for (let r = 1; r < 40; r++) {
    let best = -1;
    let bd = Infinity;
    for (let j = j0 - r; j <= j0 + r; j++) {
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || j < 0 || i >= NX || j >= NY) continue;
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
        const c = j * NX + i;
        if (cell[c] !== land) continue;
        const d = Math.hypot(cx(i) - x, cy(j) - y);
        if (d < bd) (bd = d), (best = c);
      }
    }
    if (best >= 0) return best;
  }
  return fail(`no land near ${x},${y}`);
}

// ───────────────────────────── 2. regions ──────────────────────────────────

const REG = S.REGIONS;
const regIdx = new Map(REG.map((r, i) => [r.id, i]));
for (const r of ALDMERE_REGIONS) if (!regIdx.has(r.id)) fail(`region ${r.id} has no spec`);
for (const r of REG) if (!ALDMERE_REGIONS.find((x) => x.id === r.id)) fail(`spec region ${r.id} is not declared in aldmere.ts`);
const owners: Array<string | null> = [null, ...ALDMERE_NATIONS.map((n) => n.id)];
const ownerIdx = (o: string | null) => owners.indexOf(o);

const cellReg = new Int16Array(NX * NY).fill(-1);
const cellOwn = new Int16Array(NX * NY).fill(0);
{
  const dist = new Float64Array(NX * NY).fill(Infinity);
  const heap = new MinHeap<number>();
  const label = new Int32Array(NX * NY).fill(-1); // region*64 + owner
  const seedLabel = (x: number, y: number, r: number, o: string | null) => {
    const c = nearestCell(x, y, 0);
    dist[c] = 0;
    label[c] = r * 64 + ownerIdx(o);
    heap.push(0, c);
  };
  REG.forEach((r, ri) => r.anchors.forEach((a) => seedLabel(a.x, a.y, ri, a.owner)));
  for (const f of S.FIXED) if (!f.pass) seedLabel(f.x, f.y, regIdx.get(f.region)!, f.owner);
  const done = new Uint8Array(NX * NY);
  const steps: Array<[number, number, number]> = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];
  while (heap.size) {
    const [d, c] = heap.pop();
    if (done[c]) continue;
    done[c] = 1;
    const lab = label[c];
    cellReg[c] = Math.floor(lab / 64);
    cellOwn[c] = lab % 64;
    const w = REG[cellReg[c]].weight ?? 1;
    const i = c % NX;
    const j = Math.floor(c / NX);
    for (const [di, dj, len] of steps) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NY) continue;
      const n = nj * NX + ni;
      if (done[n] || cell[n] !== 0) continue;
      const nd = d + len * G * w;
      if (nd < dist[n]) {
        dist[n] = nd;
        label[n] = lab;
        heap.push(nd, n);
      }
    }
  }
  // islands take their region wholesale
  S.ISLANDS.forEach((isl, k) => {
    for (let c = 0; c < cell.length; c++) {
      if (cell[c] === k + 1) {
        cellReg[c] = regIdx.get(isl.region)!;
        cellOwn[c] = ownerIdx(isl.owner);
      }
    }
  });
  for (let c = 0; c < cell.length; c++) if (cell[c] === 0 && cellReg[c] < 0) warnings.push(`unreached land cell at ${cx(c % NX)},${cy(Math.floor(c / NX))}`);
}

// ───────────────────────────── 3. provinces ────────────────────────────────

interface Prov {
  tmp: string; // provisional id
  x: number;
  y: number;
  region: string;
  owner: string | null;
  fixed: S.FixedProv | null;
  island: S.IslandSpec | null;
}
const provs: Prov[] = [];
for (const f of S.FIXED) provs.push({ tmp: `f_${f.id}`, x: f.x, y: f.y, region: f.region, owner: f.owner, fixed: f, island: null });

function kmeans(cells: number[], k: number, pinned: Pt[], seed: number): Array<{ x: number; y: number; own: number }> {
  const rnd = mulberry(seed);
  const pts = cells.map((c) => [cx(c % NX), cy(Math.floor(c / NX))] as Pt);
  const centres: Pt[] = [...pinned];
  // k-means++ initialisation
  while (centres.length < pinned.length + k) {
    if (!centres.length) {
      centres.push(pts[Math.floor(rnd() * pts.length)]);
      continue;
    }
    const d2 = pts.map((p) => Math.min(...centres.map((c) => (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2)));
    const sum = d2.reduce((a, b) => a + b, 0);
    let t = rnd() * sum;
    let pick = 0;
    for (; pick < d2.length - 1; pick++) {
      t -= d2[pick];
      if (t <= 0) break;
    }
    centres.push(pts[pick]);
  }
  const assign = new Int32Array(pts.length);
  for (let it = 0; it < 40; it++) {
    for (let p = 0; p < pts.length; p++) {
      let best = 0;
      let bd = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = (centres[c][0] - pts[p][0]) ** 2 + (centres[c][1] - pts[p][1]) ** 2;
        if (d < bd) (bd = d), (best = c);
      }
      assign[p] = best;
    }
    const sx = new Float64Array(centres.length);
    const sy = new Float64Array(centres.length);
    const n = new Float64Array(centres.length);
    for (let p = 0; p < pts.length; p++) {
      sx[assign[p]] += pts[p][0];
      sy[assign[p]] += pts[p][1];
      n[assign[p]]++;
    }
    for (let c = pinned.length; c < centres.length; c++) if (n[c]) centres[c] = [sx[c] / n[c], sy[c] / n[c]];
  }
  const out: Array<{ x: number; y: number; own: number }> = [];
  for (let c = pinned.length; c < centres.length; c++) {
    const votes = new Map<number, number>();
    let near = -1;
    let nd = Infinity;
    for (let p = 0; p < pts.length; p++) {
      if (assign[p] !== c) continue;
      const o = cellOwn[cells[p]];
      votes.set(o, (votes.get(o) ?? 0) + 1);
      const d = (centres[c][0] - pts[p][0]) ** 2 + (centres[c][1] - pts[p][1]) ** 2;
      if (d < nd) (nd = d), (near = p);
    }
    const own = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    // keep the centre on its own ground
    const [x, y] = cells.includes(idx(centres[c][0], centres[c][1])) ? centres[c] : pts[near];
    out.push({ x, y, own });
  }
  return out;
}

const regionArea: Record<string, number> = {};
for (const r of REG) {
  const ri = regIdx.get(r.id)!;
  const cells: number[] = [];
  for (let c = 0; c < cell.length; c++) if (cell[c] === 0 && cellReg[c] === ri) cells.push(c);
  regionArea[r.id] = cells.length * G * G * K * K;
  const fixedHere = S.FIXED.filter((f) => f.region === r.id);
  const islandHere = S.ISLANDS.filter((i) => i.region === r.id).reduce((a, i) => a + i.count, 0);
  const pinned = fixedHere.filter((f) => !f.pass).map((f) => [f.x, f.y] as Pt);
  const k = r.count - fixedHere.length - islandHere;
  if (k < 0) fail(`${r.id}: count too small`);
  if (!k) continue;
  if (!cells.length) fail(`${r.id}: region has no land`);
  kmeans(cells, k, pinned, hashStr(r.id)).forEach((c, n) => provs.push({ tmp: `g_${r.id}_${n}`, x: c.x, y: c.y, region: r.id, owner: owners[c.own], fixed: null, island: null }));
}
S.ISLANDS.forEach((isl, k) => {
  const cells: number[] = [];
  for (let c = 0; c < cell.length; c++) if (cell[c] === k + 1) cells.push(c);
  kmeans(cells, isl.count, [], hashStr(isl.name)).forEach((c, n) => provs.push({ tmp: `i_${k}_${n}`, x: c.x, y: c.y, region: isl.region, owner: isl.owner, fixed: null, island: isl }));
});

// ───────────────────────────── 4. seeds ────────────────────────────────────

const passes = S.FIXED.filter((f) => f.pass);
function peakSeeds(extra: Pt[]): Seed[] {
  const out: Seed[] = [];
  let n = 0;
  for (const r of S.RANGES) {
    const rnd = mulberry(hashStr(r.name));
    for (let s = 0; s + 1 < r.pts.length; s++) {
      const [a, b] = [r.pts[s], r.pts[s + 1]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.round(len / 50));
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      for (let t = 0; t < steps + (s + 2 === r.pts.length ? 1 : 0); t++) {
        const f = t / steps;
        const j = (rnd() - 0.5) * 22;
        const x = a[0] + (b[0] - a[0]) * f + nx * j;
        const y = a[1] + (b[1] - a[1]) * f + ny * j;
        if (passes.some((p) => Math.hypot(p.x - x, p.y - y) < 82)) continue;
        if (!pointInPoly(x, y, S.MAINLAND)) continue;
        out.push({ kind: 'peak', id: `~peak${n++}`, x, y });
      }
    }
  }
  for (const [x, y] of extra) out.push({ kind: 'peak', id: `~peak${n++}`, x, y });
  return out;
}

function lakeSeeds(): Seed[] {
  const out: Seed[] = [];
  let n = 0;
  lakePolys.forEach((poly, k) => {
    const l = S.LAKES[k];
    for (let y = l.cy - l.rx; y <= l.cy + l.rx; y += 34) {
      for (let x = l.cx - l.rx; x <= l.cx + l.rx; x += 34) if (pointInPoly(x, y, poly)) out.push({ kind: 'lake', id: `~lake${n++}`, x, y });
    }
    // shore guards just inside the lake edge
    for (let i = 0; i < poly.length; i++) {
      const [x, y] = poly[i];
      out.push({ kind: 'lake', id: `~lake${n++}`, x: l.cx + (x - l.cx) * 0.88, y: l.cy + (y - l.cy) * 0.88 });
    }
  });
  return out;
}

function coastGuards(): Seed[] {
  const out: Seed[] = [];
  let n = 0;
  for (const poly of lands) {
    // outward normal: polygons are clockwise in screen space for the mainland; test both sides
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.round(len / 44));
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      for (let t = 0; t < steps; t++) {
        const f = t / steps;
        const px = a[0] + (b[0] - a[0]) * f;
        const py = a[1] + (b[1] - a[1]) * f;
        for (const sgn of [1, -1]) {
          const x = px + nx * 36 * sgn;
          const y = py + ny * 36 * sgn;
          if (lands.some((l) => pointInPoly(x, y, l))) continue;
          if (x < B.minX || y < B.minY || x > B.maxX || y > B.maxY) continue;
          out.push({ kind: 'sea', id: `~coast${n++}`, x, y });
        }
      }
    }
  }
  return out;
}

// ───────────────────────────── 5. build ────────────────────────────────────

/** land component of each province: 0 mainland, k+1 island k */
const compOf = (p: Prov) => (p.island ? S.ISLANDS.indexOf(p.island) + 1 : 0);

const byTmpLocal = (t: string) => provs.find((p) => p.tmp === t);
function computeStraits(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const key = new Set<string>();
  const add = (a: Prov, b: Prov) => {
    const k = a.tmp < b.tmp ? `${a.tmp}|${b.tmp}` : `${b.tmp}|${a.tmp}`;
    if (key.has(k)) return;
    key.add(k);
    out.push([a.tmp, b.tmp]);
  };
  S.ISLANDS.forEach((isl, k) => {
    const mine = provs.filter((p) => compOf(p) === k + 1);
    const others = provs.filter((p) => compOf(p) !== k + 1);
    const pairs: Array<{ a: Prov; b: Prov; d: number }> = [];
    for (const a of mine) for (const b of others) pairs.push({ a, b, d: Math.hypot(a.x - b.x, a.y - b.y) });
    pairs.sort((x, y) => x.d - y.d || (x.b.tmp < y.b.tmp ? -1 : 1));
    const best = pairs[0];
    add(best.a, best.b);
    // an owned island is always linked to its owner's own coast, so the owner
    // never has to cross a foreign realm to reach it
    if (isl.owner && best.b.owner !== isl.owner) {
      const home = pairs.find((p) => p.b.owner === isl.owner && p.d < best.d * 2.2);
      if (home) add(home.a, home.b);
      else warnings.push(`${isl.name} has no strait to ${isl.owner}'s land`);
    }
    // a second landing: another province of this island, or another shore
    const second = pairs.find((p) => p.d < best.d * 1.3 && p.d < 560 && p.a !== best.a && p.b !== best.b);
    if (second) add(second.a, second.b);
    // islands are stepping stones: a lane to the nearest coast held by someone else
    const mineIds = new Set(mine.map((p) => p.tmp));
    const linked = new Set(
      out
        .filter(([x, y]) => mineIds.has(x) || mineIds.has(y))
        .flatMap(([x, y]) => [byTmpLocal(x), byTmpLocal(y)])
        .filter((p) => p && compOf(p) !== k + 1)
        .map((p) => p!.owner ?? '~'),
    );
    const lane = pairs.find((p) => p.d < 520 && !linked.has(p.b.owner ?? '~'));
    if (lane) add(lane.a, lane.b);
    if (isl.count >= 2) {
      const third = pairs.find((p) => p.d < best.d * 1.5 && p.d < 600 && compOf(p.b) !== compOf(best.b));
      if (third) add(third.a, third.b);
    }
  });
  return out;
}

function makeSeeds(extraPeaks: Pt[]): Seed[] {
  const seeds: Seed[] = [];
  for (const p of provs) seeds.push({ kind: 'prov', id: p.tmp, x: p.x, y: p.y });
  seeds.push(...peakSeeds(extraPeaks), ...lakeSeeds(), ...coastGuards());
  fillSea(seeds, B, lands, { spacing: 96, clearance: 120, seaGap: 58, seed: 4321 });
  return seeds.map((s) => ({ ...s, x: s.x * K, y: s.y * K }));
}

const straitsTmp = computeStraits();
const scaledBounds = { minX: B.minX * K, minY: B.minY * K, maxX: B.maxX * K, maxY: B.maxY * K };
const byTmp = new Map(provs.map((p) => [p.tmp, p]));
const isPass = (id: string) => !!byTmp.get(id)?.fixed?.pass;

let built: BuiltMap | null = null;
const extraPeaks: Pt[] = [];
for (let round = 0; round < 8; round++) {
  built = buildMap(makeSeeds(extraPeaks), scaledBounds, straitsTmp, { minBorder: 14, noiseMin: 9.5 });
  // borders that leak through a ridge get another peak where they cross it
  let leaks = 0;
  for (const [a, ns] of Object.entries(built.neighbors)) {
    for (const b of ns) {
      if (a > b || isPass(a) || isPass(b)) continue;
      if (straitsTmp.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
      const pa = byTmp.get(a)!;
      const pb = byTmp.get(b)!;
      for (const r of S.RANGES) {
        const ends = [r.pts[0], r.pts[r.pts.length - 1]];
        for (let s = 0; s + 1 < r.pts.length; s++) {
          const x = segIntersect([pa.x, pa.y], [pb.x, pb.y], r.pts[s], r.pts[s + 1]);
          if (!x) continue;
          if (ends.some((e) => Math.hypot(e[0] - x[0], e[1] - x[1]) < 70)) continue;
          if (passes.some((p) => Math.hypot(p.x - x[0], p.y - x[1]) < 100)) continue;
          extraPeaks.push(x);
          leaks++;
        }
      }
    }
  }
  if (!leaks) break;
  console.log(`round ${round}: ${leaks} border(s) crossed a ridge; closing them`);
  if (round === 7) warnings.push('ridge leaks remain after 8 rounds');
}
const M = built!;

// rivers follow province borders from source to sea
const riverSegs = new Set<string>();
const riverPairs = new Set<string>();
{
  const adj = new Map<string, Array<{ to: string; w: number; sk: string }>>();
  const coastNodes = new Set<string>();
  const nodePt = new Map<string, Pt>();
  for (const seg of M.segs.values()) {
    if (seg.cells.length !== 2) continue;
    const [ci, cj] = seg.cells.map((c) => M.seeds[c]);
    if (ci.kind === 'sea' || cj.kind === 'sea') {
      coastNodes.add(seg.k0);
      coastNodes.add(seg.k1);
    }
    if (ci.kind !== 'prov' || cj.kind !== 'prov') continue;
    nodePt.set(seg.k0, seg.v0);
    nodePt.set(seg.k1, seg.v1);
  }
  for (const r of S.RIVERS) {
    const line = r.pts.map(([x, y]) => [x * K, y * K] as Pt);
    adj.clear();
    for (const [sk, seg] of M.segs) {
      if (seg.cells.length !== 2) continue;
      if (seg.cells.some((c) => M.seeds[c].kind !== 'prov')) continue;
      const mid: Pt = [(seg.v0[0] + seg.v1[0]) / 2, (seg.v0[1] + seg.v1[1]) / 2];
      const d = polylineDist(mid, line);
      const len = Math.hypot(seg.v1[0] - seg.v0[0], seg.v1[1] - seg.v0[1]);
      const w = len * (1 + (d / 45) ** 2);
      (adj.get(seg.k0) ?? adj.set(seg.k0, []).get(seg.k0)!).push({ to: seg.k1, w, sk });
      (adj.get(seg.k1) ?? adj.set(seg.k1, []).get(seg.k1)!).push({ to: seg.k0, w, sk });
    }
    const nearest = (p: Pt, filter: (k: string) => boolean) => {
      let best = '';
      let bd = Infinity;
      for (const [k, q] of nodePt) {
        if (!filter(k)) continue;
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (d < bd) (bd = d), (best = k);
      }
      return best;
    };
    const src = nearest(line[0], (k) => adj.has(k) && !coastNodes.has(k));
    const dst = nearest(line[line.length - 1], (k) => adj.has(k) && coastNodes.has(k));
    const dist = new Map<string, number>([[src, 0]]);
    const prev = new Map<string, { from: string; sk: string }>();
    const heap = new MinHeap<string>();
    heap.push(0, src);
    while (heap.size) {
      const [d, n] = heap.pop();
      if (n === dst) break;
      if (d > (dist.get(n) ?? Infinity)) continue;
      for (const e of adj.get(n) ?? []) {
        const nd = d + e.w;
        if (nd < (dist.get(e.to) ?? Infinity)) {
          dist.set(e.to, nd);
          prev.set(e.to, { from: n, sk: e.sk });
          heap.push(nd, e.to);
        }
      }
    }
    if (!prev.has(dst)) {
      warnings.push(`river ${r.name} found no course`);
      continue;
    }
    let n = dst;
    let hops = 0;
    while (n !== src) {
      const p = prev.get(n)!;
      riverSegs.add(p.sk);
      const seg = M.segs.get(p.sk)!;
      const [a, b] = seg.cells.map((c) => M.seeds[c].id).sort();
      // a river along a border too short to cross is scenery on that stretch
      if (M.neighbors[a]?.includes(b)) riverPairs.add(`${a}|${b}`);
      n = p.from;
      hops++;
    }
    console.log(`river ${r.name}: ${hops} border segments`);
  }
  M.edges.forEach((e, i) => {
    if (riverSegs.has(M.edgeSegs[i])) e.river = 1;
  });
}

// ───────────────────────────── 6. attributes ───────────────────────────────

function vnoise(seed: number) {
  const h = (i: number, j: number) => hashStr(`${seed}:${i}:${j}`) / 4294967296;
  const s = (t: number) => t * t * (3 - 2 * t);
  const n1 = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = s(x - xi);
    const v = s(y - yi);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number) => 0.65 * n1(x / 380, y / 380) + 0.35 * n1(x / 150 + 17.3, y / 150 + 4.1);
}
const TERRAINS: Terrain[] = ['plains', 'forest', 'hills', 'mountains', 'marsh', 'steppe'];
const noiseT = Object.fromEntries(TERRAINS.map((t) => [t, vnoise(hashStr(`terrain-${t}`))])) as Record<Terrain, (x: number, y: number) => number>;
const noiseDev = vnoise(hashStr('dev'));

const neighbors = M.neighbors;
const coastal = new Set<string>();
for (const e of M.edges) if (e.b === '~sea' && byTmp.has(e.a)) coastal.add(e.a);
const onRiver = new Set<string>();
for (const k of riverPairs) k.split('|').forEach((x) => onRiver.add(x));
const mouths = S.RIVERS.map((r) => r.pts[r.pts.length - 1]);

const specOf = (p: Prov) => REG[regIdx.get(p.region)!];
interface Out extends Omit<ProvinceDef, 'neighbors' | 'id' | 'name'> {
  tmp: string;
  culture: string;
}
const out = new Map<string, Out>();
for (const p of provs) {
  const r = specOf(p);
  const rnd = mulberry(hashStr(`attr-${p.tmp}`));
  const f = p.fixed;
  let terrain: Terrain;
  if (f) terrain = f.terrain;
  else {
    const dRange = Math.min(...S.RANGES.map((g) => polylineDist([p.x, p.y], g.pts)));
    let best: Terrain = 'plains';
    let bs = -1;
    for (const t of TERRAINS) {
      let w = r.biome[t] ?? 0;
      if (dRange < 200) {
        const near = 1 - dRange / 200;
        if (t === 'hills') w = (w + 0.5) * (1 + 1.2 * near);
        if (t === 'mountains') w += 2.4 * near * near;
        if (t === 'plains' || t === 'steppe') w *= 1 - 0.5 * near;
      }
      if (onRiver.has(p.tmp)) {
        if (t === 'plains') w *= 1.6;
        if (t === 'marsh' && mouths.some((m) => Math.hypot(m[0] - p.x, m[1] - p.y) < 260)) w = (w + 0.6) * 1.5;
        if (t === 'forest') w *= 0.8;
      }
      if (coastal.has(p.tmp) && t === 'marsh') w *= 1.2;
      if (p.island && t === 'mountains') w = 0;
      const sc = w * (0.5 + noiseT[t](p.x, p.y)) ** 1.5;
      if (sc > bs) (bs = sc), (best = t);
    }
    terrain = best;
  }
  let resource: Resource = null;
  if (f) resource = f.resource;
  else {
    const roll = rnd();
    if ((terrain === 'hills' || terrain === 'mountains') && roll < 0.22) resource = 'iron';
    else if (terrain === 'steppe' && roll < 0.3) resource = 'horses';
    else if (terrain === 'plains' && (coastal.has(p.tmp) || onRiver.has(p.tmp)) && r.wealth >= 2.4 && roll < 0.18) resource = 'goods';
    else if (terrain === 'plains' && roll < 0.36) resource = 'grain';
    else if (terrain === 'marsh' && roll < 0.14) resource = 'grain';
    else if (terrain === 'forest' && roll < 0.05) resource = 'goods';
  }
  let dev: number;
  let pop: number;
  if (f) {
    dev = f.dev;
    pop = f.pop;
  } else {
    const tAdj: Record<Terrain, number> = { plains: 0.3, forest: -0.2, hills: -0.1, marsh: -0.5, steppe: -0.3, mountains: -0.9 };
    let v = r.wealth + (noiseDev(p.x, p.y) - 0.5) * 1.3 + tAdj[terrain];
    if (onRiver.has(p.tmp)) v += 0.4;
    if (coastal.has(p.tmp)) v += 0.25;
    if (p.owner) {
      const cap = S.FIXED.find((x) => x.owner === p.owner && !x.pass && ALDMERE_NATIONS.find((n) => n.id === p.owner)?.capital === x.id);
      if (cap && Math.hypot(cap.x - p.x, cap.y - p.y) < 330) v += 0.5;
    }
    dev = Math.max(1, Math.min(5, Math.round(v)));
    const per: Record<Terrain, number> = { plains: 14, forest: 10, hills: 10, marsh: 9, steppe: 10.5, mountains: 8 };
    pop = Math.round(dev * per[terrain] * (0.85 + 0.3 * rnd()) * (p.owner ? 1 : 0.55));
    pop = Math.max(p.owner ? 8 : 5, pop);
  }
  const integ = !p.owner ? 0 : f?.integ ?? (r.integ ? Math.round(r.integ[0] + (r.integ[1] - r.integ[0]) * rnd()) : 100);
  out.set(p.tmp, {
    tmp: p.tmp,
    culture: p.owner ?? r.culture,
    terrain,
    resource,
    owner: p.owner,
    dev,
    pop,
    region: p.region,
    infra: f?.infra ?? 0,
    fort: f?.fort ?? 0,
    integration: integ,
    claims: [...(f?.claims ?? [])],
  });
}

// hops for claims, infrastructure and forts
function hopsFrom(sources: string[]): Map<string, number> {
  const d = new Map<string, number>(sources.map((s) => [s, 0]));
  const q = [...sources];
  for (let i = 0; i < q.length; i++) for (const n of neighbors[q[i]]) if (!d.has(n)) (d.set(n, d.get(q[i])! + 1), q.push(n));
  return d;
}
for (const n of ALDMERE_NATIONS) {
  const capTmp = `f_${n.capital}`;
  if (!out.has(capTmp)) fail(`${n.id}: capital ${n.capital} is not a fixed province`);
  const h = hopsFrom([capTmp]);
  for (const o of out.values()) {
    if (o.owner !== n.id || o.tmp.startsWith('f_')) continue;
    const rnd = mulberry(hashStr(`infra-${o.tmp}`));
    const hop = h.get(o.tmp) ?? 99;
    if ((hop === 1 && o.dev >= 3 && rnd() < 0.6) || (o.dev >= 4 && rnd() < 0.3)) o.infra = 1;
    const border = neighbors[o.tmp].some((x) => out.get(x)?.owner && out.get(x)!.owner !== n.id);
    const fr = rnd();
    if (border && (o.terrain === 'hills' || o.terrain === 'mountains') && fr < 0.3) o.fort = 1;
    else if (border && fr < 0.06) o.fort = 1;
  }
}
for (const r of REG) {
  for (const [claimant, count] of r.claims ?? []) {
    const own = [...out.values()].filter((o) => o.owner === claimant).map((o) => o.tmp);
    const h = hopsFrom(own);
    const cands = [...out.values()]
      .filter((o) => o.region === r.id && o.owner && o.owner !== claimant && !o.claims.includes(claimant) && !o.tmp.startsWith('f_'))
      .sort((a, b) => (h.get(a.tmp) ?? 99) - (h.get(b.tmp) ?? 99) || b.dev - a.dev || (a.tmp < b.tmp ? -1 : 1));
    if (cands.length < count) warnings.push(`${r.id}: only ${cands.length} province(s) for ${claimant}'s ${count} claim(s)`);
    for (const c of cands.slice(0, count)) c.claims.push(claimant);
  }
}

// names and ids
const nameOf = new Map<string, string>();
const used = new Set<string>(S.FIXED.map((f) => f.name));
for (const f of S.FIXED) nameOf.set(`f_${f.id}`, f.name);
for (const p of provs) if (p.island && p.island.count === 1) (nameOf.set(p.tmp, p.island.name), used.add(p.island.name));
const byCulture = new Map<string, Out[]>();
for (const o of out.values()) if (!nameOf.has(o.tmp)) (byCulture.get(o.culture) ?? byCulture.set(o.culture, []).get(o.culture)!).push(o);
for (const [c, list] of byCulture) {
  const names = (S.NAMES[c] ?? fail(`no names for culture ${c}`)).filter((n) => !used.has(n));
  list.sort((a, b) => b.dev - a.dev || byTmp.get(a.tmp)!.y - byTmp.get(b.tmp)!.y || byTmp.get(a.tmp)!.x - byTmp.get(b.tmp)!.x);
  if (names.length < list.length) fail(`culture ${c}: ${list.length} provinces but only ${names.length} names`);
  list.forEach((o, i) => {
    nameOf.set(o.tmp, names[i]);
    used.add(names[i]);
  });
}
const idOf = new Map<string, string>();
const ids = new Set<string>();
for (const [tmp, name] of nameOf) {
  const fx = byTmp.get(tmp)!.fixed;
  const id = fx ? fx.id : name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (ids.has(id)) fail(`duplicate id ${id}`);
  ids.add(id);
  idOf.set(tmp, id);
}
const rid = (t: string) => (t.startsWith('~') ? t : idOf.get(t) ?? fail(`unmapped ${t}`));

// ───────────────────────────── validation ──────────────────────────────────

const provIdsTmp = provs.map((p) => p.tmp);
{
  // passes connect both sides of their range
  for (const p of passes) {
    const r = S.RANGES.reduce((a, g) => (polylineDist([p.x, p.y], g.pts) < polylineDist([p.x, p.y], a.pts) ? g : a));
    let seg = 0;
    let bd = Infinity;
    for (let s = 0; s + 1 < r.pts.length; s++) {
      const d = polylineDist([p.x, p.y], [r.pts[s], r.pts[s + 1]]);
      if (d < bd) (bd = d), (seg = s);
    }
    const [a, b] = [r.pts[seg], r.pts[seg + 1]];
    const side = (q: Prov) => Math.sign((b[0] - a[0]) * (q.y - a[1]) - (b[1] - a[1]) * (q.x - a[0]));
    const sides = new Set(neighbors[`f_${p.id}`].map((n) => side(byTmp.get(n)!)));
    if (!(sides.has(1) && sides.has(-1))) warnings.push(`pass ${p.name} does not connect both sides of ${r.name}`);
  }
  for (const t of provIdsTmp) {
    // single-province islands and coastal spits may be dead ends; inland provinces may not
    const minN = byTmp.get(t)!.island || coastal.has(t) ? 1 : 2;
    if (neighbors[t].length < minN) warnings.push(`${rid(t)} has ${neighbors[t].length} neighbour(s)`);
    else if (neighbors[t].length === 1 && !byTmp.get(t)!.island) notes.push(`${rid(t)} is a coastal dead end`);
  }
  for (const n of ALDMERE_NATIONS) {
    const mine = provIdsTmp.filter((t) => out.get(t)!.owner === n.id);
    const h = hopsFrom([`f_${n.capital}`]);
    const cut = mine.filter((t) => !h.has(t));
    if (cut.length) warnings.push(`${n.id}: unreachable provinces ${cut.map(rid).join(', ')}`);
  }
}

// ───────────────────────────── output ──────────────────────────────────────

const provincesOut: ProvinceDef[] = provIdsTmp.map((t) => {
  const o = out.get(t)!;
  return {
    id: rid(t),
    name: nameOf.get(t)!,
    terrain: o.terrain,
    resource: o.resource,
    owner: o.owner,
    dev: o.dev,
    pop: o.pop,
    region: o.region,
    infra: o.infra,
    fort: o.fort,
    integration: o.integration,
    claims: o.claims,
    neighbors: neighbors[t].map(rid).sort(),
  };
});
provincesOut.sort((a, b) => (a.id < b.id ? -1 : 1));
const straitsOut = straitsTmp.map(([a, b]) => [rid(a), rid(b)].sort() as [string, string]);
const riversOut = [...riverPairs].map((k) => k.split('|').map(rid).sort() as [string, string]).sort((a, b) => (a.join() < b.join() ? -1 : 1));
const generated = 'tools/genworld.ts from tools/aldmere.spec.ts — do not edit by hand';

writeFileSync(new URL('../src/data/aldmere.provinces.json', import.meta.url), JSON.stringify({ generated, provinces: provincesOut, straits: straitsOut, rivers: riversOut }));
const geo = {
  generated,
  bounds: { minX: Math.round(scaledBounds.minX), minY: Math.round(scaledBounds.minY), maxX: Math.round(scaledBounds.maxX), maxY: Math.round(scaledBounds.maxY) },
  // outlines are rebuilt from the shared edges in the browser (src/ui/map/rings.ts)
  provinces: Object.fromEntries(provIdsTmp.map((t) => [rid(t), { cx: M.provinces[t].cx, cy: M.provinces[t].cy, area: M.provinces[t].area }])),
  edges: M.edges.map((e) => ({ ...e, a: rid(e.a), b: rid(e.b) })),
  waste: M.waste,
  straits: straitsOut,
  labels: ALDMERE_LABELS.map((l) => ({ ...l, x: Math.round(l.x * K), y: Math.round(l.y * K), size: l.size ? Math.round(l.size * K) : undefined })),
};
writeFileSync(new URL('../src/data/aldmere.map.json', import.meta.url), JSON.stringify(geo));

mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
{
  const colors = new Map(ALDMERE_NATIONS.map((n) => [n.id, n.color]));
  const own = new Map(provincesOut.map((p) => [p.id, p.owner]));
  const nm = new Map(provincesOut.map((p) => [p.id, p.name]));
  const withPolys = { ...geo, provinces: Object.fromEntries(provIdsTmp.map((t) => [rid(t), M.provinces[t]])) };
  writeFileSync(new URL('../reports/aldmere-preview.svg', import.meta.url), previewSvg(geo.bounds, withPolys, straitsOut, (id) => own.get(id) ?? null, (n) => colors.get(n)!, (id) => nm.get(id)!, 2));
}

// report
{
  const lines: string[] = ['# Aldmere map report', '', `Generated by \`npm run genworld\`.`, ''];
  const terrainCount: Record<string, number> = {};
  for (const p of provincesOut) terrainCount[p.terrain] = (terrainCount[p.terrain] ?? 0) + 1;
  const areas = provIdsTmp.map((t) => M.provinces[t].area);
  lines.push(`- Provinces: **${provincesOut.length}** (the Reach: 99)`);
  lines.push(`- Realms: ${ALDMERE_NATIONS.length}; unclaimed provinces: ${provincesOut.filter((p) => !p.owner).length}`);
  lines.push(`- Regions: ${ALDMERE_REGIONS.length}`);
  lines.push(`- Straits: ${straitsOut.length}; river borders: ${riversOut.length}; mountain passes: ${passes.length}`);
  lines.push(`- Terrain: ${Object.entries(terrainCount).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  lines.push(`- Province area: min ${Math.min(...areas)}, median ${areas.sort((a, b) => a - b)[Math.floor(areas.length / 2)]}, max ${Math.max(...areas)}`);
  lines.push('', '| Realm | Provinces | Development | Population | Capital |', '|---|---|---|---|---|');
  for (const n of ALDMERE_NATIONS) {
    const mine = provincesOut.filter((p) => p.owner === n.id);
    lines.push(`| ${n.name} | ${mine.length} | ${mine.reduce((a, p) => a + p.dev, 0)} | ${mine.reduce((a, p) => a + p.pop, 0)} | ${nm(n.capital)} |`);
  }
  function nm(id: string) {
    return provincesOut.find((p) => p.id === id)?.name ?? id;
  }
  lines.push('', '| Region | Provinces | Owners | Area per province |', '|---|---|---|---|');
  for (const r of ALDMERE_REGIONS) {
    const mine = provincesOut.filter((p) => p.region === r.id);
    const ow = [...new Set(mine.map((p) => p.owner ?? '—'))].join(', ');
    lines.push(`| ${r.name} | ${mine.length} | ${ow} | ${Math.round(regionArea[r.id] / Math.max(1, mine.filter((p) => !S.FIXED.find((f) => f.id === p.id && f.pass)).length))} |`);
  }
  if (notes.length) lines.push('', '## Notes', '', ...notes.map((w) => `- ${w}`));
  if (warnings.length) lines.push('', '## Warnings', '', ...warnings.map((w) => `- ${w}`));
  writeFileSync(new URL('../reports/aldmere-map.md', import.meta.url), lines.join('\n') + '\n');
  console.log(lines.slice(4, 10).join('\n'));
}
const tiny = M.warnings.filter((w) => w.startsWith('tiny border')).length;
console.log(`core: ${tiny} tiny borders ignored for adjacency`);
// the core's neighbour-count check is superseded by the coast-aware one above
const other = [...warnings, ...M.warnings.filter((w) => !w.startsWith('tiny border') && !/has only \d neighbour/.test(w))];
if (other.length) console.log('WARNINGS:\n  ' + other.join('\n  '));
else console.log('no warnings');
