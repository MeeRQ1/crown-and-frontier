// Inspector cards for the navy and the air arm: a fleet, a sea zone, an air
// wing, and the port and airfield sections of a province card. Unavailable
// actions always say why.

import { activeMission, airControl, airfieldRoom, buildWingProblem, MISSION_LABELS, missionProblem, rebaseProblem, wingCost, wingRange, wingUnlocked } from '../../sim/air';
import { C, RESOURCE_INFO, SHIP_TYPES, SHIPS, WING_TYPES, WINGS } from '../../sim/config';
import {
  buildShipProblem,
  cargoRegiments,
  disbandFleetProblem,
  fleetCapacity,
  fleetEta,
  fleetsIn,
  fleetSpeed,
  fleetSummary,
  fleetValue,
  mergeFleetsProblem,
  portZone,
  provinceBlockaded,
  shipCost,
  shipUnlocked,
  zoneBalance,
  zoneBlockaded,
  zoneName,
} from '../../sim/naval';
import { atWar, provName } from '../../sim/state';
import type { AirMission, AirWing, Fleet, ProvinceId, ShipType, StrategicResource, WingType } from '../../sim/types';
import type { App } from '../app';
import { action, button, h, row } from '../dom';
import { fmt, weeks } from '../format';
import { icon } from '../icons';
import { section, shield } from './common';
import { confirmDialog } from './dialogs';
import { head, quick, tile } from './inspector';

function resText(res: Partial<Record<StrategicResource, number>>): string {
  return Object.entries(res)
    .map(([r, v]) => `${v} ${RESOURCE_INFO[r as StrategicResource].label.toLowerCase()}`)
    .join(', ');
}

export function fleetStatus(app: App, f: Fleet): string {
  const sim = app.sim!;
  if (f.path.length) return `Sailing to ${zoneName(sim, f.path[f.path.length - 1])} · ${weeks(fleetEta(sim, f, f.path))}`;
  return `In ${zoneName(sim, f.zone)}`;
}

export function fleetRow(app: App, f: Fleet): HTMLElement {
  const b = h('button', { class: 'btn quiet', type: 'button', style: 'width:100%;justify-content:flex-start;margin:2px 0', 'data-fk': `fleet-${f.id}` }, shield(app, f.nation), h('span', { class: 'grow', style: 'text-align:left' }, f.name), h('span', { class: 'faint' }, fleetSummary(f)), f.cargo.length ? icon('army') : null);
  b.addEventListener('click', () => app.selectFleet(f.id));
  return b;
}

export function wingRow(app: App, w: AirWing): HTMLElement {
  const sim = app.sim!;
  const b = h(
    'button',
    { class: 'btn quiet', type: 'button', style: 'width:100%;justify-content:flex-start;margin:2px 0', 'data-fk': `wing-${w.id}` },
    shield(app, w.nation),
    h('span', { class: 'grow', style: 'text-align:left' }, w.name),
    h('span', { class: 'faint' }, `${Math.round(w.strength)}% · ${w.mission === 'idle' ? 'idle' : `${MISSION_LABELS[w.mission].toLowerCase()}${w.target ? ` over ${provName(sim, w.target)}` : ''}`}`),
  );
  b.addEventListener('click', () => app.selectWing(w.id));
  return b;
}

// ───────────────────────────── Fleet ────────────────────────────────────────

