// Verifies the production build in a real browser (Playwright + Chromium).
//   npm run build && npm run package && npm run verify:web
// Serves dist/ at the site root and under a project subpath, the unpacked
// release ZIP, and an iframe host page, then exercises the player flow.
// Writes reports/web-verification.md; exits non-zero on any failure.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { chromium, type Browser, type Page } from 'playwright';
import { mapChecksum, type MapPackage } from '../src/maps/format';
import { parseMapPackage } from '../src/maps/validate';
import { seaAirSave } from './sea-air-save';
import { diploSave } from './diplo-save';
import { SCHEMA_VERSION } from '../src/sim/config';

const DIST = 'dist';
const ZIP = 'release/crown-and-frontier-web.zip';
const SUB = '/crown-and-frontier/';
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function unzip(path: string): Map<string, Buffer> {
  const buf = readFileSync(path);
  const files = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    const lnlen = buf.readUInt16LE(off + 26);
    const lxlen = buf.readUInt16LE(off + 28);
    const data = buf.subarray(off + 30 + lnlen + lxlen, off + 30 + lnlen + lxlen + csize);
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nlen + xlen + clen;
  }
  return files;
}

const HOST = `<!doctype html><html><head><meta charset="utf-8"><title>Embed host</title>
<style>body{margin:0;font-family:sans-serif;background:#eee} .spacer{height:2000px} iframe{border:2px solid #333;display:block;margin:40px}</style></head>
<body><h1>Portal page</h1><iframe id="game" src="${SUB}" width="900" height="560" allow="autoplay; fullscreen"></iframe><div class="spacer">page content below</div></body></html>`;

function startServer(zipFiles: Map<string, Buffer> | null): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const send = (status: number, body: Buffer | string, type = 'text/plain') => {
      res.writeHead(status, { 'content-type': type });
      res.end(body);
    };
    if (url === '/host.html') return send(200, HOST, MIME['.html']);
    if (url.startsWith('/zip/')) {
      const name = url.slice(5) || 'index.html';
      const f = zipFiles?.get(name);
      return f ? send(200, f, MIME[extname(name)] ?? 'application/octet-stream') : send(404, 'not found');
    }
    let rel = url.startsWith(SUB) ? url.slice(SUB.length) : url.slice(1);
    if (!rel || rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(DIST, rel));
    if (!file.startsWith(normalize(DIST)) || !existsSync(file)) return send(404, 'not found');
    send(200, readFileSync(file), MIME[extname(file)] ?? 'application/octet-stream');
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port })));
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
const checks: Check[] = [];
function record(name: string, ok: boolean, detail = ''): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function watch(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return problems;
}

async function startCampaign(page: Page): Promise<void> {
  await page.getByRole('button', { name: /New campaign/ }).click();
  await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
  await page.waitForSelector('canvas.map');
  await page.waitForTimeout(500);
}

async function canvasDrawn(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const c = document.querySelector('canvas.map') as HTMLCanvasElement | null;
    if (!c) return false;
    const g = c.getContext('2d')!;
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 997) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size > 12;
  });
}

async function flow(browser: Browser, base: string, label: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const problems = await watch(page);
  const t0 = Date.now();
  await page.goto(base);
  await page.waitForSelector('.screen .menu-list button', { timeout: 15000 });
  const loadMs = Date.now() - t0;
  await startCampaign(page);
  const drawn = await canvasDrawn(page);
  const info = await page.evaluate(() => {
    const a = (window as any).cnf;
    return `${a.sim.state.scenarioId}, ${a.sim.world.provIds.length} provinces`;
  });
  record(`${label}: loads, starts a campaign and draws the map`, drawn && problems.length === 0, `menu in ${loadMs} ms; ${info}${problems.length ? `; ${problems.slice(0, 3).join('; ')}` : ''}`);
  await page.close();
}

/** Campaign setup: choose the quick map, a realm, begin; map modes and navigation keys. */
async function mapChoice(browser: Browser, base: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const problems = await watch(page);
  await page.goto(base);
  await page.waitForSelector('.screen .menu-list button', { timeout: 15000 });
  await page.getByRole('button', { name: /New campaign/ }).click();
  await page.locator('[data-map="reach"]').click();
  await page.locator('[data-realm="fen"]').click();
  await page.waitForTimeout(300);
  await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
  await page.waitForSelector('canvas.map');
  await page.waitForTimeout(400);
  const st = await page.evaluate(() => {
    const a = (window as any).cnf;
    return { map: a.sim.state.scenarioId, n: a.sim.world.provIds.length, player: a.player };
  });
  record('Campaign setup starts the chosen map and realm (the Reach, Fenward)', st.map === 'reach' && st.n === 99 && st.player === 'fen' && problems.length === 0, `${st.map}, ${st.n} provinces, ${st.player}`);
  await page.locator('canvas.map').focus();
  await page.keyboard.press('Shift+Digit2');
  await page.waitForTimeout(100);
  const mode = await page.evaluate(() => (window as any).cnf.mode);
  const z0 = await page.evaluate(() => (window as any).cnf.renderer.camera.zoom);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(900);
  const z1 = await page.evaluate(() => (window as any).cnf.renderer.camera.zoom);
  record('Keyboard: Shift+2 shows the Terrain map; F fits the whole map', mode === 'terrain' && z1 < z0, `mode ${mode}, zoom ${z0.toFixed(3)} → ${z1.toFixed(3)}`);
  // the Diplomacy ledger shows the diplomacy map while it is open, then puts the player's map back
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(150);
  const during = await page.evaluate(() => (window as any).cnf.mode);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => (window as any).cnf.mode);
  record('Closing Diplomacy restores the map mode it replaced', during === 'diplomacy' && after === 'terrain', `${mode} → ${during} → ${after}`);
  await page.close();
}

