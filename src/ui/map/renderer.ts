// The strategic map, drawn as an ivory war atlas. Layers, bottom to top:
//   base geography (cached tiles) → mode washes → occupation hatching →
//   province and realm borders, rivers → straits and railways → highlights →
//   routes → markers (battles, sites, counters, fleets, air wings) → lettering.
// Strokes and markers are sized in screen pixels (map-rendering.json). Every
// counter, marker and name is placed through one screen-space collision
// registry, in the pack's order of priority: unit counters, the selected
// province, capitals, geographic features, realms, then province names. What
// cannot be placed is hidden; full names stay in the inspector.

import { activeMission } from '../../sim/air';
import { SHIPS, TERRAIN } from '../../sim/config';
import { entrenchBonus } from '../../sim/combat';
import { maxMorale } from '../../sim/military';
import { fleetsIn, subPower, surfacePower } from '../../sim/naval';
import { moveCost } from '../../sim/movement';
import { memoEpochNow } from '../../sim/index';
import { atWar, isFriendly, menOf, type Sim } from '../../sim/state';
import type { Army, Fleet, NationId, ProvinceId, UnitType } from '../../sim/types';
import { HEADING, SANS } from '../fonts';
import { drawShield } from '../heraldry';
import { BaseMap, PALETTE, type TerrainDetail } from './basemap';
import { Camera } from './camera';
import { geoIndex, pairKey, type GeoIndex, type MapGeometry, type ProvGeo } from './geometry';
import { buildContext, fillFor, realmFill, realmInk, realmWash, type MapMode } from './modes';
import { LANDMARK_BOUNDS, landmark, sprite } from './sprites';

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
  /** draw a brass outline around this realm (campaign setup) */
  outlineRealm?: NationId | null;
  /** navy and air selections */
  selectedFleet?: string | null;
  selectedZone?: string | null;
  selectedWing?: string | null;
  /** route preview for the selected fleet (sea zones) */
  fleetPreview?: string[] | null;
  fleetPreviewLabel?: string | null;
  /** trade deliveries to draw (Industry & Trade open): [from province, to province] */
  tradeRoutes?: Array<{ from: ProvinceId; to: ProvinceId; sea: boolean }> | null;
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
  label: RealmLabel | null;
}

interface RealmLabel {
  x: number;
  y: number;
  angle: number;
  len: number;
  wid: number;
  bend: number;
  /** other good frames, tried in order when this one collides with a larger realm's name */
  alts: RealmLabel[];
}

export type Tier = 'far' | 'medium' | 'close';

// ── the atlas palette (design/tokens.json and design/map-rendering.json) ──
const INK = '#253332';
const IVORY = '#eee7d7';
const IVORY_RAISED = '#f5efe2';
const SLATE = '#384342';
const BRASS = '#c2ab72';
const BRASS_INK = '#665322';
const DANGER = '#9c3b33';
const POSITIVE = '#406448';
const WARNING = '#70531f';
const ROUTE = '#365c70';
const MUTED = '#59645d';
const LINE = {
  province: { stroke: '#787e6d', px: 0.65, opacity: 0.65 },
  realm: { stroke: '#53604f', px: 2.0 },
  selected: { stroke: BRASS_INK, px: 2.8, under: IVORY_RAISED, underPx: 4.8 },
  armyOrder: { stroke: DANGER, px: 2.5, under: IVORY_RAISED, underPx: 4.5 },
  trade: { stroke: ROUTE, px: 2.0, dash: [6, 4] },
  road: { stroke: '#77816d', px: 0.8, opacity: 0.55 },
  river: { stroke: '#7ca1a7', px: 1.3, opacity: 0.95 },
};
const SEA_INK = '#4d6d73';
const RANGE_INK = '#5f5f50';

/** The branch symbol for an army: its most numerous regiment type. */
const BRANCH: Record<UnitType, string> = { infantry: 'infantry', cavalry: 'cavalry', artillery: 'artillery', engineers: 'support', armour: 'armor' };
function branchOf(a: Army): string {
  const n = new Map<UnitType, number>();
  for (const r of a.regiments) n.set(r.type, (n.get(r.type) ?? 0) + 1);
  let best: UnitType = 'infantry';
  let bn = 0;
  for (const [t, c] of n) if (c > bn || (c === bn && t === 'infantry')) (best = t), (bn = c);
  return BRANCH[best];
}

