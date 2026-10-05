// Combat matrices: equal-cost compositions against each other, through the
// real combat code. Land: six army compositions attack and defend on every
// terrain (forecast with even rolls). Sea: five fleet compositions meet in a
// zone (one week of battle). A composition that wins every pairing everywhere
// would be a dominant strategy; the stage check is that none does.
//   npx tsx tools/matrix.ts [--out reports/stage-c/combat-matrix.md]

import { SHIPS, UNITS } from '../src/sim/config';
import { startingTechs, TECH_LIST } from '../src/sim/data/techs';
import { forecastBattle } from '../src/sim/combat';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import { createFleet, newShip, touchFleets, weeklyNaval } from '../src/sim/naval';
import { nextMemoEpoch } from '../src/sim/index';
import { bump, type Sim } from '../src/sim/state';
import type { ShipType, Terrain, UnitType } from '../src/sim/types';
import { declareWar } from '../src/sim/war';
import { registerScenario } from '../src/sim/world';
import type { ScenarioDef } from '../src/sim/types';

export const TERRAINS: Terrain[] = ['plains', 'steppe', 'forest', 'hills', 'marsh', 'mountains'];

export const ARMIES: Record<string, Partial<Record<UnitType, number>>> = {
  'Line infantry': { infantry: 1 },
  'Cavalry wing': { infantry: 0.5, cavalry: 0.5 },
  'Gun line': { infantry: 0.6, artillery: 0.4 },
  'Balanced': { infantry: 0.6, cavalry: 0.12, artillery: 0.2, engineers: 0.08 },
  'Armoured': { infantry: 0.5, armour: 0.3, artillery: 0.2 },
  'Sappers': { infantry: 0.7, artillery: 0.15, engineers: 0.15 },
};

export const FLEETS: Record<string, Partial<Record<ShipType, number>>> = {
  'Battle line': { capital: 0.6, screen: 0.4 },
  'Cruiser squadron': { cruiser: 1 },
  'Submarine flotilla': { submarine: 1 },
  'Destroyer screen': { screen: 1 },
  'Carrier group': { carrier: 0.5, screen: 0.3, cruiser: 0.2 },
};

const BUDGET = 900; // crowns + materiel per side

function matrixScenario(): ScenarioDef {
  const nation = (id: string, capital: string) => ({ id, name: id, short: id, adjective: id, color: '#888888', capital, personality: 'commercial' as const, emblem: 'x', summary: '', strength: '', constraint: '', traits: {} });
  const provinces = [
    { id: 'home-a', name: 'Home A', terrain: 'plains' as Terrain, resource: null, owner: 'a', dev: 5, pop: 60, region: 'r', infra: 0, fort: 0, integration: 100, claims: [], neighbors: TERRAINS.map((t) => `field-${t}`), port: 1 },
    { id: 'home-b', name: 'Home B', terrain: 'plains' as Terrain, resource: null, owner: 'b', dev: 5, pop: 60, region: 'r', infra: 0, fort: 0, integration: 100, claims: [], neighbors: TERRAINS.map((t) => `field-${t}`), port: 1 },
    ...TERRAINS.map((t) => ({ id: `field-${t}`, name: t, terrain: t, resource: null, owner: 'b', dev: 3, pop: 30, region: 'r', infra: 0, fort: 0, integration: 100, claims: [], neighbors: ['home-a', 'home-b'] })),
  ];
  return {
    id: 'matrix',
    name: 'Matrix',
    description: 'combat matrix',
    startYear: 1930,
    nations: [nation('a', 'home-a'), nation('b', 'home-b')],
    regions: [{ id: 'r', name: 'R' }],
    straits: [],
    rivers: [],
    provinces,
    seaZones: [{ id: 'sea', name: 'Sea', neighbors: [], coasts: ['home-a', 'home-b'] }],
  };
}

registerScenario('matrix', matrixScenario);

/** 'early': what a realm knows around 1890 (no tanks yet); 'full': the whole tree. */
export type TechLevel = 'early' | 'full';

function fresh(level: TechLevel = 'full'): Sim {
  const sim = createGame({ scenario: 'matrix', seed: 3, playerNation: null });
  sim.state.armies = {};
  sim.state.fleets = {};
  const techs = level === 'full' ? TECH_LIST.map((t) => t.id) : [...startingTechs(1890), 'engineering_corps'];
  for (const n of Object.values(sim.state.nations)) n.research.done = techs;
  declareWar(sim, 'a', 'b', { type: 'conquest', provinces: ['field-plains'] });
  return sim;
}

