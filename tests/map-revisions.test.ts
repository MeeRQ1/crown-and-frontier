// The built-in historical maps were redrawn with more provinces (revision 2). A
// campaign begun on revision 1 continues on revision 1, kept with the game.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../src/maps/builtin';
import { ensureLegacyMap, legacyGeometry, needsLegacyMap, prepareSaveMap, RETAINED } from '../src/maps/legacy';
import { createGame } from '../src/sim/game';
import { buildCapacity, buildSlots, devLimit, landHeld, landOf, projectCost } from '../src/sim/construction';
import { TERRAIN } from '../src/sim/config';
import { checkInvariants } from '../src/sim/invariants';
import { readSave, serialize } from '../src/sim/save';
import { bump, type Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { getWorld, isMapAlias, mapFingerprint } from '../src/sim/world';
import { loadGeometry } from '../src/ui/map/maps';

// format 8, written by the main build (9be7367): Europe 1914 revision 1, France played, 26 weeks in, a torpedo boat on the slipways
const EUROPE_R1 = readFileSync(new URL('./fixtures/europe-r1-save-format8-9be7367.json', import.meta.url), 'utf8');
const strip = (s: string) => s.replace(/"savedAt":"[^"]+"/, '');

describe('campaigns begun before the maps were redrawn', () => {
  it('a revision-1 save needs its revision; without it the save is refused with the reason, never loaded onto the new provinces', () => {
    expect(mapFingerprint('europe').revision).toBe(2);
    expect(needsLegacyMap(EUROPE_R1)).toBe(true);
    expect(() => readSave(EUROPE_R1)).toThrow(/revision 1 of .*different provinces or realms/);
  });

  it('it loads on revision 1, says so, and nothing in it changes', async () => {
    await prepareSaveMap(EUROPE_R1);
    expect(needsLegacyMap(EUROPE_R1)).toBe(false);
    const saved = JSON.parse(EUROPE_R1).state;
    const { sim, notices } = readSave(EUROPE_R1);
    expect(sim.state.scenarioId).toBe('europe-r1');
    expect(sim.state.map).toEqual({ id: 'europe-r1', revision: 1, checksum: saved.map.checksum });
    expect(notices.join(' ')).toMatch(/made on revision 1 of .*redrawn with more provinces\. It continues on revision 1/);
    expect(notices.join(' ')).toMatch(/converted to format 9/);
    expect(sim.world.provIds.length).toBe(Object.keys(saved.provinces).length);
    for (const pid of sim.world.provIds) {
      const [a, b] = [sim.state.provinces[pid], saved.provinces[pid]];
      expect([a.owner, a.controller, a.dev, a.pop]).toEqual([b.owner, b.controller, b.dev, b.pop]);
    }
    expect(Object.keys(sim.state.armies).sort()).toEqual(Object.keys(saved.armies).sort());
    expect(sim.state.nations.fra.treasury).toBe(saved.nations.fra.treasury);
    expect(checkInvariants(sim)).toEqual([]);
    // it is a place to continue a campaign, not to start one
    expect(isMapAlias('europe-r1')).toBe(true);
    expect(createGame({ scenario: 'europe', seed: 7, playerNation: 'fra' }).world.provIds.length).toBeGreaterThan(sim.world.provIds.length);
  });

  it('it plays on, and a save made on revision 1 loads and plays on exactly as if it had not been saved', async () => {
    await prepareSaveMap(EUROPE_R1);
    const a = readSave(EUROPE_R1).sim;
    const b = readSave(EUROPE_R1).sim;
    for (let i = 0; i < 8; i++) step(a);
    for (let i = 0; i < 4; i++) step(b);
    const text = serialize(b);
    expect(JSON.parse(text).meta.scenario).toBe('europe-r1');
    expect(needsLegacyMap(text)).toBe(false);
    const c = readSave(text);
    expect(c.notices).toEqual([]);
    for (let i = 0; i < 4; i++) step(c.sim);
    expect(strip(serialize(c.sim))).toBe(strip(serialize(a)));
    expect(checkInvariants(a)).toEqual([]);
  });

  it('every retained revision registers, with geometry for every one of its provinces', async () => {
    for (const id of Object.keys(RETAINED)) {
      const alias = (await ensureLegacyMap(id, 1))!;
      expect(alias).toBe(`${id}-r1`);
      expect(mapFingerprint(alias).revision).toBe(1);
      const world = getWorld(alias);
      expect(world.provIds.length).toBeLessThan(getWorld(id).provIds.length);
      expect(Object.keys((await legacyGeometry(alias)!()).centers).sort()).toEqual([...world.provIds].sort());
      const drawn = await loadGeometry(alias);
      expect(Object.keys(drawn.provinces).length).toBe(world.provIds.length);
    }
    expect(await ensureLegacyMap('europe', 9)).toBeNull();
  });

  it('splitting land does not make it cheaper to grow: development and factories cost what the same land cost before', async () => {
    await ensureLegacyMap('europe', 1);
    const now = createGame({ scenario: 'europe', seed: 1, playerNation: null });
    const before = createGame({ scenario: 'europe-r1', seed: 1, playerNation: null });
    // France held 85 provinces on revision 1 and holds the same land in 121: each holds 85/121 of an old one
    const plains = (sim: Sim) => sim.world.provIds.find((p) => sim.state.provinces[p].owner === 'fra' && sim.world.prov[p].terrain === 'plains')!;
    const [a, b] = [plains(now), plains(before)];
    const land = landOf(now, a);
    expect(land).toBeCloseTo(85 / 121, 3);
    expect(landOf(before, b)).toBe(1);
    // a province at development 5 now costs about what one at 5 / land (7.1) cost on revision 1
    now.state.provinces[a].dev = 5;
    before.state.provinces[b].dev = 7;
    const ratio = projectCost(now, 'fra', a, 'dev').crowns / projectCost(before, 'fra', b, 'dev').crowns;
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(1.05);
    // the terrain's limit (beyond which a step costs 2.5 times more) comes as much sooner
    expect(devLimit(now, a)).toBe(Math.ceil(10 * land));
    expect(devLimit(before, b)).toBe(10);
    // and a factory level costs what the same slice of industry cost on the undivided land: the
    // first level of a province holding 0.7 of the old land is dearer than a whole province's first
    now.state.provinces[a].factories = 0;
    before.state.provinces[b].factories = 0;
    const first = projectCost(now, 'fra', a, 'factory').crowns / projectCost(before, 'fra', b, 'factory').crowns;
    expect(first).toBeCloseTo(1 / (2 * land) + 0.5, 2);
    expect(first).toBeGreaterThan(1.15);
    now.state.provinces[a].factories = 2;
    before.state.provinces[b].factories = 2;
    const third = projectCost(now, 'fra', a, 'factory').crowns / projectCost(before, 'fra', b, 'factory').crowns;
    expect(third).toBeCloseTo((5 / (2 * land) + 0.5) / 3, 2);
    // fourteen levels on seven old provinces (two each) cost about what they cost on the same land in ten
    // provinces of 0.7 (two in four of them, one in six): the same land, the same price to industrialise
    const levels = (l: number, n: number) => Array.from({ length: n }, (_, i) => (2 * i + 1) / (2 * l) + 0.5).reduce((x, y) => x + y, 0);
    const split = (4 * levels(0.7, 2) + 6 * levels(0.7, 1)) / (7 * levels(1, 2));
    expect(split).toBeGreaterThan(0.95);
    expect(split).toBeLessThan(1.15);
    // the other maps price development as they always did
    const reach = createGame({ scenario: 'reach', seed: 1, playerNation: null });
    expect(reach.world.provIds.every((p) => landOf(reach, p) === 1)).toBe(true);
    const rp = reach.world.provIds[0];
    expect(devLimit(reach, rp)).toBe(TERRAIN[reach.world.prov[rp].terrain].devCap);
  });

  it('more places to build on the same land, with exactly the builders the land had; the realm is told where they come from', async () => {
    for (const id of Object.keys(RETAINED)) {
      const alias = (await ensureLegacyMap(id, 1))!;
      const now = createGame({ scenario: id, seed: 1, playerNation: null });
      const before = createGame({ scenario: alias, seed: 1, playerNation: null });
      // every realm holds the land it held, and has the builders it had
      for (const nid of now.world.nationIds) {
        expect(landHeld(now, nid), `${id} ${nid}`).toBe(before.world.provIds.filter((p) => before.state.provinces[p].owner === nid).length);
        expect(buildSlots(now, nid), `${id} ${nid}`).toBe(buildSlots(before, nid));
      }
    }
    await ensureLegacyMap('europe', 1);
    const now = createGame({ scenario: 'europe', seed: 1, playerNation: null });
    const before = createGame({ scenario: 'europe-r1', seed: 1, playerNation: null });
    const [c1, c0] = [buildCapacity(now, 'fra'), buildCapacity(before, 'fra')];
    expect(c1.slots).toBe(buildSlots(now, 'fra'));
    expect(c1.slots).toBe(c1.base + c1.fromProvinces + c1.fromModifiers);
    expect([c1.provinces, c1.land, c0.provinces, c0.land]).toEqual([121, 85, 85, 85]);
    // more places: factory, port and airfield levels
    expect(c1.factoryRoom).toBeGreaterThan(c0.factoryRoom);
    expect(c1.portRoom).toBeGreaterThanOrEqual(c0.portRoom);
    expect(c1.airfieldRoom).toBeGreaterThan(c0.airfieldRoom);
    // conquered land brings the builders it is worth, not one per province
    const taken = now.world.provIds.filter((p) => now.state.provinces[p].owner === 'bel');
    expect(landHeld(now, 'bel')).toBe(2);
    for (const p of taken) now.state.provinces[p].owner = 'fra';
    bump(now);
    expect(landHeld(now, 'fra')).toBe(87);
  });
});
