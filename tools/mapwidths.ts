// Revision 3 of the redrawn historical maps: the ground each province and sea zone
// covers, measured against the revision it replaced (ProvinceDef.width, SeaZoneDef.width),
// the railways that revision had on the same ground, and a crossing the redraw lost.
//
// A province's width is the square root of its area over the area of the old provinces
// it lies on (their mean, weighted by how much of it each covers): a province a quarter
// the size of the old ones around it is half as wide, and a step through it counts half.
// Both revisions share the same coordinates, so the old outlines are rasterised on one
// grid with the new ones and the overlaps counted cell by cell. Sea zones are measured
// the same way on their own grids (both revisions are drawn on the same grid).
//
// The realm-average land (ProvinceDef.land) stays what prices development: this is only
// how far a step goes.
//
// Railways: the redraw kept each city's level but laid none on the land split from it,
// so a fifth of the World's railways were lost. Each province now has the level the old
// province(s) under it had: the overlap-weighted mean, whole levels given by largest
// remainder so that each realm's railways cover the area they covered before.
//
// Crossings: on the World, 1936 the Bab-el-Mandeb strait was resolved to two provinces on
// the African shore; it joins Tadjoura and Sanaa again (as on revision 1), commanded by
// the sea zone both coasts share (the map editor's own rule).
//
//   npx tsx tools/mapwidths.ts [--maps europe,europe-1936,earth,earth-1936] [--cell 6] [--revision 3] [--write]

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { shareBorder, toggleStrait } from '../src/maps/edit';
import type { MapGeometryData, MapPackage } from '../src/maps/format';
import { loopsFromEdges, type EdgeLike } from '../src/maps/rings';
import { decodeGrid } from '../src/maps/seazones';

/** The parts of a map package the measure reads. */
export interface Measured {
  provinces: Array<{ id: string; land?: number; infra?: number }>;
  seaZones: Array<{ id: string }>;
  geometry: Pick<MapGeometryData, 'bounds' | 'edges' | 'centers' | 'seas'>;
}

export interface Widths {
  provinces: Record<string, number>;
  zones: Record<string, number>;
  /** the railway level the old provinces under each province had (overlap-weighted mean; provinces on old ground only) */
  railways: Record<string, number>;
  /** provinces measured on their own ground, and those that fell back on their realm's average */
  measured: number;
  fallback: string[];
}

/** Widths are kept within these (a sliver of coast or a province many times the old ones is not a road). */
export const WIDTH_MIN = 0.3;
export const WIDTH_MAX = 1.8;

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Fills the cells whose centres lie inside a province's loops (even-odd, so holes stay out). */
function fillLoops(loops: number[][], cell: number, x0: number, y0: number, w: number, h: number, set: (i: number) => void): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const L of loops)
    for (let i = 1; i < L.length; i += 2) {
      if (L[i] < minY) minY = L[i];
      if (L[i] > maxY) maxY = L[i];
    }
  if (!Number.isFinite(minY)) return;
  const r0 = Math.max(0, Math.floor((minY - y0) / cell));
  const r1 = Math.min(h - 1, Math.floor((maxY - y0) / cell));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const yc = y0 + (r + 0.5) * cell;
    xs.length = 0;
    for (const L of loops) {
      const n = L.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const ya = L[2 * j + 1];
        const yb = L[2 * i + 1];
        if (ya > yc === yb > yc) continue;
        const xa = L[2 * j];
        const xb = L[2 * i];
        xs.push(xa + ((yc - ya) * (xb - xa)) / (yb - ya));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
      const c1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
      for (let c = c0; c <= c1; c++) set(r * w + c);
    }
  }
}

