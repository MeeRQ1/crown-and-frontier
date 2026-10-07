// The static geography layer: blue-grey sea with engraved water lines, the
// ivory land with a light paper grain, terrain drawn in the atlas pack's motif
// construction (fir clusters, hill arcs, ridge triangles, reeds, field grids),
// mountain ranges, lakes and rivers. It never changes during a campaign, so it is
// rendered once into cached tiles (plus a whole-world overview used while tiles
// are still being drawn) and composited under the political layers.

import type { GeoIndex, Glyph } from './geometry';
import { spriteImage } from './sprites';

export type TerrainDetail = 'full' | 'reduced' | 'off';

/** Colours from the pack's design tokens and map-rendering rules. */
export const PALETTE = {
  seaDeep: '#9fbcc1',
  seaMid: '#a9c5ca',
  seaShallow: '#b6cfd1',
  waterLine: '#7f9fa4',
  lake: '#adc8cc',
  river: '#7ca1a7',
  paper: '#eee7d7',
  paperShade: '#e0d9c7',
  ink: '#59645d',
  coastInk: '#6d8987',
  coastUnder: '#e8d7aa',
  peakBase: '#ddd5c1',
  beyond: '#d3d0c3',
  terrainTint: {
    plains: '#eee7d7',
    steppe: '#ece3cb',
    forest: '#e4e4cf',
    hills: '#e9e0cc',
    marsh: '#e1e5d9',
    mountains: '#e4dccc',
  } as Record<string, string>,
};

const TILE = 256;

interface Tile {
  canvas: HTMLCanvasElement;
  used: number;
}

export class BaseMap {
  private tiles = new Map<string, Tile>();
  private overview: HTMLCanvasElement | null = null;
  private overviewScale = 1;
  private clock = 0;
  detail: TerrainDetail = 'full';

  constructor(
    private readonly geo: GeoIndex,
    private readonly terrainOf: (id: string) => string,
  ) {}

  setDetail(d: TerrainDetail): void {
    if (d === this.detail) return;
    this.detail = d;
    this.tiles.clear();
    this.overview = null;
  }

  /** Pixels per world unit at a tile level. */
  private static ppw(level: number): number {
    return Math.pow(2, level) / 16;
  }

