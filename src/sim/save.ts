// Save files: versioned, checksummed JSON of the complete GameState
// (including both PRNG streams, movement progress, battles, AI commitments).
// Static map data is rebuilt from the map id; a save of a map that does not
// ship with the game embeds the whole map package, so it loads anywhere.
//
// Older formats are converted step by step (migrate.ts) and the player is told;
// newer or unconvertible saves are refused with a clear message. A save is
// never loaded on a map other than the one it records: if the map's content
// changed since (another revision), the save loads only when the provinces and
// realms are the same, with a notice; otherwise it is refused.

import { SCHEMA_VERSION } from './config';
import { checkInvariants } from './invariants';
import { addForceDefaults, MigrationError, migrateSave, type RawSave } from './migrate';
import { startingFleets } from './naval';
import { dateOf, type Sim } from './state';
import type { GameState, MapFingerprint } from './types';
import { customMapPackage, getWorld, isBuiltinMap, mapFingerprint, mapScenarioPart, registerMapScenario, scenarioIds } from './world';
import { checkMapObject } from '../maps/validate';
import { mapChecksum, type MapPackage } from '../maps/format';

export const SAVE_FORMAT = 'crown-and-frontier-save';
/** Largest save this build reads (a save may embed a custom map of up to 8 MB). */
export const SAVE_LIMIT_BYTES = 20_000_000;

export interface SaveMeta {
  nation: string | null;
  nationName: string;
  date: string;
  tick: number;
  savedAt: string;
  scenario: string;
  /** map name and revision (format 2) */
  mapName?: string;
  mapRevision?: number;
  /** the save carries its own (custom) map */
  customMap?: boolean;
}

export interface SaveFile {
  format: string;
  schema: number;
  checksum: string;
  meta: SaveMeta;
  state: GameState;
  /** the whole package of a map that does not ship with the game */
  mapPackage?: MapPackage;
}

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function saveMeta(sim: Sim): SaveMeta {
  const pn = sim.state.settings.playerNation;
  const part = mapScenarioPart(sim.state.scenarioId);
  return {
    nation: pn,
    nationName: pn ? sim.world.nationDefs[pn].name : 'Observer',
    date: dateOf(sim).label,
    tick: sim.state.tick,
    savedAt: new Date().toISOString(),
    scenario: sim.state.scenarioId,
    mapName: part?.meta.name ?? sim.world.scenario.name,
    mapRevision: sim.state.map.revision,
    customMap: !!customMapPackage(sim.state.map),
  };
}

export function serialize(sim: Sim): string {
  const stateJson = JSON.stringify(sim.state);
  const meta = saveMeta(sim);
  const custom = customMapPackage(sim.state.map);
  // the map goes after the state, so peekMeta() can read the metadata without parsing it
  const map = custom ? `,"mapPackage":${JSON.stringify(custom)}` : '';
  return `{"format":"${SAVE_FORMAT}","schema":${SCHEMA_VERSION},"checksum":"${fnv1a(stateJson)}","meta":${JSON.stringify(meta)},"state":${stateJson}${map}}`;
}

export class SaveError extends Error {}

export interface LoadedSave {
  sim: Sim;
  /** what the player should be told: conversions from older formats, map revisions */
  notices: string[];
  /** the custom map the save carried (already registered for the simulation) */
  mapPackage?: MapPackage;
}

/** Parses and validates a save. Throws SaveError with an actionable message. */
export function deserialize(text: string): Sim {
  return readSave(text).sim;
}

/**
 * Parses, converts and validates a save. A custom map embedded in the save is
 * validated like an imported map and registered for the simulation.
 */
