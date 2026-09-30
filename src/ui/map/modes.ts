// Map modes: what each overlay shows, how it colours provinces, and the
// legend and explanation shown with it. Every value comes from the live
// simulation, using only information the game already shows the player.

import { TERRAIN } from '../../sim/config';
import { coalitionAgainst, opinion } from '../../sim/diplomacy';
import { provinceCrowns } from '../../sim/economy';
import { armyStrength } from '../../sim/military';
import { atWar, enemiesOf, hasTreaty, isFriendly, type Sim } from '../../sim/state';
import { isSupplySource, supplyDistances, supplyRange } from '../../sim/supply';
import type { NationId, ProvinceId } from '../../sim/types';
import type { IconName } from '../icons';

export type MapMode = 'political' | 'terrain' | 'supply' | 'economy' | 'frontier' | 'diplomacy' | 'military';

export interface LegendItem {
  color: string;
  label: string;
  hatch?: boolean;
}

export interface ModeDef {
  id: MapMode;
  label: string;
  icon: IconName;
  key: string;
  explain: string;
  /** static legend items (dynamic ones are built by legendFor) */
  items?: LegendItem[];
  ramp?: { stops: string[]; from: string; to: string };
}

export const MODES: ModeDef[] = [
  {
    id: 'political',
    label: 'Political',
    icon: 'political',
    key: 'Q',
    explain: 'Who owns each province. Diagonal hatching means another realm occupies it in war; a ring marks a siege under way. Unclaimed frontier is left as bare parchment.',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    icon: 'terrain',
    key: 'W',
    explain: 'Ground and how it slows marching armies and helps defenders. Rivers are drawn along borders: attacking across one is harder. Dashed lines are straits and fords, crossed at a movement cost.',
  },
  {
    id: 'supply',
    label: 'Supply',
    icon: 'supply',
    key: 'E',
    explain: 'Your supply network: sources (integrated ≥50, fortified or capital) and how far supply reaches through friendly land. Beyond range, armies forage and weaken. Brown lines are roads (faster marches, more supply).',
  },
  {
    id: 'economy',
    label: 'Economy',
    icon: 'economy',
    key: 'R',
    explain: 'Crowns each province yields its owner per month (development, trade goods, integration, unrest and occupation all count). Close up, the development level is written on each province.',
    ramp: { stops: ['#efe6cf', '#e3c276', '#c98a3a', '#8e4a22'], from: '0', to: '12+ crowns / month' },
  },
  {
    id: 'frontier',
    label: 'Frontier',
    icon: 'settle',
    key: 'T',
    explain: 'Integration of each province into its owner’s realm. Raw frontier yields little tax and few recruits; at 50 it becomes a supply source, at 75 it counts for economic victory.',
    ramp: { stops: ['#b8612f', '#e6c46e', '#9cc1c2', '#3f7f9e'], from: '0 raw frontier', to: '100 integrated' },
  },
  {
    id: 'diplomacy',
    label: 'Diplomacy',
    icon: 'relations',
    key: 'Y',
    explain: 'Relations with your realm (or with the realm you select): alliances, pacts, trade, wars and the opinion each realm holds of you.',
  },
  {
    id: 'military',
    label: 'Military',
    icon: 'military',
    key: 'U',
    explain: 'Active fronts and threats. Your provinces are shaded by the hostile strength that could reach them within two marches; enemy land at war is hatched. Front-line borders are outlined.',
    ramp: { stops: ['#efe6cf', '#e8bf72', '#d0703f', '#9d2f22'], from: 'safe', to: 'heavily threatened' },
  },
];

export const MODE_MAP: Record<MapMode, ModeDef> = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<MapMode, ModeDef>;

