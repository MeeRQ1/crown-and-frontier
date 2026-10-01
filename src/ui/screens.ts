// Full-screen views: the main menu over a living atlas, campaign setup with a
// live preview of the chosen start, saves, settings, the rules, the in-game
// menu and the end of a campaign.

import { DIFFICULTY } from '../sim/ai/common';
import { PERSONALITIES } from '../sim/data/personalities';
import { TECHS } from '../sim/data/techs';
import { computeLedger, grossIncome, reserveCap, totalDev } from '../sim/economy';
import { SCHEMA_VERSION } from '../sim/config';
import { dateOf, nationName, ownedProvinces, type Sim } from '../sim/state';
import type { Difficulty, NationId } from '../sim/types';
import { VICTORY_LABELS } from '../sim/victory';
import { DEFAULT_SCENARIO, getWorld, isBuiltinMap, mapScenarioPart, scenarioIds } from '../sim/world';
import { builtinScenario, type BuiltinMapId } from '../maps/builtin';
import type { App } from './app';
import { AtlasView, startOf } from './atlas-view';
import { button, h, setChildren, type Child } from './dom';
import { fmt } from './format';
import { shieldSvg } from './heraldry';
import { icon, type IconName } from './icons';
import { loadGeometry } from './map/maps';
import { MapRenderer } from './map/renderer';
import { confirmDialog, dialog } from './panels/dialogs';
import { DEFAULT_SETTINGS, type UISettings } from './settings';
import { downloadText, pickFile } from './storage';

/** Cleanup hooks for screens that own animation or observers. */
export const screenCleanup = new WeakMap<HTMLElement, () => void>();

const LEDE = 'A young crown on a divided continent. Every province beyond your heartland is raw frontier: little tax, few recruits, restless people, until you bind it to the crown. Settle, trade or conquer, and hold what you take.';

const MAP_KIND: Record<string, string> = { aldmere: 'Standard campaign', reach: 'Quick campaign' };

/** Title, kind and campaign lengths (with their calendar years) from the map's own rules. */
function mapInfo(id: string): { title: string; kind: string; startYear: number; lengths: Array<[number, string]>; defaultYears: number } {
  const part = isBuiltinMap(id) ? builtinScenario(id as BuiltinMapId) : mapScenarioPart(id);
  const rules = part?.rules ?? { startYear: 1880, campaignYears: { options: [40], default: 40 } };
  const opts = [...rules.campaignYears.options].sort((a, b) => a - b);
  const names = opts.length === 3 ? ['Short', 'Standard', 'Long'] : opts.length === 2 ? ['Standard', 'Long'] : [''];
  return {
    title: part?.meta.name ?? id,
    kind: MAP_KIND[id] ?? 'Custom campaign',
    startYear: rules.startYear,
    lengths: opts.map((y, i) => [y, `${names[i] ? `${names[i]} · ` : ''}${y} years (${rules.startYear}–${rules.startYear + y})`]),
    defaultYears: rules.campaignYears.default,
  };
}

function backBtn(app: App, label = 'Back'): HTMLElement {
  return button(label, () => (app.sim ? app.hideScreen() : app.showMenu()), { cls: 'quiet', icon: 'chevronLeft' });
}

// ───────────────────────────── Main menu ────────────────────────────────────

