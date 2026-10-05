# AI-only campaign report

Map: isles. Runs: 16 (seeds 1–16, difficulties normal, 40-year limit). Node v22.22.2.

Winners: ost 11, san 3, ago 2
Victory paths: economic 4, diplomatic 3, score 9
Average campaign length: 33.0 years; wars per campaign 6.4; average war 7.5 months; peace treaties 9.2; forced peaces 0.0; battles 33.
Coalitions formed per campaign: 1.3; coalition wars: 0.6.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 12.02 ms/tick average, 160 ms worst tick, heap ≈ 44 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 8.3% of all income on average (highest single realm 23.3%); check: at most 30%.
- Realms with a trade agreement: 99.5% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 288 → 3755 (sum over runs).
- Average treasury at year 40: 3.99× monthly income; check: below 5×.
- Research: the average surviving realm finished 34.8% of the tree; 1588 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.4%, cavalry 13.7%, artillery 17.9%, engineers 3.0%, armour 0.0%.
- Shortages (share of realm-months): coal 14.6%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 126 of 128 surviving coastal realms built ships; 107 of the 109 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: san ×2, kal ×1); check: all. Never at war with a coastal realm while coastal (built only): dun ×8, dre ×4, est ×3, san ×2, ago ×1, kal ×1.
- Air: 80 of 87 surviving realms past era III built wings and flew missions (not: san ×7); check: all.
- Totals per run: ships built 141.3, naval battle sides 66.1, landings 4.3, blockade weeks 360.3, fleet weeks at sea 9296.7, wings built 22.8, wing-weeks on missions 10182.9, bombing wing-weeks 4.0.
- Peace settlements per run: 6.0 (13 of 96 shared among several winners); demands won: cede 108, gold 63, renounce 62, reparations 47.
- Guarantees given per run 3.3 (41 of 128 realms gave one), honoured by joining a war 1 times; loans per run 0.9 (11 lenders, 287 crowns lent per run).
- Trade blocs: 125 of 128 realms were members (80.5% of realm-months); spheres: 39 realms led one, and realms spent 11.5% of realm-months in another's sphere.
- National focus: 32.6 focuses completed per surviving realm (17% national); 128 of 128 completed national focuses, 92 a claim, 119 their ambition. First generic focuses by branch: army 138, sea 90, industry 72, diplomacy 55, state 29. Doctrines: sea_raid 107, army_prof 99, ind_consumer 82, army_fortress 70, dip_concord 68, army_offensive 49, dip_real 39, ind_war 22, army_levy 20, sea_battle 9.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% ost, 75% ost, 56% san, 75% ost, 75% ost, 75% ost, 75% ost, 75% ost, 50% ost, 70% ost, 75% ost, 86% ost, 75% ost, 75% ost, 56% san, 75% ost; economic 100%/83% ost, 85% ost, 90% ost, 84% ost, 97% ago, 94% ost, 87% ost, 100%/58% ost, 96% ost, 79% ost, 100%/90% ost, 100%/82% ost, 100%/87% ost, 98% ost, 79% ost, 96% ost; diplomatic 100%/90% san, 100%/90% san, 100%/92% san, 100%/60% san, 100%/62% san, 100%/97% san, 100%/70% san, 100%/68% san, 100%/70% san, 100%/95% san, 100%/68% san, 100%/73% san, 100%/67% san, 100%/55% san, 100%/85% san, 100%/52% san.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 11 | 15→22.7 | 100% | 2.9 | 10.3/4.1 | 0% | 25.8 |
| dun | 0 | 11→12.8 | 100% | 0.1 | 0.6/0.7 | 8% | 26.8 |
| est | 0 | 9→8.9 | 100% | 0.0 | 1.5/7.9 | 4% | 24.4 |
| dre | 0 | 9→10.4 | 100% | 0.1 | 2.2/4.1 | 2% | 23.6 |
| san | 3 | 13→15.8 | 100% | 0.0 | 1.8/0.8 | 46% | 26.2 |
| ago | 2 | 14→18.4 | 100% | 2.4 | 8.9/4.8 | 2% | 25.0 |
| kal | 0 | 12→15.2 | 100% | 0.6 | 4.8/4.9 | 1% | 26.7 |
| inv | 0 | 9→11.8 | 100% | 0.3 | 3.3/5.6 | 6% | 24.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ost (economic) | 1920.8 | 6 | 27 | — |
| 10 | normal | san (diplomatic) | 1895.5 | 6 | 24 | — |
| 11 | normal | ost (score) | 1925.1 | 7 | 29 | — |
| 12 | normal | ost (score) | 1925.1 | 4 | 20 | — |
| 13 | normal | ago (score) | 1925.1 | 7 | 34 | — |
| 14 | normal | ost (score) | 1925.1 | 6 | 19 | — |
| 15 | normal | ost (score) | 1925.1 | 6 | 46 | — |
| 16 | normal | ost (score) | 1925.1 | 9 | 57 | — |
| 2 | normal | ago (score) | 1925.1 | 6 | 21 | — |
| 3 | normal | san (diplomatic) | 1895.3 | 3 | 16 | — |
| 4 | normal | ost (economic) | 1917.5 | 7 | 37 | — |
| 5 | normal | ost (economic) | 1915.9 | 7 | 49 | — |
| 6 | normal | ost (economic) | 1921.7 | 9 | 74 | — |
| 7 | normal | ost (score) | 1925.1 | 11 | 37 | — |
| 8 | normal | san (diplomatic) | 1894.8 | 2 | 9 | — |
| 9 | normal | ost (score) | 1925.1 | 6 | 35 | — |
