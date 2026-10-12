# Gameplay profile — this branch (after)

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aldmere-idle: paused, no input, 3 s | aldmere | 0 | — | 179 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 0.8 | 0 | 0 | 0 | 14.6 | 4.3 | 0 | 0 | 0 | — | 7.3 → 12 |
| aldmere-pan: paused, dragging the map, 6 s | aldmere | 0 | — | 780 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 66.1 | 64.9 | 0 | 0.4 | 237.3 | 72.4 | 3.9 | 7 | 24 | 16.9 / 26.3 | 7.3 → 13.6 |
| aldmere-pan-mid: paused, dragging at the medium tier (90 px provinces), 6 s | aldmere | 0 | — | 791 | 16.7 | 16.7 | 16.8 | 116.7 | 1 | 1 (119) | 113 | 111.6 | 0 | 0.4 | 299.8 | 117.8 | 4.1 | 5.9 | 32 | 16.9 / 27.9 | 7.6 → 12.6 |
| aldmere-pan-close: paused, dragging at the close tier (160 px provinces), 6 s | aldmere | 0 | — | 798 | 16.7 | 16.8 | 33.3 | 33.5 | 0 | 0 (0) | 121.3 | 120.2 | 0 | 0.3 | 288.6 | 128.9 | 4.7 | 5.6 | 72 | 16.8 / 33.2 | 7.8 → 13.7 |
| aldmere-zoom: paused, 12 wheel steps in and out | aldmere | 0 | — | 117 | 16.7 | 16.8 | 50 | 66.6 | 3 | 3 (76) | 229.1 | 222.2 | 0 | 0.3 | 596.7 | 228.8 | 4.9 | 3.7 | 0 | — | 8 → 14.4 |
| aldmere-select: paused, 12 clicks selecting provinces and armies | aldmere | 0 | — | 181 | 16.7 | 16.7 | 16.8 | 33.3 | 0 | 0 (0) | 46.6 | 8.1 | 36.8 | 0.2 | 142.3 | 43.7 | 9.6 | 13.5 | 64 | — | 8.1 → 13.4 |
| aldmere-panels: paused, opening each ledger by its key | aldmere | 0 | — | 245 | 16.7 | 16.8 | 16.8 | 83.3 | 3 | 2 (68) | 45.2 | 30.5 | 13.5 | 0.1 | 123 | 56.3 | 12.8 | 12.2 | 104 | — | 8.2 → 15.3 |
| aldmere-normal: running at normal speed (1 week/s), no input, 8 s | aldmere | 8 | 1 | 480 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 26.4 | 3 | 6.5 | 0.1 | 51 | 26.7 | 1.4 | 2.3 | 16 | — | 9.4 → 16.8 |
| aldmere-max: running at the fastest speed (6 weeks/s), no input, 8 s | aldmere | 47 | 5.9 | 458 | 16.7 | 16.8 | 16.8 | 249.9 | 4 | 2 (69) | 132.8 | 26.3 | 38.6 | 4 | 224.7 | 117.8 | 9.3 | 15.6 | 16 | — | 10.3 → 22.9 |
| aldmere-max-pan: fastest speed while dragging the map and clicking, 6 s | aldmere | 65 | 5.9 | 658 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 144.8 | 81.1 | 7.4 | 3.4 | 354 | 146.4 | 6.1 | 9.8 | 48 | 17 / 30 | 11.4 → 21.7 |
| dev-pan: developed campaign (Aldmere, 30 years), paused, dragging, 6 s | aldmere | 0 | — | 777 | 16.7 | 16.8 | 16.8 | 16.8 | 0 | 0 (0) | 64.2 | 63.2 | 0 | 0.3 | 227.4 | 69.1 | 4 | 7.2 | 48 | 16.9 / 26.2 | 8.3 → 14.4 |
| dev-max: developed campaign, fastest speed, no input, 8 s | aldmere | 47 | 5.9 | 479 | 16.7 | 16.7 | 16.8 | 33.3 | 0 | 0 (0) | 132.4 | 16.3 | 44.8 | 0.4 | 213.3 | 117.7 | 8.7 | 13.5 | 32 | — | 8.6 → 23.1 |
| dev-panels-max: developed campaign, fastest speed with research, focus, trade and diplomacy open | aldmere | 61 | 5.9 | 599 | 16.7 | 16.8 | 33.3 | 116.6 | 2 | 2 (118) | 172.4 | 24.4 | 98.8 | 1.1 | 310.5 | 132.1 | 21.4 | 32.3 | 88 | — | 11.5 → 19 |
| world-idle: the World at war, paused, no input, 3 s | earth | 0 | — | 86 | 16.7 | 100 | 133.3 | 183.3 | 21 | 19 (168) | 677.8 | 677.2 | 0 | 0.2 | 754 | 714 | 0.3 | 0.3 | 0 | — | 29.5 → 42.1 |
| world-pan: the World at war, paused, dragging at regional zoom (far tier), 6 s | earth | 0 | — | 792 | 16.7 | 16.8 | 33.4 | 66.6 | 7 | 5 (74) | 139.2 | 138.1 | 0 | 0.4 | 310.3 | 144.1 | 3.7 | 7.7 | 32 | 17 / 31.2 | 30 → 41.1 |
| world-pan-mid: the World at war, paused, dragging at the medium tier, 6 s | earth | 0 | — | 917 | 16.7 | 16.8 | 66.6 | 100.1 | 23 | 19 (103) | 242 | 241 | 0 | 0.3 | 436.6 | 252.2 | 2.8 | 5.4 | 160 | 19.8 / 41.1 | 30.4 → 42.7 |
| world-pan-close: the World at war, paused, dragging at the close tier, 6 s | earth | 0 | — | 820 | 16.7 | 16.8 | 33.3 | 50 | 3 | 0 (0) | 158.5 | 157.3 | 0 | 0.4 | 361.6 | 166.5 | 3.2 | 6.1 | 72 | 17.5 / 32.5 | 30.7 → 42.6 |
| world-pan-far: the World at war, paused, dragging the whole world, 6 s | earth | 0 | — | 779 | 16.7 | 16.7 | 16.8 | 133.3 | 1 | 1 (146) | 98.1 | 96.8 | 0 | 0.5 | 268.8 | 103.5 | 4.1 | 6.9 | 56 | 17.2 / 26.8 | 30.9 → 44.2 |
| world-zoom: the World at war, paused, 12 wheel steps | earth | 0 | — | 99 | 16.7 | 66.7 | 150 | 166.6 | 7 | 6 (177) | 515.4 | 510 | 0 | 0.3 | 766.2 | 516.8 | 1.5 | 2 | 0 | — | 30.8 → 42.6 |
| world-select: the World at war, paused, 12 clicks | earth | 0 | — | 179 | 16.7 | 16.8 | 33.4 | 50 | 1 | 1 (54) | 66.7 | 16.6 | 48.4 | 0.3 | 218.8 | 79.2 | 8.4 | 16.2 | 80 | — | 31.1 → 42.5 |
| world-panels: the World at war, paused, each ledger by its key | earth | 0 | — | 247 | 16.7 | 16.8 | 100 | 149.9 | 5 | 5 (130) | 78 | 57.4 | 19.6 | 0.2 | 202.3 | 111.2 | 19.6 | 21.6 | 176 | — | 31 → 46.6 |
| world-normal: the World at war, normal speed, no input, 8 s | earth | 7 | 0.9 | 466 | 16.7 | 16.8 | 33.4 | 50.1 | 2 | 2 (62) | 183.5 | 9.8 | 21.4 | 0.3 | 207.7 | 181.1 | 1.7 | 2.9 | 32 | — | 34.1 → 56 |
| world-max: the World at war, fastest speed, no input, 8 s | earth | 46 | 5.8 | 433 | 16.7 | 33.3 | 33.4 | 83.4 | 3 | 1 (86) | 802 | 68.8 | 72.4 | 2.5 | 912.2 | 783.1 | 9.5 | 17.8 | 24 | — | 36.5 → 129.4 |
| world-max-military: the World at war, fastest speed in the military map mode (threat and fronts redrawn as armies move), 8 s | earth | 46 | 5.7 | 385 | 16.7 | 33.4 | 66.7 | 100 | 14 | 8 (114) | 872.6 | 186.6 | 79.7 | 2.5 | 974.2 | 855.9 | 7.3 | 12.6 | 112 | — | 38.2 → 104.9 |
| world-max-orders: the World at war, fastest speed, an army selected and ordered to march 8 times (right-click) | earth | 31 | 4.1 | 388 | 16.7 | 33.4 | 50 | 66.7 | 13 | 8 (81) | 747 | 101.8 | 93.4 | 3.6 | 865.3 | 716 | 12.4 | 23.1 | 96 | — | 38.6 → 106.3 |
| world-max-pan: the World at war, fastest speed while dragging and clicking, 6 s | earth | 65 | 3.4 | 1064 | 16.7 | 33.3 | 33.4 | 66.6 | 5 | 1 (55) | 680.3 | 226.6 | 11.8 | 1.9 | 925.7 | 680 | 5.7 | 8.3 | 96 | 44.8 / 75.2 | 38.8 → 86.1 |
| editor-open: opening a copy of the World in the editor (until its map is drawn) | — | 0 | — | 48 | 16.7 | 16.8 | 83.3 | 850 | 2 | 3 (720) | 0 | 0 | 0 | 0 | 574.3 | 467.7 | 1.7 | 0.9 | 32 | — | 50.2 → 89.6 |
| editor-pan: the World in the editor, dragging, 6 s | — | 0 | — | 774 | 16.7 | 16.8 | 66.7 | 83.3 | 16 | 16 (96) | 0 | 0 | 0 | 0 | 202.7 | 116.2 | 0 | 0 | 24 | 16.7 / 22.2 | 64.2 → 81.6 |
| editor-click: the World in the editor, 12 clicks selecting provinces | — | 0 | — | 183 | 16.7 | 16.7 | 16.8 | 116.6 | 1 | 1 (118) | 0 | 0 | 0 | 0 | 130 | 60.1 | 8.3 | 5.7 | 136 | — | 64.1 → 79.9 |

