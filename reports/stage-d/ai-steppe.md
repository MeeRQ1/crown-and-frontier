# AI-only campaign report

Map: steppe. Runs: 3 (seeds 1–3, difficulties normal, 40-year limit). Node v22.22.2.

Winners: ast 1, dor 1, ots 1
Victory paths: economic 1, score 2
Average campaign length: 36.6 years; wars per campaign 26.0; average war 10.1 months; peace treaties 43.2; forced peaces 0.0; battles 165.
Coalitions formed per campaign: 3.7; coalition wars: 3.7.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 15.47 ms/tick average, 143 ms worst tick, heap ≈ 58 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 6.3% of all income on average (highest single realm 21.6%); check: at most 30%.
- Realms with a trade agreement: 99.0% of realm-months.
- Industry at the end: 33 of 33 surviving realms ran factories in their last month; factories 78 → 1283 (sum over runs).
- Average treasury at year 40: 3.15× monthly income; check: below 5×.
- Research: the average surviving realm finished 25.7% of the tree; 387 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 64.5%, cavalry 15.9%, artillery 17.4%, engineers 2.1%, armour 0.0%.
- Shortages (share of realm-months): coal 3.3%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 25 of 25 surviving coastal realms built ships; 24 of the 24 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): kyz ×1.
- Air: 9 of 9 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 230.7, naval battle sides 232.3, landings 15.3, blockade weeks 1065.7, fleet weeks at sea 5360.3, wings built 27.7, wing-weeks on missions 7480.3, bombing wing-weeks 0.0.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| vol | 0 | 14→16.0 | 100% | 0.0 | 5.7/4.3 | 11% | 17.0 |
| san | 0 | 23→28.0 | 100% | 0.0 | 8.3/13.7 | 6% | 20.3 |
| ast | 1 | 31→39.7 | 100% | 9.0 | 46.3/37.7 | 12% | 20.0 |
| ots | 1 | 19→24.7 | 100% | 1.0 | 8.0/19.0 | 12% | 18.7 |
| kyz | 0 | 19→23.7 | 100% | 2.7 | 8.0/1.3 | 0% | 18.7 |
| gor | 0 | 22→23.7 | 100% | 0.0 | 8.0/10.0 | 0% | 19.0 |
| tor | 0 | 22→11.7 | 100% | 0.0 | 14.0/25.7 | 16% | 17.3 |
| pel | 0 | 28→23.7 | 100% | 5.3 | 28.3/20.3 | 25% | 18.7 |
| pih | 0 | 16→18.7 | 100% | 2.0 | 3.3/13.3 | 8% | 17.0 |
| dor | 1 | 20→29.0 | 100% | 6.0 | 31.0/15.3 | 1% | 19.7 |
| volo | 0 | 26→24.3 | 100% | 0.0 | 4.3/3.0 | 0% | 19.7 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ast (economic) | 1909.8 | 30 | 182 | — |
| 2 | normal | dor (score) | 1920.1 | 26 | 138 | — |
| 3 | normal | ots (score) | 1920.1 | 22 | 176 | — |
