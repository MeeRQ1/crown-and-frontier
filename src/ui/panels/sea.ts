// Inspector cards for the navy and the air arm: a fleet, a sea zone, an air
// wing, and the port and airfield sections of a province card. Unavailable
// actions always say why.

import { airBalance, airControl, airfieldRoom, buildWingProblem, deckSlots, ferryRange, LAND_MISSIONS, MISSION_HELP, MISSION_LABELS, missionPlace, missionProblem, placeName, readyFactor, rebaseProblem, SEA_MISSIONS, wingCost, wingRange, wingsAboard, wingStatus, wingUnlocked, type WingState } from '../../sim/air';
import { C, RESOURCE_INFO, SHIP_TYPES, SHIPS, WING_TYPES, WINGS } from '../../sim/config';
import {
  bombardPlan,
  bombardPower,
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
  raidBalance,
  raidingHere,
  shipCost,
  shipUnlocked,
  zoneBalance,
  zoneBlockaded,
  zoneName,
  zoneRaid,
} from '../../sim/naval';
import { isBeachhead } from '../../sim/supply';
import { atWar, dateOf, provName } from '../../sim/state';
import type { AirWing, Fleet, ProvinceId, ShipType, StrategicResource, WingType } from '../../sim/types';
import type { App } from '../app';
import { action, button, h, row } from '../dom';
import { fmt, plural, weeks } from '../format';
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
    h('span', { class: 'faint' }, `${Math.round(w.strength)}% · ${wingLine(app, w)}`),
  );
  void sim;
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
  // what it did last week beyond sailing (resolved)
  if (f.report && f.report.tick >= st.tick - 1 && f.report.notes.length) body.appendChild(section('Last week (resolved)', h('ul', { class: 'notes small', 'data-sk': 'fleet-report' }, f.report.notes.map((n) => h('li', null, n)))));
  // the air group of its carriers
  const deck = deckSlots(sim, f);
  if (deck.hold) body.appendChild(airGroupSection(app, f));
  // what its ships can do from where it lies
  const ops = fleetOperations(app, f);
  if (ops.length) body.appendChild(section('Operations here', h('ul', { class: 'notes small', 'data-sk': 'fleet-ops' }, ops.map((n) => h('li', null, n)))));
  // ships by type
  const rows: HTMLElement[] = [];
  for (const t of SHIP_TYPES) {
    const ships = f.ships.filter((s) => s.type === t);
    if (!ships.length) continue;
    const avg = ships.reduce((s, x) => s + x.hp, 0) / ships.length;
    const r = row(h('span', null, `${ships.length} × ${ships.length === 1 ? SHIPS[t].label : SHIPS[t].plural}`, h('span', { class: 'faint' }, ` · ${SHIPS[t].role.toLowerCase()}`)), `${Math.round(avg)}%`);
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
        h('p', { class: 'small muted' }, f.landing ? `They land at ${provName(sim, f.landing)} when the fleet reaches a zone on its coast and no enemy warships outgun ours there${f.path.length ? ` (${weeks(fleetEta(sim, f, f.path))} away)` : ''}. Ashore, they are supplied by sea only while a fleet of ours lies off the beach, or once they take a port.` : 'No landing chosen.'),
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

/** The wings aboard a fleet's carriers, its decks, and how to fill them. */
function airGroupSection(app: App, f: Fleet): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const deck = deckSlots(sim, f);
  const aboard = wingsAboard(sim, f.id);
  const items: Array<HTMLElement | null> = [row('Decks', `${aboard.length} of ${deck.hold} wings${deck.operate < deck.hold ? ` · ${deck.operate} working (a carrier below ${C.air.deckHull}% hull cannot operate aircraft)` : ''}`)];
  if (!aboard.length) items.push(h('div', { class: 'callout warn', 'data-sk': 'empty-deck' }, icon('alert'), h('span', null, `No aircraft aboard: the carriers can neither strike nor cover the fleet. Fly fighter, ground-attack or reconnaissance wings aboard from an airfield within reach (twice a wing's range).`)));
  for (const w of aboard) items.push(wingRow(app, w));
  if (f.nation === app.player && aboard.length < deck.hold) {
    const near = Object.keys(st.wings)
      .sort()
      .map((id) => st.wings[id])
      .filter((w) => w.nation === f.nation && w.carrier !== f.id && WINGS[w.type].carrier);
    const acts = near.slice(0, 6).map((w) => action(`Fly ${w.name} aboard`, `${WINGS[w.type].label} at ${w.carrier ? st.fleets[w.carrier]?.name : provName(sim, w.base)} · readiness ${Math.round(w.readiness)}%.`, () => app.do({ type: 'rebaseWing', wing: w.id, carrier: f.id }), rebaseProblem(sim, f.nation, w.id, null, f.id)));
    if (acts.length) items.push(h('div', { class: 'actions' }, acts));
  }
  return section('Air group', ...items);
}

