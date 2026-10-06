// The real-world map pipeline: builds a campaign map from Natural Earth through
// the shared world generator (src/maps/gen/world.ts), like every other map. A
// map is one RealMapDef: its frame and projection, its realms and regions, the
// rule that assigns every first-level division to a region, and what Natural
// Earth cannot give (historical names, ridges and passes, straits).
// "The Baltic, 1906" keeps its own script (tools/genbaltic.ts) so its geometry,
// and the saves made on it, do not change.
//
// Natural Earth (naturalearthdata.com) is in the public domain. The layers are
// downloaded into .cache/naturalearth/ (not committed) if missing and checked
// against the SHA-256 sums pinned below.
//
// Steps: project; rasterise land, lakes and divisions on the generator's grid;
// classify every land cell into a region; split the land into the landmasses
// divided among regions (continents), whole islands and dropped islets; clean
// region enclaves; choose cities as fixed provinces; size regions by area;
// generate; name provinces after the towns in them; place deposits; add sea
// zones (with the ocean's wrap-around links on a world map); set victory
// thresholds from the starting shares; validate.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MAP_FORMAT, MAP_FORMAT_VERSION, sizeFor, type MapLabelDef, type MapMeta, type MapPackage } from '../src/maps/format';
import { previewSvg, type Pt } from '../src/maps/gen/core';
import { slug } from '../src/maps/gen/names';
import { components, outline, placeDeposits, type Climate, type Grid } from '../src/maps/gen/procedural';
import { generateWorld, worldReport, type FixedProv, type IslandSpec, type LakeSpec, type RangeSpec, type RegionSpec, type RiverSpec, type WorldSpec } from '../src/maps/gen/world';
import { researchCostFor, scaledVictory } from '../src/maps/rules';
import { decodeGrid } from '../src/maps/seazones';
import { addSeaZones, validateMapPackage } from '../src/maps/validate';
import type { NationDef, RegionDef, ResourceKind, Terrain } from '../src/sim/types';

