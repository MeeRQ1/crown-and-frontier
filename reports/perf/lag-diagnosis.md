# Lag diagnosis: causes, fixes and before/after measurements

The previous update made the game feel nearly unplayable. This report records
how the lag was reproduced, what caused it (each cause backed by a
measurement), what was changed, and the same workloads measured before and
after on one machine with production builds. The full per-workload tables are
in `profile-before.md` and `profile-after.md` (plus `.json`); the high-density
screen runs are in `profile-hidpi-*.md`, and the run under a project subpath is
in `profile-subpath.md`.

## Environment

- Intel Xeon @ 2.1 GHz, 4 cores, 16 GB, Linux; Node 22.
- Headless Chromium 141.0.7390.37 through Playwright. **There is no GPU**, so
  canvas drawing is rasterised in software. That costs far more than on a desktop
  with a graphics card. Absolute numbers are pessimistic; the comparison is what
  counts.
- 1366×800 at device pixel ratio 1 for the full set. 1920×1080 at ratio 2 for a
  high-density subset (`--size 1920x1080 --dpr 2`).
- Builds:
  - **before**: `main` at 8ba06c6, built with `npm run build`;
  - **after**: this branch, built with `npm run build`.
  - Both are production builds (minified, `base: './'`), served by the profiler's
    own static server.
- The two full runs ran one after the other with nothing else on the machine,
  on 2026-10-12.

## Reproducing

```sh
npm run build                       # in each checkout (main 8ba06c6 and this branch)
npx tsx tools/profile-web.ts --dist <dist> --label "<label>" \
    --out reports/perf/profile-<x>.md --json reports/perf/profile-<x>.json
# high-density subset
npx tsx tools/profile-web.ts --dist <dist> --only aldmere-idle,aldmere-pan,aldmere-max,world-idle,world-pan,world-max \
    --size 1920x1080 --dpr 2 --out reports/perf/profile-hidpi-<x>.md
# under a project subpath, as on GitHub Pages
npx tsx tools/profile-web.ts --dist dist --base /crown-and-frontier/ --only aldmere-pan,aldmere-max,editor-pan
```

The campaigns are made in Node from fixed seeds, so every run plays the same
game:

- **Aldmere, new campaign**: seed 3, as Aurelia.
- **Developed campaign**: Aldmere played 30 years by the AI from seed 1, then
  handed to Aurelia.
- **The World, 1914 at war**: the World map at week 280 from seed 1, as Britain.
  This is the largest map, with wars, armies, fleets, trade and 56 AI realms
  running.
- **Editor**: a copy of the World opened in the map editor.

Each workload drives real input through Playwright: mouse drags, wheel steps,
clicks, ledger keys and speed changes. It records:

- the interval between animation frames, which is what the player sees;
- long tasks;
- input latency from the Event Timing API;
- the time from a drag's pointer event to the frame that shows it ("drag
  acknowledged");
- the JavaScript per part of the frame loop;
- main-thread script, style and layout time from the DevTools protocol;
- simulation weeks per second;
- the heap.

A soak test opens ledgers 135 times and loads campaigns 7 times. It then checks
the heap after garbage collection, DOM nodes, event listeners, live intervals
and animation-frame requests.

## What caused the lag

These causes were found on `main` (8ba06c6) with the profiler above. Where
noted, CPU profiles of an unminified build, Node slice timing of the simulation,
and pixel-level probes in `.scratch` were also used.

1. **Whole-map far-zoom layers were rebuilt on every simulation slice.** The
   memo key included the epoch, which changes every slice while a week runs.
   On the World at the fastest speed:
   - `drawImage` took 38% of all CPU;
   - drawing took 582 ms per second, 104 ms of it in `farLayers`;
   - the clock made only 19 of 48 weeks in 8 s;
   - frame p95 was 333 ms.
