// Short, skippable, contextual tutorial. Each step completes when the player
// actually does the thing; suggested actions are checked against the real
// rules for the current state before they are suggested.

import { activeProjects, buildProblem, PROJECT_LABELS } from '../sim/construction';
import { recruitProblem, unitCost } from '../sim/military';
import { armiesOf, ownedProvinces, provName } from '../sim/state';
import type { ProjectKind } from '../sim/types';
import type { App } from './app';
import { button, h, setChildren } from './dom';

interface Step {
  title: string;
  text: (app: App) => (string | Node)[];
  done?: (app: App) => boolean;
  show?: (app: App) => void;
}

function recruitText(c: ReturnType<typeof unitCost>): string {
  const parts = [`${c.crowns} crowns`];
  if (c.materiel) parts.push(`${c.materiel} materiel`);
  for (const [r, v] of Object.entries(c.resources)) if (v) parts.push(`${v} ${r}`);
  parts.push(`${c.manpower.toLocaleString('en-GB')} men from the manpower pool`);
  return parts.join(', ');
}

function suggestProject(app: App): { pid: string; kind: ProjectKind } | { reason: string } {
  const sim = app.sim!;
  const me = app.player!;
  const cap = sim.state.nations[me].capital!;
  const order = [cap, ...ownedProvinces(sim, me).filter((p) => p !== cap)];
  let reason = '';
  for (const pid of order) {
    for (const k of ['dev', 'infra', 'charter', 'fort'] as ProjectKind[]) {
      const prob = buildProblem(sim, me, pid, k);
      if (!prob) return { pid, kind: k };
      if (!reason) reason = prob;
    }
  }
  return { reason };
}

/** What the suggested project is for, in the tutorial's words. */
const PROJECT_WHY: Partial<Record<ProjectKind, string>> = {
  dev: 'Development raises income for good',
  infra: 'Railways speed armies and supplies and help new land integrate',
  charter: 'Charters integrate frontier land faster',
  fort: 'Forts slow invaders and shelter your armies',
};