## Opening a ledger (ms from the call to the next frame)

| Campaign | realm | industry | military | research | focus | diplomacy | wars | victory | log | help |
|---|---|---|---|---|---|---|---|---|---|---|
| Aldmere, new campaign | 18 | 25 | 16 | 25 | 20 | 57 | 45 | 27 | 14 | 16 |
| the World, week 280 | 44 | 50 | 38 | 24 | 21 | 124 | 91 | 57 | 19 | 15 |

## Leak checks (after garbage collection)

| After | Heap MB | DOM nodes | Event listeners | Live intervals | Animation-frame requests per frame |
|---|---|---|---|---|---|
| developed Aldmere loaded | 8.6 | 2796 | 92 | 0 | 2 |
| ledgers opened 45 times | 9.9 | 2791 | 83 | 0 | 2 |
| ledgers opened 90 times | 10.4 | 2791 | 83 | 0 | 2 |
| ledgers opened 135 times | 10.6 | 2791 | 83 | 0 | 2 |
| campaigns loaded 3 times | 29.8 | 2828 | 84 | 0 | 2 |
| campaigns loaded 5 times | 30.2 | 2828 | 84 | 0 | 2 |
| campaigns loaded 7 times | 30.5 | 2828 | 84 | 0 | 2 |

No page errors.
