// Authoritative simulation types. Everything under GameState is plain JSON
// (serialisable for saves). Static scenario data lives in World and is rebuilt
// from the scenario id on load.

export type NationId = string;
export type ProvinceId = string;
export type ArmyId = string;
export type WarId = string;
export type TechId = string;
export type PolicyId = string;
export type EventId = string;

export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains' | 'marsh' | 'steppe';
export type Resource = 'grain' | 'iron' | 'horses' | 'goods' | null;
export type UnitType = 'foot' | 'horse' | 'guns';
export type ProjectKind = 'dev' | 'infra' | 'fort' | 'charter' | 'settle';
export type Personality = 'expansionist' | 'defensive' | 'commercial' | 'opportunist' | 'diplomat';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type VictoryPath = 'territorial' | 'economic' | 'diplomatic';
export type TreatyType = 'nap' | 'trade' | 'alliance';

// ───────────────────────────── Static scenario data ─────────────────────────

export interface NationTraits {
  incomeMul?: number;
  supplyProdMul?: number;
  manpowerMul?: number;
  researchMul?: number;
  tradeMul?: number;
  moraleAdd?: number;
  fortCostMul?: number;
  siegeMul?: number;
  devCostMul?: number;
  popGrowthMul?: number;
  gunsCostMul?: number;
  horseCostMul?: number;
  horseAttackAdd?: number;
  integrationMul?: number;
  envoyAdd?: number;
  opinionAdd?: number;
  /** added to the movement cost of a sea strait (Hrafnmark: -2) */
  straitCostAdd?: number;
}

export interface NationDef {
  id: NationId;
  name: string;
  short: string;
  adjective: string;
  color: string;
  capital: ProvinceId;
  personality: Personality;
  emblem: string;
  summary: string;
  strength: string;
  constraint: string;
  traits: NationTraits;
  /** kind of starting position, shown when choosing a realm */
  startType?: string;
  /** how forgiving the start is for a new player */
  rating?: 'recommended' | 'standard' | 'challenging';
  /** heraldry (presentation only): field, ordinary and charge */
  arms?: { field: string; ordinary: string; ordinaryTincture: string; charge: string; chargeTincture: string };
}

export interface ProvinceDef {
  id: ProvinceId;
  name: string;
  terrain: Terrain;
  resource: Resource;
  owner: NationId | null;
  dev: number;
  pop: number;
  region: string;
  infra: number;
  fort: number;
  integration: number;
  claims: NationId[];
  neighbors: ProvinceId[];
}

export interface RegionDef {
  id: string;
  name: string;
}

export interface EdgeDef {
  a: ProvinceId;
  b: ProvinceId;
  strait: boolean;
}

export interface ScenarioDef {
  id: string;
  name: string;
  description: string;
  startYear: number;
  nations: NationDef[];
  provinces: ProvinceDef[];
  regions: RegionDef[];
  straits: Array<[ProvinceId, ProvinceId]>;
  /** borders that are rivers: attacking across one gives the defender a bonus */
  rivers?: Array<[ProvinceId, ProvinceId]>;
  /** optional per-map victory thresholds (defaults in config) */
  victory?: Partial<{ territorialRegions: number; territorialShare: number; economicShare: number; diplomaticInfluencePerRealm: number; diplomaticMinInfluence: number }>;
  /** short blurb for the campaign picker */
  blurb?: string;
  /** technology costs are multiplied by this (default 1) */
  researchCostMul?: number;
}

/** Static world derived from a scenario: lookups and graph structure. */
export interface World {
  scenario: ScenarioDef;
  prov: Record<ProvinceId, ProvinceDef>;
  provIds: ProvinceId[];
  nationDefs: Record<NationId, NationDef>;
  nationIds: NationId[];
  regionProvinces: Record<string, ProvinceId[]>;
  /** key `${a}|${b}` with a<b → strait crossing */
  straitSet: Set<string>;
  /** key `${a}|${b}` with a<b → river border */
  riverSet: Set<string>;
  /**
   * Hop distance between two provinces over borders and straits (undefined if
   * one cannot reach the other), for AI and proximity heuristics. Backed by a
   * compact all-pairs matrix built once per map.
   */
  hop(a: ProvinceId, b: ProvinceId): number | undefined;
}

