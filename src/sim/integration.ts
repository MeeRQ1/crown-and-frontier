// Frontier integration — the game's distinguishing system.
//
// Every owned province has integration 0..100. It sets the share of taxes and
// supplies reaching the crown (25%..100%), the military reserve it provides
// (20%..100%), whether it can raise troops (>= 30), be developed (>= 40), act as
// a supply source (>= 50) and count toward economic victory (>= 75), and its
// baseline unrest. Newly conquered land starts at 10 (25 if we held a claim),
// settled land at 20.
//
// Monthly gain = 3 * (1 + 0.25*roads) * (1.5 if claimed) * (1.3 if garrisoned)
//                * max(0.5, 1 - 0.05*hops to capital) * (1 + modifiers)
//                * (1 - unrest/200) * min(1, capacity / frontier load)
// Frontier load = sum(1 - integration/100); capacity = 3 + 0.1*provinces + modifiers.
// A realm beyond capacity is overextended: slower integration and more unrest.

import { C } from './config';
import { nationMods } from './modifiers';
import { chance } from './rng';
import { clamp, months, notify, ownedProvinces, provName, type Sim } from './state';
import type { NationId, ProvinceId } from './types';

export function adminCapacity(sim: Sim, nid: NationId): number {
  return C.integration.capacityBase + C.integration.capacityPerProvince * ownedProvinces(sim, nid).length + nationMods(sim, nid).adminCapacity;
}

export function frontierLoad(sim: Sim, nid: NationId): number {
  let l = 0;
  for (const pid of ownedProvinces(sim, nid)) l += 1 - sim.state.provinces[pid].integration / 100;
  return l;
}

export function overextension(sim: Sim, nid: NationId): number {
  const cap = adminCapacity(sim, nid);
  const load = frontierLoad(sim, nid);
  return Math.max(0, (load - cap) / Math.max(1, cap));
}

export function garrisoned(sim: Sim, pid: ProvinceId): boolean {
  const owner = sim.state.provinces[pid].owner;
  if (!owner) return false;
  for (const id in sim.state.armies) {
    const a = sim.state.armies[id];
    if (a.location === pid && a.nation === owner && a.path.length === 0 && !a.battle) return true;
  }
  return false;
}

export interface IntegrationBreakdown {
  rate: number;
  parts: Array<[string, number]>;
}

export function integrationRate(sim: Sim, pid: ProvinceId): IntegrationBreakdown {
  const st = sim.state;
  const p = st.provinces[pid];
  const parts: Array<[string, number]> = [];
  if (!p.owner) return { rate: 0, parts };
  if (p.controller !== p.owner) return { rate: -1, parts: [['Occupied: integration erodes', -1]] };
  if (p.revoltUntil > st.tick) return { rate: 0, parts: [['In revolt', 0]] };
  if (p.integration >= 100) return { rate: 0, parts: [['Fully integrated', 1]] };
  const nid = p.owner;
  let r = C.integration.base;
  parts.push(['Base', C.integration.base]);
  const mul = (label: string, m: number) => {
    if (Math.abs(m - 1) < 1e-6) return;
    r *= m;
    parts.push([label, m]);
  };
  mul(`Roads level ${p.infra}`, 1 + C.integration.infraBonus * p.infra);
  if (p.claims.includes(nid)) mul('Rightful claim', 1 + C.integration.claimBonus);
  if (garrisoned(sim, pid)) mul('Garrisoned', 1 + C.integration.garrisonBonus);
  const cap = st.nations[nid].capital;
  const hops = cap ? (sim.world.hops[cap][pid] ?? 10) : 10;
  mul(`${hops} step(s) from the capital`, Math.max(C.integration.distanceFloor, 1 - C.integration.distancePenalty * hops));
  mul('Realm modifiers', Math.max(0.1, 1 + nationMods(sim, nid).integration));
  mul(`Unrest ${Math.round(p.unrest)}`, 1 - p.unrest / 200);
  const load = frontierLoad(sim, nid);
  const capa = adminCapacity(sim, nid);
  if (load > capa) mul(`Overextended (load ${load.toFixed(1)} / capacity ${capa.toFixed(1)})`, capa / load);
  return { rate: r, parts };
}

export function unrestTarget(sim: Sim, pid: ProvinceId): { target: number; parts: Array<[string, number]> } {
  const st = sim.state;
  const p = st.provinces[pid];
  const parts: Array<[string, number]> = [];
  if (!p.owner) return { target: 0, parts };
  const nid = p.owner;
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.5) parts.push([label, v]);
  };
  add(`Integration ${Math.floor(p.integration)}`, (100 - p.integration) * C.unrest.fromIntegration);
  add('Overextension', overextension(sim, nid) * C.unrest.overextension);
  add('War exhaustion', st.nations[nid].warExhaustion * C.unrest.warExhaustion);
  add('Realm modifiers', nationMods(sim, nid).unrest);
  if (p.controller !== nid) add('Occupied', C.unrest.occupied);
  if (garrisoned(sim, pid)) add('Garrison', -C.unrest.garrison);
  if (p.claims.some((c) => c !== nid && st.nations[c]?.alive) && p.integration < 50) add('Loyal to a former ruler', 5);
  const target = clamp(parts.reduce((s, x) => s + x[1], 0), 0, 100);
  return { target, parts };
}

export function monthlyIntegration(sim: Sim): void {
  const st = sim.state;
  for (const pid of sim.world.provIds) {
    const p = st.provinces[pid];
    if (!p.owner) continue;
    const nid = p.owner;
    const rate = integrationRate(sim, pid).rate;
    p.integration = clamp(p.integration + rate, 0, 100);
    const { target } = unrestTarget(sim, pid);
    p.unrest = clamp(p.unrest + (target - p.unrest) * C.unrest.approach, 0, 100);
    if (p.revoltUntil && p.revoltUntil <= st.tick) {
      p.revoltUntil = 0;
      notify(sim, nid, 'normal', 'revolt', `The revolt in ${provName(sim, pid)} has burnt out.`, { province: pid });
    }
    if (p.revoltUntil === 0 && p.controller === nid && p.unrest >= C.unrest.revoltThreshold && p.integration < 50 && !garrisoned(sim, pid)) {
      if (chance(st.rng, C.unrest.revoltChance)) {
        p.revoltUntil = st.tick + months(C.unrest.revoltMonths);
        p.integration = Math.max(0, p.integration - C.unrest.revoltIntegrationLoss);
        p.unrest = 40;
        if (p.project && p.project.nation === nid) p.project = null;
        notify(sim, nid, 'urgent', 'revolt', `Revolt in ${provName(sim, pid)}! It yields nothing for six months and loses integration. Garrison troops in restless frontier provinces to prevent revolts.`, { province: pid });
      } else if (st.nations[nid].isPlayer) {
        notify(sim, nid, 'normal', 'unrest', `Unrest in ${provName(sim, pid)} is dangerous (${Math.round(p.unrest)}). A garrison would prevent a revolt.`, { province: pid });
      }
    }
  }
}
