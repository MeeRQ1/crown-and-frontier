// Map packages, save format 2 and its migration, and bug-report replays.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { builtinPackage } from '../src/maps/builtin';
import { MAP_LIMITS, normalizeMapPackage, parseMapPackage, validateMapPackage } from '../src/maps/validate';
import { MAP_FORMAT_VERSION, type MapPackage } from '../src/maps/format';
import { applyCommand, checkCommand } from '../src/sim/commands';
import { SCHEMA_VERSION } from '../src/sim/config';
import { diagnosticBundle, replayBundle } from '../src/sim/diagnostics';
import { createGame } from '../src/sim/game';
import { LEGACY_TECHS, startingTechs, TECHS } from '../src/sim/data/techs';
import { FORMAT1_MAPS } from '../src/sim/migrate';
import { checkInvariants } from '../src/sim/invariants';
import { fnv1a, readSave, SAVE_LIMIT_BYTES, serialize } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { mapFingerprint, registerMapScenario, scenarioIds, unregisterScenario } from '../src/sim/world';

const FIXTURE = readFileSync(new URL('./fixtures/reach-save-main-c29aea6.json', import.meta.url), 'utf8');
// format 2, written by the Stage A build (168569b): a built-in Aldmere campaign five years in, and a custom-map campaign
const FORMAT2_ALDMERE = readFileSync(new URL('./fixtures/aldmere-save-format2-168569b.json', import.meta.url), 'utf8');
const FORMAT2_CUSTOM = readFileSync(new URL('./fixtures/custom-map-save-format2-168569b.json', import.meta.url), 'utf8');
const ENV = { build: 'test', userAgent: 'vitest' };
const strip = (s: string) => s.replace(/"savedAt":"[^"]+"/, '');

/** The Reach as a custom map with another id (a stand-in for an imported map). */
async function customReach(id = 'reach-copy'): Promise<MapPackage> {
  const pkg = structuredClone(await builtinPackage('reach'));
  return { ...pkg, id, meta: { ...pkg.meta, name: 'Reach Copy', origin: 'custom' } };
}

/** Re-encodes a parsed save after an edit, with a valid state checksum. */
function reencode(obj: { checksum?: string; state: unknown }): string {
  obj.checksum = fnv1a(JSON.stringify(obj.state));
  return JSON.stringify(obj);
}

