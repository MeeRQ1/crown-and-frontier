// The single validation and execution boundary for player AND AI actions.
// checkCommand() never mutates state; applyCommand() validates first and
// leaves state untouched when it fails (returning a player-readable reason).

import { buildProblem, cancelProblem, cancelProject, startProject } from './construction';
import {
  cancelTreaty,
  cancelTreatyProblem,
  envoyProblem,
  evaluateTreaty,
  fabricateProblem,
  joinCoalition,
  joinCoalitionProblem,
  leaveCoalition,
  addMemory,
  addProposal,
  proposeTreaty,
  recallEnvoy,
  signTreaty,
  startEnvoy,
  startFabrication,
  treatyProblem,
  coalitionAgainst,
} from './diplomacy';
import { choiceProblem, resolveEvent } from './events';
import { cancelRecruits, disbandProblem, doDisband, doMerge, doSplit, mergeProblem, orderRecruit, recruitProblem, splitProblem } from './military';
import { enterProblem, findPath } from './movement';
import { policyProblem, researchProblem, setPolicy } from './progression';
import { nationName, notify, type Sim } from './state';
import type { Command, CommandResult } from './types';
import { answerCallToArms, applyPeace, declareWar, declareWarProblem, evaluatePeace, goalOptions, peaceProblem } from './war';

export function checkCommand(sim: Sim, cmd: Command): string | null {
  const st = sim.state;
  const n = st.nations[cmd.nation];
  if (!n) return 'Unknown realm.';
  if (!n.alive) return 'Your realm has fallen.';
  switch (cmd.type) {
    case 'recruit':
      if (cmd.count !== undefined && (!Number.isInteger(cmd.count) || cmd.count < 1 || cmd.count > 10)) return 'Recruit between 1 and 10 regiments at a time.';
      return recruitProblem(sim, cmd.nation, cmd.province, cmd.unit);
    case 'cancelRecruit': {
      const p = st.provinces[cmd.province];
      if (!p || !p.recruits.some((r) => r.nation === cmd.nation)) return 'No recruits in training here.';
      return null;
    }
    case 'move': {
      const a = st.armies[cmd.army];
      if (!a || a.nation !== cmd.nation) return 'Not your army.';
      if (!st.provinces[cmd.dest]) return 'Unknown province.';
      if (a.battle) return 'The army is engaged in battle and cannot manoeuvre.';
      if (a.retreating) return 'The army is retreating and cannot take orders until it arrives.';
      if (cmd.dest === a.location) return null;
      const ep = enterProblem(sim, cmd.nation, cmd.dest);
      if (ep) return ep;
      if (!findPath(sim, cmd.nation, a.location, cmd.dest)) return 'No legal route: the way is blocked by realms that deny us access.';
      return null;
    }
    case 'stop': {
      const a = st.armies[cmd.army];
      if (!a || a.nation !== cmd.nation) return 'Not your army.';
      if (a.retreating) return 'A retreat cannot be halted.';
      return null;
    }
    case 'split':
      return splitProblem(sim, cmd.nation, cmd.army, cmd.counts);
    case 'merge':
      return mergeProblem(sim, cmd.nation, cmd.armies);
    case 'disband':
      return disbandProblem(sim, cmd.nation, cmd.army);
    case 'build':
      return buildProblem(sim, cmd.nation, cmd.province, cmd.project);
    case 'cancelBuild':
      return cancelProblem(sim, cmd.nation, cmd.province);
    case 'research':
      return researchProblem(sim, cmd.nation, cmd.tech);
    case 'funding':
      return [0, 1, 2, 3].includes(cmd.level) ? null : 'Invalid funding level.';
    case 'policy':
      return policyProblem(sim, cmd.nation, cmd.policy);
    case 'envoy':
      return envoyProblem(sim, cmd.nation, cmd.target);
    case 'recallEnvoy':
      return st.envoys.some((e) => e.from === cmd.nation && e.to === cmd.target) ? null : 'No envoy there.';
    case 'propose':
      return treatyProblem(sim, cmd.nation, cmd.target, cmd.treaty);
    case 'cancelTreaty':
      return cancelTreatyProblem(sim, cmd.nation, cmd.target, cmd.treaty);
    case 'fabricate':
      return fabricateProblem(sim, cmd.nation, cmd.province);
    case 'declareWar':
      return declareWarProblem(sim, cmd.nation, cmd.target, cmd.goal);
    case 'peace':
      return peaceProblem(sim, cmd.nation, cmd.war, cmd.with, cmd.terms);
    case 'respond': {
      const p = st.proposals.find((x) => x.id === cmd.proposal);
      if (!p || p.to !== cmd.nation) return 'That proposal is no longer open.';
      return null;
    }
    case 'eventChoice': {
      const pe = n.pendingEvents.find((e) => e.id === cmd.instance);
      if (!pe) return 'That event has already been resolved.';
      return choiceProblem(sim, cmd.nation, pe, cmd.choice);
    }
    case 'joinCoalition':
      return joinCoalitionProblem(sim, cmd.nation, cmd.target);
    case 'leaveCoalition':
      return coalitionAgainst(sim, cmd.target)?.members.includes(cmd.nation) ? null : 'Not a member of that coalition.';
    case 'coalitionWar': {
      const c = coalitionAgainst(sim, cmd.target);
      if (!c?.members.includes(cmd.nation)) return 'Only coalition members may call a coalition war.';
      const goal = goalOptions(sim, cmd.nation, cmd.target).find((g) => g.type === 'coalition');
      if (!goal) return 'No coalition war goal is available.';
      return declareWarProblem(sim, cmd.nation, cmd.target, goal);
    }
    default:
      return 'Unknown command.';
  }
}

