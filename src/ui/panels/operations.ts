// Operations in the interface (format 8): the forces selected together, the
// operation being prepared (objective, forces, posture, limits and permissions,
// with a preview of the first orders and the risks), an operation's card for
// monitoring and control, and the line each member's own card shows.
//
// The workflow: select forces (Shift+click or drag a box with Shift on the map,
// the Select tool on touch, or the Military ledger) → New operation → choose
// the area on the map → read the preview → choose the posture → Activate →
// watch, change, pause, take over or cancel at any time.

import { inRangeOf, wingRange } from '../../sim/air';
import { forecastBattle } from '../../sim/combat';
import { SHIPS } from '../../sim/config';
import { fleetCapacity } from '../../sim/naval';
import { findPath } from '../../sim/movement';
import {
  COMPLETION_LABELS,
  DEFAULT_OP_SETTINGS,
  describeArea,
  OP_HELP,
  OP_LABELS,
  opForces,
  planOpGround,
  POSTURE_HELP,
  STRATEGY_HELP,
  STRATEGY_LABELS,
  unitRef,
} from '../../sim/ops/operations';
import { hostileArmiesAt } from '../../sim/ai/common';
import { atWar, enemiesOf, isFriendly, menOf, nationName, provName } from '../../sim/state';
import { supplyDistances, supplyRange } from '../../sim/supply';
import type { Army, NationId, Operation, OperationKind, OperationSettings, OpPosture, OpStrategy, OpTask, ProvinceId, ZoneId } from '../../sim/types';
import type { App } from '../app';
import { action, bar, button, h, row } from '../dom';
import { men, plural } from '../format';
import { icon } from '../icons';
import { section } from './common';
import { head } from './inspector';
import { reserveToggle, warStatus } from './autoconquer';

/** An operation being prepared (or an existing one being changed). */
export interface OpDraft {
  /** the operation being changed (null: a new one) */
  editing: string | null;
  kind: OperationKind;
  area: ProvinceId[];
  zones: ZoneId[];
  units: string[];
  settings: OperationSettings;
  name: string;
  /** Auto-conquer: the enemies chosen */
  enemies: NationId[];
}

export interface OpPreview {
  tasks: Record<string, OpTask>;
  routes: Array<{ army: string; path: ProvinceId[] }>;
  risks: string[];
  notes: string[];
}

const TASK_LABEL: Record<OpTask['kind'], string> = {
  attack: 'Attacking',
  stage: 'Gathering',
  occupy: 'Occupying',
  defend: 'Defending',
  hold: 'Holding',
  reserve: 'Reserve',
  recover: 'Resting',
  regroup: 'Regrouping',
  return: 'Returning',
  wait: 'Waiting',
  patrol: 'Patrolling',
  escort: 'Escorting',
  blockade: 'Blockading',
  bombard: 'Shelling',
  repair: 'Repairing',
  transport: 'Transport',
  strike: 'Striking',
  cover: 'Air cover',
  support: 'Ground support',
  interdict: 'Interdiction',
  rest: 'Resting',
  rebase: 'Rebasing',
  drop: 'Airborne',
  embark: 'Embarking',
  manual: 'Your command',
};

export function newDraft(app: App, units: string[], kind?: OperationKind): OpDraft {
  const sim = app.sim!;
  const forces = units.map((id) => unitRef(sim, id)).filter((r): r is NonNullable<typeof r> => !!r);
  const navalOnly = forces.length > 0 && forces.every((r) => r.kind !== 'army');
  const k: OperationKind = kind ?? (navalOnly && forces.some((r) => r.kind === 'fleet') ? 'sea' : 'conquer');
  return { editing: null, kind: k, area: [], zones: [], units: [...units], settings: { ...DEFAULT_OP_SETTINGS }, name: '', enemies: [] };
}

export function draftFromOp(op: Operation, units: string[]): OpDraft {
  const settings: OperationSettings = {
    posture: op.posture,
    priority: op.priority,
    reserve: op.reserve,
    commitReserve: op.commitReserve,
    minReadiness: op.minReadiness,
    supplyLimit: op.supplyLimit,
    reorganize: op.reorganize,
    rebase: op.rebase,
    airborne: op.airborne,
    airborneRisk: op.airborneRisk,
    resumeAfterOrder: op.resumeAfterOrder,
    onComplete: op.onComplete,
    ...(op.kind === 'war' ? { autoAssign: !!op.autoAssign, strategy: op.strategy ?? 'none', focus: op.focus ?? null } : {}),
  };
  return { editing: op.id, kind: op.kind, area: [...op.area], zones: [...op.zones], units, settings, name: op.name, enemies: [...(op.enemies ?? [])] };
}

/** A stand-in operation for the preview (never in the state). */
function tempOp(app: App, d: OpDraft): Operation {
  const sim = app.sim!;
  const real = d.editing ? sim.state.operations[d.editing] : undefined;
  return {
    ...d.settings,
    id: real?.id ?? '__draft',
    nation: app.player!,
    name: d.name || 'New operation',
    kind: d.kind,
    status: 'active',
    area: d.area,
    zones: d.zones,
    created: sim.state.tick,
    since: sim.state.tick,
    tasks: real ? { ...real.tasks } : {},
    assigned: real ? { ...real.assigned } : {},
    held: [],
    failures: real ? { ...real.failures } : {},
    detached: real ? [...real.detached] : [],
    reorganized: real ? { ...real.reorganized } : {},
    log: [],
    issue: null,
    stats: { taken: 0, lost: 0, menLost: 0, shipsLost: 0, wingStrengthLost: 0, drops: 0, landings: 0 },
    landing: d.kind === 'landing' ? (real?.landing ?? { stage: 'gather', port: null }) : null,
    ...(d.kind === 'war' ? { enemies: [...d.enemies] } : {}),
  };
}

