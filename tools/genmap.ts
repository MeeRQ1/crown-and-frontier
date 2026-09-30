// Generates province geometry + adjacency for the Reach scenario.
//   npm run genmap            -> writes src/data/reach.map.json and reports/map-preview.svg
// Seed positions come from src/data/reach.ts. Each province is a Voronoi cell;
// borders are "noisy edges" (recursive quad subdivision, deterministic per edge)
// so neighbouring provinces share one identical border polyline.

import { Delaunay } from 'd3-delaunay';
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

type Pt = [number, number];
type Kind = 'prov' | 'sea' | 'peak' | 'lake';
interface Seed {
  kind: Kind;
  id: string;
  x: number;
  y: number;
}

const B = MAP_BOUNDS;
const seeds: Seed[] = [];
for (const s of REACH_PROVINCE_SEEDS) seeds.push({ kind: 'prov', id: s.id, x: s.x, y: s.y });
WASTE_SEEDS.forEach(([x, y, k], i) => seeds.push({ kind: k, id: `~${k}${i}`, x, y }));
FORCED_SEA.forEach(([x, y], i) => seeds.push({ kind: 'sea', id: `~fsea${i}`, x, y }));

function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Small deterministic PRNG for jitter/noise.
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Automatic sea seeds on a jittered grid outside the continent outline.
{
  const rnd = mulberry(1234);
  const spacing = 72;
  const solid = seeds.filter((s) => s.kind !== 'sea');
  let n = 0;
  for (let y = B.minY + 10; y < B.maxY; y += spacing) {
    for (let x = B.minX + 10; x < B.maxX; x += spacing) {
      const px = x + (rnd() - 0.5) * spacing * 0.6;
      const py = y + (rnd() - 0.5) * spacing * 0.6;
      if (pointInPoly(px, py, OUTLINE)) continue;
      let ok = true;
      for (const s of solid) {
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < 88) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (const s of seeds) {
        if (s.kind === 'sea' && Math.hypot(s.x - px, s.y - py) < 40) {
          ok = false;
          break;
        }
      }
      if (ok) seeds.push({ kind: 'sea', id: `~sea${n++}`, x: px, y: py });
    }
  }
}

const delaunay = Delaunay.from(seeds.map((s) => [s.x, s.y] as Pt));
const voronoi = delaunay.voronoi([B.minX, B.minY, B.maxX, B.maxY]);

