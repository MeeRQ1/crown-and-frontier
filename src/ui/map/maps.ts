// Campaign map geometry, loaded on demand so each map's shapes download only
// when that map is played or previewed. The simulation needs only the gameplay
// half of the map package, which ships with the scenario definitions.

import { BUILTIN_MAPS, builtinGeometry, builtinScenario, type BuiltinMapId } from '../../maps/builtin';
import { drawnFromPackage } from '../../maps/convert';
import type { MapPackage } from '../../maps/format';
import type { MapGeometry } from './geometry';

type Loader = () => Promise<MapGeometry>;

const LOADERS: Record<string, Loader> = {};
for (const id of BUILTIN_MAPS) {
  LOADERS[id] = async () => drawnFromPackage({ id, straits: builtinScenario(id as BuiltinMapId).straits, geometry: await builtinGeometry(id as BuiltinMapId) });
}

const loaded = new Map<string, Promise<MapGeometry>>();

export function registerGeometry(id: string, loader: Loader): void {
  LOADERS[id] = loader;
  loaded.delete(id);
}

/** Makes a whole (validated) package drawable. */
export function registerPackageGeometry(pkg: MapPackage): void {
  registerGeometry(pkg.id, async () => drawnFromPackage(pkg));
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