export function renderMenu(app: App): HTMLElement {
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const view = new AtlasView(canvas);
  view.drift = true;
  view.reducedMotion = app.settings.reducedMotion;
  // under the veil, light terrain drawing looks the same and paints faster
  view.presentation = { ...view.presentation, terrain: 'reduced' };
  const list = h('nav', { class: 'menu-list', 'aria-label': 'Main menu' });
  const item = (ic: IconName, title: string, sub: string, onClick: () => void, primary = false) => {
    const b = h('button', { class: `menu-item ${primary ? 'primary' : ''}`, type: 'button' }, icon(ic), h('span', null, h('div', { class: 'mi-t' }, title), h('div', { class: 'mi-s' }, sub)));
    b.addEventListener('click', onClick);
    return b;
  };
  const el = h(
    'div',
    { class: 'screen', role: 'main' },
    h('div', { class: 'backdrop' }, canvas),
    h('div', { class: 'veil' }),
    h(
      'div',
      { class: 'screen-scroll' },
      h(
        'div',
        { class: 'menu-wrap' },
        h('h1', { class: 'wordmark' }, 'Crown ', h('span', { class: 'amp' }, '&'), ' Frontier'),
        h('p', { class: 'lede' }, LEDE),
        list,
        h(
          'div',
          { class: 'menu-foot' },
          app.store.problem ? h('p', { class: 'callout warn', style: 'margin-bottom:10px' }, icon('alert'), app.store.problem) : null,
          h('p', null, 'An original game: every realm, place and event is fictional. It runs entirely in your browser, with no account and no server.'),
        ),
      ),
    ),
    h('div', { class: 'atlas-caption', 'aria-hidden': 'true' }, 'Aldmere, 1880'),
  );
  screenCleanup.set(el, () => view.destroy());
  // the menu is usable at once; the atlas behind it is prepared a moment later
  const newItem = item('flag', 'New campaign', 'Aldmere, or the quick Reach', () => app.showScreen(renderNewGame(app)), true);
  setChildren(
    list,
    newItem,
    item('upload', 'Load or import', 'Saves in this browser, or a save file', () => app.showScreen(renderLoad(app))),
    item('settings', 'Settings', 'Display, map, sound, pausing and saving', () => app.showScreen(renderSettingsScreen(app))),
    item('help', 'How to play', 'Rules, the map, controls and victory', () => app.showScreen(renderHowTo(app))),
  );
  requestAnimationFrame(() => newItem.focus({ preventScroll: true }));
  setTimeout(() => void view.show(DEFAULT_SCENARIO), 120);
  void (async () => {
    const latest = await app.store.latest().catch(() => null);
    if (!latest?.meta || !el.isConnected) return;
    const m = latest.meta;
    const cont = item('play', 'Continue', `${m.nationName} · ${mapInfo(m.scenario).title} · ${m.date}`, () => void app.load(latest.key), true);
    newItem.classList.remove('primary');
    list.prepend(cont);
    cont.focus({ preventScroll: true });
  })();
  return el;
}

// ───────────────────────────── Campaign setup ───────────────────────────────

interface StartFacts {
  provinces: number;
  dev: number;
  income: number;
  reserve: number;
  neighbours: NationId[];
  frontier: number;
  passes: string[];
  rivers: number;
  claims: number;
  claimed: number;
}

function startFacts(sim: Sim, nid: NationId): StartFacts {
  const st = sim.state;
  const mine = ownedProvinces(sim, nid);
  const set = new Set(mine);
  const neighbours = new Set<NationId>();
  const frontier = new Set<string>();
  let rivers = 0;
  for (const p of mine) {
    for (const n of sim.world.prov[p].neighbors) {
      if (set.has(n)) continue;
      const o = st.provinces[n].owner;
      if (o) neighbours.add(o);
      else frontier.add(n);
      if (sim.world.riverSet.has(p < n ? `${p}|${n}` : `${n}|${p}`)) rivers++;
    }
  }
  const passes = mine.filter((p) => sim.world.prov[p].terrain === 'mountains' && st.provinces[p].fort >= 2).map((p) => sim.world.prov[p].name);
  const claims = sim.world.provIds.filter((p) => st.provinces[p].claims.includes(nid)).length;
  const claimed = mine.filter((p) => st.provinces[p].claims.length > 0).length;
  return {
    provinces: mine.length,
    dev: totalDev(sim, nid),
    income: grossIncome(computeLedger(sim, nid)),
    reserve: reserveCap(sim, nid),
    neighbours: [...neighbours].sort((a, b) => sim.world.nationDefs[a].short.localeCompare(sim.world.nationDefs[b].short)),
    frontier: frontier.size,
    passes,
    rivers,
    claims,
    claimed,
  };
}

function segmented<T extends string | number>(label: string, options: Array<[T, string]>, value: T, onChange: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const draw = (v: T) =>
    setChildren(
      wrap,
      options.map(([val, text]) => {
        const b = h('button', { type: 'button', class: val === v ? 'active' : '', role: 'radio', 'aria-checked': val === v ? 'true' : 'false' }, text);
        b.addEventListener('click', () => {
          draw(val);
          onChange(val);
        });
        return b;
      }),
    );
  draw(value);
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), wrap);
}

