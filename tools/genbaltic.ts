// "The Baltic, 1906": a real-world regional map built from Natural Earth by
// this reproducible script.
//   npm run genbaltic
//
// Natural Earth (naturalearthdata.com) is in the public domain. The script
// downloads five GeoJSON layers of Natural Earth 5.1.2 into .cache/naturalearth/
// (not committed) if they are missing, checks them against the SHA-256 sums
// below, and builds the map through the shared world generator, like every
// other map:
//   coastline and islands        ne_50m_land
//   lakes                        ne_50m_lakes
//   rivers                       ne_10m_rivers_lake_centerlines
//   realms and regions           ne_10m_admin_1_states_provinces
//   towns (cities and names)     ne_10m_populated_places_simple
// Everything Natural Earth cannot give (the realms of 1906, which division
// belonged to which, historical names, the Scandes ridges) is authored in
// tools/baltic.data.ts.
//
// Steps: project (Lambert conformal conic); rasterise land, lakes and
// divisions on the generator's grid; trace the coast and lakes; classify every
// land cell into a 1906 region; choose cities as fixed provinces; size regions
// by area (larger provinces in the thinly settled north); generate; name the
// remaining provinces after the towns in them; place deposits; add sea zones;
// set victory thresholds from the starting shares; validate.
// Outputs: src/data/maps/baltic.scenario.json, baltic.map.json,
//          reports/maps/baltic-map.md, baltic-preview.svg.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { MAP_FORMAT, MAP_FORMAT_VERSION, sizeFor, type MapLabelDef, type MapMeta, type MapPackage } from '../src/maps/format';
import { previewSvg, type Pt } from '../src/maps/gen/core';
import { slug } from '../src/maps/gen/names';
import { components, outline, placeDeposits, type Grid } from '../src/maps/gen/procedural';
import { generateWorld, worldReport, type FixedProv, type IslandSpec, type LakeSpec, type RangeSpec, type RegionSpec, type RiverSpec, type WorldSpec } from '../src/maps/gen/world';
import { researchCostFor, scaledVictory } from '../src/maps/rules';
import { loopsFromEdges } from '../src/maps/rings';
import { addSeaZones, validateMapPackage } from '../src/maps/validate';
import type { RegionDef, ResourceKind } from '../src/sim/types';
import * as D from './baltic.data';

const NE_VERSION = 'v5.1.2';
const CACHE = '.cache/naturalearth';
const LAYERS = {
  land: { file: 'ne_50m_land', sha256: 'e874b27a51d146452be360cafb3cc50c86001074a67d534113e6534682f9826b' },
  lakes: { file: 'ne_50m_lakes', sha256: 'd350b75978b26fe839b797c2c529b2fb8f47fb3983c03f4964e36d5df9378a52' },
  rivers: { file: 'ne_10m_rivers_lake_centerlines', sha256: 'bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a' },
  admin: { file: 'ne_10m_admin_1_states_provinces', sha256: '22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5' },
  places: { file: 'ne_10m_populated_places_simple', sha256: 'fd3fa867a320cbd5c5b6bb5bc550afeec2939fb2cef688e508007282a55ac42f' },
} as const;

/**
 * The campaign's frame (degrees): the Baltic and its shores, down to Berlin
 * and Posen in the west and to Vilna in the east; the Low Countries, central
 * Poland and southern Belarus stay beyond it.
 */
const CROP = { west: 4.6, east: 31.8, south: 52.25, north: 66.6 };
const southEdge = (lon: number) => (lon <= 19.5 ? 52.25 : lon <= 23.0 ? 53.1 : 54.0);
const inCrop = (lon: number, lat: number) => lon >= CROP.west && lon <= CROP.east && lat >= southEdge(lon) && lat <= CROP.north && !(lon < 7.25 && lat < 55);

/** Kilometres per design unit: provinces come out at Aldmere's scale (about 26,000 square units). */
const KM = 0.5;
/** Raster step in design units (the generator's default). */
const STEP = 14;
/** Province area in km² before the thinly-settled-north factor. */
const PROV_KM2 = 5600;
const MIN_ISLAND_KM2 = 420;
const MIN_LAKE_KM2 = 330;

// ───────────────────────────── data ────────────────────────────────────────

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };

function layer(key: keyof typeof LAYERS): Feature[] {
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
  return (JSON.parse(buf.toString('utf8')) as { features: Feature[] }).features;
}

/** Outer rings and holes of a (Multi)Polygon, as [lon, lat] lists. */
function polygons(g: Feature['geometry']): number[][][][] {
  if (g.type === 'Polygon') return [g.coordinates as number[][][]];
  if (g.type === 'MultiPolygon') return g.coordinates as number[][][][];
  return [];
}
function lines(g: Feature['geometry']): number[][][] {
  if (g.type === 'LineString') return [g.coordinates as number[][]];
  if (g.type === 'MultiLineString') return g.coordinates as number[][][];
  return [];
}

