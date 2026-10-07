// National Focus: the realm's branching plan. Each branch is a lane; work runs
// left to right (a focus sits to the right of what it needs), and the choices
// that exclude each other are tied with a dashed "or". The inspector separates
// what a focus does while held, what it grants on completion and its flavour,
// and states what switching away from the current focus would cost.

import { FOCUS_BRANCHES, type FocusBranch, type FocusDef } from '../../sim/data/focus';
import { describeReward, focusMonthsLeft, focusProblem, focusStatus, focusTree, getFocus } from '../../sim/focus';
import { describeEffects } from '../../sim/modifiers';
import type { NationId } from '../../sim/types';
import type { App } from '../app';
import { action, bar, button, h } from '../dom';
import { confirmDialog } from '../panels/dialogs';
import { treeLegend, treePlane, type NodeState, type TreeBand, type TreeEdge, type TreeNode } from '../tree';

const NODE_W = 160;
const NODE_H = 60;
const GAP_X = 34;
const GAP_Y = 10;
const LANE_HEAD = 24;
const PAD = 14;

const STATE_TEXT: Record<NodeState, string> = {
  done: 'Completed',
  current: 'The national focus now',
  available: 'Can be chosen now',
  locked: 'Needs an earlier focus',
  early: 'Not yet: waits for a year or a coast',
  excluded: 'Excluded by an earlier choice',
};

function stateOf(app: App, nid: NationId, d: FocusDef): NodeState {
  const s = focusStatus(app.sim!, nid, d.id);
  if (s !== 'locked') return s;
  const why = focusProblem(app.sim!, nid, d.id) ?? '';
  return why.startsWith('Not before') || why.startsWith('Needs a coast') ? 'early' : 'locked';
}

export function focusLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const pid = app.player;
  if (!pid) return h('p', { class: 'muted' }, 'Observer mode: no realm of your own.');
  const n = sim.state.nations[pid];
  const tree = focusTree(sim, pid);
  const byId = new Map(tree.map((d) => [d.id, d]));
  const branches = (Object.keys(FOCUS_BRANCHES) as FocusBranch[]).filter((b) => tree.some((d) => d.branch === b));
  // lanes: one per branch; inside, a focus's row in the data is its step (x) and its column its line (y)
  const lanes: TreeBand[] = [];
  const nodes: TreeNode[] = [];
  let y = 0;
  let maxStep = 0;
  for (const b of branches) {
    const list = tree.filter((d) => d.branch === b);
    const lines = Math.max(...list.map((d) => d.col)) + 1;
    const done = list.filter((d) => n.focus.done.includes(d.id)).length;
    const size = LANE_HEAD + lines * (NODE_H + GAP_Y) + GAP_Y;
    lanes.push({ label: FOCUS_BRANCHES[b].name, sub: `${done}/${list.length} completed`, at: y, size });
    for (const d of list) {
      const st = stateOf(app, pid, d);
      maxStep = Math.max(maxStep, d.row);
      nodes.push({
        id: d.id,
        x: PAD + d.row * (NODE_W + GAP_X),
        y: y + LANE_HEAD + d.col * (NODE_H + GAP_Y),
        title: d.name,
        meta: st === 'done' ? 'completed' : st === 'current' ? `${n.focus.progress} of ${d.months} months` : `${d.months} months${d.year && st !== 'excluded' ? ` · from ${d.year}` : ''}`,
        state: st,
        progress: st === 'current' ? n.focus.progress / d.months : undefined,
        stateText: STATE_TEXT[st],
      });
    }
    y += size;
  }
  const edges: TreeEdge[] = [];
  const seen = new Set<string>();
  for (const d of tree) {
    for (const r of d.requires) if (byId.has(r)) edges.push({ from: r, to: d.id, kind: 'requires' });
    for (const r of d.requiresAny ?? []) if (byId.has(r)) edges.push({ from: r, to: d.id, kind: 'any' });
    for (const x of d.excludes ?? []) {
      const k = [d.id, x].sort().join('|');
      if (byId.has(x) && !seen.has(k)) seen.add(k), edges.push({ from: d.id, to: x, kind: 'excludes' });
    }
  }
  const cur = n.focus.current ? getFocus(sim, pid, n.focus.current) : null;
  const sel = (app.ui.focusSel && byId.has(app.ui.focusSel) ? app.ui.focusSel : null) ?? cur?.id ?? tree.find((d) => stateOf(app, pid, d) === 'available')?.id ?? tree[0].id;
  const plane = treePlane({
    key: 'focus-plane',
    label: 'National focus plan by branch',
    nodes,
    edges,
    lanes,
    columns: [{ label: 'Earlier → later: each focus needs the ones linked before it', at: 0, size: PAD * 2 + (maxStep + 1) * (NODE_W + GAP_X) }],
    nodeW: NODE_W,
    nodeH: NODE_H,
    selected: sel,
    onSelect: (id) => {
      app.ui.focusSel = id;
      app.refresh();
    },
  });
  const strip = h(
    'div',
    { class: 'strip' },
    h('div', null, h('span', { class: 'k' }, 'National focus'), h('b', { class: cur ? '' : 'warn' }, cur ? cur.name : 'None')),
    h('div', null, h('span', { class: 'k' }, 'Progress'), h('b', null, cur ? `${n.focus.progress} / ${cur.months} months` : '—')),
    h('div', null, h('span', { class: 'k' }, 'Done in'), h('b', null, cur ? `${focusMonthsLeft(sim, pid)} months` : '—')),
    h('div', null, h('span', { class: 'k' }, 'Completed'), h('b', null, `${n.focus.done.length} of ${tree.length}`)),
  );
  return h(
    'div',
    { class: 'tree-ledger' },
    strip,
    cur ? null : h('div', { class: 'callout warn small', role: 'status' }, 'No national focus: a month without one is a month lost. Choose one below.'),
    h(
      'div',
      { class: 'tree-work' },
      h('div', { class: 'tree-main' }, plane, treeLegend([['done', 'Completed'], ['current', 'Under way'], ['available', 'Can choose'], ['locked', 'Needs an earlier focus'], ['early', 'Waits for a year or coast'], ['excluded', 'Excluded']], [['requires', 'Needed'], ['any', 'One of these'], ['excludes', 'Either, not both']])),
      inspector(app, pid, byId.get(sel)!),
    ),
    h('p', { class: 'small muted' }, 'The realm works on one focus at a time and each one finished is permanent. Switching loses the work done on the current focus.'),
  );
}

