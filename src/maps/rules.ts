// Campaign rules derived from a map's size: victory thresholds scaled to the
// number of realms (DESIGN.md, "Victory on other maps"), research pace and
// campaign lengths. Shared by the procedural generator and the map editor.

import type { MapRules, MapSize } from './format';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Victory thresholds: dominance is a smaller share of the world when more realms share it. */
export function scaledVictory(regions: number, realms: number): NonNullable<MapRules['victory']> {
  const n = Math.max(2, realms);
  return {
    territorialRegions: Math.max(2, Math.round(regions * (0.07 + 1.2 / n))),
    territorialShare: round2(clamp(0.06 + 1.6 / n, 0.12, 0.45)),
    economicShare: round2(clamp(0.06 + 1.7 / n, 0.12, 0.45)),
    diplomaticInfluencePerRealm: round2(0.3 + 8.5 / n),
  };
}

/** Larger realms research faster; the tree should last the campaign. */
export function researchCostFor(provinces: number, realms: number): number {
  return round2(clamp(0.75 + 0.03 * (provinces / Math.max(1, realms)), 0.9, 1.6));
}

export function campaignYearsFor(size: MapSize): MapRules['campaignYears'] {
  return size === 'small' ? { options: [25, 40, 60], default: 40 } : size === 'standard' ? { options: [40, 60, 70], default: 60 } : { options: [50, 70, 90], default: 70 };
}
