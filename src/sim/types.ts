// Authoritative simulation types. Everything under GameState is plain JSON
// (serialisable for saves). Static scenario data lives in World and is rebuilt
// from the scenario id on load.

export type NationId = string;
export type ProvinceId = string;
export type ArmyId = string;
export type WarId = string;
export type TechId = string;
export type FocusId = string;
export type EventId = string;
export type ZoneId = string;
export type FleetId = string;
export type WingId = string;

export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains' | 'marsh' | 'steppe';
/** Strategic resources mined or grown in provinces; food is the realm's provisions stockpile. */
export type StrategicResource = 'coal' | 'iron' | 'oil' | 'rubber' | 'nitrates';
/** What trade contracts can carry: the five strategic resources and food. */
export type Tradeable = StrategicResource | 'food';
export type ResourceKind = 'food' | StrategicResource;
/** A province's deposit (one at most). */
export type Resource = ResourceKind | null;
export type UnitType = 'infantry' | 'cavalry' | 'artillery' | 'engineers' | 'armour' | 'airborne';
export type ProjectKind = 'dev' | 'infra' | 'fort' | 'charter' | 'settle' | 'factory' | 'port' | 'airfield' | 'flak';
export type ShipType = 'transport' | 'screen' | 'cruiser' | 'capital' | 'submarine' | 'carrier';
export type WingType = 'recon' | 'fighter' | 'attack' | 'bomber' | 'transport';
/** What an air wing does over its target area (land) or zone (sea). */
export type AirMission = 'idle' | 'superiority' | 'support' | 'interdiction' | 'bombing' | 'naval' | 'recon';
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
  /** treaties in force when a campaign starts (historical maps) */
  treaties?: Array<{ type: TreatyType; a: NationId; b: NationId }>;
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
  /** provinces at either end of a strait (a cheap pre-check before building an edge key) */
  straitEnds: Set<ProvinceId>;
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
  /** a province's row of the hop matrix, in provIds order (0xffff: unreachable); shared, do not modify */
  hopRow(a: ProvinceId): Uint16Array | undefined;
  /** a province's position in provIds */
  provIndex: ReadonlyMap<ProvinceId, number>;
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
  /** anti-aircraft batteries 0–3 (format 7): fire at enemy aircraft over the province */
  aa: number;
  /** ships under construction in this port */
  dock: ShipOrder[];
  /** air wings under construction at this airfield */
  hangar: WingOrder[];
}

export interface ShipOrder {
  nation: NationId;
  ship: ShipType;
  weeksLeft: number;
  /** the production order that laid it down (format 9) */
  order?: string;
}

export interface WingOrder {
  nation: NationId;
  wing: WingType;
  weeksLeft: number;
  /** the production order that raised it (format 9) */
  order?: string;
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
  /** what the fleet did last week beyond sailing (bombardment, air attacks, raiding), for the interface */
  report?: FleetReport | null;
  /** its standing order (format 7); none: on station, every duty it can */
  duty?: FleetDuty | null;
  /** the player's operation it serves, and whether a player order has taken it under direct command (format 8) */
  op?: string | null;
  opHold?: boolean;
  /** reserved for the player's direct command (format 9): Auto-conquer never takes it */
  reserved?: boolean;
}

/**
 * A fleet's standing order (format 7). On station (no order) a fleet does every
 * duty it can where it lies; an order sends it somewhere and puts its weight on
 * one duty:
 *   hold      stay; blockade and protect trade, no raiding or shelling
 *   patrol    keep a zone: protect our trade there (×1.5) and fight its intruders
 *   blockade  close a zone (×1.5 towards a blockade), no raiding or shelling
 *   raid      prey on enemy trade in a zone (×1.5), no escort
 *   escort    sail with another of our fleets and fight beside it
 *   bombard   lie off a coast province and shell only it (battles and sieges there)
 *   port      sail to a port and lie in harbour: repairs half as fast again, no duties
 */
export type FleetDutyKind = 'hold' | 'patrol' | 'blockade' | 'raid' | 'escort' | 'bombard' | 'port';
export interface FleetDuty {
  kind: FleetDutyKind;
  /** patrol, blockade, raid: the zone; port: the port's zone (set when ordered) */
  zone?: ZoneId | null;
  /** bombard: the coast province shelled; port: the port */
  province?: ProvinceId | null;
  /** escort: the fleet escorted */
  fleet?: FleetId | null;
  since: number;
}

