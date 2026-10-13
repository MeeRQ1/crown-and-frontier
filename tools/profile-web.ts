// Reproducible profile of real gameplay workloads in a production build: the
// paused map under pan, zoom, selection and panels; the game running at normal and
// at the fastest speed; the largest map in a world war; a developed campaign; the
// research, focus and trade screens; and the map editor.
//
//   npm run build && npx tsx tools/profile-web.ts [--dist dist] [--base /] [--only a,b]
//       [--out reports/perf/profile.md] [--json profile.json] [--cpuprofile dir] [--label text]
//
// For each workload it records the interval between animation frames (what the
// player sees), long tasks, input latency from the Event Timing API (input delay,
// processing and presentation of clicks and key presses), where the JavaScript of
// each frame went (simulation, map drawing, interface rebuilds, minimap, hover),
// the main thread's script, style and layout time from the DevTools protocol, and
// the JavaScript heap. --cpuprofile also writes a CPU profile per workload with the
// hottest functions (use an unminified build, `npx vite build --minify false`, to
// read function names).
//
// Saves are made in Node from fixed seeds (cached in .scratch/profile-saves), so a
// workload is the same campaign every time. Run with nothing else busy on the
// machine; the report records the machine and the browser. Headless Chromium has no
// GPU here: canvas drawing is rasterised in software, which costs more than on a
// desktop with a graphics card, so compare runs only on the same machine.

import { createServer } from 'node:http';
import { cpus, totalmem } from 'node:os';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium, type CDPSession } from 'playwright';
import { createGame } from '../src/sim/game';
import { serialize } from '../src/sim/save';
import { step } from '../src/sim/tick';

declare global {
  interface Window {
    cnf: any;
    __prof: any;
  }
}

const args = process.argv.slice(2);
const get = (k: string, d = '') => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const BASE = get('base', '/').replace(/\/?$/, '/');
const only = get('only') ? new Set(get('only').split(',')) : null;
const outPath = get('out');
const jsonPath = get('json');
const cpuDir = get('cpuprofile');
const label = get('label');
const traceSet = new Set(get('trace') ? get('trace').split(',') : []);
// screen: CSS size and device pixel ratio (a high-density display: --size 1920x1080 --dpr 2)
const [VW, VH] = get('size', '1366x800').split('x').map(Number);
const DPR = Number(get('dpr', '1'));

// ───────────────────────────── saves ─────────────────────────────────────────

const SAVES = '.scratch/profile-saves';
/** An AI campaign played `weeks` weeks from a fixed seed, then handed to `player`. */
function campaign(id: string, scenario: string, seed: number, weeks: number, player: string): string {
  const file = `${SAVES}/${id}.json`;
  if (existsSync(file)) return readFileSync(file, 'utf8');
  mkdirSync(SAVES, { recursive: true });
  const t = performance.now();
  const sim = createGame({ scenario, seed, playerNation: null });
  while (sim.state.tick < weeks) step(sim);
  sim.state.settings.playerNation = player;
  for (const n of Object.values(sim.state.nations)) n.isPlayer = n.id === player;
  const text = serialize(sim);
  writeFileSync(file, text);
  console.log(`made ${id}: ${scenario} seed ${seed}, ${weeks} weeks, ${player} (${Math.round((performance.now() - t) / 1000)} s)`);
  return text;
}

