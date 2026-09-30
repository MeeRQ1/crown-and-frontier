// Map geometry shared by every campaign map: the generated polygons and edges
// plus derived indexes (paths, bounding boxes, a spatial grid for picking and
// culling, label anchors and deterministic terrain-art placements).

export interface MapGeometry {
  id: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  provinces: Record<string, { poly: number[]; cx: number; cy: number; area: number }>;
  /** province–province and province–water/waste border polylines (shared, so borders match exactly) */
  edges: Array<{ a: string; b: string; pts: number[]; river?: number }>;
  /** impassable cells: 'peak' (mountain range) or 'lake' */
  waste: Array<{ kind: string; poly: number[] }>;
  straits: Array<[string, string]>;
  /** named geography for lettering */
  labels?: MapLabel[];
}

export interface MapLabel {
  kind: 'sea' | 'lake' | 'range' | 'region' | 'river';
  name: string;
  x: number;
  y: number;
  size?: number; // world units
  angle?: number; // radians
}

export type BBox = [number, number, number, number];

export interface Glyph {
  x: number;
  y: number;
  s: number; // size in world units
  v: number; // variant 0..1
}

function pathFrom(poly: number[], close = true): Path2D {
  const p = new Path2D();
  p.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) p.lineTo(poly[i], poly[i + 1]);
  if (close) p.closePath();
  return p;
}