export interface FleetReport {
  tick: number;
  notes: string[];
}

export interface AirWing {
  id: WingId;
  nation: NationId;
  name: string;
  type: WingType;
  /** airfield province it flies from (aboard a carrier: the airfield it last flew from) */
  base: ProvinceId;
  /** aboard the carriers of this fleet (format 6); null at its airfield */
  carrier: FleetId | null;
  /** 0–100: losses lower it, the base replenishes it with materiel */
  strength: number;
  /** 0–100 (format 6): flying wears it down, rest at the base restores it; effectiveness falls with it */
  readiness: number;
  mission: AirMission;
  /** land missions: centre of the mission area (the province and its neighbours; bombing: the province) */
  target: ProvinceId | null;
  /** sea missions (format 6): the zone; null aboard a carrier means over its own fleet */
  zone: ZoneId | null;
  /** last week's operations, for the interface (format 6) */
  report: WingReport | null;
  /** its service so far (format 7): weeks flown, enemy aircraft downed and hull hit (summed), strength lost */
  record?: { weeks: number; kills: number; hits: number; lost: number };
  /** the player's operation it serves, and whether a player order has taken it under direct command (format 8) */
  op?: string | null;
  opHold?: boolean;
  /** reserved for the player's direct command (format 9): Auto-conquer never takes it */
  reserved?: boolean;
}

/** One week of a wing's operations, as the player is told it. */
export interface WingReport {
  tick: number;
  /** it flew this week (sorties that wear its readiness and expose it) */
  flew: boolean;
  /** what it did, or why it could not: one line */
  note: string;
  /** enemy aircraft strength it shot down, damage it dealt (hull or fire share), strength it lost */
  kills: number;
  hits: number;
  lost: number;
}

export interface RecruitOrder {
  nation: NationId;
  unit: UnitType;
  weeksLeft: number;
  /** the production order that raised it (format 9) */
  order?: string;
}

/**
 * A standing production order (format 9): several ships, air wings or regiments of one
 * type, at one place or spread over several. Each week it lays down (and pays for, as
 * an order by hand would) what the free slipways, airfield room, money, materiel,
 * resources and men allow; nothing is reserved in advance. A blocked order waits and
 * says why. Cancelling stops what is not yet started; what is on the slipways or in
 * training stays (it is cancelled where it is, by the ordinary rules).
 */
export interface ProductionOrder {
  id: string;
  kind: 'ship' | 'wing' | 'regiment';
  /** ShipType, WingType or UnitType */
  unit: string;
  /** the ports, airfields or provinces, in the order chosen */
  places: ProvinceId[];
  /** per place (each place gets `count`) or total (spread over them, a place at a time) */
  mode: 'per' | 'total';
  count: number;
  /** units ordered in all (per place: count × places; less when a place is lost before its share starts) */
  total: number;
  /** started so far at each place */
  started: Record<ProvinceId, number>;
  /** finished so far */
  done: number;
  paused: boolean;
  created: number;
  /** why nothing (more) started last week, and since when */
  blocked: { why: string; since: number } | null;
  /** where finished units go: an operation of ours, and for wings an airfield to move to / for fleets a zone to sail to */
  assign: { op: string | null; rally: string | null };
  /** the fleet or army this order is filling at each place (later units join it there while it waits) */
  groups: Record<ProvinceId, string>;
  /** fleets this order formed (bounded by its count): with a zone to sail to, they join up there */
  formed: string[];
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
  /** an airborne operation under way (format 7): flown to `target` by these transport wings in the air phase */
  drop?: AirDrop | null;
  /** tick it landed from the air (airborne landing penalty that week) */
  dropped?: number;
  /** the player's operation it serves (format 8); null: under direct command only */
  op?: string | null;
  /** a member taken under direct command by a player order: the operation leaves it alone until it is resumed */
  opHold?: boolean;
  /** the player keeps this formation as it is: operations never split it or merge it into another */
  keep?: boolean;
  /** reserved for the player's direct command (format 9): Auto-conquer never takes it */
  reserved?: boolean;
}

