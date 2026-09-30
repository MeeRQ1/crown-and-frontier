// The fixed weekly tick sequence.
//
//  1. Proposal expiry            (calls to arms honoured by default)
//  2. AI decisions               (same command path as the player)
//  3. Standing orders, then movement & arrivals (id order; pinned armies stay)
//  4. Battle detection + one combat round per battle (retreats begin)
//  5. Sieges & occupation        (control changes -> supply network invalidated)
//  6. Army care                  (supply recomputed on the new map: attrition,
//                                 morale recovery, reinforcement)
//  7. Recruitment & construction progress
//  8. War score refresh
//  9. End of month (every 4th week): economy -> research -> integration/unrest
//     -> diplomacy -> wars (exhaustion, forced peace) -> events -> victory
// Commands issued between ticks (e.g. while paused) apply immediately and are
// visible to every phase of the next tick.

import { runAI } from './ai/ai';
import { weeklyCombat, detectBattles } from './combat';
import { weeklyProposals } from './commands';
import { weeklyConstruction } from './construction';
import { monthlyEconomy } from './economy';
import { monthlyEvents } from './events';
import { monthlyIntegration } from './integration';
import { weeklyArmyCare, weeklyRecruitment } from './military';
import { weeklyMovement, weeklyOrders } from './movement';
import { monthlyResearch } from './progression';
import { weeklySieges } from './siege';
import { monthlyDiplomacy } from './diplomacy';
import { WEEKS_PER_MONTH, type Sim } from './state';
import { checkPlayerDefeat, monthlyVictory } from './victory';
import { monthlyWars, weeklyWarScores } from './war';

export interface StepOptions {
  /** skip AI decisions (for tests of pure rules) */
  noAI?: boolean;
}

export function isOver(sim: Sim): boolean {
  return !!sim.state.result && !sim.state.continueAfterResult;
}

export function step(sim: Sim, opts: StepOptions = {}): void {
  const st = sim.state;
  if (isOver(sim)) return;
  weeklyProposals(sim);
  if (!opts.noAI) runAI(sim);
  weeklyOrders(sim);
  weeklyMovement(sim);
  detectBattles(sim);
  weeklyCombat(sim);
  weeklySieges(sim);
  weeklyArmyCare(sim);
  weeklyRecruitment(sim);
  weeklyConstruction(sim);
  weeklyWarScores(sim);
  if ((st.tick + 1) % WEEKS_PER_MONTH === 0) {
    monthlyEconomy(sim);
    monthlyResearch(sim);
    monthlyIntegration(sim);
    monthlyDiplomacy(sim);
    monthlyWars(sim);
    monthlyEvents(sim);
    checkPlayerDefeat(sim);
    monthlyVictory(sim);
  }
  checkPlayerDefeat(sim);
  st.tick++;
}

export function runTicks(sim: Sim, n: number, opts: StepOptions = {}): void {
  for (let i = 0; i < n && !isOver(sim); i++) step(sim, opts);
}