// ───────────────────────────── server and browser ────────────────────────────

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png', '.txt': 'text/plain' };
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (!p.startsWith(BASE)) return void res.writeHead(404).end();
  p = p.slice(BASE.length);
  if (!p || p.endsWith('/')) p += 'index.html';
  p = normalize(p).replace(/^([/\\])+/, '');
  try {
    const body = readFileSync(join(DIST, p));
    res.writeHead(200, { 'content-type': MIME[extname(p)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}${BASE}`;
const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
const cdp: CDPSession = await page.context().newCDPSession(page);
await cdp.send('Performance.enable');
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

// tsx names functions with a __name helper that does not exist in the page
await page.addInitScript('window.__name = (f) => f;');
// frame timestamps, long tasks and event timing, from the first script on
await page.addInitScript(() => {
  const P: any = (window.__prof = { frames: [] as number[], long: [] as Array<{ t: number; d: number }>, events: [] as any[], t: {} as Record<string, number>, n: {} as Record<string, number> });
  const tick = (ts: number) => {
    P.frames.push(ts);
    if (P.frames.length > 20000) P.frames.splice(0, 10000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) P.long.push({ t: e.startTime, d: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as any[]) {
        if (!['click', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'mousedown', 'mouseup'].includes(e.name)) continue;
        P.events.push({ name: e.name, t: e.startTime, delay: e.processingStart - e.startTime, proc: e.processingEnd - e.processingStart, dur: e.duration });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as any);
  } catch {}
  // animation-frame callbacks, for the leak checks (a leaked frame loop adds one a frame)
  const raf = window.requestAnimationFrame.bind(window);
  P.rafCalls = 0;
  (window as any).requestAnimationFrame = (f: FrameRequestCallback) => {
    P.rafCalls++;
    return raf(f);
  };
  // live intervals, for the leak checks
  const live = (P.intervals = new Set<number>());
  const si = window.setInterval.bind(window);
  const ci = window.clearInterval.bind(window);
  (window as any).setInterval = (f: TimerHandler, ms?: number, ...a: unknown[]) => {
    const id = si(f, ms, ...a);
    live.add(id);
    return id;
  };
  (window as any).clearInterval = (id?: number) => {
    if (id !== undefined) live.delete(id);
    ci(id);
  };
});

/** Times the app's frame loop, map drawing, interface rebuilds, minimap and hover. */
async function instrument(): Promise<void> {
  await page.evaluate(() => {
    const app = window.cnf;
    const P = window.__prof;
    const wrap = (obj: any, name: string, key: string) => {
      if (!obj || typeof obj[name] !== 'function' || obj[name].__w) return;
      const orig = obj[name];
      const f = function (this: unknown, ...a: unknown[]) {
        const t = performance.now();
        try {
          return orig.apply(this, a);
        } finally {
          P.t[key] = (P.t[key] ?? 0) + performance.now() - t;
          P.n[key] = (P.n[key] ?? 0) + 1;
        }
      };
      (f as any).__w = 1;
      obj[name] = f;
    };
    wrap(app, 'frame', 'frame');
    wrap(app, 'drawMap', 'draw');
    wrap(app, 'renderUI', 'ui');
    wrap(app, 'hover', 'hover');
    wrap(app.minimap, 'draw', 'minimap');
    // the renderer's stages (instance methods called through this)
    const r = app.renderer;
    for (const m of ['ensureRealms', 'farLayers', 'paintRealmLayers', 'diffGround', 'modeContext', 'drawGround', 'worldLayer', 'drawSeaZones', 'drawStraits', 'drawRoads', 'drawBattles', 'drawArmies', 'drawFleets', 'drawWings', 'drawSites', 'drawZoneNames', 'drawLabels', 'drawRoute', 'drawFleetRoutes', 'drawAirMissions']) wrap(r, m, `r.${m}`);
    wrap(r.base, 'draw', 'r.base');
    wrap(r.base, 'drawRegion', 'r.baseRegion');
    wrap(r.base, 'renderTile', 'r.tile');
    // interface pieces rebuilt by renderUI
    for (const m of ['renderRail', 'renderAttention', 'renderBanner', 'updateInsets']) wrap(app, m, `ui.${m}`);
  });
}

async function metrics(): Promise<Record<string, number>> {
  const r = (await cdp.send('Performance.getMetrics')) as { metrics: Array<{ name: string; value: number }> };
  return Object.fromEntries(r.metrics.map((m) => [m.name, m.value]));
}

async function gc(): Promise<void> {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
};
const r1 = (x: number) => Math.round(x * 10) / 10;

// ───────────────────────────── one workload ──────────────────────────────────

interface Result {
  name: string;
  what: string;
  map: string;
  tick: [number, number];
  seconds: number;
  frames: number;
  frameMs: { p50: number; p95: number; p99: number; max: number };
  slow: { over17: number; over33: number; over50: number; over100: number };
  long: { count: number; totalMs: number; maxMs: number };
  js: Record<string, number>; // ms per second of wall time
  counts: Record<string, number>;
  main: { taskMs: number; scriptMs: number; styleMs: number; layoutMs: number; layouts: number; styles: number }; // per second
  input: Array<{ name: string; delay: number; proc: number; dur: number }>;
  inputWorst: number;
  moveAck: { n: number; p50: number; p95: number; max: number } | null;
  trace?: Array<{ name: string; selfMs: number }>;
  heapMB: [number, number];
  domNodes: [number, number];
  hot?: Array<{ fn: string; selfMs: number; pct: number }>;
}
const results: Result[] = [];

async function measure(name: string, what: string, body: () => Promise<void>): Promise<void> {
  if (only && !only.has(name)) return;
  await gc();
  const m0 = await metrics();
  await page.evaluate(() => {
    const P = window.__prof;
    P.mark = performance.now();
    P.t = {};
    P.n = {};
  });
  const s0 = await page.evaluate(() => ({ tick: window.cnf.sim?.state.tick ?? 0, map: window.cnf.sim?.state.scenarioId ?? '—' }));
  if (cpuDir) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  moveAck = [];
  const tracing = traceSet.has(name);
  if (tracing) await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'blink', 'cc', 'gpu', 'viz', 'skia'] });
  const t0 = Date.now();
  await body();
  const seconds = (Date.now() - t0) / 1000;
  let trace: Result['trace'];
  if (tracing) {
    const buf = await browser.stopTracing();
    mkdirSync('.scratch/traces', { recursive: true });
    writeFileSync(`.scratch/traces/${name}.json`, buf);
    trace = traceSummary(JSON.parse(buf.toString()), seconds);
  }
  let hot: Result['hot'];
  if (cpuDir) {
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: any };
    mkdirSync(cpuDir, { recursive: true });
    writeFileSync(`${cpuDir}/${name}.cpuprofile`, JSON.stringify(profile));
    hot = hottest(profile);
  }
  const m1 = await metrics();
  const s1 = await page.evaluate(() => {
    const P = window.__prof;
    const since = P.mark as number;
    const fr = (P.frames as number[]).filter((t) => t >= since);
    const gaps: number[] = [];
    for (let i = 1; i < fr.length; i++) gaps.push(fr[i] - fr[i - 1]);
    return {
      gaps,
      long: (P.long as Array<{ t: number; d: number }>).filter((x) => x.t >= since),
      events: (P.events as any[]).filter((x) => x.t >= since),
      t: P.t,
      n: P.n,
      tick: window.cnf.sim?.state.tick ?? 0,
      heap: (performance as any).memory?.usedJSHeapSize ?? 0,
    };
  });
  const per = (k: string) => ((m1[k] ?? 0) - (m0[k] ?? 0)) / seconds;
  const res: Result = {
    name,
    what,
    map: s0.map,
    tick: [s0.tick, s1.tick],
    seconds: r1(seconds),
    frames: s1.gaps.length,
    frameMs: { p50: r1(pct(s1.gaps, 0.5)), p95: r1(pct(s1.gaps, 0.95)), p99: r1(pct(s1.gaps, 0.99)), max: r1(Math.max(0, ...s1.gaps)) },
    slow: { over17: s1.gaps.filter((g) => g > 17.5).length, over33: s1.gaps.filter((g) => g > 34).length, over50: s1.gaps.filter((g) => g > 50).length, over100: s1.gaps.filter((g) => g > 100).length },
    long: { count: s1.long.length, totalMs: Math.round(s1.long.reduce((a, b) => a + b.d, 0)), maxMs: Math.round(Math.max(0, ...s1.long.map((x) => x.d))) },
    js: Object.fromEntries(Object.entries(s1.t as Record<string, number>).map(([k, v]) => [k, r1(v / seconds)])),
    counts: s1.n,
    main: { taskMs: r1(per('TaskDuration') * 1000), scriptMs: r1(per('ScriptDuration') * 1000), styleMs: r1(per('RecalcStyleDuration') * 1000), layoutMs: r1(per('LayoutDuration') * 1000), layouts: r1(per('LayoutCount')), styles: r1(per('RecalcStyleCount')) },
    input: s1.events.map((e: any) => ({ name: e.name, delay: r1(e.delay), proc: r1(e.proc), dur: e.dur })),
    inputWorst: Math.max(0, ...s1.events.map((e: any) => e.dur)),
    moveAck: moveAck.length ? { n: moveAck.length, p50: r1(pct(moveAck, 0.5)), p95: r1(pct(moveAck, 0.95)), max: r1(Math.max(...moveAck)) } : null,
    trace,
    heapMB: [r1((m0.JSHeapUsedSize ?? 0) / 1048576), r1(s1.heap / 1048576)],
    domNodes: [m0.Nodes ?? 0, m1.Nodes ?? 0],
    hot,
  };
  results.push(res);
  console.log(`  js ms/s: ${Object.entries(res.js).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (trace) console.log(`  trace (main-thread self ms per second): ${trace.slice(0, 16).map((t) => `${t.name} ${t.selfMs}`).join('; ')}`);
  const j = res.js;
  console.log(
    `${name.padEnd(22)} ${res.map.padEnd(9)} frames ${String(res.frames).padStart(4)} p50 ${res.frameMs.p50} p95 ${res.frameMs.p95} max ${res.frameMs.max} | >33ms ${res.slow.over33} | long ${res.long.count}/${res.long.maxMs}ms | js/s frame ${j.frame ?? 0} draw ${j.draw ?? 0} ui ${j.ui ?? 0} mini ${j.minimap ?? 0} | main/s task ${res.main.taskMs} script ${res.main.scriptMs} style ${res.main.styleMs} layout ${res.main.layoutMs} | input worst ${res.inputWorst}${res.moveAck ? ` move p50 ${res.moveAck.p50} p95 ${res.moveAck.p95}` : ''} | tiles rendered ${res.counts['r.tile'] ?? 0}, draws ${res.counts.draw ?? 0} | weeks ${res.tick[1] - res.tick[0]} in ${res.seconds} s`,
  );
}

/** Self time per event name on the renderer's main thread, per second of the workload. */
function traceSummary(trace: any, seconds: number): Array<{ name: string; selfMs: number }> {
  const evs: any[] = trace.traceEvents ?? trace;
  const names = new Map<string, string>();
  for (const e of evs) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args?.name);
  const self = new Map<string, number>();
  const byThread = new Map<string, any[]>();
  for (const e of evs) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const k = `${e.pid}:${e.tid}`;
    const tn = names.get(k) ?? '';
    if (tn !== 'CrRendererMain') {
      // other threads: total time by thread name (raster, compositor, GPU)
      if (/Compositor|Raster|Gpu|Viz/i.test(tn) && (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'TaskGraphRunner::RunTask' || e.name === 'RunTask')) self.set(`[${tn}]`, (self.get(`[${tn}]`) ?? 0) + e.dur / 1000);
      continue;
    }
    (byThread.get(k) ?? byThread.set(k, []).get(k)!).push(e);
  }
  for (const list of byThread.values()) {
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack: any[] = [];
    for (const e of list) {
      while (stack.length && stack[stack.length - 1].ts + stack[stack.length - 1].dur <= e.ts) stack.pop();
      const parent = stack[stack.length - 1];
      if (parent) parent.__child = (parent.__child ?? 0) + e.dur;
      stack.push(e);
    }
    for (const e of list) self.set(e.name, (self.get(e.name) ?? 0) + (e.dur - (e.__child ?? 0)) / 1000);
  }
  return [...self.entries()].map(([name, ms]) => ({ name, selfMs: r1(ms / seconds) })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 30);
}

/** Self time per function from a CPU profile, the hottest first. */
function hottest(profile: any): Result['hot'] {
  const self = new Map<string, number>();
  const dt: number[] = profile.timeDeltas;
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]));
  let total = 0;
  profile.samples.forEach((id: number, i: number) => {
    const n = byId.get(id);
    const cf = n.callFrame;
    const key = `${cf.functionName || '(anonymous)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}`;
    const d = (dt[i] ?? 0) / 1000;
    total += d;
    self.set(key, (self.get(key) ?? 0) + d);
  });
  return [...self.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([fn, ms]) => ({ fn, selfMs: Math.round(ms), pct: Math.round((ms / total) * 1000) / 10 }));
}

