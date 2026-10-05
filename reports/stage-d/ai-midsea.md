# AI-only campaign report

Map: midsea. Runs: 3 (seeds 1–3, difficulties normal, 40-year limit). Node v22.22.2.

Winners: tve 2, dij 1
Victory paths: score 3
Average campaign length: 40.1 years; wars per campaign 25.3; average war 12.1 months; peace treaties 34.0; forced peaces 0.0; battles 280.
Coalitions formed per campaign: 2.7; coalition wars: 4.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 19.83 ms/tick average, 148 ms worst tick, heap ≈ 111 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.9% of all income on average (highest single realm 44.2%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 48 of 48 surviving realms ran factories in their last month; factories 126 → 2563 (sum over runs).
- Average treasury at year 40: 2.30× monthly income; check: below 5×.
- Research: the average surviving realm finished 22.9% of the tree; 659 technologies finished in all; at most 3 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.1%, cavalry 14.9%, artillery 17.5%, engineers 1.5%, armour 0.0%.
- Shortages (share of realm-months): coal 8.3%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 41 of 41 surviving coastal realms built ships; 29 of the 31 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: dij ×1, ago ×1); check: all. Never at war with a coastal realm while coastal (built only): bri ×2, kam ×2, str ×2, var ×2, bel ×1, car ×1.
- Air: 4 of 4 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 301.7, naval battle sides 143.0, landings 12.0, blockade weeks 1128.3, fleet weeks at sea 2752.7, wings built 30.7, wing-weeks on missions 7260.7, bombing wing-weeks 0.0.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 1 | 40→42.0 | 100% | 2.7 | 10.3/12.3 | 37% | 21.3 |
| cas | 0 | 37→47.0 | 100% | 5.3 | 46.7/41.7 | 8% | 16.7 |
| dor | 0 | 24→10.0 | 100% | 0.7 | 25.0/23.3 | 5% | 13.3 |
| bri | 0 | 28→36.3 | 100% | 0.0 | 0.0/0.0 | 33% | 18.0 |
| uus | 0 | 29→16.0 | 100% | 0.0 | 26.7/11.7 | 18% | 14.7 |
| str | 0 | 35→35.0 | 100% | 0.0 | 0.7/1.0 | 1% | 16.7 |
| tve | 2 | 39→57.0 | 100% | 5.0 | 31.0/31.3 | 6% | 16.0 |
| ago | 0 | 20→16.0 | 100% | 0.3 | 8.3/7.0 | 33% | 13.7 |
| wes | 0 | 29→17.0 | 100% | 0.0 | 17.3/9.0 | 5% | 17.3 |
| dre | 0 | 30→30.7 | 100% | 0.0 | 16.7/13.3 | 1% | 16.0 |
| bel | 0 | 35→30.3 | 100% | 0.0 | 15.7/3.0 | 1% | 16.3 |
| kul | 0 | 36→50.3 | 100% | 3.3 | 49.0/61.0 | 4% | 15.3 |
| brim | 0 | 33→52.7 | 100% | 7.7 | 24.3/52.7 | 23% | 19.3 |
| var | 0 | 30→37.0 | 100% | 0.0 | 0.0/0.0 | 33% | 18.7 |
| car | 0 | 28→28.0 | 100% | 0.0 | 3.7/0.3 | 65% | 16.7 |
| kam | 0 | 33→42.7 | 100% | 0.3 | 5.0/7.0 | 3% | 17.7 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | tve (score) | 1915.1 | 23 | 397 | — |
| 2 | normal | dij (score) | 1915.1 | 23 | 249 | — |
| 3 | normal | tve (score) | 1915.1 | 30 | 195 | — |
