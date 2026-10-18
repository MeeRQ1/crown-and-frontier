// Operational reach over land and sea together.
//
// Distances are counted in steps on one graph of provinces and sea zones: a
// province to a neighbouring province (a strait counts), a coastal province to a
// zone on its coast, and a zone to a neighbouring zone are each one step (on a
// redrawn map, a step between provinces counts the ground it covers, stepLength,
// so a range reaches as far as before; distances are kept to a tenth). Aircraft
// range is measured on it from an airfield (a province) or from a carrier (its
// zone), so a wing at Durazzo reaches Bari across the Adriatic in two steps. The
// graph is static per map: distances from a node are computed once and cached.
//
// The war-reach assessment (warReach) is what a realm sees before declaring war:
// whether its armies can reach the enemy overland, whether it can ship them there,
// whether its aircraft reach, and what holding an overseas beach would take. It
// never blocks a declaration; the rules of war, movement and supply decide.

import { SHIPS, WINGS } from './config';
import { CostHeap } from './heap';
import { stepLength } from './index';
import { nationMods } from './modifiers';
import { hasAccess, isFriendly, type Sim } from './state';
import type { NationId, ProvinceId, ZoneId } from './types';
import type { World } from './types';

/** A place on the operational graph: a province or a sea zone. */
export type Place = { prov: ProvinceId; zone?: undefined } | { zone: ZoneId; prov?: undefined };

/** Every distance up to this many steps is cached (no wing flies further). */
export const MAX_STEPS = 8;

const cache = new WeakMap<World, Map<string, Map<string, number>>>();

const key = (p: Place): string => (p.prov !== undefined ? `p:${p.prov}` : `z:${p.zone}`);

/** Steps from a place to every place within MAX_STEPS (cached per map). */
function distancesFrom(world: World, from: Place): Map<string, number> {
  let perWorld = cache.get(world);
  if (!perWorld) cache.set(world, (perWorld = new Map()));
  const k = key(from);
  let d = perWorld.get(k);
  if (d) return d;
  d = redrawn(world) ? weightedFrom(world, k) : stepsFrom(world, k);
  perWorld.set(k, d);
  return d;
}

const redrawnMemo = new WeakMap<World, boolean>();
/** Does any province record its land (a map redrawn more finely)? */
function redrawn(world: World): boolean {
  let r = redrawnMemo.get(world);
  if (r === undefined) redrawnMemo.set(world, (r = world.provIds.some((p) => world.prov[p].land !== undefined)));
  return r;
}

/** Every step counts one (breadth-first). */
function stepsFrom(world: World, k: string): Map<string, number> {
  const d = new Map([[k, 0]]);
  let frontier = [k];
  for (let step = 1; step <= MAX_STEPS && frontier.length; step++) {
    const next: string[] = [];
    for (const n of frontier) {
      const id = n.slice(2);
      const out = n[0] === 'p' ? [...world.prov[id].neighbors.map((q) => `p:${q}`), ...(world.provZones[id] ?? []).map((z) => `z:${z}`)] : [...(world.zones[id]?.neighbors ?? []).map((z) => `z:${z}`), ...(world.zones[id]?.coasts ?? []).map((q) => `p:${q}`)];
      for (const m of out) {
        if (d.has(m)) continue;
        d.set(m, step);
        next.push(m);
      }
    }
    frontier = next;
  }
  return d;
}

/** A step between provinces counts the ground it covers (cheapest first). */
function weightedFrom(world: World, k: string): Map<string, number> {
  const dist = new Map<string, number>([[k, 0]]);
  const open = new CostHeap();
  open.push(0, k);
  while (open.size) {
    const c = open.peekCost();
    const n = open.pop();
    if (c > dist.get(n)!) continue;
    const id = n.slice(2);
    const relax = (m: string, len: number) => {
      const nd = c + len;
      if (nd > MAX_STEPS + 1e-9 || nd >= (dist.get(m) ?? Infinity)) return;
      dist.set(m, nd);
      open.push(nd, m);
    };
    if (n[0] === 'p') {
      for (const q of world.prov[id].neighbors) relax(`p:${q}`, stepLength(world, id, q));
      for (const z of world.provZones[id] ?? []) relax(`z:${z}`, 1);
    } else {
      for (const z of world.zones[id]?.neighbors ?? []) relax(`z:${z}`, 1);
      for (const q of world.zones[id]?.coasts ?? []) relax(`p:${q}`, 1);
    }
  }
  // to a tenth, so a range of 3 reaches what lies 3 steps away however the sum was rounded
  return new Map([...dist].map(([m, v]) => [m, Math.round(v * 10) / 10]));
}

