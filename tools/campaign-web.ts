// A complete campaign in the browser, from the main menu to the end screen, on a
// production build. The Reach as Fenward, the shortest campaign (25 years), Normal.
//
// Through the real controls: New campaign, map, realm, length, Begin; the clock at the
// fastest speed; Simple Auto-conquer from the Military ledger whenever we are at war
// and it is not running; Export to file and Import file half-way (the campaign goes on
// from the imported copy); the end screen. The player's other decisions go through the
// same command call the interface uses (cnf.do), as a plain player would make them:
//   - every half year at peace from the second year, war on the weakest neighbour
//     (a conquest of up to two border provinces), at most one war every three years
//   - a production order for four infantry at the capital once a year, when affordable
//   - peace offers from enemies accepted unless they take our land; alliances and
//     trade accepted; everything else declined
// The final state is exported once more and checked in Node: it loads, and every
// invariant holds.
//   npm run build && npx tsx tools/campaign-web.ts [--dist dist] [--years 25] [--out reports/playability/after]

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { checkInvariants } from '../src/sim/invariants';
import { readSave } from '../src/sim/save';
import { serve } from './qol-audit';

const args = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const DIST = get('dist', 'dist');
const YEARS = Number(get('years', '25'));
const OUT = get('out', 'reports/playability/after');
const TMP = join('reports', 'tmp');

