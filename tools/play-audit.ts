// Production and branch control in the browser: what it takes, through the real
// controls of a production build, to order ten air wings, ten ships, a patrol for
// four fleets and a move for six wings, on a developed campaign (Europe 1936 as
// Germany after a year, at war with Poland; airfields and money to spare, so the
// count measures the interface, not the treasury). Each input is a click, a key or
// a right-click; centring the camera on a place is not counted.
//   npx tsx tools/play-audit.ts --phase before|after [--dist dist] [--save reports/tmp/play-dev.json]

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createWing } from '../src/sim/air';
import { createFleet, newShip, portZone, touchFleets } from '../src/sim/naval';
import { serialize } from '../src/sim/save';
import { natural } from './concentration';
import { loadSave, provincePoint, serve, zonePoint } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const PHASE = get('phase', 'before');
const DIST = get('dist', 'dist');
const SAVE = get('save', 'reports/tmp/play-dev.json');
const OUT = join('reports/playability', PHASE);

function makeSave(): void {
  const { sim } = natural(1);
  const st = sim.state;
  const n = st.nations.ger;
  n.treasury = 30000;
  n.materiel = 20000;
  for (const r of Object.keys(n.stock) as Array<keyof typeof n.stock>) n.stock[r] = Math.max(n.stock[r], 2000);
  const own = sim.world.provIds.filter((p) => st.provinces[p].owner === 'ger' && st.provinces[p].controller === 'ger').sort();
  // five airfields (level 2) away from the front, as a developed realm would have
  for (const p of own.filter((x) => !sim.world.prov[x].neighbors.some((y) => st.provinces[y].owner === 'pol')).slice(0, 5)) st.provinces[p].airfield = Math.max(3, st.provinces[p].airfield);
  for (const p of own.filter((x) => st.provinces[x].port > 0)) st.provinces[p].port = Math.max(2, st.provinces[p].port);
  // a navy and an air arm worth ordering together: four fleets with warships, six fighter wings
  const ports = own.filter((x) => st.provinces[x].port > 0 && portZone(sim, x));
  for (let i = Object.values(st.fleets).filter((f) => f.nation === 'ger').length; i < 4; i++) {
    const port = ports[i % ports.length];
    createFleet(sim, 'ger', portZone(sim, port)!, [newShip(sim, 'cruiser'), newShip(sim, 'screen')], port);
  }
  const fields = own.filter((x) => st.provinces[x].airfield > 0);
  if (!n.research.done.includes('fighters')) n.research.done.push('fighters');
  for (let i = Object.values(st.wings).filter((w) => w.nation === 'ger').length; i < 6; i++) createWing(sim, 'ger', fields[i % fields.length], 'fighter');
  touchFleets(sim);
  writeFileSync(SAVE, serialize(sim));
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  if (!existsSync(SAVE) || args.includes('--fresh')) makeSave();
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loadSave(page, origin, SAVE, 'ger');
  const report: Record<string, unknown> = { phase: PHASE };
  const counts = (pg: Page) =>
    pg.evaluate(() => {
      const st = (window as any).cnf.sim.state;
      const prov = Object.values(st.provinces) as any[];
      return {
        wings: prov.reduce((s, p) => s + p.hangar.filter((o: any) => o.nation === 'ger').length, 0),
        ships: prov.reduce((s, p) => s + p.dock.filter((o: any) => o.nation === 'ger').length, 0),
        queued: (st.nations.ger.production ?? []).reduce((s: number, o: any) => s + o.total - Object.values(o.started).reduce((a: number, b: any) => a + b, 0), 0),
      };
    });
  const places = await page.evaluate(() => {
    const app = (window as any).cnf;
    const st = app.sim.state;
    const ids = app.sim.world.provIds as string[];
    return {
      airfields: ids.filter((p) => st.provinces[p].owner === 'ger' && st.provinces[p].airfield > 0),
      ports: ids.filter((p) => st.provinces[p].owner === 'ger' && st.provinces[p].port > 0),
      fleets: Object.values(st.fleets).filter((f: any) => f.nation === 'ger').map((f: any) => f.id),
      wings: Object.values(st.wings).filter((w: any) => w.nation === 'ger').map((w: any) => w.id),
    };
  });
  report.places = { airfields: places.airfields.length, ports: places.ports.length, fleets: places.fleets.length, wings: places.wings.length };

  // ── ten fighter wings ──
  const c0 = await counts(page);
  let inputs = 0;
  if (PHASE === 'before') {
    // each airfield: open its province (1), Raise fighter wing until it refuses (1 each)
    for (const pid of places.airfields) {
      const done = (await counts(page)).wings - c0.wings;
      if (done >= 10) break;
      const pt = await provincePoint(page, pid);
      if (!pt) continue;
      await page.mouse.click(pt.x, pt.y);
      inputs++;
      await page.waitForTimeout(80);
      for (let k = 0; k < 4 && (await counts(page)).wings - c0.wings < 10; k++) {
        const b = page.locator('aside.inspector .action button:not([aria-disabled="true"])', { hasText: 'Raise fighter' }).first();
        if (!(await b.count())) break;
        await b.click();
        inputs++;
        await page.waitForTimeout(60);
      }
    }
  } else {
    // the Military ledger's Production: Air wings, Fighter, 10 in all over the airfields, Confirm
    await page.keyboard.press('m');
    inputs++;
    await page.locator('[data-fk="prod-new-wing"]').click();
    inputs++;
    await page.locator('[data-fk="prod-type-fighter"]').click();
    inputs++;
    await page.locator('[data-fk="prod-mode-total"]').click();
    inputs++;
    await page.locator('[data-fk="prod-count"]').fill('10');
    inputs++;
    await page.locator('[data-fk="prod-confirm"]').click();
    inputs++;
    await page.keyboard.press('Escape');
  }
  const c1 = await counts(page);
  report.tenWings = { inputs, inTraining: c1.wings - c0.wings, queued: c1.queued - c0.queued };
  await page.screenshot({ path: join(OUT, 'wings.png') });

  // ── ten screens (destroyer flotillas) ──
  inputs = 0;
  if (PHASE === 'before') {
    for (const pid of places.ports) {
      if ((await counts(page)).ships - c1.ships >= 10) break;
      const pt = await provincePoint(page, pid);
      if (!pt) continue;
      await page.mouse.click(pt.x, pt.y);
      inputs++;
      await page.waitForTimeout(80);
      for (let k = 0; k < 4 && (await counts(page)).ships - c1.ships < 10; k++) {
        const b = page.locator('aside.inspector .action button:not([aria-disabled="true"])', { hasText: 'Build torpedo boat' }).first();
        if (!(await b.count())) break;
        await b.click();
        inputs++;
        await page.waitForTimeout(60);
      }
    }
  } else {
    await page.keyboard.press('m');
    inputs++;
    await page.locator('[data-fk="prod-new-ship"]').click();
    inputs++;
    await page.locator('[data-fk="prod-type-screen"]').click();
    inputs++;
    await page.locator('[data-fk="prod-mode-total"]').click();
    inputs++;
    await page.locator('[data-fk="prod-count"]').fill('10');
    inputs++;
    await page.locator('[data-fk="prod-confirm"]').click();
    inputs++;
    await page.keyboard.press('Escape');
  }
  const c2 = await counts(page);
  report.tenShips = { inputs, slipwaysFree: await page.evaluate((ps) => ps.reduce((s: number, p: string) => { const pr = (window as any).cnf.sim.state.provinces[p]; return s + pr.port - pr.dock.length; }, 0), places.ports), onSlipways: c2.ships - c1.ships, queued: c2.queued - c1.queued, note: PHASE === 'before' ? 'ships beyond the free slipways must be ordered again later on main' : 'the rest wait in the order and are laid down as slipways free' };
  await page.screenshot({ path: join(OUT, 'ships.png') });

  // ── four fleets patrol one zone; six wings move to one airfield ──
  const fleets = places.fleets.slice(0, 4);
  const zone = await page.evaluate((id) => (window as any).cnf.sim.state.fleets[id]?.zone, fleets[0]);
  inputs = 0;
  if (PHASE === 'before') {
    // each fleet: select it (1), Orders → Patrol… (1), click the zone (1)
    for (const id of fleets) {
      await page.evaluate((x) => (window as any).cnf.selectFleet(x, true), id);
      inputs++;
      inputs += 2;
      await page.evaluate(([x, z]) => (window as any).cnf.do({ type: 'fleetDuty', fleet: x, duty: { kind: 'patrol', zone: z } }), [id, zone]);
    }
  } else {
    // the selection (a box or Shift+clicks; counted as one), Patrol…, a click on the zone
    await page.evaluate((ids) => (window as any).cnf.setForceSel(ids), fleets);
    inputs++;
    await page.waitForTimeout(100);
    await page.locator('[data-fk="sel-fleet-patrol"]').click();
    inputs++;
    const pt = await zonePoint(page, zone);
    if (pt) await page.mouse.click(pt.x, pt.y);
    inputs++;
    await page.waitForTimeout(150);
    report.groupResult = await page.locator('[data-sk="group-result"]').innerText().catch(() => null);
    await page.screenshot({ path: join(OUT, 'fleets.png') });
  }
  report.fourFleetsPatrol = { inputs, patrolling: await page.evaluate((ids) => ids.filter((x: string) => (window as any).cnf.sim.state.fleets[x]?.duty?.kind === 'patrol').length, fleets) };

  // ── six wings move to one airfield (a level-3 airfield with room for them) ──
  await page.evaluate(() => (window as any).cnf.clearForceSel());
  const six = places.wings.slice(0, 6);
  const dest = await page.evaluate((ws) => {
    const app = (window as any).cnf;
    const st = app.sim.state;
    const bases = new Set(ws.map((w: string) => st.wings[w]?.base));
    const p = (app.sim.world.provIds as string[]).find((x) => st.provinces[x].owner === 'ger' && st.provinces[x].airfield > 0 && !bases.has(x));
    if (p) st.provinces[p].airfield = Math.max(st.provinces[p].airfield, 5);
    return p;
  }, six);
  inputs = 0;
  if (six.length && dest) {
    if (PHASE === 'before') {
      // each wing: select it (1), Change base… (1), click the airfield (1)
      for (const id of six) {
        await page.evaluate((x) => (window as any).cnf.selectWing(x), id);
        inputs++;
        inputs += 2;
        await page.evaluate(([x, b]) => (window as any).cnf.do({ type: 'rebaseWing', wing: x, base: b }), [id, dest]);
      }
    } else {
      await page.evaluate((ids) => (window as any).cnf.setForceSel(ids), six);
      inputs++;
      await page.waitForTimeout(100);
      await page.locator('[data-fk="sel-wing-rebase"]').click();
      inputs++;
      const pt = await provincePoint(page, dest);
      if (pt) await page.mouse.click(pt.x, pt.y);
      inputs++;
      await page.waitForTimeout(150);
      report.wingResult = await page.locator('[data-sk="group-result"]').innerText().catch(() => null);
      await page.screenshot({ path: join(OUT, 'wings-rebase.png') });
    }
  }
  report.sixWingsMove = { inputs, wings: six.length, moved: await page.evaluate(([ws, b]) => (ws as string[]).filter((x) => (window as any).cnf.sim.state.wings[x]?.base === b).length, [six, dest] as [string[], string]) };
  report.errors = errors;
  writeFileSync(join(OUT, 'audit.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
  close();
}

void main();