/** One screen-space collision registry: everything placed this frame. */
class Registry {
  private rects: Rect[] = [];
  private boxes: OBox[] = [];
  /** names and markers left out this frame for lack of room (for checks) */
  skipped = 0;
  clear(): void {
    this.rects = [];
    this.boxes = [];
    this.skipped = 0;
  }
  add(r: Rect): void {
    this.rects.push(r);
  }
  addBox(b: OBox): void {
    this.boxes.push(b);
  }
  hits(r: Rect): boolean {
    for (const q of this.rects) if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) return true;
    if (this.boxes.length) {
      const b = orientedBox(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0);
      for (const q of this.boxes) if (boxesOverlap(b, q)) return true;
    }
    return false;
  }
  hitsBox(b: OBox, extra: Rect[] = []): boolean {
    for (const q of this.rects) if (boxesOverlap(b, orientedBox(q.x + q.w / 2, q.y + q.h / 2, q.w, q.h, 0))) return true;
    for (const q of extra) if (boxesOverlap(b, orientedBox(q.x + q.w / 2, q.y + q.h / 2, q.w, q.h, 0))) return true;
    for (const q of this.boxes) if (boxesOverlap(b, q)) return true;
    return false;
  }
  get count(): number {
    return this.rects.length + this.boxes.length;
  }
}

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly camera: Camera;
  readonly geo: GeoIndex;
  readonly base: BaseMap;
  markers: Marker[] = [];
  fleetMarkers: Array<{ fleet: string; x: number; y: number; w: number; h: number }> = [];
  battleMarkers: Array<{ battle: string; province: ProvinceId; x: number; y: number; r: number }> = [];
  /** what the last frame placed (names and markers) and left out: for browser checks */
  readonly placed = new Registry();
  dpr = 1;
  width = 0;
  height = 0;
  /** called when lazily loaded art (landmarks) arrives */
  onArt: (() => void) | null = null;
  private realmKey = '';
  private realms = new Map<NationId, RealmShape>();
  /** realm lettering frames, reused while a realm's territory is unchanged */
  private labelCache = new Map<NationId, { sig: string; label: RealmShape['label'] }>();
  private riverPath: Path2D | null = null;
  private patternCache = new Map<string, CanvasPattern | null>();
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

  /** World (far), regional (medium) and local (close) views, by projected province size. */
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

  /** Sea zone under a screen point (CSS pixels), if it is not on land. */
  zoneAt(sx: number, sy: number): string | null {
    const w = this.camera.toWorld(sx, sy);
    if (this.geo.provinceAt(w.x, w.y)) return null;
    return this.geo.zoneAt(w.x, w.y);
  }

  fleetAt(sx: number, sy: number): string | null {
    for (let i = this.fleetMarkers.length - 1; i >= 0; i--) {
      const m = this.fleetMarkers[i];
      if (sx >= m.x - 4 && sx <= m.x + m.w + 4 && sy >= m.y - 4 && sy <= m.y + m.h + 4) return m.fleet;
    }
    return null;
  }

  zoneCenter(id: string): { x: number; y: number } {
    return this.geo.zoneAnchors.get(id) ?? { x: 0, y: 0 };
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
    this.base.setDetail(rs.presentation.terrain);
    const complete = this.base.draw(ctx, cam.zoom, cam.offX, cam.offY, this.width, this.height, dpr, animating ? 6 : 12);
    this.pending = !complete;

    const z = cam.zoom;
    const tier = this.tier();
    const view = cam.viewRect(60);
    const visible = this.geo.provincesIn(view[0], view[1], view[2], view[3]);
    this.ensureRealms(sim);

    // world transform
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * cam.offX, dpr * cam.offY);
    const px = 1 / z; // one CSS pixel in world units

    // 1–3. washes, hatching, borders and rivers: at the far tier, while the
    // camera only pans, from a cached layer (redrawn when the realms, the mode
    // or the zoom change); otherwise drawn directly
    const mctx = buildContext(sim, rs.mode, rs.player);
    const farLayer = tier === 'far' && !animating && this.lod ? this.farLayers(sim, rs, tier, mctx) : null;
    if (farLayer) {
      const x = dpr * (cam.offX + farLayer.x0 * z);
      const y = dpr * (cam.offY + farLayer.y0 * z);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(farLayer.wash, x, y);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(farLayer.lines, x, y);
      ctx.restore();
    } else this.paintRealmLayers(ctx, sim, rs, tier, px, view, visible, { wash: true, lines: true, washComposite: 'multiply' }, mctx);
    if (rs.outlineRealm) {
      const r = this.realms.get(rs.outlineRealm);
      if (r) this.understroked(r.outline, BRASS_INK, 2.8 * px, IVORY_RAISED, 5 * px);
    }

    // 4. sea zones, straits and fords, railways
    this.drawSeaZones(sim, rs, tier, px);
    this.drawStraits(px);
    if (tier === 'close' || rs.mode === 'supply') this.drawRoads(sim, px, visible);

    // 5. highlights
    if (rs.highlight?.length) {
      ctx.save();
      ctx.setLineDash([6 * px, 4 * px]);
      ctx.strokeStyle = BRASS_INK;
      ctx.lineWidth = 2.2 * px;
      for (const id of rs.highlight) {
        const p = this.geo.provs.get(id);
        if (p) ctx.stroke(p.path);
      }
      ctx.restore();
    }
    if (rs.mode === 'military' && mctx.fronts?.size) {
      ctx.save();
      ctx.strokeStyle = DANGER;
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
        ctx.fillStyle = 'rgba(245, 239, 226, 0.28)';
        ctx.fill(p.path);
        ctx.strokeStyle = 'rgba(37, 51, 50, 0.55)';
        ctx.lineWidth = 1.2 * px;
        ctx.stroke(p.path);
        ctx.restore();
      }
    }
    if (rs.selectedProvince) {
      const p = this.geo.provs.get(rs.selectedProvince);
      if (p) {
        ctx.save();
        ctx.clip(p.path);
        ctx.fillStyle = 'rgba(194, 171, 114, 0.16)';
        ctx.fill(p.path);
        ctx.restore();
        this.understroked(p.path, LINE.selected.stroke, LINE.selected.px * px, LINE.selected.under, LINE.selected.underPx * px);
      }
    }

    // 6. routes (world space, constant screen width)
    if (rs.tradeRoutes?.length) this.drawTradeRoutes(rs.tradeRoutes, px);
    const armies = Object.values(sim.state.armies);
    const pos = new Map<string, { x: number; y: number }>();
    for (const a of armies) pos.set(a.id, this.armyPos(sim, a));
    for (const a of armies) {
      if (a.embarked || !a.path.length || a.id === rs.selectedArmy) continue;
      const mine = a.nation === rs.player;
      const hostile = rs.player ? atWar(sim, rs.player, a.nation) : false;
      if (!mine && !hostile) continue;
      if (tier === 'far' && !hostile) continue;
      // our orders in brick red; enemy marches in ink, both dashed when not selected
      this.drawRoute(pos.get(a.id)!, a.path, mine ? DANGER : INK, px, true, a.retreating ? 0.6 : 0.8);
    }
    this.drawFleetRoutes(sim, rs, tier, px);
    this.drawAirMissions(sim, rs, tier, px);
    const sel = rs.selectedArmy ? sim.state.armies[rs.selectedArmy] : undefined;
    if (sel?.path.length) this.drawRoute(pos.get(sel.id)!, sel.path, LINE.armyOrder.stroke, px, false, 1);
    if (sel && rs.previewPath?.length) this.drawRoute(pos.get(sel.id)!, rs.previewPath, rs.previewBad ? MUTED : LINE.armyOrder.stroke, px, true, 1);

    // screen-space layers, all through one collision registry
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.placed.clear();
    this.markers = [];
    this.fleetMarkers = [];
    this.battleMarkers = [];
    const t = now / 1000;
    this.drawBattles(sim, rs, t);
    this.drawArmies(sim, rs, tier, pos);
    this.drawFleets(sim, rs, tier);
    this.drawWings(sim, rs, tier);
    const fsel = rs.selectedFleet ? sim.state.fleets[rs.selectedFleet] : undefined;
    if (fsel && rs.fleetPreview?.length && rs.fleetPreviewLabel) {
      const end = this.zoneCenter(rs.fleetPreview[rs.fleetPreview.length - 1]);
      const s = cam.toScreen(end.x, end.y);
      this.pill(s.x, s.y - 34, rs.fleetPreviewLabel, false);
    }
    if (sel && rs.previewPath?.length && rs.previewLabel) {
      const end = this.provinceCenter(rs.previewPath[rs.previewPath.length - 1]);
      const s = cam.toScreen(end.x, end.y);
      this.pill(s.x, s.y - 30, rs.previewLabel, !!rs.previewBad);
    } else if (sel?.path.length) {
      const end = this.provinceCenter(sel.path[sel.path.length - 1]);
      const s = cam.toScreen(end.x, end.y);
      this.flag(s.x, s.y);
    }
    this.drawSites(sim, rs, tier, visible);
    this.drawZoneNames(rs, tier);
    this.drawLabels(sim, rs, tier, visible);
    return animating || this.pending || (!rs.reducedMotion && Object.keys(sim.state.battles).length > 0);
  }

  /** A line over a lighter understroke (selection, order routes), both in world units. */
  private understroked(path: Path2D, color: string, w: number, under: string, underW: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = under;
    ctx.lineWidth = underW;
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke(path);
    ctx.restore();
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
    // steeper frames are only worth trying for tall realms
    const tall = whi - wlo > (hi - lo) * 1.3 || Math.abs(0.5 * Math.atan2(2 * cxy, cxx - cyy)) > 0.9;
    const angles = [...new Set([angle, angle / 2, 0, -0.25, 0.25, ...(tall ? [-0.6, 0.6] : [])].map((v) => Math.round(v * 100) / 100))];
    const fits: Array<{ x: number; y: number; angle: number; len: number; wid: number; score: number }> = [];
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
        const score = Math.min(len / 7, wid * 0.42) * (1 - Math.abs(ang) * 0.25) * (Math.abs(ang) > 0.4 ? 0.8 : 1);
        fits.push({ x, y, angle: ang, len, wid, score });
      }
    }
    if (!fits.length) return null;
    fits.sort((a, b) => b.score - a.score);
    // the best frame, then up to three alternatives that differ from it in place or angle
    const picked: typeof fits = [];
    for (const f of fits) {
      if (picked.length >= 4) break;
      if (f.score < fits[0].score * 0.45) break;
      if (picked.some((q) => Math.hypot(q.x - f.x, q.y - f.y) < this.geo.provScale * 1.2 && Math.abs(q.angle - f.angle) < 0.3)) continue;
      picked.push(f);
    }
    const bend = Math.sign(above) * Math.min(0.04, (0.5 * Math.abs(above)) / sw);
    const frame = (f: (typeof fits)[number]): RealmLabel => ({ x: f.x, y: f.y, angle: f.angle, len: f.len * 0.9, wid: f.wid, bend: Math.abs(f.angle) > 0.1 ? bend : 0, alts: [] });
    const [first, ...rest] = picked.map(frame);
    first.alts = rest;
    return first;
  }

  /** Far-tier level of detail (cached layers while panning); the benchmark turns it off to compare. */
  lod = true;
  private farCache: { key: string; wash: HTMLCanvasElement; lines: HTMLCanvasElement; x0: number; y0: number } | null = null;
  /** Far-tier layers covering the whole map at the current zoom; null when too large to keep. */
  private farLayers(sim: Sim, rs: RenderState, tier: Tier, mctx: ReturnType<typeof buildContext>): { wash: HTMLCanvasElement; lines: HTMLCanvasElement; x0: number; y0: number } | null {
    const z = this.camera.zoom;
    const dpr = this.dpr;
    const b = this.geo.bounds;
    const w = Math.ceil((b.maxX - b.minX) * z * dpr);
    const h = Math.ceil((b.maxY - b.minY) * z * dpr);
    if (w * h > 9e6 || w < 1 || h < 1) return null;
    const st = sim.state;
    const key = [st.tick, st.rev, memoEpochNow(), rs.mode, rs.focusNation, rs.player, rs.presentation.borders, rs.presentation.patterns, z, dpr].join('|');
    if (this.farCache?.key === key) return this.farCache;
    const make = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };
    const wash = make();
    const lines = make();
    const px = 1 / z;
    const all = this.geo.provList;
    const view: [number, number, number, number] = [b.minX, b.minY, b.maxX, b.maxY];
    for (const [c, parts] of [
      [wash, { wash: true, lines: false, washComposite: 'source-over' as GlobalCompositeOperation }],
      [lines, { wash: false, lines: true, washComposite: 'source-over' as GlobalCompositeOperation }],
    ] as const) {
      const g = c.getContext('2d')!;
      g.setTransform(dpr * z, 0, 0, dpr * z, -b.minX * dpr * z, -b.minY * dpr * z);
      this.paintRealmLayers(g, sim, rs, tier, px, view, all, parts, mctx);
    }
    this.farCache = { key, wash, lines, x0: b.minX, y0: b.minY };
    return this.farCache;
  }

  /** Mode washes, occupation hatching, borders, realm edges and rivers. */
  private paintRealmLayers(
    ctx: CanvasRenderingContext2D,
    sim: Sim,
    rs: RenderState,
    tier: Tier,
    px: number,
    view: [number, number, number, number],
    visible: ProvGeo[],
    parts: { wash: boolean; lines: boolean; washComposite: GlobalCompositeOperation },
    mctx: ReturnType<typeof buildContext>,
  ): void {
    const groups = new Map<string, Path2D>();
    const hatches: Array<{ id: ProvinceId; color: string }> = [];
    for (const p of visible) {
      const f = fillFor(rs.mode, mctx, p.id, rs.focusNation);
      if (f.alpha > 0 && parts.wash) {
        const k = `${f.color}|${f.alpha}`;
        let g = groups.get(k);
        if (!g) groups.set(k, (g = new Path2D()));
        g.addPath(p.path);
      }
      if (f.hatch && parts.lines) hatches.push({ id: p.id, color: f.hatch });
    }
    // 1. mode washes (multiply: the printed terrain stays visible)
    if (parts.wash) {
      ctx.save();
      ctx.globalCompositeOperation = parts.washComposite;
      for (const [k, path] of groups) {
        const [color, alpha] = k.split('|');
        ctx.globalAlpha = Number(alpha);
        ctx.fillStyle = color;
        ctx.fill(path);
      }
      ctx.restore();
    }
    if (!parts.lines) return;

    // 2. occupation / war hatching
    for (const hch of hatches) {
      const pat = this.hatchPattern(hch.color);
      if (!pat) continue;
      // one pattern pixel = one CSS pixel, anchored to the map
      pat.setTransform(new DOMMatrix([px, 0, 0, px, 0, 0]));
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = pat;
      ctx.fill(this.geo.provs.get(hch.id)!.path);
      ctx.restore();
    }

    // 3. province borders (fine, solid), then realm borders
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
      ctx.save();
      ctx.globalAlpha = LINE.province.opacity * (bstyle === 'subtle' ? 0.75 : 1);
      ctx.strokeStyle = LINE.province.stroke;
      ctx.lineWidth = LINE.province.px * (tier === 'close' ? 1.3 : 1) * px;
      ctx.stroke(thin);
      ctx.restore();
    }
    // a narrow inner edge in each realm's own hue: identity does not rest on the wash alone
    if (rs.mode === 'political' || rs.mode === 'diplomacy') {
      const edgeW = (bstyle === 'strong' ? 6 : bstyle === 'subtle' ? 3 : 4.5) * px;
      for (const [nid, rsh] of this.realms) {
        ctx.save();
        ctx.clip(rsh.union);
        ctx.globalAlpha = rs.mode === 'political' ? 0.5 : 0.3;
        ctx.strokeStyle = realmFill(sim.world.nationDefs[nid].color);
        ctx.lineWidth = edgeW * 2;
        ctx.stroke(rsh.border);
        ctx.restore();
      }
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
      ctx.globalAlpha = LINE.river.opacity;
      ctx.strokeStyle = LINE.river.stroke;
      ctx.lineWidth = LINE.river.px * (tier === 'close' ? 1.5 : 1) * px;
      ctx.stroke(this.riverPath);
      ctx.restore();
    }
    const realmBorder = new Path2D();
    for (const rsh of this.realms.values()) realmBorder.addPath(rsh.border);
    ctx.strokeStyle = LINE.realm.stroke;
    ctx.lineWidth = LINE.realm.px * (bstyle === 'strong' ? 1.35 : bstyle === 'subtle' ? 0.7 : 1) * px;
    ctx.lineJoin = 'round';
    ctx.stroke(realmBorder);
  }

  private hatchPattern(color: string): CanvasPattern | null {
    if (this.patternCache.has(color)) return this.patternCache.get(color)!;
    const c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    const g = c.getContext('2d');
    if (!g) return null;
    g.strokeStyle = color;
    g.lineWidth = 1.6;
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

  /** Strait crossings: a dashed ink ferry line. */
  private drawStraits(px: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    for (const [a, b] of this.geo.straits) {
      const pa = this.provinceCenter(a);
      const pb = this.provinceCenter(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = 'rgba(245, 239, 226, 0.85)';
      ctx.lineWidth = 3.4 * px;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([4 * px, 3 * px]);
      ctx.strokeStyle = SEA_INK;
      ctx.lineWidth = 1.4 * px;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Railways (infrastructure): fine lines, heavier for higher levels, dashed at level 1. */
  private drawRoads(sim: Sim, px: number, visible: Array<{ id: string }>): void {
    const ctx = this.ctx;
    const st = sim.state;
    const vis = new Set(visible.map((v) => v.id));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = LINE.road.stroke;
    for (const id of vis) {
      const inf = st.provinces[id].infra;
      if (!inf) continue;
      const pa = this.provinceCenter(id);
      for (const n of sim.world.prov[id].neighbors) {
        if (n < id && vis.has(n)) continue;
        const lvl = Math.min(inf, st.provinces[n].infra);
        if (!lvl || sim.world.straitSet.has(pairKey(id, n))) continue;
        const pb = this.provinceCenter(n);
        ctx.globalAlpha = LINE.road.opacity + lvl * 0.12;
        ctx.lineWidth = (LINE.road.px + (lvl - 1) * 0.5) * px;
        ctx.setLineDash(lvl >= 2 ? [] : [5 * px, 3 * px]);
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
        if (lvl >= 3) {
          // cross-ties on main lines
          const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
          const ux = (pb.x - pa.x) / len;
          const uy = (pb.y - pa.y) / len;
          ctx.setLineDash([]);
          ctx.lineWidth = 0.8 * px;
          ctx.beginPath();
          for (let d = 6 * px; d < len - 6 * px; d += 9 * px) {
            const cx = pa.x + ux * d;
            const cy = pa.y + uy * d;
            ctx.moveTo(cx - uy * 2.5 * px, cy + ux * 2.5 * px);
            ctx.lineTo(cx + uy * 2.5 * px, cy - ux * 2.5 * px);
          }
          ctx.stroke();
        }
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
    ctx.strokeStyle = LINE.armyOrder.under;
    ctx.lineWidth = LINE.armyOrder.underPx * weight * px;
    ctx.stroke(line);
    ctx.strokeStyle = color;
    ctx.lineWidth = LINE.armyOrder.px * weight * px;
    if (dashed) ctx.setLineDash([7 * px, 5 * px]);
    ctx.stroke(line);
    ctx.setLineDash([]);
    this.arrowHead(pts.length > 2 ? { x: (pts[pts.length - 2].x + last.x) / 2, y: (pts[pts.length - 2].y + last.y) / 2 } : pts[0], last, color, 9 * weight * px, px);
    ctx.restore();
  }

  private arrowHead(prev: { x: number; y: number }, last: { x: number; y: number }, color: string, s: number, px: number): void {
    const ctx = this.ctx;
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
    ctx.save();
    ctx.translate(last.x, last.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(s * 0.4, 0);
    ctx.lineTo(-s, -s * 0.66);
    ctx.lineTo(-s * 0.6, 0);
    ctx.lineTo(-s, s * 0.66);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = IVORY_RAISED;
    ctx.lineWidth = 1.2 * px;
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  /** Trade deliveries: dashed blue-grey lines with a direction marker at the midpoint. */
  private drawTradeRoutes(routes: Array<{ from: ProvinceId; to: ProvinceId; sea: boolean }>, px: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    for (const r of routes) {
      const a = this.provinceCenter(r.from);
      const b = this.provinceCenter(r.to);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.12;
      const path = new Path2D();
      path.moveTo(a.x, a.y);
      path.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.strokeStyle = 'rgba(245, 239, 226, 0.8)';
      ctx.lineWidth = (LINE.trade.px + 2) * px;
      ctx.setLineDash([]);
      ctx.stroke(path);
      ctx.strokeStyle = LINE.trade.stroke;
      ctx.lineWidth = LINE.trade.px * px;
      ctx.setLineDash(LINE.trade.dash.map((d) => d * px));
      ctx.stroke(path);
      // direction: an arrowhead at the curve's midpoint
      const qx = 0.25 * a.x + 0.5 * mx + 0.25 * b.x;
      const qy = 0.25 * a.y + 0.5 * my + 0.25 * b.y;
      ctx.setLineDash([]);
      this.arrowHead({ x: qx - (b.x - a.x) * 0.05, y: qy - (b.y - a.y) * 0.05 }, { x: qx, y: qy }, LINE.trade.stroke, 8 * px, px);
    }
    ctx.restore();
  }

  // ───────────────────────────── sea and air ──────────────────────────────

  /** Zone borders (world space); in the military and sea modes, who holds each zone. */
  private drawSeaZones(sim: Sim, rs: RenderState, tier: Tier, px: number): void {
    const geo = this.geo;
    if (!geo.zoneIds.length) return;
    const ctx = this.ctx;
    const me = rs.player;
    ctx.save();
    if ((rs.mode === 'military' && me) || rs.mode === 'sea' || rs.selectedZone) ctx.clip(geo.seaClip(), 'evenodd');
    if (rs.mode === 'sea') {
      // every zone in the colour of the realm with the strongest warships there
      for (const z of geo.zoneIds) {
        const power = new Map<string, number>();
        for (const f of fleetsIn(sim, z)) power.set(f.nation, (power.get(f.nation) ?? 0) + surfacePower(f) + subPower(f) * 0.5);
        let best: string | null = null;
        let bp = 0;
        for (const [n, p] of [...power].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (p > bp) (best = n), (bp = p);
        if (!best) continue;
        const path = geo.zonePath(z);
        if (!path) continue;
        // a light wash in the realm's colour: the water must still read as water (the zone
        // paths are unions of cells, so they are filled, never stroked)
        ctx.save();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = realmFill(sim.world.nationDefs[best]?.color ?? '#5d79a8');
        ctx.fill(path);
        ctx.restore();
      }
    }
    if (rs.mode === 'military' && me) {
      for (const z of geo.zoneIds) {
        let ours = 0;
        let theirs = 0;
        for (const f of fleetsIn(sim, z)) {
          const p = surfacePower(f) + subPower(f) * 0.5;
          if (f.nation === me || isFriendly(sim, me, f.nation)) ours += p;
          else if (atWar(sim, me, f.nation)) theirs += p;
        }
        if (ours <= 0 && theirs <= 0) continue;
        const path = geo.zonePath(z);
        if (!path) continue;
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = theirs <= 0 ? ROUTE : ours <= 0 ? DANGER : ours >= theirs ? '#5f7f8c' : '#8a5a50';
        ctx.fill(path);
        ctx.restore();
      }
    }
    if (rs.selectedZone) {
      const path = geo.zonePath(rs.selectedZone);
      if (path) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = BRASS;
        ctx.fill(path);
        ctx.restore();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = tier === 'far' ? 'rgba(77, 109, 115, 0.22)' : 'rgba(77, 109, 115, 0.38)';
    ctx.lineWidth = (tier === 'far' ? 0.8 : 1) * px;
    ctx.setLineDash([6 * px, 5 * px]);
    ctx.stroke(geo.zoneBorders);
    ctx.restore();
  }

  /** A fleet's position on the map: its zone anchor, partway to the next zone when sailing. */
  fleetPos(f: Fleet): { x: number; y: number } {
    const here = this.zoneCenter(f.zone);
    if (!f.path.length || f.progress <= 0) return here;
    const next = this.zoneCenter(f.path[0]);
    const u = Math.max(0, Math.min(0.85, f.progress));
    return { x: here.x + (next.x - here.x) * u, y: here.y + (next.y - here.y) * u };
  }

  private seaRoute(from: { x: number; y: number }, zones: string[], color: string, px: number, dashed: boolean, weight: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(245, 239, 226, 0.75)';
    ctx.lineWidth = (2.4 * weight + 2) * px;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const path = new Path2D();
    path.moveTo(from.x, from.y);
    for (const z of zones) {
      const c = this.zoneCenter(z);
      path.lineTo(c.x, c.y);
    }
    ctx.stroke(path);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2 * weight * px;
    if (dashed) ctx.setLineDash([8 * px, 6 * px]);
    ctx.stroke(path);
    ctx.restore();
  }

  private drawFleetRoutes(sim: Sim, rs: RenderState, tier: Tier, px: number): void {
    const me = rs.player;
    for (const f of Object.values(sim.state.fleets)) {
      if (!f.path.length || f.id === rs.selectedFleet) continue;
      const mine = f.nation === me;
      const hostile = me ? atWar(sim, me, f.nation) : false;
      if (!mine && !hostile) continue;
      if (tier === 'far' && !hostile) continue;
      this.seaRoute(this.fleetPos(f), f.path, mine ? ROUTE : INK, px, true, 0.9);
    }
    const sel = rs.selectedFleet ? sim.state.fleets[rs.selectedFleet] : undefined;
    if (sel?.path.length) this.seaRoute(this.fleetPos(sel), sel.path, ROUTE, px, false, 1.2);
    if (sel && rs.fleetPreview?.length) this.seaRoute(this.fleetPos(sel), rs.fleetPreview, BRASS_INK, px, true, 1.1);
    // the beach a fleet with troops is heading for
    if (sel?.landing) {
      const p = this.geo.provs.get(sel.landing);
      if (p) {
        this.ctx.save();
        this.ctx.setLineDash([5 * px, 4 * px]);
        this.ctx.strokeStyle = BRASS_INK;
        this.ctx.lineWidth = 2.2 * px;
        this.ctx.stroke(p.path);
        this.ctx.restore();
      }
    }
  }

  private drawAirMissions(sim: Sim, rs: RenderState, tier: Tier, px: number): void {
    if (tier === 'far') return;
    const ctx = this.ctx;
    const me = rs.player;
    for (const w of Object.values(sim.state.wings)) {
      if (!w.target || w.mission === 'idle') continue;
      const mine = w.nation === me;
      const hostile = me ? atWar(sim, me, w.nation) : false;
      const selected = w.id === rs.selectedWing;
      if (!selected && !mine && !hostile) continue;
      if (!activeMission(sim, w)) continue;
      const a = this.provinceCenter(w.base);
      const b = this.provinceCenter(w.target);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.18;
      ctx.save();
      ctx.strokeStyle = selected ? BRASS_INK : mine ? ROUTE : DANGER;
      ctx.lineWidth = (selected ? 2 : 1.4) * px;
      ctx.setLineDash([3 * px, 4 * px]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      if (selected) {
        // the mission area: the target and its neighbours (bombing: the target)
        const area = w.mission === 'bombing' ? [w.target] : [w.target, ...sim.world.prov[w.target].neighbors];
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(194, 171, 114, 0.16)';
        for (const id of area) {
          const p = this.geo.provs.get(id);
          if (p) ctx.fill(p.path);
        }
      }
      ctx.restore();
    }
  }

  private drawFleets(sim: Sim, rs: RenderState, tier: Tier): void {
    const cam = this.camera;
    const me = rs.player;
    const byZone = new Map<string, Fleet[]>();
    for (const id of Object.keys(sim.state.fleets).sort()) {
      const f = sim.state.fleets[id];
      const mine = f.nation === me;
      const hostile = me ? atWar(sim, me, f.nation) : false;
      if (!mine && !hostile && f.id !== rs.selectedFleet && rs.presentation.armies === 'mine') continue;
      if (!mine && !hostile && tier === 'far' && f.id !== rs.selectedFleet) continue;
      const k = f.path.length && f.progress > 0 ? `m${f.id}` : f.zone;
      (byZone.get(k) ?? byZone.set(k, []).get(k)!).push(f);
    }
    for (const list of byZone.values()) {
      list.sort((a, b) => (a.nation === me ? -1 : 0) - (b.nation === me ? -1 : 0) || (a.id < b.id ? -1 : 1));
      const base = this.fleetPos(list[0]);
      const s = cam.toScreen(base.x, base.y);
      if (s.x < -80 || s.y < -80 || s.x > this.width + 80 || s.y > this.height + 80) continue;
      const kind = this.counterKind(tier);
      const dims = list.map((f) => this.counterSize(kind, String(f.ships.length)));
      const total = dims.reduce((x, d) => x + d.w + 3, -3);
      let x = s.x - total / 2;
      list.forEach((f, i) => {
        const { w, h } = dims[i];
        const y = s.y - h / 2;
        // bars: average hull condition, and the share of ships fit to fight (hull at least half)
        const hp = f.ships.reduce((a, sh) => a + sh.hp, 0) / Math.max(1, f.ships.length) / 100;
        const fit = f.ships.filter((sh) => sh.hp >= 50).length / Math.max(1, f.ships.length);
        this.counter(sim, {
          kind,
          nation: f.nation,
          x,
          y,
          symbol: 'naval',
          count: String(f.ships.length),
          detail: `${f.ships.length} ship${f.ships.length === 1 ? '' : 's'}${f.cargo.length ? ` · ${f.cargo.length} army` : ''}`,
          bars: [hp, fit],
          status: f.cargo.length ? 'moving' : null,
          relation: this.relation(sim, f.nation, me),
          selected: f.id === rs.selectedFleet,
        });
        this.fleetMarkers.push({ fleet: f.id, x, y, w, h });
        this.placed.add({ x, y, w, h });
        x += w + 3;
      });
    }
    void SHIPS;
  }

  private drawWings(sim: Sim, rs: RenderState, tier: Tier): void {
    if (tier === 'far') return;
    const me = rs.player;
    const at = new Map<ProvinceId, { nation: NationId; n: number; sel: boolean }>();
    for (const w of Object.values(sim.state.wings)) {
      const mine = w.nation === me;
      const hostile = me ? atWar(sim, me, w.nation) : false;
      if (!mine && !hostile && w.id !== rs.selectedWing && rs.presentation.armies !== 'all') continue;
      const cur = at.get(w.base) ?? { nation: w.nation, n: 0, sel: false };
      cur.n++;
      if (w.id === rs.selectedWing) cur.sel = true;
      at.set(w.base, cur);
    }
    for (const [pid, v] of at) {
      const c = this.provinceCenter(pid);
      const s = this.camera.toScreen(c.x, c.y);
      const kind = 'pill';
      const { w, h } = this.counterSize(kind, String(v.n));
      const x = s.x + 16;
      const y = s.y + 2;
      if (x < -40 || y < -40 || x > this.width + 40 || y > this.height + 40) continue;
      this.counter(sim, { kind, nation: v.nation, x, y, symbol: 'air', count: String(v.n), detail: '', bars: null, status: null, relation: this.relation(sim, v.nation, me), selected: v.sel });
      this.placed.add({ x, y, w, h });
    }
  }

  /** Sea-zone names on open water (the map's printed sea names are not repeated). */
  private drawZoneNames(rs: RenderState, tier: Tier): void {
    if (tier === 'far' || rs.presentation.labels === 'few') return;
    const printed = new Set(this.geo.labels.filter((l) => l.kind === 'sea').map((l) => l.name));
    const ctx = this.ctx;
    const size = tier === 'close' ? 13 : 12;
    ctx.save();
    ctx.font = `500 ${size}px ${HEADING}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of this.geo.zoneIds) {
      const name = (this.geo.zoneNames.get(z) ?? z).toUpperCase();
      if (printed.has(this.geo.zoneNames.get(z) ?? z) && z !== rs.selectedZone) continue;
      const a = this.zoneCenter(z);
      const s = this.camera.toScreen(a.x, a.y);
      const y = s.y + 26;
      const wd = ctx.measureText(name).width + name.length * 1.2 + 6;
      const r = { x: s.x - wd / 2, y: y - 8, w: wd, h: 16 };
      if (r.x < 0 || r.y < 0 || r.x + r.w > this.width || r.y + r.h > this.height) continue;
      if (z !== rs.selectedZone && this.placed.hits(r)) {
        this.placed.skipped++;
        continue;
      }
      this.letter(name, s.x, y, 0, { font: `500 ${size}px ${HEADING}`, spacing: 1.2, fill: z === rs.selectedZone ? BRASS_INK : SEA_INK, halo: 'rgba(182, 207, 209, 0.7)', haloW: 3 });
      this.placed.add(r);
    }
    ctx.restore();
  }

  armyPos(sim: Sim, a: Army): { x: number; y: number } {
    const here = this.provinceCenter(a.location);
    if (!a.path.length || a.progress <= 0 || a.battle) return here;
    const next = this.provinceCenter(a.path[0]);
    const cost = Math.max(0.1, moveCost(sim, a.location, a.path[0], a.nation));
    const u = Math.max(0, Math.min(0.85, a.progress / cost));
    return { x: here.x + (next.x - here.x) * u, y: here.y + (next.y - here.y) * u };
  }

  // ───────────────────────────── screen-space layers ──────────────────────

  private drawBattles(sim: Sim, rs: RenderState, t: number): void {
    const ctx = this.ctx;
    const cam = this.camera;
    for (const b of Object.values(sim.state.battles)) {
      const c = this.provinceCenter(b.province);
      const s = cam.toScreen(c.x, c.y);
      if (s.x < -40 || s.y < -40 || s.x > this.width + 40 || s.y > this.height + 40) continue;
      const ours = rs.player && (b.attackerNations.includes(rs.player) || b.defenderNations.includes(rs.player));
      const r = ours ? 14 : 11;
      if (!rs.reducedMotion) {
        const ph = (t * 1.2) % 1;
        ctx.save();
        ctx.globalAlpha = 0.6 * (1 - ph);
        ctx.strokeStyle = DANGER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, r + ph * 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = ours ? DANGER : '#7a4a44';
      ctx.strokeStyle = IVORY_RAISED;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const eng = sprite('counters/status/engaged', r * 1.3, r * 1.3, this.dpr, IVORY_RAISED);
      if (eng) ctx.drawImage(eng, s.x - r * 0.65, s.y - r * 0.65, r * 1.3, r * 1.3);
      ctx.restore();
      this.battleMarkers.push({ battle: b.id, province: b.province, x: s.x, y: s.y, r });
      this.placed.add({ x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 });
    }
  }

  /**
   * Point markers, in priority order: sieges, capitals, then (local view) forts,
   * ports, factories and airfields; at the closest zoom a landmark illustration
   * replaces the marker where the place really has that building.
   */
  private drawSites(sim: Sim, rs: RenderState, tier: Tier, visible: Array<{ id: string }>): void {
    const st = sim.state;
    const cam = this.camera;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const capitals = new Set<string>();
    for (const n of Object.values(st.nations)) if (n.alive && n.capital) capitals.add(n.capital);
    const local = cam.provincePx >= 230;
    const items: Array<{ id: string; pri: number }> = [];
    for (const v of visible) {
      const p = st.provinces[v.id];
      const siege = p.siege && p.siege.progress > 0;
      const isCap = capitals.has(v.id);
      if (siege) items.push({ id: v.id, pri: 0 });
      else if (isCap) items.push({ id: v.id, pri: 1 });
      else if (tier === 'close' && (p.fort > 0 || p.port > 0 || p.factories > 1 || p.airfield > 0)) items.push({ id: v.id, pri: 2 });
    }
    items.sort((a, b) => a.pri - b.pri || (a.id < b.id ? -1 : 1));
    for (const { id } of items) {
      const p = st.provinces[id];
      const g = this.geo.provs.get(id)!;
      const s = cam.toScreen(g.lx, g.ly);
      if (s.x < -60 || s.y < -60 || s.x > this.width + 60 || s.y > this.height + 60) continue;
      const y = s.y + (tier === 'far' ? 0 : 14);
      const siege = p.siege && p.siege.progress > 0 ? p.siege : null;
      if (siege) {
        const col = sim.world.nationDefs[siege.nation]?.color ?? '#999';
        ctx.save();
        ctx.fillStyle = IVORY_RAISED;
        ctx.strokeStyle = SLATE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = realmInk(col);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, y, 11, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * siege.progress) / 100);
        ctx.stroke();
        const f = sprite('markers/fort', 14, 14, dpr);
        if (f) ctx.drawImage(f, s.x - 7, y - 7, 14, 14);
        ctx.restore();
        this.placed.add({ x: s.x - 12, y: y - 12, w: 24, h: 24 });
        continue;
      }
      if (capitals.has(id)) {
        const size = tier === 'far' ? 13 : 22;
        const r: Rect = { x: s.x - size / 2, y: y - size / 2, w: size, h: size };
        if (tier !== 'far' && this.placed.hits(r)) {
          this.placed.skipped++;
          continue;
        }
        const m = sprite('markers/capital', size, size, dpr);
        if (m) ctx.drawImage(m, r.x, r.y, size, size);
        this.placed.add(r);
        continue;
      }
      // local view: the place's most significant building
      const kind = p.fort >= 2 && sim.world.provZones[id] ? 'coastal-fort' : p.port >= 2 ? 'harbor' : p.factories >= 3 ? 'industrial-works' : null;
      if (local && kind) {
        const w = Math.min(128, Math.max(64, cam.provincePx * 0.38));
        const [bx0, by0, bx1, by1] = LANDMARK_BOUNDS[kind];
        const h = (w * (by1 - by0) * 1024) / ((bx1 - bx0) * 1536);
        const r: Rect = { x: s.x - w / 2, y: y - h * 0.15, w, h };
        if (!this.placed.hits(r)) {
          const img = landmark(kind, () => this.onArt?.());
          if (img) {
            ctx.drawImage(img, bx0 * img.width, by0 * img.height, (bx1 - bx0) * img.width, (by1 - by0) * img.height, r.x, r.y, w, h);
            this.placed.add(r);
            continue;
          }
        }
      }
      const marker = p.fort > 0 ? 'fort' : p.port > 0 ? 'port' : p.factories > 1 ? 'factory' : 'airfield';
      const r: Rect = { x: s.x - 10, y: y - 10, w: 20, h: 20 };
      if (this.placed.hits(r)) {
        this.placed.skipped++;
        continue;
      }
      const m = sprite(`markers/${marker}`, 20, 20, dpr);
      if (m) ctx.drawImage(m, r.x, r.y, 20, 20);
      if (marker === 'fort' && p.fort > 1) {
        ctx.fillStyle = BRASS_INK;
        for (let i = 0; i < p.fort; i++) ctx.fillRect(s.x - 7 + i * 5, y + 11, 4, 3);
      }
      this.placed.add({ x: r.x, y: r.y, w: 20, h: 24 });
    }
    void rs;
  }

  private relation(sim: Sim, nid: NationId, me: NationId | null): 'own' | 'allied' | 'hostile' | 'other' {
    if (nid === me) return 'own';
    if (!me) return 'other';
    if (atWar(sim, me, nid)) return 'hostile';
    if (isFriendly(sim, me, nid)) return 'allied';
    return 'other';
  }

  /**
   * Counters by projected province size: round tokens at world view, small pills
   * when provinces are still small, the pack's compact frame regionally and its
   * standard frame (with readiness bars) up close.
   */
  private counterKind(tier: Tier): 'pill' | 'compact' | 'standard' {
    const ppx = this.camera.provincePx;
    if (tier === 'far' || ppx < 88) return 'pill';
    return ppx >= 190 ? 'standard' : 'compact';
  }

  private counterSize(kind: 'pill' | 'compact' | 'standard', count: string): { w: number; h: number } {
    if (kind === 'standard') return { w: 96, h: 64 };
    if (kind === 'compact') return { w: 56 + 8 + count.length * 7, h: 36 };
    return { w: 26 + count.length * 7, h: 20 };
  }

  /**
   * One counter, drawn from the pack's empty chrome plus live layers: identity
   * (the realm's shield on its muted colour), the branch symbol, the strength,
   * readiness bars (standard frame) and one status symbol outside the right edge.
   */
  private counter(
    sim: Sim,
    o: {
      kind: 'pill' | 'compact' | 'standard';
      nation: NationId;
      x: number;
      y: number;
      symbol: string;
      count: string;
      detail: string;
      bars: [number, number] | null;
      status: string | null;
      relation: 'own' | 'allied' | 'hostile' | 'other';
      selected: boolean;
      group?: number | null;
      dim?: boolean;
    },
  ): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const def = sim.world.nationDefs[o.nation];
    const edge = o.selected ? BRASS : o.relation === 'hostile' ? '#8d3932' : o.relation === 'allied' ? '#456f77' : '#303b3b';
    const { w, h } = this.counterSize(o.kind, o.count);
    ctx.save();
    if (o.kind === 'pill') {
      ctx.fillStyle = IVORY;
      ctx.strokeStyle = edge;
      ctx.lineWidth = o.selected ? 2.4 : o.relation === 'own' || o.relation === 'hostile' ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.rect(o.x + 0.5, o.y + 0.5, w - 1, h - 1);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = realmFill(def.color);
      ctx.fillRect(o.x + 2, o.y + 2, 14, h - 4);
      const sym = sprite(`counters/symbols/${o.symbol}`, 12, 12, dpr, INK);
      if (sym) ctx.drawImage(sym, o.x + 3, o.y + (h - 12) / 2, 12, 12);
      ctx.fillStyle = INK;
      ctx.font = `600 12px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.count, o.x + 16 + (w - 16) / 2, o.y + h / 2 + 0.5);
    } else if (o.kind === 'compact') {
      const fw = 56;
      const frame = sprite('counters/frames/compact', fw, 36, dpr);
      if (frame) ctx.drawImage(frame, o.x, o.y, fw, 36);
      ctx.fillStyle = realmFill(def.color);
      ctx.fillRect(o.x + 2, o.y + 2, 15, 32);
      drawShield(ctx, def, o.x + 3, o.y + 8, 13);
      const sym = sprite(`counters/symbols/${o.symbol}`, 20, 20, dpr, INK);
      if (sym) ctx.drawImage(sym, o.x + 26, o.y + 8, 20, 20);
      // the strength in a tab on the frame's right edge (a recorded deviation: the
      // pack's compact frame has no numbers, but the count is what the player reads)
      const tw = w - fw;
      ctx.fillStyle = SLATE;
      ctx.fillRect(o.x + fw - 1, o.y + 9, tw + 1, 18);
      ctx.fillStyle = IVORY;
      ctx.font = `600 12px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.count, o.x + fw + tw / 2, o.y + 18.5);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x + 1, o.y + 1, fw - 2, 34);
      if (o.selected) {
        ctx.strokeStyle = BRASS;
        ctx.lineWidth = 3;
        ctx.strokeRect(o.x - 1.5, o.y - 1.5, fw + 3, 39);
      }
    } else {
      const variant = o.dim ? 'disabled' : o.selected ? 'selected' : o.relation === 'hostile' ? 'hostile' : o.relation === 'allied' ? 'allied' : 'standard';
      const frame = sprite(`counters/frames/${variant}`, 96, 64, dpr);
      if (frame) ctx.drawImage(frame, o.x, o.y, 96, 64);
      // identity slot (3,3) 20×14: the realm's muted colour with its shield
      ctx.fillStyle = realmFill(def.color);
      ctx.fillRect(o.x + 3, o.y + 3, 20, 14);
      drawShield(ctx, def, o.x + 8, o.y + 3.5, 10);
      // branch symbol (41,6) 24×24
      const sym = sprite(`counters/symbols/${o.symbol}`, 24, 24, dpr, INK);
      if (sym) ctx.drawImage(sym, o.x + 41, o.y + 6, 24, 24);
      // strength (28,30) 64×14
      ctx.fillStyle = INK;
      ctx.font = `600 13px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.detail || o.count, o.x + 28 + 32, o.y + 37.5);
      // readiness bars (4,51) 88×7, two separated by 4 px
      if (o.bars) {
        o.bars.forEach((v, i) => {
          const bx = o.x + 4 + i * 46;
          ctx.fillStyle = '#e0d9c7';
          ctx.fillRect(bx, o.y + 51, 42, 7);
          const f = Math.max(0, Math.min(1, v));
          ctx.fillStyle = f > 0.5 ? POSITIVE : f > 0.25 ? WARNING : DANGER;
          ctx.fillRect(bx, o.y + 51, 42 * f, 7);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 0.5, o.y + 51.5, 41, 6);
        });
      }
    }
    // status outside the right edge (16×16)
    if (o.status && o.kind !== 'pill') {
      const sx = o.x + w + 2;
      const sy = o.y + 2;
      ctx.fillStyle = IVORY_RAISED;
      ctx.strokeStyle = o.status === 'low-supply' ? DANGER : SLATE;
      ctx.lineWidth = 1;
      ctx.fillRect(sx, sy, 16, 16);
      ctx.strokeRect(sx + 0.5, sy + 0.5, 15, 15);
      const st = sprite(`counters/status/${o.status}`, 14, 14, dpr, o.status === 'low-supply' ? DANGER : INK);
      if (st) ctx.drawImage(st, sx + 1, sy + 1, 14, 14);
    }
    // army group number: a small brass tab on the top-left corner
    if (o.group) {
      ctx.fillStyle = BRASS;
      ctx.strokeStyle = BRASS_INK;
      ctx.lineWidth = 1;
      ctx.fillRect(o.x - 5, o.y - 6, 12, 12);
      ctx.strokeRect(o.x - 4.5, o.y - 5.5, 11, 11);
      ctx.fillStyle = INK;
      ctx.font = `700 9px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(o.group), o.x + 1, o.y + 0.5);
    }
    if (o.dim && o.kind !== 'standard') {
      ctx.fillStyle = 'rgba(224, 220, 207, 0.55)';
      ctx.fillRect(o.x, o.y, w, h);
    }
    ctx.restore();
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
      if (a.embarked || !relevant(a)) continue;
      const p = pos.get(a.id)!;
      const s = cam.toScreen(p.x, p.y);
      if (s.x < -100 || s.y < -80 || s.x > this.width + 100 || s.y > this.height + 80) continue;
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
      const kind = this.counterKind(tier);
      const dims = list.map((a) => this.counterSize(kind, String(a.regiments.length)));
      const total = dims.reduce((x, d) => x + d.w + 4, -4);
      let x = s.x - total / 2;
      const hMax = Math.max(...dims.map((d) => d.h));
      const y = s.y - hMax - 8;
      list.forEach((a, i) => {
        const { w, h } = dims[i];
        const mine = a.nation === me;
        const mm = maxMorale(sim, a.nation);
        const engineers = a.regiments.some((r) => r.type === 'engineers');
        const status = a.battle ? 'engaged' : mine && a.supply < 0.5 ? 'low-supply' : a.path.length ? 'moving' : entrenchBonus(sim, a.nation, a.stationary, engineers) > 0 ? 'entrenched' : null;
        this.counter(sim, {
          kind,
          nation: a.nation,
          x,
          y: y + (hMax - h),
          symbol: branchOf(a),
          count: String(a.regiments.length),
          detail: `${a.regiments.length} · ${(menOf(a) / 1000).toFixed(1)}k`,
          bars: [a.morale / Math.max(0.01, mm), mine ? a.supply : 1],
          status,
          relation: this.relation(sim, a.nation, me),
          selected: a.id === rs.selectedArmy,
          group: mine ? a.group : null,
          dim: a.retreating,
        });
        // the status symbol widens the hit and collision box
        const ww = w + (status && kind !== 'pill' ? 18 : 0);
        this.markers.push({ army: a.id, x, y: y + (hMax - h), w: ww, h });
        this.placed.add({ x, y: y + (hMax - h), w: ww, h });
        x += w + 4;
      });
    }
  }

  private farMarker(sim: Sim, a: Army, x: number, y: number, regs: number, selected: boolean, me: NationId | null): void {
    const ctx = this.ctx;
    const def = sim.world.nationDefs[a.nation];
    const rel = this.relation(sim, a.nation, me);
    const r = 8 + Math.min(5, Math.sqrt(regs));
    ctx.save();
    if (selected) {
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = realmFill(def.color);
    ctx.strokeStyle = rel === 'hostile' ? DANGER : rel === 'own' ? INK : '#5f6a62';
    ctx.lineWidth = rel === 'hostile' || rel === 'own' ? 2 : 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `700 ${regs > 9 ? 10 : 11}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(regs), x, y + 0.5);
    ctx.restore();
    this.markers.push({ army: a.id, x: x - r, y: y - r, w: r * 2, h: r * 2 });
    this.placed.add({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
  }

  /** A route label: slate with ivory text (a muted ink one when the order is refused). */
  private pill(x: number, y: number, text: string, bad: boolean): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `600 13px ${SANS}`;
    const w = ctx.measureText(text).width + 16;
    ctx.fillStyle = bad ? IVORY_RAISED : SLATE;
    ctx.strokeStyle = bad ? DANGER : '#303b3b';
    ctx.lineWidth = 1;
    ctx.fillRect(x - w / 2, y - 11, w, 22);
    ctx.strokeRect(x - w / 2 + 0.5, y - 10.5, w - 1, 21);
    ctx.fillStyle = bad ? DANGER : IVORY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 0.5);
    ctx.restore();
    this.placed.add({ x: x - w / 2, y: y - 11, w, h: 22 });
  }

  /** The destination flag of the selected army's order. */
  private flag(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.stroke();
    ctx.fillStyle = DANGER;
    ctx.strokeStyle = IVORY_RAISED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(13, -18);
    ctx.lineTo(0, -13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    this.placed.add({ x: x - 2, y: y - 23, w: 16, h: 24 });
  }

  // ───────────────────────────── lettering ────────────────────────────────

  private drawLabels(sim: Sim, rs: RenderState, tier: Tier, visible: Array<{ id: string; lx: number; ly: number; lr: number; area: number }>): void {
    const ctx = this.ctx;
    const cam = this.camera;
    const z = cam.zoom;
    const ppx = cam.provincePx;
    const density = rs.presentation.labels;
    const st = sim.state;
    // No two names overlap. Order of precedence: counters and markers (already
    // placed), the selected province, capitals, geographic names, realm names,
    // other province names.
    const caps = new Set<string>();
    for (const n of Object.values(st.nations)) if (n.alive && n.capital) caps.add(n.capital);
    const nameFrame = (v: { id: string; lx: number; ly: number; lr: number }) => {
      const cap = caps.has(v.id);
      const name = sim.world.prov[v.id].name;
      const size = Math.round(Math.max(12, Math.min(tier === 'close' ? 16 : 14, v.lr * z * 0.3)) + (cap ? 1 : 0));
      const s = cam.toScreen(v.lx, v.ly);
      const font = `${cap ? 700 : 500} ${size}px ${SANS}`;
      ctx.font = font;
      const w = ctx.measureText(name).width;
      const y = s.y + (cap ? 34 : 4);
      const r: Rect = { x: s.x - w / 2 - 2, y: y - size * 0.62, w: w + 4, h: size * 1.2 };
      return { name, size, font, w, x: s.x, y, r, cap };
    };
    const selFrame = rs.selectedProvince && tier !== 'far' ? visible.find((v) => v.id === rs.selectedProvince) : undefined;
    const reserved = (tier === 'far' ? [] : visible.filter((v) => caps.has(v.id) || v.id === rs.selectedProvince)).map((v) => ({ v, f: nameFrame(v) }));
    const reservedRects = reserved.map((c) => c.f.r);

    // geographic names: seas, ranges, lakes
    for (const l of this.geo.labels) {
      if (l.kind === 'region') continue;
      const s = cam.toScreen(l.x, l.y);
      if (s.x < -200 || s.y < -60 || s.x > this.width + 200 || s.y > this.height + 60) continue;
      const water = l.kind === 'sea' || l.kind === 'lake';
      const size = Math.max(11, Math.min(water ? 26 : 16, (l.size ?? 40) * z * 0.9));
      if (size < 11.5 || (!water && tier === 'far' && size < 13)) continue;
      const text = l.name.toUpperCase();
      const spacing = size * (water ? 0.22 : 0.14);
      const font = `500 ${size}px ${HEADING}`;
      ctx.font = font;
      const box = orientedBox(s.x, s.y, ctx.measureText(text).width + spacing * (text.length - 1) + 4, size * 1.1, l.angle ?? 0);
      if (this.placed.hitsBox(box, reservedRects)) {
        this.placed.skipped++;
        continue;
      }
      this.placed.addBox(box);
      this.letter(text, s.x, s.y, l.angle ?? 0, {
        font,
        spacing,
        fill: water ? SEA_INK : RANGE_INK,
        halo: water ? 'rgba(182, 207, 209, 0.6)' : 'rgba(245, 239, 226, 0.75)',
        haloW: water ? 2.5 : 3,
      });
    }

    // realm names at distance (largest first; shrink, move or skip on collision). They fade out
    // as province names take over, and province names give way to them while they show.
    const fade = ppx < 78 ? 1 : 1 - (ppx - 78) / 30;
    if (fade > 0.25) {
      const alpha = fade * (rs.mode === 'political' || rs.mode === 'diplomacy' ? 0.9 : 0.62);
      const items: Array<{ nid: NationId; name: string; base: number; size: number; lab: RealmLabel }> = [];
      ctx.font = `600 100px ${HEADING}`;
      const fitSize = (lab: RealmLabel, base: number) => Math.min(((lab.len * z) / base) * 100, lab.wid * z * 0.5, 46);
      for (const [nid, rsh] of this.realms) {
        const lab = rsh.label;
        if (!lab) continue;
        const name = sim.world.nationDefs[nid].short.toUpperCase();
        const base = ctx.measureText(name).width + name.length * 18;
        items.push({ nid, name, base, size: fitSize(lab, base), lab });
      }
      items.sort((a, b) => b.size - a.size);
      for (const it of alpha > 0.02 ? items : []) {
        // try the best frame, shrinking a little, then the alternatives
        let placed: { lab: RealmLabel; size: number; s: { x: number; y: number }; box: OBox } | null = null;
        for (const lab of [it.lab, ...it.lab.alts]) {
          const s = cam.toScreen(lab.x, lab.y);
          let size = lab === it.lab ? it.size : fitSize(lab, it.base);
          for (let tries = 0; tries < 3 && size >= 12 && !placed; tries++, size *= 0.85) {
            ctx.font = `600 ${size}px ${HEADING}`;
            const w = ctx.measureText(it.name).width + size * 0.18 * (it.name.length - 1);
            const box = orientedBox(s.x, s.y, w + 4, size * 0.9, lab.angle);
            if (!this.placed.hitsBox(box, reservedRects)) placed = { lab, size, s, box };
          }
          if (placed) break;
        }
        if (!placed) {
          this.placed.skipped++;
          continue;
        }
        this.placed.addBox(placed.box);
        const { lab, size, s } = placed;
        const def = sim.world.nationDefs[it.nid];
        ctx.save();
        ctx.globalAlpha = alpha;
        this.letter(it.name, s.x, s.y, lab.angle, {
          font: `600 ${size}px ${HEADING}`,
          spacing: size * 0.18,
          fill: realmInk(def.color),
          halo: 'rgba(245, 239, 226, 0.5)',
          haloW: Math.max(2, size * 0.08),
          bend: lab.bend,
        });
        ctx.restore();
      }
    }

    // province names: the selected one and capitals first, then the rest by importance
    if (tier !== 'far') {
      const minR = density === 'many' ? 13 : density === 'few' ? 26 : 18;
      const cands = visible
        .map((v) => ({ v, cap: caps.has(v.id), sel: v.id === rs.selectedProvince, pri: (v.id === rs.selectedProvince ? 2e6 : 0) + (caps.has(v.id) ? 1e6 : 0) + st.provinces[v.id].dev * 1000 + v.area / 100 }))
        .filter((c) => c.cap || c.sel || c.v.lr * z > minR)
        .sort((a, b) => b.pri - a.pri);
      for (const c of cands) {
        const { name, size, font, w, y, r } = c.cap || c.sel ? reserved.find((q) => q.v.id === c.v.id)!.f : nameFrame(c.v);
        const sx = r.x + r.w / 2;
        // the selected province and capitals are always named; other names give way
        if (!c.cap && !c.sel && (this.placed.hits(r) || w > c.v.lr * z * 2.9)) {
          this.placed.skipped++;
          continue;
        }
        this.placed.add(r);
        this.letter(name, sx, y, 0, { font, spacing: 0, fill: c.sel ? BRASS_INK : INK, halo: 'rgba(245, 239, 226, 0.9)', haloW: 3 });
        const note = (text: string) => this.letter(text, sx, y + size * 0.95, 0, { font: `600 12px ${SANS}`, spacing: 0, fill: MUTED, halo: 'rgba(245, 239, 226, 0.85)', haloW: 2.5 });
        if (tier === 'close' && rs.mode === 'economy') note(`dev ${st.provinces[c.v.id].dev}`);
        if (tier === 'close' && rs.mode === 'terrain') {
          const t = sim.world.prov[c.v.id].terrain;
          note(`${t} · move ${moveCostLabel(t)}`);
        }
        if (tier === 'close' && rs.mode === 'frontier' && st.provinces[c.v.id].owner) note(`${Math.floor(st.provinces[c.v.id].integration)}`);
      }
    }
    void selFrame;
  }

  /** Spaced (optionally arched) lettering with a halo. */
  private letter(
    text: string,
    x: number,
    y: number,
    angle: number,
    o: { font: string; spacing: number; fill: string; halo: string; haloW: number; bend?: number },
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
      ctx.globalAlpha = hl && o !== hl ? 0.55 : 1;
      ctx.fillStyle = realmWash(colorOf(o));
      ctx.fill(p.path);
    }
    ctx.restore();
    // realm borders
    const border = new Path2D();
    for (const e of geo.edges) {
      if (e.coast) continue;
      if (ownerOf(e.a) !== ownerOf(e.b)) border.addPath(e.path);
    }
    ctx.strokeStyle = LINE.realm.stroke;
    ctx.lineWidth = 1.4 / z;
    ctx.stroke(border);
    if (opts.highlight) {
      const hp = new Path2D();
      for (const e of geo.edges) {
        const oa = ownerOf(e.a);
        const ob = e.coast ? null : ownerOf(e.b);
        if ((oa === opts.highlight) !== (ob === opts.highlight)) hp.addPath(e.path);
      }
      ctx.lineJoin = 'round';
      ctx.strokeStyle = IVORY_RAISED;
      ctx.lineWidth = 4.8 / z;
      ctx.stroke(hp);
      ctx.strokeStyle = BRASS_INK;
      ctx.lineWidth = 2.6 / z;
      ctx.stroke(hp);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (opts.dim) {
      ctx.fillStyle = 'rgba(56, 67, 66, 0.12)';
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

/** A rotated label box: centre, half extents and axis. */
interface OBox {
  x: number;
  y: number;
  hw: number;
  hh: number;
  c: number;
  s: number;
}

function orientedBox(x: number, y: number, w: number, h: number, angle: number): OBox {
  return { x, y, hw: w / 2, hh: h / 2, c: Math.cos(angle), s: Math.sin(angle) };
}

/** Separating-axis test for two rotated rectangles. */
function boxesOverlap(a: OBox, b: OBox): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const [ax, ay] of [[a.c, a.s], [-a.s, a.c], [b.c, b.s], [-b.s, b.c]]) {
    const ra = a.hw * Math.abs(a.c * ax + a.s * ay) + a.hh * Math.abs(-a.s * ax + a.c * ay);
    const rb = b.hw * Math.abs(b.c * ax + b.s * ay) + b.hh * Math.abs(-b.s * ax + b.c * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
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
