// The in-browser map editor. A map is a map package (src/maps/format.ts): the
// editor creates one with the procedural generator or opens an existing one,
// edits it through the operations in src/maps/edit.ts, checks it with the
// same validator as an imported file (findings point at the province, realm
// or sea zone to fix), and saves it to the map library, exports it as a file,
// or opens it for play. Unfinished work is kept as a draft in this browser.

import { C, TERRAIN } from '../../sim/config';
import type { Personality, Resource, Terrain } from '../../sim/types';
import { PERSONALITIES } from '../../sim/data/personalities';
import * as E from '../../maps/edit';
import type { MapPackage } from '../../maps/format';
import { buildProceduralMap, CLIMATES, DEFAULT_PARAMS, MAP_SHAPES, SHAPE_LABELS, type Climate, type MapShape, type ProceduralParams } from '../../maps/gen/procedural';
import { parseMapPackage, validateMapPackage, type MapCheck, type MapIssue } from '../../maps/validate';
import { RESOURCES, TERRAINS } from '../../maps/vocab';
import type { App } from '../app';
import { button, h, setChildren, type Child } from '../dom';
import { icon, type IconName } from '../icons';
import { issueList, renderMapLibrary } from '../library';
import { mapIdFrom } from '../maplib';
import { confirmDialog, dialog } from '../panels/dialogs';
import { renderNewGame, screenCleanup } from '../screens';
import { downloadText, pickFile } from '../storage';
import { DEPOSIT_COLORS, EditorView, hashColor, type EditorLayer } from './view';

type Tool = 'select' | 'owner' | 'region' | 'terrain' | 'deposit' | 'route' | 'port' | 'merge' | 'capital';
type Tab = 'tool' | 'map' | 'realms' | 'regions' | 'check';

const TOOLS: Array<{ id: Tool; label: string; icon: IconName; layer?: EditorLayer; help: string }> = [
  { id: 'select', label: 'Select', icon: 'target', help: 'Click a province or sea zone to edit it. Drag to move the map.' },
  { id: 'owner', label: 'Realms', icon: 'flag', layer: 'realms', help: 'Click or drag across provinces to give them to the chosen realm.' },
  { id: 'region', label: 'Regions', icon: 'political', layer: 'regions', help: 'Click or drag across provinces to put them in the chosen region.' },
  { id: 'terrain', label: 'Terrain', icon: 'terrain', layer: 'terrain', help: 'Click or drag across provinces to set their terrain.' },
  { id: 'deposit', label: 'Deposits', icon: 'mine', layer: 'deposits', help: 'Click or drag across provinces to set their deposit.' },
  { id: 'route', label: 'Routes', icon: 'road', help: 'Click two provinces. Across a land border this adds or removes a river; between two coasts it adds or removes a strait.' },
  { id: 'port', label: 'Ports', icon: 'anchor', layer: 'seas', help: 'Click a coastal province to add or remove its port.' },
  { id: 'merge', label: 'Merge', icon: 'merge', help: 'Click a province, then a neighbour to merge into it.' },
];

const LAYERS: Array<[EditorLayer, string]> = [
  ['realms', 'Realms'],
  ['regions', 'Regions'],
  ['terrain', 'Terrain'],
  ['deposits', 'Deposits'],
  ['seas', 'Sea zones'],
];

const RESOURCE_LABEL: Record<string, string> = { food: 'Food', coal: 'Coal', iron: 'Iron', oil: 'Oil', rubber: 'Rubber', nitrates: 'Nitrates' };
const CLIMATE_LABEL: Record<Climate, string> = { temperate: 'Temperate', northern: 'Northern (forests)', southern: 'Southern (warm plains)', arid: 'Arid (steppe)' };
const MAP_ID = /^[a-z0-9][a-z0-9-]{1,39}$/;

interface Snapshot {
  text: string;
  geometry: MapPackage['geometry'];
}