let previewMemo: { key: string; value: OpPreview } | null = null;

/** The first orders the planner would give, and what stands in the way (a forecast, not a promise). */
export function opPreview(app: App, d: OpDraft): OpPreview {
  const sim = app.sim!;
  const me = app.player!;
  const key = JSON.stringify([d.kind, d.area, d.zones, d.units, d.settings, sim.state.tick, sim.state.rev]);
  if (previewMemo?.key === key) return previewMemo.value;
  const st = sim.state;
  const op = tempOp(app, d);
  const armies = d.units.map((id) => st.armies[id]).filter((a): a is Army => !!a && !a.opHold);
  const fleets = d.units.map((id) => st.fleets[id]).filter((f) => !!f);
  const wings = d.units.map((id) => st.wings[id]).filter((w) => !!w);
  const out: OpPreview = { tasks: {}, routes: [], risks: [], notes: [] };
  const ground = d.kind !== 'sea' && !(d.kind === 'landing');
  if (ground && armies.length && d.area.length) {
    const g = planOpGround(sim, op, armies, true);
    out.tasks = g.tasks;
    for (const [id, t] of Object.entries(g.tasks)) {
      const a = st.armies[id];
      if (!a || !t.target || t.target === a.location) continue;
      const p = findPath(sim, me, a.location, t.target);
      if (p) out.routes.push({ army: id, path: p.path });
    }
    for (const b of g.blocked.slice(0, 5)) out.risks.push(`${provName(sim, b.pid)}: ${b.why}.`);
    // the defended targets: what the forecast says of the first strike
    const groups = new Map<ProvinceId, Army[]>();
    for (const [id, t] of Object.entries(g.tasks)) if (t.kind === 'attack' && t.target) (groups.get(t.target) ?? groups.set(t.target, []).get(t.target)!).push(st.armies[id]);
    for (const [pid, list] of [...groups].slice(0, 3)) {
      const foes = hostileArmiesAt(sim, me, pid);
      if (!foes.length) continue;
      const f = forecastBattle(sim, pid, list, foes);
      out.notes.push(`${provName(sim, pid)}: forecast ${f.verdict.toLowerCase()}, ${f.attMen.toLocaleString()} of our men against ${f.defMen.toLocaleString()} (about ${f.attLoss.toLocaleString()} lost). A forecast, not a promise.`);
    }
  }
  if (ground && !armies.length) out.risks.push('No armies: nothing will march. Add armies to the selection.');
  if (d.area.length && d.kind !== 'sea') {
    const peace = d.area.filter((p) => {
      const c = st.provinces[p].controller;
      return c && !isFriendly(sim, me, c) && !atWar(sim, me, c);
    });
    if (peace.length) out.notes.push(`${plural(peace.length, 'province')} of the area belong${peace.length === 1 ? 's' : ''} to realms we are not at war with: they are left alone.`);
    if (d.settings.supplyLimit && d.kind !== 'hold') {
      const dist = supplyDistances(sim, me);
      const far = d.area.filter((p) => !(dist[p] <= supplyRange(sim, me) + 1) && st.provinces[p].controller && atWar(sim, me, st.provinces[p].controller!));
      if (far.length) out.risks.push(`${plural(far.length, 'province')} lie beyond our supply lines: with "Stay in supply" on, they wait until the front comes nearer.`);
    }
  }
  // aircraft: can they reach the area at all
  const places = d.kind === 'sea' ? d.zones.map((z) => ({ zone: z })) : d.area.map((p) => ({ prov: p }));
  for (const w of wings) {
    if (w.type === 'transport') {
      if (d.settings.airborne === 'off') out.notes.push(`${w.name}: no airborne mandate, it stands by.`);
      continue;
    }
    const reach = places.some((pl) => inRangeOf(sim, w, pl));
    if (!reach) out.risks.push(`${w.name} cannot reach the area from ${w.carrier ? 'its carrier' : provName(sim, w.base)} (range ${wingRange(sim, w)})${d.settings.rebase ? ': it will move to an airfield in range if one has room' : ': allow rebasing, or move it'}.`);
  }
  // the navy: what each fleet would do
  for (const f of fleets) {
    const hull = f.ships.reduce((s, x) => s + x.hp, 0) / Math.max(1, f.ships.length);
    if (hull < 50) out.notes.push(`${f.name} goes to port to repair first (hull ${Math.round(hull)}%).`);
  }
  if (d.kind === 'landing') {
    const regs = armies.reduce((n, a) => n + a.regiments.length, 0);
    const lift = Math.max(0, ...fleets.map((f) => fleetCapacity(f)));
    if (!fleets.some((f) => fleetCapacity(f) > 0)) out.risks.push('No transports: the landing cannot sail. Add a fleet with transports (2 regiments each).');
    else if (lift < regs) out.risks.push(`The landing force is ${regs} regiments but the largest transport fleet carries ${lift}.`);
    if (!fleets.some((f) => f.ships.some((s) => SHIPS[s.type].gun > 0))) out.notes.push('No warships: the transports sail without escort (they wait if enemy ships lie on the route).');
    if (!armies.length) out.risks.push('No armies to land.');
  }
  const paras = armies.filter((a) => a.regiments.every((r) => r.type === 'airborne'));
  if (d.settings.airborne !== 'off') {
    if (!paras.length) out.risks.push('Airborne drops are allowed, but no airborne army is assigned.');
    if (!wings.some((w) => w.type === 'transport')) out.risks.push('Airborne drops are allowed, but no transport wing is assigned: the operation flies only its own.');
  } else if (paras.length) out.notes.push(`${plural(paras.length, 'airborne army', 'airborne armies')} will fight on foot: allow drops to use ${paras.length === 1 ? 'it' : 'them'} from the air.`);
  previewMemo = { key, value: out };
  return out;
}

