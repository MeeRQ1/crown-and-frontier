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

async function main(): Promise<void> {
  if (!existsSync(join(DIST, 'index.html'))) throw new Error('dist/ missing: run npm run build');
  const zipFiles = existsSync(ZIP) ? unzip(ZIP) : null;
  const { server, port } = await startServer(zipFiles);
  const origin = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const version = browser.version();
  try {
    await flow(browser, `${origin}/`, 'Site root');
    await flow(browser, `${origin}${SUB}`, 'Project subpath');
    await mapChoice(browser, `${origin}/`);
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
