// A read-only view of a campaign map drawn by the real map renderer: the main
// menu's backdrop and the campaign-setup preview. It builds a sample start of
// the chosen map (no player), so what you see is exactly the opening position.

import { createGame } from '../sim/game';
import type { Sim } from '../sim/state';
import type { NationId } from '../sim/types';
import { loadGeometry } from './map/maps';
import { MapRenderer, type Presentation } from './map/renderer';

const starts = new Map<string, Sim>();

/** The opening position of a map (shared by every preview of it). */
export function startOf(scenarioId: string): Sim {
  let s = starts.get(scenarioId);
  if (!s) starts.set(scenarioId, (s = createGame({ scenario: scenarioId, seed: 1, playerNation: null })));
  return s;
}

export class AtlasView {
  renderer: MapRenderer | null = null;
  sim: Sim | null = null;
  outline: NationId | null = null;
  /**
   * Menu backdrop: drawn once, 12% larger than its frame, and drifted by a
   * composited CSS animation (no redraws; none at all with reduced motion).
   */
  drift = false;
  reducedMotion = false;
  presentation: Presentation = { labels: 'few', terrain: 'full', borders: 'normal', armies: 'mine', patterns: false };
  onReady: (() => void) | null = null;
  private raf = 0;
  private token = 0;
  private alive = true;
  private ro: ResizeObserver | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    const parent = canvas.parentElement;
    if (parent) {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(parent);
    }
  }

  async show(scenarioId: string): Promise<void> {
    const token = ++this.token;
    const geometry = await loadGeometry(scenarioId);
    if (token !== this.token || !this.alive) return;
    const sim = startOf(scenarioId);
    this.sim = sim;
    this.renderer = new MapRenderer(this.canvas, geometry, (id) => sim.world.prov[id]?.terrain ?? 'plains');
    this.resize();
    if (this.drift) {
      const b = this.renderer.geo.bounds;
      const cam = this.renderer.camera;
      cam.centerOn(b.minX + (b.maxX - b.minX) * 0.56, b.minY + (b.maxY - b.minY) * 0.5, cam.zoomForProvincePx(62), false);
    } else this.renderer.camera.fit(false);
    this.kick();
    this.onReady?.();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent || !this.renderer) return;
    const r = parent.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const k = this.drift ? 1.12 : 1;
    this.renderer.resize(r.width * k, r.height * k, Math.min(2, window.devicePixelRatio || 1));
    if (this.drift) {
      this.canvas.classList.add('drifting');
      this.canvas.style.left = `${(-r.width * (k - 1)) / 2}px`;
      this.canvas.style.top = `${(-r.height * (k - 1)) / 2}px`;
    }
    this.kick();
  }

  /** Frame a realm and its surroundings, outlined in gold. */
  focusRealm(nid: NationId | null, animate = true): void {
    this.outline = nid;
    const r = this.renderer;
    if (!r || !this.sim) return;
    const bb = nid ? r.realmBBox(this.sim, nid) : null;
    if (bb) {
      // include the neighbourhood: fronts matter as much as the realm itself
      const w = bb[2] - bb[0];
      const h = bb[3] - bb[1];
      const m = Math.max(w, h) * 0.45 + r.geo.provScale * 2;
      r.camera.fitRect(bb[0] - m, bb[1] - m, bb[2] + m, bb[3] + m, animate && !this.reducedMotion, 1);
    } else r.camera.fit(animate && !this.reducedMotion);
    this.kick();
  }

  kick(): void {
    if (!this.raf && this.alive) this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ro?.disconnect();
  }

  private frame = (t: number): void => {
    this.raf = 0;
    const r = this.renderer;
    const sim = this.sim;
    if (!r || !sim || !this.alive) return;
    const more = r.draw(
      sim,
      {
        selectedProvince: null,
        selectedArmy: null,
        hoverProvince: null,
        previewPath: null,
        previewLabel: null,
        mode: 'political',
        focusNation: null,
        highlight: null,
        reducedMotion: this.reducedMotion,
        player: null,
        presentation: this.presentation,
        outlineRealm: this.outline,
      },
      t,
    );
    // keep drawing only while tiles are still being painted or the camera flies
    if (more) this.kick();
  };
}