export const NE_VERSION = 'v5.1.2';
const CACHE = '.cache/naturalearth';
export const LAYERS = {
  land50: { file: 'ne_50m_land', sha256: 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b' },
  land10: { file: 'ne_10m_land', sha256: '1ac90796408bc6ad6911d69448485d3c4dbf2190370080368a09976e1c9f7416' },
  lakes50: { file: 'ne_50m_lakes', sha256: 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52' },
  rivers10: { file: 'ne_10m_rivers_lake_centerlines', sha256: 'bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a' },
  admin: { file: 'ne_10m_admin_1_states_provinces', sha256: '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5' },
  places: { file: 'ne_10m_populated_places_simple', sha256: 'fd3fa867a320cbd5c5b6bb5bc550afeec2939fb2cef688e508007282a55ac42f' },
} as const;
export type LayerKey = keyof typeof LAYERS;

export type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };

const layerCache = new Map<string, Feature[]>();
export function layer(key: LayerKey): Feature[] {
  const hit = layerCache.get(key);
  if (hit) return hit;
  const { file, sha256 } = LAYERS[key];
  const path = `${CACHE}/${file}.geojson`;
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    const url = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson/${file}.geojson`;
    console.log(`downloading ${url}`);
    execFileSync('curl', ['-sSfL', '-o', path, url], { stdio: 'inherit' });
  }
  const buf = readFileSync(path);
  const sum = createHash('sha256').update(buf).digest('hex');
  if (sum !== sha256) throw new Error(`${path}: SHA-256 ${sum} does not match the pinned ${sha256}; delete it to download again`);
  const out = (JSON.parse(buf.toString('utf8')) as { features: Feature[] }).features;
  layerCache.set(key, out);
  return out;
}

export function polygons(g: Feature['geometry']): number[][][][] {
  if (g.type === 'Polygon') return [g.coordinates as number[][][]];
  if (g.type === 'MultiPolygon') return g.coordinates as number[][][][];
  return [];
}
function lines(g: Feature['geometry']): number[][][] {
  if (g.type === 'LineString') return [g.coordinates as number[][]];
  if (g.type === 'MultiLineString') return g.coordinates as number[][][];
  return [];
}

// ───────────────────────────── projections (kilometres) ─────────────────────

export interface Projection {
  fwd(lon: number, lat: number): [number, number];
  inv(x: number, y: number): [number, number];
}
const R = 6371;
const rad = Math.PI / 180;

/** Lambert conformal conic with two standard parallels. */
export function lambert(lon0: number, lat0: number, lat1: number, lat2: number): Projection {
  const P1 = lat1 * rad;
  const P2 = lat2 * rad;
  const L0 = lon0 * rad;
  const N = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(Math.tan(Math.PI / 4 + P2 / 2) / Math.tan(Math.PI / 4 + P1 / 2));
  const F = (Math.cos(P1) * Math.tan(Math.PI / 4 + P1 / 2) ** N) / N;
  const rho = (phi: number) => (R * F) / Math.tan(Math.PI / 4 + phi / 2) ** N;
  const RHO0 = rho(lat0 * rad);
  return {
    fwd(lon, lat) {
      const r = rho(lat * rad);
      const t = N * (lon * rad - L0);
      return [r * Math.sin(t), RHO0 - r * Math.cos(t)];
    },
    inv(x, y) {
      const r = Math.sign(N) * Math.hypot(x, RHO0 - y);
      const t = Math.atan2(x, RHO0 - y);
      return [(L0 + t / N) / rad, (2 * Math.atan(((R * F) / r) ** (1 / N)) - Math.PI / 2) / rad];
    },
  };
}

/**
 * The Equal Earth projection (Šavrič, Patterson and Jenny 2018): equal-area, so
 * provinces sized by area keep their size everywhere. Longitudes are taken
 * relative to `lon0` and wrapped into (lon0 − 180, lon0 + 180].
 */
export function equalEarth(lon0: number): Projection {
  const A1 = 1.340264;
  const A2 = -0.081106;
  const A3 = 0.000893;
  const A4 = 0.003796;
  const M = Math.sqrt(3) / 2;
  const wrap = (lon: number) => {
    let d = lon - lon0;
    while (d <= -180) d += 360;
    while (d > 180) d -= 360;
    return d;
  };
  return {
    fwd(lon, lat) {
      const l = wrap(lon) * rad;
      const th = Math.asin(M * Math.sin(lat * rad));
      const t2 = th * th;
      const t6 = t2 * t2 * t2;
      const x = (2 * Math.sqrt(3) * l * Math.cos(th)) / (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1));
      const y = th * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1);
      return [R * x, R * y];
    },
    inv(x, y) {
      const X = x / R;
      const Y = y / R;
      let th = Y;
      for (let i = 0; i < 12; i++) {
        const t2 = th * th;
        const t6 = t2 * t2 * t2;
        const f = th * (A4 * t6 * t2 + A3 * t6 + A2 * t2 + A1) - Y;
        const fp = 9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1;
        th -= f / fp;
      }
      const t2 = th * th;
      const t6 = t2 * t2 * t2;
      const l = (3 * X * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)) / (2 * Math.sqrt(3) * Math.cos(th));
      return [lon0 + l / rad, Math.asin(Math.sin(th) / M) / rad];
    },
  };
}

// ───────────────────────────── the definition ──────────────────────────────

export interface RealRegion {
  id: string;
  name: string;
  realm: string;
  /** terrain weights for provinces without a fixed terrain */
  biome: Partial<Record<Terrain, number>>;
  /** integration range of its provinces at the start (loosely held lands) */
  integ?: [number, number];
  /** province area multiplier: thinly settled land gets larger provinces */
  sparse?: number;
}

export interface Division {
  adm0: string;
  name: string;
  /** Natural Earth's grouping of divisions (French and Italian regions, Russian federal districts…), or '' */
  group: string;
  props: Record<string, unknown>;
}

export interface RealMapDef {
  id: string;
  revision: number;
  meta: MapMeta;
  startYear: number;
  campaignYears: { options: number[]; default: number };
  nations: NationDef[];
  regions: RealRegion[];
  /** each realm's capital: the Natural Earth place name (its modern spelling) and country */
  capitals: Record<string, [string, string]>;
  /** the region of a division at a point; null leaves it off the map; undefined is an error (unclassified) */
  classify(d: Division, lon: number, lat: number): string | null | undefined;
  proj: Projection;
  /** the frame, in degrees, and the test for being inside it */
  box: { west: number; east: number; south: number; north: number };
  inCrop(lon: number, lat: number): boolean;
  /** kilometres per design unit */
  km: number;
  /** province area in km² before a region's `sparse` factor */
  provKm2: number;
  minIslandKm2: number;
  minLakeKm2: number;
  /** landmasses this large are divided among regions (continents); smaller ones are whole islands */
  regionalKm2: number;
  land: 'land50' | 'land10';
  /** Natural Earth lake name → the name shown */
  lakes: Record<string, string>;
  /** Natural Earth river name → the name shown */
  rivers: Record<string, string>;
  riverMinKm: number;
  ridges: Array<{ name: string; halfKm: number; pts: Array<[number, number]> }>;
  passes: Array<{ name: string; lon: number; lat: number }>;
  islandNames: Array<[string, number, number]>;
  seas: Array<[string, number, number, number?]>;
  /** modern place name → the name in use at the start */
  names: Record<string, string>;
  /** places Natural Earth lists that did not yet exist as towns at the start */
  notYet: string[];
  straits: Array<{ name: string; a: [number, number]; b: [number, number] }>;
  straitMaxKm: number;
  cities: { max: number; minPop: number; spacingKm: number };
  depositHints: Array<{ kind: ResourceKind; lon: number; lat: number; km: number; weight: number }>;
  climate: Climate;
  /** sea zones that touch the left and right edges of a world map are linked (the ocean continues) */
  wrapOcean?: boolean;
  /** victory thresholds measured for this map, over the scaled defaults */
  victory?: Partial<NonNullable<MapPackage['rules']['victory']>>;
}

export interface RealMapResult {
  pkg: MapPackage;
  report: string;
  world: ReturnType<typeof generateWorld>;
}

/** Fills the cells whose centres lie inside a polygon (even-odd over its rings), by scanlines. */
function fillPoly(G: Grid, rings: Pt[][], set: (c: number) => void): void {
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of rings) for (const [, y] of r) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const j0 = Math.max(0, Math.floor(y0 / G.g));
  const j1 = Math.min(G.ny - 1, Math.ceil(y1 / G.g));
  for (let j = j0; j <= j1; j++) {
    const y = (j + 0.5) * G.g;
    const xs: number[] = [];
    for (const r of rings)
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
        const [xa, ya] = r[a];
        const [xb, yb] = r[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / G.g - 0.5));
      const i1 = Math.min(G.nx - 1, Math.floor(xs[k + 1] / G.g - 0.5));
      for (let i = i0; i <= i1; i++) set(j * G.nx + i);
    }
  }
}

export function buildRealMap(D: RealMapDef, log: (l: string) => void = () => {}): RealMapResult {
  const STEP = 14;
  const KM = D.km;
  const CELL_KM2 = (STEP * KM) ** 2;
  // frame: the box, projected, with a margin of open sea
  const frame: Array<[number, number]> = [];
  for (let lon = D.box.west; lon <= D.box.east; lon += 0.5) frame.push(D.proj.fwd(lon, D.box.south), D.proj.fwd(lon, D.box.north));
  for (let lat = D.box.south; lat <= D.box.north; lat += 0.5) frame.push(D.proj.fwd(D.box.west, lat), D.proj.fwd(D.box.east, lat));
  const MARGIN = 6 * STEP;
  const kx0 = Math.min(...frame.map((p) => p[0]));
  const ky1 = Math.max(...frame.map((p) => p[1]));
  const toDu = ([x, y]: [number, number]): Pt => [(x - kx0) / KM + MARGIN, (ky1 - y) / KM + MARGIN];
  const fromDu = (x: number, y: number): [number, number] => D.proj.inv((x - MARGIN) * KM + kx0, ky1 - (y - MARGIN) * KM);
  const proj = (lon: number, lat: number): Pt => toDu(D.proj.fwd(lon, lat));
  const BOUNDS = {
    minX: 0,
    minY: 0,
    maxX: Math.ceil((Math.max(...frame.map((p) => p[0])) - kx0) / KM + 2 * MARGIN),
    maxY: Math.ceil((ky1 - Math.min(...frame.map((p) => p[1]))) / KM + 2 * MARGIN),
  };
  const G: Grid = { nx: Math.ceil(BOUNDS.maxX / STEP), ny: Math.ceil(BOUNDS.maxY / STEP), x0: 0, y0: 0, g: STEP };
  const CELLS = G.nx * G.ny;
  const cxOf = (c: number) => ((c % G.nx) + 0.5) * STEP;
  const cyOf = (c: number) => (Math.floor(c / G.nx) + 0.5) * STEP;
  const cellAt = (x: number, y: number) => Math.max(0, Math.min(G.ny - 1, Math.floor(y / STEP))) * G.nx + Math.max(0, Math.min(G.nx - 1, Math.floor(x / STEP)));
  const nbrs4 = (c: number): number[] => {
    const i = c % G.nx;
    const out: number[] = [];
    if (i > 0) out.push(c - 1);
    if (i < G.nx - 1) out.push(c + 1);
    if (c >= G.nx) out.push(c - G.nx);
    if (c + G.nx < CELLS) out.push(c + G.nx);
    return out;
  };
  log(`${D.id}: grid ${G.nx}×${G.ny} (${CELLS} cells, ${Math.round(CELL_KM2)} km² each)`);
  const lonlat = Array.from({ length: CELLS }, (_, c) => fromDu(cxOf(c), cyOf(c)));
  const crop = Uint8Array.from(lonlat, ([lon, lat]) => (D.inCrop(lon, lat) ? 1 : 0));
  // a polygon ring, projected; rings that cross the frame's seam (a world map's
  // antimeridian, relative to lon0) are split there by the projection's wrap
  const projRing = (ring: number[][]): Pt[] => ring.map(([lon, lat]) => proj(lon, lat));
  const seamSafe = (ring: Pt[]) => {
    // a ring whose consecutive points jump across most of the map crosses the seam: drop it
    for (let k = 1; k < ring.length; k++) if (Math.abs(ring[k][0] - ring[k - 1][0]) > BOUNDS.maxX / 2) return false;
    return true;
  };
  const bbHits = (rings: number[][][]) => rings[0].some(([lon, lat]) => lat > D.box.south - 3 && lat < D.box.north + 3 && (D.box.east - D.box.west >= 350 || (lon > D.box.west - 3 && lon < D.box.east + 3)));
  const fill = (rings: number[][][], set: (c: number) => void) => {
    const pr = rings.map(projRing);
    if (!pr.every(seamSafe)) {
      // split at the seam: fill each side separately by shifting the points onto one side
      const left = pr.map((r) => r.map(([x, y]) => [x < BOUNDS.maxX / 2 ? x : x - BOUNDS.maxX * 10, y] as Pt));
      const right = pr.map((r) => r.map(([x, y]) => [x >= BOUNDS.maxX / 2 ? x : x + BOUNDS.maxX * 10, y] as Pt));
      fillPoly(G, left, set);
      fillPoly(G, right, set);
      return;
    }
    fillPoly(G, pr, set);
  };

  // land, lakes, divisions
  const land = new Uint8Array(CELLS);
  for (const f of layer(D.land)) for (const poly of polygons(f.geometry)) if (bbHits(poly)) fill(poly, (c) => (land[c] = 1));
  const lakeAt = new Int16Array(CELLS).fill(-1);
  const lakeFeatures = layer('lakes50').filter((f) => typeof f.properties.name === 'string' && D.lakes[f.properties.name as string]);
  lakeFeatures.forEach((f, k) => {
    for (const poly of polygons(f.geometry)) if (bbHits(poly)) fill(poly, (c) => (lakeAt[c] = k));
  });
  const adminFeatures = layer('admin').filter((f) => polygons(f.geometry).some(bbHits));
  const adminAt = new Int16Array(CELLS).fill(-1);
  adminFeatures.forEach((f, k) => {
    for (const poly of polygons(f.geometry)) fill(poly, (c) => (adminAt[c] = k));
  });
  log(`rasterised land, ${lakeFeatures.length} lakes, ${adminFeatures.length} divisions`);
  // fjords and inlets a cell or two wide cannot hold a border: fill them, so no province is cut in two
  for (let pass = 0; pass < 2; pass++) {
    const fillIn: number[] = [];
    for (let c = G.nx; c < CELLS - G.nx; c++) {
      if (land[c] || c % G.nx === 0 || c % G.nx === G.nx - 1) continue;
      let k = 0;
      for (const d of [-G.nx - 1, -G.nx, -G.nx + 1, -1, 1, G.nx - 1, G.nx, G.nx + 1]) k += land[c + d];
      if (k >= 6) fillIn.push(c);
    }
    for (const c of fillIn) land[c] = 1;
  }

  // the land of the campaign: inside the frame, with a strip of sea round it
  const mask = new Uint8Array(CELLS);
  for (let c = 0; c < CELLS; c++) {
    const i = c % G.nx;
    const j = Math.floor(c / G.nx);
    if (i < 3 || j < 3 || i >= G.nx - 3 || j >= G.ny - 3) continue;
    mask[c] = land[c] && crop[c] ? 1 : 0;
  }
  // divisions for coastal cells the admin layer misses: the nearest classified cell
  const admin = Int16Array.from(adminAt);
  {
    const q: number[] = [];
    for (let c = 0; c < CELLS; c++) if (mask[c] && admin[c] >= 0) q.push(c);
    for (let k = 0; k < q.length; k++) for (const n of nbrs4(q[k])) if (mask[n] && admin[n] < 0) (admin[n] = admin[q[k]]), q.push(n);
  }
  const region = new Array<string | null>(CELLS).fill(null);
  const unknown = new Map<string, number>();
  /** land the classification leaves off the campaign (drawn muted, like land beyond the frame) */
  const leftOut = new Uint8Array(CELLS);
  const division = (k: number): Division => {
    const p = adminFeatures[k].properties;
    return { adm0: String(p.adm0_a3), name: String(p.name), group: String(p.region ?? ''), props: p };
  };
  const divCache = new Map<number, Division>();
  for (let c = 0; c < CELLS; c++) {
    if (!mask[c]) continue;
    if (admin[c] < 0) {
      mask[c] = 0;
      continue;
    }
    const d = divCache.get(admin[c]) ?? divCache.set(admin[c], division(admin[c])).get(admin[c])!;
    const r = D.classify(d, lonlat[c][0], lonlat[c][1]);
    if (r === undefined) unknown.set(`${d.adm0}/${d.name}`, (unknown.get(`${d.adm0}/${d.name}`) ?? 0) + 1);
    if (r) region[c] = r;
    else (mask[c] = 0), (leftOut[c] = r === null ? 1 : 0);
  }
  if (unknown.size) throw new Error(`${D.id}: divisions without a region: ${[...unknown].map(([k, n]) => `${k} (${n} cells)`).join(', ')}`);
  const regionDef = new Map(D.regions.map((r) => [r.id, r]));
  for (let c = 0; c < CELLS; c++) if (region[c] && !regionDef.has(region[c]!)) throw new Error(`${D.id}: classify returned an undeclared region "${region[c]}"`);

  // landmasses: the largest is the mainland; large ones are divided among regions; small ones are whole islands
  let comp = components(G, mask);
  const order = comp.sizes.map((n, k) => ({ n, k })).sort((a, b) => b.n - a.n || a.k - b.k);
  for (const { n, k } of order) {
    if (n * CELL_KM2 >= D.minIslandKm2) continue;
    for (let c = 0; c < CELLS; c++) if (comp.label[c] === k) mask[c] = 0;
  }
  comp = components(G, mask);
  const byLabel = new Map<number, number[]>();
  for (let c = 0; c < CELLS; c++) if (comp.label[c] >= 0) (byLabel.get(comp.label[c]) ?? byLabel.set(comp.label[c], []).get(comp.label[c])!).push(c);
  const masses = [...byLabel.entries()].sort((a, b) => b[1].length - a[1].length || a[0] - b[0]);
  const mainLabel = masses[0][0];
  const isRegionalLabel = new Map<number, boolean>(masses.map(([k, cells], i) => [k, i === 0 || cells.length * CELL_KM2 >= D.regionalKm2]));

  // regions on the landmasses divided among regions: one piece each; small enclaves join their surroundings
  {
    let changed = true;
    let rounds = 0;
    while (changed && rounds++ < 6) {
      changed = false;
      const seen = new Uint8Array(CELLS);
      for (let c0 = 0; c0 < CELLS; c0++) {
        if (seen[c0] || !mask[c0] || !isRegionalLabel.get(comp.label[c0])) continue;
        const r = region[c0];
        const piece: number[] = [c0];
        seen[c0] = 1;
        for (let k = 0; k < piece.length; k++) for (const n of nbrs4(piece[k])) if (!seen[n] && mask[n] && region[n] === r && comp.label[n] === comp.label[c0]) (seen[n] = 1), piece.push(n);
        (piecesOf.get(r!) ?? piecesOf.set(r!, []).get(r!)!).push(piece);
      }
      for (const [r, pieces] of piecesOf) {
        if (pieces.length < 2) continue;
        pieces.sort((a, b) => b.length - a.length);
        // keep the largest, and any other piece on its own landmass worth a province (a later sub-region)
        for (const p of pieces.slice(1)) {
          const own = comp.label[p[0]] !== comp.label[pieces[0][0]];
          if (own && p.length * CELL_KM2 >= 0.5 * D.provKm2 * (regionDef.get(r)!.sparse ?? 1)) continue;
          // otherwise the neighbouring region it touches most
          const votes = new Map<string, number>();
          for (const c of p) for (const n of nbrs4(c)) if (mask[n] && region[n] !== r && region[n]) votes.set(region[n]!, (votes.get(region[n]!) ?? 0) + 1);
          const to = [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
          if (to) {
            for (const c of p) region[c] = to;
            changed = true;
          }
        }
      }
      piecesOf.clear();
    }
  }
  // a region present on two landmasses divided among regions: the smaller part becomes its own region
  const extraRegions: RealRegion[] = [];
  {
    const where = new Map<string, Map<number, number>>();
    for (let c = 0; c < CELLS; c++) {
      if (!mask[c] || !isRegionalLabel.get(comp.label[c])) continue;
      const m = where.get(region[c]!) ?? where.set(region[c]!, new Map()).get(region[c]!)!;
      m.set(comp.label[c], (m.get(comp.label[c]) ?? 0) + 1);
    }
    for (const [r, m] of where) {
      if (m.size < 2) continue;
      const parts = [...m].sort((a, b) => b[1] - a[1]);
      parts.slice(1).forEach(([lab], n) => {
        const base = regionDef.get(r)!;
        const id = `${r}-${n + 2}`;
        const isl = D.islandNames.find(([, lon, lat]) => {
          const at = proj(lon, lat);
          return comp.label[cellAt(at[0], at[1])] === lab;
        })?.[0];
        const def: RealRegion = { ...base, id, name: isl ?? `${base.name} (${n + 2})` };
        extraRegions.push(def);
        regionDef.set(id, def);
        for (let c = 0; c < CELLS; c++) if (mask[c] && comp.label[c] === lab && region[c] === r) region[c] = id;
      });
    }
  }
  const allRegions = [...D.regions, ...extraRegions];

  // the raster for the generator: 0 mainland, k+1 island k (regional or whole), -2 lakes, -1 sea
  const islands: Array<IslandSpec & { cells: number[]; label: number }> = [];
  const usedIslandNames = new Set<string>();
  const islandName = (cells: number[], fallback: string): string => {
    let x = 0;
    let y = 0;
    for (const c of cells) (x += cxOf(c)), (y += cyOf(c));
    x /= cells.length;
    y /= cells.length;
    const set = new Set(cells);
    let best: string | null = null;
    let bd = Infinity;
    for (const [name, lon, lat] of D.islandNames) {
      if (usedIslandNames.has(name)) continue;
      const p = proj(lon, lat);
      const d = set.has(cellAt(p[0], p[1])) ? -1 : Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) (bd = d), (best = name);
    }
    let name = bd < 80 / KM && best ? best : fallback;
    for (let k = 2; usedIslandNames.has(name); k++) name = `${fallback} ${k}`;
    usedIslandNames.add(name);
    return name;
  };
  for (const [lab, cells] of masses) {
    if (lab === mainLabel) continue;
    const votes = new Map<string, number>();
    for (const c of cells) votes.set(region[c]!, (votes.get(region[c]!) ?? 0) + 1);
    const reg = [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const regional = isRegionalLabel.get(lab)!;
    const lat = cells.reduce((s, c) => s + lonlat[c][1], 0) / cells.length;
    void lat;
    const name = islandName(cells, `${regionDef.get(reg)!.name} Isle`);
    if (!regional) for (const c of cells) region[c] = reg;
    const count = regional ? 0 : Math.max(1, Math.round((cells.length * CELL_KM2) / (D.provKm2 * (regionDef.get(reg)!.sparse ?? 1))));
    islands.push({ name, poly: outline(G, (c) => comp.label[c] === lab, 2), region: reg, owner: regionDef.get(reg)!.realm, count, cells, label: lab, ...(regional ? { regional: true } : {}) });
  }
  const islandOfLabel = new Map(islands.map((isl, k) => [isl.label, k]));
  const raster = new Int16Array(CELLS).fill(-1);
  for (let c = 0; c < CELLS; c++) {
    if (!mask[c]) continue;
    raster[c] = comp.label[c] === mainLabel ? 0 : islandOfLabel.get(comp.label[c])! + 1;
  }
  log(`landmasses: mainland ${byLabel.get(mainLabel)!.length} cells; ${islands.filter((i) => i.regional).length} divided among regions (${islands.filter((i) => i.regional).map((i) => i.name).join(', ')}); ${islands.filter((i) => !i.regional).length} whole islands`);

  // lakes: inside the land, large enough to show
  const lakes: LakeSpec[] = [];
  {
    const lakeMask = Uint8Array.from(lakeAt, (v, c) => (v >= 0 && raster[c] >= 0 ? 1 : 0));
    const lakeComp = components(G, lakeMask);
    const cellsOf = new Map<number, number[]>();
    for (let c = 0; c < CELLS; c++) if (lakeComp.label[c] >= 0) (cellsOf.get(lakeComp.label[c]) ?? cellsOf.set(lakeComp.label[c], []).get(lakeComp.label[c])!).push(c);
    for (const [k, cells] of cellsOf) {
      if (cells.length * CELL_KM2 < D.minLakeKm2) continue;
      const inner = cells.filter((c) => nbrs4(c).every((x) => lakeComp.label[x] === k)).length;
      if (inner / cells.length < 0.2) continue;
      const votes = new Map<number, number>();
      for (const c of cells) votes.set(lakeAt[c], (votes.get(lakeAt[c]) ?? 0) + 1);
      const f = lakeFeatures[[...votes].sort((a, b) => b[1] - a[1])[0][0]];
      const poly = outline(G, (c) => lakeComp.label[c] === k, 2);
      const xs = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const r = Math.max(Math.max(...xs) - cx, Math.max(...ys) - cy);
      lakes.push({ name: D.lakes[f.properties.name as string], cx, cy, rx: r, ry: r, rot: 0, poly });
      for (const c of cells) raster[c] = -2;
    }
  }

  // rivers that reach the sea, from source to mouth
  const seaDist = new Int32Array(CELLS).fill(1 << 29);
  {
    const q: number[] = [];
    for (let c = 0; c < CELLS; c++) if (!land[c]) (seaDist[c] = 0), q.push(c);
    for (let k = 0; k < q.length; k++) for (const n of nbrs4(q[k])) if (seaDist[n] > seaDist[q[k]] + 1) (seaDist[n] = seaDist[q[k]] + 1), q.push(n);
  }
  const riverList: RiverSpec[] = [];
  for (const f of layer('rivers10')) {
    const name = D.rivers[String(f.properties.name)];
    if (!name || f.properties.featurecla !== 'River') continue;
    for (const ln of lines(f.geometry)) {
      let run: Pt[] = [];
      const flush = () => {
        if (run.length >= 2) {
          let len = 0;
          for (let k = 1; k < run.length; k++) len += Math.hypot(run[k][0] - run[k - 1][0], run[k][1] - run[k - 1][1]);
          const a = seaDist[cellAt(run[0][0], run[0][1])];
          const b = seaDist[cellAt(run[run.length - 1][0], run[run.length - 1][1])];
          const pts = a < b ? run.slice().reverse() : run;
          if (len * KM >= D.riverMinKm && Math.min(a, b) <= 3) {
            const thin: Pt[] = [pts[0]];
            for (const p of pts.slice(1)) if (Math.hypot(p[0] - thin[thin.length - 1][0], p[1] - thin[thin.length - 1][1]) >= 18) thin.push(p);
            if (thin.length >= 3) riverList.push({ name, pts: thin.map(([x, y]) => [Math.round(x), Math.round(y)]) });
          }
        }
        run = [];
      };
      for (const [lon, lat] of ln) {
        const p = proj(lon, lat);
        const c = cellAt(p[0], p[1]);
        if (raster[c] >= 0 && raster[c] === 0) {
          if (run.length && Math.abs(run[run.length - 1][0] - p[0]) > BOUNDS.maxX / 2) flush();
          run.push(p);
        } else if (raster[c] >= 0 && islands[raster[c] - 1]?.regional) {
          if (run.length && Math.abs(run[run.length - 1][0] - p[0]) > BOUNDS.maxX / 2) flush();
          run.push(p);
        } else flush();
      }
      flush();
    }
  }
  const longest = new Map<string, RiverSpec>();
  for (const r of riverList) if (!longest.has(r.name) || r.pts.length > longest.get(r.name)!.pts.length) longest.set(r.name, r);

  const ranges: RangeSpec[] = D.ridges.map((r) => ({ name: r.name, half: r.halfKm / KM, pts: r.pts.map(([lon, lat]) => proj(lon, lat)) }));

  // cities: realm capitals, then the largest towns, spaced apart
  const notYet = new Set(D.notYet);
  const places = layer('places')
    .map((f) => f.properties as { name: string; latitude: number; longitude: number; pop_max: number; adm0_a3: string })
    .map((p) => ({ ...p, name: p.name.replace(/\s+/g, ' ').trim() }))
    .filter((p) => D.inCrop(p.longitude, p.latitude) && !notYet.has(p.name))
    .map((p) => ({ ...p, at: proj(p.longitude, p.latitude), period: D.names[p.name] ?? p.name }))
    .filter((p) => {
      const c = cellAt(p.at[0], p.at[1]);
      if (raster[c] >= 0) return true;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (raster[c + dj * G.nx + di] >= 0) return true;
      return false;
    })
    .sort((a, b) => b.pop_max - a.pop_max || a.name.localeCompare(b.name));
  const landCellNear = (x: number, y: number): number => {
    const c0 = cellAt(x, y);
    if (raster[c0] >= 0) return c0;
    let best = -1;
    let bd = Infinity;
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const c = c0 + dj * G.nx + di;
        if (c < 0 || c >= CELLS || raster[c] < 0) continue;
        const d = Math.hypot(cxOf(c) - x, cyOf(c) - y);
        if (d < bd) (bd = d), (best = c);
      }
    return best;
  };
  const fixed: FixedProv[] = [];
  const takenNames = new Set<string>();
  const addCity = (p: (typeof places)[number], capital?: string): boolean => {
    const c = landCellNear(p.at[0], p.at[1]);
    if (c < 0) return false;
    const reg = region[c]!;
    const realm = regionDef.get(reg)!.realm;
    if (capital && realm !== capital) throw new Error(`${D.id}: ${p.name} lies in ${reg} (${realm}), not ${capital}`);
    // a whole island holds as many provinces as its count: a city there must not exceed it
    const isl = raster[c] > 0 ? islands[raster[c] - 1] : null;
    if (isl && !isl.regional && !capital && fixed.filter((f) => raster[landCellNear(f.x, f.y)] === raster[c]).length >= isl.count) return false;
    const big = p.pop_max;
    const nation = D.nations.find((n) => n.id === capital);
    fixed.push({
      id: nation ? nation.capital : slug(p.period),
      name: p.period,
      x: Math.round(cxOf(c)),
      y: Math.round(cyOf(c)),
      region: reg,
      owner: realm,
      terrain: 'plains',
      resource: null,
      dev: capital ? (big > 2e6 ? 7 : 6) : Math.max(3, Math.min(6, Math.round(2.6 + 1.3 * Math.log10(Math.max(1, big) / 50000)))),
      pop: Math.max(30, Math.min(90, Math.round(30 + 20 * Math.log10(Math.max(1, big) / 30000)))),
      infra: capital ? 2 : 1,
      fort: capital ? 2 : big > 1e6 ? 1 : 0,
    });
    takenNames.add(p.period);
    return true;
  };
  const isCapital = (p: (typeof places)[number]) => Object.values(D.capitals).some(([name, adm0]) => p.name === name && p.adm0_a3 === adm0);
  for (const [realm, [name, adm0]] of Object.entries(D.capitals)) {
    const p = places.find((x) => x.name === name && x.adm0_a3 === adm0);
    if (!p) throw new Error(`${D.id}: capital "${name}" (${adm0}) of ${realm} is not among Natural Earth's places in the frame`);
    addCity(p, realm);
  }
  for (const p of places) {
    if (fixed.length >= D.cities.max || p.pop_max < D.cities.minPop || takenNames.has(p.period) || isCapital(p)) continue;
    if (fixed.some((f) => Math.hypot(f.x - p.at[0], f.y - p.at[1]) < D.cities.spacingKm / KM)) continue;
    addCity(p);
  }
  for (const pass of D.passes) {
    const at = proj(pass.lon, pass.lat);
    const c = landCellNear(at[0], at[1]);
    if (c < 0) throw new Error(`${D.id}: pass ${pass.name} is not on land`);
    const reg = region[c]!;
    fixed.push({ id: slug(pass.name), name: pass.name, x: Math.round(cxOf(c)), y: Math.round(cyOf(c)), region: reg, owner: regionDef.get(reg)!.realm, terrain: 'mountains', resource: null, dev: 1, pop: 6, fort: 1, pass: true });
    takenNames.add(pass.name);
  }

  // regions: anchors on every cell of the landmasses divided among regions, sized by area
  const regionCells = new Map<string, number[]>();
  for (let c = 0; c < CELLS; c++) if (raster[c] >= 0 && (raster[c] === 0 || islands[raster[c] - 1].regional)) (regionCells.get(region[c]!) ?? regionCells.set(region[c]!, []).get(region[c]!)!).push(c);
  const townPop = new Map<string, number>();
  for (const p of places) {
    const c = landCellNear(p.at[0], p.at[1]);
    if (c >= 0) townPop.set(region[c]!, (townPop.get(region[c]!) ?? 0) + p.pop_max);
  }
  const regions: RegionSpec[] = [];
  const regionDefs: RegionDef[] = [];
  const wholeIslands = islands.filter((i) => !i.regional);
  // fixed provinces on a whole island are among its provinces: the generator adds `count` more
  for (const isl of wholeIslands) {
    const k = islands.indexOf(isl) + 1;
    const here = fixed.filter((f) => !f.pass && raster[landCellNear(f.x, f.y)] === k).length;
    isl.count = Math.max(isl.count - here, 0);
  }
  for (const r of allRegions) {
    const cells = regionCells.get(r.id) ?? [];
    const isl = wholeIslands.filter((i) => i.region === r.id);
    if (!cells.length && !isl.length) continue;
    const islandCells = isl.reduce((s, i) => s + i.cells.length, 0);
    const fixedHere = fixed.filter((f) => f.region === r.id);
    const onIsland = (f: FixedProv) => {
      const v = raster[landCellNear(f.x, f.y)];
      return v > 0 && !islands[v - 1].regional;
    };
    const fixedMain = fixedHere.filter((f) => !onIsland(f) && !f.pass).length;
    const passes = fixedHere.filter((f) => f.pass).length;
    const target = cells.length ? Math.max(1, Math.round((cells.length * CELL_KM2) / (D.provKm2 * (r.sparse ?? 1)))) : 0;
    const count = Math.max(target, fixedMain + (cells.length && fixedMain === 0 ? 1 : 0)) + passes + isl.reduce((s, i) => s + i.count, 0) + fixedHere.filter(onIsland).length;
    const density = (townPop.get(r.id) ?? 0) / ((cells.length + islandCells) * CELL_KM2);
    const wealth = Math.max(1.3, Math.min(4.2, 2.4 + 0.9 * Math.log10(Math.max(1, density) / 25)));
    regions.push({ id: r.id, culture: r.realm, anchors: cells.map((c) => ({ x: cxOf(c), y: cyOf(c), owner: r.realm })), count, biome: r.biome, wealth, integ: r.integ });
    regionDefs.push({ id: r.id, name: r.name });
  }
  const keptIslands = islands.map(({ cells: _c, label: _l, ...i }) => i);

  // names: the largest unused town near a province, in its region; else a part of the region
  const known = new Set(places.map((p) => p.period));
  void known;
  const townNames = places.filter((p) => !takenNames.has(p.period));
  const dirs = ['North', 'South', 'East', 'West', 'Upper', 'Lower', 'Inner', 'Outer'];
  const placeName: WorldSpec['placeName'] = (p, used) => {
    // province ids come from names: two towns spelled apart (Beja, Béja) must not share one
    const usedIds = new Set([...used].map(slug));
    let best: (typeof townNames)[number] | null = null;
    let bd = Infinity;
    for (const t of townNames) {
      if (used.has(t.period) || usedIds.has(slug(t.period))) continue;
      const d = Math.hypot(t.at[0] - p.x, t.at[1] - p.y);
      if (d > 140 / KM || d >= bd) continue;
      const c = landCellNear(t.at[0], t.at[1]);
      if (c < 0 || region[c] !== p.region) continue;
      (bd = d), (best = t);
    }
    if (best) return best.period;
    const reg = regionDef.get(p.region)!.name;
    const cells = regionCells.get(p.region) ?? [];
    let mx = 0;
    let my = 0;
    for (const c of cells) (mx += cxOf(c)), (my += cyOf(c));
    mx /= Math.max(1, cells.length);
    my /= Math.max(1, cells.length);
    const dx = p.x - mx;
    const dy = p.y - my;
    const prefer = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? [0, 4, 6, 2, 3] : [1, 5, 7, 2, 3]) : dx > 0 ? [2, 6, 0, 1] : [3, 7, 0, 1];
    for (const k of [...prefer, ...dirs.keys()]) {
      const n = `${dirs[k]} ${reg}`;
      if (!used.has(n) && !usedIds.has(slug(n))) return n;
    }
    return null;
  };

  const labels: MapLabelDef[] = [
    ...D.seas.map(([name, lon, lat, size]) => {
      const [x, y] = proj(lon, lat);
      return { kind: 'sea' as const, name, x: Math.round(x), y: Math.round(y), size: size ?? 30 };
    }),
    ...lakes.filter((l) => l.poly!.length && l.rx > 40).map((l) => ({ kind: 'lake' as const, name: l.name, x: Math.round(l.cx), y: Math.round(l.cy), size: l.rx > 120 ? 20 : 15 })),
    ...ranges.map((r) => {
      const m = r.pts[Math.floor(r.pts.length / 2)];
      return { kind: 'range' as const, name: r.name, x: Math.round(m[0]), y: Math.round(m[1]), size: 18 };
    }),
  ];

  // land beyond the frame: drawn muted, never sea
  const nearMask = new Int32Array(CELLS).fill(1 << 29);
  {
    const q: number[] = [];
    for (let c = 0; c < CELLS; c++) if (raster[c] >= 0) (nearMask[c] = 0), q.push(c);
    for (let k = 0; k < q.length; k++) for (const n of nbrs4(q[k])) if (nearMask[n] > nearMask[q[k]] + 1) (nearMask[n] = nearMask[q[k]] + 1), q.push(n);
  }
  const offmap: Pt[] = [];
  for (let c = 0; c < CELLS; c++) {
    if (raster[c] !== -1 || !land[c]) continue;
    const [lon, lat] = lonlat[c];
    const edge = c % G.nx < 3 || Math.floor(c / G.nx) < 3 || c % G.nx >= G.nx - 3 || Math.floor(c / G.nx) >= G.ny - 3;
    if (D.inCrop(lon, lat) && !edge && !leftOut[c]) continue;
    const i = c % G.nx;
    const j = Math.floor(c / G.nx);
    if (nearMask[c] <= 8 || (i % 3 === 0 && j % 3 === 0)) offmap.push([cxOf(c), cyOf(c)]);
  }

  const spec: WorldSpec = {
    id: D.id,
    scale: 1,
    bounds: BOUNDS,
    mainland: outline(G, (c) => raster[c] === 0, 2),
    islands: keptIslands,
    lakes,
    ranges,
    rivers: [...longest.values()],
    fixed,
    regions,
    regionDefs,
    nations: D.nations,
    labels,
    names: Object.fromEntries(D.nations.map((n) => [n.id, []])),
    placeName,
    coastSeeds: true,
    offmap,
    cells: raster,
    straitLinks: D.straits.map((s) => ({ name: s.name, a: proj(...s.a), b: proj(...s.b) })),
    straitMax: D.straitMaxKm / KM,
  };
  const world = generateWorld(spec, log);

  // a strait that turned out to be a land border too (a channel narrower than the raster) is only a border
  const riverPairs = new Set(world.rivers.map(([a, b]) => [a, b].sort().join('|')));
  world.straits = world.straits.filter(([a, b]) => !riverPairs.has([a, b].sort().join('|')));
  const pkg: MapPackage = {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: D.id,
    revision: D.revision,
    meta: D.meta,
    rules: { startYear: D.startYear, campaignYears: D.campaignYears },
    regions: regionDefs.filter((r) => world.provinces.some((p) => p.region === r.id)),
    nations: D.nations,
    provinces: world.provinces,
    straits: world.straits,
    rivers: world.rivers,
    seaZones: [],
    geometry: { bounds: world.geometry.bounds, centers: world.geometry.provinces, edges: world.geometry.edges, waste: world.geometry.waste, labels: world.geometry.labels },
  };
  pkg.geometry.edges = pkg.geometry.edges.filter((e) => e.pts.some((v, i) => v !== e.pts[i % 2]));
  const hints = D.depositHints.map((h) => ({ ...h, at: proj(h.lon, h.lat), r: h.km / KM }));
  placeDeposits(pkg, {
    key: D.id,
    climate: D.climate,
    bias: (p, kind: ResourceKind) => {
      const c = pkg.geometry.centers[p.id];
      let w = 1;
      for (const h of hints) if (h.kind === kind && Math.hypot(c.cx - h.at[0], c.cy - h.at[1]) < h.r) w = Math.max(w, h.weight);
      return w;
    },
  });
  addSeaZones(pkg);
  if (D.wrapOcean) wrapZones(pkg);
  pkg.meta = { ...D.meta, size: sizeFor(pkg.provinces.length) };
  pkg.rules = rulesFor(D, pkg);
  const check = validateMapPackage(pkg);
  if (!check.ok) throw new Error(`${D.id}: the map does not validate: ${check.errors.slice(0, 6).map((e) => e.message).join(' ')}`);
  const report = worldReport(D.meta.name, `npm run genreal -- --map ${D.id}`, spec, world) + extraReport(pkg, check.warnings.map((w) => w.message));
  return { pkg, report, world };
}

