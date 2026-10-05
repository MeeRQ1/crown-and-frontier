// Rebuilds province outlines from their shared border edges. Maps store every
// border once (which halves the download); the outline of each province is the
// chain of edges around it. A province may enclose holes (a lake, a peak or a
// lagoon inside it); the outline is the largest loop.

export interface EdgeLike {
  a: string;
  b: string;
  pts: number[];
}

export interface Loop {
  ring: number[];
  /** the other side of each border in the loop */
  sides: string[];
  area: number;
}

function area(ring: number[]): number {
  let s = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) s += ring[j] * ring[i + 1] - ring[i] * ring[j + 1];
  return Math.abs(s) / 2;
}

/** A border with fewer than two distinct points. */
export function degenerate(pts: number[]): boolean {
  for (let i = 2; i < pts.length; i += 2) if (pts[i] !== pts[0] || pts[i + 1] !== pts[1]) return false;
  return true;
}

/**
 * Chains the edges touching `id` into closed loops (flat x,y lists without the
 * repeated end point). `closed` is false if some chain does not close.
 */
export function loopsFromEdges(id: string, edges: EdgeLike[]): { loops: Loop[]; closed: boolean } {
  // zero-length pieces (left by rounding coordinates) carry no outline
  const mine = edges.filter((e) => (e.a === id || e.b === id) && !degenerate(e.pts));
  const used = new Uint8Array(mine.length);
  const loops: Loop[] = [];
  let closed = true;
  for (let start = 0; start < mine.length; start++) {
    if (used[start]) continue;
    used[start] = 1;
    const first = mine[start];
    const ring: number[] = [...first.pts];
    const sides = [first.a === id ? first.b : first.a];
    for (;;) {
      const ex = ring[ring.length - 2];
      const ey = ring[ring.length - 1];
      if (ring.length >= 6 && ex === ring[0] && ey === ring[1]) break;
      let found = -1;
      let rev = false;
      for (let i = 0; i < mine.length && found < 0; i++) {
        if (used[i]) continue;
        const s = mine[i].pts;
        if (s[0] === ex && s[1] === ey) found = i;
        else if (s[s.length - 2] === ex && s[s.length - 1] === ey) (found = i), (rev = true);
      }
      if (found < 0) {
        closed = false;
        break;
      }
      used[found] = 1;
      const s = mine[found].pts;
      sides.push(mine[found].a === id ? mine[found].b : mine[found].a);
      if (!rev) for (let k = 2; k < s.length; k++) ring.push(s[k]);
      else for (let k = s.length - 4; k >= 0; k -= 2) ring.push(s[k], s[k + 1]);
    }
    if (ring.length >= 4 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1]) ring.length -= 2;
    loops.push({ ring, sides, area: area(ring) });
  }
  return { loops, closed };
}

/** The outline of `id`: its largest closed loop (flat x,y list, no repeated end point). */
export function ringFromEdges(id: string, edges: EdgeLike[]): number[] {
  const { loops } = loopsFromEdges(id, edges);
  if (!loops.length) return [];
  let best = loops[0];
  for (const l of loops) if (l.area > best.area) best = l;
  return best.ring;
}
