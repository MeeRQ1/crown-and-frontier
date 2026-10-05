# AI-only campaign report

Map: reach. Runs: 10 (seeds 1–10, difficulties normal, 40-year limit). Node v22.22.2.

Winners: ser 1, tar 2, dre 1, fen 3, aur 2, mor 1
Victory paths: diplomatic 4, score 3, economic 2, territorial 1
Average campaign length: 36.1 years; wars per campaign 22.5; average war 8.7 months; peace treaties 37.4; forced peaces 0.0; battles 75.
Coalitions formed per campaign: 3.3; coalition wars: 3.5.
Eliminations per campaign: 0.40; bankruptcies per campaign: 0.30.
Performance: 4.90 ms/tick average, 107 ms worst tick, heap ≈ 40 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 12.0% of all income on average (highest single realm 63.5%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 86 of 86 surviving realms ran factories in their last month; factories 180 → 1760 (sum over runs).
- Average treasury at year 40: 4.72× monthly income; check: below 5×.
- Research: the average surviving realm finished 56.2% of the tree; 906 technologies finished in all; at most 2 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 64.1%, cavalry 13.2%, artillery 15.8%, engineers 6.0%, armour 0.8%.
- Shortages (share of realm-months): coal 8.1%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 2 | 12→14.3 | 100% | 3.6 | 7.1/3.9 | 13% | 32.3 |
| vos | 0 | 11→12.7 | 100% | 3.6 | 9.8/1.4 | 30% | 30.5 |
| ser | 1 | 9→10.9 | 100% | 0.1 | 3.5/5.0 | 50% | 31.3 |
| cal | 0 | 8→7.3 | 100% | 0.4 | 3.4/12.7 | 11% | 30.3 |
| ist | 0 | 8→5.4 | 100% | 0.2 | 2.0/13.1 | 11% | 28.8 |
| dre | 1 | 10→14.3 | 100% | 4.8 | 18.1/10.2 | 3% | 30.0 |
| mor | 1 | 10→5.8 | 60% | 4.5 | 15.3/15.7 | 12% | 26.8 |
| fen | 3 | 7→10.9 | 100% | 0.5 | 0.7/3.8 | 5% | 29.9 |
| tar | 2 | 12→17.4 | 100% | 4.8 | 15.1/8.8 | 8% | 30.7 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ser (diplomatic) | 1931.0 | 29 | 63 | — |
| 10 | normal | tar (score) | 1935.1 | 20 | 58 | mor |
| 2 | normal | dre (economic) | 1934.6 | 31 | 105 | — |
| 3 | normal | tar (territorial) | 1924.1 | 12 | 41 | mor |
| 4 | normal | fen (diplomatic) | 1931.8 | 25 | 93 | — |
| 5 | normal | fen (diplomatic) | 1931.3 | 30 | 83 | — |
| 6 | normal | fen (diplomatic) | 1931.4 | 18 | 61 | mor |
| 7 | normal | aur (score) | 1935.1 | 16 | 45 | mor |
| 8 | normal | mor (score) | 1935.1 | 27 | 141 | — |
| 9 | normal | aur (economic) | 1921.6 | 17 | 60 | — |
