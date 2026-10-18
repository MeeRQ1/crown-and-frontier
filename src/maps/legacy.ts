// Earlier revisions of the built-in historical maps, kept so that campaigns begun on
// them keep loading after the map was redrawn (revision 2, format 9: denser provinces).
// A save records its map's id, revision and checksum; when the shipped map has since
// changed its provinces, the save continues on the revision it was made on, registered
// under its own id (`europe-r1`). The files load only when such a save is opened, so
// they cost nothing to anyone else.

import type { MapGeometryData, MapScenarioPart } from './format';
import { peekMeta } from '../sim/save';
import { mapFingerprint, registerMapAlias, scenarioIds } from '../sim/world';

type Json = { default: unknown };
interface Retained {
  scenario: () => Promise<Json>;
  geometry: () => Promise<Json>;
}

/** Retained revisions, by map id and revision. */
export const RETAINED: Record<string, Record<number, Retained>> = {
  europe: { 1: { scenario: () => import('../data/maps/legacy/europe-r1.scenario.json'), geometry: () => import('../data/maps/legacy/europe-r1.map.json') } },
  earth: { 1: { scenario: () => import('../data/maps/legacy/earth-r1.scenario.json'), geometry: () => import('../data/maps/legacy/earth-r1.map.json') } },
  'europe-1936': { 1: { scenario: () => import('../data/maps/legacy/europe-1936-r1.scenario.json'), geometry: () => import('../data/maps/legacy/europe-1936-r1.map.json') } },
  'earth-1936': { 1: { scenario: () => import('../data/maps/legacy/earth-1936-r1.scenario.json'), geometry: () => import('../data/maps/legacy/earth-1936-r1.map.json') } },
};

export const legacyId = (id: string, revision: number): string => `${id}-r${revision}`;

/** `europe-r1` → ['europe', 1]; null for any other id. */
export function parseLegacyId(id: string): [string, number] | null {
  const m = /^(.+)-r(\d+)$/.exec(id);
  return m && RETAINED[m[1]]?.[Number(m[2])] ? [m[1], Number(m[2])] : null;
}

const geometryLoaders = new Map<string, () => Promise<MapGeometryData>>();

/** The drawn half of a retained revision (for the map view), once it is registered. */
export function legacyGeometry(alias: string): (() => Promise<MapGeometryData>) | undefined {
  return geometryLoaders.get(alias);
}

/** Registers a retained revision (scenario and geometry); returns its id, or null if it is not kept. */
export async function ensureLegacyMap(id: string, revision: number): Promise<string | null> {
  const r = RETAINED[id]?.[revision];
  if (!r) return null;
  const alias = legacyId(id, revision);
  if (!scenarioIds().includes(alias)) {
    const raw = (await r.scenario()).default as MapScenarioPart & { generated?: string };
    const { generated: _note, ...pkg } = raw;
    void _note;
    registerMapAlias(alias, pkg as MapScenarioPart);
    geometryLoaders.set(alias, async () => (await r.geometry()).default as MapGeometryData);
  }
  return alias;
}

/** The map revision a save was made on: its metadata, or (older saves) its state. */
function savedRevision(text: string, meta: { mapRevision?: number }): number | undefined {
  if (meta.mapRevision !== undefined) return meta.mapRevision;
  try {
    const r = (JSON.parse(text) as { state?: { map?: { revision?: unknown } } }).state?.map?.revision;
    return typeof r === 'number' ? r : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Before a save is read: if it was made on a revision of a built-in map that has
 * since changed (or is already on a retained revision), make that revision available.
 * Reads only the save's metadata.
 */
export async function prepareSaveMap(text: string): Promise<void> {
  const meta = peekMeta(text);
  if (!meta?.scenario) return;
  const legacy = parseLegacyId(meta.scenario);
  if (legacy) {
    await ensureLegacyMap(legacy[0], legacy[1]);
    return;
  }
  if (!RETAINED[meta.scenario]) return;
  const revision = savedRevision(text, meta);
  if (revision !== undefined && mapFingerprint(meta.scenario).revision !== revision) await ensureLegacyMap(meta.scenario, revision);
}

/** Whether a save needs a retained revision that is not registered yet (a quick check before loading). */
export function needsLegacyMap(text: string): boolean {
  const meta = peekMeta(text);
  if (!meta?.scenario) return false;
  const legacy = parseLegacyId(meta.scenario);
  if (legacy) return !scenarioIds().includes(meta.scenario);
  if (!RETAINED[meta.scenario]) return false;
  const revision = savedRevision(text, meta);
  return revision !== undefined && !!RETAINED[meta.scenario][revision] && mapFingerprint(meta.scenario).revision !== revision && !scenarioIds().includes(legacyId(meta.scenario, revision));
}