/**
 * A world map's ocean continues past its left and right edges: sea zones that
 * reach both edges at overlapping latitudes are linked as neighbours.
 */
function wrapZones(pkg: MapPackage): void {
  const seas = pkg.geometry.seas;
  if (!seas) return;
  const { w, h } = seas.grid;
  const decoded = decodeGrid(seas.grid.rle, w * h, pkg.seaZones.length);
  if (!decoded) return;
  const left = new Map<number, Set<number>>();
  const right = new Map<number, Set<number>>();
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < 3; i++) {
      const v = decoded[j * w + i];
      if (v > 0) (left.get(v) ?? left.set(v, new Set()).get(v)!).add(j);
    }
    for (let i = w - 3; i < w; i++) {
      const v = decoded[j * w + i];
      if (v > 0) (right.get(v) ?? right.set(v, new Set()).get(v)!).add(j);
    }
  }
  for (const [a, rowsA] of left)
    for (const [b, rowsB] of right) {
      if (a === b) continue;
      if (![...rowsA].some((j) => rowsB.has(j) || rowsB.has(j - 1) || rowsB.has(j + 1))) continue;
      // the grid holds a zone's number, and zones are named sea-<number>
      const za = pkg.seaZones.find((z) => z.id === `sea-${a}`);
      const zb = pkg.seaZones.find((z) => z.id === `sea-${b}`);
      if (!za || !zb) continue;
      if (!za.neighbors.includes(zb.id)) za.neighbors.push(zb.id);
      if (!zb.neighbors.includes(za.id)) zb.neighbors.push(za.id);
    }
}

