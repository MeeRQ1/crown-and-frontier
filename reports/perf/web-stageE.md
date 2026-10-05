Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.10GHz ×4, 2026-10-05

### midsea — 548 provinces, 16 realms

- Page load to menu: 234 ms; new campaign: simulation 84 ms, first frame after 1578 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 2.6 | 4.4 | 6.5 | 36.6 | 49.9 |
| far | 1.4 | 2.2 | 2.6 | 19.5 | 24.7 |
| medium | 5 | 11.1 | 29.1 | 45.9 | 57.5 |
| close | 2.5 | 10 | 14.7 | 36.3 | 46.4 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.2 / 1.4; terrain 2.3 / 2.4; supply 1.6 / 1.9; economy 2.6 / 2.8; frontier 3.2 / 10.5; diplomacy 1.9 / 2.1; military 2.8 / 9.7; resources 1.9 / 1.9; sea 2.3 / 2.5.
Opening ledgers (ms): realm 3.2, industry 1.7, military 1.9, research 1.7, focus 1.6, diplomacy 1.4, wars 2, victory 34.2, log 3.3.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 21.9 ms, p95 47.5 ms, worst 91.1 ms.
Battle on screen (1 under way): draw avg 4.1 ms, p95 9.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 22.5 / 198 / 363; 3 s of wall time.

### stress-900 — 900 provinces, 24 realms

- Page load to menu: 205 ms; new campaign: simulation 147 ms, first frame after 1716 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 5.8 | 9.4 | 25.3 | 113.8 | 139.2 |
| far | 4.9 | 24.4 | 30.6 | 27.6 | 39.8 |
| medium | 8.4 | 19.3 | 24.4 | 57.8 | 70.3 |
| close | 2.9 | 7.5 | 14.4 | 43.9 | 53 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.6 / 2.7; terrain 2.8 / 3.5; supply 3.5 / 8.8; economy 3.9 / 5.4; frontier 2.9 / 3; diplomacy 3.6 / 10.8; military 2.5 / 2.7; resources 3.5 / 7.1; sea 3.1 / 3.7.
Opening ledgers (ms): realm 4, industry 1.2, military 1.4, research 1.3, focus 1.4, diplomacy 1.3, wars 1.9, victory 34.7, log 2.7.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 29.7 ms, p95 77.2 ms, worst 115.6 ms.
Battle on screen (1 under way): draw avg 5.1 ms, p95 11.5 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 47 / 214 / 542; 6 s of wall time.

