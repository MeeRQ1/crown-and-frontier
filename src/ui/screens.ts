// Full-screen views and the in-game menu.

import { TECHS } from '../sim/data/techs';
import { PERSONALITIES } from '../sim/data/personalities';
import { reserveCap, totalDev } from '../sim/economy';
import { createGame } from '../sim/game';
import { dateOf, nationName, ownedProvinces } from '../sim/state';
import type { Difficulty } from '../sim/types';
import { VICTORY_LABELS } from '../sim/victory';
import { getWorld } from '../sim/world';
import { DIFFICULTY } from '../sim/ai/common';
import type { App } from './app';
import { button, h, row, setChildren } from './dom';
import { fmt } from './format';
import { dialog, confirmDialog } from './panels/dialogs';
import { DEFAULT_SETTINGS, type UISettings } from './settings';
import { pickFile } from './storage';

const FANTASY =
  'You rule a young crown on a divided continent. Your heartland is rich, but every province you gain beyond it is raw frontier — little tax, few recruits, restless people — until you integrate it. Expand by settlement, investment or conquest, bind new land to the crown before rivals exploit its weakness, and win the Reach through dominance, prosperity or leadership.';

export function renderMenu(app: App): HTMLElement {
  const el = h('div', { class: 'screen', role: 'main' });
  const buttons = h('div', { class: 'menu-buttons' });
  setChildren(
    el,
    h('div', { class: 'title' }, 'Crown & Frontier'),
    h('p', { class: 'subtitle' }, FANTASY),
    buttons,
    app.store.problem ? h('p', { class: 'warn small', style: 'max-width:560px;text-align:center;margin-top:16px' }, app.store.problem) : null,
    h('p', { class: 'muted small', style: 'margin-top:auto;padding-top:30px;text-align:center' }, 'An original game. All realms, places and events are fictional. Runs entirely in your browser — no account, no server.'),
  );
  void (async () => {
    const latest = await app.store.latest().catch(() => null);
    const items: HTMLElement[] = [];
    if (latest?.meta) {
      items.push(button(h('span', null, 'Continue', h('br'), h('small', { class: 'muted' }, `${latest.meta.nationName}, ${latest.meta.date}`)), () => void app.load(latest.key), { cls: 'primary' }));
    }
    items.push(button('New campaign', () => app.showScreen(renderNewGame(app)), { cls: latest ? '' : 'primary' }));
    items.push(button('Load or import a save', () => app.showScreen(renderLoad(app))));
    items.push(button('Settings', () => app.showScreen(renderSettingsScreen(app))));
    items.push(button('How to play', () => app.showScreen(renderHowTo(app))));
    setChildren(buttons, items);
    (buttons.querySelector('button') as HTMLButtonElement | null)?.focus();
  })();
  return el;
}

function backBtn(app: App): HTMLElement {
  return button('← Back', () => (app.sim ? app.hideScreen() : app.showMenu()));
}

