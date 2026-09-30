// The strategic map. Layers, bottom to top:
//   base geography (cached tiles) → mode washes → occupation hatching →
//   province and realm borders → straits and roads → highlights → routes →
//   markers (capitals, sieges, battles, armies) → lettering.
// Lettering and markers are placed in screen space, by zoom tier, with
// collision checks so nothing overlaps.

import { TERRAIN } from '../../sim/config';
import { maxMorale } from '../../sim/military';
import { moveCost } from '../../sim/movement';
import { atWar, isFriendly, menOf, type Sim } from '../../sim/state';
import type { Army, NationId, ProvinceId } from '../../sim/types';
import { drawShield } from '../heraldry';
import { iconPath } from '../icons';
import { BaseMap, PALETTE, type TerrainDetail } from './basemap';
import { Camera } from './camera';
import { geoIndex, pairKey, type GeoIndex, type MapGeometry } from './geometry';
import { buildContext, fillFor, type MapMode } from './modes';

export interface Presentation {
  labels: 'few' | 'normal' | 'many';
  terrain: TerrainDetail;
  borders: 'subtle' | 'normal' | 'strong';
  armies: 'all' | 'relevant' | 'mine';
  patterns: boolean;
}

export interface RenderState {
  selectedProvince: ProvinceId | null;
  selectedArmy: string | null;
  hoverProvince: ProvinceId | null;
  previewPath: ProvinceId[] | null;
  previewLabel: string | null;
  previewBad?: boolean;
  mode: MapMode;
  /** realm whose relations the diplomacy mode shows (defaults to the player) */
  focusNation: NationId | null;
  /** provinces to outline (war goals, peace terms…) */
  highlight: ProvinceId[] | null;
  reducedMotion: boolean;
  player: NationId | null;
  presentation: Presentation;
  /** draw a gold outline around this realm (campaign setup) */
  outlineRealm?: NationId | null;
}

export interface Marker {
  army: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RealmShape {
  union: Path2D;
  border: Path2D;
  /** full outline including coasts */
  outline: Path2D;
  bbox: [number, number, number, number];
  label: { x: number; y: number; angle: number; len: number; wid: number; bend: number } | null;
}

export type Tier = 'far' | 'medium' | 'close';

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly geo: GeoIndex;
  readonly base: BaseMap;
  markers: Marker[] = [];
  battleMarkers: Array<{ battle: string; province: ProvinceId; x: number; y: number; r: number }> = [];
  dpr = 1;
  width = 0;
  height = 0;
  private realmKey = '';
  private realms = new Map<NationId, RealmShape>();
  /** realm lettering frames, reused while a realm's territory is unchanged */
  private labelCache = new Map<NationId, { sig: string; label: RealmShape['label'] }>();
  private riverPath: Path2D | null = null;
  private patternCache = new Map<string, CanvasPattern | null>();
  private placed: Rect[] = [];
  private pending = false;

