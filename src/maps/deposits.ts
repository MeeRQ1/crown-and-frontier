// Industrial-age deposits. Earlier map data (format 1, revision 1 of the
// built-in maps) knew four 17th-century resources: grain, iron, horses and
// goods. This deterministic conversion gives every province its industrial
// deposit from its old resource, its terrain and a hash of its id, so the
// built-in maps, the map generators and imported maps all agree.
//
// Distribution: grain becomes food; iron splits into iron and coal; the horse
// steppes hold oil or grain; old trading wealth becomes coal or nitrates; and
// some provinces without a resource gain coal (hills, mountains), oil and
// rubber (marsh, forest) or nitrates (steppe, plains). Oil and rubber stay rare.

import type { Resource, Terrain } from '../sim/types';

export type LegacyResource = 'grain' | 'iron' | 'horses' | 'goods' | null;
export const LEGACY_RESOURCES = ['grain', 'iron', 'horses', 'goods'] as const;

/** A stable number in [0, 1) from a province id. */
export function idHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // final avalanche so neighbouring ids spread
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

export function industrialDeposit(old: LegacyResource, terrain: Terrain, id: string): Resource {
  const h = idHash(id);
  switch (old) {
    case 'grain':
      return 'food';
    case 'iron':
      return h < 0.6 ? 'iron' : 'coal';
    case 'horses':
      return h < 0.45 ? 'oil' : 'food';
    case 'goods':
      return h < 0.55 ? 'coal' : 'nitrates';
  }
  switch (terrain) {
    case 'hills':
      return h < 0.22 ? 'coal' : h < 0.3 ? 'iron' : null;
    case 'mountains':
      return h < 0.15 ? 'iron' : h < 0.25 ? 'coal' : null;
    case 'marsh':
      return h < 0.18 ? 'rubber' : h < 0.3 ? 'oil' : null;
    case 'forest':
      return h < 0.1 ? 'rubber' : h < 0.16 ? 'coal' : null;
    case 'steppe':
      return h < 0.15 ? 'nitrates' : h < 0.25 ? 'oil' : null;
    case 'plains':
      return h < 0.06 ? 'nitrates' : null;
  }
}
