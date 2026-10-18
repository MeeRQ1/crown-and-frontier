// Browser application shell: screens, game loop, input, selection and the
// bridge between interface actions and simulation commands. All game actions
// go through applyCommand() — the same validation the AI uses.

import { MISSION_LABELS, missionProblem, SEA_MISSIONS, stepsTo, wingCoverage, wingHome, wingRange } from '../sim/air';
import { applyCommand } from '../sim/commands';
import { buildProblem, projectCost } from '../sim/construction';
import { createGame, type NewGameOptions } from '../sim/game';
import { canEnter, etaWeeks, findPath } from '../sim/movement';
import { readSave, SaveError, serialize } from '../sim/save';
import { atWar, dateOf, months, ownedProvinces, provName, type Sim } from '../sim/state';
import { isOver, step, weekSlices } from '../sim/tick';
import { DUTY_HELP, DUTY_LABELS, dutyDestination, fleetDutyProblem, fleetEta, fleetsIn, fleetSummary, pathToCoast, transportFor, zoneName, zonePath } from '../sim/naval';
import { closeOrderMenu, openOrderMenu, orderMenuOpen, rebaseTargets } from './orders';
import { airDropProblem, airDropRisk } from '../sim/airborne';
import { confirmDialog } from './panels/dialogs';
import type { AirMission, Army, Command, CommandResult, ContractTerms, Demand, DemandKind, FleetDuty, FleetDutyKind, NationId, ProvinceId, Tradeable } from '../sim/types';
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
import { provincesNear, unitFilter, zonesNear, type Focus, type UnitFilter } from './map/visibility';
import { draftFromOp, newDraft, opPreview, type OpDraft } from './panels/operations';
import { freshBatchUI, type BatchUI } from './panels/batch';
import { opForces, unitRef } from '../sim/ops/operations';
import type { OperationKind } from '../sim/types';
import { hideTip, installTips, shield, tip } from './panels/common';
import { dialog, pendingDecisions, renderDock } from './panels/dialogs';
import { attention, renderHud } from './panels/hud';
import { renderInspector } from './panels/inspector';
import { renderLedger, type LedgerTab } from './panels/ledgers';
import type { LogFilter } from './ledgers/chronicle';
import { Minimap, renderModes, renderNavCluster } from './panels/mapui';
import { openMenuDialog, renderEndScreen, renderMenu, screenCleanup } from './screens';
import { loadSettings, saveSettings, type UISettings } from './settings';
import { MapLibrary } from './maplib';
import { downloadText, SaveStore, slotLabel } from './storage';
import { Tutorial } from './tutorial';

type DistOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
export type PlayerCommand = DistOmit<Command, 'nation'>;

export const SPEEDS = [0, 0.5, 1, 2.5, 6]; // ticks (weeks) per second; index 2 is "normal"
/**
 * Work a frame may do (interface, map and simulation) and still be shown at 60 Hz:
 * the simulation gets what the interface and the map leave of it. Less while the
 * player is moving the map or clicking, more when nobody is touching anything.
 */
const FRAME_BUDGET_MS = { input: 10, idle: 14 };
/** while the clock runs, the simulation always gets at least this much a frame (one slice may run over) */
const SIM_MIN_MS = 3;
/** how long after the last input the map counts as being handled */
const INPUT_HOLD_MS = 600;
/** the simulation's time a frame while an order waits for the week in progress to end */
const ORDER_BUDGET_MS = 30;