  constructor(canvas: HTMLCanvasElement, geometry: MapGeometry, terrainOf: (id: string) => string) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    this.geo = geoIndex(geometry);
    this.camera = new Camera(this.geo.bounds, this.geo.provScale);
    this.base = new BaseMap(this.geo, terrainOf);
  }

  /** World bounding box of a realm's provinces (after the last draw). */
  realmBBox(sim: Sim, nid: NationId): [number, number, number, number] | null {
    this.ensureRealms(sim);
    return this.realms.get(nid)?.bbox ?? null;
  }

  provinceCenter(id: ProvinceId): { x: number; y: number } {
    const p = this.geo.provs.get(id);
    return p ? { x: p.lx, y: p.ly } : { x: 0, y: 0 };
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

  tier(): Tier {
    const px = this.camera.provincePx;
    return px < 48 ? 'far' : px < 135 ? 'medium' : 'close';
  }

  /** Province under a screen point (CSS pixels). */
  provinceAt(sx: number, sy: number): ProvinceId | null {
    const w = this.camera.toWorld(sx, sy);
    return this.geo.provinceAt(w.x, w.y);
  }

  armyAt(sx: number, sy: number): string | null {
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      if (sx >= m.x - 4 && sx <= m.x + m.w + 4 && sy >= m.y - 4 && sy <= m.y + m.h + 4) return m.army;
    }
    return null;
  }

  battleAt(sx: number, sy: number): { battle: string; province: ProvinceId } | null {
    for (const b of this.battleMarkers) if (Math.hypot(sx - b.x, sy - b.y) <= b.r + 4) return b;
    return null;
  }

  /** Draw a frame; returns true if another frame is wanted (animation or tiles pending). */
  draw(sim: Sim, rs: RenderState, now: number): boolean {
    const cam = this.camera;
    const animating = cam.update(now);
    const ctx = this.ctx;
    const dpr = this.dpr;
    const W = this.width;
    const H = this.height;
    this.base.setDetail(rs.presentation.terrain);
    const complete = this.base.draw(ctx, cam.zoom, cam.offX, cam.offY, W, H, dpr, animating ? 6 : 12);
    this.pending = !complete;

    const z = cam.zoom;
    const tier = this.tier();
    const view = cam.viewRect(60);
    const visible = this.geo.provincesIn(view[0], view[1], view[2], view[3]);
    this.ensureRealms(sim);

    // world transform
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * cam.offX, dpr * cam.offY);
    const px = 1 / z; // one CSS pixel in world units

    // 1. mode washes (multiply: the printed terrain stays visible)
    const mctx = buildContext(sim, rs.mode, rs.player);
    const groups = new Map<string, Path2D>();
    const hatches: Array<{ id: ProvinceId; color: string }> = [];
    for (const p of visible) {
      const f = fillFor(rs.mode, mctx, p.id, rs.focusNation);
      if (f.alpha > 0) {
        const k = `${f.color}|${f.alpha}`;
        let g = groups.get(k);
        if (!g) groups.set(k, (g = new Path2D()));
        g.addPath(p.path);
      }
      if (f.hatch) hatches.push({ id: p.id, color: f.hatch });
    }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const [k, path] of groups) {
      const [color, alpha] = k.split('|');
      ctx.globalAlpha = Number(alpha);
      ctx.fillStyle = color;
      ctx.fill(path);
    }
    ctx.restore();

    // 2. occupation / war hatching
    for (const hch of hatches) {
      const pat = this.hatchPattern(hch.color);
      if (!pat) continue;
      // one pattern pixel = one CSS pixel, anchored to the map
      pat.setTransform(new DOMMatrix([1 / z, 0, 0, 1 / z, 0, 0]));
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = pat;
      ctx.fill(this.geo.provs.get(hch.id)!.path);
      ctx.restore();
    }

    // 3. province borders (fine), then realm borders with inner ribbons
    const bstyle = rs.presentation.borders;
    if (tier !== 'far') {
      const thin = new Path2D();
      for (const e of this.geo.edges) {
        if (e.coast) continue;
        if (e.bbox[2] < view[0] || e.bbox[0] > view[2] || e.bbox[3] < view[1] || e.bbox[1] > view[3]) continue;
        const oa = sim.state.provinces[e.a].owner;
        const ob = sim.state.provinces[e.b].owner;
        if (oa !== ob) continue;
        thin.addPath(e.path);
      }
      ctx.strokeStyle = 'rgba(52, 44, 34, 0.55)';
      ctx.lineWidth = (tier === 'close' ? 1.1 : 0.8) * px;
      ctx.setLineDash([3 * px, 2.5 * px]);
      ctx.stroke(thin);
      ctx.setLineDash([]);
    }
    const ribbonW = (bstyle === 'strong' ? 11 : bstyle === 'subtle' ? 5 : 8) * px * (tier === 'far' ? 0.8 : 1);
    for (const [nid, rsh] of this.realms) {
      ctx.save();
      ctx.clip(rsh.union);
      ctx.globalAlpha = rs.mode === 'political' ? 0.55 : 0.32;
      ctx.strokeStyle = sim.world.nationDefs[nid].color;
      ctx.lineWidth = ribbonW * 2;
      ctx.stroke(rsh.border);
      ctx.restore();
    }
    // rivers: strategic lines (attackers crossing one fight at a disadvantage)
    if (this.geo.riverEdges.length) {
      if (!this.riverPath) {
        this.riverPath = new Path2D();
        for (const e of this.geo.riverEdges) this.riverPath.addPath(e.path);
      }
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(232, 240, 238, 0.55)';
      ctx.lineWidth = (tier === 'far' ? 3.6 : 4.6) * px;
      ctx.stroke(this.riverPath);
      ctx.strokeStyle = '#3d7391';
      ctx.lineWidth = (tier === 'far' ? 1.9 : tier === 'medium' ? 2.4 : 2.8) * px;
      ctx.stroke(this.riverPath);
      ctx.restore();
    }
    const realmBorder = new Path2D();
    for (const rsh of this.realms.values()) realmBorder.addPath(rsh.border);
    ctx.strokeStyle = 'rgba(33, 27, 21, 0.92)';
    ctx.lineWidth = (bstyle === 'strong' ? 2.6 : bstyle === 'subtle' ? 1.3 : 1.9) * px;
    ctx.lineJoin = 'round';
    ctx.stroke(realmBorder);
    if (rs.outlineRealm) {
      const r = this.realms.get(rs.outlineRealm);
      if (r) {
        ctx.save();
        ctx.strokeStyle = 'rgba(20, 16, 12, 0.7)';
        ctx.lineWidth = 5 * px;
        ctx.stroke(r.outline);
        ctx.strokeStyle = '#f2d48a';
        ctx.lineWidth = 2.6 * px;
        ctx.stroke(r.outline);
        ctx.restore();
      }
    }

    // 4. straits and fords, roads
    this.drawStraits(sim, px, tier);
    if (tier === 'close' || rs.mode === 'supply') this.drawRoads(sim, px, visible);

    // 5. highlights
    if (rs.highlight?.length) {
      ctx.save();
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.strokeStyle = '#f2d48a';
      ctx.lineWidth = 2.4 * px;
      for (const id of rs.highlight) {
        const p = this.geo.provs.get(id);
        if (p) ctx.stroke(p.path);
      }
      ctx.restore();
    }
    if (rs.mode === 'military' && mctx.fronts?.size) {
      ctx.save();
      ctx.strokeStyle = 'rgba(157, 47, 34, 0.9)';
      ctx.lineWidth = 2.2 * px;
      for (const id of mctx.fronts) {
        for (const e of this.geo.edgesOf.get(id) ?? []) {
          if (e.coast) continue;
          const other = e.a === id ? e.b : e.a;
          const oc = sim.state.provinces[other].controller;
          if (oc && rs.player && atWar(sim, rs.player, oc)) ctx.stroke(e.path);
        }
      }
      ctx.restore();
    }
    if (rs.hoverProvince && rs.hoverProvince !== rs.selectedProvince) {
      const p = this.geo.provs.get(rs.hoverProvince);
      if (p) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 250, 235, 0.16)';
        ctx.fill(p.path);
        ctx.strokeStyle = 'rgba(255, 248, 225, 0.85)';
        ctx.lineWidth = 1.6 * px;
        ctx.stroke(p.path);
        ctx.restore();
      }
    }
    if (rs.selectedProvince) {
      const p = this.geo.provs.get(rs.selectedProvince);
      if (p) {
        ctx.save();
        ctx.clip(p.path);
        ctx.strokeStyle = 'rgba(242, 212, 138, 0.55)';
        ctx.lineWidth = 9 * px;
        ctx.stroke(p.path);
        ctx.restore();
        ctx.strokeStyle = '#f2d48a';
        ctx.lineWidth = 2.6 * px;
        ctx.stroke(p.path);
        ctx.strokeStyle = 'rgba(30, 24, 16, 0.8)';
        ctx.lineWidth = 0.9 * px;
        ctx.stroke(p.path);
      }
    }

    // 6. routes (world space, constant screen width)
    const armies = Object.values(sim.state.armies);
    const pos = new Map<string, { x: number; y: number }>();
    for (const a of armies) pos.set(a.id, this.armyPos(sim, a));
    for (const a of armies) {
      if (!a.path.length || a.id === rs.selectedArmy) continue;
      const mine = a.nation === rs.player;
      const hostile = rs.player ? atWar(sim, rs.player, a.nation) : false;
      if (!mine && !hostile) continue;
      if (tier === 'far' && !hostile) continue;
      this.drawRoute(pos.get(a.id)!, a.path, mine ? 'rgba(240, 226, 190, 0.75)' : 'rgba(214, 72, 52, 0.9)', px, true, a.retreating ? 0.5 : 1);
    }
    const sel = rs.selectedArmy ? sim.state.armies[rs.selectedArmy] : undefined;
    if (sel?.path.length) this.drawRoute(pos.get(sel.id)!, sel.path, '#f2d48a', px, false, 1.35);
    if (sel && rs.previewPath?.length) this.drawRoute(pos.get(sel.id)!, rs.previewPath, rs.previewBad ? 'rgba(230, 110, 90, 0.95)' : 'rgba(255, 244, 214, 0.95)', px, true, 1.2);

    // screen-space layers
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.placed = [];
    this.markers = [];
    this.battleMarkers = [];
    const t = now / 1000;
    this.drawBattles(sim, rs, t);
    this.drawSites(sim, rs, tier, visible);
    this.drawArmies(sim, rs, tier, pos);
    if (sel && rs.previewPath?.length && rs.previewLabel) {
      const end = this.provinceCenter(rs.previewPath[rs.previewPath.length - 1]);
      const s = cam.toScreen(end.x, end.y);
      this.pill(s.x, s.y - 30, rs.previewLabel, rs.previewBad ? '#8f2e1d' : '#1a242f', rs.previewBad ? '#ffd9d0' : '#f6e7c1');
    } else if (sel?.path.length) {
      const end = this.provinceCenter(sel.path[sel.path.length - 1]);
      const s = cam.toScreen(end.x, end.y);
      this.flag(s.x, s.y);
    }
    this.drawLabels(sim, rs, tier, visible);
    return animating || this.pending || (!rs.reducedMotion && Object.keys(sim.state.battles).length > 0);
  }

  // ───────────────────────────── caches ───────────────────────────────────

  private ensureRealms(sim: Sim): void {
    const key = `${sim.state.tick >= 0 ? sim.state.rev : 0}`;
    if (key === this.realmKey && this.realms.size) return;
    this.realmKey = key;
    this.realms.clear();
    const st = sim.state;
    const owner = (id: string) => st.provinces[id]?.owner ?? null;
    for (const nid of sim.world.nationIds) {
      if (!st.nations[nid].alive) continue;
      const union = new Path2D();
      const border = new Path2D();
      const outline = new Path2D();
      const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      let any = false;
      let sig = '';
      for (const pid of sim.world.provIds) {
        if (owner(pid) !== nid) continue;
        any = true;
        sig += `${pid},`;
        const pg = this.geo.provs.get(pid)!;
        union.addPath(pg.path);
        bbox[0] = Math.min(bbox[0], pg.bbox[0]);
        bbox[1] = Math.min(bbox[1], pg.bbox[1]);
        bbox[2] = Math.max(bbox[2], pg.bbox[2]);
        bbox[3] = Math.max(bbox[3], pg.bbox[3]);
        for (const e of this.geo.edgesOf.get(pid) ?? []) {
          if (e.coast) {
            outline.addPath(e.path);
            continue;
          }
          const other = e.a === pid ? e.b : e.a;
          if (owner(other) !== nid) {
            border.addPath(e.path);
            outline.addPath(e.path);
          }
        }
      }
      if (!any) continue;
      let lab = this.labelCache.get(nid);
      if (!lab || lab.sig !== sig) this.labelCache.set(nid, (lab = { sig, label: this.realmLabel(sim, nid) }));
      this.realms.set(nid, { union, border, outline, bbox, label: lab.label });
    }
  }

  /** Axis-aligned lettering frame for a realm's largest connected territory. */
  private realmLabel(sim: Sim, nid: NationId): RealmShape['label'] {
    const st = sim.state;
    const owned = sim.world.provIds.filter((p) => st.provinces[p].owner === nid);
    const seen = new Set<string>();
    let best: string[] = [];
    let bestArea = 0;
    for (const s of owned) {
      if (seen.has(s)) continue;
      const comp: string[] = [];
      const q = [s];
      seen.add(s);
      while (q.length) {
        const c = q.pop()!;
        comp.push(c);
        for (const n of sim.world.prov[c].neighbors) if (!seen.has(n) && st.provinces[n].owner === nid && !sim.world.straitSet.has(pairKey(c, n))) (seen.add(n), q.push(n));
      }
      const area = comp.reduce((a, id) => a + this.geo.provs.get(id)!.area, 0);
      if (area > bestArea) {
        bestArea = area;
        best = comp;
      }
    }
    if (!best.length) return null;
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (const id of best) {
      const p = this.geo.provs.get(id)!;
      sx += p.lx * p.area;
      sy += p.ly * p.area;
      sw += p.area;
    }
    const mx = sx / sw;
    const my = sy / sw;
    let cxx = 0;
    let cyy = 0;
    let cxy = 0;
    for (const id of best) {
      const p = this.geo.provs.get(id)!;
      const dx = p.lx - mx;
      const dy = p.ly - my;
      cxx += dx * dx * p.area;
      cyy += dy * dy * p.area;
      cxy += dx * dy * p.area;
    }
    let angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    if (best.length < 3) angle = 0;
    angle = Math.max(-0.38, Math.min(0.38, angle));
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    let lo = Infinity;
    let hi = -Infinity;
    let wlo = Infinity;
    let whi = -Infinity;
    let above = 0;
    for (const id of best) {
      const p = this.geo.provs.get(id)!;
      for (let i = 0; i < p.poly.length; i += 6) {
        const dx = p.poly[i] - mx;
        const dy = p.poly[i + 1] - my;
        const u = dx * ca + dy * sa;
        const v = -dx * sa + dy * ca;
        if (u < lo) lo = u;
        if (u > hi) hi = u;
        if (v < wlo) wlo = v;
        if (v > whi) whi = v;
      }
      const v0 = -(p.lx - mx) * sa + (p.ly - my) * ca;
      above += (v0 < 0 ? 1 : -1) * p.area;
    }
    void lo;
    void hi;
    void wlo;
    void whi;
    // Fit the lettering inside the realm: try lines through several interior
    // points at a few angles; measure how far each runs before leaving the
    // realm, and how thick the realm is across it.
    const inRealm = (x: number, y: number) => {
      const id = this.geo.provinceAt(x, y);
      return !!id && st.provinces[id].owner === nid;
    };
    const stepLen = this.geo.provScale * 0.3;
    const reach = (x: number, y: number, ca2: number, sa2: number, max: number) => {
      let d = 0;
      while (d < max && inRealm(x + (d + stepLen) * ca2, y + (d + stepLen) * sa2)) d += stepLen;
      return d;
    };
    const anchors = best
      .map((id) => this.geo.provs.get(id)!)
      .sort((p, q) => Math.hypot(p.lx - mx, p.ly - my) - Math.hypot(q.lx - mx, q.ly - my))
      .slice(0, 8);
    const angles = [...new Set([angle, angle / 2, 0, -0.25, 0.25].map((v) => Math.round(v * 100) / 100))];
    let bestFit: { x: number; y: number; angle: number; len: number; wid: number; score: number } | null = null;
    const maxRun = this.geo.provScale * 14;
    for (const p of anchors) {
      for (const ang of angles) {
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const back = reach(p.lx, p.ly, -c, -sn, maxRun);
        const fwd = reach(p.lx, p.ly, c, sn, maxRun);
        const len = back + fwd;
        const x = p.lx + ((fwd - back) / 2) * c;
        const y = p.ly + ((fwd - back) / 2) * sn;
        if (!inRealm(x, y)) continue;
        const up = reach(x, y, sn, -c, maxRun / 3);
        const down = reach(x, y, -sn, c, maxRun / 3);
        const wid = 2 * Math.min(up, down) + stepLen;
        // lettering size is bounded by both length and thickness; prefer level text
        const score = Math.min(len / 7, wid * 0.42) * (1 - Math.abs(ang) * 0.25);
        if (!bestFit || score > bestFit.score) bestFit = { x, y, angle: ang, len, wid, score };
      }
    }
    if (!bestFit) return null;
    return { x: bestFit.x, y: bestFit.y, angle: bestFit.angle, len: bestFit.len * 0.9, wid: bestFit.wid, bend: Math.abs(bestFit.angle) > 0.1 ? Math.sign(above) * Math.min(0.04, (0.5 * Math.abs(above)) / sw) : 0 };
  }

  private hatchPattern(color: string): CanvasPattern | null {
    if (this.patternCache.has(color)) return this.patternCache.get(color)!;
    const c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    const g = c.getContext('2d');
    if (!g) return null;
    g.strokeStyle = color;
    g.lineWidth = 2.4;
    g.lineCap = 'square';
    g.beginPath();
    g.moveTo(-2, 12);
    g.lineTo(12, -2);
    g.moveTo(-2, 2);
    g.lineTo(2, -2);
    g.moveTo(8, 12);
    g.lineTo(12, 8);
    g.stroke();
    const pat = this.ctx.createPattern(c, 'repeat');
    this.patternCache.set(color, pat);
    return pat;
  }

  // ───────────────────────────── world-space extras ───────────────────────

  private drawStraits(sim: Sim, px: number, tier: Tier): void {
    const ctx = this.ctx;
    for (const [a, b] of this.geo.straits) {
      const pa = this.provinceCenter(a);
      const pb = this.provinceCenter(b);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(20, 38, 46, 0.55)';
      ctx.lineWidth = 4.2 * px;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
      ctx.setLineDash([5 * px, 5 * px]);
      ctx.strokeStyle = '#f1e7cc';
      ctx.lineWidth = 2 * px;
      ctx.stroke();
      ctx.restore();
      if (tier === 'close') {
        void sim;
      }
    }
  }

  private drawRoads(sim: Sim, px: number, visible: Array<{ id: string }>): void {
    const ctx = this.ctx;
    const st = sim.state;
    const vis = new Set(visible.map((v) => v.id));
    ctx.save();
    ctx.lineCap = 'round';
    for (const id of vis) {
      const inf = st.provinces[id].infra;
      if (!inf) continue;
      const pa = this.provinceCenter(id);
      for (const n of sim.world.prov[id].neighbors) {
        if (n < id && vis.has(n)) continue;
        const lvl = Math.min(inf, st.provinces[n].infra);
        if (!lvl || sim.world.straitSet.has(pairKey(id, n))) continue;
        const pb = this.provinceCenter(n);
        ctx.strokeStyle = 'rgba(245, 236, 214, 0.85)';
        ctx.lineWidth = (1.6 + lvl * 1.2) * px;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(122, 86, 52, 0.95)';
        ctx.lineWidth = (0.7 + lvl * 0.7) * px;
        ctx.setLineDash(lvl >= 2 ? [] : [5 * px, 3 * px]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  private drawRoute(from: { x: number; y: number }, path: ProvinceId[], color: string, px: number, dashed: boolean, weight: number): void {
    const ctx = this.ctx;
    const pts = [from, ...path.map((p) => this.provinceCenter(p))];
    const line = new Path2D();
    line.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      line.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const last = pts[pts.length - 1];
    line.lineTo(last.x, last.y);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(18, 14, 10, 0.55)';
    ctx.lineWidth = (4.6 * weight) * px;
    ctx.stroke(line);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4 * weight * px;
    if (dashed) ctx.setLineDash([7 * px, 5 * px]);
    ctx.stroke(line);
    ctx.setLineDash([]);
    // arrowhead
    const prev = pts.length > 2 ? { x: (pts[pts.length - 2].x + last.x) / 2, y: (pts[pts.length - 2].y + last.y) / 2 } : pts[0];
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    const s = 9 * weight * px;
    ctx.translate(last.x, last.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(s * 0.4, 0);
    ctx.lineTo(-s, -s * 0.72);
    ctx.lineTo(-s * 0.6, 0);
    ctx.lineTo(-s, s * 0.72);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(18, 14, 10, 0.7)';
    ctx.lineWidth = 1.2 * px;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Army position, gliding between provinces as it marches. */
  armyPos(sim: Sim, a: Army): { x: number; y: number } {
    const here = this.provinceCenter(a.location);
    if (!a.path.length || a.progress <= 0 || a.battle) return here;
    const next = this.provinceCenter(a.path[0]);
    const cost = Math.max(0.1, moveCost(sim, a.location, a.path[0], a.nation));
    const u = Math.max(0, Math.min(0.85, a.progress / cost));
    return { x: here.x + (next.x - here.x) * u, y: here.y + (next.y - here.y) * u };
  }

  // ───────────────────────────── screen-space layers ──────────────────────

  private overlaps(r: Rect): boolean {
    for (const q of this.placed) if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) return true;
    return false;
  }

  private place(r: Rect): void {
    this.placed.push(r);
  }

  private drawBattles(sim: Sim, rs: RenderState, t: number): void {
    const ctx = this.ctx;
    const cam = this.camera;
    for (const b of Object.values(sim.state.battles)) {
      const c = this.provinceCenter(b.province);
      const s = cam.toScreen(c.x, c.y);
      if (s.x < -40 || s.y < -40 || s.x > this.width + 40 || s.y > this.height + 40) continue;
      const ours = rs.player && (b.attackerNations.includes(rs.player) || b.defenderNations.includes(rs.player));
      const r = ours ? 15 : 12;
      if (!rs.reducedMotion) {
        const ph = (t * 1.2) % 1;
        ctx.save();
        ctx.globalAlpha = 0.55 * (1 - ph);
        ctx.strokeStyle = '#e5604c';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + ph * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = ours ? '#8f2e1d' : '#5a2a22';
      ctx.strokeStyle = '#f7e2c8';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.icon('battle', s.x, s.y, r * 1.25, '#fff2e0', 2);
      ctx.restore();
      this.battleMarkers.push({ battle: b.id, province: b.province, x: s.x, y: s.y, r });
      this.place({ x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 });
    }
  }

  /** Capitals, forts and sieges. */
  private drawSites(sim: Sim, rs: RenderState, tier: Tier, visible: Array<{ id: string }>): void {
    const st = sim.state;
    const cam = this.camera;
    const ctx = this.ctx;
    const capitals = new Set<string>();
    for (const n of Object.values(st.nations)) if (n.alive && n.capital) capitals.add(n.capital);
    for (const v of visible) {
      const p = st.provinces[v.id];
      const isCap = capitals.has(v.id);
      const siege = p.siege && p.siege.progress > 0 ? p.siege : null;
      if (!isCap && !siege && !(tier === 'close' && p.fort > 0)) continue;
      const g = this.geo.provs.get(v.id)!;
      const s = cam.toScreen(g.lx, g.ly);
      if (s.x < -30 || s.y < -30 || s.x > this.width + 30 || s.y > this.height + 30) continue;
      const y = s.y + (tier === 'far' ? 0 : 13);
      if (siege) {
        const col = sim.world.nationDefs[siege.nation]?.color ?? '#999';
        ctx.save();
        ctx.fillStyle = 'rgba(20, 24, 30, 0.88)';
        ctx.beginPath();
        ctx.arc(s.x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = col;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, y, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * siege.progress) / 100);
        ctx.stroke();
        this.icon('fort', s.x, y, 13, '#f1e7cc', 1.6);
        ctx.restore();
        this.place({ x: s.x - 12, y: y - 12, w: 24, h: 24 });
        continue;
      }
      if (isCap) {
        const owner = p.owner ? sim.world.nationDefs[p.owner] : null;
        if (tier === 'far') {
          ctx.save();
          ctx.fillStyle = '#1b1712';
          ctx.beginPath();
          ctx.arc(s.x, y, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f2d48a';
          ctx.beginPath();
          ctx.arc(s.x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          this.place({ x: s.x - 6, y: y - 6, w: 12, h: 12 });
        } else {
          ctx.save();
          ctx.fillStyle = owner?.color ?? '#555';
          ctx.strokeStyle = '#1b1712';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(s.x, y, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#f2d48a';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(s.x, y, 12.5, 0, Math.PI * 2);
          ctx.stroke();
          this.icon('capital', s.x, y, 13, '#fff8e8', 1.7);
          ctx.restore();
          this.place({ x: s.x - 13, y: y - 13, w: 26, h: 26 });
        }
        continue;
      }
      // fort (close zoom)
      ctx.save();
      ctx.fillStyle = 'rgba(28, 24, 18, 0.82)';
      ctx.beginPath();
      ctx.roundRect(s.x - 9, y - 9, 18, 18, 4);
      ctx.fill();
      this.icon('fort', s.x, y, 12, '#f1e7cc', 1.6);
      for (let i = 0; i < p.fort; i++) {
        ctx.fillStyle = '#f2d48a';
        ctx.fillRect(s.x - 7 + i * 5, y + 11, 4, 3);
      }
      ctx.restore();
      this.place({ x: s.x - 10, y: y - 10, w: 20, h: 26 });
    }
    void rs;
  }

  private drawArmies(sim: Sim, rs: RenderState, tier: Tier, pos: Map<string, { x: number; y: number }>): void {
    const st = sim.state;
    const cam = this.camera;
    const me = rs.player;
    const mode = rs.presentation.armies;
    const relevant = (a: Army) => {
      if (a.nation === me || a.id === rs.selectedArmy) return true;
      if (!me) return mode === 'all';
      if (atWar(sim, me, a.nation)) return mode !== 'mine';
      if (mode === 'all') return true;
      return mode === 'relevant' && isFriendly(sim, me, a.nation) && tier !== 'far';
    };
    // group stacks by rounded screen position
    const stacks = new Map<string, Army[]>();
    for (const a of Object.values(st.armies)) {
      if (!relevant(a)) continue;
      const p = pos.get(a.id)!;
      const s = cam.toScreen(p.x, p.y);
      if (s.x < -60 || s.y < -60 || s.x > this.width + 60 || s.y > this.height + 60) continue;
      const k = tier === 'far' ? `${a.location}|${a.nation}` : a.path.length && a.progress > 0 ? `m${a.id}` : a.location;
      (stacks.get(k) ?? stacks.set(k, []).get(k)!).push(a);
    }
    const order = [...stacks.values()].sort((x, y) => {
      const sx = x.some((a) => a.id === rs.selectedArmy) ? 1 : 0;
      const sy = y.some((a) => a.id === rs.selectedArmy) ? 1 : 0;
      return sx - sy;
    });
    for (const list of order) {
      list.sort((a, b) => (a.nation === me ? -1 : 0) - (b.nation === me ? -1 : 0) || (a.id < b.id ? -1 : 1));
      const base = pos.get(list[0].id)!;
      const s = cam.toScreen(base.x, base.y);
      if (tier === 'far') {
        const a = list[0];
        const regs = list.reduce((n, x) => n + x.regiments.length, 0);
        this.farMarker(sim, a, s.x, s.y - 8, regs, list.some((x) => x.id === rs.selectedArmy), me);
        continue;
      }
      const H = 22;
      const widths = list.map((a) => 30 + String(a.regiments.length).length * 7);
      const total = widths.reduce((x, y) => x + y + 3, -3);
      let x = s.x - total / 2;
      const y = s.y - H - 8;
      list.forEach((a, i) => {
        this.armyMarker(sim, a, x, y, widths[i], H, a.id === rs.selectedArmy, me);
        this.markers.push({ army: a.id, x, y, w: widths[i], h: H + 5 });
        this.place({ x, y, w: widths[i], h: H + 5 });
        x += widths[i] + 3;
      });
    }
  }

  private farMarker(sim: Sim, a: Army, x: number, y: number, regs: number, selected: boolean, me: NationId | null): void {
    const ctx = this.ctx;
    const def = sim.world.nationDefs[a.nation];
    const hostile = me ? atWar(sim, me, a.nation) : false;
    const r = 8 + Math.min(5, Math.sqrt(regs));
    ctx.save();
    if (selected) {
      ctx.fillStyle = 'rgba(242, 212, 138, 0.45)';
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = def.color;
    ctx.strokeStyle = hostile ? '#e5604c' : a.nation === me ? '#f2d48a' : '#161a1f';
    ctx.lineWidth = hostile || a.nation === me ? 2.2 : 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${regs > 9 ? 10 : 11}px 'Source Sans 3 Variable', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(regs), x, y + 0.5);
    ctx.restore();
    this.markers.push({ army: a.id, x: x - r, y: y - r, w: r * 2, h: r * 2 });
    this.place({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  }

  private armyMarker(sim: Sim, a: Army, x: number, y: number, w: number, h: number, selected: boolean, me: NationId | null): void {
    const ctx = this.ctx;
    const def = sim.world.nationDefs[a.nation];
    const mine = a.nation === me;
    const hostile = me ? atWar(sim, me, a.nation) : false;
    ctx.save();
    if (selected) {
      ctx.shadowColor = 'rgba(242, 212, 138, 0.9)';
      ctx.shadowBlur = 10;
    } else {
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
    }
    // banner body
    ctx.fillStyle = '#161b21';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, 3);
    ctx.fill();
    // darken for text contrast
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x + 16, y + 1.5, w - 17.5, h - 3);
    ctx.strokeStyle = selected ? '#f2d48a' : hostile ? '#ff6a52' : mine ? 'rgba(242, 212, 138, 0.8)' : 'rgba(10,12,14,0.9)';
    ctx.lineWidth = selected ? 2.2 : hostile || mine ? 1.6 : 1;
    ctx.beginPath();
    ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 4);
    ctx.stroke();
    drawShield(ctx, def, x + 3.5, y + 3, 10.5);
    ctx.fillStyle = '#fffaf0';
    ctx.font = `700 12.5px 'Source Sans 3 Variable', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(a.regiments.length), x + 16 + (w - 17) / 2, y + h / 2 + 0.5);
    // morale bar
    const mm = maxMorale(sim, a.nation);
    const m = Math.max(0, Math.min(1, a.morale / mm));
    ctx.fillStyle = 'rgba(12, 14, 16, 0.85)';
    ctx.fillRect(x + 2, y + h + 1, w - 4, 3.5);
    ctx.fillStyle = m > 0.5 ? '#74c07a' : m > 0.25 ? '#e3ab3f' : '#e5604c';
    ctx.fillRect(x + 2, y + h + 1, (w - 4) * m, 3.5);
    // supply warning
    if (mine && a.supply < 0.8) {
      const col = a.supply < 0.4 ? '#e5604c' : '#e3ab3f';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x + w, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1712';
      ctx.font = `800 9px 'Source Sans 3 Variable', sans-serif`;
      ctx.fillText('!', x + w, y + 0.5);
    }
    if (a.retreating) {
      ctx.fillStyle = 'rgba(12,14,16,0.6)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 4);
      ctx.fill();
    }
    ctx.restore();
    void menOf;
  }

  private icon(name: Parameters<typeof iconPath>[0], x: number, y: number, size: number, color: string, stroke = 1.8): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = color;
    ctx.lineWidth = (stroke * 24) / size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(iconPath(name));
    ctx.restore();
  }

  private pill(x: number, y: number, text: string, bg: string, fg: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `700 12.5px 'Source Sans 3 Variable', sans-serif`;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bg;
    ctx.strokeStyle = 'rgba(242, 212, 138, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - 11, w, 22, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
    this.place({ x: x - w / 2, y: y - 11, w, h: 22 });
  }

  private flag(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1b1712';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.fillStyle = '#f2d48a';
    ctx.strokeStyle = '#1b1712';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(13, -18);
    ctx.lineTo(0, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ───────────────────────────── lettering ────────────────────────────────

  private drawLabels(sim: Sim, rs: RenderState, tier: Tier, visible: Array<{ id: string; lx: number; ly: number; lr: number; area: number }>): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const z = cam.zoom;
    const ppx = cam.provincePx;
    const density = rs.presentation.labels;

    // geographic names: seas, ranges, lakes (behind realm names)
    for (const l of this.geo.labels) {
      if (l.kind === 'region') continue;
      const s = cam.toScreen(l.x, l.y);
      if (s.x < -200 || s.y < -60 || s.x > this.width + 200 || s.y > this.height + 60) continue;
      const size = Math.max(10, Math.min(l.kind === 'sea' ? 30 : 17, (l.size ?? 40) * z));
      if (size < 10.5 || (l.kind !== 'sea' && tier === 'far' && size < 12)) continue;
      const water = l.kind === 'sea' || l.kind === 'lake';
      this.letter(l.name.toUpperCase(), s.x, s.y, l.angle ?? 0, size, {
        font: `italic 500 ${size}px 'Alegreya Variable', serif`,
        spacing: size * (water ? 0.3 : 0.18),
        fill: water ? 'rgba(214, 231, 236, 0.82)' : 'rgba(84, 66, 46, 0.85)',
        halo: water ? 'rgba(30, 60, 74, 0.5)' : 'rgba(240, 232, 212, 0.75)',
        haloW: water ? 2 : 3,
      });
    }

    // realm names at distance (largest first; shrink or skip on collision)
    if (ppx < 150) {
      const fade = ppx < 95 ? 1 : 1 - (ppx - 95) / 55;
      const alpha = fade * (rs.mode === 'political' || rs.mode === 'diplomacy' ? 0.92 : 0.6);
      const boxes: Rect[] = [];
      const items: Array<{ nid: NationId; name: string; size: number; lab: NonNullable<RealmShape['label']> }> = [];
      for (const [nid, rsh] of this.realms) {
        const lab = rsh.label;
        if (!lab) continue;
        const name = sim.world.nationDefs[nid].short.toUpperCase();
        ctx.font = `700 100px 'Alegreya SC', 'Alegreya Variable', serif`;
        const base = ctx.measureText(name).width + name.length * 22;
        const size = Math.min(((lab.len * z) / base) * 100, lab.wid * z * 0.42, 50);
        items.push({ nid, name, size, lab });
      }
      items.sort((a, b) => b.size - a.size);
      for (const it of alpha > 0.02 ? items : []) {
        const s = cam.toScreen(it.lab.x, it.lab.y);
        let size = it.size;
        let box: Rect | null = null;
        for (let tries = 0; tries < 3 && size >= 11; tries++, size *= 0.8) {
          ctx.font = `700 ${size}px 'Alegreya SC', 'Alegreya Variable', serif`;
          const w = ctx.measureText(it.name).width + size * 0.22 * (it.name.length - 1);
          const h = size * 0.9;
          const ca = Math.abs(Math.cos(it.lab.angle));
          const sa = Math.abs(Math.sin(it.lab.angle));
          const bw = w * ca + h * sa;
          const bh = w * sa + h * ca;
          const r = { x: s.x - bw / 2, y: s.y - bh / 2, w: bw, h: bh };
          if (!boxes.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y)) {
            box = r;
            break;
          }
        }
        if (!box || size < 11) continue;
        boxes.push(box);
        const def = sim.world.nationDefs[it.nid];
        ctx.save();
        ctx.globalAlpha = alpha;
        this.letter(it.name, s.x, s.y, it.lab.angle, size, {
          font: `700 ${size}px 'Alegreya SC', 'Alegreya Variable', serif`,
          spacing: size * 0.22,
          fill: shade(def.color, -0.55),
          halo: 'rgba(244, 236, 216, 0.55)',
          haloW: Math.max(2, size * 0.09),
          bend: it.lab.bend,
          register: false,
        });
        ctx.restore();
      }
    }

    // province names
    if (tier !== 'far') {
      const st = sim.state;
      const caps = new Set<string>();
      for (const n of Object.values(st.nations)) if (n.alive && n.capital) caps.add(n.capital);
      const minR = density === 'many' ? 13 : density === 'few' ? 26 : 18;
      const cands = visible
        .map((v) => ({ v, cap: caps.has(v.id), pri: (caps.has(v.id) ? 1e6 : 0) + st.provinces[v.id].dev * 1000 + v.area / 100 }))
        .filter((c) => c.cap || c.v.lr * z > minR)
        .sort((a, b) => b.pri - a.pri);
      for (const c of cands) {
        const name = sim.world.prov[c.v.id].name;
        const size = Math.max(11, Math.min(tier === 'close' ? 17 : 14.5, c.v.lr * z * 0.34)) + (c.cap ? 1 : 0);
        const s = cam.toScreen(c.v.lx, c.v.ly);
        const font = c.cap ? `700 ${size}px 'Alegreya SC', 'Alegreya Variable', serif` : `500 ${size}px 'Alegreya Variable', serif`;
        ctx.font = font;
        const w = ctx.measureText(name).width + (c.cap ? name.length * 0.8 : 0);
        const y = s.y + (c.cap ? 37 : 5);
        const r: Rect = { x: s.x - w / 2 - 2, y: y - size * 0.62, w: w + 4, h: size * 1.2 };
        // capitals are always named; other names give way to markers and each other
        if (!c.cap && this.overlaps(r)) continue;
        if (!c.cap && w > c.v.lr * z * 2.9) continue;
        this.place(r);
        this.letter(name, s.x, y, 0, size, { font, spacing: c.cap ? 0.8 : 0, fill: '#2a241c', halo: 'rgba(246, 239, 222, 0.88)', haloW: 3 });
        if (tier === 'close' && rs.mode === 'economy') {
          const dv = `dev ${st.provinces[c.v.id].dev}`;
          this.letter(dv, s.x, y + size * 0.95, 0, 11, { font: `600 11px 'Source Sans 3 Variable', sans-serif`, spacing: 0, fill: '#4a3a26', halo: 'rgba(246,239,222,0.8)', haloW: 2.5 });
        }
        if (tier === 'close' && rs.mode === 'terrain') {
          const t = sim.world.prov[c.v.id].terrain;
          this.letter(`${t} · move ${moveCostLabel(t)}`, s.x, y + size * 0.95, 0, 11, { font: `600 11px 'Source Sans 3 Variable', sans-serif`, spacing: 0, fill: '#4a3a26', halo: 'rgba(246,239,222,0.8)', haloW: 2.5 });
        }
        if (tier === 'close' && rs.mode === 'frontier' && st.provinces[c.v.id].owner) {
          this.letter(`${Math.floor(st.provinces[c.v.id].integration)}`, s.x, y + size * 0.95, 0, 11, { font: `700 11px 'Source Sans 3 Variable', sans-serif`, spacing: 0, fill: '#3a2e20', halo: 'rgba(246,239,222,0.8)', haloW: 2.5 });
        }
      }
    }
  }

  /** Spaced (optionally arched) lettering with a halo. */
  private letter(
    text: string,
    x: number,
    y: number,
    angle: number,
    size: number,
    o: { font: string; spacing: number; fill: string; halo: string; haloW: number; bend?: number; register?: boolean },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = o.font;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (!angle && !o.bend && !o.spacing) {
      // level, unspaced lettering (most place names): draw the string whole
      ctx.textAlign = 'center';
      ctx.strokeStyle = o.halo;
      ctx.lineWidth = o.haloW;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = o.fill;
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }
    ctx.textAlign = 'left';
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + o.spacing * (text.length - 1);
    ctx.translate(x, y);
    ctx.rotate(angle);
    const bend = o.bend ?? 0;
    const chars: Array<{ ch: string; x: number; y: number; r: number }> = [];
    let cx = -total / 2;
    for (let i = 0; i < text.length; i++) {
      const mid = cx + widths[i] / 2;
      const u = total ? mid / (total / 2) : 0; // -1..1
      const dy = bend ? bend * total * 0.5 * (1 - u * u) * -1 : 0;
      const rot = bend ? Math.atan(bend * u * 2) : 0;
      chars.push({ ch: text[i], x: mid, y: dy, r: rot });
      cx += widths[i] + o.spacing;
    }
    ctx.strokeStyle = o.halo;
    ctx.lineWidth = o.haloW;
    ctx.textAlign = 'center';
    for (const c of chars) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.strokeText(c.ch, 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = o.fill;
    for (const c of chars) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.r);
      ctx.fillText(c.ch, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    if (o.register !== false) void size;
  }

  /** Render a static preview of a world (menus, campaign setup). */
  static renderPreview(
    canvas: HTMLCanvasElement,
    geometry: MapGeometry,
    terrainOf: (id: string) => string,
    ownerOf: (id: string) => string | null,
    colorOf: (nid: string) => string,
    opts: { highlight?: string | null; dim?: boolean } = {},
  ): void {
    const geo = geoIndex(geometry);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || canvas.width;
    const h = canvas.clientHeight || canvas.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    const base = new BaseMap(geo, terrainOf);
    const b = geo.bounds;
    const z = Math.max(w / (b.maxX - b.minX), h / (b.maxY - b.minY));
    const offX = (w - (b.maxX - b.minX) * z) / 2 - b.minX * z;
    const offY = (h - (b.maxY - b.minY) * z) / 2 - b.minY * z;
    base.draw(ctx, z, offX, offY, w, h, dpr, 1e9);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * offX, dpr * offY);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const p of geo.provList) {
      const o = ownerOf(p.id);
      if (!o) continue;
      const hl = opts.highlight;
      ctx.globalAlpha = hl ? (o === hl ? 0.72 : 0.28) : 0.5;
      ctx.fillStyle = colorOf(o);
      ctx.fill(p.path);
    }
    ctx.restore();
    // realm borders
    const border = new Path2D();
    for (const e of geo.edges) {
      if (e.coast) continue;
      if (ownerOf(e.a) !== ownerOf(e.b)) border.addPath(e.path);
    }
    ctx.strokeStyle = 'rgba(33, 27, 21, 0.85)';
    ctx.lineWidth = 1.4 / z;
    ctx.stroke(border);
    if (opts.highlight) {
      const hp = new Path2D();
      for (const e of geo.edges) {
        const oa = ownerOf(e.a);
        const ob = e.coast ? null : ownerOf(e.b);
        if ((oa === opts.highlight) !== (ob === opts.highlight)) hp.addPath(e.path);
      }
      ctx.strokeStyle = '#f2d48a';
      ctx.lineWidth = 2.6 / z;
      ctx.stroke(hp);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.dim) {
      ctx.fillStyle = 'rgba(12, 17, 22, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  /** Screen transform for a preview (to place labels over it). */
  static previewTransform(geometry: MapGeometry, w: number, h: number) {
    const b = geometry.bounds;
    const z = Math.max(w / (b.maxX - b.minX), h / (b.maxY - b.minY));
    const offX = (w - (b.maxX - b.minX) * z) / 2 - b.minX * z;
    const offY = (h - (b.maxY - b.minY) * z) / 2 - b.minY * z;
    return { z, offX, offY };
  }
}

function moveCostLabel(t: string): string {
  return String(TERRAIN[t as keyof typeof TERRAIN]?.move ?? '?');
}

/** Darken (negative) or lighten (positive) a hex colour. */
export function shade(hex: string, amt: number): string {
  const v = parseInt(hex.slice(1), 16);
  let r = (v >> 16) & 255;
  let g = (v >> 8) & 255;
  let b = v & 255;
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export { PALETTE };