export function fleetCard(app: App, f: Fleet): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const mine = f.nation === app.player;
  const out: HTMLElement[] = [];
  const tags: HTMLElement[] = [];
  if (app.player && !mine && atWar(sim, app.player, f.nation)) tags.push(h('span', { class: 'tag bad' }, 'Enemy'));
  if (f.cargo.length) tags.push(h('span', { class: 'tag brass' }, `Carrying ${f.cargo.length} ${f.cargo.length === 1 ? 'army' : 'armies'}${f.landing ? ` to ${provName(sim, f.landing)}` : ''}`));
  const hp = f.ships.reduce((s, x) => s + x.hp, 0) / Math.max(1, f.ships.length);
  if (hp < 50) tags.push(h('span', { class: 'tag warn' }, 'Damaged'));
  const coast = sim.world.zones[f.zone]?.coasts ?? [];
  if (coast.some((pid) => st.provinces[pid].owner && atWar(sim, f.nation, st.provinces[pid].owner!) && provinceBlockaded(sim, pid))) tags.push(h('span', { class: 'tag good' }, 'Blockading'));
  out.push(head(app, f.nation, f.name, [`${sim.world.nationDefs[f.nation].short} · ${fleetStatus(app, f)}`], tags));

  if (mine) {
    const prim: HTMLElement[] = [];
    prim.push(quick('move', app.targeting?.kind === 'fleet' ? 'Choose a zone…' : 'Sail', () => app.startFleetMove(f.id), null, 'Then click a sea zone (or a coast) on the map, or right-click it directly. Fleets entering a zone held by enemy warships stop there and fight.', 'primary'));
    if (f.path.length) prim.push(quick('stop', 'Halt', () => app.do({ type: 'stopFleet', fleet: f.id }), null, 'Stop in the current zone.'));
    const others = fleetsIn(sim, f.zone).filter((x) => x.nation === f.nation && x.id !== f.id);
    if (others.length) {
      const ids = [f.id, ...others.map((o) => o.id)];
      prim.push(quick('merge', `Merge ${ids.length}`, () => app.do({ type: 'mergeFleets', fleets: ids }), mergeFleetsProblem(sim, f.nation, ids), 'Combine every squadron of ours in this zone.'));
    }
    if (f.cargo.length) {
      prim.push(
        quick('target', 'Change beach', () => {
          app.targeting = { kind: 'ship', armies: [...f.cargo], fleet: f.id };
          app.canvas.classList.add('move-mode');
          app.toast('Click the coastal province to land on. Esc cancels.');
          app.refresh();
        }, null, 'Choose another coast for the troops aboard.'),
      );
    }
    out.push(h('div', { class: 'ins-primary' }, prim));
  }

  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  const cap = fleetCapacity(f);
  body.appendChild(
    h(
      'div',
      { class: 'stat-grid', style: 'margin-top:10px' },
      tile('Ships', `${f.ships.length}`, fleetSummary(f)),
      tile('Fighting value', fmt(fleetValue(f), 1), null, 'Guns, torpedoes, anti-submarine and air strike values of the ships afloat, weighted by size and condition.'),
      tile('Condition', `${Math.round(hp)}%`, f.home ? `home ${provName(sim, f.home)}` : 'no home port', 'Damage lowers fighting value. Ships repair in a zone on the coast of a friendly port; far from any port they wear down.'),
      tile('Speed', `${fmt(fleetSpeed(sim, f), 1)}`, `zones / week${cap ? ` · carries ${cargoRegiments(sim, f)}/${cap}` : ''}`),
    ),
  );
  // ships by type
  const rows: HTMLElement[] = [];
  for (const t of SHIP_TYPES) {
    const ships = f.ships.filter((s) => s.type === t);
    if (!ships.length) continue;
    const avg = ships.reduce((s, x) => s + x.hp, 0) / ships.length;
    const r = row(h('span', null, `${ships.length} × ${ships.length === 1 ? SHIPS[t].label : SHIPS[t].plural}`), `${Math.round(avg)}%`);
    rows.push(r);
    if (mine && ships.length < f.ships.length) {
      rows.push(
        h(
          'div',
          { style: 'margin:0 0 4px' },
          button(`Detach the ${ships.length === 1 ? SHIPS[t].label.toLowerCase() : SHIPS[t].plural.toLowerCase()}`, () => app.do({ type: 'splitFleet', fleet: f.id, ships: ships.map((s) => s.id) }), { cls: 'small quiet', fk: `detach-${t}` }),
        ),
      );
    }
  }
  body.appendChild(section('Ships', ...rows));
  // the sea around it
  const z = sim.world.zones[f.zone];
  if (z) {
    const b = zoneBalance(sim, f.zone, f.nation);
    body.appendChild(
      section(
        'At sea',
        row('Zone', h('button', { class: 'linkish', type: 'button', onclick: () => app.selectZone(f.zone) }, z.name)),
        row('Our side’s surface power', fmt(b.friendSurface, 1)),
        row('Enemy surface / submarine power', `${fmt(b.hostileSurface, 1)} / ${fmt(b.hostileSubs, 1)}`),
        z.straits?.length ? row('Straits commanded', z.straits.map(([a, c]) => `${provName(sim, a)}–${provName(sim, c)}`).join(', ')) : null,
      ),
    );
  }
  if (f.cargo.length) {
    body.appendChild(
      section(
        'Troops aboard',
        ...f.cargo.map((id) => {
          const a = st.armies[id];
          return a ? row(a.name, `${a.regiments.length} regiments`) : null;
        }),
        h('p', { class: 'small muted' }, f.landing ? `They land at ${provName(sim, f.landing)} when the fleet reaches a zone on its coast and no enemy warships outgun ours there.` : 'No landing chosen.'),
      ),
    );
  }
  if (mine) {
    const prob = disbandFleetProblem(sim, f.nation, f.id);
    body.appendChild(
      section(
        'Orders',
        action('Pay off the fleet', 'The ships are decommissioned: no more upkeep or fuel. This cannot be undone.', () => confirmDialog(app, `Pay off ${f.name}?`, `${f.ships.length} ships will be decommissioned.`, () => app.do({ type: 'disbandFleet', fleet: f.id }), 'Pay off'), prob),
      ),
    );
  }
  out.push(body);
  return out;
}