function inspector(app: App, pid: NationId, d: FocusDef): HTMLElement {
  const sim = app.sim!;
  const n = sim.state.nations[pid];
  const st = stateOf(app, pid, d);
  const prob = focusProblem(sim, pid, d.id);
  const cur = n.focus.current ? getFocus(sim, pid, n.focus.current) : null;
  const tree = focusTree(sim, pid);
  const name = (id: string) => getFocus(sim, pid, id)?.name ?? id;
  const chip = (id: string) => {
    const f = getFocus(sim, pid, id);
    const s = f ? stateOf(app, pid, f) : 'locked';
    return h('button', { type: 'button', class: `chip ${s}`, title: STATE_TEXT[s], onclick: () => ((app.ui.focusSel = id), app.refresh()) }, name(id));
  };
  const effects = describeEffects(d.effects);
  const reward = describeReward(sim, d);
  const leadsTo = tree.filter((o) => o.requires.includes(d.id) || o.requiresAny?.includes(d.id));
  const status =
    st === 'done'
      ? h('p', { class: 'state-line good' }, 'Completed: its effects are permanent.')
      : st === 'current'
        ? h('div', null, h('p', { class: 'state-line' }, `Under way: ${n.focus.progress} of ${d.months} months, done in ${focusMonthsLeft(sim, pid)}.`), bar(n.focus.progress, d.months, 'info', 'Focus progress'))
        : st === 'excluded'
          ? h('p', { class: 'state-line bad' }, prob ?? 'Excluded by an earlier choice.')
          : st === 'available'
            ? h('p', { class: 'state-line' }, `Can be chosen now: ${d.months} months of work.`)
            : h('p', { class: 'state-line muted' }, prob ?? STATE_TEXT[st]);
  const start = () => {
    const go = () => app.do({ type: 'focus', focus: d.id });
    if (cur && n.focus.progress > 0) confirmDialog(app, `Switch to ${d.name}?`, `${n.focus.progress} month${n.focus.progress === 1 ? '' : 's'} of work on ${cur.name} will be lost.`, go);
    else go();
  };
  const consequence = cur
    ? n.focus.progress
      ? `Replaces ${cur.name}: ${n.focus.progress} month${n.focus.progress === 1 ? '' : 's'} of work on it are lost.`
      : `Replaces ${cur.name} (no work on it yet).`
    : `${d.months} months of work; a finished focus is permanent.`;
  return h(
    'aside',
    { class: 'tree-inspector', 'aria-live': 'polite', 'data-sk': 'focus-inspector' },
    h('div', { class: 'eyebrow' }, `${FOCUS_BRANCHES[d.branch].name} focus · ${d.months} months${d.year ? ` · from ${d.year}` : ''}`),
    h('h3', null, d.name),
    status,
    h('h4', null, 'While it is the realm’s focus, and after'),
    effects.length ? h('ul', { class: 'notes' }, effects.map((e) => h('li', null, e))) : h('p', { class: 'small muted' }, 'No lasting modifier.'),
    reward.length ? h('div', null, h('h4', null, 'On completion'), h('ul', { class: 'notes' }, reward.map((r) => h('li', { class: 'good' }, r)))) : null,
    d.claimsOnly ? h('p', { class: 'small warn' }, 'While held, wars may be declared only over claims.') : null,
    d.coastal ? h('p', { class: 'small muted' }, 'Only for realms with a coast.') : null,
    d.requires.length ? h('div', null, h('h4', null, 'Needs'), h('div', { class: 'chips' }, d.requires.map(chip))) : null,
    d.requiresAny?.length ? h('div', null, h('h4', null, 'Needs one of'), h('div', { class: 'chips' }, d.requiresAny.map(chip))) : null,
    d.excludes?.length ? h('div', null, h('h4', null, 'Rules out'), h('div', { class: 'chips' }, d.excludes.map(chip))) : null,
    leadsTo.length ? h('div', null, h('h4', null, 'Leads to'), h('div', { class: 'chips' }, leadsTo.map((o) => chip(o.id)))) : null,
    d.provinces?.length ? h('div', { style: 'margin-top:8px' }, button('Show the region on the map', () => app.highlightProvinces(d.provinces!), { cls: 'small quiet', icon: 'target' })) : null,
    h('blockquote', { class: 'flavor' }, d.description),
    st === 'done' || st === 'current' ? null : action(cur ? 'Make this our focus instead' : 'Make this our focus', consequence, start, prob, 'primary'),
  );
}