  /**
   * Draw the base map for the current camera. Renders missing tiles within a
   * time budget; returns false if some tiles are still pending (redraw soon).
   */
  draw(ctx: CanvasRenderingContext2D, zoom: number, offX: number, offY: number, vw: number, vh: number, dpr: number, budgetMs = 10): boolean {
    this.clock++;
    const scale = zoom * dpr;
    // backdrop: the whole-world overview (instant)
    const ov = this.getOverview();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(0, 0, vw, vh);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const b = this.geo.bounds;
    ctx.drawImage(ov, offX + b.minX * zoom, offY + b.minY * zoom, (b.maxX - b.minX) * zoom, (b.maxY - b.minY) * zoom);
    ctx.restore();
    // tiles at the level just above the needed resolution
    const level = Math.ceil(Math.log2(scale * 16));
    const ppw = BaseMap.ppw(level);
    if (ppw <= this.overviewScale * 1.05) return true;
    const tw = TILE / ppw; // world units per tile
    const x0 = (0 - offX) / zoom;
    const y0 = (0 - offY) / zoom;
    const x1 = (vw - offX) / zoom;
    const y1 = (vh - offY) / zoom;
    const tx0 = Math.floor(Math.max(x0, b.minX) / tw);
    const ty0 = Math.floor(Math.max(y0, b.minY) / tw);
    const tx1 = Math.floor(Math.min(x1, b.maxX) / tw);
    const ty1 = Math.floor(Math.min(y1, b.maxY) / tw);
    const t0 = performance.now();
    let complete = true;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    const drawScale = scale / ppw;
    // nearest tiles first so the centre sharpens first
    const cxT = (tx0 + tx1) / 2;
    const cyT = (ty0 + ty1) / 2;
    const order: Array<[number, number]> = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) order.push([tx, ty]);
    order.sort((p, q) => Math.hypot(p[0] - cxT, p[1] - cyT) - Math.hypot(q[0] - cxT, q[1] - cyT));
    for (const [tx, ty] of order) {
      const key = `${level}|${tx}|${ty}`;
      let t = this.tiles.get(key);
      if (!t) {
        if (performance.now() - t0 > budgetMs) {
          complete = false;
          continue;
        }
        t = { canvas: this.renderTile(level, tx, ty), used: 0 };
        this.tiles.set(key, t);
      }
      t.used = this.clock;
      const sx = (tx * tw * zoom + offX) * dpr;
      const sy = (ty * tw * zoom + offY) * dpr;
      const size = TILE * drawScale;
      // overlap by a fraction of a pixel to hide seams
      ctx.drawImage(t.canvas, Math.floor(sx), Math.floor(sy), Math.ceil(size + (sx % 1)) + 1, Math.ceil(size + (sy % 1)) + 1);
    }
    ctx.restore();
    this.evict();
    return complete;
  }

  private evict(): void {
    const max = 140;
    if (this.tiles.size <= max) return;
    const arr = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < arr.length - max; i++) this.tiles.delete(arr[i][0]);
  }

  private getOverview(): HTMLCanvasElement {
    if (this.overview) return this.overview;
    const b = this.geo.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const s = Math.min(2048 / w, 2048 / h);
    const c = document.createElement('canvas');
    c.width = Math.round(w * s);
    c.height = Math.round(h * s);
    const g = c.getContext('2d')!;
    g.setTransform(s, 0, 0, s, -b.minX * s, -b.minY * s);
    this.paint(g, s, [b.minX, b.minY, b.maxX, b.maxY]);
    this.overview = c;
    this.overviewScale = s;
    return c;
  }

  private renderTile(level: number, tx: number, ty: number): HTMLCanvasElement {
    const ppw = BaseMap.ppw(level);
    const tw = TILE / ppw;
    const c = document.createElement('canvas');
    c.width = TILE;
    c.height = TILE;
    const g = c.getContext('2d')!;
    g.setTransform(ppw, 0, 0, ppw, -tx * tw * ppw, -ty * tw * ppw);
    const pad = this.geo.provScale * 0.4;
    this.paint(g, ppw, [tx * tw - pad, ty * tw - pad, (tx + 1) * tw + pad, (ty + 1) * tw + pad]);
    return c;
  }

  /** Paint the geography for a world rectangle at `ppw` pixels per world unit. */
  private paint(g: CanvasRenderingContext2D, ppw: number, rect: [number, number, number, number]): void {
    const geo = this.geo;
    const S = geo.provScale / 150; // world scale factor relative to the Reach
    const px = 1 / ppw; // one device pixel in world units
    const [rx0, ry0, rx1, ry1] = rect;
    const inRect = (bb: [number, number, number, number]) => bb[2] >= rx0 && bb[0] <= rx1 && bb[3] >= ry0 && bb[1] <= ry1;
    const coast = geo.coastIn(rect, 160 * S);
    const shore = geo.coastIn(rect, 20 * S, true);
    const provs = geo.provList.filter((p) => inRect(p.bbox));
    const peaks = geo.peaks.map((w, i) => ({ w, i })).filter((o) => inRect(o.w.bbox));
    const land = new Path2D();
    for (const p of provs) land.addPath(p.path);
    for (const o of peaks) land.addPath(o.w.path);

    // sea: blue-grey, lighter over the shallows, with a faint printed texture
    g.fillStyle = PALETTE.seaDeep;
    g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const shallows: Array<[number, string, number]> = [
      [150 * S, PALETTE.seaMid, 0.55],
      [90 * S, PALETTE.seaMid, 0.7],
      [44 * S, PALETTE.seaShallow, 0.8],
    ];
    for (const [w, col, a] of shallows) {
      g.globalAlpha = a;
      g.strokeStyle = col;
      g.lineWidth = w;
      g.stroke(coast);
    }
    g.globalAlpha = 1;
    this.texture(g, 'textures/sea-tile', 0.3, px, rect);
    // engraved water lines: thin rings at fixed distances from the shore
    if (ppw * S > 0.06) {
      for (const d of [34, 22, 12]) {
        const dd = d * S;
        g.strokeStyle = PALETTE.waterLine;
        g.globalAlpha = 0.42 - d / 140;
        g.lineWidth = dd * 2;
        g.stroke(coast);
        g.globalAlpha = 1;
        g.strokeStyle = d === 34 ? PALETTE.seaMid : PALETTE.seaShallow;
        g.lineWidth = Math.max(0, dd * 2 - Math.max(0.9 * px, 1.1 * S));
        g.stroke(coast);
      }
      g.globalAlpha = 1;
    }

    // land beyond the frame of a regional map: muted, without detail
    const beyond = geo.beyond.filter((b) => inRect(b.bbox));
    if (beyond.length) {
      const bp = new Path2D();
      for (const b of beyond) bp.addPath(b.path);
      g.fillStyle = PALETTE.beyond;
      g.fill(bp);
    }
    // ivory land, faint terrain tints by province (one fill per tint: no seams)
    g.fillStyle = PALETTE.paper;
    g.fill(land);
    const tints = new Map<string, Path2D>();
    for (const p of provs) {
      const tint = PALETTE.terrainTint[this.terrainOf(p.id)];
      if (!tint || tint === PALETTE.terrainTint.plains) continue;
      (tints.get(tint) ?? tints.set(tint, new Path2D()).get(tint)!).addPath(p.path);
    }
    for (const [tint, path] of tints) {
      g.fillStyle = tint;
      g.fill(path);
    }
    // mountain ranges (impassable)
    const range = new Path2D();
    for (const { w } of peaks) range.addPath(w.path);
    g.fillStyle = PALETTE.peakBase;
    g.fill(range);
    // paper grain over land, light
    g.save();
    g.clip(land);
    this.texture(g, 'textures/paper-tile', 0.25, px, rect);
    // the coast's warm understroke on the land side
    g.strokeStyle = PALETTE.coastUnder;
    g.lineWidth = Math.max(3 * px, 3 * S);
    g.stroke(coast);
    g.restore();

    // lakes: one body of water, with water lines along the real shore only
    const lakes = new Path2D();
    let anyLake = false;
    for (const l of geo.lakes) {
      if (!inRect(l.bbox)) continue;
      lakes.addPath(l.path);
      anyLake = true;
    }
    if (anyLake) {
      g.fillStyle = PALETTE.lake;
      g.fill(lakes);
      if (ppw * S > 0.06) {
        g.save();
        g.clip(lakes);
        g.strokeStyle = PALETTE.waterLine;
        g.globalAlpha = 0.35;
        g.lineWidth = 16 * S;
        g.stroke(shore);
        g.strokeStyle = PALETTE.lake;
        g.globalAlpha = 1;
        g.lineWidth = 16 * S - Math.max(0.9 * px, 1.1 * S);
        g.stroke(shore);
        g.restore();
      }
    }

    // terrain motifs: sparse, deterministic, from each province's real terrain
    const glyphPx = ppw * geo.provScale; // province size in pixels at this level
    if (this.detail !== 'off' && glyphPx > 26) {
      const reduced = this.detail === 'reduced';
      for (const p of provs) {
        const t = this.terrainOf(p.id);
        if (t === 'plains' && (reduced || glyphPx < 150)) continue;
        if (reduced && (t === 'steppe' || t === 'marsh')) continue;
        const gl = geo.glyphs(p.id, t);
        const step = (glyphPx < 60 ? 4 : glyphPx < 100 ? 3 : 2) * (reduced ? 2 : 1);
        drawMotifs(g, t, gl, step, px);
      }
    }
    // ranges are drawn at every level: they are strategic barriers
    if (this.detail !== 'off') {
      for (const { i } of peaks) drawMotifs(g, 'range', geo.peakGlyphs(i), glyphPx < 40 ? 3 : 2, px);
    }

    // rivers (wider downstream)
    if (geo.riverEdges.length) {
      g.strokeStyle = PALETTE.river;
      g.globalAlpha = 0.95;
      for (const e of geo.riverEdges) {
        if (!inRect(e.bbox)) continue;
        g.lineWidth = Math.max(1.3 * px, (1.6 + e.river * 1.6) * S);
        g.stroke(e.path);
      }
      g.globalAlpha = 1;
    }

    // the coastline: one fine blue-grey line
    g.strokeStyle = PALETTE.coastInk;
    g.lineWidth = Math.max(1 * px, 1.2 * S);
    g.stroke(coast);
    g.lineWidth = Math.max(0.8 * px, 0.9 * S);
    g.stroke(shore);
  }

  /** A pack surface texture over the current clip, one texture pixel per device pixel. */
  private texture(g: CanvasRenderingContext2D, name: string, alpha: number, px: number, rect: [number, number, number, number]): void {
    const img = spriteImage(name);
    if (!img) return;
    const pat = g.createPattern(img, 'repeat');
    if (!pat) return;
    pat.setTransform(new DOMMatrix([px, 0, 0, px, 0, 0]));
    g.save();
    g.globalAlpha = alpha;
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = pat;
    g.fillRect(rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]);
    g.restore();
  }
}

