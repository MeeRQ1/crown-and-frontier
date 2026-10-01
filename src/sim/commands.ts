// The single validation and execution boundary for player AND AI actions.
// checkCommand() never mutates state; applyCommand() validates first and
// leaves state untouched when it fails (returning a player-readable reason).

import { buildWingProblem, cancelWing, inRange, missionProblem, MISSION_LABELS, rebaseProblem, startWing } from './air';
import { C, SHIPS, WINGS } from './config';
import { nextMemoEpoch } from './index';
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
import { enterProblem, findPath, stationProblem } from './movement';
import {
  buildShipProblem,
  cancelShip,
  disbandFleetProblem,
  fleetOrderProblem,
  mergeFleets,
  mergeFleetsProblem,
  moveFleet,
  moveFleetProblem,
  removeFleet,
  shipArmies,
  shipArmiesProblem,
  splitFleet,
  splitFleetProblem,
  startShip,
} from './naval';
import { policyProblem, researchProblem, setPolicy } from './progression';
import { serialize } from './save';
import { nationName, notify, type Sim } from './state';
import type { Command, CommandResult } from './types';
import { answerCallToArms, applyPeace, declareWar, declareWarProblem, evaluatePeace, goalOptions, peaceProblem } from './war';

function atSeaProblem(sim: Sim, fleet: string): string {
  return `The army is at sea aboard ${sim.state.fleets[fleet]?.name ?? 'a fleet'}; it takes orders again once it lands.`;
}

export function checkCommand(sim: Sim, cmd: Command): string | null {
  const st = sim.state;
  if (cmd.type === 'continueCampaign') return st.result && !st.continueAfterResult ? null : 'The campaign has not ended.';
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
      if (a.embarked) return atSeaProblem(sim, a.embarked);
      if (!st.provinces[cmd.dest]) return 'Unknown province.';
      if (a.battle) return 'The army is engaged in battle and cannot manoeuvre.';
      if (a.retreating) return 'The army is retreating and cannot take orders until it arrives.';
      const from = cmd.append && a.path.length ? a.path[a.path.length - 1] : a.location;
      if (cmd.dest === from) return null;
      const ep = enterProblem(sim, cmd.nation, cmd.dest);
      if (ep) return ep;
      if (!findPath(sim, cmd.nation, from, cmd.dest)) return 'No legal route: the way is blocked by realms that deny us access.';
      return null;
    }
    case 'setGroup': {
      const a = st.armies[cmd.army];
      if (!a || a.nation !== cmd.nation) return 'Not your army.';
      if (cmd.group !== null && (!Number.isInteger(cmd.group) || cmd.group < 1 || cmd.group > 9)) return 'Army groups are numbered 1 to 9.';
      return null;
    }
    case 'setOrder': {
      const a = st.armies[cmd.army];
      if (!a || a.nation !== cmd.nation) return 'Not your army.';
      if (!cmd.order) return null;
      if (a.embarked) return atSeaProblem(sim, a.embarked);
      if (cmd.order.kind !== 'station') return 'Unknown order.';
      const sp = stationProblem(sim, cmd.nation, cmd.order.province);
      if (sp) return sp;
      if (a.location !== cmd.order.province && !findPath(sim, cmd.nation, a.location, cmd.order.province)) return 'No legal route to that province.';
      return null;
    }
    case 'stop': {
      const a = st.armies[cmd.army];
      if (!a || a.nation !== cmd.nation) return 'Not your army.';
      if (a.retreating) return 'A retreat cannot be halted.';
      return null;
    }
    case 'split':
      if (st.armies[cmd.army]?.embarked) return atSeaProblem(sim, st.armies[cmd.army].embarked!);
      return splitProblem(sim, cmd.nation, cmd.army, cmd.counts);
    case 'merge': {
      const sea = cmd.armies.map((id) => st.armies[id]?.embarked).find((x) => x);
      if (sea) return atSeaProblem(sim, sea);
      return mergeProblem(sim, cmd.nation, cmd.armies);
    }
    case 'disband':
      if (st.armies[cmd.army]?.embarked) return atSeaProblem(sim, st.armies[cmd.army].embarked!);
      return disbandProblem(sim, cmd.nation, cmd.army);
    case 'buildShip':
      return buildShipProblem(sim, cmd.nation, cmd.province, cmd.ship);
    case 'cancelShip':
      return st.provinces[cmd.province]?.dock.some((o) => o.nation === cmd.nation) ? null : 'No ships of ours on the slipways here.';
    case 'moveFleet':
      return moveFleetProblem(sim, cmd.nation, cmd.fleet, cmd.zone);
    case 'stopFleet':
      return fleetOrderProblem(sim, cmd.nation, cmd.fleet);
    case 'mergeFleets':
      return mergeFleetsProblem(sim, cmd.nation, cmd.fleets);
    case 'splitFleet':
      return splitFleetProblem(sim, cmd.nation, cmd.fleet, cmd.ships);
    case 'disbandFleet':
      return disbandFleetProblem(sim, cmd.nation, cmd.fleet);
    case 'shipArmies':
      return shipArmiesProblem(sim, cmd.nation, cmd.armies, cmd.fleet, cmd.dest);
    case 'buildWing':
      return buildWingProblem(sim, cmd.nation, cmd.province, cmd.wing);
    case 'cancelWing':
      return st.provinces[cmd.province]?.hangar.some((o) => o.nation === cmd.nation) ? null : 'No air wings of ours in training here.';
    case 'airMission':
      if (!(cmd.mission in MISSION_LABELS)) return 'Unknown mission.';
      return missionProblem(sim, cmd.nation, cmd.wing, cmd.mission, cmd.target);
    case 'rebaseWing':
      return rebaseProblem(sim, cmd.nation, cmd.wing, cmd.base);
    case 'disbandWing': {
      const w = st.wings[cmd.wing];
      return w && w.nation === cmd.nation ? null : 'Not our air wing.';
    }
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
  const player = cmd.type === 'continueCampaign' || sim.state.nations[cmd.nation].isPlayer;
  const r = execute(sim, cmd);
  // derived values shown to the player (air cover, sea control…) are recomputed after
  // each player order; replays apply the same commands, so they see the same thing
  if (player && r.ok) nextMemoEpoch();
  return r;
}

