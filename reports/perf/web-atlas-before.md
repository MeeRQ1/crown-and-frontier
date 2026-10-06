Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 2026-10-06

### midsea — 548 provinces, 16 realms

- Page load to menu: 184 ms; new campaign: simulation 77 ms, first frame after 1593 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 2.1 | 3.1 | 3.6 | 31.6 | 38.1 |
| far | 1.1 | 1.5 | 3.4 | 17 | 20 |
| medium | 4.2 | 9.9 | 17.5 | 40.5 | 51.1 |
| close | 2 | 5.2 | 15.2 | 32.1 | 38.3 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.3 / 1.6; terrain 2.1 / 2.5; supply 1.4 / 1.6; economy 2.1 / 2.5; frontier 3.1 / 10.6; diplomacy 1.8 / 2.7; military 2.4 / 3; resources 2.1 / 2; sea 2 / 1.8.
Opening ledgers (ms): realm 2.7, industry 1.2, military 1.4, research 1, focus 1.1, diplomacy 1.2, wars 1.4, victory 26.7, log 1.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 21.5 ms, p95 47.7 ms, worst 75.9 ms.
Battle on screen (1 under way): draw avg 3.8 ms, p95 9.5 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 34 / 213 / 384; y4 28 / 218 / 399; y6 45.2 / 218 / 404; y8 35.7 / 208 / 417; y10 40.2 / 218 / 413; 15 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 178 ms; new campaign: simulation 107 ms, first frame after 1566 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 5 | 8.5 | 18.3 | 101.5 | 124.1 |
| far | 4.6 | 21.9 | 25.2 | 29.7 | 38.7 |
| medium | 7.5 | 16.9 | 19.9 | 51.3 | 62.3 |
| close | 2.6 | 8.8 | 12.5 | 39.6 | 47.6 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.6 / 2.6; terrain 2.6 / 3.2; supply 2.9 / 4.3; economy 3.3 / 5.6; frontier 2.6 / 2.7; diplomacy 2.9 / 6.8; military 2.6 / 2.6; resources 3.2 / 7.4; sea 3.4 / 9.3.
Opening ledgers (ms): realm 3, industry 1.2, military 1.4, research 1.2, focus 1, diplomacy 1.2, wars 1.6, victory 31.3, log 1.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 25.9 ms, p95 66 ms, worst 89.2 ms.
Battle on screen (1 under way): draw avg 5 ms, p95 9.4 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 47.7 / 214 / 542; y4 35 / 198 / 544; y6 24.2 / 213 / 552; y8 29.3 / 203 / 565; y10 22.9 / 204 / 582; 23 s of wall time.

