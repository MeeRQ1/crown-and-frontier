// Seeded PRNG (sfc32). The complete state is four uint32 values stored in the
// GameState, so saves reproduce future randomness exactly. Gameplay code must
// only draw from these streams — never Math.random().

export function seedState(seed: number): number[] {
  // splitmix32 to spread a single seed over four words
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st = [next(), next(), next(), next()];
  // warm up
  for (let i = 0; i < 12; i++) nextFloat(st);
  return st;
}

/** Returns a float in [0, 1) and advances the state in place. */
export function nextFloat(st: number[]): number {
  let a = st[0] >>> 0;
  let b = st[1] >>> 0;
  let c = st[2] >>> 0;
  let d = st[3] >>> 0;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) >>> 0;
  st[0] = a >>> 0;
  st[1] = b >>> 0;
  st[2] = c >>> 0;
  st[3] = d >>> 0;
  return t / 4294967296;
}

export function range(st: number[], min: number, max: number): number {
  return min + (max - min) * nextFloat(st);
}

export function intRange(st: number[], min: number, maxInclusive: number): number {
  return min + Math.floor(nextFloat(st) * (maxInclusive - min + 1));
}

export function chance(st: number[], p: number): boolean {
  return nextFloat(st) < p;
}

export function pick<T>(st: number[], arr: readonly T[]): T {
  return arr[Math.floor(nextFloat(st) * arr.length)];
}
