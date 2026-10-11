# AI-only campaign report

Map: midsea. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: tve 6, brim 1, var 1
Victory paths: score 7, diplomatic 1
Average campaign length: 50.0 years; wars per campaign 12.9; average war 11.0 months; peace treaties 24.7; forced peaces 0.0; battles 100.
Coalitions formed per campaign: 6.9; coalition wars: 16.3.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 23.62 ms/tick average, 248 ms worst tick, heap ≈ 126 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.6% of all income on average (highest single realm 15.7%); check: at most 30%.
- Realms with a trade agreement: 99.2% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 336 → 10634 (sum over runs).
- Average treasury at year 40: 2.74× monthly income; check: below 5×.
- Research: the average surviving realm finished 35.2% of the tree; 2907 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.1%, cavalry 12.6%, artillery 17.7%, engineers 1.5%, armour 0.0%.
- Shortages (share of realm-months): coal 9.9%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 104 of 104 surviving coastal realms built ships; 71 of the 76 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: str ×2, bel ×2, wes ×1); check: all. Never at war with a coastal realm while coastal (built only): kam ×5, bri ×4, str ×4, var ×4, wes ×4, bel ×2, car ×2, ago ×1, dij ×1, dor ×1.
- Air: 127 of 128 surviving realms past era III built wings and flew missions (not: dor ×1); check: all.
- Totals per run: ships built 496.6, naval battle sides 149.5, landings 11.4, blockade weeks 778.9, fleet weeks at sea 6897.1, wings built 104.9, wing-weeks on missions 41496.9, bombing wing-weeks 31.5.
- Peace settlements per run: 11.5 (11 of 92 shared among several winners); demands won: cede 143, renounce 55, gold 52, reparations 22, sphere 2, disarm 2.
- Guarantees given per run 4.4 (32 of 128 realms gave one), honoured by joining a war 3 times; loans per run 2.9 (16 lenders, 1869 crowns lent per run).
- Trade contracts: 0.0 signed per run (0 of 128 realms signed at least one); realms held one in 0.0% of realm-months, 0.00 contracts in force per realm-month; per run 0.0 ran their term, 0.0 ended in default, 0.0 were cancelled; 0 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 40.0% of army-months at war; pointless wars (no land and no demand changed hands) 4 of 103 ended (4%); idle treasuries (over 10 months of income with a builder free) 0.7% of realm-months.
- Trade blocs: 128 of 128 realms were members (93.2% of realm-months); spheres: 61 realms led one, and realms spent 5.7% of realm-months in another's sphere.
- National focus: 37.3 focuses completed per surviving realm (16% national); 128 of 128 completed national focuses, 128 a claim, 128 their ambition. First generic focuses by branch: army 134, diplomacy 101, industry 85, state 44, sea 20. Doctrines: army_prof 111, ind_consumer 102, sea_raid 101, dip_concord 79, army_fortress 77, army_offensive 51, dip_real 49, ind_war 26, army_levy 17, sea_battle 3.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 55% tve, 58% tve, 51% tve, 52% tve, 55% tve, 55% tve, 54% tve, 62% tve; economic 87% tve, 92% brim, 85% kam, 84% tve, 85% tve, 91% tve, 86% tve, 97% tve; diplomatic 100%/75% wes, 100%/78% wes, 100%/65% wes, 100%/92% wes, 100%/83% wes, 100%/72% wes, 100%/97% bri, 100%/57% dij.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 0 | 40→36.0 | 100% | 1.0 | 6.3/8.6 | 33% | 29.9 |
| cas | 0 | 37→35.9 | 100% | 1.5 | 15.4/13.6 | 19% | 24.1 |
| dor | 0 | 24→19.9 | 100% | 0.3 | 6.3/12.1 | 19% | 20.9 |
| bri | 0 | 28→35.8 | 100% | 0.0 | 7.9/2.5 | 18% | 26.3 |
| uus | 0 | 29→28.4 | 100% | 0.0 | 9.4/6.1 | 14% | 24.4 |
| str | 0 | 35→35.0 | 100% | 0.0 | 0.0/0.0 | 50% | 23.8 |
| tve | 6 | 39→48.8 | 100% | 3.9 | 17.9/11.0 | 8% | 28.3 |
| ago | 0 | 20→19.0 | 100% | 1.6 | 2.3/7.0 | 37% | 19.9 |
| wes | 0 | 29→28.4 | 100% | 0.0 | 4.3/4.1 | 34% | 27.0 |
| dre | 0 | 30→30.9 | 100% | 0.0 | 1.9/1.6 | 17% | 27.0 |
| bel | 0 | 35→35.3 | 100% | 0.1 | 1.8/0.5 | 52% | 25.4 |
| kul | 0 | 36→45.4 | 100% | 1.0 | 13.1/17.3 | 22% | 24.5 |
| brim | 1 | 33→44.0 | 100% | 2.8 | 7.3/7.4 | 35% | 28.3 |
| var | 1 | 30→33.6 | 100% | 0.0 | 1.8/1.4 | 0% | 26.8 |
| car | 0 | 28→29.1 | 100% | 0.5 | 2.1/4.3 | 35% | 28.3 |
| kam | 0 | 33→42.8 | 100% | 0.3 | 2.5/2.0 | 9% | 26.9 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | tve (score) | 1925.1 | 12 | 100 | — |
| 2 | normal | tve (score) | 1925.1 | 23 | 121 | — |
| 3 | normal | brim (score) | 1925.1 | 17 | 157 | — |
| 4 | normal | tve (score) | 1925.1 | 6 | 52 | — |
| 5 | normal | tve (score) | 1925.1 | 10 | 96 | — |
| 6 | normal | tve (score) | 1925.1 | 12 | 88 | — |
| 7 | normal | var (diplomatic) | 1924.7 | 9 | 62 | — |
| 8 | normal | tve (score) | 1925.1 | 14 | 123 | — |
