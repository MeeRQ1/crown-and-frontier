# Gameplay profile — this branch, served under a project subpath

Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 16 GB, headless Chromium 141.0.7390.37 (software rendering), 1366×800 at device pixel ratio 1, base /crown-and-frontier/; 2026-10-12.

Frame intervals are the time between animation frames as the player sees them (16.7 ms at 60 Hz). JS columns are milliseconds per second of wall time spent in the app's frame loop and in its parts; "main" is the main thread's task, script, style and layout time per second from the DevTools protocol.

| Workload | Map | Weeks | Weeks/s | Frames | p50 | p95 | p99 | max | >33 ms | long tasks (max) | frame JS/s | draw/s | UI/s | minimap/s | main task/s | script/s | style/s | layout/s | worst input (ms) | drag move p50/p95 (ms) | heap MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| aldmere-pan: paused, dragging the map, 6 s | aldmere | 0 | — | 783 | 16.7 | 16.7 | 16.8 | 50 | 1 | 0 (0) | 58.5 | 57.7 | 0 | 0.3 | 212.4 | 64.7 | 3.7 | 6.7 | 24 | 16.8 / 26.7 | 7.3 → 13.3 |
| aldmere-max: running at the fastest speed (6 weeks/s), no input, 8 s | aldmere | 48 | 6 | 481 | 16.7 | 16.8 | 16.8 | 16.8 | 0 | 0 (0) | 120.8 | 26.3 | 35.2 | 3.8 | 194.5 | 106.5 | 7.9 | 13.2 | 24 | — | 7.6 → 15.5 |
| editor-pan: the World in the editor, dragging, 6 s | — | 0 | — | 757 | 16.7 | 16.7 | 16.8 | 16.8 | 0 | 0 (0) | 0 | 0 | 0 | 0 | 69.8 | 2.4 | 0.1 | 0 | 24 | 16.7 / 19 | 50.3 → 64.2 |

No page errors.
