// Orders on the map: right-click (long-press on touch, or E over the map) a place
// with an air wing or a fleet of ours selected, and a short menu lists what that
// unit could be told to do there, each order with what it means or why it cannot
// be given. The same rules check the order when it is given (sim/commands.ts).
//
//   air wing   move to an airfield or aboard a carrier there; each mission it
//              flies that fits the place (a battle first: ground support)
//   fleet      sail there; patrol, blockade or raid those waters; shell a coast;
//              return to a port; escort or join another of our fleets; land the
//              troops aboard on a coast
//   army       marching stays on a plain right-click

import { LAND_MISSIONS, MISSION_HELP, MISSION_LABELS, missionProblem, rebaseProblem, SEA_MISSIONS, stepsTo, wingRange, airfieldRoom, ferryRange, deckSlots, wingsAboard } from '../sim/air';
import { WINGS } from '../sim/config';
import { DUTY_HELP, fleetDutyProblem, fleetEta, isCoastal, mergeFleetsProblem, moveFleetProblem, pathToCoast, portZone, shipArmiesProblem, zoneName, zonePath } from '../sim/naval';
import { provName, type Sim } from '../sim/state';
import type { AirMission, AirWing, Fleet, FleetDuty, ProvinceId } from '../sim/types';
import type { App } from './app';
import { h, setChildren } from './dom';
import { weeks } from './format';
import { icon } from './icons';

export interface OrderItem {
  label: string;
  /** what it does, or (with a problem) why it cannot be given */
  note: string;
  problem: string | null;
  run: () => void;
}

interface Point {
  pid: ProvinceId | null;
  zone: string | null;
  fleet: string | null;
  battle: boolean;
}

function pointAt(app: App, x: number, y: number): Point {
  const r = app.renderer!;
  const fleet = r.fleetAt(x, y);
  const pid = r.provinceAt(x, y);
  const zone = pid ? null : r.zoneAt(x, y);
  const battle = r.battleAt(x, y);
  return { pid: battle?.province ?? pid, zone, fleet, battle: !!battle };
}

/** Airfields and carriers the wing could move to. */
export function rebaseTargets(sim: Sim, w: AirWing): { provinces: ProvinceId[]; fleets: string[] } {
  const st = sim.state;
  const provinces = sim.world.provIds.filter((pid) => {
    const p = st.provinces[pid];
    return p.airfield > 0 && p.owner === w.nation && p.controller === w.nation && (pid !== w.base || !!w.carrier) && airfieldRoom(sim, pid) > 0;
  });
  const fleets = Object.keys(st.fleets)
    .sort()
    .filter((id) => {
      const f = st.fleets[id];
      return f.nation === w.nation && id !== w.carrier && WINGS[w.type].carrier && deckSlots(sim, f).hold > wingsAboard(sim, id).length && stepsTo(sim, w, { zone: f.zone }) <= ferryRange(sim, w);
    });
  return { provinces, fleets };
}

/** What the selected wing could do at a place on the map. */
export function wingOrders(app: App, w: AirWing, at: Point): { title: string; items: OrderItem[] } {
  const sim = app.sim!;
  const st = sim.state;
  const items: OrderItem[] = [];
  const nid = w.nation;
  const where = at.pid ? provName(sim, at.pid) : at.zone ? zoneName(sim, at.zone) : at.fleet ? st.fleets[at.fleet]?.name ?? '' : '';
  // a carrier of ours here: fly aboard
  const f = at.fleet ? st.fleets[at.fleet] : undefined;
  if (f && f.nation === nid && deckSlots(sim, f).hold > 0) {
    const prob = rebaseProblem(sim, nid, w.id, null, f.id);
    items.push({ label: `Fly aboard ${f.name}`, note: `Its carriers lie in ${zoneName(sim, f.zone)}; the wing then flies from the decks, wherever the fleet sails.`, problem: prob, run: () => app.do({ type: 'rebaseWing', wing: w.id, carrier: f.id }) });
  }
  // an airfield of ours here: move there
  if (at.pid && st.provinces[at.pid].airfield > 0 && st.provinces[at.pid].owner === nid) {
    const prob = rebaseProblem(sim, nid, w.id, at.pid);
    items.push({ label: `Move to the airfield at ${provName(sim, at.pid)}`, note: `Changing base costs readiness; missions are then flown from there.`, problem: prob, run: () => app.do({ type: 'rebaseWing', wing: w.id, base: at.pid! }) });
  }
  // missions that fit the place
  const zone = at.zone ?? (f ? f.zone : null);
  const missions = [...WINGS[w.type].missions] as AirMission[];
  // over a battle, ground support comes first
  if (at.battle) missions.sort((a, b) => (a === 'support' ? -1 : b === 'support' ? 1 : 0));
  for (const m of missions) {
    let target: ProvinceId | null = null;
    let z: string | null = null;
    if (zone && SEA_MISSIONS.includes(m)) z = zone;
    else if (at.pid && LAND_MISSIONS.includes(m)) target = at.pid;
    else if (at.pid && m === 'naval') z = sim.world.provZones[at.pid]?.[0] ?? null;
    if (!target && !z) continue;
    const place = z ? zoneName(sim, z) : provName(sim, target!);
    const steps = stepsTo(sim, w, z ? { zone: z } : { prov: target! });
    const prob = missionProblem(sim, nid, w.id, m, target, z);
    items.push({
      label: `${MISSION_LABELS[m]} over ${place}`,
      note: `${steps === Infinity ? 'out of reach' : `${steps} of ${wingRange(sim, w)} steps`}. ${MISSION_HELP[m]}`,
      problem: prob,
      run: () => app.do({ type: 'airMission', wing: w.id, mission: m, target, zone: z }),
    });
  }
  if (w.mission !== 'idle') items.push({ label: 'Stand down', note: MISSION_HELP.idle, problem: null, run: () => app.do({ type: 'airMission', wing: w.id, mission: 'idle', target: null }) });
  return { title: `${w.name} · ${where}`, items };
}

