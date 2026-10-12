// The map editor's canvas: a flat, fast drawing of the map being edited
// (realms, regions, terrain, deposits or sea zones), with borders, rivers,
// straits, ports, capitals, the selection and validator highlights. Uses the
// game's geometry index (outlines, picking) and camera (pan and zoom), but not
// the campaign renderer, which needs a running game.

import { drawnFromPackage } from '../../maps/convert';
import type { MapPackage } from '../../maps/format';
import { Camera } from '../map/camera';
import { GeoIndex, pairKey } from '../map/geometry';
import { PALETTE } from '../map/basemap';

export type EditorLayer = 'realms' | 'regions' | 'terrain' | 'deposits' | 'seas';

export const DEPOSIT_COLORS: Record<string, string> = { food: '#9bb35a', coal: '#4a4a4a', iron: '#9a5b3c', oil: '#2f2f55', rubber: '#3f7a52', nitrates: '#c9b458' };
export const DEPOSIT_LETTER: Record<string, string> = { food: 'F', coal: 'C', iron: 'I', oil: 'O', rubber: 'R', nitrates: 'N' };
const TERRAIN_FILL: Record<string, string> = { plains: '#d9cf8f', steppe: '#d8b86f', forest: '#7f9e5f', hills: '#b39a6a', marsh: '#87a59a', mountains: '#8f8478' };

/** A stable, distinct colour for an id (regions, sea zones). */
export function hashColor(id: string, sat = 45, light = 62): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return `hsl(${(h >>> 0) % 360}, ${sat}%, ${light}%)`;
}

export class EditorView {
  readonly ctx: CanvasRenderingContext2D;
  geo!: GeoIndex;
  camera!: Camera;
  pkg!: MapPackage;
  layer: EditorLayer = 'realms';
  selected: string | null = null;
  /** first province of a two-click tool (routes, merge) */
  pending: string | null = null;
  hover: string | null = null;
  /** provinces or zones named by a validator finding */
  flagged = new Set<string>();
  /** the sea zone being inspected */
  selectedZone: string | null = null;
  /**
   * Provinces painted by the stroke in progress: drawn over the cached scene, which
   * is redrawn once when the stroke ends (a full redraw per province is slow on a
   * large map).
   */
  painting: Set<string> | null = null;
  private geometryRef: unknown = null;
  /** where each coastal province's port is drawn: the middle of its longest sea shore */
  private portSpots = new Map<string, { x: number; y: number }>();
  private dpr = 1;
  private dirty = true;
  private raf = 0;
  private alive = true;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** Shows a package; the outlines are rebuilt only when its drawn geometry changed. */
  setMap(pkg: MapPackage): void {
    this.pkg = pkg;
    // an edit: owners, regions, colours or rivers may have changed
    this.version++;
    if (pkg.geometry !== this.geometryRef) {
      const sameBounds = this.geo && JSON.stringify(this.geo.bounds) === JSON.stringify(pkg.geometry.bounds);
      this.geo = new GeoIndex(drawnFromPackage(pkg));
      this.geometryRef = pkg.geometry;
      this.portSpots.clear();
      if (!sameBounds || !this.camera) {
        this.camera = new Camera(this.geo.bounds, this.geo.provScale);
        this.resize();
      }
    }
    this.invalidate();
  }

  resize(): void {
    const w = this.canvas.clientWidth || 800;
    const h = this.canvas.clientHeight || 600;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.camera?.setViewport(w, h);
    this.invalidate();
  }

  invalidate(): void {
    this.dirty = true;
    if (!this.raf && this.alive) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
  }

  private frame(now: number): void {
    this.raf = 0;
    const moving = this.camera?.update(now) ?? false;
    if (this.dirty || moving) {
      this.dirty = false;
      this.draw();
    }
    if (moving) this.invalidate();
  }

  /** Province (or, failing that, sea zone) under a screen point. */
  pick(sx: number, sy: number): { province: string | null; zone: string | null } {
    const w = this.camera.toWorld(sx, sy);
    const province = this.geo.provinceAt(w.x, w.y);
    return { province, zone: province ? null : this.geo.zoneAt(w.x, w.y) };
  }