function regimentsFor(mix: Partial<Record<UnitType, number>>): UnitType[] {
  const per = Object.entries(mix).reduce((s, [t, w]) => s + (w ?? 0) * (UNITS[t as UnitType].cost + UNITS[t as UnitType].materiel), 0);
  const scale = BUDGET / per;
  const out: UnitType[] = [];
  for (const [t, w] of Object.entries(mix)) for (let i = 0; i < Math.round((w ?? 0) * scale); i++) out.push(t as UnitType);
  return out;
}

function shipsFor(mix: Partial<Record<ShipType, number>>): ShipType[] {
  const per = Object.entries(mix).reduce((s, [t, w]) => s + (w ?? 0) * (SHIPS[t as ShipType].cost + SHIPS[t as ShipType].materiel), 0);
  const scale = (BUDGET * 1.5) / per;
  const out: ShipType[] = [];
  for (const [t, w] of Object.entries(mix)) for (let i = 0; i < Math.max(1, Math.round((w ?? 0) * scale)); i++) out.push(t as ShipType);
  return out;
}

/** Does the attacker win (even rolls) on this terrain? Also returns the loss ratio. */
export function landBout(att: string, def: string, terrain: Terrain, level: TechLevel = 'full'): { win: boolean; ratio: number } {
  const sim = fresh(level);
  const pid = `field-${terrain}`;
  const a = createArmy(sim, 'a', 'home-a', regimentsFor(ARMIES[att]).map((t) => newRegiment(sim, t)));
  const d = createArmy(sim, 'b', pid, regimentsFor(ARMIES[def]).map((t) => newRegiment(sim, t)));
  d.stationary = 2; // the defender has had time to dig in a little
  const f = forecastBattle(sim, pid, [a], [d], 'home-a');
  return { win: f.outcomes[1] === 'attacker', ratio: f.defLoss / Math.max(1, f.attLoss) };
}

/** Which fleet comes out ahead after a week of battle (share of fighting value kept)? */
export function seaBout(x: string, y: string): { win: boolean; kept: [number, number] } {
  const sim = fresh();
  const fa = createFleet(sim, 'a', 'sea', shipsFor(FLEETS[x]).map((t) => newShip(sim, t)), 'home-a');
  const fb = createFleet(sim, 'b', 'sea', shipsFor(FLEETS[y]).map((t) => newShip(sim, t)), 'home-b');
  const value = (id: string) => sim.state.fleets[id]?.ships.reduce((s, sh) => s + (SHIPS[sh.type].gun + SHIPS[sh.type].torpedo + SHIPS[sh.type].air + SHIPS[sh.type].antiSub) * SHIPS[sh.type].hull * sh.hp, 0) ?? 0;
  const va = value(fa.id);
  const vb = value(fb.id);
  bump(sim);
  touchFleets(sim);
  nextMemoEpoch();
  weeklyNaval(sim);
  const ka = value(fa.id) / va;
  const kb = value(fb.id) / vb;
  return { win: ka > kb, kept: [ka, kb] };
}

export interface LandMatrix {
  level: TechLevel;
  names: string[];
  /** pairings won per composition */
  wins: Record<string, { wins: number; bouts: number }>;
  rows: Array<{ att: string; def: string; terrain: Terrain; win: boolean; ratio: number }>;
  pairs: Array<{ x: string; y: string; terrain: Terrain; winner: string }>;
  dominant: string[];
}

export interface MatrixResult {
  land: LandMatrix[];
  sea: Record<string, { wins: number; bouts: number }>;
  seaRows: Array<{ x: string; y: string; win: boolean; kept: [number, number] }>;
  dominantLand: string[];
  dominantSea: string[];
}

export function landMatrix(level: TechLevel): LandMatrix {
  // no tanks before the Great War technologies
  const names = Object.keys(ARMIES).filter((n) => level === 'full' || !ARMIES[n].armour);
  const wins: LandMatrix['wins'] = Object.fromEntries(names.map((n) => [n, { wins: 0, bouts: 0 }]));
  const rows: LandMatrix['rows'] = [];
  for (const att of names) for (const def of names) if (att !== def) for (const t of TERRAINS) rows.push({ att, def, terrain: t, ...landBout(att, def, t, level) });
  // a pairing on a terrain goes to the side that trades better when it attacks
  // the other (losses inflicted per loss taken), so the defender's edge cancels out
  const ratio = (a: string, d: string, t: Terrain) => rows.find((x) => x.att === a && x.def === d && x.terrain === t)!.ratio;
  const pairs: LandMatrix['pairs'] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const [x, y] = [names[i], names[j]];
      for (const t of TERRAINS) {
        const winner = ratio(x, y, t) >= ratio(y, x, t) ? x : y;
        pairs.push({ x, y, terrain: t, winner });
        wins[x].bouts++;
        wins[y].bouts++;
        wins[winner].wins++;
      }
    }
  }
  return { level, names, wins, rows, pairs, dominant: names.filter((n) => wins[n].wins === wins[n].bouts) };
}