const STEPS: Step[] = [
  {
    title: 'Welcome',
    text: (app) => {
      const d = app.sim!.world.nationDefs[app.player!];
      return [`You rule the ${d.name}. ${d.summary} The game is paused: nothing happens until you press ▶ or Space, so take your time.`];
    },
  },
  {
    title: 'Your capital',
    text: (app) => {
      const cap = app.sim!.state.nations[app.player!].capital!;
      return [`Click ${provName(app.sim!, cap)} (the gold star) to inspect it. The panel shows its output, integration, unrest and what you can build or recruit there.`];
    },
    done: (app) => app.selectedProvince === app.sim!.state.nations[app.player!].capital,
    show: (app) => app.centerOn(app.sim!.state.nations[app.player!].capital!),
  },
  {
    title: 'Invest in the realm',
    text: (app) => {
      const s = suggestProject(app);
      if ('reason' in s) return [`Projects use construction slots and crowns. Right now: ${s.reason} Skip this step for now.`];
      return [`Start a project: ${PROJECT_LABELS[s.kind]} in ${provName(app.sim!, s.pid)}. ${PROJECT_WHY[s.kind] ?? 'Projects pay off for years'}, but every crown spent here is not spent on soldiers.`];
    },
    done: (app) => activeProjects(app.sim!, app.player!).length > 0,
    show: (app) => {
      const s = suggestProject(app);
      if (!('reason' in s)) app.selectProvince(s.pid, true);
    },
  },
  {
    title: 'Industry and resources',
    text: () => ['Open Industry (I). Factories turn coal, iron, oil, rubber and nitrates into materiel for regiments, ships and aircraft, and a shortage slows them. The Resources overlay (Shift+8) shows where each deposit lies; hatched ones are deposits you are short of.'],
    done: (app) => app.ui.ledgerTab === 'industry' || app.mode === 'resources',
    show: (app) => app.openLedger('industry'),
  },
  {
    title: 'Raise a regiment',
    text: (app) => {
      const sim = app.sim!;
      const cap = sim.state.nations[app.player!].capital!;
      const prob = recruitProblem(sim, app.player!, cap, 'infantry');
      return prob
        ? [`Recruiting in ${provName(sim, cap)} is not possible right now: ${prob} You can skip this step.`]
        : [`In ${provName(sim, cap)}, press “Raise Infantry”: ${recruitText(unitCost(sim, app.player!, 'infantry'))}. Regiments cost upkeep every month, and replacing their losses later uses materiel from your factories.`];
    },
    done: (app) => app.sim!.world.provIds.some((p) => app.sim!.state.provinces[p].recruits.some((r) => r.nation === app.player)),
    show: (app) => app.selectProvince(app.sim!.state.nations[app.player!].capital!, true),
  },
  {
    title: 'Move an army',
    text: () => ['Click one of your army markers (the number is its regiments). Then right-click a province — or long-press on touch, or press “Set destination”. The route and arrival time are shown before you commit.'],
    done: (app) => armiesOf(app.sim!, app.player!).some((a) => a.path.length > 0),
    show: (app) => {
      const a = armiesOf(app.sim!, app.player!).sort((x, y) => y.regiments.length - x.regiments.length)[0];
      if (a) app.selectArmy(a.id, true);
    },
  },
  {
    title: 'Terrain and supply',
    text: () => ['Open the Supply overlay (bottom left). Armies are fed along a supply line from integrated or fortified provinces; beyond it they forage and suffer. Mountains, marshes and forests slow armies, help defenders and feed fewer troops.'],
    done: (app) => app.mode === 'supply',
    show: (app) => app.setMode('supply'),
  },
  {
    title: 'The frontier',
    text: () => ['Now open the Integration overlay. New land starts as raw frontier: little tax, no recruits, unrest. Roads, garrisons, charters and claims integrate it. Conquer faster than you can integrate and your realm overextends.'],
    done: (app) => app.mode === 'frontier',
    show: (app) => app.setMode('frontier'),
  },
  {
    title: 'Ships and aircraft',
    text: (app) => {
      const sim = app.sim!;
      const coastal = ownedProvinces(sim, app.player!).some((p) => sim.world.provZones[p]);
      return [
        coastal
          ? 'Open the Sea control overlay (Shift+9): each sea zone takes the colour of the realm with the strongest warships there. Fleets blockade enemy ports, guard your trade and carry armies across the water.'
          : 'Your realm has no coast, so its wars are fought on land. The Sea control overlay (Shift+9) still shows who commands each sea zone.',
        ' From the third era, air wings scout, bomb and defend. Military (M) lists armies, fleets and wings.',
      ];
    },
    done: (app) => app.mode === 'sea',
    show: (app) => app.setMode('sea'),
  },
  {
    title: 'Neighbours',
    text: () => ['Open Diplomacy (D). Every proposal shows whether the other realm would accept and why, before you send it. Envoys, trade, loans and guarantees build influence; enough of it draws a smaller realm into your sphere. Rapid conquest alarms neighbours into coalitions.'],
    done: (app) => app.ui.ledgerTab === 'diplomacy',
    show: (app) => app.openLedger('diplomacy'),
  },
  {
    title: 'A national focus',
    text: () => ['Open Focus (P) and start a focus. Each takes months, then grants a lasting effect and a reward. Your realm’s national branch holds its own claims and ambitions, and some focuses rule out others.'],
    done: (app) => !!app.sim!.state.nations[app.player!].focus.current,
    show: (app) => app.openLedger('focus'),
  },
  {
    title: 'How wars end',
    text: () => ['Open Wars (W). A war ends in a settlement: the side that is winning lists demands — provinces, crowns, reparations, disarmament, a sphere — paid for with war score and shared out by what each ally contributed. The other side accepts, or you see the counter-offer it would take.'],
    done: (app) => app.ui.ledgerTab === 'wars',
    show: (app) => app.openLedger('wars'),
  },
  {
    title: 'Three ways to win',
    text: () => ['Open Victory (V): territorial dominance, economic prosperity, or diplomatic leadership — each must be held for years while rivals respond.'],
    done: (app) => app.ui.ledgerTab === 'victory',
    show: (app) => app.openLedger('victory'),
  },
  {
    title: 'Let time run',
    text: () => ['Close the ledger and press ▶ or Space. Speed 2 is normal (one week per second); 3 and 4 are faster. The game pauses itself for wars, events and proposals (see Settings).'],
    done: (app) => app.speed > 0,
  },
  {
    title: 'You are ready',
    text: () => ['Choose research (T) that fits your plan. The Help ledger (H) explains every rule. Good luck.'],
  },
];

export class Tutorial {
  i = 0;
  active = true;
  constructor(private app: App) {}

  update(): void {
    if (!this.active || !this.app.sim || !this.app.player) {
      this.app.tutorialEl?.classList.add('hidden');
      return;
    }
    let step = STEPS[this.i];
    while (step && step.done && step.done(this.app)) {
      this.i++;
      step = STEPS[this.i];
    }
    if (!step) return this.finish();
    const el = this.app.tutorialEl;
    el.classList.remove('hidden');
    const next = button(step.done ? 'Skip step' : this.i === STEPS.length - 1 ? 'Finish' : 'Next', () => {
      this.i++;
      this.update();
    }, { cls: step.done ? 'small' : 'small primary' });
    const show = step.show ? button('Show me', () => step.show!(this.app), { cls: 'small' }) : null;
    const skip = button('End tutorial', () => this.finish(), { cls: 'small' });
    setChildren(el, h('h4', null, step.title), h('p', { class: 'small' }, ...step.text(this.app)), h('div', { class: 'row' }, h('span', { class: 'steps grow' }, `Step ${this.i + 1} of ${STEPS.length}`), show, skip, next));
  }

  finish(): void {
    this.active = false;
    this.app.tutorialEl.classList.add('hidden');
  }
}
