// Simple Auto-conquer (format 9): choose realms we are at war with, press one button;
// every free army, fleet and air wing is used with visible defaults. The status card
// shows the opponents, the forces, the progress, the losses and what stands in the
// way, with pause, resume, stop, the opponents, manual takeover and (optional) the
// detailed settings. Forces the player keeps for direct command are never taken.

import { enemiesOf, isFriendly, nationName, provName } from '../../sim/state';
import { opForces, STRATEGY_HELP, STRATEGY_LABELS, unitRef } from '../../sim/ops/operations';
import type { NationId, Operation, OpStrategy } from '../../sim/types';
import type { App } from '../app';
import { bar, button, h, row } from '../dom';
import { men, plural } from '../format';
import { icon } from '../icons';
import { section, shield } from './common';

/** Per-session choices in the Auto-conquer chooser (not part of the game state). */
interface Draft {
  picked: Set<NationId> | null;
  strategy: OpStrategy;
  focus: NationId | null;
}
const draft: Draft = { picked: null, strategy: 'none', focus: null };

/** Our live Auto-conquer mandates. */
export function warOps(app: App): Operation[] {
  const sim = app.sim!;
  return Object.values(sim.state.operations).filter((o) => o.nation === app.player && o.kind === 'war');
}

/** Enemies not yet in a live mandate of ours. */
function freeEnemies(app: App): NationId[] {
  const sim = app.sim!;
  const taken = new Set(warOps(app).filter((o) => o.status !== 'complete').flatMap((o) => o.enemies ?? []));
  return enemiesOf(sim, app.player!).filter((e) => !taken.has(e)).sort();
}

/** Activates a mandate against these enemies with the chooser's priority (defaults otherwise). */
export function startAutoConquer(app: App, enemies: NationId[], strategy: OpStrategy = 'none', focus: NationId | null = null): void {
  const settings = { strategy, focus: strategy === 'focus' ? (focus ?? enemies[0]) : null };
  const r = app.do({ type: 'createOp', kind: 'war', area: [], enemies, settings, activate: true });
  if (r.ok) {
    const id = Object.values(app.sim!.state.operations).filter((o) => o.nation === app.player && o.kind === 'war').map((o) => o.id).sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).at(-1);
    draft.picked = null;
    if (id) app.selectOp(id);
  }
}

