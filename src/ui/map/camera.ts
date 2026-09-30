// Pan/zoom camera (screen = world * zoom + offset) with eased flights,
// zoom limits derived from province size, and insets for docked panels so
// "centre on" keeps its target in the visible part of the map.

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Flight {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  t0: number;
  dur: number;
}

export class Camera {
  zoom = 0.5;
  offX = 0;
  offY = 0;
  vw = 800;
  vh = 600;
  minZoom = 0.1;
  maxZoom = 3;
  insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 };
  private flight: Flight | null = null;
  private initialised = false;

  constructor(
    readonly bounds: { minX: number; minY: number; maxX: number; maxY: number },
    /** typical province radius in world units */
    readonly provScale: number,
  ) {}

  get bw(): number {
    return this.bounds.maxX - this.bounds.minX;
  }

  get bh(): number {
    return this.bounds.maxY - this.bounds.minY;
  }

  setViewport(w: number, h: number): void {
    this.vw = w;
    this.vh = h;
    this.minZoom = Math.min(w / this.bw, h / this.bh) * 0.85;
    // close enough that a province spans about 520 px
    this.maxZoom = Math.max(this.minZoom * 4, 520 / this.provScale);
    if (!this.initialised) {
      this.initialised = true;
      this.fit(false);
    }
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    this.clamp();
  }

  /** Zoom at which a typical province spans `px` screen pixels. */
  zoomForProvincePx(px: number): number {
    return Math.max(this.minZoom, Math.min(this.maxZoom, px / this.provScale));
  }

  /** Screen size of a typical province at the current zoom. */
  get provincePx(): number {
    return this.zoom * this.provScale;
  }

  /** Centre of the unobstructed part of the viewport. */
  private freeCentre(): { x: number; y: number } {
    const i = this.insets;
    return { x: i.left + (this.vw - i.left - i.right) / 2, y: i.top + (this.vh - i.top - i.bottom) / 2 };
  }

  private target(wx: number, wy: number, z: number) {
    const c = this.freeCentre();
    return { x: c.x - wx * z, y: c.y - wy * z, z };
  }

  fit(animate = true): void {
    const i = this.insets;
    const fw = Math.max(200, this.vw - i.left - i.right);
    const fh = Math.max(200, this.vh - i.top - i.bottom);
    const z = Math.max(this.minZoom, Math.min(fw / this.bw, fh / this.bh) * 0.98);
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const cy = (this.bounds.minY + this.bounds.maxY) / 2;
    this.go(this.target(cx, cy, z), animate);
  }

  toWorld(sx: number, sy: number) {
    return { x: (sx - this.offX) / this.zoom, y: (sy - this.offY) / this.zoom };
  }

  toScreen(wx: number, wy: number) {
    return { x: wx * this.zoom + this.offX, y: wy * this.zoom + this.offY };
  }

  /** Visible world rectangle (with a margin in screen pixels). */
  viewRect(margin = 0): [number, number, number, number] {
    const a = this.toWorld(-margin, -margin);
    const b = this.toWorld(this.vw + margin, this.vh + margin);
    return [a.x, a.y, b.x, b.y];
  }

  pan(dx: number, dy: number): void {
    this.flight = null;
    this.offX += dx;
    this.offY += dy;
    this.clamp();
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    this.flight = null;
    const w = this.toWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.offX = sx - w.x * this.zoom;
    this.offY = sy - w.y * this.zoom;
    this.clamp();
  }

  /** Centre a world point in the free area, optionally at a zoom (animated unless reduced motion). */
  centerOn(wx: number, wy: number, zoom?: number, animate = true): void {
    const z = Math.max(this.minZoom, Math.min(this.maxZoom, zoom ?? this.zoom));
    this.go(this.target(wx, wy, z), animate);
  }

  /** Is a world point inside the free area (with a margin)? */
  isVisible(wx: number, wy: number, margin = 40): boolean {
    const s = this.toScreen(wx, wy);
    const i = this.insets;
    return s.x > i.left + margin && s.x < this.vw - i.right - margin && s.y > i.top + margin && s.y < this.vh - i.bottom - margin;
  }

  private go(t: { x: number; y: number; z: number }, animate: boolean): void {
    if (!animate || reducedMotion()) {
      this.flight = null;
      this.offX = t.x;
      this.offY = t.y;
      this.zoom = t.z;
      this.clamp();
      return;
    }
    const d = Math.hypot(t.x - this.offX, t.y - this.offY) + Math.abs(Math.log(t.z / this.zoom)) * 400;
    this.flight = { from: { x: this.offX, y: this.offY, z: this.zoom }, to: t, t0: performance.now(), dur: Math.min(900, 280 + d * 0.35) };
  }

  /** Advance an active flight; returns true while animating. */
  update(now: number): boolean {
    const f = this.flight;
    if (!f) return false;
    let u = (now - f.t0) / f.dur;
    if (u >= 1) {
      u = 1;
      this.flight = null;
    }
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    // interpolate zoom geometrically and keep the screen-space path smooth
    const z = f.from.z * Math.pow(f.to.z / f.from.z, e);
    const c = this.freeCentre();
    const wx0 = (c.x - f.from.x) / f.from.z;
    const wy0 = (c.y - f.from.y) / f.from.z;
    const wx1 = (c.x - f.to.x) / f.to.z;
    const wy1 = (c.y - f.to.y) / f.to.z;
    const wx = wx0 + (wx1 - wx0) * e;
    const wy = wy0 + (wy1 - wy0) * e;
    this.zoom = z;
    this.offX = c.x - wx * z;
    this.offY = c.y - wy * z;
    if (!this.flight) this.clamp();
    return true;
  }

  get animating(): boolean {
    return !!this.flight;
  }

  clamp(): void {
    // keep a good part of the world on screen
    const b = this.bounds;
    const left = b.minX * this.zoom + this.offX;
    const right = b.maxX * this.zoom + this.offX;
    const top = b.minY * this.zoom + this.offY;
    const bottom = b.maxY * this.zoom + this.offY;
    const mx = Math.min(this.vw * 0.35, 260);
    const my = Math.min(this.vh * 0.35, 200);
    if (right < mx + this.insets.left) this.offX += mx + this.insets.left - right;
    if (left > this.vw - mx - this.insets.right) this.offX -= left - (this.vw - mx - this.insets.right);
    if (bottom < my) this.offY += my - bottom;
    if (top > this.vh - my) this.offY -= top - (this.vh - my);
  }
}

function reducedMotion(): boolean {
  return document.documentElement.classList.contains('reduced-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
