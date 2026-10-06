// Map modes: what each overlay shows, how it colours provinces, and the
// legend and explanation shown with it. Every value comes from the live
// simulation, using only information the game already shows the player.

import { RESOURCE_INFO, TERRAIN } from '../../sim/config';
import { provinceBlockaded } from '../../sim/naval';
import { coalitionAgainst, opinion } from '../../sim/diplomacy';
import { sameBloc, sphereOf } from '../../sim/influence';
import { provinceCrowns } from '../../sim/economy';
import { armyStrength } from '../../sim/military';
import { atWar, enemiesOf, hasTreaty, isFriendly, type Sim } from '../../sim/state';
import { isSupplySource, supplyDistances, supplyRange } from '../../sim/supply';
import type { NationId, ProvinceId } from '../../sim/types';
import type { IconName } from '../icons';

export type MapMode = 'political' | 'terrain' | 'supply' | 'economy' | 'frontier' | 'diplomacy' | 'military' | 'resources' | 'sea';

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
    explain: 'Who owns each province. Diagonal hatching means another realm occupies it in war; a ring marks a siege under way. Unclaimed frontier is left as bare ivory land.',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    icon: 'terrain',
    key: 'W',
    explain: 'Ground: how it slows marching armies and helps defenders. Mountain ranges cannot be crossed except at their passes. Rivers run along borders: attackers who cross one to start a battle face defenders +20%. Dashed lines over the sea are straits: +2 movement points to cross (Hrafnmark: none).',
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
    explain: 'Crowns each province yields its owner per month (development, population, integration, unrest and occupation all count). Close up, the development level is written on each province.',
    ramp: { stops: ['#efe6cf', '#e2cf96', '#c9a35c', '#8f6a32'], from: '0', to: '12+ crowns / month' },
  },
  {
    id: 'frontier',
    label: 'Frontier',
    icon: 'settle',
    key: 'T',
    explain: 'Integration of each province into its owner’s realm. Raw frontier yields little tax and few recruits; at 50 it becomes a supply source, at 75 it counts for economic victory.',
    ramp: { stops: ['#c98d62', '#e3cc8e', '#b9cfc2', '#6f949a'], from: '0 raw frontier', to: '100 integrated' },
  },
  {
    id: 'diplomacy',
    label: 'Diplomacy',
    icon: 'relations',
    key: 'Y',
    explain: 'Relations with your realm (or with the realm you select): alliances, spheres of influence, guarantees, pacts, trade blocs and agreements, wars and the opinion each realm holds of you.',
  },
  {
    id: 'military',
    label: 'Military',
    icon: 'military',
    key: 'U',
    explain: 'Active fronts and threats. Your provinces are shaded by the hostile strength that could reach them within two marches; enemy land at war is hatched. Front-line borders are outlined.',
    ramp: { stops: ['#efe6cf', '#e6c88d', '#cf8f68', '#a1564a'], from: 'safe', to: 'heavily threatened' },
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: 'mine',
    key: 'I',
    explain: 'Deposits: each province holds at most one, and yields it to its owner every month (more with development and technology). Hatched: a resource your realm is short of, so taking or trading for that land matters.',
  },
  {
    id: 'sea',
    label: 'Sea control',
    icon: 'anchor',
    key: 'O',
    explain: 'Who commands each sea zone: the realm with the strongest warships there (submarines count half). Coasts are shaded by port level; a hatched coast is blockaded and loses a quarter of its crowns and its sea trade.',
  },
];

/** Colours of the deposits in the Resources mode. */
export const RESOURCE_COLORS: Record<string, string> = {
  food: '#a9bf74',
  coal: '#6b6a64',
  iron: '#a86b4f',
  oil: '#7d6380',
  rubber: '#5e8a68',
  nitrates: '#d6c27a',
};

export const MODE_MAP: Record<MapMode, ModeDef> = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<MapMode, ModeDef>;

export const TERRAIN_COLORS: Record<string, string> = {
  plains: '#e3dcb8',
  steppe: '#e6d3a4',
  forest: '#b9c7a3',
  hills: '#d6c4a2',
  marsh: '#bfcfc6',
  mountains: '#c7bfb4',
};

