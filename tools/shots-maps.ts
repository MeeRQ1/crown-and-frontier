// Screenshots of the denser maps' interface and the homeland defence, on a production build:
//   - the Industry ledger's room to build (Europe 1914, France)
//   - a province card with its land and development limit
//   - a campaign begun before the redraw, loaded (the notice)
//   - Auto-conquer defending our land (the Reach, Fenward invaded)
//   npm run build && npx tsx tools/shots-maps.ts [--dist dist] [--out reports/playability/after]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import '../src/maps/builtin';
import { applyCommand } from '../src/sim/commands';
import { createGame } from '../src/sim/game';
import { createArmy, newRegiment } from '../src/sim/military';
import { serialize } from '../src/sim/save';
import { step } from '../src/sim/tick';
import { declareWar } from '../src/sim/war';
import { loadSave, serve } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const OUT = get('out', 'reports/playability/after');
const TMP = 'reports/tmp';

/** Europe 1914 as France, at the start. */
function franceSave(): string {
  const sim = createGame({ scenario: 'europe', seed: 1, playerNation: 'fra' });
  const path = join(TMP, 'shots-europe-fra.json');
  writeFileSync(path, serialize(sim));
  return path;
}

/** The Reach as Fenward, invaded by a much stronger Drevenholt, Auto-conquer active. */
function invadedSave(): { path: string; op: string } {
  const sim = createGame({ scenario: 'reach', seed: 1, playerNation: 'fen' });
  const st = sim.state;
  const ours = sim.world.provIds.filter((p) => st.provinces[p].owner === 'fen');
  const enemy = Object.keys(st.nations).find((n) => n !== 'fen' && ours.some((p) => sim.world.prov[p].neighbors.some((q) => st.provinces[q].owner === n)))!;
  const border = sim.world.provIds.find((p) => st.provinces[p].owner === enemy && sim.world.prov[p].neighbors.some((q) => st.provinces[q].owner === 'fen'))!;
  // the invader already stands in our border province
  const entered = ours.find((p) => sim.world.prov[p].neighbors.includes(border) && p !== st.nations.fen.capital)!;
  declareWar(sim, enemy, 'fen', { type: 'conquest', provinces: [entered] });
  createArmy(sim, enemy, entered, Array.from({ length: 24 }, () => newRegiment(sim, 'infantry', 1000)));
  const r = applyCommand(sim, { type: 'createOp', nation: 'fen', kind: 'war', area: [], enemies: [enemy], activate: true });
  if (!r.ok) throw new Error(r.reason);
  const op = Object.values(st.operations).at(-1)!.id;
  for (let i = 0; i < 4; i++) step(sim);
  const path = join(TMP, 'shots-reach-invaded.json');
  writeFileSync(path, serialize(sim));
  return { path, op };
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, name) });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const notes: Record<string, unknown> = {};

  await loadSave(page, origin, franceSave(), 'fra');
  await page.evaluate(() => (window as any).cnf.openLedger('industry'));
  await page.locator('[data-sk="build-room"]').first().scrollIntoViewIfNeeded().catch(() => undefined);
  notes.buildRoom = await page.locator('[data-sk="build-room"]').first().textContent().catch(() => null);
  await shot(page, 'maps-industry-room.png');
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as any).cnf.selectProvince('paris', true));
  await shot(page, 'maps-province-land.png');

  // a campaign begun on revision 1 (a real save of the main build), through Import file
  await page.getByRole('button', { name: 'Game menu' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
  await chooser.setFiles('tests/fixtures/europe-r1-save-format8-9be7367.json');
  await page.waitForFunction(() => (window as any).cnf.sim?.state.scenarioId === 'europe-r1', null, { timeout: 60000 });
  await page.waitForTimeout(600);
  notes.oldSaveNotice = await page.locator('.modal-layer:not(.hidden)').first().textContent().catch(() => null);
  await shot(page, 'maps-old-save-notice.png');
  await page.evaluate(() => document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click()));

  const inv = invadedSave();
  await loadSave(page, origin, inv.path, 'fen');
  await page.evaluate((id) => (window as any).cnf.selectOp(id), inv.op);
  await page.waitForTimeout(300);
  // the card's log, where the mandate says what it is doing
  await page.getByText(/Defending our land/).first().scrollIntoViewIfNeeded().catch(() => undefined);
  notes.homeland = await page.evaluate((id) => (window as any).cnf.sim.state.operations[id].log.map((l: { text: string }) => l.text).filter((t: string) => /Defending our land|All our land|threat to our land/.test(t)), inv.op);
  await shot(page, 'autoconquer-homeland.png');

  notes.errors = errors;
  writeFileSync(join(OUT, 'shots-maps.json'), JSON.stringify(notes, null, 1));
  console.log(JSON.stringify(notes, null, 1));
  await browser.close();
  close();
}

await main();
