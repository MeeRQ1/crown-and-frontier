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
export type ZoneId = string;
export type FleetId = string;
export type WingId = string;

export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains' | 'marsh' | 'steppe';
/** Strategic resources mined or grown in provinces; food is the realm's provisions stockpile. */
export type StrategicResource = 'coal' | 'iron' | 'oil' | 'rubber' | 'nitrates';
export type ResourceKind = 'food' | StrategicResource;
/** A province's deposit (one at most). */
export type Resource = ResourceKind | null;
export type UnitType = 'infantry' | 'cavalry' | 'artillery' | 'engineers' | 'armour';
export type ProjectKind = 'dev' | 'infra' | 'fort' | 'charter' | 'settle' | 'factory' | 'port' | 'airfield';
export type ShipType = 'transport' | 'screen' | 'cruiser' | 'capital' | 'submarine' | 'carrier';
export type WingType = 'recon' | 'fighter' | 'attack' | 'bomber';
/** What an air wing does over its target area. */
export type AirMission = 'idle' | 'superiority' | 'support' | 'interdiction' | 'bombing' | 'recon';
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
  artilleryCostMul?: number;
  cavalryCostMul?: number;
  cavalryAttackAdd?: number;
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
  /** factory levels at the start (default: derived from development) */
  factories?: number;
  /** port level at the start (coastal provinces only; format 3) */
  port?: number;
}

/** A sea zone: the node fleets move between (map format 3). */
export interface SeaZoneDef {
  id: ZoneId;
  name: string;
  /** neighbouring sea zones */
  neighbors: ZoneId[];
  /** provinces on this zone's coast: they can hold ports, launch and receive landings */
  coasts: ProvinceId[];
  /** straits whose crossing this zone commands */
  straits?: Array<[ProvinceId, ProvinceId]>;
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
  /** sea zones (map format 3; none on older test scenarios) */
  seaZones?: SeaZoneDef[];
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
  /** sea zones by id, in map order */
  zones: Record<ZoneId, SeaZoneDef>;
  zoneIds: ZoneId[];
  /** the sea zones each coastal province touches (sorted); absent for inland provinces */
  provZones: Record<ProvinceId, ZoneId[]>;
  /** key `${a}|${b}` with a<b → the zone that commands that strait */
  straitZone: Map<string, ZoneId>;
  /** hop distance between two sea zones (undefined if unconnected) */
  zoneHop(a: ZoneId, b: ZoneId): number | undefined;
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
  /** factory levels (industry) */
  factories: number;
  integration: number; // 0..100
  unrest: number; // 0..100
  project: Project | null;
  siege: Siege | null;
  claims: NationId[];
  revoltUntil: number; // tick until which the province is in revolt (0 = none)
  lastOwnerChange: number;
  recruits: RecruitOrder[];
  /** port level 0–3 (coastal provinces): shipbuilding and repair */
  port: number;
  /** airfield level 0–2: bases for air wings */
  airfield: number;
  /** ships under construction in this port */
  dock: ShipOrder[];
  /** air wings under construction at this airfield */
  hangar: WingOrder[];
}

export interface ShipOrder {
  nation: NationId;
  ship: ShipType;
  weeksLeft: number;
}

export interface WingOrder {
  nation: NationId;
  wing: WingType;
  weeksLeft: number;
}

export interface Ship {
  id: string;
  type: ShipType;
  /** condition 0–100: damage lowers fighting value; 0 sinks */
  hp: number;
}

export interface Fleet {
  id: FleetId;
  nation: NationId;
  name: string;
  /** the sea zone it is in */
  zone: ZoneId;
  /** remaining route, path[0] is the next zone */
  path: ZoneId[];
  /** movement points towards path[0] */
  progress: number;
  ships: Ship[];
  /** home port (repairs, new ships, where it returns after a lost battle) */
  home: ProvinceId | null;
  /** armies carried (embarked) */
  cargo: ArmyId[];
  /** where the cargo lands when the fleet reaches a zone on that coast */
  landing: ProvinceId | null;
  /** AI assignment tag */
  task: string | null;
}

