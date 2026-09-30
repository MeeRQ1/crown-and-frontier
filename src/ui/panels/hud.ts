// The top bar: realm, resources (current value, monthly change, what is
// already committed), urgent problems, date and time controls.

import { TECHS, TECH_LIST } from '../../sim/data/techs';
import { coalitionAgainst } from '../../sim/diplomacy';
import { computeLedger, debtStage, grossIncome, poolCap, stockpileCap } from '../../sim/economy';
import { activeProjects, buildSlots } from '../../sim/construction';
import { overextension } from '../../sim/integration';
import { researchRate, techAvailable, techCost } from '../../sim/progression';
import { armiesOf, dateOf, provName, warsOf } from '../../sim/state';
import { rivalLeader } from '../../sim/ai/strategic';
import { VICTORY_LABELS } from '../../sim/victory';
import { scoreFor } from '../../sim/war';
import { SPEEDS, type App } from '../app';
import { h, rebuild, setChildren } from '../dom';
import { fmt, signed } from '../format';
import { icon, type IconName } from '../icons';
import { shield, tip } from './common';

export interface AttentionItem {
  level: 'seal' | 'bad' | 'warn' | 'info';
  short: string;
  text: string;
  icon: IconName;
  act?: () => void;
}

/** Everything that needs the player's attention, most severe first. */
export function attention(app: App): AttentionItem[] {
  const sim = app.sim;
  const pid = app.player;
  if (!sim || !pid) return [];
  const st = sim.state;
  const n = st.nations[pid];
  const out: AttentionItem[] = [];
  if (!n.alive) return [{ level: 'bad', short: 'Realm fallen', text: 'Your realm has been destroyed. You are observing the rest of the campaign.', icon: 'alert' }];
  const decisions = n.pendingEvents.length + st.proposals.filter((p) => p.to === pid).length;
  if (decisions) out.push({ level: 'seal', short: `${decisions} decision${decisions > 1 ? 's' : ''}`, text: `${decisions} decision${decisions > 1 ? 's' : ''} awaiting your answer.`, icon: 'scroll', act: () => app.openDecisions() });
  const stage = debtStage(sim, pid);
  if (stage) out.push({ level: 'bad', short: ['', 'In debt', 'Severe debt', 'Bankruptcy near'][stage], text: ['', 'Treasury in debt: 2% interest every month.', 'Severe debt: morale recovers at half speed and unrest rises.', 'Bankruptcy imminent: armies will be disbanded and projects cancelled.'][stage], icon: 'treasury', act: () => app.openLedger('realm') });
  if (n.supplies <= 0) out.push({ level: 'bad', short: 'No supplies', text: 'The supply stockpile is empty: armies on supply lines are starving.', icon: 'supplies', act: () => app.openLedger('realm') });
  const coal = coalitionAgainst(sim, pid);
  if (coal) out.push({ level: 'bad', short: 'Coalition', text: `A coalition of ${coal.members.map((m) => sim.world.nationDefs[m].short).join(', ')} stands against you.`, icon: 'alliance', act: () => app.openLedger('diplomacy') });
  for (const w of warsOf(sim, pid)) {
    const sc = Math.round(scoreFor(w, pid));
    out.push({ level: sc < 0 ? 'bad' : 'warn', short: `War ${sc >= 0 ? '+' : ''}${sc}`, text: `${w.name}: war score ${sc} in our favour.`, icon: 'wars', act: () => app.openLedger('wars') });
  }
  const restless = sim.world.provIds.filter((p) => st.provinces[p].owner === pid && st.provinces[p].unrest >= 60 && st.provinces[p].integration < 50);
  for (const p of restless.slice(0, 2)) out.push({ level: 'bad', short: 'Revolt risk', text: `${provName(sim, p)} may revolt (unrest ${Math.round(st.provinces[p].unrest)}). Garrison it or grant a charter.`, icon: 'alert', act: () => app.selectProvince(p, true) });
  const rival = rivalLeader(sim, pid);
  if (rival) out.push({ level: 'bad', short: `${sim.world.nationDefs[rival.nid].short} near victory`, text: `${sim.world.nationDefs[rival.nid].name} is closing in on ${VICTORY_LABELS[rival.path]}.`, icon: 'victory', act: () => app.openLedger('victory') });
  const starving = armiesOf(sim, pid).filter((a) => a.supply < 0.4 && !a.battle);
  if (starving.length) out.push({ level: 'warn', short: `${starving.length} unsupplied`, text: `${starving.length} ${starving.length > 1 ? 'armies are' : 'army is'} out of supply and losing men.`, icon: 'supply', act: () => app.selectArmy(starving[0].id, true) });
  if (!n.research.current && TECH_LIST.some((t) => techAvailable(sim, pid, t.id))) out.push({ level: 'warn', short: 'No research', text: 'No research selected: progress banks only up to 60 points, then is lost.', icon: 'research', act: () => app.openLedger('research') });
  const free = buildSlots(sim, pid) - activeProjects(sim, pid).length;
  if (free > 0 && n.treasury > 60) out.push({ level: 'info', short: `${free} idle builder${free > 1 ? 's' : ''}`, text: `${free} construction slot${free > 1 ? 's' : ''} idle. Select a province to develop, build roads or grant charters.`, icon: 'build', act: () => app.suggestBuild() });
  const ox = overextension(sim, pid);
  if (ox > 0) out.push({ level: 'warn', short: `Overextended ${Math.round(ox * 100)}%`, text: `Overextended by ${Math.round(ox * 100)}%: too much raw frontier. Integration slows and unrest rises.`, icon: 'settle', act: () => app.setMode('frontier') });
  return out;
}