// ───────────────────────────── Sea zone ─────────────────────────────────────

export function zoneCard(app: App, zone: string): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const z = sim.world.zones[zone];
  const me = app.player;
  const tags: HTMLElement[] = [];
  if (me && zoneBlockaded(sim, zone, me) && z.coasts.some((p) => st.provinces[p].owner === me)) tags.push(h('span', { class: 'tag bad' }, 'Enemy holds these waters'));
  const out: HTMLElement[] = [h('div', null, h('div', { class: 'ins-head' }, h('span', { class: 'shield lg', style: 'display:grid;place-items:center' }, icon('anchor')), h('div', { class: 'titles' }, h('h2', null, z.name), h('div', { class: 'sub' }, `Sea zone · ${z.coasts.length} coastal provinces · ${z.neighbors.length} neighbouring zones`), tags.length ? h('div', { class: 'facts' }, tags) : null), (() => {
    const close = h('button', { class: 'btn quiet small icon close', type: 'button', 'aria-label': 'Close (Esc)', 'data-fk': 'ins-close' }, icon('close'));
    close.addEventListener('click', () => app.clearSelection());
    return close;
  })()))];
  const sel = app.selectedFleet ? st.fleets[app.selectedFleet] : undefined;
  void sel;
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  const here = fleetsIn(sim, zone);
  body.appendChild(section('Fleets here', ...(here.length ? here.map((f) => fleetRow(app, f)) : [h('p', { class: 'small muted' }, 'No fleets in these waters.')])));
  const mine = me ? [...Object.values(st.fleets)].filter((f) => f.nation === me && f.zone !== zone) : [];
  if (mine.length) {
    body.appendChild(
      section(
        'Send a fleet here',
        ...mine.slice(0, 6).map((f) => action(`${f.name} (${fleetSummary(f)})`, `From ${zoneName(sim, f.zone)}.`, () => app.do({ type: 'moveFleet', fleet: f.id, zone }), null)),
      ),
    );
  }
  if (me) {
    const b = zoneBalance(sim, zone, me);
    body.appendChild(
      section(
        'Sea control',
        row('Our side’s surface power', fmt(b.friendSurface, 1)),
        row('Enemy surface / submarine power', `${fmt(b.hostileSurface, 1)} / ${fmt(b.hostileSubs, 1)}`),
        h('p', { class: 'small muted' }, `Enemy warships that outgun ours here close the straits this zone commands to us. Where every zone on a coast holds enemy warships (submarines count half) at ${C.naval.blockadeRatio}× our surface power, that coast is blockaded: it loses ${Math.round(C.naval.blockadeIncome * 100)}% of its crowns and its sea trade.`),
      ),
    );
  }
  if (z.straits?.length) body.appendChild(section('Straits it commands', ...z.straits.map(([a, c]) => row(`${provName(sim, a)} – ${provName(sim, c)}`, ''))));
  body.appendChild(
    section(
      'Coasts',
      ...z.coasts.map((pid) => {
        const p = st.provinces[pid];
        const b = h('button', { class: 'btn quiet', type: 'button', style: 'width:100%;justify-content:flex-start;margin:2px 0' }, p.owner ? shield(app, p.owner) : null, h('span', { class: 'grow', style: 'text-align:left' }, provName(sim, pid)), p.port ? h('span', { class: 'faint' }, `port ${p.port}`) : null, provinceBlockaded(sim, pid) ? h('span', { class: 'bad' }, 'blockaded') : null);
        b.addEventListener('click', () => app.selectProvince(pid, true));
        return b;
      }),
    ),
  );
  if (z.neighbors.length) body.appendChild(section('Neighbouring zones', h('p', { class: 'small' }, z.neighbors.map((n) => zoneName(sim, n)).join(', '))));
  out.push(body);
  return out;
}

