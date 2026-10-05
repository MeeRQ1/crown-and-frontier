// Procedural maps: a few parameters (seed, size, number of realms, the shape
// of the land, how mountainous, wet and wild it is) in, a complete map package
// out. Builds a WorldSpec for the shared generator (world.ts): coastline and
// islands from shaped noise, mountain ranges with passes, lakes, rivers,
// capitals, regions grown into realms, realm names, arms and traits, labels,
// victory thresholds scaled to the number of realms. Then sea zones and
// validation, as for any imported map.
//
// Used by the map editor ("New map") and by tools/genmaps.ts for the built-in
// fictional maps. Deterministic for given parameters.

import type { NationDef, Personality, RegionDef, ResourceKind, Terrain } from '../../sim/types';
import { MAP_FORMAT, MAP_FORMAT_VERSION, SEA, sizeFor, type MapLabelDef, type MapMeta, type MapPackage, type MapRules } from '../format';
import { campaignYearsFor, researchCostFor, scaledVictory } from '../rules';
import { addSeaZones, validateMapPackage, type MapCheck } from '../validate';
import { CHARGE_NAMES, ORDINARY_NAMES } from '../vocab';
import { hashStr, mulberry, type Pt } from './core';
import { cultureById, CULTURES, NameBook, slug, type Culture } from './names';
import { generateWorld, WorldError, type FixedProv, type IslandSpec, type LakeSpec, type RangeSpec, type RegionSpec, type RiverSpec, type WorldResult, type WorldSpec } from './world';

export const MAP_SHAPES = ['continent', 'archipelago', 'inland-sea', 'peninsulas', 'twin'] as const;
export type MapShape = (typeof MAP_SHAPES)[number];
export const CLIMATES = ['temperate', 'northern', 'southern', 'arid'] as const;
export type Climate = (typeof CLIMATES)[number];

export const SHAPE_LABELS: Record<MapShape, string> = {
  continent: 'One continent',
  archipelago: 'Archipelago',
  'inland-sea': 'Ring around an inland sea',
  peninsulas: 'Peninsulas and gulfs',
  twin: 'Twin lands joined by an isthmus',
};

export interface ProceduralParams {
  id: string;
  name: string;
  seed: number;
  /** target number of provinces (40–900) */
  provinces: number;
  /** number of realms (2–24) */
  realms: number;
  shape: MapShape;
  climate: Climate;
  /** 0–1: how many and how long the mountain ranges are */
  mountains: number;
  /** 0–1: how many rivers */
  rivers: number;
  /** 0–1: how many lakes */
  lakes: number;
  /** 0–0.5: share of the land left unclaimed */
  frontier: number;
  startYear: number;
  /** cultures to draw realm names from (default: a mix) */
  cultures?: string[];
  /** fixed texts for a curated map */
  meta?: Partial<MapMeta>;
}

export const DEFAULT_PARAMS: ProceduralParams = {
  id: 'new-map',
  name: 'New map',
  seed: 1,
  provinces: 120,
  realms: 8,
  shape: 'continent',
  climate: 'temperate',
  mountains: 0.5,
  rivers: 0.5,
  lakes: 0.4,
  frontier: 0.12,
  startYear: 1890,
};

/** Mean province area in design units (Aldmere's median province). */
const AREA = 26000;
/** Raster step of the land mask, in design units. */
const STEP = 24;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Fisher–Yates shuffle (a sort with a random comparator depends on the engine's sort). */
function shuffled<T>(xs: readonly T[], rnd: () => number): T[] {
  const out = xs.slice();
  for (let k = out.length - 1; k > 0; k--) {
    const r = Math.floor(rnd() * (k + 1));
    [out[k], out[r]] = [out[r], out[k]];
  }
  return out;
}

// ───────────────────────────── noise ───────────────────────────────────────

function valueNoise(seed: number, scale: number) {
  const h = (i: number, j: number) => hashStr(`${seed}:${i}:${j}`) / 4294967296;
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / scale;
    const fy = y / scale;
    const xi = Math.floor(fx);
    const yi = Math.floor(fy);
    const u = s(fx - xi);
    const v = s(fy - yi);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(seed: number, base: number) {
  const octaves = [valueNoise(seed, base), valueNoise(seed + 1, base / 2.1), valueNoise(seed + 2, base / 4.3)];
  return (x: number, y: number) => 0.55 * octaves[0](x, y) + 0.3 * octaves[1](x, y) + 0.15 * octaves[2](x, y);
}

// ───────────────────────────── grid helpers ────────────────────────────────

interface Grid {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  g: number;
}
const gx = (G: Grid, i: number) => G.x0 + (i + 0.5) * G.g;
const gy = (G: Grid, j: number) => G.y0 + (j + 0.5) * G.g;

/** 4-connected components of cells where mask is true. */
function components(G: Grid, mask: Uint8Array): { label: Int32Array; sizes: number[] } {
  const label = new Int32Array(G.nx * G.ny).fill(-1);
  const sizes: number[] = [];
  const q: number[] = [];
  for (let c = 0; c < mask.length; c++) {
    if (!mask[c] || label[c] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    q.length = 0;
    q.push(c);
    label[c] = id;
    for (let k = 0; k < q.length; k++) {
      const cur = q[k];
      n++;
      const i = cur % G.nx;
      const j = (cur - i) / G.nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= G.nx || nj >= G.ny) continue;
        const nc = nj * G.nx + ni;
        if (mask[nc] && label[nc] < 0) {
          label[nc] = id;
          q.push(nc);
        }
      }
    }
    sizes.push(n);
  }
  return { label, sizes };
}

/** Breadth-first distance (in cells, 8-connected) from every cell to the nearest seed cell. */
function distanceField(G: Grid, seed: (c: number) => boolean, pass: (c: number) => boolean = () => true): Int32Array {
  const d = new Int32Array(G.nx * G.ny).fill(1 << 29);
  const q: number[] = [];
  for (let c = 0; c < d.length; c++) if (seed(c)) (d[c] = 0), q.push(c);
  for (let k = 0; k < q.length; k++) {
    const cur = q[k];
    const i = cur % G.nx;
    const j = (cur - i) / G.nx;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di;
        const nj = j + dj;
        if ((!di && !dj) || ni < 0 || nj < 0 || ni >= G.nx || nj >= G.ny) continue;
        const nc = nj * G.nx + ni;
        if (d[nc] > d[cur] + 1 && pass(nc)) {
          d[nc] = d[cur] + 1;
          q.push(nc);
        }
      }
  }
  return d;
}

/**
 * Outline of one component of the mask: the longest boundary loop of its cells,
 * with the cell corners as vertices, smoothed into a coastline.
 */