/** Steps between two places over land and sea (Infinity beyond MAX_STEPS). */
export function opDistance(sim: Sim, from: Place, to: Place): number {
  return distancesFrom(sim.world, from).get(key(to)) ?? Infinity;
}

/** Provinces and zones within `steps` of a place (for range overlays). */
export function placesWithin(sim: Sim, from: Place, steps: number): { provs: ProvinceId[]; zones: ZoneId[] } {
  const provs: ProvinceId[] = [];
  const zones: ZoneId[] = [];
  for (const [k, d] of distancesFrom(sim.world, from)) {
    if (d > steps) continue;
    if (k[0] === 'p') provs.push(k.slice(2));
    else zones.push(k.slice(2));
  }
  return { provs, zones };
}

// ───────────────────────────── War reach ────────────────────────────────────

export interface WarReach {
  /** our armies can march onto their land (through our, friendly or unclaimed land) */
  overland: boolean;
  /** the first of their provinces our armies would reach overland */
  overlandAt: ProvinceId | null;
  /** fewest sea zones from one of our ports to one of their coasts (null: no sea route) */
  seaZones: number | null;
  /** our port and their coast at the ends of that route */
  seaFrom: ProvinceId | null;
  seaTo: ProvinceId | null;
  /** regiments our transports afloat can carry, and regiments we have */
  liftRegiments: number;
  ourRegiments: number;
  theirRegiments: number;
  /** warships' fighting power: ours, and theirs with their allies' */
  ourNavy: number;
  theirNavy: number;
  /** our air wings that reach any of their provinces from where they are based */
  wingsInReach: number;
  /** what the assessment means, one line each; `warnings` are the problems */
  notes: string[];
  warnings: string[];
  /** a route exists (overland, or by sea with transports afloat) */
  usable: boolean;
}

