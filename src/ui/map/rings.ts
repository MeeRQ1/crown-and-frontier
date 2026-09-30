// Rebuilds province outlines from their shared border edges. Aldmere ships
// only the edges (every border is stored once), which halves the download;
// the outline of each province is the chain of edges around it.

export interface EdgeLike {
  a: string;
  b: string;
  pts: number[];
}

/** Chains the edges touching `id` into one closed ring (flat x,y list, no repeated end point). */
export function ringFromEdges(id: string, edges: EdgeLike[]): number[] {
  const segs = edges.filter((e) => e.a === id || e.b === id).map((e) => e.pts);
  if (!segs.length) return [];
  const used = new Uint8Array(segs.length);
  const ring: number[] = [...segs[0]];
  used[0] = 1;
  for (let n = 1; n < segs.length; n++) {
    const ex = ring[ring.length - 2];
    const ey = ring[ring.length - 1];
    let found = -1;
    let rev = false;
    for (let i = 0; i < segs.length && found < 0; i++) {
      if (used[i]) continue;
      const s = segs[i];
      if (s[0] === ex && s[1] === ey) found = i;
      else if (s[s.length - 2] === ex && s[s.length - 1] === ey) (found = i), (rev = true);
    }
    if (found < 0) break;
    used[found] = 1;
    const s = segs[found];
    if (!rev) for (let k = 2; k < s.length; k++) ring.push(s[k]);
    else for (let k = s.length - 4; k >= 0; k -= 2) ring.push(s[k], s[k + 1]);
  }
  // drop the closing point
  if (ring.length >= 4 && ring[0] === ring[ring.length - 2] && ring[1] === ring[ring.length - 1]) ring.length -= 2;
  return ring;
}