// ───────────────────────────── projection ──────────────────────────────────

// Lambert conformal conic, standard parallels 55° and 63°, centred on 18° E, 58.5° N.
const R = 6371;
const rad = Math.PI / 180;
const P1 = 55 * rad;
const P2 = 63 * rad;
const P0 = 58.5 * rad;
const L0 = 18 * rad;
const N = Math.log(Math.cos(P1) / Math.cos(P2)) / Math.log(Math.tan(Math.PI / 4 + P2 / 2) / Math.tan(Math.PI / 4 + P1 / 2));
const F = (Math.cos(P1) * Math.tan(Math.PI / 4 + P1 / 2) ** N) / N;
const rho = (phi: number) => (R * F) / Math.tan(Math.PI / 4 + phi / 2) ** N;
const RHO0 = rho(P0);
function lccKm(lon: number, lat: number): [number, number] {
  const r = rho(lat * rad);
  const t = N * (lon * rad - L0);
  return [r * Math.sin(t), RHO0 - r * Math.cos(t)];
}
function lccInv(x: number, y: number): [number, number] {
  const r = Math.sign(N) * Math.hypot(x, RHO0 - y);
  const t = Math.atan2(x, RHO0 - y);
  return [(L0 + t / N) / rad, (2 * Math.atan(((R * F) / r) ** (1 / N)) - Math.PI / 2) / rad];
}

// frame: the crop's outline, projected, with a margin of open sea
const frame: Array<[number, number]> = [];
for (let lon = CROP.west; lon <= CROP.east; lon += 0.25) frame.push(lccKm(lon, CROP.south), lccKm(lon, CROP.north));
for (let lat = CROP.south; lat <= CROP.north; lat += 0.25) frame.push(lccKm(CROP.west, lat), lccKm(CROP.east, lat));
const MARGIN = 6 * STEP;
const kx0 = Math.min(...frame.map((p) => p[0]));
const ky1 = Math.max(...frame.map((p) => p[1]));
const toDu = ([x, y]: [number, number]): Pt => [(x - kx0) / KM + MARGIN, (ky1 - y) / KM + MARGIN];
const fromDu = (x: number, y: number): [number, number] => lccInv((x - MARGIN) * KM + kx0, ky1 - (y - MARGIN) * KM);
const proj = (lon: number, lat: number): Pt => toDu(lccKm(lon, lat));
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
const CELL_KM2 = (STEP * KM) ** 2;

/** Fills the cells whose centres lie inside a polygon (even-odd over its rings), by scanlines. */
function fillPoly(rings: number[][][], set: (c: number) => void): void {
  const pr = rings.map((r) => r.map(([lon, lat]) => proj(lon, lat)));
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const r of pr) for (const [, y] of r) (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  const j0 = Math.max(0, Math.floor(y0 / STEP));
  const j1 = Math.min(G.ny - 1, Math.ceil(y1 / STEP));
  for (let j = j0; j <= j1; j++) {
    const y = (j + 0.5) * STEP;
    const xs: number[] = [];
    for (const r of pr)
      for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
        const [xa, ya] = r[a];
        const [xb, yb] = r[b];
        if (ya > y !== yb > y) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil(xs[k] / STEP - 0.5));
      const i1 = Math.min(G.nx - 1, Math.floor(xs[k + 1] / STEP - 0.5));
      for (let i = i0; i <= i1; i++) set(j * G.nx + i);
    }
  }
}

const bboxHits = (rings: number[][][]) => rings[0].some(([lon, lat]) => lon > CROP.west - 3 && lon < CROP.east + 3 && lat > CROP.south - 3 && lat < CROP.north + 3);

// ───────────────────────────── build ───────────────────────────────────────

