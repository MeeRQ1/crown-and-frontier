// Sea zones: the nodes fleets move between. Map format 3 stores them; older
// packages (and the built-in maps' generator) derive them from the drawn
// geometry with generateSeaZones(), which is deterministic.
//
// Method: the map is rasterised (land, lakes and peaks are not sea). Seeds are
// spread along the coastal water by farthest-point sampling on distances
// through water, then relaxed (Lloyd) a few times; every sea cell joins the
// nearest seed through water, so a zone never reaches across a peninsula.
// Coasts, adjacency, strait control, names and label anchors follow from the
// cells. The drawn part keeps a run-length grid (hit testing and fills) and
// smoothed zone borders.

import type { ProvinceDef } from '../sim/types';
import { SEA, type MapGeometryData, type MapLabelDef, type SeaGeometry, type SeaZoneDef } from './format';
import { ringFromEdges, type EdgeLike } from './rings';

export interface SeaZoneResult {
  zones: SeaZoneDef[];
  /** starting port levels of coastal provinces (only those above 0) */
  ports: Record<string, number>;
  drawn: SeaGeometry;
}

interface Input {
  provinces: Pick<ProvinceDef, 'id' | 'name' | 'dev' | 'owner'>[];
  nations: Array<{ id: string; capital: string }>;
  straits: Array<[string, string]>;
  geometry: Pick<MapGeometryData, 'bounds' | 'centers' | 'edges' | 'waste' | 'labels'>;
}

const SUFFIXES = ['Waters', 'Sound', 'Roads', 'Approaches', 'Bight', 'Channel'];

/** Scanline fill of a closed ring into the grid (cell centres inside get `value`). */
function fillRing(grid: Int32Array, w: number, h: number, x0: number, y0: number, cell: number, ring: number[], value: number, onlyIf?: (v: number) => boolean): void {
  const n = ring.length / 2;
  if (n < 3) return;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < ring.length; i += 2) {
    if (ring[i] < minY) minY = ring[i];
    if (ring[i] > maxY) maxY = ring[i];
  }
  const j0 = Math.max(0, Math.floor((minY - y0) / cell - 0.5));
  const j1 = Math.min(h - 1, Math.ceil((maxY - y0) / cell - 0.5));
  const xs: number[] = [];
  for (let j = j0; j <= j1; j++) {
    const y = y0 + (j + 0.5) * cell;
    xs.length = 0;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const ay = ring[a * 2 + 1];
      const by = ring[b * 2 + 1];
      if (ay > y !== by > y) {
        const ax = ring[a * 2];
        const bx = ring[b * 2];
        xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - x0) / cell - 0.5));
      const i1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) / cell - 0.5));
      for (let i = i0; i <= i1; i++) {
        const idx = j * w + i;
        if (!onlyIf || onlyIf(grid[idx])) grid[idx] = value;
      }
    }
  }
}

/** Breadth-first distances through `allowed` cells from `sources` (4-neighbour). */
function bfs(w: number, h: number, allowed: Uint8Array, sources: number[], dist: Int32Array, label?: Int32Array, labels?: number[]): void {
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (let s = 0; s < sources.length; s++) {
    const c = sources[s];
    if (dist[c] === 0 && label && label[c] !== -1) continue;
    dist[c] = 0;
    if (label && labels) label[c] = labels[s];
    queue[tail++] = c;
  }
  while (head < tail) {
    const c = queue[head++];
    const d = dist[c] + 1;
    const x = c % w;
    const y = (c - x) / w;
    const nbs = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
    for (const nb of nbs) {
      if (nb < 0 || !allowed[nb] || dist[nb] <= d) continue;
      dist[nb] = d;
      if (label) label[nb] = label[c];
      queue[tail++] = nb;
    }
  }
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Chaikin smoothing of an open polyline, keeping its end points. */
function smooth(pts: number[], rounds: number): number[] {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    if (p.length < 6) return p;
    const q: number[] = [p[0], p[1]];
    for (let i = 0; i + 3 < p.length; i += 2) {
      const ax = p[i];
      const ay = p[i + 1];
      const bx = p[i + 2];
      const by = p[i + 3];
      q.push(0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by, 0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by);
    }
    q.push(p[p.length - 2], p[p.length - 1]);
    p = q;
  }
  return p;
}

