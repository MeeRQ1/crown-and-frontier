Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-11

### reach — 99 provinces, 9 realms

- Page load to menu: 222 ms; new campaign: simulation 28 ms, first frame after 519 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 3.7 | 6.2 | 12.8 | 38.2 | 57.8 |
| far | 3 | 4.5 | 9.7 | 33.7 | 43.5 |
| medium | 3.4 | 4.7 | 15.2 | 38.1 | 50.9 |
| close | 2.4 | 11.9 | 16.2 | 47.8 | 62.2 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.4 / 1.7; terrain 1.5 / 2; supply 1.5 / 1.7; economy 1.9 / 2.2; frontier 1.3 / 1.7; diplomacy 1.2 / 1.5; military 1 / 1.1; resources 1 / 1.2; sea 1.1 / 1.8.
Opening ledgers (ms): realm 4, industry 1.8, military 2.1, research 1.4, focus 1.6, diplomacy 1.6, wars 1.6, victory 22.5, log 1.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.9 ms, p95 24.6 ms, worst 47.7 ms.
Battle on screen (1 under way): draw avg 3.1 ms, p95 9.8 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 15.9 / 218 / 196; y4 22.1 / 218 / 197; y6 21.5 / 218 / 203; y8 22.1 / 219 / 205; y10 32 / 218 / 203; 10 s of wall time.

### aldmere — 298 provinces, 14 realms

- Page load to menu: 284 ms; new campaign: simulation 48 ms, first frame after 735 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 3.2 | 6.1 | 9.3 | 50.8 | 59.7 |
| far | 1.9 | 3.4 | 7.6 | 26.4 | 33.1 |
| medium | 6 | 19.1 | 26.8 | 67 | 99 |
| close | 2.6 | 9.5 | 14.7 | 52.4 | 71.4 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.5 / 1.8; terrain 2.3 / 5.1; supply 2 / 2; economy 2.5 / 5.2; frontier 1.6 / 1.7; diplomacy 2.1 / 5.8; military 1.3 / 1.6; resources 1.6 / 1.7; sea 1.4 / 1.6.
Opening ledgers (ms): realm 3.9, industry 1.4, military 1.6, research 1.1, focus 1.2, diplomacy 1.2, wars 1.6, victory 27, log 2.1.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 20.3 ms, p95 40.3 ms, worst 65.5 ms.
Battle on screen (1 under way): draw avg 2.9 ms, p95 8.9 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 23.9 / 203 / 279; y4 46.6 / 208 / 283; y6 38.4 / 218 / 289; y8 55.5 / 218 / 298; y10 37.9 / 218 / 297; 13 s of wall time.

