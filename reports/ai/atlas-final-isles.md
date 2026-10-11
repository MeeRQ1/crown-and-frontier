# AI-only campaign report

Map: isles. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: ost 6, san 1, ago 1
Victory paths: economic 6, diplomatic 1, score 1
Average campaign length: 30.1 years; wars per campaign 5.4; average war 7.8 months; peace treaties 8.4; forced peaces 0.0; battles 32.
Coalitions formed per campaign: 1.4; coalition wars: 4.5.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 3.72 ms/tick average, 53 ms worst tick, heap ≈ 75 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 6.5% of all income on average (highest single realm 13.1%); check: at most 30%.
- Realms with a trade agreement: 100.0% of realm-months.
- Industry at the end: 64 of 64 surviving realms ran factories in their last month; factories 144 → 1822 (sum over runs).
- Average treasury at year 40: 4.48× monthly income; check: below 5×.
- Research: the average surviving realm finished 33.4% of the tree; 730 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.2%, cavalry 13.9%, artillery 18.0%, engineers 2.9%, armour 0.0%.
- Shortages (share of realm-months): coal 12.1%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 64 of 64 surviving coastal realms built ships; 50 of the 50 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): dun ×4, dre ×2, kal ×2, san ×2, ago ×1, est ×1, inv ×1, ost ×1.
- Air: 16 of 17 surviving realms past era III built wings and flew missions (not: san ×1); check: all.
- Totals per run: ships built 133.8, naval battle sides 60.3, landings 3.3, blockade weeks 409.9, fleet weeks at sea 8530.8, wings built 15.0, wing-weeks on missions 7280.4, bombing wing-weeks 1.9.
- Peace settlements per run: 4.6 (3 of 37 shared among several winners); demands won: cede 44, renounce 23, gold 18, reparations 9.
- Guarantees given per run 4.6 (25 of 64 realms gave one), honoured by joining a war 3 times; loans per run 0.0 (0 lenders, 0 crowns lent per run).
- Trade contracts: 414.4 signed per run (64 of 64 realms signed at least one); realms held one in 63.0% of realm-months, 0.71 contracts in force per realm-month; per run 403.5 ran their term, 0.0 ended in default, 2.0 were cancelled; 3132 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 5.9% of army-months at war (1.4% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 1 of 43 ended (2%); idle treasuries (over 10 months of income with a builder free) 0.0% of realm-months.
- Trade blocs: 64 of 64 realms were members (80.2% of realm-months); spheres: 23 realms led one, and realms spent 21.4% of realm-months in another's sphere.
- National focus: 30.9 focuses completed per surviving realm (19% national); 64 of 64 completed national focuses, 48 a claim, 63 their ambition. First generic focuses by branch: army 74, sea 39, industry 38, diplomacy 25, state 16. Doctrines: sea_raid 63, army_prof 55, ind_consumer 44, dip_concord 36, army_fortress 30, army_offensive 25, dip_real 18, ind_war 6, army_levy 4.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% ost, 56% san, 75% ost, 70% ost, 75% ost, 75% ost, 50% ost, 75% ost; economic 100%/83% ost, 84% ost, 100%/88% ost, 95% ost, 100%/92% ost, 100%/100% ost, 100%/93% ost, 100%/92% ost; diplomatic 100%/57% inv, 100%/93% san, 100%/50% san, 100%/77% san, 100%/17% san, 100%/27% san, 100%/30% ost, 100%/32% inv.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 6 | 15→22.9 | 100% | 1.6 | 10.1/3.5 | 4% | 24.9 |
| dun | 0 | 11→12.6 | 100% | 0.1 | 1.0/2.1 | 1% | 25.5 |
| est | 0 | 9→9.5 | 100% | 0.0 | 2.1/7.9 | 3% | 23.5 |
| dre | 0 | 9→10.3 | 100% | 0.1 | 1.1/3.9 | 2% | 22.5 |
| san | 1 | 13→15.8 | 100% | 0.0 | 2.1/0.3 | 35% | 25.4 |
| ago | 1 | 14→19.4 | 100% | 2.3 | 8.6/5.6 | 10% | 23.9 |
| kal | 0 | 12→14.8 | 100% | 1.0 | 4.3/1.8 | 1% | 25.6 |
| inv | 0 | 9→10.9 | 100% | 0.3 | 2.6/5.0 | 1% | 24.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | ost (economic) | 1917.8 | 6 | 45 | — |
| 2 | normal | san (diplomatic) | 1897.3 | 6 | 28 | — |
| 3 | normal | ost (economic) | 1905.6 | 7 | 32 | — |
| 4 | normal | ost (score) | 1935.1 | 0 | 0 | — |
| 5 | normal | ago (economic) | 1924.4 | 12 | 69 | — |
| 6 | normal | ost (economic) | 1916.0 | 5 | 38 | — |
| 7 | normal | ost (economic) | 1915.3 | 2 | 18 | — |
| 8 | normal | ost (economic) | 1909.4 | 5 | 26 | — |