describe('map packages', () => {
  it('the built-in maps are valid packages', async () => {
    for (const id of ['reach', 'aldmere'] as const) {
      const check = validateMapPackage(await builtinPackage(id));
      expect(check.errors, id).toEqual([]);
      expect(check.ok).toBe(true);
    }
  });

  it('malformed and oversized map files are refused with reasons', async () => {
    expect(parseMapPackage('{"format": "crown-frontier-map"').check.errors[0].code).toBe('json');
    expect(parseMapPackage('x'.repeat(MAP_LIMITS.bytes + 1)).check.errors[0].code).toBe('limit');
    expect(parseMapPackage('{"hello": 1}').pkg).toBeNull();
    const broken = await customReach();
    broken.provinces[0] = { ...broken.provinces[0], neighbors: [...broken.provinces[0].neighbors, 'nowhere'] };
    const r = parseMapPackage(JSON.stringify(broken));
    expect(r.pkg).toBeNull();
    expect(r.check.errors.some((e) => /nowhere/.test(e.message))).toBe(true);
    const crowded = await customReach();
    crowded.provinces = Array.from({ length: MAP_LIMITS.provinces + 1 }, (_, i) => ({ ...crowded.provinces[0], id: `p${i}` }));
    expect(parseMapPackage(JSON.stringify(crowded)).pkg).toBeNull();
  });

  it('unknown fields are dropped and text stays plain text', async () => {
    const pkg = (await customReach()) as MapPackage & Record<string, unknown>;
    pkg.onload = 'alert(1)';
    pkg.nations[0] = { ...pkg.nations[0], name: '<img src=x onerror=alert(1)>' };
    const { pkg: clean, errors } = normalizeMapPackage(JSON.parse(JSON.stringify(pkg)));
    expect(errors).toEqual([]);
    expect('onload' in clean).toBe(false);
    // kept verbatim as data; the interface only ever writes map text as text nodes
    expect(clean.nations[0].name).toBe('<img src=x onerror=alert(1)>');
  });

  it('a custom map plays like a built-in one', async () => {
    registerMapScenario(await customReach('reach-play'));
    const sim = createGame({ scenario: 'reach-play', seed: 3, playerNation: null });
    expect(sim.state.map.id).toBe('reach-play');
    for (let i = 0; i < 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    unregisterScenario('reach-play');
  });
});

describe('save format', () => {
  it('a format-1 save is converted step by step, with notices, and keeps playing', () => {
    const { sim, notices } = readSave(FIXTURE);
    expect(notices).toHaveLength(2);
    expect(notices[0]).toMatch(/format 1/);
    expect(notices[1]).toMatch(/industrial age.*Foot became infantry.*continues in 1896/);
    const regs = Object.values(sim.state.armies).flatMap((a) => a.regiments.map((r) => r.type));
    expect(regs.length).toBeGreaterThan(0);
    expect(regs.every((t) => ['infantry', 'cavalry', 'artillery'].includes(t))).toBe(true);
    expect(sim.state.nations.aur.stock.coal).toBeGreaterThan(0);
    expect(sim.state.nations.aur.research.done).toContain('breech_rifles');
    expect(sim.state.schema).toBe(SCHEMA_VERSION);
    expect(sim.state.map).toEqual(mapFingerprint('reach'));
    for (let i = 0; i < 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    const again = readSave(serialize(sim));
    expect(JSON.parse(serialize(sim)).schema).toBe(SCHEMA_VERSION);
    expect(again.notices).toEqual([]);
  });

  it('format-1 saves are pinned to revision 1 of the built-in maps and converted to the current one', () => {
    expect(FORMAT1_MAPS.reach.revision).toBe(1);
    expect(FORMAT1_MAPS.aldmere.revision).toBe(1);
    expect(mapFingerprint('reach').revision).toBeGreaterThan(1);
    expect(readSave(FIXTURE).sim.state.map).toEqual(mapFingerprint('reach'));
  });

  it('a format-1 save that names an unknown map is refused, not guessed', () => {
    const obj = JSON.parse(FIXTURE);
    obj.state.scenarioId = 'nowhere';
    expect(() => readSave(reencode(obj))).toThrow(/cannot be converted/);
  });

  it('a save from another revision of its map loads with a notice when provinces and realms match', () => {
    const obj = JSON.parse(serialize(createGame({ scenario: 'reach', seed: 2, playerNation: 'aur' })));
    obj.state.map = { id: 'reach', revision: 0, checksum: '00000000' };
    const { sim, notices } = readSave(reencode(obj));
    expect(notices.join(' ')).toMatch(/revision 0 of The Reach/);
    expect(sim.state.map).toEqual(mapFingerprint('reach'));
  });

  it('a save from another revision of its map is refused when the provinces differ', () => {
    const obj = JSON.parse(serialize(createGame({ scenario: 'reach', seed: 2, playerNation: 'aur' })));
    obj.state.map = { id: 'reach', revision: 0, checksum: '00000000' };
    delete obj.state.provinces.westmere;
    expect(() => readSave(reencode(obj))).toThrow(/revision 0 of The Reach.*different/);
  });

  it('a custom-map save carries its map and continues identically in a session without it', async () => {
    registerMapScenario(await customReach());
    const sim = createGame({ scenario: 'reach-copy', seed: 9, playerNation: 'aur' });
    for (let i = 0; i < 30; i++) step(sim);
    const text = serialize(sim);
    expect(JSON.parse(text).mapPackage.id).toBe('reach-copy');
    unregisterScenario('reach-copy');
    expect(scenarioIds()).not.toContain('reach-copy');
    const loaded = readSave(text);
    expect(loaded.notices).toEqual([]);
    expect(loaded.mapPackage?.id).toBe('reach-copy');
    for (let i = 0; i < 60; i++) {
      step(sim);
      step(loaded.sim);
    }
    expect(strip(serialize(loaded.sim))).toBe(strip(serialize(sim)));
    unregisterScenario('reach-copy');
  });

  it('a tampered or mislabelled embedded map is refused', async () => {
    registerMapScenario(await customReach());
    const text = serialize(createGame({ scenario: 'reach-copy', seed: 9, playerNation: 'aur' }));
    unregisterScenario('reach-copy');
    const tampered = JSON.parse(text);
    tampered.mapPackage.provinces[0].dev += 1;
    expect(() => readSave(JSON.stringify(tampered))).toThrow(/does not match/);
    const builtinName = JSON.parse(text);
    builtinName.mapPackage.id = 'reach';
    expect(() => readSave(JSON.stringify(builtinName))).toThrow(/built-in map/);
  });

  it('a format-2 save on a built-in map converts to the industrial age with one notice and keeps playing', () => {
    const before = JSON.parse(FORMAT2_ALDMERE);
    expect(before.schema).toBe(2);
    const { sim, notices } = readSave(FORMAT2_ALDMERE);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatch(/save format 2.*industrial age.*continues in 1885/);
    expect(sim.state.schema).toBe(SCHEMA_VERSION);
    expect(sim.state.map).toEqual(mapFingerprint('aldmere'));
    const regs = Object.values(sim.state.armies).flatMap((a) => a.regiments.map((r) => r.type));
    expect(new Set(regs)).toEqual(new Set(['infantry', 'cavalry', 'artillery']));
    // the same armies, renamed: nothing lost
    const count = (o: typeof before) => Object.values<{ regiments: unknown[] }>(o.state.armies).reduce((s, a) => s + a.regiments.length, 0);
    expect(regs.length).toBe(count(before));
    // researched technologies map onto the new tree; the start-year techs are known to all
    expect(sim.state.nations.vos.research.done).toContain(LEGACY_TECHS.drill);
    for (const n of Object.values(sim.state.nations)) {
      expect(n.research.done).toEqual(expect.arrayContaining(startingTechs(1880)));
      expect(n.research.done.every((t) => TECHS[t])).toBe(true);
      if (n.alive) expect(n.materiel).toBeGreaterThan(0);
    }
    expect(Object.values(sim.state.provinces).some((p) => p.factories > 0)).toBe(true);
    for (let i = 0; i < 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    expect(readSave(serialize(sim)).notices).toEqual([]);
  });

  it('a format-2 save carrying a custom map upgrades that map and keeps playing', () => {
    const before = JSON.parse(FORMAT2_CUSTOM);
    expect(before.mapPackage.version).toBe(1);
    const { sim, notices, mapPackage } = readSave(FORMAT2_CUSTOM);
    expect(notices.join(' ')).toMatch(/industrial age/);
    expect(mapPackage?.version).toBe(MAP_FORMAT_VERSION);
    expect(validateMapPackage(mapPackage!).ok).toBe(true);
    // old trade goods became industrial deposits
    const vocab = new Set(['food', 'coal', 'iron', 'oil', 'rubber', 'nitrates', null]);
    expect(mapPackage!.provinces.every((p) => vocab.has(p.resource ?? null))).toBe(true);
    expect(sim.state.map.id).toBe('reach-copy');
    for (let i = 0; i < 48; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
    const again = readSave(serialize(sim));
    expect(again.notices).toEqual([]);
    unregisterScenario('reach-copy');
  });

  it('a format-2 save whose map cannot be upgraded is refused with the reason', () => {
    const obj = JSON.parse(FORMAT2_CUSTOM);
    obj.mapPackage.provinces[0].neighbors.push('nowhere');
    expect(() => readSave(JSON.stringify(obj))).toThrow(/cannot be converted|cannot be upgraded|nowhere/);
  });

  it('an oversized file is refused before it is parsed', () => {
    expect(() => readSave('x'.repeat(SAVE_LIMIT_BYTES + 1))).toThrow(/too large/);
  });
});

describe('bug reports', () => {
  /** A few player commands every week for `weeks` weeks. */
  function play(sim: ReturnType<typeof createGame>, weeks: number, perWeek = 1) {
    for (let w = 0; w < weeks; w++) {
      for (let k = 0; k < perWeek; k++) applyCommand(sim, { type: 'funding', nation: 'aur', level: ((w + k) % 4) as 0 | 1 | 2 | 3 });
      step(sim);
    }
  }

  it('a report from a campaign started in this session replays from a fresh game', () => {
    const sim = createGame({ scenario: 'reach', seed: 5, playerNation: 'aur' });
    play(sim, 40);
    const bundle = JSON.parse(JSON.stringify(diagnosticBundle(sim, ENV)));
    expect(bundle.checkpoint).toBeNull();
    const r = replayBundle(bundle);
    expect(r.from).toBe('fresh game');
    expect(r.reproduced).toBe(true);
  });

  it('a report from a loaded campaign replays from the save it was loaded from', () => {
    const original = createGame({ scenario: 'reach', seed: 5, playerNation: 'aur' });
    play(original, 30);
    const { sim } = readSave(serialize(original));
    play(sim, 30);
    const bundle = JSON.parse(JSON.stringify(diagnosticBundle(sim, ENV)));
    expect(bundle.checkpoint.tick).toBe(30);
    expect(bundle.playerCommands).toHaveLength(30);
    const r = replayBundle(bundle);
    expect(r.from).toBe('checkpoint');
    expect(r.reproduced).toBe(true);
  });

  it('a full command log rolls over to a checkpoint and the report still replays', () => {
    const sim = createGame({ scenario: 'reach', seed: 6, playerNation: 'aur' });
    play(sim, 230, 10); // 2,300 commands: more than the log keeps
    expect(sim.origin).toBeDefined();
    expect(sim.state.playerLog.length).toBeLessThan(2000);
    const r = replayBundle(JSON.parse(JSON.stringify(diagnosticBundle(sim, ENV))));
    expect(r.from).toBe('checkpoint');
    expect(r.reproduced).toBe(true);
  });

  it('a report from a custom map replays with the map it carries', async () => {
    registerMapScenario(await customReach('reach-bug'));
    const sim = createGame({ scenario: 'reach-bug', seed: 4, playerNation: 'aur' });
    play(sim, 20);
    const bundle = JSON.parse(JSON.stringify(diagnosticBundle(sim, ENV)));
    unregisterScenario('reach-bug');
    expect(bundle.mapPackage.id).toBe('reach-bug');
    expect(replayBundle(bundle).reproduced).toBe(true);
    unregisterScenario('reach-bug');
  });

  it('playing on after the result is a logged command', () => {
    const sim = createGame({ scenario: 'reach', seed: 1, playerNation: 'aur' });
    expect(checkCommand(sim, { type: 'continueCampaign', nation: 'aur' })).toMatch(/not ended/);
    sim.state.result = { winner: 'aur', path: 'territorial', tick: 0, reason: 'test' } as typeof sim.state.result;
    expect(applyCommand(sim, { type: 'continueCampaign', nation: 'aur' }).ok).toBe(true);
    expect(sim.state.continueAfterResult).toBe(true);
    expect(sim.state.playerLog.at(-1)?.cmd.type).toBe('continueCampaign');
  });
});
