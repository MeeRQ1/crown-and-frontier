// The large-force campaign for the quality-of-life checks (operations, unit-view
// filters, province batches), built with the real simulation code: Europe 1936
// as Germany with more than 100 regiments, fleets and aircraft, at war with
// Poland and France; Italy is allied and fights beside us; Czechoslovakia,
// Denmark, the Netherlands and the rest are neutral.
//   used by tools/qol-audit.ts, tools/qol-demo.ts and the tests

import { createWing } from '../src/sim/air';
import { removeTreaty, signTreaty } from '../src/sim/diplomacy';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import { createFleet, newShip, portsOf } from '../src/sim/naval';
import { serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/state';
import type { NationId, ProvinceId, ShipType, UnitType, WingType } from '../src/sim/types';
import { breakTies, declareWar, joinWar } from '../src/sim/war';

const TECH = ['aviation', 'fighters', 'ground_attack', 'strategic_bombing', 'all_metal_aircraft', 'air_defence', 'airborne_forces', 'naval_aviation', 'engineering_corps'];

export interface LargeForce {
  sim: Sim;
  /** our armies by front */
  east: string[];
  west: string[];
  /** neighbours that stay out of the war */
  neutrals: NationId[];
}

/** German provinces bordering a realm, sorted by id. */
function border(sim: Sim, nid: NationId, other: NationId): ProvinceId[] {
  const st = sim.state;
  return sim.world.provIds.filter((p) => st.provinces[p].owner === nid && sim.world.prov[p].neighbors.some((n) => st.provinces[n].owner === other)).sort();
}

/** `scenario`: Europe 1936 as shipped, or a retained revision of it (`europe-1936-r1`, registered by the caller). */
export function largeForce(seed = 3, scenario = 'europe-1936'): LargeForce {
  const sim = createGame({ scenario, seed, playerNation: 'ger' });
  const st = sim.state;
  for (const nid of ['ger', 'pol', 'fra', 'ita']) {
    const n = st.nations[nid];
    for (const t of TECH) if (!n.research.done.includes(t)) n.research.done.push(t);
    n.treasury = Math.max(n.treasury, 4000);
    n.materiel = Math.max(n.materiel, 3000);
  }
  signTreaty(sim, 'alliance', 'ger', 'ita');
  // pacts with the realms we fight end with the war (as declaring it does through the command)
  for (const [a, b] of [['ger', 'pol'], ['ger', 'fra'], ['ger', 'rom'], ['ita', 'fra'], ['ita', 'pol'], ['ita', 'rom']]) {
    breakTies(sim, a, b);
    for (const t of ['nap', 'trade', 'alliance'] as const) removeTreaty(sim, t, a, b);
  }
  const polGoal = border(sim, 'pol', 'ger').slice(0, 3);
  const war = declareWar(sim, 'ger', 'pol', { type: 'conquest', provinces: polGoal });
  if (!war.defenders.includes('fra')) joinWar(sim, war, 'fra', 'defender');
  if (!war.attackers.includes('ita')) joinWar(sim, war, 'ita', 'attacker');
  // our starting armies are replaced by fronts of divisions-sized armies
  for (const a of Object.values(st.armies)) if (a.nation === 'ger') delete st.armies[a.id];
  const regs = (mix: Partial<Record<UnitType, number>>) => Object.entries(mix).flatMap(([t, n]) => Array.from({ length: n ?? 0 }, () => newRegiment(sim, t as UnitType)));
  const east = border(sim, 'ger', 'pol');
  const west = border(sim, 'ger', 'fra');
  const out: LargeForce = { sim, east: [], west: [], neutrals: [] };
  // 8 armies east (72 regiments), 4 west (36): 108 regiments
  for (let i = 0; i < 8; i++) out.east.push(createArmy(sim, 'ger', east[i % east.length], regs({ infantry: 6, artillery: 2, engineers: i % 4 === 0 ? 1 : 0, armour: i % 4 === 0 ? 0 : 1 })).id);
  for (let i = 0; i < 4; i++) out.west.push(createArmy(sim, 'ger', west[i % west.length], regs({ infantry: 7, artillery: 2 })).id);
  // two airborne regiments at an airfield in the east, with transports
  const field = east[0];
  st.provinces[field].airfield = 2;
  out.east.push(createArmy(sim, 'ger', field, regs({ airborne: 2 })).id);
  const wing = (nid: NationId, base: ProvinceId, t: WingType) => createWing(sim, nid, base, t);
  wing('ger', field, 'transport');
  wing('ger', field, 'transport');
  const fieldW = west[0];
  st.provinces[fieldW].airfield = 2;
  for (const t of ['fighter', 'fighter', 'attack', 'bomber'] as WingType[]) wing('ger', t === 'bomber' ? fieldW : east[1], t);
  st.provinces[east[1]].airfield = Math.max(st.provinces[east[1]].airfield, 2);
  // the navy: a Baltic squadron with transports, and a North Sea group
  const ships = (t: ShipType[]) => t.map((x) => newShip(sim, x));
  const ports = portsOf(sim, 'ger');
  const baltic = ports.find((p) => (sim.world.provZones[p] ?? []).some((z) => /baltic/i.test(sim.world.zones[z].name))) ?? ports[0];
  const north = ports.find((p) => (sim.world.provZones[p] ?? []).some((z) => /north|heligoland|german bight/i.test(sim.world.zones[z].name))) ?? ports[ports.length - 1];
  createFleet(sim, 'ger', sim.world.provZones[baltic][0], ships(['capital', 'cruiser', 'cruiser', 'screen', 'transport', 'transport', 'transport']), baltic, 'Baltic Squadron');
  createFleet(sim, 'ger', sim.world.provZones[north][0], ships(['capital', 'cruiser', 'screen', 'submarine']), north, 'North Sea Group');
  // the enemy's air arm and an Italian army near France
  const polField = border(sim, 'pol', 'ger')[0];
  st.provinces[polField].airfield = 1;
  wing('pol', polField, 'fighter');
  const fraFields = border(sim, 'fra', 'ger');
  st.provinces[fraFields[0]].airfield = 1;
  wing('fra', fraFields[0], 'fighter');
  wing('fra', fraFields[0], 'bomber');
  // neutral neighbours: whoever borders us and is not in the war
  const sides = new Set([...war.attackers, ...war.defenders]);
  out.neutrals = [...new Set(sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger').flatMap((p) => sim.world.prov[p].neighbors.map((n) => st.provinces[n].owner)))]
    .filter((n): n is NationId => !!n && !sides.has(n))
    .sort();
  return out;
}

export function largeForceSave(seed = 3): { text: string; force: LargeForce } {
  const force = largeForce(seed);
  return { text: serialize(force.sim), force };
}