2. **Base-map tile budget starvation.** The tile budget's clock started before
   the cached tiles were drawn. On a 1920×1080 screen at pixel ratio 2, the
   paused map redrew about 8 times a second forever: 16–18 draws per 2 s, with
   no tile rendered after 6 s. That was 843 ms/s of JavaScript, and a drag was
   acknowledged after 342 ms.
3. **The tile cache held only 140 tiles, and LRU eviction removed tiles still in
   use.** A 4K or 150%-scaled screen needs 250–550 tiles, so tiles were thrown
   away and rendered again every frame.
4. **Every frame re-filled and re-stroked every visible province path**, along
   with washes, hatching, borders, rivers and sea zones. On the World at the
   medium tier a drag had frame p95 67 ms, 383 of 1,272 frames over 33 ms, and
   drag acknowledgement p50 85 ms.
5. **Any battle anywhere kept the map redrawing at 60 Hz**, even off screen.
   The paused World spent 199 ms/s drawing.
6. **The overview image behind the tiles was resampled with high-quality
   smoothing every frame**, about 16 ms per call.
7. **Long single simulation slices on the World** (Node slice timing):
   - the monthly economy: 84 ms;
   - one realm's AI planning: 85 ms;
   - influence: 43 ms;
   - army care: 32 ms.
   Each became a frame hitch while the clock ran.
8. **The frame loop ran up to 24 ms of simulation first**, then the map and
   interface. Any frame in which the map was drawn went over budget.
9. **Ledgers (open panels):**
   - each was built twice on opening;
   - each was rebuilt every 180 ms while the clock ran;
   - the HUD recomputed the player's ledger (7 ms on the World) on every
     rebuild.
   The World's diplomacy ledger took 347 ms to open, and the worst input while
   opening panels was 744 ms.
10. **Orders given while the clock ran finished the half-done week
    synchronously.** A right-click march order froze the World for up to
    408 ms.
11. **The editor rebuilt every province path every frame, with no caching.** It
    spent 1.79 s of self time in `addPath` over a 6 s drag. Label anchors took
    0.9 s when the World was opened.
12. **The minimap was rebuilt on every state revision, and every realm's shape
    was rebuilt on every revision.**

Ruled out by measurement: copy-on-write state snapshots (`cowtest.ts`: no
measurable cost), memory growth (heap stable, see below), timer and rAF leaks
(none on either build), and asset loading.

## What changed

**Ground cache** (`src/ui/map/renderer.ts`), for causes 4, 5, 1 and 12:

- The ground is kept in a canvas a little larger than the screen and copied
  each frame. The ground is: base map, ownership washes, hatching, province and
  realm borders, rivers, sea zones, straits and railways.
- Panning shifts the canvas by whole pixels and paints only the uncovered
  strips.
- Provinces whose fill, owner or railways changed, and sea zones whose fleet
  colouring changed, are repainted where they lie.
- The margin is painted only when the player is not handling the map, nearest
  first, at most a quarter of the time.
- While zooming, the cache is shown scaled over a 1024 px whole-map layer for at
  most 140 ms after the last wheel step, then repainted crisp.
- While the clock runs, the washes catch up at most every 150 ms.
- A battle's pulse requests frames only when it is on screen.
- Realm shapes are rebuilt only for realms whose provinces changed.
- The map mode's context (supply, threat) is worked out once per state.
- Realm borders and inner edges are traced from the edges in view.
- The previous map mode's ground is kept, so closing a ledger restores it
  without repainting.
- `lod = false` still draws everything directly. It is the reference the
  correctness checks compare against.

**Base map** (`src/ui/map/basemap.ts`), for causes 2, 3 and 6:

- The tile budget counts only rendering and first rasterisation, is per frame,
  and always renders at least one tile.
- Tiles in use are never evicted, and the cap is 320.
- The overview is used whenever it has enough detail for the scale, resampled
  once per scale.
- A tile is drawn the same wherever the origin lies.

**Frame loop** (`src/ui/app.ts`), for causes 8–10:

- Map and interface come first; the simulation gets what remains of a 10–14 ms
  frame.
