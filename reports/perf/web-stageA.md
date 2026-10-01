Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 2026-10-01

### reach — 99 provinces, 9 realms

- Page load to menu: 88 ms; new campaign: simulation 11 ms, first frame after 339 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 2.4 | 5.1 | 7.7 | 24.6 | 31.5 |
| medium | 2.1 | 4.2 | 11.5 | 23.8 | 32.2 |
| close | 1.6 | 8.6 | 13 | 26.7 | 36.5 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1 / 1.4; terrain 1 / 1.5; supply 0.7 / 0.9; economy 1.3 / 1; frontier 0.7 / 0.7; diplomacy 0.8 / 1; military 0.5 / 0.6.
Opening ledgers (ms): realm 3.2, military 1.6, research 1.2, policy 1.3, diplomacy 1.7, wars 1.5, victory 27, log 2.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.7 ms, p95 21.2 ms, worst 42.1 ms.
Battle on screen (1 under way): draw avg 3 ms, p95 9 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 15 / 215 / 132; y4 15.6 / 215 / 157; y6 14.2 / 215 / 159; y8 12.2 / 215 / 171; y10 16.4 / 215 / 174; 6 s of wall time.

### aldmere — 298 provinces, 14 realms

- Page load to menu: 121 ms; new campaign: simulation 29 ms, first frame after 590 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 2.4 | 5 | 8.4 | 37.7 | 45.2 |
| medium | 3.8 | 9.2 | 16 | 40.1 | 52.8 |
| close | 1.4 | 6 | 11.6 | 27.9 | 38.8 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 0.9 / 1.2; terrain 1.5 / 1.4; supply 1.4 / 1.1; economy 2.1 / 6.5; frontier 1.2 / 1.3; diplomacy 1.3 / 2.3; military 0.8 / 1.
Opening ledgers (ms): realm 3.2, military 1.6, research 1.1, policy 0.8, diplomacy 1.5, wars 1.2, victory 24.1, log 1.5.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 18.2 ms, p95 30.6 ms, worst 46.1 ms.
Battle on screen (1 under way): draw avg 3.2 ms, p95 8.9 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 26.6 / 215 / 245; y4 19 / 215 / 252; y6 23.3 / 215 / 254; y8 19.3 / 215 / 257; y10 18.2 / 215 / 260; 8 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 98 ms; new campaign: simulation 77 ms, first frame after 1301 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 4.1 | 7.4 | 15.6 | 83.9 | 100.9 |
| medium | 6.3 | 15.9 | 18.3 | 46.2 | 59.1 |
| close | 1.9 | 6.2 | 12 | 31.3 | 37.9 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.6 / 1.6; terrain 1.7 / 2; supply 2.3 / 5.3; economy 2.7 / 7.9; frontier 2 / 2.2; diplomacy 1.9 / 1.6; military 1.8 / 1.8.
Opening ledgers (ms): realm 2.9, military 1.3, research 0.8, policy 0.9, diplomacy 0.9, wars 1.1, victory 28.4, log 1.6.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 23.6 ms, p95 55.4 ms, worst 94 ms.
Battle on screen (1 under way): draw avg 4.6 ms, p95 9.5 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 40.4 / 210 / 482; y4 32.3 / 195 / 483; y6 36.6 / 215 / 507; y8 33.1 / 215 / 512; y10 44.7 / 215 / 513; 21 s of wall time.