/** Navy and air through the interface: blockade, air superiority over a battle, a landing. */
async function seaAirFlow(browser: Browser, base: string): Promise<void> {
  const { text, ids } = seaAirSave();
  const path = join('reports', 'tmp', 'sea-air.json');
  mkdirSync(join('reports', 'tmp'), { recursive: true });
  writeFileSync(path, text);
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const problems = await watch(page);
  await page.goto(base);
  await startCampaign(page);
  await page.getByRole('button', { name: 'Game menu' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
  await chooser.setFiles(path);
  await page.waitForFunction(() => (window as any).cnf.player === 'ser', null, { timeout: 10000 });
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.setSpeed(0);
    document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
  });
  // screen point of a province (centred first) or of an army marker
  const view = async (pid: string) =>
    page.evaluate((p) => {
      const app = (window as any).cnf;
      const c = app.renderer.provinceCenter(p);
      app.renderer.camera.centerOn(c.x, c.y, Math.max(app.renderer.camera.zoom, app.renderer.camera.zoomForProvincePx(70)), false);
      app.mapDirty = true;
    }, pid);
  const provPoint = (pid: string) =>
    page.evaluate((p) => {
      const app = (window as any).cnf;
      const c = app.renderer.provinceCenter(p);
      const s = app.renderer.camera.toScreen(c.x, c.y);
      const r = app.canvas.getBoundingClientRect();
      return { x: s.x + r.left, y: s.y + r.top };
    }, pid);
  const clickProvince = async (pid: string) => {
    // aim a little off the centre, clear of army markers, and fall back to a scan of the province
    const p = await page.evaluate((id) => {
      const app = (window as any).cnf;
      const r = app.canvas.getBoundingClientRect();
      const c = app.renderer.provinceCenter(id);
      const s = app.renderer.camera.toScreen(c.x, c.y);
      for (let d = 0; d < 80; d += 4) {
        for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0], [d, d], [-d, -d], [d, -d], [-d, d]]) {
          const x = s.x + dx;
          const y = s.y + dy;
          if (app.renderer.provinceAt(x, y) === id && !app.renderer.armyAt(x, y) && !app.renderer.fleetAt(x, y) && !app.renderer.battleAt(x, y)) return { x: x + r.left, y: y + r.top };
        }
      }
      return null;
    }, pid);
    if (!p) throw new Error(`no clear point in ${pid}`);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
  };
  const clickArmy = async (id: string) => {
    const p = await page.evaluate((a) => {
      const app = (window as any).cnf;
      const m = app.renderer.markers.find((x: { army: string }) => x.army === a);
      const r = app.canvas.getBoundingClientRect();
      return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top } : null;
    }, id);
    if (!p) throw new Error(`army ${id} has no marker on screen`);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(150);
  };
  const inspector = () => page.locator('aside.inspector').innerText();
  void provPoint;

  // ── blockade: the zone card marks Westmere, the fleet card says so, the Military ledger counts it
  await page.evaluate((z) => {
    const app = (window as any).cnf;
    const c = app.renderer.zoneCenter(z);
    app.renderer.camera.centerOn(c.x, c.y, app.renderer.camera.zoom, false);
    app.mapDirty = true;
  }, ids.zone);
  await page.waitForTimeout(250);
  const zp = await page.evaluate((z) => {
    const app = (window as any).cnf;
    const r = app.canvas.getBoundingClientRect();
    const c = app.renderer.zoneCenter(z);
    const s = app.renderer.camera.toScreen(c.x, c.y);
    for (let d = 0; d < 120; d += 4) for (const [dx, dy] of [[0, d], [d, 0], [0, -d], [-d, 0]]) if (app.renderer.zoneAt(s.x + dx, s.y + dy) === z && !app.renderer.fleetAt(s.x + dx, s.y + dy)) return { x: s.x + dx + r.left, y: s.y + dy + r.top };
    return null;
  }, ids.zone);
  if (zp) await page.mouse.click(zp.x, zp.y);
  await page.waitForTimeout(200);
  const zoneText = await inspector();
  const zoneSel = await page.evaluate(() => (window as any).cnf.selectedZone);
  const westmereMarked = /\nWestmere\nblockaded/i.test(zoneText);
  await page.evaluate((f) => (window as any).cnf.selectFleet(f), ids.fleet);
  await page.waitForTimeout(150);
  const fleetText = await inspector();
  await page.keyboard.press('Escape');
  await page.keyboard.press('m');
  await page.waitForTimeout(250);
  const ledger = await page.locator('.drawer:not(.closed)').innerText().catch(() => '');
  const blockTile = /Blockades\s*[1-9]\d* held · 0 on us/i.test(ledger) && /We blockade: [^\n]*Westmere/.test(ledger);
  await page.keyboard.press('Escape');
  record(
    'Blockade: clicking the sea shows the blockaded coast, the fleet card says Blockading, the Military ledger counts it',
    zoneSel === ids.zone && westmereMarked && /Blockading/.test(fleetText) && blockTile,
    `zone ${zoneSel}: Westmere ${westmereMarked ? 'marked blockaded' : 'not marked'}; fleet card ${/Blockading/.test(fleetText) ? 'Blockading' : 'no tag'}; ledger ${(ledger.match(/We blockade: [^\n]*/) ?? ['no blockade line'])[0]}`,
  );

  // ── air: ground support over Duncairn, first under the enemy's sky, then under ours
  const flyMission = async (wing: string, label: RegExp, target: string) => {
    await view('serenna');
    await page.waitForTimeout(200);
    await clickProvince('serenna');
    await page.locator(`[data-fk="wing-${wing}"]`).click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: label }).first().click();
    await view(target);
    await page.waitForTimeout(200);
    await clickProvince(target);
    return page.evaluate((w) => {
      const x = (window as any).cnf.sim.state.wings[w];
      return `${x.mission}@${x.target}`;
    }, wing);
  };
  const m1 = await flyMission(ids.attack, /Fly ground support/, 'duncairn');
  await view('duncairn');
  await page.waitForTimeout(250);
  await clickArmy(ids.theirs);
  const under = await inspector();
  const theirSky = under.match(/Air support \+(\d+)% \(enemy holds the sky\)/);
  const fm: string[] = [];
  for (const f of [ids.f1, ids.f2, ids.f3]) fm.push(await flyMission(f, /Fly air superiority/, 'duncairn'));
  await view('duncairn');
  await page.waitForTimeout(250);
  await clickArmy(ids.theirs);
  const over = await inspector();
  const ourSky = over.match(/Air support \+(\d+)% \(air superiority\)/);
  record(
    'Air: a wing flies ground support chosen on the map; the attack forecast shows the enemy holding the sky, then our fighters winning it',
    m1 === 'support@duncairn' && fm.every((x) => x === 'superiority@duncairn') && !!theirSky && !!ourSky && Number(ourSky[1]) > Number(theirSky[1]),
    `attack wing ${m1}; fighters ${fm.join(', ')}; forecast ${theirSky ? theirSky[0] : 'no enemy-sky note'} → ${ourSky ? ourSky[0] : 'no superiority note'}`,
  );

  // ── naval invasion: Ship by sea, click the beach, run the weeks until the troops are ashore
  await view('calvi');
  await page.waitForTimeout(250);
  await clickArmy(ids.landing);
  await page.getByRole('button', { name: /Ship by sea/ }).first().click();
  await view('westmere');
  await page.waitForTimeout(250);
  await clickProvince('westmere');
  const aboard = await page.evaluate((a) => (window as any).cnf.sim.state.armies[a]?.embarked ?? null, ids.landing);
  await page.evaluate(() => (window as any).cnf.setSpeed(4));
  const landed = await page
    .waitForFunction(
      (a) => {
        const app = (window as any).cnf;
        if (app.speed === 0) {
          document.querySelectorAll<HTMLButtonElement>('.modal-layer:not(.hidden) footer button').forEach((b) => b.click());
          app.setSpeed(4);
        }
        const army = app.sim.state.armies[a];
        return app.sim.state.nations.ser.stats.landings > 0 && (!army || !army.embarked);
      },
      ids.landing,
      { timeout: 30000, polling: 100 },
    )
    .then(() => true)
    .catch(() => false);
  const after = await page.evaluate((a) => {
    const app = (window as any).cnf;
    app.setSpeed(0);
    const army = app.sim.state.armies[a];
    return { loc: army?.location ?? 'gone', landings: app.sim.state.nations.ser.stats.landings, tick: app.sim.state.tick };
  }, ids.landing);
  record(
    'Naval invasion: Ship by sea, click the beach, the troops sail and land',
    aboard === ids.fleet && landed && after.loc === 'westmere',
    `embarked on ${aboard}; landings ${after.landings}; army now in ${after.loc} (week ${after.tick})`,
  );
  record('No errors during the navy and air session', problems.length === 0, problems.slice(0, 3).join('; '));
  await page.close();
}

/**
 * The map library and editor: generate a new map, edit it, see a finding and
 * undo it, save and export it, delete and re-import it, refuse a broken file,
 * play it, and edit a copy of a built-in map.
 */
