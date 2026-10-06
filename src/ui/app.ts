// Browser application shell: screens, game loop, input, selection and the
// bridge between interface actions and simulation commands. All game actions
// go through applyCommand() — the same validation the AI uses.

import { applyCommand } from '../sim/commands';
import { buildProblem, projectCost } from '../sim/construction';
import { createGame, type NewGameOptions } from '../sim/game';
import { canEnter, etaWeeks, findPath } from '../sim/movement';
import { readSave, SaveError, serialize } from '../sim/save';
import { atWar, dateOf, months, ownedProvinces, provName, type Sim } from '../sim/state';
import { isOver, step } from '../sim/tick';
import { fleetEta, fleetsIn, fleetSummary, pathToCoast, transportFor, zonePath } from '../sim/naval';
import type { AirMission, Army, Command, CommandResult, Demand, DemandKind, NationId, ProvinceId } from '../sim/types';
import { Sound } from './audio';
import { h, setChildren } from './dom';
import { fontsReady } from './fonts';
import { spritesReady } from './map/sprites';
import { weeks } from './format';
import { icon } from './icons';
import type { MapGeometry } from './map/geometry';
import { loadGeometry, registerPackageGeometry } from './map/maps';
import { parseMapPackage, type MapCheck } from '../maps/validate';
import { isBuiltinMap, registerMapScenario } from '../sim/world';
import { MODES, type MapMode } from './map/modes';
import { MapRenderer } from './map/renderer';
import { hideTip, installTips, shield, tip } from './panels/common';
import { dialog, pendingDecisions, renderDock } from './panels/dialogs';
import { attention, renderHud } from './panels/hud';
import { renderInspector } from './panels/inspector';
import { renderLedger, type LedgerTab } from './panels/ledgers';
import { Minimap, renderModes, renderNavCluster } from './panels/mapui';
import { openMenuDialog, renderEndScreen, renderMenu, screenCleanup } from './screens';
import { loadSettings, saveSettings, type UISettings } from './settings';
import { MapLibrary } from './maplib';
import { downloadText, SaveStore } from './storage';
import { Tutorial } from './tutorial';

type DistOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type PlayerCommand = DistOmit<Command, 'nation'>;

export const SPEEDS = [0, 0.5, 1, 2.5, 6]; // ticks (weeks) per second; index 2 is "normal"

export interface UIState {
  peace: { war: string; with: string; mode: 'demand' | 'concede' | 'white'; provinces: string[]; gold: number } | null;
  /** peace conferences being drafted (a settlement for every party), by war */
  settle: Record<string, { demands: Demand[]; offer: boolean; kind: DemandKind; from: string; to: string; province: string; amount: number }>;
  /** demands struck out of a settlement we were offered (a counter-offer) */
  counter: { proposal: string; drop: number[] } | null;
  split: Record<string, number>;
  ledgerTab: LedgerTab | null;
  diploTarget: NationId | null;
  logFilter: 'all' | 'urgent' | 'battles';
  inspectorPeek: boolean;
  presentationOpen: boolean;
  dockOpen: boolean;
  dockItem: string | null;
  attentionOpen: boolean;
  /** move orders apply to every army in the selected army's group */
  groupOrders: boolean;
  /** legend panel open (starts closed on phones, where it would cover the map) */
  legendOpen: boolean;
}

const RAIL: Array<{ tab: LedgerTab; label: string; icon: Parameters<typeof icon>[0]; key: string; desk?: boolean }> = [
  { tab: 'realm', label: 'Realm', icon: 'crown', key: 'B' },
  { tab: 'industry', label: 'Industry', icon: 'factory', key: 'I' },
  { tab: 'military', label: 'Military', icon: 'military', key: 'M' },
  { tab: 'research', label: 'Research', icon: 'research', key: 'T' },
  { tab: 'focus', label: 'Focus', icon: 'policy', key: 'P', desk: true },
  { tab: 'diplomacy', label: 'Diplomacy', icon: 'diplomacy', key: 'D' },
  { tab: 'wars', label: 'Wars', icon: 'wars', key: 'W' },
  { tab: 'victory', label: 'Victory', icon: 'victory', key: 'V', desk: true },
  { tab: 'log', label: 'Chronicle', icon: 'chronicle', key: 'L', desk: true },
  { tab: 'help', label: 'Help', icon: 'help', key: 'H', desk: true },
];

export class App {
  readonly root: HTMLElement;
  settings: UISettings;
  store = new SaveStore();
  /** maps made in the editor or imported (stored apart from saves) */
  maps = new MapLibrary();
  sound = new Sound();
  sim: Sim | null = null;
  renderer: MapRenderer | null = null;
  geometry: MapGeometry | null = null;
  tutorial: Tutorial | null = null;

  speed = 0;
  lastSpeed = 2;
  selectedProvince: ProvinceId | null = null;
  selectedArmy: string | null = null;
  /** the player's army that a selected province would receive ("March here") */
  orderArmy: string | null = null;
  selectedFleet: string | null = null;
  selectedZone: string | null = null;
  selectedWing: string | null = null;
  hoverZone: string | null = null;
  /** what the next map click chooses: a fleet's destination, a beach for armies, an air target */
  targeting: { kind: 'fleet'; fleet: string } | { kind: 'ship'; armies: string[]; fleet: string } | { kind: 'air'; wing: string; mission: AirMission } | null = null;
  hoverProvince: ProvinceId | null = null;
  moveMode = false;
  mode: MapMode = 'political';
  /** the map mode a ledger replaced (restored when it closes, unless the player chose another) */
  private ledgerMode: { before: MapMode; shown: MapMode } | null = null;
  focusNation: NationId | null = null;
  highlight: ProvinceId[] | null = null;
  ui: UIState = this.freshUI();
  /** centre on this province once the panels have laid out (so it lands in the free area) */
  private pendingCenter: { pid: ProvinceId; zoomPx?: number; instant?: boolean } | null = null;

