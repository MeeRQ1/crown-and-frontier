// The map library: maps made in the editor or imported from files, kept in
// this browser as plain map-package JSON (a store of their own, apart from the
// saves). A map is validated when it is stored and again whenever it is read
// back; nothing in a map file is ever run. Valid maps are registered for the
// simulation and the renderer, so they appear in the campaign setup.

import { mapChecksum, type MapPackage } from '../maps/format';
import { parseMapPackage, validateMapPackage, type MapCheck } from '../maps/validate';
import { isBuiltinMap, registerMapScenario } from '../sim/world';
import { registerPackageGeometry } from './map/maps';
import { SaveStore } from './storage';

export interface LibraryMap {
  id: string;
  pkg: MapPackage;
  check: MapCheck;
  /** bytes as stored */
  size: number;
}

export interface BrokenMap {
  key: string;
  message: string;
}

/** A map id from free text: lower-case letters, digits and dashes. */
export function mapIdFrom(text: string): string {
  const id = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  return id.length >= 2 ? id : `map-${id || 'new'}`;
}

/** Key of the editor's unfinished work (kept apart from the finished maps). */
const DRAFT = '~draft';

export class MapLibrary {
  readonly store = new SaveStore('crown-and-frontier-maps', 'maps', 'cnf-map:');
  private maps = new Map<string, LibraryMap>();
  /** stored entries that no longer pass the validator (kept, never deleted silently) */
  broken: BrokenMap[] = [];

  async init(): Promise<void> {
    await this.store.init();
    await this.reload();
  }

  get mode(): string {
    return this.store.mode;
  }

  async reload(): Promise<void> {
    this.maps.clear();
    this.broken = [];
    const keys = await this.store.keys().catch(() => [] as string[]);
    for (const key of keys.sort()) {
      if (key.startsWith(DRAFT)) continue;
      const text = await this.store.get(key).catch(() => null);
      if (!text) continue;
      const { pkg, check } = parseMapPackage(text);
      if (!pkg) {
        this.broken.push({ key, message: check.errors[0]?.message ?? 'The stored map cannot be read.' });
        continue;
      }
      if (pkg.id !== key || isBuiltinMap(pkg.id)) {
        this.broken.push({ key, message: `The stored map has the id "${pkg.id}", which does not match its place in the library.` });
        continue;
      }
      this.maps.set(pkg.id, { id: pkg.id, pkg, check, size: text.length });
    }
    this.registerAll();
  }

  /** Makes every library map playable (again: a loaded save may have registered another version of one). */
  registerAll(): void {
    for (const m of this.maps.values()) {
      registerMapScenario(m.pkg);
      registerPackageGeometry(m.pkg);
    }
  }

  list(): LibraryMap[] {
    return [...this.maps.values()].sort((a, b) => a.pkg.meta.name.localeCompare(b.pkg.meta.name));
  }

  get(id: string): LibraryMap | undefined {
    return this.maps.get(id);
  }

  has(id: string): boolean {
    return this.maps.has(id);
  }

  /** An id that is neither a built-in map nor already in the library. */
  freeId(base: string): string {
    const root = mapIdFrom(base);
    let id = root;
    for (let k = 2; isBuiltinMap(id) || this.maps.has(id); k++) id = `${root.slice(0, 34)}-${k}`;
    return id;
  }

  /**
   * Stores a map (new, or replacing the library's map with the same id). The
   * map must pass the validator. When an existing map's gameplay content
   * changes, its revision goes up, so campaigns saved on the old version say so.
   */
  async save(pkg: MapPackage): Promise<MapCheck> {
    if (isBuiltinMap(pkg.id)) return { ok: false, errors: [{ code: 'id', message: `"${pkg.id}" is the id of a built-in map; give the map another id.` }], warnings: [] };
    const prev = this.maps.get(pkg.id);
    if (prev && mapChecksum(prev.pkg) !== mapChecksum(pkg) && pkg.revision <= prev.pkg.revision) pkg = { ...pkg, revision: prev.pkg.revision + 1 };
    const text = JSON.stringify(pkg);
    // the stored text is read back through the same path as an imported file
    const { pkg: clean, check } = parseMapPackage(text);
    if (!clean) return check;
    await this.store.put(clean.id, text);
    this.maps.set(clean.id, { id: clean.id, pkg: clean, check, size: text.length });
    registerMapScenario(clean);
    registerPackageGeometry(clean);
    return check;
  }

  /** Reads a map file for import. A clashing id is changed (and the change reported). */
  async importText(text: string): Promise<{ map: LibraryMap | null; check: MapCheck; renamed?: { from: string; to: string } }> {
    const { pkg, check } = parseMapPackage(text);
    if (!pkg) return { map: null, check };
    let renamed: { from: string; to: string } | undefined;
    let next = pkg;
    if (isBuiltinMap(pkg.id) || this.maps.has(pkg.id)) {
      const to = this.freeId(pkg.id);
      renamed = { from: pkg.id, to };
      next = { ...pkg, id: to, meta: { ...pkg.meta, origin: 'custom' } };
    }
    if (next.meta.origin === 'builtin') next = { ...next, meta: { ...next.meta, origin: 'custom' } };
    const saved = await this.save(next);
    return { map: saved.ok ? (this.maps.get(next.id) ?? null) : null, check: saved, renamed };
  }

  async remove(id: string): Promise<void> {
    await this.store.remove(id);
    this.maps.delete(id);
  }

  async removeBroken(key: string): Promise<void> {
    await this.store.remove(key);
    this.broken = this.broken.filter((b) => b.key !== key);
  }

  /** The editor's working copy: kept even while it has errors, never listed or played. */
  async saveDraft(text: string): Promise<void> {
    await this.store.put(DRAFT, text);
  }

  async loadDraft(): Promise<string | null> {
    return this.store.get(DRAFT).catch(() => null);
  }

  async clearDraft(): Promise<void> {
    await this.store.remove(DRAFT).catch(() => undefined);
  }

  /** Validation of a package (the editor checks drafts without storing them). */
  static check(pkg: MapPackage): MapCheck {
    return validateMapPackage(pkg);
  }
}