export interface AirWing {
  id: WingId;
  nation: NationId;
  name: string;
  type: WingType;
  /** airfield province it flies from */
  base: ProvinceId;
  /** 0–100: losses lower it, the base replenishes it with materiel */
  strength: number;
  mission: AirMission;
  /** centre of the mission area (the province and its neighbours; bombing: the province) */
  target: ProvinceId | null;
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
  /** carried by this fleet: at sea, out of every land phase until it lands */
  embarked?: FleetId | null;
  /** tick it came ashore from the sea (amphibious landing penalty that week) */
  landed?: number;
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
  /** a naval battle: `province` holds the sea zone id */
  sea?: boolean;
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
  industryMul?: number;
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
  /** a planned landing: gather a force at `port`, carry it to `target` */
  invasion?: { target: ProvinceId; port: ProvinceId; since: number } | null;
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
  /** navy and air (system-usage counts) */
  shipsBuilt: number;
  shipsSunk: number;
  shipsLost: number;
  navalBattles: number;
  landings: number;
  blockadeWeeks: number;
  wingsBuilt: number;
  airMissionWeeks: number;
  bombingWeeks: number;
}

export interface NationState {
  id: NationId;
  alive: boolean;
  eliminatedTick: number | null;
  isPlayer: boolean;
  capital: ProvinceId | null;
  treasury: number;
  /** food: the provisions stockpile armies draw on (shown as "Food") */
  supplies: number;
  manpower: number;
  /** strategic resource stockpiles */
  stock: Record<StrategicResource, number>;
  /** equipment produced by industry, spent on regiments and replacements */
  materiel: number;
  /** resources the realm ran out of at the last monthly settlement */
  shortages: StrategicResource[];
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
  /** strategic resources: produced, used, bought and sold this month */
  resources: Record<StrategicResource, ResourceFlow>;
  /** industrial capacity (factory output after coal and efficiency) */
  industry: number;
  /** materiel added to the stockpile this month */
  materielIn: number;
}

export interface ResourceFlow {
  produced: number;
  used: number;
  imported: number;
  exported: number;
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

/**
 * Which map a campaign is played on: the map package's id and content
 * revision, and the checksum of its gameplay content (src/maps/format.ts).
 */
export interface MapFingerprint {
  id: string;
  revision: number;
  checksum: string;
}

export interface GameState {
  schema: number;
  scenarioId: string;
  /** the exact map this campaign was created on (save format 2) */
  map: MapFingerprint;
  tick: number;
  /** revision counter bumped on any control/ownership/war/treaty change (cache key) */
  rev: number;
  settings: Settings;
  rng: number[]; // gameplay PRNG state
  aiRng: number[]; // AI decision PRNG state (kept separate from combat/events)
  provinces: Record<ProvinceId, ProvinceState>;
  nations: Record<NationId, NationState>;
  armies: Record<ArmyId, Army>;
  fleets: Record<FleetId, Fleet>;
  wings: Record<WingId, AirWing>;
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
  counters: { army: number; battle: number; war: number; treaty: number; note: number; proposal: number; event: number; regiment: number; coalition: number; fleet: number; ship: number; wing: number };
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
  | { type: 'buildShip'; nation: NationId; province: ProvinceId; ship: ShipType }
  | { type: 'cancelShip'; nation: NationId; province: ProvinceId }
  | { type: 'moveFleet'; nation: NationId; fleet: FleetId; zone: ZoneId }
  | { type: 'stopFleet'; nation: NationId; fleet: FleetId }
  | { type: 'mergeFleets'; nation: NationId; fleets: FleetId[] }
  | { type: 'splitFleet'; nation: NationId; fleet: FleetId; ships: string[] }
  | { type: 'disbandFleet'; nation: NationId; fleet: FleetId }
  /** carry armies standing on a coast by sea and land them on another coast */
  | { type: 'shipArmies'; nation: NationId; armies: ArmyId[]; fleet: FleetId; dest: ProvinceId }
  | { type: 'buildWing'; nation: NationId; province: ProvinceId; wing: WingType }
  | { type: 'cancelWing'; nation: NationId; province: ProvinceId }
  | { type: 'airMission'; nation: NationId; wing: WingId; mission: AirMission; target: ProvinceId | null }
  | { type: 'rebaseWing'; nation: NationId; wing: WingId; base: ProvinceId }
  | { type: 'disbandWing'; nation: NationId; wing: WingId }
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
  | { type: 'coalitionWar'; nation: NationId; target: NationId }
  /** play on after the campaign result (logged so replays match; null for an observer) */
  | { type: 'continueCampaign'; nation: NationId | null };

/** A command issued by a realm (everything except the campaign-level ones). */
export type RealmCommand = Exclude<Command, { type: 'continueCampaign' }>;

export type CommandResult = { ok: true; message?: string } | { ok: false; reason: string };
