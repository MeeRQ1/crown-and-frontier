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
  private geometryRef: unknown = null;
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
    if (pkg.geometry !== this.geometryRef) {
      const sameBounds = this.geo && JSON.stringify(this.geo.bounds) === JSON.stringify(pkg.geometry.bounds);
      this.geo = new GeoIndex(drawnFromPackage(pkg));
      this.geometryRef = pkg.geometry;
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

  draw(): void {
    const { ctx, camera: cam, geo, pkg } = this;
    if (!pkg || !geo) return;
    this.provIndex = new Map(pkg.provinces.map((p) => [p.id, p]));
    this.colorIndex = new Map(pkg.nations.map((n) => [n.id, n.color]));
    const z = cam.zoom;
    const px = 1 / z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.seaMid;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * cam.offX, this.dpr * cam.offY);
    const [x0, y0, x1, y1] = cam.viewRect(40);
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
    const thin = new Path2D();
    const thick = new Path2D();
    for (const e of geo.edges) {
      if (e.coast) continue;
      const a = this.provIndex.get(e.a);
      const b = this.provIndex.get(e.b);
      const differ = this.layer === 'regions' ? a?.region !== b?.region : this.layer === 'realms' ? a?.owner !== b?.owner : false;
      (differ ? thick : thin).addPath(e.path);
    }
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
    // highlights
    const outline = (id: string | null, color: string, width: number, dash?: number[]) => {
      const p = id ? geo.provs.get(id) : null;
      if (!p) return;
      ctx.setLineDash(dash ? dash.map((d) => d * px) : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = width * px;
      ctx.stroke(p.path);
      ctx.setLineDash([]);
    };
    for (const id of this.flagged) outline(id, '#e0533d', 3);
    outline(this.hover, 'rgba(255, 255, 255, 0.85)', 2);
    outline(this.pending, '#f2d48a', 3, [6, 4]);
    outline(this.selected, '#f2d48a', 3.2);

    // marks drawn at screen size
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const caps = new Set(pkg.nations.map((n) => n.capital));
    const showNames = cam.provincePx > 70;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of visible) {
      const def = this.provIndex.get(p.id);
      if (!def) continue;
      const s = cam.toScreen(p.lx, p.ly);
      if (caps.has(p.id)) star(ctx, s.x, s.y - (showNames ? 10 : 0), 6);
      if (def.port) {
        ctx.fillStyle = '#1d3f57';
        ctx.beginPath();
        ctx.arc(s.x + 9, s.y + 7, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e8f1f5';
        ctx.lineWidth = 1.2;
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
        const s = cam.toScreen(a.x, a.y);
        ctx.fillText(zd.name, s.x, s.y);
        if (this.flagged.has(zd.id) || this.selected === zd.id) {
          ctx.strokeStyle = this.selected === zd.id ? '#f2d48a' : '#e0533d';
          ctx.lineWidth = 2;
          ctx.strokeRect(s.x - 50, s.y - 10, 100, 20);
        }
      }
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
