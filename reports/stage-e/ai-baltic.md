# AI-only campaign report

Map: baltic. Runs: 16 (seeds 1–16, difficulties normal, 40-year limit). Node v22.22.2.

Winners: dan 5, rus 6, swe 5
Victory paths: diplomatic 10, score 6
Average campaign length: 27.5 years; wars per campaign 4.6; average war 13.8 months; peace treaties 7.4; forced peaces 0.0; battles 33.
Coalitions formed per campaign: 0.0; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 18.22 ms/tick average, 286 ms worst tick, heap ≈ 52 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 2.8% of all income on average (highest single realm 63.2%); check: at most 30%.
- Realms with a trade agreement: 98.9% of realm-months.
- Industry at the end: 80 of 80 surviving realms ran factories in their last month; factories 176 → 7046 (sum over runs).
- Average treasury at year 40: 2.15× monthly income; check: below 5×.
- Research: the average surviving realm finished 53.6% of the tree; 650 technologies finished in all; at most 0 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.0%, cavalry 9.3%, artillery 16.0%, engineers 5.0%, armour 1.7%.
- Shortages (share of realm-months): coal 8.3%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 80 of 80 surviving coastal realms built ships; 58 of the 66 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: nor ×7, dan ×1); check: all. Never at war with a coastal realm while coastal (built only): nor ×8, ger ×6.
- Air: 58 of 58 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 205.4, naval battle sides 88.7, landings 2.5, blockade weeks 237.9, fleet weeks at sea 2745.3, wings built 27.7, wing-weeks on missions 16651.5, bombing wing-weeks 87.8.
- Peace settlements per run: 4.3 (21 of 68 shared among several winners); demands won: cede 76, gold 47, renounce 25, reparations 16.
- Guarantees given per run 2.4 (34 of 80 realms gave one), honoured by joining a war 0 times; loans per run 3.0 (14 lenders, 1161 crowns lent per run).
- Trade blocs: 78 of 80 realms were members (83.1% of realm-months); spheres: 42 realms led one, and realms spent 20.1% of realm-months in another's sphere.
- National focus: 28.6 focuses completed per surviving realm (19% national); 80 of 80 completed national focuses, 71 a claim, 67 their ambition. First generic focuses by branch: army 86, industry 64, diplomacy 48, sea 25, state 17. Doctrines: sea_raid 62, army_prof 60, dip_concord 39, ind_consumer 35, army_offensive 32, army_fortress 28, dip_real 19, ind_war 9, army_levy 5, sea_battle 2.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 76% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus, 76% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus, 75% rus; economic 98% rus, 92% rus, 96% rus, 94% rus, 94% rus, 94% rus, 94% rus, 93% rus, 94% rus, 95% rus, 94% rus, 94% rus, 97% rus, 94% rus, 94% rus, 93% rus; diplomatic 100%/83% swe, 100%/88% swe, 100%/52% swe, 100%/82% swe, 100%/90% swe, 100%/95% swe, 100%/65% swe, 100%/88% swe, 100%/82% swe, 100%/97% swe, 100%/83% swe, 100%/97% swe, 100%/78% swe, 100%/55% swe, 100%/92% ger, 100%/75% swe.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| swe | 5 | 48→48.4 | 100% | 0.1 | 10.2/10.6 | 11% | 40.4 |
| nor | 0 | 27→26.9 | 100% | 0.0 | 0.8/0.6 | 16% | 38.1 |
| dan | 5 | 12→11.1 | 100% | 0.0 | 1.5/1.8 | 74% | 36.2 |
| ger | 0 | 45→48.1 | 100% | 1.3 | 9.2/2.8 | 2% | 39.9 |
| rus | 6 | 101→98.6 | 100% | 3.2 | 11.6/16.6 | 18% | 41.1 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | dan (diplomatic) | 1931.8 | 3 | 34 | — |
| 10 | normal | dan (diplomatic) | 1932.6 | 5 | 15 | — |
| 11 | normal | rus (score) | 1946.1 | 12 | 74 | — |
| 12 | normal | rus (score) | 1946.1 | 5 | 35 | — |
| 13 | normal | swe (diplomatic) | 1916.5 | 2 | 24 | — |
| 14 | normal | swe (diplomatic) | 1922.3 | 3 | 11 | — |
| 15 | normal | rus (score) | 1946.1 | 4 | 41 | — |
| 16 | normal | dan (diplomatic) | 1933.6 | 5 | 54 | — |
| 2 | normal | swe (diplomatic) | 1918.9 | 2 | 4 | — |
| 3 | normal | swe (diplomatic) | 1917.2 | 2 | 11 | — |
| 4 | normal | dan (diplomatic) | 1935.8 | 4 | 15 | — |
| 5 | normal | swe (diplomatic) | 1917.2 | 2 | 18 | — |
| 6 | normal | rus (score) | 1946.1 | 9 | 56 | — |
| 7 | normal | rus (score) | 1946.1 | 6 | 48 | — |
| 8 | normal | dan (diplomatic) | 1934.4 | 4 | 68 | — |
| 9 | normal | rus (score) | 1946.1 | 6 | 25 | — |
