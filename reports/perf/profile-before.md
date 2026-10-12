# Gameplay profile — main 8ba06c6 (before)

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aldmere-idle: paused, no input, 3 s | aldmere | 0 | — | 172 | 16.7 | 16.8 | 49.9 | 50 | 3 | 0 (0) | 44.2 | 43.3 | 0 | 0 | 115.1 | 51.6 | 0.4 | 0.2 | 0 | — | 7.1 → 11.8 |
| aldmere-pan: paused, dragging the map, 6 s | aldmere | 0 | — | 1215 | 16.7 | 16.8 | 33.4 | 50 | 3 | 2 (56) | 40.1 | 39.3 | 0 | 0.3 | 511.2 | 45 | 2.5 | 4.3 | 56 | 36.7 / 52.7 | 7.1 → 13.2 |
| aldmere-pan-mid: paused, dragging at the medium tier (90 px provinces), 6 s | aldmere | 0 | — | 1258 | 16.7 | 49.9 | 50.1 | 83.4 | 69 | 67 (89) | 60 | 59.1 | 0 | 0.3 | 613 | 63.2 | 2.2 | 3 | 72 | 52.4 / 76.5 | 7.5 → 13.1 |
| aldmere-pan-close: paused, dragging at the close tier (160 px provinces), 6 s | aldmere | 0 | — | 1330 | 16.7 | 33.4 | 50 | 66.7 | 21 | 10 (63) | 45.8 | 44.9 | 0 | 0.3 | 570.8 | 49.8 | 2.7 | 3.2 | 88 | 49.6 / 66.9 | 7.6 → 13.5 |
| aldmere-zoom: paused, 12 wheel steps in and out | aldmere | 0 | — | 88 | 16.7 | 50.1 | 66.7 | 66.7 | 16 | 6 (67) | 260 | 253.6 | 0 | 0.2 | 713.9 | 267.8 | 5.3 | 4.7 | 0 | — | 7.8 → 12.3 |
| aldmere-select: paused, 12 clicks selecting provinces and armies | aldmere | 0 | — | 171 | 16.7 | 33.2 | 33.4 | 50 | 2 | 2 (51) | 51.8 | 10.2 | 40.1 | 0.4 | 220.8 | 34.8 | 9.6 | 13.8 | 64 | — | 7.7 → 13.5 |
| aldmere-panels: paused, opening each ledger by its key | aldmere | 0 | — | 241 | 16.7 | 16.8 | 66.6 | 100 | 7 | 4 (98) | 56.1 | 27.1 | 28.2 | 0.1 | 214.3 | 61.6 | 14.7 | 18.8 | 144 | — | 7.9 → 14 |
| aldmere-normal: running at normal speed (1 week/s), no input, 8 s | aldmere | 7 | 0.9 | 455 | 16.7 | 16.8 | 66.7 | 83.3 | 7 | 7 (97) | 53.1 | 31.2 | 6.3 | 0.3 | 103.2 | 53.8 | 1.2 | 1.9 | 40 | — | 8.9 → 14.8 |
| aldmere-max: running at the fastest speed (6 weeks/s), no input, 8 s | aldmere | 47 | 5.9 | 331 | 16.7 | 66.7 | 83.3 | 116.6 | 47 | 47 (117) | 326.7 | 228.7 | 33.7 | 14.8 | 560.5 | 312.9 | 8.7 | 13.5 | 48 | — | 9.9 → 16 |
| aldmere-max-pan: fastest speed while dragging the map and clicking, 6 s | aldmere | 170 | 6 | 1073 | 16.7 | 83.3 | 100 | 133.4 | 176 | 174 (142) | 344.9 | 263.4 | 3.1 | 14.3 | 798.4 | 347 | 4.4 | 7 | 120 | 82.8 / 144 | 11 → 21.4 |
| dev-pan: developed campaign (Aldmere, 30 years), paused, dragging, 6 s | aldmere | 0 | — | 1214 | 16.7 | 16.8 | 33.4 | 66.6 | 4 | 2 (72) | 43.1 | 42.3 | 0 | 0.3 | 521 | 47.7 | 2.5 | 4.4 | 80 | 37.3 / 56.1 | 8.1 → 14.3 |
| dev-max: developed campaign, fastest speed, no input, 8 s | aldmere | 48 | 5.9 | 306 | 16.7 | 83.3 | 100 | 133.3 | 48 | 48 (126) | 392.2 | 260.6 | 46.3 | 7.5 | 645.7 | 376.3 | 9 | 13.7 | 48 | — | 8.4 → 16.7 |
| dev-panels-max: developed campaign, fastest speed with research, focus, trade and diplomacy open | aldmere | 62 | 5.9 | 385 | 16.7 | 83.3 | 100 | 133.4 | 68 | 66 (141) | 404.8 | 253.7 | 88.8 | 5.5 | 691.2 | 368.9 | 19 | 29.5 | 176 | — | 12.3 → 19.9 |
| world-idle: the World at war, paused, no input, 3 s | earth | 0 | — | 127 | 16.7 | 66.7 | 100 | 166.7 | 14 | 13 (166) | 348 | 347.3 | 0 | 0.1 | 432.6 | 379.2 | 0.4 | 0.4 | 0 | — | 28.7 → 40.1 |
| world-pan: the World at war, paused, dragging at regional zoom (far tier), 6 s | earth | 0 | — | 1247 | 16.7 | 33.3 | 33.4 | 133.3 | 9 | 7 (140) | 378.7 | 377.7 | 0 | 0.4 | 554.2 | 382.3 | 2.2 | 4.2 | 64 | 42.8 / 59.6 | 29.3 → 40.3 |
| world-pan-mid: the World at war, paused, dragging at the medium tier, 6 s | earth | 0 | — | 1272 | 16.7 | 83.3 | 100 | 166.7 | 383 | 383 (167) | 120.3 | 119.5 | 0 | 0.4 | 751.3 | 123.8 | 1.3 | 2.4 | 208 | 84.5 / 111.3 | 29.8 → 40.8 |
| world-pan-close: the World at war, paused, dragging at the close tier, 6 s | earth | 0 | — | 1248 | 16.7 | 66.6 | 83.3 | 100.1 | 350 | 347 (107) | 79.8 | 79.1 | 0 | 0.3 | 707 | 82.7 | 1.4 | 2.8 | 96 | 72.2 / 99.3 | 29.9 → 43 |
| world-pan-far: the World at war, paused, dragging the whole world, 6 s | earth | 0 | — | 1237 | 16.7 | 33.3 | 50.1 | 150 | 29 | 25 (182) | 111.6 | 110.6 | 0 | 0.3 | 602.5 | 116.5 | 2.1 | 3.9 | 128 | 39.4 / 62.5 | 30 → 42.7 |
| world-zoom: the World at war, paused, 12 wheel steps | earth | 0 | — | 45 | 66.7 | 116.7 | 133.3 | 150 | 41 | 40 (148) | 434.4 | 430.2 | 0 | 0.1 | 1054.5 | 439.5 | 1.3 | 2.1 | 0 | — | 30.1 → 41.8 |
| world-select: the World at war, paused, 12 clicks | earth | 0 | — | 130 | 16.7 | 66.7 | 99.9 | 166.6 | 18 | 19 (160) | 342.7 | 287.4 | 53.9 | 0.5 | 510.1 | 338.8 | 9.4 | 16.4 | 232 | — | 30.2 → 42.4 |
| world-panels: the World at war, paused, each ledger by its key | earth | 0 | — | 238 | 16.7 | 49.9 | 200 | 500 | 14 | 10 (492) | 263.2 | 218.7 | 43.4 | 0.1 | 402 | 281.2 | 16.8 | 23 | 744 | — | 30.3 → 43.7 |
| world-normal: the World at war, normal speed, no input, 8 s | earth | 7 | 0.9 | 318 | 16.7 | 33.4 | 299.9 | 366.6 | 14 | 13 (365) | 427.4 | 237.1 | 20.4 | 6.3 | 461.2 | 425.7 | 1.5 | 2.6 | 56 | — | 33.4 → 46.8 |
| world-max: the World at war, fastest speed, no input, 8 s | earth | 18 | 2.2 | 91 | 33.3 | 333.3 | 433.3 | 450 | 31 | 23 (448) | 945.8 | 594.7 | 43.4 | 14.3 | 987.3 | 933.8 | 4.5 | 7.8 | 48 | — | 35.6 → 50.2 |
| world-max-military: the World at war, fastest speed in the military map mode (threat and fronts redrawn as armies move), 8 s | earth | 18 | 2.3 | 87 | 33.4 | 316.7 | 350 | 400 | 28 | 25 (405) | 957.7 | 555.1 | 55.4 | 20.1 | 999.6 | 913.5 | 4.1 | 6.1 | 216 | — | 39.5 → 60.6 |
| world-max-orders: the World at war, fastest speed, an army selected and ordered to march 8 times (right-click) | earth | 24 | 2.8 | 137 | 33.3 | 200.1 | 283.3 | 416.7 | 44 | 43 (290) | 647 | 207.7 | 69.1 | 23.4 | 977.7 | 657.3 | 9.7 | 17.9 | 640 | — | 37.3 → 57.7 |
| world-max-pan: the World at war, fastest speed while dragging and clicking, 6 s | earth | 177 | 2.6 | 857 | 83.3 | 166.6 | 200 | 250.1 | 485 | 456 (247) | 547.3 | 168.4 | 2 | 25.4 | 997.1 | 548.1 | 2.5 | 3.8 | 288 | 202 / 340.6 | 37.6 → 93.8 |
| editor-open: opening a copy of the World in the editor (until its map is drawn) | — | 0 | — | 25 | 16.7 | 16.8 | 83.3 | 1383.3 | 2 | 3 (1119) | 0 | 0 | 0 | 0 | 821.9 | 612.8 | 1.7 | 1.1 | 40 | — | 50.3 → 96.7 |
| editor-pan: the World in the editor, dragging, 6 s | — | 0 | — | 1239 | 16.7 | 133.3 | 150 | 183.3 | 376 | 376 (192) | 0 | 0 | 0 | 0 | 831.1 | 57.9 | 0 | 0 | 152 | 137.3 / 170.1 | 63.8 → 78.1 |
| editor-click: the World in the editor, 12 clicks selecting provinces | — | 0 | — | 115 | 16.7 | 116.7 | 133.3 | 150 | 12 | 12 (157) | 0 | 0 | 0 | 0 | 541.4 | 71.8 | 9.7 | 6 | 176 | — | 63.9 → 79.2 |