function outline(G: Grid, inside: (c: number) => boolean, smooth = 3): Pt[] {
  const edges = new Map<string, Array<[number, number]>>();
  const key = (i: number, j: number) => `${i},${j}`;
  const add = (a: [number, number], b: [number, number]) => {
    const k = key(a[0], a[1]);
    (edges.get(k) ?? edges.set(k, []).get(k)!).push(b);
  };
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < G.nx && j < G.ny && inside(j * G.nx + i);
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) {
      if (!at(i, j)) continue;
      // clockwise around the cell (screen coordinates): the land is on the right
      if (!at(i, j - 1)) add([i, j], [i + 1, j]);
      if (!at(i + 1, j)) add([i + 1, j], [i + 1, j + 1]);
      if (!at(i, j + 1)) add([i + 1, j + 1], [i, j + 1]);
      if (!at(i - 1, j)) add([i, j + 1], [i, j]);
    }
  const loops: Array<Array<[number, number]>> = [];
  const used = new Set<string>();
  for (const [start, outs] of edges) {
    for (const first of outs) {
      const ek = `${start}>${first[0]},${first[1]}`;
      if (used.has(ek)) continue;
      const loop: Array<[number, number]> = [start.split(',').map(Number) as [number, number]];
      let prev = loop[0];
      let cur = first;
      used.add(ek);
      for (let guard = 0; guard < 1e6; guard++) {
        loop.push(cur);
        const next = edges.get(key(cur[0], cur[1])) ?? [];
        let pick: [number, number] | undefined;
        if (next.length === 1) pick = next[0];
        else {
          // a saddle: turn right, keeping diagonal neighbours apart
          const dx = cur[0] - prev[0];
          const dy = cur[1] - prev[1];
          pick = next.find((n) => n[0] - cur[0] === -dy && n[1] - cur[1] === dx) ?? next[0];
        }
        const nk = `${cur[0]},${cur[1]}>${pick[0]},${pick[1]}`;
        if (used.has(nk)) break;
        used.add(nk);
        prev = cur;
        cur = pick;
      }
      loops.push(loop);
    }
  }
  if (!loops.length) return [];
  loops.sort((a, b) => b.length - a.length);
  let pts: Pt[] = loops[0].map(([i, j]) => [G.x0 + i * G.g, G.y0 + j * G.g]);
  // drop the corners of straight runs, then round the steps off
  pts = pts.filter((p, k) => {
    const a = pts[(k - 1 + pts.length) % pts.length];
    const b = pts[(k + 1) % pts.length];
    return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1]));
  });
  for (let s = 0; s < smooth; s++) {
    const out: Pt[] = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return pts.map(([x, y]) => [Math.round(x), Math.round(y)]);
}

// ───────────────────────────── realms ──────────────────────────────────────

const PALETTE = [
  '#3f6fc4', '#a8323e', '#1f9a8f', '#d0a22a', '#7a4fa3', '#2f7d3a', '#c4622d', '#4a8ab8', '#8c5a2b', '#b8457a',
  '#5b6e2a', '#2b5f8c', '#9c3d2d', '#3a8f6b', '#b07d2a', '#6a4c8c', '#2a7f8c', '#8c2a4f', '#4f7a2a', '#a35f1f',
  '#596fa8', '#7d2f5f', '#3c6e5a', '#b8863a',
];

const PERSONALITY_CYCLE: Personality[] = ['expansionist', 'commercial', 'defensive', 'opportunist', 'diplomat'];

interface TraitPick {
  text: string;
  traits: Record<string, number>;
}
const STRENGTHS: TraitPick[] = [
  { text: 'Fertile heartland: +20% food production.', traits: { supplyProdMul: 0.2 } },
  { text: 'Martial tradition: +0.5 maximum morale.', traits: { moraleAdd: 0.5 } },
  { text: 'Merchant houses: exports fetch 50% more and each trade agreement brings 50% more commerce.', traits: { tradeMul: 0.5 } },
  { text: 'Universities: +20% research.', traits: { researchMul: 0.2 } },
  { text: 'Stone and mortar: forts cost 25% less.', traits: { fortCostMul: -0.25 } },
  { text: 'Siege trains: sieges progress 25% faster.', traits: { siegeMul: 0.25 } },
  { text: 'Crown charters: frontier land integrates 25% faster.', traits: { integrationMul: 0.25 } },
  { text: 'Large families: +25% population growth.', traits: { popGrowthMul: 0.25 } },
  { text: 'Busy markets: +10% income.', traits: { incomeMul: 0.1 } },
  { text: 'Envoy tradition: +1 envoy.', traits: { envoyAdd: 1 } },
  { text: 'Horse country: cavalry costs 25% less.', traits: { cavalryCostMul: -0.25 } },
  { text: 'Foundries: artillery costs 20% less.', traits: { artilleryCostMul: -0.2 } },
];
const CONSTRAINTS: TraitPick[] = [
  { text: 'Burgher realm: -25% military reserve.', traits: { manpowerMul: -0.25 } },
  { text: 'Thin soil: -15% food production.', traits: { supplyProdMul: -0.15 } },
  { text: 'Proud nobility: development costs 15% more.', traits: { devCostMul: 0.15 } },
  { text: 'Old grudges: -10 opinion with every realm.', traits: { opinionAdd: -10 } },
  { text: 'Few soldiers: -20% manpower.', traits: { manpowerMul: -0.2 } },
  { text: 'Insular court: -10% research.', traits: { researchMul: -0.1 } },
  { text: 'Restless provinces: frontier land integrates 15% slower.', traits: { integrationMul: -0.15 } },
  { text: 'Poor roads: -10% income.', traits: { incomeMul: -0.1 } },
];

// ───────────────────────────── the builder ─────────────────────────────────

export interface ProceduralResult {
  pkg: MapPackage;
  check: MapCheck;
  world: WorldResult;
  spec: WorldSpec;
  attempts: number;
}