// ───────────────────────────── Air wing ─────────────────────────────────────

export function wingCard(app: App, w: AirWing): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const mine = w.nation === app.player;
  const r = WINGS[w.type];
  const tags: HTMLElement[] = [];
  if (app.player && !mine && atWar(sim, app.player, w.nation)) tags.push(h('span', { class: 'tag bad' }, 'Enemy'));
  if (w.mission !== 'idle' && w.target) {
    const ctl = airControl(sim, w.target, w.nation);
    tags.push(h('span', { class: `tag ${ctl === 'ours' ? 'good' : ctl === 'theirs' ? 'bad' : ''}` }, ctl === 'ours' ? 'Air superiority' : ctl === 'theirs' ? 'Enemy holds the sky' : ctl === 'contested' ? 'Contested sky' : 'Quiet sky'));
  }
  const out: HTMLElement[] = [head(app, w.nation, w.name, [`${r.label} · based at ${provName(sim, w.base)}`], tags)];
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  body.appendChild(
    h(
      'div',
      { class: 'stat-grid', style: 'margin-top:10px' },
      tile('Strength', `${Math.round(w.strength)}%`, 'replenished at a quiet base with materiel'),
      tile('Range', `${wingRange(sim, w)}`, 'provinces from the base'),
      tile('Mission', MISSION_LABELS[w.mission], w.target ? `over ${provName(sim, w.target)}${activeMission(sim, w) ? '' : ' (out of range)'}` : null),
      tile('Values', `air ${r.air} · ground ${r.ground}`, `bombing ${r.bomb} · upkeep ${r.upkeep}/mo`),
    ),
  );
  body.appendChild(h('p', { class: 'small muted', style: 'margin-top:8px' }, r.description));
  if (mine) {
    const missions: AirMission[] = r.missions;
    const acts = missions.map((m) => {
      const detail: Record<string, string> = {
        superiority: `Fight for the sky over the target and its neighbours. With ${C.air.superiority}× the enemy's air power we hold superiority: their support and interdiction fall to ${Math.round(C.air.contested * 100)}%.`,
        support: `Our battles in the area fire up to +${Math.round(C.air.supportMax * 100)}% harder.`,
        interdiction: `Enemy armies in the area lose up to ${Math.round(C.air.interdictSupplyMax * 100)}% supply and ${Math.round(C.air.interdictMoveMax * 100)}% speed.`,
        bombing: `Factories in an enemy-held province lose up to ${Math.round(C.air.bombIndustryMax * 100)}% of their output; forts shoot back.`,
        recon: `Our battles in the area fire +${Math.round(C.air.recon * 100)}% harder.`,
      };
      return action(`Fly ${MISSION_LABELS[m].toLowerCase()}…`, `${detail[m]} Choose the target on the map.`, () => app.startAirTarget(w.id, m), null);
    });
    if (w.mission !== 'idle') acts.push(action('Stand down', 'Return to base and replenish.', () => app.do({ type: 'airMission', wing: w.id, mission: 'idle', target: null }), missionProblem(sim, w.nation, w.id, 'idle', null)));
    body.appendChild(section('Missions', h('div', { class: 'actions' }, acts)));
    const fields = sim.world.provIds.filter((pid) => st.provinces[pid].airfield > 0 && st.provinces[pid].controller === w.nation && pid !== w.base);
    if (fields.length) {
      body.appendChild(section('Rebase', h('div', { class: 'actions' }, fields.slice(0, 6).map((pid) => action(`To ${provName(sim, pid)}`, `${airfieldRoom(sim, pid)} free place(s).`, () => app.do({ type: 'rebaseWing', wing: w.id, base: pid }), rebaseProblem(sim, w.nation, w.id, pid))))));
    }
    body.appendChild(section('Orders', action('Disband the wing', 'No more upkeep or fuel. This cannot be undone.', () => confirmDialog(app, `Disband ${w.name}?`, 'The aircraft and crews are stood down for good.', () => app.do({ type: 'disbandWing', wing: w.id }), 'Disband'), null)));
  }
  out.push(body);
  return out;
}