function res(opts: { icon: IconName; value: (Node | string)[]; sub: (Node | string)[]; tip: () => Node; onClick: () => void; state?: 'alert' | 'caution' | ''; label: string }): HTMLElement {
  const b = h('button', { class: `res ${opts.state ?? ''}`, type: 'button', 'aria-label': opts.label, 'data-fk': opts.label }, icon(opts.icon), h('span', { class: 'val' }, ...opts.value), h('span', { class: 'sub' }, ...opts.sub));
  b.addEventListener('click', opts.onClick);
  tip(b, opts.tip);
  return b;
}

function breakdown(title: string, rows: Array<[string, number, string?]>, foot?: string): Node {
  return h(
    'div',
    null,
    h('b', { class: 't' }, title),
    ...rows.map(([k, v, cls]) => h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: `v ${cls ?? (v >= 0 ? 'good' : 'bad')}` }, signed(v)))),
    foot ? h('p', { class: 'faint', style: 'margin-top:6px' }, foot) : null,
  );
}

export function renderHud(app: App): void {
  const sim = app.sim!;
  const st = sim.state;
  const pid = app.player;
  const el = app.hudEl;
  rebuild(el, () => {
    const parts: HTMLElement[] = [];
    if (pid) {
      const n = st.nations[pid];
      const def = sim.world.nationDefs[pid];
      const realm = h('button', { class: 'hud-realm', type: 'button', 'aria-label': `${def.name}: open the Realm ledger`, 'data-fk': 'realm' }, shield(app, pid, 'lg'), h('span', { class: 'stack', style: 'gap:0' }, h('span', { class: 'nm' }, def.short), h('span', { class: 'title' }, def.name.replace(def.short, '').replace(/ of\s*$/, '').trim() || def.adjective)));
      realm.addEventListener('click', () => app.openLedger('realm'));
      parts.push(realm);
      const l = computeLedger(sim, pid);
      const gross = grossIncome(l);
      const costs = Object.values(l.expenses).reduce((a, b) => a + b, 0);
      const stage = debtStage(sim, pid);
      const resEl = h('div', { class: 'hud-res' });
      resEl.appendChild(
        res({
          label: 'Treasury',
          icon: 'treasury',
          value: [fmt(n.treasury)],
          sub: [h('span', { class: l.net >= 0 ? 'pos' : 'neg' }, `${signed(l.net)}/mo`), h('span', { class: 'commit' }, `−${fmt(costs)} costs`)],
          state: stage >= 2 ? 'alert' : stage ? 'caution' : '',
          tip: () =>
            breakdown(
              'Treasury (crowns)',
              [...Object.entries(l.income).map(([k, v]) => [k, v] as [string, number]), ...Object.entries(l.expenses).map(([k, v]) => [k, -v] as [string, number])],
              `Income ${fmt(gross, 1)} − costs ${fmt(costs, 1)} = ${signed(l.net)} per month.${stage ? ' In debt: see the Realm ledger.' : ''}`,
            ),
          onClick: () => app.openLedger('realm'),
        }),
      );
      const sIn = Object.values(l.suppliesIn).reduce((a, b) => a + b, 0);
      const sOut = Object.values(l.suppliesOut).reduce((a, b) => a + b, 0);
      resEl.appendChild(
        res({
          label: 'Supplies',
          icon: 'supplies',
          value: [fmt(n.supplies), h('span', { class: 'cap' }, `/${fmt(stockpileCap(sim, pid))}`)],
          sub: [h('span', { class: l.netSupplies >= 0 ? 'pos' : 'neg' }, `${signed(l.netSupplies)}/mo`), h('span', { class: 'commit' }, `−${fmt(sOut, 1)} armies`)],
          state: n.supplies <= 0 ? 'alert' : l.netSupplies < 0 && n.supplies < sOut * 3 ? 'caution' : '',
          tip: () => breakdown('Supplies (wagons)', [...Object.entries(l.suppliesIn).map(([k, v]) => [k, v] as [string, number]), ...Object.entries(l.suppliesOut).map(([k, v]) => [k, -v] as [string, number])], `Produced ${fmt(sIn, 1)}, drawn ${fmt(sOut, 1)} per month. Armies beyond supply range forage instead.`),
          onClick: () => app.openLedger('realm'),
        }),
      );
      let training = 0;
      for (const p of sim.world.provIds) for (const o of st.provinces[p].recruits) if (o.nation === pid) training++;
      const cap = poolCap(sim, pid);
      resEl.appendChild(
        res({
          label: 'Manpower',
          icon: 'manpower',
          value: [fmt(n.manpower), h('span', { class: 'cap' }, `/${fmt(cap)}`)],
          sub: [h('span', { class: 'pos' }, `+${fmt(l.manpowerIn)}/mo`), training ? h('span', { class: 'commit' }, `${training} training`) : h('span', { class: 'commit' }, 'men')],
          state: n.manpower < 1000 && cap < 1500 ? 'caution' : '',
          tip: () =>
            h(
              'div',
              null,
              h('b', { class: 't' }, 'Manpower'),
              h('p', null, `Men ready to recruit and reinforce: ${fmt(n.manpower)} of a current limit of ${fmt(cap)}.`),
              h('p', { class: 'faint' }, n.manpower > cap ? 'The pool is above the limit because occupied or lost land shrank the reserve, or more men are serving: no new men arrive until it falls below.' : `About ${fmt(l.manpowerIn)} men join each month. Regiments in training: ${training}.`),
            ),
          onClick: () => app.openLedger('military'),
        }),
      );
      const cur = n.research.current ? TECHS[n.research.current] : null;
      const rate = researchRate(sim, pid);
      const anyLeft = TECH_LIST.some((t) => techAvailable(sim, pid, t.id));
      resEl.appendChild(
        res({
          label: 'Research',
          icon: 'research',
          value: cur ? [cur.name.split(' ').slice(-1)[0], h('span', { class: 'cap' }, ` ${Math.min(99, Math.floor((n.research.progress / techCost(sim, cur.id)) * 100))}%`)] : [anyLeft ? 'Choose' : 'Complete'],
          sub: cur ? [h('span', { class: 'pos' }, `+${fmt(rate, 1)}/mo`), h('span', { class: 'commit' }, `~${Math.max(1, Math.ceil((techCost(sim, cur.id) - n.research.progress) / Math.max(0.1, rate)))} mo`)] : [h('span', { class: 'commit' }, anyLeft ? 'nothing selected' : 'all done')],
          state: !cur && anyLeft ? 'caution' : '',
          tip: () =>
            h(
              'div',
              null,
              h('b', { class: 't' }, cur ? cur.name : 'Research'),
              h('p', null, cur ? `${Math.floor(n.research.progress)} of ${techCost(sim, cur.id)} points; ${fmt(rate, 1)} per month at funding level ${n.research.funding}.` : anyLeft ? 'No technology selected — progress banks only up to 60 points, then is lost.' : 'Every technology has been researched. Research funding can be set to None to save crowns.'),
            ),
          onClick: () => app.openLedger('research'),
        }),
      );
      if (warsOf(sim, pid).length || n.warExhaustion > 1) {
        resEl.appendChild(
          res({
            label: 'War exhaustion',
            icon: 'wars',
            value: [`${Math.round(n.warExhaustion)}`],
            sub: [h('span', { class: 'commit' }, `${warsOf(sim, pid).length} war${warsOf(sim, pid).length === 1 ? '' : 's'}`)],
            state: n.warExhaustion > 60 ? 'alert' : n.warExhaustion > 30 ? 'caution' : '',
            tip: () => h('div', null, h('b', { class: 't' }, 'War exhaustion (0–100)'), h('p', null, 'Rises with battles, occupation and long wars. It raises unrest and makes the realm accept worse peace terms; at 100 peace must be accepted.')),
            onClick: () => app.openLedger('wars'),
          }),
        );
      }
      parts.push(resEl);
    } else {
      parts.push(h('div', { class: 'hud-realm' }, icon('eye'), h('span', { class: 'nm' }, 'Observer')));
    }
    parts.push(h('div', { class: 'hud-spacer' }));
    // urgent problems
    const items = attention(app);
    const alerts = h('div', { class: 'hud-alerts' });
    const chips = items.filter((i) => i.level === 'seal' || i.level === 'bad').slice(0, 2);
    for (const it of chips) {
      const c = h('button', { class: `alert-chip ${it.level}`, type: 'button', 'data-fk': `chip-${it.short}` }, icon(it.icon), it.short);
      if (it.act) c.addEventListener('click', it.act);
      tip(c, it.text);
      alerts.appendChild(c);
    }
    const bell = h('button', { class: `alert-chip ${items.length ? '' : ''}`, type: 'button', 'aria-label': `${items.length} items need attention`, 'data-fk': 'bell' }, icon('bell'), items.length ? String(items.length) : '');
    bell.addEventListener('click', () => app.toggleAttention(bell));
    tip(bell, items.length ? 'Things that need your attention (click for the list)' : 'Nothing needs your attention');
    alerts.appendChild(bell);
    parts.push(alerts);
    // time
    const d = dateOf(sim);
    const paused = app.speed === 0;
    const speeds = h('div', { class: 'speeds', role: 'group', 'aria-label': 'Game speed' });
    const play = h('button', { class: `play ${paused ? 'paused' : ''}`, type: 'button', 'aria-label': paused ? 'Resume (Space)' : 'Pause (Space)', 'data-fk': 'play' }, icon(paused ? 'play' : 'pause'));
    play.addEventListener('click', () => app.togglePause());
    tip(play, paused ? 'Resume (Space)' : 'Pause (Space)');
    speeds.appendChild(play);
    for (let s = 1; s < SPEEDS.length; s++) {
      const b = h('button', { class: `${app.speed === s ? 'active' : ''} ${s === 1 ? 'slow' : ''}`, type: 'button', 'aria-label': `Speed ${s}`, 'aria-pressed': app.speed === s ? 'true' : 'false', 'data-fk': `speed${s}` }, h('span', { class: 'pips' }, ...[1, 2, 3, 4].map((k) => h('i', { class: k <= s ? 'on' : '' }))));
      b.addEventListener('click', () => app.setSpeed(s));
      tip(b, `Speed ${s}: ${SPEEDS[s]} week${SPEEDS[s] === 1 ? '' : 's'} per second (key ${s})`);
      speeds.appendChild(b);
    }
    parts.push(h('div', { class: 'hud-time' }, h('div', { class: 'hud-date' }, h('span', { class: 'd' }, d.label), h('span', { class: `s ${paused ? 'paused' : ''}` }, paused ? 'Paused' : `Speed ${app.speed}`)), speeds));
    const menu = h('button', { class: 'btn quiet icon', type: 'button', 'aria-label': 'Game menu', 'data-fk': 'menu' }, icon('menu'));
    menu.addEventListener('click', () => app.openMenu());
    tip(menu, 'Save, load, settings, quit (Esc when nothing is open)');
    parts.push(h('div', { class: 'hud-menu' }, menu));
    setChildren(el, ...parts);
  });
}
