// Deterministic replay: the same starting point plus the logged player commands
// (applied before the tick they were issued in) reproduces a campaign exactly.
// The starting point is a fresh game with the same settings or, for a campaign
// that was loaded from a save (or whose command log rolled over), the
// checkpoint save it continued from. Used by bug reports and tests.

import { applyCommand } from './commands';
import { createGame } from './game';
import { fnv1a } from './save';
import type { Sim } from './state';
import { step } from './tick';
import type { Command, Settings } from './types';

export type CommandLog = Array<{ tick: number; cmd: Command }>;

/** Plays a campaign forward to `toTick`, applying each logged command in its week. */
export function replayFrom(sim: Sim, log: CommandLog, toTick: number): { sim: Sim; checksum: string; rejected: number } {
  let i = 0;
  let rejected = 0;
  // commands logged before the starting point cannot apply
  while (i < log.length && log[i].tick < sim.state.tick) {
    rejected++;
    i++;
  }
  while (sim.state.tick <= toTick) {
    while (i < log.length && log[i].tick === sim.state.tick) {
      if (!applyCommand(sim, log[i].cmd).ok) rejected++;
      i++;
    }
    if (sim.state.tick === toTick) break;
    step(sim);
  }
  return { sim, checksum: fnv1a(JSON.stringify(sim.state)), rejected };
}

/** Replays from a fresh game with these settings. */
export function replayCommands(settings: Settings, scenario: string, log: CommandLog, toTick: number): { sim: Sim; checksum: string; rejected: number } {
  const sim = createGame({
    scenario,
    seed: settings.seed,
    playerNation: settings.playerNation,
    difficulty: settings.difficulty,
    campaignYears: settings.campaignYears,
    aiIncomeBonus: settings.aiIncomeBonus,
  });
  return replayFrom(sim, log, toTick);
}