async function mapEditorFlow(browser: Browser, base: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const problems = await watch(page);
  const ed = <T>(fn: string) => page.evaluate(`(() => { const e = window.cnfEditor; return ${fn}; })()`) as Promise<T>;
  // a province whose label point is well inside the editor's map, not under its overlays
  const spot = (filter: string) =>
    page.evaluate(`(() => {
      const e = window.cnfEditor;
      const r = document.querySelector('.ed-canvas').getBoundingClientRect();
      const caps = new Set(e.pkg.nations.map((n) => n.capital));
      for (const p of e.pkg.provinces) {
        if (!(${filter})) continue;
        const s = e.screenOf(p.id);
        if (s && s.x > r.left + 90 && s.x < r.right - 90 && s.y > r.top + 90 && s.y < r.bottom - 90) return { id: p.id, x: s.x, y: s.y };
      }
      return null;
    })()`) as Promise<{ id: string; x: number; y: number } | null>;
  await page.goto(base);
  await page.waitForSelector('.screen .menu-list button', { timeout: 15000 });
  await page.getByRole('button', { name: /Map library/ }).click();
  await page.waitForSelector('.lib-card');
  await page.waitForTimeout(1200);
  const lib = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.lib-card')];
    const c = cards[0]?.querySelector('canvas') as HTMLCanvasElement | null;
    const d = c ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data : null;
    const seen = new Set<number>();
    if (d) for (let i = 0; i < d.length; i += 4 * 211) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return { cards: cards.map((x) => x.getAttribute('data-map')), colours: seen.size };
  });
  record('Map library lists every built-in map with a drawn preview', ['aldmere', 'reach', 'isles', 'steppe', 'midsea'].every((id) => lib.cards.includes(id)) && lib.colours > 12, `${lib.cards.join(', ')}; preview colours ${lib.colours}`);

  // ── create
  await page.locator('[data-fk="new-map"]').click();
  await page.waitForSelector('.ed-new-card');
  await page.locator('[data-f=gen-name]').fill('Verify Land');
  await page.locator('[data-f=gen-seed]').fill('7');
  await page.locator('[data-f=gen-provinces]').fill('60');
  await page.locator('[data-f=gen-realms]').fill('4');
  const t0 = Date.now();
  await page.locator('[data-fk=ed-generate]').click();
  await page.waitForSelector('.ed-new.hidden', { state: 'attached', timeout: 60000 });
  const genMs = Date.now() - t0;
  await page.waitForTimeout(400);
  const made = await ed<{ id: string; n: number; realms: number; ok: boolean }>('({ id: e.pkg.id, n: e.pkg.provinces.length, realms: e.pkg.nations.length, ok: e.check.ok })');
  record('Map editor: New map generates a playable map (in a worker)', made.ok && made.realms === 4 && made.n >= 40, `${made.id}: ${made.n} provinces, ${made.realms} realms in ${(genMs / 1000).toFixed(1)} s`);

  // ── edit: select and rename, paint terrain, undo
  const p = await spot('p.owner && !caps.has(p.id)');
  let edited = false;
  let detail = 'no province in view';
  if (p) {
    await page.mouse.click(p.x, p.y);
    await page.waitForSelector(`[data-province="${p.id}"]`);
    await page.locator('[data-f=name]').fill('Verifyholm');
    await page.locator('[data-f=name]').press('Tab');
    const renamed = await ed<string>(`e.pkg.provinces.find((x) => x.id === '${p.id}').name`);
    const before = await ed<string>(`e.pkg.provinces.find((x) => x.id === '${p.id}').terrain`);
    const target = before === 'marsh' ? 'hills' : 'marsh';
    await page.locator('[data-tool=terrain]').click();
    await page.locator(`.ed-choice[data-choice="${target}"]`).click();
    await page.mouse.click(p.x, p.y);
    const painted = await ed<string>(`e.pkg.provinces.find((x) => x.id === '${p.id}').terrain`);
    await page.keyboard.press('Control+z');
    const undone = await ed<string>(`e.pkg.provinces.find((x) => x.id === '${p.id}').terrain`);
    edited = renamed === 'Verifyholm' && painted === target && undone === before;
    detail = `renamed ${p.id} to ${renamed}; terrain ${before} → ${painted} → undo → ${undone}`;
  }
  record('Map editor: select and rename a province, paint terrain, undo', edited, detail);

  // ── a realm with no land: reported with what to fix, and undo repairs it
  let finding = false;
  detail = 'no province in view';
  if (p) {
    await page.locator('[data-tab=realms]').click();
    await page.locator('[data-f=new-realm]').fill('Testmark');
    await page.locator('[data-fk=ed-place-capital]').click();
    await page.mouse.click(p.x, p.y);
    const nid = await ed<string | null>("e.pkg.nations.find((n) => n.name === 'Testmark')?.id ?? null");
    const other = await ed<string>(`e.pkg.nations.find((n) => n.name !== 'Testmark').id`);
    await page.locator(`.ed-choice[data-choice="${other}"]`).click();
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(500);
    const bad = await page.locator('.ed-status.bad').count();
    await page.locator('.ed-status').click();
    const issue = (await page.locator('.ed-issue.bad .grow').first().textContent()) ?? '';
    const show = await page.locator('.ed-issue.bad button').count();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    const after = await ed<number>('e.check.errors.length');
    finding = !!nid && bad === 1 && /Testmark/.test(issue) && show > 0 && after === 0;
    detail = `finding: "${issue.trim()}"; errors after undo ${after}`;
  }
  record('Map editor: a realm left without land is reported with a way to find it, and undo repairs it', finding, detail);

  // ── save and export
  await page.locator('[data-fk=ed-save]').click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate((id) => (window as any).cnf.maps.has(id), made.id);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-fk=ed-export]').click()]);
  const file = join('reports', 'tmp', `${made.id}.map.json`);
  mkdirSync(join('reports', 'tmp'), { recursive: true });
  await download.saveAs(file);
  const exported = parseMapPackage(readFileSync(file, 'utf8'));
  const live = JSON.parse(await ed<string>('JSON.stringify(e.pkg)')) as MapPackage;
  const same = !!exported.pkg && mapChecksum(exported.pkg) === mapChecksum(live);
  record('Map editor: saves to the library and exports a file that passes the validator', saved && exported.check.ok && same, `library ${saved ? 'has' : 'lacks'} ${made.id}; file ${exported.check.ok ? 'valid' : exported.check.errors[0]?.message}; checksum ${same ? 'matches' : 'differs'}`);

  // ── library: delete, import again, refuse broken files, play
  await page.locator('[data-fk=ed-back]').click();
  await page.waitForSelector(`.lib-card[data-map="${made.id}"]`);
  await page.locator(`[data-fk="delete-${made.id}"]`).click();
  await page.locator('.modal-layer:not(.hidden) button', { hasText: 'Delete' }).click();
  await page.waitForTimeout(300);
  const gone = (await page.locator(`.lib-card[data-map="${made.id}"]`).count()) === 0;
  const importFile = async (path: string) => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-fk=import-map]').click()]);
    await chooser.setFiles(path);
    await page.waitForTimeout(600);
  };
  await importFile(file);
  const back = (await page.locator(`.lib-card[data-map="${made.id}"]`).count()) === 1;
  const broken = join('reports', 'tmp', 'broken.map.json');
  writeFileSync(broken, '{"format":"crown-frontier-map","version":3,"id":"broken","provinces":[');
  await importFile(broken);
  const refusal = (await page.locator('.modal-layer:not(.hidden)').textContent()) ?? '';
  await page.locator('.modal-layer:not(.hidden) footer button').first().click();
  // a map whose texts carry markup and an unknown "script" field: imported as plain data
  const hostile = { ...live, id: 'markup-map', onload: 'alert(1)', meta: { ...live.meta, name: '<img src=x onerror="window.__pwned=1">Markup Map' } };
  const hostileFile = join('reports', 'tmp', 'markup.map.json');
  writeFileSync(hostileFile, JSON.stringify(hostile));
  await importFile(hostileFile);
  const inert = await page.evaluate(() => ({ imgs: document.querySelectorAll('.lib-card img').length, pwned: (window as any).__pwned === 1, title: document.querySelector('.lib-card[data-map="markup-map"] .lib-t')?.textContent ?? '' }));
  record(
    'Map library: delete and re-import a map; a broken file is refused with a reason; map text is never run',
    gone && back && /cannot be imported/.test(refusal) && /not readable JSON/.test(refusal) && inert.imgs === 0 && !inert.pwned && inert.title.startsWith('<img'),
    `deleted ${gone}, re-imported ${back}; refusal "${refusal.replace(/\s+/g, ' ').slice(0, 90)}…"; markup shown as text: ${inert.title.slice(0, 30)}`,
  );
  await page.locator(`[data-fk="play-${made.id}"]`).click();
  await page.waitForSelector(`.map-card.selected[data-map="${made.id}"]`);
  await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
  await page.waitForSelector('canvas.map');
  await page.waitForTimeout(500);
  const playing = await page.evaluate(() => (window as any).cnf.sim.state.scenarioId);
  record('Map library: a map made in the editor starts a campaign', playing === made.id && (await canvasDrawn(page)), `campaign on ${playing}`);
  await page.close();

  // ── edit a copy of a built-in map
  const page2 = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const problems2 = await watch(page2);
  await page2.goto(base);
  await page2.getByRole('button', { name: /Map library/ }).click();
  await page2.locator('[data-fk="copy-reach"]').click();
  await page2.waitForSelector('.ed-canvas');
  await page2.waitForTimeout(800);
  const copy = (await page2.evaluate('(() => ({ id: window.cnfEditor.pkg.id, n: window.cnfEditor.pkg.provinces.length, ok: window.cnfEditor.check.ok }))()')) as { id: string; n: number; ok: boolean };
  await page2.locator('[data-fk=ed-save]').click();
  await page2.waitForTimeout(400);
  const kept = await page2.evaluate((id) => (window as any).cnf.maps.has(id), copy.id);
  record('Map library: edit a copy of a built-in map and save it', copy.id === 'reach-copy' && copy.n === 99 && copy.ok && kept, `${copy.id}, ${copy.n} provinces, ${kept ? 'saved' : 'not saved'}`);
  record('Map library and editor without errors', problems.length === 0 && problems2.length === 0, [...problems, ...problems2].slice(0, 3).join('; '));
  await page2.close();
}