/** Victory thresholds above the largest starting share, so no realm starts within reach of a win it has not earned. */
function rulesFor(D: RealMapDef, pkg: MapPackage): MapPackage['rules'] {
  const n = pkg.provinces.length;
  const byOwner = new Map<string, { prov: number; dev: number; regions: Set<string> }>();
  let devAll = 0;
  for (const p of pkg.provinces) {
    devAll += p.dev;
    if (!p.owner) continue;
    const o = byOwner.get(p.owner) ?? byOwner.set(p.owner, { prov: 0, dev: 0, regions: new Set() }).get(p.owner)!;
    o.prov++;
    o.dev += p.dev;
  }
  const regionOwner = new Map<string, Map<string, number>>();
  for (const p of pkg.provinces) if (p.owner) regionOwner.set(p.region, (regionOwner.get(p.region) ?? new Map()).set(p.owner, (regionOwner.get(p.region)?.get(p.owner) ?? 0) + 1));
  for (const [rid, owners] of regionOwner) {
    const total = pkg.provinces.filter((p) => p.region === rid).length;
    for (const [o, k] of owners) if (k / total >= 0.75) byOwner.get(o)!.regions.add(rid);
  }
  const top = [...byOwner.values()];
  const maxProv = Math.max(...top.map((t) => t.prov)) / n;
  const maxDev = Math.max(...top.map((t) => t.dev)) / devAll;
  const maxRegions = Math.max(...top.map((t) => t.regions.size));
  const v = scaledVictory(pkg.regions.length, pkg.nations.length);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    startYear: D.startYear,
    campaignYears: D.campaignYears,
    victory: {
      territorialRegions: Math.max(v.territorialRegions!, maxRegions + 6),
      territorialShare: round2(Math.max(v.territorialShare!, maxProv + 0.12)),
      economicShare: round2(Math.max(v.economicShare!, maxDev + 0.1)),
      diplomaticInfluencePerRealm: v.diplomaticInfluencePerRealm,
      ...D.victory,
    },
    researchCostMul: researchCostFor(n, pkg.nations.length),
  };
}

