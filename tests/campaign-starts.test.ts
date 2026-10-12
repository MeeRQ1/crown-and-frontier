// Every built-in campaign, the three large maps of the atlas update included,
// must be a valid map package that starts a playable campaign: each realm holds
// and controls its capital, which is a supply source; its forces stand on its own
// land and in supply; every resource is found somewhere; the victory thresholds
// can be met; and the first weeks of AI play keep the state's invariants.

import { describe, expect, it } from 'vitest';
import { BUILTIN_MAPS, builtinPackage } from '../src/maps/builtin';
import { parseMapPackage, validateMapPackage } from '../src/maps/validate';
import { createGame } from '../src/sim/game';
import { RESEARCH_PACE_MONTHS, researchPace } from '../src/sim/progression';
import { hasTreaty } from '../src/sim/state';
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

describe('the alliances and claims of 1914', () => {
  for (const id of ['europe', 'earth']) {
    it(`${id}: starts with the alliances and claims of its year`, () => {
      const sim = createGame({ scenario: id, seed: 1, playerNation: null });
      expect(hasTreaty(sim, 'alliance', 'ger', 'aus')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'aus', 'ita')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'fra', 'rus')).toBe(true);
      expect(hasTreaty(sim, 'nap', 'gbr', 'fra')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'fra', 'ger')).toBe(false);
      const claimed = (by: string, owner: string) => sim.world.provIds.some((p) => sim.state.provinces[p].owner === owner && sim.state.provinces[p].claims.includes(by));
      expect(claimed('fra', 'ger'), 'France claims Alsace-Lorraine').toBe(true);
      expect(claimed('ita', 'aus'), 'Italy claims the Trentino or Trieste').toBe(true);
      expect(claimed('ser', 'aus'), 'Serbia claims Bosnia').toBe(true);
      for (const nid of sim.world.nationIds) {
        const capital = sim.state.nations[nid].capital;
        if (capital) expect(sim.state.provinces[capital].claims, `${id}: no claim on ${nid}'s capital`).toEqual([]);
      }
    });
  }

  it('rejects a treaty at the start that names an unknown realm, one realm twice or a repeat', async () => {
    const pkg = await builtinPackage('europe');
    const codes = (treaties: unknown) => parseMapPackage(JSON.stringify({ ...pkg, treaties })).check.errors.map((e) => e.code);
    expect(codes([{ type: 'alliance', a: 'ger', b: 'nowhere' }])).toContain('reference');
    expect(codes([{ type: 'alliance', a: 'ger', b: 'ger' }])).toContain('value');
    expect(codes([{ type: 'nap', a: 'ger', b: 'aus' }, { type: 'nap', a: 'aus', b: 'ger' }])).toContain('duplicate');
    expect(codes([{ type: 'marriage', a: 'ger', b: 'aus' }]).length).toBeGreaterThan(0);
  });
});

