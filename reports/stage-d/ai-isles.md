# AI-only campaign report

Map: isles. Runs: 3 (seeds 1–3, difficulties normal, 40-year limit). Node v22.22.2.

Winners: ost 2, ago 1
Victory paths: score 3
Average campaign length: 40.1 years; wars per campaign 14.7; average war 8.5 months; peace treaties 21.3; forced peaces 0.0; battles 79.
Coalitions formed per campaign: 0.3; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 10.37 ms/tick average, 112 ms worst tick, heap ≈ 45 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 10.0% of all income on average (highest single realm 23.8%); check: at most 30%.
- Realms with a trade agreement: 99.4% of realm-months.
- Industry at the end: 24 of 24 surviving realms ran factories in their last month; factories 54 → 520 (sum over runs).
- Average treasury at year 40: 2.85× monthly income; check: below 5×.
- Research: the average surviving realm finished 34.1% of the tree; 286 technologies finished in all; at most 3 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.2%, cavalry 13.6%, artillery 17.0%, engineers 3.2%, armour 0.0%.
- Shortages (share of realm-months): coal 6.0%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 24 of 24 surviving coastal realms built ships; 23 of the 23 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): san ×1.
- Air: 20 of 20 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 141.0, naval battle sides 121.0, landings 6.7, blockade weeks 1072.3, fleet weeks at sea 11501.3, wings built 28.0, wing-weeks on missions 11585.3, bombing wing-weeks 0.0.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 2 | 15→25.3 | 100% | 5.3 | 25.3/6.0 | 2% | 25.0 |
| dun | 0 | 11→12.7 | 100% | 0.0 | 3.0/2.3 | 15% | 26.0 |
| est | 0 | 9→4.3 | 100% | 0.0 | 7.3/19.7 | 5% | 24.0 |
| dre | 0 | 9→10.7 | 100% | 2.3 | 7.3/7.7 | 1% | 24.0 |
| san | 0 | 13→14.7 | 100% | 0.0 | 1.3/0.0 | 33% | 26.0 |
| ago | 1 | 14→23.7 | 100% | 7.0 | 21.0/10.0 | 4% | 24.7 |
| kal | 0 | 12→15.7 | 100% | 0.0 | 7.0/9.0 | 1% | 26.0 |
| inv | 0 | 9→9.0 | 100% | 0.0 | 6.7/21.3 | 2% | 23.7 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ost (score) | 1925.1 | 13 | 83 | — |
| 2 | normal | ost (score) | 1925.1 | 19 | 90 | — |
| 3 | normal | ago (score) | 1925.1 | 12 | 64 | — |