/** Province index + 1 per cell (0: none). */
function rasterise(m: Measured, cell: number): { grid: Int32Array; w: number; h: number; ids: string[] } {
  const { bounds, edges } = m.geometry;
  const w = Math.ceil((bounds.maxX - bounds.minX) / cell);
  const h = Math.ceil((bounds.maxY - bounds.minY) / cell);
  const grid = new Int32Array(w * h);
  const ids = m.provinces.map((p) => p.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const byProv = new Map<string, EdgeLike[]>();
  for (const e of edges) for (const s of [e.a, e.b]) if (index.has(s)) (byProv.get(s) ?? byProv.set(s, []).get(s)!).push(e);
  for (const [id, mine] of byProv) {
    const v = index.get(id)! + 1;
    const { loops } = loopsFromEdges(id, mine);
    fillLoops(
      loops.map((l) => l.ring),
      cell,
      bounds.minX,
      bounds.minY,
      w,
      h,
      (i) => (grid[i] = v),
    );
  }
  return { grid, w, h, ids };
}

/**
 * Each place's width from the overlap of its cells with the old places' cells: the square
 * root of its size over the mean size of the old places under it (weighted by the overlap).
 * `size` is the place's own size (in cells, or its exact area for provinces); `oldSize` the
 * old places' sizes in the same unit.
 */
function overlapWidths(now: Int32Array, before: Int32Array, nNow: number, nBefore: number, size: (i: number) => number, oldSize: (j: number) => number): { width: Float64Array; covered: Float64Array } {
  const weighted = new Float64Array(nNow);
  const covered = new Float64Array(nNow);
  for (let c = 0; c < now.length; c++) {
    const i = now[c] - 1;
    const j = before[c] - 1;
    if (i < 0 || j < 0 || i >= nNow || j >= nBefore) continue;
    weighted[i] += oldSize(j);
    covered[i]++;
  }
  const width = new Float64Array(nNow);
  for (let i = 0; i < nNow; i++) width[i] = covered[i] > 0 ? Math.sqrt(size(i) / (weighted[i] / covered[i])) : NaN;
  return { width, covered };
}

/**
 * The width of every province and sea zone of `now`, measured against `before` (the
 * revision it replaced, in the same coordinates). Provinces with no cell on old ground
 * keep their realm's average (√land).
 */
export function measureWidths(now: Measured, before: Measured, cell = 6): Widths {
  // provinces: exact areas over the old provinces' exact areas, weighted by the cells they share
  const a = rasterise(now, cell);
  const b = rasterise(before, cell);
  const areaNow = a.ids.map((id) => now.geometry.centers[id]?.area ?? 0);
  const areaBefore = b.ids.map((id) => before.geometry.centers[id]?.area ?? 0);
  // a province too small to hold a cell's centre is measured where its label stands
  const at = (x: number, y: number) => {
    const c = Math.floor((x - now.geometry.bounds.minX) / cell);
    const r = Math.floor((y - now.geometry.bounds.minY) / cell);
    return c >= 0 && r >= 0 && c < b.w && r < b.h ? b.grid[r * b.w + c] - 1 : -1;
  };
  const pw = overlapWidths(a.grid, b.grid, a.ids.length, b.ids.length, (i) => areaNow[i], (j) => areaBefore[j]);
  // the old railways on the same ground
  const oldInfra = before.provinces.map((p) => p.infra ?? 0);
  const railSum = new Float64Array(a.ids.length);
  for (let c = 0; c < a.grid.length; c++) {
    const i = a.grid[c] - 1;
    const j = b.grid[c] - 1;
    if (i >= 0 && j >= 0) railSum[i] += oldInfra[j];
  }
  const railways: Record<string, number> = {};
  now.provinces.forEach((p, i) => {
    if (pw.covered[i] > 0) railways[p.id] = railSum[i] / pw.covered[i];
  });
  const provinces: Record<string, number> = {};
  const fallback: string[] = [];
  let measured = 0;
  now.provinces.forEach((p, i) => {
    let wd = pw.width[i];
    if (!Number.isFinite(wd)) {
      const c = now.geometry.centers[p.id];
      const j = c ? at(c.cx, c.cy) : -1;
      if (j >= 0 && areaBefore[j] > 0 && areaNow[i] > 0) wd = Math.sqrt(areaNow[i] / areaBefore[j]);
    }
    if (Number.isFinite(wd) && wd > 0) measured++;
    else {
      fallback.push(p.id);
      wd = Math.sqrt(p.land ?? 1);
    }
    provinces[p.id] = round2(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, wd)));
  });
  // sea zones: cells over cells, on their shared grid
  const zones: Record<string, number> = {};
  const sa = now.geometry.seas;
  const sb = before.geometry.seas;
  if (sa && sb && sa.grid.w === sb.grid.w && sa.grid.h === sb.grid.h && sa.grid.cell === sb.grid.cell) {
    const ga = decodeGrid(sa.grid.rle, sa.grid.w * sa.grid.h, now.seaZones.length);
    const gb = decodeGrid(sb.grid.rle, sb.grid.w * sb.grid.h, before.seaZones.length);
    if (ga && gb) {
      const cntA = new Float64Array(now.seaZones.length);
      const cntB = new Float64Array(before.seaZones.length);
      for (const v of ga) if (v > 0) cntA[v - 1]++;
      for (const v of gb) if (v > 0) cntB[v - 1]++;
      const zw = overlapWidths(ga, gb, cntA.length, cntB.length, (i) => cntA[i], (j) => cntB[j]);
      now.seaZones.forEach((z, i) => {
        const wd = Number.isFinite(zw.width[i]) && zw.width[i] > 0 ? zw.width[i] : 1;
        zones[z.id] = round2(Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, wd)));
      });
    }
  }
  return { provinces, zones, railways, measured, fallback };
}