describe('the treaties, claims and frontiers of 1 January 1936', () => {
  for (const id of ['europe-1936', 'earth-1936']) {
    it(`${id}: starts with the alliances, pacts and grievances of its day`, () => {
      const sim = createGame({ scenario: id, seed: 1, playerNation: null });
      const st = sim.state;
      // the French alliances, the Little Entente and the Balkan Pact; Locarno and the 1934 declaration as pacts
      expect(hasTreaty(sim, 'alliance', 'fra', 'pol')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'fra', 'cze')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'cze', 'rom')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'gre', 'tur')).toBe(true);
      expect(hasTreaty(sim, 'alliance', 'cze', 'sov')).toBe(true);
      expect(hasTreaty(sim, 'nap', 'ger', 'pol')).toBe(true);
      expect(hasTreaty(sim, 'nap', 'fra', 'ger')).toBe(true);
      // not yet: the Franco-Soviet treaty (March 1936), the Axis (October 1936)
      expect(hasTreaty(sim, 'alliance', 'fra', 'sov')).toBe(false);
      expect(hasTreaty(sim, 'alliance', 'ger', 'ita')).toBe(false);
      const claimed = (by: string, owner: string) => sim.world.provIds.some((p) => st.provinces[p].owner === owner && st.provinces[p].claims.includes(by));
      expect(claimed('ger', 'pol'), 'Germany claims Danzig and the Corridor').toBe(true);
      // on the world map Lithuania is one province, its capital, which is never claimed
      if (id === 'europe-1936') expect(claimed('ger', 'lit'), 'Germany claims Memel').toBe(true);
      expect(claimed('hun', 'rom'), 'Hungary claims Transylvania').toBe(true);
      expect(claimed('lit', 'pol'), 'Lithuania claims Vilnius').toBe(true);
      expect(claimed('sov', 'rom'), 'the Soviet Union claims Bessarabia').toBe(true);
      for (const nid of sim.world.nationIds) {
        const capital = st.nations[nid].capital;
        if (capital) expect(st.provinces[capital].claims, `${id}: no claim on ${nid}'s capital`).toEqual([]);
      }
      // the realms of 1936, and none of 1914's
      for (const nid of ['ger', 'sov', 'pol', 'cze', 'aut', 'hun', 'yug', 'tur', 'fin', 'est', 'lat', 'lit', 'irl', 'egy', 'irq', 'irn']) expect(sim.world.nationIds, nid).toContain(nid);
      for (const nid of ['aus', 'rus', 'ott', 'ser', 'mon', 'per']) expect(sim.world.nationIds, nid).not.toContain(nid);
    });
  }

  it('europe-1936: the frontiers that moved since 1914 put each town in the realm that held it', () => {
    const sim = createGame({ scenario: 'europe-1936', seed: 1, playerNation: null });
    const held: Record<string, string> = { Danzig: 'pol', Wilno: 'pol', Lwów: 'pol', Breslau: 'ger', Stettin: 'ger', Klaipėda: 'lit', Cluj: 'rom', Cernăuți: 'rom', Chișinău: 'rom', Bazargic: 'rom', Trieste: 'ita', Alexandretta: 'fra', Kars: 'tur', Enso: 'fin', Kolosjoki: 'fin' };
    for (const [name, nid] of Object.entries(held)) {
      const p = sim.world.provIds.find((id) => sim.world.prov[id].name === name);
      expect(p, `${name} is a province`).toBeTruthy();
      expect(sim.state.provinces[p!].owner, name).toBe(nid);
    }
  });

  it('earth-1936: the mandates and new states outside Europe', () => {
    const sim = createGame({ scenario: 'earth-1936', seed: 1, playerNation: null });
    for (const nid of ['sau', 'yem', 'man', 'mgl', 'chn', 'jpn', 'eth', 'usa']) expect(sim.world.nationIds, nid).toContain(nid);
    expect(hasTreaty(sim, 'alliance', 'jpn', 'man')).toBe(true);
    expect(hasTreaty(sim, 'alliance', 'gbr', 'can')).toBe(true);
    const claimed = (by: string, owner: string) => sim.world.provIds.some((p) => sim.state.provinces[p].owner === owner && sim.state.provinces[p].claims.includes(by));
    expect(claimed('ita', 'eth'), 'Italy claims Ethiopia').toBe(true);
    expect(claimed('chn', 'man'), 'China claims Manchuria').toBe(true);
    // the German colonies are mandates (South West Africa, New Guinea); Manchukuo holds Hsinking, China Peiping
    const held: Record<string, string> = { Windhoek: 'saf', Madang: 'ast', Hsinking: 'man', Peiping: 'chn', Nanking: 'chn', 'Addis Ababa': 'eth' };
    for (const [name, nid] of Object.entries(held)) {
      const p = sim.world.provIds.find((id) => sim.world.prov[id].name === name);
      expect(p, `${name} is a province`).toBeTruthy();
      expect(sim.state.provinces[p!].owner, name).toBe(nid);
    }
  });
});

describe('the pace of research at the start', () => {
  // months per technology for a typical realm: 34–52 on the hand-made maps; the generated
  // maps are calibrated to RESEARCH_PACE_MONTHS, so a late start (the 1914 maps, where
  // only the costly technologies are left) is not twice as slow as an early one
  for (const id of BUILTIN_MAPS) {
    it(`${id}: research moves at a playable pace`, () => {
      const pace = researchPace(createGame({ scenario: id, seed: 1, playerNation: null }));
      expect(pace, id).toBeGreaterThan(30);
      expect(pace, id).toBeLessThan(70);
      if (['hesperia', 'europe', 'earth', 'europe-1936', 'earth-1936'].includes(id)) expect(Math.abs(pace - RESEARCH_PACE_MONTHS), id).toBeLessThan(1);
    });
  }
});
