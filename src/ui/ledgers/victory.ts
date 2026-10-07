// Victory: three routes stated the same way so they can be compared. Each has
// its conditions as raw measures against thresholds (separate from the
// percentage progress), the timer with what next month will do to it and why,
// the player's nearest unmet condition, and compact standings. A rival close
// to winning gets a note on what would stop them.

import { C } from '../../sim/config';
import { aliveNations, dateOf, endTick, nationName, ownedProvinces } from '../../sim/state';
import type { NationId, VictoryPath } from '../../sim/types';
import { allScores, dominatedRegions, influenceByPartner, influenceNeeded, SCORE_FORMULA, timerOutlook, VICTORY_LABELS, VICTORY_MONTHS, victoryProgress, victoryRules, type PathProgress } from '../../sim/victory';
import type { App } from '../app';
import { bar, h } from '../dom';
import { shield } from '../panels/common';

const PATHS: VictoryPath[] = ['territorial', 'economic', 'diplomatic'];

function statement(app: App, k: VictoryPath): string {
  const sim = app.sim!;
  const r = victoryRules(sim);
  if (k === 'territorial') return `Dominate ${r.territorialRegions} regions and hold ${Math.round(r.territorialShare * 100)}% of all provinces, for ${VICTORY_MONTHS.territorial} months in a row.`;
  if (k === 'economic') return `Own ${Math.round(r.economicShare * 100)}% of the world’s integrated development, with low unrest, no debt and no land occupied, for ${VICTORY_MONTHS.economic} months in a row.`;
  return `Gather influence over partners who think well of us, keep trust high and wage no offensive war, for ${VICTORY_MONTHS.diplomatic} months in a row.`;
}

/** The rule behind a route's main measure, for the expandable explanation. */
function rules(app: App, k: VictoryPath): string {
  const sim = app.sim!;
  const r = victoryRules(sim);
  if (k === 'territorial') return `A region is dominated when we own and control at least 75% of its provinces. Provinces held means owned and controlled; occupied land does not count.`;
  if (k === 'economic') return `Integrated development counts the development of provinces at integration 75 or more. Average unrest is weighted by development and must stay at or below ${C.victory.economicUnrest}.`;
  return `Each partner whose opinion of us is at least ${C.victory.diplomaticOpinion} gives influence: an alliance at least ${C.victory.diplomaticTreatyAge / 12} years old, or a realm in our sphere, 2; our guarantee a year old, 1; and a trade agreement at least ${C.victory.diplomaticTreatyAge / 12} years old, 1 more. We need ${r.diplomaticInfluencePerRealm} per other surviving realm, and trust of ${C.victory.diplomaticTrust}.`;
}

function counterplay(app: App, k: VictoryPath, progress: Map<NationId, ReturnType<typeof victoryProgress>>): HTMLElement | null {
  const sim = app.sim!;
  const rival = [...progress.entries()]
    .filter(([n]) => n !== app.player)
    .map(([n, vp]) => ({ n, p: vp[k] }))
    .filter((x) => x.p.met && x.p.streak > 0)
    .sort((a, b) => b.p.streak - a.p.streak)[0];
  if (!rival) return null;
  const name = nationName(sim, rival.n);
  let text: string;
  if (k === 'territorial') {
    const regions = dominatedRegions(sim, rival.n).map((r) => sim.world.scenario.regions.find((x) => x.id === r)?.name ?? r);
    text = `${name} dominates ${regions.join(', ')}. Occupying or taking land there, or cutting their share of all provinces, breaks the condition.`;
  } else if (k === 'economic') {
    text = `Occupying any one province of ${name} in a war, driving their unrest above ${C.victory.economicUnrest}, or pushing them into debt breaks the condition.`;
  } else {
    const parts = Object.entries(influenceByPartner(sim, rival.n)).map(([n, v]) => `${nationName(sim, n)} ${v}`);
    text = `${name}'s influence comes from ${parts.join(', ')} (needs ${influenceNeeded(sim, rival.n)}). Turning a partner's opinion of them below ${C.victory.diplomaticOpinion} breaks it; so would an offensive war of theirs.`;
  }
  return h(
    'div',
    { class: 'callout warn small', 'data-sk': `rival-${k}` },
    h('div', null, h('b', null, `${name} has held this for ${rival.p.streak} of ${rival.p.required} months. `), text, ` A month in which the condition fails pauses their timer; each further month in a row costs them ${C.victory.streakDecay} months.`),
  );
}

/** The player's nearest unmet condition on a route, in words. */
function nextConstraint(p: PathProgress): string | null {
  const miss = p.conditions.filter((c) => !c.ok);
  if (!miss.length) return null;
  const c = miss[0];
  return `${c.label}: ${c.have} now, ${c.need} needed.`;
}