function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const id = control.id || `ed-${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div', { class: 'field' }, h('label', { for: id }, label), control, hint ? h('div', { class: 'small muted' }, hint) : null);
}

function textInput(value: string, onCommit: (v: string) => void, attrs: Record<string, unknown> = {}): HTMLInputElement {
  const el = h('input', { type: 'text', value, maxlength: 60, ...attrs }) as HTMLInputElement;
  el.addEventListener('change', () => onCommit(el.value));
  return el;
}

function numInput(value: number, min: number, max: number, onCommit: (v: number) => void, step = 1): HTMLInputElement {
  const el = h('input', { type: 'number', value: String(value), min: String(min), max: String(max), step: String(step) }) as HTMLInputElement;
  el.addEventListener('change', () => onCommit(Number(el.value)));
  return el;
}

function selectInput<T extends string>(options: Array<[T, string]>, value: T, onChange: (v: T) => void): HTMLSelectElement {
  const el = h('select', null, options.map(([v, t]) => h('option', { value: v, selected: v === value ? true : undefined }, t))) as HTMLSelectElement;
  el.addEventListener('change', () => onChange(el.value as T));
  return el;
}

export function renderEditor(app: App, initial: MapPackage | null): HTMLElement {
  const canvas = h('canvas', { class: 'ed-canvas', 'aria-label': 'Map being edited' });
  const view = new EditorView(canvas);
  const panel = h('div', { class: 'ed-panel-body' });
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const toolsEl = h('nav', { class: 'ed-tools', 'aria-label': 'Editing tools' });
  const layersEl = h('div', { class: 'segmented ed-layers', role: 'radiogroup', 'aria-label': 'What the map shows' });
  const hint = h('div', { class: 'ed-hint', role: 'status', 'aria-live': 'polite' });
  const statusEl = h('button', { type: 'button', class: 'ed-status', 'data-fk': 'ed-status' });
  const titleEl = h('div', { class: 'ed-title' });
  const undoBtn = button('', () => undo(), { cls: 'icon quiet', icon: 'chevronLeft', title: 'Undo (Ctrl+Z)', fk: 'ed-undo' });
  const redoBtn = button('', () => redo(), { cls: 'icon quiet', icon: 'chevronRight', title: 'Redo (Ctrl+Y)', fk: 'ed-redo' });
  const stage = h('div', { class: 'ed-stage' }, canvas, h('div', { class: 'ed-overlay' }, layersEl), hint);
  const overlay = h('div', { class: 'ed-new hidden' });

  let pkg: MapPackage = initial ? structuredClone(initial) : (null as unknown as MapPackage);
  /** the library id this map was opened from (saving to it replaces that map) */
  let libraryId: string | null = initial && app.maps.has(initial.id) ? initial.id : null;
  let check: MapCheck = { ok: false, errors: [], warnings: [] };
  let tool: Tool = 'select';
  let tab: Tab = 'tool';
  let undoStack: Snapshot[] = [];
  let redoStack: Snapshot[] = [];
  let unsaved = false;
  let message: { text: string; kind: 'good' | 'warn' | 'bad' | 'info' } | null = null;
  // tool choices
  let paintRealm: string | null = null;
  let paintRegion = '';
  let paintTerrain: Terrain = 'plains';
  let paintDeposit: Resource = null;
  let newRealmName = '';
  let selectedZone: string | null = null;

  // ── history and persistence
  const snapshot = (): Snapshot => {
    const { geometry, ...rest } = pkg;
    return { text: JSON.stringify(rest), geometry };
  };
  const restore = (s: Snapshot) => {
    pkg = { ...(JSON.parse(s.text) as Omit<MapPackage, 'geometry'>), geometry: s.geometry };
  };
  let validateTimer = 0;
  let draftTimer = 0;
  const afterEdit = (opts: { quiet?: boolean } = {}) => {
    unsaved = true;
    view.setMap(pkg);
    clearTimeout(validateTimer);
    validateTimer = window.setTimeout(() => {
      check = validateMapPackage(pkg);
      drawHeader();
      if (tab === 'check') drawPanel();
    }, pkg.provinces.length > 300 ? 300 : 120);
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => void app.maps.saveDraft(JSON.stringify({ libraryId, pkg })).catch(() => undefined), 1200);
    drawHeader();
    if (!opts.quiet) drawPanel();
  };
  const begin = () => {
    undoStack.push(snapshot());
    if (undoStack.length > 80) undoStack.shift();
    redoStack = [];
  };
  /** Runs one edit as one undo step. */
  const edit = (fn: () => E.EditResult | number | void): boolean => {
    begin();
    const r = fn();
    if (r && typeof r === 'object' && !r.ok) {
      undoStack.pop();
      say(r.message ?? 'That change is not possible.', 'warn');
      return false;
    }
    afterEdit();
    return true;
  };
  const undo = () => {
    const s = undoStack.pop();
    if (!s) return;
    redoStack.push(snapshot());
    restore(s);
    afterEdit();
    say('Undone.', 'info');
  };
  const redo = () => {
    const s = redoStack.pop();
    if (!s) return;
    undoStack.push(snapshot());
    restore(s);
    afterEdit();
    say('Redone.', 'info');
  };
  const say = (text: string, kind: 'good' | 'warn' | 'bad' | 'info' = 'info') => {
    message = { text, kind };
    drawHint();
  };

  // ── header
  const drawHeader = () => {
    if (!pkg) return;
    setChildren(titleEl, h('span', { class: 'ed-name' }, pkg.meta.name), h('span', { class: 'ed-id' }, pkg.id), unsaved ? h('span', { class: 'tag warn' }, 'Unsaved') : h('span', { class: 'tag good' }, 'Saved'));
    const e = check.errors.length;
    const w = check.warnings.length;
    statusEl.className = `ed-status ${e ? 'bad' : w ? 'warn' : 'good'}`;
    setChildren(statusEl, icon(e ? 'alert' : 'check'), e ? `${e} error${e === 1 ? '' : 's'}` : 'Playable', w ? h('small', null, ` · ${w} warning${w === 1 ? '' : 's'}`) : null);
    undoBtn.setAttribute('aria-disabled', undoStack.length ? 'false' : 'true');
    redoBtn.setAttribute('aria-disabled', redoStack.length ? 'false' : 'true');
  };
  statusEl.addEventListener('click', () => setTab('check'));

  // ── tools, layers, tabs
  const setTool = (t: Tool) => {
    tool = t;
    view.pending = null;
    const def = TOOLS.find((x) => x.id === t);
    if (def?.layer) view.layer = def.layer;
    if (tab !== 'tool') tab = 'tool';
    drawTools();
    drawLayers();
    drawTabs();
    drawPanel();
    drawHint();
    view.invalidate();
  };
  const drawTools = () =>
    setChildren(
      toolsEl,
      TOOLS.map((t) => {
        const b = h('button', { type: 'button', class: `ed-tool ${tool === t.id ? 'active' : ''}`, 'aria-pressed': tool === t.id ? 'true' : 'false', title: t.help, 'data-tool': t.id }, icon(t.icon), h('span', null, t.label));
        b.addEventListener('click', () => setTool(t.id));
        return b;
      }),
    );
  const drawLayers = () =>
    setChildren(
      layersEl,
      LAYERS.map(([id, label]) => {
        const b = h('button', { type: 'button', class: view.layer === id ? 'active' : '', role: 'radio', 'aria-checked': view.layer === id ? 'true' : 'false', 'data-layer': id }, label);
        b.addEventListener('click', () => {
          view.layer = id;
          drawLayers();
          view.invalidate();
        });
        return b;
      }),
    );
  const setTab = (t: Tab) => {
    tab = t;
    if (t === 'check') check = validateMapPackage(pkg);
    drawTabs();
    drawPanel();
    drawHeader();
  };
  const drawTabs = () =>
    setChildren(
      tabsEl,
      (
        [
          ['tool', tool === 'select' ? 'Selection' : 'Tool'],
          ['map', 'Map'],
          ['realms', 'Realms'],
          ['regions', 'Regions'],
          ['check', 'Check'],
        ] as Array<[Tab, string]>
      ).map(([id, label]) => {
        const b = h('button', { type: 'button', class: `tab ${tab === id ? 'active' : ''}`, role: 'tab', 'aria-selected': tab === id ? 'true' : 'false', 'data-tab': id }, label);
        b.addEventListener('click', () => setTab(id));
        return b;
      }),
    );
  const drawHint = () => {
    const def = TOOLS.find((x) => x.id === tool);
    const text = tool === 'capital' ? `Click a province for the capital of ${newRealmName}.` : (def?.help ?? '');
    setChildren(hint, message ? h('div', { class: `callout ${message.kind}` }, h('span', null, message.text)) : null, h('div', { class: 'ed-help' }, view.hover ? `${provName(view.hover)} · ` : '', text));
  };
  const provName = (id: string) => pkg.provinces.find((p) => p.id === id)?.name ?? id;
  const realmName = (id: string | null) => (id ? (pkg.nations.find((n) => n.id === id)?.name ?? id) : 'Unclaimed');

  // ── panel
  const drawPanel = () => {
    if (!pkg) return;
    const body: Child[] =
      tab === 'tool' ? toolPanel() : tab === 'map' ? mapPanel() : tab === 'realms' ? realmsPanel() : tab === 'regions' ? regionsPanel() : checkPanel();
    setChildren(panel, body);
  };

  const choiceList = <T,>(items: Array<{ value: T; label: string; swatch?: string; sub?: string }>, current: T, onPick: (v: T) => void): HTMLElement =>
    h(
      'div',
      { class: 'ed-choices', role: 'radiogroup' },
      items.map((it) => {
        const b = h('button', { type: 'button', class: `ed-choice ${it.value === current ? 'active' : ''}`, role: 'radio', 'aria-checked': it.value === current ? 'true' : 'false', 'data-choice': String(it.value) }, h('span', { class: 'sw', style: `background:${it.swatch ?? 'transparent'}` }), h('span', { class: 'ct' }, it.label), it.sub ? h('span', { class: 'cs' }, it.sub) : null);
        b.addEventListener('click', () => {
          onPick(it.value);
          drawPanel();
        });
        return b;
      }),
    );

  const counts = () => {
    const byOwner = new Map<string, number>();
    const byRegion = new Map<string, number>();
    for (const p of pkg.provinces) {
      if (p.owner) byOwner.set(p.owner, (byOwner.get(p.owner) ?? 0) + 1);
      byRegion.set(p.region, (byRegion.get(p.region) ?? 0) + 1);
    }
    return { byOwner, byRegion };
  };

  const toolPanel = (): Child[] => {
    const def = TOOLS.find((x) => x.id === tool);
    const head = h('p', { class: 'small muted' }, tool === 'capital' ? `Click a province on the map: it becomes the capital of the new realm "${newRealmName}".` : def?.help);
    const { byOwner, byRegion } = counts();
    switch (tool) {
      case 'select':
        return [head, selectedZone ? zoneInspector(selectedZone) : view.selected ? provinceInspector(view.selected) : h('div', { class: 'callout info' }, icon('info'), h('span', null, 'Nothing selected. Click a province or a sea zone.'))];
      case 'owner':
        return [head, choiceList<string | null>([{ value: null, label: 'Unclaimed frontier', swatch: '#ece3cc' }, ...pkg.nations.map((n) => ({ value: n.id as string | null, label: n.name, swatch: n.color, sub: String(byOwner.get(n.id) ?? 0) }))], paintRealm, (v) => (paintRealm = v))];
      case 'region': {
        if (!pkg.regions.some((r) => r.id === paintRegion)) paintRegion = pkg.regions[0]?.id ?? '';
        const nameIn = h('input', { type: 'text', placeholder: 'New region name', maxlength: 60 }) as HTMLInputElement;
        const add = button('Add', () => {
          let id: string | undefined;
          if (edit(() => {
            const r = E.addRegion(pkg, nameIn.value);
            id = r.id;
            return r;
          }) && id) paintRegion = id;
          drawPanel();
        }, { cls: 'small', icon: 'plus' });
        return [head, choiceList(pkg.regions.map((r) => ({ value: r.id, label: r.name, swatch: hashColor(r.id), sub: String(byRegion.get(r.id) ?? 0) })), paintRegion, (v) => (paintRegion = v)), h('div', { class: 'row', style: 'margin-top:10px' }, nameIn, add)];
      }
      case 'terrain':
        return [head, choiceList(TERRAINS.map((t) => ({ value: t as Terrain, label: TERRAIN[t].label, swatch: ({ plains: '#d9cf8f', steppe: '#d8b86f', forest: '#7f9e5f', hills: '#b39a6a', marsh: '#87a59a', mountains: '#8f8478' } as Record<string, string>)[t], sub: `development up to ${E.devCap(t)}` })), paintTerrain, (v) => (paintTerrain = v))];
      case 'deposit':
        return [head, choiceList<Resource>([{ value: null, label: 'No deposit', swatch: 'transparent' }, ...RESOURCES.map((r) => ({ value: r as Resource, label: RESOURCE_LABEL[r], swatch: DEPOSIT_COLORS[r], sub: String(pkg.provinces.filter((p) => p.resource === r).length) }))], paintDeposit, (v) => (paintDeposit = v))];
      case 'route':
        return [head, view.pending ? h('p', null, `First province: ${provName(view.pending)}. Now click the second.`) : null, h('p', { class: 'small muted' }, `${pkg.straits.length} straits, ${pkg.rivers.length} river borders.`)];
      case 'port':
        return [head, h('p', { class: 'small muted' }, `${pkg.provinces.filter((p) => p.port).length} ports. Ports can only be on provinces that border a sea zone; regenerate the sea zones (Map tab) after changing coasts.`)];
      case 'merge':
        return [head, view.pending ? h('p', null, `Keeping ${provName(view.pending)}. Click a neighbour to merge into it.`) : null, h('p', { class: 'small muted' }, 'The merged province keeps the first province\'s name, owner, terrain and region, the larger development, roads and fort, and the sum of population and factories.')];
      case 'capital':
        return [head, button('Cancel', () => setTool('select'), { cls: 'quiet' })];
    }
  };

  const provinceInspector = (pid: string): HTMLElement => {
    const p = pkg.provinces.find((x) => x.id === pid);
    if (!p) return h('p', null, 'This province no longer exists.');
    const coastal = pkg.seaZones.some((z) => z.coasts.includes(pid));
    const capitalOf = pkg.nations.find((n) => n.capital === pid);
    const owner = p.owner ? pkg.nations.find((n) => n.id === p.owner) : null;
    const claimSel = selectInput<string>([['', 'Add or remove a claim…'], ...pkg.nations.filter((n) => n.id !== p.owner).map((n) => [n.id, `${p.claims.includes(n.id) ? '✓ ' : ''}${n.name}`] as [string, string])], '', (v) => v && edit(() => E.toggleClaim(pkg, pid, v)));
    const neighbours = p.neighbors.map((nb) => {
      const strait = pkg.straits.some(([a, b]) => (a === pid && b === nb) || (a === nb && b === pid));
      const river = pkg.rivers.some(([a, b]) => (a === pid && b === nb) || (a === nb && b === pid));
      const link = h('button', { type: 'button', class: 'linkish' }, provName(nb), strait ? ' (strait)' : river ? ' (river)' : '');
      link.addEventListener('click', () => select(nb, true));
      return link;
    });
    return h(
      'div',
      { class: 'ed-form', 'data-province': pid },
      h('h3', null, p.name, capitalOf ? h('span', { class: 'tag brass', style: 'margin-left:8px' }, `Capital of ${capitalOf.short}`) : null),
      h('div', { class: 'small muted' }, `id ${p.id} · ${coastal ? 'coastal' : 'inland'}`),
      field('Name', textInput(p.name, (v) => edit(() => E.setProvince(pkg, pid, { name: v })), { 'data-f': 'name' })),
      field('Owner', selectInput<string>([['', 'Unclaimed frontier'], ...pkg.nations.map((n) => [n.id, n.name] as [string, string])], p.owner ?? '', (v) => edit(() => E.paintOwner(pkg, [pid], v || null)))),
      field('Region', selectInput<string>(pkg.regions.map((r) => [r.id, r.name] as [string, string]), p.region, (v) => edit(() => E.paintRegion(pkg, [pid], v)))),
      h(
        'div',
        { class: 'ed-grid2' },
        field('Terrain', selectInput<Terrain>(TERRAINS.map((t) => [t, TERRAIN[t].label] as [Terrain, string]), p.terrain, (v) => edit(() => E.paintTerrain(pkg, [pid], v)))),
        field('Deposit', selectInput<string>([['', 'None'], ...RESOURCES.map((r) => [r, RESOURCE_LABEL[r]] as [string, string])], p.resource ?? '', (v) => edit(() => E.paintDeposit(pkg, [pid], (v || null) as Resource)))),
        field('Development', numInput(p.dev, 1, E.devCap(p.terrain), (v) => edit(() => E.setProvince(pkg, pid, { dev: v })))),
        field('Population', numInput(Math.round(p.pop), 1, 10000, (v) => edit(() => E.setProvince(pkg, pid, { pop: v })))),
        field('Fort', numInput(p.fort, 0, 3, (v) => edit(() => E.setProvince(pkg, pid, { fort: v })))),
        field('Roads', numInput(p.infra, 0, 3, (v) => edit(() => E.setProvince(pkg, pid, { infra: v })))),
        field('Factories', numInput(p.factories ?? 0, 0, 5, (v) => edit(() => E.setProvince(pkg, pid, { factories: v })))),
        field('Port', numInput(p.port ?? 0, 0, 3, (v) => edit(() => E.setProvince(pkg, pid, { port: v }))), coastal ? undefined : 'Inland: no port'),
      ),
      field('Claims', claimSel, p.claims.length ? `Claimed by ${p.claims.map((c) => realmName(c)).join(', ')}` : 'No claims'),
      owner && !capitalOf ? button(`Make this the capital of ${owner.short}`, () => edit(() => E.setCapital(pkg, owner.id, pid)), { cls: 'small', icon: 'capital' }) : null,
      h('div', { class: 'eyebrow', style: 'margin-top:12px' }, `Neighbours (${p.neighbors.length})`),
      h('div', { class: 'ed-links' }, neighbours),
    );
  };

  const zoneInspector = (zid: string): HTMLElement => {
    const z = pkg.seaZones.find((x) => x.id === zid);
    if (!z) return h('p', null, 'This sea zone no longer exists.');
    return h(
      'div',
      { class: 'ed-form', 'data-zone': zid },
      h('h3', null, z.name),
      h('div', { class: 'small muted' }, `Sea zone ${z.id} · ${z.coasts.length} coastal provinces · ${z.neighbors.length} neighbouring zones${z.straits?.length ? ` · commands ${z.straits.length} strait(s)` : ''}`),
      field('Name', textInput(z.name, (v) => edit(() => {
        const nm = v.trim().slice(0, 60);
        if (!nm) return { ok: false, message: 'A sea zone needs a name.' };
        z.name = nm;
        return { ok: true };
      }))),
      h('p', { class: 'small muted' }, 'Sea zones follow the coastline. After changing coasts (merging coastal provinces), regenerate them from the Map tab.'),
    );
  };

  const mapPanel = (): Child[] => {
    const m = pkg.meta;
    const r = pkg.rules;
    const idIn = textInput(pkg.id, (v) => {
      const id = mapIdFrom(v);
      if (!MAP_ID.test(id)) return say('A map id uses lower-case letters, digits and dashes.', 'warn');
      if (id !== libraryId && app.maps.has(id)) return say(`Your library already has a map with the id "${id}".`, 'warn');
      edit(() => void (pkg.id = id));
    });
    const desc = h('textarea', { rows: 3, maxlength: 600 }, m.description) as HTMLTextAreaElement;
    desc.addEventListener('change', () => edit(() => void (pkg.meta.description = desc.value.slice(0, 600))));
    const v = r.victory ?? {};
    return [
      field('Name', textInput(m.name, (val) => edit(() => (val.trim() ? void (pkg.meta.name = val.trim().slice(0, 60)) : { ok: false, message: 'A map needs a name.' })), { 'data-f': 'map-name' })),
      field('Id', idIn, 'Saves and the library know the map by this id.'),
      field('Description', desc),
      field('One-line summary', textInput(m.blurb ?? '', (val) => edit(() => void (pkg.meta.blurb = val.slice(0, 600))))),
      field('Author', textInput(m.author ?? '', (val) => edit(() => void (pkg.meta.author = val.slice(0, 60) || undefined)))),
      h(
        'div',
        { class: 'ed-grid2' },
        field('Start year', numInput(r.startYear, 1870, 1930, (val) => edit(() => void (pkg.rules.startYear = Math.max(1870, Math.min(1930, Math.round(val))))))),
        field('Difficulty', selectInput(['gentle', 'standard', 'hard'].map((d) => [d, d[0].toUpperCase() + d.slice(1)] as [string, string]), m.difficulty, (val) => edit(() => void (pkg.meta.difficulty = val as typeof m.difficulty)))),
      ),
      field('Campaign style', textInput(m.style, (val) => edit(() => void (pkg.meta.style = val.slice(0, 120))))),
      h(
        'div',
        { class: 'ed-facts small' },
        h('div', null, `${pkg.provinces.length} provinces (${m.size}) · ${pkg.nations.length} realms · ${pkg.regions.length} regions · ${pkg.seaZones.length} sea zones`),
        h('div', null, `Campaign lengths: ${r.campaignYears.options.join(', ')} years (default ${r.campaignYears.default})`),
        h('div', null, `Victory: ${v.territorialRegions ?? '–'} regions and ${Math.round((v.territorialShare ?? 0) * 100)}% of provinces; ${Math.round((v.economicShare ?? 0) * 100)}% of development (${Math.round((v.economicShare ?? 0) * C.victory.economicScale * 100)}% in play); diplomatic influence ${v.diplomaticInfluencePerRealm ?? '–'} per realm. Research cost ×${r.researchCostMul ?? 1}.`),
        h('div', null, `Mechanics: ${m.mechanics.join(', ') || 'none listed'}`),
        m.attribution?.length ? h('div', null, `Sources: ${m.attribution.join('; ')}`) : null,
      ),
      h(
        'div',
        { class: 'row', style: 'margin-top:8px' },
        button('Recompute size, mechanics and victory', () => edit(() => E.refreshRules(pkg)), { cls: 'small', fk: 'ed-rules' }),
        button('Regenerate sea zones', () => edit(() => E.regenerateSeas(pkg)), { cls: 'small', fk: 'ed-seas', title: 'Rebuild the sea zones and their coasts from the coastline' }),
      ),
    ];
  };

  const realmsPanel = (): Child[] => {
    const { byOwner } = counts();
    const nameIn = h('input', { type: 'text', placeholder: 'Name of the new realm', maxlength: 60, value: newRealmName, 'data-f': 'new-realm' }) as HTMLInputElement;
    const place = button('Place its capital…', () => {
      if (!nameIn.value.trim()) return say('Name the new realm first.', 'warn');
      newRealmName = nameIn.value.trim();
      setTool('capital');
    }, { cls: 'small', icon: 'capital', fk: 'ed-place-capital' });
    return [
      h(
        'div',
        { class: 'ed-rows' },
        pkg.nations.map((n) => {
          const color = h('input', { type: 'color', value: n.color, 'aria-label': `Colour of ${n.name}` }) as HTMLInputElement;
          color.addEventListener('change', () => edit(() => E.updateRealm(pkg, n.id, { color: color.value })));
          const cap = h('button', { type: 'button', class: 'linkish' }, `Capital: ${provName(n.capital)}`);
          cap.addEventListener('click', () => select(n.capital, true));
          return h(
            'div',
            { class: 'ed-row', 'data-realm': n.id },
            color,
            h(
              'div',
              { class: 'grow' },
              textInput(n.name, (v) => edit(() => E.updateRealm(pkg, n.id, { name: v }))),
              h('div', { class: 'row small' }, cap, h('span', { class: 'muted' }, `${byOwner.get(n.id) ?? 0} provinces`), selectInput(Object.keys(PERSONALITIES).map((k) => [k, PERSONALITIES[k as Personality].label] as [string, string]), n.personality, (v) => edit(() => E.updateRealm(pkg, n.id, { personality: v as Personality })))),
            ),
            button('', () => confirmDialog(app, `Remove ${n.name}?`, 'Its provinces become unclaimed frontier and its claims lapse. You can undo this.', () => edit(() => E.removeRealm(pkg, n.id)), 'Remove'), { cls: 'icon quiet', icon: 'close', title: `Remove ${n.name}` }),
          );
        }),
      ),
      h('div', { class: 'eyebrow', style: 'margin-top:14px' }, 'New realm'),
      h('div', { class: 'row' }, nameIn, place),
    ];
  };

  const regionsPanel = (): Child[] => {
    const { byRegion } = counts();
    const nameIn = h('input', { type: 'text', placeholder: 'Name of the new region', maxlength: 60 }) as HTMLInputElement;
    return [
      h(
        'div',
        { class: 'ed-rows' },
        pkg.regions.map((r) =>
          h(
            'div',
            { class: 'ed-row', 'data-region': r.id },
            h('span', { class: 'sw', style: `background:${hashColor(r.id)}` }),
            h('div', { class: 'grow' }, textInput(r.name, (v) => edit(() => E.renameRegion(pkg, r.id, v))), h('div', { class: 'small muted' }, `${byRegion.get(r.id) ?? 0} provinces`)),
            button('', () => {
              const others = pkg.regions.filter((x) => x.id !== r.id);
              if (!others.length) return say('A map needs at least one region.', 'warn');
              let into = others[0].id;
              const sel = selectInput(others.map((o) => [o.id, o.name] as [string, string]), into, (v) => (into = v));
              let close = () => {};
              const yes = button('Remove', () => {
                close();
                edit(() => E.removeRegion(pkg, r.id, into));
              }, { cls: 'danger' });
              close = dialog(app, `Remove ${r.name}?`, [h('p', null, 'Its provinces move to:'), sel], [button('Cancel', () => close()), yes]);
            }, { cls: 'icon quiet', icon: 'close', title: `Remove ${r.name}` }),
          ),
        ),
      ),
      h('div', { class: 'eyebrow', style: 'margin-top:14px' }, 'New region'),
      h('div', { class: 'row' }, nameIn, button('Add', () => {
        let id: string | undefined;
        if (edit(() => {
          const res = E.addRegion(pkg, nameIn.value);
          id = res.id;
          return res;
        }) && id) {
          paintRegion = id;
          setTool('region');
        }
      }, { cls: 'small', icon: 'plus' })),
    ];
  };

  const issueRows = (issues: MapIssue[], kind: 'bad' | 'warn') =>
    issues.map((i) => {
      const target = i.ref && (pkg.provinces.some((p) => p.id === i.ref) || pkg.seaZones.some((z) => z.id === i.ref)) ? i.ref : i.ref ? (pkg.nations.find((n) => n.id === i.ref)?.capital ?? null) : null;
      return h('div', { class: `ed-issue ${kind}` }, icon(kind === 'bad' ? 'alert' : 'info'), h('span', { class: 'grow' }, i.message), target ? button('Show', () => select(target, true), { cls: 'small quiet' }) : null);
    });

  const checkPanel = (): Child[] => [
    check.errors.length
      ? h('div', { class: 'callout bad' }, icon('alert'), h('span', null, `${check.errors.length} error(s): the map cannot be played or saved to the library until they are fixed.`))
      : h('div', { class: 'callout good' }, icon('check'), h('span', null, 'The map passes every check and can be played.')),
    h('div', { class: 'ed-issues' }, issueRows(check.errors, 'bad'), issueRows(check.warnings, 'warn')),
    h('p', { class: 'small muted' }, 'These are the checks every imported map goes through: references, two-way borders, visible routes, closed outlines, capitals, sea zones and ports, and one connected world.'),
  ];

  // ── selection
  const select = (id: string, focus = false) => {
    const isZone = pkg.seaZones.some((z) => z.id === id);
    selectedZone = isZone ? id : null;
    view.selected = isZone ? null : id;
    if (isZone) view.layer = 'seas';
    view.flagged = new Set([id].filter(() => tab === 'check'));
    if (focus) view.focus(id);
    if (tool !== 'select') tool = 'select';
    if (tab !== 'check') tab = 'tool';
    drawTools();
    drawLayers();
    drawTabs();
    drawPanel();
    view.invalidate();
  };

  // ── pointer interaction
  const PAINT: Tool[] = ['owner', 'region', 'terrain', 'deposit'];
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { kind: 'pan' | 'paint' | 'click'; x: number; y: number; moved: boolean } | null = null;
  let pinch: { d: number } | null = null;
  let spaceDown = false;
  const local = (e: PointerEvent | WheelEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const paintAt = (pid: string | null) => {
    if (!pid) return;
    const n =
      tool === 'owner'
        ? E.paintOwner(pkg, [pid], paintRealm)
        : tool === 'region'
          ? E.paintRegion(pkg, [pid], paintRegion)
          : tool === 'terrain'
            ? E.paintTerrain(pkg, [pid], paintTerrain)
            : E.paintDeposit(pkg, [pid], paintDeposit);
    if (n) view.invalidate();
  };
  const clickAt = (sx: number, sy: number) => {
    const { province, zone } = view.pick(sx, sy);
    message = null;
    switch (tool) {
      case 'select':
        if (province) select(province);
        else if (zone) select(zone);
        else {
          view.selected = null;
          selectedZone = null;
          drawPanel();
        }
        break;
      case 'route':
      case 'merge':
        if (!province) break;
        if (!view.pending) {
          view.pending = province;
          drawPanel();
        } else if (view.pending === province) view.pending = null;
        else {
          const a = view.pending;
          view.pending = null;
          if (tool === 'merge') {
            if (edit(() => E.mergeProvinces(pkg, a, province))) say(`Merged into ${provName(a)}.`, 'good');
          } else if (view.landBorder(a, province)) {
            const had = pkg.rivers.some(([x, y]) => (x === a && y === province) || (x === province && y === a));
            if (edit(() => E.toggleRiver(pkg, a, province))) say(had ? 'River removed.' : 'River added along that border.', 'good');
          } else {
            const had = pkg.straits.some(([x, y]) => (x === a && y === province) || (x === province && y === a));
            if (edit(() => E.toggleStrait(pkg, a, province))) say(had ? 'Strait removed.' : 'Strait added.', 'good');
          }
          drawPanel();
        }
        break;
      case 'port':
        if (province) {
          const p = pkg.provinces.find((x) => x.id === province)!;
          if (edit(() => E.setProvince(pkg, province, { port: p.port ? 0 : 1 }))) say(p.port ? `Port added at ${p.name}.` : `Port removed from ${p.name}.`, 'good');
        }
        break;
      case 'capital':
        if (province) {
          let id: string | undefined;
          if (edit(() => {
            const r = E.addRealm(pkg, newRealmName, province);
            id = r.id;
            return r;
          })) {
            say(`${newRealmName} founded at ${provName(province)}. Paint its land with the Realms tool.`, 'good');
            newRealmName = '';
            paintRealm = id ?? null;
            setTool('owner');
          }
        }
        break;
      default:
        break;
    }
    drawHint();
    view.invalidate();
  };
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (!pkg) return;
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      if (gesture?.kind === 'paint') afterEdit({ quiet: true });
      gesture = { kind: 'pan', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, moved: true };
      return;
    }
    const panning = e.button === 1 || e.button === 2 || spaceDown;
    if (!panning && PAINT.includes(tool) && e.button === 0) {
      begin();
      gesture = { kind: 'paint', x: p.x, y: p.y, moved: false };
      paintAt(view.pick(p.x, p.y).province);
    } else gesture = { kind: panning ? 'pan' : 'click', x: p.x, y: p.y, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pkg) return;
    const p = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, p);
    if (pinch && pointers.size === 2 && gesture) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      view.camera.pan(mx - gesture.x, my - gesture.y);
      if (pinch.d > 0) view.camera.zoomAt(mx, my, d / pinch.d);
      pinch.d = d;
      gesture.x = mx;
      gesture.y = my;
      view.invalidate();
      return;
    }
    if (gesture) {
      const dx = p.x - gesture.x;
      const dy = p.y - gesture.y;
      if (gesture.kind === 'paint') {
        paintAt(view.pick(p.x, p.y).province);
        return;
      }
      if (!gesture.moved && Math.hypot(dx, dy) < 5) return;
      gesture.moved = true;
      gesture.kind = 'pan';
      view.camera.pan(dx, dy);
      gesture.x = p.x;
      gesture.y = p.y;
      view.invalidate();
      return;
    }
    const hov = view.pick(p.x, p.y).province;
    if (hov !== view.hover) {
      view.hover = hov;
      drawHint();
      view.invalidate();
    }
  });
  const endPointer = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size >= 1) return;
    pinch = null;
    const g = gesture;
    gesture = null;
    if (!g) return;
    if (g.kind === 'paint') {
      // the stroke is one undo step; nothing changed means nothing to undo
      const last = undoStack[undoStack.length - 1];
      if (last && last.text === snapshot().text) undoStack.pop();
      else afterEdit();
      return;
    }
    if (g.kind === 'click' && !g.moved && e.type === 'pointerup') clickAt(g.x, g.y);
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => {
    if (view.hover) {
      view.hover = null;
      drawHint();
      view.invalidate();
    }
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!pkg) return;
      e.preventDefault();
      const p = local(e);
      view.camera.zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
      view.invalidate();
    },
    { passive: false },
  );
  const onKey = (e: KeyboardEvent) => {
    if (!el.isConnected || !pkg) return;
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
    if (e.key === ' ' && !typing) {
      spaceDown = e.type === 'keydown';
      if (e.type === 'keydown') e.preventDefault();
      return;
    }
    if (e.type !== 'keydown' || typing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (e.key === 'Escape') {
      if (view.pending || tool === 'capital') {
        view.pending = null;
        if (tool === 'capital') setTool('select');
      } else {
        view.selected = null;
        selectedZone = null;
      }
      drawPanel();
      view.invalidate();
    }
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  const ro = new ResizeObserver(() => pkg && view.resize());
  ro.observe(canvas);

  // ── saving, exporting, playing
  const saveToLibrary = async (): Promise<boolean> => {
    check = validateMapPackage(pkg);
    drawHeader();
    if (!check.ok) {
      setTab('check');
      say('Fix the errors listed under Check before saving the map to your library.', 'bad');
      return false;
    }
    if (pkg.id !== libraryId && app.maps.has(pkg.id)) {
      setTab('map');
      say(`Your library already has another map with the id "${pkg.id}". Give this map another id.`, 'bad');
      return false;
    }
    try {
      const result = await app.maps.save(pkg);
      if (!result.ok) {
        check = result;
        setTab('check');
        return false;
      }
      const stored = app.maps.get(pkg.id);
      if (stored) pkg.revision = stored.pkg.revision;
      libraryId = pkg.id;
      unsaved = false;
      void app.maps.clearDraft();
      drawHeader();
      say(`${pkg.meta.name} is saved in your map library.`, 'good');
      return true;
    } catch (e) {
      say(`The map could not be saved: ${(e as Error).message}`, 'bad');
      return false;
    }
  };
  const exportMap = () => {
    check = validateMapPackage(pkg);
    drawHeader();
    const go = () => downloadText(`${pkg.id}.map.json`, JSON.stringify(pkg));
    if (check.ok) return go();
    confirmDialog(app, 'Export a map with errors?', `The map has ${check.errors.length} error(s). The file will keep your work, but it will not import or play until they are fixed.`, go, 'Export anyway', false);
  };
  const play = async () => {
    if (!(await saveToLibrary())) return;
    app.showScreen(renderNewGame(app, pkg.id));
  };
  const leave = () => {
    const go = () => app.showScreen(renderMapLibrary(app));
    if (!unsaved) return go();
    confirmDialog(app, 'Leave the editor?', 'Your changes are not in the library yet. They are kept in this browser as an unfinished map: choose New map to continue it.', go, 'Leave', false);
  };
  const importInto = async () => {
    const text = await pickFile('.json,application/json');
    if (!text) return;
    if (text === '__too_big__') return say('That file is too large to be a map.', 'bad');
    const { pkg: loaded, check: c } = parseMapPackage(text);
    if (!loaded) {
      dialog(app, 'This map cannot be opened', [h('p', null, 'The file was checked and nothing was changed. Problems found:'), issueList(c.errors)]);
      return;
    }
    open(loaded, app.maps.has(loaded.id) ? loaded.id : null);
    say(`Opened ${loaded.meta.name} from a file.`, 'good');
  };

  // ── new map form
  const showNewForm = async () => {
    overlay.classList.remove('hidden');
    const P: ProceduralParams = { ...DEFAULT_PARAMS, id: app.maps.freeId('new-map'), name: 'New map', seed: Math.floor(Math.random() * 100000) };
    const draftText = await app.maps.loadDraft();
    let draft: { libraryId: string | null; pkg: MapPackage } | null = null;
    if (draftText) {
      try {
        const obj = JSON.parse(draftText) as { libraryId?: unknown; pkg?: unknown };
        draft = { libraryId: typeof obj.libraryId === 'string' ? obj.libraryId : null, pkg: obj.pkg as MapPackage };
      } catch {
        draft = null;
      }
    }
    const status = h('div', { class: 'ed-gen-status', role: 'status', 'aria-live': 'polite' });
    const nameIn = h('input', { type: 'text', value: P.name, maxlength: 60, 'data-f': 'gen-name' }) as HTMLInputElement;
    const seedIn = h('input', { type: 'number', value: String(P.seed), min: '0', max: '999999', 'data-f': 'gen-seed' }) as HTMLInputElement;
    const range = (label: string, min: number, max: number, step: number, value: number, fmt: (v: number) => string, key: string) => {
      const out = h('span', { class: 'rv' }, fmt(value));
      const inp = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value), 'data-f': key }) as HTMLInputElement;
      inp.addEventListener('input', () => setChildren(out, fmt(Number(inp.value))));
      return { el: h('div', { class: 'field' }, h('label', null, label, ' ', out), inp), get: () => Number(inp.value) };
    };
    const provinces = range('Provinces', 40, 600, 10, 120, (v) => `about ${v}`, 'gen-provinces');
    const realms = range('Realms', 2, 20, 1, 8, (v) => String(v), 'gen-realms');
    const mountains = range('Mountains', 0, 1, 0.05, 0.5, (v) => `${Math.round(v * 100)}%`, 'gen-mountains');
    const rivers = range('Rivers', 0, 1, 0.05, 0.5, (v) => `${Math.round(v * 100)}%`, 'gen-rivers');
    const lakes = range('Lakes', 0, 1, 0.05, 0.4, (v) => `${Math.round(v * 100)}%`, 'gen-lakes');
    const frontier = range('Unclaimed frontier', 0, 0.5, 0.02, 0.12, (v) => `${Math.round(v * 100)}% of the land`, 'gen-frontier');
    const year = range('Start year', 1870, 1930, 5, 1890, (v) => String(v), 'gen-year');
    let shape: MapShape = 'continent';
    let climate: Climate = 'temperate';
    const shapeSel = selectInput(MAP_SHAPES.map((s) => [s, SHAPE_LABELS[s]] as [MapShape, string]), shape, (v) => (shape = v));
    const climateSel = selectInput(CLIMATES.map((c) => [c, CLIMATE_LABEL[c]] as [Climate, string]), climate, (v) => (climate = v));
    shapeSel.setAttribute('data-f', 'gen-shape');
    const generate = button('Generate the map', () => {
      const params: ProceduralParams = {
        ...P,
        id: app.maps.freeId(nameIn.value || 'new-map'),
        name: nameIn.value.trim().slice(0, 60) || 'New map',
        seed: Math.max(0, Math.min(999999, Math.round(Number(seedIn.value) || 0))),
        provinces: provinces.get(),
        realms: realms.get(),
        shape,
        climate,
        mountains: mountains.get(),
        rivers: rivers.get(),
        lakes: lakes.get(),
        frontier: frontier.get(),
        startYear: year.get(),
        meta: { origin: 'custom' },
      };
      generate.setAttribute('aria-disabled', 'true');
      setChildren(status, h('div', { class: 'callout info' }, icon('hourglass'), h('span', null, `Drawing coastlines, ranges and rivers for about ${params.provinces} provinces…`)));
      void runGenerator(params).then((r) => {
        generate.setAttribute('aria-disabled', 'false');
        if (!r.ok) {
          setChildren(status, h('div', { class: 'callout bad' }, icon('alert'), h('span', null, `This combination could not be built (${r.message}). Try another seed or fewer realms for the size.`)));
          return;
        }
        overlay.classList.add('hidden');
        open(r.pkg, null);
        unsaved = true;
        afterEdit();
        say(`Generated in ${(r.ms / 1000).toFixed(1)} s. Edit it, then save it to your library.`, 'good');
      });
    }, { cls: 'primary', icon: 'play', fk: 'ed-generate' });
    const dice = button('', () => (seedIn.value = String(Math.floor(Math.random() * 100000))), { cls: 'icon quiet', icon: 'dice', title: 'Another seed' });
    setChildren(
      overlay,
      h(
        'div',
        { class: 'ed-new-card', role: 'dialog', 'aria-label': 'New map' },
        h('h2', null, 'New map'),
        h('p', { class: 'small muted' }, 'The generator draws a coastline, mountain ranges with passes, rivers, lakes, provinces, regions and realms from these settings; the same settings and seed give the same map. Then edit anything by hand.'),
        draft?.pkg
          ? h(
              'div',
              { class: 'callout info' },
              icon('info'),
              h('span', { class: 'grow' }, `An unfinished map is kept in this browser: ${(draft.pkg.meta as { name?: string } | undefined)?.name ?? 'untitled'}.`),
              button('Continue it', () => {
                const r = parseMapPackageObject(draft!.pkg);
                if (!r) return setChildren(status, h('div', { class: 'callout bad' }, icon('alert'), h('span', null, 'The unfinished map could not be read.')));
                overlay.classList.add('hidden');
                open(r, draft!.libraryId);
                unsaved = true;
                drawHeader();
              }, { cls: 'small', fk: 'ed-continue' }),
            )
          : null,
        h('div', { class: 'ed-grid2' }, field('Name', nameIn), h('div', { class: 'field' }, h('label', null, 'Seed'), h('div', { class: 'row seed' }, seedIn, dice))),
        h('div', { class: 'ed-grid2' }, field('Shape of the land', shapeSel), field('Climate', climateSel)),
        h('div', { class: 'ed-grid2' }, provinces.el, realms.el, mountains.el, rivers.el, lakes.el, frontier.el, year.el),
        status,
        h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:12px' }, button('Open a map file', () => void importInto().then(() => pkg && overlay.classList.add('hidden')), { cls: 'quiet', icon: 'upload', fk: 'ed-open-file' }), button('Back to the library', () => leave(), { cls: 'quiet' }), generate),
      ),
    );
  };

  /** Opens a package for editing (resets history). */
  const open = (next: MapPackage, fromLibrary: string | null) => {
    pkg = structuredClone(next);
    libraryId = fromLibrary;
    undoStack = [];
    redoStack = [];
    unsaved = false;
    view.selected = null;
    view.pending = null;
    selectedZone = null;
    paintRealm = pkg.nations[0]?.id ?? null;
    paintRegion = pkg.regions[0]?.id ?? '';
    check = validateMapPackage(pkg);
    // the panels first: they set the stage's final size, which the map is fitted to
    drawTools();
    drawLayers();
    drawTabs();
    drawPanel();
    drawHeader();
    drawHint();
    view.setMap(pkg);
    view.resize();
    view.camera.fit(false);
  };

  const el = h(
    'div',
    { class: 'editor', role: 'main' },
    h(
      'header',
      { class: 'ed-bar' },
      button('Library', () => leave(), { cls: 'quiet', icon: 'chevronLeft', fk: 'ed-back' }),
      titleEl,
      undoBtn,
      redoBtn,
      statusEl,
      h('span', { class: 'grow' }),
      button('Open file', () => void importInto(), { cls: 'quiet', icon: 'upload', fk: 'ed-open' }),
      button('Export', () => exportMap(), { icon: 'download', fk: 'ed-export' }),
      button('Save to library', () => void saveToLibrary(), { icon: 'save', fk: 'ed-save' }),
      button('Play', () => void play(), { cls: 'primary', icon: 'play', fk: 'ed-play' }),
    ),
    h('div', { class: 'ed-body' }, toolsEl, stage, h('aside', { class: 'ed-panel' }, tabsEl, panel)),
    overlay,
  );
  screenCleanup.set(el, () => {
    view.destroy();
    ro.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    clearTimeout(validateTimer);
  });
  // debugging handle, like window.cnf for the game (inspect only; the browser checks use it)
  (window as unknown as { cnfEditor?: unknown }).cnfEditor = {
    get pkg() {
      return pkg;
    },
    get check() {
      return check;
    },
    /** page coordinates of a province's label point */
    screenOf(id: string) {
      const p = view.geo?.provs.get(id);
      if (!p) return null;
      const s = view.camera.toScreen(p.lx, p.ly);
      const r = canvas.getBoundingClientRect();
      return { x: r.left + s.x, y: r.top + s.y };
    },
  };
  drawTools();
  drawLayers();
  if (pkg) requestAnimationFrame(() => open(pkg, libraryId));
  else void showNewForm();
  return el;
}

/** Validates a stored draft object as a package (it may have errors; only its structure must be readable). */
function parseMapPackageObject(raw: unknown): MapPackage | null {
  const { pkg } = parseMapPackage(JSON.stringify(raw));
  if (pkg) return pkg;
  // a draft with errors is still worth opening: keep it if it has the parts the editor needs
  const o = raw as Partial<MapPackage> | null;
  if (!o || !Array.isArray(o.provinces) || !Array.isArray(o.nations) || !Array.isArray(o.regions) || !o.geometry || !Array.isArray(o.geometry.edges)) return null;
  return o as MapPackage;
}

interface GenResult {
  ok: boolean;
  pkg: MapPackage;
  ms: number;
  message?: string;
}

/** Runs the generator in a worker (main thread if workers are unavailable). */
function runGenerator(params: ProceduralParams): Promise<GenResult> {
  return new Promise((resolve) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('./gen.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      worker = null;
    }
    if (!worker) {
      // no workers here: generate on the main thread after the status has been drawn
      setTimeout(() => {
        const t0 = performance.now();
        try {
          resolve({ ok: true, pkg: buildProceduralMap(params).pkg, ms: performance.now() - t0 });
        } catch (e) {
          resolve({ ok: false, pkg: null as unknown as MapPackage, ms: 0, message: (e as Error).message });
        }
      }, 50);
      return;
    }
    worker.onmessage = (e: MessageEvent<{ ok: boolean; pkg: MapPackage; ms: number; message?: string }>) => {
      worker!.terminate();
      resolve(e.data);
    };
    worker.onerror = (e) => {
      worker!.terminate();
      resolve({ ok: false, pkg: null as unknown as MapPackage, ms: 0, message: e.message || 'the generator stopped' });
    };
    worker.postMessage(params);
  });
}
