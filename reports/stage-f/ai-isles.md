# AI-only campaign report

Map: isles. Runs: 16 (seeds 1–16, difficulties normal, 40-year limit). Node v22.22.2.

Winners: san 4, ost 9, ago 3
Victory paths: diplomatic 4, economic 10, score 2
Average campaign length: 27.4 years; wars per campaign 5.5; average war 7.4 months; peace treaties 8.6; forced peaces 0.0; battles 26.
Coalitions formed per campaign: 1.8; coalition wars: 3.7.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 7.65 ms/tick average, 104 ms worst tick, heap ≈ 49 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 7.6% of all income on average (highest single realm 29.4%); check: at most 30%.
- Realms with a trade agreement: 99.4% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 288 → 3550 (sum over runs).
- Average treasury at year 40: 4.03× monthly income; check: below 5×.
- Research: the average surviving realm finished 31.8% of the tree; 1309 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.8%, cavalry 13.6%, artillery 17.9%, engineers 2.7%, armour 0.0%.
- Shortages (share of realm-months): coal 10.8%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 125 of 128 surviving coastal realms built ships; 99 of the 102 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: san ×3, kal ×1); check: all. Never at war with a coastal realm while coastal (built only): dun ×6, est ×5, dre ×4, san ×4, ago ×3, kal ×3, inv ×1.
- Air: 40 of 43 surviving realms past era III built wings and flew missions (not: san ×3); check: all.
- Totals per run: ships built 136.7, naval battle sides 55.0, landings 3.3, blockade weeks 357.7, fleet weeks at sea 7842.2, wings built 16.4, wing-weeks on missions 5710.3, bombing wing-weeks 19.8.
- Peace settlements per run: 5.2 (13 of 83 shared among several winners); demands won: cede 103, gold 64, renounce 49, reparations 36.
- Guarantees given per run 4.1 (46 of 128 realms gave one), honoured by joining a war 1 times; loans per run 0.7 (9 lenders, 186 crowns lent per run).
- Trade blocs: 124 of 128 realms were members (75.9% of realm-months); spheres: 44 realms led one, and realms spent 14.4% of realm-months in another's sphere.
- National focus: 29.1 focuses completed per surviving realm (19% national); 128 of 128 completed national focuses, 92 a claim, 119 their ambition. First generic focuses by branch: army 139, sea 94, industry 70, diplomacy 53, state 28. Doctrines: sea_raid 109, army_prof 105, ind_consumer 74, dip_concord 64, army_fortress 57, army_offensive 52, dip_real 33, ind_war 16, army_levy 8, sea_battle 5.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% ost, 75% ost, 50% ost, 75% ost, 75% ost, 73% ost, 75% ost, 75% ost, 50% ost, 70% ost, 75% ost, 86% ost, 75% ost, 75% ost, 56% san, 75% ost; economic 90% ost, 100%/88% ost, 100%/95% ost, 100%/93% ost, 100%/88% ost, 91% ost, 100%/68% ost, 97% ost, 100%/92% ago, 100%/2% ago, 100%/83% ost, 100%/82% ost, 100%/98% ost, 100%/88% ost, 85% ost, 100%/97% ost; diplomatic 100%/90% san, 100%/82% san, 100%/62% san, 100%/87% san, 100%/62% san, 100%/83% san, 100%/53% san, 100%/90% san, 100%/70% san, 100%/93% san, 100%/53% san, 100%/78% san, 100%/80% san, 100%/55% san, 100%/85% san, 100%/90% san.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 9 | 15→23.1 | 100% | 2.5 | 10.3/4.0 | 4% | 23.8 |
| dun | 0 | 11→12.8 | 100% | 0.1 | 0.4/1.3 | 16% | 24.3 |
| est | 0 | 9→9.8 | 100% | 0.0 | 1.1/4.9 | 6% | 22.6 |
| dre | 0 | 9→10.2 | 100% | 0.1 | 0.9/3.3 | 4% | 21.8 |
| san | 4 | 13→15.6 | 100% | 0.0 | 1.3/0.5 | 44% | 23.9 |
| ago | 3 | 14→18.8 | 100% | 2.1 | 6.3/2.6 | 6% | 22.6 |
| kal | 0 | 12→14.7 | 100% | 0.4 | 3.8/4.8 | 3% | 24.5 |
| inv | 0 | 9→11.1 | 100% | 0.3 | 2.1/4.3 | 4% | 22.5 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | san (diplomatic) | 1895.5 | 3 | 14 | — |
| 10 | normal | ost (economic) | 1913.6 | 8 | 20 | — |
| 11 | normal | ost (economic) | 1919.3 | 4 | 17 | — |
| 12 | normal | ago (economic) | 1924.3 | 4 | 39 | — |
| 13 | normal | ost (economic) | 1910.6 | 4 | 9 | — |
| 14 | normal | san (diplomatic) | 1897.8 | 3 | 8 | — |
| 15 | normal | ost (score) | 1925.1 | 8 | 50 | — |
| 16 | normal | san (diplomatic) | 1895.5 | 3 | 10 | — |
| 2 | normal | ost (economic) | 1921.4 | 6 | 21 | — |
| 3 | normal | ago (score) | 1925.1 | 6 | 27 | — |
| 4 | normal | ost (economic) | 1916.8 | 8 | 51 | — |
| 5 | normal | ost (economic) | 1907.9 | 3 | 19 | — |
| 6 | normal | ost (economic) | 1914.1 | 8 | 38 | — |
| 7 | normal | ago (economic) | 1922.6 | 12 | 51 | — |
| 8 | normal | san (diplomatic) | 1894.8 | 2 | 9 | — |
| 9 | normal | ost (economic) | 1914.2 | 6 | 38 | — |