export function victoryLedger(app: App): HTMLElement {
  const sim = app.sim!;
  const me = app.player;
  const alive = aliveNations(sim);
  const progress = new Map(alive.map((n) => [n, victoryProgress(sim, n)]));
  const mine = me ? progress.get(me) ?? null : null;
  const end = dateOf(sim, endTick(sim));
  const yearsLeft = Math.max(0, end.year - dateOf(sim).year);
  const routes = PATHS.map((k) => {
    const p = mine?.[k] ?? null;
    const out = me && p ? timerOutlook(sim, me, k, p) : null;
    const standings = alive
      .map((n) => ({ n, p: progress.get(n)![k] }))
      .sort((a, b) => b.p.streak - a.p.streak || b.p.progress - a.p.progress || (a.n < b.n ? -1 : 1));
    const top = standings.slice(0, 4);
    if (me && !top.some((x) => x.n === me)) {
      const mineRow = standings.find((x) => x.n === me);
      if (mineRow) top.push(mineRow);
    }
    const nxt = p ? nextConstraint(p) : null;
    return h(
      'section',
      { class: 'route', 'data-sk': `route-${k}` },
      h('header', { class: 'route-head' }, h('h3', null, VICTORY_LABELS[k]), h('p', null, statement(app, k))),
      h(
        'div',
        { class: 'route-body' },
        h(
          'div',
          null,
          p
            ? h(
                'table',
                { class: 'register conditions' },
                h('thead', null, h('tr', null, h('th', null, 'Condition'), h('th', { class: 'r' }, 'Now'), h('th', { class: 'r' }, 'Needed'), h('th', { class: 'r' }, ''))),
                h(
                  'tbody',
                  null,
                  p.conditions.map((c) => h('tr', { class: c.ok ? 'ok' : 'miss' }, h('td', null, c.label), h('td', { class: 'r' }, c.have), h('td', { class: 'r' }, c.need), h('td', { class: `r ${c.ok ? 'good' : 'bad'}` }, c.ok ? 'met' : 'not met'))),
                ),
              )
            : null,
          p && out
            ? h(
                'div',
                { class: `timer ${out.trend}` },
                h('div', { class: 'timer-row' }, h('span', { class: 'k' }, 'Timer'), h('b', null, `${p.streak} of ${p.required} months`), h('span', { class: 'small muted' }, `condition ${Math.round(p.progress * 100)}% of the way`)),
                bar(p.streak, p.required, p.met ? 'good' : out.trend === 'falling' ? 'bad' : 'warn', `${VICTORY_LABELS[k]} timer`),
                h('p', { class: 'small' }, out.text),
              )
            : null,
          nxt ? h('p', { class: 'small next' }, h('b', null, 'Our next constraint: '), nxt) : null,
          h('details', { class: 'small' }, h('summary', null, 'How this is measured'), h('p', { class: 'muted' }, rules(app, k))),
        ),
        h(
          'div',
          { class: 'standings' },
          h('div', { class: 'eyebrow' }, 'Standings'),
          h(
            'table',
            { class: 'register' },
            h('thead', null, h('tr', null, h('th', null, 'Realm'), h('th', { class: 'r' }, 'Condition'), h('th', { class: 'r' }, 'Held'))),
            h(
              'tbody',
              null,
              top.map(({ n, p: q }) => h('tr', { class: n === me ? 'me' : '' }, h('td', null, shield(app, n), ' ', nationName(sim, n)), h('td', { class: 'r' }, `${Math.round(q.progress * 100)}%`), h('td', { class: 'r' }, q.streak ? `${q.streak} mo` : '—'))),
            ),
          ),
        ),
      ),
      counterplay(app, k, progress),
    );
  });
  const scores = allScores(sim);
  return h(
    'div',
    { class: 'victory-ledger' },
    h(
      'div',
      { class: 'strip' },
      h('div', null, h('span', { class: 'k' }, 'Campaign ends'), h('b', null, end.short)),
      h('div', null, h('span', { class: 'k' }, 'Time left'), h('b', null, `${yearsLeft} year${yearsLeft === 1 ? '' : 's'}`)),
      h('div', null, h('span', { class: 'k' }, 'Our score'), h('b', null, me ? scores[me].toFixed(1) : '—')),
      h('div', null, h('span', { class: 'k' }, 'Score rank'), h('b', null, me ? `${alive.slice().sort((a, b) => scores[b] - scores[a]).indexOf(me) + 1} of ${alive.length}` : '—')),
    ),
    h('p', { class: 'small muted' }, `Every realm, AI or not, can win by any route. A timer runs only while all of a route's conditions hold. The first month one fails, it pauses; each further month in a row it loses ${C.victory.streakDecay} months, unless the realm is within ${Math.round((1 - C.victory.nearMiss) * 100)}% of the main measure with every other condition met, when it stays paused.`),
    routes,
    h(
      'section',
      { class: 'section' },
      h('div', { class: 'eyebrow' }, 'Campaign score'),
      h('p', { class: 'small muted' }, `${SCORE_FORMULA} It breaks simultaneous wins and decides the result if no route is completed by ${end.short}.`),
      h(
        'table',
        { class: 'register' },
        h('thead', null, h('tr', null, h('th', null, 'Realm'), h('th', { class: 'r' }, 'Provinces'), h('th', { class: 'r' }, 'Score'))),
        h(
          'tbody',
          null,
          sim.world.nationIds
            .slice()
            .sort((a, b) => scores[b] - scores[a])
            .map((n) => h('tr', { class: n === me ? 'me' : '' }, h('td', null, shield(app, n), ' ', nationName(sim, n), sim.state.nations[n].alive ? '' : ' (fallen)'), h('td', { class: 'r' }, String(ownedProvinces(sim, n).length)), h('td', { class: 'r' }, scores[n].toFixed(1)))),
        ),
      ),
    ),
  );
}
