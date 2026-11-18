// Revision 3 of the redrawn historical maps: each province and sea zone records how wide
// it is, measured against revision 1 on the same ground, so a march or a voyage over the
// same ground or sea takes the same time; railways are revision 1's on the same ground;
// a crossing the redraw lost is restored. A campaign saved on revision 2 continues.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import '../src/maps/builtin';
import { ensureLegacyMap, RETAINED } from '../src/maps/legacy';
import { createGame } from '../src/sim/game';
import { CostHeap } from '../src/sim/heap';
import { groundFrom, stepLength, widthOf, zoneStep } from '../src/sim/index';
import { checkInvariants } from '../src/sim/invariants';
import { moveCost } from '../src/sim/movement';
import { createFleet, fleetEta, moveFleet, newShip, portZone, seaLength, zonePath } from '../src/sim/naval';
import { readSave } from '../src/sim/save';
import type { Sim } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { getWorld, mapFingerprint } from '../src/sim/world';

// format 9, written by the main build (e1d57b9): Europe 1914 revision 2, France played, 8 weeks in
const EUROPE_R2 = readFileSync(new URL('./fixtures/europe-r2-save-format9-e1d57b9.json', import.meta.url), 'utf8');

/** The cheapest movement points from a province to every other, whoever may pass. */
function points(sim: Sim, from: string): Record<string, number> {
  const d: Record<string, number> = { [from]: 0 };
  const open = new CostHeap();
  open.push(0, from);
  while (open.size) {
    const c = open.peekCost();
    const p = open.pop();
    if (c > d[p]) continue;
    for (const q of sim.world.prov[p].neighbors) {
      const n = c + moveCost(sim, p, q);
      if (n < (d[q] ?? Infinity)) open.push((d[q] = n), q);
    }
  }
  return d;
}

/** Capitals up to six provinces apart on revision 1, on both revisions. */
function capitalPairs(before: Sim, now: Sim): Array<[string, string]> {
  const caps = before.world.nationIds.map((n) => before.state.nations[n].capital).filter((c): c is string => !!c && !!now.world.prov[c]);
  const out: Array<[string, string]> = [];
  for (const a of caps) for (const b of caps) if (b > a && (before.world.hop(a, b) ?? 99) <= 6) out.push([a, b]);
  return out;
}

describe('revision 3 of the redrawn maps: the ground each province covers', () => {
  it('every province and sea zone records its width, measured on its own ground', () => {
    for (const id of Object.keys(RETAINED)) {
      expect(mapFingerprint(id).revision, id).toBe(3);
      const w = getWorld(id);
      const widths = w.provIds.map((p) => w.prov[p].width);
      expect(widths.every((x) => x !== undefined && x >= 0.3 && x <= 1.8), id).toBe(true);
      // most provinces are a little smaller than the old ones, and not all by the same share
      const sorted = (widths as number[]).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      expect(median, id).toBeGreaterThan(0.75);
      expect(median, id).toBeLessThan(0.95);
      expect(sorted[Math.floor(sorted.length * 0.9)] - sorted[Math.floor(sorted.length * 0.1)], id).toBeGreaterThan(0.1);
      expect(w.zoneIds.every((z) => (w.zones[z].width ?? 0) >= 0.3 && (w.zones[z].width ?? 0) <= 1.8), id).toBe(true);
      // a step counts the mean of the widths of its two ends
      const p = w.provIds[0];
      const q = w.prov[p].neighbors[0];
      expect(stepLength(w, p, q)).toBeCloseTo((widthOf(w, p) + widthOf(w, q)) / 2, 9);
    }
    // a map never redrawn counts every step and every zone as one
    const reach = getWorld('reach');
    expect(reach.provIds.every((p) => widthOf(reach, p) === 1)).toBe(true);
    expect(reach.zoneIds.every((z) => reach.zones[z].neighbors.every((n) => zoneStep(reach, z, n) === 1))).toBe(true);
  });

  it('the same ground is as far: between capitals, within 3% of revision 1 on every redrawn map', async () => {
    for (const id of Object.keys(RETAINED)) {
      const alias = (await ensureLegacyMap(id, 1))!;
      const now = getWorld(id);
      const before = getWorld(alias);
      let [g0, g1] = [0, 0];
      for (const [a, b] of capitalPairs(createGame({ scenario: alias, seed: 1, playerNation: null }), createGame({ scenario: id, seed: 1, playerNation: null }))) {
        const [x, y] = [groundFrom(before, a).get(b), groundFrom(now, a).get(b)];
        if (x === undefined || y === undefined) continue;
        g0 += x;
        g1 += y;
      }
      expect(g1 / g0, id).toBeGreaterThan(0.97);
      expect(g1 / g0, id).toBeLessThan(1.03);
    }
  });

  it('a march takes about as long as on revision 1 (railways and terrain counted): within 7%', async () => {
    for (const id of Object.keys(RETAINED)) {
      const alias = (await ensureLegacyMap(id, 1))!;
      const now = createGame({ scenario: id, seed: 1, playerNation: null });
      const before = createGame({ scenario: alias, seed: 1, playerNation: null });
      let [p0, p1] = [0, 0];
      const pairs = capitalPairs(before, now);
      const byFrom = new Map<string, string[]>();
      for (const [a, b] of pairs) (byFrom.get(a) ?? byFrom.set(a, []).get(a)!).push(b);
      for (const [a, bs] of byFrom) {
        const [d0, d1] = [points(before, a), points(now, a)];
        for (const b of bs) {
          if (d0[b] === undefined || d1[b] === undefined) continue;
          p0 += d0[b];
          p1 += d1[b];
        }
      }
      // the World, 1936 is the slowest (+5%): its finer provinces have rougher terrain on the way
      expect(p1 / p0, id).toBeLessThan(1.07);
      expect(p1 / p0, id).toBeGreaterThan(0.95);
    }
  });

  it("railways cover the land they covered on revision 1: each realm's, area for area", async () => {
    for (const id of Object.keys(RETAINED)) {
      const alias = (await ensureLegacyMap(id, 1))!;
      const area = (sim: Sim, p: string) => (sim.world.prov[p].width ?? 1) ** 2;
      const railed = (sim: Sim) => sim.world.provIds.reduce((s, p) => s + sim.state.provinces[p].infra * area(sim, p), 0) / sim.world.provIds.reduce((s, p) => s + area(sim, p), 0);
      const [now, before] = [createGame({ scenario: id, seed: 1, playerNation: null }), createGame({ scenario: alias, seed: 1, playerNation: null })];
      expect(Math.abs(railed(now) / railed(before) - 1), id).toBeLessThan(0.05);
      expect(now.world.provIds.every((p) => now.state.provinces[p].infra <= 2), id).toBe(true);
    }
  });

  it('the Bab-el-Mandeb crossing joins Tadjoura and Sanaa again on the World, 1936', () => {
    const w = getWorld('earth-1936');
    const straits = w.scenario.straits.map(([a, b]) => [a, b].sort().join('|'));
    expect(straits).toContain('sanaa|tadjoura');
    expect(straits).not.toContain('mekele|tadjoura');
    // Mekele and Tadjoura stay neighbours by land, and the crossing is commanded at sea
    expect(w.prov.mekele.neighbors).toContain('tadjoura');
    expect(w.prov.sanaa.neighbors).toContain('tadjoura');
    expect(w.straitZone.get(['sanaa', 'tadjoura'].sort().join('|'))).toBeDefined();
    // Addis Ababa to Sanaa: two steps, as on revision 1, not across Arabia
    expect(groundFrom(w, 'addisababa').get('sanaa')!).toBeLessThan(3);
  });
});

