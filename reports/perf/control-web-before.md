# Gameplay profile — main b479032

Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /; 2026-10-14.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| w36-idle: the World, 1936 at week 280 (as Britain), paused, no input, 3 s | earth-1936 | 0 | — | 22 | 116.7 | 200 | 216.7 | 233.3 | 22 | 23 (227) | 1036.5 | 1036 | 0 | 0.3 | 1107.5 | 1068 | 0.2 | 0.1 | 0 | — | 32.6 → 45.4 |
| w36-pan: the World, 1936 at week 280 (as Britain), paused, dragging at regional zoom, 6 s | earth-1936 | 0 | — | 891 | 16.7 | 16.8 | 50 | 100 | 12 | 11 (116) | 169.3 | 167.7 | 0 | 0.5 | 351.5 | 181 | 4.1 | 7.6 | 32 | 19.3 / 37.8 | 33.4 → 48.8 |
| w36-select: the World, 1936 at week 280 (as Britain), paused, 12 clicks | earth-1936 | 0 | — | 165 | 16.7 | 33.4 | 50 | 66.7 | 6 | 6 (67) | 106.8 | 30 | 74.1 | 0.7 | 257 | 78.8 | 12.5 | 22.2 | 88 | — | 33.9 → 46.1 |
| w36-max: the World, 1936 at week 280 (as Britain), fastest speed, no input, 8 s | earth-1936 | 18 | 2.3 | 348 | 16.7 | 50 | 99.9 | 199.9 | 28 | 21 (116) | 862.9 | 105.4 | 55.5 | 5.1 | 949.7 | 850 | 6.5 | 11.6 | 32 | — | 34.1 → 82.8 |
| na-pan: the World 1936 at week 280, every realm at war flying front-line air missions (333 wings, 85 fleets; as Britain), paused, dragging at regional zoom, 6 s | earth-1936 | 0 | — | 899 | 16.7 | 16.8 | 133.3 | 199.9 | 36 | 36 (194) | 300.8 | 299.2 | 0 | 0.5 | 475.2 | 315.7 | 3.3 | 6 | 360 | 19.8 / 53.2 | 32.7 → 48.8 |
| na-max: the World 1936 at week 280, every realm at war flying front-line air missions (333 wings, 85 fleets; as Britain), fastest speed, no input, 8 s | earth-1936 | 18 | 2.3 | 353 | 16.7 | 50 | 83.3 | 149.9 | 25 | 19 (136) | 865.7 | 87.7 | 59.6 | 5.6 | 953.9 | 850.7 | 7.9 | 13.3 | 40 | — | 33.9 → 72.9 |

No page errors.
