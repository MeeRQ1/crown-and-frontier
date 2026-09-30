import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame } from '../src/sim/game';
import { checkInvariants } from '../src/sim/invariants';
import { deserialize, SaveError, serialize } from '../src/sim/save';
import { runTicks, step } from '../src/sim/tick';
import { getWorld, validateScenario } from '../src/sim/world';
import { borders } from '../src/sim/state';

describe('scenario', () => {
  it('the Reach is valid, connected and gives every realm a neighbour to deal with', () => {
    const w = getWorld('reach');
    expect(validateScenario(w.scenario)).toEqual([]);
    expect(w.provIds.length).toBeGreaterThanOrEqual(80);
    expect(w.nationIds.length).toBeGreaterThanOrEqual(8);
    for (const p of w.provIds) expect(Object.keys(w.hops[p]).length).toBe(w.provIds.length);
    const sim = createGame({ seed: 1, playerNation: null });
    for (const n of w.nationIds) {
      const neighbours = w.nationIds.filter((o) => o !== n && borders(sim, n, o));
      expect(neighbours.length).toBeGreaterThanOrEqual(2);
    }
    for (const r of w.scenario.regions) expect(w.regionProvinces[r.id].length).toBeGreaterThan(0);
  });
});

describe('determinism', () => {
  it('same seed and settings reproduce the same campaign', () => {
    const a = createGame({ seed: 77, playerNation: null });
    const b = createGame({ seed: 77, playerNation: null });
    runTicks(a, 300);
    runTicks(b, 300);
    expect(serialize(a).replace(/"savedAt":"[^"]+"/, '')).toBe(serialize(b).replace(/"savedAt":"[^"]+"/, ''));
  });

  it('the simulation never uses Math.random or wall-clock time', () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
    for (const f of walk('src/sim')) {
      const text = readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(text, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

describe('persistence', () => {
  it('a game saved mid-war continues exactly like the original', () => {
    const sim = createGame({ seed: 3, playerNation: null });
    // run until there is fighting (or a fixed time)
    for (let i = 0; i < 48 * 8 && Object.keys(sim.state.battles).length === 0; i++) step(sim);
    const text = serialize(sim);
    const copy = deserialize(text);
    runTicks(sim, 150);
    runTicks(copy, 150);
    const strip = (s: string) => s.replace(/"savedAt":"[^"]+"/, '');
    expect(strip(serialize(copy))).toBe(strip(serialize(sim)));
  });

  it('rejects damaged or foreign files with actionable messages', () => {
    const sim = createGame({ seed: 1, playerNation: 'aur' });
    const text = serialize(sim);
    expect(() => deserialize(text.slice(0, text.length / 2))).toThrow(SaveError);
    expect(() => deserialize(text.slice(0, text.length / 2))).toThrow(/truncated|corrupted/);
    expect(() => deserialize('{"hello":1}')).toThrow(/not a Crown & Frontier save/);
    expect(() => deserialize(text.replace('"schema":1', '"schema":99'))).toThrow(/newer version/);
    expect(() => deserialize(text.replace('"treasury":', '"treasury":1'))).toThrow(/integrity/);
    const obj = JSON.parse(text);
    delete obj.state.provinces.aurelon;
    obj.checksum = undefined;
    expect(() => deserialize(JSON.stringify(obj))).toThrow(/missing province/);
  });
});

describe('AI campaigns', () => {
  it('AI realms fight, make peace and keep a consistent world for 12 years', () => {
    for (const seed of [11, 12]) {
      const sim = createGame({ seed, playerNation: null, difficulty: seed === 11 ? 'hard' : 'easy' });
      for (let t = 0; t < 48 * 12; t++) {
        step(sim);
        if (t % 24 === 0) expect(checkInvariants(sim), `seed ${seed} tick ${sim.state.tick}`).toEqual([]);
      }
      const nations = Object.values(sim.state.nations);
      const wars = nations.reduce((s, n) => s + n.stats.warsDeclared, 0);
      const peaces = nations.reduce((s, n) => s + n.stats.peacesMade, 0);
      expect(wars).toBeGreaterThan(0);
      expect(peaces).toBeGreaterThan(0);
      expect(nations.every((n) => n.research.done.length > 0)).toBe(true);
      expect(sim.state.diagnostics.some((d) => d.layer === 'operational')).toBe(true);
    }
  });
});