  private acc = 0;
  private lastFrame = 0;
  private lastUI = 0;
  private uiDirty = true;
  private mapDirty = true;
  private lastNote = 0;
  private lastAutosave = 0;
  private lastMinimap = 0;
  private endShown = false;
  private raf = 0;
  private starting = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; button: number; shift: boolean; moved: boolean }>();
  private pinchDist = 0;
  private longPress: number | null = null;
  private hoverPos: { x: number; y: number } | null = null;
  private pointerDown = false;
  private resizeObs: ResizeObserver | null = null;
  private lastAlertProvince: ProvinceId | null = null;

  // DOM
  private gameEl: HTMLElement | null = null;
  hudEl!: HTMLElement;
  stageEl!: HTMLElement;
  railEl!: HTMLElement;
  drawerEl!: HTMLElement;
  inspectorEl!: HTMLElement;
  modesEl!: HTMLElement;
  navClusterEl!: HTMLElement;
  minimapEl!: HTMLElement;
  toastsEl!: HTMLElement;
  dockEl!: HTMLElement;
  attentionEl!: HTMLElement;
  /** one dialog layer for the whole app, above the game and every screen */
  readonly dialogLayer: HTMLElement = h('div', { class: 'modal-layer app-layer hidden' });
  bannerEl!: HTMLElement;
  tipEl!: HTMLElement;
  tutorialEl!: HTMLElement;
  canvas!: HTMLCanvasElement;
  screenEl: HTMLElement | null = null;
  minimap: Minimap | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    // dialogs work on the menu screens too, not only during a campaign
    root.appendChild(this.dialogLayer);
    this.settings = loadSettings();
    this.mode = (MODES.some((m) => m.id === this.settings.mapMode) ? this.settings.mapMode : 'political') as MapMode;
    this.applySettings();
    installTips();
    // inside an iframe, a wheel over the game must never scroll the host page:
    // panels scroll themselves (contained), everything else zooms the map
    root.addEventListener(
      'wheel',
      (e) => {
        const t = e.target as HTMLElement | null;
        const scroller = t?.closest('.scroll, .screen-scroll, .modal > .body, .setup .col, .page') as HTMLElement | null;
        if (scroller && scroller.scrollHeight > scroller.clientHeight + 1) return;
        e.preventDefault();
        if (this.renderer && t && !t.closest('.hud') && this.stageEl?.contains(t) && t !== this.canvas) {
          const r = this.canvas.getBoundingClientRect();
          this.renderer.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
          this.mapDirty = true;
        }
      },
      { passive: false },
    );
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
    void fontsReady.then(() => {
      this.mapDirty = true;
    });
  }

  private freshUI(): UIState {
    return { peace: null, settle: {}, counter: null, split: {}, ledgerTab: null, diploTarget: null, logFilter: 'all', inspectorPeek: false, presentationOpen: false, dockOpen: false, dockItem: null, attentionOpen: false, groupOrders: false, legendOpen: this.settings?.showLegend ?? true };
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
    this.refresh();
  }

  async boot(progress: (pct: number, text: string) => void): Promise<void> {
    progress(55, 'Opening the archives…');
    await this.store.init();
    progress(70, 'Inking the maps…');
    await this.maps.init().catch(() => undefined);
    await Promise.all([fontsReady, spritesReady]);
    progress(95, 'Unrolling the atlas…');
    this.showMenu();
    progress(100, 'Ready');
  }

  // ───────────────────────────── Screens ────────────────────────────────────

  showScreen(el: HTMLElement): void {
    this.hideHover();
    this.hideScreen();
    this.screenEl = el;
    this.root.appendChild(el);
    hideTip();
  }

  hideScreen(): void {
    if (this.screenEl) screenCleanup.get(this.screenEl)?.();
    this.screenEl?.remove();
    this.screenEl = null;
  }

  showMenu(): void {
    this.setSpeed(0);
    this.showScreen(renderMenu(this));
  }

  /**
   * Makes a map package playable in this session: parsed, validated (with
   * actionable problems returned) and registered for the simulation and the
   * renderer. Nothing is registered when the map has errors.
   */
  registerMapPackage(text: string): { id: string | null; check: MapCheck } {
    const { pkg, check } = parseMapPackage(text);
    if (!pkg) return { id: null, check };
    if (isBuiltinMap(pkg.id)) {
      return { id: null, check: { ok: false, errors: [{ code: 'id', message: `"${pkg.id}" is the id of a built-in map; give the map another id.` }], warnings: check.warnings } };
    }
    registerMapScenario(pkg);
    registerPackageGeometry(pkg);
    return { id: pkg.id, check };
  }

  newGame(opts: NewGameOptions, tutorial: boolean): void {
    const sim = createGame(opts);
    void this.startGame(sim, tutorial);
  }

  async startGame(sim: Sim, tutorial = false): Promise<void> {
    const token = ++this.starting;
    const geometry = await loadGeometry(sim.state.scenarioId);
    await Promise.all([fontsReady, spritesReady]);
    if (token !== this.starting) return;
    this.teardownGame();
    this.sim = sim;
    this.geometry = geometry;
    this.lastNote = sim.state.notifications.at(-1)?.id ?? 0;
    this.lastAutosave = sim.state.tick;
    this.endShown = !!sim.state.result && !sim.state.continueAfterResult;
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.orderArmy = null;
    this.moveMode = false;
    this.focusNation = null;
    this.highlight = null;
    this.ui = this.freshUI();
    this.buildGameDom(geometry);
    this.hideScreen();
    if (this.isPhone()) this.ui.legendOpen = false;
    const cap = this.player ? sim.state.nations[this.player].capital : null;
    // centred after the first layout pass, so panels already count as covered
    if (cap) this.pendingCenter = { pid: cap, zoomPx: 96, instant: true };
    else this.renderer!.camera.fit(false);
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
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.gameEl?.remove();
    this.gameEl = null;
    this.renderer = null;
    this.minimap = null;
    this.sim = null;
    this.tutorial = null;
    // a dialog about the campaign that is closing goes with it
    this.dialogLayer.classList.add('hidden');
    setChildren(this.dialogLayer);
    hideTip();
  }

  quitToMenu(): void {
    void this.autosave(true).finally(() => {
      this.teardownGame();
      this.showMenu();
    });
  }

  private buildGameDom(geometry: MapGeometry): void {
    this.canvas = h('canvas', { class: 'map', 'aria-label': 'Strategic map. Click a province or army to select it; right-click to move the selected army.', tabindex: 0 });
    this.hudEl = h('header', { class: 'hud', role: 'toolbar', 'aria-label': 'Realm, resources and time' });
    this.railEl = h('nav', { class: 'rail', 'aria-label': 'Ledgers' });
    this.drawerEl = h('section', { class: 'drawer closed', 'aria-label': 'Ledger' });
    this.inspectorEl = h('aside', { class: 'inspector closed', 'aria-label': 'Selection' });
    this.modesEl = h('div', { class: 'modes' });
    this.navClusterEl = h('div', { class: 'navcl' });
    this.toastsEl = h('div', { class: 'toasts', 'aria-live': 'polite' });
    this.dockEl = h('div', { class: 'dock' });
    this.attentionEl = h('div', { class: 'legend hidden', style: 'position:absolute;right:8px;top:8px;z-index:41;width:min(360px,calc(100% - 16px))' });
    this.bannerEl = h('div', { class: 'banner hidden', role: 'status' });
    this.tipEl = h('div', { class: 'hover-tip hidden' });
    this.tutorialEl = h('div', { class: 'tutorial hidden', role: 'dialog', 'aria-label': 'Tutorial' });
    this.stageEl = h(
      'main',
      { class: 'stage' },
      this.canvas,
      this.railEl,
      this.drawerEl,
      this.inspectorEl,
      this.modesEl,
      this.navClusterEl,
      this.toastsEl,
      this.dockEl,
      this.attentionEl,
      this.bannerEl,
      this.tipEl,
      this.tutorialEl,
    );
    this.gameEl = h('div', { style: 'display:contents' }, this.hudEl, this.stageEl);
    this.root.appendChild(this.gameEl);
    const sim = this.sim!;
    this.renderer = new MapRenderer(this.canvas, geometry, (id) => sim.world.prov[id]?.terrain ?? 'plains');
    this.minimap = new Minimap(this);
    this.minimapEl = this.minimap.el;
    this.bindCanvas();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.stageEl);
    this.resize();
  }

  private resize(): void {
    if (!this.renderer || !this.stageEl) return;
    const r = this.stageEl.getBoundingClientRect();
    this.renderer.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(2.5, window.devicePixelRatio || 1));
    this.updateInsets();
    this.mapDirty = true;
  }

  isPhone(): boolean {
    return (this.stageEl?.getBoundingClientRect().width ?? window.innerWidth) <= 760;
  }

  /** Tell the camera which parts of the map are covered by panels. */
  private updateInsets(): void {
    const cam = this.renderer?.camera;
    if (!cam || !this.stageEl) return;
    const s = this.stageEl.getBoundingClientRect();
    const open = (el: HTMLElement | null, cls = 'closed') => !!el && !el.classList.contains(cls) && el.getBoundingClientRect().height > 0;
    const ins = { left: 0, right: 0, top: 0, bottom: 0 };
    // bottom: whatever sits lowest-first along the bottom edge (rail on phones, mode bar and legend)
    let bottomEdge = s.bottom;
    const lower = (el: HTMLElement | null) => {
      if (el && el.getBoundingClientRect().height > 0) bottomEdge = Math.min(bottomEdge, el.getBoundingClientRect().top);
    };
    if (this.isPhone()) {
      lower(this.railEl);
      if (open(this.inspectorEl)) lower(this.inspectorEl);
      lower(this.modesEl.firstElementChild as HTMLElement | null);
    } else {
      ins.left = this.railEl.getBoundingClientRect().right - s.left + 8;
      if (open(this.drawerEl)) ins.left = this.drawerEl.getBoundingClientRect().right - s.left + 8;
      if (open(this.inspectorEl)) ins.right = s.right - this.inspectorEl.getBoundingClientRect().left + 8;
      bottomEdge = s.bottom - 52;
    }
    ins.bottom = Math.max(0, s.bottom - bottomEdge);
    // top: the tutorial coach mark when it sits at the top of the stage
    if (open(this.tutorialEl, 'hidden')) {
      const t = this.tutorialEl.getBoundingClientRect();
      if (t.top - s.top < s.height / 3) ins.top = t.bottom - s.top + 8;
    }
    // never let panels claim more than two thirds of the map in either direction
    ins.bottom = Math.min(ins.bottom, s.height * 0.66 - ins.top);
    cam.insets = ins;
  }

  // ───────────────────────────── Loop ───────────────────────────────────────

  private frame(t: number): void {
    this.raf = requestAnimationFrame((tt) => this.frame(tt));
    const dt = Math.min(250, t - this.lastFrame);
    this.lastFrame = t;
    const sim = this.sim;
    if (!sim || !this.renderer) return;
    if (this.speed > 0 && !isOver(sim)) {
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
    if (this.mapDirty || this.renderer.camera.animating || this.wantsFrame) {
      this.mapDirty = false;
      this.drawMap(t);
      if (t - this.lastMinimap > 120) {
        this.lastMinimap = t;
        this.minimap?.draw();
      }
    }
    if (this.uiDirty && t - this.lastUI > 180 && !this.pointerDown && !this.editingForm()) {
      this.lastUI = t;
      this.uiDirty = false;
      this.renderUI();
    }
  }

  private wantsFrame = false;

  private drawMap(now: number): void {
    const sim = this.sim;
    if (!sim || !this.renderer) return;
    let previewPath: ProvinceId[] | null = null;
    let previewLabel: string | null = null;
    let previewBad = false;
    const a = this.selectedArmy ? sim.state.armies[this.selectedArmy] : undefined;
    if (a && a.nation === this.player && this.hoverProvince && this.hoverProvince !== a.location && (this.moveMode || this.hoverPos)) {
      const r = findPath(sim, a.nation, a.location, this.hoverProvince);
      if (r) {
        previewPath = r.path;
        previewLabel = weeks(etaWeeks(sim, a, r.path));
      } else if (this.moveMode) {
        previewLabel = canEnter(sim, a.nation, this.hoverProvince) ? 'No route' : 'No access';
        previewBad = true;
      }
    }
    // a fleet's route preview to the zone under the pointer
    let fleetPreview: string[] | null = null;
    let fleetPreviewLabel: string | null = null;
    const fl = this.selectedFleet ? sim.state.fleets[this.selectedFleet] : undefined;
    if (fl && fl.nation === this.player && (this.targeting?.kind === 'fleet' || this.hoverPos)) {
      const dest = this.hoverZone ?? (this.hoverProvince ? pathToCoast(sim, fl.zone, this.hoverProvince)?.at(-1) ?? null : null);
      if (dest && dest !== fl.zone) {
        fleetPreview = zonePath(sim, fl.zone, dest);
        if (fleetPreview) fleetPreviewLabel = weeks(fleetEta(sim, fl, fleetPreview));
      }
    }
    const s = this.settings;
    this.wantsFrame = this.renderer.draw(
      sim,
      {
        selectedProvince: this.selectedProvince,
        selectedArmy: this.selectedArmy,
        hoverProvince: this.hoverProvince,
        previewPath,
        previewLabel,
        previewBad,
        mode: this.mode,
        focusNation: this.focusNation,
        highlight: this.highlight,
        reducedMotion: s.reducedMotion,
        player: this.player,
        presentation: { labels: s.labelDensity, terrain: s.terrainDetail, borders: s.borderEmphasis, armies: s.armyMarkers, patterns: s.patterns },
        outlineRealm: this.ui.ledgerTab === 'diplomacy' ? this.ui.diploTarget : null,
        selectedFleet: this.selectedFleet,
        selectedZone: this.selectedZone,
        selectedWing: this.selectedWing,
        fleetPreview,
        fleetPreviewLabel,
      },
      now,
    );
    // the political legend lists the realms on screen: rebuild it once the view settles
    if (this.mode === 'political' && this.ui.legendOpen && !this.wantsFrame) {
      const cam = this.renderer.camera;
      const key = `${Math.round(cam.offX / 40)}|${Math.round(cam.offY / 40)}|${cam.zoom.toFixed(3)}|${sim.state.rev}`;
      if (key !== this.legendKey) {
        this.legendKey = key;
        renderModes(this);
      }
    }
  }

  private legendKey = '';

  /** A select/input inside a panel has focus: rebuilding would close or reset it. */
  private editingForm(): boolean {
    const a = document.activeElement as HTMLElement | null;
    if (!a || !(a.tagName === 'SELECT' || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return false;
    return !!a.closest('.drawer, .inspector, .modal-layer, .dock');
  }

  refresh(): void {
    this.uiDirty = true;
    this.mapDirty = true;
    this.lastUI = 0;
  }

  mapChanged(): void {
    this.mapDirty = true;
  }

  renderUI(): void {
    const sim = this.sim;
    if (!sim) return;
    renderHud(this);
    this.renderRail();
    renderInspector(this);
    this.inspectorEl.classList.toggle('peek', this.ui.inspectorPeek);
    if (this.ui.ledgerTab) renderLedger(this);
    renderModes(this);
    renderNavCluster(this);
    renderDock(this);
    this.renderAttention();
    this.tutorial?.update();
    this.renderBanner();
    this.updateInsets();
    if (this.pendingCenter) {
      const p = this.pendingCenter;
      this.pendingCenter = null;
      if (p.instant && this.renderer) {
        const c = this.renderer.provinceCenter(p.pid);
        const cam = this.renderer.camera;
        cam.centerOn(c.x, c.y, cam.zoomForProvincePx(p.zoomPx ?? 96), false);
        this.mapDirty = true;
      } else this.centerOn(p.pid, p.zoomPx);
    }
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
      // own news toasts; world news only when urgent (the rest is in the Chronicle)
      if (mine ? n.priority !== 'low' : world && n.priority === 'urgent') this.toast(n.text, n.priority === 'urgent' ? 'urgent' : 'info', n.province);
      if (mine && n.priority === 'urgent' && n.province) this.lastAlertProvince = n.province;
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
            this.ui.dockOpen = true;
          }
        }
        if ((n.kind === 'proposal' || n.kind === 'callToArms') && n.priority !== 'low') {
          this.sound.play('alert');
          if (this.settings.autoPauseProposal) {
            this.setSpeed(0);
            this.ui.dockOpen = true;
          }
        }
        // research or a focus finished: the next must be chosen, or months are lost
        if ((n.kind === 'research' || n.kind === 'focus') && /Choose the next/.test(n.text) && this.settings.autoPauseChoice) this.setSpeed(0);
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
    if (this.selectedArmy && !st.armies[this.selectedArmy]) {
      this.selectedArmy = null;
      this.moveMode = false;
    }
    if (this.orderArmy && !st.armies[this.orderArmy]) this.orderArmy = null;
    if (this.selectedFleet && !st.fleets[this.selectedFleet]) this.selectedFleet = null;
    if (this.selectedWing && !st.wings[this.selectedWing]) this.selectedWing = null;
    if (this.targeting && ((this.targeting.kind === 'fleet' && !st.fleets[this.targeting.fleet]) || (this.targeting.kind === 'air' && !st.wings[this.targeting.wing]))) this.targeting = null;
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
    // a logged command, so a bug report from the continued campaign still replays
    applyCommand(this.sim, { type: 'continueCampaign', nation: this.player });
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
      this.afterCommandNotes();
    }
    this.refresh();
    this.tutorial?.update();
    return r;
  }

  private afterCommandNotes(): void {
    const st = this.sim!.state;
    for (const n of st.notifications) {
      if (n.id <= this.lastNote) continue;
      if (n.nation === this.player && n.priority === 'urgent') this.toast(n.text, 'urgent', n.province);
    }
    this.lastNote = st.notifications.at(-1)?.id ?? this.lastNote;
  }

  // ───────────────────────────── Selection ──────────────────────────────────

  selectProvince(pid: ProvinceId | null, center = false): void {
    // keep the player's army in mind so the province card can offer "March here"
    const a = this.selectedArmy ? this.sim?.state.armies[this.selectedArmy] : undefined;
    this.orderArmy = pid && a && a.nation === this.player ? a.id : pid ? this.orderArmy : null;
    this.selectedProvince = pid;
    this.selectedArmy = null;
    this.clearSea();
    this.moveMode = false;
    this.ui.inspectorPeek = false;
    if (pid && center) this.pendingCenter = { pid };
    this.refresh();
  }

  private clearSea(): void {
    this.selectedFleet = null;
    this.selectedZone = null;
    this.selectedWing = null;
    this.targeting = null;
    this.canvas?.classList.remove('move-mode');
  }

  selectFleet(id: string | null, center = false): void {
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.moveMode = false;
    this.selectedFleet = id;
    this.ui.inspectorPeek = false;
    const f = id ? this.sim?.state.fleets[id] : undefined;
    if (f && center && this.renderer) {
      const c = this.renderer.zoneCenter(f.zone);
      this.renderer.camera.centerOn(c.x, c.y, Math.max(this.renderer.camera.zoom, this.renderer.camera.zoomForProvincePx(60)));
      this.mapDirty = true;
    }
    this.refresh();
  }

  selectZone(id: string | null): void {
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.moveMode = false;
    this.selectedZone = id;
    this.ui.inspectorPeek = false;
    this.refresh();
  }

  selectWing(id: string | null): void {
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.moveMode = false;
    this.selectedWing = id;
    this.ui.inspectorPeek = false;
    this.refresh();
  }

  /** The next map click picks a destination zone for the selected fleet. */
  startFleetMove(fleet: string): void {
    this.targeting = { kind: 'fleet', fleet };
    this.canvas.classList.add('move-mode');
    this.toast('Click a sea zone (or a coast) for the fleet’s destination. Esc cancels.');
    this.refresh();
  }

  /** The next map click picks the beach for armies carried by sea. */
  startShipTarget(armies: string[]): void {
    const sim = this.sim;
    if (!sim || !armies.length) return;
    const a = sim.state.armies[armies[0]];
    const regs = armies.reduce((n, id) => n + (sim.state.armies[id]?.regiments.length ?? 0), 0);
    const f = a ? transportFor(sim, a.nation, a.location, regs) : null;
    if (!f) {
      this.toast(`No fleet of ours with room for ${regs} regiments lies off this coast. Bring transports (2 regiments each) to a sea zone on the coast of ${provName(sim, a.location)}.`, 'fail');
      return;
    }
    this.targeting = { kind: 'ship', armies, fleet: f.id };
    this.canvas.classList.add('move-mode');
    this.toast(`${f.name} will carry the troops. Click the coastal province to land on. Esc cancels.`);
    this.refresh();
  }

  /** The next map click picks an air wing's target province. */
  startAirTarget(wing: string, mission: AirMission): void {
    this.targeting = { kind: 'air', wing, mission };
    this.canvas.classList.add('move-mode');
    this.toast('Click the province to fly the mission over. Esc cancels.');
    this.refresh();
  }

  cancelTargeting(): void {
    this.targeting = null;
    this.canvas.classList.remove('move-mode');
    this.refresh();
  }

  selectArmy(id: string | null, center = false): void {
    if (id !== this.selectedArmy) this.ui.groupOrders = false;
    this.clearSea();
    this.selectedArmy = id;
    this.moveMode = false;
    this.ui.split = {};
    this.ui.inspectorPeek = false;
    if (id && this.sim?.state.armies[id]) {
      this.selectedProvince = null;
      if (this.sim.state.armies[id].nation === this.player) this.orderArmy = id;
      if (center) this.pendingCenter = { pid: this.sim.state.armies[id].location };
    }
    this.refresh();
  }

  clearSelection(): void {
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.orderArmy = null;
    this.moveMode = false;
    this.canvas?.classList.remove('move-mode');
    this.refresh();
  }

  selectedArmyForOrders(): Army | undefined {
    const id = this.orderArmy;
    const a = id ? this.sim?.state.armies[id] : undefined;
    return a && a.nation === this.player && !a.battle && !a.retreating ? a : undefined;
  }

  centerOn(pid: ProvinceId, zoomPx?: number): void {
    const r = this.renderer;
    if (!r) return;
    this.updateInsets();
    const c = r.provinceCenter(pid);
    const cam = r.camera;
    const target = zoomPx ? cam.zoomForProvincePx(zoomPx) : Math.max(cam.zoom, cam.zoomForProvincePx(70));
    if (cam.isVisible(c.x, c.y, 80) && Math.abs(target - cam.zoom) / cam.zoom < 0.05) return;
    cam.centerOn(c.x, c.y, target);
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

  orderMove(dest: ProvinceId, armyId?: string, append = false): void {
    const id = armyId ?? this.selectedArmy;
    if (!id) return;
    const a = this.sim?.state.armies[id];
    const group = a && this.ui.groupOrders && a.group ? this.groupArmies(a.group) : [];
    if (group.length > 1) {
      // every army of the group marches on its own best route
      let ok = 0;
      const why: string[] = [];
      for (const g of group) {
        const r = applyCommand(this.sim!, { type: 'move', nation: this.player!, army: g.id, dest, ...(append ? { append: true } : {}) });
        if (r.ok) ok++;
        else why.push(`${g.name}: ${r.reason}`);
      }
      this.toast(`Group ${a!.group}: ${ok} of ${group.length} armies marching to ${this.sim!.world.prov[dest].name}.${why.length ? ` ${why[0]}` : ''}`, why.length ? 'fail' : 'good');
      this.sound.play(ok ? 'click' : 'alert');
      this.cancelMoveMode();
      this.refresh();
      return;
    }
    this.do({ type: 'move', army: id, dest, ...(append ? { append: true } : {}) }, true);
    this.cancelMoveMode();
  }

  /** The player's armies in a group, in id order. */
  groupArmies(group: number): Army[] {
    const sim = this.sim;
    if (!sim || !this.player) return [];
    return Object.values(sim.state.armies)
      .filter((x) => x.nation === this.player && x.group === group)
      .sort((x, y) => (x.id < y.id ? -1 : 1));
  }

  /** Select the next army group (Shift+N) with group orders on. */
  cycleGroup(): void {
    const sim = this.sim;
    if (!sim || !this.player) return;
    const groups = [...new Set(Object.values(sim.state.armies).filter((x) => x.nation === this.player && x.group).map((x) => x.group!))].sort((a, b) => a - b);
    if (!groups.length) {
      this.toast('No army groups yet: give armies a group number in their panel.', 'info');
      return;
    }
    const cur = this.selectedArmy ? sim.state.armies[this.selectedArmy]?.group ?? 0 : 0;
    const next = groups.find((g) => g > cur) ?? groups[0];
    this.selectArmy(this.groupArmies(next)[0].id, true);
    this.ui.groupOrders = true;
    this.refresh();
  }

  setMode(m: MapMode): void {
    this.mode = m;
    if (m !== 'diplomacy') this.focusNation = null;
    this.settings.mapMode = m;
    saveSettings(this.settings);
    this.refresh();
    this.tutorial?.update();
  }

  highlightProvinces(list: ProvinceId[] | null): void {
    this.highlight = list?.length ? list : null;
    if (list?.length && this.renderer) {
      const pts = list.map((p) => this.renderer!.provinceCenter(p));
      const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      this.renderer.camera.centerOn(x, y);
    }
    this.refresh();
  }

  // ───────────────────────────── Navigation ─────────────────────────────────

  fitWorld(): void {
    this.updateInsets();
    this.renderer?.camera.fit();
    this.mapDirty = true;
  }

  goCapital(): void {
    const pid = this.player;
    const cap = pid ? this.sim?.state.nations[pid].capital : null;
    if (cap) this.centerOn(cap, 96);
  }

  centreSelection(): void {
    const a = this.selectedArmy ? this.sim?.state.armies[this.selectedArmy] : undefined;
    if (a) this.centerOn(a.location, 110);
    else if (this.selectedProvince) this.centerOn(this.selectedProvince, 110);
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

  nextBattle(): void {
    const sim = this.sim;
    if (!sim) return;
    const list = Object.values(sim.state.battles).filter((b) => !this.player || b.attackerNations.includes(this.player) || b.defenderNations.includes(this.player));
    if (!list.length) return;
    const curProv = this.selectedArmy ? sim.state.armies[this.selectedArmy]?.location : this.selectedProvince;
    const i = list.findIndex((b) => b.province === curProv);
    const b = list[(i + 1) % list.length];
    const ours = [...b.attackers, ...b.defenders].map((id) => sim.state.armies[id]).find((a) => a && a.nation === this.player);
    if (ours) this.selectArmy(ours.id, true);
    else this.selectProvince(b.province, true);
  }

  jumpToAlert(): void {
    if (this.lastAlertProvince) this.selectProvince(this.lastAlertProvince, true);
  }

  /** Select the most useful province to build in (idle-builder shortcut). */
  suggestBuild(): void {
    const sim = this.sim;
    const pid = this.player;
    if (!sim || !pid) return;
    let best: ProvinceId | null = null;
    let bestCost = Infinity;
    for (const p of ownedProvinces(sim, pid)) {
      if (buildProblem(sim, pid, p, 'dev')) continue;
      const c = projectCost(sim, pid, p, 'dev').crowns / Math.max(1, sim.state.provinces[p].integration);
      if (c < bestCost) {
        bestCost = c;
        best = p;
      }
    }
    if (best) this.selectProvince(best, true);
    else this.openLedger('realm');
  }

  openDiplomacy(nid: NationId): void {
    this.ui.diploTarget = nid;
    this.openLedger('diplomacy');
  }

  // ───────────────────────────── Drawer, dock, toasts ───────────────────────

  openLedger(tab: LedgerTab): void {
    this.hideHover();
    this.ui.ledgerTab = tab;
    this.drawerEl.classList.remove('closed');
    // switching from a ledger that chose the map mode to one that does not want it puts the
    // player's mode back, as closing it would
    const wanted: MapMode | null = tab === 'diplomacy' ? 'diplomacy' : tab === 'wars' ? 'military' : null;
    if (this.ledgerMode && this.ledgerMode.shown !== wanted) {
      if (this.mode === this.ledgerMode.shown) this.setMode(this.ledgerMode.before);
      this.ledgerMode = null;
    }
    // the diplomacy map shows our relations; the chosen realm is outlined
    const show: MapMode | null = tab === 'diplomacy' && this.mode !== 'diplomacy' ? 'diplomacy' : tab === 'wars' && this.mode === 'political' ? 'military' : null;
    if (show) {
      this.ledgerMode = { before: this.ledgerMode?.before ?? this.mode, shown: show };
      this.setMode(show);
    }
    renderLedger(this);
    this.updateInsets();
    this.refresh();
    this.tutorial?.update();
    (this.drawerEl.querySelector('#ledger-title') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  closeLedger(): void {
    this.ui.ledgerTab = null;
    this.drawerEl.classList.add('closed');
    setChildren(this.drawerEl);
    this.focusNation = null;
    const lm = this.ledgerMode;
    this.ledgerMode = null;
    if (lm && this.mode === lm.shown) this.setMode(lm.before);
    this.canvas.focus({ preventScroll: true });
    this.updateInsets();
    this.refresh();
  }

  /** Back-compat name used by older panels. */
  closeModal(): void {
    this.closeLedger();
  }

  openDecisions(id?: string): void {
    const list = pendingDecisions(this);
    if (!list.length) return;
    this.ui.dockOpen = true;
    this.ui.dockItem = id ?? list[0].id;
    this.setSpeed(0);
    this.refresh();
  }

  openMenu(): void {
    this.hideHover();
    openMenuDialog(this);
  }

  toggleAttention(anchor?: HTMLElement): void {
    this.ui.attentionOpen = !this.ui.attentionOpen;
    void anchor;
    this.renderAttention();
  }

  private renderAttention(): void {
    const el = this.attentionEl;
    if (!this.ui.attentionOpen) {
      el.classList.add('hidden');
      return;
    }
    const items = attention(this);
    el.classList.remove('hidden');
    const close = h('button', { class: 'btn quiet small icon', type: 'button', 'aria-label': 'Close' }, icon('close'));
    close.addEventListener('click', () => this.toggleAttention());
    setChildren(
      el,
      h('div', { class: 'lg-head' }, icon('bell'), h('b', null, 'Needs attention'), close),
      items.length
        ? h(
            'div',
            { class: 'stack', style: 'gap:6px;margin-top:6px' },
            items.map((it) => {
              const c = h('div', { class: `callout ${it.level === 'seal' ? 'bad' : it.level} ${it.act ? 'clickable' : ''}`, role: it.act ? 'button' : undefined, tabindex: it.act ? 0 : undefined }, icon(it.icon), h('span', null, it.text));
              if (it.act)
                c.addEventListener('click', () => {
                  this.ui.attentionOpen = false;
                  it.act!();
                  this.renderAttention();
                });
              return c;
            }),
          )
        : h('p', { class: 'muted' }, 'Nothing urgent. Grow the realm, or choose a rival.'),
    );
  }

  private renderRail(): void {
    const sim = this.sim;
    if (!sim) return;
    const pid = this.player;
    const n = pid ? sim.state.nations[pid] : null;
    const warCount = pid ? Object.values(sim.state.wars).filter((w) => w.attackers.includes(pid) || w.defenders.includes(pid)).length : 0;
    const badges: Partial<Record<LedgerTab, number>> = {
      research: n && !n.research.current && n.alive ? 1 : 0,
      focus: n && !n.focus.current && n.alive ? 1 : 0,
      wars: warCount,
      diplomacy: pid ? sim.state.proposals.filter((p) => p.to === pid && p.kind !== 'peace').length : 0,
    };
    setChildren(
      this.railEl,
      RAIL.map((r, i) => {
        const b = h('button', { class: `${this.ui.ledgerTab === r.tab ? 'active' : ''} ${r.desk ? 'desk' : ''}`, type: 'button', 'aria-keyshortcuts': r.key, 'aria-pressed': this.ui.ledgerTab === r.tab ? 'true' : 'false', 'data-fk': `rail-${r.tab}` }, icon(r.icon), h('span', null, r.label), badges[r.tab] ? h('span', { class: 'badge' }, String(badges[r.tab])) : null);
        b.addEventListener('click', () => (this.ui.ledgerTab === r.tab ? this.closeLedger() : this.openLedger(r.tab)));
        tip(b, `${r.label} (${r.key})`);
        return i === 6 ? [h('div', { class: 'rail-sep' }), b] : b;
      }),
    );
    // phone: a "more" entry opens the remaining ledgers
    if (window.innerWidth <= 760) {
      const more = h('button', { type: 'button', class: RAIL.some((r) => r.desk && r.tab === this.ui.ledgerTab) ? 'active' : '' }, icon('menu'), h('span', null, 'More'));
      more.addEventListener('click', () => this.openLedger(RAIL.some((r) => r.desk && r.tab === this.ui.ledgerTab) ? 'help' : 'victory'));
      this.railEl.appendChild(more);
    }
  }

  toast(text: string, kind: 'info' | 'urgent' | 'good' | 'fail' = 'info', province?: string): void {
    if (!this.toastsEl) return;
    // group repeats instead of stacking them
    for (const el of [...this.toastsEl.children] as HTMLElement[]) {
      if (el.dataset.text === text) {
        const n = Number(el.dataset.count ?? '1') + 1;
        el.dataset.count = String(n);
        const c = el.querySelector('.count');
        if (c) c.textContent = `×${n}`;
        clearTimeout(Number(el.dataset.timer));
        el.dataset.timer = String(window.setTimeout(() => this.dropToast(el), kind === 'urgent' ? 9000 : 5000));
        return;
      }
    }
    const ic = kind === 'urgent' ? 'alert' : kind === 'good' ? 'check' : kind === 'fail' ? 'info' : 'bell';
    const el = h('div', { class: `toast ${kind}`, role: kind === 'urgent' ? 'alert' : 'status', 'data-text': text }, icon(ic), h('span', null, text), h('span', { class: 'count' }));
    el.addEventListener('click', () => {
      if (province) this.selectProvince(province, true);
      this.dropToast(el);
    });
    this.toastsEl.appendChild(el);
    while (this.toastsEl.children.length > 4) this.toastsEl.firstChild?.remove();
    el.dataset.timer = String(window.setTimeout(() => this.dropToast(el), kind === 'urgent' ? 9000 : 5000));
  }

  private dropToast(el: HTMLElement): void {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 220);
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
      const { sim, notices, mapPackage } = readSave(text);
      if (mapPackage) registerPackageGeometry(mapPackage);
      void this.startGame(sim, false).then(() => {
        this.toast(`Loaded ${dateOf(sim).label}.`, 'good');
        // converted from an older format, or a map that changed since: say so plainly
        if (notices.length) dialog(this, 'This save was converted', notices.map((n) => h('p', null, n)));
      });
      return true;
    } catch (e) {
      const msg = e instanceof SaveError ? e.message : `Could not load: ${(e as Error).message}`;
      const host = this.sim ? this : null;
      if (host) dialog(this, 'Cannot load this save', [h('p', null, msg), h('p', { class: 'muted' }, 'Your current campaign has not been changed.')]);
      else this.showLoadError(msg);
      return false;
    }
  }

  private showLoadError(msg: string): void {
    // no game DOM yet: a minimal layer over the current screen
    const layer = h('div', { class: 'modal-layer app-layer' });
    const ok = h('button', { class: 'btn primary', type: 'button' }, 'Close');
    ok.addEventListener('click', () => layer.remove());
    layer.appendChild(h('div', { class: 'modal narrow', role: 'dialog', 'aria-modal': 'true' }, h('header', null, h('h2', null, 'Cannot load this save')), h('div', { class: 'body' }, h('p', null, msg)), h('footer', null, ok)));
    this.root.appendChild(layer);
    ok.focus();
  }

  exportSave(): void {
    if (!this.sim) return;
    const d = dateOf(this.sim);
    const nation = this.player ?? 'observer';
    downloadText(`crown-and-frontier-${this.sim.state.scenarioId}-${nation}-${d.year}-${d.month + 1}.json`, serialize(this.sim));
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
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
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
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), button: e.button, shift: e.shiftKey, moved: false });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      if (e.pointerType === 'touch' && this.pointers.size === 1) {
        this.longPress = window.setTimeout(() => {
          const p = this.pointers.get(e.pointerId);
          if (p && !p.moved) {
            p.moved = true;
            this.secondaryAt(p.x, p.y, false);
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
      if (!p.moved && Math.hypot(x - p.sx, y - p.sy) > 6) {
        p.moved = true;
        c.classList.add('dragging');
      }
      if (p.moved && this.renderer) {
        this.renderer.camera.pan(x - p.x, y - p.y);
        this.mapDirty = true;
        this.tipEl.classList.add('hidden');
      }
      p.x = x;
      p.y = y;
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      c.classList.remove('dragging');
      if (this.longPress) {
        clearTimeout(this.longPress);
        this.longPress = null;
      }
      if (!p || p.moved || this.pointers.size > 0 || e.type === 'pointercancel') return;
      if (p.button === 2) this.secondaryAt(p.x, p.y, p.shift || e.shiftKey);
      else if (p.button === 0) this.primaryAt(p.x, p.y, e.shiftKey);
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

  /** Hide the map's hover card and highlight (a panel now covers the pointer, or the map lost it). */
  hideHover(): void {
    if (!this.tipEl) return;
    this.hoverPos = null;
    if (this.hoverProvince) this.mapDirty = true;
    this.hoverProvince = null;
    this.tipEl.classList.add('hidden');
  }

  /** Whether a screen point (stage coordinates) lies under an open panel, where the map takes no input. */
  private underPanel(x: number, y: number): boolean {
    const s = this.stageEl.getBoundingClientRect();
    for (const el of [this.drawerEl, this.inspectorEl, this.railEl, this.dockEl, this.tutorialEl]) {
      if (!el || el.classList.contains('closed') || el.classList.contains('hidden')) continue;
      for (const r of el === this.dockEl ? [...el.children].map((c) => c.getBoundingClientRect()) : [el.getBoundingClientRect()]) {
        if (r.width && x + s.left >= r.left && x + s.left <= r.right && y + s.top >= r.top && y + s.top <= r.bottom) return true;
      }
    }
    return false;
  }

  private hover(x: number, y: number): void {
    if (!this.renderer || !this.sim) return;
    if (this.underPanel(x, y)) return this.hideHover();
    this.hoverPos = { x, y };
    const armyId = this.renderer.armyAt(x, y);
    const pid = this.renderer.provinceAt(x, y);
    if (pid !== this.hoverProvince) {
      this.hoverProvince = pid;
      this.mapDirty = true;
    }
    const zone = pid ? null : this.renderer.zoneAt(x, y);
    if (zone !== this.hoverZone) {
      this.hoverZone = zone;
      if (this.selectedFleet) this.mapDirty = true;
    }
    const sim = this.sim;
    const tipEl = this.tipEl;
    const fleetId = this.renderer.fleetAt(x, y);
    if (fleetId && sim.state.fleets[fleetId]) {
      const f = sim.state.fleets[fleetId];
      const def = sim.world.nationDefs[f.nation];
      const hostile = this.player ? atWar(sim, this.player, f.nation) : false;
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, shield(this, f.nation), f.name),
        h('div', { class: 'tt-row' }, `${def.short}${hostile ? ' · enemy' : ''} · ${fleetSummary(f)}${f.cargo.length ? ` · carrying ${f.cargo.length} ${f.cargo.length === 1 ? 'army' : 'armies'}` : ''}`),
        h('div', { class: 'tt-hint' }, f.nation === this.player ? 'Click to select, then right-click a sea zone to sail.' : 'Click for details.'),
      );
    } else if (!armyId && !pid && this.hoverZone) {
      const z = sim.world.zones[this.hoverZone];
      const here = fleetsIn(sim, z.id);
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, icon('anchor'), z.name),
        h('div', { class: 'tt-row' }, `${z.coasts.length} coastal provinces${z.straits?.length ? ` · commands ${z.straits.length} strait${z.straits.length === 1 ? '' : 's'}` : ''}${here.length ? ` · ${here.length} fleet${here.length === 1 ? '' : 's'}` : ''}`),
        this.selectedFleet && sim.state.fleets[this.selectedFleet]?.nation === this.player ? h('div', { class: 'tt-hint' }, 'Right-click to sail here.') : null,
      );
    } else if (armyId && sim.state.armies[armyId]) {
      const a = sim.state.armies[armyId];
      const def = sim.world.nationDefs[a.nation];
      const hostile = this.player ? atWar(sim, this.player, a.nation) : false;
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, shield(this, a.nation), a.name),
        h('div', { class: 'tt-row' }, `${def.short}${hostile ? ' · enemy' : ''} · ${a.regiments.length} regiments · morale ${a.morale.toFixed(1)}`),
        h('div', { class: 'tt-hint' }, a.nation === this.player ? 'Click to select, then right-click a province to march.' : 'Click for details and battle forecasts.'),
      );
    } else if (pid) {
      const p = sim.state.provinces[pid];
      const def = sim.world.prov[pid];
      const owner = p.owner ? sim.world.nationDefs[p.owner].short : 'Unclaimed frontier';
      const occ = p.controller && p.controller !== p.owner ? ` · occupied by ${sim.world.nationDefs[p.controller].short}` : '';
      const rows: HTMLElement[] = [h('div', { class: 'tt-row' }, `${owner}${occ}`), h('div', { class: 'tt-row' }, `${def.terrain} · dev ${p.dev}${p.owner ? ` · integration ${Math.floor(p.integration)}` : ''}${p.fort ? ` · fort ${p.fort}` : ''}`)];
      const a = this.selectedArmy ? sim.state.armies[this.selectedArmy] : undefined;
      if (a && a.nation === this.player && pid !== a.location) {
        const r = findPath(sim, a.nation, a.location, pid);
        rows.push(h('div', { class: 'tt-hint' }, r ? `Right-click${this.moveMode ? ' or click' : ''} to march: ${weeks(etaWeeks(sim, a, r.path))}. Shift adds a waypoint.` : h('span', { class: 'bad' }, 'No legal route: no military access through the realms in between.')));
      }
      setChildren(tipEl, h('div', { class: 'tt-title' }, p.owner ? shield(this, p.owner) : null, def.name), ...rows);
    } else {
      tipEl.classList.add('hidden');
      return;
    }
    tipEl.classList.remove('hidden');
    const W = this.stageEl.clientWidth;
    const H = this.stageEl.clientHeight;
    const tw = tipEl.offsetWidth || 260;
    const th = tipEl.offsetHeight || 70;
    tipEl.style.left = `${Math.min(x + 16, W - tw - 8)}px`;
    tipEl.style.top = `${Math.min(y + 18, H - th - 8)}px`;
  }

  private primaryAt(x: number, y: number, shift: boolean): void {
    if (!this.renderer || !this.sim) return;
    this.canvas.focus({ preventScroll: true });
    this.ui.attentionOpen = false;
    const pid = this.renderer.provinceAt(x, y);
    if (this.moveMode && this.selectedArmy) {
      if (pid) this.orderMove(pid, undefined, shift);
      else this.cancelMoveMode();
      return;
    }
    const tg = this.targeting;
    if (tg) {
      this.targeting = null;
      this.canvas.classList.remove('move-mode');
      if (tg.kind === 'fleet') this.orderFleet(tg.fleet, x, y);
      else if (tg.kind === 'ship' && pid) this.do({ type: 'shipArmies', armies: tg.armies, fleet: tg.fleet, dest: pid });
      else if (tg.kind === 'air' && pid) this.do({ type: 'airMission', wing: tg.wing, mission: tg.mission, target: pid });
      else this.refresh();
      return;
    }
    const fleet = this.renderer.fleetAt(x, y);
    if (fleet) {
      this.selectFleet(fleet);
      return;
    }
    const army = this.renderer.armyAt(x, y);
    if (army) {
      this.selectArmy(army);
      return;
    }
    const battle = this.renderer.battleAt(x, y);
    if (battle) {
      const b = this.sim.state.battles[battle.battle];
      const ours = b ? [...b.attackers, ...b.defenders].map((id) => this.sim!.state.armies[id]).find((a) => a && a.nation === this.player) : undefined;
      if (ours) this.selectArmy(ours.id);
      else this.selectProvince(battle.province);
      return;
    }
    if (!pid) {
      const zone = this.renderer.zoneAt(x, y);
      if (zone) this.selectZone(zone);
      else this.clearSelection();
      return;
    }
    this.selectProvince(pid);
  }

  /** Sends a fleet to the sea zone at a screen point, or to the nearest zone on a coast there. */
  orderFleet(fleetId: string, x: number, y: number): void {
    const sim = this.sim;
    const f = sim?.state.fleets[fleetId];
    if (!sim || !f || !this.renderer) return;
    const pid = this.renderer.provinceAt(x, y);
    const zone = this.renderer.zoneAt(x, y) ?? (pid ? pathToCoast(sim, f.zone, pid)?.at(-1) ?? (sim.world.provZones[pid]?.includes(f.zone) ? f.zone : null) : null);
    if (!zone) {
      this.toast(pid ? `${provName(sim, pid)} is not on the coast.` : 'Choose a sea zone.', 'fail');
      return;
    }
    this.do({ type: 'moveFleet', fleet: fleetId, zone });
  }

  private secondaryAt(x: number, y: number, shift: boolean): void {
    if (!this.renderer || !this.sim) return;
    const pid = this.renderer.provinceAt(x, y);
    const f = this.selectedFleet ? this.sim.state.fleets[this.selectedFleet] : undefined;
    if (f && f.nation === this.player) {
      this.orderFleet(f.id, x, y);
      return;
    }
    const a = this.selectedArmy ? this.sim.state.armies[this.selectedArmy] : undefined;
    if (a && a.nation === this.player && pid) this.orderMove(pid, undefined, shift);
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
      if (this.targeting) this.cancelTargeting();
      else if (this.moveMode) this.cancelMoveMode();
      else if (this.ui.attentionOpen) this.toggleAttention();
      else if (this.ui.presentationOpen) {
        this.ui.presentationOpen = false;
        this.refresh();
      }
      // an open ledger sits above the map: it closes before the map selection is cleared
      else if (this.ui.ledgerTab) this.closeLedger();
      else if (this.selectedArmy || this.selectedProvince || this.selectedFleet || this.selectedZone || this.selectedWing) this.clearSelection();
      else this.openMenu();
      e.preventDefault();
      return;
    }
    if (dialogOpen) return;
    // map modes: Shift+1…9
    if (e.shiftKey && /^Digit[1-9]$/.test(e.code) && MODES[Number(e.code.slice(5)) - 1]) {
      this.setMode(MODES[Number(e.code.slice(5)) - 1].id);
      e.preventDefault();
      return;
    }
    const ledgers: Record<string, LedgerTab> = { b: 'realm', i: 'industry', m: 'military', t: 'research', p: 'focus', d: 'diplomacy', w: 'wars', v: 'victory', l: 'log', h: 'help' };
    const lk = k.toLowerCase();
    if (k === ' ') {
      this.togglePause();
      e.preventDefault();
    } else if (['1', '2', '3', '4'].includes(k)) this.setSpeed(Number(k));
    else if (ledgers[lk] && !e.shiftKey) {
      if (this.ui.ledgerTab === ledgers[lk]) this.closeLedger();
      else this.openLedger(ledgers[lk]);
    } else if (lk === 'o') {
      const i = MODES.findIndex((o) => o.id === this.mode);
      this.setMode(MODES[(i + (e.shiftKey ? MODES.length - 1 : 1)) % MODES.length].id);
    } else if (lk === 'g' && this.selectedArmy) this.startMoveMode();
    else if (lk === 'g' && this.selectedFleet && this.sim.state.fleets[this.selectedFleet]?.nation === this.player) this.startFleetMove(this.selectedFleet);
    else if (lk === 'f') this.fitWorld();
    else if (lk === 'c') this.centreSelection();
    else if (lk === 'k') this.nextBattle();
    else if (lk === 'j') this.jumpToAlert();
    else if (lk === 'n' && e.shiftKey) this.cycleGroup();
    else if (lk === 'n') this.cycleArmy();
    else if (k === 'Home') this.goCapital();
    else if (cam && (k === '+' || k === '=')) cam.zoomAt(cam.vw / 2, cam.vh / 2, 1.25);
    else if (cam && (k === '-' || k === '_')) cam.zoomAt(cam.vw / 2, cam.vh / 2, 1 / 1.25);
    else if (cam && k === 'ArrowLeft') cam.pan(90, 0);
    else if (cam && k === 'ArrowRight') cam.pan(-90, 0);
    else if (cam && k === 'ArrowUp') cam.pan(0, 90);
    else if (cam && k === 'ArrowDown') cam.pan(0, -90);
    else return;
    e.preventDefault();
    this.mapDirty = true;
    this.uiDirty = true;
  }

  private renderBanner(): void {
    const a = this.selectedArmy && this.sim ? this.sim.state.armies[this.selectedArmy] : undefined;
    if (this.moveMode && a) {
      this.bannerEl.classList.remove('hidden');
      const cancel = h('button', { class: 'btn small quiet', type: 'button' }, 'Cancel (Esc)');
      cancel.addEventListener('click', () => this.cancelMoveMode());
      setChildren(this.bannerEl, icon('move'), h('span', null, `Choose where ${a.name} marches. Shift adds a waypoint.`), cancel);
    } else {
      this.bannerEl.classList.add('hidden');
      this.canvas?.classList.remove('move-mode');
    }
    void provName;
  }
}
