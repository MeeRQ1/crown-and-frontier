// National focus: one focus at a time, a month of work per month, permanent
// effects once finished, and one-off rewards on completion.
//
// Each realm's tree = the generic tree (data/focus.ts) + a national branch
// made from its map at the start of the campaign:
//   heritage   (root)       an effect fitting the realm's temperament
//   claim × 1–2 (exclusive) claims on a neighbouring region held by others
//   develop                 development in the home region
//   resource                output of its most common deposit
//   sea | rail              a navy league (coastal) or a railway network
//   ambition   (final)      follows its victory path: claims, prosperity or concert
// A focus may require others, exclude others, wait for a year, or need a coast.
// Switching to another focus loses the progress made on the current one.

import { C, RESOURCE_INFO } from './config';
import { devMax } from './construction';
import { GENERIC_FOCUSES, NATIONAL_NAMES, type FocusDef, type NationalNames } from './data/focus';
import { PERSONALITIES } from './data/personalities';
import { materielCap, resourceCap } from './economy';
import type { ModEffects } from './modifiers';
import { alliesOf, bump, dateOf, nationName, notify, ownedProvinces, provName, type Sim } from './state';
import type { NationId, Personality, ProvinceId, ResourceKind, StrategicResource, World } from './types';

export const GENERIC_BY_ID: Record<string, FocusDef> = Object.fromEntries(GENERIC_FOCUSES.map((d) => [d.id, d]));

const nationalCache = new WeakMap<World, Map<NationId, FocusDef[]>>();

/** The national branch of a realm, made once per map from its starting position. */
export function nationalFocuses(world: World, nid: NationId): FocusDef[] {
  let per = nationalCache.get(world);
  if (!per) nationalCache.set(world, (per = new Map()));
  let list = per.get(nid);
  if (!list) per.set(nid, (list = buildNational(world, nid)));
  return list;
}

const HERITAGE: Record<Personality, { name: (adj: string) => string; effects: ModEffects; description: string; tags: FocusDef['tags'] }> = {
  expansionist: { name: (a) => `${a} Martial Tradition`, effects: { attack: 0.05, integration: 0.15 }, description: 'A people raised to the colours: victories are expected and conquests are settled.', tags: ['war', 'expansion'] },
  defensive: { name: (a) => `${a} Bulwark`, effects: { defense: 0.1, fortCost: -0.15 }, description: 'Every valley a fortress, every farmer a reservist.', tags: ['defence'] },
  commercial: { name: (a) => `${a} Merchant Houses`, effects: { trade: 0.15, income: 0.05 }, description: 'The great houses of trade finance the state and the world.', tags: ['trade', 'economy'] },
  opportunist: { name: (a) => `${a} Freebooters`, effects: { moveSpeed: 0.05, siege: 0.15 }, description: 'Quick to march, quick to take what others leave unguarded.', tags: ['war', 'expansion'] },
  diplomat: { name: (a) => `${a} Court Diplomacy`, effects: { opinion: 5, relationGain: 0.25 }, description: 'Marriages, congresses and patient envoys win what armies cannot.', tags: ['diplomacy'] },
};