// ───────────────────────────── The selection ────────────────────────────────

export function selectionCard(app: App): HTMLElement[] {
  const sim = app.sim!;
  const refs = app.forceSel.map((id) => unitRef(sim, id)).filter((r): r is NonNullable<typeof r> => !!r);
  const armies = refs.filter((r) => r.kind === 'army').map((r) => r.unit as Army);
  const fleets = refs.filter((r) => r.kind === 'fleet');
  const wings = refs.filter((r) => r.kind === 'wing');
  const regs = armies.reduce((n, a) => n + a.regiments.length, 0);
  const out: HTMLElement[] = [];
  const close = h('button', { class: 'btn quiet small icon close', type: 'button', 'aria-label': 'Clear the selection (Esc)', 'data-fk': 'ins-close' }, icon('close'));
  close.addEventListener('click', () => app.clearForceSel());
  out.push(
    h('div', { class: 'ins-head' }, h('div', { class: 'grow' }, h('h2', null, `${plural(refs.length, 'force')} selected`), h('div', { class: 'sub' }, [`${plural(armies.length, 'army', 'armies')} (${regs} regiments, ${men(armies.reduce((s, a) => s + menOf(a), 0))})`, fleets.length ? plural(fleets.length, 'fleet') : '', wings.length ? plural(wings.length, 'air wing') : ''].filter(Boolean).join(' · '))), close),
  );
  const prim: HTMLElement[] = [
    button('New operation…', () => app.startOpDraft(), { cls: 'small primary', icon: 'target', fk: 'op-new' }),
  ];
  const ops = Object.values(sim.state.operations).filter((o) => o.nation === app.player);
  if (armies.length > 1) prim.push(button('March all to…', () => app.startGroupMove(), { cls: 'small', icon: 'move', fk: 'sel-march' }));
  const sameProv = armies.length > 1 && armies.every((a) => a.location === armies[0].location);
  if (sameProv) prim.push(button('Merge', () => app.do({ type: 'merge', armies: armies.map((a) => a.id) }), { cls: 'small', icon: 'merge', fk: 'sel-merge' }));
  out.push(h('div', { class: 'ins-primary' }, prim));
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins' });
  if (ops.length) {
    body.appendChild(
      section(
        'Add to an operation',
        ...ops.map((o) => action(o.name, `${OP_LABELS[o.kind]} · ${describeArea(sim, o)}`, () => app.do({ type: 'assignOp', op: o.id, units: refs.map((r) => r.unit.id) }), null)),
      ),
    );
  }
  const members = refs.filter((r) => r.unit.op);
  if (members.length) body.appendChild(h('div', { class: 'row', style: 'margin-top:8px' }, button(`Detach ${plural(members.length, 'member')} from operations`, () => app.do({ type: 'releaseOp', units: members.map((r) => r.unit.id) }), { cls: 'small quiet', fk: 'sel-release' })));
  body.appendChild(
    section(
      'Selected',
      ...refs.map((r) => {
        const u = r.unit;
        const what = r.kind === 'army' ? `${(u as Army).regiments.length} regiments at ${provName(sim, (u as Army).location)}` : r.kind === 'fleet' ? `${(u as { ships: unknown[] }).ships.length} ships` : 'air wing';
        const op = u.op ? sim.state.operations[u.op] : undefined;
        const rm = button('Remove', () => app.toggleForce(u.id), { cls: 'small quiet', fk: `sel-rm-${u.id}` });
        const go = h('button', { class: 'linklike', type: 'button', 'data-fk': `sel-go-${u.id}` }, u.name);
        go.addEventListener('click', () => (r.kind === 'army' ? app.selectArmy(u.id, true) : r.kind === 'fleet' ? app.selectFleet(u.id, true) : app.selectWing(u.id)));
        return h('div', { class: 'kv' }, h('span', { class: 'k' }, go), h('span', { class: 'v small' }, `${what}${op ? ` · ${op.name}${u.opHold ? ' (your command)' : ''}` : ''}`, rm));
      }),
    ),
  );
  body.appendChild(h('p', { class: 'small faint' }, 'Shift+click a force on the map to add or remove it; Shift+drag draws a box. On touch, use the Select tool. Esc clears the selection.'));
  out.push(body);
  return out;
}