/**
 * Whole railway levels from the old revision's (overlap-weighted means): each realm's levels
 * by largest remainder, so its railways cover, area for area, what they covered before.
 * Provinces not on old ground keep their own level.
 */
export function carryRailways(provinces: Array<{ id: string; owner: string | null; infra?: number }>, mean: Record<string, number>, area: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  const byRealm = new Map<string, string[]>();
  for (const p of provinces) {
    if (mean[p.id] === undefined) {
      out[p.id] = p.infra ?? 0;
      continue;
    }
    const k = p.owner ?? '~';
    (byRealm.get(k) ?? byRealm.set(k, []).get(k)!).push(p.id);
  }
  for (const ids of byRealm.values()) {
    let target = 0;
    let cur = 0;
    for (const id of ids) {
      target += mean[id] * area[id];
      out[id] = Math.min(3, Math.floor(mean[id] + 1e-9));
      cur += out[id] * area[id];
    }
    const order = [...ids].sort((x, y) => mean[y] - out[y] - (mean[x] - out[x]) || (x < y ? -1 : 1));
    for (const id of order) {
      // a whole level up, never above what the old ground had
      if (out[id] >= Math.min(3, Math.ceil(mean[id] - 1e-9)) || cur + area[id] / 2 > target) continue;
      out[id]++;
      cur += area[id];
    }
  }
  return out;
}

/** Crossings the redraw lost (or resolved to the wrong shore), set right with the editor's own rule. */
export const STRAIT_FIXES: Record<string, Array<{ remove?: [string, string]; add?: [string, string] }>> = {
  // Bab-el-Mandeb: resolved to Mekele and Tadjoura, both on the African shore (and already neighbours by land)
  'earth-1936': [{ remove: ['mekele', 'tadjoura'] }, { add: ['sanaa', 'tadjoura'] }],
};

/** Applies a map's strait fixes to its package (scenario and geometry); returns what was done. */
export function fixStraits(pkg: MapPackage): string[] {
  const out: string[] = [];
  for (const f of STRAIT_FIXES[pkg.id] ?? []) {
    const [a, b] = (f.remove ?? f.add)!;
    const has = pkg.straits.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    if (f.remove ? !has : has) continue;
    const r = toggleStrait(pkg, a, b);
    if (!r.ok) throw new Error(`${pkg.id}: ${r.message}`);
    // a strait over a land border is removed as a strait only: the border stays
    if (f.remove && shareBorder(pkg, a, b)) {
      const pa = pkg.provinces.find((p) => p.id === a)!;
      const pb = pkg.provinces.find((p) => p.id === b)!;
      if (!pa.neighbors.includes(b)) pa.neighbors.push(b);
      if (!pb.neighbors.includes(a)) pb.neighbors.push(a);
    }
    out.push(`${f.remove ? 'removed' : 'added'} the strait ${a}–${b}`);
  }
  return out;
}

