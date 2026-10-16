// The quality-of-life audit in a production build: the large-force campaign
// (tools/qol-scenario.ts) loaded in the browser; what each unit-view mode shows
// at three zoom levels (markers by relation to the player), and the inputs it
// takes to build in ten provinces, raise troops in ten and order every army.
//   npm run build && npx tsx tools/qol-audit.ts [--dist dist] [--out reports/qol/before] [--phase before|after]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium, type Page } from 'playwright';
import { largeForceSave } from './qol-scenario';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const OUT = get('out', 'reports/qol/before');
const PHASE = get('phase', 'before');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

export async function serve(dist: string): Promise<{ origin: string; close: () => void }> {
  const server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = normalize(join(dist, rel));
    if (!file.startsWith(normalize(dist)) || !existsSync(file)) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  return { origin: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() };
}

/** Opens the game and loads a save through the game menu's Import file. */
export async function loadSave(page: Page, origin: string, file: string, player: string): Promise<void> {
  // tsx names the helpers inside page.evaluate callbacks with __name: give the page one
  await page.addInitScript('window.__name = (f) => f;');
  await page.goto(origin);
  await page.getByRole('button', { name: /New campaign/ }).click();
  await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
  await page.waitForSelector('canvas.map');
  await page.getByRole('button', { name: 'Game menu' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
  await chooser.setFiles(file);
  await page.waitForFunction((p) => (window as any).cnf.player === p, player, { timeout: 60000 });
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.setSpeed(0);
    document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
    app.ui.legendOpen = false;
    app.refresh();
  });
}

