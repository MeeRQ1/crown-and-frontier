# AI-only campaign report

Map: baltic. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: swe 1, rus 7
Victory paths: diplomatic 1, score 7
Average campaign length: 46.9 years; wars per campaign 8.9; average war 8.9 months; peace treaties 11.6; forced peaces 0.0; battles 92.
Coalitions formed per campaign: 0.0; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 6.28 ms/tick average, 90 ms worst tick, heap ≈ 61 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 1.1% of all income on average (highest single realm 10.0%); check: at most 30%.
- Realms with a trade agreement: 99.7% of realm-months.
- Industry at the end: 40 of 40 surviving realms ran factories in their last month; factories 88 → 4140 (sum over runs).
- Average treasury at year 40: 2.06× monthly income; check: below 5×.
- Research: the average surviving realm finished 63.9% of the tree; 627 technologies finished in all; at most 0 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 66.9%, cavalry 9.1%, artillery 16.1%, engineers 5.1%, armour 2.8%.
- Shortages (share of realm-months): coal 23.7%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 40 of 40 surviving coastal realms built ships; 31 of the 38 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: nor ×6, dan ×1); check: all. Never at war with a coastal realm while coastal (built only): nor ×2.
- Air: 40 of 40 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 294.1, naval battle sides 100.9, landings 1.9, blockade weeks 295.1, fleet weeks at sea 5731.8, wings built 40.1, wing-weeks on missions 34578.1, bombing wing-weeks 385.5.
- Peace settlements per run: 8.5 (11 of 68 shared among several winners); demands won: cede 118, renounce 33, gold 32, reparations 14, disarm 1.
- Guarantees given per run 3.3 (19 of 40 realms gave one), honoured by joining a war 0 times; loans per run 1.1 (6 lenders, 482 crowns lent per run).
- Trade contracts: 450.6 signed per run (40 of 40 realms signed at least one); realms held one in 77.9% of realm-months, 0.82 contracts in force per realm-month; per run 440.8 ran their term, 0.0 ended in default, 1.6 were cancelled; 4840 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 3.6% of army-months at war (2.9% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 0 of 71 ended (0%); idle treasuries (over 10 months of income with a builder free) 2.3% of realm-months.
- Trade blocs: 40 of 40 realms were members (89.5% of realm-months); spheres: 23 realms led one, and realms spent 14.6% of realm-months in another's sphere.
- National focus: 36.8 focuses completed per surviving realm (16% national); 40 of 40 completed national focuses, 40 a claim, 40 their ambition. First generic focuses by branch: army 48, industry 27, diplomacy 25, sea 14, state 6. Doctrines: army_prof 35, sea_raid 35, ind_consumer 29, dip_concord 24, army_fortress 22, army_offensive 16, dip_real 15, ind_war 7, sea_battle 4, army_levy 3.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% rus, 75% rus, 78% rus, 75% rus, 75% rus, 75% rus, 75% rus, 79% rus; economic 95% rus, 96% rus, 97% rus, 93% rus, 93% rus, 95% rus, 94% rus, 98% rus; diplomatic 100%/100% swe, 100%/52% swe, 100%/22% dan, 100%/37% swe, 100%/42% swe, 100%/18% swe, 100%/38% swe, 100%/18% swe.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| swe | 1 | 48→47.6 | 100% | 0.0 | 12.4/10.4 | 5% | 49.1 |
| nor | 0 | 27→27.0 | 100% | 0.0 | 3.1/0.8 | 4% | 44.9 |
| dan | 0 | 12→8.5 | 100% | 0.0 | 6.3/6.5 | 4% | 40.5 |
| ger | 0 | 45→54.8 | 100% | 5.5 | 40.4/17.8 | 2% | 48.9 |
| rus | 7 | 101→95.1 | 100% | 3.4 | 29.6/52.3 | 4% | 50.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | swe (diplomatic) | 1931.0 | 3 | 134 | — |
| 2 | normal | rus (score) | 1956.1 | 6 | 56 | — |
| 3 | normal | rus (score) | 1956.1 | 8 | 70 | — |
| 4 | normal | rus (score) | 1956.1 | 13 | 123 | — |
| 5 | normal | rus (score) | 1956.1 | 6 | 36 | — |
| 6 | normal | rus (score) | 1956.1 | 13 | 84 | — |
| 7 | normal | rus (score) | 1956.1 | 7 | 69 | — |
| 8 | normal | rus (score) | 1956.1 | 15 | 162 | — |
