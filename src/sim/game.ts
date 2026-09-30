// New-game construction.

import { C, SCHEMA_VERSION } from './config';
import { PERSONALITIES } from './data/personalities';
import { POLICY_COOLDOWN_MONTHS } from './data/policies';
import { computeLedger, reserveCap, stockpileCap, totalDev, menServing } from './economy';
import { createArmy, newRegiment } from './military';
import { seedState } from './rng';
import { months, ownedProvinces, type Sim } from './state';
import type { Difficulty, GameState, MonthlyLedger, NationId, NationState, Regiment, Settings, UnitType } from './types';
import { getWorld, validateScenario } from './world';
import { validateContent } from './content';

export interface NewGameOptions {
  scenario?: string;
  seed?: number;
  playerNation?: NationId | null;
  difficulty?: Difficulty;
  campaignYears?: number;
  aiIncomeBonus?: number;
}

function emptyLedger(): MonthlyLedger {
  return { tick: 0, income: {}, expenses: {}, suppliesIn: {}, suppliesOut: {}, manpowerIn: 0, researchGain: 0, net: 0, netSupplies: 0 };
}

export function createGame(opts: NewGameOptions = {}): Sim {
  const world = getWorld(opts.scenario ?? 'reach');
  const errs = [...validateScenario(world.scenario), ...validateContent(world.scenario)];
  if (errs.length) throw new Error(`Invalid scenario: ${errs.join('; ')}`);
  const seed = (opts.seed ?? 1) >>> 0;
  const settings: Settings = {
    difficulty: opts.difficulty ?? 'normal',
    campaignYears: opts.campaignYears ?? 40,
    seed,
    playerNation: opts.playerNation === undefined ? world.nationIds[0] : opts.playerNation,
    aiIncomeBonus: opts.aiIncomeBonus ?? 0,
    fogOfWar: false,
  };
  const st: GameState = {
    schema: SCHEMA_VERSION,
    scenarioId: world.scenario.id,
    tick: 0,
    rev: 0,
    settings,
    rng: seedState(seed),
    aiRng: seedState(seed ^ 0x5bd1e995),
    provinces: {},
    nations: {},
    armies: {},
    battles: {},
    wars: {},
    treaties: [],
    truces: [],
    memories: {},
    alarm: {},
    envoys: [],
    fabrications: [],
    coalitions: [],
    proposals: [],
    reports: [],
    notifications: [],
    counters: { army: 0, battle: 0, war: 0, treaty: 0, note: 0, proposal: 0, event: 0, regiment: 0, coalition: 0 },
    result: null,
    continueAfterResult: false,
    diagnostics: [],
    playerLog: [],
  };
  for (const p of world.scenario.provinces) {
    st.provinces[p.id] = {
      id: p.id,
      owner: p.owner,
      controller: p.owner,
      pop: p.pop,
      dev: p.dev,
      infra: p.infra,
      fort: p.fort,
      integration: p.owner ? p.integration : 0,
      unrest: p.owner ? Math.max(0, (100 - p.integration) / 3) : 0,
      project: null,
      siege: null,
      claims: [...p.claims],
      revoltUntil: 0,
      lastOwnerChange: 0,
      recruits: [],
    };
  }
  world.nationIds.forEach((nid, i) => {
    const def = world.nationDefs[nid];
    const pers = PERSONALITIES[def.personality];
    const n: NationState = {
      id: nid,
      alive: true,
      eliminatedTick: null,
      isPlayer: nid === settings.playerNation,
      capital: def.capital,
      treasury: 0,
      supplies: 0,
      manpower: 0,
      research: { current: null, progress: 0, done: [], funding: 1 },
      policy: pers.policies[0],
      policySince: -months(POLICY_COOLDOWN_MONTHS),
      warExhaustion: 0,
      trust: C.diplomacy.trustStart,
      debtMonths: 0,
      bankruptUntil: 0,
      modifiers: [],
      eventCooldowns: {},
      nextEventTick: months(C.events.firstMonths) + (i % 4) * 4,
      pendingEvents: [],
      victoryStreak: { territorial: 0, economic: 0, diplomatic: 0 },
      lastMonth: emptyLedger(),
      ai: {
        personality: def.personality,
        goal: { kind: 'develop', target: null, since: 0, score: 0, victory: pers.victory },
        warPlan: null,
        lastWarEnd: -1000,
        nextStrategic: i % 4,
        nextOperational: 0,
        lastPolicyEval: 0,
        objectives: {},
        armyTarget: 0,
        rally: null,
        lastPeaceTry: {},
        lastProposal: {},
      },
      stats: {
        battlesWon: 0,
        battlesLost: 0,
        menLost: 0,
        enemyKilled: 0,
        provincesGained: 0,
        provincesLost: 0,
        warsDeclared: 0,
        peacesMade: 0,
        bankruptcies: 0,
        peakProvinces: 0,
        idleArmyWeeks: 0,
        armyWeeks: 0,
      },
      armyCounter: 0,
    };
    st.nations[nid] = n;
  });
  const sim: Sim = { world, state: st };
  for (const nid of world.nationIds) {
    const n = st.nations[nid];
    const def = world.nationDefs[nid];
    const pers = PERSONALITIES[def.personality];
    n.treasury = 100 + 3 * totalDev(sim, nid);
    n.supplies = Math.round(stockpileCap(sim, nid) * 0.6);
    n.stats.peakProvinces = ownedProvinces(sim, nid).length;
    const reserve = reserveCap(sim, nid);
    const regs = Math.max(5, 3 + Math.round((reserve * 0.35) / C.regimentSize));
    let horse = Math.round(regs * pers.composition.horse);
    const guns = Math.round(regs * pers.composition.guns);
    if (def.traits.horseCostMul) horse += 2;
    const foot = Math.max(1, regs - horse - guns);
    const units: UnitType[] = [...Array(foot).fill('foot'), ...Array(horse).fill('horse'), ...Array(guns).fill('guns')];
    const regiments: Regiment[] = units.map((u) => newRegiment(sim, u));
    const cap = def.capital;
    if (regiments.length >= 6) {
      // a second, smaller army guards the most valuable other fortified or border province
      const owned = ownedProvinces(sim, nid).filter((p) => p !== cap);
      const border = owned.filter((p) => world.prov[p].neighbors.some((nb) => st.provinces[nb].owner && st.provinces[nb].owner !== nid));
      const pick = [...(border.length ? border : owned)].sort((a, b) => st.provinces[b].fort * 10 + st.provinces[b].dev - (st.provinces[a].fort * 10 + st.provinces[a].dev) || (a < b ? -1 : 1))[0];
      const second = Math.floor(regiments.length * 0.35);
      const detached = [...regiments.filter((r) => r.type === 'foot').slice(0, second)];
      createArmy(sim, nid, cap, regiments.filter((r) => !detached.includes(r)));
      if (pick && detached.length) createArmy(sim, nid, pick, detached);
      else if (detached.length) st.armies[Object.keys(st.armies).pop()!].regiments.push(...detached);
    } else createArmy(sim, nid, cap, regiments);
    n.manpower = Math.round(Math.max(0, reserve - menServing(sim, nid)) * C.population.startPoolShare);
  }
  for (const nid of world.nationIds) st.nations[nid].lastMonth = computeLedger(sim, nid);
  return sim;
}