// ───────────────────────────── The editor ───────────────────────────────────

function seg<T extends string | number>(label: string, value: T, options: Array<[T, string]>, set: (v: T) => void, help?: string): HTMLElement {
  return h(
    'div',
    { class: 'field', style: 'margin-top:8px' },
    h('span', { class: 'label' }, label),
    h(
      'div',
      { class: 'segmented' },
      options.map(([v, l]) => {
        const b = h('button', { class: v === value ? 'active' : '', type: 'button', 'data-fk': `op-${label}-${v}`, 'aria-pressed': v === value ? 'true' : 'false' }, l);
        b.addEventListener('click', () => set(v));
        return b;
      }),
    ),
    help ? h('div', { class: 'small muted', style: 'margin-top:3px' }, help) : null,
  );
}

function check(label: string, value: boolean, set: (v: boolean) => void, help: string): HTMLElement {
  const box = h('input', { type: 'checkbox', 'data-fk': `op-${label}` }) as HTMLInputElement;
  box.checked = value;
  box.addEventListener('change', () => set(box.checked));
  return h('label', { class: 'check', style: 'margin-top:8px;display:flex;gap:8px;align-items:flex-start' }, box, h('span', null, h('b', null, label), h('div', { class: 'small muted' }, help)));
}

export function opEditor(app: App): HTMLElement[] {
  const sim = app.sim!;
  const d = app.opDraft!;
  const st = sim.state;
  const set = (patch: Partial<OperationSettings>) => {
    d.settings = { ...d.settings, ...patch };
    app.refresh();
  };
  const out: HTMLElement[] = [];
  const close = h('button', { class: 'btn quiet small icon close', type: 'button', 'aria-label': 'Close without saving (Esc)', 'data-fk': 'ins-close' }, icon('close'));
  close.addEventListener('click', () => app.cancelOpDraft());
  out.push(h('div', { class: 'ins-head' }, h('div', { class: 'grow' }, h('h2', null, d.editing ? `Change ${st.operations[d.editing]?.name ?? 'operation'}` : 'New operation'), h('div', { class: 'sub' }, `${plural(d.units.length, 'force')} assigned`)), close));
  const body = h('div', { class: 'ins-body scroll', 'data-sk': 'ins-op' });
  // 1. the objective
  if (!d.editing) {
    body.appendChild(
      seg('Objective', d.kind, (Object.keys(OP_LABELS) as OperationKind[]).filter((k) => k !== 'war').map((k) => [k, OP_LABELS[k].replace(/ (an area|to a province|the seas)$/, '')]), (k) => {
        d.kind = k;
        if (k === 'advance' || k === 'landing') d.area = d.area.slice(0, 1);
        app.refresh();
      }, OP_HELP[d.kind]),
    );
  } else body.appendChild(h('p', { class: 'small muted' }, OP_HELP[d.kind]));
  // 2. the area (Auto-conquer: the enemies, its priority and who joins)
  if (d.kind === 'war') body.appendChild(warSettings(app, d));
  const picking = app.targeting?.kind === 'opArea';
  const areaText = d.kind === 'sea' ? (d.zones.length ? describeArea(sim, { kind: 'sea', area: [], zones: d.zones }) : 'no sea zones yet') : d.area.length ? describeArea(sim, { kind: d.kind, area: d.area, zones: [] }) : 'nothing chosen yet';
  const fill = d.kind === 'conquer' ? reachableEnemyLand(app, d) : [];
  if (d.kind !== 'war') body.appendChild(
    section(
      d.kind === 'sea' ? 'Sea zones' : d.kind === 'advance' ? 'Destination' : d.kind === 'landing' ? 'Beach (then the area)' : 'Area',
      h('p', null, areaText),
      h(
        'div',
        { class: 'row wrap', style: 'gap:6px' },
        button(picking ? 'Done choosing' : 'Choose on the map', () => (picking ? app.cancelTargeting() : app.pickOpArea()), { cls: `small ${picking ? 'primary' : ''}`, icon: 'target', fk: 'op-pick' }),
        fill.length ? button(`Enemy land within reach (${fill.length})`, () => {
          d.area = fill;
          app.refresh();
        }, { cls: 'small', fk: 'op-fill', title: 'Every enemy-held province within six marches of the assigned armies' }) : null,
        (d.area.length || d.zones.length) ? button('Clear', () => {
          d.area = [];
          d.zones = [];
          app.refresh();
        }, { cls: 'small quiet', fk: 'op-clear' }) : null,
      ),
      picking ? h('p', { class: 'small' }, d.kind === 'sea' ? 'Click sea zones to add or remove them.' : d.kind === 'advance' ? 'Click the destination.' : d.kind === 'landing' ? 'Click the beach first, then any provinces to take after landing.' : 'Click provinces to add or remove them; Shift+click adds or removes a whole region.') : null,
    ),
  );
  // 3. posture and limits
  body.appendChild(seg('Posture', d.settings.posture, [['cautious', 'Cautious'], ['balanced', 'Balanced'], ['aggressive', 'Aggressive']] as Array<[OpPosture, string]>, (v) => set({ posture: v }), POSTURE_HELP[d.settings.posture]));
  body.appendChild(seg('Priority', d.settings.priority, [[1, 'Low'], [2, 'Normal'], [3, 'High']] as Array<[1 | 2 | 3, string]>, (v) => set({ priority: v }), 'Higher priority plans first where operations share airfields and ports.'));
  if (d.kind !== 'sea') {
    body.appendChild(seg('Reserve', d.settings.reserve, [[0, 'None'], [0.15, '15%'], [0.3, '30%']], (v) => set({ reserve: v }), 'The share of the strength held back at the base.'));
    if (d.settings.reserve > 0) body.appendChild(seg('Reserve goes in', d.settings.commitReserve, [['never', 'Never'], ['battles', 'To win battles'], ['freely', 'Where needed']], (v) => set({ commitReserve: v }), d.settings.commitReserve === 'never' ? 'The reserve only holds the base.' : d.settings.commitReserve === 'battles' ? 'Into a battle our troops are losing, if the forecast with it is acceptable.' : 'Also to targets nothing else covers.'));
    body.appendChild(seg('Rest armies below', d.settings.minReadiness, [[0.3, '30% morale'], [0.45, '45%'], [0.6, '60%']], (v) => set({ minReadiness: v }), 'Tired or depleted armies (or below half their men) fall back to rest instead of attacking.'));
    body.appendChild(check('Stay in supply', d.settings.supplyLimit, (v) => set({ supplyLimit: v }), 'Attack only where our supply reaches; unsupplied armies fall back.'));
    body.appendChild(check('Split and regroup armies', d.settings.reorganize, (v) => set({ reorganize: v }), `Detach task forces (at least 2 regiments, at most ${6} detachments) for undefended targets and the reserve; merge idle armies again. Whole regiments only. Mark an army "Keep together" on its card to protect it.`));
  }
  body.appendChild(check('Move aircraft between airfields', d.settings.rebase, (v) => set({ rebase: v }), 'Wings out of range move to an airfield of ours in range with room and no enemy next to it. Off: the operation tells you instead.'));
  if (d.kind !== 'sea') {
    body.appendChild(seg('Airborne drops', d.settings.airborne, [['off', 'None'], ['once', 'One drop'], ['repeat', 'As forces allow']], (v) => set({ airborne: v }), 'Only inside the area, with the operation’s own transport wings and airborne armies, near enough to our armies to be relieved.'));
    if (d.settings.airborne !== 'off') body.appendChild(seg('Expected losses at most', d.settings.airborneRisk, [[0.1, '10%'], [0.2, '20%'], [0.35, '35%']], (v) => set({ airborneRisk: v }), 'A drop that would cost more of its men on the way in (fighters, anti-aircraft fire) is not made.'));
  }
  body.appendChild(check('Rejoin after my orders', d.settings.resumeAfterOrder, (v) => set({ resumeAfterOrder: v }), 'A member you give a direct order rejoins the operation once that order is carried out. Off: it stays under your command until you resume it.'));
  if (d.kind !== 'sea' && d.kind !== 'hold') body.appendChild(seg('When the objective is reached', d.settings.onComplete, (Object.keys(COMPLETION_LABELS) as Array<keyof typeof COMPLETION_LABELS>).map((k) => [k, COMPLETION_LABELS[k]]), (v) => set({ onComplete: v })));
  // 4. preview
  const pv = opPreview(app, d);
  const counts = new Map<string, number>();
  for (const t of Object.values(pv.tasks)) counts.set(TASK_LABEL[t.kind], (counts.get(TASK_LABEL[t.kind]) ?? 0) + 1);
  body.appendChild(
    section(
      'Preview: the first orders',
      counts.size ? h('p', null, [...counts].map(([k, n]) => `${k}: ${n}`).join(' · ')) : h('p', { class: 'small muted' }, 'Choose forces and an area to see the plan.'),
      ...Object.entries(pv.tasks).slice(0, 8).map(([id, t]) => row(st.armies[id]?.name ?? id, h('span', { class: 'small' }, t.note))),
      ...pv.notes.map((n) => h('p', { class: 'small' }, n)),
      pv.risks.length ? h('div', { class: 'callout warn', style: 'margin-top:6px' }, icon('alert'), h('div', null, ...pv.risks.map((r) => h('div', { class: 'small' }, r)))) : null,
      h('p', { class: 'small faint' }, 'The routes are drawn on the map. Orders follow the ordinary rules each week: this is a forecast, not a promise.'),
    ),
  );
  out.push(body);
  const problem = draftProblem(app, d);
  out.push(
    h(
      'div',
      { class: 'ins-primary', style: 'border-top:1px solid var(--line)' },
      d.editing
        ? button('Save changes', () => app.commitOpDraft(true), { cls: 'small primary', disabled: problem, fk: 'op-save' })
        : button('Activate', () => app.commitOpDraft(true), { cls: 'small primary', disabled: problem, icon: 'play', fk: 'op-activate' }),
      d.editing ? null : button('Save, start later', () => app.commitOpDraft(false), { cls: 'small', disabled: problem, fk: 'op-prepare' }),
      button('Cancel', () => app.cancelOpDraft(), { cls: 'small quiet', fk: 'op-cancel' }),
      problem ? h('div', { class: 'small why', style: 'width:100%' }, problem) : null,
    ),
  );
  return out;
}