  focus(id: string): void {
    const p = this.geo.provs.get(id);
    if (p) {
      this.camera.centerOn(p.lx, p.ly, Math.max(this.camera.zoom, this.camera.zoomForProvincePx(140)));
      this.invalidate();
      return;
    }
    const z = this.geo.zoneAnchors.get(id);
    if (z) this.camera.centerOn(z.x, z.y, Math.max(this.camera.zoom, this.camera.zoomForProvincePx(60)));
    this.invalidate();
  }

  private portSpot(id: string): { x: number; y: number } | null {
    const hit = this.portSpots.get(id);
    if (hit) return hit;
    let best: number[] | null = null;
    let bestLen = 0;
    for (const e of this.geo.edgesOf.get(id) ?? []) {
      if (!e.coast || e.b !== '~sea') continue;
      let len = 0;
      for (let i = 2; i < e.pts.length; i += 2) len += Math.hypot(e.pts[i] - e.pts[i - 2], e.pts[i + 1] - e.pts[i - 1]);
      if (len > bestLen) (bestLen = len), (best = e.pts);
    }
    if (!best) return null;
    const p = this.geo.provs.get(id)!;
    const k = Math.floor(best.length / 4) * 2;
    // a little inside the shore, towards the province's centre
    const spot = { x: best[k] + (p.lx - best[k]) * 0.18, y: best[k + 1] + (p.ly - best[k + 1]) * 0.18 };
    this.portSpots.set(id, spot);
    return spot;
  }

  private fillOf(id: string): string {
    const p = this.provIndex.get(id);
    if (!p) return PALETTE.paper;
    switch (this.layer) {
      case 'realms':
        return p.owner ? (this.colorIndex.get(p.owner) ?? '#888') : PALETTE.paper;
      case 'regions':
        return hashColor(p.region);
      case 'terrain':
        return TERRAIN_FILL[p.terrain] ?? PALETTE.paper;
      case 'deposits':
        return PALETTE.terrainTint[p.terrain] ?? PALETTE.paper;
      case 'seas':
        return PALETTE.terrainTint[p.terrain] ?? PALETTE.paper;
    }
  }

  private provIndex = new Map<string, MapPackage['provinces'][number]>();
  private colorIndex = new Map<string, string>();
  /** bumped by every setMap (an edit); part of the content key */
  private version = 0;
  private bordersKey = '';
  private borders: { thin: Path2D; thick: Path2D } = { thin: new Path2D(), thick: new Path2D() };
  /** the map drawn once, a little larger than the screen, and copied while the view only pans */
  private scene: { canvas: HTMLCanvasElement; key: string; offX: number; offY: number; m: number } | null = null;

  /**
   * What the drawing shows, as a string: an edit made without setMap (a paint
   * stroke changes the package as it goes) still changes it. About a millisecond
   * on the largest map.
   */
  private contentKey(): string {
    const { pkg } = this;
    let s = `${this.version}|${this.layer}|${pkg.provinces.length}|${pkg.rivers.length}|${pkg.straits.length}|${pkg.seaZones.length}|`;
    for (const p of pkg.provinces) s += `${p.id},${p.owner},${p.region},${p.terrain},${p.resource},${p.port},${p.name};`;
    for (const n of pkg.nations) s += `${n.id},${n.color},${n.capital};`;
    return s;
  }

  /** The province and colour indexes. */
  private ensureIndexes(): void {
    const { pkg } = this;
    this.provIndex = new Map(pkg.provinces.map((p) => [p.id, p]));
    this.colorIndex = new Map(pkg.nations.map((n) => [n.id, n.color]));
  }

  /** The border paths, when owners or regions changed. */
  private ensureBorders(): void {
    const { geo, pkg } = this;
    const key = `${this.layer}|${this.geometryRef === pkg.geometry}|${this.layer === 'regions' ? pkg.provinces.map((p) => p.region).join() : this.layer === 'realms' ? pkg.provinces.map((p) => p.owner).join() : ''}|${this.version}`;
    if (key === this.bordersKey) return;
    this.bordersKey = key;
    // province borders, and realm or region borders
    const thin = new Path2D();
    const thick = new Path2D();
    for (const e of geo.edges) {
      if (e.coast) continue;
      const a = this.provIndex.get(e.a);
      const b = this.provIndex.get(e.b);
      const differ = this.layer === 'regions' ? a?.region !== b?.region : this.layer === 'realms' ? a?.owner !== b?.owner : false;
      (differ ? thick : thin).addPath(e.path);
    }
    this.borders = { thin, thick };
  }

