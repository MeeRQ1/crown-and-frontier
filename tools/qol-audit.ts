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


/** A screen point inside a province (not on a counter), after centring the camera on it (centring is not an input). */
async function provincePoint(page: Page, pid: string): Promise<{ x: number; y: number } | null> {
  await page.evaluate((id) => {
    const app = (window as any).cnf;
    const c0 = app.renderer.provinceCenter(id);
    app.renderer.camera.centerOn(c0.x, c0.y, Math.max(app.renderer.camera.zoom, app.renderer.camera.zoomForProvincePx(40)), false);
    app.mapDirty = true;
  }, pid);
  await page.waitForTimeout(120);
  return page.evaluate((id) => {
    const app = (window as any).cnf;
    const r = app.canvas.getBoundingClientRect();
    const c = app.renderer.provinceCenter(id);
    const s = app.renderer.camera.toScreen(c.x, c.y);
    for (let d = 0; d < 80; d += 4)
      for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0], [d, d], [-d, -d]]) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (app.renderer.provinceAt(x, y) === id && !app.renderer.armyAt(x, y) && !app.renderer.fleetAt(x, y) && !app.renderer.wingAt(x, y)) return { x: x + r.left, y: y + r.top };
      }
    return null;
  }, pid);
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
    if (PHASE === 'after') {
      // Ctrl+click each of the ten provinces on the map, then confirm once (the card opens on Build, railway)
      for (const pid of ten) {
        const pt = await provincePoint(page, pid);
        if (!pt) continue;
        await page.keyboard.down('Control');
        await page.mouse.click(pt.x, pt.y);
        await page.keyboard.up('Control');
        inputs++;
        await page.waitForTimeout(60);
      }
      await page.screenshot({ path: join(OUT, 'build-ten-preview.png') });
      const ok = page.locator('[data-fk="batch-confirm"]:not([aria-disabled="true"])');
      if (await ok.count()) {
        await ok.click();
        inputs++;
        built = await page.evaluate(() => (window as any).cnf.batch.last?.details.filter((d: string) => /queued/.test(d)).length ?? 0);
      }
      // a second click on the same request sends nothing
      await page.locator('[data-fk="batch-confirm"]').click({ force: true }).catch(() => undefined);
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
    if (PHASE === 'after') {
      await page.evaluate(() => (window as any).cnf.clearProvSel());
      rInputs++; // Esc
      for (const pid of ten) {
        const pt = await provincePoint(page, pid);
        if (!pt) continue;
        await page.keyboard.down('Control');
        await page.mouse.click(pt.x, pt.y);
        await page.keyboard.up('Control');
        rInputs++;
        await page.waitForTimeout(60);
      }
      await page.locator('[data-fk="batch-tab-recruit"]').click();
      rInputs++;
      await page.screenshot({ path: join(OUT, 'recruit-ten-preview.png') });
      const ok = page.locator('[data-fk="batch-confirm"]:not([aria-disabled="true"])');
      if (await ok.count()) {
        await ok.click();
        rInputs++;
      }
      await page.evaluate(() => (window as any).cnf.clearProvSel());
    }
    const queued = await page.evaluate((list) => list.reduce((s: number, p: string) => s + (window as any).cnf.sim.state.provinces[p].recruits.filter((r: any) => r.nation === 'ger').length, 0), ten);
    report.recruitTen = { provinces: ten.length, inputs: rInputs, regimentsQueued: queued };
    if (PHASE === 'after') {
      // the quick way: a box over a region (Ctrl+drag), Only ours, Recruit, confirm
      await page.evaluate(() => {
        const app = (window as any).cnf;
        const c = app.renderer.provinceCenter(app.sim.state.nations.ger.capital);
        app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(36), false);
        app.mapDirty = true;
      });
      await page.waitForTimeout(300);
      const before = await page.evaluate(() => Object.values((window as any).cnf.sim.state.provinces).reduce((s: number, p: any) => s + p.recruits.filter((r: any) => r.nation === 'ger').length, 0));
      let bInputs = 0;
      await page.keyboard.down('Control');
      await page.mouse.move(420, 260);
      await page.mouse.down();
      await page.mouse.move(560, 380, { steps: 4 });
      await page.mouse.move(700, 500, { steps: 4 });
      await page.mouse.up();
      await page.keyboard.up('Control');
      bInputs++;
      const selected = await page.evaluate(() => (window as any).cnf.provSel.length);
      const ours = page.locator('[data-fk="batch-ours"]:not([aria-disabled="true"])');
      if (await ours.count()) {
        await ours.click();
        bInputs++;
      }
      await page.locator('[data-fk="batch-tab-recruit"]').click();
      bInputs++;
      const ok = page.locator('[data-fk="batch-confirm"]:not([aria-disabled="true"])');
      if (await ok.count()) {
        await ok.click();
        bInputs++;
      }
      const after = await page.evaluate(() => Object.values((window as any).cnf.sim.state.provinces).reduce((s: number, p: any) => s + p.recruits.filter((r: any) => r.nation === 'ger').length, 0));
      await page.screenshot({ path: join(OUT, 'recruit-box.png') });
      report.recruitBox = { provincesSelected: selected, provincesOurs: await page.evaluate(() => (window as any).cnf.provSel.length), inputs: bInputs, regimentsQueued: after - before };
      await page.evaluate(() => (window as any).cnf.clearProvSel());
    }

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
    if (PHASE === 'after') {
      // every army at once: Shift+drag a box over Germany, New operation, Enemy land within reach, Activate
      await page.evaluate(() => {
        const app = (window as any).cnf;
        const c = app.renderer.provinceCenter(app.sim.state.nations.ger.capital);
        app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoomForProvincePx(18), false);
        app.mapDirty = true;
      });
      await page.waitForTimeout(400);
      const box = await page.evaluate(() => {
        const app = (window as any).cnf;
        const r = app.canvas.getBoundingClientRect();
        const ms = app.renderer.markers.filter((m: any) => app.sim.state.armies[m.army]?.nation === 'ger');
        const xs = ms.flatMap((m: any) => [m.x, m.x + m.w]);
        const ys = ms.flatMap((m: any) => [m.y, m.y + m.h]);
        return { x0: Math.min(...xs) - 6 + r.left, y0: Math.min(...ys) - 6 + r.top, x1: Math.max(...xs) + 6 + r.left, y1: Math.max(...ys) + 6 + r.top };
      });
      await page.keyboard.down('Shift');
      await page.mouse.move(box.x0, box.y0);
      await page.mouse.down();
      await page.mouse.move((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, { steps: 4 });
      await page.mouse.move(box.x1, box.y1, { steps: 4 });
      await page.mouse.up();
      await page.keyboard.up('Shift');
      oInputs++;
      const selected = await page.evaluate(() => (window as any).cnf.forceSel.filter((id: string) => (window as any).cnf.sim.state.armies[id]).length);
      await page.locator('[data-fk="op-new"]').click();
      oInputs++;
      await page.locator('[data-fk="op-fill"]').click();
      oInputs++;
      await page.screenshot({ path: join(OUT, 'op-editor.png') });
      await page.locator('[data-fk="op-activate"]').click();
      oInputs++;
      await page.waitForTimeout(200);
      const members = await page.evaluate(() => Object.values((window as any).cnf.sim.state.armies).filter((a: any) => a.nation === 'ger' && a.op).length);
      await page.evaluate(() => (window as any).cnf.debugAdvance(1));
      await page.waitForTimeout(300);
      ordered = await page.evaluate(() => Object.values((window as any).cnf.sim.state.armies).filter((a: any) => a.nation === 'ger' && a.op && (a.path.length || a.battle)).length);
      const tasks = await page.evaluate(() => {
        const op = Object.values((window as any).cnf.sim.state.operations)[0] as any;
        return op ? Object.values(op.tasks).reduce((m: any, t: any) => ((m[t.kind] = (m[t.kind] ?? 0) + 1), m), {}) : {};
      });
      await page.screenshot({ path: join(OUT, 'op-card.png') });
      report.orderAll = { armies: 13, selectedByBox: selected, members, marchingOrFighting: ordered, tasks, inputs: oInputs, note: 'Shift+drag a box over our armies, New operation, Enemy land within reach, Activate; the operation then gives the routine orders every week' };
    }
    await page.screenshot({ path: join(OUT, 'orders.png') });

    // ── touch sizes: the Select tool, the selection and batch cards, the editor on a narrow screen ──
    if (PHASE === 'after') {
      const touch: Record<string, unknown> = {};
      for (const vp of [
        { name: 'tablet', width: 1024, height: 768 },
        { name: 'phone', width: 390, height: 844 },
      ]) {
        const tp = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.name === 'phone' });
        tp.on('pageerror', (e) => errors.push(`${vp.name}: ${e.message}`));
        await loadSave(tp, origin, 'reports/tmp/qol-large.json', 'ger');
        await tp.evaluate(() => {
          const app = (window as any).cnf;
          const c = app.renderer.provinceCenter(app.sim.state.nations.pol.capital);
          app.renderer.camera.centerOn(c.x - 200, c.y, app.renderer.camera.zoomForProvincePx(40), false);
          app.mapDirty = true;
        });
        await tp.waitForTimeout(400);
        const sel = tp.locator('[data-fk="nav-select"]');
        const hasTool = await sel.count();
        if (hasTool) await sel.tap();
        await tp.waitForTimeout(200);
        const pts = await tp.evaluate(() => {
          const app = (window as any).cnf;
          const r = app.canvas.getBoundingClientRect();
          return app.renderer.markers.filter((m: any) => app.sim.state.armies[m.army]?.nation === 'ger').slice(0, 3).map((m: any) => ({ x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top }));
        });
        for (const p of pts) await tp.touchscreen.tap(p.x, p.y);
        await tp.waitForTimeout(250);
        const forces = await tp.evaluate(() => (window as any).cnf.forceSel.length);
        await tp.screenshot({ path: join(OUT, `touch-${vp.name}-forces.png`) });
        // to provinces: the banner's switch (the map buttons are under the card on small screens)
        const sw = tp.locator('[data-fk="banner-switch"]');
        if (await sw.count()) await sw.tap();
        await tp.waitForTimeout(150);
        const ppts = await tp.evaluate(() => {
          const app = (window as any).cnf;
          const r = app.canvas.getBoundingClientRect();
          const out: Array<{ x: number; y: number }> = [];
          for (let y = 120; y < r.height - 120 && out.length < 3; y += 37)
            for (let x = 40; x < r.width - 40 && out.length < 3; x += 53) {
              const p = app.renderer.provinceAt(x, y);
              if (p && app.sim.state.provinces[p].owner === 'ger' && !app.renderer.armyAt(x, y) && !app.renderer.wingAt(x, y) && !out.some((q) => app.renderer.provinceAt(q.x - r.left, q.y - r.top) === p)) out.push({ x: x + r.left, y: y + r.top });
            }
          return out;
        });
        for (const p of ppts) await tp.touchscreen.tap(p.x, p.y);
        await tp.waitForTimeout(250);
        const provinces = await tp.evaluate(() => (window as any).cnf.provSel.length);
        await tp.screenshot({ path: join(OUT, `touch-${vp.name}-provinces.png`) });
        // the editor on this screen
        await tp.evaluate(() => {
          const app = (window as any).cnf;
          app.clearProvSel();
          app.setSelectMode('off');
          const ids = Object.values(app.sim.state.armies).filter((a: any) => a.nation === 'ger').slice(0, 4).map((a: any) => a.id);
          app.setForceSel(ids);
          app.startOpDraft();
        });
        await tp.waitForTimeout(300);
        await tp.screenshot({ path: join(OUT, `touch-${vp.name}-editor.png`) });
        const overflow = await tp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        touch[vp.name] = { selectTool: !!hasTool, forcesTapped: pts.length, forcesSelected: forces, provincesTapped: ppts.length, provincesSelected: provinces, horizontalOverflow: overflow };
        await tp.close();
      }
      report.touch = touch;
    }
  } finally {
    report.errors = errors;
    writeFileSync(join(OUT, 'audit.json'), `${JSON.stringify(report, null, 1)}\n`);
    await browser.close();
    close();
  }
  console.log(JSON.stringify(report, null, 1));
}

if (process.argv[1]?.endsWith('qol-audit.ts')) void main();
