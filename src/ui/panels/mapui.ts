// Map chrome: the map-mode selector with its legend and explanation, the
// presentation options, the navigation cluster and the minimap.

import type { App } from '../app';
import { VIEW_HELP, VIEW_LABELS, viewCounts } from '../map/visibility';
import { h, rebuild, setChildren } from '../dom';
import { icon } from '../icons';
import { legendFor, MODE_MAP, MODES, realmFill } from '../map/modes';
import { tip } from './common';

export function renderModes(app: App): void {
  const el = app.modesEl;
  rebuild(el, () => {
    const bar = h('div', { class: 'mode-bar', role: 'toolbar', 'aria-label': 'Map modes' });
    MODES.forEach((m, i) => {
      const b = h('button', { class: app.mode === m.id ? 'active' : '', type: 'button', 'aria-pressed': app.mode === m.id ? 'true' : 'false', 'data-fk': `mode-${m.id}` }, icon(m.icon), h('span', { class: 'lbl' }, m.label));
      b.addEventListener('click', () => app.setMode(m.id));
      tip(b, () => h('div', null, h('b', { class: 't' }, `${m.label} map`), h('p', null, m.explain), h('p', { class: 'faint' }, `Key: Shift+${i + 1} · O cycles modes`)));
      bar.appendChild(b);
    });
    bar.appendChild(h('span', { class: 'sep' }));
    const leg = h('button', { class: app.ui.legendOpen ? 'active' : '', type: 'button', 'aria-pressed': app.ui.legendOpen ? 'true' : 'false', 'aria-label': 'Show legend', 'data-fk': 'legend' }, icon('info'));
    leg.addEventListener('click', () => {
      app.ui.legendOpen = !app.ui.legendOpen;
      // the preference is remembered on larger screens only; phones start with it folded
      if (!app.isPhone()) app.updateSettings({ showLegend: app.ui.legendOpen });
      app.refresh();
    });
    tip(leg, 'Show or hide the legend and explanation for the current map mode');
    bar.appendChild(leg);
    const pres = h('button', { class: app.ui.presentationOpen ? 'active' : '', type: 'button', 'aria-pressed': app.ui.presentationOpen ? 'true' : 'false', 'aria-label': 'Map presentation', 'data-fk': 'presentation' }, icon('layers'));
    pres.addEventListener('click', () => {
      app.ui.presentationOpen = !app.ui.presentationOpen;
      app.refresh();
    });
    tip(pres, 'Map presentation: label density, terrain detail, borders, army markers');
    bar.appendChild(pres);
    const kids: HTMLElement[] = [];
    if (app.ui.presentationOpen) kids.push(presentationPanel(app));
    else if (app.ui.legendOpen) kids.push(legend(app));
    kids.push(bar);
    setChildren(el, ...kids);
  });
}