export function balticPackage(log: (l: string) => void = () => {}): { pkg: MapPackage; report: string; spec: WorldSpec; world: ReturnType<typeof generateWorld> } {
  const lonlat = Array.from({ length: CELLS }, (_, c) => fromDu(cxOf(c), cyOf(c)));
  const crop = Uint8Array.from(lonlat, ([lon, lat]) => (inCrop(lon, lat) ? 1 : 0));

  // land, lakes, divisions
  const land = new Uint8Array(CELLS);
  for (const f of layer('land')) for (const poly of polygons(f.geometry)) if (bboxHits(poly)) fillPoly(poly, (c) => (land[c] = 1));
  const lakeAt = new Int16Array(CELLS).fill(-1);
  const lakeFeatures = layer('lakes').filter((f) => typeof f.properties.name === 'string' && D.LAKES[f.properties.name as string]);
  lakeFeatures.forEach((f, k) => {
    for (const poly of polygons(f.geometry)) if (bboxHits(poly)) fillPoly(poly, (c) => (lakeAt[c] = k));
  });
  const adminFeatures = layer('admin').filter((f) => polygons(f.geometry).some(bboxHits));
  const adminAt = new Int16Array(CELLS).fill(-1);
  adminFeatures.forEach((f, k) => {
    for (const poly of polygons(f.geometry)) fillPoly(poly, (c) => (adminAt[c] = k));
  });

  // the land of the campaign: inside the frame, of a known division, with a strip of sea round the frame
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
    for (let k = 0; k < q.length; k++) {
      const c = q[k];
      const i = c % G.nx;
      for (const n of [c - 1, c + 1, c - G.nx, c + G.nx]) {
        if (n < 0 || n >= CELLS || (n === c - 1 && i === 0) || (n === c + 1 && i === G.nx - 1)) continue;
        if (mask[n] && admin[n] < 0) (admin[n] = admin[c]), q.push(n);
      }
    }
  }
  // Low Countries and anything unclassified leave the map
  const comp0 = components(G, mask);
  const mainComp = comp0.sizes.indexOf(Math.max(...comp0.sizes));
  const region = new Array<string | null>(CELLS).fill(null);
  const unknown = new Map<string, number>();
  for (let c = 0; c < CELLS; c++) {
    if (!mask[c]) continue;
    const a = adminFeatures[admin[c]]?.properties;
    const r = a ? D.regionOf(String(a.adm0_a3), String(a.name), lonlat[c][0], lonlat[c][1], comp0.label[c] === mainComp) : null;
    if (r === undefined || (a && r === null && !['NLD', 'BEL'].includes(String(a.adm0_a3)))) unknown.set(`${a?.adm0_a3}/${a?.name}`, (unknown.get(`${a?.adm0_a3}/${a?.name}`) ?? 0) + 1);
    if (r) region[c] = r;
    else mask[c] = 0;
  }
  if (unknown.size) throw new Error(`divisions without a 1906 region: ${[...unknown].map(([k, n]) => `${k} (${n} cells)`).join(', ')}`);

  // components: the mainland and the islands worth a province
  const comp = components(G, mask);
  const main = comp.sizes.indexOf(Math.max(...comp.sizes));
  const regionDef = new Map(D.REGIONS.map((r) => [r.id, r]));
  const islandName = (cells: number[]): string => {
    let x = 0;
    let y = 0;
    for (const c of cells) (x += cxOf(c)), (y += cyOf(c));
    x /= cells.length;
    y /= cells.length;
    let best: string | null = null;
    let bd = Infinity;
    for (const [name, lon, lat] of D.ISLANDS) {
      const p = proj(lon, lat);
      const inside = cells.includes(cellAt(p[0], p[1]));
      const d = inside ? -1 : Math.hypot(p[0] - x, p[1] - y);
      if (d < bd) (bd = d), (best = name);
    }
    return bd < 60 / KM && best ? best : '';
  };
  const islands: Array<IslandSpec & { cells: number[] }> = [];
  const islandOf = new Int32Array(CELLS).fill(-1);
  const cellsOf = new Map<number, number[]>();
  for (let c = 0; c < CELLS; c++) if (comp.label[c] >= 0) (cellsOf.get(comp.label[c]) ?? cellsOf.set(comp.label[c], []).get(comp.label[c])!).push(c);
  const usedIslandNames = new Set<string>();
  for (const [k, cells] of [...cellsOf].sort((a, b) => b[1].length - a[1].length)) {
    if (k === main) continue;
    if (cells.length * CELL_KM2 < MIN_ISLAND_KM2) {
      for (const c of cells) mask[c] = 0;
      continue;
    }
    const votes = new Map<string, number>();
    for (const c of cells) votes.set(region[c]!, (votes.get(region[c]!) ?? 0) + 1);
    const reg = [...votes].sort((a, b) => b[1] - a[1])[0][0];
    let name = islandName(cells);
    if (!name || usedIslandNames.has(name)) name = `${regionDef.get(reg)!.name} Isle${usedIslandNames.has(`${regionDef.get(reg)!.name} Isle`) ? ` ${islands.length}` : ''}`;
    usedIslandNames.add(name);
    const lat = cells.reduce((s, c) => s + lonlat[c][1], 0) / cells.length;
    const count = Math.max(1, Math.round((cells.length * CELL_KM2) / (PROV_KM2 * northFactor(lat))));
    for (const c of cells) (islandOf[c] = islands.length), (region[c] = reg);
    islands.push({ name, poly: outline(G, (c) => comp.label[c] === k, 2), region: reg, owner: regionDef.get(reg)!.realm, count, cells });
  }
  const mainland = outline(G, (c) => comp.label[c] === main, 2);
  if (process.env.DEBUG_BALTIC) {
    const hue = new Map(D.REGIONS.map((r, i) => [r.id, (i * 47) % 360]));
    writeFileSync('.scratch/baltic-raster.json', JSON.stringify({ nx: G.nx, ny: G.ny, cells: Array.from({ length: CELLS }, (_, c) => (!mask[c] ? (land[c] ? -2 : -1) : lakeAt[c] >= 0 ? -3 : comp.label[c] === main ? hue.get(region[c]!)! : 400 + (hue.get(region[c]!) ?? 0))) }));
  }
  log(`mainland ${comp.sizes[main]} cells (${Math.round(comp.sizes[main] * CELL_KM2 / 1000)}k km²), ${islands.length} islands: ${islands.map((i) => `${i.name} ${i.count}`).join(', ')}`);

  // lakes: inside the land, large enough to show
  const lakeMask = Uint8Array.from(lakeAt, (v, c) => (v >= 0 && mask[c] && islandOf[c] < 0 ? 1 : 0));
  const lakeComp = components(G, lakeMask);
  const lakes: LakeSpec[] = [];
  lakeComp.sizes.forEach((n, k) => {
    if (n * CELL_KM2 < MIN_LAKE_KM2) return;
    const cells: number[] = [];
    for (let c = 0; c < CELLS; c++) if (lakeComp.label[c] === k) cells.push(c);
    // a lake drawn as threads of single cells (Saimaa's maze) would only cut provinces apart
    const inner = cells.filter((c) => [c - 1, c + 1, c - G.nx, c + G.nx].every((x) => lakeComp.label[x] === k)).length;
    if (inner / cells.length < 0.2) return;
    const votes = new Map<number, number>();
    for (const c of cells) votes.set(lakeAt[c], (votes.get(lakeAt[c]) ?? 0) + 1);
    const f = lakeFeatures[[...votes].sort((a, b) => b[1] - a[1])[0][0]];
    const poly = outline(G, (c) => lakeComp.label[c] === k, 2);
    const xs = poly.map((p) => p[0]);
    const ys = poly.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const r = Math.max(Math.max(...xs) - cx, Math.max(...ys) - cy);
    lakes.push({ name: D.LAKES[f.properties.name as string], cx, cy, rx: r, ry: r, rot: 0, poly });
  });

  // rivers that reach the sea, from source to mouth
  const seaDist = new Int32Array(CELLS).fill(1 << 29);
  {
    const q: number[] = [];
    // real sea only: land cut off by the frame is not a river mouth
    for (let c = 0; c < CELLS; c++) if (!land[c]) (seaDist[c] = 0), q.push(c);
    for (let k = 0; k < q.length; k++) {
      const c = q[k];
      const i = c % G.nx;
      for (const n of [c - 1, c + 1, c - G.nx, c + G.nx]) {
        if (n < 0 || n >= CELLS || (n === c - 1 && i === 0) || (n === c + 1 && i === G.nx - 1)) continue;
        if (seaDist[n] > seaDist[c] + 1) (seaDist[n] = seaDist[c] + 1), q.push(n);
      }
    }
  }
  const rivers: RiverSpec[] = [];
  for (const f of layer('rivers')) {
    const name = D.RIVERS[String(f.properties.name)];
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
          const mouth = Math.min(a, b);
          if (len >= 110 && mouth <= 3) {
            const thin: Pt[] = [pts[0]];
            for (const p of pts.slice(1)) if (Math.hypot(p[0] - thin[thin.length - 1][0], p[1] - thin[thin.length - 1][1]) >= 18) thin.push(p);
            if (thin.length >= 3) rivers.push({ name, pts: thin.map(([x, y]) => [Math.round(x), Math.round(y)]) });
          }
        }
        run = [];
      };
      for (const [lon, lat] of ln) {
        const p = proj(lon, lat);
        const c = cellAt(p[0], p[1]);
        if (mask[c] && islandOf[c] < 0 && lakeMask[c] === 0) run.push(p);
        else flush();
      }
      flush();
    }
  }
  // one river per name: the longest run
  const longest = new Map<string, RiverSpec>();
  for (const r of rivers) if (!longest.has(r.name) || r.pts.length > longest.get(r.name)!.pts.length) longest.set(r.name, r);

  // the Scandes ridges and their passes
  const ranges: RangeSpec[] = D.RIDGES.map((r) => ({ name: r.name, half: r.half, pts: r.pts.map(([lon, lat]) => proj(lon, lat)) }));

  // cities: the realm capitals and the largest towns, spaced apart
  const places = layer('places')
    .map((f) => f.properties as { name: string; latitude: number; longitude: number; pop_max: number; adm0_a3: string })
    .filter((p) => inCrop(p.longitude, p.latitude))
    .map((p) => ({ ...p, at: proj(p.longitude, p.latitude), name1906: D.NAMES_1906[p.name] ?? p.name }))
    .filter((p) => {
      const c = cellAt(p.at[0], p.at[1]);
      return mask[c] || nearLand(c);
    })
    .sort((a, b) => b.pop_max - a.pop_max || a.name.localeCompare(b.name));
  function nearLand(c: number): boolean {
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (mask[c + dj * G.nx + di]) return true;
    return false;
  }
  const landCellNear = (x: number, y: number): number => {
    const c0 = cellAt(x, y);
    if (mask[c0]) return c0;
    let best = -1;
    let bd = Infinity;
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const c = c0 + dj * G.nx + di;
        if (c < 0 || c >= CELLS || !mask[c]) continue;
        const d = Math.hypot(cxOf(c) - x, cyOf(c) - y);
        if (d < bd) (bd = d), (best = c);
      }
    return best;
  };
  const capitalPlace = new Map(Object.entries(D.CAPITALS).map(([realm, name]) => [name, realm as D.Realm]));
  const fixed: FixedProv[] = [];
  const takenNames = new Set<string>();
  const addCity = (p: (typeof places)[number], capitalOf?: D.Realm) => {
    const c = landCellNear(p.at[0], p.at[1]);
    if (c < 0) return;
    const reg = region[c]!;
    const realm = regionDef.get(reg)!.realm;
    if (capitalOf && realm !== capitalOf) throw new Error(`${p.name} lies in ${reg} (${realm}), not ${capitalOf}`);
    const big = p.pop_max;
    const dev = capitalOf ? (big > 2e6 ? 7 : 6) : Math.max(3, Math.min(6, Math.round(2.6 + 1.3 * Math.log10(big / 50000))));
    fixed.push({
      id: capitalOf ? D.NATIONS.find((n) => n.id === capitalOf)!.capital : slug(p.name1906),
      name: p.name1906,
      x: Math.round(cxOf(c)),
      y: Math.round(cyOf(c)),
      region: reg,
      owner: realm,
      terrain: realm === 'nor' ? 'hills' : 'plains',
      resource: null,
      dev,
      pop: Math.max(30, Math.min(90, Math.round(30 + 20 * Math.log10(big / 30000)))),
      infra: capitalOf ? 2 : 1,
      fort: capitalOf ? 2 : big > 300000 ? 1 : 0,
    });
    takenNames.add(p.name1906);
  };
  for (const p of places) if (capitalPlace.has(p.name)) addCity(p, capitalPlace.get(p.name));
  for (const p of places) {
    if (fixed.length >= 42 || p.pop_max < 60000 || capitalPlace.has(p.name) || takenNames.has(p.name1906)) continue;
    if (fixed.some((f) => Math.hypot(f.x - p.at[0], f.y - p.at[1]) < 75 / KM)) continue;
    addCity(p);
  }
  for (const pass of D.PASSES) {
    const at = proj(pass.lon, pass.lat);
    const c = landCellNear(at[0], at[1]);
    const reg = region[c]!;
    fixed.push({ id: slug(pass.name), name: pass.name, x: Math.round(cxOf(c)), y: Math.round(cyOf(c)), region: reg, owner: regionDef.get(reg)!.realm, terrain: 'mountains', resource: null, dev: 1, pop: 6, fort: 1, pass: true });
    takenNames.add(pass.name);
  }

  // regions: anchors on every mainland cell, sized by area (larger provinces in the north)
  const mainCells = new Map<string, number[]>();
  for (let c = 0; c < CELLS; c++) if (mask[c] && comp.label[c] === main) (mainCells.get(region[c]!) ?? mainCells.set(region[c]!, []).get(region[c]!)!).push(c);
  // wealth from the towns of the region (present-day populations stand in for those of 1906)
  const townPop = new Map<string, number>();
  for (const p of places) {
    const c = landCellNear(p.at[0], p.at[1]);
    if (c >= 0) townPop.set(region[c]!, (townPop.get(region[c]!) ?? 0) + p.pop_max);
  }
  const regions: RegionSpec[] = [];
  const regionDefs: RegionDef[] = [];
  for (const r of D.REGIONS) {
    const cells = mainCells.get(r.id) ?? [];
    const isl = islands.filter((i) => i.region === r.id);
    const islandCells = isl.reduce((s, i) => s + i.cells.length, 0);
    if (!cells.length && !isl.length) continue;
    const all = [...cells, ...isl.flatMap((i) => i.cells)];
    const lat = all.reduce((s, c) => s + lonlat[c][1], 0) / all.length;
    const fixedHere = fixed.filter((f) => f.region === r.id);
    const fixedMain = fixedHere.filter((f) => islandOf[cellAt(f.x, f.y)] < 0).length;
    const target = cells.length ? Math.max(1, Math.round((cells.length * CELL_KM2) / (PROV_KM2 * northFactor(lat)))) : 0;
    const count = Math.max(target, fixedMain + (cells.length && fixedMain === 0 ? 1 : 0)) + isl.reduce((s, i) => s + i.count, 0) + (fixedHere.length - fixedMain);
    const density = (townPop.get(r.id) ?? 0) / ((cells.length + islandCells) * CELL_KM2);
    const wealth = Math.max(1.3, Math.min(4.2, 2.4 + 0.9 * Math.log10(Math.max(1, density) / 25)));
    regions.push({ id: r.id, culture: r.realm, anchors: cells.map((c) => ({ x: cxOf(c), y: cyOf(c), owner: r.realm })), count, biome: r.biome, wealth, integ: r.realm === 'rus' && !['stpetersburg', 'novgorod', 'pskov'].includes(r.id) ? [55, 85] : undefined });
    regionDefs.push({ id: r.id, name: r.name });
  }

  // names: provinces take the name of the largest unused town near them (Natural
  // Earth's towns first, then the district towns of 1906)
  const known = new Set(places.map((p) => p.name1906));
  const extra = D.TOWNS_1906.filter(([name, lon, lat]) => !known.has(name) && inCrop(lon, lat)).map(([name, lon, lat]) => ({ name, name1906: name, longitude: lon, latitude: lat, pop_max: 0, adm0_a3: '', at: proj(lon, lat) }));
  const townNames = [...places, ...extra].filter((p) => !takenNames.has(p.name1906));
  const fallbackDir = ['North', 'South', 'East', 'West', 'Upper', 'Lower', 'Inner', 'Outer'];
  const placeName: WorldSpec['placeName'] = (p, used) => {
    let best: (typeof townNames)[number] | null = null;
    let bd = Infinity;
    for (const t of townNames) {
      if (used.has(t.name1906)) continue;
      const d = Math.hypot(t.at[0] - p.x, t.at[1] - p.y);
      const c = landCellNear(t.at[0], t.at[1]);
      if (c < 0 || region[c] !== p.region) continue;
      if (d < bd) (bd = d), (best = t);
    }
    if (best && bd < 70 / KM) return best.name1906;
    // no town: a part of its region
    const reg = regionDef.get(p.region)!.name;
    const cells = mainCells.get(p.region) ?? [];
    let mx = 0;
    let my = 0;
    for (const c of cells) (mx += cxOf(c)), (my += cyOf(c));
    mx /= Math.max(1, cells.length);
    my /= Math.max(1, cells.length);
    const dx = p.x - mx;
    const dy = p.y - my;
    const order = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? [0, 4, 6, 2, 3] : [1, 5, 7, 2, 3]) : dx > 0 ? [2, 6, 0, 1] : [3, 7, 0, 1];
    for (const k of [...order, ...fallbackDir.keys()]) {
      const n = `${fallbackDir[k]} ${reg}`;
      if (!used.has(n)) return n;
    }
    return null;
  };

  // labels: seas, large lakes, the ridges
  const labels: MapLabelDef[] = [
    ...D.SEAS.map(([name, lon, lat]) => ({ kind: 'sea' as const, name, ...xy(proj(lon, lat)), size: 30 })),
    ...lakes.filter((l) => l.poly!.length && l.rx > 40).map((l) => ({ kind: 'lake' as const, name: l.name, x: Math.round(l.cx), y: Math.round(l.cy), size: l.rx > 120 ? 20 : 15 })),
    ...ranges.map((r) => {
      const m = r.pts[Math.floor(r.pts.length / 2)];
      return { kind: 'range' as const, name: r.name, x: Math.round(m[0]), y: Math.round(m[1]), size: 18 };
    }),
  ];

  // land beyond the frame: drawn muted, never sea (every cell near the frame, sparser further out)
  const nearMask = new Int32Array(CELLS).fill(1 << 29);
  {
    const q: number[] = [];
    for (let c = 0; c < CELLS; c++) if (mask[c]) (nearMask[c] = 0), q.push(c);
    for (let k = 0; k < q.length; k++) {
      const c = q[k];
      const i = c % G.nx;
      for (const n of [c - 1, c + 1, c - G.nx, c + G.nx]) {
        if (n < 0 || n >= CELLS || (n === c - 1 && i === 0) || (n === c + 1 && i === G.nx - 1)) continue;
        if (nearMask[n] > nearMask[c] + 1) (nearMask[n] = nearMask[c] + 1), q.push(n);
      }
    }
  }
  const offmap: Pt[] = [];
  for (let c = 0; c < CELLS; c++) {
    if (mask[c] || !land[c]) continue;
    const [lon, lat] = lonlat[c];
    // only land the frame cut off (dropped islets inside the frame are sea)
    if (inCrop(lon, lat) && !(c % G.nx < 3 || Math.floor(c / G.nx) < 3 || c % G.nx >= G.nx - 3 || Math.floor(c / G.nx) >= G.ny - 3)) continue;
    const i = c % G.nx;
    const j = Math.floor(c / G.nx);
    if (nearMask[c] <= 8 || (i % 3 === 0 && j % 3 === 0)) offmap.push([cxOf(c), cyOf(c)]);
  }

  const spec: WorldSpec = {
    id: 'baltic',
    scale: 1,
    bounds: BOUNDS,
    mainland,
    islands: islands.map(({ cells: _c, ...i }) => i),
    lakes,
    ranges,
    rivers: [...longest.values()],
    fixed,
    regions,
    regionDefs,
    nations: D.NATIONS,
    labels,
    names: Object.fromEntries(D.NATIONS.map((n) => [n.id, []])),
    placeName,
    coastSeeds: true,
    offmap,
  };
  const world = generateWorld(spec, log);

  const pkg: MapPackage = {
    format: MAP_FORMAT,
    version: MAP_FORMAT_VERSION,
    id: 'baltic',
    revision: 1,
    meta: META,
    rules: { startYear: 1906, campaignYears: { options: [30, 40, 49], default: 40 } },
    regions: regionDefs.filter((r) => world.provinces.some((p) => p.region === r.id)),
    nations: D.NATIONS,
    provinces: world.provinces,
    straits: world.straits,
    rivers: world.rivers,
    seaZones: [],
    geometry: { bounds: world.geometry.bounds, centers: world.geometry.provinces, edges: world.geometry.edges, waste: world.geometry.waste, labels: world.geometry.labels },
  };
  pkg.geometry.edges = pkg.geometry.edges.filter((e) => e.pts.some((v, i) => v !== e.pts[i % 2]));
  // deposits: the game's usual mix, likelier in the known mining districts
  const hints = D.DEPOSIT_HINTS.map((h) => ({ ...h, at: proj(h.lon, h.lat), r: h.km / KM }));
  const centre = (id: string) => pkg.geometry.centers[id];
  placeDeposits(pkg, {
    key: 'baltic',
    climate: 'northern',
    bias: (p, kind: ResourceKind) => {
      const c = centre(p.id);
      let w = kind === 'rubber' ? 0 : 1;
      for (const h of hints) if (h.kind === kind && Math.hypot(c.cx - h.at[0], c.cy - h.at[1]) < h.r) w = Math.max(w, h.weight);
      return w;
    },
  });
  addSeaZones(pkg);
  pkg.meta = { ...META, size: sizeFor(pkg.provinces.length) };
  pkg.rules = rulesFor(pkg);
  const check = validateMapPackage(pkg);
  if (!check.ok && process.env.DEBUG_BALTIC) {
    for (const e of check.errors) {
      if (!e.ref || !/more than one piece/.test(e.message)) continue;
      const { loops } = loopsFromEdges(e.ref, pkg.geometry.edges.filter((x) => x.a === e.ref || x.b === e.ref));
      log(`${e.ref}: ${loops.map((l) => `loop area ${Math.round(l.area)} sides ${[...new Set(l.sides)].join('/')}`).join(' | ')}`);
    }
    const byId = new Map(pkg.provinces.map((p) => [p.id, p]));
    const seen = new Map<string, number>();
    let k = 0;
    for (const p of pkg.provinces) {
      if (seen.has(p.id)) continue;
      const q = [p.id];
      seen.set(p.id, k);
      for (let i = 0; i < q.length; i++) for (const nb of byId.get(q[i])!.neighbors) if (!seen.has(nb)) (seen.set(nb, k), q.push(nb));
      log(`component ${k}: ${q.length} provinces: ${q.slice(0, 8).map((id) => byId.get(id)!.name).join(', ')}`);
      k++;
    }
    const sizes = new Map<number, number>();
    for (const v of seen.values()) sizes.set(v, (sizes.get(v) ?? 0) + 1);
    const big = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
    const col = new Map(pkg.nations.map((x) => [x.id, x.color]));
    writeFileSync(
      '.scratch/baltic-debug.svg',
      previewSvg(world.geometry.bounds, { ...world.geometry, provinces: world.polys } as unknown as Parameters<typeof previewSvg>[1], pkg.straits, (id) => (seen.get(id) !== big ? 'iso' : (byId.get(id)?.owner ?? null)), (o) => (o === 'iso' ? '#ff00ff' : col.get(o)!), (id) => byId.get(id)?.name ?? id, 1),
    );
  }
  if (!check.ok) throw new Error(`the map does not validate: ${check.errors.slice(0, 5).map((e) => e.message).join(' ')}`);
  const report = worldReport('The Baltic, 1906', 'npm run genbaltic', spec, world) + extraReport(pkg, check.warnings.map((w) => w.message));
  return { pkg, report, spec, world };
}