/** Land our armies may cross today: our own, friendly-held or unclaimed (breadth-first, cached per week and revision). */
function marchable(sim: Sim, nid: NationId): Set<ProvinceId> {
  const st = sim.state;
  const k = `${st.tick}|${st.rev}`;
  const hit = marchMemo.get(st)?.get(nid);
  if (hit && hit.k === k) return hit.set;
  const set = new Set<ProvinceId>();
  const queue: ProvinceId[] = [];
  for (const pid of sim.world.provIds) {
    if (st.provinces[pid].controller === nid) {
      set.add(pid);
      queue.push(pid);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    for (const q of sim.world.prov[queue[i]].neighbors) {
      if (set.has(q)) continue;
      const p = st.provinces[q];
      if (!hasAccess(sim, nid, p.owner, p.controller)) continue;
      set.add(q);
      queue.push(q);
    }
  }
  let per = marchMemo.get(st);
  if (!per) marchMemo.set(st, (per = new Map()));
  per.set(nid, { k, set });
  return set;
}
const marchMemo = new WeakMap<object, Map<NationId, { k: string; set: Set<ProvinceId> }>>();

/**
 * How `attacker` could fight `target`: overland, by sea and in the air, with the
 * forces it has now. Public information only (what every realm can see).
 */
export function warReach(sim: Sim, attacker: NationId, target: NationId): WarReach {
  const st = sim.state;
  const w = sim.world;
  const theirs = w.provIds.filter((p) => st.provinces[p].owner === target);
  const name = (pid: ProvinceId | null) => (pid ? w.prov[pid].name : '');
  // overland: their land touches land we may cross (at war their provinces open to us)
  const ok = marchable(sim, attacker);
  let overlandAt: ProvinceId | null = null;
  for (const p of theirs) {
    if (ok.has(p) || w.prov[p].neighbors.some((q) => ok.has(q))) {
      overlandAt = p;
      break;
    }
  }
  // by sea: our ports to their coasts
  let seaZones: number | null = null;
  let seaFrom: ProvinceId | null = null;
  let seaTo: ProvinceId | null = null;
  const ports = w.provIds.filter((p) => st.provinces[p].port > 0 && st.provinces[p].owner === attacker && st.provinces[p].controller === attacker);
  const coasts = theirs.filter((p) => w.provZones[p]?.length);
  for (const pp of ports) {
    for (const a of w.provZones[pp] ?? []) {
      for (const c of coasts) {
        for (const b of w.provZones[c]!) {
          const d = w.zoneHop(a, b);
          if (d === undefined) continue;
          if (seaZones === null || d < seaZones || (d === seaZones && st.provinces[c].dev > st.provinces[seaTo!].dev)) (seaZones = d), (seaFrom = pp), (seaTo = c);
        }
      }
    }
  }
  let lift = 0;
  let ourNavy = 0;
  let theirNavy = 0;
  const foes = new Set<NationId>([target, ...w.nationIds.filter((o) => o !== attacker && st.nations[o].alive && isFriendly(sim, target, o) && !isFriendly(sim, attacker, o))]);
  for (const id of Object.keys(st.fleets)) {
    const f = st.fleets[id];
    let guns = 0;
    let cap = 0;
    for (const s of f.ships) {
      if (SHIPS[s.type].capacity) cap += SHIPS[s.type].capacity;
      else guns += s.hp / 100;
    }
    if (f.nation === attacker) {
      lift += cap;
      ourNavy += guns;
    } else if (foes.has(f.nation)) theirNavy += guns;
  }
  let ourRegs = 0;
  let theirRegs = 0;
  for (const id of Object.keys(st.armies)) {
    const a = st.armies[id];
    if (a.nation === attacker) ourRegs += a.regiments.length;
    else if (foes.has(a.nation)) theirRegs += a.regiments.length;
  }
  let wingsInReach = 0;
  for (const id of Object.keys(st.wings)) {
    const wg = st.wings[id];
    if (wg.nation !== attacker) continue;
    const from: Place = wg.carrier && st.fleets[wg.carrier] ? { zone: st.fleets[wg.carrier].zone } : { prov: wg.base };
    const range = WINGS[wg.type].range + nationMods(sim, attacker).airRange;
    if (theirs.some((p) => opDistance(sim, from, { prov: p }) <= range)) wingsInReach++;
  }
  const notes: string[] = [];
  const warnings: string[] = [];
  if (overlandAt) notes.push(`Overland: our armies can march onto their land (nearest: ${name(overlandAt)}).`);
  else notes.push('Overland: no route. Realms that are neither our allies nor at war with us lie between us, and declaring war gives no right of passage.');
  if (seaZones !== null) {
    notes.push(`By sea: ${name(seaTo)} is ${seaZones === 0 ? 'on the same water as' : `${seaZones} sea zone${seaZones === 1 ? '' : 's'} from`} our port of ${name(seaFrom)}. Our transports afloat carry ${lift} regiment${lift === 1 ? '' : 's'} (we have ${ourRegs}).`);
    notes.push(`Their navy and their allies': ${theirNavy.toFixed(0)} warships to our ${ourNavy.toFixed(0)}. Troops land only where enemy warships do not outgun ours, and stay supplied only while a fleet holds the waters off the beach or once they take a port.`);
  } else if (!ports.length) notes.push('By sea: we hold no port.');
  else notes.push('By sea: no sea route from our ports to their coasts.');
  notes.push(`Air: ${wingsInReach} of our wings reach their land from where they are based.`);
  const usable = !!overlandAt || (seaZones !== null && lift > 0);
  if (!usable) {
    if (seaZones !== null) warnings.push(`No usable route yet: their land is reached only by sea, and we have no transports afloat. Build transports (2 regiments each) in a port, then embark an army.`);
    else warnings.push('No usable route: our armies cannot reach their land overland or by sea. War can still be declared, but we could only defend.');
  } else if (!overlandAt && lift < 4) warnings.push(`Our transports carry only ${lift} regiment${lift === 1 ? '' : 's'}: a landing that small is easily thrown back.`);
  if (!overlandAt && seaZones !== null && theirNavy > ourNavy * 1.5) warnings.push('Their warships outnumber ours: troopships without escorts risk being sunk on the way.');
  return { overland: !!overlandAt, overlandAt, seaZones, seaFrom, seaTo, liftRegiments: lift, ourRegiments: ourRegs, theirRegiments: theirRegs, ourNavy, theirNavy, wingsInReach, notes, warnings, usable };
}
