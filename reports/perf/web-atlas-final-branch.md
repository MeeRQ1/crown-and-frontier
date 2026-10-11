Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-11

### reach — 99 provinces, 9 realms

- Page load to menu: 401 ms; new campaign: simulation 29 ms, first frame after 1071 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 3.1 | 4.9 | 6.8 | 33.1 | 44.4 |
| far | 2.7 | 3.9 | 6.3 | 31.8 | 38.5 |
| medium | 5.1 | 19.2 | 24.5 | 36.2 | 56.5 |
| close | 4.5 | 17.2 | 19.7 | 50.7 | 71.7 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.8 / 8.7; terrain 1.4 / 2; supply 1.6 / 1.8; economy 2.4 / 11.1; frontier 1.8 / 1.3; diplomacy 1.6 / 1.3; military 1 / 1; resources 1.2 / 1.1; sea 0.8 / 1.
Opening ledgers (ms): realm 3.7, industry 4.9, military 3.2, research 2.3, focus 1.6, diplomacy 2.6, wars 1.8, victory 14.8, log 3.6.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.8 ms, p95 25.5 ms, worst 41.4 ms.
Battle on screen (1 under way): draw avg 8.2 ms, p95 21.5 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 21.8 / 227 / 177; y4 22.6 / 227 / 185; y6 34 / 232 / 193; y8 24.9 / 237 / 195; y10 35.2 / 237 / 196; 10 s of wall time.

### aldmere — 298 provinces, 14 realms

- Page load to menu: 440 ms; new campaign: simulation 55 ms, first frame after 747 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 3.6 | 5.9 | 7.1 | 61.5 | 86.5 |
| far | 2.1 | 3.2 | 9.5 | 35.8 | 47.3 |
| medium | 7.4 | 22.3 | 25.7 | 62.6 | 79.2 |
| close | 4.1 | 18.2 | 19 | 47.7 | 62.1 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.1 / 4.4; terrain 4.5 / 17.9; supply 2.5 / 8.4; economy 4.4 / 16.1; frontier 2.6 / 2.1; diplomacy 4 / 16.9; military 1.5 / 1.8; resources 2.6 / 10.9; sea 1.2 / 1.7.
Opening ledgers (ms): realm 3.6, industry 3, military 3, research 2, focus 1.3, diplomacy 2.3, wars 1.6, victory 17, log 3.2.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 20 ms, p95 39.2 ms, worst 63.3 ms.
Battle on screen (1 under way): draw avg 7.9 ms, p95 18.6 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 28.3 / 211 / 284; y4 28.7 / 221 / 293; y6 35.5 / 231 / 308; y8 30.9 / 231 / 313; y10 22.9 / 231 / 316; 11 s of wall time.

### europe — 686 provinces, 23 realms

- Page load to menu: 444 ms; new campaign: simulation 115 ms, first frame after 2897 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 10.9 | 38 | 46.1 | 94.7 | 132.1 |
| far | 40 | 52.7 | 56.2 | 44.8 | 55.9 |
| medium | 10.3 | 30.5 | 60.1 | 74.6 | 93.8 |
| close | 12 | 46.6 | 49.4 | 55.4 | 67.8 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 14.7 / 39.5; terrain 4.2 / 14.5; supply 15.8 / 45.8; economy 14.6 / 44.6; frontier 4.5 / 14.9; diplomacy 22 / 52.9; military 16 / 45; resources 2.8 / 12.1; sea 15.6 / 43.
Opening ledgers (ms): realm 4.5, industry 5, military 2.6, research 1.7, focus 1.2, diplomacy 1.9, wars 1.5, victory 20.6, log 3.8.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 26.7 ms, p95 56.9 ms, worst 73.8 ms.
Battle on screen (1 under way): draw avg 18.1 ms, p95 29.4 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 48.4 / 225 / 532; y4 43.4 / 234 / 546; y6 37.8 / 234 / 579; y8 41.6 / 234 / 595; y10 36.4 / 234 / 585; 27 s of wall time.

### hesperia — 754 provinces, 22 realms

- Page load to menu: 596 ms; new campaign: simulation 116 ms, first frame after 2449 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 4.3 | 5.9 | 7 | 83 | 98.2 |
| far | 2.4 | 2.8 | 19 | 41.5 | 55.7 |
| medium | 13.2 | 31.2 | 39.3 | 85.2 | 109.9 |
| close | 7.5 | 22.9 | 34.6 | 64.1 | 92.7 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 4.8 / 16.2; terrain 2.8 / 3.1; supply 5.3 / 18; economy 3.7 / 14.3; frontier 4 / 13.6; diplomacy 5.2 / 15.6; military 3.1 / 13.9; resources 5.8 / 17.6; sea 4.1 / 18.2.
Opening ledgers (ms): realm 5.2, industry 4.3, military 2.8, research 2.8, focus 1.6, diplomacy 2.2, wars 1.5, victory 23.4, log 4.1.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 28 ms, p95 59 ms, worst 122.1 ms.
Battle on screen (1 under way): draw avg 9.9 ms, p95 19.1 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 42.3 / 224 / 530; y4 36.5 / 228 / 534; y6 32.2 / 225 / 541; y8 52 / 226 / 562; y10 57.5 / 225 / 565; 22 s of wall time.

### earth — 1225 provinces, 57 realms

- Page load to menu: 499 ms; new campaign: simulation 210 ms, first frame after 3827 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 23.7 | 65.8 | 102 | 174.1 | 225.6 |
| far | 47.3 | 58.6 | 61.6 | 58.7 | 73.5 |
| medium | 11.8 | 26.7 | 31.3 | 91.1 | 107.5 |
| close | 14.7 | 26.9 | 42.5 | 83.8 | 108.6 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 4.3 / 5; terrain 8 / 18; supply 8.7 / 22.1; economy 5.9 / 24.4; frontier 10.8 / 25.6; diplomacy 10 / 26.9; military 5.5 / 17.2; resources 11 / 24; sea 7.2 / 19.7.
Opening ledgers (ms): realm 3.7, industry 2.6, military 4.6, research 3.4, focus 2.2, diplomacy 3, wars 2.3, victory 57.7, log 5.4.
Fastest speed for 6 s: 28 weeks simulated (target 36); frame avg 53.5 ms, p95 91.2 ms, worst 117.9 ms.
Battle on screen (1 under way): draw avg 19 ms, p95 31 ms over 60 frames.
Long session (10 years at full speed, heap MB / DOM nodes / state KB): y2 80.6 / 244 / 1050; y4 77.5 / 234 / 1132; y6 99.7 / 244 / 1138; y8 67.1 / 240 / 1149; y10 113.6 / 244 / 1159; 88 s of wall time.

### Late-game stress: earth, seed 1, week 280 (3 wars, 205 armies, AI only)

- The next 12 weeks, a whole week per frame (the loop before this change): frame avg 498.8 ms, p95 633.5 ms, worst 704.2 ms; 2.0 weeks/s.
- The same 12 weeks in slices at the fastest speed: 75 frames, frame avg 104.2 ms, p95 275.1 ms, worst 382.2 ms; 1.5 weeks/s.

