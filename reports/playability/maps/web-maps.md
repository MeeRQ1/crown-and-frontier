Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### europe — 959 provinces, 23 realms

- Page load to menu: 527 ms; new campaign: simulation 185 ms, first frame after 2342 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 6 | 9.4 | 14.1 | 45.1 | 66.6 |
| far | 2.9 | 4.4 | 17.8 | 16.7 | 20.2 |
| medium | 34 | 60.2 | 78.2 | 40.3 | 65.3 |
| close | 24.5 | 37.5 | 48.4 | 28.9 | 48.3 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.4 / 1.9; terrain 2.4 / 2.1; supply 1.6 / 2; economy 3.3 / 13.9; frontier 1.6 / 2; diplomacy 4.6 / 22.7; military 4.7 / 18.2; resources 1.3 / 1.6; sea 3.1 / 13.8.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.52 / 0.78 (1597 of 4080 points on land); medium 0.33 / 0.37 (2040 of 4080 points on land).
Opening ledgers (ms): realm 4.1, industry 5, military 4, research 2.6, focus 1.5, diplomacy 2.8, wars 1.8, victory 25.9, log 5.1.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 18.6 ms, p95 36.6 ms, worst 79.9 ms.
Battle on screen (1 under way): draw avg 38.1 ms, p95 67 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 72.7 / 235 / 704; 6 s of wall time.

### europe-rev1 — 686 provinces, 23 realms

- Page load to menu: 490 ms; new campaign: simulation 83 ms, first frame after 1482 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 6.4 | 8.4 | 9.4 | 58.2 | 76.1 |
| far | 2.5 | 3.3 | 13.7 | 16.7 | 18.1 |
| medium | 17 | 49.5 | 60.6 | 25.5 | 59.3 |
| close | 19.7 | 30.4 | 37 | 24.2 | 33.1 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.2 / 1.4; terrain 1.3 / 1.6; supply 1.7 / 1.5; economy 1.2 / 1.5; frontier 1.8 / 2.3; diplomacy 1.5 / 1.7; military 0.8 / 0.9; resources 0.6 / 0.8; sea 1.5 / 1.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.57 / 1.04 (1859 of 4080 points on land); medium 0.49 / 0.13 (3704 of 4080 points on land).
Opening ledgers (ms): realm 3.5, industry 3.1, military 3.5, research 3, focus 1.4, diplomacy 2.3, wars 1.6, victory 18.5, log 4.8.
Fastest speed for 6 s: 33 weeks simulated (target 36); frame avg 17.9 ms, p95 38.5 ms, worst 71.8 ms.
Battle on screen (1 under way): draw avg 25.4 ms, p95 90 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 82.5 / 241 / 615; 5 s of wall time.

### europe-1936 — 967 provinces, 32 realms

- Page load to menu: 517 ms; new campaign: simulation 232 ms, first frame after 2614 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 4.6 | 6.3 | 9.4 | 25 | 32 |
| far | 3 | 3.1 | 31.6 | 16.9 | 17.7 |
| medium | 11.6 | 25.7 | 28.8 | 20.3 | 29 |
| close | 10.2 | 26.1 | 37.3 | 18.8 | 29.4 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1 / 1.4; terrain 1.4 / 1.6; supply 1.1 / 1.3; economy 0.9 / 1.1; frontier 1.2 / 1.8; diplomacy 1.3 / 1.2; military 2.7 / 13.5; resources 1.2 / 2; sea 1.9 / 1.3.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.42 / 0.45 (642 of 4080 points on land); medium 0.34 / 0.16 (1542 of 4080 points on land).
Opening ledgers (ms): realm 3.8, industry 3.2, military 2.9, research 2.3, focus 1.6, diplomacy 2.8, wars 1.7, victory 28.1, log 5.4.
Fastest speed for 6 s: 35 weeks simulated (target 36); frame avg 16.9 ms, p95 31.8 ms, worst 50.2 ms.
Battle on screen (1 under way): draw avg 22.2 ms, p95 42.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 121.9 / 225 / 871; 10 s of wall time.