export function combatMatrix(): MatrixResult {
  const land = [landMatrix('early'), landMatrix('full')];
  const fl = Object.keys(FLEETS);
  const sea: MatrixResult['sea'] = Object.fromEntries(fl.map((n) => [n, { wins: 0, bouts: 0 }]));
  const seaRows: MatrixResult['seaRows'] = [];
  for (let i = 0; i < fl.length; i++) {
    for (let j = i + 1; j < fl.length; j++) {
      const [x, y] = [fl[i], fl[j]];
      const r = seaBout(x, y);
      seaRows.push({ x, y, ...r });
      sea[x].bouts++;
      sea[y].bouts++;
      if (r.win) sea[x].wins++;
      else sea[y].wins++;
    }
  }
  return {
    land,
    sea,
    seaRows,
    dominantLand: [...new Set(land.flatMap((m) => m.dominant))],
    dominantSea: fl.filter((n) => sea[n].wins === sea[n].bouts),
  };
}

const LEVEL_LABEL: Record<TechLevel, string> = { early: 'around 1890 (no tanks)', full: 'the whole technology tree' };

const isMain = process.argv[1]?.endsWith('matrix.ts');
if (isMain) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { dirname } = await import('node:path');
  const i = process.argv.indexOf('--out');
  const out = i >= 0 ? process.argv[i + 1] : null;
  const r = combatMatrix();
  const lines: string[] = [
    '# Combat matrix',
    '',
    `Equal-cost compositions (${BUDGET} crowns + materiel per army; ${BUDGET * 1.5} per fleet), through the real combat code. Generated by \`npx tsx tools/matrix.ts\`.`,
    '',
    'Land: each composition attacks each other one from a neighbouring province, against a defender dug in for two weeks, with the even-roll forecast. A pairing on a terrain goes to the composition that trades better attacking the other (enemy losses per own loss) than the other does attacking it, so the defender\'s edge cancels out. Sea: one week of battle in a zone, both sides with the whole tree; the side keeping the larger share of its fighting value wins.',
    '',
  ];
  for (const m of r.land) {
    lines.push(`## Land, ${LEVEL_LABEL[m.level]}`, '', '| Composition | Regiments | Pairings won | Pairings |', '|---|---|---|---|');
    for (const n of m.names) lines.push(`| ${n} | ${regimentsFor(ARMIES[n]).length} | ${m.wins[n].wins} | ${m.wins[n].bouts} |`);
    lines.push('', '| Pair | ' + TERRAINS.join(' | ') + ' |', '|---|' + TERRAINS.map(() => '---').join('|') + '|');
    for (let a = 0; a < m.names.length; a++) for (let b = a + 1; b < m.names.length; b++) {
      const [x, y] = [m.names[a], m.names[b]];
      lines.push(`| ${x} / ${y} | ${TERRAINS.map((t) => m.pairs.find((p) => p.x === x && p.y === y && p.terrain === t)!.winner).join(' | ')} |`);
    }
    lines.push('', `Attacks that win outright at equal cost: ${m.rows.filter((x) => x.win).length} of ${m.rows.length}. Loss ratios (enemy losses per own loss) when attacking:`, '', '| Attacker → defender | ' + TERRAINS.join(' | ') + ' |', '|---|' + TERRAINS.map(() => '---').join('|') + '|');
    for (const a of m.names) for (const d of m.names) {
      if (a === d) continue;
      lines.push(`| ${a} → ${d} | ${TERRAINS.map((t) => { const b = m.rows.find((x) => x.att === a && x.def === d && x.terrain === t)!; return `${b.ratio.toFixed(2)}${b.win ? ' (win)' : ''}`; }).join(' | ')} |`);
    }
    lines.push('', `Dominant composition: ${m.dominant.length ? m.dominant.join(', ') : 'none'}.`, '');
  }
  lines.push('## Sea, the whole technology tree', '', '| Composition | Ships | Wins | Bouts |', '|---|---|---|---|');
  for (const [n, v] of Object.entries(r.sea)) lines.push(`| ${n} | ${shipsFor(FLEETS[n]).length} | ${v.wins} | ${v.bouts} |`);
  lines.push('', '| Fleets | Winner | Value kept |', '|---|---|---|');
  for (const x of r.seaRows) lines.push(`| ${x.x} vs ${x.y} | ${x.win ? x.x : x.y} | ${(x.kept[0] * 100).toFixed(0)}% / ${(x.kept[1] * 100).toFixed(0)}% |`);
  lines.push('', `Dominant land composition: ${r.dominantLand.length ? r.dominantLand.join(', ') : 'none'}. Dominant fleet: ${r.dominantSea.length ? r.dominantSea.join(', ') : 'none'}.`);
  const text = lines.join('\n');
  console.log(text);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text + '\n');
  }
}