/** Run-length encoding of zone ordinals (0 = not sea): "count*value,…". */
export function encodeGrid(cells: ArrayLike<number>): string {
  const out: string[] = [];
  let run = 0;
  let cur = cells.length ? cells[0] : 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === cur) run++;
    else {
      out.push(`${run}*${cur}`);
      cur = cells[i];
      run = 1;
    }
  }
  if (run) out.push(`${run}*${cur}`);
  return out.join(',');
}

/** Inverse of encodeGrid; returns null if the text is malformed or the wrong size. */
export function decodeGrid(rle: string, size: number, maxValue: number): Int32Array | null {
  const out = new Int32Array(size);
  let i = 0;
  for (const part of rle.split(',')) {
    const m = /^(\d+)\*(\d+)$/.exec(part);
    if (!m) return null;
    const n = Number(m[1]);
    const v = Number(m[2]);
    if (v > maxValue || i + n > size) return null;
    out.fill(v, i, i + n);
    i += n;
  }
  return i === size ? out : null;
}

export function generateSeaZones(input: Input): SeaZoneResult {
  const { bounds, edges, waste } = input.geometry;
  const W = bounds.maxX - bounds.minX;
  const H = bounds.maxY - bounds.minY;
  const cell = Math.max(6, Math.sqrt((W * H) / 60000));
  const w = Math.max(4, Math.ceil(W / cell));
  const h = Math.max(4, Math.ceil(H / cell));
  const x0 = bounds.minX;
  const y0 = bounds.minY;
  const N = w * h;
  const provIdx = new Map(input.provinces.map((p, i) => [p.id, i]));

  // ── raster: 0 sea, >0 province index + 1, -1 lake, -2 peak
  const grid = new Int32Array(N);
  const byProv = new Map<string, EdgeLike[]>();
  for (const e of edges) for (const s of [e.a, e.b]) if (provIdx.has(s)) (byProv.get(s) ?? byProv.set(s, []).get(s)!).push(e);
  for (const p of input.provinces) fillRing(grid, w, h, x0, y0, cell, ringFromEdges(p.id, byProv.get(p.id) ?? []), provIdx.get(p.id)! + 1);
  for (const wz of waste) fillRing(grid, w, h, x0, y0, cell, wz.poly, wz.kind === 'lake' ? -1 : -2);
  const sea = new Uint8Array(N);
  for (let i = 0; i < N; i++) sea[i] = grid[i] === 0 ? 1 : 0;
  const cellOf = (x: number, y: number) => {
    const i = Math.min(w - 1, Math.max(0, Math.floor((x - x0) / cell)));
    const j = Math.min(h - 1, Math.max(0, Math.floor((y - y0) / cell)));
    return j * w + i;
  };

  // ── coastline samples: the sea cells next to each province's sea borders
  const coastCells = new Map<string, number[]>();
  for (const e of edges) {
    const pid = e.a === SEA ? e.b : e.b === SEA ? e.a : null;
    if (!pid || !provIdx.has(pid)) continue;
    const list = coastCells.get(pid) ?? coastCells.set(pid, []).get(pid)!;
    for (let k = 0; k + 3 < e.pts.length; k += 2) {
      const ax = e.pts[k];
      const ay = e.pts[k + 1];
      const bx = e.pts[k + 2];
      const by = e.pts[k + 3];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cell * 0.5)));
      for (let s = 0; s <= steps; s++) {
        const c = cellOf(ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
        // the nearest sea cell within two cells of the sample
        const cx = c % w;
        const cy = (c - cx) / w;
        let best = -1;
        let bd = Infinity;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const xx = cx + dx;
            const yy = cy + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            const idx = yy * w + xx;
            const d = dx * dx + dy * dy;
            if (sea[idx] && (d < bd || (d === bd && idx < best))) {
              bd = d;
              best = idx;
            }
          }
        }
        if (best >= 0) list.push(best);
      }
    }
  }
  const coastal = new Uint8Array(N);
  for (const list of coastCells.values()) for (const c of list) coastal[c] = 1;

  // ── sea bodies that touch a coast; others (enclosed slivers) are not navigable
  const comp = new Int32Array(N).fill(-1);
  const comps: number[][] = [];
  for (let s = 0; s < N; s++) {
    if (!sea[s] || comp[s] >= 0) continue;
    const id = comps.length;
    const cells = [s];
    comp[s] = id;
    for (let q = 0; q < cells.length; q++) {
      const c = cells[q];
      const x = c % w;
      for (const nb of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) {
        if (nb < 0 || nb >= N || !sea[nb] || comp[nb] >= 0) continue;
        comp[nb] = id;
        cells.push(nb);
      }
    }
    comps.push(cells);
  }
  const navigable = new Uint8Array(N);
  const label = new Int32Array(N).fill(-1);
  let zoneCount = 0;
  for (let ci = 0; ci < comps.length; ci++) {
    const cells = comps[ci];
    const shore = cells.filter((c) => coastal[c]);
    if (!shore.length) continue;
    const provs = new Set<string>();
    for (const [pid, list] of coastCells) if (list.some((c) => comp[c] === ci)) provs.add(pid);
    const k = Math.max(1, Math.min(shore.length, Math.round(provs.size / 3.5)));
    for (const c of cells) navigable[c] = 1;
    const allowed = new Uint8Array(N);
    for (const c of cells) allowed[c] = 1;
    // farthest-point seeds along the shore, by distance through water
    const dist = new Int32Array(N).fill(0x7fffffff);
    let seeds = [shore[0]];
    bfs(w, h, allowed, [shore[0]], dist);
    while (seeds.length < k) {
      let far = -1;
      let fd = -1;
      for (const c of shore) if (dist[c] > fd && dist[c] < 0x7fffffff) (fd = dist[c]), (far = c);
      if (far < 0 || fd <= 0) break;
      seeds.push(far);
      bfs(w, h, allowed, [far], dist);
    }
    // Lloyd relaxation: move each seed to the shore cell of its zone nearest the zone's shore centroid
    const assign = (sd: number[]) => {
      const d = new Int32Array(N).fill(0x7fffffff);
      const lab = new Int32Array(N).fill(-1);
      bfs(w, h, allowed, sd, d, lab, sd.map((_, i) => i));
      return lab;
    };
    for (let iter = 0; iter < 4; iter++) {
      const lab = assign(seeds);
      const sx = new Float64Array(seeds.length);
      const sy = new Float64Array(seeds.length);
      const sn = new Float64Array(seeds.length);
      for (const c of shore) {
        const z = lab[c];
        if (z < 0) continue;
        sx[z] += c % w;
        sy[z] += Math.floor(c / w);
        sn[z]++;
      }
      const next = seeds.slice();
      const bestD = new Float64Array(seeds.length).fill(Infinity);
      for (const c of shore) {
        const z = lab[c];
        if (z < 0 || !sn[z]) continue;
        const d = (c % w - sx[z] / sn[z]) ** 2 + (Math.floor(c / w) - sy[z] / sn[z]) ** 2;
        if (d < bestD[z]) (bestD[z] = d), (next[z] = c);
      }
      seeds = next;
    }
    const lab = assign(seeds);
    for (const c of cells) if (lab[c] >= 0) label[c] = zoneCount + lab[c];
    zoneCount += seeds.length;
  }

  // ── merge slivers into their longest-bordering neighbour
  const minCells = Math.max(12, Math.round(N / 2500));
  for (let pass = 0; pass < 6; pass++) {
    const size = new Int32Array(zoneCount);
    for (let i = 0; i < N; i++) if (label[i] >= 0) size[label[i]]++;
    const shared = new Map<number, Map<number, number>>();
    for (let i = 0; i < N; i++) {
      const a = label[i];
      if (a < 0) continue;
      const x = i % w;
      for (const nb of [x < w - 1 ? i + 1 : -1, i + w < N ? i + w : -1]) {
        if (nb < 0) continue;
        const b = label[nb];
        if (b < 0 || b === a) continue;
        for (const [p, q] of [
          [a, b],
          [b, a],
        ]) {
          const m = shared.get(p) ?? shared.set(p, new Map()).get(p)!;
          m.set(q, (m.get(q) ?? 0) + 1);
        }
      }
    }
    let merged = false;
    for (let z = 0; z < zoneCount; z++) {
      if (!size[z] || size[z] >= minCells) continue;
      const m = shared.get(z);
      if (!m || !m.size) continue;
      let to = -1;
      let best = -1;
      for (const [q, n] of [...m].sort((p, q) => p[0] - q[0])) if (n > best) (best = n), (to = q);
      for (let i = 0; i < N; i++) if (label[i] === z) label[i] = to;
      size[to] += size[z];
      size[z] = 0;
      merged = true;
    }
    if (!merged) break;
  }
  // ── coasts: zones that hold at least 15% of a province's coastline samples
  const coasts = new Map<number, Set<string>>();
  const provZones = new Map<string, Map<number, number>>();
  for (const [pid, list] of coastCells) {
    const votes = new Map<number, number>();
    for (const c of list) if (label[c] >= 0) votes.set(label[c], (votes.get(label[c]) ?? 0) + 1);
    const total = [...votes.values()].reduce((a, b) => a + b, 0);
    for (const [z, n] of votes) if (n >= Math.max(1, total * 0.15)) (coasts.get(z) ?? coasts.set(z, new Set()).get(z)!).add(pid);
    provZones.set(pid, votes);
  }
  // ── adjacency
  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < N; i++) {
    const a = label[i];
    if (a < 0) continue;
    const x = i % w;
    for (const nb of [x < w - 1 ? i + 1 : -1, i + w < N ? i + w : -1]) {
      if (nb < 0) continue;
      const b = label[nb];
      if (b < 0 || b === a) continue;
      (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
      (adj.get(b) ?? adj.set(b, new Set()).get(b)!).add(a);
    }
  }
  // an enclosed pool with no coast of its own and no neighbour is not a sea lane
  for (let z = 0; z < zoneCount; z++) {
    if (coasts.has(z) || adj.has(z)) continue;
    for (let i = 0; i < N; i++) if (label[i] === z) label[i] = -1;
    for (const votes of provZones.values()) votes.delete(z);
  }
  // renumber the surviving zones by the position of their anchor (north to south, west to east)
  const present = new Set<number>();
  for (let i = 0; i < N; i++) if (label[i] >= 0) present.add(label[i]);
  // anchors: the cell of each zone farthest from its edge
  const edgeDist = new Int32Array(N).fill(0x7fffffff);
  const zoneCells = new Uint8Array(N);
  const boundary: number[] = [];
  for (let i = 0; i < N; i++) {
    if (label[i] < 0) continue;
    zoneCells[i] = 1;
    const x = i % w;
    const nbs = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    if (nbs.some((nb) => nb < 0 || nb >= N || label[nb] !== label[i])) boundary.push(i);
  }
  // distance inside each zone from its own boundary
  {
    const queue = boundary.slice();
    for (const c of queue) edgeDist[c] = 0;
    for (let q = 0; q < queue.length; q++) {
      const c = queue[q];
      const x = c % w;
      for (const nb of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) {
        if (nb < 0 || nb >= N || !zoneCells[nb] || label[nb] !== label[c] || edgeDist[nb] <= edgeDist[c] + 1) continue;
        edgeDist[nb] = edgeDist[c] + 1;
        queue.push(nb);
      }
    }
  }
  const anchorCell = new Map<number, number>();
  for (let i = 0; i < N; i++) {
    const z = label[i];
    if (z < 0) continue;
    const cur = anchorCell.get(z);
    if (cur === undefined || edgeDist[i] > edgeDist[cur]) anchorCell.set(z, i);
  }
  const order = [...present].sort((a, b) => {
    const ca = anchorCell.get(a)!;
    const cb = anchorCell.get(b)!;
    const ra = Math.floor(Math.floor(ca / w) / 20);
    const rb = Math.floor(Math.floor(cb / w) / 20);
    return ra - rb || (ca % w) - (cb % w) || ca - cb;
  });
  const ordinal = new Map(order.map((z, i) => [z, i]));
  const zid = (z: number) => `sea-${ordinal.get(z)! + 1}`;
  const centre = (c: number) => ({ cx: Math.round(x0 + ((c % w) + 0.5) * cell), cy: Math.round(y0 + (Math.floor(c / w) + 0.5) * cell) });

  // ── straits: the zone both ends share with the most coastline, else the zone under the crossing
  const straitsOf = new Map<number, Array<[string, string]>>();
  const centres = input.geometry.centers;
  for (const [a, b] of input.straits) {
    const va = provZones.get(a) ?? new Map<number, number>();
    const vb = provZones.get(b) ?? new Map<number, number>();
    let best = -1;
    let bv = -1;
    for (const [z, n] of [...va].sort((p, q) => p[0] - q[0])) {
      const m = vb.get(z);
      if (m && n + m > bv) (bv = n + m), (best = z);
    }
    if (best < 0 && centres[a] && centres[b]) {
      // walk outward from the midpoint until a zone is found
      const mid = cellOf((centres[a].cx + centres[b].cx) / 2, (centres[a].cy + centres[b].cy) / 2);
      const mx = mid % w;
      const my = Math.floor(mid / w);
      for (let r = 0; r < 40 && best < 0; r++) {
        for (let dy = -r; dy <= r && best < 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const xx = mx + dx;
            const yy = my + dy;
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
            if (label[yy * w + xx] >= 0) {
              best = label[yy * w + xx];
              break;
            }
          }
        }
      }
    }
    if (best >= 0) (straitsOf.get(best) ?? straitsOf.set(best, []).get(best)!).push([a, b]);
  }

  // ── names: printed sea names first, then the main coast, then the open sea by direction
  const names = new Map<number, string>();
  const provName = new Map(input.provinces.map((p) => [p.id, p.name]));
  for (const l of (input.geometry.labels ?? []) as MapLabelDef[]) {
    if (l.kind !== 'sea') continue;
    const c = cellOf(l.x, l.y);
    let z = label[c];
    if (z < 0) {
      const cx = c % w;
      const cy = Math.floor(c / w);
      for (let r = 1; r < 6 && z < 0; r++) for (let dy = -r; dy <= r && z < 0; dy++) for (let dx = -r; dx <= r && z < 0; dx++) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) z = label[yy * w + xx];
      }
    }
    if (z >= 0 && !names.has(z)) names.set(z, l.name);
  }
  const used = new Set(names.values());
  for (const z of order) {
    if (names.has(z)) continue;
    let name: string;
    const coast = [...(coasts.get(z) ?? [])].sort();
    if (coast.length) {
      let top = coast[0];
      let tv = -1;
      for (const pid of coast) {
        const v = provZones.get(pid)?.get(z) ?? 0;
        if (v > tv) (tv = v), (top = pid);
      }
      name = `${provName.get(top) ?? top} ${SUFFIXES[hash(top) % SUFFIXES.length]}`;
    } else {
      const { cx, cy } = centre(anchorCell.get(z)!);
      const dx = (cx - (bounds.minX + W / 2)) / W;
      const dy = (cy - (bounds.minY + H / 2)) / H;
      name = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'Western Deep' : 'Eastern Deep') : dy < 0 ? 'Northern Deep' : 'Southern Deep';
    }
    let unique = name;
    for (let n = 2; used.has(unique); n++) unique = `${name} ${n}`;
    used.add(unique);
    names.set(z, unique);
  }

  const zones: SeaZoneDef[] = order.map((z) => {
    const def: SeaZoneDef = {
      id: zid(z),
      name: names.get(z)!,
      neighbors: [...(adj.get(z) ?? [])].map(zid).sort(),
      coasts: [...(coasts.get(z) ?? [])].sort(),
    };
    const st = straitsOf.get(z);
    if (st?.length) def.straits = st.map(([a, b]) => (a < b ? [a, b] : [b, a]) as [string, string]).sort((p, q) => (p[0] + p[1] < q[0] + q[1] ? -1 : 1));
    return def;
  });

  // ── starting ports: every coastal realm's best coastal province, its coastal
  // capital (level 2) and other developed coasts
  const capitals = new Set(input.nations.map((n) => n.capital));
  const coastal2 = new Set<string>();
  for (const z of zones) for (const p of z.coasts) coastal2.add(p);
  const ports: Record<string, number> = {};
  const best = new Map<string, Pick<ProvinceDef, 'id' | 'dev'>>();
  for (const p of input.provinces) {
    if (!coastal2.has(p.id) || !p.owner) continue;
    if (capitals.has(p.id)) ports[p.id] = 2;
    else if (p.dev >= 4) ports[p.id] = 1;
    const b = best.get(p.owner);
    if (!b || p.dev > b.dev || (p.dev === b.dev && p.id < b.id)) best.set(p.owner, p);
  }
  for (const p of best.values()) ports[p.id] = Math.max(ports[p.id] ?? 0, 1);

  // ── drawn part: grid, anchors and smoothed borders between zones
  const cells = new Int32Array(N);
  for (let i = 0; i < N; i++) cells[i] = label[i] >= 0 ? ordinal.get(label[i])! + 1 : 0;
  const anchors: SeaGeometry['anchors'] = {};
  for (const z of order) anchors[zid(z)] = centre(anchorCell.get(z)!);
  // cell-edge segments between zones, chained into polylines on the grid's vertices
  const segs = new Map<string, Array<[number, number]>>();
  const vid = (vx: number, vy: number) => vy * (w + 1) + vx;
  const addSeg = (a: number, b: number, p: number, q: number) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    (segs.get(k) ?? segs.set(k, []).get(k)!).push([p, q]);
  };
  for (let i = 0; i < N; i++) {
    const a = cells[i];
    if (!a) continue;
    const x = i % w;
    const y = Math.floor(i / w);
    if (x < w - 1 && cells[i + 1] && cells[i + 1] !== a) addSeg(a, cells[i + 1], vid(x + 1, y), vid(x + 1, y + 1));
    if (y < h - 1 && cells[i + w] && cells[i + w] !== a) addSeg(a, cells[i + w], vid(x, y + 1), vid(x + 1, y + 1));
  }
  const borders: SeaGeometry['borders'] = [];
  for (const [k, list] of [...segs].sort((p, q) => (p[0] < q[0] ? -1 : 1))) {
    const [a, b] = k.split('|').map(Number);
    const at = new Map<number, number[]>();
    list.forEach(([p, q], i) => {
      (at.get(p) ?? at.set(p, []).get(p)!).push(i);
      (at.get(q) ?? at.set(q, []).get(q)!).push(i);
    });
    const done = new Uint8Array(list.length);
    // start chains at ends (vertices used once), then close any loops
    const starts = [...at.entries()].filter(([, l]) => l.length === 1).map(([v]) => v).sort((p, q) => p - q);
    const walk = (startV: number) => {
      const chain = [startV];
      let v = startV;
      for (;;) {
        const next = (at.get(v) ?? []).find((s) => !done[s]);
        if (next === undefined) break;
        done[next] = 1;
        const [p, q] = list[next];
        v = p === v ? q : p;
        chain.push(v);
      }
      return chain;
    };
    const chains: number[][] = [];
    for (const s of starts) if ((at.get(s) ?? []).some((i) => !done[i])) chains.push(walk(s));
    for (let i = 0; i < list.length; i++) if (!done[i]) chains.push(walk(list[i][0]));
    for (const chain of chains) {
      if (chain.length < 2) continue;
      const pts: number[] = [];
      for (const v of chain) pts.push(Math.round((x0 + (v % (w + 1)) * cell) * 10) / 10, Math.round((y0 + Math.floor(v / (w + 1)) * cell) * 10) / 10);
      const sm = smooth(pts, 3).map((n) => Math.round(n * 10) / 10);
      borders.push({ a: `sea-${a}`, b: `sea-${b}`, pts: sm });
    }
  }
  return {
    zones,
    ports,
    drawn: { grid: { x0: Math.round(x0 * 100) / 100, y0: Math.round(y0 * 100) / 100, cell: Math.round(cell * 1000) / 1000, w, h, rle: encodeGrid(cells) }, anchors, borders },
  };
}