export function readSave(text: string): LoadedSave {
  if (text.length > SAVE_LIMIT_BYTES) throw new SaveError(`This file is too large to be a save (${(text.length / 1e6).toFixed(1)} MB; saves are at most ${SAVE_LIMIT_BYTES / 1e6} MB).`);
  let obj: RawSave;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new SaveError('This file is not a readable save: it may be truncated or corrupted (JSON could not be parsed).');
  }
  if (!obj || typeof obj !== 'object' || obj.format !== SAVE_FORMAT) throw new SaveError('This file is not a Crown & Frontier save.');
  if (typeof obj.schema !== 'number') throw new SaveError('The save has no version number.');
  if (obj.schema > SCHEMA_VERSION) throw new SaveError(`This save was made by a newer version of the game (format ${obj.schema}; this build reads formats up to ${SCHEMA_VERSION}). Update the game to load it.`);
  if (!obj.state || typeof obj.state !== 'object') throw new SaveError('The save contains no game state.');
  if (obj.checksum && obj.checksum !== fnv1a(JSON.stringify(obj.state))) throw new SaveError('The save failed its integrity check (checksum mismatch): the file was modified or damaged.');
  let notices: string[];
  try {
    notices = migrateSave(obj);
  } catch (e) {
    if (e instanceof MigrationError) throw new SaveError(`This save uses an old format that cannot be converted: ${e.message}`);
    throw e;
  }
  const st = obj.state as unknown as GameState;
  const recorded = st.map;
  if (!recorded || typeof recorded !== 'object' || typeof recorded.id !== 'string' || typeof recorded.checksum !== 'string' || recorded.id !== st.scenarioId) {
    throw new SaveError('The save does not record which map it was played on.');
  }

  let mapPackage: MapPackage | undefined;
  if (obj.mapPackage !== undefined) mapPackage = embeddedMap(obj.mapPackage, recorded);
  if (!scenarioIds().includes(st.scenarioId)) {
    throw new SaveError(`This save was played on the map "${st.scenarioId}", which this version of the game does not include, and the save does not contain it.`);
  }
  const world = getWorld(st.scenarioId);
  const required = ['provinces', 'nations', 'armies', 'battles', 'wars', 'treaties', 'rng', 'aiRng', 'settings', 'counters'] as const;
  for (const k of required) if (!(k in st)) throw new SaveError(`The save is missing required data (${k}).`);
  if (!Array.isArray(st.rng) || st.rng.length !== 4 || !Array.isArray(st.aiRng) || st.aiRng.length !== 4) throw new SaveError('The save has an invalid random-number state.');

  // the same map? the same content, or at least the same provinces and realms
  const current = mapFingerprint(st.scenarioId);
  const sameShape = sameKeys(st.provinces, world.provIds) && sameKeys(st.nations, world.nationIds);
  const name = mapScenarioPart(st.scenarioId)?.meta.name ?? world.scenario.name;
  if (recorded.checksum !== current.checksum) {
    if (!sameShape) {
      throw new SaveError(
        `This campaign was saved on revision ${recorded.revision} of ${name}, but this version of the game has revision ${current.revision}, whose provinces or realms are different. Load it with the version of the game that made it.`,
      );
    }
    notices.push(`This campaign was saved on revision ${recorded.revision} of ${name}; this version of the game has revision ${current.revision}. It continues on the current map, where some borders, rules or realm details may differ from when it was saved.`);
    st.map = { ...current };
  }
  for (const pid of world.provIds) if (!st.provinces[pid]) throw new SaveError(`The save is missing province "${pid}".`);
  for (const pid in st.provinces) if (!world.prov[pid]) throw new SaveError(`The save has a province "${pid}" that its map does not have.`);
  for (const nid of world.nationIds) if (!st.nations[nid]) throw new SaveError(`The save is missing realm "${nid}".`);
  for (const id in st.armies) {
    const a = st.armies[id];
    if (!world.prov[a.location] || !st.nations[a.nation]) throw new SaveError(`Army ${id} references a missing province or realm.`);
  }
  const sim: Sim = { world, state: st };
  // fleets and air forces: a converted 17th-century save gets its home squadrons
  // now that its map is loaded; a save from a development build of format 3
  // that predates them gets the same, with a notice
  const raw = st as unknown as Record<string, unknown>;
  if (!raw.fleets || !raw.wings) {
    addForceDefaults(raw, (pid) => world.prov[pid]?.port ?? 0);
    notices.push('This save was made before fleets and air forces existed. Every coastal realm received ports and a home squadron; nothing else changed.');
  }
  if (raw.pendingFleets) {
    delete raw.pendingFleets;
    startingFleets(sim);
  }
  const problems = checkInvariants(sim);
  if (problems.length) throw new SaveError(`The save is inconsistent: ${problems.slice(0, 3).join('; ')}.`);
  // bug reports from this campaign replay from the state as loaded
  sim.origin = { save: serialize(sim), tick: st.tick, logLength: st.playerLog.length };
  return { sim, notices, mapPackage };
}

function sameKeys(rec: Record<string, unknown>, ids: readonly string[]): boolean {
  return !!rec && typeof rec === 'object' && Object.keys(rec).length === ids.length && ids.every((id) => id in rec);
}

/** Validates a map embedded in a save like an imported map, and registers it. */
function embeddedMap(raw: unknown, recorded: MapFingerprint): MapPackage {
  const { pkg, check } = checkMapObject(raw);
  if (!pkg) throw new SaveError(`The map stored in this save is invalid: ${check.errors.slice(0, 3).map((e) => e.message).join('; ')}.`);
  if (isBuiltinMap(pkg.id)) throw new SaveError(`The map stored in this save uses the name of a built-in map ("${pkg.id}").`);
  if (pkg.id !== recorded.id || mapChecksum(pkg) !== recorded.checksum) throw new SaveError('The map stored in this save does not match the campaign (checksum mismatch): the file was modified or damaged.');
  registerMapScenario(pkg);
  return pkg;
}

/** Reads only the metadata (for save slot lists) without full validation. */
/** The save format number, read without parsing the whole file. */
export function peekSchema(text: string): number | null {
  const m = /"schema":(\d+)/.exec(text.slice(0, 200));
  return m ? Number(m[1]) : null;
}

export function peekMeta(text: string): SaveMeta | null {
  try {
    const i = text.indexOf('"meta":');
    const j = text.indexOf(',"state":');
    if (i < 0 || j < 0) return null;
    return JSON.parse(text.slice(i + 7, j));
  } catch {
    return null;
  }
}
