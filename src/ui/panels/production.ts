// Production orders (format 9), in the Military ledger: several ships, air wings or
// regiments of one type in one order, at one place or spread over several. The form
// previews what the order will do before it is given (per place: room, what is already
// there, its share and what starts at once; the cost against what we have; upkeep and
// how long it takes); the list shows every order's progress with pause, resume and
// cancel. Payment, capacity and deployment follow the ordinary rules (sim/production.ts).

import { checkCommand } from '../../sim/commands';
import { RESOURCE_INFO, SHIPS, SHIP_TYPES, UNITS, UNIT_TYPES, WINGS, WING_TYPES } from '../../sim/config';
import { portZone, zoneName } from '../../sim/naval';
import { enRoute, orderTotals, previewProduction, PRODUCTION_KIND_LABELS, PRODUCTION_LIMITS, productionPlaces, productionSummary, typeProblem, unitLabel } from '../../sim/production';
import { provName } from '../../sim/state';
import type { NationId, ProductionOrder, ProvinceId, StrategicResource } from '../../sim/types';
import type { App } from '../app';
import { bar, button, h, setChildren } from '../dom';
import { fmt, men } from '../format';
import { icon } from '../icons';
import { section } from './common';

type Kind = ProductionOrder['kind'];

/** The order being drawn up (per session, not part of the game state). */
interface Draft {
  kind: Kind;
  unit: string;
  places: ProvinceId[];
  mode: 'per' | 'total';
  count: number;
  /** '' stay where built · `op:<id>` join an operation · `rally:<id>` move to an airfield / sail to a zone */
  deploy: string;
}
let draft: Draft | null = null;

const TYPES: Record<Kind, string[]> = { ship: SHIP_TYPES, wing: WING_TYPES, regiment: UNIT_TYPES };

/** The form opens on this kind (the Military ledger's buttons; a province card can open it too). */
export function openProduction(app: App, kind: Kind, places?: ProvinceId[]): void {
  const sim = app.sim!;
  const me = app.player!;
  const unit = TYPES[kind].find((t) => !typeProblem(sim, me, kind, t)) ?? TYPES[kind][0];
  draft = { kind, unit, places: places ?? defaultPlaces(app, kind, unit), mode: 'total', count: kind === 'regiment' ? 4 : 5, deploy: '' };
  app.openLedger('military');
  app.refresh();
}

/** Every port or airfield that can build (as many as an order holds); regiments: the capital, else the most developed province. */
function defaultPlaces(app: App, kind: Kind, unit: string): ProvinceId[] {
  const sim = app.sim!;
  const me = app.player!;
  const all = productionPlaces(sim, me, kind, unit);
  if (kind !== 'regiment') {
    const level = (p: ProvinceId) => (kind === 'ship' ? sim.state.provinces[p].port : sim.state.provinces[p].airfield);
    return all.sort((a, b) => level(b) - level(a) || (a < b ? -1 : 1)).slice(0, PRODUCTION_LIMITS.places);
  }
  const cap = sim.state.nations[me].capital;
  if (cap && all.includes(cap)) return [cap];
  return all.sort((a, b) => sim.state.provinces[b].dev - sim.state.provinces[a].dev).slice(0, 1);
}

function assignOf(d: Draft): { op?: string | null; rally?: string | null } | undefined {
  if (d.deploy.startsWith('op:')) return { op: d.deploy.slice(3) };
  if (d.deploy.startsWith('rally:')) return { rally: d.deploy.slice(6) };
  return undefined;
}