/**
 * Stage E through the interface: choosing a national focus, a guarantee, a
 * loan, founding a trade bloc, a peace conference for two winners, a
 * counter-offer to a settlement, and spheres and blocs in the Diplomacy map mode.
 */
async function diplomacyFlow(browser: Browser, base: string): Promise<void> {
  const { text, ids } = diploSave();
  const path = join('reports', 'tmp', 'diplomacy.json');
  mkdirSync(join('reports', 'tmp'), { recursive: true });
  writeFileSync(path, text);
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const problems = await watch(page);
  await page.goto(base);
  await startCampaign(page);
  await page.getByRole('button', { name: 'Game menu' }).click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
  await chooser.setFiles(path);
  await page.waitForFunction(() => (window as any).cnf.player === 'aur', null, { timeout: 10000 });
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.setSpeed(0);
    app.ui.dockOpen = false;
    app.refresh();
  });
  await page.waitForFunction(() => (window as any).cnf.speed === 0);
  // a dialog may still open after the import, and the import's file input may hold the
  // focus (either would swallow the ledger keys): close dialogs and drop the focus until
  // no dialog has been open for half a second
  for (let quiet = 0; quiet < 5; ) {
    const open = await page.evaluate(() => {
      // close the game menu or a notice by its own Resume or Close button (never by the
      // other footer buttons: one of them saves and quits to the main menu)
      const layers = [...document.querySelectorAll<HTMLElement>('.modal-layer:not(.hidden)')];
      for (const l of layers) {
        const b = [...l.querySelectorAll<HTMLButtonElement>('footer button')].find((x) => /^(Resume|Close|OK|Continue)$/.test(x.textContent?.trim() ?? ''));
        if (b) b.click();
        else l.querySelector<HTMLElement>('.modal')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      (window as any).cnf.setSpeed(0);
      // the file input used for the import may keep the focus, and keys typed into an input are ignored
      (document.activeElement as HTMLElement | null)?.blur?.();
      return layers.length;
    });
    quiet = open ? 0 : quiet + 1;
    await page.waitForTimeout(100);
  }
  const state = <T>(fn: string) => page.evaluate(`(() => { const st = window.cnf.sim.state; return ${fn}; })()`) as Promise<T>;
  // one atomic click in the page: ledgers are rebuilt when the state changes, so a
  // located element may be replaced between being found and being clicked
  const press = async (selector: string) => {
    await page.waitForSelector(selector, { state: 'attached' });
    await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).click(), selector);
    await page.waitForTimeout(150);
  };

  // ── national focus: P opens the tree; choose a national focus
  if ((await page.evaluate(() => (window as any).cnf.player)) !== 'aur') throw new Error('the prepared campaign is no longer loaded');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  const title = (await page.locator('.drawer:not(.closed) h2').textContent()) ?? '';
  const branches = await page.locator('.tree-lane').count();
  const edges = await page.locator('.tree-edges .edge').count();
  // select an available national focus in the plan, then choose it from the inspector
  const name = (await page.locator('.tree-node.available[data-node^="nat_"] .tn-title').first().textContent()) ?? '';
  await press('.tree-node.available[data-node^="nat_"]');
  const inspected = (await page.locator('.tree-inspector h3').textContent()) ?? '';
  await press('.tree-inspector .action button');
  const current = await state<string | null>('st.nations.aur.focus.current');
  const shown = (await page.locator('.drawer .strip').first().textContent()) ?? '';
  record(
    'Focus: P opens the focus plan; selecting a national focus inspects it, and choosing it makes it the realm’s focus',
    /National Focus/.test(title) && branches >= 5 && edges > 10 && inspected === name && !!current && current.startsWith('nat_') && shown.includes(name),
    `${branches} branches, ${edges} connectors; chose "${name.split(' ')[0]}…" → ${current}`,
  );

  // ── research: T opens the era-by-branch plan; arrow keys move between nodes; the plane keeps its
  //    scroll position through the weekly re-render; choosing from the inspector starts research
  await page.keyboard.press('t');
  await page.waitForTimeout(250);
  const techEdges = await page.locator('.tree-edges .edge').count();
  const techName = (await page.locator('.tree-node.available .tn-title').first().textContent()) ?? '';
  await press('.tree-node.available');
  const techInspected = (await page.locator('.tree-inspector h3').textContent()) ?? '';
  await page.locator('.tree-node.selected').focus();
  await page.keyboard.press('ArrowRight');
  const movedTo = await page.evaluate(() => document.activeElement?.getAttribute('data-node') ?? '');
  await page.evaluate(() => ((document.querySelector('.tree-scroll') as HTMLElement).scrollLeft = 300));
  await page.evaluate(() => (window as any).cnf.refresh());
  await page.waitForTimeout(100);
  const keptScroll = await page.evaluate(() => (document.querySelector('.tree-scroll') as HTMLElement).scrollLeft);
  await press('.tree-inspector .action button');
  const researching = await state<string | null>('st.nations.aur.research.current');
  record(
    'Research: T opens the plan with dependency connectors; a node inspects, arrow keys move between nodes, scroll survives a re-render, and choosing starts research',
    techEdges > 40 && techInspected === techName && !!movedTo && keptScroll >= 250 && !!researching,
    `${techEdges} connectors; inspected "${techInspected}", arrow → ${movedTo}, scroll ${Math.round(keptScroll)}; researching ${researching}`,
  );

  // ── victory: three comparable routes, each with its conditions against thresholds and a timer outlook
  await page.keyboard.press('v');
  await page.waitForTimeout(200);
  const routes = await page.locator('.route').count();
  const condRows = await page.locator('.route .register.conditions tbody tr').count();
  const outlooks = await page.locator('.route .timer p').count();
  record('Victory: three routes stated alike, with every condition as a measure against its threshold and what next month does to the timer', routes === 3 && condRows >= 9 && outlooks === 3, `${routes} routes, ${condRows} conditions, ${outlooks} timer outlooks`);

  // ── chronicle: filters by kind with counts; an empty filter says what would appear there
  await page.keyboard.press('l');
  await page.waitForTimeout(200);
  const filterCount = await page.locator('.filter-bar button').count();
  const entriesAll = await page.locator('.chron-item').count();
  await press('[data-fk="log:battles"]');
  const battleView = (await page.locator('.battle-item').count()) > 0 || (await page.locator('.empty-state').count()) > 0;
  await press('[data-fk="log:all"]');
  record('Chronicle: entries grouped by month with kind filters; battle reports or an explained empty state', filterCount === 7 && entriesAll > 0 && battleView, `${filterCount} filters, ${entriesAll} entries`);

  // ── how to play: a contents index beside one article; choosing an entry opens it
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  const indexItems = await page.locator('.manual-index .mi-item').count();
  await press('[data-fk="help:trade"]');
  const article = (await page.locator('.manual-article h3').textContent()) ?? '';
  await page.keyboard.press('h');
  await page.waitForTimeout(100);
  record('How to Play: a field manual with a contents index; choosing “Trade contracts” opens that article', indexItems >= 15 && article === 'Trade contracts', `${indexItems} articles; opened "${article}"`);

  // ── a guarantee, a loan, a trade bloc (Diplomacy ledger)
  await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.protege);
  await page.waitForTimeout(150);
  await press('[data-fk="Guarantee their independence"]');
  const guaranteed = await state<boolean>(`st.guarantees.some((g) => g.by === 'aur' && g.of === '${ids.protege}')`);
  const influenceRow = await page.locator('.diplo-detail').getByText('Our influence over them').count();
  record('Diplomacy: guaranteeing a realm’s independence, with influence shown', guaranteed && influenceRow > 0, `guarantee ${guaranteed ? 'given' : 'missing'}`);
  await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.borrower);
  await page.waitForTimeout(150);
  const t0 = await state<number>(`st.nations.${ids.borrower}.treasury`);
  await press('[data-fk="Lend 100 crowns"]');
  const loan = await state<{ remaining: number } | null>(`st.loans.find((l) => l.from === 'aur' && l.to === '${ids.borrower}') ?? null`);
  const t1 = await state<number>(`st.nations.${ids.borrower}.treasury`);
  record('Diplomacy: a loan to a realm in debt is accepted and repaid with interest', !!loan && Math.abs(loan.remaining - 120) < 1e-6 && t1 - t0 === 100, `loan ${loan ? `${loan.remaining} owed` : 'refused'}; their treasury ${t0} → ${t1}`);
  await page.evaluate((o) => (window as any).cnf.openDiplomacy(o), ids.partner);
  await page.waitForTimeout(150);
  await press('[data-fk="Found a trade bloc with them"]');
  const bloc = await state<string[] | null>(`st.blocs[0]?.members ?? null`);
  const standing = await page.locator('[data-sk="diplo-standing"]').textContent();
  record('Diplomacy: founding a trade bloc with a trade partner', JSON.stringify(bloc) === JSON.stringify(['aur', ids.partner].sort()) && /Customs Union/.test(standing ?? ''), `members ${JSON.stringify(bloc)}`);

  // ── the peace conference: the AI's suggested terms for both winners, accepted
  await page.evaluate(() => (window as any).cnf.openLedger('wars'));
  await page.waitForTimeout(200);
  await press('[data-sk="peace-conference"] [data-fk="settle-suggest"]');
  const demands = await page.locator('[data-sk="peace-conference"]').first().locator('.demand-list li').count();
  const answer = (await page.locator('[data-sk="peace-conference"]').first().getByText(/Would (accept|refuse)/).first().textContent()) ?? '';
  const allyBefore = await state<number>(`st.nations.${ids.ally}.stats.demandsWon`);
  await press('[data-sk="peace-conference"] [data-fk="Propose settlement"]');
  const over = await state<boolean>(`!st.wars['${ids.winWar}']`);
  const allyAfter = await state<number>(`st.nations.${ids.ally}.stats.demandsWon`);
  record('Peace conference: suggested terms share the spoils with an ally, and the settlement ends the war', demands > 1 && /Would accept/.test(answer) && over && allyAfter > allyBefore, `${demands} demands; ${answer.trim()}; war ${over ? 'over' : 'goes on'}; ally received ${allyAfter - allyBefore}`);

  // ── a settlement offered to us: strike a demand and send a counter-offer
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.closeLedger();
    app.ui.dockOpen = true;
    app.refresh();
  });
  await page.waitForTimeout(200);
  const card = page.locator('.decision-card');
  const cardTitle = (await card.locator('h3').textContent()) ?? '';
  const boxes = await card.locator('.demand-list input[type=checkbox]').count();
  await press('.decision-card [data-fk="demand-1"]');
  const verdict = (await page.locator('.decision-card').getByText(/would (accept|reject) this counter-offer/).textContent()) ?? '';
  const button = (await page.locator('.decision-card [data-fk="accept"]').textContent()) ?? '';
  await press('.decision-card [data-fk="accept"]');
  const pending = await state<number>(`st.proposals.filter((p) => p.kind === 'settlement').length`);
  const war2 = await state<boolean>(`!!st.wars['${ids.loseWar}']`);
  const elmsgate = await state<string>(`st.provinces.elmsgate.owner`);
  const consistent = war2 ? elmsgate === 'aur' : elmsgate === ids.attacker;
  record('Settlement offered to us: striking a demand sends a counter-offer, which the other side judges', /Peace settlement/.test(cardTitle) && boxes === 2 && /counter-offer/.test(verdict) && /counter-offer/i.test(button) && pending === 0 && consistent, `${verdict.trim()}; war ${war2 ? 'goes on' : 'settled'}; Elmsgate held by ${elmsgate}`);

  // ── the Diplomacy map mode shows blocs, spheres and guarantees
  await page.evaluate(() => (window as any).cnf.setMode('diplomacy'));
  await page.waitForTimeout(300);
  const legend = (await page.locator('.legend:not(.hidden)').first().textContent()) ?? '';
  record('Diplomacy map mode: the legend covers spheres, guarantees and trade blocs', /sphere/.test(legend) && /guaranteed/i.test(legend) && /trade bloc/.test(legend), legend.slice(0, 80));
  record('Diplomacy and focus flows run without page errors', problems.length === 0, problems.slice(0, 3).join('; '));
  await page.close();
}

