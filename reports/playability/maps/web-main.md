Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### earth — 1225 provinces, 57 realms

- Page load to menu: 1189 ms; new campaign: simulation 223 ms, first frame after 3197 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 26.2 | 57.1 | 70.3 | 137.2 | 169.5 |
| far | 9.3 | 34.5 | 103.2 | 21 | 39.5 |
| medium | 25.6 | 50.5 | 59.2 | 32.8 | 55.9 |
| close | 29.4 | 42.6 | 49.8 | 33.2 | 50.8 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 4.3 / 16.2; terrain 1.9 / 2.2; supply 2.8 / 13.3; economy 4.1 / 14.4; frontier 2.3 / 3.2; diplomacy 5.5 / 25.3; military 4.6 / 19.7; resources 1.9 / 2.3; sea 2.3 / 1.6.
Opening ledgers (ms): realm 3.6, industry 3.3, military 3, research 2.2, focus 1.5, diplomacy 2.6, wars 2.2, victory 40.8, log 3.9.
Fastest speed for 6 s: 35 weeks simulated (target 36); frame avg 18.3 ms, p95 32.2 ms, worst 65.6 ms.
Battle on screen (2 under way): draw avg 28.4 ms, p95 46.2 ms over 60 frames.
Long session (2 years at full speed, heap MB / DOM nodes / state KB): y2 102.9 / 224 / 1180; 13 s of wall time.

### Late-game stress: earth-1936, seed 1, week 280 (10 wars, 271 armies, AI only)

- The next 12 weeks, a whole week per frame (the loop before this change): frame avg 429 ms, p95 470.6 ms, worst 596 ms; 2.3 weeks/s.
- The same 12 weeks in slices at the fastest speed: 324 frames, frame avg 26.5 ms, p95 46 ms, worst 136.3 ms; 1.4 weeks/s.