/** The Military ledger's Production: new orders, and the orders under way. */
export function productionSection(app: App): HTMLElement | null {
  const sim = app.sim!;
  const me = app.player;
  if (!me) return null;
  const orders = sim.state.nations[me].production ?? [];
  const head = h(
    'div',
    { class: 'row wrap', style: 'gap:6px;margin-bottom:6px' },
    (['ship', 'wing', 'regiment'] as Kind[]).map((k) =>
      button(`Order ${PRODUCTION_KIND_LABELS[k].toLowerCase()}…`, () => openProduction(app, k), {
        cls: `small ${draft?.kind === k ? 'primary' : 'quiet'}`,
        icon: k === 'ship' ? 'anchor' : k === 'wing' ? 'plane' : 'flag',
        fk: `prod-new-${k}`,
        title: `Several ${PRODUCTION_KIND_LABELS[k].toLowerCase()} in one order: they are laid down and paid for as ${k === 'ship' ? 'slipways' : k === 'wing' ? 'airfield room' : 'training places'} and means allow`,
      }),
    ),
  );
  return section(
    'Production orders',
    head,
    draft ? form(app, me, draft) : null,
    orders.length ? h('div', null, ...orders.map((o) => orderCard(app, me, o))) : draft ? null : h('p', { class: 'small muted' }, 'No standing orders. Order several ships, air wings or regiments at once: what the slipways, airfields and treasury allow starts now, the rest as room and money come.'),
  );
}

