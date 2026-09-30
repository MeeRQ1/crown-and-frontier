// AI entry point. AI realms act only through applyCommand(), the same
// validation path as the player, and see the same public information
// (fog of war is not implemented, so all information is public for everyone).

import { aliveNations, type Sim } from '../state';
import { diffOf } from './common';
import { operational } from './operational';
import { strategic } from './strategic';

export function runAI(sim: Sim): void {
  const st = sim.state;
  const d = diffOf(sim);
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    if (n.isPlayer || !n.alive) continue;
    if (st.tick >= n.ai.nextStrategic) {
      n.ai.nextStrategic = st.tick + 4;
      strategic(sim, nid);
    }
    if (!st.nations[nid].alive) continue;
    if (st.tick >= n.ai.nextOperational) {
      n.ai.nextOperational = st.tick + d.opEvery;
      operational(sim, nid);
    }
  }
}
