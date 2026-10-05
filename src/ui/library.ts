// The map library screen: the built-in maps and the player's own maps (made in
// the editor or imported), each with a preview, its size, realms, start year,
// campaign style and mechanics. Play, edit, export, import and delete.

import { BUILTIN_MAPS, builtinPackage, builtinScenario, type BuiltinMapId } from '../maps/builtin';
import type { MapPackage, MapScenarioPart } from '../maps/format';
import { plural } from './format';
import type { MapCheck, MapIssue } from '../maps/validate';
import type { App } from './app';
import { button, h, setChildren, type Child } from './dom';
import { icon } from './icons';
import { loadGeometry } from './map/maps';
import { MapRenderer } from './map/renderer';
import { confirmDialog, dialog } from './panels/dialogs';
import { renderNewGame } from './screens';
import { downloadText, pickFile } from './storage';

const SIZE_LABEL: Record<string, string> = { small: 'Small', standard: 'Standard', large: 'Large', huge: 'Huge' };
const DIFFICULTY_LABEL: Record<string, string> = { gentle: 'Gentle', standard: 'Standard', hard: 'Hard' };

/** A list of validator findings, worded for the player, with a count of the rest. */
export function issueList(issues: MapIssue[], max = 10): HTMLElement {
  return h(
    'ul',
    { class: 'issue-list' },
    issues.slice(0, max).map((i) => h('li', null, i.message)),
    issues.length > max ? h('li', { class: 'muted' }, `…and ${issues.length - max} more.`) : null,
  );
}

/** Explains a refused map file. */
export function refusedDialog(app: App, title: string, check: MapCheck): void {
  dialog(app, title, [
    h('p', null, 'The file was checked and nothing was changed. Problems found:'),
    issueList(check.errors),
    h('p', { class: 'small muted' }, 'Map files are read as data only; nothing in them is ever run.'),
  ]);
}

function stats(part: MapScenarioPart): string {
  return `${part.provinces.length} provinces · ${part.nations.length} realms · ${part.seaZones.length} sea zones · from ${part.rules.startYear}`;
}

function preview(canvas: HTMLCanvasElement, id: string, part: MapScenarioPart): void {
  const prov = new Map(part.provinces.map((p) => [p.id, p]));
  const color = new Map(part.nations.map((n) => [n.id, n.color]));
  void loadGeometry(id)
    .then((g) =>
      requestAnimationFrame(() => {
        if (!canvas.isConnected) return;
        MapRenderer.renderPreview(canvas, g, (p) => prov.get(p)?.terrain ?? 'plains', (p) => prov.get(p)?.owner ?? null, (n) => color.get(n) ?? '#888888');
      }),
    )
    .catch(() => undefined);
}

function mapCard(id: string, part: MapScenarioPart, actions: HTMLElement[], note?: Child): HTMLElement {
  const c = h('canvas', { 'aria-hidden': 'true' });
  const m = part.meta;
  const card = h(
    'article',
    { class: 'lib-card', 'data-map': id },
    h('div', { class: 'lib-prev' }, c),
    h(
      'div',
      { class: 'lib-body' },
      h('div', { class: 'lib-t' }, m.name),
      h('div', { class: 'lib-tags' }, h('span', { class: 'tag' }, SIZE_LABEL[m.size] ?? m.size), h('span', { class: `tag ${m.difficulty === 'hard' ? 'warn' : m.difficulty === 'gentle' ? 'good' : ''}` }, DIFFICULTY_LABEL[m.difficulty] ?? m.difficulty), m.origin === 'builtin' ? h('span', { class: 'tag brass' }, 'Built-in') : h('span', { class: 'tag info' }, 'Your map')),
      h('div', { class: 'lib-s' }, stats(part)),
      h('p', { class: 'lib-d' }, m.description),
      m.style ? h('div', { class: 'lib-style' }, icon('flag'), m.style) : null,
      m.mechanics.length ? h('div', { class: 'lib-mech' }, m.mechanics.map((x) => h('span', { class: 'chip' }, x))) : null,
      m.attribution?.length ? h('div', { class: 'lib-attr small muted' }, m.attribution.map((a) => h('div', null, a))) : null,
      note ?? null,
      h('div', { class: 'lib-actions' }, ...actions),
    ),
  );
  preview(c, id, part);
  return card;
}