describe('revision 3: fleets', () => {
  it('a zone costs the sea it covers; a voyage takes the weeks its estimate says', () => {
    const sim = createGame({ scenario: 'europe', seed: 1, playerNation: 'gbr' });
    const w = sim.world;
    const port = w.provIds.find((p) => sim.state.provinces[p].owner === 'gbr' && sim.state.provinces[p].port > 0 && portZone(sim, p))!;
    const home = portZone(sim, port)!;
    const far = w.zoneIds.filter((z) => z !== home && zonePath(sim, home, z)).sort((a, b) => zonePath(sim, home, b)!.length - zonePath(sim, home, a)!.length)[0];
    const path = zonePath(sim, home, far)!;
    // the route is the least sea, and its length is the mean widths of each step's ends
    let len = 0;
    let at = home;
    for (const z of path) {
      len += zoneStep(w, at, z);
      at = z;
    }
    expect(seaLength(sim, home, path)).toBeCloseTo(len, 9);
    expect(len).toBeLessThan(path.length);
    const f = createFleet(sim, 'gbr', home, [newShip(sim, 'screen')], port);
    moveFleet(sim, f.id, far);
    const eta = fleetEta(sim, f, f.path);
    let weeks = 0;
    while (sim.state.fleets[f.id]?.path.length && weeks < 60) {
      step(sim);
      weeks++;
    }
    // nothing hostile in the way at peace: it arrives in the weeks estimated
    expect(sim.state.fleets[f.id].zone).toBe(far);
    expect(weeks).toBe(eta);
  });

  it('the same sea takes about as long to cross as on revision 1', async () => {
    for (const id of ['europe', 'earth']) {
      const alias = (await ensureLegacyMap(id, 1))!;
      const [now, before] = [createGame({ scenario: id, seed: 1, playerNation: null }), createGame({ scenario: alias, seed: 1, playerNation: null })];
      // between the zones off every two capitals with a port zone on both revisions
      const ports = before.world.nationIds.map((n) => before.state.nations[n].capital).filter((c): c is string => !!c && !!portZone(before, c) && !!now.world.prov[c] && !!portZone(now, c));
      let [s0, s1, z1] = [0, 0, 0];
      for (const a of ports)
        for (const b of ports) {
          if (b <= a) continue;
          const [za0, zb0, za1, zb1] = [portZone(before, a)!, portZone(before, b)!, portZone(now, a)!, portZone(now, b)!];
          const [r0, r1] = [zonePath(before, za0, zb0), zonePath(now, za1, zb1)];
          if (!r0 || !r1) continue;
          s0 += r0.length;
          s1 += seaLength(now, za1, r1);
          z1 += r1.length;
        }
      // more zones on the way, about the same sea (each zone counted by itself: up to 18% more)
      expect(z1 / s0, id).toBeGreaterThan(1.03);
      expect(Math.abs(s1 / s0 - 1), id).toBeLessThan(0.08);
    }
  });
});

describe('a campaign saved on revision 2', () => {
  it('continues on revision 3 (the same provinces and realms), says so, and plays on', () => {
    const saved = JSON.parse(EUROPE_R2).state;
    expect(saved.map.revision).toBe(2);
    const { sim, notices } = readSave(EUROPE_R2);
    expect(sim.state.scenarioId).toBe('europe');
    expect(notices.join(' ')).toMatch(/saved on revision 2 of .*this version of the game has revision 3\. It continues on the current map/);
    for (const pid of sim.world.provIds) expect(sim.state.provinces[pid].owner).toBe(saved.provinces[pid].owner);
    for (let i = 0; i < 6; i++) step(sim);
    expect(checkInvariants(sim)).toEqual([]);
  });
});
