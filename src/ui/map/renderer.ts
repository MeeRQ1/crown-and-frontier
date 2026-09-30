// Canvas 2D strategic map: provinces, borders, overlays, armies, battles,
// sieges, routes and labels. Geometry is static (generated); colours and
// markers are derived from the simulation state each frame that is dirty.

import mapData from '../../data/reach.map.json';
import { TERRAIN } from '../../sim/config';
import { opinion } from '../../sim/diplomacy';
import { maxMorale } from '../../sim/military';
import { atWar, hasTreaty, isFriendly, menOf, type Sim } from '../../sim/state';
import { supplyDistances, supplyRange, isSupplySource } from '../../sim/supply';
import type { Army, ProvinceId } from '../../sim/types';
import { Camera } from './camera';

export type Overlay = 'political' | 'terrain' | 'supply' | 'diplomacy' | 'integration' | 'development';

export const OVERLAYS: Array<{ id: Overlay; label: string; key: string }> = [
  { id: 'political', label: 'Realms', key: 'Q' },
  { id: 'terrain', label: 'Terrain', key: 'W' },
  { id: 'supply', label: 'Supply', key: 'E' },
  { id: 'diplomacy', label: 'Relations', key: 'R' },
  { id: 'integration', label: 'Integration', key: 'T' },
  { id: 'development', label: 'Development', key: 'Y' },
];

interface MapJson {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  provinces: Record<string, { poly: number[]; cx: number; cy: number; area: number }>;
  edges: Array<{ a: string; b: string; pts: number[] }>;
  waste: Array<{ kind: string; poly: number[] }>;
  straits: Array<[string, string]>;
}

const MAP = mapData as unknown as MapJson;

export const TERRAIN_COLORS: Record<string, string> = {
  plains: '#c7cf8c',
  steppe: '#d8c48e',
  forest: '#7ea266',
  hills: '#b99f72',
  marsh: '#8aa89a',
  mountains: '#a0968c',
};

const SEA = '#6f9db3';
const SEA_DEEP = '#5d8aa1';
const LAND = '#e8ddc2';