export function renderNewGame(app: App, initialMap: string = DEFAULT_SCENARIO): HTMLElement {
  let map = scenarioIds().includes(initialMap) ? initialMap : DEFAULT_SCENARIO;
  const firstRealm = (id: string) => {
    const w = getWorld(id);
    return (w.scenario.nations.find((n) => n.rating === 'recommended') ?? w.scenario.nations[0]).id;
  };
  let nation: NationId = firstRealm(map);
  let difficulty: Difficulty = 'normal';
  let years = mapInfo(map).defaultYears;
  let aiBonus = 0;
  let tutorial = app.settings.tutorial;
  let seed = Math.floor(Math.random() * 1e6);

  const canvas = h('canvas', { 'aria-label': 'Preview of the starting position' });
  const view = new AtlasView(canvas);
  view.reducedMotion = app.settings.reducedMotion;
  view.presentation = { labels: 'normal', terrain: 'full', borders: 'normal', armies: 'mine', patterns: app.settings.patterns };
  const caption = h('div', { class: 'caption' });
  const mapsEl = h('div', { class: 'map-choice', role: 'radiogroup', 'aria-label': 'Map' });
  const realmsEl = h('div', { class: 'realm-list', role: 'radiogroup', 'aria-label': 'Realm' });
  const sheet = h('div', { class: 'realm-sheet' });
  const settingsEl = h('div', { class: 'setup-settings' });

  const begin = () => {
    app.updateSettings({ tutorial });
    app.newGame({ scenario: map, seed, playerNation: nation, difficulty, campaignYears: years, aiIncomeBonus: aiBonus }, tutorial);
  };
  const observe = () => app.newGame({ scenario: map, seed, playerNation: null, difficulty, campaignYears: years }, false);

  const drawMaps = () => {
    setChildren(
      mapsEl,
      scenarioIds().map((id) => {
        const w = getWorld(id);
        const info = mapInfo(id);
        const c = h('canvas', { 'aria-hidden': 'true' });
        const card = h(
          'button',
          { class: `map-card ${id === map ? 'selected' : ''}`, type: 'button', role: 'radio', 'aria-checked': id === map ? 'true' : 'false', 'data-map': id },
          c,
          h('span', { class: 'mc-t' }, info.title),
          h('span', { class: 'mc-s' }, `${info.kind} · from ${info.startYear} · ${w.provIds.length} provinces · ${w.nationIds.length} realms`),
        );
        card.addEventListener('click', () => {
          if (id === map) return;
          map = id;
          nation = firstRealm(id);
          years = mapInfo(id).defaultYears;
          drawAll(true);
        });
        void loadGeometry(id).then((g) => {
          requestAnimationFrame(() => {
            const sim = startOf(id);
            MapRenderer.renderPreview(c, g, (p) => sim.world.prov[p]?.terrain ?? 'plains', (p) => sim.state.provinces[p]?.owner ?? null, (n) => sim.world.nationDefs[n].color);
          });
        });
        return card;
      }),
    );
  };

  const drawRealms = () => {
    const w = getWorld(map);
    const sim = startOf(map);
    setChildren(
      realmsEl,
      w.scenario.nations.map((d) => {
        const n = ownedProvinces(sim, d.id).length;
        const b = h(
          'button',
          { class: `realm-item ${d.id === nation ? 'selected' : ''}`, type: 'button', role: 'radio', 'aria-checked': d.id === nation ? 'true' : 'false', 'data-realm': d.id },
          shieldSvg(d, 'lg'),
          h('span', null, h('div', { class: 'ri-n' }, d.name), h('div', { class: 'ri-s' }, `${d.startType ?? ''} · ${n} provinces`)),
          d.rating === 'recommended' ? h('span', { class: 'tag good ri-t' }, 'First campaign') : d.rating === 'challenging' ? h('span', { class: 'tag warn ri-t' }, 'Challenging') : null,
        );
        b.addEventListener('click', () => {
          nation = d.id;
          drawRealms();
          drawSheet();
          view.focusRealm(nation);
        });
        return b;
      }),
    );
  };

  const drawSheet = () => {
    const w = getWorld(map);
    const sim = startOf(map);
    const d = w.nationDefs[nation];
    const f = startFacts(sim, nation);
    const nb = f.neighbours.map((o) => h('span', { class: 'nb' }, shieldSvg(w.nationDefs[o]), w.nationDefs[o].short));
    const fact = (ic: IconName, label: string, value: Child) => h('div', { class: 'fact' }, icon(ic), h('span', { class: 'k' }, label), h('span', { class: 'v' }, value));
    setChildren(
      sheet,
      h('div', { class: 'rs-head' }, shieldSvg(d, 'xl'), h('div', null, h('h2', null, d.name), h('div', { class: 'small muted' }, `${d.startType ?? ''} · ${PERSONALITIES[d.personality].label} temperament when played by the AI`))),
      h('p', { class: 'serif rs-summary' }, d.summary),
      h('div', { class: 'trait plus' }, icon('plus'), h('span', null, d.strength)),
      h('div', { class: 'trait minus' }, icon('minus'), h('span', null, d.constraint)),
      h(
        'div',
        { class: 'stat-grid', style: 'margin-top:10px' },
        h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, 'Provinces'), h('div', { class: 'big' }, String(f.provinces))),
        h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, 'Development'), h('div', { class: 'big' }, String(f.dev))),
        h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, 'Crowns / month'), h('div', { class: 'big' }, fmt(f.income))),
        h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, 'Reserve'), h('div', { class: 'big' }, fmt(f.reserve))),
      ),
      h(
        'section',
        { class: 'section', style: 'margin-top:14px' },
        h('div', { class: 'eyebrow' }, 'Starting position'),
        fact('relations', `Borders ${f.neighbours.length} realm${f.neighbours.length === 1 ? '' : 's'}`, h('span', { class: 'nbs' }, nb)),
        fact('settle', 'Unclaimed land on the border', f.frontier ? `${f.frontier} province${f.frontier === 1 ? '' : 's'}` : 'none'),
        fact('fort', 'Mountain passes held', f.passes.length ? f.passes.join(', ') : 'none'),
        f.rivers ? fact('supply', 'River borders', `${f.rivers} (defenders +20% against crossings)`) : null,
        fact('claim', 'Claims on others', f.claims ? `${f.claims} province${f.claims === 1 ? '' : 's'}` : 'none'),
        fact('alert', 'Own land claimed by others', f.claimed ? `${f.claimed} province${f.claimed === 1 ? '' : 's'}` : 'none'),
      ),
    );
    caption.replaceChildren(h('div', { class: 'cap-t' }, `${mapInfo(map).title} · ${d.short}`), h('div', { class: 'cap-s' }, w.scenario.blurb ?? w.scenario.description));
    beginLabel.replaceChildren(shieldSvg(d), h('span', null, d.short, h('small', null, mapInfo(map).title)));
  };

  const drawSettings = () => {
    const info = mapInfo(map);
    if (!info.lengths.some(([y]) => y === years)) years = info.defaultYears;
    const seedIn = h('input', { type: 'number', value: String(seed), min: 0, 'aria-label': 'Seed', style: 'width:9em' });
    seedIn.addEventListener('change', () => (seed = Math.max(0, Math.floor(Number(seedIn.value) || 0))));
    const dice = button('', () => {
      seed = Math.floor(Math.random() * 1e6);
      seedIn.value = String(seed);
    }, { cls: 'icon quiet', icon: 'dice', title: 'New random seed' });
    dice.setAttribute('aria-label', 'New random seed');
    const tut = h('input', { type: 'checkbox', id: 'setup-tut', checked: tutorial ? true : undefined });
    tut.addEventListener('change', () => (tutorial = tut.checked));
    const assist = h('select', { id: 'setup-assist' }, [
      h('option', { value: '0', selected: aiBonus === 0 ? true : undefined }, 'None'),
      h('option', { value: '0.15', selected: aiBonus === 0.15 ? true : undefined }, '+15% AI income (disclosed)'),
    ]);
    assist.addEventListener('change', () => (aiBonus = Number(assist.value)));
    const diffHelp = h('p', { class: 'hint small muted' }, DIFFICULTY[difficulty].label);
    setChildren(
      settingsEl,
      h('div', { class: 'eyebrow' }, 'Campaign'),
      segmented<Difficulty>('AI skill', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], difficulty, (v) => {
        difficulty = v;
        diffHelp.textContent = DIFFICULTY[v].label;
      }),
      diffHelp,
      segmented<number>('Length', info.lengths, years, (v) => (years = v)),
      h('div', { class: 'field' }, h('label', { for: 'setup-assist' }, 'AI economic assistance'), assist),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Seed'), h('div', { class: 'row' }, seedIn, dice)),
      h('label', { class: 'switch', for: 'setup-tut' }, tut, h('span', null, 'Guided first steps (tutorial)')),
      h('p', { class: 'small muted' }, 'AI skill changes how well rival realms decide, never their dice: no hidden bonuses. Income assistance, if chosen, is shown in the Help ledger.'),
    );
  };

  const drawAll = (mapChanged = false) => {
    drawMaps();
    drawRealms();
    drawSheet();
    drawSettings();
    if (mapChanged) {
      view.onReady = () => view.focusRealm(nation, false);
      void view.show(map);
    }
  };

  const beginBtn = button('Begin campaign', begin, { cls: 'primary large', icon: 'play', fk: 'begin' });
  const beginBtn2 = button('Begin campaign', begin, { cls: 'primary large', icon: 'play', fk: 'begin-bottom' });
  const beginLabel = h('span', { class: 'sb-realm' });
  const watchBtn = button('Watch AI only', observe, { cls: 'quiet', icon: 'eye', title: 'Every realm is played by the AI: useful to learn, and to test.' });
  const el = h(
    'div',
    { class: 'setup', role: 'main' },
    h('header', null, backBtn(app), h('h2', null, 'New campaign'), watchBtn, beginBtn),
    h('div', { class: 'col left' }, h('div', { class: 'eyebrow' }, 'Map'), mapsEl, h('div', { class: 'eyebrow', style: 'margin-top:18px' }, 'Realm'), realmsEl),
    h('div', { class: 'preview' }, canvas, caption),
    h('div', { class: 'col right' }, sheet, settingsEl),
    // phones: a sticky bar keeps Begin (and the chosen realm) in reach while scrolling
    h('div', { class: 'setup-begin' }, beginLabel, beginBtn2),
  );
  screenCleanup.set(el, () => view.destroy());
  drawAll(true);
  return el;
}

