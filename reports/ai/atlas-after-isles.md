# AI-only campaign report

Map: isles. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: ago 4, ost 3, san 1
Victory paths: diplomatic 2, score 2, economic 4
Average campaign length: 35.5 years; wars per campaign 6.5; average war 9.1 months; peace treaties 9.9; forced peaces 0.0; battles 37.
Coalitions formed per campaign: 1.4; coalition wars: 4.8.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 8.65 ms/tick average, 97 ms worst tick, heap ≈ 50 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.8% of all income on average (highest single realm 19.1%); check: at most 30%.
- Realms with a trade agreement: 100.0% of realm-months.
- Industry at the end: 64 of 64 surviving realms ran factories in their last month; factories 144 → 1994 (sum over runs).
- Average treasury at year 40: 4.35× monthly income; check: below 5×.
- Research: the average surviving realm finished 36.5% of the tree; 871 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.8%, cavalry 13.1%, artillery 18.1%, engineers 2.9%, armour 0.0%.
- Shortages (share of realm-months): coal 13.6%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 63 of 64 surviving coastal realms built ships; 51 of the 51 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): dun ×4, dre ×3, inv ×2, kal ×2, ost ×1, san ×1.
- Air: 25 of 29 surviving realms past era III built wings and flew missions (not: san ×4); check: all.
- Totals per run: ships built 143.9, naval battle sides 65.9, landings 3.8, blockade weeks 559.1, fleet weeks at sea 10099.0, wings built 22.0, wing-weeks on missions 11730.6, bombing wing-weeks 0.0.
- Peace settlements per run: 6.0 (7 of 48 shared among several winners); demands won: cede 64, gold 39, renounce 33, reparations 21, disarm 1.
- Guarantees given per run 5.0 (27 of 64 realms gave one), honoured by joining a war 2 times; loans per run 0.4 (3 lenders, 155 crowns lent per run).
- Trade contracts: 502.4 signed per run (64 of 64 realms signed at least one); realms held one in 65.4% of realm-months, 0.73 contracts in force per realm-month; per run 476.4 ran their term, 0.1 ended in default, 12.4 were cancelled; 4008 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 8.0% of army-months at war (1.0% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 2 of 52 ended (4%); idle treasuries (over 10 months of income with a builder free) 0.3% of realm-months.
- Trade blocs: 64 of 64 realms were members (83.9% of realm-months); spheres: 24 realms led one, and realms spent 9.9% of realm-months in another's sphere.
- National focus: 33.0 focuses completed per surviving realm (17% national); 64 of 64 completed national focuses, 46 a claim, 62 their ambition. First generic focuses by branch: army 81, sea 39, industry 34, diplomacy 26, state 12. Doctrines: sea_raid 59, army_prof 56, ind_consumer 47, army_fortress 36, dip_concord 36, army_offensive 24, dip_real 21, ind_war 8, army_levy 5, sea_battle 2.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% ost, 56% san, 75% ost, 75% ost, 75% ost, 70% ost, 50% ost, 75% ost; economic 100%/78% ost, 93% ago, 100%/88% ost, 100%/100% ost, 100%/85% ago, 98% ost, 91% ost, 100%/85% ost; diplomatic 100%/95% san, 100%/70% san, 100%/88% san, 100%/73% san, 100%/55% san, 100%/68% san, 100%/92% san, 100%/28% san.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 3 | 15→21.8 | 100% | 1.3 | 8.8/4.9 | 3% | 27.5 |
| dun | 0 | 11→12.6 | 100% | 0.0 | 1.4/2.6 | 3% | 27.6 |
| est | 0 | 9→6.9 | 100% | 0.0 | 3.0/11.8 | 3% | 24.8 |
| dre | 0 | 9→10.4 | 100% | 0.1 | 1.3/4.0 | 2% | 25.0 |
| san | 1 | 13→15.8 | 100% | 0.0 | 1.8/0.0 | 56% | 27.4 |
| ago | 4 | 14→20.9 | 100% | 3.8 | 12.5/3.9 | 7% | 26.9 |
| kal | 0 | 12→15.8 | 100% | 1.3 | 5.9/0.8 | 0% | 27.8 |
| inv | 0 | 9→12.0 | 100% | 0.1 | 2.4/4.4 | 0% | 26.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ago (diplomatic) | 1934.3 | 9 | 88 | — |
| 2 | normal | ago (score) | 1935.1 | 3 | 7 | — |
| 3 | normal | ost (economic) | 1915.6 | 9 | 45 | — |
| 4 | normal | ago (economic) | 1920.0 | 9 | 55 | — |
| 5 | normal | ago (economic) | 1916.8 | 8 | 35 | — |
| 6 | normal | ost (score) | 1935.1 | 5 | 29 | — |
| 7 | normal | san (diplomatic) | 1895.4 | 2 | 16 | — |
| 8 | normal | ost (economic) | 1911.8 | 7 | 20 | — |