function pathFrom(poly: number[], close = true): Path2D {
  const p = new Path2D();
  p.moveTo(poly[0], poly[1]);
  for (let i = 2; i < poly.length; i += 2) p.lineTo(poly[i], poly[i + 1]);
  if (close) p.closePath();
  return p;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bb = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${bb})`;
}

function ramp(t: number): string {
  // red → amber → green
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? mix('#c2463d', '#e0b347', t * 2) : mix('#e0b347', '#4f9a57', (t - 0.5) * 2);
}

export interface Marker {
  army: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RenderState {
  selectedProvince: ProvinceId | null;
  selectedArmy: string | null;
  hoverProvince: ProvinceId | null;
  previewPath: ProvinceId[] | null;
  previewLabel: string | null;
  overlay: Overlay;
  patterns: boolean;
  showNames: boolean;
  reducedMotion: boolean;
  player: string | null;
}

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  private provPath = new Map<string, Path2D>();
  private landEdges: Array<{ a: string; b: string; path: Path2D }> = [];
  private coast = new Path2D();
  private lakeShore = new Path2D();
  private peakEdge = new Path2D();
  private peaks: Path2D[] = [];
  private lakes: Path2D[] = [];
  private straits: Array<[string, string]> = MAP.straits;
  private patternCache = new Map<string, CanvasPattern | null>();
  markers: Marker[] = [];
  dpr = 1;
  width = 0;
  height = 0;
  time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.camera = new Camera(MAP.bounds);
    for (const [id, p] of Object.entries(MAP.provinces)) this.provPath.set(id, pathFrom(p.poly));
    for (const e of MAP.edges) {
      const path = pathFrom(e.pts, false);
      if (!e.b.startsWith('~') && !e.a.startsWith('~')) this.landEdges.push({ a: e.a, b: e.b, path });
      else {
        const other = e.a.startsWith('~') && e.b.startsWith('~') ? `${e.a}${e.b}` : e.b;
        if (other.includes('sea')) this.coast.addPath(path);
        else if (other.includes('lake')) this.lakeShore.addPath(path);
        else if (other.includes('peak')) this.peakEdge.addPath(path);
      }
    }
    for (const w of MAP.waste) (w.kind === 'lake' ? this.lakes : this.peaks).push(pathFrom(w.poly));
  }

  static provinceCenter(id: ProvinceId): { x: number; y: number } {
    const p = MAP.provinces[id];
    return { x: p.cx, y: p.cy };
  }

  static bounds() {
    return MAP.bounds;
  }

  resize(w: number, h: number, dpr: number): void {
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.setViewport(w, h);
  }

  /** Province under a screen point (CSS pixels). */
  provinceAt(sx: number, sy: number): ProvinceId | null {
    const { x, y } = this.camera.toWorld(sx, sy);
    for (const [id, p] of Object.entries(MAP.provinces)) {
      if (pointInPoly(x, y, p.poly)) return id;
    }
    return null;
  }

  armyAt(sx: number, sy: number): string | null {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      if (sx >= m.x - 3 && sx <= m.x + m.w + 3 && sy >= m.y - 3 && sy <= m.y + m.h + 3) return m.army;
    }
    return null;
  }

  private realmPattern(nid: string, color: string): CanvasPattern | null {
    const key = `${nid}|${color}`;
    if (this.patternCache.has(key)) return this.patternCache.get(key)!;
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    const g = c.getContext('2d');
    if (!g) return null;
    g.strokeStyle = 'rgba(20,20,20,0.35)';
    g.fillStyle = 'rgba(20,20,20,0.35)';
    g.lineWidth = 1.5;
    const i = Math.abs([...nid].reduce((s, ch) => s * 31 + ch.charCodeAt(0), 7)) % 6;
    g.beginPath();
    if (i === 0) (g.moveTo(0, 16), g.lineTo(16, 0));
    if (i === 1) (g.moveTo(0, 0), g.lineTo(16, 16));
    if (i === 2) (g.moveTo(0, 8), g.lineTo(16, 8));
    if (i === 3) (g.moveTo(8, 0), g.lineTo(8, 16));
    if (i === 4) (g.moveTo(0, 16), g.lineTo(16, 0), g.moveTo(0, 0), g.lineTo(16, 16));
    g.stroke();
    if (i === 5) (g.beginPath(), g.arc(8, 8, 2, 0, Math.PI * 2), g.fill());
    const pat = this.ctx.createPattern(c, 'repeat');
    this.patternCache.set(key, pat);
    return pat;
  }

  private occupationPattern(color: string): CanvasPattern | null {
    const key = `occ|${color}`;
    if (this.patternCache.has(key)) return this.patternCache.get(key)!;
    const c = document.createElement('canvas');
    c.width = 12;
    c.height = 12;
    const g = c.getContext('2d');
    if (!g) return null;
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-3, 15);
    g.lineTo(15, -3);
    g.moveTo(9, 15);
    g.lineTo(15, 9);
    g.moveTo(-3, 3);
    g.lineTo(3, -3);
    g.stroke();
    const pat = this.ctx.createPattern(c, 'repeat');
    this.patternCache.set(key, pat);
    return pat;
  }

  private fillFor(sim: Sim, id: ProvinceId, rs: RenderState): string {
    const st = sim.state;
    const p = st.provinces[id];
    const def = sim.world.prov[id];
    const player = rs.player;
    switch (rs.overlay) {
      case 'terrain':
        return TERRAIN_COLORS[def.terrain];
      case 'integration':
        return p.owner ? ramp(p.integration / 100) : '#cfc6b0';
      case 'development':
        return mix('#efe7d4', '#5b3f86', (p.dev - 1) / 9);
      case 'supply': {
        if (!player) return LAND;
        const d = supplyDistances(sim, player)[id];
        const r = supplyRange(sim, player);
        if (isFriendly(sim, player, p.controller) && isSupplySource(sim, id)) return '#4f9a57';
        if (d <= r) return mix('#a9d08a', '#e3cf73', d / Math.max(1, r));
        if (d <= r + 1.5) return '#e59f5b';
        return '#b9aea0';
      }
      case 'diplomacy': {
        if (!player || !p.owner) return '#d9d0bb';
        if (p.owner === player) return '#d8b36a';
        if (atWar(sim, player, p.owner)) return '#c2463d';
        if (hasTreaty(sim, 'alliance', player, p.owner)) return '#3f78c4';
        if (hasTreaty(sim, 'nap', player, p.owner) || hasTreaty(sim, 'trade', player, p.owner)) return '#58a7a0';
        const op = opinion(sim, p.owner, player);
        return op >= 0 ? mix('#d9d0bb', '#8fbf9a', op / 100) : mix('#d9d0bb', '#d98a5f', -op / 100);
      }
      default: {
        if (!p.owner) return '#d6ccb3';
        const color = sim.world.nationDefs[p.owner].color;
        return mix(LAND, color, 0.72);
      }
    }
  }

  draw(sim: Sim, rs: RenderState, dt: number): void {
    this.time += dt;
    const { ctx, camera, dpr } = this;
    const st = sim.state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // sea
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, SEA);
    grad.addColorStop(1, SEA_DEEP);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);
    const z = camera.zoom;
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * camera.offX, dpr * camera.offY);
    const px = 1 / z; // one screen pixel in world units

    // coast glow
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(232,240,236,0.35)';
    ctx.lineWidth = 9 * px;
    ctx.stroke(this.coast);

    // provinces
    for (const id of sim.world.provIds) {
      const path = this.provPath.get(id);
      if (!path) continue;
      ctx.fillStyle = this.fillFor(sim, id, rs);
      ctx.fill(path);
      const p = st.provinces[id];
      if (rs.overlay === 'political' && p.owner) {
        if (rs.patterns) {
          const pat = this.realmPattern(p.owner, sim.world.nationDefs[p.owner].color);
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fill(path);
          }
        }
        if (p.controller && p.controller !== p.owner) {
          const pat = this.occupationPattern(sim.world.nationDefs[p.controller].color);
          if (pat) {
            ctx.fillStyle = pat;
            ctx.fill(path);
          }
        }
        if (p.revoltUntil > st.tick) {
          ctx.fillStyle = 'rgba(160,30,30,0.28)';
          ctx.fill(path);
        }
      } else if (rs.overlay !== 'political' && p.controller && p.controller !== p.owner) {
        const pat = this.occupationPattern('rgba(120,20,20,0.6)');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.fill(path);
        }
      }
      if (!p.owner && rs.overlay === 'political') {
        ctx.fillStyle = 'rgba(120,100,70,0.12)';
        ctx.fill(path);
      }
    }
    // impassable ground
    for (const pk of this.peaks) {
      ctx.fillStyle = '#8c8378';
      ctx.fill(pk);
    }
    for (const lk of this.lakes) {
      ctx.fillStyle = SEA;
      ctx.fill(lk);
    }
    this.drawTerrainGlyphs(sim, px);

    // borders
    ctx.strokeStyle = 'rgba(60,45,30,0.35)';
    ctx.lineWidth = 1 * px;
    for (const e of this.landEdges) ctx.stroke(e.path);
    ctx.strokeStyle = '#2a2118';
    ctx.lineWidth = 2.4 * px;
    for (const e of this.landEdges) {
      const oa = st.provinces[e.a].owner;
      const ob = st.provinces[e.b].owner;
      if (oa !== ob) ctx.stroke(e.path);
    }
    ctx.strokeStyle = 'rgba(40,52,60,0.8)';
    ctx.lineWidth = 1.6 * px;
    ctx.stroke(this.coast);
    ctx.stroke(this.lakeShore);
    ctx.strokeStyle = 'rgba(70,60,50,0.8)';
    ctx.stroke(this.peakEdge);
    // straits
    ctx.save();
    ctx.setLineDash([6 * px, 5 * px]);
    ctx.strokeStyle = 'rgba(30,40,50,0.65)';
    ctx.lineWidth = 2 * px;
    for (const [a, b] of this.straits) {
      const pa = MAP.provinces[a];
      const pb = MAP.provinces[b];
      ctx.beginPath();
      ctx.moveTo(pa.cx, pa.cy);
      ctx.lineTo(pb.cx, pb.cy);
      ctx.stroke();
    }
    ctx.restore();

    // hover & selection
    if (rs.hoverProvince && rs.hoverProvince !== rs.selectedProvince) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2 * px;
      ctx.stroke(this.provPath.get(rs.hoverProvince)!);
    }
    if (rs.selectedProvince) {
      ctx.strokeStyle = '#f3d27a';
      ctx.lineWidth = 3.5 * px;
      ctx.stroke(this.provPath.get(rs.selectedProvince)!);
    }

    // labels
    this.drawNationLabels(sim, rs, px);
    if (rs.showNames && z >= 0.75) this.drawProvinceLabels(sim, px, z);

    // routes (world space)
    const sel = rs.selectedArmy ? st.armies[rs.selectedArmy] : undefined;
    if (sel && sel.path.length) this.drawRoute(sel.location, sel.path, '#f3d27a', px, false);
    if (rs.previewPath && sel && rs.previewPath.length) this.drawRoute(sel.location, rs.previewPath, '#ffffff', px, true);
    // other own armies' routes, faint
    if (rs.player) {
      for (const id in st.armies) {
        const a = st.armies[id];
        if (a.nation !== rs.player || a.id === rs.selectedArmy || !a.path.length) continue;
        this.drawRoute(a.location, a.path, 'rgba(255,240,200,0.55)', px, false);
      }
    }

    // screen-space overlays: capitals, sieges, battles, armies
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawCapitals(sim);
    this.drawSieges(sim);
    this.drawBattles(sim, rs);
    this.drawArmies(sim, rs);
    if (rs.previewLabel && rs.previewPath?.length) {
      const end = rs.previewPath[rs.previewPath.length - 1];
      const c = camera.toScreen(MAP.provinces[end].cx, MAP.provinces[end].cy);
      this.drawTag(c.x, c.y - 30, rs.previewLabel, '#111', '#fff');
    }
  }

  private drawTerrainGlyphs(sim: Sim, px: number): void {
    const { ctx } = this;
    const z = this.camera.zoom;
    if (z < 0.55) return;
    ctx.save();
    ctx.lineWidth = 1.2 * px;
    ctx.strokeStyle = 'rgba(60,45,30,0.4)';
    for (const id of sim.world.provIds) {
      const t = sim.world.prov[id].terrain;
      const p = MAP.provinces[id];
      const x = p.cx + 26;
      const y = p.cy + 22;
      ctx.beginPath();
      if (t === 'mountains') {
        ctx.moveTo(x - 12, y + 6);
        ctx.lineTo(x - 4, y - 8);
        ctx.lineTo(x + 2, y + 2);
        ctx.lineTo(x + 7, y - 5);
        ctx.lineTo(x + 13, y + 6);
      } else if (t === 'hills') {
        ctx.arc(x - 5, y + 4, 7, Math.PI, 0);
        ctx.moveTo(x + 13, y + 4);
        ctx.arc(x + 7, y + 4, 6, 0, Math.PI, true);
      } else if (t === 'forest') {
        for (const [dx, dy] of [[-8, 0], [0, -4], [8, 1]]) {
          ctx.moveTo(x + dx, y + dy - 7);
          ctx.lineTo(x + dx - 4, y + dy + 3);
          ctx.lineTo(x + dx + 4, y + dy + 3);
          ctx.closePath();
        }
      } else if (t === 'marsh') {
        for (const dy of [-4, 1, 6]) {
          ctx.moveTo(x - 10, y + dy);
          ctx.lineTo(x + 10, y + dy);
        }
      } else if (t === 'steppe') {
        for (const dx of [-8, 0, 8]) {
          ctx.moveTo(x + dx - 3, y + 4);
          ctx.lineTo(x + dx, y - 4);
          ctx.lineTo(x + dx + 3, y + 4);
        }
      }
      ctx.stroke();
    }
    // peaks on the Greyspine
    ctx.strokeStyle = 'rgba(50,42,35,0.55)';
    ctx.lineWidth = 1.5 * px;
    for (const w of MAP.waste) {
      if (w.kind !== 'peak') continue;
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < w.poly.length; i += 2) {
        cx += w.poly[i];
        cy += w.poly[i + 1];
      }
      cx /= w.poly.length / 2;
      cy /= w.poly.length / 2;
      ctx.beginPath();
      for (const [dx, s] of [[-18, 14], [0, 20], [18, 12]]) {
        ctx.moveTo(cx + dx - s, cy + 12);
        ctx.lineTo(cx + dx, cy + 12 - s * 1.3);
        ctx.lineTo(cx + dx + s, cy + 12);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawNationLabels(sim: Sim, rs: RenderState, px: number): void {
    const { ctx } = this;
    const st = sim.state;
    const z = this.camera.zoom;
    if (rs.overlay !== 'political' && rs.overlay !== 'diplomacy') return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const nid of sim.world.nationIds) {
      if (!st.nations[nid].alive) continue;
      let sx = 0;
      let sy = 0;
      let area = 0;
      for (const pid of sim.world.provIds) {
        if (st.provinces[pid].owner !== nid) continue;
        const p = MAP.provinces[pid];
        sx += p.cx * p.area;
        sy += p.cy * p.area;
        area += p.area;
      }
      if (!area) continue;
      const cx = sx / area;
      const cy = sy / area;
      const size = Math.max(22, Math.min(64, Math.sqrt(area) * 0.16));
      const screenSize = size * z;
      if (screenSize < 9) continue;
      const alpha = z > 1.6 ? 0.25 : 0.72;
      ctx.font = `600 ${size}px Georgia, "Palatino Linotype", serif`;
      ctx.lineWidth = 4 * px;
      ctx.strokeStyle = `rgba(245,238,220,${alpha * 0.8})`;
      ctx.fillStyle = `rgba(35,25,18,${alpha})`;
      const label = sim.world.nationDefs[nid].short.toUpperCase().split('').join(' ');
      ctx.strokeText(label, cx, cy - 26);
      ctx.fillText(label, cx, cy - 26);
    }
    ctx.restore();
  }

  private drawProvinceLabels(sim: Sim, px: number, z: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.max(11, 12 / Math.min(1.4, z)) ;
    ctx.font = `${size}px system-ui, sans-serif`;
    ctx.lineWidth = 3 * px;
    ctx.strokeStyle = 'rgba(245,238,220,0.85)';
    ctx.fillStyle = 'rgba(30,24,18,0.9)';
    for (const id of sim.world.provIds) {
      const p = MAP.provinces[id];
      const name = sim.world.prov[id].name;
      ctx.strokeText(name, p.cx, p.cy + 14);
      ctx.fillText(name, p.cx, p.cy + 14);
    }
    ctx.restore();
  }

  private drawRoute(from: ProvinceId, path: ProvinceId[], color: string, px: number, dashed: boolean): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * px;
    if (dashed) ctx.setLineDash([8 * px, 6 * px]);
    ctx.beginPath();
    const s = MAP.provinces[from];
    ctx.moveTo(s.cx, s.cy);
    for (const pid of path) {
      const p = MAP.provinces[pid];
      ctx.lineTo(p.cx, p.cy);
    }
    ctx.stroke();
    // arrow head
    const last = MAP.provinces[path[path.length - 1]];
    const prev = path.length > 1 ? MAP.provinces[path[path.length - 2]] : s;
    const ang = Math.atan2(last.cy - prev.cy, last.cx - prev.cx);
    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(last.cx, last.cy);
    ctx.lineTo(last.cx - Math.cos(ang - 0.45) * 16 * px, last.cy - Math.sin(ang - 0.45) * 16 * px);
    ctx.lineTo(last.cx - Math.cos(ang + 0.45) * 16 * px, last.cy - Math.sin(ang + 0.45) * 16 * px);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawCapitals(sim: Sim): void {
    const { ctx } = this;
    for (const nid of sim.world.nationIds) {
      const cap = sim.state.nations[nid].capital;
      if (!cap || !sim.state.nations[nid].alive) continue;
      const p = MAP.provinces[cap];
      const c = this.camera.toScreen(p.cx, p.cy);
      c.y -= 4;
      const r = 7;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fillStyle = '#f3d27a';
      ctx.strokeStyle = '#2a2118';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawSieges(sim: Sim): void {
    const { ctx } = this;
    for (const pid of sim.world.provIds) {
      const s = sim.state.provinces[pid].siege;
      if (!s || s.progress <= 0) continue;
      const p = MAP.provinces[pid];
      const c = this.camera.toScreen(p.cx - 22, p.cy - 20);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,20,20,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.arc(c.x, c.y, 9, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * s.progress) / 100);
      ctx.closePath();
      ctx.fillStyle = sim.world.nationDefs[s.nation].color;
      ctx.fill();
      ctx.strokeStyle = '#f3d27a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawBattles(sim: Sim, rs: RenderState): void {
    const { ctx } = this;
    for (const b of Object.values(sim.state.battles)) {
      const p = MAP.provinces[b.province];
      const c = this.camera.toScreen(p.cx, p.cy);
      const pulse = rs.reducedMotion ? 0 : (Math.sin(this.time * 5) + 1) * 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 20 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(180,30,30,0.28)';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x - 9, c.y - 9);
      ctx.lineTo(c.x + 9, c.y + 9);
      ctx.moveTo(c.x + 9, c.y - 9);
      ctx.lineTo(c.x - 9, c.y + 9);
      ctx.stroke();
    }
  }

  private drawArmies(sim: Sim, rs: RenderState): void {
    const st = sim.state;
    const byProv = new Map<ProvinceId, Army[]>();
    for (const id of Object.keys(st.armies).sort()) {
      const a = st.armies[id];
      const arr = byProv.get(a.location) ?? [];
      arr.push(a);
      byProv.set(a.location, arr);
    }
    this.markers = [];
    for (const [pid, armies] of byProv) {
      const p = MAP.provinces[pid];
      const base = this.camera.toScreen(p.cx, p.cy);
      // own armies first, then by size
      armies.sort((x, y) => (x.nation === rs.player ? -1 : 0) - (y.nation === rs.player ? -1 : 0) || y.regiments.length - x.regiments.length || (x.id < y.id ? -1 : 1));
      const shown = armies.slice(0, 4);
      shown.forEach((a, i) => {
        const w = 40;
        const hgt = 22;
        const x = base.x - w / 2 + (i % 2) * 44 - (shown.length > 1 ? 22 : 0);
        const y = base.y - 36 - Math.floor(i / 2) * 27;
        this.drawArmyMarker(sim, a, x, y, w, hgt, a.id === rs.selectedArmy, rs.player);
        this.markers.push({ army: a.id, x, y, w, h: hgt });
      });
      if (armies.length > 4) this.drawTag(base.x + 52, base.y - 50, `+${armies.length - 4}`, '#222', '#fff');
    }
  }

  private drawArmyMarker(sim: Sim, a: Army, x: number, y: number, w: number, hgt: number, selected: boolean, player: string | null): void {
    const { ctx } = this;
    const def = sim.world.nationDefs[a.nation];
    const hostile = player ? atWar(sim, player, a.nation) : false;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = def.color;
    roundRect(ctx, x, y, w, hgt, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = selected ? 3 : hostile ? 2.5 : 1.5;
    ctx.strokeStyle = selected ? '#f3d27a' : hostile ? '#ff5a4e' : 'rgba(20,15,10,0.9)';
    roundRect(ctx, x, y, w, hgt, 5);
    ctx.stroke();
    // monogram shield
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 2, y + 2, 13, hgt - 4);
    ctx.fillStyle = '#fff';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.short[0], x + 8.5, y + hgt / 2);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(String(a.regiments.length), x + 27, y + hgt / 2 - 1);
    // morale bar
    const frac = Math.max(0, Math.min(1, a.morale / maxMorale(sim, a.nation)));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 16, y + hgt - 4, w - 19, 2.5);
    ctx.fillStyle = frac > 0.5 ? '#9be07a' : frac > 0.25 ? '#f0c14b' : '#ff6b5b';
    ctx.fillRect(x + 16, y + hgt - 4, (w - 19) * frac, 2.5);
    if (a.retreating) {
      ctx.fillStyle = '#fff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText('↩', x + w - 5, y + 6);
    }
    if (a.supply < 0.4) {
      ctx.fillStyle = '#ff6b5b';
      ctx.beginPath();
      ctx.arc(x + w - 3, y + 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    void menOf;
    ctx.restore();
  }

  private drawTag(x: number, y: number, text: string, bg: string, fg: string): void {
    const { ctx } = this;
    ctx.save();
    ctx.font = '600 12px system-ui, sans-serif';
    const w = ctx.measureText(text).width + 12;
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.85;
    roundRect(ctx, x - w / 2, y - 10, w, 20, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pointInPoly(x: number, y: number, poly: number[]): boolean {
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

export { TERRAIN };
