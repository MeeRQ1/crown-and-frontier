// The static geography layer: sea, coasts, parchment land, terrain art,
// mountain ranges, lakes and rivers. It never changes during a campaign, so it
// is rendered once into cached tiles (plus a whole-world overview used while
// tiles are still being drawn) and composited under the political layers.

import type { GeoIndex, Glyph } from './geometry';

export type TerrainDetail = 'full' | 'reduced' | 'off';

export const PALETTE = {
  seaDeep: '#2c5163',
  seaMid: '#3b6778',
  seaShallow: '#50808f',
  waterLine: '#86aab5',
  lake: '#4f7f8f',
  river: '#44778c',
  paper: '#ece3cc',
  paperShade: '#ddd1b3',
  ink: '#352f27',
  coastInk: '#2a3a40',
  peakBase: '#d3c6a8',
  terrainTint: {
    plains: '#ede4c8',
    steppe: '#e9dcae',
    forest: '#d7dcb6',
    hills: '#e3d4ae',
    marsh: '#d2d8c2',
    mountains: '#d8ccb2',
  } as Record<string, string>,
};

const TILE = 256;

interface Tile {
  canvas: HTMLCanvasElement;
  used: number;
}

let grain: HTMLCanvasElement | null = null;
function grainCanvas(): HTMLCanvasElement {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const img = g.createImageData(128, 128);
  let s = 12345;
  const r = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 150 + r() * 105;
    img.data[i] = v;
    img.data[i + 1] = v * 0.96;
    img.data[i + 2] = v * 0.88;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // a few soft fibres
  g.globalAlpha = 0.08;
  g.strokeStyle = '#6b5a3e';
  for (let i = 0; i < 26; i++) {
    g.beginPath();
    const x = r() * 128;
    const y = r() * 128;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + r() * 20 - 10, y + r() * 20 - 10, x + r() * 40 - 20, y + r() * 40 - 20);
    g.stroke();
  }
  grain = c;
  return c;
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

    // sea with shallows fading from the coast
    g.fillStyle = PALETTE.seaDeep;
    g.fillRect(rx0, ry0, rx1 - rx0, ry1 - ry0);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const shallows: Array<[number, string, number]> = [
      [150 * S, PALETTE.seaMid, 0.45],
      [90 * S, PALETTE.seaMid, 0.55],
      [48 * S, PALETTE.seaShallow, 0.55],
    ];
    for (const [w, col, a] of shallows) {
      g.globalAlpha = a;
      g.strokeStyle = col;
      g.lineWidth = w;
      g.stroke(coast);
    }
    g.globalAlpha = 1;
    // engraved water lines (rings at fixed distances from the shore)
    if (ppw * S > 0.06) {
      for (const d of [34, 22, 12]) {
        const dd = d * S;
        g.strokeStyle = PALETTE.waterLine;
        g.globalAlpha = 0.5 - d / 120;
        g.lineWidth = dd * 2;
        g.stroke(coast);
        g.globalAlpha = 1;
        g.strokeStyle = d === 34 ? PALETTE.seaMid : PALETTE.seaShallow;
        g.lineWidth = Math.max(0, dd * 2 - Math.max(1.1 * px, 1.4 * S));
        g.stroke(coast);
      }
      g.globalAlpha = 1;
    }

    // land
    g.fillStyle = PALETTE.paper;
    g.fill(land);
    // faint terrain tints by province
    for (const p of provs) {
      const tint = PALETTE.terrainTint[this.terrainOf(p.id)];
      if (!tint || tint === PALETTE.terrainTint.plains) continue;
      g.fillStyle = tint;
      g.fill(p.path);
    }
    // mountain ranges (impassable)
    g.fillStyle = PALETTE.peakBase;
    for (const { w } of peaks) g.fill(w.path);
    // paper grain over land
    const pat = g.createPattern(grainCanvas(), 'repeat');
    if (pat) {
      pat.setTransform(new DOMMatrix([px, 0, 0, px, 0, 0]));
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.globalAlpha = 0.16;
      g.fillStyle = pat;
      g.fill(land);
      g.restore();
    }
    // lakes
    for (const l of geo.lakes) {
      if (!inRect(l.bbox)) continue;
      g.fillStyle = PALETTE.lake;
      g.fill(l.path);
    }
    if (ppw * S > 0.06) {
      g.save();
      for (const l of geo.lakes) {
        if (!inRect(l.bbox)) continue;
        g.save();
        g.clip(l.path);
        g.strokeStyle = PALETTE.waterLine;
        g.globalAlpha = 0.45;
        g.lineWidth = 16 * S;
        g.stroke(l.path);
        g.strokeStyle = PALETTE.lake;
        g.globalAlpha = 1;
        g.lineWidth = 16 * S - Math.max(1.1 * px, 1.4 * S);
        g.stroke(l.path);
        g.restore();
      }
      g.restore();
    }

    // terrain art
    const glyphPx = ppw * geo.provScale; // province size in pixels at this level
    if (this.detail !== 'off' && glyphPx > 26) {
      const reduced = this.detail === 'reduced';
      for (const p of provs) {
        const t = this.terrainOf(p.id);
        if (t === 'plains' && (reduced || glyphPx < 120)) continue;
        if (reduced && (t === 'steppe' || t === 'marsh')) continue;
        const gl = geo.glyphs(p.id, t);
        const step = glyphPx < 60 ? 3 : glyphPx < 100 ? 2 : 1;
        drawGlyphs(g, t, gl, step * (reduced ? 2 : 1), px);
      }
    }
    // ranges are drawn at every level: they are strategic barriers
    if (this.detail !== 'off') {
      for (const { i } of peaks) drawGlyphs(g, 'range', geo.peakGlyphs(i), glyphPx < 40 ? 2 : 1, px);
    }

    // rivers (wider downstream)
    if (geo.riverEdges.length) {
      g.strokeStyle = PALETTE.river;
      for (const e of geo.riverEdges) {
        if (!inRect(e.bbox)) continue;
        g.lineWidth = Math.max(1.1 * px, (2.2 + e.river * 2.2) * S);
        g.stroke(e.path);
      }
    }

    // inked shoreline
    g.strokeStyle = PALETTE.coastInk;
    g.globalAlpha = 0.85;
    g.lineWidth = Math.max(1 * px, 1.8 * S);
    g.stroke(coast);
    g.lineWidth = Math.max(0.8 * px, 1.2 * S);
    g.stroke(shore);
    g.globalAlpha = 1;
  }
}

