Browser benchmarks — headless Chromium 141.0.7390.37 (software rendering), 1366×768, Intel(R) Xeon(R) Processor @ 2.80GHz ×4, 2026-10-18

### reach — 99 provinces, 9 realms

- Page load to menu: 436 ms; new campaign: simulation 34 ms, first frame after 990 ms (includes loading the map geometry).

| Panning | draw avg | draw p95 | draw max | frame avg | frame p95 |
|---|---|---|---|---|---|
| far (no level of detail) | 3.9 | 5.3 | 12.9 | 23.5 | 30 |
| far | 3 | 4.1 | 11.1 | 16.6 | 19 |
| medium | 2.7 | 3.9 | 9.6 | 16.6 | 19.1 |
| close | 14.1 | 33.8 | 38.6 | 21.4 | 40.6 |

Map modes while panning at medium zoom (draw ms, avg / p95): political 1.3 / 1.5; terrain 1.2 / 1.5; supply 0.8 / 1; economy 0.7 / 0.8; frontier 0.7 / 1; diplomacy 0.7 / 0.9; military 0.6 / 0.9; resources 0.6 / 1.3; sea 0.5 / 0.6.
Opening ledgers (ms): realm 4.2, industry 4.1, military 2.9, research 2.1, focus 2.2, diplomacy 2.4, wars 2.5, victory 12.3, log 3.3.
Fastest speed for 6 s: 36 weeks simulated (target 36); frame avg 16.6 ms, p95 22.6 ms, worst 32.1 ms.
Battle on screen (1 under way): draw avg 12.9 ms, p95 34 ms over 60 frames.
Long session (1 years at full speed, heap MB / DOM nodes / state KB): y1 23.9 / 220 / 208; 1 s of wall time.

### Late-game stress: earth, seed 1, week 280 (5 wars, 280 armies, AI only)

- The next 12 weeks, a whole week per frame (the loop before this change): frame avg 296.9 ms, p95 423.3 ms, worst 436.9 ms; 3.4 weeks/s.
- The same 12 weeks in slices at the fastest speed: 182 frames, frame avg 22.3 ms, p95 40.6 ms, worst 118.5 ms; 3.0 weeks/s.

