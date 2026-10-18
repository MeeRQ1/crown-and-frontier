Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### europe — 959 provinces, 23 realms

- Page load to menu: 790 ms; new campaign: simulation 244 ms, first frame after 2661 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 6.1 | 10.2 | 12.9 | 42.9 | 68.5 |
| far | 2.7 | 3.1 | 22.6 | 16.7 | 18.2 |
| medium | 30.6 | 55.5 | 61.5 | 36.9 | 59.5 |
| close | 24.3 | 36.7 | 45.7 | 28.1 | 40.3 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.5 / 1.8; terrain 2.5 / 5.6; supply 1.4 / 1.8; economy 3.2 / 12.5; frontier 1.5 / 2; diplomacy 5.2 / 22.2; military 5.5 / 21.5; resources 1.3 / 1.8; sea 2.1 / 2.3.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.52 / 0.78 (1597 of 4080 points on land); medium 0.29 / 0.29 (2040 of 4080 points on land).
Opening ledgers (ms): realm 3.9, industry 5.9, military 3.4, research 2.3, focus 1.3, diplomacy 2.3, wars 1.7, victory 87.5, log 3.6.
Fastest speed for 6 s: 35 weeks simulated (target 36); frame avg 18.6 ms, p95 37.9 ms, worst 64.8 ms.
Battle on screen (2 under way): draw avg 22.7 ms, p95 54.8 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 57.3 / 235 / 766; 5 s of wall time.

### europe-rev1 — 686 provinces, 23 realms

- Page load to menu: 563 ms; new campaign: simulation 125 ms, first frame after 1578 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 6.2 | 8.4 | 9.1 | 56.5 | 70.1 |
| far | 2.6 | 3.3 | 12.9 | 16.7 | 18.3 |
| medium | 16.8 | 45.1 | 56.5 | 24.7 | 48.3 |
| close | 22.4 | 33.4 | 102.7 | 26.9 | 36.8 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.2 / 1.3; terrain 1.5 / 1.7; supply 1.8 / 1.2; economy 1.4 / 1.9; frontier 1.6 / 1.3; diplomacy 2.9 / 16.3; military 0.8 / 1; resources 0.7 / 1; sea 3.1 / 15.2.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.6 / 1.26 (1859 of 4080 points on land); medium 0.66 / 0.11 (3704 of 4080 points on land).
Opening ledgers (ms): realm 3.5, industry 3.5, military 5.4, research 3.2, focus 2.1, diplomacy 3.5, wars 2.3, victory 21.5, log 3.4.
Fastest speed for 6 s: 32 weeks simulated (target 36); frame avg 18.5 ms, p95 35.1 ms, worst 80.8 ms.
Battle on screen (1 under way): draw avg 14.6 ms, p95 46.3 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 72.6 / 220 / 629; 6 s of wall time.

### earth — 1594 provinces, 57 realms

- Page load to menu: 622 ms; new campaign: simulation 332 ms, first frame after 3645 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 17.1 | 53.5 | 75.3 | 81.2 | 135.1 |
| far | 8 | 38 | 58.3 | 19.5 | 45.4 |
| medium | 44.4 | 69.5 | 93.4 | 49.6 | 74.8 |
| close | 27.3 | 49.5 | 61 | 31.8 | 53.2 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.6 / 1.7; terrain 2.2 / 2.9; supply 2.2 / 2.7; economy 8.4 / 21.7; frontier 4.8 / 16.1; diplomacy 2.4 / 3.4; military 4.8 / 17.3; resources 2 / 2.4; sea 1.8 / 2.3.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.66 / 1.09 (1829 of 4080 points on land); medium 0.35 / 0.42 (1384 of 4080 points on land).
Opening ledgers (ms): realm 3.6, industry 3.6, military 3.7, research 3.6, focus 2.1, diplomacy 3.5, wars 2.3, victory 35.1, log 3.8.
Fastest speed for 6 s: 31 weeks simulated (target 36); frame avg 23 ms, p95 41.1 ms, worst 110.6 ms.
Battle on screen (1 under way): draw avg 49.8 ms, p95 66.5 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 165.7 / 239 / 1392; 16 s of wall time.

### earth-rev1 — 1225 provinces, 57 realms

- Page load to menu: 508 ms; new campaign: simulation 247 ms, first frame after 2722 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 28.2 | 66 | 162.5 | 139.1 | 171.9 |
| far | 9.1 | 36.5 | 129.8 | 20.3 | 40.8 |
| medium | 21.8 | 49.9 | 59.6 | 29.1 | 54 |
| close | 28 | 43.4 | 46.7 | 31.7 | 46.1 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 2.3 / 2.5; terrain 2.1 / 2.7; supply 2.4 / 2.7; economy 4 / 13.8; frontier 3.2 / 7.5; diplomacy 4.3 / 17.1; military 5.4 / 22.5; resources 1.8 / 2.4; sea 2.1 / 1.8.
Hit-testing per pointer position (µs; province / armies, fleets and wings): far 0.6 / 0.85 (1652 of 4080 points on land); medium 0.35 / 0.29 (1979 of 4080 points on land).
Opening ledgers (ms): realm 3.3, industry 3.2, military 5.5, research 3.3, focus 1.5, diplomacy 2.2, wars 1.6, victory 48.8, log 5.6.
Fastest speed for 6 s: 35 weeks simulated (target 36); frame avg 17.9 ms, p95 31.7 ms, worst 70.3 ms.
Battle on screen (1 under way): draw avg 43.9 ms, p95 98.7 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 89.6 / 246 / 1216; 13 s of wall time.

### Late-game stress: earth-1936, seed 1, week 200 (10 wars, 202 armies, AI only)

- The next 12 weeks, a whole week per frame (the loop before this change): frame avg 434.5 ms, p95 510.2 ms, worst 666.5 ms; 2.3 weeks/s.
- The same 12 weeks in slices at the fastest speed: 291 frames, frame avg 24.6 ms, p95 43.2 ms, worst 176.5 ms; 1.7 weeks/s.

### Late-game stress: earth-1936-r1, seed 1, week 200 (8 wars, 169 armies, AI only)

- The next 12 weeks, a whole week per frame (the loop before this change): frame avg 318.5 ms, p95 507 ms, worst 583.8 ms; 3.1 weeks/s.
- The same 12 weeks in slices at the fastest speed: 217 frames, frame avg 21.5 ms, p95 39.8 ms, worst 83.8 ms; 2.6 weeks/s.