  draw(): void {
    const { ctx, camera: cam, geo, pkg } = this;
    if (!pkg || !geo) return;
    this.ensureIndexes();
    const W = this.canvas.width;
    const H = this.canvas.height;
    const dpr = this.dpr;
    // the scene: drawn again when its content, the zoom or the size changes, or when
    // a pan leaves its margin; otherwise copied at the new offset
    let sc = this.scene;
    // while a stroke is painted, the scene is kept (if the view did not change) and the painted provinces drawn over it
    const view = `${cam.zoom}|${dpr}|${W}x${H}`;
    const key = this.painting && sc && sc.key.endsWith(`|${view}`) ? sc.key : `${this.contentKey()}|${view}`;
    const bx = sc ? Math.round(dpr * (cam.offX - sc.offX)) : 0;
    const by = sc ? Math.round(dpr * (cam.offY - sc.offY)) : 0;
    if (!sc || sc.key !== key || Math.abs(bx) > sc.m || Math.abs(by) > sc.m) {
      const m = Math.round(Math.min(W, H) * 0.25);
      const canvas = sc && sc.canvas.width === W + 2 * m && sc.canvas.height === H + 2 * m ? sc.canvas : document.createElement('canvas');
      canvas.width = W + 2 * m;
      canvas.height = H + 2 * m;
      sc = this.scene = { canvas, key, offX: cam.offX, offY: cam.offY, m };
      this.ensureBorders();
      this.drawScene(canvas.getContext('2d')!, cam.offX + m / dpr, cam.offY + m / dpr, m / dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(dpr * (cam.offX - sc.offX));
    const dy = Math.round(dpr * (cam.offY - sc.offY));
    ctx.drawImage(sc.canvas, sc.m - dx, sc.m - dy, W, H, 0, 0, W, H);
    this.drawOverlays();
  }

  /**
   * Everything but the highlights, for a camera offset (CSS pixels) and a margin
   * around the screen, into the scene canvas.
   */
  private drawScene(ctx: CanvasRenderingContext2D, offX: number, offY: number, margin: number): void {
    const { camera: cam, geo, pkg } = this;
    const z = cam.zoom;
    const px = 1 / z;
    const dpr = this.dpr;
    const toScreen = (x: number, y: number) => ({ x: x * z + offX, y: y * z + offY });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.seaMid;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * offX, dpr * offY);
    const pad = 40 + margin;
    const x0 = (-pad - offX + margin) / z;
    const y0 = (-pad - offY + margin) / z;
    const x1 = (cam.vw + pad - offX + margin) / z;
    const y1 = (cam.vh + pad - offY + margin) / z;
    const visible = geo.provincesIn(x0, y0, x1, y1);

    // sea zones
    if (this.layer === 'seas') {
      for (const id of geo.zoneIds) {
        const path = geo.zonePath(id);
        if (!path) continue;
        ctx.fillStyle = hashColor(id, 35, 42);
        ctx.fill(path);
      }
      ctx.strokeStyle = 'rgba(220, 235, 240, 0.55)';
      ctx.lineWidth = 1.5 * px;
      ctx.stroke(geo.zoneBorders);
    }
    for (const l of geo.lakes) {
      ctx.fillStyle = PALETTE.lake;
      ctx.fill(l.path);
    }
    for (const b of geo.beyond) {
      ctx.fillStyle = PALETTE.beyond;
      ctx.fill(b.path);
    }
    // provinces
    for (const p of visible) {
      ctx.fillStyle = this.fillOf(p.id);
      ctx.fill(p.path);
    }
    for (const pk of geo.peaks) {
      ctx.fillStyle = PALETTE.peakBase;
      ctx.fill(pk.path);
    }
    // province borders, then realm or region borders
    const { thin, thick } = this.borders;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(53, 47, 39, 0.35)';
    ctx.lineWidth = 0.8 * px;
    ctx.stroke(thin);
    ctx.strokeStyle = 'rgba(40, 32, 24, 0.9)';
    ctx.lineWidth = 2.2 * px;
    ctx.stroke(thick);
    ctx.strokeStyle = PALETTE.coastInk;
    ctx.lineWidth = 1.4 * px;
    ctx.stroke(geo.coastPath);
    // rivers (from the package, so edits show at once)
    ctx.strokeStyle = PALETTE.river;
    ctx.lineWidth = 2.6 * px;
    ctx.lineCap = 'round';
    for (const [a, b] of pkg.rivers) {
      for (const e of geo.edgesOf.get(a) ?? []) if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) ctx.stroke(e.path);
    }
    // straits
    ctx.setLineDash([6 * px, 5 * px]);
    ctx.strokeStyle = 'rgba(250, 240, 210, 0.9)';
    ctx.lineWidth = 2 * px;
    for (const [a, b] of pkg.straits) {
      const pa = geo.provs.get(a);
      const pb = geo.provs.get(b);
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.lx, pa.ly);
      ctx.lineTo(pb.lx, pb.ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // marks drawn at screen size
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const caps = new Set(pkg.nations.map((n) => n.capital));
    const showNames = cam.provincePx > 70;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of visible) {
      const def = this.provIndex.get(p.id);
      if (!def) continue;
      const s = toScreen(p.lx, p.ly);
      if (caps.has(p.id)) star(ctx, s.x, s.y - (showNames ? 10 : 0), 6);
      const spot = def.port ? this.portSpot(p.id) : null;
      if (spot) {
        const q = toScreen(spot.x, spot.y);
        ctx.fillStyle = '#1d3f57';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8f1f5';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      if (this.layer === 'deposits' && def.resource) {
        ctx.fillStyle = DEPOSIT_COLORS[def.resource] ?? '#333';
        ctx.beginPath();
        ctx.arc(s.x, s.y + (showNames ? 9 : 0), 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 9px system-ui, sans-serif';
        ctx.fillText(DEPOSIT_LETTER[def.resource] ?? '?', s.x, s.y + (showNames ? 9 : 0) + 0.5);
      }
      if (showNames) {
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(30, 24, 18, 0.9)';
        ctx.fillText(def.name, s.x, s.y);
      }
    }
    if (this.layer === 'seas') {
      ctx.font = 'italic 600 12px Georgia, serif';
      ctx.fillStyle = 'rgba(240, 248, 250, 0.95)';
      for (const zd of pkg.seaZones) {
        const a = geo.zoneAnchors.get(zd.id);
        if (!a) continue;
        const s = toScreen(a.x, a.y);
        ctx.fillText(zd.name, s.x, s.y);
      }
    }
  }

  /** Validator findings, the hovered, pending and selected province, and a flagged or selected sea zone. */
  private drawOverlays(): void {
    const { ctx, camera: cam, geo, pkg } = this;
    const z = cam.zoom;
    const px = 1 / z;
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * cam.offX, this.dpr * cam.offY);
    ctx.lineJoin = 'round';
    const outline = (id: string | null, color: string, width: number, dash?: number[]) => {
      const p = id ? geo.provs.get(id) : null;
      if (!p) return;
      ctx.setLineDash(dash ? dash.map((d) => d * px) : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = width * px;
      ctx.stroke(p.path);
      ctx.setLineDash([]);
    };
    // provinces painted by the stroke in progress
    if (this.painting?.size) {
      ctx.strokeStyle = 'rgba(53, 47, 39, 0.35)';
      ctx.lineWidth = 0.8 * px;
      for (const id of this.painting) {
        const p = geo.provs.get(id);
        if (!p) continue;
        ctx.fillStyle = this.fillOf(id);
        ctx.fill(p.path);
        ctx.stroke(p.path);
      }
    }
    for (const id of this.flagged) outline(id, '#e0533d', 3);
    outline(this.hover, 'rgba(255, 255, 255, 0.85)', 2);
    outline(this.pending, '#f2d48a', 3, [6, 4]);
    outline(this.selected, '#f2d48a', 3.2);
    // a flagged or selected sea zone: its own outline, in any layer
    for (const zd of pkg.seaZones) {
      const selected = this.selectedZone === zd.id;
      if (!selected && !this.flagged.has(zd.id)) continue;
      const path = geo.zonePath(zd.id);
      if (!path) continue;
      ctx.strokeStyle = selected ? '#f2d48a' : '#e0533d';
      ctx.lineWidth = (selected ? 3.2 : 3) * px;
      ctx.stroke(path);
    }
  }

  /** Whether two provinces share a drawn land border (for the routes tool). */
  landBorder(a: string, b: string): boolean {
    return this.geo.edgeByPair.has(pairKey(a, b));
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = '#f2d48a';
  ctx.fill();
  ctx.strokeStyle = '#2a2016';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