function bboxOf(poly: number[]): BBox {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    const x = poly[i];
    const y = poly[i + 1];
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

export function pointInPoly(x: number, y: number, poly: number[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const xi = poly[i];
    const yi = poly[i + 1];
    const xj = poly[j];
    const yj = poly[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}

function distToPoly(x: number, y: number, poly: number[]): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const d = distToSegSq(x, y, poly[j], poly[j + 1], poly[i], poly[i + 1]);
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

/** Pole of inaccessibility (a label anchor well inside the polygon), grid refinement. */
function poleOf(poly: number[], bb: BBox): { x: number; y: number; r: number } {
  let best = { x: (bb[0] + bb[2]) / 2, y: (bb[1] + bb[3]) / 2, r: -1 };
  let step = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 8;
  let cx = best.x;
  let cy = best.y;
  let span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2;
  for (let iter = 0; iter < 5; iter++) {
    for (let x = cx - span; x <= cx + span; x += step) {
      for (let y = cy - span; y <= cy + span; y += step) {
        if (!pointInPoly(x, y, poly)) continue;
        const r = distToPoly(x, y, poly);
        if (r > best.r) best = { x, y, r };
      }
    }
    cx = best.x;
    cy = best.y;
    span = step * 1.5;
    step /= 3;
  }
  if (best.r < 0) best = { x: (bb[0] + bb[2]) / 2, y: (bb[1] + bb[3]) / 2, r: 0 };
  return best;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poisson-ish scatter inside a polygon (deterministic), keeping clear of its edge. */
function scatter(poly: number[], bb: BBox, spacing: number, margin: number, seed: number, max = 400): Array<{ x: number; y: number }> {
  const r = rng(seed);
  const out: Array<{ x: number; y: number }> = [];
  const w = bb[2] - bb[0];
  const hgt = bb[3] - bb[1];
  const tries = Math.min(max * 6, Math.ceil(((w * hgt) / (spacing * spacing)) * 3.5));
  const s2 = spacing * spacing;
  for (let i = 0; i < tries && out.length < max; i++) {
    const x = bb[0] + r() * w;
    const y = bb[1] + r() * hgt;
    if (!pointInPoly(x, y, poly)) continue;
    if (margin > 0 && distToPoly(x, y, poly) < margin) continue;
    let ok = true;
    for (const q of out) {
      const dx = q.x - x;
      const dy = q.y - y;
      if (dx * dx + dy * dy < s2) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ x, y });
  }
  return out;
}

export interface ProvGeo {
  id: string;
  poly: number[];
  path: Path2D;
  bbox: BBox;
  cx: number;
  cy: number;
  area: number;
  /** label anchor and the radius of the largest inscribed circle there */
  lx: number;
  ly: number;
  lr: number;
}

export interface EdgeGeo {
  a: string;
  b: string;
  pts: number[];
  path: Path2D;
  bbox: BBox;
  river: number;
  /** a province touching water or an impassable cell */
  coast: boolean;
}

const GRID = 160;

export class GeoIndex {
  readonly id: string;
  readonly bounds: MapGeometry['bounds'];
  readonly provs = new Map<string, ProvGeo>();
  readonly provList: ProvGeo[] = [];
  readonly edges: EdgeGeo[] = [];
  readonly edgeByPair = new Map<string, EdgeGeo>();
  /** edges bordering each province */
  readonly edgesOf = new Map<string, EdgeGeo[]>();
  readonly peaks: Array<{ poly: number[]; path: Path2D; bbox: BBox }> = [];
  readonly lakes: Array<{ poly: number[]; path: Path2D; bbox: BBox }> = [];
  readonly straits: Array<[string, string]>;
  readonly labels: MapLabel[];
  /** outline of all land (provinces and mountain cells) against sea and lakes */
  readonly coastPath = new Path2D();
  readonly lakeShorePath = new Path2D();
  readonly landPath = new Path2D();
  readonly riverEdges: EdgeGeo[] = [];
  /** shoreline pieces with bounding boxes (for per-tile drawing) */
  readonly coastSegs: Array<{ path: Path2D; bbox: BBox; lake: boolean }> = [];
  private grid = new Map<string, string[]>();
  private glyphCache = new Map<string, Glyph[]>();
  /** typical province radius in world units (for zoom tiers) */
  readonly provScale: number;

  constructor(g: MapGeometry) {
    this.id = g.id;
    this.bounds = g.bounds;
    this.straits = g.straits ?? [];
    this.labels = g.labels ?? [];
    let areaSum = 0;
    for (const [id, p] of Object.entries(g.provinces)) {
      const bbox = bboxOf(p.poly);
      const pole = poleOf(p.poly, bbox);
      const pg: ProvGeo = { id, poly: p.poly, path: pathFrom(p.poly), bbox, cx: p.cx, cy: p.cy, area: p.area, lx: pole.x, ly: pole.y, lr: pole.r };
      this.provs.set(id, pg);
      this.provList.push(pg);
      this.landPath.addPath(pg.path);
      areaSum += p.area;
      for (let gx = Math.floor(bbox[0] / GRID); gx <= Math.floor(bbox[2] / GRID); gx++)
        for (let gy = Math.floor(bbox[1] / GRID); gy <= Math.floor(bbox[3] / GRID); gy++) {
          const k = `${gx},${gy}`;
          const l = this.grid.get(k);
          if (l) l.push(id);
          else this.grid.set(k, [id]);
        }
    }
    this.provScale = Math.sqrt(areaSum / Math.max(1, this.provList.length));
    for (const w of g.waste) {
      const item = { poly: w.poly, path: pathFrom(w.poly), bbox: bboxOf(w.poly) };
      if (w.kind === 'lake') this.lakes.push(item);
      else {
        this.peaks.push(item);
        this.landPath.addPath(item.path);
      }
    }
    for (const e of g.edges) {
      const aw = e.a.startsWith('~');
      const bw = e.b.startsWith('~');
      const path = pathFrom(e.pts, false);
      if (aw || bw) {
        // only the waste side's id names its kind ('~sea', '~peak', '~lake')
        const kinds = `${aw ? e.a : ''}${bw ? e.b : ''}`;
        const water = kinds.includes('sea');
        const lake = kinds.includes('lake');
        // a mountain cell next to a province is land–land: no shoreline
        if (water && !(aw && bw && !kinds.includes('peak'))) {
          this.coastPath.addPath(path);
          this.coastSegs.push({ path, bbox: bboxOf(e.pts), lake: false });
        } else if (lake) {
          this.lakeShorePath.addPath(path);
          this.coastSegs.push({ path, bbox: bboxOf(e.pts), lake: true });
        }
        if (!(aw && bw)) {
          const prov = aw ? e.b : e.a;
          const eg: EdgeGeo = { a: prov, b: aw ? e.a : e.b, pts: e.pts, path, bbox: bboxOf(e.pts), river: 0, coast: true };
          this.edges.push(eg);
          (this.edgesOf.get(prov) ?? this.edgesOf.set(prov, []).get(prov)!).push(eg);
        }
        continue;
      }
      const eg: EdgeGeo = { a: e.a, b: e.b, pts: e.pts, path, bbox: bboxOf(e.pts), river: e.river ?? 0, coast: false };
      this.edges.push(eg);
      this.edgeByPair.set(pairKey(e.a, e.b), eg);
      (this.edgesOf.get(e.a) ?? this.edgesOf.set(e.a, []).get(e.a)!).push(eg);
      (this.edgesOf.get(e.b) ?? this.edgesOf.set(e.b, []).get(e.b)!).push(eg);
      if (eg.river > 0) this.riverEdges.push(eg);
    }
  }

  /** Province under a world point. */
  provinceAt(x: number, y: number): string | null {
    const l = this.grid.get(`${Math.floor(x / GRID)},${Math.floor(y / GRID)}`);
    if (!l) return null;
    for (const id of l) {
      const p = this.provs.get(id)!;
      if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
      if (pointInPoly(x, y, p.poly)) return id;
    }
    return null;
  }

  /** Provinces whose bounding box intersects a world rectangle. */
  provincesIn(minX: number, minY: number, maxX: number, maxY: number): ProvGeo[] {
    const out: ProvGeo[] = [];
    for (const p of this.provList) if (p.bbox[2] >= minX && p.bbox[0] <= maxX && p.bbox[3] >= minY && p.bbox[1] <= maxY) out.push(p);
    return out;
  }

  /** Shoreline (sea, or lake shores) within a world rectangle, padded. */
  coastIn(rect: BBox, pad: number, lake = false): Path2D {
    const out = new Path2D();
    for (const c of this.coastSegs) {
      if (c.lake !== lake) continue;
      const b = c.bbox;
      if (b[2] + pad >= rect[0] && b[0] - pad <= rect[2] && b[3] + pad >= rect[1] && b[1] - pad <= rect[3]) out.addPath(c.path);
    }
    return out;
  }

  /** Deterministic terrain-art placements for a province (cached). */
  glyphs(id: string, terrain: string): Glyph[] {
    const key = `${id}|${terrain}`;
    const hit = this.glyphCache.get(key);
    if (hit) return hit;
    const p = this.provs.get(id)!;
    const s = this.provScale;
    const spec: Record<string, [number, number, number]> = {
      // spacing, glyph size, margin (fractions of the province scale)
      forest: [0.13, 0.08, 0.05],
      hills: [0.2, 0.14, 0.07],
      mountains: [0.2, 0.17, 0.08],
      marsh: [0.16, 0.1, 0.06],
      steppe: [0.2, 0.08, 0.06],
      plains: [0.3, 0.1, 0.1],
    };
    const [sp, sz, mg] = spec[terrain] ?? spec.plains;
    const pts = scatter(p.poly, p.bbox, sp * s, mg * s, hashStr(key), 260);
    const r = rng(hashStr(key) ^ 0x9e3779b9);
    const out = pts.map((q) => ({ x: q.x, y: q.y, s: sz * s * (0.8 + r() * 0.4), v: r() }));
    out.sort((a, b) => a.y - b.y);
    this.glyphCache.set(key, out);
    return out;
  }

  /** Glyphs filling an impassable mountain cell. */
  peakGlyphs(i: number): Glyph[] {
    const key = `~peak${i}`;
    const hit = this.glyphCache.get(key);
    if (hit) return hit;
    const w = this.peaks[i];
    const s = this.provScale;
    const pts = scatter(w.poly, w.bbox, 0.12 * s, 0.03 * s, hashStr(key), 240);
    const r = rng(hashStr(key) ^ 0x51ed27);
    const out = pts.map((q) => ({ x: q.x, y: q.y, s: 0.19 * s * (0.75 + r() * 0.5), v: r() }));
    out.sort((a, b) => a.y - b.y);
    this.glyphCache.set(key, out);
    return out;
  }
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const cache = new Map<string, GeoIndex>();
/** Build (once) the index for a geometry. */
export function geoIndex(g: MapGeometry): GeoIndex {
  let gi = cache.get(g.id);
  if (!gi) cache.set(g.id, (gi = new GeoIndex(g)));
  return gi;
}