function legend(app: App): HTMLElement {
  const m = MODE_MAP[app.mode];
  const items = legendFor(app.mode);
  const kids: (Node | null)[] = [h('div', { class: 'lg-head' }, icon(m.icon), h('b', null, `${m.label} map`)), h('p', null, m.explain)];
  if (app.mode === 'diplomacy' && app.focusNation && app.focusNation !== app.player && app.sim) {
    const def = app.sim.world.nationDefs[app.focusNation];
    const back = h('button', { class: 'btn small', type: 'button' }, `Showing ${def.short}'s relations — show mine`);
    back.addEventListener('click', () => {
      app.focusNation = null;
      app.refresh();
    });
    kids.push(back);
  }
  if (m.ramp) {
    kids.push(h('div', { class: 'ramp', style: `background:linear-gradient(90deg, ${m.ramp.stops.join(',')})` }));
    kids.push(h('div', { class: 'ramp-lbl' }, h('span', null, m.ramp.from), h('span', null, m.ramp.to)));
  }
  if (app.mode === 'political' && app.sim && app.renderer) {
    // the realms actually on screen, largest first, with the muted fill the map draws
    const sim = app.sim;
    const cam = app.renderer.camera;
    const view = cam.viewRect(0);
    const area = new Map<string, number>();
    for (const p of app.renderer.geo.provincesIn(view[0], view[1], view[2], view[3])) {
      const o = sim.state.provinces[p.id]?.owner;
      if (o) area.set(o, (area.get(o) ?? 0) + p.area);
    }
    const realms = [...area].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const shown = realms.slice(0, 8);
    kids.push(
      h(
        'div',
        { class: 'items', 'data-sk': 'legend-realms' },
        shown.map(([nid]) => h('div', { class: 'it' }, h('span', { class: 'sw', style: `background:${realmFill(sim.world.nationDefs[nid].color)}` }), h('span', null, sim.world.nationDefs[nid].short))),
      ),
    );
    if (realms.length > shown.length) kids.push(h('div', { class: 'more' }, `and ${realms.length - shown.length} more on screen; every realm is named on the map`));
  }
  if (items.length) {
    kids.push(
      h(
        'div',
        { class: `items ${app.mode === 'terrain' || app.mode === 'political' || app.mode === 'military' ? 'one' : ''}` },
        items.map((it) =>
          h(
            'div',
            { class: 'it' },
            h('span', {
              class: `sw ${it.line ? 'line' : ''}`,
              style: it.line ? `border-top-color:${it.color}` : it.hatch ? `background:repeating-linear-gradient(135deg, ${it.color} 0 2px, #eee7d7 2px 5px)` : `background:${it.color}`,
            }),
            h('span', null, it.label),
          ),
        ),
      ),
    );
  }
  if (app.mode === 'political' && app.sim) kids.push(h('p', { class: 'faint', style: 'margin-top:6px' }, 'Each realm is also named on the map and outlined in its own hue; set "Realm patterns" in Settings for hatch patterns.'));
  return h('div', { class: 'legend' }, ...kids);
}

/** What the unit view shows, and how many forces of each kind it shows and hides. */
export function unitViewNote(app: App): HTMLElement | null {
  const sim = app.sim;
  if (!sim) return null;
  const f = app.unitFilter();
  const c = viewCounts(sim, f, new Set([app.selectedArmy, app.selectedFleet, app.selectedWing].filter((x): x is string => !!x)));
  const parts = [`${c.shown.own} ours`, `${c.shown.enemy} enemy`, `${c.shown.allied} allied`, ...(c.shown.neutral ? [`${c.shown.neutral} neutral`] : [])];
  const hid = c.hidden.enemy + c.hidden.allied + c.hidden.neutral;
  return h(
    'div',
    { class: 'small', style: 'margin-top:6px', 'data-fk': 'unit-view-note' },
    h('div', { class: 'muted' }, `${VIEW_HELP[f.mode]}`),
    h('div', null, h('b', null, 'Shown: '), `${parts.join(' · ')} (armies, fleets and air wings, on screen or not).`),
    hid ? h('div', { class: 'faint' }, `Hidden by this view: ${[c.hidden.enemy ? `${c.hidden.enemy} enemy` : '', c.hidden.allied ? `${c.hidden.allied} allied` : '', c.hidden.neutral ? `${c.hidden.neutral} neutral` : ''].filter(Boolean).join(' · ')}. "All" shows every force.`) : null,
    h('div', { class: 'faint' }, f.context),
  );
}

