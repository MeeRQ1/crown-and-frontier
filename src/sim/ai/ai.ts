// AI entry point. AI realms act only through applyCommand(), the same
// validation path as the player, and see the same public information
// (fog of war is not implemented, so all information is public for everyone).

import { aliveNations, type Sim } from '../state';
import type { PhaseProfile } from '../tick';
import { diffOf } from './common';
import { operational } from './operational';
import { strategic } from './strategic';

export function runAI(sim: Sim, prof?: PhaseProfile): void {
  const st = sim.state;
  const d = diffOf(sim);
  const timed = (name: string, f: () => void) => {
    if (!prof) return f();
    const t = prof.now();
    f();
    prof.last[name] = (prof.last[name] ?? 0) + prof.now() - t;
  };
  for (const nid of aliveNations(sim)) {
    const n = st.nations[nid];
    if (n.isPlayer || !n.alive) continue;
    if (st.tick >= n.ai.nextStrategic) {
      n.ai.nextStrategic = st.tick + 4;
      timed('ai.strategic', () => strategic(sim, nid));
    }
    if (!st.nations[nid].alive) continue;
    if (st.tick >= n.ai.nextOperational) {
      n.ai.nextOperational = st.tick + d.opEvery;
      timed('ai.operational', () => operational(sim, nid));
    }
  }
}