/** Every other colour a mode draws, so the legends show exactly what the map does. */
export const MODE_COLORS = {
  supplySource: '#5f8a9a',
  supplyRange: '#b9d0d4',
  supplyBeyond: '#e0c48f',
  supplyOut: '#d3cdbd',
  unowned: '#d9d1bb',
  self: '#c2ab72',
  war: '#b7675d',
  warHatch: '#7a2c25',
  ally: '#7b95b4',
  sphere: '#9a8bb8',
  patron: '#75689a',
  coalition: '#9d6b78',
  guarantee: '#8ea8c4',
  nap: '#8fb4ab',
  bloc: '#c9b98c',
  trade: '#b4c9b0',
  opinion: ['#c08a72', '#e5dcc6', '#8aa884'],
  enemy: '#b07a6f',
  friendly: '#9cb2c6',
  other: '#d3cdbd',
  shortHatch: '#9c3b33',
  port: ['#ddd6c3', '#b6cdd8', '#86a9bd', '#5f8399'],
  blockade: '#9c3b33',
  noDeposit: '#d6ceb7',
  seaControl: 'muted fill of the realm',
} as const;
const M = MODE_COLORS;

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

const IVORY: [number, number, number] = [0xee, 0xe7, 0xd7];
const washCache = new Map<string, string>();

/**
 * A realm's political colour as a muted atlas wash: the realm's own hue, with
 * the saturation and lightness of the pack's faction fills (S 12–24%, L 64–72%).
 * Returned as the colour to *multiply* over the ivory land, so that plain land
 * reads exactly as the muted fill while printed terrain still shows through.
 */
export function realmWash(color: string): string {
  const hit = washCache.get(color);
  if (hit) return hit;
  const [r, g, b] = hex(color).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l0 = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  const s0 = d < 1e-6 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
  // muted: saturation into 12–24%, lightness into 64–72% (darker hues stay a little darker)
  const s = 0.12 + Math.min(1, s0) * 0.12;
  const l = 0.64 + Math.min(1, l0) * 0.08;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const target = [r1 + m, g1 + m, b1 + m];
  const out = target.map((v, i) => Math.round(Math.min(1, v / (IVORY[i] / 255)) * 255));
  const res = `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  washCache.set(color, res);
  return res;
}

/** The muted fill itself, as it appears on plain land (legends, previews, swatches). */
export function realmFill(color: string): string {
  const w = hex(realmWash(color));
  return `#${w.map((v, i) => Math.round((v * IVORY[i]) / 255).toString(16).padStart(2, '0')).join('')}`;
}