/** Auto-conquer in the editor: the enemies (realms at war with us), its priority, and whether new forces join. */
function warSettings(app: App, d: OpDraft): HTMLElement {
  const sim = app.sim!;
  const enemies = enemiesOf(sim, app.player!).sort();
  const boxes = enemies.map((e) => {
    const box = h('input', { type: 'checkbox', 'data-fk': `op-enemy-${e}` }) as HTMLInputElement;
    box.checked = d.enemies.includes(e);
    box.addEventListener('change', () => {
      d.enemies = box.checked ? [...new Set([...d.enemies, e])] : d.enemies.filter((x) => x !== e);
      if (d.settings.focus && !d.enemies.includes(d.settings.focus)) d.settings = { ...d.settings, focus: null };
      app.refresh();
    });
    return h('label', { class: 'switch', style: 'margin-right:10px' }, box, h('span', null, nationName(sim, e)));
  });
  const strat = (d.settings.strategy ?? 'none') as OpStrategy;
  return section(
    'Enemies',
    enemies.length ? h('div', { class: 'row wrap' }, boxes) : h('p', { class: 'small muted' }, 'We are at war with no one: Auto-conquer never starts a war.'),
    seg('Priority', strat, (Object.keys(STRATEGY_LABELS) as OpStrategy[]).map((k) => [k, STRATEGY_LABELS[k]]), (v) => {
      d.settings = { ...d.settings, strategy: v, focus: v === 'focus' ? (d.settings.focus ?? d.enemies[0] ?? null) : null };
      app.refresh();
    }, STRATEGY_HELP[strat]),
    strat === 'focus' && d.enemies.length > 1
      ? seg('Concentrate on', d.settings.focus ?? d.enemies[0], d.enemies.map((e) => [e, nationName(sim, e)]), (v) => {
          d.settings = { ...d.settings, focus: v };
          app.refresh();
        })
      : null,
    check('New forces join', !!d.settings.autoAssign, (v) => {
      d.settings = { ...d.settings, autoAssign: v };
      app.refresh();
    }, 'Armies, fleets and air wings that are in no operation and not kept for your direct command join as they appear (recruits, ships launched, wings raised).'),
  );
}