function presentationPanel(app: App): HTMLElement {
  const s = app.settings;
  const seg = <T extends string>(label: string, value: T, options: Array<[T, string]>, set: (v: T) => void) =>
    h(
      'div',
      { class: 'field', style: 'margin-top:6px' },
      h('span', { class: 'label' }, label),
      h(
        'div',
        { class: 'segmented' },
        options.map(([v, l]) => {
          const b = h('button', { class: v === value ? 'active' : '', type: 'button', 'data-fk': `${label}-${v}` }, l);
          b.addEventListener('click', () => set(v));
          return b;
        }),
      ),
    );
  const close = h('button', { class: 'btn quiet small icon', type: 'button', 'aria-label': 'Close' }, icon('close'));
  close.addEventListener('click', () => {
    app.ui.presentationOpen = false;
    app.refresh();
  });
  return h(
    'div',
    { class: 'legend' },
    h('div', { class: 'lg-head' }, icon('layers'), h('b', null, 'Map presentation'), close),
    seg('Place names', s.labelDensity, [['few', 'Few'], ['normal', 'Normal'], ['many', 'Many']], (v) => app.updateSettings({ labelDensity: v })),
    seg('Terrain drawing', s.terrainDetail, [['full', 'Full'], ['reduced', 'Light'], ['off', 'Off']], (v) => app.updateSettings({ terrainDetail: v })),
    seg('Borders', s.borderEmphasis, [['subtle', 'Subtle'], ['normal', 'Normal'], ['strong', 'Strong']], (v) => app.updateSettings({ borderEmphasis: v })),
    seg('Forces shown', s.armyMarkers, [['all', VIEW_LABELS.all], ['relevant', VIEW_LABELS.relevant], ['mine', VIEW_LABELS.mine]], (v) => app.updateSettings({ armyMarkers: v })),
    unitViewNote(app),
    s.armyMarkers === 'relevant' ? seg('Allies in Relevant', s.relevantAllies ? 'on' : 'off', [['on', 'Shown'], ['off', 'Hidden']], (v) => app.updateSettings({ relevantAllies: v === 'on' })) : null,
    h('p', { class: 'faint', style: 'margin-top:8px' }, 'Reduced motion and UI scale are in Settings.'),
  );
}

export function renderNavCluster(app: App): void {
  const el = app.navClusterEl;
  const sim = app.sim;
  if (!sim) return;
  rebuild(el, () => {
    const btn = (ic: Parameters<typeof icon>[0], label: string, key: string, fn: () => void, disabled: string | null = null, badge = 0) => {
      const b = h('button', { class: disabled ? 'disabled' : '', type: 'button', 'aria-label': label, 'aria-disabled': disabled ? 'true' : undefined, 'data-fk': `nav-${label}` }, icon(ic), badge ? h('span', { class: 'badge' }, String(badge)) : null);
      b.addEventListener('click', () => {
        if (!disabled) fn();
      });
      tip(b, disabled ? `${label} — ${disabled}` : `${label} (${key})`);
      return b;
    };
    const battles = Object.values(sim.state.battles).filter((b) => !app.player || b.attackerNations.includes(app.player) || b.defenderNations.includes(app.player));
    const cam = app.renderer?.camera;
    const col = h(
      'div',
      { class: 'nav-btns' },
      btn('zoomIn', 'Zoom in', '+', () => cam?.zoomAt(cam.vw / 2, cam.vh / 2, 1.35)),
      btn('zoomOut', 'Zoom out', '−', () => cam?.zoomAt(cam.vw / 2, cam.vh / 2, 1 / 1.35)),
      btn('fit', 'Whole world', 'F', () => app.fitWorld()),
      btn('capital', 'Your capital', 'Home', () => app.goCapital(), app.player && sim.state.nations[app.player].alive ? null : 'no capital'),
      btn('target', 'Centre on selection', 'C', () => app.centreSelection(), app.selectedArmy || app.selectedProvince ? null : 'nothing selected'),
      btn('army', 'Next army', 'N', () => app.cycleArmy(), app.player && Object.values(sim.state.armies).some((a) => a.nation === app.player) ? null : 'no armies'),
      btn('battle', 'Next battle', 'K', () => app.nextBattle(), battles.length ? null : 'no battles involving you', battles.length),
      selectToggle(app),
    );
    setChildren(el, app.minimapEl, col);
  });
}

/** The Select tool (touch-friendly): forces → provinces → off; taps add or remove, a drag draws a box. */
function selectToggle(app: App): HTMLElement {
  const m = app.selectMode;
  const label = m === 'off' ? 'Select several' : m === 'forces' ? 'Selecting forces' : 'Selecting provinces';
  const b = h('button', { class: m === 'off' ? '' : 'active', type: 'button', 'aria-label': label, 'aria-pressed': m === 'off' ? 'false' : 'true', 'data-fk': 'nav-select' }, icon(m === 'provinces' ? 'build' : 'check'), m === 'off' ? null : h('span', { class: 'badge' }, String(m === 'forces' ? app.forceSel.length : app.provSel.length)));
  b.addEventListener('click', () => app.setSelectMode(m === 'off' ? 'forces' : m === 'forces' ? 'provinces' : 'off'));
  tip(b, `${label} (X): ${m === 'off' ? 'tap forces to select several, drag a box; press again for provinces' : m === 'forces' ? 'press again to select provinces instead' : 'press again to finish'}`);
  return b;
}