type Cnf = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function exportSave(page: Page, name: string): Promise<string> {
  await page.getByRole('button', { name: 'Game menu' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export to file' }).click()]);
  const path = join(TMP, name);
  await dl.saveAs(path);
  await page.keyboard.press('Escape');
  return path;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  const { origin, close } = await serve(DIST);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript('window.__name = (f) => f;');
  const t0 = Date.now();
  await page.goto(origin);
  await page.getByRole('button', { name: /New campaign/ }).click();
  await page.locator('[data-map="reach"]').click();
  await page.locator('[data-realm="fen"]').click();
  await page.locator('button:visible', { hasText: new RegExp(`^(.* · )?${YEARS} years`) }).first().click();
  await page.locator('button:visible', { hasText: 'Begin campaign' }).first().click();
  await page.waitForSelector('canvas.map');
  const start = await page.evaluate(() => {
    const a = (window as Cnf).cnf;
    a.updateSettings({ autoPauseProposal: false, autoPauseEvent: false, autoPauseWar: false, autoPauseBattle: false, autoPauseOperation: false, autoPauseDefeat: false });
    const st = a.sim.state;
    return { map: st.scenarioId, player: a.player, years: st.settings.campaignYears, provinces: a.sim.world.provIds.filter((p: string) => st.provinces[p].owner === a.player).length };
  });
  const log: string[] = [];
  const r: Record<string, unknown> = { start };
  let autoPresses = 0;
  let wars = 0;
  let orders = 0;
  let answered = 0;
  let imported = false;
  const frames: number[] = [];
  for (let guard = 0; guard < 400; guard++) {
    // the player's half-yearly look at the realm
    const s = await page.evaluate(() => {
      const a = (window as Cnf).cnf;
      const sim = a.sim;
      const st = sim.state;
      const me = a.player;
      const n = st.nations[me];
      const enemies = Object.values(st.wars as Record<string, { attackers: string[]; defenders: string[] }>).flatMap((w) => (w.attackers.includes(me) ? w.defenders : w.defenders.includes(me) ? w.attackers : []));
      const auto = Object.values(st.operations ?? {}).some((o: any) => o.nation === me && o.kind === 'war' && o.status !== 'complete');
      return { tick: st.tick, over: !!st.result, alive: n.alive, treasury: n.treasury, enemies: [...new Set(enemies)], auto };
    });
    if (s.over || !s.alive) break;
    // at war and no mandate running: Auto-conquer from the Military ledger
    if (s.enemies.length && !s.auto) {
      await page.keyboard.press('KeyM');
      const act = page.locator('[data-fk="ac-activate"]');
      if (await act.count()) {
        await act.first().click();
        autoPresses++;
        log.push(`wk ${s.tick}: Auto-conquer against ${s.enemies.join(', ')}`);
      }
      await page.keyboard.press('Escape');
    }
    // decisions a plain player makes
    const d = await page.evaluate(
      ({ warsSoFar }) => {
        const a = (window as Cnf).cnf;
        const sim = a.sim;
        const st = sim.state;
        const me = a.player;
        const out: string[] = [];
        let war = 0;
        let order = 0;
        let ans = 0;
        for (const p of [...st.proposals].filter((x: any) => x.to === me)) {
          const takesOurLand = p.kind === 'peace' && (p.terms?.provinces ?? []).some((q: string) => st.provinces[q].owner === me);
          const accept = (p.kind === 'peace' && !takesOurLand) || p.kind === 'alliance' || p.kind === 'trade';
          const res = a.do({ type: 'respond', nation: me, proposal: p.id, accept }, true);
          ans++;
          out.push(`wk ${st.tick}: ${accept ? 'accepted' : 'declined'} ${p.kind} from ${p.from}${res.ok ? '' : ` (${res.reason})`}`);
        }
        const atWar = Object.values(st.wars as Record<string, { attackers: string[]; defenders: string[] }>).some((w) => w.attackers.includes(me) || w.defenders.includes(me));
        const year = st.tick / 52;
        if (!atWar && year >= 2 && (warsSoFar === 0 || st.tick - (a.__lastWar ?? -1e9) >= 156)) {
          const mine = new Set<string>(sim.world.provIds.filter((p: string) => st.provinces[p].owner === me));
          const near = new Map<string, string[]>();
          for (const p of mine) for (const q of sim.world.prov[p].neighbors as string[]) {
            const o = st.provinces[q].owner as string | null;
            if (o && o !== me) near.set(o, [...(near.get(o) ?? []), q]);
          }
          const weak = [...near.keys()].sort((x, y) => sim.world.provIds.filter((p: string) => st.provinces[p].owner === x).length - sim.world.provIds.filter((p: string) => st.provinces[p].owner === y).length);
          for (const t of weak) {
            const goal = { type: 'conquest', provinces: [...new Set(near.get(t))].slice(0, 2) };
            const res = a.do({ type: 'declareWar', nation: me, target: t, goal }, true);
            if (res.ok) {
              war++;
              a.__lastWar = st.tick;
              out.push(`wk ${st.tick}: war on ${t} for ${goal.provinces.join(', ')}`);
              break;
            }
          }
        }
        if (st.tick % 52 < 26 && st.nations[me].treasury > 150 && st.nations[me].capital) {
          const res = a.do({ type: 'orderProduction', nation: me, kind: 'regiment', unit: 'infantry', places: [st.nations[me].capital], count: 4, mode: 'total' }, true);
          if (res.ok) order++;
        }
        return { out, war, order, ans };
      },
      { warsSoFar: wars },
    );
    wars += d.war;
    orders += d.order;
    answered += d.ans;
    log.push(...d.out);
    // half-way: export to a file and carry on from the imported copy
    if (!imported && s.tick >= (YEARS * 52) / 2) {
      const path = await exportSave(page, 'campaign-half.json');
      await page.getByRole('button', { name: 'Game menu' }).click();
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Import file' }).click()]);
      await chooser.setFiles(path);
      await page.waitForFunction((t) => (window as Cnf).cnf.sim?.state.tick === t, s.tick, { timeout: 60000 });
      await page.evaluate(() => (window as Cnf).cnf.updateSettings({ autoPauseProposal: false, autoPauseEvent: false, autoPauseWar: false, autoPauseBattle: false, autoPauseOperation: false, autoPauseDefeat: false }));
      imported = true;
      r.halfWay = { tick: s.tick, file: path, bytes: readFileSync(path).length };
      log.push(`wk ${s.tick}: exported, imported, continuing`);
    }
    // half a year at the fastest speed
    const run = await page.evaluate(async (target) => {
      const a = (window as Cnf).cnf;
      const out: number[] = [];
      a.setSpeed(4);
      let last = performance.now();
      const until = last + 60000;
      while (a.sim.state.tick < target && !a.sim.state.result && performance.now() < until) {
        await new Promise((res) => requestAnimationFrame(res));
        const now = performance.now();
        out.push(now - last);
        last = now;
        if (a.speed === 0) a.setSpeed(4);
      }
      a.setSpeed(0);
      return out;
    }, s.tick + 26);
    frames.push(...run);
  }
  const end = await page.evaluate(() => {
    const a = (window as Cnf).cnf;
    const st = a.sim.state;
    const me = a.player;
    return {
      tick: st.tick,
      years: +(st.tick / 52).toFixed(1),
      result: st.result ? { winner: st.result.winner, path: st.result.path, playerOutcome: st.result.playerOutcome, reason: st.result.reason } : null,
      provinces: a.sim.world.provIds.filter((p: string) => st.provinces[p].owner === me).length,
      regiments: Object.values(st.armies).filter((x: any) => x.nation === me).reduce((n: number, x: any) => n + x.regiments.length, 0),
      endScreen: !!document.querySelector('.screen') && document.body.innerText.includes('Your reign'),
    };
  });
  await page.screenshot({ path: join(OUT, 'campaign-end.png') });
  const sorted = [...frames].sort((x, y) => x - y);
  const q = (p: number) => Math.round((sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0) * 10) / 10;
  // the final state, checked in Node
  let finalCheck: Record<string, unknown> = {};
  try {
    await page.getByRole('button', { name: /Continue|Back to the map|Keep playing/ }).first().click({ timeout: 3000 });
  } catch {
    // the end screen may offer no way back to the map; the game menu is still reachable from the map only
  }
  try {
    const path = await exportSave(page, 'campaign-end.json');
    const { sim } = readSave(readFileSync(path, 'utf8'));
    finalCheck = { loads: true, invariants: checkInvariants(sim), tick: sim.state.tick };
  } catch (e) {
    finalCheck = { exported: false, note: (e as Error).message.slice(0, 200) };
  }
  Object.assign(r, { end, wallSeconds: Math.round((Date.now() - t0) / 1000), autoConquerPresses: autoPresses, warsDeclared: wars, productionOrders: orders, proposalsAnswered: answered, frames: { n: frames.length, p50: q(0.5), p95: q(0.95), max: q(1) }, finalCheck, errors, log });
  writeFileSync(join(OUT, 'campaign.json'), JSON.stringify(r, null, 1));
  console.log(JSON.stringify({ ...r, log: log.slice(0, 40) }, null, 1));
  await browser.close();
  close();
}

void main();