// ───────────────────────────── interactions ──────────────────────────────────

const MAP = { x: 640, y: 420 }; // a point on the map, clear of the panels at 1366 × 800
const wait = (ms: number) => page.waitForTimeout(ms);

async function boot(): Promise<void> {
  await page.goto(origin);
  try {
    await page.waitForFunction(() => !!window.cnf, null, { timeout: 60000 });
  } catch (e) {
    console.log('the page did not start:', errors.join(' / '), await page.evaluate(() => document.body.innerText.slice(0, 300)));
    throw e;
  }
}

async function startCampaign(scenario: string, seed = 3, player: string | null = null): Promise<void> {
  await boot();
  await page.evaluate(
    ([scn, sd, pl]) => {
      window.cnf.newGame({ scenario: scn, seed: sd, playerNation: pl ?? undefined, difficulty: 'normal' }, false);
    },
    [scenario, seed, player] as const,
  );
  await page.waitForFunction(() => !!window.cnf.renderer && !!window.cnf.sim, null, { timeout: 120000 });
  await settle();
}

async function loadSave(text: string): Promise<void> {
  await boot();
  await page.evaluate((t) => window.cnf.loadText(t), text);
  await page.waitForFunction(() => !!window.cnf.renderer && !!window.cnf.sim, null, { timeout: 120000 });
  await settle();
}

