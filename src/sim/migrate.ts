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
import { mapScenarioPart } from './world';

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

/**
 * The maps format-1 saves were made on: revision 1 of the built-in maps (the
 * first two releases; Aldmere exists only in the second). Pinned here so that a
 * later revision of a built-in map is recognised as a change, not assumed.
 */
export const FORMAT1_MAPS: Readonly<Record<string, MapFingerprint>> = {
  reach: { id: 'reach', revision: 1, checksum: '1953242e' },
  aldmere: { id: 'aldmere', revision: 1, checksum: '3ee14fac' },
};

const STEPS: Record<number, Step> = {
  // 1 → 2: record which map the campaign is played on
  1: (save, notices) => {
    const id = save.state.scenarioId;
    const fp = typeof id === 'string' ? FORMAT1_MAPS[id] : undefined;
    if (!fp) {
      throw new MigrationError(`Format-1 saves were only made on the built-in maps, but this one names the map "${String(id)}".`);
    }
    save.state.map = { ...fp };
    save.state.schema = 2;
    save.schema = 2;
    const name = mapScenarioPart(fp.id)?.meta.name ?? fp.id;
    notices.push(
      `This save was made by an earlier version of the game (save format 1) and was converted to format 2. ` +
        `Format 1 did not record which version of the map it used, so the campaign continues on ${name} as this version of the game has it. Saving again writes the new format.`,
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
