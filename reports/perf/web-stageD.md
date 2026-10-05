Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-05

### midsea — 548 provinces, 16 realms

- Page load to menu: 187 ms; new campaign: simulation 75 ms, first frame after 1404 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 2.4 | 3.8 | 6.5 | 36.5 | 50 |
| far | 1.6 | 2.3 | 8.7 | 25.4 | 37.1 |
| medium | 4.1 | 12.2 | 16.7 | 50.5 | 62.6 |
| close | 2.1 | 5.9 | 14.2 | 44.2 | 52.3 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.5 / 1.9; terrain 2.2 / 2.3; supply 1.4 / 1.5; economy 2.2 / 2.5; frontier 3.3 / 11.5; diplomacy 1.8 / 2.6; military 2.3 / 3.
Opening ledgers (ms): realm 3.2, military 1.3, research 1.2, policy 1.1, diplomacy 1.3, wars 2.4, victory 27.3, log 1.9.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 25.2 ms, p95 55.8 ms, worst 138.4 ms.
Battle on screen (1 under way): draw avg 3.8 ms, p95 10.7 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 26.3 / 195 / 370; 3 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 267 ms; new campaign: simulation 77 ms, first frame after 1410 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 5.4 | 8.6 | 24.7 | 103.7 | 124.5 |
| far | 5.5 | 29.5 | 33.1 | 33 | 39.4 |
| medium | 8.5 | 19.7 | 24.9 | 68.9 | 90.2 |
| close | 2.8 | 10.8 | 14.8 | 53.1 | 64.1 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.5 / 2.9; terrain 2.7 / 3.4; supply 3 / 4.8; economy 3.6 / 8.8; frontier 2.6 / 3; diplomacy 3.3 / 11.7; military 2.7 / 2.8.
Opening ledgers (ms): realm 2.7, military 1.3, research 1, policy 1, diplomacy 1.5, wars 1.3, victory 60.7, log 2.6.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 30.8 ms, p95 76.4 ms, worst 104.6 ms.
Battle on screen (1 under way): draw avg 5.7 ms, p95 14.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 39.2 / 195 / 522; 5 s of wall time.

