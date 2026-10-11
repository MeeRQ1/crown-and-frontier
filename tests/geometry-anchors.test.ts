// The label anchors (pole of inaccessibility) and terrain-art placements of the map
// geometry are found with an early exit that skips measuring candidates that
// cannot win. They must come out exactly as the plain search placed them: names,
// unit counters and terrain art sit where they always have.

import { describe, expect, it } from 'vitest';
import { builtinGeometry } from '../src/maps/builtin';
import { drawnFromPackage } from '../src/maps/convert';
import { pointInPoly, poleOf, scatter, rng } from '../src/ui/map/geometry';

// the search as it was, measuring every candidate in full
function distToSegSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l = dx * dx + dy * dy;
  let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}
function distToPoly(x: number, y: number, poly: number[]): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 2; i < poly.length; j = i, i += 2) {
    const d = distToSegSq(x, y, poly[j], poly[j + 1], poly[i], poly[i + 1]);
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}
function plainPole(poly: number[], bb: [number, number, number, number]): { x: number; y: number; r: number } {
  let best = { x: (bb[0] + bb[2]) / 2, y: (bb[1] + bb[3]) / 2, r: -1 };
  let step = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 8;
  let cx = best.x;
  let cy = best.y;
  let span = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2;
  for (let iter = 0; iter < 5; iter++) {
    for (let x = cx - span; x <= cx + span; x += step) {
      for (let y = cy - span; y <= cy + span; y += step) {
        if (!pointInPoly(x, y, poly)) continue;
        const r = distToPoly(x, y, poly);
        if (r > best.r) best = { x, y, r };
      }
    }
    cx = best.x;
    cy = best.y;
    span = step * 1.5;
    step /= 3;
  }
  if (best.r < 0) best = { x: (bb[0] + bb[2]) / 2, y: (bb[1] + bb[3]) / 2, r: 0 };
  return best;
}
function plainScatter(poly: number[], bb: [number, number, number, number], spacing: number, margin: number, seed: number, max = 400): Array<{ x: number; y: number }> {
  const r = rng(seed);
  const out: Array<{ x: number; y: number }> = [];
  const w = bb[2] - bb[0];
  const hgt = bb[3] - bb[1];
  const tries = Math.min(max * 6, Math.ceil(((w * hgt) / (spacing * spacing)) * 3.5));
  const s2 = spacing * spacing;
  for (let i = 0; i < tries && out.length < max; i++) {
    const x = bb[0] + r() * w;
    const y = bb[1] + r() * hgt;
    if (!pointInPoly(x, y, poly)) continue;
    if (margin > 0 && distToPoly(x, y, poly) < margin) continue;
    let ok = true;
    for (const q of out) {
      const dx = q.x - x;
      const dy = q.y - y;
      if (dx * dx + dy * dy < s2) {
        ok = false;
        break;
      }
    }
    if (ok) out.push({ x, y });
  }
  return out;
}
const bboxOf = (poly: number[]): [number, number, number, number] => {
  let a = Infinity;
  let b = Infinity;
  let c = -Infinity;
  let d = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    a = Math.min(a, poly[i]);
    b = Math.min(b, poly[i + 1]);
    c = Math.max(c, poly[i]);
    d = Math.max(d, poly[i + 1]);
  }
  return [a, b, c, d];
};

describe('map geometry anchors', () => {
  for (const id of ['europe', 'earth', 'aldmere'] as const) {
    it(`${id}: every province's label anchor and terrain art are where the plain search puts them`, async () => {
      const g = drawnFromPackage({ id, straits: [], seaZones: [], geometry: await builtinGeometry(id) });
      const polys = Object.values(g.provinces).map((p) => p.poly);
      let n = 0;
      for (const poly of polys) {
        const bb = bboxOf(poly);
        expect(poleOf(poly, bb)).toEqual(plainPole(poly, bb));
        // the terrain art's placement (sizes as the base map asks for them)
        if (n++ % 7 === 0) {
          const sp = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 9;
          expect(scatter(poly, bb, sp, sp * 0.6, 77 + n)).toEqual(plainScatter(poly, bb, sp, sp * 0.6, 77 + n));
        }
      }
      expect(polys.length).toBeGreaterThan(100);
    }, 120000);
  }
});