export function renderNewGame(app: App): HTMLElement {
  const world = getWorld('reach');
  const probe = createGame({ seed: 1, playerNation: null });
  let chosen = 'aur';
  let difficulty: Difficulty = 'normal';
  let years = 40;
  let tutorial = app.settings.tutorial;
  let aiBonus = 0;
  const seedInput = h('input', { type: 'number', value: String(Math.floor(Math.random() * 1e6)), min: 0, 'aria-label': 'Seed', style: 'width:9em' });
  const grid = h('div', { class: 'nation-grid', role: 'radiogroup', 'aria-label': 'Choose your realm' });
  const renderGrid = () => {
    setChildren(
      grid,
      world.nationIds.map((nid) => {
        const d = world.nationDefs[nid];
        const card = h(
          'button',
          { class: `nation-card ${chosen === nid ? 'selected' : ''}`, type: 'button', role: 'radio', 'aria-checked': chosen === nid ? 'true' : 'false' },
          h('h3', null, h('span', { class: 'shield', style: `background:${d.color}` }, d.short[0]), d.name),
          h('p', { class: 'small muted' }, d.summary),
          h('p', { class: 'small' }, h('span', { class: 'good' }, '▲ '), d.strength),
          h('p', { class: 'small' }, h('span', { class: 'bad' }, '▼ '), d.constraint),
          h('p', { class: 'small muted' }, `${ownedProvinces(probe, nid).length} provinces · development ${totalDev(probe, nid)} · reserve ${fmt(reserveCap(probe, nid))} men · AI temperament: ${PERSONALITIES[d.personality].label}`),
          nid === 'aur' ? h('span', { class: 'tag good' }, 'Recommended first realm') : nid === 'fen' || nid === 'cal' ? h('span', { class: 'tag warn' }, 'Challenging') : null,
        );
        card.addEventListener('click', () => {
          chosen = nid;
          renderGrid();
        });
        return card;
      }),
    );
  };
  renderGrid();
  const sel = <T extends string | number>(label: string, options: Array<[T, string]>, value: T, onChange: (v: T) => void) => {
    const s = h('select', { 'aria-label': label }, options.map(([v, t]) => h('option', { value: String(v), selected: v === value ? true : undefined }, t)));
    s.addEventListener('change', () => onChange((typeof value === 'number' ? Number(s.value) : s.value) as T));
    return h('div', { class: 'field' }, h('label', null, label), s);
  };
  const tut = h('input', { type: 'checkbox', checked: tutorial ? true : undefined, id: 'tut' });
  tut.addEventListener('change', () => (tutorial = tut.checked));
  const start = button('Begin campaign', () => {
    app.updateSettings({ tutorial });
    app.newGame({ seed: Number(seedInput.value) || 1, playerNation: chosen, difficulty, campaignYears: years, aiIncomeBonus: aiBonus }, tutorial);
  }, { cls: 'primary' });
  const observe = button('Watch an AI-only campaign', () => app.newGame({ seed: Number(seedInput.value) || 1, playerNation: null, difficulty, campaignYears: years }, false), { title: 'All nine realms are AI; useful to learn and to test.' });
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'setup-bar' }, backBtn(app), h('h2', { style: 'margin:0' }, 'New campaign — The Reach, 1640')),
    h(
      'div',
      { class: 'setup-bar', style: 'margin-top:0' },
      sel<Difficulty>('AI difficulty', (['easy', 'normal', 'hard'] as Difficulty[]).map((d) => [d, DIFFICULTY[d].label]), difficulty, (v) => (difficulty = v)),
      sel<number>('Campaign length', [[25, '25 years (≈30–50 min)'], [40, '40 years (≈45–90 min)'], [60, '60 years (long)']], years, (v) => (years = v)),
      sel<number>('AI economic assistance', [[0, 'None (default)'], [0.15, '+15% AI income (disclosed)']], aiBonus, (v) => (aiBonus = v)),
      h('div', { class: 'field' }, h('label', null, 'Seed'), seedInput),
      h('div', { class: 'field' }, h('label', { for: 'tut' }, 'Tutorial'), h('div', { class: 'row' }, tut, h('span', { class: 'small' }, 'Show guided first steps'))),
      h('span', { class: 'grow' }),
      observe,
      start,
    ),
    grid,
    h('p', { class: 'small muted', style: 'max-width:1100px;margin-top:12px' }, 'Difficulty changes how well AI realms decide — how many options they weigh, whether they coordinate armies, and how often they blunder. AI realms never get hidden combat bonuses or free actions; optional income assistance is shown above and in the Help ledger.'),
  );
}

export function renderLoad(app: App): HTMLElement {
  const list = h('div', { style: 'width:min(700px,100%)' }, h('p', { class: 'muted' }, 'Reading saves…'));
  const refresh = async () => {
    const slots = await app.store.list().catch(() => []);
    setChildren(
      list,
      slots.length
        ? slots.map((s) =>
            h(
              'div',
              { class: 'card row', style: 'margin:6px 0' },
              h('div', { class: 'grow' }, h('b', null, s.key), h('div', { class: 'small muted' }, s.meta ? `${s.meta.nationName} — ${s.meta.date} · saved ${new Date(s.meta.savedAt).toLocaleString()}` : 'Unreadable save')),
              button('Load', () => void app.load(s.key), { cls: 'primary small', disabled: s.meta ? null : 'Unreadable' }),
              button('Delete', () => confirmDialog(app, `Delete ${s.key}?`, 'This cannot be undone.', () => void app.store.remove(s.key).then(refresh)), { cls: 'danger small' }),
            ),
          )
        : h('p', { class: 'muted' }, 'No saves in this browser yet.'),
    );
  };
  void refresh();
  const imp = button('Import save file…', async () => {
    const text = await pickFile('.json,application/json');
    if (text === '__too_big__') return dialog(app, 'File too large', [h('p', null, 'That file is too large to be a save.')]);
    if (text) app.loadText(text);
  });
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'setup-bar' }, backBtn(app), h('h2', { style: 'margin:0' }, 'Load a campaign'), h('span', { class: 'grow' }), imp),
    list,
    h('p', { class: 'small muted', style: 'max-width:700px' }, `Saves are stored in this browser (${app.store.mode}). They do not sync between devices or websites and may be cleared by private browsing or managed-device policies — export important campaigns to a file.`),
  );
}