function draftProblem(app: App, d: OpDraft): string | null {
  if (d.kind === 'war') return d.enemies.length ? null : 'Choose at least one enemy.';
  if (d.kind === 'sea' ? !d.zones.length : !d.area.length) return d.kind === 'sea' ? 'Choose the sea zones on the map.' : 'Choose the area on the map.';
  if (d.kind === 'advance' && d.area.length !== 1) return 'An advance has one destination.';
  if (!d.units.length && !d.editing) return 'Select forces first.';
  void app;
  return null;
}

/** Enemy-held provinces within six marches of the draft's armies (a quick area for a conquest). */
function reachableEnemyLand(app: App, d: OpDraft): ProvinceId[] {
  const sim = app.sim!;
  const me = app.player!;
  const st = sim.state;
  const armies = d.units.map((id) => st.armies[id]).filter((a): a is Army => !!a);
  if (!armies.length) return [];
  const out = new Set<ProvinceId>();
  const ids = sim.world.provIds;
  for (const a of armies) {
    const row = sim.world.hopRow(a.location);
    if (!row) continue;
    for (let i = 0; i < ids.length; i++) {
      if (row[i] > 6) continue;
      const c = st.provinces[ids[i]].controller;
      if (c && atWar(sim, me, c)) out.add(ids[i]);
    }
  }
  return [...out].sort().slice(0, 120);
}

// ───────────────────────────── An operation's card ───────────────────────────