async function settle(): Promise<void> {
  await page.evaluate(() => {
    const app = window.cnf;
    app.setSpeed(0);
    // the clock must keep running: no pauses for events, proposals, battles or choices
    app.updateSettings({ autoPauseWar: false, autoPauseEvent: false, autoPauseProposal: false, autoPauseChoice: false, autoPauseBattle: false });
    app.closeModal?.();
    app.tutorial?.end?.();
    for (const b of document.querySelectorAll('button')) if (/^End tutorial$/.test(b.textContent?.trim() ?? '')) (b as HTMLButtonElement).click();
  });
  await wait(1500);
  await instrument();
}

/** Time for the page to take each pointer move during drags (the browser waits for the main thread). */
let moveAck: number[] = [];

/** A drag across the map like a hand: a move every frame. */
async function drag(ms: number, dx: number, dy: number): Promise<void> {
  await page.mouse.move(MAP.x, MAP.y);
  await page.mouse.down();
  const steps = Math.round(ms / 16);
  for (let i = 1; i <= steps; i++) {
    const f = i / steps;
    const t = performance.now();
    await page.mouse.move(MAP.x + dx * Math.sin(f * Math.PI * 2), MAP.y + dy * Math.sin(f * Math.PI));
    moveAck.push(performance.now() - t);
    await wait(16);
  }
  await page.mouse.up();
}