function xy(p: Pt): { x: number; y: number } {
  return { x: Math.round(p[0]), y: Math.round(p[1]) };
}

/** Provinces grow larger towards the thinly settled north. */
function northFactor(lat: number): number {
  return lat < 57 ? 0.9 : lat < 60 ? 1 : lat < 62.5 ? 1.5 : 2.3;
}

const META: MapMeta = {
  name: 'The Baltic, 1906',
  description:
    'Northern Europe in 1906: Sweden and newly independent Norway, Denmark at the straits, the German Empire along the southern shore and the Russian Empire from Finland to Lithuania, around one inland sea.',
  blurb: 'A real-world map: five realms, two empires and three small kingdoms, around the Baltic.',
  size: 'standard',
  difficulty: 'hard',
  style: 'Great powers and small kingdoms around one sea',
  mechanics: ['Real geography', 'Mountain passes', 'River crossings', 'Straits and islands'],
  origin: 'builtin',
  attribution: [
    'Coastlines, lakes, rivers, first-level divisions and towns: Natural Earth (naturalearthdata.com), public domain.',
    'Borders of 1906 approximated from present-day divisions; historical names and the Scandes ridges are authored (tools/baltic.data.ts).',
  ],
};

/**
 * Campaign rules. The empires start far larger than the kingdoms, so the
 * scaled thresholds (DESIGN.md) are raised above the largest starting share:
 * no realm starts within reach of a victory it has not earned.
 */
