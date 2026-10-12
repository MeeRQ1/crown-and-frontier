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

/** A canvas just painted is rasterised when first drawn: draw it into one pixel, so that cost is paid (and timed) now. */
let probe: CanvasRenderingContext2D | null = null;
function rasterise(c: HTMLCanvasElement): void {
  if (!probe) {
    const p = document.createElement('canvas');
    p.width = 1;
    p.height = 1;
    probe = p.getContext('2d');
  }
  probe?.drawImage(c, 0, 0, 1, 1);
}

interface Tile {
  canvas: HTMLCanvasElement;
  used: number;
}

export class BaseMap {
  private tiles = new Map<string, Tile>();
  private overview: HTMLCanvasElement | null = null;
  private overviewScale = 1;
  private clock = 0;
  /** the renderer's frame counter: tiles used in the current frame are never evicted */
  private frame = 0;
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
    this.scaled = null;
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
    this.beginFrame();
    return this.drawRegion(ctx, zoom * dpr, offX * dpr, offY * dpr, [0, 0, vw * dpr, vh * dpr], budgetMs);
  }

  /**
   * Draw the base map over a rectangle of a canvas, in device pixels, where a world
   * point lands at `scale · w + (ax, ay)`. Renders missing tiles while the frame's
   * tile rendering (see beginFrame) is within a time budget; returns false if some
   * tiles are still pending (redraw soon), and lists where they go in `missing`.
   */
  drawRegion(ctx: CanvasRenderingContext2D, scale: number, ax: number, ay: number, rect: [number, number, number, number], budgetMs = 10, missing?: Array<[number, number, number, number]>): boolean {
    const [rx0, ry0, rx1, ry1] = rect;
    const b = this.geo.bounds;
    const ov = this.getOverview();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    // tiles at the level just above the needed resolution
    const level = Math.ceil(Math.log2(scale * 16));
    const ppw = BaseMap.ppw(level);
    if (scale <= this.overviewScale || ppw <= this.overviewScale * 1.05) {
      // the whole-world overview has all the detail this scale shows (it is painted
      // the same way as the tiles, at its own scale): resampled once per scale (a
      // high-quality downscale of it costs ~16 ms), then copied
      ctx.drawImage(this.scaledOverview(scale), Math.round(ax + b.minX * scale), Math.round(ay + b.minY * scale));
      ctx.restore();
      return true;
    }
    const tw = TILE / ppw; // world units per tile
    const x0 = (rx0 - ax) / scale;
    const y0 = (ry0 - ay) / scale;
    const x1 = (rx1 - ax) / scale;
    const y1 = (ry1 - ay) / scale;
    const tx0 = Math.floor(Math.max(x0, b.minX) / tw);
    const ty0 = Math.floor(Math.max(y0, b.minY) / tw);
    const tx1 = Math.floor(Math.min(x1, b.maxX) / tw);
    const ty1 = Math.floor(Math.min(y1, b.maxY) / tw);
    // nearest tiles first so the centre sharpens first
    const cxT = (tx0 + tx1) / 2;
    const cyT = (ty0 + ty1) / 2;
    const order: Array<[number, number]> = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) order.push([tx, ty]);
    order.sort((p, q) => Math.hypot(p[0] - cxT, p[1] - cyT) - Math.hypot(q[0] - cxT, q[1] - cyT));
    // Render missing tiles, nearest first, within the budget, which counts the time
    // spent rendering a tile and rasterising it (forced here with a one-pixel draw),
    // not the time spent drawing cached tiles (that can exceed the budget on a large
    // screen, and must not starve the missing ones); one is always rendered, so the
    // map converges.
    let complete = true;
    const holes: Array<[number, number, number, number]> = [];
    const drawScale = scale / ppw;
    const size = TILE * drawScale;
    const ready = new Set<string>();
    for (const [tx, ty] of order) {
      const key = `${level}|${tx}|${ty}`;
      let t = this.tiles.get(key);
      if (!t) {
        if (this.frameRendered > 0 && this.frameSpent > budgetMs) {
          complete = false;
          const sx = tx * tw * scale + ax;
          const sy = ty * tw * scale + ay;
          holes.push([sx, sy, sx + size, sy + size]);
          continue;
        }
        const t1 = performance.now();
        t = { canvas: this.renderTile(level, tx, ty), used: 0 };
        rasterise(t.canvas);
        this.frameSpent += performance.now() - t1;
        this.frameRendered++;
        this.tiles.set(key, t);
      }
      t.used = this.frame;
      ready.add(key);
    }
    // then draw them row by row: tiles overlap by a pixel to hide seams, and a fixed
    // order decides those pixels the same way however the region is cut into pieces
    ctx.imageSmoothingEnabled = true;
    for (let ty = ty0; ty <= ty1; ty++)
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = `${level}|${tx}|${ty}`;
        if (!ready.has(key)) continue;
        const sx = tx * tw * scale + ax;
        const sy = ty * tw * scale + ay;
        // whole pixels from floor and ceil of both edges, so a tile is drawn the same
        // wherever the origin lies (with `sx % 1`, negative left of the origin, it was
        // a pixel narrower there)
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        ctx.drawImage(this.tiles.get(key)!.canvas, x0, y0, Math.ceil(sx + size) + 1 - x0, Math.ceil(sy + size) + 1 - y0);
      }
    // where tiles are still to come, the overview stands in (blurred, for a few frames)
    if (holes.length) {
      ctx.save();
      ctx.beginPath();
      for (const h of holes) ctx.rect(h[0], h[1], h[2] - h[0], h[3] - h[1]);
      ctx.clip();
      ctx.drawImage(ov, ax + b.minX * scale, ay + b.minY * scale, (b.maxX - b.minX) * scale, (b.maxY - b.minY) * scale);
      ctx.restore();
      missing?.push(...holes);
    }
    ctx.restore();
    this.evict();
    return complete;
  }

  private scaled: { scale: number; canvas: HTMLCanvasElement } | null = null;
  /** The overview resampled to a scale (pixels per world unit), kept for the last scale asked. */
  private scaledOverview(scale: number): HTMLCanvasElement {
    const ov = this.getOverview();
    if (Math.abs(scale - this.overviewScale) < 1e-9) return ov;
    if (this.scaled?.scale === scale) return this.scaled.canvas;
    const b = this.geo.bounds;
    const c = this.scaled?.canvas ?? document.createElement('canvas');
    c.width = Math.max(1, Math.round((b.maxX - b.minX) * scale));
    c.height = Math.max(1, Math.round((b.maxY - b.minY) * scale));
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(ov, 0, 0, c.width, c.height);
    this.scaled = { scale, canvas: c };
    return c;
  }

  /** Start a frame: tiles drawn from now on count as in use until the next one. */
  beginFrame(): void {
    this.frame = ++this.clock;
    this.frameSpent = 0;
    this.frameRendered = 0;
  }
  /** time spent rendering tiles this frame, and how many: the budget is the frame's, however many regions it paints */
  private frameSpent = 0;
  private frameRendered = 0;

  /**
   * Keep at most about 320 tiles (80 MB), dropping the least recently used, but
   * never one drawn in the current frame: a large or high-density screen needs
   * several hundred tiles at once, and evicting those would re-render them every frame.
   */
  private evict(): void {
    const max = 320;
    if (this.tiles.size <= max) return;
    const arr = [...this.tiles.entries()].filter((e) => e[1].used < this.frame).sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < Math.min(arr.length, this.tiles.size - max); i++) this.tiles.delete(arr[i][0]);
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