/** Quartiles of a list (for the report). */
export function spread(xs: number[]): string {
  const s = [...xs].sort((x, y) => x - y);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(f * s.length))]?.toFixed(2) ?? '-';
  const mean = s.reduce((x, y) => x + y, 0) / Math.max(1, s.length);
  return `${q(0)} / ${q(0.25)} / ${q(0.5)} / ${q(0.75)} / ${s.at(-1)?.toFixed(2) ?? '-'} (mean ${mean.toFixed(3)})`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : d;
  };
  const maps = get('maps', 'europe,europe-1936,earth,earth-1936').split(',');
  const cell = Number(get('cell', '6'));
  const revision = Number(get('revision', '0'));
  const write = args.includes('--write');
  for (const id of maps) {
    const scenPath = `src/data/maps/${id}.scenario.json`;
    const scen = JSON.parse(readFileSync(scenPath, 'utf8'));
    const geo = JSON.parse(readFileSync(`src/data/maps/${id}.map.json`, 'utf8')) as MapGeometryData;
    const old = JSON.parse(readFileSync(`src/data/maps/legacy/${id}-r1.scenario.json`, 'utf8'));
    const oldGeo = JSON.parse(readFileSync(`src/data/maps/legacy/${id}-r1.map.json`, 'utf8')) as MapGeometryData;
    const t0 = Date.now();
    const w = measureWidths({ ...scen, geometry: geo }, { ...old, geometry: oldGeo }, cell);
    const pw = Object.values(w.provinces);
    const zw = Object.values(w.zones);
    const landW = (scen.provinces as Array<{ land?: number }>).map((p) => Math.sqrt(p.land ?? 1));
    console.log(`${id}: ${pw.length} provinces (${w.measured} measured, ${w.fallback.length} on their realm's average${w.fallback.length ? `: ${w.fallback.slice(0, 8).join(', ')}` : ''}), ${Date.now() - t0} ms`);
    console.log(`  province width min/q1/median/q3/max: ${spread(pw)}; realm average √land: ${spread(landW)}`);
    console.log(`  sea zone width ${zw.length ? spread(zw) : 'not measured'} (${scen.seaZones.length} zones, ${old.seaZones.length} before)`);
    const areas = Object.fromEntries(Object.entries(geo.centers).map(([k, c]) => [k, c.area]));
    const carried = carryRailways(scen.provinces, w.railways, areas);
    const rails = (scen.provinces as Array<{ id: string }>).map((p) => carried[p.id]);
    const area = (ids: Array<{ id: string; infra?: number }>, g: MapGeometryData, level: (p: { id: string; infra?: number }, i: number) => number) => {
      let s = 0;
      let t = 0;
      ids.forEach((p, i) => {
        const a = g.centers[p.id]?.area ?? 0;
        s += level(p, i) * a;
        t += a;
      });
      return (s / t).toFixed(3);
    };
    console.log(`  railways (area-weighted level): revision 1 ${area(old.provinces, oldGeo, (p) => p.infra ?? 0)}, now ${area(scen.provinces, geo, (p) => p.infra ?? 0)}, carried over ${area(scen.provinces, geo, (_p, i) => rails[i])}`);
    if (!write) continue;
    scen.provinces.forEach((p: { width?: number; infra?: number; id: string }, i: number) => {
      p.width = w.provinces[p.id];
      p.infra = rails[i];
    });
    for (const z of scen.seaZones) if (w.zones[z.id] !== undefined) z.width = w.zones[z.id];
    if (revision) scen.revision = revision;
    const pkg = { ...scen, geometry: geo } as MapPackage & { generated?: string };
    for (const l of fixStraits(pkg)) console.log(`  ${l}`);
    const { geometry: _g, ...out } = pkg;
    void _g;
    writeFileSync(scenPath, JSON.stringify(out));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
