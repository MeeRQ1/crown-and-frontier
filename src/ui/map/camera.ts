// Pan/zoom camera for the map (screen = world * zoom + offset).

export class Camera {
  zoom = 0.5;
  offX = 0;
  offY = 0;
  vw = 800;
  vh = 600;
  minZoom = 0.2;
  maxZoom = 3.5;
  constructor(readonly bounds: { minX: number; minY: number; maxX: number; maxY: number }) {}

  setViewport(w: number, h: number): void {
    const first = this.vw === 800 && this.vh === 600 && this.offX === 0;
    this.vw = w;
    this.vh = h;
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    this.minZoom = Math.min(w / bw, h / bh) * 0.9;
    if (first) this.fit();
    this.clamp();
  }

  fit(): void {
    const bw = this.bounds.maxX - this.bounds.minX;
    const bh = this.bounds.maxY - this.bounds.minY;
    this.zoom = Math.min(this.vw / bw, this.vh / bh);
    this.offX = (this.vw - bw * this.zoom) / 2 - this.bounds.minX * this.zoom;
    this.offY = (this.vh - bh * this.zoom) / 2 - this.bounds.minY * this.zoom;
  }

  toWorld(sx: number, sy: number) {
    return { x: (sx - this.offX) / this.zoom, y: (sy - this.offY) / this.zoom };
  }

  toScreen(wx: number, wy: number) {
    return { x: wx * this.zoom + this.offX, y: wy * this.zoom + this.offY };
  }

  pan(dx: number, dy: number): void {
    this.offX += dx;
    this.offY += dy;
    this.clamp();
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const w = this.toWorld(sx, sy);
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    this.offX = sx - w.x * this.zoom;
    this.offY = sy - w.y * this.zoom;
    this.clamp();
  }

  centerOn(wx: number, wy: number, zoom?: number): void {
    if (zoom) this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.offX = this.vw / 2 - wx * this.zoom;
    this.offY = this.vh / 2 - wy * this.zoom;
    this.clamp();
  }

  clamp(): void {
    // keep some of the map visible
    const b = this.bounds;
    const left = b.minX * this.zoom + this.offX;
    const right = b.maxX * this.zoom + this.offX;
    const top = b.minY * this.zoom + this.offY;
    const bottom = b.maxY * this.zoom + this.offY;
    const margin = 120;
    if (right < margin) this.offX += margin - right;
    if (left > this.vw - margin) this.offX -= left - (this.vw - margin);
    if (bottom < margin) this.offY += margin - bottom;
    if (top > this.vh - margin) this.offY -= top - (this.vh - margin);
  }
}