// ───────────────────────────── Province sections ────────────────────────────

/** Port: shipyard, ships under construction, fleets off this coast. */
export function portSection(app: App, pid: ProvinceId): HTMLElement | null {
  const sim = app.sim!;
  const st = sim.state;
  const p = st.provinces[pid];
  const me = app.player;
  if (!sim.world.provZones[pid]) return null;
  const items: (HTMLElement | null)[] = [];
  items.push(row('Port', p.port ? `level ${p.port} · ${p.dock.length}/${p.port} slipways in use` : 'none'));
  const zone = portZone(sim, pid);
  if (zone) items.push(row('Launches into', h('button', { class: 'linkish', type: 'button', onclick: () => app.selectZone(zone) }, zoneName(sim, zone))));
  if (provinceBlockaded(sim, pid)) items.push(h('div', { class: 'callout bad' }, icon('alert'), h('span', null, `Blockaded: this coast loses ${Math.round(C.naval.blockadeIncome * 100)}% of its crowns and its sea trade.`)));
  if (p.dock.length) items.push(h('p', { class: 'small' }, `On the slipways: ${p.dock.map((o) => `${SHIPS[o.ship].label} (${o.weeksLeft} wk)`).join(', ')}`));
  if (me && p.owner === me && p.port > 0) {
    const acts = SHIP_TYPES.filter((t: ShipType) => shipUnlocked(sim, me, t) || SHIPS[t].requires).map((t) => {
      const c = shipCost(sim, me, t);
      const res = resText(c.resources);
      const r = SHIPS[t];
      return action(
        `Build ${r.label.toLowerCase()}`,
        `${c.crowns} crowns, ${c.materiel} materiel${res ? `, ${res}` : ''} · ${c.weeks} weeks · upkeep ${r.upkeep}/mo + ${r.fuel} ${r.oil ? 'oil' : 'coal'}. ${r.description}`,
        () => app.do({ type: 'buildShip', province: pid, ship: t }),
        buildShipProblem(sim, me, pid, t),
      );
    });
    items.push(h('div', { class: 'actions' }, acts));
    if (p.dock.some((o) => o.nation === me)) items.push(button('Cancel the newest ship', () => app.do({ type: 'cancelShip', province: pid }), { cls: 'small quiet' }));
  }
  const near = (sim.world.provZones[pid] ?? []).flatMap((z) => [...fleetsIn(sim, z)]);
  if (near.length) items.push(h('div', { style: 'margin-top:6px' }, h('div', { class: 'eyebrow' }, 'Fleets off this coast'), ...near.map((f) => fleetRow(app, f))));
  return section('Port and fleets', ...items);
}