// ───────────────────────────── Dynamic state ────────────────────────────────

export interface Project {
  kind: ProjectKind;
  progress: number; // weeks completed
  total: number; // weeks required
  cost: number; // crowns paid (refund basis on cancel)
  nation: NationId; // who ordered it (settle projects target unowned land)
}

export interface Siege {
  nation: NationId;
  progress: number; // 0..100
}

export interface ProvinceState {
  id: ProvinceId;
  owner: NationId | null;
  controller: NationId | null;
  pop: number; // thousands
  dev: number;
  infra: number;
  fort: number;
  integration: number; // 0..100
  unrest: number; // 0..100
  project: Project | null;
  siege: Siege | null;
  claims: NationId[];
  revoltUntil: number; // tick until which the province is in revolt (0 = none)
  lastOwnerChange: number;
  recruits: RecruitOrder[];
}

export interface RecruitOrder {
  nation: NationId;
  unit: UnitType;
  weeksLeft: number;
}

export interface Regiment {
  id: string;
  type: UnitType;
  men: number; // 0..1000
}

export interface Army {
  id: ArmyId;
  nation: NationId;
  name: string;
  location: ProvinceId;
  regiments: Regiment[];
  morale: number;
  /** remaining path, path[0] is the next province */
  path: ProvinceId[];
  /** progress towards path[0] in movement points */
  progress: number;
  /** weeks stationary (for entrenchment) */
  stationary: number;
  retreating: boolean;
  battle: string | null;
  /** last computed supply level 0..1 (derived each tick) */
  supply: number;
  /** AI assignment tag (operational layer) */
  task: string | null;
  /** the province the army last stepped out of, and when (river crossings) */
  lastMove?: { from: ProvinceId; tick: number };
  /** player's army group (1–9), for grouped orders and quick selection */
  group?: number | null;
  /** standing order kept between marches */
  order?: ArmyOrder | null;
}

/** Station: return to (and hold) this province whenever the army has nothing else to do. */
export interface ArmyOrder {
  kind: 'station';
  province: ProvinceId;
}

export interface BattleRound {
  round: number;
  attLoss: number;
  defLoss: number;
  attMorale: number;
  defMorale: number;
}

export interface Battle {
  id: string;
  province: ProvinceId;
  startTick: number;
  attackers: ArmyId[];
  defenders: ArmyId[];
  attackerNations: NationId[];
  defenderNations: NationId[];
  rounds: BattleRound[];
  attStartMen: number;
  defStartMen: number;
  attLosses: number;
  defLosses: number;
  /** summary of main modifiers for the report */
  factors: string[];
  /** every attacker opened the battle by crossing a river into the province */
  river?: boolean;
}

export interface BattleReport {
  id: string;
  tick: number;
  province: ProvinceId;
  attackerNations: NationId[];
  defenderNations: NationId[];
  attStartMen: number;
  defStartMen: number;
  attLosses: number;
  defLosses: number;
  winner: 'attacker' | 'defender';
  rounds: number;
  factors: string[];
  outcome: string;
}

export interface WarGoal {
  type: 'claim' | 'conquest' | 'coalition';
  provinces: ProvinceId[];
}

export interface War {
  id: WarId;
  name: string;
  attackerLead: NationId;
  defenderLead: NationId;
  attackers: NationId[];
  defenders: NationId[];
  goal: WarGoal;
  startTick: number;
  battleScore: number; // attacker perspective, bounded
  goalScore: number; // attacker perspective, bounded
  score: number; // cached total −100..100 attacker perspective
  stalemateMonths: number;
  dominantMonths: number;
}

export interface Treaty {
  id: string;
  type: TreatyType;
  a: NationId;
  b: NationId;
  since: number;
  until: number | null; // null = indefinite
}

export interface Truce {
  a: NationId;
  b: NationId;
  until: number;
}

export interface Memory {
  kind: string;
  value: number; // current value (decays toward 0)
  decay: number; // per month absolute decay
}

export interface Envoy {
  from: NationId;
  to: NationId;
  until: number;
}

export interface ClaimFabrication {
  nation: NationId;
  province: ProvinceId;
  until: number;
}

export interface Coalition {
  id: string;
  target: NationId;
  members: NationId[];
  since: number;
}