function settingsControls(app: App, onChange?: () => void): HTMLElement {
  const s = app.settings;
  const grid = h('div', { class: 'settings-grid' });
  const toggle = (key: keyof UISettings, label: string, help?: string) => {
    const cb = h('input', { type: 'checkbox', checked: s[key] ? true : undefined, id: `set-${key}` });
    cb.addEventListener('change', () => {
      app.updateSettings({ [key]: cb.checked } as Partial<UISettings>);
      onChange?.();
    });
    grid.append(h('label', { for: `set-${key}` }, label, help ? h('div', { class: 'small muted' }, help) : null), cb);
  };
  const slider = (key: 'volume' | 'uiScale', label: string, min: number, max: number, stepv: number) => {
    const r = h('input', { type: 'range', min, max, step: stepv, value: String(s[key]), id: `set-${key}` });
    const out = h('span', { class: 'small muted' }, String(s[key]));
    r.addEventListener('input', () => {
      out.textContent = r.value;
      app.updateSettings({ [key]: Number(r.value) } as Partial<UISettings>);
    });
    grid.append(h('label', { for: `set-${key}` }, label), h('div', { class: 'row' }, r, out));
  };
  slider('volume', 'Volume', 0, 1, 0.05);
  toggle('sound', 'Sound effects');
  slider('uiScale', 'Interface scale', 0.85, 1.3, 0.05);
  toggle('reducedMotion', 'Reduced motion', 'No pulsing markers or sliding notifications.');
  toggle('patterns', 'Realm patterns', 'Hatch patterns on each realm, so ownership does not depend on colour alone.');
  toggle('showNames', 'Province names on the map');
  toggle('autoPauseWar', 'Pause when war is declared on us');
  toggle('autoPauseEvent', 'Pause for events');
  toggle('autoPauseProposal', 'Pause for proposals and calls to arms');
  toggle('autoPauseBattle', 'Pause when our armies start a battle');
  const auto = h('select', { id: 'set-auto' }, [0, 3, 6, 12].map((m) => h('option', { value: String(m), selected: s.autosaveMonths === m ? true : undefined }, m ? `Every ${m} months` : 'Off')));
  auto.addEventListener('change', () => app.updateSettings({ autosaveMonths: Number(auto.value) }));
  grid.append(h('label', { for: 'set-auto' }, 'Autosave', h('div', { class: 'small muted' }, 'Also when the tab is hidden or closed.')), auto);
  const reset = button('Restore defaults', () => {
    app.updateSettings({ ...DEFAULT_SETTINGS });
    onChange?.();
  }, { cls: 'small' });
  return h('div', null, grid, h('div', { style: 'margin-top:12px' }, reset));
}

export function renderSettingsScreen(app: App): HTMLElement {
  const holder = h('div', { style: 'width:min(560px,100%)' });
  const draw = () => setChildren(holder, settingsControls(app, draw));
  draw();
  return h('div', { class: 'screen' }, h('div', { class: 'setup-bar', style: 'width:min(560px,100%)' }, backBtn(app), h('h2', { style: 'margin:0' }, 'Settings')), holder);
}

export function renderHowTo(app: App): HTMLElement {
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'setup-bar', style: 'width:min(760px,100%)' }, backBtn(app), h('h2', { style: 'margin:0' }, 'How to play')),
    h(
      'div',
      { style: 'width:min(760px,100%)' },
      h('p', null, FANTASY),
      h('h3', null, 'Winning'),
      h('p', null, `${VICTORY_LABELS.territorial}: hold four regions and a fifth of the Reach. ${VICTORY_LABELS.economic}: out-develop the world with integrated, stable land. ${VICTORY_LABELS.diplomatic}: become the centre of a web of long-standing alliances and trade. Each must be held for years while rivals respond; otherwise the best campaign score wins at the time limit.`),
      h('h3', null, 'Losing'),
      h('p', null, 'You lose if your realm is destroyed or another realm achieves victory first. Losing your capital is not fatal: the court moves, at a cost.'),
      h('h3', null, 'First minutes'),
      h('p', null, 'Pick a research topic, start a development or road project, decide on a national policy, and look at your borders: who is stronger, who is alarmed, who might be a partner? The tutorial walks through each of these with legal actions from your current situation.'),
      h('p', { class: 'muted small' }, 'In game, the Help ledger (H) lists all controls and rules.'),
    ),
  );
}

