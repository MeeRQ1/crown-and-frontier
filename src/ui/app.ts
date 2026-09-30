// Browser application shell: screens, game loop, input, selection and the
// bridge between interface actions and simulation commands. All game actions
// go through applyCommand() — the same validation the AI uses.

import { applyCommand } from '../sim/commands';
import { createGame, type NewGameOptions } from '../sim/game';
import { findPath, etaWeeks, canEnter } from '../sim/movement';
import { deserialize, SaveError, serialize } from '../sim/save';
import { dateOf, months, type Sim } from '../sim/state';
import { isOver, step } from '../sim/tick';
import type { Command, CommandResult, NationId, ProvinceId } from '../sim/types';
import { Sound } from './audio';
import { h, setChildren } from './dom';
import { weeks } from './format';
import { MapRenderer, OVERLAYS, type Overlay } from './map/renderer';
import { renderContext } from './panels/context';
import { renderDecisions, showEventDialog, showProposalDialog, dialog } from './panels/dialogs';
import { renderLedger, type LedgerTab } from './panels/ledgers';
import { renderTopbar } from './panels/topbar';
import { renderEndScreen, renderMenu } from './screens';
import { loadSettings, saveSettings, type UISettings } from './settings';
import { SaveStore, downloadText } from './storage';
import { Tutorial } from './tutorial';

type DistOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type PlayerCommand = DistOmit<Command, 'nation'>;

export const SPEEDS = [0, 0.5, 1, 2.5, 6]; // ticks (weeks) per second; index 2 is "normal"

export interface UIState {
  peace: { war: string; with: string; mode: 'demand' | 'concede' | 'white'; provinces: string[]; gold: number } | null;
  split: Record<string, number>;
  ledgerTab: LedgerTab | null;
  diploTarget: NationId | null;
  logFilter: 'all' | 'urgent' | 'battles';
  /** realm summary expanded on small screens */
  summaryOpen: boolean;
}

export class App {
  readonly root: HTMLElement;
  settings: UISettings;
  store = new SaveStore();
  sound = new Sound();
  sim: Sim | null = null;
  renderer: MapRenderer | null = null;
  tutorial: Tutorial | null = null;

  speed = 0;
  lastSpeed = 2;
  selectedProvince: ProvinceId | null = null;
  selectedArmy: string | null = null;
  hoverProvince: ProvinceId | null = null;
  moveMode = false;
  overlay: Overlay = 'political';
  ui: UIState = { peace: null, split: {}, ledgerTab: null, diploTarget: null, logFilter: 'all', summaryOpen: false };