export function renderMapLibrary(app: App): HTMLElement {
  const builtins = h('div', { class: 'lib-list' });
  const mine = h('div', { class: 'lib-list' });
  const status = h('div', { class: 'lib-status', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, kind: 'good' | 'warn' | 'info' = 'info') => setChildren(status, h('div', { class: `callout ${kind}` }, icon(kind === 'good' ? 'check' : kind === 'warn' ? 'alert' : 'info'), h('span', null, text)));

  const play = (id: string) => app.showScreen(renderNewGame(app, id));
  const edit = (pkg: MapPackage, asCopy: boolean) =>
    void import('./editor/editor').then(({ renderEditor }) => {
      let draft = pkg;
      if (asCopy) {
        const id = app.maps.freeId(`${pkg.id}-copy`);
        draft = { ...structuredClone(pkg), id, revision: 1, meta: { ...pkg.meta, name: `${pkg.meta.name} (copy)`, origin: 'custom' } };
      }
      app.showScreen(renderEditor(app, draft));
    });
  const exportMap = (pkg: MapPackage) => downloadText(`${pkg.id}.map.json`, JSON.stringify(pkg));

  const draw = () => {
    setChildren(
      builtins,
      BUILTIN_MAPS.map((id) => {
        const part = builtinScenario(id);
        return mapCard(id, part, [
          button('Play', () => play(id), { cls: 'primary', icon: 'play', fk: `play-${id}` }),
          button('Edit a copy', () => void builtinPackage(id as BuiltinMapId).then((pkg) => edit(pkg, true)), { icon: 'build', fk: `copy-${id}` }),
          button('Export', () => void builtinPackage(id as BuiltinMapId).then(exportMap), { cls: 'quiet', icon: 'download', fk: `export-${id}`, title: 'Save this map as a file (it can be imported again, or edited)' }),
        ]);
      }),
    );
    const list = app.maps.list();
    setChildren(
      mine,
      list.length
        ? list.map((m) =>
            mapCard(
              m.id,
              m.pkg,
              [
                button('Play', () => play(m.id), { cls: 'primary', icon: 'play', fk: `play-${m.id}` }),
                button('Edit', () => edit(m.pkg, false), { icon: 'build', fk: `edit-${m.id}` }),
                button('Export', () => exportMap(m.pkg), { cls: 'quiet', icon: 'download', fk: `export-${m.id}` }),
                button('', () => confirmDialog(app, 'Delete this map?', `${m.pkg.meta.name} will be removed from this browser's library. Campaigns already saved on it keep their own copy and still load. This cannot be undone.`, () => void app.maps.remove(m.id).then(() => (draw(), say(`${m.pkg.meta.name} was deleted.`))), 'Delete'), { cls: 'icon quiet', icon: 'close', title: 'Delete this map', fk: `delete-${m.id}` }),
              ],
              m.check.warnings.length ? h('div', { class: 'small muted' }, `${m.check.warnings.length} warning${m.check.warnings.length === 1 ? '' : 's'} from the validator (playable).`) : null,
            ),
          )
        : h('div', { class: 'callout info' }, icon('info'), h('span', null, 'No maps of your own yet. Make one with New map, edit a copy of a built-in map, or import a map file.')),
      app.maps.broken.map((b) =>
        h(
          'div',
          { class: 'callout warn' },
          icon('alert'),
          h('span', null, `A stored map ("${b.key}") no longer passes the checks: ${b.message} It is kept until you delete it.`),
          button('Delete', () => void app.maps.removeBroken(b.key).then(draw), { cls: 'quiet' }),
        ),
      ),
    );
  };

  const importBtn = button(
    'Import map',
    async () => {
      const text = await pickFile('.json,application/json');
      if (!text) return;
      if (text === '__too_big__') return refusedDialog(app, 'This map cannot be imported', { ok: false, errors: [{ code: 'limit', message: 'The file is larger than 20 MB; maps may be at most 8 MB.' }], warnings: [] });
      try {
        const r = await app.maps.importText(text);
        if (!r.map) return refusedDialog(app, 'This map cannot be imported', r.check);
        draw();
        const parts = [`${r.map.pkg.meta.name} was added to your maps.`];
        if (r.renamed) parts.push(`Its id "${r.renamed.from}" was already taken, so it is stored as "${r.renamed.to}".`);
        if (r.check.warnings.length) parts.push(`${plural(r.check.warnings.length, 'warning')}: ${r.check.warnings.slice(0, 2).map((w) => w.message).join(' ')}`);
        say(parts.join(' '), r.check.warnings.length ? 'warn' : 'good');
        builtins.parentElement?.querySelector(`[data-map="${CSS.escape(r.map.id)}"]`)?.scrollIntoView({ block: 'nearest' });
      } catch (e) {
        say(`The map could not be stored: ${(e as Error).message}`, 'warn');
      }
    },
    { icon: 'upload', fk: 'import-map' },
  );
  const newBtn = button('New map', () => void import('./editor/editor').then(({ renderEditor }) => app.showScreen(renderEditor(app, null))), { cls: 'primary', icon: 'plus', fk: 'new-map' });
  draw();
  return h(
    'div',
    { class: 'screen', role: 'main' },
    h(
      'div',
      { class: 'screen-scroll' },
      h(
        'div',
        { class: 'page wide' },
        h('header', null, button('Back', () => app.showMenu(), { cls: 'quiet', icon: 'chevronLeft' }), h('h2', null, 'Map library'), importBtn, newBtn),
        status,
        h('div', { class: 'eyebrow' }, 'Your maps'),
        mine,
        h('div', { class: 'eyebrow', style: 'margin-top:22px' }, 'Built-in maps'),
        builtins,
        h(
          'p',
          { class: 'small muted', style: 'margin-top:16px' },
          `Your maps are stored in this browser (${app.maps.mode}), apart from your saves; export a map to keep it elsewhere or share it. Every map file is checked by the same validator when it is imported, stored and played; files are read as data only, and nothing in them is ever run.`,
        ),
      ),
    ),
  );
}