/** An airborne operation: the army, at an airfield, is flown to a province and dropped there. */
export interface AirDrop {
  target: ProvinceId;
  wings: WingId[];
  /** tick it was ordered */
  since: number;
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
  /** fire support in the latest round, by side (format 6): air wings and ships offshore */
  support?: { att: SupportLine[]; def: SupportLine[] };
}

/** One air wing or fleet supporting a side of a land battle, and what it added. */
export interface SupportLine {
  kind: 'air' | 'recon' | 'naval';
  /** the wing or fleet */
  id: string;
  nation: NationId;
  name: string;
  /** added fire, as a share (0.12 = +12%) after caps */
  value: number;
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
  /** contribution to the war by each participant (battles won, enemy land held): shares the spoils */
  contrib?: Record<NationId, number>;
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

export type ProposalKind = 'nap' | 'trade' | 'alliance' | 'peace' | 'callToArms' | 'settlement' | 'loan' | 'blocInvite' | 'blocJoin' | 'contract';

/**
 * One demand of a peace settlement: what a realm on the losing side gives to a
 * realm on the winning side.
 *   cede         a province
 *   gold         crowns, paid at once
 *   reparations  a share of the giver's income (amount 0.1–0.3) for five years
 *   disarm       the giver's army is limited for five years (half its regiments, at least 3)
 *   renounce     the giver drops its claims on the receiver and may not attack it for ten years
 *   sphere       the receiver gains a strong influence over the giver
 */
export type DemandKind = 'cede' | 'gold' | 'reparations' | 'disarm' | 'renounce' | 'sphere';

export interface Demand {
  kind: DemandKind;
  /** the giver (losing side) */
  from: NationId;
  /** the receiver (winning side) */
  to: NationId;
  province?: ProvinceId;
  amount?: number;
}

/** A realm's guarantee of another's independence: it joins the defence when they are attacked. */
export interface Guarantee {
  by: NationId;
  of: NationId;
  since: number;
}

/** Crowns lent by one realm to another, repaid monthly with interest. */
export interface Loan {
  id: string;
  from: NationId;
  to: NationId;
  /** crowns still owed */
  remaining: number;
  /** the monthly instalment */
  monthly: number;
  since: number;
}

/** A customs union: members trade at lower cost and share the losses of blockades. */
export interface TradeBloc {
  id: string;
  name: string;
  leader: NationId;
  members: NationId[];
  since: number;
}

/** Reparations imposed by a peace settlement. */
export interface Reparation {
  from: NationId;
  to: NationId;
  /** share of the payer's gross income */
  share: number;
  until: number;
}

/** An army limit imposed by a peace settlement. */
export interface Disarmament {
  nation: NationId;
  by: NationId;
  /** most regiments (in armies and in training) */
  cap: number;
  until: number;
}

export interface FocusState {
  current: FocusId | null;
  /** months of work on the current focus */
  progress: number;
  done: FocusId[];
}

export interface Proposal {
  id: string;
  kind: ProposalKind;
  from: NationId;
  to: NationId;
  tick: number;
  expires: number;
  war?: WarId;
  terms?: PeaceTerms;
  /** a peace settlement's demands */
  demands?: Demand[];
  /** a loan's crowns */
  amount?: number;
  /** a trade bloc's id */
  bloc?: string;
  /** a trade contract's terms */
  contract?: ContractTerms;
  /** why the proposer offers a treaty, in its own words */
  reason?: string;
}

/** The terms of a trade contract, as proposed (format 5). */
export interface ContractTerms {
  seller: NationId;
  buyer: NationId;
  res: Tradeable;
  /** units shipped each month */
  qty: number;
  /** crowns per unit, fixed for the whole term */
  price: number;
  /** length of the term in months */
  months: number;
}

/**
 * A signed contract. Each monthly settlement the seller ships `qty` before its
 * own use (the reserved stock); goods reach the buyer after `lag` months (0
 * overland, within the same settlement) and are paid for on delivery.
 */
export interface TradeContract extends ContractTerms {
  id: string;
  /** tick it was signed */
  start: number;
  /** first settlement tick with no more shipments (the term is over) */
  until: number;
  /** months from shipment to delivery */
  lag: number;
  /** units shipped so far */
  shipped: number;
  /** consecutive settlements the seller shipped short of the terms (two end the contract) */
  sellerMisses: number;
  /** consecutive settlements the buyer could not pay (two end the contract) */
  buyerMisses: number;
}

/** Goods under way: shipped at one settlement, delivered and paid for at `arrives`. */
export interface Shipment {
  id: string;
  contract: string;
  seller: NationId;
  buyer: NationId;
  res: Tradeable;
  qty: number;
  price: number;
  sent: number;
  arrives: number;
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
  /** remembers per-front objective commitments: armyId -> objective province */
  objectives: Record<ArmyId, { target: ProvinceId; since: number; kind: string; value: number }>;
  /** provinces where an attack of ours failed (format 8): no new attack there until the wait is over, and only stronger */
  failures?: Record<ProvinceId, { tick: number; count: number; held?: boolean }>;
  /** armies it detached or merged recently (format 8): they wait before reorganising again */
  reorganized?: Record<ArmyId, number>;
  /** desired regiment count set by the strategic layer */
  armyTarget: number;
  /** province where idle forces gather */
  rally: ProvinceId | null;
  lastPeaceTry: Record<string, number>;
  lastProposal: Record<string, number>;
  /** per war: the last peace offer made, how it was answered, and the war's recent outlook (format 7) */
  peace: Record<WarId, PeaceMemory>;
  /** answers our treaty proposals got, by `${realm}:${type}` (format 7) */
  treatyAnswers: Record<string, { tick: number; accepted: boolean; reason?: string }>;
  /** a planned landing: gather a force at `port`, carry it to `target` */
  invasion?: { target: ProvinceId; port: ProvinceId; since: number } | null;
}

/** What an AI realm remembers of making peace in one war. */
export interface PeaceMemory {
  /** the last offer: when, what kind, its value in war-score points and our standing then */
  tick: number;
  mode: 'white' | 'concede' | 'demand' | 'settlement' | null;
  value: number;
  standing: number;
  answer: 'pending' | 'rejected' | 'accepted' | null;
  /** the outlook each month, newest last (at most four): the war's momentum */
  outlooks: number[];
  /** when it next reconsiders the war */
  next: number;
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
  /** weeks with a fleet away from its home waters */
  seaWeeks: number;
  wingsBuilt: number;
  airMissionWeeks: number;
  bombingWeeks: number;
  /** format 6: wing-weeks supporting a battle, enemy wings shot down, ship hits from the air, weeks of shore bombardment, weeks raiding enemy sea trade */
  supportWeeks: number;
  airKills: number;
  navalStrikeHits: number;
  bombardWeeks: number;
  raidWeeks: number;
  /** airborne operations flown (format 7; older saves: absent) */
  airborneDrops?: number;
  /** diplomacy and focus (system-usage counts) */
  focusesDone: number;
  /** settlements dictated as the winning war leader */
  settlementsImposed: number;
  /** demands this realm received in settlements */
  demandsWon: number;
  guaranteesGiven: number;
  /** wars joined to defend a realm we guarantee */
  guaranteeCalls: number;
  loansGiven: number;
  loanCrowns: number;
  /** months as a member of a trade bloc */
  blocMonths: number;
  /** months leading a sphere of influence with at least one member */
  sphereMonths: number;
  /** settlements dictated in which more than one realm received demands */
  settlementsShared: number;
  /** demands received, by kind */
  demands: Partial<Record<DemandKind, number>>;
  /** trade contracts (format 5): signed (as either party), run to term, ended by our default or cancellation, units we shipped */
  contractsSigned: number;
  contractsKept: number;
  contractsDefaulted: number;
  contractsCancelled: number;
  contractUnits: number;
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
  /** men fit for service lost for good in war and not yet made up by new cohorts (format 7) */
  reserveLost: number;
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
  /** national focus */
  focus: FocusState;
  warExhaustion: number;
  trust: number; // 0..100 reputation for honouring agreements
  debtMonths: number;
  bankruptUntil: number;
  modifiers: Modifier[];
  /** standing production orders (format 9): ships, air wings and regiments laid down as capacity and money allow */
  production?: ProductionOrder[];
  eventCooldowns: Record<EventId, number>;
  nextEventTick: number;
  pendingEvents: PendingEvent[];
  victoryStreak: Record<VictoryPath, number>;
  /** consecutive months each victory condition has failed (a timer pauses the first month, then decays) */
  victoryMissed?: Record<VictoryPath, number>;
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
  /** food lost above the stockpile cap (format 5) */
  foodWasted?: number;
}

export interface ResourceFlow {
  produced: number;
  used: number;
  imported: number;
  exported: number;
  /** delivered or produced beyond the stockpile cap, and lost (format 5) */
  wasted?: number;
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

// ───────────────────────────── Operations (format 8) ─────────────────────────

/**
 * A player's operation: forces assigned to an objective with constraints; the
 * planner (sim/ops) carries out the routine orders through the same commands
 * as the player, weekly, until it is done, paused or cancelled.
 *   conquer   take the enemy-held provinces of an area
 *   advance   push through to one province, taking what lies on the way
 *   hold      defend an area: cover its threatened border, counter-attack inside it
 *   sea       keep sea zones: patrol and intercept, escort, strike enemy fleets
 *   landing   carry the armies to an enemy coast under escort and cover, then take the area
 */
export type OperationKind = 'conquer' | 'advance' | 'hold' | 'sea' | 'landing' | 'war';

/** What an Auto-conquer mandate favours (format 9): nothing in particular, sparing men, ports, industry, or one enemy. */
export type OpStrategy = 'none' | 'manpower' | 'ports' | 'industry' | 'focus';
export type OpPosture = 'cautious' | 'balanced' | 'aggressive';
export type OpStatus = 'active' | 'paused' | 'complete';
/** when the objective is reached: hold the area, regroup in it, return home, or stand and wait */
export type OpCompletion = 'hold' | 'regroup' | 'return' | 'await';

export interface OperationSettings {
  posture: OpPosture;
  /** 1 low, 2 normal, 3 high: higher plans first where operations share bases or airfields */
  priority: 1 | 2 | 3;
  /** share of the ground strength held back as a reserve (0–0.4) */
  reserve: number;
  /** when the reserve goes in: never, to win battles our forces are fighting, or wherever a target needs it */
  commitReserve: 'never' | 'battles' | 'freely';
  /** armies below this share of full morale rest instead of attacking (0.2–0.8) */
  minReadiness: number;
  /** attack only where our supply reaches */
  supplyLimit: boolean;
  /** may split and merge the operation's armies, move ships between its fleets */
  reorganize: boolean;
  /** may move the operation's air wings to other airfields */
  rebase: boolean;
  /** airborne drops: none, one (the mandate ends with it), or as often as the forces allow */
  airborne: 'off' | 'once' | 'repeat';
  /** the most of a drop's men it may expect to lose on the way in (0.05–0.5) */
  airborneRisk: number;
  /** a member given a direct order rejoins the operation once that order is carried out */
  resumeAfterOrder: boolean;
  onComplete: OpCompletion;
  /** Auto-conquer (format 9): forces of ours that are free (in no operation, not reserved) join it as they appear */
  autoAssign?: boolean;
  /** Auto-conquer (format 9): what it favours, and the enemy it concentrates on when that is 'focus' */
  strategy?: OpStrategy;
  focus?: NationId | null;
}

export type OpTaskKind =
  | 'attack' | 'stage' | 'occupy' | 'defend' | 'hold' | 'reserve' | 'recover' | 'regroup' | 'return' | 'wait'
  | 'patrol' | 'escort' | 'blockade' | 'bombard' | 'repair' | 'transport' | 'strike'
  | 'cover' | 'support' | 'interdict' | 'rest' | 'rebase' | 'drop' | 'embark' | 'manual';

/** What the planner last had a member do, and why (shown in the operation's panel). */
export interface OpTask {
  kind: OpTaskKind;
  /** province or sea zone */
  target: string | null;
  note: string;
  since: number;
}

export interface Operation extends OperationSettings {
  id: string;
  nation: NationId;
  name: string;
  kind: OperationKind;
  status: OpStatus;
  /** provinces: to take (conquer), to reach (advance: one), to hold (hold), the beach then the area (landing) */
  area: ProvinceId[];
  /** sea zones to keep (sea) */
  zones: ZoneId[];
  created: number;
  /** tick it was activated (or last resumed) */
  since: number;
  /** current task of each member (unit id) */
  tasks: Record<string, OpTask>;
  /** each army's target, kept until it is taken, lost or hopeless (commitment against order churn) */
  assigned: Record<ArmyId, { target: ProvinceId; since: number; kind: string }>;
  /** area provinces held by our side at the last planning (to count what changes hands) */
  held: ProvinceId[];
  /** targets where an attack failed: no new attack until the posture's wait is over (and only stronger) */
  failures: Record<ProvinceId, { tick: number; count: number; held?: boolean }>;
  /** armies the planner detached (ids), and when an army last split or merged: it waits before reorganising again */
  detached: string[];
  reorganized: Record<string, number>;
  /** what happened, newest last (at most 40 lines) */
  log: Array<{ tick: number; text: string; tone?: 'good' | 'bad' }>;
  /** a decision the player is asked for (raised once, kept until it no longer applies) */
  issue: { code: string; text: string; since: number } | null;
  /** results since it began */
  stats: { taken: number; lost: number; menLost: number; shipsLost: number; wingStrengthLost: number; drops: number; landings: number };
  /** a landing's progress (landing operations) */
  landing?: { stage: 'gather' | 'sail' | 'ashore'; port: ProvinceId | null } | null;
  /** Auto-conquer (format 9): the realms at war with us it is to defeat (it never adds one) */
  enemies?: NationId[];
  /** Auto-conquer (format 9): the enemies' provinces when it began (for its progress) */
  startLand?: number;
  /** a landing Auto-conquer organised (format 9): the mandate its forces return to when it is done */
  parent?: string | null;
  /** Auto-conquer (format 9): no new landing before this tick (one failed) */
  landingWait?: number;
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
  /** the player's operations (format 8) */
  operations: Record<string, Operation>;
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
  /** influence[a][b] = a's influence over b (0..100) */
  influence: Record<NationId, Record<NationId, number>>;
  guarantees: Guarantee[];
  loans: Loan[];
  blocs: TradeBloc[];
  /** trade contracts in force, and goods under way (format 5) */
  contracts: TradeContract[];
  shipments: Shipment[];
  reparations: Reparation[];
  disarmaments: Disarmament[];
  proposals: Proposal[];
  reports: BattleReport[];
  notifications: Notification[];
  counters: { army: number; battle: number; war: number; treaty: number; note: number; proposal: number; event: number; regiment: number; coalition: number; fleet: number; ship: number; wing: number; loan: number; bloc: number; contract: number; op?: number; production?: number };
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
  | { type: 'fleetDuty'; nation: NationId; fleet: FleetId; duty: Omit<FleetDuty, 'since'> | null }
  /** `wings`: flown by these transport wings only (an operation flies its own) */
  | { type: 'airDrop'; nation: NationId; army: ArmyId; target: ProvinceId; wings?: WingId[] }
  | { type: 'cancelDrop'; nation: NationId; army: ArmyId }
  | { type: 'mergeFleets'; nation: NationId; fleets: FleetId[] }
  | { type: 'splitFleet'; nation: NationId; fleet: FleetId; ships: string[] }
  | { type: 'disbandFleet'; nation: NationId; fleet: FleetId }
  /** carry armies standing on a coast by sea and land them on another coast */
  | { type: 'shipArmies'; nation: NationId; armies: ArmyId[]; fleet: FleetId; dest: ProvinceId }
  | { type: 'buildWing'; nation: NationId; province: ProvinceId; wing: WingType }
  | { type: 'cancelWing'; nation: NationId; province: ProvinceId }
  /** a land mission names a province; a sea mission (superiority, naval strike, recon) names a zone instead (aboard a carrier, no zone: over its own fleet) */
  | { type: 'airMission'; nation: NationId; wing: WingId; mission: AirMission; target: ProvinceId | null; zone?: ZoneId | null }
  /** to an airfield (`base`) or aboard the carriers of a fleet (`carrier`) */
  | { type: 'rebaseWing'; nation: NationId; wing: WingId; base?: ProvinceId; carrier?: FleetId }
  | { type: 'disbandWing'; nation: NationId; wing: WingId }
  | { type: 'cancelBuild'; nation: NationId; province: ProvinceId }
  /** operations (format 8): create one (prepared, or active at once) with forces assigned */
  | { type: 'createOp'; nation: NationId; kind: OperationKind; area: ProvinceId[]; zones?: ZoneId[]; settings?: Partial<OperationSettings>; units?: string[]; name?: string; activate?: boolean; enemies?: NationId[] }
  | { type: 'editOp'; nation: NationId; op: string; area?: ProvinceId[]; zones?: ZoneId[]; settings?: Partial<OperationSettings>; name?: string; enemies?: NationId[] }
  | { type: 'reserveUnits'; nation: NationId; units: string[]; reserved: boolean }
  | { type: 'orderProduction'; nation: NationId; kind: ProductionOrder['kind']; unit: string; places: ProvinceId[]; count: number; mode: 'per' | 'total'; assign?: { op?: string | null; rally?: string | null } }
  | { type: 'productionState'; nation: NationId; order: string; state: 'paused' | 'active' | 'cancel' }
  /** armies, fleets and wings (by id) join the operation (leaving any other) */
  | { type: 'assignOp'; nation: NationId; op: string; units: string[] }
  /** members leave their operation and keep their last orders under direct command */
  | { type: 'releaseOp'; nation: NationId; units: string[] }
  /** members under direct command hand back to their operation */
  | { type: 'resumeUnits'; nation: NationId; units: string[] }
  | { type: 'opState'; nation: NationId; op: string; state: 'active' | 'paused' }
  | { type: 'cancelOp'; nation: NationId; op: string }
  /** protect an army from being split or merged by operations */
  | { type: 'keepFormation'; nation: NationId; army: ArmyId; keep: boolean }
  /** the same project in several provinces at once (in the order given; each checked again) */
  | { type: 'batchBuild'; nation: NationId; project: ProjectKind; provinces: ProvinceId[] }
  /** regiments in several provinces at once: the allocation previewed (each checked again, in order) */
  | { type: 'batchRecruit'; nation: NationId; unit: UnitType; alloc: Array<{ province: ProvinceId; count: number }> }
  | { type: 'research'; nation: NationId; tech: TechId }
  | { type: 'funding'; nation: NationId; level: 0 | 1 | 2 | 3 }
  | { type: 'focus'; nation: NationId; focus: FocusId }
  | { type: 'envoy'; nation: NationId; target: NationId }
  | { type: 'recallEnvoy'; nation: NationId; target: NationId }
  | { type: 'propose'; nation: NationId; target: NationId; treaty: TreatyType; reason?: string }
  | { type: 'cancelTreaty'; nation: NationId; target: NationId; treaty: TreatyType }
  | { type: 'fabricate'; nation: NationId; province: ProvinceId }
  | { type: 'declareWar'; nation: NationId; target: NationId; goal: WarGoal }
  | { type: 'peace'; nation: NationId; war: WarId; with: NationId; terms: PeaceTerms }
  /** a war leader proposes a full peace settlement to the opposing leader */
  | { type: 'settle'; nation: NationId; war: WarId; demands: Demand[] }
  /** answer a proposal; for a settlement, `drop` lists demands (by index) to strike out as a counter-offer */
  | { type: 'respond'; nation: NationId; proposal: string; accept: boolean; drop?: number[] }
  | { type: 'guarantee'; nation: NationId; target: NationId }
  | { type: 'revokeGuarantee'; nation: NationId; target: NationId }
  | { type: 'loan'; nation: NationId; target: NationId; amount: number }
  /** found a trade bloc with a trade partner (who must agree) */
  | { type: 'foundBloc'; nation: NationId; target: NationId }
  | { type: 'inviteBloc'; nation: NationId; target: NationId }
  | { type: 'joinBloc'; nation: NationId; bloc: string }
  | { type: 'leaveBloc'; nation: NationId }
  /** propose a trade contract (the realm is its seller or its buyer): an AI partner answers at once, a player gets a proposal */
  | { type: 'offerContract'; nation: NationId; terms: ContractTerms }
  /** end a contract before its term: the canceller pays the other party a fee */
  | { type: 'cancelContract'; nation: NationId; contract: string }
  | { type: 'eventChoice'; nation: NationId; instance: string; choice: number }
  | { type: 'joinCoalition'; nation: NationId; target: NationId }
  | { type: 'leaveCoalition'; nation: NationId; target: NationId }
  | { type: 'coalitionWar'; nation: NationId; target: NationId }
  /** play on after the campaign result (logged so replays match; null for an observer) */
  | { type: 'continueCampaign'; nation: NationId | null };

/** A command issued by a realm (everything except the campaign-level ones). */
export type RealmCommand = Exclude<Command, { type: 'continueCampaign' }>;

export type CommandResult = { ok: true; message?: string; /** per-item outcome of a batch */ details?: string[] } | { ok: false; reason: string };
