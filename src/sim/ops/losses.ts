// Losses of an operation's members, counted where they happen (battles,
// attrition, airborne drops, sinkings, air losses): a small module with no
// dependencies, so the rule modules can call it without an import cycle.

import type { Sim } from '../state';

export function noteOpLoss(sim: Sim, opId: string | null | undefined, kind: 'men' | 'ships' | 'wings', amount: number): void {
  if (!opId || !(amount > 0)) return;
  const op = sim.state.operations?.[opId];
  if (!op) return;
  if (kind === 'men') op.stats.menLost += amount;
  else if (kind === 'ships') op.stats.shipsLost += amount;
  else op.stats.wingStrengthLost += amount;
}