/** The Military ledger's Auto-conquer: the chooser when there are enemies to give it, the live mandates' lines. */
export function autoConquerSection(app: App): HTMLElement | null {
  const sim = app.sim!;
  const me = app.player;
  if (!me) return null;
  const live = warOps(app);
  const free = freeEnemies(app);
  if (!free.length && !live.length) return null;
  const kids: Array<Node | null> = [];
  for (const op of live) kids.push(statusLine(app, op));
  if (free.length) {
    if (!draft.picked || [...draft.picked].some((e) => !free.includes(e))) draft.picked = new Set(free);
    const picks = free.map((e) => {
      const box = h('input', { type: 'checkbox', 'data-fk': `ac-enemy-${e}`, 'aria-label': nationName(sim, e) }) as HTMLInputElement;
      box.checked = draft.picked!.has(e);
      box.addEventListener('change', () => {
        if (box.checked) draft.picked!.add(e);
        else draft.picked!.delete(e);
        app.refresh();
      });
      return h('label', { class: 'switch', style: 'margin-right:10px' }, box, shield(app, e), h('span', null, nationName(sim, e)));
    });
    const strat = h('select', { 'data-fk': 'ac-strategy', 'aria-label': 'Priority' }, (Object.keys(STRATEGY_LABELS) as OpStrategy[]).map((s) => h('option', { value: s, selected: draft.strategy === s ? true : undefined }, STRATEGY_LABELS[s]))) as HTMLSelectElement;
    strat.addEventListener('change', () => {
      draft.strategy = strat.value as OpStrategy;
      app.refresh();
    });
    const chosen = free.filter((e) => draft.picked!.has(e));
    const focusSel =
      draft.strategy === 'focus' && chosen.length > 1
        ? (() => {
            const s = h('select', { 'data-fk': 'ac-focus', 'aria-label': 'Concentrate on' }, chosen.map((e) => h('option', { value: e, selected: draft.focus === e ? true : undefined }, nationName(sim, e)))) as HTMLSelectElement;
            s.addEventListener('change', () => (draft.focus = s.value));
            return h('div', { class: 'field', style: 'margin-top:6px' }, h('span', { class: 'label' }, 'Concentrate on'), s);
          })()
        : null;
    const go = button(`Auto-conquer ${chosen.length === 1 ? nationName(sim, chosen[0]) : chosen.length ? `${chosen.length} enemies` : '…'}`, () => startAutoConquer(app, chosen, draft.strategy, draft.focus), {
      cls: 'small primary',
      icon: 'target',
      fk: 'ac-activate',
      disabled: chosen.length ? null : 'Choose at least one enemy.',
    });
    kids.push(
      h(
        'div',
        { class: 'group-card', 'data-sk': 'ac-chooser' },
        h('div', { class: 'gc-head' }, h('b', { class: 'grow' }, live.length ? 'Auto-conquer more enemies' : 'Auto-conquer'), go),
        h('div', { class: 'row wrap', style: 'margin:4px 0' }, picks),
        h('div', { class: 'field', style: 'margin-top:4px' }, h('span', { class: 'label' }, 'Priority (optional)'), strat, h('div', { class: 'small muted' }, STRATEGY_HELP[draft.strategy])),
        focusSel,
        h(
          'p',
          { class: 'small muted', style: 'margin-top:6px' },
          'Every free army, fleet and air wing of ours joins (forces you keep for direct command, and those in other operations, do not). It takes the chosen enemies\' land, defends ours against anyone at war with us, moves aircraft to airfields in reach, and keeps a reserve. It never declares war, makes peace, buys or builds; airborne drops only if you allow them in its settings.',
        ),
      ),
    );
  }
  return section('Auto-conquer', ...kids);
}

function statusLine(app: App, op: Operation): HTMLElement {
  const sim = app.sim!;
  const f = opForces(sim, op.id);
  const p = progress(app, op);
  const open = button('Open', () => app.selectOp(op.id), { cls: 'small', fk: `ac-open-${op.id}` });
  return h(
    'div',
    { class: 'group-card' },
    h('div', { class: 'gc-head' }, h('b', { class: 'grow' }, op.name), h('span', { class: `tag ${op.issue ? 'bad' : op.status === 'active' ? 'good' : op.status === 'paused' ? 'warn' : 'brass'}` }, op.issue ? 'Needs a decision' : op.status === 'active' ? 'Active' : op.status === 'paused' ? 'Paused' : 'Over'), open),
    h('div', { class: 'small muted' }, `${p.taken} of ${p.total} enemy provinces taken · ${plural(f.armies.length, 'army', 'armies')}, ${plural(f.fleets.length, 'fleet')}, ${plural(f.wings.length, 'wing')} · ${men(op.stats.menLost)} lost`),
    op.issue ? h('div', { class: 'small neg' }, op.issue.text) : null,
  );
}

/** Enemy land taken: provinces of the chosen enemies (and ours they held) now ours, of all of them. */
function progress(app: App, op: Operation): { taken: number; total: number } {
  const sim = app.sim!;
  const st = sim.state;
  const total = op.area.length;
  const taken = op.area.filter((pid) => isFriendly(sim, op.nation, st.provinces[pid].controller)).length;
  return { taken, total };
}