function extraReport(pkg: MapPackage, warnings: string[]): string {
  const lines = ['', '## Realms at the start', '', '| Realm | Provinces | Development | Capital |', '|---|---|---|---|'];
  for (const nat of pkg.nations) {
    const mine = pkg.provinces.filter((p) => p.owner === nat.id);
    lines.push(`| ${nat.name} | ${mine.length} | ${mine.reduce((s, p) => s + p.dev, 0)} | ${pkg.provinces.find((p) => p.id === nat.capital)?.name} |`);
  }
  const dep = new Map<string, number>();
  for (const p of pkg.provinces) dep.set(String(p.resource), (dep.get(String(p.resource)) ?? 0) + 1);
  lines.push(
    '',
    `- Sea zones: ${pkg.seaZones.length}; ports: ${pkg.provinces.filter((p) => p.port).length}`,
    `- Deposits: ${[...dep].map(([k, n]) => `${k} ${n}`).join(', ')}`,
    `- Victory: ${JSON.stringify(pkg.rules.victory)}; research cost ×${pkg.rules.researchCostMul}`,
    `- Natural Earth ${NE_VERSION}: ${Object.values(LAYERS).map((l) => `${l.file} (sha256 ${l.sha256.slice(0, 12)}…)`).join(', ')}`,
    `- Validator warnings: ${warnings.length ? warnings.join(' / ') : 'none'}`,
    '',
    '### Province names',
    '',
    pkg.provinces.map((p) => `${p.name} (${p.owner ?? '–'})`).join(', '),
    '',
  );
  return lines.join('\n');
}

