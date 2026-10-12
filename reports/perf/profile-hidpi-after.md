# Gameplay profile — this branch (after), 1920×1080 at pixel ratio 2

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1920×1080 at device pixel ratio 2, base /; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aldmere-idle: paused, no input, 3 s | aldmere | 0 | — | 34 | 83.3 | 116.6 | 116.6 | 116.7 | 34 | 35 (119) | 948.1 | 947.6 | 0 | 0.3 | 1077.1 | 974.3 | 0 | 0 | 0 | — | 7.4 → 12.5 |
| aldmere-pan: paused, dragging the map, 6 s | aldmere | 0 | — | 1147 | 16.7 | 49.9 | 66.7 | 183.3 | 62 | 48 (87) | 304.1 | 303.3 | 0 | 0.3 | 496.1 | 310.3 | 2 | 3.8 | 160 | 33.7 / 88.1 | 7.5 → 13.2 |
| aldmere-max: running at the fastest speed (6 weeks/s), no input, 8 s | aldmere | 47 | 5.9 | 474 | 16.7 | 16.8 | 33.3 | 33.4 | 0 | 0 (0) | 166.4 | 77.5 | 33.4 | 4.2 | 293.5 | 153.8 | 7.6 | 12.6 | 64 | — | 7.7 → 21.4 |
| world-idle: the World at war, paused, no input, 3 s | earth | 0 | — | 14 | 216.6 | 250 | 250 | 250 | 14 | 15 (248) | 1088.5 | 1088.2 | 0 | 0.2 | 1152.4 | 1101 | 0.3 | 0.1 | 0 | — | 23.8 → 35.9 |
| world-pan: the World at war, paused, dragging at regional zoom (far tier), 6 s | earth | 0 | — | 1156 | 16.7 | 99.9 | 183.3 | 283.3 | 118 | 103 (295) | 535.1 | 534.3 | 0 | 0.4 | 708.2 | 543.1 | 1.5 | 2.8 | 424 | 34.8 / 232.6 | 24.7 → 35.7 |
| world-max: the World at war, fastest speed, no input, 8 s | earth | 34 | 4.2 | 365 | 16.7 | 33.4 | 50 | 166.7 | 18 | 7 (161) | 767 | 213.2 | 56.4 | 2.4 | 943.3 | 755.1 | 6.8 | 11.4 | 80 | — | 25.1 → 105 |

No page errors.
