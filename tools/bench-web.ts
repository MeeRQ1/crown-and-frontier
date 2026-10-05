// Browser benchmarks on the production build (headless Chromium, software
// rendering): load and campaign creation, frame cost while panning at each zoom
// tier and in each map mode, frames during battles, ledger rendering, frames
// while the game runs at its fastest speed (simulation and drawing on the main
// thread), and heap / DOM growth over a long session.
//
//   npm run build && npx tsx tools/bench-web.ts [--maps reach,aldmere,file.json] [--years 10] [--out reports/perf/web.md]
//
// Numbers from headless software rendering are not real-device numbers; they
// are comparable between revisions on the same machine.

import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { cpus } from 'node:os';
import { chromium, type Page } from 'playwright';

declare global {
  interface Window {
    // the app's debugging handle (src/main.ts); untyped here, as in verify-web
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cnf: any;
  }
}

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const maps = get('maps', 'reach,aldmere').split(',');
const years = Number(get('years', '10'));
const outPath = get('out', '');
const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (!p || p.endsWith('/')) p += 'index.html';
  try {
    const body = readFileSync(join('dist', p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}/`;

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => (s.length ? s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))] : 0);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { n: s.length, avg: r(s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)), p95: r(q(0.95)), max: r(q(1)) };
};

const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const lines: string[] = [];
const log = (s = '') => {
  lines.push(s);
  console.log(s);
};
log(`Browser benchmarks — headless Chromium ${browser.version()} (software rendering), 1366×768, ${cpus()[0]?.model} ×${cpus().length}, ${new Date().toISOString().slice(0, 10)}`);
log('');

async function newPage(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.on('pageerror', (e) => log(`  page error: ${e.message}`));
  return page;
}

for (const m of maps) {
  const page = await newPage();
  const t0 = Date.now();
  await page.goto(base);
  await page.waitForSelector('.menu-list button');
  const menuMs = Date.now() - t0;
  let scenario = m;
  if (m.endsWith('.json')) {
    const text = readFileSync(m, 'utf8');
    const res = await page.evaluate((t) => window.cnf.registerMapPackage(t), text);
    if (!res.id) {
      log(`${m}: invalid map (${res.check.errors.map((e: { message: string }) => e.message).join('; ')})`);
      continue;
    }
    scenario = res.id;
  }
  const create = await page.evaluate(async (scn) => {
    const a = window.cnf;
    const t = performance.now();
    a.newGame({ scenario: scn, seed: 3, playerNation: null, difficulty: 'normal' }, false);
    const created = performance.now() - t;
    while (!a.renderer) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { created, ready: performance.now() - t, provinces: a.sim.world.provIds.length, realms: a.sim.world.nationIds.length };
  }, scenario);
  log(`### ${scenario} — ${create.provinces} provinces, ${create.realms} realms`);
  log('');
  log(`- Page load to menu: ${menuMs} ms; new campaign: simulation ${Math.round(create.created)} ms, first frame after ${Math.round(create.ready)} ms (includes loading the map geometry).`);

  // panning at each zoom tier, political mode
  const tiers = await page.evaluate(async () => {
    const a = window.cnf;
    const r = a.renderer;
    const cam = r.camera;
    const out: Record<string, { draw: number[]; frame: number[] }> = {};
    for (const [tier, px, lod] of [['far (no level of detail)', 30, false], ['far', 30, true], ['medium', 90, true], ['close', 200, true]] as const) {
      r.lod = lod;
      const ids = a.sim.world.provIds;
      const c = r.provinceCenter(ids[Math.floor(ids.length / 2)]);
      cam.centerOn(c.x, c.y, cam.zoomForProvincePx(px), false);
      for (let i = 0; i < 20; i++) {
        a.mapDirty = true;
        await new Promise((res) => requestAnimationFrame(res));
      }
      const draw: number[] = [];
      const frame: number[] = [];
      const orig = r.draw.bind(r);
      r.draw = (...x: unknown[]) => {
        const t = performance.now();
        const v = orig(...(x as Parameters<typeof orig>));
        draw.push(performance.now() - t);
        return v;
      };
      let last = performance.now();
      for (let i = 0; i < 60; i++) {
        cam.pan(7, 4);
        a.mapDirty = true;
        await new Promise((res) => requestAnimationFrame(res));
        const now = performance.now();
        frame.push(now - last);
        last = now;
      }
      r.draw = orig;
      out[tier] = { draw, frame };
    }
    return out;
  });
  log('');
  log('| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |');
  log('|---|---|---|---|---|---|');
  for (const [k, v] of Object.entries(tiers)) {
    const d = stats(v.draw);
    const f = stats(v.frame);
    log(`| ${k} | ${d.avg} | ${d.p95} | ${d.max} | ${f.avg} | ${f.p95} |`);
  }

  // every map mode at medium zoom
  const modes = await page.evaluate(async () => {
    const a = window.cnf;
    const r = a.renderer;
    const out: Record<string, number[]> = {};
    for (const mode of ['political', 'terrain', 'supply', 'economy', 'frontier', 'diplomacy', 'military', 'resources', 'sea']) {
      a.setMode(mode);
      for (let i = 0; i < 10; i++) {
        a.mapDirty = true;
        await new Promise((res) => requestAnimationFrame(res));
      }
      const draw: number[] = [];
      const orig = r.draw.bind(r);
      r.draw = (...x: unknown[]) => {
        const t = performance.now();
        const v = orig(...(x as Parameters<typeof orig>));
        draw.push(performance.now() - t);
        return v;
      };
      for (let i = 0; i < 30; i++) {
        r.camera.pan(-6, 3);
        a.mapDirty = true;
        await new Promise((res) => requestAnimationFrame(res));
      }
      r.draw = orig;
      out[mode] = draw;
    }
    a.setMode('political');
    return out;
  });
  log('');
  log(`Map modes while panning at medium zoom (draw ms, avg / p95): ${Object.entries(modes).map(([k, v]) => `${k} ${stats(v).avg} / ${stats(v).p95}`).join('; ')}.`);

  // ledgers
  const ledgers = await page.evaluate(async () => {
    const a = window.cnf;
    const out: Record<string, number> = {};
    for (const tab of ['realm', 'industry', 'military', 'research', 'focus', 'diplomacy', 'wars', 'victory', 'log']) {
      const t = performance.now();
      a.openLedger(tab);
      out[tab] = performance.now() - t;
      await new Promise((res) => requestAnimationFrame(res));
    }
    a.closeLedger();
    return out;
  });
  log(`Opening ledgers (ms): ${Object.entries(ledgers).map(([k, v]) => `${k} ${Math.round(v * 10) / 10}`).join(', ')}.`);

  // running at the fastest speed: simulation and drawing share the main thread
  const run = await page.evaluate(async () => {
    const a = window.cnf;
    a.updateSettings({ autoPauseProposal: false, autoPauseEvent: false, autoPauseWar: false, autoPauseBattle: false });
    const frames: number[] = [];
    const startTick = a.sim.state.tick;
    a.setSpeed(4);
    let last = performance.now();
    const until = last + 6000;
    while (performance.now() < until) {
      await new Promise((res) => requestAnimationFrame(res));
      const now = performance.now();
      frames.push(now - last);
      last = now;
      if (a.speed === 0) a.setSpeed(4);
    }
    a.setSpeed(0);
    return { frames, weeks: a.sim.state.tick - startTick };
  });
  const rf = stats(run.frames);
  log(`Fastest speed for 6 s: ${run.weeks} weeks simulated (target 36); frame avg ${rf.avg} ms, p95 ${rf.p95} ms, worst ${rf.max} ms.`);

  // battles: advance until fighting, then measure animated frames
  const battle = await page.evaluate(async () => {
    const a = window.cnf;
    let weeks = 0;
    while (Object.keys(a.sim.state.battles).length === 0 && weeks < 480) {
      a.debugAdvance(4);
      weeks += 4;
    }
    const n = Object.keys(a.sim.state.battles).length;
    if (!n) return null;
    const pid = (Object.values(a.sim.state.battles)[0] as { province: string }).province;
    a.centerOn(pid);
    const r = a.renderer;
    const draw: number[] = [];
    const orig = r.draw.bind(r);
    r.draw = (...x: unknown[]) => {
      const t = performance.now();
      const v = orig(...(x as Parameters<typeof orig>));
      draw.push(performance.now() - t);
      return v;
    };
    for (let i = 0; i < 60; i++) await new Promise((res) => requestAnimationFrame(res));
    r.draw = orig;
    return { battles: n, draw };
  });
  if (battle) log(`Battle on screen (${battle.battles} under way): draw avg ${stats(battle.draw).avg} ms, p95 ${stats(battle.draw).p95} ms over ${battle.draw.length} frames.`);

  // long session: heap and DOM over years of play
  const longRun = await page.evaluate(async (yrs) => {
    const a = window.cnf;
    // no local helper functions here: the bundler would wrap them in a helper the page lacks
    const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
    const out: Array<{ year: number; heapMB: number; dom: number; stateKB: number; ms: number }> = [];
    const t0 = performance.now();
    for (let y = 1; y <= yrs; y++) {
      for (let q = 0; q < 12; q++) {
        a.debugAdvance(4);
        await new Promise((res) => setTimeout(res, 0));
      }
      if (y % 2 === 0 || y === yrs) out.push({ year: y, heapMB: Math.round((perf.memory?.usedJSHeapSize ?? 0) / 104857.6) / 10, dom: document.getElementsByTagName('*').length, stateKB: Math.round(JSON.stringify(a.sim.state).length / 1024), ms: Math.round(performance.now() - t0) });
    }
    return out;
  }, years);
  log(`Long session (${years} years at full speed, heap MB / DOM nodes / state KB): ${longRun.map((x) => `y${x.year} ${x.heapMB} / ${x.dom} / ${x.stateKB}`).join('; ')}; ${Math.round(longRun.at(-1)!.ms / 1000)} s of wall time.`);
  log('');
  await page.close();
}
await browser.close();
server.close();
if (outPath) writeFileSync(outPath, lines.join('\n') + '\n');