/** What the selected fleet could do at a place on the map. */
export function fleetOrders(app: App, f: Fleet, at: Point): { title: string; items: OrderItem[] } {
  const sim = app.sim!;
  const st = sim.state;
  const nid = f.nation;
  const items: OrderItem[] = [];
  const duty = (d: Omit<FleetDuty, 'since'>, label: string, extra = '') => {
    const prob = fleetDutyProblem(sim, nid, f.id, d);
    items.push({ label, note: `${DUTY_HELP[d.kind]}${extra}`, problem: prob, run: () => app.do({ type: 'fleetDuty', fleet: f.id, duty: d }) });
  };
  const other = at.fleet && at.fleet !== f.id ? st.fleets[at.fleet] : undefined;
  if (other && other.nation === nid) {
    duty({ kind: 'escort', fleet: other.id }, `Escort ${other.name}`);
    if (other.zone === f.zone) items.push({ label: `Join ${other.name}`, note: 'The two squadrons become one fleet under this one’s name.', problem: mergeFleetsProblem(sim, nid, [f.id, other.id]), run: () => app.do({ type: 'mergeFleets', fleets: [f.id, other.id] }) });
  }
  // the waters: the zone under the pointer, or the zone off the coast clicked
  const zone = at.zone ?? (other ? other.zone : at.pid ? (sim.world.provZones[at.pid]?.includes(f.zone) ? f.zone : pathToCoast(sim, f.zone, at.pid)?.at(-1) ?? null) : null);
  if (zone) {
    const path = zone === f.zone ? [] : zonePath(sim, f.zone, zone);
    const eta = path?.length ? ` ${weeks(fleetEta(sim, f, path))} under way.` : '';
    const name = zoneName(sim, zone);
    items.push({ label: zone === f.zone ? `Stay in ${name}, on station` : `Sail to ${name}`, note: `${DUTY_HELP.station}${eta}`, problem: moveFleetProblem(sim, nid, f.id, zone), run: () => (zone === f.zone ? app.do({ type: 'fleetDuty', fleet: f.id, duty: null }) : app.do({ type: 'moveFleet', fleet: f.id, zone })) });
    duty({ kind: 'patrol', zone }, `Patrol ${name}`, eta);
    duty({ kind: 'blockade', zone }, `Blockade ${name}`, eta);
    duty({ kind: 'raid', zone }, `Raid trade in ${name}`, eta);
  }
  if (at.pid && isCoastal(sim, at.pid)) {
    const p = st.provinces[at.pid];
    if (f.cargo.length) {
      const prob = shipArmiesProblem(sim, nid, [...f.cargo], f.id, at.pid);
      items.unshift({ label: `Land the troops at ${provName(sim, at.pid)}`, note: 'They land when the fleet reaches a zone on that coast and no enemy warships outgun ours there.', problem: prob, run: () => app.do({ type: 'shipArmies', armies: [...f.cargo], fleet: f.id, dest: at.pid! }) });
    }
    duty({ kind: 'bombard', province: at.pid }, `Shell ${provName(sim, at.pid)}`, p.fort ? ` Its forts (level ${p.fort}) will fire back.` : '');
    if (p.port > 0 && portZone(sim, at.pid)) duty({ kind: 'port', province: at.pid }, `Return to port at ${provName(sim, at.pid)}`);
  }
  const where = at.pid ? provName(sim, at.pid) : zone ? zoneName(sim, zone) : other ? other.name : '';
  return { title: `${f.name} · ${where}`, items };
}

