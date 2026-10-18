Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### aldmere — 298 provinces, 14 realms

- Page load to menu: 459 ms; new campaign: simulation 57 ms, first frame after 705 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 4.1 | 5.6 | 6 | 35.8 | 40.2 |
| far | 2.3 | 2.8 | 12 | 16.7 | 17.8 |
| medium | 22.6 | 47.4 | 56 | 30 | 51.1 |
| close | 11.8 | 26.6 | 38.4 | 19.6 | 29.5 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 0.9 / 1.3; terrain 1.2 / 1.6; supply 1 / 1.3; economy 1.2 / 1.7; frontier 1.1 / 1.5; diplomacy 0.9 / 1.2; military 0.7 / 1; resources 0.7 / 1; sea 0.6 / 0.7.
Opening ledgers (ms): realm 4.8, industry 5, military 4.4, research 2.2, focus 1.4, diplomacy 2.3, wars 1.5, victory 13.8, log 2.9.
Fastest speed for 6 s: 35 weeks simulated (target 36); frame avg 16.6 ms, p95 27.2 ms, worst 37.4 ms.
Battle on screen (1 under way): draw avg 21.1 ms, p95 47.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 34.8 / 227 / 329; 2 s of wall time.