/** Markers on screen by relation to the player: armies (with the units they stand for), fleets, wings. */
async function markerCensus(page: Page): Promise<Record<string, Record<string, number>>> {
  return page.evaluate(() => {
    const app = (window as any).cnf;
    const sim = app.sim;
    const me = app.player;
    const rel = (nid: string) => (nid === me ? 'own' : app.renderer.relation(sim, nid, me));
    const out: Record<string, Record<string, number>> = { armies: {}, fleets: {}, wings: {} };
    const add = (k: string, r: string) => (out[k][r] = (out[k][r] ?? 0) + 1);
    for (const m of app.renderer.markers) {
      const a = sim.state.armies[m.army];
      if (a) add('armies', rel(a.nation));
    }
    for (const m of app.renderer.fleetMarkers) {
      const f = sim.state.fleets[m.fleet];
      if (f) add('fleets', rel(f.nation));
    }
    for (const m of app.renderer.wingMarkers) {
      const w = sim.state.wings[m.wings[0]];
      if (w) add('wings', rel(w.nation));
    }
    return out;
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  mkdirSync('reports/tmp', { recursive: true });
  const { text, force } = largeForceSave();
  writeFileSync('reports/tmp/qol-large.json', text);
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const report: Record<string, unknown> = { phase: PHASE, scenario: 'Europe 1936 as Germany: 13 armies (110 regiments), 3 fleets, 8 wings; at war with Poland, Romania and France beside Italy', neutrals: force.neutrals };
  try {
    await loadSave(page, origin, 'reports/tmp/qol-large.json', 'ger');
    // ── unit-view filters ──
    const views: Array<{ name: string; set: () => Promise<void> }> = [
      { name: 'near', set: () => page.evaluate(() => { const app = (window as any).cnf; const c = app.renderer.provinceCenter(app.sim.state.nations.pol.capital); app.renderer.camera.centerOn(c.x - 200, c.y, app.renderer.camera.zoomForProvincePx(60), false); app.mapDirty = true; }) },
      { name: 'regional', set: () => page.evaluate(() => { const app = (window as any).cnf; const c = app.renderer.provinceCenter('berlin' in app.sim.state.provinces ? 'berlin' : app.sim.state.nations.ger.capital); app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(26), false); app.mapDirty = true; }) },
      { name: 'far', set: () => page.evaluate(() => { const app = (window as any).cnf; app.fitWorld(); app.mapDirty = true; }) },
    ];
    const filters: Record<string, unknown> = {};
    for (const mode of ['all', 'relevant', 'mine']) {
      await page.evaluate((m) => (window as any).cnf.updateSettings({ armyMarkers: m }), mode);
      for (const v of views) {
        await v.set();
        await page.waitForTimeout(350);
        filters[`${mode}/${v.name}`] = await markerCensus(page);
        await page.screenshot({ path: join(OUT, `filter-${mode}-${v.name}.png`) });
      }
    }
    report.filters = filters;
    await page.evaluate(() => (window as any).cnf.updateSettings({ armyMarkers: 'relevant' }));

    // ── province work: railways in ten provinces, a regiment in each of ten ──
    const ten = await page.evaluate(() => {
      const app = (window as any).cnf;
      const sim = app.sim;
      return sim.world.provIds.filter((p: string) => sim.state.provinces[p].owner === 'ger' && sim.state.provinces[p].controller === 'ger' && !sim.state.provinces[p].project && sim.state.provinces[p].integration >= 80).slice(0, 10);
    });
    let inputs = 0;
    let built = 0;
    if (PHASE === 'before') {
      for (const pid of ten) {
        await page.evaluate((p) => (window as any).cnf.selectProvince(p, true), pid);
        inputs++; // click the province on the map
        await page.waitForTimeout(80);
        const b = page.locator('aside.inspector .ins-primary button:not([aria-disabled="true"])', { hasText: 'Build railway' }).first();
        if (await b.count()) {
          await b.click();
          inputs++;
          built++;
        }
        await page.waitForTimeout(60);
      }
    }
    const projects = await page.evaluate((list) => list.filter((p: string) => (window as any).cnf.sim.state.provinces[p].project?.kind === 'infra').length, ten);
    report.buildTen = { provinces: ten.length, inputs, clicked: built, railwaysQueued: projects, note: 'one click on the province, one on Build railway; finding each province on the map is not counted' };
    await page.screenshot({ path: join(OUT, 'build-ten.png') });

    let rInputs = 0;
    if (PHASE === 'before') {
      for (const pid of ten) {
        await page.evaluate((p) => (window as any).cnf.selectProvince(p, true), pid);
        rInputs++;
        await page.waitForTimeout(80);
        const b = page.locator('aside.inspector .action button:not([aria-disabled="true"])', { hasText: 'Raise Infantry' }).first();
        if (await b.count()) {
          await b.click();
          rInputs++;
        }
        await page.waitForTimeout(60);
      }
    }
    const queued = await page.evaluate((list) => list.reduce((s: number, p: string) => s + (window as any).cnf.sim.state.provinces[p].recruits.filter((r: any) => r.nation === 'ger').length, 0), ten);
    report.recruitTen = { provinces: ten.length, inputs: rInputs, regimentsQueued: queued };

    // ── ordering the army: every army towards the nearest enemy province, one at a time ──
    let oInputs = 0;
    let ordered = 0;
    if (PHASE === 'before') {
      const plan = await page.evaluate(() => {
        const app = (window as any).cnf;
        const sim = app.sim;
        return Object.values(sim.state.armies)
          .filter((a: any) => a.nation === 'ger')
          .map((a: any) => ({ id: a.id, dest: sim.world.prov[a.location].neighbors.find((n: string) => ['pol', 'fra'].includes(sim.state.provinces[n].controller)) ?? null }))
          .filter((x: any) => x.dest);
      });
      for (const o of plan) {
        await page.evaluate((id) => (window as any).cnf.selectArmy(id, true), o.id);
        oInputs++; // click the army's counter
        await page.waitForTimeout(80);
        const pt = await page.evaluate((id) => {
          const app = (window as any).cnf;
          const r = app.canvas.getBoundingClientRect();
          const c = app.renderer.provinceCenter(id);
          const s = app.renderer.camera.toScreen(c.x, c.y);
          for (let d = 0; d < 80; d += 4)
            for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0], [d, d], [-d, -d]]) {
              const x = s.x + dx;
              const y = s.y + dy;
              if (app.renderer.provinceAt(x, y) === id && !app.renderer.armyAt(x, y) && !app.renderer.fleetAt(x, y)) return { x: x + r.left, y: y + r.top };
            }
          return null;
        }, o.dest);
        if (pt) {
          await page.mouse.click(pt.x, pt.y, { button: 'right' });
          oInputs++;
          await page.waitForTimeout(120);
          // an order menu may open: the first item is the march
          const item = page.locator('.order-menu .order-item').first();
          if (await item.count()) {
            await item.click();
            oInputs++;
          }
        }
        if (await page.evaluate((id) => ((window as any).cnf.sim.state.armies[id]?.path.length ?? 0) > 0, o.id)) ordered++;
      }
      report.orderAll = { armies: plan.length, ordered, inputs: oInputs, note: 'each army: click its counter, right-click the target (and pick the march if a menu opens); repeated for every new province and every week the situation changes' };
    }
    await page.screenshot({ path: join(OUT, 'orders.png') });
  } finally {
    report.errors = errors;
    writeFileSync(join(OUT, 'audit.json'), `${JSON.stringify(report, null, 1)}\n`);
    await browser.close();
    close();
  }
  console.log(JSON.stringify(report, null, 1));
}

if (process.argv[1]?.endsWith('qol-audit.ts')) void main();
