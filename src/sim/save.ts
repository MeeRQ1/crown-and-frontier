// Save files: versioned, checksummed JSON of the complete GameState
// (including both PRNG streams, movement progress, battles, AI commitments).
// Static scenario data is rebuilt from the scenario id. No migrations exist yet:
// schema 1 is the first release format, and other versions are rejected with a
// clear message rather than loaded incorrectly.

import { SCHEMA_VERSION } from './config';
import { checkInvariants } from './invariants';
import { dateOf, type Sim } from './state';
import type { GameState } from './types';
import { getWorld, scenarioIds } from './world';

export const SAVE_FORMAT = 'crown-and-frontier-save';

export interface SaveMeta {
  nation: string | null;
  nationName: string;
  date: string;
  tick: number;
  savedAt: string;
  scenario: string;
}

export interface SaveFile {
  format: string;
  schema: number;
  checksum: string;
  meta: SaveMeta;
  state: GameState;
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
  return {
    nation: pn,
    nationName: pn ? sim.world.nationDefs[pn].name : 'Observer',
    date: dateOf(sim).label,
    tick: sim.state.tick,
    savedAt: new Date().toISOString(),
    scenario: sim.state.scenarioId,
  };
}

export function serialize(sim: Sim): string {
  const stateJson = JSON.stringify(sim.state);
  const meta = saveMeta(sim);
  return `{"format":"${SAVE_FORMAT}","schema":${SCHEMA_VERSION},"checksum":"${fnv1a(stateJson)}","meta":${JSON.stringify(meta)},"state":${stateJson}}`;
}

export class SaveError extends Error {}

/** Parses and validates a save. Throws SaveError with an actionable message. */
export function deserialize(text: string): Sim {
  let obj: SaveFile;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new SaveError('This file is not a readable save: it may be truncated or corrupted (JSON could not be parsed).');
  }
  if (!obj || typeof obj !== 'object' || obj.format !== SAVE_FORMAT) throw new SaveError('This file is not a Crown & Frontier save.');
  if (typeof obj.schema !== 'number') throw new SaveError('The save has no version number.');
  if (obj.schema > SCHEMA_VERSION) throw new SaveError(`This save was made by a newer version of the game (format ${obj.schema}; this build reads format ${SCHEMA_VERSION}). Update the game to load it.`);
  if (obj.schema < SCHEMA_VERSION) throw new SaveError(`This save uses an old format (${obj.schema}) that this build cannot convert (format ${SCHEMA_VERSION}).`);
  if (!obj.state || typeof obj.state !== 'object') throw new SaveError('The save contains no game state.');
  const stateJson = JSON.stringify(obj.state);
  if (obj.checksum && obj.checksum !== fnv1a(stateJson)) throw new SaveError('The save failed its integrity check (checksum mismatch): the file was modified or damaged.');
  const st = obj.state;
  if (!scenarioIds().includes(st.scenarioId)) throw new SaveError(`The save uses an unknown scenario "${st.scenarioId}".`);
  const world = getWorld(st.scenarioId);
  const required = ['provinces', 'nations', 'armies', 'battles', 'wars', 'treaties', 'rng', 'aiRng', 'settings', 'counters'] as const;
  for (const k of required) if (!(k in st)) throw new SaveError(`The save is missing required data (${k}).`);
  if (!Array.isArray(st.rng) || st.rng.length !== 4 || !Array.isArray(st.aiRng) || st.aiRng.length !== 4) throw new SaveError('The save has an invalid random-number state.');
  for (const pid of world.provIds) if (!st.provinces[pid]) throw new SaveError(`The save is missing province "${pid}".`);
  for (const nid of world.nationIds) if (!st.nations[nid]) throw new SaveError(`The save is missing realm "${nid}".`);
  for (const id in st.armies) {
    const a = st.armies[id];
    if (!world.prov[a.location] || !st.nations[a.nation]) throw new SaveError(`Army ${id} references a missing province or realm.`);
  }
  const sim: Sim = { world, state: st };
  const problems = checkInvariants(sim);
  if (problems.length) throw new SaveError(`The save is inconsistent: ${problems.slice(0, 3).join('; ')}.`);
  return sim;
}

/** Reads only the metadata (for save slot lists) without full validation. */
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