// ── terrain motifs, in the construction of the pack's terrain/*.svg ──

const FIR = new Path2D('M0-14l-6 9h3l-7 10h8v5h4V5h8L3-5h3z');
const PEAK = new Path2D('M-17 12L0-20l20 32z');
const PEAK_HATCH = new Path2D('M0-20l-4 15 6 5-1 12m-5-17-8 13m11-12 9 12m-5-14 7 14');
const HILL = new Path2D('M-22 6q15-31 34 0M-7 14q14-8 25 0');
const REEDS = new Path2D('M-14 8h23M-6 5v-18m0 9-6-5m6 0 5-8M6 8v-14m0 6 5-7');
const FIELD = new Path2D('M-19 1l20-9 18 11-20 8zM-14 3l19-9M-9 5l19-8M-6-4l18 10');
const TUFT = new Path2D('M0 0l-4-8M0 0l0.5-9M0 0l4.5-7');

/** Draw one motif per `step` glyphs (glyphs are scattered and sorted by y, so the pattern never rows up). */
function drawMotifs(g: CanvasRenderingContext2D, terrain: string, list: Glyph[], step: number, px: number): void {
  const at = (q: Glyph, unit: number, draw: () => void) => {
    g.save();
    g.translate(q.x, q.y);
    const k = (q.s * unit) / 40;
    g.scale(k, k);
    g.lineWidth = Math.max(px / k, 1.1);
    draw();
    g.restore();
  };
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const pick = (i: number, q: Glyph) => i % step === 0 || (step > 1 && q.v > 0.93);
  if (terrain === 'forest') {
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!pick(i, q)) continue;
      at(q, 1.5 + q.v * 0.4, () => {
        g.fillStyle = '#68775e';
        g.strokeStyle = '#455b4d';
        for (const [dx, dy, k] of q.v > 0.5 ? [[-7, 2, 0.8], [6, -2, 1], [14, 5, 0.85]] : [[-4, 0, 0.9], [8, 3, 0.8]]) {
          g.save();
          g.translate(dx, dy);
          g.scale(k, k);
          g.fill(FIR);
          g.lineWidth /= k;
          g.stroke(FIR);
          g.restore();
        }
      });
    }
    return;
  }
  if (terrain === 'hills') {
    g.strokeStyle = '#8a8b72';
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!pick(i, q)) continue;
      at(q, 1.2 + q.v * 0.4, () => g.stroke(HILL));
    }
    return;
  }
  if (terrain === 'mountains' || terrain === 'range') {
    const dense = terrain === 'range';
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!dense && !pick(i, q)) continue;
      if (dense && i % step !== 0) continue;
      at(q, (dense ? 1.05 : 1.15) + q.v * 0.3, () => {
        g.fillStyle = '#d9d0ba';
        g.strokeStyle = dense ? '#86857a' : '#7b7b6b';
        g.fill(PEAK);
        g.stroke(PEAK);
        g.strokeStyle = '#92907b';
        g.lineWidth *= 0.8;
        g.stroke(PEAK_HATCH);
      });
    }
    return;
  }
  if (terrain === 'marsh') {
    g.strokeStyle = '#68867f';
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!pick(i, q)) continue;
      at(q, 1.1 + q.v * 0.3, () => g.stroke(REEDS));
    }
    return;
  }
  if (terrain === 'steppe') {
    g.strokeStyle = '#a4976a';
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (!pick(i, q)) continue;
      at(q, 1.3, () => {
        g.stroke(TUFT);
        g.save();
        g.translate(9, 4);
        g.stroke(TUFT);
        g.restore();
      });
    }
    return;
  }
  if (terrain === 'plains') {
    g.strokeStyle = '#819074';
    g.globalAlpha = 0.7;
    for (let i = 0; i < list.length; i++) {
      const q = list[i];
      if (i % (step * 2) !== 0) continue;
      at(q, 1.3, () => g.stroke(FIELD));
    }
    g.globalAlpha = 1;
  }
}
