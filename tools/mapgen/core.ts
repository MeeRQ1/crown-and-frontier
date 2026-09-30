// Shared map-building core for every scenario.
//
// Input: seed points (provinces, sea, mountain peaks, lakes). Each seed becomes
// a Voronoi cell; borders between cells are "noisy edges" (recursive quad
// subdivision, deterministic per edge), so neighbouring provinces share one
// identical border polyline. Output: province polygons, adjacency, border
// edges (with coasts and shores), impassable waste polygons and warnings.
//
// The Reach (tools/genmap.ts) and Aldmere (tools/genworld.ts) both build on it.

import { Delaunay } from 'd3-delaunay';

export type Pt = [number, number];
export type Kind = 'prov' | 'sea' | 'peak' | 'lake';
export interface Seed {
  kind: Kind;
  id: string;
  x: number;
  y: number;
}
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function pointInPoly(x: number, y: number, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Small deterministic PRNG. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}
export function centroid(p: Pt[]): Pt {
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

/**
 * Sea seeds on a jittered grid outside the land outlines, kept clear of every
 * non-sea seed. Appends to `seeds` (the Reach's original behaviour).
 */
export function fillSea(seeds: Seed[], bounds: Bounds, outlines: Pt[][], opts: { spacing: number; clearance: number; seaGap: number; seed: number }): void {
  const rnd = mulberry(opts.seed);
  const spacing = opts.spacing;
  const solid = seeds.filter((s) => s.kind !== 'sea');
  let n = 0;
  for (let y = bounds.minY + 10; y < bounds.maxY; y += spacing) {
    for (let x = bounds.minX + 10; x < bounds.maxX; x += spacing) {
      const px = x + (rnd() - 0.5) * spacing * 0.6;
      const py = y + (rnd() - 0.5) * spacing * 0.6;
      if (outlines.some((o) => pointInPoly(px, py, o))) continue;
      let ok = true;
      for (const s of solid) {
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < opts.clearance) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      for (const s of seeds) {
        if (s.kind === 'sea' && Math.hypot(s.x - px, s.y - py) < opts.seaGap) {
          ok = false;
          break;
        }
      }
      if (ok) seeds.push({ kind: 'sea', id: `~sea${n++}`, x: px, y: py });
    }
  }
}

function noisy(A: Pt, Bp: Pt, C: Pt, D: Pt, rnd: () => number, minLen: number, out: Pt[], depth = 0): void {
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

export interface Seg {
  cells: number[];
  v0: Pt;
  v1: Pt;
  k0: string;
  k1: string;
  /** noisy polyline from v0 to v1 */
  path: Pt[];
}

export interface EdgeOut {
  a: string;
  b: string;
  pts: number[];
  river?: 1;
}

export interface BuiltMap {
  seeds: Seed[];
  segs: Map<string, Seg>;
  cellRings: Pt[][];
  provIndex: Map<string, number>;
  provinces: Record<string, { poly: number[]; cx: number; cy: number; area: number }>;
  neighbors: Record<string, string[]>;
  edges: EdgeOut[];
  /** segment key of each edge (parallel to `edges`) */
  edgeSegs: string[];
  waste: Array<{ kind: string; poly: number[] }>;
  warnings: string[];
  cellPoly(i: number): Pt[];
}

export const vkey = (p: Pt): string => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
export const r1 = (v: number): number => Math.round(v);
export const flat = (p: Pt[]): number[] => p.flatMap(([x, y]) => [r1(x), r1(y)]);

/**
 * Builds cells, noisy borders, adjacency and edges from the seeds.
 * `minBorder`: shorter land borders are drawn but do not count as adjacency.
 */
export function buildMap(seeds: Seed[], bounds: Bounds, straits: Array<[string, string]>, opts: { minBorder?: number; noiseMin?: number; noiseFactor?: number } = {}): BuiltMap {
  const minBorder = opts.minBorder ?? 14;
  const noiseMin = opts.noiseMin ?? 7;
  const f = opts.noiseFactor ?? 0.55;
  const B = bounds;
  const delaunay = Delaunay.from(seeds.map((s) => [s.x, s.y] as Pt));
  const voronoi = delaunay.voronoi([B.minX, B.minY, B.maxX, B.maxY]);

  const segs = new Map<string, Seg>();
  const cellRings: Pt[][] = [];
  for (let i = 0; i < seeds.length; i++) {
    const ring = (voronoi.cellPolygon(i) as Pt[] | null) ?? [];
    cellRings.push(ring);
    for (let k = 0; k + 1 < ring.length; k++) {
      const a = ring[k];
      const b = ring[k + 1];
      const ka = vkey(a);
      const kb = vkey(b);
      const sk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const seg = segs.get(sk);
      if (seg) seg.cells.push(i);
      else segs.set(sk, { cells: [i], v0: ka < kb ? a : b, v1: ka < kb ? b : a, k0: ka < kb ? ka : kb, k1: ka < kb ? kb : ka, path: [] });
    }
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
    const Bq = lerp(mid, si, f);
    const Dq = lerp(mid, sj, f);
    const pts: Pt[] = [seg.v0];
    noisy(seg.v0, Bq, seg.v1, Dq, rnd, noiseMin, pts);
    pts.push(seg.v1);
    seg.path = pts;
  }

  const segFor = (a: Pt, b: Pt): Pt[] => {
    const ka = vkey(a);
    const kb = vkey(b);
    const sk = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    const path = segs.get(sk)!.path;
    return ka < kb ? path : [...path].reverse();
  };
  const cellPoly = (i: number): Pt[] => {
    const ring = cellRings[i];
    const out: Pt[] = [];
    for (let k = 0; k + 1 < ring.length; k++) {
      const p = segFor(ring[k], ring[k + 1]);
      for (let m = 0; m < p.length - 1; m++) out.push(p[m]);
    }
    return out;
  };

  const provIndex = new Map<string, number>();
  seeds.forEach((s, i) => {
    if (s.kind === 'prov') provIndex.set(s.id, i);
  });

  const provinces: BuiltMap['provinces'] = {};
  const neighbors: Record<string, string[]> = {};
  const warnings: string[] = [];
  for (const [id, i] of provIndex) {
    const poly = cellPoly(i);
    const c = centroid(poly);
    provinces[id] = { poly: flat(poly), cx: r1(c[0]), cy: r1(c[1]), area: Math.round(polyArea(poly)) };
    neighbors[id] = [];
  }

  const edges: EdgeOut[] = [];
  const edgeSegs: string[] = [];
  const push = (e: EdgeOut, sk: string) => {
    edges.push(e);
    edgeSegs.push(sk);
  };
  for (const [sk, seg] of segs) {
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
      push({ a: `~${a.kind}`, b: `~${b.kind}`, pts: flat(seg.path) }, sk);
      continue;
    }
    const len = dist(seg.v0, seg.v1);
    if (a.kind === 'prov' && b.kind === 'prov') {
      if (len >= minBorder) {
        neighbors[a.id].push(b.id);
        neighbors[b.id].push(a.id);
      } else warnings.push(`tiny border ${a.id}-${b.id} (${len.toFixed(1)}) ignored for adjacency`);
      push(a.id < b.id ? { a: a.id, b: b.id, pts: flat(seg.path) } : { a: b.id, b: a.id, pts: flat([...seg.path].reverse()) }, sk);
    } else {
      const p = a.kind === 'prov' ? a : b;
      const o = a.kind === 'prov' ? b : a;
      const path = a.kind === 'prov' ? seg.path : [...seg.path].reverse();
      push({ a: p.id, b: `~${o.kind}`, pts: flat(path) }, sk);
    }
  }
  for (const [a, b] of straits) {
    if (!neighbors[a] || !neighbors[b]) throw new Error(`bad strait ${a}-${b}`);
    if (neighbors[a].includes(b)) warnings.push(`strait ${a}-${b} is already a land border`);
    else {
      neighbors[a].push(b);
      neighbors[b].push(a);
    }
  }
  for (const id of Object.keys(neighbors)) neighbors[id].sort();

  const waste: BuiltMap['waste'] = [];
  seeds.forEach((s, i) => {
    if (s.kind === 'peak' || s.kind === 'lake') waste.push({ kind: s.kind, poly: flat(cellPoly(i)) });
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

  return { seeds, segs, cellRings, provIndex, provinces, neighbors, edges, edgeSegs, waste, warnings, cellPoly };
}

/** SVG preview for visual inspection of a generated map. */
export function previewSvg(
  bounds: Bounds,
  built: Pick<BuiltMap, 'provinces' | 'waste' | 'edges'>,
  straits: Array<[string, string]>,
  ownerOf: (id: string) => string | null,
  colorOf: (nation: string) => string,
  label: (id: string) => string = (id) => id,
  scale = 1.2,
): string {
  const B = bounds;
  const W = B.maxX - B.minX;
  const H = B.maxY - B.minY;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${B.minX} ${B.minY} ${W} ${H}" width="${Math.round(W / scale)}" height="${Math.round(H / scale)}">`);
  parts.push(`<rect x="${B.minX}" y="${B.minY}" width="${W}" height="${H}" fill="#9cc3d5"/>`);
  const toPath = (f: number[]) => {
    let d = `M${f[0]},${f[1]}`;
    for (let i = 2; i < f.length; i += 2) d += `L${f[i]},${f[i + 1]}`;
    return d + 'Z';
  };
  const line = (f: number[]) => {
    let d = `M${f[0]},${f[1]}`;
    for (let i = 2; i < f.length; i += 2) d += `L${f[i]},${f[i + 1]}`;
    return d;
  };
  for (const w of built.waste) parts.push(`<path d="${toPath(w.poly)}" fill="${w.kind === 'lake' ? '#9cc3d5' : '#8a8378'}" stroke="none"/>`);
  for (const [id, p] of Object.entries(built.provinces)) {
    const o = ownerOf(id);
    parts.push(`<path d="${toPath(p.poly)}" fill="${o ? colorOf(o) : '#d8cfb8'}" fill-opacity="0.75" stroke="#222" stroke-width="1.2"/>`);
  }
  for (const e of built.edges) if (e.river) parts.push(`<path d="${line(e.pts)}" fill="none" stroke="#1d5f9a" stroke-width="5"/>`);
  for (const [a, b] of straits) {
    const pa = built.provinces[a];
    const pb = built.provinces[b];
    parts.push(`<line x1="${pa.cx}" y1="${pa.cy}" x2="${pb.cx}" y2="${pb.cy}" stroke="#224" stroke-dasharray="8 6" stroke-width="2"/>`);
  }
  for (const [id, p] of Object.entries(built.provinces)) {
    parts.push(`<text x="${p.cx}" y="${p.cy}" font-size="17" text-anchor="middle" font-family="sans-serif">${label(id)}</text>`);
  }
  parts.push('</svg>');
  return parts.join('\n');
}

/** Binary min-heap keyed by number (for Dijkstra searches). */
export class MinHeap<T> {
  private k: number[] = [];
  private v: T[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, val: T): void {
    const k = this.k;
    const v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  /** returns [key, value] of the smallest entry */
  pop(): [number, T] {
    const k = this.k;
    const v = this.v;
    const topK = k[0];
    const topV = v[0];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r] < k[l] ? r : l;
        if (k[c] >= lk) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lk;
      v[i] = lv;
    }
    return [topK, topV];
  }
}

/** Distance from point p to segment ab, and the closest point. */
export function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function polylineDist(p: Pt, line: Pt[]): number {
  let d = Infinity;
  for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, segDist(p, line[i], line[i + 1]));
  return d;
}

/** Intersection point of segments p1p2 and p3p4, or null. */
export function segIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): Pt | null {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
}
