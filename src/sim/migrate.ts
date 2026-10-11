// Save migrations. Each step converts a parsed save from format n to n + 1 in
// place and explains what it did, so the player is told (never silently) that
// an old campaign was converted. A save that cannot be converted is refused
// with the reason; nothing is ever loaded half-converted.
//
// Format history (SCHEMA_VERSION in config.ts):
//   1  first release (v0.1, v0.2)
//   2  the state records its map fingerprint; saves of custom maps embed the map
//   3  the industrial age: new unit roster, resources, industry, research eras
//   4  national focus replaces the six policies; peace settlements, guarantees,
//      influence, loans and trade blocs
//   5  trade contracts and goods under way replace the automatic exchange of
//      surplus between trade partners

import { checkMapObject } from '../maps/validate';
import { mapChecksum, type MapPackage } from '../maps/format';
import { C, SCHEMA_VERSION, STRATEGIC } from './config';
import { LEGACY_TECHS, startingTechs } from './data/techs';
import { POLICY_TO_FOCUS } from './data/focus';
import { emptyFlows } from './economy';
import { defaultFactories, emptyDiplomacyStats, emptyForceStats, emptyTradeStats } from './game';
import type { MapFingerprint } from './types';
import { getWorld, isBuiltinMap, mapFingerprint, mapScenarioPart, scenarioIds } from './world';

/** A save as parsed from JSON, before validation. */
export interface RawSave {
  format: string;
  schema: number;
  checksum?: string;
  meta?: Record<string, unknown>;
  state: Record<string, unknown> & { schema?: number; scenarioId?: unknown; map?: MapFingerprint };
  mapPackage?: unknown;
}

export class MigrationError extends Error {}

type Step = (save: RawSave, notices: string[]) => void;

/**
 * The maps format-1 saves were made on: revision 1 of the built-in maps (the
 * first two releases; Aldmere exists only in the second). Pinned here so that a
 * later revision of a built-in map is recognised as a change, not assumed.
 */
export const FORMAT1_MAPS: Readonly<Record<string, MapFingerprint>> = {
  reach: { id: 'reach', revision: 1, checksum: '1953242e' },
  aldmere: { id: 'aldmere', revision: 1, checksum: '3ee14fac' },
};