/** The status card of a mandate (the operation card's head and body for Auto-conquer). */
export function warStatus(app: App, op: Operation): HTMLElement[] {
  const sim = app.sim!;
  const st = sim.state;
  const f = opForces(sim, op.id);
  const out: HTMLElement[] = [];
  const p = progress(app, op);
  const regs = f.armies.reduce((n, a) => n + a.regiments.length, 0);
  const held = [...f.armies, ...f.fleets, ...f.wings].filter((u) => u.opHold).length;
  // opponents
  const foes = (op.enemies ?? []).map((e) => h('span', { class: 'tag', style: 'margin-right:4px' }, shield(app, e), ` ${nationName(sim, e)}`));
  out.push(
    section(
      'Opponents',
      foes.length ? h('div', { class: 'row wrap' }, foes) : h('p', { class: 'small muted' }, 'No war left with the chosen enemies: the mandate is over.'),
      op.status !== 'complete' ? button('Change opponents…', () => app.editWarEnemies(op.id), { cls: 'small quiet', fk: 'ac-enemies' }) : null,
    ),
  );
  out.push(
    section(
      'Progress',
      bar(p.taken, Math.max(1, p.total), 'good', 'Enemy land taken'),
      row('Enemy land held by us', `${p.taken} of ${p.total} provinces`),
      row('Taken / lost since it began', `${op.stats.taken} / ${op.stats.lost}`),
      row('Forces', `${plural(f.armies.length, 'army', 'armies')} (${regs} regiments) · ${plural(f.fleets.length, 'fleet')} · ${plural(f.wings.length, 'wing')}${held ? ` · ${held} under your direct command` : ''}`),
      row('Losses', `${men(op.stats.menLost)} men · ${plural(op.stats.shipsLost, 'ship')} · air strength ${Math.round(op.stats.wingStrengthLost)}%`),
      row('Priority', STRATEGY_LABELS[op.strategy ?? 'none'] + (op.strategy === 'focus' && op.focus ? `: ${nationName(sim, op.focus)}` : '')),
      row('New forces', op.autoAssign ? 'join automatically' : 'join only when you add them'),
      row('Airborne drops', op.airborne === 'off' ? 'not allowed' : op.airborne === 'once' ? 'one drop allowed' : 'allowed'),
    ),
  );
  // landings it organised (their own operations, under the ordinary landing rules)
  const subs = Object.values(st.operations).filter((o) => o.parent === op.id);
  if (subs.length)
    out.push(
      section(
        'Landings it organised',
        ...subs.map((s) => h('div', { class: 'kv' }, h('span', { class: 'k' }, h('button', { class: 'linklike', type: 'button', 'data-fk': `ac-sub-${s.id}`, onclick: () => app.selectOp(s.id) }, s.name)), h('span', { class: 'v small' }, s.landing?.stage === 'ashore' ? 'ashore, taking the area' : s.landing?.stage === 'sail' ? 'at sea' : 'gathering at the port'))),
      ),
    );
  // what stands in the way (the planner's own reasons, grouped)
  const waits = Object.entries(op.tasks)
    .filter(([id, t]) => unitRef(sim, id) && ['wait', 'stage', 'recover'].includes(t.kind))
    .map(([, t]) => t.note.replace(/;.*$/, ''));
  const counts = new Map<string, number>();
  for (const w of waits) {
    const k = w.length > 90 ? `${w.slice(0, 88)}…` : w;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (top.length) out.push(section('Waiting or recovering', ...top.map(([k, n]) => h('div', { class: 'small' }, `${n} × ${k}`))));
  void st;
  void provName;
  return out;
}

/** Keep a force for direct command (Auto-conquer never takes it), or hand it back: for the force's own card. */
export function reserveToggle(app: App, id: string): HTMLElement | null {
  const sim = app.sim!;
  const r = unitRef(sim, id);
  if (!r || r.unit.nation !== app.player) return null;
  const live = warOps(app).filter((o) => o.status !== 'complete');
  if (!live.length && !r.unit.reserved) return null;
  if (r.unit.reserved)
    return h(
      'div',
      { class: 'callout info', style: 'margin-top:8px', 'data-sk': 'reserved' },
      icon('info'),
      h('span', { class: 'grow' }, 'Kept for your direct command: Auto-conquer does not use it.'),
      button('Let Auto-conquer use it', () => app.do({ type: 'reserveUnits', units: [id], reserved: false }), { cls: 'small', fk: 'unit-unreserve' }),
    );
  return h('div', { class: 'row', style: 'margin-top:6px' }, button('Keep for my direct command', () => app.do({ type: 'reserveUnits', units: [id], reserved: true }), { cls: 'small quiet', fk: 'unit-reserve', title: 'Auto-conquer will not take this force (now or later) until you allow it again.' }));
}
