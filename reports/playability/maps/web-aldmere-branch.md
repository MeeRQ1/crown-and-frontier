Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### aldmere — 298 provinces, 14 realms

- Page load to menu: 491 ms; new campaign: simulation 61 ms, first frame after 635 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 4 | 5.3 | 6.9 | 35.6 | 41.6 |
| far | 2.5 | 3.4 | 11.7 | 16.7 | 19.3 |
| medium | 20.6 | 42.2 | 45.7 | 27.8 | 46.5 |
| close | 10.8 | 25.4 | 27.3 | 18.7 | 28.7 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 0.9 / 1.3; terrain 1.1 / 1.3; supply 0.9 / 1.1; economy 1.3 / 2.2; frontier 1 / 1.3; diplomacy 0.9 / 1.2; military 0.8 / 1; resources 0.8 / 1; sea 0.7 / 0.9.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.47 / 0.76 (1071 of 4080 points on land); medium 0.53 / 0.26 (2552 of 4080 points on land).
Opening ledgers (ms): realm 3.5, industry 3.7, military 3.1, research 2.1, focus 1.3, diplomacy 2, wars 1.6, victory 15.8, log 3.4.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.6 ms, p95 28.1 ms, worst 38.9 ms.
Battle on screen (1 under way): draw avg 8.1 ms, p95 29.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 53.6 / 251 / 367; 2 s of wall time.