- An open ledger refreshes while the clock runs at most every ten times its own
  build cost, and at once after a player action. It is built once when opened.
- The HUD caches the player's ledger.
- A march ordered mid-week waits for the end of that week instead of finishing
  it on the spot; the week then gets 30 ms per frame.

**Simulation slicing** (`src/sim/tick.ts`, `economy.ts`, `influence.ts`,
`military.ts`, `ai/ai.ts`), for cause 7:

- The monthly economy, influence, and army care yield between realms (army care
  every 16 armies).
- The AI yields between strategic and operational planning.
- **The results are identical.** Yearly state checksums match `main` on the
  Reach, Aldmere, Europe and the World (`rulecheck-8ba06c6.json`).

**Editor** (`src/ui/editor/view.ts`), for cause 11:

- The map is drawn once into a cached scene and copied while the view pans.
- Hover, selection, pending and validator highlights are overlays.
- The cache key is a signature of the content, so a paint stroke that edits the
  package still repaints.

**Lettering**:

- Each letter's transform is set directly instead of save, translate, rotate
  and restore.
- The label collision registry is indexed in a grid.
- The output is pixel-identical on Europe, the World and Aldmere.

**Minimap**: rebuilt only when ownership changes.

## Results: before → after (1366×800, pixel ratio 1)

The frame interval at 60 Hz is 16.7 ms. A frame over 33 ms is a visible
stutter. "Drag acknowledged" is the time from a drag's pointer event to the
frame that shows it.

