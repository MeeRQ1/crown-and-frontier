# AI-only campaign report

Map: midsea. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: tve 6, brim 2
Victory paths: score 8
Average campaign length: 50.1 years; wars per campaign 14.8; average war 11.3 months; peace treaties 18.4; forced peaces 0.0; battles 142.
Coalitions formed per campaign: 0.4; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 15.13 ms/tick average, 104 ms worst tick, heap ≈ 73 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 4.8% of all income on average (highest single realm 15.9%); check: at most 30%.
- Realms with a trade agreement: 99.9% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 336 → 10535 (sum over runs).
- Average treasury at year 40: 2.59× monthly income; check: below 5×.
- Research: the average surviving realm finished 35.9% of the tree; 2966 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.2%, cavalry 12.6%, artillery 17.7%, engineers 1.4%, armour 0.0%.
- Shortages (share of realm-months): coal 10.6%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 105 of 105 surviving coastal realms built ships; 71 of the 72 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: str ×1); check: all. Never at war with a coastal realm while coastal (built only): kam ×8, bri ×7, str ×7, bel ×3, var ×3, car ×2, wes ×2, ago ×1.
- Air: 127 of 127 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 436.1, naval battle sides 124.6, landings 6.1, blockade weeks 736.3, fleet weeks at sea 9361.1, wings built 104.6, wing-weeks on missions 41571.4, bombing wing-weeks 41.4.
- Peace settlements per run: 13.5 (8 of 108 shared among several winners); demands won: cede 150, renounce 63, reparations 42, gold 39, disarm 5.
- Guarantees given per run 6.5 (41 of 128 realms gave one), honoured by joining a war 3 times; loans per run 1.0 (8 lenders, 678 crowns lent per run).
- Trade contracts: 1463.3 signed per run (128 of 128 realms signed at least one); realms held one in 56.7% of realm-months, 0.77 contracts in force per realm-month; per run 1448.9 ran their term, 0.0 ended in default, 0.0 were cancelled; 14817 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 2.6% of army-months at war (1.0% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 4 of 118 ended (3%); idle treasuries (over 10 months of income with a builder free) 0.7% of realm-months.
- Trade blocs: 128 of 128 realms were members (93.3% of realm-months); spheres: 55 realms led one, and realms spent 7.4% of realm-months in another's sphere.
- National focus: 37.3 focuses completed per surviving realm (16% national); 128 of 128 completed national focuses, 128 a claim, 128 their ambition. First generic focuses by branch: army 138, diplomacy 105, industry 76, state 43, sea 22. Doctrines: army_prof 119, ind_consumer 110, sea_raid 99, dip_concord 80, army_fortress 79, army_offensive 49, dip_real 48, ind_war 18, army_levy 9, sea_battle 6.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 54% tve, 49% tve, 51% tve, 52% tve, 55% tve, 52% tve, 55% tve, 52% tve; economic 85% tve, 99% brim, 92% brim, 84% tve, 87% tve, 86% dij, 89% tve, 82% dij; diplomatic 77% bel, 69% brim, 100%/25% kam, 100%/7% dij, 85% bel, 100%/8% dij, 100%/8% brim, 100%/5% bel.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 0 | 40→35.8 | 100% | 1.5 | 12.6/13.1 | 4% | 29.5 |
| cas | 0 | 37→36.9 | 100% | 1.8 | 27.4/19.4 | 1% | 24.9 |
| dor | 0 | 24→21.9 | 100% | 0.3 | 5.3/9.3 | 5% | 21.0 |
| bri | 0 | 28→35.3 | 100% | 0.0 | 0.5/0.5 | 0% | 26.6 |
| uus | 0 | 29→28.1 | 100% | 0.0 | 7.9/3.4 | 3% | 25.8 |
| str | 0 | 35→34.8 | 100% | 0.0 | 2.6/2.6 | 0% | 24.3 |
| tve | 6 | 39→45.4 | 100% | 3.3 | 15.0/10.0 | 3% | 28.6 |
| ago | 0 | 20→18.5 | 100% | 0.8 | 3.5/9.5 | 4% | 20.4 |
| wes | 0 | 29→28.9 | 100% | 0.0 | 6.9/7.3 | 24% | 28.1 |
| dre | 0 | 30→30.6 | 100% | 0.3 | 2.5/2.3 | 1% | 27.3 |
| bel | 0 | 35→35.3 | 100% | 0.1 | 3.5/2.0 | 2% | 26.1 |
| kul | 0 | 36→43.3 | 100% | 1.3 | 25.3/28.0 | 0% | 24.3 |
| brim | 2 | 33→45.6 | 100% | 4.8 | 23.4/26.9 | 2% | 28.6 |
| var | 0 | 30→36.4 | 100% | 0.3 | 1.5/1.6 | 1% | 28.1 |
| car | 0 | 28→29.0 | 100% | 0.6 | 4.0/4.6 | 0% | 28.0 |
| kam | 0 | 33→42.5 | 100% | 0.0 | 0.0/0.0 | 0% | 27.3 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | tve (score) | 1925.1 | 9 | 115 | — |
| 2 | normal | brim (score) | 1925.1 | 28 | 219 | — |
| 3 | normal | brim (score) | 1925.1 | 19 | 140 | — |
| 4 | normal | tve (score) | 1925.1 | 15 | 143 | — |
| 5 | normal | tve (score) | 1925.1 | 7 | 39 | — |
| 6 | normal | tve (score) | 1925.1 | 12 | 138 | — |
| 7 | normal | tve (score) | 1925.1 | 13 | 208 | — |
| 8 | normal | tve (score) | 1925.1 | 15 | 132 | — |