/** Builds a WorldSpec from parameters (one attempt; `salt` varies the hidden choices). */
export function proceduralSpec(P: ProceduralParams, salt = 0): { spec: WorldSpec; meta: MapMeta; rules: MapRules } {
  const seed = (hashStr(`${P.seed}:${salt}`) ^ (P.seed * 2654435761)) >>> 0;
  const rnd = mulberry(seed);
  const provinces = clamp(Math.round(P.provinces), 30, 900);
  const realms = clamp(Math.round(P.realms), 2, 24);
  const names = new NameBook(seed ^ 0x9e3779b9);

  // ── size and land mask
  const landFrac = { continent: 0.52, archipelago: 0.36, 'inland-sea': 0.46, peninsulas: 0.46, twin: 0.48 }[P.shape];
  const aspect = P.shape === 'twin' ? 1.9 : 1.6;
  const landArea = provinces * AREA * 1.12;
  const W = Math.round(Math.sqrt((landArea / landFrac) * aspect));
  const H = Math.round(W / aspect);
  const G: Grid = { nx: Math.ceil(W / STEP), ny: Math.ceil(H / STEP), x0: 0, y0: 0, g: STEP };
  const N = G.nx * G.ny;
  const noise = fbm(seed, Math.max(260, W / 6));
  const blobs: Array<{ x: number; y: number; r: number }> = [];
  if (P.shape === 'archipelago') {
    blobs.push({ x: 0, y: 0, r: 0.5 });
    const k = 6 + Math.round(provinces / 25);
    for (let t = 0; t < k * 8 && blobs.length < k + 1; t++) {
      const x = (rnd() * 2 - 1) * 0.82;
      const y = (rnd() * 2 - 1) * 0.78;
      const r = 0.1 + rnd() * 0.16;
      if (blobs.some((b) => Math.hypot(b.x - x, b.y - y) < (b.r + r) * 0.9)) continue;
      blobs.push({ x, y, r });
    }
  }
  const outlet = rnd() * Math.PI * 2;
  const gulfs: Array<{ a: number; w: number; d: number }> = [];
  if (P.shape === 'peninsulas') for (let k = 0; k < 4 + Math.floor(rnd() * 3); k++) gulfs.push({ a: rnd() * Math.PI * 2, w: 0.09 + rnd() * 0.07, d: 0.45 + rnd() * 0.25 });
  const mask = (u: number, v: number): number => {
    const r = Math.hypot(u / 0.92, v / 0.88);
    switch (P.shape) {
      case 'continent':
        return 1 - r;
      case 'inland-sea': {
        // the sea opens to the ocean through one channel, so it stays navigable sea
        const sea = 1.4 * Math.max(0, 1 - Math.hypot(u / 0.42, v / 0.36));
        const ang = Math.atan2(v, u);
        let da = Math.abs(ang - outlet);
        da = Math.min(da, Math.PI * 2 - da);
        const channel = Math.hypot(u, v) > 0.25 ? 1.5 * Math.max(0, 1 - da / 0.09) : 0;
        return 1 - r - sea - channel;
      }
      case 'peninsulas': {
        let m = 1 - r;
        for (const g of gulfs) {
          // a gulf: a wedge of sea from the edge toward the centre
          const ang = Math.atan2(v, u);
          let da = Math.abs(ang - g.a);
          da = Math.min(da, Math.PI * 2 - da);
          if (Math.hypot(u, v) > 1 - g.d) m -= 1.6 * Math.max(0, 1 - da / g.w);
        }
        return m;
      }
      case 'twin': {
        const left = 1 - Math.hypot((u + 0.48) / 0.48, v / 0.84);
        const right = 1 - Math.hypot((u - 0.48) / 0.48, v / 0.84);
        const isthmus = Math.abs(u) < 0.1 ? 0.25 - Math.abs(v) * 1.4 : -1;
        return Math.max(left, right, isthmus);
      }
      case 'archipelago': {
        let m = -1;
        for (const b of blobs) m = Math.max(m, 1 - Math.hypot(u - b.x, v - b.y) / b.r);
        return m * 0.8;
      }
    }
  };
  const field = new Float32Array(N);
  for (let j = 0; j < G.ny; j++)
    for (let i = 0; i < G.nx; i++) {
      const x = gx(G, i);
      const y = gy(G, j);
      const u = (x / W) * 2 - 1;
      const v = (y / H) * 2 - 1;
      const edge = Math.min(i, j, G.nx - 1 - i, G.ny - 1 - j);
      field[j * G.nx + i] = edge < 3 ? -9 : mask(u, v) + 0.55 * (noise(x, y) - 0.5);
    }
  const sorted = Float32Array.from(field).sort();
  const threshold = sorted[Math.floor(N * (1 - landFrac))];
  let land: Uint8Array = new Uint8Array(N);
  for (let c = 0; c < N; c++) land[c] = field[c] > threshold ? 1 : 0;
  // one pass of smoothing: no single-cell spits or holes
  {
    const next = new Uint8Array(N);
    for (let j = 0; j < G.ny; j++)
      for (let i = 0; i < G.nx; i++) {
        let n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) n += land[clamp(j + dj, 0, G.ny - 1) * G.nx + clamp(i + di, 0, G.nx - 1)];
        next[j * G.nx + i] = n >= 5 ? 1 : 0;
      }
    land = next;
  }

  // ── landmasses: the largest is the mainland; big enough others are islands
  const cellArea = STEP * STEP;
  const comp = components(G, land);
  const order = comp.sizes.map((_, k) => k).sort((a, b) => comp.sizes[b] - comp.sizes[a]);
  const mainComp = order[0];
  const minIsland = (AREA * 0.7) / cellArea;
  const islandComps = order.slice(1).filter((k) => comp.sizes[k] >= minIsland).slice(0, 40);
  const keep = new Set([mainComp, ...islandComps]);
  for (let c = 0; c < N; c++) if (land[c] && !keep.has(comp.label[c])) land[c] = 0;
  // lakes inside the mainland: water not reachable from the map edge
  const water = new Uint8Array(N);
  for (let c = 0; c < N; c++) water[c] = land[c] ? 0 : 1;
  const wcomp = components(G, water);
  const outerWater = new Set<number>();
  for (let i = 0; i < G.nx; i++) (outerWater.add(wcomp.label[i]), outerWater.add(wcomp.label[(G.ny - 1) * G.nx + i]));
  for (let j = 0; j < G.ny; j++) (outerWater.add(wcomp.label[j * G.nx]), outerWater.add(wcomp.label[j * G.nx + G.nx - 1]));
  const lakeCells = new Map<number, number[]>();
  for (let c = 0; c < N; c++) {
    if (!water[c] || outerWater.has(wcomp.label[c])) continue;
    (lakeCells.get(wcomp.label[c]) ?? lakeCells.set(wcomp.label[c], []).get(wcomp.label[c])!).push(c);
  }
  const lakes: LakeSpec[] = [];
  for (const cells of lakeCells.values()) {
    if (cells.length * cellArea < AREA * 0.5 || P.lakes < 0.15) {
      // too small (or no lakes wanted): fill in, as part of the land around it
      const around = (c: number) => {
        const i = c % G.nx;
        const j = (c - i) / G.nx;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = (j + dj) * G.nx + i + di;
          if (comp.label[n] >= 0) return comp.label[n];
        }
        return -1;
      };
      const lab = cells.map(around).find((x) => x >= 0) ?? mainComp;
      for (const c of cells) (land[c] = 1), (comp.label[c] = lab);
      continue;
    }
    const xs = cells.map((c) => gx(G, c % G.nx));
    const ys = cells.map((c) => gy(G, Math.floor(c / G.nx)));
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    const set = new Set(cells);
    const poly = outline(G, (c) => set.has(c), 2);
    const rx = Math.max(...poly.map((p) => Math.abs(p[0] - cx)), ...poly.map((p) => Math.abs(p[1] - cy)));
    lakes.push({ name: '', cx: Math.round(cx), cy: Math.round(cy), rx: Math.round(rx), ry: Math.round(rx), rot: 0, poly });
  }
  const mainCell = (c: number) => land[c] === 1 && comp.label[c] === mainComp;
  const mainland = outline(G, mainCell);
  const coastDist = distanceField(G, (c) => !land[c]);

  // ── mountain ranges (ridges kept off the coast so regions can grow around them)
  const ranges: RangeSpec[] = [];
  const nRanges = Math.round(P.mountains * (1 + provinces / 110));
  const ridgeNear = (x: number, y: number, d: number) => ranges.some((r) => r.pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < d));
  for (let t = 0; t < nRanges * 30 && ranges.length < Math.min(8, nRanges); t++) {
    const c = Math.floor(rnd() * N);
    if (!mainCell(c) || coastDist[c] < 8) continue;
    let x = gx(G, c % G.nx);
    let y = gy(G, Math.floor(c / G.nx));
    if (ridgeNear(x, y, 600) || lakes.some((l) => Math.hypot(l.cx - x, l.cy - y) < l.rx + 220)) continue;
    const a = rnd() * Math.PI;
    const len = (0.18 + 0.2 * P.mountains + rnd() * 0.12) * W;
    const pts: Pt[] = [[x, y]];
    // grow both ways from the start, stopping short of the coast and of lakes
    for (const dir of [1, -1]) {
      let px = x;
      let py = y;
      let ang = a + (dir < 0 ? Math.PI : 0);
      for (let s = 0; s < 60 && pts.length * 70 < len; s++) {
        ang += (rnd() - 0.5) * 0.5;
        const nx = px + Math.cos(ang) * 70;
        const ny = py + Math.sin(ang) * 70;
        const ci = Math.floor(nx / STEP);
        const cj = Math.floor(ny / STEP);
        if (ci < 0 || cj < 0 || ci >= G.nx || cj >= G.ny) break;
        const cc = cj * G.nx + ci;
        if (!mainCell(cc) || coastDist[cc] < 7) break;
        if (lakes.some((l) => Math.hypot(l.cx - nx, l.cy - ny) < l.rx + 160)) break;
        if (dir > 0) pts.push([nx, ny]);
        else pts.unshift([nx, ny]);
        px = nx;
        py = ny;
      }
    }
    if (pts.length < 5) continue;
    ranges.push({ name: '', half: 60 + Math.round(rnd() * 10), pts: pts.map(([px, py]) => [Math.round(px), Math.round(py)]) });
  }
  const wallAt = (x: number, y: number) => ranges.some((r) => r.pts.some((p, k) => k + 1 < r.pts.length && segDist([x, y], p, r.pts[k + 1]) < r.half));

  // ── rivers: from the high interior down to the coast
  const rivers: RiverSpec[] = [];
  const nRivers = Math.round(P.rivers * (1 + provinces / 45));
  for (let t = 0; t < nRivers * 40 && rivers.length < Math.min(12, nRivers); t++) {
    const c = Math.floor(rnd() * N);
    if (!mainCell(c) || coastDist[c] < 9) continue;
    let i = c % G.nx;
    let j = Math.floor(c / G.nx);
    if (wallAt(gx(G, i), gy(G, j))) continue;
    const pts: Pt[] = [[gx(G, i), gy(G, j)]];
    let ok = false;
    for (let s = 0; s < 400; s++) {
      const here = coastDist[j * G.nx + i];
      if (here <= 1) {
        ok = true;
        break;
      }
      const steps: Array<[number, number]> = [];
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if ((!di && !dj) || i + di < 0 || j + dj < 0 || i + di >= G.nx || j + dj >= G.ny) continue;
          if (coastDist[(j + dj) * G.nx + (i + di)] < here) steps.push([di, dj]);
        }
      if (!steps.length) break;
      const [di, dj] = steps[Math.floor(rnd() * steps.length)];
      i += di;
      j += dj;
      if (wallAt(gx(G, i), gy(G, j)) || lakes.some((l) => Math.hypot(l.cx - gx(G, i), l.cy - gy(G, j)) < l.rx)) break;
      if (s % 3 === 2) pts.push([gx(G, i), gy(G, j)]);
    }
    if (!ok || pts.length < 4) continue;
    pts.push([gx(G, i), gy(G, j)]);
    if (rivers.some((r) => r.pts.some((p) => pts.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 160)))) continue;
    rivers.push({ name: '', pts: pts.map(([x, y]) => [Math.round(x), Math.round(y)]) });
  }

  // ── capitals: spread across the land by farthest-point sampling
  const usable = (c: number) => land[c] === 1 && coastDist[c] >= 2 && !wallAt(gx(G, c % G.nx), gy(G, Math.floor(c / G.nx))) && !lakes.some((l) => Math.hypot(l.cx - gx(G, c % G.nx), l.cy - gy(G, Math.floor(c / G.nx))) < l.rx + 60);
  const bigIsland = (c: number) => comp.label[c] === mainComp || comp.sizes[comp.label[c]] * cellArea >= AREA * 4;
  const cands: number[] = [];
  for (let c = 0; c < N; c++) if (usable(c) && bigIsland(c) && ((c % G.nx) + Math.floor(c / G.nx)) % 2 === 0) cands.push(c);
  if (!cands.length) throw new WorldError('the land is too small for any realm');
  const capCells: number[] = [cands[Math.floor(rnd() * cands.length)]];
  const minD = new Float64Array(cands.length).fill(Infinity);
  while (capCells.length < realms) {
    const last = capCells[capCells.length - 1];
    let best = -1;
    let bd = -1;
    for (let k = 0; k < cands.length; k++) {
      const c = cands[k];
      const d = Math.hypot(gx(G, c % G.nx) - gx(G, last % G.nx), gy(G, Math.floor(c / G.nx)) - gy(G, Math.floor(last / G.nx)));
      minD[k] = Math.min(minD[k], d);
      // a little inland is better than the very coast
      const score = minD[k] * (1 + 0.04 * Math.min(6, coastDist[c]));
      if (score > bd) (bd = score), (best = c);
    }
    capCells.push(best);
  }

  // ── cultures and realm names
  const cultures: Culture[] = [];
  const pool = (P.cultures?.length ? P.cultures.map(cultureById) : [...CULTURES]).slice();
  for (let k = pool.length - 1; k > 0; k--) {
    const r = Math.floor(rnd() * (k + 1));
    [pool[k], pool[r]] = [pool[r], pool[k]];
  }
  // neighbouring realms share a culture now and then, as real borders do
  for (let k = 0; k < realms; k++) cultures.push(pool[k % pool.length]);
  const frontierCulture = pool[(realms + 1) % pool.length];

  // ── regions: mainland seeds by farthest-point sampling, grown over the land (walls block)
  const islandProvinces = islandComps.reduce((s, k) => s + Math.max(1, Math.round((comp.sizes[k] * cellArea) / AREA)), 0);
  const mainProvinces = Math.max(realms * 2, provinces - islandProvinces);
  const regionCount = clamp(Math.round(mainProvinces / 7), realms, 260);
  const walls = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (mainCell(c) && wallAt(gx(G, c % G.nx), gy(G, Math.floor(c / G.nx)))) walls[c] = 1;
  const growable = (c: number) => mainCell(c) && !walls[c] && !lakes.some((l) => Math.hypot(l.cx - gx(G, c % G.nx), l.cy - gy(G, Math.floor(c / G.nx))) < l.rx * 0.8);
  const mainCaps = capCells.filter((c) => comp.label[c] === mainComp);
  const seeds: number[] = [...mainCaps];
  {
    const pts: number[] = [];
    for (let c = 0; c < N; c++) if (growable(c) && coastDist[c] >= 1 && ((c % G.nx) + Math.floor(c / G.nx)) % 2 === 0) pts.push(c);
    const md = new Float64Array(pts.length).fill(Infinity);
    for (const s of seeds) for (let k = 0; k < pts.length; k++) md[k] = Math.min(md[k], Math.hypot(gx(G, pts[k] % G.nx) - gx(G, s % G.nx), gy(G, Math.floor(pts[k] / G.nx)) - gy(G, Math.floor(s / G.nx))));
    if (!seeds.length && pts.length) seeds.push(pts[0]);
    while (seeds.length < regionCount && pts.length) {
      const last = seeds[seeds.length - 1];
      let best = -1;
      let bd = -1;
      for (let k = 0; k < pts.length; k++) {
        md[k] = Math.min(md[k], Math.hypot(gx(G, pts[k] % G.nx) - gx(G, last % G.nx), gy(G, Math.floor(pts[k] / G.nx)) - gy(G, Math.floor(last / G.nx))));
        if (md[k] > bd) (bd = md[k]), (best = pts[k]);
      }
      if (bd <= 0) break;
      seeds.push(best);
    }
  }
  // grow (multi-source breadth-first over growable cells)
  const regOf = new Int32Array(N).fill(-1);
  {
    const q: number[] = [];
    seeds.forEach((s, k) => {
      regOf[s] = k;
      q.push(s);
    });
    for (let k = 0; k < q.length; k++) {
      const cur = q[k];
      const i = cur % G.nx;
      const j = (cur - i) / G.nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= G.nx || nj >= G.ny) continue;
        const nc = nj * G.nx + ni;
        if (regOf[nc] < 0 && growable(nc)) {
          regOf[nc] = regOf[cur];
          q.push(nc);
        }
      }
    }
  }
  const regArea = new Array(seeds.length).fill(0);
  const adj = seeds.map(() => new Set<number>());
  for (let c = 0; c < N; c++) {
    const r = regOf[c];
    if (r < 0) continue;
    regArea[r]++;
    const i = c % G.nx;
    const j = (c - i) / G.nx;
    for (const [di, dj] of [[1, 0], [0, 1], [2, 0], [0, 2], [3, 0], [0, 3]]) {
      // regions also neighbour across a thin wall (a range), so realms can face each other over it
      const ni = i + di;
      const nj = j + dj;
      if (ni >= G.nx || nj >= G.ny) continue;
      const o = regOf[nj * G.nx + ni];
      if (o >= 0 && o !== r) (adj[r].add(o), adj[o].add(r));
    }
  }

  // ── realms take regions: the realm furthest below its target grows next
  const capReg = mainCaps.map((c) => regOf[c]);
  const owner = new Array<number>(seeds.length).fill(-1); // realm index, or -1 for frontier
  const realmOfMainCap = new Map(mainCaps.map((c) => [c, capCells.indexOf(c)]));
  // starting sizes vary, but no realm starts with more than half again another's share
  const weights = capCells.map(() => 0.8 + rnd() * 0.4);
  const totalMain = regArea.reduce((a, b) => a + b, 0);
  const claimable = totalMain * (1 - clamp(P.frontier, 0, 0.5));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const target = weights.map((w) => (claimable * w) / wsum);
  const held = new Array(realms).fill(0);
  capReg.forEach((r, k) => {
    const realm = realmOfMainCap.get(mainCaps[k])!;
    owner[r] = realm;
    held[realm] += regArea[r];
  });
  for (let guard = 0; guard < seeds.length * 2; guard++) {
    let pickRealm = -1;
    let pickReg = -1;
    let best = Infinity;
    for (let realm = 0; realm < realms; realm++) {
      if (held[realm] >= target[realm]) continue;
      const ratio = held[realm] / target[realm];
      if (ratio >= best) continue;
      // its cheapest free neighbouring region (nearest to the capital)
      const cap = capCells[realm];
      let rBest = -1;
      let dBest = Infinity;
      for (let r = 0; r < seeds.length; r++) {
        if (owner[r] !== realm) continue;
        for (const o of adj[r]) {
          if (owner[o] !== -1) continue;
          const d = Math.hypot(gx(G, seeds[o] % G.nx) - gx(G, cap % G.nx), gy(G, Math.floor(seeds[o] / G.nx)) - gy(G, Math.floor(cap / G.nx)));
          if (d < dBest) (dBest = d), (rBest = o);
        }
      }
      if (rBest >= 0) (best = ratio), (pickRealm = realm), (pickReg = rBest);
    }
    if (pickRealm < 0) break;
    owner[pickReg] = pickRealm;
    held[pickRealm] += regArea[pickReg];
  }

  // ── realm definitions
  const nationIds: string[] = [];
  const nations: NationDef[] = [];
  const fixed: FixedProv[] = [];
  const personalities = PERSONALITY_CYCLE.slice();
  for (let k = personalities.length - 1; k > 0; k--) {
    const r = Math.floor(rnd() * (k + 1));
    [personalities[k], personalities[r]] = [personalities[r], personalities[k]];
  }
  const palette = PALETTE.slice();
  for (let k = palette.length - 1; k > 0; k--) {
    const r = Math.floor(rnd() * (k + 1));
    [palette[k], palette[r]] = [palette[r], palette[k]];
  }
  const strengths = shuffled(STRENGTHS, rnd);
  const constraints = shuffled(CONSTRAINTS, rnd);
  for (let k = 0; k < realms; k++) {
    const c = cultures[k];
    const stem = names.stem(c);
    let id = slug(stem).slice(0, 3);
    for (let n = 3; nationIds.includes(id) && n < slug(stem).length; n++) id = slug(stem).slice(0, n + 1);
    while (nationIds.includes(id)) id = `${id.slice(0, 2)}${k}`;
    nationIds.push(id);
    const capName = names.place(c);
    const capId = slug(capName);
    const cap = capCells[k];
    const near = ranges.some((r) => r.pts.some((p) => Math.hypot(p[0] - gx(G, cap % G.nx), p[1] - gy(G, Math.floor(cap / G.nx))) < 260));
    const s = strengths[k % strengths.length];
    let con = constraints[k % constraints.length];
    if (Object.keys(con.traits).some((t) => t in s.traits)) con = constraints[(k + 1) % constraints.length];
    nations.push({
      id,
      name: `${names.title(c)} of ${stem}`,
      short: stem,
      adjective: names.adjectiveOf(stem, c),
      color: palette[k % palette.length],
      capital: capId,
      personality: personalities[k % personalities.length],
      emblem: CHARGE_NAMES[1 + Math.floor(rnd() * (CHARGE_NAMES.length - 1))],
      summary: '',
      strength: s.text,
      constraint: con.text,
      traits: { ...s.traits, ...con.traits },
      arms: {
        field: 'realm',
        ordinary: ORDINARY_NAMES[1 + Math.floor(rnd() * (ORDINARY_NAMES.length - 1))],
        ordinaryTincture: ['or', 'argent'][Math.floor(rnd() * 2)],
        charge: CHARGE_NAMES[1 + Math.floor(rnd() * (CHARGE_NAMES.length - 1))],
        chargeTincture: ['or', 'argent', 'sable'][Math.floor(rnd() * 3)],
      },
    });
    fixed.push({
      id: capId,
      name: capName,
      x: Math.round(gx(G, cap % G.nx)),
      y: Math.round(gy(G, Math.floor(cap / G.nx))),
      region: '', // set below
      owner: id,
      terrain: near ? 'hills' : 'plains',
      resource: rnd() < 0.5 ? 'goods' : near ? 'iron' : 'grain',
      dev: weights[k] > 1.1 ? 6 : 5,
      pop: Math.round(50 + 30 * rnd()),
      infra: weights[k] > 1 ? 2 : 1,
      fort: 1 + (rnd() < 0.5 ? 1 : 0),
    });
  }

  // ── region specs
  const climateBias: Record<Climate, Partial<Record<Terrain, number>>> = {
    temperate: { plains: 3, forest: 2, hills: 1.5, marsh: 0.5 },
    northern: { forest: 3.5, hills: 2, plains: 1.5, marsh: 1 },
    southern: { plains: 3.5, hills: 2, forest: 0.8, marsh: 0.6 },
    arid: { steppe: 3.5, plains: 2, hills: 1.5 },
  };
  const regionDefs: RegionDef[] = [];
  const regions: RegionSpec[] = [];
  const cultureOfRealm = (r: number) => (r >= 0 ? nationIds[r] : frontierCulture.id);
  const capRegion = new Map<number, number>(); // realm → region index
  capCells.forEach((c, k) => {
    if (comp.label[c] === mainComp) capRegion.set(k, regOf[c]);
  });
  const regionId = (r: number) => `r${r}`;
  const biomeAt = (_x: number, y: number): Partial<Record<Terrain, number>> => {
    const lat = y / H; // 0 north … 1 south
    const base = { ...climateBias[P.climate] };
    if (lat < 0.3) (base.forest = (base.forest ?? 0) + 1.5), (base.hills = (base.hills ?? 0) + 0.5);
    if (lat > 0.7 && P.climate !== 'northern') (base.plains = (base.plains ?? 0) + 1), (base.steppe = (base.steppe ?? 0) + (P.climate === 'arid' ? 1.5 : 0.5));
    return base;
  };
  let assigned = 0;
  const regionCounts = regArea.map((a) => Math.max(1, Math.round((a * cellArea) / AREA)));
  const scaleFix = mainProvinces / Math.max(1, regionCounts.reduce((a, b) => a + b, 0));
  for (let r = 0; r < seeds.length; r++) {
    const realm = owner[r];
    const x = gx(G, seeds[r] % G.nx);
    const y = gy(G, Math.floor(seeds[r] / G.nx));
    const isCore = realm >= 0 && capRegion.get(realm) === r;
    const nearCore = realm >= 0 && [...adj[r]].some((o) => capRegion.get(realm) === o);
    const c = realm >= 0 ? cultures[realm] : frontierCulture;
    const name = realm >= 0 ? names.feature('region', c) : names.feature('wilds', c);
    regionDefs.push({ id: regionId(r), name });
    const count = Math.max(isCore ? 2 : 1, Math.round(regionCounts[r] * scaleFix));
    assigned += count;
    const claims: Array<[string, number]> = [];
    if (realm >= 0)
      for (const o of adj[r]) {
        const other = owner[o];
        if (other >= 0 && other !== realm && rnd() < 0.18 && !claims.some((x) => x[0] === nationIds[other])) claims.push([nationIds[other], 1]);
      }
    regions.push({
      id: regionId(r),
      culture: cultureOfRealm(realm),
      anchors: [{ x: Math.round(x), y: Math.round(y), owner: realm >= 0 ? nationIds[realm] : null }],
      count,
      biome: biomeAt(x, y),
      wealth: realm < 0 ? 0.9 + rnd() * 0.4 : isCore ? 3.0 + rnd() * 0.4 : nearCore ? 2.4 + rnd() * 0.3 : 1.9 + rnd() * 0.4,
      ...(realm >= 0 && !isCore && !nearCore ? { integ: [65, 90] as [number, number] } : {}),
      ...(claims.length ? { claims } : {}),
    });
  }
  void assigned;
  // capitals on the mainland belong to their region
  capCells.forEach((c, k) => {
    if (comp.label[c] === mainComp) fixed[k].region = regionId(regOf[c]);
  });

  // ── islands: one region each, held by the realm whose capital is on it or nearest
  const islands: IslandSpec[] = [];
  islandComps.forEach((k, n) => {
    const cells: number[] = [];
    for (let c = 0; c < N; c++) if (land[c] && comp.label[c] === k) cells.push(c);
    const set = new Set(cells);
    const poly = outline(G, (c) => set.has(c));
    if (poly.length < 6) return;
    const area = cells.length * cellArea;
    const cx = cells.reduce((s, c) => s + gx(G, c % G.nx), 0) / cells.length;
    const cy = cells.reduce((s, c) => s + gy(G, Math.floor(c / G.nx)), 0) / cells.length;
    const capHere = capCells.findIndex((c) => comp.label[c] === k);
    let realm = capHere;
    if (realm < 0) {
      let bd = Infinity;
      capCells.forEach((c, r) => {
        const d = Math.hypot(gx(G, c % G.nx) - cx, gy(G, Math.floor(c / G.nx)) - cy);
        if (d < bd) (bd = d), (realm = r);
      });
      if (bd > W * 0.28 || rnd() < clamp(P.frontier, 0, 0.5)) realm = -1;
    }
    const c = realm >= 0 ? cultures[realm] : frontierCulture;
    const rid = `isle${n}`;
    const name = names.feature(realm >= 0 ? 'region' : 'wilds', c);
    regionDefs.push({ id: rid, name: name.replace(/ (Marches|Uplands|Lowlands|Vale|Wolds|Plains|Reach)$/, ' Isles') });
    const count = Math.max(1, Math.round(area / AREA));
    const isleName = names.place(c);
    if (capHere >= 0) fixed[capHere].region = rid;
    regions.push({ id: rid, culture: cultureOfRealm(realm), anchors: [], count: count + (capHere >= 0 ? 1 : 0), biome: biomeAt(cx, cy), wealth: realm >= 0 ? 2.2 : 1.0 });
    islands.push({ name: isleName, poly, region: rid, owner: realm >= 0 ? nationIds[realm] : null, count });
  });
  // a realm whose capital landed on a dropped island moves to the mainland region nearest it
  fixed.forEach((f, k) => {
    if (f.region) return;
    let bestR = 0;
    let bd = Infinity;
    seeds.forEach((s, r) => {
      const d = Math.hypot(gx(G, s % G.nx) - f.x, gy(G, Math.floor(s / G.nx)) - f.y);
      if (d < bd) (bd = d), (bestR = r);
    });
    f.region = regionId(bestR);
    f.x = Math.round(gx(G, seeds[bestR] % G.nx));
    f.y = Math.round(gy(G, Math.floor(seeds[bestR] / G.nx)));
    regions[bestR].anchors[0].owner = nationIds[k];
  });

  // ── passes over each range (one per ~420 units), held by the region they stand in
  ranges.forEach((r, k) => {
    const c = cultures[k % cultures.length];
    r.name = names.feature('range', c);
    let along = 0;
    const lenTotal = r.pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - r.pts[i - 1][0], p[1] - r.pts[i - 1][1]) : 0), 0);
    const passes = Math.max(1, Math.round(lenTotal / 420));
    const spacing = lenTotal / (passes + 1);
    let next = spacing;
    for (let i = 1; i < r.pts.length - 1 && fixed.filter((f) => f.pass && f.name.includes(r.name)).length < passes; i++) {
      along += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
      if (along < next) continue;
      next += spacing;
      const [px, py] = r.pts[i];
      // the region of the land beside the pass
      let reg = -1;
      for (let d = 1; d < 8 && reg < 0; d++)
        for (const [di, dj] of [[d, 0], [-d, 0], [0, d], [0, -d]]) {
          const ci = Math.floor(px / STEP) + di;
          const cj = Math.floor(py / STEP) + dj;
          if (ci < 0 || cj < 0 || ci >= G.nx || cj >= G.ny) continue;
          const rr = regOf[cj * G.nx + ci];
          if (rr >= 0) {
            reg = rr;
            break;
          }
        }
      if (reg < 0) continue;
      const realm = owner[reg];
      const passName = `${names.place(realm >= 0 ? cultures[realm] : frontierCulture).replace(/\s.*$/, '')} Pass`;
      names.reserve(passName);
      fixed.push({ id: slug(passName), name: passName, x: px, y: py, region: regionId(reg), owner: realm >= 0 ? nationIds[realm] : null, terrain: 'mountains', resource: null, dev: 1, pop: 9, fort: realm >= 0 ? 1 + (rnd() < 0.5 ? 1 : 0) : 0, integ: realm >= 0 ? 80 : undefined, pass: true });
      regions[reg].count += 1;
    }
  });
  lakes.forEach((l, k) => (l.name = names.feature('lake', cultures[k % cultures.length])));
  rivers.forEach((r, k) => (r.name = names.feature('river', cultures[k % cultures.length])));

  // ── place names: plenty for every culture in use
  const placeNames: Record<string, string[]> = {};
  const need = new Map<string, number>();
  for (const r of regions) need.set(r.culture, (need.get(r.culture) ?? 0) + r.count + 4);
  for (const i of islands) if (i.owner) need.set(i.owner, (need.get(i.owner) ?? 0) + i.count + 2);
  for (const [cul, n] of need) placeNames[cul] = names.places(nationIds.includes(cul) ? cultures[nationIds.indexOf(cul)] : frontierCulture, Math.ceil(n * 1.6) + 6);

  // ── labels: open seas (farthest from land), ranges, lakes
  const labels: MapLabelDef[] = [];
  {
    const seaDist = distanceField(G, (c) => land[c] === 1);
    const picks: Array<{ x: number; y: number }> = [];
    const order2 = [...seaDist.keys()].filter((c) => !land[c] && seaDist[c] >= 3).sort((a, b) => seaDist[b] - seaDist[a] || a - b);
    const want = clamp(Math.round(provinces / 60), 2, 7);
    for (const c of order2) {
      if (picks.length >= want) break;
      const x = gx(G, c % G.nx);
      const y = gy(G, Math.floor(c / G.nx));
      if (picks.some((p) => Math.hypot(p.x - x, p.y - y) < W / 4)) continue;
      picks.push({ x, y });
    }
    picks.forEach((p, k) => labels.push({ kind: 'sea', name: names.feature('sea', cultures[k % cultures.length]), x: Math.round(p.x), y: Math.round(p.y), size: 56 }));
  }
  for (const r of ranges) {
    const m = Math.floor(r.pts.length / 2);
    const a = r.pts[Math.max(0, m - 1)];
    const b = r.pts[Math.min(r.pts.length - 1, m + 1)];
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (ang > Math.PI / 2) ang -= Math.PI;
    if (ang < -Math.PI / 2) ang += Math.PI;
    labels.push({ kind: 'range', name: r.name, x: r.pts[m][0], y: r.pts[m][1] + 40, size: 26, angle: Math.round(ang * 100) / 100 });
  }
  for (const l of lakes) labels.push({ kind: 'lake', name: l.name, x: l.cx, y: l.cy, size: 22 });

  const spec: WorldSpec = {
    id: P.id,
    scale: 0.84,
    bounds: { minX: 0, minY: 0, maxX: W, maxY: H },
    mainland,
    islands,
    lakes,
    ranges,
    rivers,
    fixed,
    regions,
    regionDefs,
    nations,
    labels,
    names: placeNames,
  };

  // ── map description and rules (thresholds scaled to the number of realms; DESIGN.md)
  const size = sizeFor(provinces);
  const mechanics: string[] = [];
  if (ranges.length) mechanics.push('Mountain passes');
  if (rivers.length) mechanics.push('River crossings');
  if (islands.length) mechanics.push('Straits and islands');
  if (P.frontier >= 0.05) mechanics.push('Unclaimed frontier');
  const style: Record<MapShape, string> = {
    continent: 'Continental war on several fronts',
    archipelago: 'Naval war among islands',
    'inland-sea': 'War around an inland sea',
    peninsulas: 'Peninsulas joined by narrow necks',
    twin: 'Two lands fighting over one isthmus',
  };
  const years = campaignYearsFor(size);
  const meta: MapMeta = {
    name: P.name,
    description: `${realms} realms on ${SHAPE_LABELS[P.shape].toLowerCase()}, about ${provinces} provinces.`,
    blurb: `A generated ${size} map (seed ${P.seed}).`,
    size,
    difficulty: 'standard',
    style: style[P.shape],
    mechanics,
    origin: 'generated',
    ...P.meta,
  };
  const rules: MapRules = {
    startYear: clamp(Math.round(P.startYear), 1870, 1930),
    campaignYears: years,
    victory: scaledVictory(regionDefs.length, realms),
    researchCostMul: researchCostFor(provinces, realms),
  };
  return { spec, meta, rules };
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Share of provinces holding each deposit (about Aldmere's mix), before climate. */
const DEPOSIT_SHARE: Record<ResourceKind, number> = { coal: 0.14, iron: 0.065, food: 0.1, nitrates: 0.06, oil: 0.035, rubber: 0.03 };
const CLIMATE_DEPOSITS: Record<Climate, Partial<Record<ResourceKind, number>>> = {
  temperate: {},
  northern: { rubber: 0.4, food: 0.8, coal: 1.1 },
  southern: { rubber: 1.7, food: 1.2, coal: 0.85 },
  arid: { oil: 1.8, nitrates: 1.5, food: 0.7, rubber: 0.3 },
};
/** Where each deposit is likely, by terrain. */
const AFFINITY: Record<ResourceKind, Partial<Record<Terrain, number>>> = {
  coal: { hills: 4, mountains: 2.5, forest: 1.5, plains: 0.6, steppe: 0.6, marsh: 0.3 },
  iron: { mountains: 4, hills: 3, forest: 0.5, steppe: 0.4, plains: 0.3 },
  food: { plains: 4, marsh: 1, steppe: 1, forest: 0.5 },
  nitrates: { steppe: 3, plains: 1.5, hills: 0.5 },
  oil: { steppe: 3, marsh: 3, plains: 0.5, hills: 0.4 },
  rubber: { marsh: 3, forest: 3, plains: 0.2 },
};

/**
 * Places the industrial deposits of a generated map: about Aldmere's mix of
 * coal, iron, food, nitrates, oil and rubber, shifted by climate, on the
 * terrain that suits each (food on rivers and coasts). Every realm starts with
 * at least one coal field, so each can begin to industrialise; the rest is
 * spread by weighted draws, rarest deposits first.
 */
function placeDeposits(pkg: MapPackage, P: ProceduralParams): void {
  const rnd = mulberry(hashStr(`${P.id}:${P.seed}:deposits`));
  const wet = new Set<string>();
  for (const e of pkg.geometry.edges) {
    if (e.a === SEA) wet.add(e.b);
    if (e.b === SEA) wet.add(e.a);
  }
  for (const [a, b] of pkg.rivers) (wet.add(a), wet.add(b));
  for (const p of pkg.provinces) p.resource = null;
  const weight = (kind: ResourceKind, p: (typeof pkg.provinces)[number]) => (AFFINITY[kind][p.terrain] ?? 0) * (kind === 'food' && wet.has(p.id) ? 1.6 : 1);
  // one coal field in every realm
  for (const n of pkg.nations) {
    let best: (typeof pkg.provinces)[number] | null = null;
    let bestScore = -1;
    for (const p of pkg.provinces) {
      if (p.owner !== n.id) continue;
      const score = (weight('coal', p) + 0.2) * (0.5 + rnd());
      if (score > bestScore) (best = p), (bestScore = score);
    }
    if (best) best.resource = 'coal';
  }
  const kinds: ResourceKind[] = ['rubber', 'oil', 'iron', 'nitrates', 'food', 'coal'];
  for (const kind of kinds) {
    const want = Math.round(pkg.provinces.length * DEPOSIT_SHARE[kind] * (CLIMATE_DEPOSITS[P.climate][kind] ?? 1));
    const have = pkg.provinces.filter((p) => p.resource === kind).length;
    // weighted sampling without replacement (Efraimidis–Spirakis keys)
    const keyed = pkg.provinces
      .filter((p) => p.resource === null && weight(kind, p) > 0)
      .map((p) => ({ p, k: Math.pow(rnd(), 1 / weight(kind, p)) }))
      .sort((a, b) => b.k - a.k || (a.p.id < b.p.id ? -1 : 1));
    for (const { p } of keyed.slice(0, Math.max(0, want - have))) p.resource = kind;
  }
}

/** Describes each realm's start once its provinces exist (start type, rating, summary). */
function describeRealms(pkg: MapPackage): void {
  const byOwner = new Map<string, typeof pkg.provinces>();
  for (const p of pkg.provinces) if (p.owner) (byOwner.get(p.owner) ?? byOwner.set(p.owner, []).get(p.owner)!).push(p);
  const coastal = new Set(pkg.seaZones.flatMap((z) => z.coasts));
  const stats = pkg.nations.map((n) => {
    const mine = byOwner.get(n.id) ?? [];
    const dev = mine.reduce((s, p) => s + p.dev, 0);
    const coast = mine.filter((p) => coastal.has(p.id)).length / Math.max(1, mine.length);
    const ids = new Set(mine.map((p) => p.id));
    const foreign = new Set<string>();
    let wild = 0;
    for (const p of mine)
      for (const q of p.neighbors) {
        if (ids.has(q)) continue;
        const o = pkg.provinces.find((x) => x.id === q);
        if (o?.owner) foreign.add(o.owner);
        else if (o) wild++;
      }
    return { n, size: mine.length, dev, coast, neighbours: foreign.size, wild };
  });
  const byDev = [...stats].sort((a, b) => b.dev - a.dev);
  for (const s of stats) {
    const terrain = new Map<string, number>();
    for (const p of byOwner.get(s.n.id) ?? []) terrain.set(p.terrain, (terrain.get(p.terrain) ?? 0) + 1);
    const main = [...terrain].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'plains';
    s.n.startType =
      s === byDev[0] ? 'Wealthy heartland' : s.wild >= 4 ? 'Frontier to settle' : s.coast > 0.6 ? 'Maritime trader' : s.neighbours >= 4 ? 'Exposed crossroads' : s.size <= 5 ? 'Compact defensive' : 'Established crown';
    s.n.rating = s === byDev[0] ? 'recommended' : s === byDev[byDev.length - 1] ? 'challenging' : 'standard';
    s.n.summary = `${s.size} provinces of mostly ${main}${s.coast > 0.4 ? ' along the coast' : ''}; ${s.neighbours} neighbouring realm${s.neighbours === 1 ? '' : 's'}${s.wild ? ' and open frontier' : ''}.`;
  }
}

/**
 * Builds a whole map package from parameters: the spec, the world, sea zones,
 * realm descriptions and validation. Retries with other hidden choices (up to
 * `tries` times) when a layout cannot be built; throws if none can.
 */
export function buildProceduralMap(P: ProceduralParams, opts: { tries?: number; log?: (l: string) => void } = {}): ProceduralResult {
  const tries = opts.tries ?? 6;
  let last: unknown = null;
  for (let salt = 0; salt < tries; salt++) {
    try {
      const { spec, meta, rules } = proceduralSpec(P, salt);
      const world = generateWorld(spec, opts.log);
      const pkg: MapPackage = {
        format: MAP_FORMAT,
        version: MAP_FORMAT_VERSION,
        id: P.id,
        revision: 1,
        meta,
        rules,
        regions: spec.regionDefs.filter((r) => world.provinces.some((p) => p.region === r.id)),
        nations: spec.nations,
        provinces: world.provinces,
        straits: world.straits,
        rivers: world.rivers,
        seaZones: [],
        geometry: { bounds: world.geometry.bounds, centers: world.geometry.provinces, edges: world.geometry.edges, waste: world.geometry.waste, labels: world.geometry.labels },
      };
      // borders that round to nothing carry no information (the validator would only warn)
      pkg.geometry.edges = pkg.geometry.edges.filter((e) => e.pts.some((v, i) => v !== e.pts[i % 2]));
      placeDeposits(pkg, P);
      addSeaZones(pkg);
      describeRealms(pkg);
      const check = validateMapPackage(pkg);
      if (!check.ok) {
        last = new WorldError(check.errors.map((e) => e.message).join(' '));
        continue;
      }
      return { pkg, check, world, spec, attempts: salt + 1 };
    } catch (e) {
      last = e;
      if (!(e instanceof WorldError)) throw e;
    }
  }
  throw last instanceof Error ? last : new WorldError('the map could not be built');
}