| Workload | frame p95 (ms) | frame p99 | worst frame | frames > 33 ms | long tasks (longest ms) | worst input (ms) | drag acknowledged p50 / p95 (ms) | weeks/s |
|---|---|---|---|---|---|---|---|---|
| Aldmere paused, idle | 16.8 → **16.7** | 49.9 → **16.8** | 50 → **16.8** | 3/172 → **0/179** | 0 → **0** | 0 → **0** | — | — |
| Aldmere drag | 16.8 → **16.7** | 33.4 → **16.8** | 50 → **16.8** | 3/1215 → **0/780** | 2 (56) → **0** | 56 → **24** | 36.7 / 52.7 → **16.9 / 26.3** | — |
| Aldmere drag, medium tier | 49.9 → **16.7** | 50.1 → **16.8** | 83.4 → **116.7** | 69/1258 → **1/791** | 67 (89) → **1 (119)** | 72 → **32** | 52.4 / 76.5 → **16.9 / 27.9** | — |
| Aldmere drag, close tier | 33.4 → **16.8** | 50 → **33.3** | 66.7 → **33.5** | 21/1330 → **0/798** | 10 (63) → **0** | 88 → **72** | 49.6 / 66.9 → **16.8 / 33.2** | — |
| Aldmere zoom (12 wheel steps) | 50.1 → **16.8** | 66.7 → **50** | 66.7 → **66.6** | 16/88 → **3/117** | 6 (67) → **3 (76)** | 0 → **0** | — | — |
| Aldmere select (12 clicks) | 33.2 → **16.7** | 33.4 → **16.8** | 50 → **33.3** | 2/171 → **0/181** | 2 (51) → **0** | 64 → **64** | — | — |
| Aldmere ledgers | 16.8 → **16.8** | 66.6 → **16.8** | 100 → **83.3** | 7/241 → **3/245** | 4 (98) → **2 (68)** | 144 → **104** | — | — |
| Aldmere normal speed | 16.8 → **16.7** | 66.7 → **16.8** | 83.3 → **16.8** | 7/455 → **0/480** | 7 (97) → **0** | 40 → **16** | — | 0.9 → **1.0** |
| Aldmere fastest speed | 66.7 → **16.8** | 83.3 → **16.8** | 116.6 → **249.9** | 47/331 → **4/458** | 47 (117) → **2 (69)** | 48 → **16** | — | 5.9 → **5.9** |
| Aldmere fastest + dragging | 83.3 → **16.7** | 100 → **16.8** | 133.4 → **16.8** | 176/1073 → **0/658** | 174 (142) → **0** | 120 → **48** | 82.8 / 144 → **17 / 30** | 6.0 → **5.9** |
| Developed campaign, drag | 16.8 → **16.8** | 33.4 → **16.8** | 66.6 → **16.8** | 4/1214 → **0/777** | 2 (72) → **0** | 80 → **48** | 37.3 / 56.1 → **16.9 / 26.2** | — |
| Developed campaign, fastest | 83.3 → **16.7** | 100 → **16.8** | 133.3 → **33.3** | 48/306 → **0/479** | 48 (126) → **0** | 48 → **32** | — | 5.9 → **5.9** |
| Developed, fastest, research/focus/trade/diplomacy open | 83.3 → **16.8** | 100 → **33.3** | 133.4 → **116.6** | 68/385 → **2/599** | 66 (141) → **2 (118)** | 176 → **88** | — | 5.9 → **5.9** |
| World paused, idle (just loaded) | 66.7 → **100** | 100 → **133.3** | 166.7 → **183.3** | 14/127 → **21/86** | 13 (166) → **19 (168)** | 0 → **0** | — | — |
| World drag, regional | 33.3 → **16.8** | 33.4 → **33.4** | 133.3 → **66.6** | 9/1247 → **7/792** | 7 (140) → **5 (74)** | 64 → **32** | 42.8 / 59.6 → **17 / 31.2** | — |
| World drag, medium tier | 83.3 → **16.8** | 100 → **66.6** | 166.7 → **100.1** | 383/1272 → **23/917** | 383 (167) → **19 (103)** | 208 → **160** | 84.5 / 111.3 → **19.8 / 41.1** | — |
| World drag, close tier | 66.6 → **16.8** | 83.3 → **33.3** | 100.1 → **50** | 350/1248 → **3/820** | 347 (107) → **0** | 96 → **72** | 72.2 / 99.3 → **17.5 / 32.5** | — |
| World drag, whole world | 33.3 → **16.7** | 50.1 → **16.8** | 150 → **133.3** | 29/1237 → **1/779** | 25 (182) → **1 (146)** | 128 → **56** | 39.4 / 62.5 → **17.2 / 26.8** | — |
| World zoom (12 wheel steps) | 116.7 → **66.7** | 133.3 → **150** | 150 → **166.6** | 41/45 → **7/99** | 40 (148) → **6 (177)** | 0 → **0** | — | — |
| World select (12 clicks) | 66.7 → **16.8** | 99.9 → **33.4** | 166.6 → **50** | 18/130 → **1/179** | 19 (160) → **1 (54)** | 232 → **80** | — | — |
| World ledgers | 49.9 → **16.8** | 200 → **100** | 500 → **149.9** | 14/238 → **5/247** | 10 (492) → **5 (130)** | 744 → **176** | — | — |
| World normal speed | 33.4 → **16.8** | 299.9 → **33.4** | 366.6 → **50.1** | 14/318 → **2/466** | 13 (365) → **2 (62)** | 56 → **32** | — | 0.9 → **0.9** |
| World fastest speed | 333.3 → **33.3** | 433.3 → **33.4** | 450 → **83.4** | 31/91 → **3/433** | 23 (448) → **1 (86)** | 48 → **24** | — | 2.2 → **5.8** |
| World fastest, military map mode | 316.7 → **33.4** | 350 → **66.7** | 400 → **100** | 28/87 → **14/385** | 25 (405) → **8 (114)** | 216 → **112** | — | 2.3 → **5.7** |
| World fastest, 8 march orders | 200.1 → **33.4** | 283.3 → **50** | 416.7 → **66.7** | 44/137 → **13/388** | 43 (290) → **8 (81)** | 640 → **96** | — | 2.8 → **4.1** |
| World fastest + dragging | 166.6 → **33.3** | 200 → **33.4** | 250.1 → **66.6** | 485/857 → **5/1064** | 456 (247) → **1 (55)** | 288 → **96** | 202 / 340.6 → **44.8 / 75.2** | 2.6 → **3.4** |
| Editor: open the World | 16.8 → **16.8** | 83.3 → **83.3** | 1383.3 → **850** | 2/25 → **2/48** | 3 (1119) → **3 (720)** | 40 → **32** | — | — |
| Editor: drag | 133.3 → **16.8** | 150 → **66.7** | 183.3 → **83.3** | 376/1239 → **16/774** | 376 (192) → **16 (96)** | 152 → **24** | 137.3 / 170.1 → **16.7 / 22.2** | — |
| Editor: select (12 clicks) | 116.7 → **16.7** | 133.3 → **16.8** | 150 → **116.6** | 12/115 → **1/183** | 12 (157) → **1 (118)** | 176 → **136** | — | — |