export interface UIState {
  peace: { war: string; with: string; mode: 'demand' | 'concede' | 'white'; provinces: string[]; gold: number } | null;
  /** peace conferences being drafted (a settlement for every party), by war */
  settle: Record<string, { demands: Demand[]; offer: boolean; kind: DemandKind; from: string; to: string; province: string; amount: number }>;
  /** demands struck out of a settlement we were offered (a counter-offer) */
  counter: { proposal: string; drop: number[] } | null;
  split: Record<string, number>;
  ledgerTab: LedgerTab | null;
  diploTarget: NationId | null;
  logFilter: LogFilter;
  inspectorPeek: boolean;
  presentationOpen: boolean;
  dockOpen: boolean;
  dockItem: string | null;
  attentionOpen: boolean;
  /** move orders apply to every army in the selected army's group */
  groupOrders: boolean;
  /** legend panel open (starts closed on phones, where it would cover the map) */
  legendOpen: boolean;
  /** Industry & Trade: the good in the workspace, and a contract being drafted */
  tradeGood: Tradeable | null;
  tradeDraft: ContractTerms | null;
  /** the technology and the focus shown in the Research and National Focus inspectors */
  techSel: string | null;
  focusSel: string | null;
  /** the How to Play article open */
  helpTopic: string | null;
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
  /** what to click for the fleet order being placed (the banner says it) */
  private dutyHint = '';
  targeting:
    | { kind: 'fleet'; fleet: string }
    | { kind: 'ship'; armies: string[]; fleet: string }
    | { kind: 'air'; wing: string; mission: AirMission; group?: string[] }
    | { kind: 'duty'; fleet: string; duty: FleetDutyKind }
    | { kind: 'drop'; army: string }
    /** the area of the operation being prepared: clicks add or remove provinces (or sea zones) */
    | { kind: 'opArea' }
    /** several fleets or wings at once: where they sail, the place of their standing order, or the airfield they move to */
    | { kind: 'group'; order: 'sail' | 'rebase' | FleetDutyKind; ids: string[] }
    | null = null;
  /** the last order given to several forces at once: what each did, or why not (the selection card lists them all) */
  groupResult: { title: string; rows: Array<{ id: string; name: string; ok: boolean; text: string }> } | null = null;
  /** forces selected together (armies, fleets, wings of ours), for operations and group orders */
  forceSel: string[] = [];
  /** provinces selected together, for batch construction and recruitment */
  provSel: ProvinceId[] = [];
  /** the Select tool (touch-friendly): taps add or remove, a drag draws a box, instead of panning */
  selectMode: 'off' | 'forces' | 'provinces' = 'off';
  /** the operation being prepared or changed */
  opDraft: OpDraft | null = null;
  /** the operation whose card is open */
  selectedOp: string | null = null;
  /** armies marching together to the next province clicked (March all to…) */
  groupMoveIds: string[] | null = null;
  /** a selection box being drawn (screen coordinates) */
  box: { x0: number; y0: number; x1: number; y1: number; kind: 'forces' | 'provinces' } | null = null;
  /** the province batch card's choices and its last result */
  batch: BatchUI = freshBatchUI();
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
  /** the week being simulated while it spans frames (see weekSlices) */
  private week: Generator<void, void, void> | null = null;
  private lastFrame = 0;
  private lastUI = 0;
  private uiDirty = true;
  private mapDirty = true;
  private lastNote = 0;
  private lastAutosave = 0;
  private lastMinimap = 0;
  /** the last pointer, wheel or key input (see FRAME_BUDGET_MS) */
  private lastInput = -Infinity;
  /** an open ledger is rebuilt while the clock runs at most this often: ten times what its last rebuild cost */
  private ledgerDue = 0;
  /** openLedger has just built the ledger: the next interface pass need not build it again */
  private ledgerFresh = false;
  /** orders given while a week was half done, applied when it ends (see orderMove) */
  private atWeekEnd: Array<() => void> = [];
  private endShown = false;
  private raf = 0;
  private starting = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; button: number; shift: boolean; ctrl: boolean; moved: boolean }>();
  private pinchDist = 0;
  private longPress: number | null = null;
  private hoverPos: { x: number; y: number } | null = null;
  private pointerDown = false;
  private resizeObs: ResizeObserver | null = null;
  /** measures the legend and mode bar so the decision dock can stack above them */
  private modesObs: ResizeObserver | null = null;
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
    return { peace: null, settle: {}, counter: null, split: {}, ledgerTab: null, diploTarget: null, logFilter: 'all', inspectorPeek: false, presentationOpen: false, dockOpen: false, dockItem: null, attentionOpen: false, groupOrders: false, legendOpen: this.settings?.showLegend ?? true, tradeGood: null, tradeDraft: null, techSel: null, focusSel: null, helpTopic: null };
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
    // nothing carries over from another campaign: selections, an operation being prepared, the batch card
    this.forceSel = [];
    this.provSel = [];
    this.selectMode = 'off';
    this.opDraft = null;
    this.selectedOp = null;
    this.groupMoveIds = null;
    this.box = null;
    this.batch = freshBatchUI();
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
    this.week = null;
    this.atWeekEnd = [];
    this.resizeObs?.disconnect();
    this.resizeObs = null;
    this.modesObs?.disconnect();
    this.modesObs = null;
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
    this.modesObs = new ResizeObserver(() => this.stageEl.style.setProperty('--modes-h', `${Math.ceil(this.modesEl.getBoundingClientRect().height)}px`));
    this.modesObs.observe(this.modesEl);
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
    const start = performance.now();
    if (this.speed > 0 && !isOver(sim)) this.acc += (dt / 1000) * SPEEDS[this.speed];
    // the map moved under a still pointer (centring on a selection, a wheel step, the
    // keyboard): the hover card describes what is under the pointer now
    if (this.hoverPos && !this.pointers.size && this.viewKey() !== this.hoverView) this.hover(this.hoverPos.x, this.hoverPos.y);
    const busy = this.pointers.size > 0 || this.renderer.camera.animating || start - this.lastInput < INPUT_HOLD_MS;
    this.renderer.interacting = busy;
    this.renderer.running = this.speed > 0 || !!this.week;
    // the player has stopped handling the map: the cache's margin can be painted now
    if (!busy && this.renderer.idleWork) this.mapDirty = true;
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
    // Simulate a slice at a time with what is left of the frame's budget, so a long
    // week (a world war on the largest maps) spreads over frames instead of freezing
    // the map and the controls; what the slices change is drawn next frame. A week
    // once begun is finished even if the game is paused.
    let budget = Math.max(SIM_MIN_MS, (busy ? FRAME_BUDGET_MS.input : FRAME_BUDGET_MS.idle) - (performance.now() - start));
    // an order waits for the week in progress: finish it in a few frames
    if (this.atWeekEnd.length) budget = Math.max(budget, ORDER_BUDGET_MS);
    const until = performance.now() + budget;
    let weeks = 0;
    while (performance.now() < until) {
      if (!this.week) {
        if (!(this.speed > 0 && this.acc >= 1 && weeks < 6 && !isOver(sim))) break;
        this.acc -= 1;
        this.week = weekSlices(sim);
      }
      if (this.week.next().done) {
        this.week = null;
        weeks++;
        this.afterTick();
        this.applyWeekEndOrders();
      }
    }
    // a clock that cannot keep up runs slower instead of piling up weeks to catch up
    if (this.acc > 3) this.acc = 0;
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
        selectedWing: this.targeting?.kind === 'air' ? this.targeting.wing : this.selectedWing,
        airTargeting: this.targeting?.kind === 'air',
        rebaseTargets: this.wingRebaseTargets(sim),
        fleetPreview,
        fleetPreviewLabel,
        tradeRoutes: this.ui.ledgerTab === 'industry' && this.player ? this.tradeRoutes(sim, this.player) : null,
        units: this.unitFilter(),
        selectedSet: this.forceSel.length ? new Set(this.forceSel) : null,
        provSel: this.provSel.length ? this.provSel : null,
        opArea: this.opAreaShown(),
        opRoutes: this.opDraft ? opPreview(this, this.opDraft).routes : null,
        box: this.box,
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
  private focusMemo: { key: string; value: Focus | null } | null = null;
  private filterMemo: { key: string; value: UnitFilter } | null = null;

  /** What the selection is about, for the "Relevant" unit view (worked out when the selection or the week changes). */
  viewFocus(): Focus | null {
    const sim = this.sim;
    if (!sim) return null;
    const st = sim.state;
    const a = this.selectedArmy ? st.armies[this.selectedArmy] : undefined;
    const f = this.selectedFleet ? st.fleets[this.selectedFleet] : undefined;
    const w = this.selectedWing ? st.wings[this.selectedWing] : undefined;
    const op = this.selectedOp ? st.operations?.[this.selectedOp] : this.opDraft ? { name: 'the operation being prepared', area: this.opDraft.area, zones: this.opDraft.zones, id: this.opDraft.editing ?? '' } : undefined;
    const key = `${a?.id}|${a?.location}|${a?.path.join(',')}|${f?.id}|${f?.zone}|${w?.id}|${w?.base}|${w?.carrier}|${op?.id}|${op?.area.length}|${op?.zones.length}|${st.tick}|${st.rev}`;
    if (this.focusMemo?.key === key) return this.focusMemo.value;
    let value: Focus | null = null;
    if (op) {
      // an operation: its area and its forces, and two marches around them
      const members = op.id ? opForces(sim, op.id) : { armies: [], fleets: [], wings: [] };
      const provinces = provincesNear(sim, [...op.area, ...members.armies.map((x) => x.location)], 2);
      value = { label: op.name, provinces, zones: zonesNear(sim, [...op.zones, ...members.fleets.map((x) => x.zone)], 1, provinces) };
    } else if (a) {
      const provinces = provincesNear(sim, [a.location, ...a.path], 3);
      value = { label: a.name, provinces, zones: zonesNear(sim, [], 0, provinces) };
    } else if (f) {
      const zones = zonesNear(sim, [f.zone, ...f.path], 2);
      value = { label: f.name, provinces: new Set([...zones].flatMap((z) => sim.world.zones[z].coasts)), zones };
    } else if (w) {
      const c = wingCoverage(sim, w);
      value = { label: w.name, provinces: new Set(c.provs), zones: new Set(c.zones) };
    }
    this.focusMemo = { key, value };
    return value;
  }

  /** Which forces the map and the panels show (ui/map/visibility.ts). */
  unitFilter(): UnitFilter {
    const sim = this.sim!;
    const focus = this.viewFocus();
    const s = this.settings;
    const key = `${this.player}|${s.armyMarkers}|${s.relevantAllies}|${sim.state.rev}|${sim.state.tick}|${focus ? this.focusMemo?.key : ''}`;
    if (this.filterMemo?.key !== key) this.filterMemo = { key, value: unitFilter(sim, this.player, s.armyMarkers, { allies: s.relevantAllies, focus }) };
    return this.filterMemo.value;
  }

  private rebaseMemo: { key: string; value: { provinces: ProvinceId[]; fleets: string[] } } | null = null;

  /** The airfields and carriers the selected wing of ours could move to (worked out once a week). */
  private wingRebaseTargets(sim: Sim): { provinces: ProvinceId[]; fleets: string[] } | null {
    const w = this.selectedWing ? sim.state.wings[this.selectedWing] : undefined;
    if (!w || w.nation !== this.player || this.targeting) return null;
    const key = `${w.id}|${w.base}|${w.carrier}|${sim.state.tick}|${sim.state.rev}`;
    if (this.rebaseMemo?.key !== key) this.rebaseMemo = { key, value: rebaseTargets(sim, w) };
    return this.rebaseMemo.value;
  }

  /** Our contracts as routes between the two capitals (the chosen good only, when one is chosen). */
  private tradeRoutes(sim: Sim, pid: NationId): Array<{ from: ProvinceId; to: ProvinceId; sea: boolean }> {
    const out: Array<{ from: ProvinceId; to: ProvinceId; sea: boolean }> = [];
    for (const c of sim.state.contracts) {
      if (c.seller !== pid && c.buyer !== pid) continue;
      if (this.ui.tradeGood && c.res !== this.ui.tradeGood) continue;
      const a = sim.state.nations[c.seller].capital;
      const b = sim.state.nations[c.buyer].capital;
      if (a && b) out.push({ from: a, to: b, sea: c.lag > 0 });
    }
    return out;
  }

  /** A select/input inside a panel has focus: rebuilding would close or reset it. */
  private editingForm(): boolean {
    const a = document.activeElement as HTMLElement | null;
    if (!a || !(a.tagName === 'SELECT' || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return false;
    return !!a.closest('.drawer, .inspector, .modal-layer, .dock');
  }

  /** counts refresh(): something the player did or chose (cached interface figures are worked out again) */
  actions = 0;

  refresh(): void {
    this.actions++;
    this.uiDirty = true;
    this.mapDirty = true;
    this.lastUI = 0;
    // something the player did: the open ledger shows it at once
    this.ledgerDue = 0;
    this.ledgerFresh = false;
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
    if (this.ui.ledgerTab) {
      // while the clock runs, a costly ledger (diplomacy or wars on the largest maps)
      // refreshes less often than the rest of the interface; paused, it always does
      const now = performance.now();
      if (this.ledgerFresh) this.ledgerFresh = false;
      else if (this.speed === 0 || now >= this.ledgerDue) {
        renderLedger(this);
        this.ledgerDue = now + 10 * (performance.now() - now);
      } else this.uiDirty = true;
    }
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
        if (n.kind === 'battle' && this.settings.autoPauseDefeat && /^Defeat at/.test(n.text)) this.setSpeed(0);
        if (n.kind === 'operation' && n.priority === 'urgent' && this.settings.autoPauseOperation) this.setSpeed(0);
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
    // forces merged, destroyed or disbanded leave the selection; a cancelled operation's card closes
    const exists = (id: string) => !!(st.armies[id] || st.fleets[id] || st.wings[id]);
    if (this.forceSel.some((id) => !exists(id))) this.forceSel = this.forceSel.filter(exists);
    if (this.opDraft?.units.some((id) => !exists(id))) this.opDraft.units = this.opDraft.units.filter(exists);
    if (this.groupMoveIds?.some((id) => !st.armies[id])) this.groupMoveIds = this.groupMoveIds.filter((id) => st.armies[id]);
    if (this.selectedOp && !st.operations?.[this.selectedOp]) this.selectedOp = null;
    if (this.opDraft?.editing && !st.operations?.[this.opDraft.editing]) this.opDraft = null;
    if (this.targeting && (((this.targeting.kind === 'fleet' || this.targeting.kind === 'duty') && !st.fleets[this.targeting.fleet]) || (this.targeting.kind === 'air' && !st.wings[this.targeting.wing]) || (this.targeting.kind === 'drop' && !st.armies[this.targeting.army]))) this.targeting = null;
  }

  /**
   * Completes the week in progress. Commands, saves and bug reports wait for it,
   * so they always see whole weeks, and a replay applies each command between
   * the same two weeks as the campaign did.
   */
  finishWeek(): void {
    const week = this.week;
    if (!week) return;
    this.week = null;
    while (!week.next().done);
    this.afterTick();
    this.applyWeekEndOrders();
  }

  /** The orders given while the week that has just ended was in progress, in the order given. */
  private applyWeekEndOrders(): void {
    const orders = this.atWeekEnd;
    if (!orders.length || !this.sim) return;
    this.atWeekEnd = [];
    for (const o of orders) o();
  }

  /** Developer/test hook (console only): advance the simulation N weeks immediately. */
  debugAdvance(weeksToRun: number): void {
    const sim = this.sim;
    if (!sim) return;
    this.finishWeek();
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
    this.finishWeek();
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
    this.finishWeek();
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
    this.selectedOp = null;
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
    this.selectedOp = null;
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
    this.selectedOp = null;
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.moveMode = false;
    this.selectedZone = id;
    this.ui.inspectorPeek = false;
    this.refresh();
  }

  selectWing(id: string | null): void {
    this.selectedOp = null;
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.moveMode = false;
    this.selectedWing = id;
    this.ui.inspectorPeek = false;
    this.refresh();
  }

  // ───────────────────────────── Selections and operations ─────────────────

  /** Adds a force of ours to the selection, or takes it out (the first one added brings the unit already selected along). */
  toggleForce(id: string): void {
    const sim = this.sim;
    if (!sim) return;
    if (this.opDraft && !this.opDraft.editing) {
      const d = this.opDraft;
      d.units = d.units.includes(id) ? d.units.filter((x) => x !== id) : [...d.units, id];
    }
    if (this.forceSel.includes(id)) this.forceSel = this.forceSel.filter((x) => x !== id);
    else {
      if (!this.forceSel.length) {
        const cur = this.selectedArmy ?? this.selectedFleet ?? this.selectedWing;
        const r = cur ? unitRef(sim, cur) : null;
        if (r && r.unit.nation === this.player && cur !== id) this.forceSel.push(cur!);
      }
      this.forceSel.push(id);
    }
    if (!this.opDraft) this.selectedOp = null;
    this.mapDirty = true;
    this.refresh();
  }

  setForceSel(ids: string[]): void {
    this.forceSel = [...new Set(ids)];
    this.selectedOp = null;
    this.mapDirty = true;
    this.refresh();
  }

  clearForceSel(): void {
    this.forceSel = [];
    this.mapDirty = true;
    this.refresh();
  }

  toggleProvince(pid: ProvinceId): void {
    this.provSel = this.provSel.includes(pid) ? this.provSel.filter((p) => p !== pid) : [...this.provSel, pid];
    this.selectedProvince = null;
    this.selectedArmy = null;
    this.clearSea();
    this.mapDirty = true;
    this.refresh();
  }

  setProvSel(pids: ProvinceId[]): void {
    this.provSel = [...new Set(pids)];
    this.mapDirty = true;
    this.refresh();
  }

  clearProvSel(): void {
    this.provSel = [];
    this.mapDirty = true;
    this.refresh();
  }

  setSelectMode(m: 'off' | 'forces' | 'provinces'): void {
    this.selectMode = m;
    this.mapDirty = true;
    this.refresh();
  }

  /** A box drawn on the map: our forces (or the provinces) whose markers (or centres) lie inside join the selection. */
  private finishBox(b: { x0: number; y0: number; x1: number; y1: number; kind: 'forces' | 'provinces' }): void {
    const r = this.renderer;
    const sim = this.sim;
    if (!r || !sim) return;
    const [x0, x1] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)];
    const [y0, y1] = [Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)];
    const inside = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    if (b.kind === 'provinces') {
      const add: ProvinceId[] = [];
      for (const pid of sim.world.provIds) {
        const c = r.provinceCenter(pid);
        const s = r.camera.toScreen(c.x, c.y);
        if (inside(s.x, s.y)) add.push(pid);
      }
      this.setProvSel([...this.provSel, ...add]);
      return;
    }
    const st = sim.state;
    const add: string[] = [];
    // stacked markers stand for every army of ours in that place
    for (const m of r.markers) {
      if (!inside(m.x + m.w / 2, m.y + m.h / 2)) continue;
      const a = st.armies[m.army];
      if (!a || a.nation !== this.player) continue;
      for (const x of Object.values(st.armies)) if (x.nation === this.player && x.location === a.location && !x.embarked) add.push(x.id);
    }
    for (const m of r.fleetMarkers) if (inside(m.x + m.w / 2, m.y + m.h / 2) && st.fleets[m.fleet]?.nation === this.player) add.push(m.fleet);
    for (const m of r.wingMarkers) if (inside(m.x + m.w / 2, m.y + m.h / 2)) for (const w of m.wings) if (st.wings[w]?.nation === this.player) add.push(w);
    if (this.opDraft && !this.opDraft.editing) this.opDraft.units = [...new Set([...this.opDraft.units, ...add])];
    this.setForceSel([...this.forceSel, ...add]);
    if (add.length) this.toast(`${add.length} force${add.length === 1 ? '' : 's'} added to the selection.`);
  }

  /** Selects an army, fleet or wing by id. */
  selectUnit(id: string): void {
    const st = this.sim?.state;
    if (!st) return;
    if (st.armies[id]) this.selectArmy(id, true);
    else if (st.fleets[id]) this.selectFleet(id, true);
    else if (st.wings[id]) this.selectWing(id);
  }

  /** Opens an operation's card (null: closes it). */
  selectOp(id: string | null): void {
    this.selectedOp = id;
    if (id) {
      this.selectedArmy = null;
      this.selectedProvince = null;
      this.clearSea();
    }
    this.ui.inspectorPeek = false;
    this.mapDirty = true;
    this.refresh();
  }

  /** Prepares a new operation with the selected forces (or the force selected). */
  startOpDraft(kind?: OperationKind): void {
    const units = this.forceSel.length ? [...this.forceSel] : [this.selectedArmy ?? this.selectedFleet ?? this.selectedWing].filter((x): x is string => !!x && unitRef(this.sim!, x)?.unit.nation === this.player);
    this.opDraft = newDraft(this, units, kind);
    this.forceSel = [...units];
    this.selectedOp = null;
    this.selectedArmy = null;
    this.selectedProvince = null;
    this.clearSea();
    this.pickOpArea();
  }

  /** Auto-conquer's opponents: its settings, where the enemies are chosen. */
  editWarEnemies(id: string): void {
    this.editOp(id);
  }

  /** Opens an operation for changes. */
  editOp(id: string): void {
    const sim = this.sim;
    const op = sim?.state.operations[id];
    if (!sim || !op) return;
    const f = opForces(sim, id);
    this.opDraft = draftFromOp(op, [...f.armies, ...f.fleets, ...f.wings].map((u) => u.id));
    this.refresh();
  }

  cancelOpDraft(): void {
    const editing = this.opDraft?.editing ?? null;
    this.opDraft = null;
    if (this.targeting?.kind === 'opArea') this.targeting = null;
    this.canvas?.classList.remove('move-mode');
    if (editing) this.selectedOp = editing;
    this.mapDirty = true;
    this.refresh();
  }

  /** The next map clicks choose the area of the operation being prepared. */
  pickOpArea(): void {
    this.targeting = { kind: 'opArea' };
    this.canvas.classList.add('move-mode');
    this.mapDirty = true;
    this.refresh();
  }

  private toggleOpArea(x: number, y: number, region: boolean): void {
    const sim = this.sim;
    const d = this.opDraft;
    const r = this.renderer;
    if (!sim || !d || !r) return;
    const pid = r.provinceAt(x, y);
    if (d.kind === 'sea') {
      const z = pid ? null : r.zoneAt(x, y);
      if (z) d.zones = d.zones.includes(z) ? d.zones.filter((q) => q !== z) : [...d.zones, z];
    } else if (pid) {
      if (d.kind === 'advance') d.area = [pid];
      else if (region && d.kind !== 'landing') {
        const reg = sim.world.prov[pid].region;
        const all = sim.world.provIds.filter((p) => sim.world.prov[p].region === reg);
        const on = d.area.includes(pid);
        d.area = on ? d.area.filter((p) => !all.includes(p)) : [...new Set([...d.area, ...all])];
      } else d.area = d.area.includes(pid) ? d.area.filter((p) => p !== pid) : [...d.area, pid];
    }
    this.mapDirty = true;
    this.refresh();
  }

  /** Creates the operation prepared (or saves the changes to the one being changed). */
  commitOpDraft(activate: boolean): void {
    const d = this.opDraft;
    if (!d) return;
    const war = d.kind === 'war';
    const r = d.editing
      ? this.do({ type: 'editOp', op: d.editing, area: d.kind === 'sea' || war ? undefined : d.area, zones: d.kind === 'sea' ? d.zones : undefined, settings: d.settings, name: d.name || undefined, enemies: war ? d.enemies : undefined })
      : this.do({ type: 'createOp', kind: d.kind, area: war ? [] : d.area, zones: d.zones, settings: d.settings, units: d.units, name: d.name || undefined, activate, enemies: war ? d.enemies : undefined });
    if (!r.ok) return;
    const id = d.editing ?? Object.values(this.sim!.state.operations).filter((o) => o.nation === this.player).map((o) => o.id).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).at(-1) ?? null;
    this.opDraft = null;
    this.forceSel = [];
    if (this.targeting?.kind === 'opArea') this.targeting = null;
    this.canvas?.classList.remove('move-mode');
    this.selectOp(id);
  }

  cancelOp(id: string): void {
    const op = this.sim?.state.operations[id];
    if (!op) return;
    confirmDialog(this, `Cancel ${op.name}?`, [h('p', null, 'Every force in it returns to your direct command and keeps its last orders. Nothing else changes.')], () => {
      this.do({ type: 'cancelOp', op: id });
      this.selectOp(null);
    }, 'Cancel the operation', false);
  }

  /** The area drawn on the map: the operation being prepared, or the one whose card is open. */
  private opAreaShown(): { provinces: ProvinceId[]; zones: string[]; draft: boolean } | null {
    if (this.opDraft) return { provinces: this.opDraft.area, zones: this.opDraft.zones, draft: true };
    const op = this.selectedOp ? this.sim?.state.operations[this.selectedOp] : undefined;
    return op ? { provinces: op.area, zones: op.zones, draft: false } : null;
  }

  /** March all to…: the selected armies march to the next province clicked. */
  startGroupMove(): void {
    const sim = this.sim;
    if (!sim) return;
    const ids = this.forceSel.filter((id) => sim.state.armies[id]?.nation === this.player);
    if (!ids.length) return;
    this.groupMoveIds = ids;
    this.moveMode = true;
    this.canvas.classList.add('move-mode');
    this.refresh();
  }

  private groupMoveTo(dest: ProvinceId): void {
    const ids = this.groupMoveIds ?? [];
    this.cancelMoveMode();
    this.groupOrder(`March to ${this.sim!.world.prov[dest].name}`, ids, () => ({ type: 'move', army: '', dest }), 'army');
  }

  /**
   * One order for several forces: each is checked and given it on its own (by the
   * ordinary rules, as if ordered one by one); every one that cannot says why, and the
   * selection card lists them all, so none is dropped silently.
   */
  groupOrder(title: string, ids: string[], make: (id: string) => PlayerCommand | string, field?: 'army' | 'fleet' | 'wing'): void {
    const sim = this.sim;
    if (!sim) return;
    this.finishWeek();
    const rows: Array<{ id: string; name: string; ok: boolean; text: string }> = [];
    for (const id of ids) {
      const ref = unitRef(sim, id);
      if (!ref || ref.unit.nation !== this.player) {
        rows.push({ id, name: id, ok: false, text: 'No longer ours (lost or disbanded).' });
        continue;
      }
      const c = make(id);
      if (typeof c === 'string') {
        rows.push({ id, name: ref.unit.name, ok: false, text: c });
        continue;
      }
      const cmd = (field ? { ...c, [field]: id } : c) as PlayerCommand;
      const r = this.do(cmd, true);
      rows.push({ id, name: ref.unit.name, ok: r.ok, text: r.ok ? (r.message ?? 'Done.') : r.reason });
    }
    const ok = rows.filter((r) => r.ok).length;
    this.groupResult = { title, rows };
    this.toast(`${title}: ${ok} of ${rows.length}${ok < rows.length ? ` · ${rows.length - ok} could not (each says why on the selection card)` : ''}.`, ok < rows.length ? 'fail' : 'good');
    this.refresh();
  }

  /** The next map click picks the place for several fleets or wings at once. */
  startGroupTarget(order: 'sail' | 'rebase' | FleetDutyKind, ids: string[]): void {
    if (!ids.length) return;
    this.targeting = { kind: 'group', order, ids };
    this.canvas.classList.add('move-mode');
    this.dutyHint = order === 'sail' ? 'Click the sea zone (or a coast) where they sail.' : order === 'rebase' ? 'Click the airfield (or a fleet with carriers) to move them to.' : '';
    if (order !== 'sail' && order !== 'rebase') this.startDutyHint(order);
    this.refresh();
  }

  private startDutyHint(duty: FleetDutyKind): void {
    const what: Record<FleetDutyKind, string> = {
      hold: 'Click anywhere.',
      patrol: 'Click the sea zone to patrol.',
      blockade: 'Click the sea zone to blockade (a coast takes the waters off it).',
      raid: 'Click the sea zone to raid in.',
      escort: 'Click the fleet of ours to escort.',
      bombard: 'Click the coast province to shell.',
      port: 'Click the port to return to.',
    };
    this.dutyHint = what[duty];
  }

  /** Where each fleet would sail for a click (its own route to that coast). */
  private fleetZoneAt(fleetId: string, x: number, y: number): string | null {
    const sim = this.sim;
    const f = sim?.state.fleets[fleetId];
    if (!sim || !f || !this.renderer) return null;
    const pid = this.renderer.provinceAt(x, y);
    return this.renderer.zoneAt(x, y) ?? (pid ? pathToCoast(sim, f.zone, pid)?.at(-1) ?? (sim.world.provZones[pid]?.includes(f.zone) ? f.zone : null) : null);
  }

  private resolveGroupTarget(tg: { order: 'sail' | 'rebase' | FleetDutyKind; ids: string[] }, x: number, y: number): void {
    const sim = this.sim!;
    const r = this.renderer!;
    if (tg.order === 'sail') {
      const pid = r.provinceAt(x, y);
      const zone = r.zoneAt(x, y);
      const where = zone ? zoneName(sim, zone) : pid ? `the coast of ${provName(sim, pid)}` : 'there';
      this.groupOrder(`Sail to ${where}`, tg.ids, (id) => {
        const z = this.fleetZoneAt(id, x, y);
        return z ? { type: 'moveFleet', fleet: id, zone: z } : pid ? `${provName(sim, pid)} is not on a coast it can reach.` : 'Choose a sea zone.';
      });
      return;
    }
    if (tg.order === 'rebase') {
      const fleet = r.fleetAt(x, y);
      const carrier = fleet && sim.state.fleets[fleet]?.nation === this.player ? fleet : null;
      const pid = carrier ? null : r.provinceAt(x, y);
      if (!carrier && !pid) {
        this.refresh();
        return;
      }
      this.groupOrder(`Move to ${carrier ? sim.state.fleets[carrier].name : provName(sim, pid!)}`, tg.ids, (id) => (carrier ? { type: 'rebaseWing', wing: id, carrier } : { type: 'rebaseWing', wing: id, base: pid! }));
      return;
    }
    const duty = tg.order;
    this.groupOrder(DUTY_LABELS[duty], tg.ids, (id) => {
      const d = this.dutyAt(id, duty, x, y);
      return d ? { type: 'fleetDuty', fleet: id, duty: d } : `Nothing it can ${DUTY_LABELS[duty].toLowerCase()} there.`;
    });
  }

  /** The next map click picks a destination zone for the selected fleet. */
  startFleetMove(fleet: string): void {
    this.targeting = { kind: 'fleet', fleet };
    this.canvas.classList.add('move-mode');
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
    this.refresh();
  }

  /** The next map click picks the place for a fleet's standing order (a zone, a coast, a port or a fleet). */
  startDutyTarget(fleet: string, duty: FleetDutyKind): void {
    this.targeting = { kind: 'duty', fleet, duty };
    this.canvas.classList.add('move-mode');
    const what: Record<FleetDutyKind, string> = {
      hold: 'Click anywhere.',
      patrol: 'Click the sea zone to patrol.',
      blockade: 'Click the sea zone to blockade (a coast takes the waters off it).',
      raid: 'Click the sea zone to raid in.',
      escort: 'Click the fleet of ours to escort.',
      bombard: 'Click the coast province to shell.',
      port: 'Click the port to return to.',
    };
    this.dutyHint = what[duty];
    this.refresh();
  }

  /** The next map click picks the province an airborne army is dropped on. */
  startDropTarget(army: string): void {
    this.targeting = { kind: 'drop', army };
    this.canvas.classList.add('move-mode');
    this.refresh();
  }

  /** Reviews an airborne operation's risks and launches it on confirmation. */
  confirmDrop(army: string, target: ProvinceId): void {
    const sim = this.sim;
    const a = sim?.state.armies[army];
    if (!sim || !a) return;
    const prob = airDropProblem(sim, a.nation, a.id, target);
    if (prob) {
      this.toast(prob, 'fail');
      return;
    }
    const risk = airDropRisk(sim, a.nation, target);
    const men = a.regiments.reduce((n, r) => n + r.men, 0);
    confirmDialog(
      this,
      `Drop ${a.name} on ${provName(sim, target)}?`,
      [h('p', null, `${a.regiments.length} airborne regiments (${men.toLocaleString()} men) fly from ${provName(sim, a.location)} in this week's air phase. Expected losses on the way in: about ${Math.round(risk.loss * 100)}% (${Math.round(men * risk.loss).toLocaleString()} men).`), h('ul', { class: 'notes small' }, risk.notes.map((n) => h('li', null, n)))],
      () => this.do({ type: 'airDrop', army: a.id, target }),
      'Launch the drop',
      false,
    );
  }

  /** The order a duty would be at a screen point (null: nothing fitting there). */
  dutyAt(fleetId: string, duty: FleetDutyKind, x: number, y: number): Omit<FleetDuty, 'since'> | null {
    const sim = this.sim;
    const f = sim?.state.fleets[fleetId];
    if (!sim || !f || !this.renderer) return null;
    const pid = this.renderer.provinceAt(x, y);
    const zone = pid ? null : this.renderer.zoneAt(x, y);
    if (duty === 'hold') return { kind: 'hold' };
    if (duty === 'escort') {
      const g = this.renderer.fleetAt(x, y);
      return g ? { kind: 'escort', fleet: g } : null;
    }
    if (duty === 'bombard') return pid ? { kind: 'bombard', province: pid } : null;
    if (duty === 'port') return pid ? { kind: 'port', province: pid } : null;
    const z = zone ?? (pid ? (sim.world.provZones[pid]?.includes(f.zone) ? f.zone : pathToCoast(sim, f.zone, pid)?.at(-1) ?? null) : null);
    return z ? { kind: duty, zone: z } : null;
  }

  /** The next map click picks an air wing's target province (for several wings at once: `group`). */
  startAirTarget(wing: string, mission: AirMission, group?: string[]): void {
    this.targeting = group && group.length > 1 ? { kind: 'air', wing, mission, group } : { kind: 'air', wing, mission };
    this.canvas.classList.add('move-mode');
    this.mapDirty = true;
    this.refresh();
  }

  cancelTargeting(): void {
    this.targeting = null;
    this.canvas.classList.remove('move-mode');
    this.refresh();
  }

  selectArmy(id: string | null, center = false): void {
    if (id !== this.selectedArmy) this.ui.groupOrders = false;
    this.selectedOp = null;
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
    this.selectedOp = null;
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
    this.groupMoveIds = null;
    this.canvas.classList.remove('move-mode');
    this.refresh();
  }

  orderMove(dest: ProvinceId, armyId?: string, append = false): void {
    const id = armyId ?? this.selectedArmy;
    if (!id) return;
    // A week half done on a large map can take a tenth of a second or more to
    // finish: rather than freeze the map until it has, the order waits for the end
    // of the week (the frame loop hurries it), and is applied between the same two
    // weeks as finishing it at once would.
    if (this.week) {
      this.atWeekEnd.push(() => this.orderMove(dest, id, append));
      this.cancelMoveMode();
      return;
    }
    const a = this.sim?.state.armies[id];
    const group = a && this.ui.groupOrders && a.group ? this.groupArmies(a.group) : [];
    if (group.length > 1) {
      // every army of the group marches on its own best route; each that cannot says why
      this.cancelMoveMode();
      this.groupOrder(`Group ${a!.group}: march to ${this.sim!.world.prov[dest].name}`, group.map((g) => g.id), () => ({ type: 'move', army: '', dest, ...(append ? { append: true } : {}) }), 'army');
      return;
    }
    const r = this.do({ type: 'move', army: id, dest, ...(append ? { append: true } : {}) }, true);
    // a route through enemy troops is said at once (the order stands)
    if (r.ok && r.message) this.toast(r.message, 'fail');
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
    const sim = this.sim;
    const a = this.selectedArmy ? sim?.state.armies[this.selectedArmy] : undefined;
    const w = this.selectedWing ? sim?.state.wings[this.selectedWing] : undefined;
    const f = this.selectedFleet ? sim?.state.fleets[this.selectedFleet] : w?.carrier ? sim?.state.fleets[w.carrier] : undefined;
    if (a) this.centerOn(a.location, 110);
    else if (f && this.renderer) {
      const c = this.renderer.zoneCenter(f.zone);
      this.renderer.camera.centerOn(c.x, c.y, Math.max(this.renderer.camera.zoom, this.renderer.camera.zoomForProvincePx(50)));
      this.mapDirty = true;
    } else if (w) this.centerOn(w.base, 90);
    else if (this.selectedProvince) this.centerOn(this.selectedProvince, 110);
  }

  /** N: the next army of ours (with a wing or a fleet selected: the next wing or fleet). */
  cycleArmy(): void {
    const sim = this.sim;
    if (!sim || !this.player) return;
    if (this.selectedWing || this.selectedFleet) {
      const kind = this.selectedWing ? 'wings' : 'fleets';
      const ids = Object.keys(kind === 'wings' ? sim.state.wings : sim.state.fleets)
        .sort()
        .filter((id) => (kind === 'wings' ? sim.state.wings[id].nation : sim.state.fleets[id].nation) === this.player);
      if (!ids.length) return;
      const i = ids.indexOf((kind === 'wings' ? this.selectedWing : this.selectedFleet) ?? '');
      const next = ids[(i + 1) % ids.length];
      if (kind === 'wings') this.selectWing(next);
      else this.selectFleet(next);
      this.centreSelection();
      return;
    }
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
    // the ledger was just built: the rest of the interface catches up next frame without building it again
    this.ledgerFresh = true;
    this.tutorial?.update();
    (this.drawerEl.querySelector('#ledger-title') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  closeLedger(): void {
    this.ui.ledgerTab = null;
    this.drawerEl.classList.add('closed');
    this.stageEl.classList.remove('wide-ledger');
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
    this.finishWeek();
    try {
      const replaced = await this.store.putKeepingPrevious(slot, serialize(this.sim));
      const label = slotLabel(slot);
      this.toast(replaced ? `Saved to ${label}. The save it replaced is kept on the Load screen.` : `Saved to ${label}.`, 'good');
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
    this.finishWeek();
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
    this.finishWeek();
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
        this.lastInput = performance.now();
        const r = c.getBoundingClientRect();
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016));
        this.renderer.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
        this.mapDirty = true;
      },
      { passive: false },
    );
    c.addEventListener('pointerdown', (e) => {
      this.lastInput = performance.now();
      c.setPointerCapture(e.pointerId);
      const r = c.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, moved: false });
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
      this.lastInput = performance.now();
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
        // a drag with Shift (forces), Ctrl/Cmd (provinces) or the Select tool draws a selection box instead of panning
        const kind = p.button !== 0 || this.targeting ? null : this.selectMode !== 'off' ? this.selectMode : p.shift ? 'forces' : p.ctrl ? 'provinces' : null;
        if (kind) this.box = { x0: p.sx, y0: p.sy, x1: x, y1: y, kind };
        else c.classList.add('dragging');
      }
      if (p.moved && this.box) {
        this.box.x1 = x;
        this.box.y1 = y;
        this.mapDirty = true;
      } else if (p.moved && this.renderer) {
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
      if (this.box) {
        const b = this.box;
        this.box = null;
        this.mapDirty = true;
        if (e.type !== 'pointercancel') this.finishBox(b);
        return;
      }
      if (!p || p.moved || this.pointers.size > 0 || e.type === 'pointercancel') return;
      if (p.button === 2) this.secondaryAt(p.x, p.y, p.shift || e.shiftKey);
      else if (p.button === 0) this.primaryAt(p.x, p.y, e.shiftKey, p.ctrl || e.ctrlKey || e.metaKey);
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

  /** The camera when the hover card was last worked out. */
  private hoverView = '';

  private viewKey(): string {
    const c = this.renderer!.camera;
    return `${c.zoom}|${c.offX}|${c.offY}`;
  }

  private hover(x: number, y: number): void {
    if (!this.renderer || !this.sim) return;
    if (this.underPanel(x, y)) return this.hideHover();
    this.hoverPos = { x, y };
    this.hoverView = this.viewKey();
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
    const tg = this.targeting;
    if (tg?.kind === 'air' && sim.state.wings[tg.wing]) {
      // choosing a mission's target: say whether it can be flown there, and why not
      const w = sim.state.wings[tg.wing];
      const t = this.airTargetAt(tg.mission, x, y);
      const where = t ? (t.zone ? sim.world.zones[t.zone].name : provName(sim, t.target!)) : null;
      const prob = t ? missionProblem(sim, w.nation, w.id, tg.mission, t.target, t.zone) : tg.mission === 'naval' ? 'Choose a sea zone.' : 'Choose a province.';
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, icon('plane'), `${MISSION_LABELS[tg.mission]}${where ? `: ${where}` : ''}`),
        t ? h('div', { class: 'tt-row' }, `${stepsTo(sim, w, t.zone ? { zone: t.zone } : { prov: t.target! })} steps from ${wingHome(sim, w)} (range ${wingRange(sim, w)})`) : null,
        h('div', { class: prob ? 'tt-hint bad' : 'tt-hint' }, prob ?? 'Click to fly the mission here. Esc cancels.'),
      );
      tipEl.classList.remove('hidden');
      const W = this.stageEl.clientWidth;
      const H = this.stageEl.clientHeight;
      tipEl.style.left = `${Math.min(x + 16, W - (tipEl.offsetWidth || 260) - 8)}px`;
      tipEl.style.top = `${Math.min(y + 18, H - (tipEl.offsetHeight || 70) - 8)}px`;
      return;
    }
    if (tg?.kind === 'drop' && sim.state.armies[tg.army]) {
      // choosing where to drop: range, and the sky, guns and troops waiting there
      const a = sim.state.armies[tg.army];
      const pid = this.renderer.provinceAt(x, y);
      const prob = pid ? airDropProblem(sim, a.nation, a.id, pid) : 'Choose a province.';
      const risk = pid && !prob ? airDropRisk(sim, a.nation, pid) : null;
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, icon('plane'), `Airborne drop${pid ? `: ${provName(sim, pid)}` : ''}`),
        risk ? h('div', { class: 'tt-row' }, `Expected losses on the way in: ${Math.round(risk.loss * 100)}%`) : null,
        ...(risk ? risk.notes.slice(0, 3).map((n) => h('div', { class: 'tt-row' }, n)) : []),
        h('div', { class: prob ? 'tt-hint bad' : 'tt-hint' }, prob ?? 'Click to review and launch. Esc cancels.'),
      );
      tipEl.classList.remove('hidden');
      const W = this.stageEl.clientWidth;
      const H = this.stageEl.clientHeight;
      tipEl.style.left = `${Math.min(x + 16, W - (tipEl.offsetWidth || 260) - 8)}px`;
      tipEl.style.top = `${Math.min(y + 18, H - (tipEl.offsetHeight || 70) - 8)}px`;
      return;
    }
    if (tg?.kind === 'duty' && sim.state.fleets[tg.fleet]) {
      // choosing where a fleet's order applies: say whether it can be given there, and why not
      const f = sim.state.fleets[tg.fleet];
      const d = this.dutyAt(f.id, tg.duty, x, y);
      const prob = d ? fleetDutyProblem(sim, f.nation, f.id, d) : 'Choose a place on the map.';
      const dest = d ? dutyDestination(sim, f, d) : null;
      const path = dest && dest !== f.zone ? zonePath(sim, f.zone, dest) : null;
      const where = d?.zone ? zoneName(sim, d.zone) : d?.province ? provName(sim, d.province) : d?.fleet ? sim.state.fleets[d.fleet]?.name ?? '' : '';
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, icon('anchor'), `${DUTY_LABELS[tg.duty]}${where ? `: ${where}` : ''}`),
        h('div', { class: 'tt-row' }, path ? `${path.length} zone${path.length === 1 ? '' : 's'} away · ${weeks(fleetEta(sim, f, path))}` : dest ? 'Here' : DUTY_HELP[tg.duty]),
        h('div', { class: prob ? 'tt-hint bad' : 'tt-hint' }, prob ?? 'Click to give the order. Esc cancels.'),
      );
      tipEl.classList.remove('hidden');
      const W = this.stageEl.clientWidth;
      const H = this.stageEl.clientHeight;
      tipEl.style.left = `${Math.min(x + 16, W - (tipEl.offsetWidth || 260) - 8)}px`;
      tipEl.style.top = `${Math.min(y + 18, H - (tipEl.offsetHeight || 70) - 8)}px`;
      return;
    }
    const wm = !tg ? this.renderer.wingAt(x, y) : null;
    const fleetId = this.renderer.fleetAt(x, y);
    if (wm && !fleetId) {
      const ws = wm.wings.map((id) => sim.state.wings[id]).filter((w) => !!w);
      const n = ws[0]?.nation;
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, n ? shield(this, n) : null, wm.fleet ? `Aboard ${sim.state.fleets[wm.fleet]?.name ?? ''}` : `Airfield at ${provName(sim, wm.base!)}`),
        ...ws.slice(0, 5).map((w) => h('div', { class: 'tt-row' }, `${w.name} · ${MISSION_LABELS[w.mission].toLowerCase()} · ready ${Math.round(w.readiness)}%`)),
        h('div', { class: 'tt-hint' }, n === this.player ? `Click to select${ws.length > 1 ? ' (again for the next wing)' : ''}; then right-click a place for its orders.` : 'Click for details.'),
      );
    } else if (fleetId && sim.state.fleets[fleetId]) {
      const f = sim.state.fleets[fleetId];
      const def = sim.world.nationDefs[f.nation];
      const hostile = this.player ? atWar(sim, this.player, f.nation) : false;
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, shield(this, f.nation), f.name),
        h('div', { class: 'tt-row' }, `${def.short}${hostile ? ' · enemy' : ''} · ${fleetSummary(f)}${f.cargo.length ? ` · carrying ${f.cargo.length} ${f.cargo.length === 1 ? 'army' : 'armies'}` : ''}`),
        f.duty ? h('div', { class: 'tt-row' }, `Order: ${DUTY_LABELS[f.duty.kind].toLowerCase()}`) : null,
        h('div', { class: 'tt-hint' }, f.nation === this.player ? 'Click to select, then right-click a place for its orders (Shift+right-click sails at once).' : 'Click for details.'),
      );
    } else if (!armyId && !pid && this.hoverZone) {
      const z = sim.world.zones[this.hoverZone];
      const here = fleetsIn(sim, z.id);
      setChildren(
        tipEl,
        h('div', { class: 'tt-title' }, icon('anchor'), z.name),
        h('div', { class: 'tt-row' }, `${z.coasts.length} coastal provinces${z.straits?.length ? ` · commands ${z.straits.length} strait${z.straits.length === 1 ? '' : 's'}` : ''}${here.length ? ` · ${here.length} fleet${here.length === 1 ? '' : 's'}` : ''}`),
        this.selectedFleet && sim.state.fleets[this.selectedFleet]?.nation === this.player ? h('div', { class: 'tt-hint' }, 'Right-click for orders here (Shift+right-click sails at once).') : null,
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

  private primaryAt(x: number, y: number, shift: boolean, ctrl = false): void {
    if (!this.renderer || !this.sim) return;
    this.canvas.focus({ preventScroll: true });
    this.ui.attentionOpen = false;
    const pid = this.renderer.provinceAt(x, y);
    if (this.moveMode && this.groupMoveIds) {
      if (pid) this.groupMoveTo(pid);
      else this.cancelMoveMode();
      return;
    }
    if (this.moveMode && this.selectedArmy) {
      if (pid) this.orderMove(pid, undefined, shift);
      else this.cancelMoveMode();
      return;
    }
    const tg = this.targeting;
    if (tg?.kind === 'opArea') {
      // choosing an operation's area: each click adds or removes (the pick stays open)
      this.toggleOpArea(x, y, shift);
      return;
    }
    // forces of ours under the pointer (for the selection)
    const ownAt = () => {
      const r = this.renderer!;
      const st = this.sim!.state;
      const f = r.fleetAt(x, y);
      if (f && st.fleets[f]?.nation === this.player) return f;
      const wm = r.wingAt(x, y);
      if (wm) {
        const w = wm.wings.find((id) => st.wings[id]?.nation === this.player);
        if (w) return w;
      }
      const a = r.armyAt(x, y);
      if (a && st.armies[a]?.nation === this.player) return a;
      return null;
    };
    // preparing an operation: clicks on our forces add or remove them
    if (this.opDraft && !tg) {
      const u = ownAt();
      if (u) this.toggleForce(u);
      return;
    }
    if (!tg && (this.selectMode === 'provinces' || (ctrl && !shift))) {
      if (pid) this.toggleProvince(pid);
      return;
    }
    if (!tg && (this.selectMode === 'forces' || shift)) {
      const u = ownAt();
      if (u) {
        this.toggleForce(u);
        return;
      }
      if (this.selectMode === 'forces') return;
    }
    if (tg) {
      this.targeting = null;
      this.canvas.classList.remove('move-mode');
      if (tg.kind === 'fleet') this.orderFleet(tg.fleet, x, y);
      else if (tg.kind === 'ship' && pid) this.do({ type: 'shipArmies', armies: tg.armies, fleet: tg.fleet, dest: pid });
      else if (tg.kind === 'drop') {
        if (pid) this.confirmDrop(tg.army, pid);
        else this.refresh();
      } else if (tg.kind === 'duty') {
        const d = this.dutyAt(tg.fleet, tg.duty, x, y);
        if (d) this.do({ type: 'fleetDuty', fleet: tg.fleet, duty: d });
        else this.refresh();
      } else if (tg.kind === 'group') this.resolveGroupTarget(tg, x, y);
      else if (tg.kind === 'air') {
        const t = this.airTargetAt(tg.mission, x, y);
        if (t && tg.group) {
          // several wings at once: each flies it if it can; the others say why not
          const where = t.zone ? zoneName(this.sim, t.zone) : provName(this.sim, t.target!);
          this.groupOrder(`${MISSION_LABELS[tg.mission]} over ${where}`, tg.group, (id) => ({ type: 'airMission', wing: id, mission: tg.mission, target: t.target, zone: t.zone }));
        } else if (t) this.do({ type: 'airMission', wing: tg.wing, mission: tg.mission, target: t.target, zone: t.zone });
        else this.refresh();
      } else this.refresh();
      return;
    }
    const fleet = this.renderer.fleetAt(x, y);
    if (fleet) {
      this.selectFleet(fleet);
      return;
    }
    // an air wing counter: the wings at that airfield or aboard that fleet; clicking again cycles through them
    const wm = this.renderer.wingAt(x, y);
    if (wm) {
      const i = this.selectedWing ? wm.wings.indexOf(this.selectedWing) : -1;
      this.selectWing(wm.wings[(i + 1) % wm.wings.length]);
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

  /**
   * What an air mission ordered at a screen point would cover: a province, or a
   * sea zone (naval strikes always; superiority and reconnaissance over open water).
   * A naval strike ordered on a coast takes the sea zone off it.
   */
  airTargetAt(mission: AirMission, x: number, y: number): { target: ProvinceId | null; zone: string | null } | null {
    if (!this.renderer || !this.sim) return null;
    const pid = this.renderer.provinceAt(x, y);
    const zone = pid ? null : this.renderer.zoneAt(x, y);
    if (mission === 'naval') {
      const z = zone ?? (pid ? this.sim.world.provZones[pid]?.[0] ?? null : null);
      return z ? { target: null, zone: z } : null;
    }
    if (zone && SEA_MISSIONS.includes(mission)) return { target: null, zone };
    return pid ? { target: pid, zone: null } : null;
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
    // Shift+right-click sails at once; otherwise the orders that fit the place
    if (f && f.nation === this.player && shift) {
      this.orderFleet(f.id, x, y);
      return;
    }
    if (this.targeting) this.cancelTargeting();
    if (openOrderMenu(this, x, y)) return;
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
    this.lastInput = performance.now();
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
      else if (this.opDraft) this.cancelOpDraft();
      else if (this.selectMode !== 'off') this.setSelectMode('off');
      else if (this.forceSel.length) this.clearForceSel();
      else if (this.provSel.length) this.clearProvSel();
      else if (this.selectedOp) this.selectOp(null);
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
    } else if (lk === 'e' && (this.selectedWing || this.selectedFleet)) {
      // orders at the pointer (or at the middle of the map)
      if (orderMenuOpen()) closeOrderMenu();
      else {
        const p = this.hoverPos ?? { x: this.stageEl.clientWidth / 2, y: this.stageEl.clientHeight / 2 };
        if (!openOrderMenu(this, p.x, p.y)) this.toast('Select an air wing or a fleet of ours first.');
      }
    } else if (lk === 'g' && this.selectedArmy) this.startMoveMode();
    else if (lk === 'g' && this.selectedFleet && this.sim.state.fleets[this.selectedFleet]?.nation === this.player) this.startFleetMove(this.selectedFleet);
    else if (lk === 'f') this.fitWorld();
    else if (lk === 'c') this.centreSelection();
    else if (lk === 'k') this.nextBattle();
    else if (lk === 'j') this.jumpToAlert();
    else if (lk === 'x') this.setSelectMode(this.selectMode === 'off' ? 'forces' : this.selectMode === 'forces' ? 'provinces' : 'off');
    else if (lk === 'u') this.openLedger('military');
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
    const tg = this.targeting;
    if (this.moveMode && this.groupMoveIds) {
      this.bannerEl.classList.remove('hidden');
      const cancel = h('button', { class: 'btn small quiet', type: 'button', 'data-fk': 'banner-cancel' }, 'Cancel (Esc)');
      cancel.addEventListener('click', () => this.cancelMoveMode());
      setChildren(this.bannerEl, icon('move'), h('span', null, `Choose where the ${this.groupMoveIds.length} selected armies march (each by its own best route).`), cancel);
    } else if (tg?.kind === 'opArea' && this.opDraft) {
      this.bannerEl.classList.remove('hidden');
      const done = h('button', { class: 'btn small primary', type: 'button', 'data-fk': 'banner-cancel' }, 'Done');
      done.addEventListener('click', () => this.cancelTargeting());
      const k = this.opDraft.kind;
      const n = k === 'sea' ? this.opDraft.zones.length : this.opDraft.area.length;
      setChildren(this.bannerEl, icon('target'), h('span', null, k === 'sea' ? `Click sea zones to add or remove them (${n} chosen).` : k === 'advance' ? 'Click the province to advance to.' : k === 'landing' ? `Click the beach, then the provinces to take after landing (${n} chosen).` : `Click provinces to add or remove them; Shift+click: a whole region (${n} chosen).`), done);
    } else if (this.selectMode !== 'off' && !tg) {
      this.bannerEl.classList.remove('hidden');
      const done = h('button', { class: 'btn small quiet', type: 'button', 'data-fk': 'banner-cancel' }, 'Done');
      done.addEventListener('click', () => this.setSelectMode('off'));
      // switch what is being selected (the map buttons are hidden under an open card on small screens)
      const other = h('button', { class: 'btn small quiet', type: 'button', 'data-fk': 'banner-switch' }, this.selectMode === 'forces' ? 'Provinces' : 'Forces');
      other.addEventListener('click', () => this.setSelectMode(this.selectMode === 'forces' ? 'provinces' : 'forces'));
      const n = this.selectMode === 'forces' ? this.forceSel.length : this.provSel.length;
      setChildren(this.bannerEl, icon('check'), h('span', null, `${this.selectMode === 'forces' ? 'Forces' : 'Provinces'} (${n}): tap to add or remove, drag for a box.`), other, done);
    } else if (this.moveMode && a) {
      this.bannerEl.classList.remove('hidden');
      const cancel = h('button', { class: 'btn small quiet', type: 'button' }, 'Cancel (Esc)');
      cancel.addEventListener('click', () => this.cancelMoveMode());
      setChildren(this.bannerEl, icon('move'), h('span', null, `Choose where ${a.name} marches. Shift adds a waypoint.`), cancel);
    } else if (tg && this.sim) {
      // choosing a place for a fleet, a landing, a mission or an order: the banner can cancel it (touch has no Esc)
      const sim = this.sim;
      const text =
        tg.kind === 'opArea'
          ? 'Choose the operation’s area.'
          : tg.kind === 'fleet'
          ? `Click the sea zone (or a coast) where ${sim.state.fleets[tg.fleet]?.name ?? 'the fleet'} sails.`
          : tg.kind === 'ship'
            ? `Click the coast where the troops land (${sim.state.fleets[tg.fleet]?.name ?? 'the fleet'} carries them).`
            : tg.kind === 'duty'
              ? `${DUTY_LABELS[tg.duty]} (${sim.state.fleets[tg.fleet]?.name ?? 'the fleet'}): ${this.dutyHint}`
              : tg.kind === 'group'
                ? `${tg.order === 'sail' ? 'Sail' : tg.order === 'rebase' ? 'Move' : DUTY_LABELS[tg.order]} (${tg.ids.length} ${tg.order === 'rebase' ? 'wings' : 'fleets'}, each by its own route and range): ${this.dutyHint}`
              : tg.kind === 'drop'
                ? `Airborne drop: click where ${sim.state.armies[tg.army]?.name ?? 'the army'} lands; the tooltip shows the range and the risks.`
              : `${MISSION_LABELS[tg.mission]}: click where ${tg.group ? `${tg.group.length} wings fly` : `${sim.state.wings[tg.wing]?.name ?? 'the wing'} flies`} (${tg.mission === 'naval' ? 'a sea zone' : SEA_MISSIONS.includes(tg.mission) ? 'a province or a sea zone' : 'a province'}; the shaded area is within range).`;
      this.bannerEl.classList.remove('hidden');
      const cancel = h('button', { class: 'btn small quiet', type: 'button', 'data-fk': 'banner-cancel' }, 'Cancel (Esc)');
      cancel.addEventListener('click', () => this.cancelTargeting());
      setChildren(this.bannerEl, icon('target'), h('span', null, text), cancel);
    } else {
      this.bannerEl.classList.add('hidden');
      this.canvas?.classList.remove('move-mode');
    }
    void provName;
  }
}