/** The tutorial walks through the new systems, and each new step completes on the real action. */
async function tutorialFlow(browser: Browser, base: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 800 } });
  const problems = await watch(page);
  await page.goto(base);
  await startCampaign(page);
  const tut = page.locator('.tutorial:not(.hidden)');
  const title = async () => ((await tut.count()) ? ((await tut.locator('h4').textContent()) ?? '').trim() : '');
  const press = async (selector: string) => {
    await page.waitForSelector(selector, { state: 'attached' });
    await page.evaluate((sel) => (document.querySelector(sel) as HTMLElement).click(), selector);
  };
  // the steps for the new systems, each done the way a player would
  const actions: Record<string, () => Promise<void>> = {
    'Industry and resources': () => page.keyboard.press('i'),
    'Ships and aircraft': () => page.keyboard.press('Shift+Digit9'),
    'A national focus': async () => {
      await page.keyboard.press('p');
      await page.waitForTimeout(200);
      // with no focus under way the rail marks the Focus ledger; with a ledger open the tutorial sits beside it
      focusBadge = await page.evaluate(() => [...document.querySelectorAll('.rail button')].some((b) => /Focus/.test(b.textContent ?? '') && !!b.querySelector('.badge')));
      tutorialClear = await page.evaluate(() => {
        const a = document.querySelector('.tutorial')!.getBoundingClientRect();
        const b = document.querySelector('.drawer')!.getBoundingClientRect();
        return a.left >= b.right || a.right <= b.left || a.top >= b.bottom || a.bottom <= b.top;
      });
      await press('.tree-node.available[data-node^="nat_"]');
      await press('.tree-inspector .action button');
    },
    'How wars end': () => page.keyboard.press('w'),
  };
  let focusBadge = false;
  let tutorialClear = false;
  const total = Number(/of (\d+)/.exec((await tut.locator('.steps').textContent()) ?? '')?.[1] ?? 0);
  const seen: string[] = [];
  const completed: string[] = [];
  for (let guard = 0; guard < 40 && (await tut.count()); guard++) {
    const t = await title();
    if (seen[seen.length - 1] !== t) seen.push(t);
    const act = actions[t];
    if (act && !completed.includes(t)) {
      await act();
      await page.waitForTimeout(300);
      if ((await title()) !== t) completed.push(t);
      else break; // the action did not complete its step
      continue;
    }
    await tut.locator('button', { hasText: /^(Next|Skip step|Finish)$/ }).click();
    await page.waitForTimeout(120);
  }
  const want = Object.keys(actions);
  record(
    'Tutorial: steps for industry, sea and air, national focus and settlements, each completed by doing it',
    want.every((t) => completed.includes(t)) && seen[seen.length - 1] === 'You are ready' && total === seen.length,
    `${seen.length} of ${total} steps shown; completed by action: ${completed.join(', ') || 'none'}; last "${seen[seen.length - 1]}"`,
  );
  record('Focus: the rail marks the Focus ledger while no focus is under way; the tutorial never covers an open ledger', focusBadge && tutorialClear, `badge ${focusBadge}, tutorial beside the ledger ${tutorialClear}`);
  const mode = await page.evaluate(() => (window as any).cnf.mode);
  await page.evaluate(() => (window as any).cnf.closeLedger());
  await page.keyboard.press('Shift+Digit8');
  await page.waitForTimeout(300);
  const resLegend = (await page.locator('.legend:not(.hidden)').first().textContent()) ?? '';
  const resMode = await page.evaluate(() => (window as any).cnf.mode);
  const resDrawn = await canvasDrawn(page);
  await page.keyboard.press('Shift+Digit9');
  await page.waitForTimeout(300);
  const seaLegend = (await page.locator('.legend:not(.hidden)').first().textContent()) ?? '';
  const seaMode = await page.evaluate(() => (window as any).cnf.mode);
  record(
    'Map modes: Shift+8 shows Resources and Shift+9 Sea control, each with a legend',
    mode === 'sea' && resMode === 'resources' && /Coal/.test(resLegend) && /short/.test(resLegend) && resDrawn && seaMode === 'sea' && /Port level/.test(seaLegend),
    `${resMode}: "${resLegend.slice(0, 50)}…"; ${seaMode}: "${seaLegend.slice(0, 50)}…"`,
  );
  // nothing see-through takes the pointer over the map: every point is the map or visible interface
  const deadZones = await page.evaluate(() => {
    const hits: string[] = [];
    // the canvas's own ancestors are the page behind the map: they do not count as interface
    const behind = new Set<Element>();
    for (let c = document.querySelector('canvas.map')?.parentElement ?? null; c; c = c.parentElement) behind.add(c);
    for (let x = 4; x < innerWidth; x += 20)
      for (let y = 60; y < innerHeight; y += 20) {
        const e = document.elementFromPoint(x, y);
        if (!e || e.tagName === 'CANVAS') continue;
        let c: Element | null = e;
        let seen = false;
        for (; c && !behind.has(c); c = c.parentElement) {
          const bg = getComputedStyle(c).backgroundColor;
          if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            seen = true;
            break;
          }
        }
        if (!seen) hits.push(`${(e as HTMLElement).className || e.tagName}@${x},${y}`);
      }
    return hits;
  });
  // switching from Diplomacy (which shows its own map) straight to another ledger puts the player's map back
  await page.keyboard.press('Shift+Digit2');
  await page.keyboard.press('d');
  await page.waitForTimeout(150);
  const during = await page.evaluate(() => (window as any).cnf.mode);
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => (window as any).cnf.mode);
  await page.evaluate(() => (window as any).cnf.closeLedger());
  record('Switching from Diplomacy to another ledger restores the map mode it replaced', during === 'diplomacy' && after === 'terrain', `terrain → ${during} → ${after}`);
  // a finished focus pauses the game so that the next can be chosen
  const paused = await page.evaluate(async () => {
    const app = (window as any).cnf;
    const n = app.sim.state.nations[app.player];
    n.focus.progress = 99; // the focus chosen above finishes at the next month
    app.setSpeed(4);
    for (let i = 0; i < 80 && n.focus.current; i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 300));
    const out = { finished: !n.focus.current, speed: app.speed };
    app.setSpeed(0);
    return out;
  });
  record('A finished national focus pauses the game for the next choice', paused.finished && paused.speed === 0, `finished ${paused.finished}, speed afterwards ${paused.speed}`);
  record('Map clicks reach the map beside the legend, the mode bar and the minimap', deadZones.length === 0, deadZones.length ? `${deadZones.length} points blocked, e.g. ${deadZones.slice(0, 3).join(', ')}` : 'no transparent box over the map');
  // a ledger and a card open at once: the legend stays clear of the zoom buttons
  await page.evaluate(() => {
    const app = (window as any).cnf;
    app.setMode('military');
    const army = Object.values(app.sim.state.armies as Record<string, { id: string; nation: string }>).find((x) => x.nation === app.player);
    if (army) app.selectArmy(army.id, false);
    app.openLedger('wars');
    app.refresh();
  });
  await page.waitForTimeout(600);
  const clear = await page.evaluate(() => ({
    legend: document.querySelector('.legend:not(.hidden)')?.getBoundingClientRect().right ?? 0,
    nav: document.querySelector('.navcl .nav-btns')?.getBoundingClientRect().left ?? 0,
    inspector: !document.querySelector('.inspector')?.classList.contains('closed'),
  }));
  record('With a ledger and a card open, the legend stays clear of the zoom buttons', clear.inspector && clear.legend > 0 && clear.legend <= clear.nav, `legend ends at ${Math.round(clear.legend)} px, zoom buttons start at ${Math.round(clear.nav)} px`);
  record('Tutorial and map modes without errors', problems.length === 0, problems.slice(0, 3).join('; '));
  await page.close();
}

