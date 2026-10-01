// The fixed weekly tick sequence.
//
//  1. Proposal expiry            (calls to arms honoured by default)
//  2. AI decisions               (same command path as the player)
//  3. Standing orders; the navy (fleet movement, naval battles, landings,
//     repair); then army movement & arrivals (id order; pinned armies stay)
//  4. Air (rebasing, mission upkeep, air combat), then battle detection +
//     one combat round per battle (retreats begin)
//  5. Sieges & occupation        (control changes -> supply network invalidated)
//  6. Army care                  (supply recomputed on the new map: attrition,
//                                 morale recovery, reinforcement)
//  7. Recruitment, shipyards, airfields & construction progress
//  8. War score refresh
//  9. End of month (every 4th week): economy -> research -> integration/unrest
//     -> diplomacy -> wars (exhaustion, forced peace) -> events -> victory
// Commands issued between ticks (e.g. while paused) apply immediately and are
// visible to every phase of the next tick.

import { runAI } from './ai/ai';
import { weeklyCombat, detectBattles } from './combat';
import { weeklyProposals } from './commands';
import { weeklyConstruction } from './construction';
import { weeklyAir, weeklyHangars } from './air';
import { monthlyEconomy } from './economy';
import { weeklyNaval, weeklyShipyards } from './naval';
import { monthlyEvents } from './events';
import { monthlyIntegration } from './integration';
import { weeklyArmyCare, weeklyRecruitment } from './military';
import { weeklyMovement, weeklyOrders } from './movement';
import { monthlyResearch } from './progression';
import { nextMemoEpoch } from './index';
import { weeklySieges } from './siege';
import { monthlyDiplomacy } from './diplomacy';
import { WEEKS_PER_MONTH, type Sim } from './state';
import { checkPlayerDefeat, monthlyVictory } from './victory';
import { monthlyWars, weeklyWarScores } from './war';

export interface StepOptions {
  /** skip AI decisions (for tests of pure rules) */
  noAI?: boolean;
  /**
   * Optional per-phase timing for benchmarks and the performance overlay. The
   * caller supplies the clock, so the simulation itself never reads wall-clock
   * time; timings are only accumulated, never used by any rule.
   */
  profile?: PhaseProfile;
}

export interface PhaseProfile {
  now: () => number;
  /** milliseconds spent per phase in the most recent step */
  last: Record<string, number>;
}

export function isOver(sim: Sim): boolean {
  return !!sim.state.result && !sim.state.continueAfterResult;
}

export function step(sim: Sim, opts: StepOptions = {}): void {
  const st = sim.state;
  if (isOver(sim)) return;
  const prof = opts.profile;
  if (prof) prof.last = {};
  const phase = (name: string, f: () => void) => {
    nextMemoEpoch();
    if (!prof) return f();
    const t = prof.now();
    f();
    prof.last[name] = (prof.last[name] ?? 0) + prof.now() - t;
  };
  phase('proposals', () => weeklyProposals(sim));
  if (!opts.noAI) phase('ai', () => runAI(sim, prof));
  phase('orders', () => weeklyOrders(sim));
  phase('naval', () => weeklyNaval(sim));
  phase('movement', () => weeklyMovement(sim));
  phase('air', () => weeklyAir(sim));
  phase('battles', () => {
    detectBattles(sim);
    weeklyCombat(sim);
  });
  phase('sieges', () => weeklySieges(sim));
  phase('armyCare', () => weeklyArmyCare(sim));
  phase('recruitment', () => {
    weeklyRecruitment(sim);
    weeklyShipyards(sim);
    weeklyHangars(sim);
  });
  phase('construction', () => weeklyConstruction(sim));
  phase('warScores', () => weeklyWarScores(sim));
  if ((st.tick + 1) % WEEKS_PER_MONTH === 0) {
    phase('m.economy', () => monthlyEconomy(sim));
    phase('m.research', () => monthlyResearch(sim));
    phase('m.integration', () => monthlyIntegration(sim));
    phase('m.diplomacy', () => monthlyDiplomacy(sim));
    phase('m.wars', () => monthlyWars(sim));
    phase('m.events', () => monthlyEvents(sim));
    phase('m.victory', () => {
      checkPlayerDefeat(sim);
      monthlyVictory(sim);
    });
  }
  checkPlayerDefeat(sim);
  st.tick++;
  nextMemoEpoch();
}

export function runTicks(sim: Sim, n: number, opts: StepOptions = {}): void {
  for (let i = 0; i < n && !isOver(sim); i++) step(sim, opts);
}
