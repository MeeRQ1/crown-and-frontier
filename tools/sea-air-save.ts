// A prepared campaign for the navy and air browser checks and the Stage C
// screenshots, built with the real simulation code (tools/verify-web.ts,
// tools/shots-stage-c.ts).

import { createWing } from '../src/sim/air';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import { createFleet, newShip, removeFleet } from '../src/sim/naval';
import { serialize } from '../src/sim/save';
import type { ShipType, UnitType, WingType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';

/**
 * A Reach campaign as Serrata at war with Aurelian, prepared with the real
 * simulation code: transports and escorts off Calvi with an army to carry to
 * Westmere (whose only coast is the Calvi water, so the escorts blockade it),
 * and an air front at Duncairn (our airfield at Serenna, their fighters at Hollin).
 */
export function seaAirSave(): { text: string; ids: Record<string, string> } {
  const sim = createGame({ scenario: 'reach', seed: 5, playerNation: 'ser' });
  const st = sim.state;
  for (const n of ['ser', 'aur']) for (const t of ['aviation', 'fighters', 'ground_attack']) if (!st.nations[n].research.done.includes(t)) st.nations[n].research.done.push(t);
  declareWar(sim, 'ser', 'aur', { type: 'conquest', provinces: ['westmere'] });
  for (const f of Object.values(st.fleets)) if (f.nation === 'aur') removeFleet(sim, f, false);
  for (const a of Object.values(st.armies)) if (a.location === 'westmere' || a.location === 'duncairn') delete st.armies[a.id];
  const ships = (types: ShipType[]) => types.map((t) => newShip(sim, t));
  const regs = (t: UnitType, n: number) => Array.from({ length: n }, () => newRegiment(sim, t));
  const zone = sim.world.provZones.calvi.find((z) => sim.world.provZones.westmere.includes(z))!;
  const fleet = createFleet(sim, 'ser', zone, ships(['transport', 'transport', 'capital', 'capital', 'cruiser', 'cruiser']), 'calvi', 'Calvi Squadron');
  const landing = createArmy(sim, 'ser', 'calvi', regs('infantry', 4));
  const ours = createArmy(sim, 'ser', 'ostra', regs('infantry', 6));
  const theirs = createArmy(sim, 'aur', 'duncairn', regs('infantry', 5));
  st.provinces.serenna.airfield = 2;
  st.provinces.hollin.airfield = 1;
  const wing = (nid: string, base: string, t: WingType) => createWing(sim, nid, base, t);
  const attack = wing('ser', 'serenna', 'attack');
  const fighters = [wing('ser', 'serenna', 'fighter'), wing('ser', 'serenna', 'fighter'), wing('ser', 'serenna', 'fighter')];
  for (const w of [wing('aur', 'hollin', 'fighter'), wing('aur', 'hollin', 'fighter')]) {
    w.mission = 'superiority';
    w.target = 'duncairn';
  }
  return { text: serialize(sim), ids: { zone, fleet: fleet.id, landing: landing.id, ours: ours.id, theirs: theirs.id, attack: attack.id, f1: fighters[0].id, f2: fighters[1].id, f3: fighters[2].id } };
}