export function opCard(app: App, id: string): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const op = st.operations[id];
  if (!op) return [h('p', null, 'This operation no longer exists.')];
  const f = opForces(sim, op.id);
  const out: HTMLElement[] = [];
  const status = op.status === 'active' ? 'Active' : op.status === 'paused' ? 'Paused' : 'Objective reached';
  out.push(head(app, op.nation, op.name, [`${OP_LABELS[op.kind]} · ${describeArea(sim, op)}`], [h('span', { class: `tag ${op.status === 'active' ? 'good' : op.status === 'paused' ? 'warn' : 'brass'}` }, status), op.issue ? h('span', { class: 'tag bad' }, 'Needs a decision') : h('span', { class: 'tag' }, op.posture)]));
  const prim: HTMLElement[] = [];
  if (op.status !== 'complete') prim.push(op.status === 'active' ? button('Pause', () => app.do({ type: 'opState', op: op.id, state: 'paused' }), { cls: 'small', icon: 'pause', fk: 'op-pause' }) : button('Resume', () => app.do({ type: 'opState', op: op.id, state: 'active' }), { cls: 'small primary', icon: 'play', fk: 'op-resume' }));
  prim.push(button(op.kind === 'war' ? 'Settings…' : 'Change…', () => app.editOp(op.id), { cls: 'small', icon: 'settings', fk: 'op-edit' }));
  if (op.kind === 'war' && op.status !== 'complete') prim.push(button('Take over all', () => app.do({ type: 'releaseOp', units: [...f.armies, ...f.fleets, ...f.wings].map((u) => u.id) }), { cls: 'small quiet', fk: 'ac-takeover', title: 'Every force returns to your direct command (and is kept for it: Auto-conquer will not take it again until you allow it).' }));
  if (app.forceSel.length) prim.push(button(`Add ${plural(app.forceSel.length, 'selected force')}`, () => app.do({ type: 'assignOp', op: op.id, units: [...app.forceSel] }), { cls: 'small', icon: 'plus', fk: 'op-add' }));
  prim.push(button('Select its forces', () => app.setForceSel([...f.armies, ...f.fleets, ...f.wings].map((u) => u.id)), { cls: 'small quiet', fk: 'op-select' }));
  prim.push(button(op.kind === 'war' ? 'Stop' : 'Cancel operation', () => app.cancelOp(op.id), { cls: 'small quiet', icon: 'close', fk: 'op-cancel-op' }));
  out.push(h('div', { class: 'ins-primary' }, prim));
  const body = h('div', { class: 'ins-body scroll', 'data-sk': `ins-op-${op.id}` });
  if (op.issue) {
    body.appendChild(
      h(
        'div',
        { class: 'callout bad', style: 'margin-top:8px' },
        icon('alert'),
        h(
          'div',
          null,
          h('div', null, op.issue.text),
          h(
            'div',
            { class: 'row wrap', style: 'gap:6px;margin-top:6px' },
            button('Change the area or posture', () => app.editOp(op.id), { cls: 'small', fk: 'op-issue-edit' }),
            app.forceSel.length ? button('Add the selected forces', () => app.do({ type: 'assignOp', op: op.id, units: [...app.forceSel] }), { cls: 'small', fk: 'op-issue-add' }) : null,
            button('Take direct command of all', () => app.do({ type: 'releaseOp', units: [...f.armies, ...f.fleets, ...f.wings].map((u) => u.id) }), { cls: 'small quiet', fk: 'op-issue-release' }),
          ),
        ),
      ),
    );
  }
  // progress
  const area = op.area;
  const ours = area.filter((p) => isFriendly(sim, op.nation, st.provinces[p].controller)).length;
  const regs = f.armies.reduce((n, a) => n + a.regiments.length, 0);
  if (op.kind === 'war') for (const el of warStatus(app, op)) body.appendChild(el);
  else if (op.kind !== 'sea') body.appendChild(section('Progress', bar(ours, Math.max(1, area.length), 'good', 'Area held'), row('Area held by our side', `${ours} of ${area.length}`), row('Taken / lost since it began', `${op.stats.taken} / ${op.stats.lost}`), op.kind === 'landing' ? row('Landing', op.landing?.stage === 'ashore' ? 'ashore' : op.landing?.stage === 'sail' ? 'at sea' : `gathering${op.landing?.port ? ` at ${provName(sim, op.landing.port)}` : ''}`) : null));
  if (op.kind !== 'war') body.appendChild(
    section(
      'Forces',
      row('Under its command', `${plural(f.armies.length, 'army', 'armies')} (${regs} regiments, ${men(f.armies.reduce((s, a) => s + menOf(a), 0))}) · ${plural(f.fleets.length, 'fleet')} · ${plural(f.wings.length, 'wing')}`),
      row('Losses', `${men(op.stats.menLost)} men · ${plural(op.stats.shipsLost, 'ship')} · air strength ${Math.round(op.stats.wingStrengthLost)}%${op.stats.drops ? ` · ${plural(op.stats.drops, 'drop')}` : ''}`),
      row('Settings', `${op.posture}, reserve ${Math.round(op.reserve * 100)}%, ${op.reorganize ? 'may split and regroup' : 'keeps formations'}, ${op.rebase ? 'may rebase aircraft' : 'no rebasing'}, airborne ${op.airborne === 'off' ? 'none' : op.airborne === 'once' ? 'one drop' : 'repeated'}`),
    ),
  );
  // tasks, grouped
  const groups = new Map<string, Array<{ id: string; name: string; t: OpTask; held: boolean }>>();
  for (const u of [...f.armies, ...f.fleets, ...f.wings]) {
    const t = op.tasks[u.id] ?? { kind: 'wait', target: null, note: op.status === 'paused' ? 'the operation is paused' : 'no orders yet (next week)', since: st.tick };
    const k = u.opHold ? 'Your command' : TASK_LABEL[t.kind];
    (groups.get(k) ?? groups.set(k, []).get(k)!).push({ id: u.id, name: u.name, t, held: !!u.opHold });
  }
  body.appendChild(
    section(
      'What they are doing',
      ...[...groups].map(([k, list]) =>
        h(
          'div',
          { class: 'op-group' },
          h('div', { class: 'eyebrow' }, `${k} (${list.length})`),
          ...list.map((x) => {
            const go = h('button', { class: 'linklike', type: 'button', 'data-fk': `op-u-${x.id}` }, x.name);
            go.addEventListener('click', () => app.selectUnit(x.id));
            return h('div', { class: 'kv' }, h('span', { class: 'k' }, go), h('span', { class: 'v small' }, x.t.note, x.held ? button('Resume', () => app.do({ type: 'resumeUnits', units: [x.id] }), { cls: 'small quiet', fk: `op-resume-${x.id}` }) : null));
          }),
        ),
      ),
    ),
  );
  body.appendChild(section('Recent', ...op.log.slice(-10).reverse().map((l) => h('div', { class: `small ${l.tone === 'bad' ? 'neg' : l.tone === 'good' ? 'pos' : ''}` }, `Wk ${l.tick - op.created + 1}: ${l.text}`))));
  out.push(body);
  return out;
}