function form(app: App, me: NationId, d: Draft): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const kind = d.kind;
  const label = (t: string) => (kind === 'ship' ? SHIPS[t as keyof typeof SHIPS].label : kind === 'wing' ? WINGS[t as keyof typeof WINGS].label : UNITS[t as keyof typeof UNITS].label);
  // type
  const types = h(
    'div',
    { class: 'segmented wrap' },
    TYPES[kind].map((t) => {
      const why = typeProblem(sim, me, kind, t);
      const b = h('button', { class: d.unit === t ? 'active' : '', type: 'button', 'data-fk': `prod-type-${t}`, 'aria-pressed': d.unit === t ? 'true' : 'false', title: why ?? undefined, 'aria-disabled': why ? 'true' : undefined }, label(t));
      b.addEventListener('click', () => {
        if (why) return;
        d.unit = t;
        // the places that can build it (a type may need a larger port, a technology…)
        d.places = d.places.filter((p) => productionPlaces(sim, me, kind, t).includes(p));
        if (!d.places.length) d.places = defaultPlaces(app, kind, t);
        app.refresh();
      });
      return b;
    }),
  );
  // per place or in total
  const modeBtn = (m: 'per' | 'total', text: string) => {
    const b = h('button', { class: d.mode === m ? 'active' : '', type: 'button', 'data-fk': `prod-mode-${m}`, 'aria-pressed': d.mode === m ? 'true' : 'false' }, text);
    b.addEventListener('click', () => {
      d.mode = m;
      app.refresh();
    });
    return b;
  };
  const count = h('input', { type: 'number', min: '1', max: String(PRODUCTION_LIMITS.count), step: '1', value: String(d.count), 'data-fk': 'prod-count', 'aria-label': 'How many', style: 'width:5em' }) as HTMLInputElement;
  // places
  const all = productionPlaces(sim, me, kind, d.unit);
  const chips = all.slice(0, 80).map((pid) => {
    const on = d.places.includes(pid);
    const p = st.provinces[pid];
    const cap = kind === 'ship' ? `${p.port - p.dock.length}/${p.port} free` : kind === 'wing' ? `level ${p.airfield}` : `dev ${Math.round(p.dev)}`;
    const b = h('button', { class: `chip ${on ? 'on' : ''}`, type: 'button', 'data-fk': `prod-place-${pid}`, 'aria-pressed': on ? 'true' : 'false', title: cap }, provName(sim, pid), h('span', { class: 'faint' }, ` ${cap}`));
    b.addEventListener('click', () => {
      d.places = on ? d.places.filter((x) => x !== pid) : d.places.length < PRODUCTION_LIMITS.places ? [...d.places, pid] : d.places;
      app.refresh();
    });
    return b;
  });
  const placesRow = h(
    'div',
    { class: 'field', style: 'margin-top:8px' },
    h('span', { class: 'label' }, `${kind === 'ship' ? 'Ports' : kind === 'wing' ? 'Airfields' : 'Provinces'} (${d.places.length} chosen)`),
    all.length
      ? h(
          'div',
          { class: 'row wrap', style: 'gap:4px' },
          chips,
          button('All', () => {
            d.places = all.slice(0, PRODUCTION_LIMITS.places);
            app.refresh();
          }, { cls: 'small quiet', fk: 'prod-places-all' }),
          button('None', () => {
            d.places = [];
            app.refresh();
          }, { cls: 'small quiet', fk: 'prod-places-none' }),
        )
      : h('p', { class: 'small warn' }, kind === 'ship' ? 'No port of ours can build ships (we need a port we own and hold).' : kind === 'wing' ? 'No airfield of ours: build one in a province first (needs Aviation).' : 'No province of ours can raise troops now.'),
  );
  // where the new units go
  const ops = Object.values(st.operations).filter((o) => o.nation === me && o.status !== 'complete' && !o.parent);
  const rallies: Array<[string, string]> =
    kind === 'wing'
      ? sim.world.provIds.filter((p) => st.provinces[p].owner === me && st.provinces[p].controller === me && st.provinces[p].airfield > 0).map((p) => [`rally:${p}`, `Move to the airfield at ${provName(sim, p)}`])
      : kind === 'ship'
        ? [...new Set([...sim.world.provIds.filter((p) => st.provinces[p].owner === me && st.provinces[p].port > 0).map((p) => portZone(sim, p)), ...Object.values(st.fleets).filter((f) => f.nation === me).map((f) => f.zone)].filter((z): z is string => !!z))]
            .sort()
            .map((z) => [`rally:${z}`, `Sail to ${zoneName(sim, z)} and join up there`])
        : [];
  const deploy = h(
    'select',
    { 'data-fk': 'prod-deploy', 'aria-label': 'When ready' },
    h('option', { value: '' }, kind === 'ship' ? 'Stay off the port (one squadron a port)' : kind === 'wing' ? 'Stay at the airfield where raised' : 'Form an army where raised'),
    ops.map((o) => h('option', { value: `op:${o.id}`, selected: d.deploy === `op:${o.id}` ? true : undefined }, `Join ${o.name}`)),
    rallies.map(([v, l]) => h('option', { value: v, selected: d.deploy === v ? true : undefined }, l)),
  ) as HTMLSelectElement;
  deploy.value = d.deploy;
  deploy.addEventListener('change', () => {
    d.deploy = deploy.value;
    app.refresh();
  });
  // the preview and the confirmation redraw as the count is typed (focus stays in the field)
  const live = h('div');
  const draw = () => setChildren(live, ...preview(app, me, d));
  count.addEventListener('input', () => {
    const v = Math.floor(Number(count.value));
    if (Number.isFinite(v) && v >= 1) d.count = Math.min(PRODUCTION_LIMITS.count, v);
    draw();
  });
  draw();
  return h(
    'div',
    { class: 'group-card', 'data-sk': 'prod-form' },
    h('div', { class: 'gc-head' }, h('b', { class: 'grow' }, `Order ${PRODUCTION_KIND_LABELS[kind].toLowerCase()}`), button('Close', () => ((draft = null), app.refresh()), { cls: 'small quiet', fk: 'prod-close' })),
    h('div', { class: 'field' }, h('span', { class: 'label' }, 'Type'), types),
    h('div', { class: 'row wrap', style: 'gap:10px;margin-top:8px;align-items:flex-end' }, h('div', { class: 'field' }, h('span', { class: 'label' }, 'How many'), count), h('div', { class: 'field' }, h('span', { class: 'label' }, 'Counted'), h('div', { class: 'segmented' }, modeBtn('total', 'In total'), modeBtn('per', 'At each place')))),
    placesRow,
    h('div', { class: 'field', style: 'margin-top:8px' }, h('span', { class: 'label' }, 'When ready'), deploy),
    live,
  );
}

