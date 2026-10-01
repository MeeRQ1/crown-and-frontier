// Save migrations. Each step converts a parsed save from format n to n + 1 in
// place and explains what it did, so the player is told (never silently) that
// an old campaign was converted. A save that cannot be converted is refused
// with the reason; nothing is ever loaded half-converted.
//
// Format history (SCHEMA_VERSION in config.ts):
//   1  first release (v0.1, v0.2)
//   2  the state records its map fingerprint; saves of custom maps embed the map

import { SCHEMA_VERSION } from './config';
import type { MapFingerprint } from './types';
import { isBuiltinMap, mapFingerprint, mapScenarioPart } from './world';

/** A save as parsed from JSON, before validation. */
export interface RawSave {
  format: string;
  schema: number;
  checksum?: string;
  meta?: Record<string, unknown>;
  state: Record<string, unknown> & { schema?: number; scenarioId?: unknown; map?: MapFingerprint };
  mapPackage?: unknown;
}

export class MigrationError extends Error {}

type Step = (save: RawSave, notices: string[]) => void;

const STEPS: Record<number, Step> = {
  // 1 → 2: record which map the campaign is played on
  1: (save, notices) => {
    const id = save.state.scenarioId;
    if (typeof id !== 'string' || !isBuiltinMap(id)) {
      throw new MigrationError(`Format-1 saves were only made on the built-in maps, but this one names the map "${String(id)}".`);
    }
    save.state.map = { ...mapFingerprint(id) };
    save.state.schema = 2;
    save.schema = 2;
    const name = mapScenarioPart(id)?.meta.name ?? id;
    notices.push(
      `This save was made by an earlier version of the game (save format 1) and was converted to format 2. ` +
        `Format 1 did not record which version of the map it used, so the campaign continues on this version's ${name}. Saving again writes the new format.`,
    );
  },
};

/**
 * Brings a parsed save up to the current format. Returns the notices to show
 * the player; throws MigrationError when the save cannot be converted.
 */
export function migrateSave(save: RawSave): string[] {
  const notices: string[] = [];
  if (!Number.isInteger(save.schema) || save.schema < 1) throw new MigrationError(`The save has an invalid format number (${String(save.schema)}).`);
  while (save.schema < SCHEMA_VERSION) {
    const step = STEPS[save.schema];
    if (!step) throw new MigrationError(`Save format ${save.schema} cannot be converted to format ${SCHEMA_VERSION}.`);
    const from = save.schema;
    step(save, notices);
    if (save.schema !== from + 1) throw new MigrationError(`The conversion from save format ${from} did not complete.`);
  }
  return notices;
}
