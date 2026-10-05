# AI-only campaign report

Map: baltic. Runs: 4 (seeds 1–4, difficulties normal, 40-year limit). Node v22.22.2.

Winners: rus 3, dan 1
Victory paths: score 3, diplomatic 1
Average campaign length: 36.6 years; wars per campaign 6.8; average war 10.9 months; peace treaties 7.5; forced peaces 0.0; battles 79.
Coalitions formed per campaign: 0.0; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 9.82 ms/tick average, 134 ms worst tick, heap ≈ 52 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 2.6% of all income on average (highest single realm 8.1%); check: at most 30%.
- Realms with a trade agreement: 99.9% of realm-months.
- Industry at the end: 20 of 20 surviving realms ran factories in their last month; factories 44 → 1532 (sum over runs).
- Average treasury at year 40: 2.11× monthly income; check: below 5×.
- Research: the average surviving realm finished 54.6% of the tree; 177 technologies finished in all; at most 0 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.2%, cavalry 9.1%, artillery 15.9%, engineers 5.0%, armour 1.8%.
- Shortages (share of realm-months): coal 4.2%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 20 of 20 surviving coastal realms built ships; 14 of the 16 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: dan ×2); check: all. Never at war with a coastal realm while coastal (built only): nor ×4.
- Air: 18 of 19 surviving realms past era III built wings and flew missions (not: dan ×1); check: all.
- Totals per run: ships built 128.3, naval battle sides 24.0, landings 1.8, blockade weeks 211.8, fleet weeks at sea 2974.5, wings built 25.0, wing-weeks on missions 20830.0, bombing wing-weeks 184.5.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| swe | 0 | 48→46.5 | 100% | 0.0 | 5.0/13.5 | 2% | 40.3 |
| nor | 0 | 27→27.0 | 100% | 0.0 | 0.0/0.0 | 0% | 39.0 |
| dan | 1 | 12→12.5 | 100% | 0.0 | 0.0/0.0 | 100% | 37.3 |
| ger | 0 | 45→64.3 | 100% | 5.8 | 44.0/16.0 | 7% | 41.8 |
| rus | 3 | 101→82.8 | 100% | 1.0 | 29.5/49.0 | 8% | 41.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | rus (score) | 1946.1 | 7 | 61 | — |
| 2 | normal | dan (diplomatic) | 1932.3 | 5 | 103 | — |
| 3 | normal | rus (score) | 1946.1 | 7 | 78 | — |
| 4 | normal | rus (score) | 1946.1 | 8 | 72 | — |