  private acc = 0;
  private lastFrame = 0;
  private lastUI = 0;
  private uiDirty = true;
  private mapDirty = true;
  private lastNote = 0;
  private lastAutosave = 0;
  private endShown = false;
  private raf = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; button: number; moved: boolean }>();
  private pinchDist = 0;
  private longPress: number | null = null;
  private hoverPos: { x: number; y: number } | null = null;
  private pointerDown = false;

  // DOM
  private gameEl: HTMLElement | null = null;
  topbarEl!: HTMLElement;
  contextEl!: HTMLElement;
  navEl!: HTMLElement;
  overlaysEl!: HTMLElement;
  legendEl!: HTMLElement;
  toastsEl!: HTMLElement;
  decisionsEl!: HTMLElement;
  modalLayer!: HTMLElement;
  dialogLayer!: HTMLElement;
  bannerEl!: HTMLElement;
  tipEl!: HTMLElement;
  tutorialEl!: HTMLElement;
  canvas!: HTMLCanvasElement;
  mainEl!: HTMLElement;
  screenEl: HTMLElement | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings();
    this.applySettings();
    window.addEventListener('keydown', (e) => this.onKey(e));
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => void this.autosave(true));
    // never rebuild panels under a pressed pointer (a replaced button would swallow the click)
    window.addEventListener('pointerdown', () => (this.pointerDown = true), true);
    window.addEventListener('pointerup', () => (this.pointerDown = false), true);
    window.addEventListener('pointercancel', () => (this.pointerDown = false), true);
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  get player(): NationId | null {
    return this.sim?.state.settings.playerNation ?? null;
  }

  applySettings(): void {
    document.documentElement.style.setProperty('--scale', String(this.settings.uiScale));
    document.documentElement.classList.toggle('reduced-motion', this.settings.reducedMotion);
    this.sound.enabled = this.settings.sound;
    this.sound.setVolume(this.settings.volume);
    this.mapDirty = true;
    this.uiDirty = true;
  }

  updateSettings(patch: Partial<UISettings>): void {
    Object.assign(this.settings, patch);
    saveSettings(this.settings);
    this.applySettings();
  }

  async boot(progress: (pct: number, text: string) => void): Promise<void> {
    progress(55, 'Opening the archives…');
    await this.store.init();
    progress(90, 'Unrolling the map…');
    this.showMenu();
    progress(100, 'Ready');
  }

  // ───────────────────────────── Screens ────────────────────────────────────

  showScreen(el: HTMLElement): void {
    this.hideScreen();
    this.screenEl = el;
    this.root.appendChild(el);
  }

  hideScreen(): void {
    this.screenEl?.remove();
    this.screenEl = null;
  }

  showMenu(): void {
    this.setSpeed(0);
    this.showScreen(renderMenu(this));
  }

  newGame(opts: NewGameOptions, tutorial: boolean): void {
    const sim = createGame(opts);
    this.startGame(sim, tutorial);
  }

  startGame(sim: Sim, tutorial = false): void {
    this.teardownGame();
    this.sim = sim;
    this.lastNote = sim.state.notifications.at(-1)?.id ?? 0;
    this.lastAutosave = sim.state.tick;
    this.endShown = !!sim.state.result && !sim.state.continueAfterResult;
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.moveMode = false;
    this.ui = { peace: null, split: {}, ledgerTab: null, diploTarget: null, logFilter: 'all', summaryOpen: false };
    this.buildGameDom();
    this.hideScreen();
    const cap = this.player ? sim.state.nations[this.player].capital : null;
    if (cap) {
      const c = MapRenderer.provinceCenter(cap);
      this.renderer!.camera.centerOn(c.x, c.y, Math.max(0.55, this.renderer!.camera.minZoom * 2.2));
    }
    this.tutorial = tutorial && this.player ? new Tutorial(this) : null;
    this.speed = 0;
    this.refresh();
    this.lastFrame = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.frame(t));
    if (this.endShown) this.showEnd();
  }

  teardownGame(): void {
    cancelAnimationFrame(this.raf);
    this.gameEl?.remove();
    this.gameEl = null;
    this.renderer = null;
    this.sim = null;
    this.tutorial = null;
  }

  quitToMenu(): void {
    void this.autosave(true).finally(() => {
      this.teardownGame();
      this.showMenu();
    });
  }

  private buildGameDom(): void {
    this.canvas = h('canvas', { class: 'map', 'aria-label': 'Strategic map. Click a province or army to select it.', tabindex: 0 });
    this.topbarEl = h('div', { class: 'topbar', role: 'toolbar', 'aria-label': 'Realm overview and time controls' });
    this.contextEl = h('aside', { class: 'context', 'aria-label': 'Selection details', 'aria-live': 'off' });
    this.navEl = h('nav', { class: 'nav', 'aria-label': 'Ledgers' });
    this.overlaysEl = h('div', { class: 'overlays', role: 'toolbar', 'aria-label': 'Map overlays' });
    this.legendEl = h('div', { class: 'legend hidden' });
    this.toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.decisionsEl = h('div', { class: 'decisions' });
    this.bannerEl = h('div', { class: 'banner hidden', role: 'status' });
    this.tipEl = h('div', { class: 'hover-tip hidden' });
    this.tutorialEl = h('div', { class: 'tutorial hidden', role: 'dialog', 'aria-label': 'Tutorial' });
    this.modalLayer = h('div', { class: 'modal-layer hidden' });
    this.dialogLayer = h('div', { class: 'modal-layer hidden' });
    this.mainEl = h(
      'div',
      { class: 'main' },
      this.canvas,
      this.navEl,
      this.contextEl,
      this.overlaysEl,
      this.legendEl,
      this.decisionsEl,
      this.toastsEl,
      this.bannerEl,
      this.tipEl,
      this.tutorialEl,
      this.modalLayer,
      this.dialogLayer,
    );
    this.gameEl = h('div', { style: 'display:contents' }, this.topbarEl, this.mainEl);
    this.root.appendChild(this.gameEl);
    this.renderer = new MapRenderer(this.canvas);
    this.modalLayer.addEventListener('pointerdown', (e) => {
      if (e.target === this.modalLayer) this.closeModal();
    });
    this.bindCanvas();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.mainEl);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderNav();
    this.renderOverlayBar();
  }

  private resize(): void {
    if (!this.renderer || !this.mainEl) return;
    const r = this.mainEl.getBoundingClientRect();
    this.renderer.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2.5, window.devicePixelRatio || 1));
    this.mapDirty = true;
  }

  // ───────────────────────────── Loop ───────────────────────────────────────

  private frame(t: number): void {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(250, t - this.lastFrame);
    this.lastFrame = t;
    const sim = this.sim;
    if (!sim || !this.renderer) return;
    const blocked = !this.modalLayer.classList.contains('hidden') && false;
    if (this.speed > 0 && !blocked && !isOver(sim)) {
      this.acc += (dt / 1000) * SPEEDS[this.speed];
      let steps = 0;
      while (this.acc >= 1 && steps < 6 && this.speed > 0 && !isOver(sim)) {
        step(sim);
        this.acc -= 1;
        steps++;
        this.afterTick();
      }
      if (this.acc > 3) this.acc = 0;
    }
    const animating = Object.keys(sim.state.battles).length > 0 && !this.settings.reducedMotion;
    if (this.mapDirty || animating) {
      this.drawMap(dt);
      this.mapDirty = false;
    }
    if (this.uiDirty && t - this.lastUI > 200 && !this.pointerDown && !this.editingForm()) {
      this.lastUI = t;
      this.uiDirty = false;
      this.renderUI();
    }
  }

  private drawMap(dt: number): void {
    const sim = this.sim;
    if (!sim || !this.renderer) return;
    let previewPath: ProvinceId[] | null = null;
    let previewLabel: string | null = null;
    const a = this.selectedArmy ? sim.state.armies[this.selectedArmy] : undefined;
    if (a && a.nation === this.player && this.hoverProvince && this.hoverProvince !== a.location && (this.moveMode || this.hoverPos)) {
      const r = findPath(sim, a.nation, a.location, this.hoverProvince);
      if (r) {
        previewPath = r.path;
        previewLabel = `${weeks(etaWeeks(sim, a, r.path))}`;
      } else if (!canEnter(sim, a.nation, this.hoverProvince)) previewLabel = null;
    }
    this.renderer.draw(
      sim,
      {
        selectedProvince: this.selectedProvince,
        selectedArmy: this.selectedArmy,
        hoverProvince: this.hoverProvince,
        previewPath,
        previewLabel,
        overlay: this.overlay,
        patterns: this.settings.patterns,
        showNames: this.settings.showNames,
        reducedMotion: this.settings.reducedMotion,
        player: this.player,
      },
      dt / 1000,
    );
  }

  /** A select/input inside a panel has focus: rebuilding would close or reset it. */
  private editingForm(): boolean {
    const a = document.activeElement as HTMLElement | null;
    if (!a || !(a.tagName === 'SELECT' || a.tagName === 'INPUT')) return false;
    return !!a.closest('.modal-layer, .context');
  }

  refresh(): void {
    this.uiDirty = true;
    this.mapDirty = true;
    this.lastUI = 0;
  }

  renderUI(): void {
    const sim = this.sim;
    if (!sim) return;
    renderTopbar(this);
    const st = this.contextEl.scrollTop;
    renderContext(this);
    this.contextEl.scrollTop = st;
    renderDecisions(this);
    this.renderNav();
    this.renderLegend();
    if (this.ui.ledgerTab) {
      const body = this.modalLayer.querySelector('.body');
      const top = body?.scrollTop ?? 0;
      renderLedger(this);
      const nb = this.modalLayer.querySelector('.body');
      if (nb) nb.scrollTop = top;
    }
    this.tutorial?.update();
    this.renderBanner();
  }

  // ───────────────────────────── Time ───────────────────────────────────────

  setSpeed(s: number): void {
    if (s > 0) this.lastSpeed = s;
    this.speed = s;
    this.acc = 0;
    this.uiDirty = true;
  }

  togglePause(): void {
    this.setSpeed(this.speed > 0 ? 0 : this.lastSpeed || 2);
  }

  private afterTick(): void {
    const sim = this.sim!;
    const st = sim.state;
    this.mapDirty = true;
    this.uiDirty = true;
    const pid = this.player;
    for (const n of st.notifications) {
      if (n.id <= this.lastNote) continue;
      const mine = n.nation === pid;
      const world = n.nation === null;
      if (!mine && !(world && n.priority !== 'low')) continue;
      if (n.priority !== 'low') this.toast(n.text, n.priority === 'urgent' ? 'urgent' : 'info', n.province);
      if (mine) {
        if (n.kind === 'battle') this.sound.play('battle');
        if (n.kind === 'war' && n.priority === 'urgent') {
          this.sound.play('war');
          if (this.settings.autoPauseWar) this.setSpeed(0);
        }
        if (n.kind === 'battle' && this.settings.autoPauseBattle && /^Battle of/.test(n.text)) this.setSpeed(0);
        if (n.kind === 'peace') this.sound.play('peace');
        if (n.kind === 'event') {
          this.sound.play('event');
          if (this.settings.autoPauseEvent) {
            this.setSpeed(0);
            const pe = st.nations[pid!].pendingEvents[0];
            if (pe) showEventDialog(this, pe.id);
          }
        }
        if ((n.kind === 'proposal' || n.kind === 'callToArms') && n.priority !== 'low') {
          this.sound.play('alert');
          if (this.settings.autoPauseProposal) {
            this.setSpeed(0);
            const pr = st.proposals.find((p) => p.to === pid);
            if (pr) showProposalDialog(this, pr.id);
          }
        }
        if (n.kind === 'build') this.sound.play('build');
        if (['bankrupt', 'revolt', 'surrender', 'capital', 'debt'].includes(n.kind)) this.sound.play('alert');
      }
      if (n.kind === 'result') this.sound.play(st.result?.playerOutcome === 'victory' ? 'victory' : 'defeat');
    }
    this.lastNote = st.notifications.at(-1)?.id ?? this.lastNote;
    this.tutorial?.update();
    if (this.settings.autosaveMonths > 0 && st.tick - this.lastAutosave >= months(this.settings.autosaveMonths)) void this.autosave();
    if (st.result && !st.continueAfterResult && !this.endShown) {
      this.endShown = true;
      this.setSpeed(0);
      void this.autosave(true);
      this.showEnd();
    }
    // selected army destroyed?
    if (this.selectedArmy && !st.armies[this.selectedArmy]) {
      this.selectedArmy = null;
      this.moveMode = false;
    }
  }

  /** Developer/test hook (console only): advance the simulation N weeks immediately. */
  debugAdvance(weeksToRun: number): void {
    const sim = this.sim;
    if (!sim) return;
    for (let i = 0; i < weeksToRun && !isOver(sim); i++) {
      step(sim);
      this.afterTick();
    }
    this.refresh();
  }

  showEnd(): void {
    if (!this.sim) return;
    this.showScreen(renderEndScreen(this));
  }

  continueAfterEnd(): void {
    if (!this.sim) return;
    this.sim.state.continueAfterResult = true;
    this.hideScreen();
    this.refresh();
  }

  // ───────────────────────────── Commands ───────────────────────────────────

  do(cmd: PlayerCommand, quiet = false): CommandResult {
    const sim = this.sim;
    const pid = this.player;
    if (!sim || !pid) return { ok: false, reason: 'No active realm.' };
    const full = { ...cmd, nation: pid } as Command;
    const r = applyCommand(sim, full);
    if (!r.ok) {
      this.toast(r.reason, 'fail');
      this.sound.play('alert');
    } else {
      if (r.message && !quiet) this.toast(r.message, 'good');
      this.sound.play('click');
      // new pending decisions triggered by the command?
      this.afterTickNotesOnly();
    }
    this.refresh();
    this.tutorial?.update();
    return r;
  }

  private afterTickNotesOnly(): void {
    const st = this.sim!.state;
    for (const n of st.notifications) {
      if (n.id <= this.lastNote) continue;
      if (n.nation === this.player && n.priority === 'urgent') this.toast(n.text, 'urgent', n.province);
    }
    this.lastNote = st.notifications.at(-1)?.id ?? this.lastNote;
  }

  // ───────────────────────────── Selection ──────────────────────────────────

  selectProvince(pid: ProvinceId | null, center = false): void {
    this.selectedProvince = pid;
    this.selectedArmy = null;
    this.moveMode = false;
    if (pid && center) this.centerOn(pid);
    this.contextEl.scrollTop = 0;
    this.refresh();
  }

  selectArmy(id: string | null, center = false): void {
    this.selectedArmy = id;
    this.moveMode = false;
    this.ui.split = {};
    if (id && this.sim?.state.armies[id]) {
      this.selectedProvince = null;
      if (center) this.centerOn(this.sim.state.armies[id].location);
    }
    this.contextEl.scrollTop = 0;
    this.refresh();
  }

  centerOn(pid: ProvinceId): void {
    if (!this.renderer) return;
    const c = MapRenderer.provinceCenter(pid);
    const cam = this.renderer.camera;
    cam.centerOn(c.x, c.y, Math.max(cam.zoom, 0.8));
    // keep the province clear of the side panel on wide screens
    const panel = this.contextEl?.getBoundingClientRect();
    if (panel && panel.width && panel.height > this.mainEl.clientHeight * 0.6 && panel.width < this.mainEl.clientWidth * 0.6) cam.pan(-panel.width / 2, 0);
    this.mapDirty = true;
  }

  startMoveMode(): void {
    if (!this.selectedArmy) return;
    this.moveMode = true;
    this.canvas.classList.add('move-mode');
    this.refresh();
  }

  cancelMoveMode(): void {
    this.moveMode = false;
    this.canvas.classList.remove('move-mode');
    this.refresh();
  }

  orderMove(dest: ProvinceId): void {
    if (!this.selectedArmy) return;
    this.do({ type: 'move', army: this.selectedArmy, dest }, true);
    this.cancelMoveMode();
  }

  setOverlay(o: Overlay): void {
    this.overlay = o;
    this.renderOverlayBar();
    this.refresh();
    this.tutorial?.update();
  }

  // ───────────────────────────── Modals & toasts ────────────────────────────

  openLedger(tab: LedgerTab): void {
    this.ui.ledgerTab = tab;
    this.modalLayer.classList.remove('hidden');
    renderLedger(this);
    this.tutorial?.update();
  }

  closeModal(): void {
    this.ui.ledgerTab = null;
    this.modalLayer.classList.add('hidden');
    setChildren(this.modalLayer);
    this.canvas.focus({ preventScroll: true });
    this.refresh();
  }

  toast(text: string, kind: 'info' | 'urgent' | 'good' | 'fail' = 'info', province?: string): void {
    if (!this.toastsEl) return;
    const el = h('div', { class: `toast ${kind}`, role: kind === 'urgent' ? 'alert' : 'status' }, text);
    el.addEventListener('click', () => {
      if (province) this.selectProvince(province, true);
      el.remove();
    });
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild?.remove();
    setTimeout(() => el.remove(), kind === 'urgent' ? 9000 : 5000);
  }

  // ───────────────────────────── Saves ──────────────────────────────────────

  async save(slot: string): Promise<boolean> {
    if (!this.sim) return false;
    try {
      await this.store.put(slot, serialize(this.sim));
      this.toast(`Saved (${slot}).`, 'good');
      return true;
    } catch (e) {
      this.toast((e as Error).message, 'fail');
      return false;
    }
  }

  async autosave(force = false): Promise<void> {
    const sim = this.sim;
    if (!sim || !sim.state.settings.playerNation) return;
    if (!force && this.settings.autosaveMonths <= 0) return;
    this.lastAutosave = sim.state.tick;
    try {
      await this.store.autosave(serialize(sim));
    } catch (e) {
      this.toast(`Autosave failed: ${(e as Error).message}`, 'fail');
    }
  }

  async load(slot: string): Promise<void> {
    const text = await this.store.get(slot);
    if (!text) {
      this.toast('That save no longer exists.', 'fail');
      return;
    }
    this.loadText(text);
  }

  loadText(text: string): boolean {
    try {
      const sim = deserialize(text);
      this.startGame(sim, false);
      this.toast(`Loaded ${dateOf(sim).label}.`, 'good');
      return true;
    } catch (e) {
      const msg = e instanceof SaveError ? e.message : `Could not load: ${(e as Error).message}`;
      dialog(this, 'Cannot load this save', [h('p', null, msg), h('p', { class: 'muted' }, 'Your current campaign has not been changed.')]);
      return false;
    }
  }

  exportSave(): void {
    if (!this.sim) return;
    const d = dateOf(this.sim);
    const nation = this.player ?? 'observer';
    downloadText(`crown-and-frontier-${nation}-${d.year}-${d.month + 1}.json`, serialize(this.sim));
  }

  // ───────────────────────────── Input ──────────────────────────────────────

  private bindCanvas(): void {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (!this.renderer) return;
        const r = c.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
        this.renderer.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
        this.mapDirty = true;
      },
      { passive: false },
    );
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), button: e.button, moved: false });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      if (e.pointerType === 'touch' && this.pointers.size === 1) {
        this.longPress = window.setTimeout(() => {
          const p = this.pointers.get(e.pointerId);
          if (p && !p.moved) {
            p.moved = true;
            this.secondaryAt(p.x, p.y);
          }
        }, 550);
      }
    });
    c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        this.hover(x, y);
        return;
      }
      if (this.pointers.size === 2 && this.renderer) {
        const prev = { ...p };
        p.x = x;
        p.y = y;
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.renderer.camera.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / this.pinchDist);
        this.renderer.camera.pan((x - prev.x) / 2, (y - prev.y) / 2);
        this.pinchDist = d;
        for (const q of this.pointers.values()) q.moved = true;
        this.mapDirty = true;
        return;
      }
      const dx = x - p.x;
      const dy = y - p.y;
      if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 6) p.moved = true;
      if (p.moved && this.renderer) {
        this.renderer.camera.pan(dx, dy);
        this.mapDirty = true;
        this.tipEl.classList.add('hidden');
      }
      p.x = x;
      p.y = y;
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.longPress) {
        clearTimeout(this.longPress);
        this.longPress = null;
      }
      if (!p || p.moved || this.pointers.size > 0 || e.type === 'pointercancel') return;
      if (p.button === 2) this.secondaryAt(p.x, p.y);
      else if (p.button === 0) this.primaryAt(p.x, p.y);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('pointerleave', () => {
      this.hoverPos = null;
      this.hoverProvince = null;
      this.tipEl.classList.add('hidden');
      this.mapDirty = true;
    });
  }

  private hover(x: number, y: number): void {
    if (!this.renderer || !this.sim) return;
    this.hoverPos = { x, y };
    const pid = this.renderer.provinceAt(x, y);
    if (pid !== this.hoverProvince) {
      this.hoverProvince = pid;
      this.mapDirty = true;
    }
    if (!pid) {
      this.tipEl.classList.add('hidden');
      return;
    }
    const sim = this.sim;
    const p = sim.state.provinces[pid];
    const def = sim.world.prov[pid];
    const owner = p.owner ? sim.world.nationDefs[p.owner].short : 'Unclaimed';
    const occ = p.controller && p.controller !== p.owner ? ` · occupied by ${sim.world.nationDefs[p.controller].short}` : '';
    let extra = '';
    const a = this.selectedArmy ? sim.state.armies[this.selectedArmy] : undefined;
    if (a && a.nation === this.player && pid !== a.location) {
      const r = findPath(sim, a.nation, a.location, pid);
      extra = r ? `<br><b>Right-click${this.moveMode ? ' / click' : ''}</b> to march: ${weeks(etaWeeks(sim, a, r.path))}` : '<br><span class="bad">No legal route (no military access)</span>';
    }
    this.tipEl.innerHTML = `<b>${def.name}</b> — ${owner}${occ}<br><span class="muted">${def.terrain}, dev ${p.dev}${p.owner ? `, integration ${Math.floor(p.integration)}` : ''}${p.fort ? `, fort ${p.fort}` : ''}</span>${extra}`;
    this.tipEl.classList.remove('hidden');
    const W = this.mainEl.clientWidth;
    this.tipEl.style.left = `${Math.min(x + 16, W - 290)}px`;
    this.tipEl.style.top = `${y + 18}px`;
  }

  private primaryAt(x: number, y: number): void {
    if (!this.renderer || !this.sim) return;
    this.canvas.focus({ preventScroll: true });
    const pid = this.renderer.provinceAt(x, y);
    if (this.moveMode && this.selectedArmy) {
      if (pid) this.orderMove(pid);
      else this.cancelMoveMode();
      return;
    }
    const army = this.renderer.armyAt(x, y);
    if (army) {
      this.selectArmy(army);
      return;
    }
    this.selectProvince(pid);
  }

  private secondaryAt(x: number, y: number): void {
    if (!this.renderer || !this.sim) return;
    const pid = this.renderer.provinceAt(x, y);
    const a = this.selectedArmy ? this.sim.state.armies[this.selectedArmy] : undefined;
    if (a && a.nation === this.player && pid) this.orderMove(pid);
    else if (pid) this.selectProvince(pid);
  }

  private onVisibility(): void {
    if (document.hidden) {
      if (this.speed > 0) {
        this.lastSpeed = this.speed;
        this.setSpeed(0);
        this.toast('Paused while the tab was hidden.');
      }
      this.sound.suspend();
      void this.autosave(true);
    } else this.sound.resume();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this.sim || this.screenEl) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const cam = this.renderer?.camera;
    const dialogOpen = !this.dialogLayer.classList.contains('hidden');
    if (k === 'Escape') {
      if (dialogOpen) return;
      if (this.moveMode) this.cancelMoveMode();
      else if (this.ui.ledgerTab) this.closeModal();
      else {
        this.selectedArmy = null;
        this.selectProvince(null);
      }
      e.preventDefault();
      return;
    }
    if (dialogOpen) return;
    const ledgers: Record<string, LedgerTab> = { b: 'realm', m: 'military', t: 'research', p: 'policy', d: 'diplomacy', w: 'wars', v: 'victory', l: 'log', h: 'help' };
    const lk = k.toLowerCase();
    if (k === ' ') {
      this.togglePause();
      e.preventDefault();
    } else if (['1', '2', '3', '4'].includes(k)) this.setSpeed(Number(k));
    else if (ledgers[lk] && !e.shiftKey) {
      if (this.ui.ledgerTab === ledgers[lk]) this.closeModal();
      else this.openLedger(ledgers[lk]);
    } else if (lk === 'o') {
      const i = OVERLAYS.findIndex((o) => o.id === this.overlay);
      this.setOverlay(OVERLAYS[(i + 1) % OVERLAYS.length].id);
    } else if (lk === 'g' && this.selectedArmy) this.startMoveMode();
    else if (k === 'Home' && this.player) {
      const cap = this.sim.state.nations[this.player].capital;
      if (cap) this.centerOn(cap);
    } else if (cam && (k === '+' || k === '=')) cam.zoomAt(cam.vw / 2, cam.vh / 2, 1.2);
    else if (cam && (k === '-' || k === '_')) cam.zoomAt(cam.vw / 2, cam.vh / 2, 1 / 1.2);
    else if (cam && k === 'ArrowLeft') cam.pan(80, 0);
    else if (cam && k === 'ArrowRight') cam.pan(-80, 0);
    else if (cam && k === 'ArrowUp') cam.pan(0, 80);
    else if (cam && k === 'ArrowDown') cam.pan(0, -80);
    else if (lk === 'n') this.cycleArmy();
    else return;
    this.mapDirty = true;
    this.uiDirty = true;
  }

  cycleArmy(): void {
    const sim = this.sim;
    if (!sim || !this.player) return;
    const mine = Object.values(sim.state.armies)
      .filter((a) => a.nation === this.player)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    if (!mine.length) return;
    const i = mine.findIndex((a) => a.id === this.selectedArmy);
    this.selectArmy(mine[(i + 1) % mine.length].id, true);
  }

  // ───────────────────────────── Chrome ─────────────────────────────────────

  renderNav(): void {
    const sim = this.sim;
    if (!sim || !this.navEl) return;
    const pid = this.player;
    const warCount = pid ? Object.values(sim.state.wars).filter((w) => w.attackers.includes(pid) || w.defenders.includes(pid)).length : 0;
    const item = (tab: LedgerTab, label: string, key: string, badge?: number) => {
      const b = h('button', { class: `btn ${this.ui.ledgerTab === tab ? 'active' : ''}`, type: 'button', 'aria-keyshortcuts': key }, label, badge ? h('span', { class: 'badge' }, badge) : null, h('kbd', null, key));
      b.addEventListener('click', () => (this.ui.ledgerTab === tab ? this.closeModal() : this.openLedger(tab)));
      return b;
    };
    const n = pid ? sim.state.nations[pid] : null;
    setChildren(
      this.navEl,
      item('realm', 'Realm', 'B'),
      item('military', 'Military', 'M'),
      item('research', 'Research', 'T', n && !n.research.current && n.alive ? 1 : 0),
      item('policy', 'Policy', 'P'),
      item('diplomacy', 'Diplomacy', 'D'),
      item('wars', 'Wars', 'W', warCount),
      item('victory', 'Victory', 'V'),
      item('log', 'Log', 'L'),
      item('help', 'Help', 'H'),
    );
  }

  renderOverlayBar(): void {
    setChildren(
      this.overlaysEl,
      OVERLAYS.map((o) => {
        const b = h('button', { class: `btn small ${this.overlay === o.id ? 'active' : ''}`, type: 'button', 'aria-pressed': this.overlay === o.id ? 'true' : 'false' }, o.label);
        b.addEventListener('click', () => this.setOverlay(o.id));
        return b;
      }),
    );
  }

  private renderLegend(): void {
    const L = this.legendEl;
    const sw = (c: string, t: string) => h('div', null, h('span', { class: 'sw', style: `background:${c}` }), t);
    const items: Record<Overlay, HTMLElement[] | null> = {
      political: null,
      terrain: [sw('#c7cf8c', 'Plains'), sw('#d8c48e', 'Steppe'), sw('#7ea266', 'Forest'), sw('#b99f72', 'Hills'), sw('#8aa89a', 'Marsh'), sw('#a0968c', 'Mountains')],
      supply: [sw('#4f9a57', 'Supply source (integrated ≥50, fort or capital)'), sw('#a9d08a', 'Within supply range'), sw('#e59f5b', 'One step beyond range (foraging)'), sw('#b9aea0', 'Out of reach')],
      diplomacy: [sw('#d8b36a', 'Your realm'), sw('#3f78c4', 'Ally'), sw('#58a7a0', 'Pact or trade'), sw('#c2463d', 'At war'), sw('#8fbf9a', 'Friendly'), sw('#d98a5f', 'Hostile opinion')],
      integration: [sw('#c2463d', '0 — raw frontier'), sw('#e0b347', '50 — supply source'), sw('#4f9a57', '100 — integrated')],
      development: [sw('#efe7d4', 'Dev 1'), sw('#a592b8', 'Dev 5'), sw('#5b3f86', 'Dev 10')],
    };
    const list = items[this.overlay];
    L.classList.toggle('hidden', !list);
    if (list) setChildren(L, h('b', null, OVERLAYS.find((o) => o.id === this.overlay)!.label), list);
  }

  private renderBanner(): void {
    const a = this.selectedArmy && this.sim ? this.sim.state.armies[this.selectedArmy] : undefined;
    if (this.moveMode && a) {
      this.bannerEl.classList.remove('hidden');
      const cancel = h('button', { class: 'btn small', type: 'button' }, 'Cancel');
      cancel.addEventListener('click', () => this.cancelMoveMode());
      setChildren(this.bannerEl, h('span', null, `Choose a destination for ${a.name}.`), cancel);
    } else {
      this.bannerEl.classList.add('hidden');
      this.canvas?.classList.remove('move-mode');
    }
  }
}