/** A dark ink in the realm's hue, for its lettering on the map. */
export function realmInk(color: string): string {
  const [r, g, b] = hex(realmFill(color));
  const k = 0.42;
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
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
    const hostileArmies = Object.values(st.armies).filter((a) => hostile.includes(a.nation));
    for (const pid of sim.world.provIds) {
      if (st.provinces[pid].owner !== viewer) continue;
      let t = 0;
      for (const a of hostileArmies) {
        const d = sim.world.hop(pid, a.location);
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
  const occ = p.controller && p.controller !== p.owner ? realmInk(sim.world.nationDefs[p.controller]?.color ?? '#888888') : null;
  switch (mode) {
    case 'political': {
      if (!p.owner) return NONE;
      return { color: realmWash(sim.world.nationDefs[p.owner].color), alpha: 1, hatch: occ };
    }
    case 'terrain':
      return { color: TERRAIN_COLORS[def.terrain], alpha: 0.85 };
    case 'supply': {
      if (!c.supply || !c.viewer) return { color: M.supplyOut, alpha: 0.6 };
      const d = c.supply.dist[pid];
      const friendly = isFriendly(sim, c.viewer, p.controller);
      if (friendly && d === 0 && isSupplySource(sim, pid)) return { color: M.supplySource, alpha: 0.8 };
      if (d <= c.supply.range) return { color: M.supplyRange, alpha: friendly ? 0.9 : 0.65 };
      if (d <= c.supply.range + 1) return { color: M.supplyBeyond, alpha: 0.8 };
      return { color: M.supplyOut, alpha: 0.6 };
    }
    case 'economy': {
      if (!p.owner) return { color: M.unowned, alpha: 0.5 };
      const v = provinceCrowns(sim, pid);
      return { color: rampColor(MODE_MAP.economy.ramp!.stops, v / 12), alpha: 0.9, hatch: occ };
    }
    case 'frontier': {
      if (!p.owner) return { color: M.unowned, alpha: 0.5 };
      return { color: rampColor(MODE_MAP.frontier.ramp!.stops, p.integration / 100), alpha: 0.85 };
    }
    case 'diplomacy': {
      const me = focus ?? c.viewer;
      if (!p.owner || !me) return p.owner ? { color: realmWash(sim.world.nationDefs[p.owner].color), alpha: 0.6 } : NONE;
      const o = p.owner;
      if (o === me) return { color: M.self, alpha: 0.85, hatch: occ };
      if (atWar(sim, me, o)) return { color: M.war, alpha: 0.85, hatch: M.warHatch };
      if (hasTreaty(sim, 'alliance', me, o)) return { color: M.ally, alpha: 0.85 };
      if (sphereOf(sim, o) === me) return { color: M.sphere, alpha: 0.85 };
      if (sphereOf(sim, me) === o) return { color: M.patron, alpha: 0.85 };
      if (coalitionAgainst(sim, me)?.members.includes(o)) return { color: M.coalition, alpha: 0.85 };
      if (sim.state.guarantees.some((g) => g.by === me && g.of === o)) return { color: M.guarantee, alpha: 0.85 };
      if (hasTreaty(sim, 'nap', me, o)) return { color: M.nap, alpha: 0.85 };
      if (sim.state.blocs.length && sameBloc(sim, me, o)) return { color: M.bloc, alpha: 0.85 };
      if (hasTreaty(sim, 'trade', me, o)) return { color: M.trade, alpha: 0.85 };
      const op = opinion(sim, o, me);
      const t = (op + 100) / 200;
      return { color: rampColor([...M.opinion], t), alpha: 0.8 };
    }
    case 'resources': {
      const r = def.resource;
      if (!r) return p.owner ? { color: M.noDeposit, alpha: 0.45 } : NONE;
      const short = !!c.viewer && r !== 'food' && !!st.nations[c.viewer]?.shortages.includes(r);
      return { color: RESOURCE_COLORS[r], alpha: p.owner ? 0.9 : 0.6, hatch: short ? M.shortHatch : occ };
    }
    case 'sea': {
      if (!p.owner) return NONE;
      if (!sim.world.provZones[pid]) return { color: M.other, alpha: 0.35 };
      const color = M.port[Math.min(3, p.port)];
      return { color, alpha: 0.9, hatch: provinceBlockaded(sim, pid) ? M.blockade : null };
    }
    case 'military': {
      const me = c.viewer;
      if (!me) return p.owner ? { color: realmWash(sim.world.nationDefs[p.owner].color), alpha: 0.5 } : NONE;
      if (p.owner === me) {
        const t = c.threatMax ? (c.threat?.[pid] ?? 0) / Math.max(4, c.threatMax) : 0;
        return { color: rampColor(MODE_MAP.military.ramp!.stops, t), alpha: 0.9, hatch: occ };
      }
      if (p.owner && atWar(sim, me, p.owner)) return { color: M.enemy, alpha: 0.75, hatch: M.warHatch };
      if (p.owner && isFriendly(sim, me, p.owner)) return { color: M.friendly, alpha: 0.7 };
      return { color: M.other, alpha: 0.5 };
    }
  }
}

/** A legend swatch: a fill as it appears on ivory land, or a line. */
export interface LegendEntry extends LegendItem {
  line?: boolean;
}

const onIvory = (c: string, a: number) => {
  // a multiply wash at alpha a over ivory, as the swatch the player sees
  const [r, g, b] = hex(c);
  const mix = (v: number, k: number) => Math.round(k * (1 - a + (a * v) / 255));
  return `rgb(${mix(r, IVORY[0])},${mix(g, IVORY[1])},${mix(b, IVORY[2])})`;
};

/** Legend entries for a mode, from the same colours the map draws with. */
export function legendFor(mode: MapMode): LegendEntry[] {
  switch (mode) {
    case 'political':
      // the realms on screen are listed by the legend itself (they depend on the view)
      return [
        { color: '#5a5048', label: 'Hatched: occupied in war (hatch in the occupier’s ink)', hatch: true },
        { color: '#eee7d7', label: 'Ivory: unclaimed land' },
      ];
    case 'terrain':
      return [
        ...(Object.keys(TERRAIN) as Array<keyof typeof TERRAIN>).map((t) => ({
          color: onIvory(TERRAIN_COLORS[t], 0.85),
          label: `${TERRAIN[t].label} · move ${TERRAIN[t].move} · defence +${Math.round(TERRAIN[t].defense * 100)}%`,
        })),
        { color: '#ddd5c1', label: 'Mountain range (ridges): impassable except at passes' },
        { color: '#7ca1a7', label: 'River border: defenders +20% against crossings', line: true },
        { color: '#4d6d73', label: 'Dashed ferry line: a strait (+2 movement)', line: true },
      ];
    case 'supply':
      return [
        { color: onIvory(M.supplySource, 0.8), label: 'Supply source' },
        { color: onIvory(M.supplyRange, 0.9), label: 'Within supply range' },
        { color: onIvory(M.supplyBeyond, 0.8), label: 'One march beyond: foraging' },
        { color: onIvory(M.supplyOut, 0.6), label: 'Out of reach' },
        { color: '#77816d', label: 'Railway (dashed: level 1; ties: level 3)', line: true },
      ];
    case 'diplomacy':
      return [
        { color: onIvory(M.self, 0.85), label: 'This realm' },
        { color: onIvory(M.ally, 0.85), label: 'Ally' },
        { color: onIvory(M.sphere, 0.85), label: 'In its sphere of influence' },
        { color: onIvory(M.patron, 0.85), label: 'Its patron (it is in their sphere)' },
        { color: onIvory(M.guarantee, 0.85), label: 'Independence guaranteed by it' },
        { color: onIvory(M.nap, 0.85), label: 'Non-aggression pact' },
        { color: onIvory(M.bloc, 0.85), label: 'Same trade bloc' },
        { color: onIvory(M.trade, 0.85), label: 'Trade agreement' },
        { color: onIvory(M.war, 0.85), label: 'At war', hatch: true },
        { color: onIvory(M.coalition, 0.85), label: 'In a coalition against it' },
        { color: onIvory(M.opinion[2], 0.8), label: 'Friendly opinion' },
        { color: onIvory(M.opinion[0], 0.8), label: 'Hostile opinion' },
      ];
    case 'military':
      return [
        { color: onIvory(M.enemy, 0.75), label: 'Enemy land (at war)', hatch: true },
        { color: onIvory(M.friendly, 0.7), label: 'Allied or co-belligerent' },
        { color: '#9c3b33', label: 'Your orders (dashed when not selected)', line: true },
        { color: '#253332', label: 'Enemy marches', line: true },
        { color: '#9c3b33', label: 'Front line against an enemy', line: true },
      ];
    case 'resources':
      return [
        ...(['coal', 'iron', 'oil', 'rubber', 'nitrates', 'food'] as const).map((r) => ({ color: onIvory(RESOURCE_COLORS[r], 0.9), label: RESOURCE_INFO[r].label })),
        { color: M.shortHatch, label: 'Hatched: your realm is short of it', hatch: true },
      ];
    case 'sea':
      return [
        { color: '#c7c3b4', label: 'Sea zone: in the muted colour of the realm with the strongest warships there' },
        { color: onIvory(M.port[1], 0.9), label: 'Port level 1' },
        { color: onIvory(M.port[2], 0.9), label: 'Port level 2' },
        { color: onIvory(M.port[3], 0.9), label: 'Port level 3' },
        { color: onIvory(M.port[0], 0.9), label: 'Coast without a port' },
        { color: M.blockade, label: 'Hatched: blockaded coast', hatch: true },
      ];
    default:
      return [];
  }
}