async function panAround(seconds: number): Promise<void> {
  const reps = Math.max(1, Math.round(seconds / 1.5));
  for (let i = 0; i < reps; i++) await drag(1500, 220, 140);
}

async function wheel(steps: number, dy: number): Promise<void> {
  await page.mouse.move(MAP.x, MAP.y);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy);
    await wait(120);
  }
}

/** Opens each ledger through the app and times it to the next frame (layout and paint included). */
async function ledgerTimes(): Promise<Record<string, number>> {
  return page.evaluate(async () => {
    const app = window.cnf;
    const out: Record<string, number> = {};
    for (const tab of ['realm', 'industry', 'military', 'research', 'focus', 'diplomacy', 'wars', 'victory', 'log', 'help']) {
      await new Promise((r) => requestAnimationFrame(r));
      const t = performance.now();
      app.openLedger(tab);
      void document.body.offsetHeight;
      await new Promise((r) => requestAnimationFrame(r));
      out[tab] = Math.round(performance.now() - t);
      app.closeLedger();
    }
    return out;
  });
}

const ledgers: Array<{ where: string; ms: Record<string, number> }> = [];
async function recordLedgers(where: string): Promise<void> {
  // the median of three openings of each
  const runs = [await ledgerTimes(), await ledgerTimes(), await ledgerTimes()];
  const ms = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, [...runs.map((r) => r[k])].sort((a, b) => a - b)[1]]));
  ledgers.push({ where, ms });
  console.log(`  ledger open to next frame (ms), ${where}:`, JSON.stringify(ms));
}

/** Clicks on a grid of points over the map: each selects what is under it. */
async function clickAround(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await page.mouse.click(420 + (i % 4) * 110, 250 + Math.floor(i / 4) * 110);
    await wait(250);
  }
  await page.keyboard.press('Escape');
}

async function panels(keys: string[]): Promise<void> {
  for (const k of keys) {
    await page.keyboard.press(k);
    await wait(400);
  }
  await page.keyboard.press('Escape');
  await wait(200);
}

async function setSpeed(s: number): Promise<void> {
  await page.keyboard.press(String(s));
}

async function zoomTo(tier: 'far' | 'regional' | 'medium' | 'close'): Promise<void> {
  await page.evaluate((t) => {
    const app = window.cnf;
    const cam = app.renderer.camera;
    if (t === 'far') app.fitWorld();
    else {
      const cap = app.player ? app.sim.state.nations[app.player].capital : app.sim.world.provIds[0];
      const c = app.renderer.provinceCenter(cap);
      // provinces of 40 px are still the far tier (below 48); 90 px is the medium tier, 160 px close
      cam.centerOn(c.x, c.y, cam.zoomForProvincePx(t === 'regional' ? 40 : t === 'medium' ? 90 : 160), false);
    }
    app.mapChanged();
  }, tier);
  await wait(600);
}

// ───────────────────────────── workloads ─────────────────────────────────────

const env = `${cpus()[0]?.model} ×${cpus().length}, ${Math.round(totalmem() / 2 ** 30)} GB, headless Chromium ${browser.version()} (software rendering), ${VW}×${VH} at device pixel ratio ${DPR}, base ${BASE}`;
console.log(env);

const ALL_KEYS = ['b', 'i', 'm', 't', 'p', 'd', 'w', 'v', 'l'];