/** Minimap: political overview with the current view outlined; click to jump. */
export class Minimap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private base: HTMLCanvasElement | null = null;
  private key = '';
  private rev = '';
  private owners = '';
  private w = 200;
  private h = 130;

  constructor(private app: App) {
    this.canvas = h('canvas', { 'aria-label': 'Minimap: click to move the view' });
    this.el = h('div', { class: 'minimap' }, this.canvas);
    let dragging = false;
    const go = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      const renderer = this.app.renderer;
      if (!renderer) return;
      const b = renderer.geo.bounds;
      const x = b.minX + ((e.clientX - r.left) / r.width) * (b.maxX - b.minX);
      const y = b.minY + ((e.clientY - r.top) / r.height) * (b.maxY - b.minY);
      renderer.camera.centerOn(x, y, undefined, !dragging);
      this.app.mapChanged();
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      dragging = false;
      this.canvas.setPointerCapture(e.pointerId);
      go(e);
      dragging = true;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (dragging && e.buttons) go(e);
    });
    this.canvas.addEventListener('pointerup', () => (dragging = false));
  }

  draw(): void {
    const app = this.app;
    const sim = app.sim;
    const r = app.renderer;
    if (!sim || !r) return;
    const b = r.geo.bounds;
    const bw = b.maxX - b.minX;
    const bh = b.maxY - b.minY;
    this.w = 196;
    this.h = Math.round((196 * bh) / bw);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // repainted when an owner changes (the revision changes far more often, for treaties)
    const rev = `${sim.state.rev}|${this.w}|${dpr}`;
    if (rev !== this.rev) {
      this.rev = rev;
      this.owners = `${r.geo.provList.map((p) => sim.state.provinces[p.id]?.owner ?? '').join(',')}|${this.w}|${dpr}`;
    }
    const key = this.owners;
    if (key !== this.key || !this.base) {
      this.key = key;
      const c = this.base ?? document.createElement('canvas');
      c.width = Math.round(this.w * dpr);
      c.height = Math.round(this.h * dpr);
      const g = c.getContext('2d')!;
      const z = (this.w * dpr) / bw;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#a9c5ca';
      g.fillRect(0, 0, c.width, c.height);
      g.setTransform(z, 0, 0, z, -b.minX * z, -b.minY * z);
      for (const p of r.geo.provList) {
        const o = sim.state.provinces[p.id].owner;
        g.fillStyle = o ? realmFill(sim.world.nationDefs[o].color) : '#eee7d7';
        g.fill(p.path);
      }
      g.fillStyle = '#ddd5c1';
      for (const w of r.geo.peaks) g.fill(w.path);
      g.fillStyle = '#d3d0c3';
      for (const w of r.geo.beyond) g.fill(w.path);
      this.base = c;
    }
    const c = this.canvas;
    if (c.width !== this.base.width) {
      c.width = this.base.width;
      c.height = this.base.height;
      c.style.width = `${this.w}px`;
      c.style.height = `${this.h}px`;
    }
    const g = c.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    const cam = r.camera;
    const v = cam.viewRect(0);
    const s = c.width / bw;
    const rect: [number, number, number, number] = [(v[0] - b.minX) * s, (v[1] - b.minY) * s, (v[2] - v[0]) * s, (v[3] - v[1]) * s];
    g.strokeStyle = '#f5efe2';
    g.lineWidth = 3.5 * dpr;
    g.strokeRect(...rect);
    g.strokeStyle = '#665322';
    g.lineWidth = 1.6 * dpr;
    g.strokeRect(...rect);
  }
}