async function main(): Promise<void> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ missing: run npm run build');
  const zipFiles = existsSync(ZIP) ? unzip(ZIP) : null;
  const { server, port } = await startServer(zipFiles);
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const version = browser.version();
  try {
    // ONLY=sea-air runs just the navy and air flow (while working on it; no report is written)
    if (process.env.ONLY === 'sea-air') {
      await seaAirFlow(browser, `${origin}/`);
      return;
    }
    if (process.env.ONLY === 'maps') {
      await mapEditorFlow(browser, `${origin}/`);
      return;
    }
    if (process.env.ONLY === 'diplomacy') {
      await diplomacyFlow(browser, `${origin}/`);
      return;
    }
    if (process.env.ONLY === 'tutorial') {
      await tutorialFlow(browser, `${origin}/`);
      return;
    }
    await flow(browser, `${origin}/`, 'Site root');
    await flow(browser, `${origin}${SUB}`, 'Project subpath');
    await mapChoice(browser, `${origin}/`);
    await seaAirFlow(browser, `${origin}/`);
    await mapEditorFlow(browser, `${origin}/`);
    await diplomacyFlow(browser, `${origin}/`);
    await tutorialFlow(browser, `${origin}/`);
    if (zipFiles) {
      record('Release ZIP has index.html at its root', zipFiles.has('index.html'), `${zipFiles.size} files`);
      await flow(browser, `${origin}/zip/`, 'Unpacked release ZIP');
    } else record('Release ZIP present', false, `${ZIP} not found (run npm run package)`);

    // ── iframe embedding ─────────────────────────────────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      const problems = await watch(page);
      await page.goto(`${origin}/host.html`);
      const frame = page.frameLocator('#game');
      await frame.getByRole('button', { name: /New campaign/ }).click();
      await frame.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
      await frame.locator('canvas.map').waitFor();
      await page.waitForTimeout(400);
      const f = page.frames().find((x) => x.url().includes(SUB))!;
      const size = await f.evaluate(() => ({ w: innerWidth, h: innerHeight, cw: document.querySelector('canvas.map')!.clientWidth }));
      record('iframe: game adapts to the container size', size.w === 900 && size.cw > 0 && size.cw <= size.w, `frame ${size.w}×${size.h}, map ${size.cw}px wide`);
      const box = await page.locator('#game').boundingBox();
      const before = await page.evaluate(() => scrollY);
      await page.mouse.move(box!.x + 450, box!.y + 350);
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => scrollY);
      record('iframe: zooming the map does not scroll the host page', after === before, `host scrollY ${before} → ${after}`);
      await page.evaluate(() => {
        (document.getElementById('game') as HTMLIFrameElement).width = '640';
      });
      await page.waitForTimeout(500);
      const cw2 = await f.evaluate(() => document.querySelector('canvas.map')!.clientWidth);
      record('iframe: resizing the container resizes the map', cw2 <= 640 && cw2 < size.cw, `map ${size.cw}px → ${cw2}px`);
      record('iframe: no errors while embedded', problems.length === 0, problems.slice(0, 3).join('; '));
      await page.close();
    }

    // ── tab hiding, keyboard, audio, save/load ───────────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      const problems = await watch(page);
      await page.goto(`${origin}/`);
      await startCampaign(page);
      await page.locator('canvas.map').click({ position: { x: 300, y: 300 } });
      await page.keyboard.press('2');
      await page.waitForTimeout(1500);
      const ticking = await page.evaluate(() => (window as any).cnf.speed);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: true, configurable: true });
        Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForTimeout(600);
      const paused = await page.evaluate(() => (window as any).cnf.speed);
      const autosaves = await page.evaluate(async () => (await (window as any).cnf.store.list()).map((s: { key: string }) => s.key));
      record('Hidden tab pauses the game and autosaves', ticking === 2 && paused === 0 && autosaves.some((k: string) => k.startsWith('autosave')), `speed ${ticking} → ${paused}; slots ${autosaves.join(', ')}`);
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { value: false, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      const audio = await page.evaluate(() => {
        const s = (window as any).cnf.sound;
        return s.ctx ? s.ctx.state : 'none';
      });
      record('Audio starts only after a user gesture, without errors', audio !== 'none', `AudioContext state: ${audio}`);
      await page.keyboard.press('d');
      await page.waitForTimeout(150);
      const diplo = await page.locator('.drawer:not(.closed) h2', { hasText: 'Diplomacy' }).count();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const closed = await page.locator('.drawer.closed').count();
      record('Keyboard: D opens Diplomacy, Esc closes', diplo === 1 && closed === 1);
      // save to a slot, return to the menu, load it back
      const tick = await page.evaluate(() => (window as any).cnf.sim.state.tick);
      await page.getByRole('button', { name: 'Game menu' }).click();
      await page.locator('.modal').getByRole('button', { name: 'Slot 1' }).click();
      await page.waitForTimeout(300);
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to file' }).click()]);
      const exportPath = join('reports', 'tmp', 'export.json');
      mkdirSync(join('reports', 'tmp'), { recursive: true });
      await download.saveAs(exportPath);
      await page.getByRole('button', { name: 'Save and quit to menu' }).click();
      await page.waitForSelector('.screen .menu-list button');
      await page.getByRole('button', { name: /Load or import/ }).click();
      // after quitting, deleting a save still asks first (the dialog used to stay with the closed campaign)
      await page.locator('.save-card', { hasText: 'Slot 1' }).getByRole('button', { name: 'Delete this save' }).click();
      const asked = await page.locator('.modal:visible h2', { hasText: 'Delete this save?' }).count();
      await page.locator('.modal:visible').getByRole('button', { name: 'Cancel' }).click();
      const kept = await page.locator('.save-card', { hasText: 'Slot 1' }).count();
      record('On the menu screens, deleting a save asks first; Cancel keeps it', asked === 1 && kept === 1, `confirmation shown ${asked}, slot kept ${kept}`);
      await page.locator('.save-card', { hasText: 'Slot 1' }).getByRole('button', { name: 'Load' }).click();
      await page.waitForSelector('canvas.map');
      const loaded = await page.evaluate(() => (window as any).cnf.sim.state.tick);
      record('Save to a slot and load it back', loaded === tick, `tick ${tick} → ${loaded}`);
      // import the exported file
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
      await chooser.setFiles(exportPath);
      await page.waitForTimeout(500);
      const imported = await page.evaluate(() => (window as any).cnf.sim?.state.tick);
      record('Export to file and import it again', imported === tick, `exported ${readFileSync(exportPath).length} bytes`);
      // a damaged import keeps the current campaign
      writeFileSync(join('reports', 'tmp', 'broken.json'), readFileSync(exportPath, 'utf8').slice(0, 5000));
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
      await chooser2.setFiles(join('reports', 'tmp', 'broken.json'));
      await page.waitForTimeout(400);
      const msg = await page.locator('.modal h2', { hasText: 'Cannot load this save' }).count();
      const still = await page.evaluate(() => (window as any).cnf.sim?.state.tick);
      record('A damaged save is rejected and the campaign is kept', msg === 1 && still === tick);
      // a save from the first release (format 1) is converted, and the player is told
      await page.locator('.modal footer button').first().click();
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [chooser3] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
      await chooser3.setFiles(join('tests', 'fixtures', 'reach-save-main-c29aea6.json'));
      await page.waitForSelector('.modal h2:has-text("This save was converted")', { timeout: 10000 }).catch(() => null);
      const old = await page.evaluate(() => ({ tick: (window as any).cnf.sim?.state.tick, schema: (window as any).cnf.sim?.state.schema, map: (window as any).cnf.sim?.state.scenarioId }));
      const notice = await page.locator('.modal', { hasText: 'save format 1' }).count();
      record('A format-1 save is converted on import, with a notice', old.tick === 60 && old.schema === SCHEMA_VERSION && old.map === 'reach' && notice === 1, `tick ${old.tick}, format ${old.schema}, ${old.map}`);
      // a format-2 save (Stage A build) is converted to the industrial age, and the player is told
      await page.locator('.modal footer button').first().click();
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [chooser4] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
      await chooser4.setFiles(join('tests', 'fixtures', 'aldmere-save-format2-168569b.json'));
      await page.waitForSelector('.modal h2:has-text("This save was converted")', { timeout: 10000 }).catch(() => null);
      const f2 = await page.evaluate(() => {
        const sim = (window as any).cnf.sim;
        const regs = Object.values<any>(sim?.state.armies ?? {}).flatMap((a) => a.regiments.map((r: any) => r.type));
        return { tick: sim?.state.tick, schema: sim?.state.schema, map: sim?.state.scenarioId, oldUnits: regs.filter((t: string) => ['foot', 'horse', 'guns'].includes(t)).length };
      });
      const notice2 = await page.locator('.modal', { hasText: 'industrial age' }).count();
      record('A format-2 save is converted to the industrial age on import, with a notice', f2.tick === 240 && f2.schema === SCHEMA_VERSION && f2.map === 'aldmere' && f2.oldUnits === 0 && notice2 === 1, `tick ${f2.tick}, format ${f2.schema}, ${f2.map}`);
      // a stored save that cannot be converted stays listed, is refused with a reason, and can still be exported
      const unconvertible = JSON.parse(readFileSync(join('tests', 'fixtures', 'custom-map-save-format2-168569b.json'), 'utf8'));
      unconvertible.mapPackage.provinces[0].neighbors.push('nowhere');
      const unconvertibleText = JSON.stringify(unconvertible);
      await page.evaluate((t) => (window as any).cnf.store.put('slot-9', t), unconvertibleText);
      await page.locator('.modal footer button').first().click();
      await page.getByRole('button', { name: 'Game menu' }).click();
      await page.getByRole('button', { name: 'Save and quit to menu' }).click();
      await page.waitForSelector('.screen .menu-list button');
      await page.getByRole('button', { name: /Load or import/ }).click();
      const card9 = page.locator('.save-card', { hasText: 'Slot 9' });
      await card9.waitFor({ timeout: 5000 }).catch(() => null);
      const olderNote = await card9.locator('text=earlier version').count();
      await card9.getByRole('button', { name: 'Load' }).click();
      const refusal = page.locator('.modal', { hasText: 'Cannot load this save' });
      await refusal.waitFor({ timeout: 5000 }).catch(() => null);
      const reason = (await refusal.textContent().catch(() => '')) ?? '';
      await refusal.locator('footer button').first().click().catch(() => null);
      const [dl9] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), card9.getByRole('button', { name: 'Export this save to a file' }).click()]).catch(() => [null]);
      const dlPath = dl9 ? await dl9.path() : null;
      const exportedSame = !!dlPath && readFileSync(dlPath, 'utf8') === unconvertibleText;
      record(
        'A save that cannot be converted stays listed, is refused with a reason and can be exported',
        olderNote === 1 && /cannot be/.test(reason) && (await card9.count()) === 1 && exportedSame,
        reason.replace(/\s+/g, ' ').slice(0, 140),
      );
      record('No errors during the session', problems.length === 0, problems.slice(0, 3).join('; '));
      await page.close();
    }

    // ── performance probe (fastest speed, AI active) ────────────────────────
    {
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
      await page.goto(`${origin}/`);
      await startCampaign(page);
      // plain JS source: transpiler helpers must not leak into the page
      const probe = `(async () => {
        const app = window.cnf;
        const draws = [];
        const orig = app.renderer.draw.bind(app.renderer);
        app.renderer.draw = (...args) => { const t = performance.now(); orig(...args); draws.push(performance.now() - t); };
        const tick0 = app.sim.state.tick;
        let frames = 0;
        const t0 = performance.now();
        app.setSpeed(4);
        await new Promise((resolve) => {
          const loop = () => {
            frames++;
            if (app.speed === 0) {
              const b = document.querySelector('.modal-layer:not(.hidden) footer button');
              if (b) b.click();
              app.setSpeed(4);
            }
            if (performance.now() - t0 < 6000) requestAnimationFrame(loop); else resolve();
          };
          requestAnimationFrame(loop);
        });
        const secs = (performance.now() - t0) / 1000;
        app.setSpeed(0);
        draws.sort((a, b) => a - b);
        const mem = (performance.memory && performance.memory.usedJSHeapSize) || 0;
        return { fps: frames / secs, drawAvg: draws.reduce((a, b) => a + b, 0) / Math.max(1, draws.length), drawP95: draws[Math.floor(draws.length * 0.95)] || 0, ticks: app.sim.state.tick - tick0, secs, heapMB: mem / 1e6 };
      })()`;
      const perf = (await page.evaluate(probe)) as { fps: number; drawAvg: number; drawP95: number; ticks: number; secs: number; heapMB: number };
      const detail = `${perf.fps.toFixed(0)} fps, map draw avg ${perf.drawAvg.toFixed(1)} ms (p95 ${perf.drawP95.toFixed(1)} ms), ${perf.ticks} weeks simulated in ${perf.secs.toFixed(1)} s at fastest speed, JS heap ${perf.heapMB.toFixed(0)} MB`;
      record('Performance probe (headless, software rendering)', perf.drawAvg < 16 && perf.ticks > 10, detail);
      await page.close();
    }

    // ── common laptop / Chromebook sizes and UI scaling ─────────────────────
    for (const [w, hgt, scale] of [[1024, 768, 1], [1280, 720, 1], [1366, 768, 1.3], [1536, 864, 1], [1920, 1080, 1]] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      const problems = await watch(page);
      await page.goto(`${origin}/`);
      await page.waitForSelector('.menu-list button');
      await page.evaluate((s) => (window as any).cnf.updateSettings({ uiScale: s }), scale);
      await startCampaign(page);
      await page.keyboard.press('b');
      await page.waitForTimeout(200);
      const res = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight,
        topbar: document.querySelector('.hud')!.getBoundingClientRect().height,
        modalFits: document.querySelector('.drawer')!.getBoundingClientRect().bottom <= innerHeight + 1,
      }));
      record(`Layout ${w}×${hgt} (UI scale ${scale})`, !res.overflow && res.modalFits && problems.length === 0, `top bar ${Math.round(res.topbar)} px${res.overflow ? '; page overflows' : ''}${res.modalFits ? '' : '; ledger taller than the window'}`);
      await page.evaluate(() => (window as any).cnf.updateSettings({ uiScale: 1 }));
      await page.close();
    }

    // ── touch ───────────────────────────────────────────────────────────────
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const problems = await watch(page);
      await page.goto(`${origin}/`);
      await page.getByRole('button', { name: /New campaign/ }).tap();
      await page.locator('button:visible', { hasText: 'Begin campaign' }).first().tap();
      await page.waitForSelector('canvas.map');
      await page.waitForTimeout(400);
      const p = await page.evaluate(() => {
        const app = (window as any).cnf;
        const cap = app.sim.state.nations[app.player].capital;
        const c = app.renderer.provinceCenter(cap);
        const s = app.renderer.camera.toScreen(c.x, c.y);
        const r = app.canvas.getBoundingClientRect();
        return { x: s.x + r.left, y: s.y + r.top + 14, cap };
      });
      await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(400);
      const sel = await page.evaluate(() => (window as any).cnf.selectedProvince);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      record('Touch: tapping a province selects it (390×780 phone)', sel === p.cap, `selected ${sel}, expected ${p.cap}`);
      record('Phone layout has no horizontal page scroll', !overflow);
      record('Touch session without errors', problems.length === 0, problems.slice(0, 3).join('; '));
      await ctx.close();
    }

    // ── storage unavailable ─────────────────────────────────────────────────
    {
      const ctx = await browser.newContext();
      await ctx.addInitScript(() => {
        Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
        const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); }, key() { return null; }, length: 0, clear() {} };
        Object.defineProperty(window, 'localStorage', { value: throwing, configurable: true });
      });
      const page = await ctx.newPage();
      const problems = await watch(page);
      await page.goto(`${origin}/`);
      await page.waitForSelector('.screen .menu-list button');
      const warned = await page.getByText(/blocks storage/).count();
      await startCampaign(page);
      const drawn = await canvasDrawn(page);
      record('Blocked storage: warning shown and the game still runs', warned === 1 && drawn && problems.length === 0, problems.slice(0, 2).join('; '));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const failed = checks.filter((c) => !c.ok);
  const lines = [
    '# Web build verification',
    '',
    `Generated by \`npm run verify:web\` — ${new Date().toISOString()}`,
    '',
    `Environment: Chromium ${version} (Playwright, headless), Node ${process.version}, ${process.platform}. Served over HTTP by a local static server.`,
    '',
    '| Result | Check | Detail |',
    '|---|---|---|',
    ...checks.map((c) => `| ${c.ok ? 'PASS' : '**FAIL**'} | ${c.name} | ${c.detail.replace(/\|/g, '/')} |`),
    '',
    `${checks.length - failed.length}/${checks.length} checks passed.`,
    '',
    'Not covered here: other browser engines (Firefox, Safari), real Chromebook hardware, and real touch devices — see DEPLOYMENT.md.',
  ];
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/web-verification.md', lines.join('\n') + '\n');
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed. Report: reports/web-verification.md`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