// ───────────────────────────── Load ─────────────────────────────────────────

export function renderLoad(app: App): HTMLElement {
  const list = h('div', { class: 'save-list' }, h('p', { class: 'muted' }, 'Reading saves…'));
  const refresh = async () => {
    const slots = await app.store.list().catch(() => []);
    setChildren(
      list,
      slots.length
        ? slots.map((s) => {
            const m = s.meta;
            const registered = !!m && scenarioIds().includes(m.scenario);
            // a save of a custom map carries the map itself
            const known = registered || !!m?.customMap;
            const def = registered && m.nation ? getWorld(m.scenario).nationDefs[m.nation] : null;
            const why = !m ? 'This save cannot be read.' : !known ? `This save uses a map ("${m.scenario}") that this version does not include.` : null;
            return h(
              'div',
              { class: 'save-card' },
              def ? shieldSvg(def, 'lg') : h('span', { class: 'shield lg' }),
              h(
                'div',
                { class: 'grow' },
                h('div', { class: 'sv-t' }, m ? m.nationName : s.key),
                h('div', { class: 'sv-s' }, m ? `${m.mapName ?? (isBuiltinMap(m.scenario) ? mapInfo(m.scenario).title : m.scenario)} · ${m.date} · saved ${new Date(m.savedAt).toLocaleString()}` : 'Unreadable save'),
                h('div', { class: 'sv-k' }, s.key.startsWith('autosave') ? 'Autosave' : s.key.replace('slot-', 'Slot ')),
                why ? h('div', { class: 'small bad' }, why) : null,
                !why && s.schema !== null && s.schema < SCHEMA_VERSION
                  ? h('div', { class: 'small muted' }, `Made by an earlier version (save format ${s.schema}). It is converted to the current rules when loaded, and you are told what changed; export it first to keep the original.`)
                  : null,
              ),
              button('Load', () => void app.load(s.key), { cls: 'primary', disabled: why }),
              button('', () => void app.store.get(s.key).then((text) => text && downloadText(`crown-frontier-${s.key}.json`, text)), { cls: 'icon quiet', icon: 'download', title: 'Export this save to a file' }),
              button('', () => confirmDialog(app, 'Delete this save?', `${m ? `${m.nationName}, ${m.date}` : s.key} will be removed from this browser. This cannot be undone.`, () => void app.store.remove(s.key).then(refresh), 'Delete'), { cls: 'icon quiet', icon: 'close', title: 'Delete this save' }),
            );
          })
        : h('div', { class: 'callout info' }, icon('info'), 'No saves in this browser yet. Campaigns autosave every few months, and when the tab is hidden.'),
    );
  };
  void refresh();
  const imp = button('Import a save file', async () => {
    const text = await pickFile('.json,application/json');
    if (text === '__too_big__') return dialog(app, 'File too large', [h('p', null, 'That file is too large to be a save.')]);
    if (text) app.loadText(text);
  }, { icon: 'upload' });
  return h(
    'div',
    { class: 'screen', role: 'main' },
    h(
      'div',
      { class: 'screen-scroll' },
      h(
        'div',
        { class: 'page' },
        h('header', null, backBtn(app), h('h2', null, 'Load a campaign'), imp),
        list,
        h('p', { class: 'small muted', style: 'margin-top:16px' }, `Saves are stored in this browser (${app.store.mode}). They do not follow you to other devices or sites and may be cleared by private browsing or managed-device policies: export important campaigns to a file. Saves keep the map they were started on; campaigns begun on the Reach before Aldmere existed still load on the Reach.`),
      ),
    ),
  );
}