function execute(sim: Sim, cmd: Command): CommandResult {
  const st = sim.state;
  if (cmd.type === 'continueCampaign' || st.nations[cmd.nation].isPlayer) logCommand(sim, cmd);
  switch (cmd.type) {
    case 'continueCampaign':
      st.continueAfterResult = true;
      return { ok: true };
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
      // a new march replaces a standing station order
      if (a.order && cmd.dest !== a.order.province) a.order = null;
      if (cmd.append && a.path.length) {
        const end = a.path[a.path.length - 1];
        if (cmd.dest !== end) a.path = [...a.path, ...findPath(sim, cmd.nation, end, cmd.dest)!.path];
        return { ok: true };
      }
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
    case 'setGroup': {
      const a = st.armies[cmd.army];
      a.group = cmd.group;
      return { ok: true, message: cmd.group ? `${a.name} joins group ${cmd.group}.` : `${a.name} leaves its group.` };
    }
    case 'setOrder': {
      const a = st.armies[cmd.army];
      a.order = cmd.order;
      if (cmd.order && a.location !== cmd.order.province && !a.battle && !a.retreating) {
        a.path = findPath(sim, cmd.nation, a.location, cmd.order.province)!.path;
        a.progress = 0;
      }
      return { ok: true, message: cmd.order ? `${a.name} is stationed at ${sim.world.prov[cmd.order.province].name}.` : `${a.name} has no standing order.` };
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
    case 'buildShip':
      startShip(sim, cmd.nation, cmd.province, cmd.ship);
      return { ok: true, message: `${SHIPS[cmd.ship].label} laid down.` };
    case 'cancelShip':
      cancelShip(sim, cmd.nation, cmd.province);
      return { ok: true, message: 'Ship cancelled; materiel and resources returned (crowns are lost).' };
    case 'moveFleet':
      moveFleet(sim, cmd.fleet, cmd.zone);
      return { ok: true };
    case 'stopFleet': {
      const f = st.fleets[cmd.fleet];
      f.path = [];
      f.progress = 0;
      return { ok: true };
    }
    case 'mergeFleets': {
      const f = mergeFleets(sim, cmd.fleets);
      return { ok: true, message: `Merged into ${f.name}.` };
    }
    case 'splitFleet': {
      const f = splitFleet(sim, cmd.fleet, cmd.ships);
      return { ok: true, message: `${f.name} formed.` };
    }
    case 'disbandFleet':
      removeFleet(sim, st.fleets[cmd.fleet], false);
      return { ok: true, message: 'Fleet paid off.' };
    case 'shipArmies':
      shipArmies(sim, cmd.nation, cmd.armies, cmd.fleet, cmd.dest);
      return { ok: true, message: `Troops embarked for ${sim.world.prov[cmd.dest].name}.` };
    case 'buildWing':
      startWing(sim, cmd.nation, cmd.province, cmd.wing);
      return { ok: true, message: `${WINGS[cmd.wing].label} in training.` };
    case 'cancelWing':
      cancelWing(sim, cmd.nation, cmd.province);
      return { ok: true, message: 'Training cancelled; materiel and resources returned (crowns are lost).' };
    case 'airMission': {
      const w = st.wings[cmd.wing];
      w.mission = cmd.mission;
      w.target = cmd.mission === 'idle' ? null : cmd.target;
      return { ok: true };
    }
    case 'rebaseWing': {
      const w = st.wings[cmd.wing];
      w.base = cmd.base;
      if (w.target && !inRange(sim, w, w.target)) {
        w.mission = 'idle';
        w.target = null;
      }
      return { ok: true };
    }
    case 'disbandWing':
      delete st.wings[cmd.wing];
      return { ok: true, message: 'Air wing disbanded.' };
    case 'cancelBuild':
      cancelProject(sim, cmd.province);
      return { ok: true, message: 'Project cancelled; half the cost refunded.' };
    case 'research':
      st.nations[cmd.nation].research.current = cmd.tech;
      return { ok: true };
    case 'funding':
      st.nations[cmd.nation].research.funding = cmd.level;
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

/**
 * Player commands are logged so a bug report can replay the campaign. A full log
 * rolls over: the state before this command becomes the replay checkpoint (it
 * already contains every earlier command's effect) and the log starts afresh.
 */
function logCommand(sim: Sim, cmd: Command): void {
  const st = sim.state;
  if (st.playerLog.length >= C.playerLogMax) {
    sim.origin = { save: serialize(sim), tick: st.tick, logLength: 0 };
    st.playerLog = [];
  }
  st.playerLog.push({ tick: st.tick, cmd: JSON.parse(JSON.stringify(cmd)) });
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
