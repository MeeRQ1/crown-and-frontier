# Gameplay profile — main 8ba06c6 (before), 1920×1080 at pixel ratio 2

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1920×1080 at device pixel ratio 2, base /; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aldmere-idle: paused, no input, 3 s | aldmere | 0 | — | 22 | 133.3 | 150 | 150.1 | 200 | 22 | 23 (201) | 822.9 | 822.3 | 0 | 0.4 | 1100.7 | 855.6 | 0 | 0 | 0 | — | 7.2 → 13 |
| aldmere-pan: paused, dragging the map, 6 s | aldmere | 0 | — | 1141 | 116.7 | 150.1 | 183.3 | 450 | 1141 | 1143 (458) | 899.9 | 899.5 | 0 | 0.3 | 1000.9 | 901.1 | 0 | 0 | 280 | 343.1 / 435.6 | 7.3 → 15.1 |
| aldmere-max: running at the fastest speed (6 weeks/s), no input, 8 s | aldmere | 48 | 5.8 | 38 | 216.7 | 266.6 | 266.7 | 266.7 | 38 | 39 (268) | 970.8 | 865.4 | 37 | 13.2 | 1030.8 | 950.6 | 5.1 | 7.4 | 408 | — | 7.6 → 15.7 |
| world-idle: the World at war, paused, no input, 3 s | earth | 0 | — | 12 | 266.6 | 266.7 | 266.7 | 283.4 | 12 | 13 (277) | 147.7 | 147.5 | 0 | 0.2 | 1178.8 | 155 | 0.2 | 0.1 | 0 | — | 28.8 → 40.3 |
| world-pan: the World at war, paused, dragging at regional zoom (far tier), 6 s | earth | 0 | — | 1137 | 233.3 | 283.3 | 333.3 | 633.3 | 1137 | 1139 (626) | 415.3 | 415 | 0 | 0.2 | 1000.9 | 415.6 | 0 | 0 | 552 | 676.3 / 815.1 | 29.1 → 44.9 |
| world-max: the World at war, fastest speed, no input, 8 s | earth | 4 | 0.4 | 27 | 333.3 | 366.7 | 366.7 | 699.9 | 27 | 28 (701) | 532.2 | 405.7 | 10.3 | 11.6 | 1062.3 | 529.4 | 0.6 | 1.2 | 664 | — | 30 → 61.2 |

No page errors.
