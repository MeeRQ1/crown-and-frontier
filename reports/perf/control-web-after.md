# Gameplay profile — branch

Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /; 2026-10-14.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| w36-idle: the World, 1936 at week 280 (as Britain), paused, no input, 3 s | earth-1936 | 0 | — | 21 | 133.3 | 233.3 | 233.3 | 233.4 | 21 | 22 (237) | 1022.6 | 1022.1 | 0 | 0.4 | 1086.7 | 1048.8 | 0.2 | 0.1 | 0 | — | 33 → 47.2 |
| w36-pan: the World, 1936 at week 280 (as Britain), paused, dragging at regional zoom, 6 s | earth-1936 | 0 | — | 918 | 16.7 | 16.8 | 49.9 | 100.1 | 11 | 11 (109) | 166.3 | 164.8 | 0 | 0.4 | 355.6 | 178.3 | 4 | 6.7 | 32 | 20.5 / 38.7 | 33.6 → 45.8 |
| w36-select: the World, 1936 at week 280 (as Britain), paused, 12 clicks | earth-1936 | 0 | — | 171 | 16.7 | 33.3 | 33.4 | 50 | 1 | 2 (59) | 85.6 | 21.5 | 61.1 | 0.4 | 227.2 | 66.2 | 11.2 | 19.2 | 80 | — | 34 → 47.3 |
| w36-max: the World, 1936 at week 280 (as Britain), fastest speed, no input, 8 s | earth-1936 | 18 | 2.3 | 352 | 16.7 | 50 | 83.3 | 116.8 | 21 | 18 (121) | 888.6 | 79.8 | 52.6 | 3.6 | 968.4 | 875.2 | 7.1 | 12.1 | 24 | — | 34.2 → 91.9 |
| na-pan: the World 1936 at week 280, every realm at war flying front-line air missions (333 wings, 85 fleets; as Britain), paused, dragging at regional zoom, 6 s | earth-1936 | 0 | — | 913 | 16.7 | 16.8 | 116.6 | 233.3 | 38 | 38 (232) | 299.8 | 298.3 | 0 | 0.4 | 476.7 | 314.3 | 3.2 | 5.8 | 304 | 20.6 / 57.7 | 33 → 48 |
| na-max: the World 1936 at week 280, every realm at war flying front-line air missions (333 wings, 85 fleets; as Britain), fastest speed, no input, 8 s | earth-1936 | 15 | 1.9 | 353 | 16.7 | 50 | 100 | 150 | 23 | 16 (147) | 871.6 | 75 | 56.1 | 3.1 | 955.3 | 856.1 | 7.1 | 12.6 | 32 | — | 34.2 → 92.8 |

No page errors.
