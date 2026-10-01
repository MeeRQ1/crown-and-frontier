

Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 2026-10-01

### reach — 99 provinces, 9 realms

- Page load to menu: 118 ms; new campaign: simulation 16 ms, first frame after 379 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 2.4 | 4.3 | 5 | 25.5 | 32.1 |
| medium | 3 | 4.6 | 14.2 | 29.6 | 41.4 |
| close | 2.2 | 10.1 | 15.1 | 34 | 40.5 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.3 / 1.7; terrain 1.5 / 2.3; supply 1 / 1.2; economy 1.5 / 1.7; frontier 1.1 / 1; diplomacy 0.8 / 1; military 0.7 / 0.8.
Opening ledgers (ms): realm 3.1, military 1.3, research 1.2, policy 1.1, diplomacy 1.3, wars 1.3, victory 22.9, log 1.6.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.7 ms, p95 23.6 ms, worst 37.2 ms.
Battle on screen (1 under way): draw avg 2.4 ms, p95 10.5 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 12.2 / 205 / 152; y4 12.8 / 200 / 154; y6 11.2 / 210 / 155; y8 19.3 / 210 / 176; y10 24.8 / 210 / 178; 9 s of wall time.

### aldmere — 298 provinces, 14 realms

- Page load to menu: 253 ms; new campaign: simulation 54 ms, first frame after 822 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 3.9 | 6.9 | 10.3 | 58.3 | 79.1 |
| medium | 5.8 | 14.9 | 18.7 | 53.8 | 67.4 |
| close | 2.1 | 8.8 | 14.2 | 34.4 | 41.7 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.5 / 2.8; terrain 2.3 / 4.5; supply 1.9 / 2.1; economy 2.2 / 5.3; frontier 1.3 / 1.3; diplomacy 1.6 / 2.5; military 1.1 / 1.5.
Opening ledgers (ms): realm 2.8, military 1.3, research 1.2, policy 1.1, diplomacy 1.4, wars 1.4, victory 23.3, log 1.9.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 20.7 ms, p95 38.6 ms, worst 125.5 ms.
Battle on screen (1 under way): draw avg 3.8 ms, p95 8.6 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 20.4 / 210 / 234; y4 24.6 / 200 / 253; y6 18.9 / 205 / 261; y8 17 / 210 / 262; y10 25.1 / 210 / 266; 10 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 126 ms; new campaign: simulation 99 ms, first frame after 1646 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 6.5 | 15 | 24.3 | 111.4 | 133.4 |
| medium | 10 | 20.1 | 25.4 | 65.9 | 99.7 |
| close | 3.4 | 10.5 | 16.7 | 46.4 | 59.1 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.7 / 3.4; terrain 2.6 / 3.2; supply 3.3 / 6.6; economy 3.6 / 10.5; frontier 2.9 / 3.2; diplomacy 2.8 / 5.3; military 2.8 / 3.1.
Opening ledgers (ms): realm 3, military 1.5, research 1.1, policy 1, diplomacy 1.2, wars 1.4, victory 34.8, log 3.4.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 26 ms, p95 61.1 ms, worst 217.2 ms.
Battle on screen (1 under way): draw avg 6.4 ms, p95 15.6 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 23.5 / 200 / 481; y4 37 / 200 / 478; y6 44.3 / 195 / 479; y8 43.6 / 195 / 480; y10 27.8 / 206 / 502; 21 s of wall time.

