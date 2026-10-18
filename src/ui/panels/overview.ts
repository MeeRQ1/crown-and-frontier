// The armed forces at a glance (format 9), at the top of the Military ledger: land,
// navy and air in the same status categories, each count selecting those forces (so
// the selection card's group orders apply), and one list of what needs attention —
// supply, stalled marches, depleted armies, damaged fleets, grounded wings, missing
// fuel or shells, production orders waiting and operations that need a decision —
// each with the force to select and the order that answers it. Counts come from the
// same state as the map and the rosters (every force of ours, whatever the map shows).

import { wingStatus } from '../../sim/air';
import { C } from '../../sim/config';
import { isShort } from '../../sim/economy';
import { maxMorale } from '../../sim/military';
import { orderStatus } from '../../sim/readiness';
import { orderTotals, unitLabel } from '../../sim/production';
import { armiesOf, menOf, provName } from '../../sim/state';
import { armySupplyInfo } from '../../sim/supply';
import type { AirWing, Army, Fleet } from '../../sim/types';
import type { App } from '../app';
import { button, h } from '../dom';
import { icon, type IconName } from '../icons';
import { section } from './common';

type Status = 'ready' | 'active' | 'fighting' | 'op' | 'recovering';
const STATUS_LABELS: Record<Status, string> = { ready: 'Ready', active: 'Moving or on a task', fighting: 'Fighting', op: 'In operations', recovering: 'Recovering' };
const STATUS_HELP: Record<Status, string> = {
  ready: 'Under your direct command, standing still with no standing order',
  active: 'Marching, sailing, on a standing order or flying a mission',
  fighting: 'In battle (armies) or under fire this week',
  op: 'Members of an operation or Auto-conquer (taken under your command again by any order you give)',
  recovering: 'Retreating, low morale or strength, under repair, or resting to recover readiness',
};

function armyState(app: App, a: Army): Status {
  const sim = app.sim!;
  if (a.battle) return 'fighting';
  if (a.op && !a.opHold) return 'op';
  if (a.retreating || a.morale < maxMorale(sim, a.nation) * 0.5) return 'recovering';
  const s = orderStatus(sim, a).state;
  return s === 'holding' ? 'ready' : 'active';
}

const hull = (f: Fleet) => (f.ships.length ? f.ships.reduce((s, x) => s + x.hp, 0) / f.ships.length : 100);

function fleetState(f: Fleet): Status {
  if (f.op && !f.opHold) return 'op';
  if (hull(f) < 70) return 'recovering';
  return f.path.length || f.duty ? 'active' : 'ready';
}

function wingState(w: AirWing): Status {
  if (w.op && !w.opHold) return 'op';
  if (w.strength < 60 || w.readiness < 50) return 'recovering';
  return w.mission === 'idle' ? 'ready' : 'active';
}

interface Problem {
  icon: IconName;
  text: string;
  why: string;
  select: () => void;
  fix?: HTMLElement | null;
}

export function forcesOverview(app: App): HTMLElement | null {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player;
  if (!me) return null;
  const armies = armiesOf(sim, me).sort((a, b) => (a.id < b.id ? -1 : 1));
  const fleets = Object.values(st.fleets).filter((f) => f.nation === me).sort((a, b) => (a.id < b.id ? -1 : 1));
  const wings = Object.values(st.wings).filter((w) => w.nation === me).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!armies.length && !fleets.length && !wings.length) return null;
  const by = <T extends { id: string }>(list: T[], f: (x: T) => Status) => {
    const out: Record<Status, string[]> = { ready: [], active: [], fighting: [], op: [], recovering: [] };
    for (const x of list) out[f(x)].push(x.id);
    return out;
  };
  const rows: Array<[string, IconName, string[], Record<Status, string[]>]> = [
    ['Land', 'army', armies.map((a) => a.id), by(armies, (a) => armyState(app, a))],
    ['Navy', 'anchor', fleets.map((f) => f.id), by(fleets, fleetState)],
    ['Air', 'plane', wings.map((w) => w.id), by(wings, wingState)],
  ];
  const cell = (ids: string[], label: string) =>
    ids.length
      ? h('td', { class: 'r' }, h('button', { class: 'linkish', type: 'button', title: `Select these ${ids.length}: the selection card gives them one order`, 'data-fk': `ov-${label}` }, String(ids.length)))
      : h('td', { class: 'r faint' }, '0');
  const table = h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 'register compact', 'data-sk': 'forces-overview' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'r' }, 'All'), ...(Object.keys(STATUS_LABELS) as Status[]).map((s) => h('th', { class: 'r', title: STATUS_HELP[s] }, STATUS_LABELS[s])))),
      h(
        'tbody',
        null,
        rows.map(([label, ic, all, st2]) => {
          const tr = h('tr', null, h('td', null, icon(ic), ` ${label}`), cell(all, `${label}-all`), ...(Object.keys(STATUS_LABELS) as Status[]).map((s) => cell(st2[s], `${label}-${s}`)));
          // the counts select their forces
          tr.querySelectorAll('button[data-fk]').forEach((b) => {
            const key = (b as HTMLElement).dataset.fk!.split('-').at(-1) as Status | 'all';
            b.addEventListener('click', () => app.setForceSel(key === 'all' ? all : st2[key]));
          });
          return tr;
        }),
      ),
    ),
  );
  const problems = attention(app, armies, fleets, wings);
  const shown = problems.slice(0, 12);
  return section(
    'Armed forces at a glance',
    table,
    h('div', { class: 'eyebrow', style: 'margin-top:8px' }, problems.length ? `Needs attention (${problems.length})` : 'Needs attention'),
    problems.length
      ? h(
          'div',
          { 'data-sk': 'attention' },
          shown.map((p) =>
            h(
              'div',
              { class: 'attn-row' },
              icon(p.icon),
              h('div', { class: 'grow' }, h('b', null, p.text), h('div', { class: 'small muted' }, p.why)),
              button('Show', p.select, { cls: 'small quiet', icon: 'target' }),
              p.fix ?? null,
            ),
          ),
          problems.length > shown.length ? h('p', { class: 'small faint' }, `${problems.length - shown.length} more of the same kinds: select them from the counts above.`) : null,
        )
      : h('p', { class: 'small muted' }, 'Nothing: every force is supplied, able to move and fit to fight, and no order or operation is waiting on you.'),
  );
}