function buildNational(world: World, nid: NationId): FocusDef[] {
  const def = world.nationDefs[nid];
  if (!def) return [];
  const names: NationalNames = NATIONAL_NAMES[world.scenario.id]?.[nid] ?? {};
  const named = (key: keyof Omit<NationalNames, 'res'>, name: string, description: string): [string, string] => names[key] ?? [name, description];
  const owned = new Set(world.provIds.filter((p) => world.prov[p].owner === nid));
  const regionName = (r: string) => world.scenario.regions.find((x) => x.id === r)?.name ?? r;
  const home = world.prov[def.capital]?.region ?? world.scenario.regions[0]?.id;
  const pers = PERSONALITIES[def.personality];
  const out: FocusDef[] = [];

  // heritage
  const her = HERITAGE[def.personality];
  const [hn, hd] = named('heritage', her.name(def.adjective), her.description);
  out.push({ id: 'nat_heritage', name: hn, branch: 'national', months: 8, requires: [], effects: her.effects, description: hd, col: 1, row: 0, tags: her.tags, template: 'heritage' });

  // claims on up to two neighbouring regions held mostly by others
  const cands: Array<{ r: string; v: number; owner: string }> = [];
  for (const r of world.scenario.regions) {
    const provs = world.regionProvinces[r.id] ?? [];
    if (!provs.length) continue;
    const ours = provs.filter((p) => owned.has(p)).length;
    if (ours / provs.length >= 0.5) continue;
    const foreign = provs.filter((p) => world.prov[p].owner && world.prov[p].owner !== nid);
    if (!foreign.length) continue;
    const touching = foreign.filter((p) => world.prov[p].neighbors.some((nb) => owned.has(nb))).length;
    if (!touching) continue;
    let dev = 0;
    const by: Record<string, number> = {};
    for (const p of foreign) {
      dev += world.prov[p].dev;
      by[world.prov[p].owner!] = (by[world.prov[p].owner!] ?? 0) + world.prov[p].dev;
    }
    const owner = Object.keys(by).sort((a, b) => by[b] - by[a] || (a < b ? -1 : 1))[0];
    cands.push({ r: r.id, v: dev + 3 * touching, owner });
  }
  cands.sort((a, b) => b.v - a.v || (a.r < b.r ? -1 : 1));
  const picks: typeof cands = [];
  for (const c of cands) {
    if (picks.length >= 2) break;
    // prefer two different neighbours to choose between
    if (picks.length === 1 && picks[0].owner === c.owner && cands.some((x) => x.owner !== picks[0].owner)) continue;
    picks.push(c);
  }
  const claimIds = picks.map((c) => `nat_claim_${c.r}`);
  picks.forEach((c, i) => {
    const provs = (world.regionProvinces[c.r] ?? []).filter((p) => world.prov[p].owner && world.prov[p].owner !== nid);
    out.push({
      id: claimIds[i],
      name: `Claim to ${regionName(c.r)}`,
      branch: 'national',
      months: 10,
      requires: ['nat_heritage'],
      excludes: claimIds.filter((x) => x !== claimIds[i]),
      effects: {},
      reward: { claimRegion: c.r },
      description: `Our historians, cartographers and newspapers make the case: ${regionName(c.r)} belongs with us. Claims on every province of the region held by another realm.`,
      col: i === 0 ? 0 : 2,
      row: 1,
      tags: ['expansion'],
      template: 'claim',
      provinces: provs,
    });
  });

  // the home region
  const [dn, dd] = named('develop', `Develop ${regionName(home)}`, `Roads, schools and credit for ${regionName(home)}, the heart of the realm.`);
  out.push({ id: 'nat_develop', name: dn, branch: 'national', months: 10, requires: ['nat_heritage'], effects: { devCost: -0.1 }, reward: { dev: 4, devRegion: home }, description: dd, col: 1, row: 1, tags: ['economy', 'admin'], template: 'develop' });

  // the realm's own deposits
  const count: Record<string, number> = {};
  const where: Record<string, Record<string, number>> = {};
  for (const p of owned) {
    const r = world.prov[p].resource;
    if (!r || r === 'food') continue;
    count[r] = (count[r] ?? 0) + 1;
    const reg = world.prov[p].region;
    (where[r] ??= {})[reg] = (where[r][reg] ?? 0) + 1;
  }
  const res: ResourceKind = names.res ?? ((Object.keys(count).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1))[0] as StrategicResource | undefined) ?? 'food');
  const resRegion = Object.entries(where[res] ?? {}).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? home;
  const resEffects: ModEffects = res === 'food' ? { supplyProd: 0.2, trade: 0.1 } : { [`${res}Output`]: 0.3 };
  const [rn, rd] =
    res === 'food'
      ? named('resource', `${regionName(resRegion)} Granaries`, `Grain exchanges and cold stores: food for the army and for export.`)
      : named('resource', `${regionName(resRegion)} ${RESOURCE_INFO[res].label} Concessions`, `New concessions and machinery for the ${RESOURCE_INFO[res].label.toLowerCase()} of ${regionName(resRegion)}.`);
  out.push({
    id: 'nat_resource', name: rn, branch: 'national', months: 10, requires: ['nat_develop'], effects: resEffects,
    reward: res === 'food' ? { crowns: 60 } : { stock: { [res]: 30 } as Partial<Record<StrategicResource, number>> },
    description: rd, col: 1, row: 2, tags: ['industry', 'economy'], template: 'resource',
  });

  // the coast or the railways
  const coastal = [...owned].some((p) => world.provZones[p]);
  const [sn, sd] = coastal
    ? named('sea', `${def.adjective} Navy League`, 'A patriotic league raises money for warships and harbours.')
    : named('sea', `${def.adjective} Railway Network`, 'Strategic railways tie every frontier to the capital.');
  out.push({
    id: 'nat_sea', name: sn, branch: 'national', months: 10, requires: [], requiresAny: [...claimIds, 'nat_develop'],
    effects: coastal ? { navalAttack: 0.1, shipCost: -0.1 } : { supplyRange: 1, moveSpeed: 0.05 },
    reward: coastal ? { port: true } : { infra: 3 },
    description: sd, col: claimIds.length > 1 ? 2 : 0, row: 2, tags: coastal ? ['navy'] : ['war', 'admin'], template: 'sea',
  });

  // the ambition, by victory path
  const path = pers.victory;
  const amb =
    path === 'territorial'
      ? { name: `Greater ${def.short}`, description: 'Every border province that should be ours: claims on our neighbours’ best land along the frontier.', effects: { alarmGen: -0.2, integration: 0.2 } as ModEffects, reward: { claimBorder: 4 }, tags: ['expansion', 'war'] as FocusDef['tags'] }
      : path === 'economic'
        ? { name: `${def.adjective} Prosperity`, description: 'Wealth, order and contented provinces.', effects: { income: 0.1, integration: 0.15 } as ModEffects, reward: { dev: 4, devRegion: '*' }, tags: ['economy'] as FocusDef['tags'] }
        : { name: `Concert of ${def.short}`, description: 'Our capital as the meeting place of every congress.', effects: { influenceGain: 0.5, guarantees: 1, relationGain: 0.25 } as ModEffects, reward: { trust: 5 }, tags: ['diplomacy'] as FocusDef['tags'] };
  const [an, ad] = named('ambition', amb.name, amb.description);
  out.push({ id: 'nat_ambition', name: an, branch: 'national', months: 14, requires: ['nat_resource', 'nat_sea'], effects: amb.effects, reward: amb.reward, description: ad, col: 1, row: 3, tags: amb.tags, template: 'ambition' });
  return out;
}