export function applyCommand(sim: Sim, cmd: Command): CommandResult {
  const problem = checkCommand(sim, cmd);
  if (problem) return { ok: false, reason: problem };
  const st = sim.state;
  const n = st.nations[cmd.nation];
  if (n.isPlayer) {
    st.playerLog.push({ tick: st.tick, cmd: JSON.parse(JSON.stringify(cmd)) });
    if (st.playerLog.length > 2000) st.playerLog.splice(0, st.playerLog.length - 2000);
  }
  switch (cmd.type) {
    case 'recruit': {
      const count = cmd.count ?? 1;
      let done = 0;
      for (let i = 0; i < count; i++) {
        if (i > 0 && recruitProblem(sim, cmd.nation, cmd.province, cmd.unit)) break;
        orderRecruit(sim, cmd.nation, cmd.province, cmd.unit);
        done++;
      }
      return { ok: true, message: `${done} regiment(s) in training.` };
    }
    case 'cancelRecruit':
      cancelRecruits(sim, cmd.province, cmd.nation);
      return { ok: true, message: 'Training cancelled; men and supplies returned (crowns are lost).' };
    case 'move': {
      const a = st.armies[cmd.army];
      if (cmd.dest === a.location) {
        a.path = [];
        a.progress = 0;
        return { ok: true };
      }
      const res = findPath(sim, cmd.nation, a.location, cmd.dest)!;
      if (a.path[0] !== res.path[0]) a.progress = 0;
      a.path = res.path;
      return { ok: true };
    }
    case 'stop': {
      const a = st.armies[cmd.army];
      a.path = [];
      a.progress = 0;
      return { ok: true };
    }
    case 'split': {
      const b = doSplit(sim, cmd.army, cmd.counts);
      return { ok: true, message: `${b.name} formed.` };
    }
    case 'merge': {
      const a = doMerge(sim, cmd.armies);
      return { ok: true, message: `Merged into ${a.name}.` };
    }
    case 'disband': {
      const back = doDisband(sim, cmd.army);
      return { ok: true, message: `Army disbanded; ${Math.round(back).toLocaleString()} men returned to the manpower pool.` };
    }
    case 'build':
      startProject(sim, cmd.nation, cmd.province, cmd.project);
      return { ok: true };
    case 'cancelBuild':
      cancelProject(sim, cmd.province);
      return { ok: true, message: 'Project cancelled; half the cost refunded.' };
    case 'research':
      n.research.current = cmd.tech;
      return { ok: true };
    case 'funding':
      n.research.funding = cmd.level;
      return { ok: true };
    case 'policy':
      setPolicy(sim, cmd.nation, cmd.policy);
      return { ok: true };
    case 'envoy':
      startEnvoy(sim, cmd.nation, cmd.target);
      return { ok: true };
    case 'recallEnvoy':
      recallEnvoy(sim, cmd.nation, cmd.target);
      return { ok: true };
    case 'propose':
      return proposeTreaty(sim, cmd.nation, cmd.target, cmd.treaty);
    case 'cancelTreaty':
      cancelTreaty(sim, cmd.nation, cmd.target, cmd.treaty);
      return { ok: true };
    case 'fabricate':
      startFabrication(sim, cmd.nation, cmd.province);
      return { ok: true, message: 'Our clerks begin forging a claim (12 months).' };
    case 'declareWar': {
      const w = declareWar(sim, cmd.nation, cmd.target, cmd.goal);
      return { ok: true, message: `${w.name} begins.` };
    }
    case 'peace': {
      const other = st.nations[cmd.with];
      if (other.isPlayer) {
        addProposal(sim, { kind: 'peace', from: cmd.nation, to: cmd.with, war: cmd.war, terms: cmd.terms });
        notify(sim, cmd.with, 'urgent', 'proposal', `${nationName(sim, cmd.nation)} offers peace terms.`);
        return { ok: true, message: 'Offer sent.' };
      }
      const ev = evaluatePeace(sim, cmd.war, cmd.nation, cmd.with, cmd.terms);
      if (!ev.accept) {
        const top = [...ev.reasons].sort((x, y) => x.value - y.value).slice(0, 3).map((r) => `${r.label} (${r.value > 0 ? '+' : ''}${r.value})`);
        return { ok: false, reason: `${nationName(sim, cmd.with)} refuses (score ${Math.round(ev.score)}): ${top.join('; ')}.` };
      }
      applyPeace(sim, cmd.war, cmd.nation, cmd.with, cmd.terms);
      return { ok: true, message: `${nationName(sim, cmd.with)} accepts the peace.` };
    }
    case 'respond': {
      const p = st.proposals.find((x) => x.id === cmd.proposal)!;
      st.proposals = st.proposals.filter((x) => x.id !== p.id);
      if (p.kind === 'callToArms') {
        answerCallToArms(sim, cmd.nation, p.war!, p.from, cmd.accept);
        return { ok: true };
      }
      if (!cmd.accept) {
        addMemory(sim, p.from, cmd.nation, 'rebuffed', -5, 1);
        return { ok: true, message: 'Proposal declined.' };
      }
      if (p.kind === 'peace') {
        const prob = peaceProblem(sim, p.from, p.war!, cmd.nation, p.terms!);
        if (prob) return { ok: false, reason: `The offer is no longer valid: ${prob}` };
        applyPeace(sim, p.war!, p.from, cmd.nation, p.terms!);
        return { ok: true, message: 'Peace concluded.' };
      }
      const prob = treatyProblem(sim, p.from, cmd.nation, p.kind);
      if (prob) return { ok: false, reason: `The offer is no longer valid: ${prob}` };
      signTreaty(sim, p.kind, p.from, cmd.nation);
      notify(sim, p.from, 'normal', 'treaty', `${nationName(sim, cmd.nation)} accepted our proposal.`);
      return { ok: true, message: 'Treaty signed.' };
    }
    case 'eventChoice':
      resolveEvent(sim, cmd.nation, cmd.instance, cmd.choice);
      return { ok: true };
    case 'joinCoalition':
      joinCoalition(sim, cmd.nation, cmd.target);
      return { ok: true };
    case 'leaveCoalition':
      leaveCoalition(sim, cmd.nation, cmd.target);
      return { ok: true };
    case 'coalitionWar': {
      const goal = goalOptions(sim, cmd.nation, cmd.target).find((g) => g.type === 'coalition')!;
      const w = declareWar(sim, cmd.nation, cmd.target, goal);
      return { ok: true, message: `${w.name} begins.` };
    }
  }
}

/** Proposal expiry: unanswered calls to arms are honoured, everything else lapses. */
export function weeklyProposals(sim: Sim): void {
  const st = sim.state;
  const expired = st.proposals.filter((p) => p.expires <= st.tick);
  if (!expired.length) return;
  st.proposals = st.proposals.filter((p) => p.expires > st.tick);
  for (const p of expired) {
    if (p.kind === 'callToArms') answerCallToArms(sim, p.to, p.war!, p.from, true);
    else notify(sim, p.from, 'low', 'proposal', `${nationName(sim, p.to)} did not answer our proposal.`);
  }
}

export { evaluateTreaty };