export const TERRAIN_COLORS: Record<string, string> = {
  plains: '#d9d49a',
  steppe: '#e2c27f',
  forest: '#8fae73',
  hills: '#c4a377',
  marsh: '#97b3a6',
  mountains: '#a39a90',
};

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function rampColor(stops: string[], t: number): string {
  t = Math.max(0, Math.min(1, t));
  const f = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(f));
  const u = f - i;
  const a = hex(stops[i]);
  const b = hex(stops[i + 1]);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * u)},${Math.round(a[1] + (b[1] - a[1]) * u)},${Math.round(a[2] + (b[2] - a[2]) * u)})`;
}

export interface Fill {
  color: string;
  alpha: number;
  hatch?: string | null;
}

/** Per-mode derived data computed once per redraw (cached by the renderer). */
export interface ModeContext {
  sim: Sim;
  viewer: NationId | null;
  supply?: { dist: Record<ProvinceId, number>; range: number };
  threat?: Record<ProvinceId, number>;
  threatMax?: number;
  fronts?: Set<ProvinceId>;
}

export function buildContext(sim: Sim, mode: MapMode, viewer: NationId | null): ModeContext {
  const ctx: ModeContext = { sim, viewer };
  if (mode === 'supply' && viewer && sim.state.nations[viewer]?.alive) ctx.supply = { dist: supplyDistances(sim, viewer), range: supplyRange(sim, viewer) };
  if (mode === 'military' && viewer) {
    const st = sim.state;
    const hostile = enemiesOf(sim, viewer);
    const threat: Record<ProvinceId, number> = {};
    let max = 0;
    const hops = sim.world.hops;
    const hostileArmies = Object.values(st.armies).filter((a) => hostile.includes(a.nation));
    for (const pid of sim.world.provIds) {
      if (st.provinces[pid].owner !== viewer) continue;
      let t = 0;
      for (const a of hostileArmies) {
        const d = hops[pid][a.location];
        if (d !== undefined && d <= 2) t += armyStrength(sim, a) * (d === 0 ? 1.2 : d === 1 ? 1 : 0.6);
      }
      threat[pid] = t;
      if (t > max) max = t;
    }
    const fronts = new Set<ProvinceId>();
    for (const pid of sim.world.provIds) {
      const p = st.provinces[pid];
      if (p.owner !== viewer && p.controller !== viewer) continue;
      if (sim.world.prov[pid].neighbors.some((n) => hostile.includes(st.provinces[n].controller ?? ''))) fronts.add(pid);
    }
    ctx.threat = threat;
    ctx.threatMax = max;
    ctx.fronts = fronts;
  }
  return ctx;
}

const NONE: Fill = { color: '#000', alpha: 0 };

/** The colour wash for a province in a mode. */
export function fillFor(mode: MapMode, c: ModeContext, pid: ProvinceId, focus: NationId | null): Fill {
  const sim = c.sim;
  const st = sim.state;
  const p = st.provinces[pid];
  const def = sim.world.prov[pid];
  const occ = p.controller && p.controller !== p.owner ? sim.world.nationDefs[p.controller]?.color ?? null : null;
  switch (mode) {
    case 'political': {
      if (!p.owner) return NONE;
      return { color: sim.world.nationDefs[p.owner].color, alpha: 0.5, hatch: occ };
    }
    case 'terrain':
      return { color: TERRAIN_COLORS[def.terrain], alpha: 0.72 };
    case 'supply': {
      if (!c.supply || !c.viewer) return { color: '#b9ad97', alpha: 0.35 };
      const d = c.supply.dist[pid];
      const friendly = isFriendly(sim, c.viewer, p.controller);
      if (friendly && d === 0 && isSupplySource(sim, pid)) return { color: '#2f7596', alpha: 0.72 };
      if (d <= c.supply.range) return { color: '#8ec0cf', alpha: friendly ? 0.62 : 0.45 };
      if (d <= c.supply.range + 1) return { color: '#e0a35b', alpha: 0.5 };
      return { color: '#b9ad97', alpha: 0.35 };
    }
    case 'economy': {
      if (!p.owner) return { color: '#d9cfb6', alpha: 0.25 };
      const v = provinceCrowns(sim, pid);
      return { color: rampColor(MODE_MAP.economy.ramp!.stops, v / 12), alpha: 0.78, hatch: occ };
    }
    case 'frontier': {
      if (!p.owner) return { color: '#d9cfb6', alpha: 0.25 };
      return { color: rampColor(MODE_MAP.frontier.ramp!.stops, p.integration / 100), alpha: 0.72 };
    }
    case 'diplomacy': {
      const me = focus ?? c.viewer;
      if (!p.owner || !me) return p.owner ? { color: sim.world.nationDefs[p.owner].color, alpha: 0.3 } : NONE;
      const o = p.owner;
      if (o === me) return { color: '#cfaa62', alpha: 0.72, hatch: occ };
      if (atWar(sim, me, o)) return { color: '#b8402e', alpha: 0.7, hatch: '#5e1a12' };
      if (hasTreaty(sim, 'alliance', me, o)) return { color: '#3d6cb0', alpha: 0.7 };
      if (coalitionAgainst(sim, me)?.members.includes(o)) return { color: '#8a3a52', alpha: 0.65 };
      if (hasTreaty(sim, 'nap', me, o)) return { color: '#5da39c', alpha: 0.65 };
      if (hasTreaty(sim, 'trade', me, o)) return { color: '#9cc3a5', alpha: 0.65 };
      const op = opinion(sim, o, me);
      const t = (op + 100) / 200;
      return { color: rampColor(['#b86a4b', '#e2cfb0', '#6f9f6c'], t), alpha: 0.6 };
    }
    case 'military': {
      const me = c.viewer;
      if (!me) return p.owner ? { color: sim.world.nationDefs[p.owner].color, alpha: 0.25 } : NONE;
      if (p.owner === me) {
        const t = c.threatMax ? (c.threat?.[pid] ?? 0) / Math.max(4, c.threatMax) : 0;
        return { color: rampColor(MODE_MAP.military.ramp!.stops, t), alpha: 0.75, hatch: occ };
      }
      if (p.owner && atWar(sim, me, p.owner)) return { color: '#9d4a3c', alpha: 0.45, hatch: '#5e1a12' };
      if (p.owner && isFriendly(sim, me, p.owner)) return { color: '#7fa3c7', alpha: 0.35 };
      return { color: '#cfc4ab', alpha: 0.28 };
    }
  }
}

/** Legend entries for a mode (some depend on the viewer). */
export function legendFor(mode: MapMode): LegendItem[] {
  switch (mode) {
    case 'political':
      return [
        { color: '#b39a78', label: 'Realm colour: owner' },
        { color: '#7b4a3a', label: 'Hatched: occupied in war', hatch: true },
        { color: '#ece3cc', label: 'Parchment: unclaimed' },
      ];
    case 'terrain':
      return (Object.keys(TERRAIN) as Array<keyof typeof TERRAIN>).map((t) => ({
        color: TERRAIN_COLORS[t],
        label: `${TERRAIN[t].label} · move ${TERRAIN[t].move} · defence +${Math.round(TERRAIN[t].defense * 100)}%`,
      }));
    case 'supply':
      return [
        { color: '#2f7596', label: 'Supply source' },
        { color: '#8ec0cf', label: 'Within supply range' },
        { color: '#e0a35b', label: 'One march beyond: foraging' },
        { color: '#b9ad97', label: 'Out of reach' },
      ];
    case 'diplomacy':
      return [
        { color: '#cfaa62', label: 'This realm' },
        { color: '#3d6cb0', label: 'Ally' },
        { color: '#5da39c', label: 'Non-aggression pact' },
        { color: '#9cc3a5', label: 'Trade agreement' },
        { color: '#b8402e', label: 'At war', hatch: true },
        { color: '#8a3a52', label: 'In a coalition against it' },
        { color: '#6f9f6c', label: 'Friendly opinion' },
        { color: '#b86a4b', label: 'Hostile opinion' },
      ];
    case 'military':
      return [
        { color: '#9d4a3c', label: 'Enemy land (at war)', hatch: true },
        { color: '#7fa3c7', label: 'Allied or co-belligerent' },
      ];
    default:
      return [];
  }
}