// 1. a standard map, new campaign, as a player: the paused map, then running
if (!only || ['aldmere-idle', 'aldmere-pan', 'aldmere-pan-mid', 'aldmere-pan-close', 'aldmere-zoom', 'aldmere-select', 'aldmere-panels', 'aldmere-normal', 'aldmere-max', 'aldmere-max-pan'].some((x) => only.has(x))) {
  await startCampaign('aldmere', 3, 'aur');
  await zoomTo('regional');
  await measure('aldmere-idle', 'paused, no input, 3 s', () => wait(3000));
  await measure('aldmere-pan', 'paused, dragging the map, 6 s', () => panAround(6));
  await zoomTo('medium');
  await measure('aldmere-pan-mid', 'paused, dragging at the medium tier (90 px provinces), 6 s', () => panAround(6));
  await zoomTo('close');
  await measure('aldmere-pan-close', 'paused, dragging at the close tier (160 px provinces), 6 s', () => panAround(6));
  await zoomTo('regional');
  await measure('aldmere-zoom', 'paused, 12 wheel steps in and out', async () => {
    await wheel(6, -240);
    await wheel(6, 240);
  });
  await measure('aldmere-select', 'paused, 12 clicks selecting provinces and armies', () => clickAround(12));
  await measure('aldmere-panels', 'paused, opening each ledger by its key', () => panels(ALL_KEYS));
  if (!only || only.has('aldmere-panels')) await recordLedgers('Aldmere, new campaign');
  await measure('aldmere-normal', 'running at normal speed (1 week/s), no input, 8 s', async () => {
    await setSpeed(2);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure('aldmere-max', 'running at the fastest speed (6 weeks/s), no input, 8 s', async () => {
    await setSpeed(4);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure('aldmere-max-pan', 'fastest speed while dragging the map and clicking, 6 s', async () => {
    await setSpeed(4);
    await panAround(4.5);
    await clickAround(4);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
}

// 2. a developed campaign: Aldmere after 30 years
if (!only || ['dev-pan', 'dev-max', 'dev-panels-max'].some((x) => only.has(x))) {
  await loadSave(campaign('aldmere-30y', 'aldmere', 1, 1560, 'aur'));
  await zoomTo('regional');
  await measure('dev-pan', 'developed campaign (Aldmere, 30 years), paused, dragging, 6 s', () => panAround(6));
  await measure('dev-max', 'developed campaign, fastest speed, no input, 8 s', async () => {
    await setSpeed(4);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure('dev-panels-max', 'developed campaign, fastest speed with research, focus, trade and diplomacy open', async () => {
    await setSpeed(4);
    for (const k of ['t', 'p', 'i', 'd']) {
      await page.keyboard.press(k);
      await wait(2500);
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
}

// 3. the largest map in a world war: the World, 1914 at week 280, as Britain
if (!only || ['world-idle', 'world-pan', 'world-pan-mid', 'world-pan-close', 'world-pan-far', 'world-zoom', 'world-select', 'world-panels', 'world-normal', 'world-max', 'world-max-military', 'world-max-orders', 'world-max-pan'].some((x) => only.has(x))) {
  await loadSave(campaign('earth-w280', 'earth', 1, 280, 'gbr'));
  await zoomTo('regional');
  await measure('world-idle', 'the World at war, paused, no input, 3 s', () => wait(3000));
  await measure('world-pan', 'the World at war, paused, dragging at regional zoom (far tier), 6 s', () => panAround(6));
  await zoomTo('medium');
  await measure('world-pan-mid', 'the World at war, paused, dragging at the medium tier, 6 s', () => panAround(6));
  await zoomTo('close');
  await measure('world-pan-close', 'the World at war, paused, dragging at the close tier, 6 s', () => panAround(6));
  await zoomTo('far');
  await measure('world-pan-far', 'the World at war, paused, dragging the whole world, 6 s', () => panAround(6));
  await zoomTo('regional');
  await measure('world-zoom', 'the World at war, paused, 12 wheel steps', async () => {
    await wheel(6, -240);
    await wheel(6, 240);
  });
  await measure('world-select', 'the World at war, paused, 12 clicks', () => clickAround(12));
  await measure('world-panels', 'the World at war, paused, each ledger by its key', () => panels(ALL_KEYS));
  if (!only || only.has('world-panels')) await recordLedgers('the World, week 280');
  await measure('world-normal', 'the World at war, normal speed, no input, 8 s', async () => {
    await setSpeed(2);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure('world-max', 'the World at war, fastest speed, no input, 8 s', async () => {
    await setSpeed(4);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure('world-max-military', 'the World at war, fastest speed in the military map mode (threat and fronts redrawn as armies move), 8 s', async () => {
    await page.evaluate(() => window.cnf.setMode('military'));
    await setSpeed(4);
    await wait(8000);
    await page.evaluate(() => {
      window.cnf.setSpeed(0);
      window.cnf.setMode('political');
    });
  });
  await measure('world-max-orders', 'the World at war, fastest speed, an army selected and ordered to march 8 times (right-click)', async () => {
    // the player's largest army, centred and selected
    const at = await page.evaluate(() => {
      const app = window.cnf;
      const armies = Object.values(app.sim.state.armies as Record<string, any>).filter((a) => a.nation === app.player && !a.embarked);
      armies.sort((a, b) => b.regiments.length - a.regiments.length);
      const a = armies[0];
      if (!a) return null;
      const cam = app.renderer.camera;
      const c = app.renderer.provinceCenter(a.location);
      cam.centerOn(c.x, c.y, cam.zoomForProvincePx(90), false);
      app.mapChanged();
      app.selectArmy(a.id);
      return a.id;
    });
    await wait(400);
    await setSpeed(4);
    await wait(1500);
    for (let i = 0; i < 8; i++) {
      await page.mouse.click(MAP.x + (i % 2 ? 120 : -120), MAP.y + (i % 3) * 40 - 40, { button: 'right' });
      await wait(700);
    }
    await page.evaluate(() => window.cnf.setSpeed(0));
    if (!at) console.log('  (no army to order)');
  });
  await measure('world-max-pan', 'the World at war, fastest speed while dragging and clicking, 6 s', async () => {
    await setSpeed(4);
    await panAround(4.5);
    await clickAround(4);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
}

// 3b. the 1936 maps, after five years of AI play (on request: --only e36-…,w36-…)
async function map1936(prefix: string, what: string, save: () => string): Promise<void> {
  if (!only || ![...only].some((x) => x.startsWith(`${prefix}-`))) return;
  await loadSave(save());
  await zoomTo('regional');
  await measure(`${prefix}-idle`, `${what}, paused, no input, 3 s`, () => wait(3000));
  await measure(`${prefix}-pan`, `${what}, paused, dragging at regional zoom, 6 s`, () => panAround(6));
  await zoomTo('medium');
  await measure(`${prefix}-pan-mid`, `${what}, paused, dragging at the medium tier, 6 s`, () => panAround(6));
  await zoomTo('regional');
  await measure(`${prefix}-zoom`, `${what}, paused, 12 wheel steps`, async () => {
    await wheel(6, -240);
    await wheel(6, 240);
  });
  await measure(`${prefix}-select`, `${what}, paused, 12 clicks`, () => clickAround(12));
  await measure(`${prefix}-panels`, `${what}, paused, each ledger by its key`, () => panels(ALL_KEYS));
  await measure(`${prefix}-normal`, `${what}, normal speed, no input, 8 s`, async () => {
    await setSpeed(2);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure(`${prefix}-max`, `${what}, fastest speed, no input, 8 s`, async () => {
    await setSpeed(4);
    await wait(8000);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
  await measure(`${prefix}-max-pan`, `${what}, fastest speed while dragging and clicking, 6 s`, async () => {
    await setSpeed(4);
    await panAround(4.5);
    await clickAround(4);
    await page.evaluate(() => window.cnf.setSpeed(0));
  });
}
await map1936('e36', 'Europe, 1936 at week 280 (as Germany)', () => campaign('europe-1936-w280', 'europe-1936', 1, 280, 'ger'));
await map1936('w36', 'the World, 1936 at week 280 (as Britain)', () => campaign('earth-1936-w280', 'earth-1936', 1, 280, 'gbr'));
// 3c. naval and air warfare at scale (on request: --only na-…): the World 1936 save above
// with every realm at war given front airfields, four wings on missions over each and a
// battle squadron off an enemy coast (333 wings, 85 fleets). Made once with the baseline
// commit by tools/naval-air-stress.ts, so both builds run the same campaign.
await map1936('na', 'the World 1936 at week 280, every realm at war flying front-line air missions (333 wings, 85 fleets; as Britain)', () => readFileSync(`${SAVES}/earth-1936-w280-navalair.json`, 'utf8'));

// 4. the map editor on the largest map: open a copy, drag, select and paint
if (!only || ['editor-open', 'editor-pan', 'editor-click'].some((x) => only.has(x))) {
  await page.goto(origin);
  await page.waitForFunction(() => !!window.cnf);
  await page.getByText('Map library', { exact: false }).first().click();
  await page.waitForSelector('[data-fk="copy-earth"]');
  await measure('editor-open', 'opening a copy of the World in the editor (until its map is drawn)', async () => {
    await page.click('[data-fk="copy-earth"]');
    await page.waitForFunction(() => !!document.querySelector('canvas.ed-canvas'), null, { timeout: 120000 }).catch(() => {});
    await wait(1500);
  });
  await measure('editor-pan', 'the World in the editor, dragging, 6 s', () => panAround(6));
  await measure('editor-click', 'the World in the editor, 12 clicks selecting provinces', () => clickAround(12));
}

// 5. leaks: open and close every ledger many times, then load campaigns again and
// again; after each round, the heap after garbage collection, DOM nodes, event
// listeners, live intervals and animation-frame requests per frame
interface Soak {
  step: string;
  heapMB: number;
  nodes: number;
  listeners: number;
  intervals: number;
  rafPerFrame: number;
}
const soak: Soak[] = [];
async function soakSample(stepName: string): Promise<void> {
  await wait(800);
  await gc();
  await gc();
  const m = await metrics();
  const s = await page.evaluate(async () => {
    const P = window.__prof;
    const c0 = P.rafCalls;
    const f0 = P.frames.length;
    await new Promise((r) => setTimeout(r, 1000));
    return { intervals: P.intervals.size, raf: (P.rafCalls - c0) / Math.max(1, P.frames.length - f0) };
  });
  const row = { step: stepName, heapMB: r1((m.JSHeapUsedSize ?? 0) / 1048576), nodes: m.Nodes ?? 0, listeners: m.JSEventListeners ?? 0, intervals: s.intervals, rafPerFrame: r1(s.raf) };
  soak.push(row);
  console.log(`  soak ${stepName.padEnd(34)} heap ${row.heapMB} MB, nodes ${row.nodes}, listeners ${row.listeners}, intervals ${row.intervals}, rAF/frame ${row.rafPerFrame}`);
}
if (!only || only.has('soak')) {
  const world = campaign('earth-w280', 'earth', 1, 280, 'gbr');
  const dev = campaign('aldmere-30y', 'aldmere', 1, 1560, 'aur');
  await loadSave(dev);
  await soakSample('developed Aldmere loaded');
  for (let round = 1; round <= 3; round++) {
    for (let i = 0; i < 5; i++) await panels(ALL_KEYS);
    await soakSample(`ledgers opened ${round * 5 * ALL_KEYS.length} times`);
  }
  for (let round = 1; round <= 3; round++) {
    await page.evaluate((t) => window.cnf.loadText(t), world);
    await page.waitForFunction(() => window.cnf.sim?.state.scenarioId === 'earth', null, { timeout: 120000 });
    await wait(1500);
    await page.evaluate(() => window.cnf.setSpeed(4));
    await wait(3000);
    await page.evaluate(() => window.cnf.setSpeed(0));
    await page.evaluate((t) => window.cnf.loadText(t), dev);
    await page.waitForFunction(() => window.cnf.sim?.state.scenarioId === 'aldmere', null, { timeout: 120000 });
    await wait(1500);
    await soakSample(`campaigns loaded ${round * 2 + 1} times`);
  }
}

// ───────────────────────────── report ────────────────────────────────────────

await browser.close();
server.close();
const lines: string[] = [];
lines.push(`# Gameplay profile${label ? ` — ${label}` : ''}`, '', `${env}; ${new Date().toISOString().slice(0, 10)}.`, '');
lines.push('Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app\'s frame loop and in its parts; "main" is the main thread\'s task, script, style and layout time per second from the DevTools protocol.', '');
lines.push('| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of results) {
  const weeks = r.tick[1] - r.tick[0];
  lines.push(`| ${r.name}: ${r.what} | ${r.map} | ${weeks} | ${weeks ? r1(weeks / r.seconds) : '—'} | ${r.frames} | ${r.frameMs.p50} | ${r.frameMs.p95} | ${r.frameMs.p99} | ${r.frameMs.max} | ${r.slow.over33} | ${r.long.count} (${r.long.maxMs}) | ${r.js.frame ?? 0} | ${r.js.draw ?? 0} | ${r.js.ui ?? 0} | ${r.js.minimap ?? 0} | ${r.main.taskMs} | ${r.main.scriptMs} | ${r.main.styleMs} | ${r.main.layoutMs} | ${r.inputWorst} | ${r.moveAck ? `${r.moveAck.p50} / ${r.moveAck.p95}` : '—'} | ${r.heapMB[0]} → ${r.heapMB[1]} |`);
}
if (ledgers.length) {
  lines.push('', '## Opening a ledger (ms from the call to the next frame)', '');
  const tabs = Object.keys(ledgers[0].ms);
  lines.push(`| Campaign | ${tabs.join(' | ')} |`, `|---|${tabs.map(() => '---').join('|')}|`);
  for (const l of ledgers) lines.push(`| ${l.where} | ${tabs.map((t) => l.ms[t]).join(' | ')} |`);
}
if (soak.length) {
  lines.push('', '## Leak checks (after garbage collection)', '');
  lines.push('| After | Heap MB | DOM nodes | Event listeners | Live intervals | Animation-frame requests per frame |', '|---|---|---|---|---|---|');
  for (const s of soak) lines.push(`| ${s.step} | ${s.heapMB} | ${s.nodes} | ${s.listeners} | ${s.intervals} | ${s.rafPerFrame} |`);
}
if (cpuDir) {
  lines.push('', '## Hottest functions (self time)', '');
  for (const r of results) if (r.hot) lines.push(`- **${r.name}**: ${r.hot.slice(0, 12).map((h) => `${h.fn} ${h.pct}%`).join('; ')}`);
}
lines.push('', errors.length ? `Page errors: ${errors.slice(0, 5).join(' / ')}` : 'No page errors.');
if (outPath) writeFileSync(outPath, lines.join('\n') + '\n');
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ env, label, results, ledgers, soak, errors }, null, 1));
console.log(errors.length ? `page errors: ${errors.slice(0, 5).join(' / ')}` : 'no page errors');