export interface PeaceTerms {
  provinces: ProvinceId[]; // provinces ceded to the proposer's side (or by the proposer if conceding)
  gold: number; // reparations paid to the winner
  /** 'demand': proposer receives; 'concede': proposer gives */
  mode: 'demand' | 'concede' | 'white';
}

export type ProposalKind = 'nap' | 'trade' | 'alliance' | 'peace' | 'callToArms';

export interface Proposal {
  id: string;
  kind: ProposalKind;
  from: NationId;
  to: NationId;
  tick: number;
  expires: number;
  war?: WarId;
  terms?: PeaceTerms;
}

export interface Modifier {
  id: string;
  label: string;
  until: number; // tick
  effects: ModifierEffects;
}

export interface ModifierEffects {
  incomeMul?: number;
  supplyProdMul?: number;
  manpowerMul?: number;
  researchMul?: number;
  unrestAdd?: number;
  integrationMul?: number;
  moraleRecoveryMul?: number;
  upkeepMul?: number;
}

export interface PendingEvent {
  id: string; // instance id
  event: EventId;
  tick: number;
  province?: ProvinceId;
  other?: NationId;
  expires: number;
}

export interface AIGoal {
  kind: 'expand' | 'develop' | 'consolidate' | 'defend' | 'diplomacy';
  target: NationId | null;
  since: number;
  score: number;
  victory: VictoryPath;
}

export interface AIState {
  personality: Personality;
  goal: AIGoal;
  warPlan: { target: NationId; since: number; provinces: ProvinceId[] } | null;
  lastWarEnd: number;
  nextStrategic: number;
  nextOperational: number;
  lastPolicyEval: number;
  /** remembers per-front objective commitments: armyId -> objective province */
  objectives: Record<ArmyId, { target: ProvinceId; since: number; kind: string; value: number }>;
  /** desired regiment count set by the strategic layer */
  armyTarget: number;
  /** province where idle forces gather */
  rally: ProvinceId | null;
  lastPeaceTry: Record<string, number>;
  lastProposal: Record<string, number>;
}

export interface NationStats {
  battlesWon: number;
  battlesLost: number;
  menLost: number;
  enemyKilled: number;
  provincesGained: number;
  provincesLost: number;
  warsDeclared: number;
  peacesMade: number;
  bankruptcies: number;
  peakProvinces: number;
  idleArmyWeeks: number;
  armyWeeks: number;
}

export interface NationState {
  id: NationId;
  alive: boolean;
  eliminatedTick: number | null;
  isPlayer: boolean;
  capital: ProvinceId | null;
  treasury: number;
  supplies: number;
  manpower: number;
  research: {
    current: TechId | null;
    progress: number;
    done: TechId[];
    funding: 0 | 1 | 2 | 3;
  };
  policy: PolicyId;
  policySince: number;
  warExhaustion: number;
  trust: number; // 0..100 reputation for honouring agreements
  debtMonths: number;
  bankruptUntil: number;
  modifiers: Modifier[];
  eventCooldowns: Record<EventId, number>;
  nextEventTick: number;
  pendingEvents: PendingEvent[];
  victoryStreak: Record<VictoryPath, number>;
  lastMonth: MonthlyLedger;
  ai: AIState;
  stats: NationStats;
  armyCounter: number;
}

export interface MonthlyLedger {
  tick: number;
  income: Record<string, number>;
  expenses: Record<string, number>;
  suppliesIn: Record<string, number>;
  suppliesOut: Record<string, number>;
  manpowerIn: number;
  researchGain: number;
  net: number;
  netSupplies: number;
}

export interface Notification {
  id: number;
  tick: number;
  priority: 'urgent' | 'normal' | 'low';
  nation: NationId | null; // null = world news
  text: string;
  province?: ProvinceId;
  army?: ArmyId;
  kind: string;
}

export interface Settings {
  difficulty: Difficulty;
  campaignYears: number;
  seed: number;
  playerNation: NationId | null; // null = AI-only observer run
  /** optional AI economic assistance, disclosed in settings and diagnostics */
  aiIncomeBonus: number;
  fogOfWar: false; // deferred: all information is public for all nations
}