/** What a fleet's ships do where it lies this week: shell a battle, raid trade, blockade, cover the beach. */
function fleetOperations(app: App, f: Fleet): string[] {
  const sim = app.sim!;
  const st = sim.state;
  const out: string[] = [];
  const guns = bombardPower(sim, f);
  if (guns > 0) {
    const plan = bombardPlan(sim);
    let shelling: string | null = null;
    for (const [bid, sides] of plan) for (const side of ['att', 'def'] as const) if (sides[side].some((x) => x.fleet.id === f.id)) shelling = provName(sim, st.battles[bid].province);
    if (shelling) out.push(`Shelling the battle of ${shelling} (naval gunfire, at most +${Math.round(C.naval.bombardMax * 100)}% with every fleet there).`);
    else out.push(f.path.length ? 'Gun ships under way do not bombard.' : `Gun power ${guns.toFixed(1)}: lying still off a coast where our armies fight, it shells the battle (coastal forts fire back).`);
  }
  const raided = raidingHere(sim, f);
  if (f.ships.some((s) => SHIPS[s.type].raid > 0)) out.push(raided.length ? `Raiding the sea trade of ${raided.map((n) => sim.world.nationDefs[n].short).join(', ')} that passes through ${zoneName(sim, f.zone)}.` : `No enemy sea trade passes through ${zoneName(sim, f.zone)}: raiders do nothing here.`);
  const coast = sim.world.zones[f.zone]?.coasts ?? [];
  const blockading = coast.filter((pid) => st.provinces[pid].owner && atWar(sim, f.nation, st.provinces[pid].owner!) && provinceBlockaded(sim, pid));
  if (blockading.length) out.push(`Blockading ${blockading.map((p) => provName(sim, p)).join(', ')}: their crowns, shipyards and sea trade suffer.`);
  const escort = f.ships.reduce((s, x) => s + SHIPS[x.type].escort, 0);
  if (escort > 0 && !f.cargo.length) {
    const ours = raidBalance(sim, f.zone, f.nation);
    if (ours.raid > 0) out.push(`Escorting our trade through ${zoneName(sim, f.zone)} against ${ours.raiders.map((n) => sim.world.nationDefs[n].short).join(', ')} raiders.`);
  }
  const beach = coast.filter((pid) => isBeachhead(sim, pid) && st.provinces[pid].controller === f.nation && st.provinces[pid].owner !== f.nation);
  if (beach.length && !f.path.length) out.push(`Holding the waters off ${beach.map((p) => provName(sim, p)).join(', ')}: our troops there are supplied by sea.`);
  if (airControl(sim, { zone: f.zone }, f.nation) === 'theirs') out.push('Enemy aircraft hold the sky over these waters: struck from the air, our guns would be out-ranged. Bring fighters (a carrier, or land-based fighters over the zone).');
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
    const ctl = airControl(sim, { zone }, me);
    const ab = airBalance(sim, { zone }, me);
    const raid = raidBalance(sim, zone, me);
    body.appendChild(
      section(
        'Air and trade',
        row('The sky', ctl === 'none' ? 'no aircraft' : ctl === 'ours' ? `ours (${fmt(ab.ours, 1)} to ${fmt(ab.theirs, 1)})` : ctl === 'theirs' ? `the enemy's (${fmt(ab.theirs, 1)} to ${fmt(ab.ours, 1)})` : `contested (${fmt(ab.ours, 1)} to ${fmt(ab.theirs, 1)})`),
        row('Enemy raiders here', raid.raid > 0 ? `${fmt(raid.raid, 1)} raid power against ${fmt(raid.escort, 1)} of our escorts: ${Math.round(zoneRaid(sim, zone, me) * 100)}% of our trade passing is lost` : 'none'),
        h('p', { class: 'small muted' }, 'Submarines and cruisers at war with a realm take a share of its sea trade passing through their zone; screens and cruisers of its side there turn most of them away. A reconnaissance patrol overhead lets aircraft and escorts find submarines.'),
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

const STATE_LABEL: Record<WingState, { text: string; cls: string }> = {
  flying: { text: 'Flying', cls: 'good' },
  standby: { text: 'On call', cls: '' },
  grounded: { text: 'Grounded', cls: 'warn' },
  idle: { text: 'Resting', cls: '' },
};

/** One line: what a wing is doing or why not. */
export function wingLine(app: App, w: AirWing): string {
  const sim = app.sim!;
  const s = wingStatus(sim, w);
  if (w.mission === 'idle') return `resting · readiness ${Math.round(w.readiness)}%`;
  const where = placeName(sim, missionPlace(sim, w));
  const what = `${MISSION_LABELS[w.mission].toLowerCase()} over ${where}`;
  return s.state === 'flying' ? what : `${what} · ${STATE_LABEL[s.state].text.toLowerCase()}`;
}

export function wingCard(app: App, w: AirWing): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const mine = w.nation === app.player;
  const r = WINGS[w.type];
  const status = wingStatus(sim, w);
  const tags: HTMLElement[] = [];
  if (app.player && !mine && atWar(sim, app.player, w.nation)) tags.push(h('span', { class: 'tag bad' }, 'Enemy'));
  tags.push(h('span', { class: `tag ${STATE_LABEL[status.state].cls}`, 'data-sk': 'wing-state' }, STATE_LABEL[status.state].text));
  const place = missionPlace(sim, w);
  if (status.state === 'flying' && place) {
    const ctl = airControl(sim, place, w.nation);
    if (ctl !== 'none' && airBalance(sim, place, w.nation).theirs > 0) tags.push(h('span', { class: `tag ${ctl === 'ours' ? 'good' : ctl === 'theirs' ? 'bad' : 'warn'}` }, ctl === 'ours' ? 'We hold the sky' : ctl === 'theirs' ? 'Enemy holds the sky' : 'Contested sky'));
  }
  const out: HTMLElement[] = [head(app, w.nation, w.name, [`${r.label} · ${w.carrier ? `aboard ${st.fleets[w.carrier]?.name ?? 'a carrier'}` : `based at ${provName(sim, w.base)}`}`], tags)];
  if (mine && w.mission !== 'idle') {
    out.push(h('div', { class: 'ins-primary' }, quick('stop', 'Stand down', () => app.do({ type: 'airMission', wing: w.id, mission: 'idle', target: null }), null, 'Rest at the base: readiness and strength recover.')));
  }
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  const rng = wingRange(sim, w);
  body.appendChild(
    h(
      'div',
      { class: 'stat-grid', style: 'margin-top:10px' },
      tile('Strength', `${Math.round(w.strength)}%`, w.carrier ? 'replaced off a friendly port' : 'replaced at the base with materiel', 'Aircraft and crews. Losses come from interception, flak and anti-aircraft fire; replacements are paid in materiel.'),
      tile('Readiness', `${Math.round(w.readiness)}%`, `flies at ${Math.round(readyFactor(w) * 100)}% of its values`, `Each week flown wears it (−${C.air.wear}); rest restores it. Sustained operations settle near 60%. Below ${C.air.minReady}% the wing is grounded; without oil it does not recover.`),
      tile('Range', `${rng}`, `steps over land and sea from ${w.carrier ? 'its carrier' : 'the base'}`, 'A province to its neighbour, a coast to its sea zone and a zone to the next are one step each.'),
      tile('Mission', MISSION_LABELS[w.mission], place ? `over ${placeName(sim, place)}` : w.mission === 'idle' ? 'none' : null),
    ),
  );
  // what it is doing, or why it cannot
  const why = status.state === 'flying' ? null : status.reason;
  if (why) body.appendChild(h('div', { class: `callout ${status.state === 'grounded' ? 'warn' : 'info'}`, style: 'margin-top:8px', 'data-sk': 'wing-reason' }, icon(status.state === 'grounded' ? 'alert' : 'info'), h('span', null, why)));
  // last week, as resolved
  const rep = w.report;
  if (rep) {
    const when = rep.tick === st.tick - 1 ? 'Last week' : `Week of ${dateOf(sim, rep.tick).short}`;
    body.appendChild(
      section(
        `${when} (resolved)`,
        h('p', { class: 'small', 'data-sk': 'wing-report' }, rep.note || (rep.flew ? 'Flew its mission.' : 'Did not fly.')),
        rep.flew || rep.lost > 0
          ? h(
              'div',
              { class: 'strip' },
              h('div', null, h('span', { class: 'k' }, 'Enemy aircraft downed'), h('b', null, `${Math.round(rep.kills)}%`)),
              h('div', null, h('span', { class: 'k' }, 'Hull damage dealt'), h('b', null, `${Math.round(rep.hits)}`)),
              h('div', null, h('span', { class: 'k' }, 'Strength lost'), h('b', null, `${Math.round(rep.lost)}`)),
            )
          : null,
      ),
    );
  }
  body.appendChild(h('p', { class: 'small muted', style: 'margin-top:8px' }, `${r.role}. ${r.description}`));
  if (mine) {
    const acts: HTMLElement[] = [];
    for (const m of r.missions) {
      const sea = SEA_MISSIONS.includes(m);
      const land = LAND_MISSIONS.includes(m);
      const where = sea && land ? 'Click a province or a sea zone on the map.' : sea ? 'Click a sea zone on the map.' : 'Click a province on the map.';
      acts.push(action(`Fly ${MISSION_LABELS[m].toLowerCase()}…`, `${MISSION_HELP[m]} ${where}`, () => app.startAirTarget(w.id, m), null));
      // from a carrier, the sea missions can simply cover the fleet wherever it sails
      if (w.carrier && sea) acts.push(action(`${MISSION_LABELS[m]} over the fleet`, `Over the zone the carrier lies in, wherever it sails.`, () => app.do({ type: 'airMission', wing: w.id, mission: m, target: null, zone: null }), missionProblem(sim, w.nation, w.id, m, null, null)));
    }
    body.appendChild(section('Missions', h('div', { class: 'actions', 'data-sk': 'wing-missions' }, acts)));
    // where it can fly from: airfields and carriers within ferry range
    const ferry = ferryRange(sim, w);
    const fields = sim.world.provIds.filter((pid) => st.provinces[pid].airfield > 0 && st.provinces[pid].owner === w.nation && st.provinces[pid].controller === w.nation && (pid !== w.base || w.carrier));
    const carriers = Object.keys(st.fleets)
      .sort()
      .map((id) => st.fleets[id])
      .filter((f) => f.nation === w.nation && f.id !== w.carrier && deckSlots(sim, f).hold > 0);
    const rebase: HTMLElement[] = [];
    for (const f of carriers) rebase.push(action(`Aboard ${f.name}`, `${zoneName(sim, f.zone)} · decks ${wingsAboard(sim, f.id).length}/${deckSlots(sim, f).hold}. Costs ${C.air.rebase} readiness.`, () => app.do({ type: 'rebaseWing', wing: w.id, carrier: f.id }), rebaseProblem(sim, w.nation, w.id, null, f.id)));
    for (const pid of fields.slice(0, 8)) rebase.push(action(`To ${provName(sim, pid)}`, `${plural(airfieldRoom(sim, pid), 'free place')}. Costs ${C.air.rebase} readiness.`, () => app.do({ type: 'rebaseWing', wing: w.id, base: pid }), rebaseProblem(sim, w.nation, w.id, pid)));
    if (rebase.length) body.appendChild(section('Change base', h('p', { class: 'small muted' }, `A wing flies up to ${ferry} steps to a new airfield or carrier${r.carrier ? '' : ' (bombers cannot use carriers)'}.`), h('div', { class: 'actions' }, rebase)));
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
  const cell = (label: string, value: string, title?: string) => h('div', { title }, h('span', { class: 'k' }, label), h('b', null, value));
  return section(
    'Navy and air',
    h(
      'div',
      { class: 'strip' },
      cell('Fleets', `${fleets.length} · ${ships} ships`),
      cell('Fleet upkeep', `${fmt(l.expenses['Fleet upkeep'] ?? 0)} cr/mo`),
      cell('Air wings', `${wings.length} · ${wings.filter((w) => wingStatus(sim, w).state === 'flying').length} flying · ${wings.filter((w) => wingStatus(sim, w).state === 'grounded').length} grounded`, 'flying this week · with a mission they cannot fly (see why on each)'),
      cell('Blockades', `${theirBlockaded.length} held · ${ourBlockaded.length} on us`, 'enemy coasts we blockade · our coasts blockaded'),
    ),
    fleets.length ? h('div', null, ...fleets.map((f) => fleetRow(app, f))) : h('p', { class: 'small muted' }, 'No fleets. Ships are built in ports (a province card on the coast).'),
    ourBlockaded.length ? h('div', { class: 'callout bad', style: 'margin-top:6px' }, icon('alert'), h('span', null, `Blockaded: ${ourBlockaded.map((p) => provName(sim, p)).join(', ')}. Win back the sea around them or our trade and their crowns suffer.`)) : null,
    theirBlockaded.length ? h('p', { class: 'small good' }, `We blockade: ${theirBlockaded.map((p) => provName(sim, p)).join(', ')}.`) : null,
    wings.length ? airOperations(app, wings) : st.nations[me].research.done.includes('aviation') ? h('p', { class: 'small muted' }, 'No air wings. Build an airfield in a province, then raise wings there.') : h('p', { class: 'small muted' }, 'Aircraft arrive with the Aviation technology (horizon 1908).'),
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

/** Every wing of ours in one table: where it flies from, its mission and state, readiness, and last week's result. */
function airOperations(app: App, wings: AirWing[]): HTMLElement {
  const sim = app.sim!;
  const rows = wings.map((w) => {
    const s = wingStatus(sim, w);
    const name = h('button', { class: 'linkish', type: 'button', 'data-fk': `air-op-${w.id}` }, w.name);
    name.addEventListener('click', () => app.selectWing(w.id));
    return h(
      'tr',
      null,
      h('td', null, name),
      h('td', { class: 'small' }, w.carrier ? `aboard ${sim.state.fleets[w.carrier]?.name ?? '?'}` : provName(sim, w.base)),
      h('td', { class: `small ${s.state === 'grounded' ? 'warn' : ''}` }, wingLine(app, w), s.state === 'grounded' ? h('div', { class: 'faint' }, s.reason) : null),
      h('td', { class: 'r' }, `${Math.round(w.readiness)}%`),
      h('td', { class: 'small faint' }, w.report?.note ?? ''),
    );
  });
  return h(
    'div',
    { style: 'margin-top:6px', 'data-sk': 'air-operations' },
    h('div', { class: 'eyebrow' }, 'Air operations'),
    h('table', { class: 'register compact' }, h('thead', null, h('tr', null, h('th', null, 'Wing'), h('th', null, 'Flies from'), h('th', null, 'Mission'), h('th', { class: 'r' }, 'Ready'), h('th', null, 'Last week'))), h('tbody', null, rows)),
  );
}
