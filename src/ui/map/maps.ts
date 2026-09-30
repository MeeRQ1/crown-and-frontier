// Campaign map geometry, loaded on demand so each map's shapes download only
// when that map is played or previewed. The simulation needs only adjacency,
// which ships with the scenario definitions.

import { REACH_LABELS } from '../../data/reach';
import type { MapGeometry } from './geometry';

type Loader = () => Promise<MapGeometry>;

const LOADERS: Record<string, Loader> = {
  aldmere: async () => {
    const { default: g } = await import('../../data/aldmere.map.json');
    return { ...(g as unknown as Omit<MapGeometry, 'id'>), id: 'aldmere' };
  },
  reach: async () => {
    const { default: g } = await import('../../data/reach.map.json');
    const raw = g as unknown as Omit<MapGeometry, 'id' | 'labels'>;
    return { ...raw, id: 'reach', labels: REACH_LABELS };
  },
};

const loaded = new Map<string, Promise<MapGeometry>>();

export function registerGeometry(id: string, loader: Loader): void {
  LOADERS[id] = loader;
}

export function loadGeometry(id: string): Promise<MapGeometry> {
  let p = loaded.get(id);
  if (!p) {
    const l = LOADERS[id];
    if (!l) return Promise.reject(new Error(`No map geometry for scenario "${id}".`));
    p = l();
    loaded.set(id, p);
  }
  return p;
}