/** Writes a built map as checked-in data, its preview and its report. */
export function writeRealMap(r: RealMapResult): void {
  const { pkg, report, world } = r;
  const { geometry, ...scenario } = pkg;
  mkdirSync(new URL('../src/data/maps/', import.meta.url), { recursive: true });
  mkdirSync(new URL('../reports/maps/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`../src/data/maps/${pkg.id}.scenario.json`, import.meta.url), JSON.stringify({ generated: `tools/genreal.ts (${pkg.id}) from Natural Earth — do not edit by hand`, ...scenario }));
  writeFileSync(new URL(`../src/data/maps/${pkg.id}.map.json`, import.meta.url), JSON.stringify(geometry));
  const own = new Map(pkg.provinces.map((p) => [p.id, p.owner]));
  const col = new Map(pkg.nations.map((n) => [n.id, n.color]));
  const nm = new Map(pkg.provinces.map((p) => [p.id, p.name]));
  writeFileSync(
    new URL(`../reports/maps/${pkg.id}-preview.svg`, import.meta.url),
    previewSvg(world.geometry.bounds, { ...world.geometry, provinces: world.polys } as unknown as Parameters<typeof previewSvg>[1], pkg.straits, (id) => own.get(id) ?? null, (n) => col.get(n)!, (id) => nm.get(id)!, 1),
  );
  writeFileSync(new URL(`../reports/maps/${pkg.id}-map.md`, import.meta.url), report);
}

const piecesOf = new Map<string, number[][]>();