function attention(app: App, armies: Army[], fleets: Fleet[], wings: AirWing[]): Problem[] {
  const sim = app.sim!;
  const st = sim.state;
  const me = app.player!;
  const out: Problem[] = [];
  // operations that need a decision (the most urgent)
  for (const op of Object.values(st.operations)) {
    if (op.nation !== me || !op.issue || op.status === 'complete') continue;
    out.push({ icon: 'target', text: `${op.name}: needs a decision`, why: op.issue.text, select: () => app.selectOp(op.id) });
  }
  // missing fuel and shells: what the shortage does in battle
  const regs = armies.flatMap((a) => a.regiments);
  const armour = regs.filter((r) => r.type === 'armour').length;
  const guns = regs.filter((r) => r.type === 'artillery').length;
  if (armour && isShort(sim, me, 'oil')) out.push({ icon: 'alert', text: `Armour short of oil (${armour} regiments)`, why: `They fight at ${Math.round(C.combat.unfuelled * 100)}% until the oil stockpile is replenished (Industry: trade, production).`, select: () => app.openLedger('industry') });
  if (guns && isShort(sim, me, 'nitrates')) out.push({ icon: 'alert', text: `Artillery short of shells (${guns} regiments)`, why: `They fire at ${Math.round(C.combat.noShells * 100)}% until nitrates are replenished (Industry: trade, production).`, select: () => app.openLedger('industry') });
  for (const a of armies) {
    const sel = () => app.selectArmy(a.id, true);
    const os = orderStatus(sim, a);
    if (os.state === 'pinned' || os.state === 'blocked') {
      out.push({ icon: 'move', text: `${a.name}: ${os.text}`, why: os.reasons[0] ?? '', select: sel, fix: button('Stop', () => app.do({ type: 'stop', army: a.id }), { cls: 'small quiet' }) });
      continue;
    }
    if (a.battle || a.embarked) continue;
    const sup = armySupplyInfo(sim, a, true);
    if (sup.status !== 'supplied') {
      out.push({ icon: 'supply', text: `${a.name}: ${sup.status} at ${provName(sim, a.location)}`, why: `${a.regiments.length} regiments where the land feeds fewer: they lose men and fight at ${sup.status === 'strained' ? '90' : '75'}%. Spread them out, or bring them back into our supplied land.`, select: sel });
      continue;
    }
    const full = a.regiments.length * C.regimentSize;
    if (full && menOf(a) < full * 0.6) {
      const home = st.provinces[a.location].owner === me;
      out.push({ icon: 'manpower', text: `${a.name}: at ${Math.round((menOf(a) / full) * 100)}% strength`, why: home ? 'Refilling from the reserve while it stands in our supplied land.' : 'Replacements reach it only in our own supplied land: bring it home to refill.', select: sel });
    }
  }
  for (const f of fleets) {
    const hp = hull(f);
    if (hp >= 70) continue;
    const sel = () => app.selectFleet(f.id, true);
    const atHome = f.duty?.kind === 'port';
    out.push({
      icon: 'anchor',
      text: `${f.name}: hulls at ${Math.round(hp)}%`,
      why: atHome ? 'In harbour, repairing.' : 'Damaged ships fight weaker; they repair off a friendly port, faster in harbour.',
      select: sel,
      fix: !atHome && f.home ? button('To port for repair', () => app.do({ type: 'fleetDuty', fleet: f.id, duty: { kind: 'port', province: f.home! } }), { cls: 'small', title: `Sails to ${provName(sim, f.home)} and lies in harbour` }) : null,
    });
  }
  for (const w of wings) {
    const s = wingStatus(sim, w);
    if (s.state !== 'grounded') continue;
    out.push({
      icon: 'plane',
      text: `${w.name}: grounded`,
      why: s.reason,
      select: () => app.selectWing(w.id),
      fix: button('Stand down', () => app.do({ type: 'airMission', wing: w.id, mission: 'idle', target: null }), { cls: 'small quiet', title: 'Rests at its base: readiness and strength recover' }),
    });
  }
  // production orders waiting for something other than their turn
  for (const o of st.nations[me].production ?? []) {
    if (!o.blocked || o.paused || /slipway is in use|airfields are full|ten regiments a province/.test(o.blocked.why)) continue;
    const t = orderTotals(o);
    out.push({ icon: 'factory', text: `${t.total} ${unitLabel(o.kind, o.unit, t.total).toLowerCase()}: order waiting`, why: o.blocked.why, select: () => app.openLedger('military') });
  }
  return out;
}
