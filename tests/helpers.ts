// Test helpers: a small synthetic scenario and shortcuts.
//
//   a1 ─ a2 ─ a3 ─ b3 ─ b1 ─ b2 ─ c1 ─ c2
//         \              /
//          ──── m1 ─────          (m1: unclaimed mountains)
//   a1 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ c2   (sea strait)
//   a3 | b3 is a river border
//   deposits: a2 coal, b1 iron, b2 oil, c1 rubber, c2 nitrates

import { UNIT_TYPES } from '../src/sim/config';
import { createGame, type NewGameOptions } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import type { Sim } from '../src/sim/state';
import type { NationDef, ProvinceDef, ScenarioDef, Terrain, UnitType } from '../src/sim/types';
import { registerScenario } from '../src/sim/world';

function prov(id: string, terrain: Terrain, owner: string | null, neighbors: string[], extra: Partial<ProvinceDef> = {}): ProvinceDef {
  return { id, name: id.toUpperCase(), terrain, resource: null, owner, dev: 3, pop: 40, region: owner ?? 'wild', infra: 0, fort: 0, integration: owner ? 100 : 0, claims: [], neighbors, ...extra };
}

function nation(id: string, capital: string, personality: NationDef['personality'] = 'commercial'): NationDef {
  return { id, name: `Realm ${id.toUpperCase()}`, short: id.toUpperCase(), adjective: id.toUpperCase(), color: '#888888', capital, personality, emblem: 'x', summary: '', strength: '', constraint: '', traits: {} };
}

export function lineScenario(): ScenarioDef {
  return {
    id: 'test-line',
    name: 'Test line',
    description: 'synthetic',
    startYear: 1880,
    nations: [nation('a', 'a1'), nation('b', 'b1'), nation('c', 'c1')],
    regions: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'wild', name: 'Wild' }],
    straits: [['a1', 'c2']],
    rivers: [['a3', 'b3']],
    provinces: [
      prov('a1', 'plains', 'a', ['a2', 'c2']),
      prov('a2', 'plains', 'a', ['a1', 'a3', 'm1'], { resource: 'coal' }),
      prov('a3', 'hills', 'a', ['a2', 'b3']),
      prov('b3', 'forest', 'b', ['a3', 'b1']),
      prov('b1', 'plains', 'b', ['b3', 'b2', 'm1'], { resource: 'iron' }),
      prov('b2', 'plains', 'b', ['b1', 'c1'], { resource: 'oil' }),
      prov('c1', 'plains', 'c', ['b2', 'c2'], { resource: 'rubber' }),
      prov('c2', 'plains', 'c', ['c1', 'a1'], { resource: 'nitrates' }),
      prov('m1', 'mountains', null, ['a2', 'b1'], { dev: 1, pop: 5 }),
    ],
  };
}

registerScenario('test-line', lineScenario);

/** A test game on the line scenario with starting armies removed (for precise setups). */
export function lineGame(opts: NewGameOptions = {}, keepArmies = false): Sim {
  const sim = createGame({ scenario: 'test-line', seed: 42, playerNation: null, ...opts });
  if (!keepArmies) sim.state.armies = {};
  return sim;
}

export function addArmy(sim: Sim, nid: string, pid: string, units: Partial<Record<UnitType, number>>, men = 1000) {
  const regs = [];
  for (const t of UNIT_TYPES) for (let i = 0; i < (units[t] ?? 0); i++) regs.push(newRegiment(sim, t, men));
  return createArmy(sim, nid, pid, regs);
}

export function totalMen(sim: Sim, nid?: string): number {
  let m = 0;
  for (const a of Object.values(sim.state.armies)) if (!nid || a.nation === nid) for (const r of a.regiments) m += r.men;
  return m;
}