/** Terrain symbols in the manner of an engraved atlas. */
function drawGlyphs(g: CanvasRenderingContext2D, terrain: string, list: Glyph[], step: number, px: number): void {
  const ink = PALETTE.ink;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (terrain === 'forest') {
    // canopy dots with a shadow, drawn in two passes for speed
    g.fillStyle = 'rgba(66, 86, 52, 0.16)';
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      g.moveTo(q.x + q.s * 0.62, q.y + q.s * 0.12);
      g.arc(q.x + q.s * 0.12, q.y + q.s * 0.12, q.s * 0.5, 0, Math.PI * 2);
    }
    g.fill();
    g.fillStyle = 'rgba(116, 142, 88, 0.42)';
    g.strokeStyle = 'rgba(52, 60, 40, 0.34)';
    g.lineWidth = Math.max(0.7 * px, list[0]?.s * 0.08 || 0);
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      g.moveTo(q.x + q.s * 0.5, q.y);
      g.arc(q.x, q.y, q.s * 0.5, 0, Math.PI * 2);
    }
    g.fill();
    g.stroke();
    return;
  }
  if (terrain === 'hills') {
    g.strokeStyle = ink;
    g.globalAlpha = 0.5;
    g.lineWidth = Math.max(0.8 * px, (list[0]?.s ?? 0) * 0.08);
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      const w = q.s * (0.8 + q.v * 0.4);
      g.moveTo(q.x - w * 0.5, q.y + w * 0.12);
      g.quadraticCurveTo(q.x - w * 0.1, q.y - w * 0.42, q.x + w * 0.5, q.y + w * 0.12);
      // shading strokes on the lee side
      g.moveTo(q.x + w * 0.12, q.y - w * 0.08);
      g.lineTo(q.x + w * 0.2, q.y + w * 0.08);
      g.moveTo(q.x + w * 0.28, q.y - w * 0.01);
      g.lineTo(q.x + w * 0.34, q.y + w * 0.1);
    }
    g.stroke();
    g.globalAlpha = 1;
    return;
  }
  if (terrain === 'mountains' || terrain === 'range') {
    const shadow = terrain === 'range' ? 'rgba(112, 96, 74, 0.62)' : 'rgba(118, 104, 84, 0.45)';
    const lw = Math.max(0.8 * px, (list[0]?.s ?? 0) * 0.055);
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      const w = q.s * (0.85 + q.v * 0.35);
      const apx = q.x + (q.v - 0.5) * w * 0.25;
      const apy = q.y - w * 0.55;
      const lx = q.x - w * 0.55;
      const rx = q.x + w * 0.55;
      const by = q.y + w * 0.3;
      // lit face
      g.fillStyle = terrain === 'range' ? '#e2d4b4' : '#e9dec3';
      g.beginPath();
      g.moveTo(lx, by);
      g.lineTo(apx, apy);
      g.lineTo(rx, by);
      g.closePath();
      g.fill();
      // shadowed face
      g.fillStyle = shadow;
      g.beginPath();
      g.moveTo(apx, apy);
      g.lineTo(rx, by);
      g.lineTo(q.x + w * 0.08, by);
      g.closePath();
      g.fill();
      // ridge line
      g.strokeStyle = 'rgba(58, 50, 40, 0.72)';
      g.lineWidth = lw;
      g.beginPath();
      g.moveTo(lx, by);
      g.lineTo(apx, apy);
      g.lineTo(rx, by);
      g.stroke();
      if (terrain === 'range' && q.v > 0.82) {
        // snow on the higher peaks
        g.fillStyle = 'rgba(250, 248, 240, 0.8)';
        g.beginPath();
        g.moveTo(apx, apy);
        g.lineTo(apx - w * 0.14, apy + w * 0.22);
        g.lineTo(apx + w * 0.02, apy + w * 0.16);
        g.lineTo(apx + w * 0.16, apy + w * 0.24);
        g.closePath();
        g.fill();
      }
    }
    return;
  }
  if (terrain === 'marsh') {
    g.strokeStyle = 'rgba(58, 84, 88, 0.55)';
    g.lineWidth = Math.max(0.7 * px, (list[0]?.s ?? 0) * 0.07);
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      const w = q.s;
      g.moveTo(q.x - w * 0.5, q.y);
      g.lineTo(q.x + w * 0.5, q.y);
      g.moveTo(q.x - w * 0.3, q.y + w * 0.22);
      g.lineTo(q.x + w * 0.25, q.y + w * 0.22);
      // reeds
      g.moveTo(q.x - w * 0.1, q.y);
      g.lineTo(q.x - w * 0.16, q.y - w * 0.38);
      g.moveTo(q.x + w * 0.02, q.y);
      g.lineTo(q.x + w * 0.04, q.y - w * 0.46);
      g.moveTo(q.x + w * 0.14, q.y);
      g.lineTo(q.x + w * 0.22, q.y - w * 0.34);
    }
    g.stroke();
    return;
  }
  if (terrain === 'steppe') {
    g.strokeStyle = 'rgba(120, 104, 60, 0.5)';
    g.lineWidth = Math.max(0.7 * px, (list[0]?.s ?? 0) * 0.07);
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      const w = q.s;
      g.moveTo(q.x, q.y);
      g.lineTo(q.x - w * 0.22, q.y - w * 0.42);
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + w * 0.02, q.y - w * 0.5);
      g.moveTo(q.x, q.y);
      g.lineTo(q.x + w * 0.24, q.y - w * 0.4);
    }
    g.stroke();
    return;
  }
  if (terrain === 'plains') {
    // furrowed fields, faint
    g.strokeStyle = 'rgba(120, 104, 70, 0.22)';
    g.lineWidth = Math.max(0.6 * px, (list[0]?.s ?? 0) * 0.05);
    g.beginPath();
    for (let i = 0; i < list.length; i += step) {
      const q = list[i];
      const w = q.s;
      const a = q.v * Math.PI;
      const dx = Math.cos(a) * w * 0.5;
      const dy = Math.sin(a) * w * 0.5;
      for (let k = -1; k <= 1; k++) {
        const ox = -Math.sin(a) * k * w * 0.18;
        const oy = Math.cos(a) * k * w * 0.18;
        g.moveTo(q.x - dx + ox, q.y - dy + oy);
        g.lineTo(q.x + dx + ox, q.y + dy + oy);
      }
    }
    g.stroke();
  }
}
