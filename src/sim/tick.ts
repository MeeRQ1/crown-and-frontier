// The fixed weekly tick sequence.
//
//  1. Proposal expiry            (calls to arms honoured by default)
//  2. AI decisions               (same command path as the player)
//     then the player's operations (format 8): the routine orders of delegated forces
//  3. Standing orders; the navy (fleet movement, air missions at sea, naval
//     battles, landings, repair); then army movement & arrivals (id order;
//     pinned armies stay) and battle detection (contact on arrival)
//  4. Air over land (rebasing, ground support for this week's battles,
//     interception, bombing, readiness), then one combat round per battle
//     with its air and naval fire support (retreats begin); coastal forts fire
//     back at the ships that shelled them
//  5. Sieges & occupation        (control changes -> supply network invalidated)
//  6. Army care                  (supply recomputed on the new map: attrition,
//                                 morale recovery, reinforcement)
//  7. Recruitment, shipyards, airfields & construction progress
//  8. War score refresh
//  9. End of month (every 4th week): economy -> research and national focus ->
//     integration/unrest -> diplomacy (influence, loans, blocs) -> wars
//     (exhaustion, forced settlements) -> events -> victory
// Commands issued between ticks (e.g. while paused) apply immediately and are
// visible to every phase of the next tick.
//
// A week can also be run in slices (weekSlices), so the browser spreads a long
// week over several frames. Phases are never split, and nothing outside the
// week may change the state between its slices: the app finishes the week in
// progress before it applies a command or saves.

import { aiSlices } from './ai/ai';
import { weeklyCombat, detectBattles } from './combat';
import { weeklyProposals } from './commands';
import { weeklyConstruction } from './construction';
import { weeklyAir, weeklyHangars } from './air';
import { monthlyEconomySteps } from './economy';
import { bombardFireBack, weeklyNaval, weeklyShipyards } from './naval';
import { resolveAirDrops } from './airborne';
import { monthlyEvents } from './events';
import { monthlyIntegration } from './integration';
import { weeklyArmyCareSteps, weeklyRecruitment } from './military';
import { weeklyMovement, weeklyOrders } from './movement';
import { monthlyResearch } from './progression';
import { monthlyFocus } from './focus';
import { nextMemoEpoch, restoreMemo, setMemoAside } from './index';
import { weeklySieges } from './siege';
import { weeklyOperationsSteps } from './ops/operations';
import { monthlyDiplomacy } from './diplomacy';
import { monthlyInfluenceSteps } from './influence';
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

/** Runs one week. */
export function step(sim: Sim, opts: StepOptions = {}): void {
  const week = weekSlices(sim, opts);
  while (!week.next().done);
}

/**
 * One week as a sequence of slices: it yields between phases and between the
 * realms the AI plans for. Running it to the end is exactly step().
 */
export function* weekSlices(sim: Sim, opts: StepOptions = {}): Generator<void, void, void> {
  const st = sim.state;
  if (isOver(sim)) return;
  const prof = opts.profile;
  if (prof) prof.last = {};
  const run = (name: string, f: () => void) => {
    if (!prof) return f();
    const t = prof.now();
    f();
    prof.last[name] = (prof.last[name] ?? 0) + prof.now() - t;
  };
  // between slices the week's memo tables are kept aside (see setMemoAside)
  function* pause(): Generator<void, void, void> {
    const own = setMemoAside();
    yield;
    restoreMemo(own);
  }
  function* phase(name: string, f: () => void): Generator<void, void, void> {
    nextMemoEpoch();
    run(name, f);
    yield* pause();
  }
  /** A phase that works in steps (a realm or a few armies at a time), a slice each. */
  function* phaseSteps(name: string, steps: Generator<void, void, void>): Generator<void, void, void> {
    nextMemoEpoch();
    let done = false;
    for (;;) {
      run(name, () => (done = !!steps.next().done));
      if (done) break;
      yield* pause();
    }
    yield* pause();
  }
  yield* phase('proposals', () => weeklyProposals(sim));
  if (!opts.noAI) {
    nextMemoEpoch();
    // one realm's plans a slice; only the time spent planning is counted
    const ai = aiSlices(sim, prof);
    let done = false;
    while (!done) {
      run('ai', () => (done = !!ai.next().done));
      if (!done) yield* pause();
    }
    yield* pause();
  }
  // the player's operations plan their routine orders (after the AI, before the standing orders),
  // through the command path; they run in replays too, so they are not in the player's log
  if (sim.state.operations && Object.keys(sim.state.operations).length) yield* phaseSteps('operations', weeklyOperationsSteps(sim));
  yield* phase('orders', () => weeklyOrders(sim));
  yield* phase('naval', () => weeklyNaval(sim));
  // contact is made on arrival: battles are known before the air phase plans support for them
  yield* phase('movement', () => {
    weeklyMovement(sim);
    // airborne operations land before contact is made: a drop on enemy troops is a battle this week
    resolveAirDrops(sim);
    detectBattles(sim);
  });
  yield* phase('air', () => weeklyAir(sim));
  yield* phase('battles', () => {
    weeklyCombat(sim);
    bombardFireBack(sim);
  });
  yield* phase('sieges', () => weeklySieges(sim));
  yield* phaseSteps('armyCare', weeklyArmyCareSteps(sim));
  yield* phase('recruitment', () => {
    weeklyRecruitment(sim);
    weeklyShipyards(sim);
    weeklyHangars(sim);
  });
  yield* phase('construction', () => weeklyConstruction(sim));
  yield* phase('warScores', () => weeklyWarScores(sim));
  if ((st.tick + 1) % WEEKS_PER_MONTH === 0) {
    yield* phaseSteps('m.economy', monthlyEconomySteps(sim));
    yield* phase('m.research', () => {
      monthlyResearch(sim);
      monthlyFocus(sim);
    });
    yield* phase('m.integration', () => monthlyIntegration(sim));
    yield* phaseSteps(
      'm.diplomacy',
      (function* () {
        monthlyDiplomacy(sim);
        yield* monthlyInfluenceSteps(sim);
      })(),
    );
    yield* phase('m.wars', () => monthlyWars(sim));
    yield* phase('m.events', () => monthlyEvents(sim));
    yield* phase('m.victory', () => {
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