// ───────────────────────────── The menu ─────────────────────────────────────

let menuEl: HTMLElement | null = null;
let closeHandlers: Array<() => void> = [];

export function closeOrderMenu(): void {
  for (const off of closeHandlers) off();
  closeHandlers = [];
  menuEl?.remove();
  menuEl = null;
}

export function orderMenuOpen(): boolean {
  return !!menuEl;
}

/** Opens the order menu for the selected wing or fleet at a screen point. Returns false if nothing is selected that takes orders there. */
export function openOrderMenu(app: App, x: number, y: number): boolean {
  const sim = app.sim;
  if (!sim || !app.renderer || !app.player) return false;
  const at = pointAt(app, x, y);
  const w = app.selectedWing ? sim.state.wings[app.selectedWing] : undefined;
  const f = app.selectedFleet ? sim.state.fleets[app.selectedFleet] : undefined;
  let menu: { title: string; items: OrderItem[] } | null = null;
  if (w && w.nation === app.player) menu = wingOrders(app, w, at);
  else if (f && f.nation === app.player) menu = fleetOrders(app, f, at);
  if (!menu) return false;
  showMenu(app, x, y, menu.title, menu.items);
  return true;
}

function showMenu(app: App, x: number, y: number, title: string, items: OrderItem[]): void {
  closeOrderMenu();
  // orders that can be given first, in their order; then the others with their reasons
  const list = [...items.filter((i) => !i.problem), ...items.filter((i) => i.problem)];
  const el = h('div', { class: 'order-menu', role: 'menu', 'aria-label': `Orders: ${title}`, 'data-sk': 'order-menu' });
  const buttons: HTMLButtonElement[] = [];
  const rows = list.map((it, i) => {
    const b = h(
      'button',
      { class: `order-item ${it.problem ? 'is-disabled' : ''}`, type: 'button', role: 'menuitem', 'aria-disabled': it.problem ? 'true' : undefined, 'data-fk': `order-${i}` },
      h('span', { class: 'order-key' }, i < 9 ? String(i + 1) : ''),
      h('span', { class: 'order-text' }, h('span', { class: 'order-label' }, it.label), h('span', { class: it.problem ? 'order-why' : 'order-note' }, it.problem ?? it.note)),
    ) as HTMLButtonElement;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (it.problem) {
        app.toast(it.problem, 'fail');
        return;
      }
      closeOrderMenu();
      it.run();
    });
    buttons.push(b);
    return b;
  });
  const close = h('button', { class: 'btn quiet small icon', type: 'button', 'aria-label': 'Close (Esc)' }, icon('close'));
  close.addEventListener('click', () => closeOrderMenu());
  setChildren(el, h('div', { class: 'order-head' }, h('span', { class: 'order-title' }, title), close), list.length ? h('div', { class: 'order-list' }, rows) : h('p', { class: 'small muted', style: 'padding:6px 10px' }, 'No orders fit this place.'));
  app.stageEl.appendChild(el);
  menuEl = el;
  // keep it on screen
  const W = app.stageEl.clientWidth;
  const H = app.stageEl.clientHeight;
  const mw = el.offsetWidth || 300;
  const mh = el.offsetHeight || 200;
  el.style.left = `${Math.max(8, Math.min(x + 8, W - mw - 8))}px`;
  el.style.top = `${Math.max(8, Math.min(y + 8, H - mh - 8))}px`;
  const first = buttons.find((_, i) => !list[i].problem) ?? buttons[0];
  first?.focus({ preventScroll: true });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeOrderMenu();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= buttons.length) {
      buttons[n - 1].click();
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = buttons[(i + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length];
      next?.focus();
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onDown = (e: PointerEvent) => {
    if (!el.contains(e.target as Node)) closeOrderMenu();
  };
  window.addEventListener('keydown', onKey, true);
  // a click elsewhere closes it (after this event has finished)
  const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown, true), 0);
  closeHandlers.push(() => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('pointerdown', onDown, true);
    clearTimeout(t);
  });
}
