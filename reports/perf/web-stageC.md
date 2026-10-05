Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 2026-10-01

### reach — 99 provinces, 9 realms

- Page load to menu: 127 ms; new campaign: simulation 22 ms, first frame after 381 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 2.2 | 3.9 | 5.3 | 25.9 | 33.3 |
| medium | 3.2 | 6 | 16.9 | 33.9 | 49.3 |
| close | 2.4 | 13.6 | 15.9 | 38 | 47.8 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.2 / 1.6; terrain 1 / 1.4; supply 0.8 / 0.9; economy 1.5 / 1.3; frontier 0.9 / 0.9; diplomacy 0.8 / 0.8; military 0.6 / 0.7.
Opening ledgers (ms): realm 3.9, military 1.8, research 1.3, policy 1.4, diplomacy 1.6, wars 1.6, victory 34.2, log 1.7.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.6 ms, p95 22.1 ms, worst 36.5 ms.
Battle on screen (1 under way): draw avg 2.4 ms, p95 8.8 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 16.1 / 200 / 140; y4 13.8 / 210 / 145; y6 24.4 / 210 / 161; y8 22.9 / 210 / 169; y10 17 / 210 / 179; 7 s of wall time.

### aldmere — 298 provinces, 14 realms

- Page load to menu: 102 ms; new campaign: simulation 45 ms, first frame after 589 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 2.6 | 4.2 | 5.3 | 44 | 58.3 |
| medium | 4.4 | 14.2 | 15.8 | 45.8 | 58.3 |
| close | 1.7 | 7.6 | 11.9 | 32.3 | 41.9 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.3 / 1.6; terrain 2.3 / 5.6; supply 1.5 / 1.7; economy 2 / 3.9; frontier 1.3 / 1.6; diplomacy 1.5 / 2.6; military 1.1 / 1.3.
Opening ledgers (ms): realm 2.7, military 1.3, research 0.9, policy 0.8, diplomacy 1.5, wars 1.6, victory 27.5, log 1.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 19.2 ms, p95 35.3 ms, worst 54.5 ms.
Battle on screen (1 under way): draw avg 4 ms, p95 10.1 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 26.6 / 206 / 272; y4 28.2 / 195 / 277; y6 14.3 / 210 / 296; y8 27.9 / 210 / 299; y10 16 / 211 / 299; 9 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 112 ms; new campaign: simulation 109 ms, first frame after 1490 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far | 4.9 | 7.7 | 19.6 | 100 | 121.5 |
| medium | 7.6 | 18.3 | 20.5 | 52.3 | 64.5 |
| close | 2.4 | 8.3 | 12.1 | 38.2 | 45.9 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.5 / 5.5; terrain 2.3 / 2.8; supply 2.2 / 3.6; economy 3 / 8.2; frontier 2.8 / 3; diplomacy 2.5 / 5.7; military 2.2 / 2.4.
Opening ledgers (ms): realm 2.9, military 1.3, research 0.9, policy 1, diplomacy 1.4, wars 1.4, victory 31.1, log 1.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 24.3 ms, p95 58.3 ms, worst 96.4 ms.
Battle on screen (1 under way): draw avg 4.9 ms, p95 13.7 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 81.1 / 195 / 522; y4 29.7 / 205 / 539; y6 61.7 / 210 / 555; y8 73 / 210 / 550; y10 94.6 / 205 / 569; 24 s of wall time.