/** A realm's whole tree: the national branch, then the generic branches. */
export function focusTree(sim: Sim, nid: NationId): FocusDef[] {
  return [...nationalFocuses(sim.world, nid), ...GENERIC_FOCUSES];
}

export function getFocus(sim: Sim, nid: NationId, id: string): FocusDef | undefined {
  return GENERIC_BY_ID[id] ?? nationalFocuses(sim.world, nid).find((d) => d.id === id);
}

export function hasCoast(sim: Sim, nid: NationId): boolean {
  return ownedProvinces(sim, nid).some((p) => sim.world.provZones[p]);
}

/** Why a realm cannot start this focus now (null = it can). */
export function focusProblem(sim: Sim, nid: NationId, id: string): string | null {
  const n = sim.state.nations[nid];
  const d = getFocus(sim, nid, id);
  if (!d) return 'Unknown focus.';
  if (n.focus.done.includes(id)) return 'Already completed.';
  if (n.focus.current === id) return 'Already the national focus.';
  const missing = d.requires.filter((r) => !n.focus.done.includes(r));
  if (missing.length) return `Requires ${missing.map((m) => getFocus(sim, nid, m)?.name ?? m).join(' and ')}.`;
  if (d.requiresAny?.length && !d.requiresAny.some((r) => n.focus.done.includes(r)))
    return `Requires ${d.requiresAny.map((m) => getFocus(sim, nid, m)?.name ?? m).join(' or ')}.`;
  const ex = (d.excludes ?? []).find((x) => n.focus.done.includes(x));
  if (ex) return `Excluded by ${getFocus(sim, nid, ex)?.name ?? ex}.`;
  if (d.year && dateOf(sim).year < d.year) return `Not before ${d.year}.`;
  if (d.coastal && !hasCoast(sim, nid)) return 'Needs a coast.';
  return null;
}

export type FocusStatus = 'done' | 'current' | 'available' | 'locked' | 'excluded';

export function focusStatus(sim: Sim, nid: NationId, id: string): FocusStatus {
  const n = sim.state.nations[nid];
  if (n.focus.done.includes(id)) return 'done';
  if (n.focus.current === id) return 'current';
  const d = getFocus(sim, nid, id);
  if (d?.excludes?.some((x) => n.focus.done.includes(x))) return 'excluded';
  return focusProblem(sim, nid, id) ? 'locked' : 'available';
}