### europe-1936-rev1 — 689 provinces, 32 realms

- Page load to menu: 503 ms; new campaign: simulation 146 ms, first frame after 1537 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 8.7 | 10.2 | 15.4 | 74 | 100.4 |
| far | 4.2 | 7.1 | 23.8 | 16.7 | 21.3 |
| medium | 23.6 | 58.9 | 70.1 | 33 | 69.3 |
| close | 33.3 | 49.7 | 55.8 | 37.6 | 54.6 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 6.6 / 17.3; terrain 2.1 / 2.8; supply 2.7 / 3.7; economy 2.7 / 2.2; frontier 2.1 / 2.7; diplomacy 5.2 / 20; military 3.9 / 15.9; resources 1.7 / 2.1; sea 5.2 / 18.4.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.62 / 1.14 (1970 of 4080 points on land); medium 0.45 / 0.35 (3143 of 4080 points on land).
Opening ledgers (ms): realm 3.3, industry 3.3, military 2.3, research 2.8, focus 1.5, diplomacy 2.4, wars 1.6, victory 21.2, log 3.6.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 17.2 ms, p95 31.5 ms, worst 51 ms.
Battle on screen (1 under way): draw avg 22.9 ms, p95 65.5 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 92.3 / 241 / 788; 9 s of wall time.

### earth — 1594 provinces, 57 realms

- Page load to menu: 508 ms; new campaign: simulation 289 ms, first frame after 3331 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 16.7 | 49.4 | 85 | 77.5 | 118.4 |
| far | 7.9 | 37.5 | 55.4 | 19.2 | 43.4 |
| medium | 42.9 | 69.1 | 77.2 | 47.4 | 74 |
| close | 21.8 | 37.9 | 48.6 | 27.9 | 46.9 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.8 / 2.5; terrain 2.8 / 3.4; supply 2 / 2.6; economy 7.9 / 20.8; frontier 5.3 / 17.2; diplomacy 2.1 / 2.6; military 4 / 15.7; resources 2 / 2.6; sea 2.5 / 3.6.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.66 / 1.11 (1829 of 4080 points on land); medium 0.25 / 0.44 (1384 of 4080 points on land).
Opening ledgers (ms): realm 3.4, industry 3.2, military 2.3, research 2.1, focus 1.6, diplomacy 2.4, wars 2, victory 37.6, log 4.
Fastest speed for 6 s: 27 weeks simulated (target 36); frame avg 23.9 ms, p95 52.4 ms, worst 107.5 ms.
Battle on screen (1 under way): draw avg 41.9 ms, p95 68.5 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 193.4 / 222 / 1358; 17 s of wall time.

### earth-rev1 — 1225 provinces, 57 realms

- Page load to menu: 565 ms; new campaign: simulation 227 ms, first frame after 2410 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 25.4 | 52.4 | 67.1 | 129.9 | 151.1 |
| far | 8.2 | 36.8 | 102.6 | 20 | 41.2 |
| medium | 23.7 | 52.1 | 60.2 | 31.3 | 57.6 |
| close | 34.1 | 53.8 | 66.7 | 39.2 | 64.9 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 7.6 / 22.1; terrain 2.3 / 2.9; supply 4.8 / 21.4; economy 4.6 / 15.2; frontier 2.3 / 3.2; diplomacy 5.2 / 17.9; military 4.5 / 18.4; resources 1.8 / 2.3; sea 5.3 / 24.8.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.61 / 0.87 (1652 of 4080 points on land); medium 0.33 / 0.3 (1979 of 4080 points on land).
Opening ledgers (ms): realm 3.9, industry 3.6, military 3.5, research 2.6, focus 2.8, diplomacy 2.7, wars 1.9, victory 40, log 6.4.
Fastest speed for 6 s: 32 weeks simulated (target 36); frame avg 20.3 ms, p95 34.5 ms, worst 92.6 ms.
Battle on screen (1 under way): draw avg 30.6 ms, p95 66.6 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 92.6 / 235 / 1208; 12 s of wall time.