// ───────────────────────────── Settings ─────────────────────────────────────

function settingsBody(app: App, redraw: () => void): HTMLElement {
  const s = app.settings;
  const set = (patch: Partial<UISettings>) => {
    app.updateSettings(patch);
    redraw();
  };
  const toggle = (key: keyof UISettings, label: string, help?: string) => {
    const id = `set-${String(key)}`;
    const cb = h('input', { type: 'checkbox', id, checked: s[key] ? true : undefined });
    cb.addEventListener('change', () => set({ [key]: cb.checked } as Partial<UISettings>));
    return [h('label', { for: id }, label), cb, help ? h('div', { class: 'hint' }, help) : null];
  };
  const seg = <T extends string | number>(label: string, key: keyof UISettings, options: Array<[T, string]>, help?: string) => {
    const wrap = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
    for (const [v, t] of options) {
      const b = h('button', { type: 'button', class: s[key] === v ? 'active' : '', role: 'radio', 'aria-checked': s[key] === v ? 'true' : 'false' }, t);
      b.addEventListener('click', () => set({ [key]: v } as Partial<UISettings>));
      wrap.appendChild(b);
    }
    return [h('span', null, label), wrap, help ? h('div', { class: 'hint' }, help) : null];
  };
  const slider = (key: 'volume' | 'uiScale', label: string, min: number, max: number, stepv: number, show: (v: number) => string) => {
    const id = `set-${key}`;
    const out = h('span', { class: 'small muted', style: 'min-width:3.2em;text-align:right' }, show(s[key]));
    const r = h('input', { type: 'range', min, max, step: stepv, value: String(s[key]), id });
    r.addEventListener('input', () => (out.textContent = show(Number(r.value))));
    r.addEventListener('change', () => app.updateSettings({ [key]: Number(r.value) } as Partial<UISettings>));
    return [h('label', { for: id }, label), h('div', { class: 'row' }, r, out)];
  };
  const auto = h('select', { id: 'set-auto' }, [0, 3, 6, 12].map((m) => h('option', { value: String(m), selected: s.autosaveMonths === m ? true : undefined }, m ? `Every ${m} months` : 'Off')));
  auto.addEventListener('change', () => app.updateSettings({ autosaveMonths: Number(auto.value) }));
  const group = (title: string, ...rows: Child[]) => h('section', { class: 'section settings-section' }, h('div', { class: 'eyebrow' }, title), h('div', { class: 'settings-grid' }, ...rows));
  return h(
    'div',
    null,
    group(
      'Display',
      ...slider('uiScale', 'Interface scale', 0.85, 1.3, 0.05, (v) => `${Math.round(v * 100)}%`),
      ...toggle('reducedMotion', 'Reduced motion', 'No drifting backdrop, camera flights, pulsing markers or sliding notices.'),
      ...toggle('patterns', 'Realm patterns', 'Hatch each realm, so ownership never depends on colour alone.'),
    ),
    group(
      'Map',
      ...seg('Place names', 'labelDensity', [['few', 'Few'], ['normal', 'Normal'], ['many', 'Many']]),
      ...seg('Terrain drawing', 'terrainDetail', [['full', 'Full'], ['reduced', 'Light'], ['off', 'Off']], 'Lighter drawing is faster on older machines.'),
      ...seg('Borders', 'borderEmphasis', [['subtle', 'Subtle'], ['normal', 'Normal'], ['strong', 'Strong']]),
      ...seg('Armies shown', 'armyMarkers', [['all', 'All'], ['relevant', 'Relevant'], ['mine', 'Mine + enemies']], '"Relevant" hides neutral armies at a distance.'),
      ...toggle('showLegend', 'Show the map legend', 'The legend explains the current map mode; phones start with it folded.'),
    ),
    group('Sound', ...slider('volume', 'Volume', 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`), ...toggle('sound', 'Sound effects')),
    group(
      'Pausing',
      ...toggle('autoPauseWar', 'When war is declared on us'),
      ...toggle('autoPauseEvent', 'For events that need a decision'),
      ...toggle('autoPauseProposal', 'For proposals and calls to arms'),
      ...toggle('autoPauseBattle', 'When our armies start a battle'),
    ),
    group('Saving', h('label', { for: 'set-auto' }, 'Autosave'), auto, h('div', { class: 'hint' }, 'Also when the tab is hidden or closed.')),
    h('div', { style: 'margin-top:18px' }, button('Restore defaults', () => set({ ...DEFAULT_SETTINGS }), { cls: 'quiet' })),
  );
}

export function renderSettingsScreen(app: App): HTMLElement {
  const holder = h('div');
  const draw = () => setChildren(holder, settingsBody(app, draw));
  draw();
  return h('div', { class: 'screen', role: 'main' }, h('div', { class: 'screen-scroll' }, h('div', { class: 'page narrow' }, h('header', null, backBtn(app), h('h2', null, 'Settings')), holder)));
}

// ───────────────────────────── How to play ──────────────────────────────────

export function renderHowTo(app: App): HTMLElement {
  const sec = (title: string, ...body: Child[]) => h('section', { class: 'section howto' }, h('div', { class: 'eyebrow' }, title), ...body);
  const keys = (list: Array<[string, string]>) => h('dl', { class: 'keys' }, list.map(([k, v]) => [h('dt', null, ...k.split(' ').map((x) => h('kbd', null, x))), h('dd', null, v)]));
  return h(
    'div',
    { class: 'screen', role: 'main' },
    h(
      'div',
      { class: 'screen-scroll' },
      h(
        'div',
        { class: 'page' },
        h('header', null, backBtn(app), h('h2', null, 'How to play')),
        h('p', { class: 'serif', style: 'font-size:var(--fs-lg);color:var(--paper-300)' }, LEDE),
        sec(
          'The two maps',
          h('p', null, h('b', null, 'Aldmere'), ' is the standard campaign: fourteen realms and about three hundred provinces, with mountain passes, rivers, islands and wide unclaimed frontiers. Every realm has several fronts and marches take months. ', h('b', null, 'The Reach'), ' is the quick campaign: nine realms and 99 provinces, where wars are decided in a few seasons.'),
        ),
        sec(
          'The land',
          h('ul', null,
            h('li', null, h('b', null, 'Mountain ranges'), ' cannot be crossed except through their passes, which are mountain provinces, usually fortified.'),
            h('li', null, h('b', null, 'Rivers'), ' run along province borders. An army that attacks across a river fights at a disadvantage: the defenders gain +20%.'),
            h('li', null, h('b', null, 'Straits'), ' (dashed lines over the sea) link islands and coasts. Crossing one costs 2 extra movement points; Hrafnmark’s longships cross free.'),
            h('li', null, h('b', null, 'Terrain'), ' sets movement cost, the defender’s bonus, how many regiments can fight at once, and how many troops the land can feed. The Terrain map mode shows it.'),
            h('li', null, h('b', null, 'Frontier'), ': newly gained land starts poorly integrated. Develop, build roads and grant charters to bind it to the crown.'),
          ),
        ),
        sec(
          'Winning',
          h('p', null, `${VICTORY_LABELS.territorial}: hold most of several regions and a large share of the map. ${VICTORY_LABELS.economic}: out-develop the world with integrated, stable land. ${VICTORY_LABELS.diplomatic}: stand at the centre of long-standing alliances and trade. Each must be held for years while rivals respond; otherwise the best campaign score wins when time runs out. The Victory ledger (V) shows exact thresholds for the map you are playing.`),
          h('p', null, 'You lose if your realm is destroyed or another realm wins first. Losing your capital is not fatal: the court moves, at a cost.'),
        ),
        sec(
          'Controls',
          keys([
            ['Click', 'Select a province or army'],
            ['Right-click', 'Move the selected army (touch: long-press, or “March here” in the province card)'],
            ['Shift Right-click', 'Add a waypoint after the current route'],
            ['Space', 'Pause or resume'],
            ['1 2 3 4', 'Game speed'],
            ['B M T P D W V L H', 'Realm, Military, Research, Policy, Diplomacy, Wars, Victory, Chronicle, Help'],
            ['Shift+1…7 O', 'Map modes; O cycles through them'],
            ['F C Home', 'Whole map, centre on selection, capital'],
            ['N K J', 'Next army, next battle, jump to the latest alert'],
            ['Esc', 'Cancel, close, or open the menu'],
          ]),
        ),
      ),
    ),
  );
}

// ───────────────────────────── In-game menu ─────────────────────────────────

export function openMenuDialog(app: App): void {
  const sim = app.sim;
  if (!sim) return;
  app.setSpeed(0);
  let close = () => {};
  const st = sim.state.settings;
  const slot = (key: string, label: string) =>
    button(label, async () => {
      await app.save(key);
      close();
    }, { icon: 'save' });
  const body = [
    h('p', { class: 'small muted' }, `${st.playerNation ? sim.world.nationDefs[st.playerNation].name : 'Observer'} · ${mapInfo(sim.state.scenarioId).title} · ${dateOf(sim).label} · seed ${st.seed} · ${DIFFICULTY[st.difficulty].label}${st.aiIncomeBonus ? ` · AI income +${Math.round(st.aiIncomeBonus * 100)}%` : ''}`),
    h('div', { class: 'eyebrow', style: 'margin-top:10px' }, 'Save'),
    h('div', { class: 'actions' }, slot('slot-1', 'Slot 1'), slot('slot-2', 'Slot 2'), slot('slot-3', 'Slot 3')),
    h('div', { class: 'eyebrow', style: 'margin-top:14px' }, 'Files and options'),
    h(
      'div',
      { class: 'actions' },
      button('Load', () => {
        close();
        app.showScreen(renderLoad(app));
      }, { icon: 'upload' }),
      button('Export to file', () => app.exportSave(), { icon: 'download' }),
      button('Import file', async () => {
        const text = await pickFile('.json,application/json');
        if (text && text !== '__too_big__') {
          close();
          app.loadText(text);
        }
      }, { icon: 'upload' }),
      button('Settings', () => {
        close();
        app.showScreen(renderSettingsScreen(app));
      }, { icon: 'settings' }),
      button('How to play', () => {
        close();
        app.showScreen(renderHowTo(app));
      }, { icon: 'help' }),
    ),
    h('p', { class: 'small muted', style: 'margin-top:12px' }, `Saves are stored in this browser (${app.store.mode}); export to keep a copy elsewhere. Game version ${__APP_VERSION__}, save format ${SCHEMA_VERSION}.`),
  ];
  const resume = button('Resume', () => close(), { cls: 'primary' });
  const quit = button('Save and quit to menu', () => {
    close();
    app.quitToMenu();
  });
  close = dialog(app, 'Menu', body, [quit, resume]);
}

// ───────────────────────────── End of campaign ──────────────────────────────

export function renderEndScreen(app: App): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const r = st.result!;
  const pid = app.player;
  const title = r.playerOutcome === 'victory' ? 'Victory' : r.playerOutcome === 'defeat' ? 'Defeat' : r.playerOutcome === 'survived' ? 'The campaign is over' : 'Campaign complete';
  const scores = Object.entries(r.scores).sort((a, b) => b[1] - a[1]);
  const n = pid ? st.nations[pid] : null;
  const tile = (label: string, value: string, sub?: string) => h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, label), h('div', { class: 'big' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
  return h(
    'div',
    { class: 'screen', role: 'main' },
    h(
      'div',
      { class: 'screen-scroll' },
      h(
        'div',
        { class: 'page' },
        h('header', null, h('h2', null, title)),
        h('p', { class: 'serif', style: 'font-size:var(--fs-lg);color:var(--paper-300)' }, r.reason, ` (${dateOf(sim, r.tick).label}, ${mapInfo(st.scenarioId).title})`),
        n
          ? h(
              'section',
              { class: 'section' },
              h('div', { class: 'eyebrow' }, 'Your reign'),
              h(
                'div',
                { class: 'stat-grid' },
                tile('Provinces', String(ownedProvinces(sim, pid!).length), `peak ${n.stats.peakProvinces}`),
                tile('Battles', `${n.stats.battlesWon} won`, `${n.stats.battlesLost} lost · ${fmt(n.stats.menLost)} men lost`),
                tile('Wars', `${n.stats.warsDeclared} declared`, `${n.stats.peacesMade} peaces made`),
                tile('Technologies', `${n.research.done.length} / ${Object.keys(TECHS).length}`, `${n.stats.bankruptcies} bankruptcies`),
              ),
            )
          : null,
        h(
          'section',
          { class: 'section' },
          h('div', { class: 'eyebrow' }, 'Final standings'),
          h(
            'table',
            { class: 'data' },
            h('thead', null, h('tr', null, h('th', null, '#'), h('th', null, 'Realm'), h('th', { class: 'num' }, 'Provinces'), h('th', { class: 'num' }, 'Score'))),
            h(
              'tbody',
              null,
              scores.map(([nid, s], i) =>
                h(
                  'tr',
                  { class: nid === pid ? 'me' : '' },
                  h('td', null, String(i + 1)),
                  h('td', null, h('span', { class: 'row' }, shieldSvg(sim.world.nationDefs[nid]), `${nationName(sim, nid)}${st.nations[nid].alive ? '' : ' (destroyed)'}${nid === pid ? ' (you)' : ''}`)),
                  h('td', { class: 'num' }, String(ownedProvinces(sim, nid).length)),
                  h('td', { class: 'num' }, fmt(s, 1)),
                ),
              ),
            ),
          ),
        ),
        h(
          'div',
          { class: 'row', style: 'margin-top:18px;flex-wrap:wrap' },
          button('Main menu', () => app.quitToMenu(), { cls: 'primary' }),
          button('Keep playing', () => app.continueAfterEnd(), { title: 'Play on without further victory checks. The recorded result stands.' }),
          button('Export save', () => app.exportSave(), { icon: 'download' }),
        ),
      ),
    ),
  );
}