const key = (p: Pt) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
interface Seg {
  cells: number[];
  v0: Pt;
  v1: Pt;
  path?: Pt[]; // from v0 to v1
}
const segs = new Map<string, Seg>();
const cellRings: Pt[][] = [];
for (let i = 0; i < seeds.length; i++) {
  const ring = (voronoi.cellPolygon(i) as Pt[] | null) ?? [];
  cellRings.push(ring);
  for (let k = 0; k + 1 < ring.length; k++) {
    const a = ring[k];
    const b = ring[k + 1];
    const ka = key(a);
    const kb = key(b);
    const sk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const seg = segs.get(sk);
    if (seg) seg.cells.push(i);
    else segs.set(sk, { cells: [i], v0: ka < kb ? a : b, v1: ka < kb ? b : a });
  }
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function dist(a: Pt, b: Pt) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function noisy(A: Pt, Bp: Pt, C: Pt, D: Pt, rnd: () => number, minLen: number, out: Pt[], depth = 0) {
  if (depth > 40) throw new Error(`noisy recursion: ${JSON.stringify([A, Bp, C, D])}`);
  if (dist(A, C) < minLen || dist(Bp, D) < minLen) return;
  const p = 0.2 + rnd() * 0.6;
  const q = 0.2 + rnd() * 0.6;
  const E = lerp(A, D, p);
  const F = lerp(Bp, C, p);
  const G = lerp(A, Bp, q);
  const I = lerp(D, C, q);
  const H = lerp(E, F, q);
  const s = 1 - (rnd() * 0.8 - 0.4);
  const t = 1 - (rnd() * 0.8 - 0.4);
  noisy(A, lerp(Bp, G, s), H, lerp(D, E, t), rnd, minLen, out, depth + 1);
  out.push(H);
  noisy(H, lerp(C, F, s), C, lerp(D, I, t), rnd, minLen, out, depth + 1);
}

const kindOf = (i: number) => seeds[i].kind;
for (const [sk, seg] of segs) {
  if (seg.cells.length !== 2) {
    seg.path = [seg.v0, seg.v1];
    continue;
  }
  const [i, j] = seg.cells;
  const ki = kindOf(i);
  const kj = kindOf(j);
  const plain = ki === kj && ki !== 'prov';
  if (plain) {
    seg.path = [seg.v0, seg.v1];
    continue;
  }
  const rnd = mulberry(hashStr(sk));
  const mid = lerp(seg.v0, seg.v1, 0.5);
  const si: Pt = [seeds[i].x, seeds[i].y];
  const sj: Pt = [seeds[j].x, seeds[j].y];
  const f = 0.55;
  const Bq = lerp(mid, si, f);
  const Dq = lerp(mid, sj, f);
  const pts: Pt[] = [seg.v0];
  noisy(seg.v0, Bq, seg.v1, Dq, rnd, 7, pts);
  pts.push(seg.v1);
  seg.path = pts;
}

function segFor(a: Pt, b: Pt): Pt[] {
  const ka = key(a);
  const kb = key(b);
  const sk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  const seg = segs.get(sk)!;
  const path = seg.path!;
  return ka < kb ? path : [...path].reverse();
}

function cellPoly(i: number): Pt[] {
  const ring = cellRings[i];
  const out: Pt[] = [];
  for (let k = 0; k + 1 < ring.length; k++) {
    const p = segFor(ring[k], ring[k + 1]);
    for (let m = 0; m < p.length - 1; m++) out.push(p[m]);
  }
  return out;
}

function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}
function centroid(p: Pt[]): Pt {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const f = p[j][0] * p[i][1] - p[i][0] * p[j][1];
    cx += (p[j][0] + p[i][0]) * f;
    cy += (p[j][1] + p[i][1]) * f;
    a += f;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

const r1 = (v: number) => Math.round(v);
const flat = (p: Pt[]) => p.flatMap(([x, y]) => [r1(x), r1(y)]);

const provIndex = new Map<string, number>();
seeds.forEach((s, i) => {
  if (s.kind === 'prov') provIndex.set(s.id, i);
});

const provincesOut: Record<string, { poly: number[]; cx: number; cy: number; area: number }> = {};
const neighbors: Record<string, string[]> = {};
const warnings: string[] = [];
for (const [id, i] of provIndex) {
  const poly = cellPoly(i);
  const c = centroid(poly);
  provincesOut[id] = { poly: flat(poly), cx: r1(c[0]), cy: r1(c[1]), area: Math.round(polyArea(poly)) };
  neighbors[id] = [];
}

const edgesOut: Array<{ a: string; b: string; pts: number[] }> = [];
for (const seg of segs.values()) {
  if (seg.cells.length === 1) {
    const s = seeds[seg.cells[0]];
    if (s.kind === 'prov') warnings.push(`${s.id} touches the map bounds`);
    continue;
  }
  const [i, j] = seg.cells;
  const a = seeds[i];
  const b = seeds[j];
  if (a.kind !== 'prov' && b.kind !== 'prov') {
    if (a.kind === b.kind) continue;
    // waste-sea, peak-lake edges: coast for waste cells
    edgesOut.push({ a: `~${a.kind}`, b: `~${b.kind}`, pts: flat(seg.path!) });
    continue;
  }
  const len = dist(seg.v0, seg.v1);
  if (a.kind === 'prov' && b.kind === 'prov') {
    if (len >= 14) {
      neighbors[a.id].push(b.id);
      neighbors[b.id].push(a.id);
    } else warnings.push(`tiny border ${a.id}-${b.id} (${len.toFixed(1)}) ignored for adjacency`);
    edgesOut.push(a.id < b.id ? { a: a.id, b: b.id, pts: flat(seg.path!) } : { a: b.id, b: a.id, pts: flat([...seg.path!].reverse()) });
  } else {
    const p = a.kind === 'prov' ? a : b;
    const o = a.kind === 'prov' ? b : a;
    const path = a.kind === 'prov' ? seg.path! : [...seg.path!].reverse();
    edgesOut.push({ a: p.id, b: `~${o.kind}`, pts: flat(path) });
  }
}
for (const [a, b] of STRAITS) {
  if (!neighbors[a] || !neighbors[b]) throw new Error(`bad strait ${a}-${b}`);
  if (neighbors[a].includes(b)) warnings.push(`strait ${a}-${b} is already a land border`);
  else {
    neighbors[a].push(b);
    neighbors[b].push(a);
  }
}
for (const id of Object.keys(neighbors)) neighbors[id].sort();

const wasteOut: Array<{ kind: string; poly: number[] }> = [];
seeds.forEach((s, i) => {
  if (s.kind === 'peak' || s.kind === 'lake') wasteOut.push({ kind: s.kind, poly: flat(cellPoly(i)) });
});

// Connectivity check.
{
  const ids = Object.keys(neighbors);
  const seen = new Set<string>([ids[0]]);
  const q = [ids[0]];
  while (q.length) {
    const c = q.shift()!;
    for (const n of neighbors[c]) if (!seen.has(n)) (seen.add(n), q.push(n));
  }
  if (seen.size !== ids.length) warnings.push(`graph disconnected: ${ids.filter((i) => !seen.has(i)).join(',')}`);
  for (const id of ids) if (neighbors[id].length < 2) warnings.push(`${id} has only ${neighbors[id].length} neighbour(s)`);
}

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

// SVG preview for visual inspection.
{
  const owner = new Map(REACH_PROVINCES.map((p) => [p.id, p.owner]));
  const color = new Map(REACH_NATIONS.map((n) => [n.id, n.color]));
  const W = B.maxX - B.minX;
  const H = B.maxY - B.minY;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${B.minX} ${B.minY} ${W} ${H}" width="${W / 1.2}" height="${H / 1.2}">`);
  parts.push(`<rect x="${B.minX}" y="${B.minY}" width="${W}" height="${H}" fill="#9cc3d5"/>`);
  const toPath = (f: number[]) => {
    let d = `M${f[0]},${f[1]}`;
    for (let i = 2; i < f.length; i += 2) d += `L${f[i]},${f[i + 1]}`;
    return d + 'Z';
  };
  for (const w of wasteOut) parts.push(`<path d="${toPath(w.poly)}" fill="${w.kind === 'lake' ? '#9cc3d5' : '#8a8378'}" stroke="none"/>`);
  for (const [id, p] of Object.entries(provincesOut)) {
    const o = owner.get(id);
    parts.push(`<path d="${toPath(p.poly)}" fill="${o ? color.get(o) : '#d8cfb8'}" fill-opacity="0.75" stroke="#222" stroke-width="1.2"/>`);
  }
  for (const [a, b] of STRAITS) {
    const pa = provincesOut[a];
    const pb = provincesOut[b];
    parts.push(`<line x1="${pa.cx}" y1="${pa.cy}" x2="${pb.cx}" y2="${pb.cy}" stroke="#224" stroke-dasharray="8 6" stroke-width="2"/>`);
  }
  for (const [id, p] of Object.entries(provincesOut)) {
    parts.push(`<text x="${p.cx}" y="${p.cy}" font-size="17" text-anchor="middle" font-family="sans-serif">${id}</text>`);
  }
  parts.push('</svg>');
  mkdirSync(new URL('../reports/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../reports/map-preview.svg', import.meta.url), parts.join('\n'));
}

const areas = Object.entries(provincesOut).map(([id, p]) => [id, p.area] as const).sort((a, b) => a[1] - b[1]);
console.log(`seeds: ${seeds.length} (${provIndex.size} provinces)`);
console.log(`smallest: ${areas.slice(0, 5).map((a) => a.join('=')).join(', ')}`);
console.log(`largest: ${areas.slice(-5).map((a) => a.join('=')).join(', ')}`);
if (warnings.length) console.log('WARNINGS:\n  ' + warnings.join('\n  '));
else console.log('no warnings');