/** The line a member's own card shows: which operation, what it is doing, and how to take over or hand back. */
export function unitOpSection(app: App, id: string): HTMLElement | null {
  const sim = app.sim!;
  const r = unitRef(sim, id);
  if (!r || r.unit.nation !== app.player) return null;
  const u = r.unit;
  if (!u.op) {
    const ops = Object.values(sim.state.operations).filter((o) => o.nation === app.player);
    if (!ops.length && !u.reserved) return null;
    return section(
      'Operation',
      h('p', { class: 'small muted' }, 'Under your direct command.'),
      h('div', { class: 'row wrap', style: 'gap:6px' }, ...ops.slice(0, 4).map((o) => button(`Join ${o.name}`, () => app.do({ type: 'assignOp', op: o.id, units: [u.id] }), { cls: 'small quiet', fk: `join-${o.id}` }))),
      reserveToggle(app, u.id),
    );
  }
  const op = sim.state.operations[u.op];
  if (!op) return null;
  const t = op.tasks[u.id];
  const open = button(op.name, () => app.selectOp(op.id), { cls: 'small', icon: 'target', fk: 'unit-op-open' });
  return section(
    'Operation',
    h('div', { class: 'row' }, open, h('span', { class: `tag ${u.opHold ? 'warn' : 'good'}` }, u.opHold ? 'Your direct command' : op.status === 'paused' ? 'Paused' : 'Delegated')),
    h('p', { class: 'small' }, u.opHold ? `Taken under your command by your order: the operation leaves it alone${op.resumeAfterOrder ? ' until the order is carried out' : ' until you resume it'}.` : t ? `${TASK_LABEL[t.kind]}: ${t.note}.` : 'Orders come with the next week’s planning.'),
    h(
      'div',
      { class: 'row wrap', style: 'gap:6px' },
      u.opHold ? button('Resume under the operation', () => app.do({ type: 'resumeUnits', units: [u.id] }), { cls: 'small primary', fk: 'unit-op-resume' }) : null,
      button('Detach (direct command)', () => app.do({ type: 'releaseOp', units: [u.id] }), { cls: 'small quiet', fk: 'unit-op-release' }),
      r.kind === 'army' ? keepToggle(app, u as Army) : null,
    ),
    h('p', { class: 'small faint' }, 'Any order you give it takes it under your direct command at once.'),
  );
}

function keepToggle(app: App, a: Army): HTMLElement {
  return button(a.keep ? 'Allow splitting' : 'Keep together', () => app.do({ type: 'keepFormation', army: a.id, keep: !a.keep }), { cls: 'small quiet', fk: 'unit-keep', title: a.keep ? 'Operations may split this army and merge it with others again.' : 'Operations will never split this army or merge it into another.' });
}

// ───────────────────────────── The ledger ───────────────────────────────────

export function operationsSection(app: App): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  // Auto-conquer mandates have their own section above
  const ops = Object.values(st.operations).filter((o) => o.nation === app.player && o.kind !== 'war').sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  const kids: Array<Node | null> = [];
  if (!ops.length) kids.push(h('p', { class: 'small muted' }, 'No operations. Select forces (Shift+click or Shift+drag on the map, or the boxes below), then New operation: the planner gives the routine orders while you set the objective and the limits.'));
  for (const op of ops) {
    const f = opForces(sim, op.id);
    const ours = op.area.filter((p) => isFriendly(sim, op.nation, st.provinces[p].controller)).length;
    const open = button('Open', () => app.selectOp(op.id), { cls: 'small', fk: `op-open-${op.id}` });
    kids.push(
      h(
        'div',
        { class: 'group-card' },
        h('div', { class: 'gc-head' }, h('b', { class: 'grow' }, op.name), h('span', { class: `tag ${op.issue ? 'bad' : op.status === 'active' ? 'good' : 'warn'}` }, op.issue ? 'Needs a decision' : op.status === 'active' ? 'Active' : op.status === 'paused' ? 'Paused' : 'Reached'), open),
        h('div', { class: 'small muted' }, `${OP_LABELS[op.kind]} · ${describeArea(sim, op)} · ${plural(f.armies.length, 'army', 'armies')}, ${plural(f.fleets.length, 'fleet')}, ${plural(f.wings.length, 'wing')}${op.kind !== 'sea' ? ` · ${ours}/${op.area.length} held` : ''} · ${men(op.stats.menLost)} lost`),
        op.issue ? h('div', { class: 'small neg' }, op.issue.text) : null,
      ),
    );
  }
  return section('Operations', ...kids);
}

/** The checkbox a roster row carries to add the force to the selection. */
export function selectBox(app: App, id: string): HTMLElement {
  const box = h('input', { type: 'checkbox', 'aria-label': 'Add to the selection', 'data-fk': `pick-${id}` }) as HTMLInputElement;
  box.checked = app.forceSel.includes(id);
  box.addEventListener('click', (e) => e.stopPropagation());
  box.addEventListener('change', () => app.toggleForce(id));
  return box;
}