const STEPS: Record<number, Step> = {
  // 1 → 2: record which map the campaign is played on
  1: (save, notices) => {
    const id = save.state.scenarioId;
    const fp = typeof id === 'string' ? FORMAT1_MAPS[id] : undefined;
    if (!fp) {
      throw new MigrationError(`Format-1 saves were only made on the built-in maps, but this one names the map "${String(id)}".`);
    }
    save.state.map = { ...fp };
    save.state.schema = 2;
    save.schema = 2;
    const name = mapScenarioPart(fp.id)?.meta.name ?? fp.id;
    notices.push(
      `This save was made by an earlier version of the game (save format 1) and was converted to format 2. ` +
        `Format 1 did not record which version of the map it used, so the campaign continues on ${name} as this version of the game has it. Saving again writes the new format.`,
    );
  },
  // 2 → 3: the 17th-century campaign moves into the industrial age
  2: (save, notices) => {
    const st = save.state as Record<string, any>;
    // the map: a built-in map continues on its current revision; an embedded map is upgraded
    if (save.mapPackage !== undefined) {
      const { pkg, check } = checkMapObject(save.mapPackage);
      if (!pkg) throw new MigrationError(`the map stored in the save cannot be upgraded (${check.errors.slice(0, 2).map((e) => e.message).join('; ')})`);
      save.mapPackage = pkg;
      st.map = { id: pkg.id, revision: pkg.revision, checksum: mapChecksum(pkg) };
    } else if (typeof st.scenarioId === 'string' && isBuiltinMap(st.scenarioId)) {
      st.map = { ...mapFingerprint(st.scenarioId) };
    }
    const startYear = typeof st.scenarioId === 'string' && scenarioIds().includes(st.scenarioId) ? getWorld(st.scenarioId).scenario.startYear : 1880;
    const UNIT: Record<string, string> = { foot: 'infantry', horse: 'cavalry', guns: 'artillery' };
    const unit = (u: unknown) => (typeof u === 'string' ? (UNIT[u] ?? u) : u);
    for (const a of Object.values<any>(st.armies ?? {})) for (const r of a.regiments ?? []) r.type = unit(r.type);
    const capitals = new Set(Object.values<any>(st.nations ?? {}).map((n) => n.capital));
    for (const p of Object.values<any>(st.provinces ?? {})) {
      for (const o of p.recruits ?? []) o.unit = unit(o.unit);
      p.factories = p.owner ? defaultFactories(p.dev ?? 1, capitals.has(p.id)) : 0;
    }
    const known = startingTechs(startYear);
    for (const n of Object.values<any>(st.nations ?? {})) {
      let dev = 0;
      let factories = 0;
      for (const p of Object.values<any>(st.provinces ?? {})) {
        if (p.owner !== n.id) continue;
        dev += p.dev ?? 0;
        factories += p.factories;
      }
      const rcap = C.resources.stockBase + C.resources.stockPerDev * dev;
      n.stock = Object.fromEntries(STRATEGIC.map((r) => [r, Math.round(rcap * C.resources.startShare)]));
      n.materiel = Math.round((C.industry.materielBase + C.industry.materielPerFactory * factories) * C.industry.startMaterielShare);
      n.shortages = [];
      const done = new Set<string>(known);
      for (const t of n.research?.done ?? []) if (LEGACY_TECHS[t]) done.add(LEGACY_TECHS[t]);
      n.research = { ...n.research, current: null, done: [...done] };
      if (n.lastMonth) n.lastMonth = { ...n.lastMonth, resources: emptyFlows(), industry: 0, materielIn: 0 };
    }
    for (const e of st.playerLog ?? []) {
      const cmd = e.cmd;
      if (cmd?.type === 'recruit') cmd.unit = unit(cmd.unit);
      if (cmd?.type === 'split' && cmd.counts) cmd.counts = Object.fromEntries(Object.entries(cmd.counts).map(([k, v]) => [unit(k), v]));
    }
    // navy and air: ports from the (current) map, empty docks and airfields; the
    // home squadrons are raised once the map is loaded (save.ts)
    const mapPorts = new Map<string, number>();
    const defs = save.mapPackage && typeof save.mapPackage === 'object' ? (save.mapPackage as MapPackage).provinces : typeof st.scenarioId === 'string' && scenarioIds().includes(st.scenarioId) ? getWorld(st.scenarioId).scenario.provinces : [];
    for (const p of defs) if (p.port) mapPorts.set(p.id, p.port);
    addForceDefaults(st, (pid) => mapPorts.get(pid) ?? 0);
    st.schema = 3;
    save.schema = 3;
    const tick = typeof st.tick === 'number' ? st.tick : 0;
    const year = startYear + Math.floor(tick / (C.time.weeksPerMonth * C.time.monthsPerYear));
    notices.push(
      `This campaign was made with the 17th-century rules (save format 2) and was converted to the industrial age (format 3). ` +
        `Foot became infantry, horse cavalry and guns artillery; researched technologies were mapped to their nearest equivalents in the new tree; ` +
        `factories, resource stockpiles and materiel were added; every coastal realm received ports and a home squadron (fleets and air forces are new); ` +
        `and the calendar now begins in ${startYear}, so the campaign continues in ${year}.`,
    );
  },
  // 3 → 4: national focus replaces policies; the new diplomacy starts empty
  3: (save, notices) => {
    const st = save.state as Record<string, any>;
    const kept: string[] = [];
    for (const n of Object.values<any>(st.nations ?? {})) {
      const policy = typeof n.policy === 'string' ? n.policy : '';
      const done = POLICY_TO_FOCUS[policy] ?? [];
      n.focus = { current: null, progress: 0, done: [...done] };
      if (n.isPlayer && done.length) kept.push(policy);
      delete n.policy;
      delete n.policySince;
      if (n.ai) delete n.ai.lastPolicyEval;
      n.stats = { ...emptyDiplomacyStats(), ...n.stats, demands: {} };
      n.victoryMissed = { territorial: 0, economic: 0, diplomatic: 0 };
    }
    st.influence = {};
    st.guarantees = [];
    st.loans = [];
    st.blocs = [];
    st.reparations = [];
    st.disarmaments = [];
    st.counters = { ...st.counters, loan: 0, bloc: 0 };
    for (const w of Object.values<any>(st.wars ?? {})) w.contrib = w.contrib ?? {};
    // policy changes in the command log cannot be replayed any more
    if (Array.isArray(st.playerLog)) st.playerLog = st.playerLog.filter((e: any) => e?.cmd?.type !== 'policy');
    st.schema = 4;
    save.schema = 4;
    notices.push(
      `This campaign was saved before national focus trees (save format 3) and was converted to format 4. ` +
        `National policies are replaced by focus trees: every realm keeps its policy as the matching completed focus${kept.length ? ' (yours included)' : ''}, and now chooses a national focus. ` +
        `Peace settlements with several parties, guarantees, influence and spheres, loans and trade blocs are new; wars under way share their spoils from now on.`,
    );
  },
  // 4 → 5: trade contracts. The running exchanges become contracts once the map is
  // loaded (readSave, `pendingContracts`), where the notice names them.
  4: (save) => {
    const st = save.state as Record<string, any>;
    st.contracts = [];
    st.shipments = [];
    st.counters = { ...st.counters, contract: 0 };
    for (const n of Object.values<any>(st.nations ?? {})) n.stats = { ...emptyTradeStats(), ...n.stats };
    st.pendingContracts = true;
    st.schema = 5;
    save.schema = 5;
  },
};

/**
 * Adds the navy and air state to a converted save: no fleets or wings yet (the
 * home squadrons are raised after loading, `pendingFleets`), ports from the map,
 * empty slipways and hangars, and zero counters.
 */
export function addForceDefaults(st: Record<string, any>, portOf: (pid: string) => number): void {
  st.fleets = {};
  st.wings = {};
  st.counters = { ...st.counters, fleet: 0, ship: 0, wing: 0 };
  for (const p of Object.values<any>(st.provinces ?? {})) {
    p.port = p.owner ? portOf(p.id) : 0;
    p.airfield = 0;
    p.dock = [];
    p.hangar = [];
  }
  for (const n of Object.values<any>(st.nations ?? {})) n.stats = { ...emptyForceStats(), ...n.stats };
  for (const a of Object.values<any>(st.armies ?? {})) delete a.embarked;
  st.pendingFleets = true;
}

/**
 * Brings a parsed save up to the current format. Returns the notices to show
 * the player; throws MigrationError when the save cannot be converted.
 */
export function migrateSave(save: RawSave): string[] {
  const notices: string[] = [];
  if (!Number.isInteger(save.schema) || save.schema < 1) throw new MigrationError(`The save has an invalid format number (${String(save.schema)}).`);
  while (save.schema < SCHEMA_VERSION) {
    const step = STEPS[save.schema];
    if (!step) throw new MigrationError(`Save format ${save.schema} cannot be converted to format ${SCHEMA_VERSION}.`);
    const from = save.schema;
    step(save, notices);
    if (save.schema !== from + 1) throw new MigrationError(`The conversion from save format ${from} did not complete.`);
  }
  return notices;
}
