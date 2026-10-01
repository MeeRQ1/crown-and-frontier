# AI-only campaign report

Map: aldmere. Runs: 10 (seeds 1–10, difficulties normal, 60-year limit). Node v22.22.2.

Winners: tar 4, les 2, mor 4
Victory paths: territorial 3, score 5, economic 2
Average campaign length: 53.2 years; wars per campaign 43.3; average war 11.0 months; peace treaties 78.5; forced peaces 0.0; battles 238.
Coalitions formed per campaign: 10.4; coalition wars: 24.3.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.20.
Performance: 11.76 ms/tick average, 208 ms worst tick, heap ≈ 65 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 11.4% of all income on average (highest single realm 78.2%); check: at most 30%.
- Realms with a trade agreement: 99.3% of realm-months.
- Industry at the end: 140 of 140 surviving realms ran factories in their last month; factories 320 → 6169 (sum over runs).
- Average treasury at year 40: 3.19× monthly income; check: below 5×.
- Research: the average surviving realm finished 46.2% of the tree; 2515 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.5%, cavalry 12.9%, artillery 17.6%, engineers 3.4%, armour 0.7%.
- Shortages (share of realm-months): coal 13.1%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 0 | 25→33.1 | 100% | 6.6 | 18.4/10.3 | 30% | 29.1 |
| vos | 0 | 20→18.4 | 100% | 2.2 | 13.3/16.9 | 28% | 23.0 |
| ser | 0 | 20→19.5 | 100% | 0.2 | 2.7/4.8 | 56% | 26.5 |
| cal | 0 | 16→19.4 | 100% | 1.4 | 7.0/7.4 | 34% | 29.2 |
| ist | 0 | 17→16.9 | 100% | 0.5 | 2.8/1.4 | 40% | 25.6 |
| dre | 0 | 21→21.3 | 100% | 6.3 | 27.6/22.8 | 26% | 23.4 |
| mor | 4 | 25→44.8 | 100% | 12.9 | 66.8/44.7 | 13% | 26.1 |
| fen | 0 | 12→10.2 | 100% | 0.0 | 8.4/25.3 | 18% | 20.0 |
| tar | 4 | 30→39.4 | 100% | 4.6 | 33.5/31.0 | 11% | 25.8 |
| car | 0 | 13→14.7 | 100% | 0.4 | 2.8/8.4 | 43% | 23.6 |
| hra | 0 | 14→6.5 | 100% | 0.3 | 4.7/14.3 | 30% | 20.3 |
| sol | 0 | 12→10.4 | 100% | 0.1 | 4.6/8.2 | 51% | 22.6 |
| les | 2 | 24→32.0 | 100% | 7.3 | 30.2/19.9 | 18% | 30.3 |
| ash | 0 | 15→11.4 | 100% | 0.5 | 15.2/20.3 | 17% | 24.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | tar (territorial) | 1927.6 | 45 | 210 | — |
| 10 | normal | tar (score) | 1940.1 | 43 | 256 | — |
| 2 | normal | tar (territorial) | 1931.3 | 45 | 201 | — |
| 3 | normal | les (score) | 1940.1 | 27 | 176 | — |
| 4 | normal | mor (score) | 1940.1 | 55 | 357 | — |
| 5 | normal | mor (score) | 1940.1 | 47 | 269 | — |
| 6 | normal | mor (economic) | 1932.3 | 56 | 257 | — |
| 7 | normal | les (score) | 1940.1 | 53 | 219 | — |
| 8 | normal | mor (economic) | 1930.8 | 45 | 333 | — |
| 9 | normal | tar (territorial) | 1909.7 | 17 | 102 | — |
