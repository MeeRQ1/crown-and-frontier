# Gameplay profile — this branch: the 1936 maps beside the World 1914

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| world-idle: the World at war, paused, no input, 3 s | earth | 0 | — | 77 | 16.7 | 116.7 | 150 | 166.7 | 21 | 19 (176) | 729.7 | 728.8 | 0 | 0.3 | 820.3 | 767.1 | 0.5 | 0.4 | 0 | — | 29.8 → 43.6 |
| world-pan: the World at war, paused, dragging at regional zoom (far tier), 6 s | earth | 0 | — | 802 | 16.7 | 16.8 | 33.4 | 66.7 | 6 | 5 (79) | 139.8 | 138.8 | 0 | 0.4 | 308.8 | 146.4 | 4 | 7 | 32 | 17.3 / 32.1 | 30.6 → 44.4 |
| world-pan-mid: the World at war, paused, dragging at the medium tier, 6 s | earth | 0 | — | 944 | 16.7 | 16.8 | 50 | 116.6 | 16 | 15 (120) | 224.7 | 223.6 | 0 | 0.3 | 416.9 | 232.3 | 3 | 5.6 | 152 | 23.8 / 39.4 | 31.1 → 45.6 |
| world-zoom: the World at war, paused, 12 wheel steps | earth | 0 | — | 99 | 16.7 | 66.7 | 133.3 | 149.9 | 9 | 9 (147) | 533.3 | 526.6 | 0 | 0.3 | 795.8 | 531.6 | 1.6 | 2.2 | 0 | — | 31.3 → 45 |
| world-select: the World at war, paused, 12 clicks | earth | 0 | — | 177 | 16.7 | 16.8 | 33.3 | 33.4 | 0 | 0 (0) | 68.7 | 16.3 | 50.6 | 0.4 | 213.2 | 82.8 | 9.3 | 17.5 | 72 | — | 31.6 → 43.3 |
| world-panels: the World at war, paused, each ledger by its key | earth | 0 | — | 247 | 16.7 | 16.8 | 83.3 | 166.7 | 8 | 4 (144) | 83.2 | 64.6 | 17.5 | 0.1 | 207.6 | 117.3 | 19.2 | 17.3 | 200 | — | 31.6 → 48.2 |
| world-normal: the World at war, normal speed, no input, 8 s | earth | 7 | 0.9 | 468 | 16.7 | 16.8 | 33.4 | 50 | 3 | 3 (54) | 174.9 | 8.9 | 19.6 | 0.2 | 205.4 | 173.6 | 1.9 | 4.3 | 32 | — | 34.7 → 65.2 |
| world-max: the World at war, fastest speed, no input, 8 s | earth | 46 | 5.8 | 414 | 16.7 | 33.4 | 33.4 | 66.8 | 1 | 1 (68) | 835.2 | 72.9 | 76 | 2.2 | 955.8 | 814 | 10.8 | 19.5 | 32 | — | 37.2 → 65.8 |
| world-max-pan: the World at war, fastest speed while dragging and clicking, 6 s | earth | 78 | 4.4 | 1000 | 16.7 | 33.3 | 33.4 | 50 | 4 | 3 (58) | 677.7 | 127.6 | 12.4 | 2.7 | 872.5 | 680.2 | 5.8 | 8.3 | 72 | 40 / 71.3 | 39 → 69.4 |
| e36-idle: Europe, 1936 at week 280 (as Germany), paused, no input, 3 s | europe-1936 | 0 | — | 179 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 0.7 | 0 | 0 | 0 | 17.7 | 3.7 | 0.3 | 0.1 | 0 | — | 20.1 → 28.3 |
| e36-pan: Europe, 1936 at week 280 (as Germany), paused, dragging at regional zoom, 6 s | europe-1936 | 0 | — | 787 | 16.7 | 16.8 | 33.3 | 50 | 2 | 2 (64) | 112.4 | 111.5 | 0 | 0.4 | 285.1 | 117.5 | 3.6 | 6.3 | 40 | 17 / 27.4 | 20.1 → 30.1 |
| e36-pan-mid: Europe, 1936 at week 280 (as Germany), paused, dragging at the medium tier, 6 s | europe-1936 | 0 | — | 897 | 16.7 | 33.2 | 66.7 | 100 | 27 | 27 (105) | 255.6 | 254.6 | 0 | 0.4 | 458.1 | 263.9 | 3 | 5.9 | 184 | 19.8 / 45 | 20.5 → 31.7 |
| e36-zoom: Europe, 1936 at week 280 (as Germany), paused, 12 wheel steps | europe-1936 | 0 | — | 105 | 16.7 | 50 | 100 | 116.7 | 12 | 12 (129) | 483 | 477.5 | 0 | 0.3 | 781.7 | 483 | 1.6 | 2.1 | 0 | — | 20.7 → 31.3 |
| e36-select: Europe, 1936 at week 280 (as Germany), paused, 12 clicks | europe-1936 | 0 | — | 182 | 16.7 | 16.7 | 16.8 | 33.5 | 0 | 0 (0) | 69.6 | 14.9 | 53.1 | 0.4 | 167.3 | 76.5 | 9.8 | 16.7 | 80 | — | 21 → 29.9 |
| e36-panels: Europe, 1936 at week 280 (as Germany), paused, each ledger by its key | europe-1936 | 0 | — | 246 | 16.7 | 16.8 | 50.1 | 116.7 | 4 | 3 (117) | 80 | 64.6 | 14.4 | 0.2 | 172.8 | 97.9 | 14.5 | 12 | 152 | — | 21.2 → 32.5 |
| e36-normal: Europe, 1936 at week 280 (as Germany), normal speed, no input, 8 s | europe-1936 | 7 | 0.9 | 474 | 16.7 | 16.8 | 16.8 | 49.9 | 1 | 0 (0) | 93.7 | 14.3 | 13.4 | 1 | 122.9 | 92.2 | 1.6 | 2.8 | 32 | — | 22.7 → 35.8 |
| e36-max: Europe, 1936 at week 280 (as Germany), fastest speed, no input, 8 s | europe-1936 | 47 | 5.9 | 480 | 16.7 | 16.8 | 16.8 | 33.4 | 0 | 0 (0) | 371.8 | 48.7 | 62.7 | 1.7 | 489.2 | 355.2 | 10.2 | 16.7 | 16 | — | 25 → 77.1 |
| e36-max-pan: Europe, 1936 at week 280 (as Germany), fastest speed while dragging and clicking, 6 s | europe-1936 | 95 | 6 | 915 | 16.7 | 16.8 | 33.4 | 50.1 | 3 | 3 (57) | 479 | 158.1 | 9.3 | 3.3 | 725.3 | 481.6 | 5.4 | 9 | 56 | 28 / 78.7 | 28 → 97.5 |
| w36-idle: the World, 1936 at week 280 (as Britain), paused, no input, 3 s | earth-1936 | 0 | — | 72 | 16.7 | 116.7 | 133.3 | 183.3 | 24 | 23 (178) | 765.1 | 764.5 | 0 | 0.3 | 851.2 | 805.8 | 0.3 | 0.3 | 0 | — | 30.4 → 43.5 |
| w36-pan: the World, 1936 at week 280 (as Britain), paused, dragging at regional zoom, 6 s | earth-1936 | 0 | — | 822 | 16.7 | 16.8 | 33.4 | 66.7 | 7 | 6 (76) | 144.8 | 143.7 | 0 | 0.3 | 318.3 | 149.8 | 3.3 | 7 | 40 | 17.9 / 36 | 31.1 → 45 |
| w36-pan-mid: the World, 1936 at week 280 (as Britain), paused, dragging at the medium tier, 6 s | earth-1936 | 0 | — | 890 | 16.7 | 16.8 | 50.1 | 83.4 | 20 | 17 (87) | 238.4 | 237.3 | 0 | 0.3 | 428.8 | 246.7 | 2.8 | 5.3 | 160 | 19.1 / 40.8 | 31.6 → 48.6 |
| w36-zoom: the World, 1936 at week 280 (as Britain), paused, 12 wheel steps | earth-1936 | 0 | — | 106 | 16.7 | 50 | 100 | 166.6 | 7 | 7 (162) | 526.6 | 520.5 | 0 | 0.3 | 794.9 | 526.5 | 1.6 | 2.2 | 0 | — | 31.7 → 46.6 |
| w36-select: the World, 1936 at week 280 (as Britain), paused, 12 clicks | earth-1936 | 0 | — | 175 | 16.7 | 16.8 | 33.4 | 50 | 1 | 1 (55) | 71.9 | 20.6 | 49.6 | 0.3 | 214 | 85.4 | 8.8 | 15.7 | 72 | — | 32.1 → 45.1 |
| w36-panels: the World, 1936 at week 280 (as Britain), paused, each ledger by its key | earth-1936 | 0 | — | 250 | 16.7 | 16.7 | 116.7 | 133.4 | 5 | 4 (119) | 84.3 | 67.2 | 16 | 0.2 | 201 | 119.6 | 18 | 17.9 | 168 | — | 32 → 47.5 |
| w36-normal: the World, 1936 at week 280 (as Britain), normal speed, no input, 8 s | earth-1936 | 7 | 0.9 | 458 | 16.7 | 16.8 | 33.4 | 66.7 | 4 | 3 (69) | 255.2 | 43.8 | 20.3 | 1.3 | 305.7 | 253.5 | 1.9 | 3.4 | 48 | — | 35 → 68.3 |
| w36-max: the World, 1936 at week 280 (as Britain), fastest speed, no input, 8 s | earth-1936 | 37 | 4.6 | 405 | 16.7 | 33.4 | 50.1 | 66.7 | 15 | 9 (69) | 828 | 81.4 | 71.6 | 2.8 | 923.4 | 810.2 | 9.5 | 16.3 | 24 | — | 37.7 → 89.2 |
| w36-max-pan: the World, 1936 at week 280 (as Britain), fastest speed while dragging and clicking, 6 s | earth-1936 | 62 | 3.4 | 995 | 16.7 | 33.3 | 50 | 83.4 | 17 | 14 (87) | 689.6 | 152.7 | 12.6 | 3 | 882.9 | 690.1 | 6 | 9 | 104 | 37.1 / 78 | 39.6 → 68.9 |

## Opening a ledger (ms from the call to the next frame)

| Campaign | realm | industry | military | research | focus | diplomacy | wars | victory | log | help |
|---|---|---|---|---|---|---|---|---|---|---|
| the World, week 280 | 54 | 45 | 43 | 26 | 21 | 115 | 95 | 54 | 24 | 17 |

No page errors.