export function openMenuDialog(app: App): void {
  const sim = app.sim;
  if (!sim) return;
  app.setSpeed(0);
  let close = () => {};
  const slotRow = (slot: string) => button(`Save to ${slot}`, async () => {
    await app.save(slot);
    close();
  });
  const body = [
    h('p', { class: 'small muted' }, `${sim.state.settings.playerNation ? sim.world.nationDefs[sim.state.settings.playerNation].name : 'Observer'} · ${dateOf(sim).label} · seed ${sim.state.settings.seed} · ${DIFFICULTY[sim.state.settings.difficulty].label}${sim.state.settings.aiIncomeBonus ? ` · AI income +${Math.round(sim.state.settings.aiIncomeBonus * 100)}%` : ''}`),
    h('div', { class: 'actions' }, slotRow('slot-1'), slotRow('slot-2'), slotRow('slot-3')),
    h('div', { class: 'sep' }),
    h(
      'div',
      { class: 'actions' },
      button('Load…', () => {
        close();
        app.showScreen(renderLoad(app));
      }),
      button('Export to file', () => app.exportSave()),
      button('Import file…', async () => {
        const text = await pickFile('.json,application/json');
        if (text && text !== '__too_big__') {
          close();
          app.loadText(text);
        }
      }),
      button('Settings', () => {
        close();
        app.showScreen(renderSettingsScreen(app));
      }),
    ),
    h('p', { class: 'small muted' }, `Saves are stored in this browser (${app.store.mode}); export to keep a copy elsewhere.`),
  ];
  const resume = button('Resume', () => close(), { cls: 'primary' });
  const quit = button('Save & quit to menu', () => {
    close();
    app.quitToMenu();
  });
  close = dialog(app, 'Menu', body, [quit, resume]);
}

export function renderEndScreen(app: App): HTMLElement {
  const sim = app.sim!;
  const st = sim.state;
  const r = st.result!;
  const pid = app.player;
  const title = r.playerOutcome === 'victory' ? 'Victory' : r.playerOutcome === 'defeat' ? 'Defeat' : r.playerOutcome === 'survived' ? 'The campaign is over' : 'Campaign complete';
  const scores = Object.entries(r.scores).sort((a, b) => b[1] - a[1]);
  const n = pid ? st.nations[pid] : null;
  const stats = n
    ? h(
        'div',
        { class: 'card', style: 'width:min(560px,100%);margin-top:12px' },
        h('h3', null, 'Your reign'),
        row('Provinces', `${ownedProvinces(sim, pid!).length} (peak ${n.stats.peakProvinces})`),
        row('Battles won / lost', `${n.stats.battlesWon} / ${n.stats.battlesLost}`),
        row('Men lost', fmt(n.stats.menLost)),
        row('Wars declared / peaces made', `${n.stats.warsDeclared} / ${n.stats.peacesMade}`),
        row('Technologies', `${n.research.done.length} of ${Object.keys(TECHS).length}`),
        row('Bankruptcies', String(n.stats.bankruptcies)),
      )
    : null;
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'title' }, title),
    h('p', { class: 'subtitle' }, r.reason, ` (${dateOf(sim, r.tick).label})`),
    h(
      'div',
      { class: 'card', style: 'width:min(560px,100%)' },
      h('h3', null, 'Final standings'),
      ...scores.map(([nid, s], i) => row(`${i + 1}. ${nationName(sim, nid)}${st.nations[nid].alive ? '' : ' ✝'}${nid === pid ? ' (you)' : ''}`, fmt(s, 1))),
    ),
    stats,
    h(
      'div',
      { class: 'row', style: 'margin-top:16px' },
      button('Continue playing', () => app.continueAfterEnd(), { title: 'Keep playing without further victory checks. The recorded result stands.' }),
      button('Export save', () => app.exportSave()),
      button('Main menu', () => app.quitToMenu(), { cls: 'primary' }),
    ),
  );
}