/** Starts a focus; progress on a focus left unfinished is lost. */
export function startFocus(sim: Sim, nid: NationId, id: string): void {
  const n = sim.state.nations[nid];
  n.focus.current = id;
  n.focus.progress = 0;
}

/** Months still needed for the current focus. */
export function focusMonthsLeft(sim: Sim, nid: NationId): number {
  const n = sim.state.nations[nid];
  const d = n.focus.current ? getFocus(sim, nid, n.focus.current) : null;
  return d ? Math.max(0, d.months - n.focus.progress) : 0;
}

/** Effects of every completed focus (for the national modifiers). */
export function focusEffects(sim: Sim, nid: NationId): ModEffects[] {
  const out: ModEffects[] = [];
  for (const id of sim.state.nations[nid].focus.done) {
    const d = getFocus(sim, nid, id);
    if (d) out.push(d.effects);
  }
  return out;
}

/** Wars only over claims (Concord of Nations). */
export function claimsOnlyFocus(sim: Sim, nid: NationId): boolean {
  return sim.state.nations[nid].focus.done.some((id) => getFocus(sim, nid, id)?.claimsOnly);
}

export function monthlyFocus(sim: Sim): void {
  const st = sim.state;
  for (const nid of sim.world.nationIds) {
    const n = st.nations[nid];
    if (!n.alive || !n.focus.current) continue;
    const d = getFocus(sim, nid, n.focus.current);
    if (!d) {
      n.focus.current = null;
      n.focus.progress = 0;
      continue;
    }
    n.focus.progress += 1;
    if (n.focus.progress < d.months) continue;
    n.focus.done.push(d.id);
    n.focus.current = null;
    n.focus.progress = 0;
    n.stats.focusesDone++;
    const got = applyReward(sim, nid, d);
    bump(sim);
    notify(sim, nid, 'normal', 'focus', `National focus complete: ${d.name}.${got.length ? ` ${got.join(' ')}` : ''} Choose the next focus (Focus ledger).`);
  }
}

/** A focus's one-off reward in words (for the interface). */
export function describeReward(sim: Sim, d: FocusDef): string[] {
  const r = d.reward;
  if (!r) return [];
  const regionName = (id: string) => sim.world.scenario.regions.find((x) => x.id === id)?.name ?? id;
  const out: string[] = [];
  if (r.crowns) out.push(`+${r.crowns} crowns`);
  if (r.materiel) out.push(`+${r.materiel} materiel`);
  if (r.research) out.push(`+${r.research} research points`);
  if (r.stock) out.push(Object.entries(r.stock).map(([k, v]) => `+${v} ${RESOURCE_INFO[k as StrategicResource].label.toLowerCase()}`).join(', '));
  if (r.factories) out.push(`+1 factory in ${r.factories} of our best provinces`);
  if (r.infra) out.push(`+1 railway level in ${r.infra} of our most developed provinces`);
  if (r.dev) out.push(`+1 development in up to ${r.dev} provinces${r.devRegion && r.devRegion !== '*' ? ` of ${regionName(r.devRegion)}` : ''}`);
  if (r.claimRegion) out.push(`claims on every province of ${regionName(r.claimRegion)} held by another realm`);
  if (r.claimBorder) out.push(`claims on the ${r.claimBorder} richest foreign provinces on our borders (not allies')`);
  if (r.port) out.push('+1 port level at our best harbour');
  if (r.airfield) out.push('an airfield at the capital');
  if (r.trust) out.push(`+${r.trust} trust`);
  return out;
}