function preview(app: App, me: NationId, d: Draft): Array<Node | null> {
  const sim = app.sim!;
  const a = assignOf(d);
  const pv = previewProduction(sim, me, d.kind, d.unit, d.places, d.count, d.mode, a?.rally ?? null);
  const problem = checkCommand(sim, { type: 'orderProduction', nation: me, kind: d.kind, unit: d.unit, places: d.places, count: d.count, mode: d.mode, assign: a });
  const res = (r: Partial<Record<StrategicResource, number>>) =>
    Object.entries(r)
      .filter(([, v]) => v)
      .map(([k, v]) => `${fmt(v ?? 0)} ${RESOURCE_INFO[k as StrategicResource].label.toLowerCase()}`);
  const shortOf = (need: number, have: number) => (need > have ? 'neg' : '');
  const rows = pv.rows.map((r) =>
    h(
      'tr',
      { class: r.problem ? 'locked' : '' },
      h('td', null, provName(sim, r.pid)),
      h('td', { class: 'r' }, r.problem ? '—' : String(r.room)),
      h('td', { class: 'r' }, String(r.inQueue)),
      h('td', { class: 'r' }, String(r.target)),
      h('td', { class: 'r' }, h('b', null, String(r.startNow))),
      h('td', { class: 'small muted' }, r.problem ?? ''),
    ),
  );
  const n = pv.count;
  const resNeed = res(pv.total.resources);
  return [
    pv.rows.length
      ? h(
          'div',
          { class: 'table-scroll', style: 'margin-top:8px' },
          h(
            'table',
            { class: 'register', 'data-sk': 'prod-preview' },
            h('thead', null, h('tr', null, h('th', null, 'Where'), h('th', { class: 'r', title: d.kind === 'ship' ? 'free slipways' : d.kind === 'wing' ? 'room for more wings (based wings count)' : 'regiments that may start this week' }, 'Room'), h('th', { class: 'r', title: 'ours there now: on the slipways or in training' }, 'Busy'), h('th', { class: 'r' }, 'Gets'), h('th', { class: 'r' }, 'Starts now'), h('th', null, ''))),
            h('tbody', null, rows),
          ),
        )
      : null,
    h(
      'div',
      { class: 'kv-list small', style: 'margin-top:6px' },
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Each'), h('span', { class: 'v' }, `${pv.price.crowns} cr · ${pv.price.materiel} materiel${pv.price.men ? ` · ${men(pv.price.men)} men` : ''}${res(pv.price.resources).length ? ` · ${res(pv.price.resources).join(', ')}` : ''} · ${pv.price.weeks} weeks`)),
      h(
        'div',
        { class: 'kv' },
        h('span', { class: 'k' }, `All ${n}`),
        h(
          'span',
          { class: 'v' },
          h('span', { class: shortOf(pv.total.crowns, pv.have.crowns) }, `${fmt(pv.total.crowns)} cr`),
          ` (have ${fmt(pv.have.crowns)}) · `,
          h('span', { class: shortOf(pv.total.materiel, pv.have.materiel) }, `${fmt(pv.total.materiel)} materiel`),
          ` (have ${fmt(pv.have.materiel)})`,
          pv.total.men ? h('span', { class: shortOf(pv.total.men, pv.have.men) }, ` · ${men(pv.total.men)} men (pool ${men(pv.have.men)})`) : null,
          resNeed.length ? ` · ${resNeed.join(', ')}` : null,
        ),
      ),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Paid'), h('span', { class: 'v' }, 'as each one starts, nothing in advance; what cannot be paid yet waits and starts by itself')),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Starts now'), h('span', { class: 'v' }, h('b', null, `${pv.startNow} of ${n}`), pv.limit && pv.startNow < n ? ` — then waits: ${pv.limit}` : '')),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'In service'), h('span', { class: 'v' }, `+${fmt(pv.upkeep, 1)} cr a month${pv.fuel && pv.fuel.amount ? `, ${fmt(pv.fuel.amount, 1)} ${pv.fuel.kind} a week at sea or flying` : ''}`)),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'All ready in'), h('span', { class: 'v' }, pv.weeks === null ? 'not all can be based there' : `about ${pv.weeks} weeks (capacity alone; money can slow it)`)),
    ),
    pv.capacity ? h('div', { class: 'callout warn', style: 'margin-top:6px' }, icon('alert'), h('span', null, `${pv.capacity}.`)) : null,
    h(
      'div',
      { class: 'row', style: 'gap:6px;margin-top:8px' },
      button(problem ? 'Cannot order' : `Order ${n} ${unitLabel(d.kind, d.unit, n).toLowerCase()}`, () => confirm(app, d), { cls: 'small primary', icon: 'check', fk: 'prod-confirm', disabled: problem }),
      problem ? h('span', { class: 'small neg' }, problem) : null,
    ),
  ];
}

