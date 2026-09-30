import { TECHS, TECH_LIST } from '../../sim/data/techs';
import { debtStage, grossIncome, poolCap, stockpileCap } from '../../sim/economy';
import { overextension } from '../../sim/integration';
import { researchRate, techAvailable } from '../../sim/progression';
import { dateOf, warsOf } from '../../sim/state';
import type { App } from '../app';
import { h, setChildren } from '../dom';
import { fmt, signed } from '../format';
import { openMenuDialog } from '../screens';

export function shield(app: App, nid: string | null): HTMLElement {
  if (!nid || !app.sim) return h('span', { class: 'shield', style: 'background:#8a8272' }, '–');
  const d = app.sim.world.nationDefs[nid];
  return h('span', { class: 'shield', style: `background:${d.color}`, title: d.name, 'aria-label': d.name }, d.short[0]);
}

export function renderTopbar(app: App): void {
  const sim = app.sim!;
  const st = sim.state;
  const pid = app.player;
  const items: HTMLElement[] = [];
  const stat = (label: string, value: (Node | string)[], title: string, onClick?: () => void, cls = '') => {
    const b = h('button', { class: `stat ${cls}`, type: 'button', title }, h('span', { class: 'lbl' }, label), h('span', { class: 'val' }, ...value));
    if (onClick) b.addEventListener('click', onClick);
    return b;
  };
  if (pid) {
    const n = st.nations[pid];
    const def = sim.world.nationDefs[pid];
    const realm = h('button', { class: 'realm', type: 'button', title: `${def.name} — open the Realm ledger (B)` }, shield(app, pid), h('span', { class: 'nm' }, def.short));
    realm.addEventListener('click', () => app.openLedger('realm'));
    items.push(realm);
    const net = n.lastMonth.net;
    const stage = debtStage(sim, pid);
    items.push(
      stat(
        'Treasury',
        [fmt(n.treasury), h('small', { class: net >= 0 ? 'good' : 'bad' }, `${signed(net)}/mo`)],
        `Crowns. Last month: income ${fmt(grossIncome(n.lastMonth), 1)}, net ${signed(net)}. ${stage ? ['', 'In debt', 'Severe debt', 'Bankruptcy'][stage] : ''}`,
        () => app.openLedger('realm'),
        stage ? 'bad' : '',
      ),
    );
    const sNet = n.lastMonth.netSupplies;
    items.push(
      stat('Supplies', [`${fmt(n.supplies)}/${fmt(stockpileCap(sim, pid))}`, h('small', { class: sNet >= 0 ? 'good' : 'bad' }, `${signed(sNet)}`)], 'Supply stockpile / limit and monthly change. Armies on supply lines draw from it.', () => app.openLedger('realm'), n.supplies <= 0 ? 'bad' : ''),
    );
    items.push(
      stat(
        'Manpower',
        [fmt(n.manpower), h('small', { class: 'muted' }, `/${fmt(poolCap(sim, pid))}`)],
        n.manpower > poolCap(sim, pid)
          ? 'Men available to recruit and reinforce (pool / current limit). The pool is above the limit because occupied or lost land shrank the reserve, or more men are serving: no new men arrive until it falls below.'
          : `Men available to recruit and reinforce (pool / current limit). Recovers ${fmt(n.lastMonth.manpowerIn)} per month.`,
        () => app.openLedger('realm'),
      ),
    );
    const cur = n.research.current ? TECHS[n.research.current] : null;
    const anyLeft = TECH_LIST.some((t) => techAvailable(sim, pid, t.id));
    items.push(
      stat(
        'Research',
        cur
          ? [cur.name.split(' ')[0], h('small', { class: 'muted' }, `${Math.min(99, Math.floor((n.research.progress / cur.cost) * 100))}%`)]
          : anyLeft
            ? [h('span', { class: 'warn' }, 'Choose!')]
            : [h('span', { class: 'muted' }, 'Complete')],
        cur
          ? `${cur.name}: ${Math.floor(n.research.progress)}/${cur.cost} (${researchRate(sim, pid).toFixed(1)}/month)`
          : anyLeft
            ? 'No technology selected — progress banks only up to 60 points, then is lost.'
            : 'Every technology has been researched. Research funding can be set to None to save crowns.',
        () => app.openLedger('research'),
      ),
    );
    const wars = warsOf(sim, pid).length;
    if (wars || n.warExhaustion > 1) items.push(stat('War exh.', [`${Math.round(n.warExhaustion)}`, h('small', { class: 'bad' }, wars ? `${wars} war${wars > 1 ? 's' : ''}` : '')], 'War exhaustion (0–100) raises unrest and makes peace more urgent.', () => app.openLedger('wars'), n.warExhaustion > 50 ? 'bad' : ''));
    const ox = overextension(sim, pid);
    if (ox > 0) items.push(stat('Overext.', [h('span', { class: 'bad' }, `${Math.round(ox * 100)}%`)], 'Too much unintegrated frontier: integration slows and unrest rises. Integrate or grant charters.', () => app.openLedger('realm'), 'bad'));
    if (!n.alive) items.push(h('span', { class: 'bad', style: 'padding:0 8px' }, 'Realm destroyed — observing'));
  } else items.push(h('span', { class: 'realm' }, 'Observer'));
  const statsWrap = h('div', { class: 'stats-wrap' }, ...items.splice(0));
  items.push(statsWrap);
  items.push(h('span', { class: 'spacer' }));
  const d = dateOf(sim);
  const speeds = h('div', { class: 'speed', role: 'group', 'aria-label': 'Game speed' });
  const pause = h('button', { class: `btn icon ${app.speed === 0 ? 'active' : ''}`, type: 'button', title: 'Pause / resume (Space)', 'aria-label': app.speed === 0 ? 'Resume' : 'Pause' }, app.speed === 0 ? '▶' : '❚❚');
  pause.addEventListener('click', () => app.togglePause());
  speeds.appendChild(pause);
  [1, 2, 3, 4].forEach((s) => {
    const b = h('button', { class: `btn icon ${app.speed === s ? 'active' : ''}`, type: 'button', title: `Speed ${s} (${['', 'slow', 'normal', 'fast', 'fastest'][s]}) — key ${s}`, 'aria-pressed': app.speed === s ? 'true' : 'false' }, '›'.repeat(s));
    b.addEventListener('click', () => app.setSpeed(s));
    speeds.appendChild(b);
  });
  items.push(h('div', { class: 'timebox' }, app.speed === 0 ? h('span', { class: 'paused-flag' }, 'PAUSED') : null, h('span', { class: 'date' }, d.label), speeds));
  const menu = h('button', { class: 'btn', type: 'button', title: 'Game menu: save, load, settings', 'aria-label': 'Menu' }, '☰', h('span', { class: 'menu-label' }, ' Menu'));
  menu.addEventListener('click', () => openMenuDialog(app));
  items.push(menu);
  setChildren(app.topbarEl, items);
}