/** Airfield: wings based here, wings in training, building wings. */
export function airfieldSection(app: App, pid: ProvinceId): HTMLElement | null {
  const sim = app.sim!;
  const st = sim.state;
  const p = st.provinces[pid];
  const me = app.player;
  const based = Object.keys(st.wings)
    .sort()
    .map((id) => st.wings[id])
    .filter((w) => w.base === pid);
  if (!p.airfield && !based.length) return null;
  const items: (HTMLElement | null)[] = [row('Airfield', `level ${p.airfield} · room for ${p.airfield * C.air.wingsPerAirfield} wings`)];
  if (based.length) items.push(...based.map((w) => wingRow(app, w)));
  if (p.hangar.length) items.push(h('p', { class: 'small' }, `In training: ${p.hangar.map((o) => `${WINGS[o.wing].label} (${o.weeksLeft} wk)`).join(', ')}`));
  if (me && p.owner === me && p.airfield > 0) {
    const acts = WING_TYPES.map((t: WingType) => {
      const c = wingCost(sim, me, t);
      const r = WINGS[t];
      return action(
        `Raise ${r.label.toLowerCase()}`,
        `${c.crowns} crowns, ${c.materiel} materiel, ${resText(c.resources)} · ${c.weeks} weeks · upkeep ${r.upkeep}/mo + ${r.fuel} oil · range ${r.range}. ${r.description}`,
        () => app.do({ type: 'buildWing', province: pid, wing: t }),
        wingUnlocked(sim, me, t) ? buildWingProblem(sim, me, pid, t) : `Needs the technology ${r.requires.replace(/_/g, ' ')}.`,
      );
    });
    items.push(h('div', { class: 'actions' }, acts));
    if (p.hangar.some((o) => o.nation === me)) items.push(button('Cancel the newest wing', () => app.do({ type: 'cancelWing', province: pid }), { cls: 'small quiet' }));
  }
  return section('Airfield and air wings', ...items);
}

/** The Military ledger's navy and air section. */
export function navyAirSection(app: App): HTMLElement | null {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player;
  if (!me) return null;
  const fleets = Object.keys(st.fleets)
    .sort()
    .map((id) => st.fleets[id])
    .filter((f) => f.nation === me);
  const wings = Object.keys(st.wings)
    .sort()
    .map((id) => st.wings[id])
    .filter((w) => w.nation === me);
  const ships = fleets.reduce((n, f) => n + f.ships.length, 0);
  const l = st.nations[me].lastMonth;
  const ourBlockaded = sim.world.provIds.filter((pid) => st.provinces[pid].owner === me && provinceBlockaded(sim, pid));
  const theirBlockaded = sim.world.provIds.filter((pid) => {
    const o = st.provinces[pid].owner;
    return !!o && atWar(sim, me, o) && provinceBlockaded(sim, pid);
  });
  const reports = st.reports.filter((r) => r.sea && (r.attackerNations.includes(me) || r.defenderNations.includes(me))).slice(-5).reverse();
  const tileEl = (label: string, value: string, sub?: string) => h('div', { class: 'stat-tile' }, h('div', { class: 'eyebrow' }, label), h('div', { class: 'big' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
  return section(
    'Navy and air',
    h(
      'div',
      { class: 'stat-grid' },
      tileEl('Fleets', String(fleets.length), `${ships} ships`),
      tileEl('Fleet upkeep', `${fmt(l.expenses['Fleet upkeep'] ?? 0)}/mo`, 'crowns, last month'),
      tileEl('Air wings', String(wings.length), `${wings.filter((w) => w.mission !== 'idle').length} on missions`),
      tileEl('Blockades', `${theirBlockaded.length} / ${ourBlockaded.length}`, 'enemy coasts we hold / our coasts held'),
    ),
    fleets.length ? h('div', null, ...fleets.map((f) => fleetRow(app, f))) : h('p', { class: 'small muted' }, 'No fleets. Ships are built in ports (a province card on the coast).'),
    ourBlockaded.length ? h('div', { class: 'callout bad', style: 'margin-top:6px' }, icon('alert'), h('span', null, `Blockaded: ${ourBlockaded.map((p) => provName(sim, p)).join(', ')}. Win back the sea around them or our trade and their crowns suffer.`)) : null,
    theirBlockaded.length ? h('p', { class: 'small good' }, `We blockade: ${theirBlockaded.map((p) => provName(sim, p)).join(', ')}.`) : null,
    wings.length ? h('div', { style: 'margin-top:6px' }, h('div', { class: 'eyebrow' }, 'Air wings'), ...wings.map((w) => wingRow(app, w))) : st.nations[me].research.done.includes('aviation') ? h('p', { class: 'small muted' }, 'No air wings. Build an airfield in a province, then raise wings there.') : h('p', { class: 'small muted' }, 'Aircraft arrive with the Aviation technology (horizon 1908).'),
    reports.length
      ? h(
          'div',
          { style: 'margin-top:6px' },
          h('div', { class: 'eyebrow' }, 'Recent naval battles'),
          ...reports.map((r) => row(`${zoneName(sim, r.province)}`, r.outcome)),
        )
      : null,
  );
}
