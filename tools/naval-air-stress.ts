// The naval-and-air stress workload, made with the baseline code (commit 41108f3):
// the World 1936 at week 280 (the profiler's cached save), with every realm at war
// given airfields on its fronts, four wings on missions over each, and a battle
// squadron off an enemy coast. Written in save format 5.
import { readFileSync, writeFileSync } from 'node:fs';
import '../src/maps/builtin';
import { createWing, touchWings, wingUnlocked } from '../src/sim/air';
import { createFleet, newShip, portsOf, touchFleets } from '../src/sim/naval';
import { deserialize, serialize } from '../src/sim/save';
import { atWar, enemiesOf } from '../src/sim/state';
import type { WingType } from '../src/sim/types';
const sim = deserialize(readFileSync('.scratch/profile-saves/earth-1936-w280.json', 'utf8'));
const st = sim.state;
let fields = 0, wings = 0, fleets = 0;
for (const nid of sim.world.nationIds) {
  const n = st.nations[nid];
  if (!n.alive || !enemiesOf(sim, nid).length) continue;
  const front = sim.world.provIds.filter((p) => st.provinces[p].controller === nid && st.provinces[p].owner === nid && sim.world.prov[p].neighbors.some((q) => st.provinces[q].controller && atWar(sim, nid, st.provinces[q].controller!)));
  for (const pid of front.slice(0, 3)) {
    st.provinces[pid].airfield = 2;
    fields++;
    const enemy = sim.world.prov[pid].neighbors.find((q) => st.provinces[q].controller && atWar(sim, nid, st.provinces[q].controller!))!;
    const plan: Array<[WingType, any]> = [['fighter', 'superiority'], ['attack', 'support'], ['attack', 'interdiction'], ['bomber', 'bombing']];
    for (const [t, m] of plan) {
      if (!wingUnlocked(sim, nid, t)) continue;
      const w = createWing(sim, nid, pid, t);
      w.mission = m;
      w.target = m === 'support' ? pid : enemy;
      wings++;
    }
  }
  const ports = portsOf(sim, nid);
  if (ports.length) {
    // a squadron in the zone of an enemy coast nearest our first port, else off our own port
    const enemyCoastZone = sim.world.zoneIds.find((z) => sim.world.zones[z].coasts.some((c) => st.provinces[c].owner && atWar(sim, nid, st.provinces[c].owner!)));
    const zone = enemyCoastZone ?? sim.world.provZones[ports[0]]![0];
    createFleet(sim, nid, zone, ['capital', 'cruiser', 'cruiser', 'screen', 'screen'].map((t) => newShip(sim, t as any)), ports[0]);
    fleets++;
  }
}
touchWings(sim);
touchFleets(sim);
writeFileSync('.scratch/profile-saves/earth-1936-w280-navalair.json', serialize(sim));
console.log({ fields, wings, fleets, totalWings: Object.keys(st.wings).length, totalFleets: Object.keys(st.fleets).length, realmsAtWar: sim.world.nationIds.filter((n) => st.nations[n].alive && enemiesOf(sim, n).length).length });
