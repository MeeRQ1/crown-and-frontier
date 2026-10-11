// Every built-in campaign, the three large maps of the atlas update included,
// must be a valid map package that starts a playable campaign: each realm holds
// and controls its capital, which is a supply source; its forces stand on its own
// land and in supply; every resource is found somewhere; the victory thresholds
// can be met; and the first weeks of AI play keep the state's invariants.

import { describe, expect, it } from 'vitest';
import { BUILTIN_MAPS, builtinPackage } from '../src/maps/builtin';
import { validateMapPackage } from '../src/maps/validate';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { isSupplySource, supplyConnected } from '../src/sim/supply';
import { step } from '../src/sim/tick';
import { victoryRules } from '../src/sim/victory';

describe('built-in campaigns', () => {
  for (const id of BUILTIN_MAPS) {
    it(`${id}: a valid map that starts a playable campaign`, async () => {
      expect(validateMapPackage(await builtinPackage(id)).errors, id).toEqual([]);

      const sim = createGame({ scenario: id, seed: 1, playerNation: null });
      const { state: st, world: w } = sim;
      for (const nid of w.nationIds) {
        const capital = st.nations[nid].capital;
        expect(capital, `${id}: ${nid} has a capital`).toBeTruthy();
        if (!capital) continue;
        const cap = st.provinces[capital];
        expect(`${cap.owner}/${cap.controller}`, `${id}: ${nid}'s capital ${capital}`).toBe(`${nid}/${nid}`);
        expect(isSupplySource(sim, capital), `${id}: ${nid}'s capital supplies its armies`).toBe(true);
        const armies = Object.values(st.armies).filter((a) => a.nation === nid);
        expect(armies.length, `${id}: ${nid} starts with forces`).toBeGreaterThan(0);
        for (const a of armies) {
          expect(st.provinces[a.location].owner, `${id}: ${a.name} starts at home`).toBe(nid);
          expect(supplyConnected(sim, nid, a.location), `${id}: ${a.name} starts in supply`).toBe(true);
        }
      }

      const found = new Set(w.provIds.map((p) => w.prov[p].resource));
      for (const r of ['food', 'coal', 'iron', 'oil', 'rubber', 'nitrates'] as const) expect(found.has(r), `${id}: ${r} is found somewhere`).toBe(true);

      const v = victoryRules(sim);
      const regions = Object.values(w.regionProvinces).filter((ps) => ps.length > 0).length;
      expect(v.territorialRegions, `${id}: regions to dominate`).toBeLessThan(regions);
      for (const share of [v.territorialShare, v.economicShare]) {
        expect(share).toBeGreaterThan(0);
        expect(share).toBeLessThan(1);
      }

      for (let i = 0; i < 4; i++) step(sim);
      expect(checkInvariants(sim), id).toEqual([]);
    });
  }
});
