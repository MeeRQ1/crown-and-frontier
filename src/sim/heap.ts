// Binary min-heap of province ids ordered by (cost, id). The id tie-break
// keeps every search deterministic and identical to a linear scan that picks
// the cheapest entry and, on ties, the smallest id.

export class CostHeap {
  private c: number[] = [];
  private v: string[] = [];

  get size(): number {
    return this.c.length;
  }

  private less(ca: number, va: string, cb: number, vb: string): boolean {
    return ca < cb || (ca === cb && va < vb);
  }

  push(cost: number, id: string): void {
    const c = this.c;
    const v = this.v;
    let i = c.length;
    c.push(cost);
    v.push(id);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(cost, id, c[p], v[p])) break;
      c[i] = c[p];
      v[i] = v[p];
      i = p;
    }
    c[i] = cost;
    v[i] = id;
  }

  /** Cost of the entry pop() would return next. */
  peekCost(): number {
    return this.c[0];
  }

  /** Removes and returns the id with the smallest (cost, id). */
  pop(): string {
    const c = this.c;
    const v = this.v;
    const top = v[0];
    const lc = c.pop()!;
    const lv = v.pop()!;
    const n = c.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const m = r < n && this.less(c[r], v[r], c[l], v[l]) ? r : l;
        if (!this.less(c[m], v[m], lc, lv)) break;
        c[i] = c[m];
        v[i] = v[m];
        i = m;
      }
      c[i] = lc;
      v[i] = lv;
    }
    return top;
  }
}
