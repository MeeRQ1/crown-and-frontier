// Diagnostic bundle ("Export bug report" in the Chronicle): everything needed to
// reproduce a campaign exactly, plus recent context for reading it.
//
// Reproduction: a campaign started in this session replays from a fresh game
// with the same settings (and the custom map, if any); a campaign loaded from a
// save, or whose command log rolled over, replays from the checkpoint save it
// continued from. Either way the player's commands since the starting point are
// applied in the weeks they were issued and the final state checksum must match.
//
//   npx tsx tools/replay.ts crown-and-frontier-bug-<seed>-<tick>.json

import { checkMapObject } from '../maps/validate';
import { mapChecksum, type MapPackage } from '../maps/format';
import { createGame } from './game';
import { replayFrom, type CommandLog } from './replay';
import { fnv1a, readSave } from './save';
import { dateOf, type Sim } from './state';
import type { AIDiagnostic, MapFingerprint, Notification, Settings } from './types';
import { customMapPackage, isBuiltinMap, registerMapScenario } from './world';

export const DIAGNOSTIC_FORMAT = 'crown-and-frontier-diagnostic';
/** 1: settings + full command log (no format field); 2: adds checkpoint, map fingerprint and custom map */
export const DIAGNOSTIC_VERSION = 2;

export interface DiagnosticBundle {
  format: typeof DIAGNOSTIC_FORMAT;
  version: number;
  game: 'crown-and-frontier';
  build: string;
  userAgent: string;
  scenario: string;
  map: MapFingerprint;
  settings: Settings;
  tick: number;
  date: string;
  stateChecksum: string;
  /** the save this campaign continued from, if it did not start in this session */
  checkpoint: { tick: number; save: string } | null;
  /** player commands since the starting point */
  playerCommands: CommandLog;
  /** the custom map, for a campaign replayed from a fresh game */
  mapPackage?: MapPackage;
  recentNotifications: Notification[];
  aiDiagnostics: AIDiagnostic[];
  howToReproduce: string;
}

export function diagnosticBundle(sim: Sim, env: { build: string; userAgent: string }): DiagnosticBundle {
  const st = sim.state;
  const origin = sim.origin;
  return {
    format: DIAGNOSTIC_FORMAT,
    version: DIAGNOSTIC_VERSION,
    game: 'crown-and-frontier',
    build: env.build,
    userAgent: env.userAgent,
    scenario: st.scenarioId,
    map: st.map,
    settings: st.settings,
    tick: st.tick,
    date: dateOf(sim).label,
    stateChecksum: fnv1a(JSON.stringify(st)),
    checkpoint: origin ? { tick: origin.tick, save: origin.save } : null,
    playerCommands: origin ? st.playerLog.slice(origin.logLength) : st.playerLog,
    // a checkpoint save already carries its custom map
    mapPackage: origin ? undefined : customMapPackage(st.map),
    recentNotifications: st.notifications.slice(-60),
    aiDiagnostics: st.diagnostics.slice(-150),
    howToReproduce: 'npx tsx tools/replay.ts <this file>: replays the player commands from the starting point (a fresh game with these settings, or the checkpoint save) and compares stateChecksum.',
  };
}

export interface ReplayOutcome {
  reproduced: boolean;
  checksum: string;
  expected: string;
  rejected: number;
  commands: number;
  from: 'checkpoint' | 'fresh game';
  sim: Sim;
}

/** Replays a bug report (format 2, or the earlier format without checkpoints). */
export function replayBundle(raw: unknown): ReplayOutcome {
  const b = raw as Partial<DiagnosticBundle> & { playerCommands?: CommandLog };
  if (!b || typeof b !== 'object' || !Array.isArray(b.playerCommands) || typeof b.tick !== 'number' || typeof b.stateChecksum !== 'string') {
    throw new Error('This file is not a Crown & Frontier bug report.');
  }
  let sim: Sim;
  let from: ReplayOutcome['from'];
  if (b.checkpoint) {
    sim = readSave(b.checkpoint.save).sim;
    from = 'checkpoint';
  } else {
    if (!b.settings || typeof b.scenario !== 'string') throw new Error('The bug report has no settings to start from.');
    if (b.mapPackage !== undefined) {
      const { pkg, check } = checkMapObject(b.mapPackage);
      if (!pkg) throw new Error(`The map in the bug report is invalid: ${check.errors.slice(0, 3).map((e) => e.message).join('; ')}`);
      if (isBuiltinMap(pkg.id) || (b.map && mapChecksum(pkg) !== b.map.checksum)) throw new Error('The map in the bug report does not match the campaign.');
      registerMapScenario(pkg);
    }
    sim = createGame({
      scenario: b.scenario,
      seed: b.settings.seed,
      playerNation: b.settings.playerNation,
      difficulty: b.settings.difficulty,
      campaignYears: b.settings.campaignYears,
      aiIncomeBonus: b.settings.aiIncomeBonus,
    });
    from = 'fresh game';
  }
  const r = replayFrom(sim, b.playerCommands, b.tick);
  return { reproduced: r.checksum === b.stateChecksum, checksum: r.checksum, expected: b.stateChecksum, rejected: r.rejected, commands: b.playerCommands.length, from, sim: r.sim };
}