/** Grants a completed focus's one-off reward; returns what was granted, for the notice. */
export function applyReward(sim: Sim, nid: NationId, d: FocusDef): string[] {
  const st = sim.state;
  const n = st.nations[nid];
  const r = d.reward;
  const out: string[] = [];
  if (!r) return out;
  const owned = ownedProvinces(sim, nid).filter((p) => st.provinces[p].controller === nid);
  const best = (list: ProvinceId[]) =>
    [...list].sort((a, b) => st.provinces[b].dev * (st.provinces[b].integration + 20) - st.provinces[a].dev * (st.provinces[a].integration + 20) || (a < b ? -1 : 1));
  if (r.crowns) {
    n.treasury += r.crowns;
    out.push(`+${r.crowns} crowns.`);
  }
  if (r.materiel) n.materiel = Math.min(materielCap(sim, nid), n.materiel + r.materiel);
  if (r.research) n.research.progress += r.research;
  if (r.trust) n.trust = Math.min(100, n.trust + r.trust);
  if (r.stock) {
    const cap = resourceCap(sim, nid);
    for (const [k, v] of Object.entries(r.stock) as Array<[StrategicResource, number]>) n.stock[k] = Math.min(cap, n.stock[k] + v);
    out.push(`Stockpiles: ${Object.entries(r.stock).map(([k, v]) => `+${v} ${RESOURCE_INFO[k as StrategicResource].label.toLowerCase()}`).join(', ')}.`);
  }
  if (r.factories) {
    const got = best(owned.filter((p) => st.provinces[p].factories < C.construction.factoryMax && st.provinces[p].integration >= 50)).slice(0, r.factories);
    for (const p of got) st.provinces[p].factories++;
    if (got.length) out.push(`New factories in ${got.map((p) => provName(sim, p)).join(' and ')}.`);
  }
  if (r.infra) {
    const got = best(owned.filter((p) => st.provinces[p].infra < C.construction.infraMax)).slice(0, r.infra);
    for (const p of got) st.provinces[p].infra++;
    if (got.length) out.push(`Railways improved in ${got.map((p) => provName(sim, p)).join(', ')}.`);
  }
  if (r.dev) {
    const region = r.devRegion === '*' ? null : (r.devRegion ?? (n.capital ? sim.world.prov[n.capital].region : null));
    const pool = owned.filter((p) => (!region || sim.world.prov[p].region === region) && st.provinces[p].dev < devMax(sim, p));
    const got = [...pool].sort((a, b) => st.provinces[b].integration - st.provinces[a].integration || st.provinces[a].dev - st.provinces[b].dev || (a < b ? -1 : 1)).slice(0, r.dev);
    for (const p of got) st.provinces[p].dev++;
    if (got.length) out.push(`Development +1 in ${got.map((p) => provName(sim, p)).join(', ')}.`);
  }
  const claim = (pids: ProvinceId[]) => {
    const fresh = pids.filter((p) => {
      const pr = st.provinces[p];
      return pr.owner && pr.owner !== nid && !pr.claims.includes(nid);
    });
    for (const p of fresh) st.provinces[p].claims.push(nid);
    if (fresh.length) {
      bump(sim);
      out.push(`Claims on ${fresh.map((p) => provName(sim, p)).join(', ')}.`);
      const owners = [...new Set(fresh.map((p) => st.provinces[p].owner!))].sort();
      for (const o of owners) notify(sim, o, 'normal', 'claim', `${nationName(sim, nid)} now claims ${fresh.filter((p) => st.provinces[p].owner === o).map((p) => provName(sim, p)).join(', ')} (national focus ${d.name}).`);
    }
  };
  if (r.claimRegion) claim(sim.world.regionProvinces[r.claimRegion] ?? []);
  if (r.claimBorder) {
    const allies = new Set(alliesOf(sim, nid));
    const own = new Set(ownedProvinces(sim, nid));
    const border = sim.world.provIds.filter((p) => {
      const o = st.provinces[p].owner;
      return !!o && o !== nid && !allies.has(o) && sim.world.prov[p].neighbors.some((nb) => own.has(nb));
    });
    claim([...border].sort((a, b) => st.provinces[b].dev - st.provinces[a].dev || (a < b ? -1 : 1)).slice(0, r.claimBorder));
  }
  if (r.port) {
    const coast = owned.filter((p) => sim.world.provZones[p] && st.provinces[p].port < C.construction.portMax);
    const pick = [...coast].sort((a, b) => st.provinces[b].port - st.provinces[a].port || (b === n.capital ? 1 : 0) - (a === n.capital ? 1 : 0) || st.provinces[b].dev - st.provinces[a].dev || (a < b ? -1 : 1))[0];
    if (pick) {
      st.provinces[pick].port++;
      out.push(`Port of ${provName(sim, pick)} enlarged.`);
    }
  }
  if (r.airfield) {
    const cands = owned.filter((p) => st.provinces[p].airfield < C.construction.airfieldMax);
    const pick = n.capital && cands.includes(n.capital) ? n.capital : best(cands)[0];
    if (pick) {
      st.provinces[pick].airfield++;
      out.push(`Airfield at ${provName(sim, pick)}.`);
    }
  }
  return out;
}
