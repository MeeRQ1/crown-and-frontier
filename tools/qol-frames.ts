// Responsiveness with many forces in play: the large-force campaign (a save) runs
// at the fastest speed in a production build while the frame intervals, long
// tasks and the time from a click on the map to the next frame are recorded.
// With --ops the player's operations are created first (East: conquer the
// Polish border land; West: hold the French border; the seas), as the interface
// does; without, the campaign runs as on main (the AI plays every other realm).
//   npx tsx tools/qol-frames.ts --dist dist --save reports/tmp/qol-large.json [--ops] [--seconds 15] [--out file.json]

import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { loadSave, serve } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const SAVE = get('save', 'reports/tmp/qol-large.json');
const OPS = args.includes('--ops');
const SECONDS = Number(get('seconds', '15'));
const OUT = get('out', '');

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(1) : 0;
};

async function main(): Promise<void> {
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await loadSave(page, origin, SAVE, 'ger');
  if (OPS) {
    const r = await page.evaluate(() => {
      const app = (window as any).cnf;
      const sim = app.sim;
      const st = sim.state;
      const ger = Object.values(st.armies).filter((a: any) => a.nation === 'ger') as any[];
      const fra = new Set(sim.world.provIds.filter((p: string) => st.provinces[p].owner === 'fra'));
      const west = ger.filter((a) => sim.world.prov[a.location].neighbors.some((n: string) => fra.has(n)));
      const east = ger.filter((a) => !west.includes(a));
      const pol = sim.world.provIds.filter((p: string) => st.provinces[p].controller === 'pol' && east.some((a) => (sim.world.hop(a.location, p) ?? 99) <= 5));
      const hold = sim.world.provIds.filter((p: string) => st.provinces[p].owner === 'ger' && sim.world.prov[p].neighbors.some((n: string) => fra.has(n)));
      const wings = Object.values(st.wings).filter((w: any) => w.nation === 'ger').map((w: any) => w.id);
      const fleets = Object.values(st.fleets).filter((f: any) => f.nation === 'ger') as any[];
      const out = [
        app.do({ type: 'createOp', kind: 'conquer', area: pol, units: [...east.map((a) => a.id), ...wings], settings: { rebase: true, airborne: 'once', airborneRisk: 0.35 }, activate: true }, true).ok,
        app.do({ type: 'createOp', kind: 'hold', area: hold, units: west.map((a) => a.id), activate: true }, true).ok,
        app.do({ type: 'createOp', kind: 'sea', area: [], zones: [...new Set(fleets.map((f) => f.zone))], units: fleets.map((f) => f.id), activate: true }, true).ok,
      ];
      return out;
    });
    console.log('operations created', r);
  }
  // the view: the eastern front at regional zoom (armies, fleets and wings on screen)
  await page.evaluate(() => {
    const app = (window as any).cnf;
    const c = app.renderer.provinceCenter(app.sim.state.nations.pol.capital);
    app.renderer.camera.centerOn(c.x - 200, c.y, app.renderer.camera.zoomForProvincePx(40), false);
    app.mapDirty = true;
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    w.__long = [];
    w.__lat = [];
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__pending) {
        w.__lat.push(t - w.__pending);
        w.__pending = 0;
      }
      if (!w.__stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) w.__long.push(e.duration);
      }).observe({ type: 'longtask', buffered: false });
    } catch {
      /* no long-task timing */
    }
    window.addEventListener('pointerup', () => (w.__pending = performance.now()), true);
    w.__tick0 = w.cnf.sim.state.tick;
    w.cnf.setSpeed(4);
  });
  // clicks on the map while it runs (a province, then an army of ours)
  const t0 = Date.now();
  let clicks = 0;
  while (Date.now() - t0 < SECONDS * 1000) {
    await page.waitForTimeout(1500);
    const pt = await page.evaluate(() => {
      const app = (window as any).cnf;
      const r = app.canvas.getBoundingClientRect();
      const m = app.renderer.markers.find((x: any) => app.sim.state.armies[x.army]?.nation === 'ger');
      return m ? { x: m.x + m.w / 2 + r.left, y: m.y + m.h / 2 + r.top } : { x: r.left + 500, y: r.top + 300 };
    });
    await page.mouse.click(pt.x, pt.y);
    clicks++;
  }
  const res = await page.evaluate(() => {
    const w = window as any;
    w.__stop = true;
    w.cnf.setSpeed(0);
    return { frames: w.__frames.slice(5) as number[], long: w.__long as number[], lat: w.__lat as number[], weeks: w.cnf.sim.state.tick - w.__tick0, ops: Object.keys(w.cnf.sim.state.operations ?? {}).length };
  });
  const out = {
    dist: DIST,
    ops: OPS,
    seconds: SECONDS,
    weeksSimulated: res.weeks,
    operations: res.ops,
    frames: res.frames.length,
    frameMs: { p50: pct(res.frames, 50), p95: pct(res.frames, 95), p99: pct(res.frames, 99), max: +Math.max(...res.frames).toFixed(1) },
    framesOver50ms: res.frames.filter((x) => x > 50).length,
    longTasks: { count: res.long.length, maxMs: res.long.length ? +Math.max(...res.long).toFixed(1) : 0, totalMs: +res.long.reduce((s, x) => s + x, 0).toFixed(0) },
    clickToFrameMs: { clicks, p50: pct(res.lat, 50), max: res.lat.length ? +Math.max(...res.lat).toFixed(1) : 0 },
    errors,
  };
  console.log(JSON.stringify(out));
  if (OUT) writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`);
  await browser.close();
  close();
}

void main();