export interface GameResult {
  tick: number;
  winner: NationId | null;
  path: VictoryPath | 'score' | 'elimination' | null;
  reason: string;
  playerOutcome: 'victory' | 'defeat' | 'survived' | null;
  scores: Record<NationId, number>;
}

export interface AIDiagnostic {
  tick: number;
  nation: NationId;
  layer: 'strategic' | 'operational' | 'execution';
  summary: string;
  detail?: string[];
}

export interface GameState {
  schema: number;
  scenarioId: string;
  tick: number;
  /** revision counter bumped on any control/ownership/war/treaty change (cache key) */
  rev: number;
  settings: Settings;
  rng: number[]; // gameplay PRNG state
  aiRng: number[]; // AI decision PRNG state (kept separate from combat/events)
  provinces: Record<ProvinceId, ProvinceState>;
  nations: Record<NationId, NationState>;
  armies: Record<ArmyId, Army>;
  battles: Record<string, Battle>;
  wars: Record<WarId, War>;
  treaties: Treaty[];
  truces: Truce[];
  /** opinions[a][b] = memories that a holds about b */
  memories: Record<NationId, Record<NationId, Memory[]>>;
  /** alarm[a][b] = how threatened a feels by b (0..100) */
  alarm: Record<NationId, Record<NationId, number>>;
  envoys: Envoy[];
  fabrications: ClaimFabrication[];
  coalitions: Coalition[];
  proposals: Proposal[];
  reports: BattleReport[];
  notifications: Notification[];
  counters: { army: number; battle: number; war: number; treaty: number; note: number; proposal: number; event: number; regiment: number; coalition: number };
  result: GameResult | null;
  continueAfterResult: boolean;
  diagnostics: AIDiagnostic[];
  /** player commands for reproducible bug reports */
  playerLog: Array<{ tick: number; cmd: Command }>;
}

// ───────────────────────────── Commands ─────────────────────────────────────

export type Command =
  | { type: 'recruit'; nation: NationId; province: ProvinceId; unit: UnitType; count?: number }
  | { type: 'cancelRecruit'; nation: NationId; province: ProvinceId }
  | { type: 'move'; nation: NationId; army: ArmyId; dest: ProvinceId; /** add the leg after the current route instead of replacing it */ append?: boolean }
  | { type: 'stop'; nation: NationId; army: ArmyId }
  | { type: 'setGroup'; nation: NationId; army: ArmyId; group: number | null }
  | { type: 'setOrder'; nation: NationId; army: ArmyId; order: ArmyOrder | null }
  | { type: 'split'; nation: NationId; army: ArmyId; counts: Partial<Record<UnitType, number>> }
  | { type: 'merge'; nation: NationId; armies: ArmyId[] }
  | { type: 'disband'; nation: NationId; army: ArmyId }
  | { type: 'build'; nation: NationId; province: ProvinceId; project: ProjectKind }
  | { type: 'cancelBuild'; nation: NationId; province: ProvinceId }
  | { type: 'research'; nation: NationId; tech: TechId }
  | { type: 'funding'; nation: NationId; level: 0 | 1 | 2 | 3 }
  | { type: 'policy'; nation: NationId; policy: PolicyId }
  | { type: 'envoy'; nation: NationId; target: NationId }
  | { type: 'recallEnvoy'; nation: NationId; target: NationId }
  | { type: 'propose'; nation: NationId; target: NationId; treaty: TreatyType }
  | { type: 'cancelTreaty'; nation: NationId; target: NationId; treaty: TreatyType }
  | { type: 'fabricate'; nation: NationId; province: ProvinceId }
  | { type: 'declareWar'; nation: NationId; target: NationId; goal: WarGoal }
  | { type: 'peace'; nation: NationId; war: WarId; with: NationId; terms: PeaceTerms }
  | { type: 'respond'; nation: NationId; proposal: string; accept: boolean }
  | { type: 'eventChoice'; nation: NationId; instance: string; choice: number }
  | { type: 'joinCoalition'; nation: NationId; target: NationId }
  | { type: 'leaveCoalition'; nation: NationId; target: NationId }
  | { type: 'coalitionWar'; nation: NationId; target: NationId };

export type CommandResult = { ok: true; message?: string } | { ok: false; reason: string };