Opening a ledger, from the key press to the next frame (ms):

| Campaign | realm | industry | military | research | focus | diplomacy | wars | victory | log | help |
|---|---|---|---|---|---|---|---|---|---|---|
| Aldmere, new campaign | 47 → **18** | 62 → **25** | 57 → **16** | 47 → **25** | 63 → **20** | 112 → **57** | 63 → **45** | 51 → **27** | 33 → **14** | 39 → **16** |
| the World, week 280 | 103 → **44** | 101 → **50** | 101 → **38** | 73 → **24** | 81 → **21** | 347 → **124** | 216 → **91** | 147 → **57** | 70 → **19** | 50 → **15** |

Fewer frames in a fixed-length workload mean the browser was too busy to
draw, so drags show fewer frames *before*.

## Results at 1920×1080, pixel ratio 2

| Workload | frame p95 (ms) | frames > 33 ms | longest task (ms) | worst input (ms) | drag acknowledged p50 / p95 (ms) | weeks/s |
|---|---|---|---|---|---|---|
| Aldmere idle (just loaded) | 150 → **116.6** | 22/22 → **34/34** | 201 → **119** | 0 → **0** | — | — |
| Aldmere drag | 150.1 → **49.9** | 1141/1141 → **62/1147** | 458 → **87** | 280 → **160** | 343.1 / 435.6 → **33.7 / 88.1** | — |
| Aldmere fastest speed | 266.6 → **16.8** | 38/38 → **0/474** | 268 → **0** | 408 → **64** | — | 5.8 → **5.9** |
| World idle (just loaded) | 266.7 → **250** | 12/12 → **14/14** | 277 → **248** | 0 → **0** | — | — |
| World drag | 283.3 → **99.9** | 1137/1137 → **118/1156** | 626 → **295** | 552 → **424** | 676.3 / 815.1 → **34.8 / 232.6** | — |
| World fastest speed | 366.7 → **33.4** | 27/27 → **18/365** | 701 → **161** | 664 → **80** | — | 0.4 → **4.2** |

At pixel ratio 2, `main` never stops drawing the paused map. Every frame of
every workload is over 33 ms there. The branch settles: in the browser check,
the paused map stops drawing after about 8 s, once its 216 tiles are rendered
in software. The 3 s "idle" workloads above fall inside that settling time.

## Leaks and stability (soak, after garbage collection)

| After | Heap MB before → after | DOM nodes | Listeners | Live intervals | rAF requests per frame |
|---|---|---|---|---|---|
| developed Aldmere loaded | 8.2 → 8.6 | 2774 → 2796 | 92 → 92 | 0 → 0 | 2 → 2 |
| ledgers opened 135 times | 10.4 → 10.6 | 2768 → 2791 | 83 → 83 | 0 → 0 | 2 → 2 |
| campaigns loaded 7 times | 31.1 → 30.5 | 2801 → 2828 | 84 → 84 | 0 → 0 | 2 → 2 |