function confirm(app: App, d: Draft): void {
  const r = app.do({ type: 'orderProduction', kind: d.kind, unit: d.unit, places: d.places, count: d.count, mode: d.mode, assign: assignOf(d) });
  if (r.ok) draft = null;
  app.refresh();
}

function orderCard(app: App, me: NationId, o: ProductionOrder): HTMLElement {
  const sim = app.sim!;
  const t = orderTotals(o);
  const op = o.assign.op ? sim.state.operations[o.assign.op] : null;
  const where = o.places.length <= 3 ? o.places.map((p) => provName(sim, p)).join(', ') : `${o.places.length} places`;
  const dest = op ? `joining ${op.name}` : o.assign.rally ? (o.kind === 'ship' ? `then to ${zoneName(sim, o.assign.rally)}` : `then to ${provName(sim, o.assign.rally)}`) : '';
  const state = o.paused ? ['warn', 'Paused'] : o.blocked && !t.left ? ['good', 'Finishing'] : o.blocked ? ['warn', 'Waiting'] : t.left ? ['good', 'Under way'] : enRoute(sim, o) ? ['brass', 'Joining up'] : ['good', 'Finishing'];
  return h(
    'div',
    { class: 'group-card', 'data-sk': `prod-order-${o.id}` },
    h(
      'div',
      { class: 'gc-head' },
      h('b', { class: 'grow' }, `${t.total} ${unitLabel(o.kind, o.unit, t.total).toLowerCase()}`, h('span', { class: 'small muted' }, ` · ${where}${dest ? ` · ${dest}` : ''}`)),
      h('span', { class: `tag ${state[0]}` }, state[1]),
      t.left
        ? o.paused
          ? button('Resume', () => app.do({ type: 'productionState', order: o.id, state: 'active' }), { cls: 'small', fk: `prod-resume-${o.id}` })
          : button('Pause', () => app.do({ type: 'productionState', order: o.id, state: 'paused' }), { cls: 'small quiet', fk: `prod-pause-${o.id}` })
        : null,
      t.left ? button('Cancel', () => app.do({ type: 'productionState', order: o.id, state: 'cancel' }), { cls: 'small quiet', fk: `prod-cancel-${o.id}`, title: 'Stops what has not started (nothing was paid for it); what is on the slipways or in training continues' }) : null,
    ),
    bar(o.done, Math.max(1, t.total), 'good', `${o.done} of ${t.total} ready`),
    h('div', { class: 'small muted' }, productionSummary(sim, me, o)),
  );
}

/** For the province card: the ordinary one-at-a-time action stays; this offers the order form for several. */
export function orderHereButton(app: App, kind: Kind, pid: ProvinceId): HTMLElement {
  return button(`Order several ${PRODUCTION_KIND_LABELS[kind].toLowerCase()}…`, () => openProduction(app, kind, [pid]), { cls: 'small quiet', fk: `prod-here-${kind}` });
}