## Opening a ledger (ms from the call to the next frame)

| Campaign | realm | industry | military | research | focus | diplomacy | wars | victory | log | help |
|---|---|---|---|---|---|---|---|---|---|---|
| Aldmere, new campaign | 47 | 62 | 57 | 47 | 63 | 112 | 63 | 51 | 33 | 39 |
| the World, week 280 | 103 | 101 | 101 | 73 | 81 | 347 | 216 | 147 | 70 | 50 |

## Leak checks (after garbage collection)

| After | Heap MB | DOM nodes | Event listeners | Live intervals | Animation-frame requests per frame |
|---|---|---|---|---|---|
| developed Aldmere loaded | 8.2 | 2774 | 92 | 0 | 2 |
| ledgers opened 45 times | 9.9 | 2768 | 83 | 0 | 2 |
| ledgers opened 90 times | 10.3 | 2768 | 83 | 0 | 2 |
| ledgers opened 135 times | 10.4 | 2768 | 83 | 0 | 2 |
| campaigns loaded 3 times | 30.1 | 2806 | 84 | 0 | 2 |
| campaigns loaded 5 times | 30.7 | 2800 | 84 | 0 | 2 |
| campaigns loaded 7 times | 31.1 | 2801 | 84 | 0 | 2 |

No page errors.
