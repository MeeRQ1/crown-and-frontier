// Deterministic replay: a fresh game with the same settings plus the logged
// player commands (applied before the tick they were issued in) reproduces a
// campaign exactly. Used by bug reports and tests.

import { applyCommand } from './commands';
import { createGame } from './game';
import { fnv1a } from './save';
import type { Sim } from './state';
import { step } from './tick';
import type { Command, Settings } from './types';

export function replayCommands(settings: Settings, scenario: string, log: Array<{ tick: number; cmd: Command }>, toTick: number): { sim: Sim; checksum: string; rejected: number } {
  const sim = createGame({
    scenario,
    seed: settings.seed,
    playerNation: settings.playerNation,
    difficulty: settings.difficulty,
    campaignYears: settings.campaignYears,
    aiIncomeBonus: settings.aiIncomeBonus,
  });
  let i = 0;
  let rejected = 0;
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