Neither build leaks: there is no heap growth beyond about 0.2 MB per load
round, and no extra listeners, timers or animation-frame loops. Neither run
logged a page error. The heap during the World at the fastest speed is
transient: it peaks at about 130 MB and is collected.

## Correctness checks

- **Same rules.** Yearly state checksums of fixed-seed AI campaigns
  (`npm run rulecheck`) are identical to `main` on the Reach, Aldmere, Europe
  (3 years) and the World (2 years). The record is `rulecheck-8ba06c6.json`.
  The sliced phases change when work happens, not what it computes.
- **Same picture.** The browser check (`tools/verify-web.ts`, `ONLY=ground`)
  draws each scene twice, through the cache and directly (`lod = false`), and
  compares the pixels. The scenes are:
  - Europe at the start, after a long drag, after wheel zoom, close (railways
    shown), far, after ownership changes and occupation, in six map modes, in
    diplomacy focus, and in the sea mode after fleets moved;
  - Aldmere.
  Fewer than 0.05% of pixels may differ (anti-aliasing at tile seams). A
  negative check proves the comparison catches stale content: with change
  detection disabled, 0.7% of pixels differ after owners change.
- **No redraws when nothing changes.** The paused map at 1920×1080, ratio 2,
  stops drawing once its tiles are rendered (after about 8 s in software), and
  an off-screen battle causes no redraws.
- **Orders are not lost.** A march ordered mid-week is applied at the end of
  that week, in the order given. The browser check "A march ordered mid-week is
  given when that week ends" covers it: the order is given at week *n* and
  applied at week *n*+1. Loading or quitting clears pending orders.
- **Saves.** Save format and contents are unchanged, and existing saves load.
- **Deployment.** The build works at the root, under a project subpath
  (`/crown-and-frontier/`), from the ZIP and in an iframe (verify-web). The
  subpath profile matches the root one (`profile-subpath.md`).

### Visual changes (documented)

- **Inner realm edges have round joins.** The previous mitre joins drew spikes
  up to ten half-widths long at sharp corners.
- **Tiles are drawn the same wherever the origin lies.** Before, a tile was a
  pixel narrower when it lay left of or above the origin.
- **The overlap pixel between two tiles is decided in a fixed order.**
- **While zooming, the map is shown scaled for up to 140 ms** after the last
  wheel step (over a 1024 px whole-map layer when zooming out), then repainted
  crisp.

Nothing was removed or simplified, and the default visual quality is unchanged.

## Targets not met, and limits of this evidence

- **Settling after a load or a zoom.** A base tile takes about 30 ms to
  rasterise at pixel ratio 1 and 60–150 ms at ratio 2 in software. Right after
  the World loads, the paused map has frames of 100–180 ms for a second or two.
  This is somewhat worse than `main` at ratio 1 (p95 66.7 → 100 ms), because
  the cache also paints its off-screen margin while the player is idle. That
  margin is what makes the later drags smooth. At ratio 2 the first seconds
  are slow on both builds.
- **World zoom.** Twelve wheel steps on the World:
  - p95 drops from 117 to 67 ms;
  - slow frames drop from 41 of 45 to 7 of 99;
  - but the worst frame is 167 ms, against 150 on `main`. It is the crisp
    repaint after the zoom settles.
- **The World at the fastest speed** keeps p95 at 33 ms, not 16.7, while the
  simulation runs 5.8 weeks a second. One AI realm's strategic planning can still
  take about 37 ms in a single slice.
- **One frame of 250 ms in Aldmere at the fastest speed** (p99 16.8 ms). It is a
  single outlier in 458 frames and did not recur in the developed campaign.
- **Opening a copy of the World in the editor** still takes about 0.7 s (it was
  1.1 s).
- **Not tested**: a GPU (all runs are software-rasterised), Firefox, Safari,
  touch devices and real 4K monitors. These numbers come from one 4-core server
  CPU. A desktop gaming PC with a graphics card should do markedly better on
  every drawing figure, but that was not measured.