function rulesFor(pkg: MapPackage): MapPackage['rules'] {
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
    for (const [o, k] of owners) if (k / total > 0.5) byOwner.get(o)!.regions.add(rid);
  }
  const top = [...byOwner.values()];
  const maxProv = Math.max(...top.map((t) => t.prov)) / n;
  const maxDev = Math.max(...top.map((t) => t.dev)) / devAll;
  const maxRegions = Math.max(...top.map((t) => t.regions.size));
  const v = scaledVictory(pkg.regions.length, pkg.nations.length);
  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    startYear: 1906,
    campaignYears: { options: [30, 40, 49], default: 40 },
    victory: {
      territorialRegions: Math.max(v.territorialRegions!, maxRegions + 6),
      territorialShare: round2(Math.max(v.territorialShare!, maxProv + 0.15)),
      economicShare: round2(Math.max(v.economicShare!, maxDev + 0.12)),
      diplomaticInfluencePerRealm: v.diplomaticInfluencePerRealm,
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
    `- Sea zones: ${pkg.seaZones.length} (${pkg.seaZones.map((z) => z.name).join(', ')}); ports: ${pkg.provinces.filter((p) => p.port).length}`,
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

const isMain = process.argv[1]?.endsWith('genbaltic.ts');
if (isMain) {
  const t0 = performance.now();
  const { pkg, report, world } = balticPackage((l) => console.log(l));
  const { geometry, ...scenario } = pkg;
  mkdirSync(new URL('../src/data/maps/', import.meta.url), { recursive: true });
  mkdirSync(new URL('../reports/maps/', import.meta.url), { recursive: true });
  writeFileSync(new URL('../src/data/maps/baltic.scenario.json', import.meta.url), JSON.stringify({ generated: 'tools/genbaltic.ts from Natural Earth — do not edit by hand', ...scenario }));
  writeFileSync(new URL('../src/data/maps/baltic.map.json', import.meta.url), JSON.stringify(geometry));
  const own = new Map(pkg.provinces.map((p) => [p.id, p.owner]));
  const col = new Map(pkg.nations.map((n) => [n.id, n.color]));
  const nm = new Map(pkg.provinces.map((p) => [p.id, p.name]));
  writeFileSync(
    new URL('../reports/maps/baltic-preview.svg', import.meta.url),
    previewSvg(world.geometry.bounds, { ...world.geometry, provinces: world.polys } as unknown as Parameters<typeof previewSvg>[1], pkg.straits, (id) => own.get(id) ?? null, (n) => col.get(n)!, (id) => nm.get(id)!, 1),
  );
  writeFileSync(new URL('../reports/maps/baltic-map.md', import.meta.url), report);
  console.log(`baltic: ${pkg.provinces.length} provinces, ${pkg.nations.length} realms, ${pkg.seaZones.length} sea zones in ${Math.round(performance.now() - t0)} ms`);
  console.log(world.warnings.length ? `warnings: ${world.warnings.join('; ')}` : 'no warnings');
}


