# AI-only campaign report

Map: europe. Runs: 16 (seeds 1–8, difficulties easy, hard, normal, 30-year limit). Node v22.22.2.

Winners: rus 16
Victory paths: score 16
Average campaign length: 30.1 years; wars per campaign 44.5; average war 7.5 months; peace treaties 72.8; forced peaces 0.0; battles 255.
Coalitions formed per campaign: 2.8; coalition wars: 2.9.
Eliminations per campaign: 0.81; bankruptcies per campaign: 0.00.
Performance: 49.10 ms/tick average, 444 ms worst tick, heap ≈ 168 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 7.9% of all income on average (highest single realm 71.6%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 355 of 355 surviving realms ran factories in their last month; factories 1296 → 22239 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 71.9% of the tree; 4126 technologies finished in all; at most 1 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 63.5%, cavalry 8.6%, artillery 17.4%, engineers 5.6%, armour 4.8%.
- Shortages (share of realm-months): coal 16.7%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 305 of 305 surviving coastal realms built ships; 292 of the 296 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: per ×3, spa ×1); check: all. Never at war with a coastal realm while coastal (built only): per ×9.
- Air: 355 of 355 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 780.5, naval battle sides 281.3, landings 6.9, blockade weeks 1733.4, fleet weeks at sea 13887.3, wings built 222.4, wing-weeks on missions 108686.8, bombing wing-weeks 890.4.
- Peace settlements per run: 42.3 (70 of 676 shared among several winners); demands won: cede 604, gold 394, renounce 336, reparations 335, disarm 13, sphere 10.
- Guarantees given per run 34.4 (201 of 368 realms gave one), honoured by joining a war 63 times; loans per run 17.6 (97 lenders, 6887 crowns lent per run).
- Trade contracts: 1965.3 signed per run (368 of 368 realms signed at least one); realms held one in 70.9% of realm-months, 1.39 contracts in force per realm-month; per run 1899.6 ran their term, 0.1 ended in default, 0.0 were cancelled; 23432 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 12.4% of army-months at war (8.1% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 2 of 712 ended (0%); idle treasuries (over 10 months of income with a builder free) 11.5% of realm-months.
- Trade blocs: 368 of 368 realms were members (84.2% of realm-months); spheres: 202 realms led one, and realms spent 18.3% of realm-months in another's sphere.
- National focus: 33.8 focuses completed per surviving realm (18% national); 355 of 355 completed national focuses, 355 a claim, 345 their ambition. First generic focuses by branch: army 379, sea 325, industry 201, diplomacy 93, state 67. Doctrines: army_prof 289, sea_raid 245, dip_concord 221, ind_consumer 190, army_fortress 163, ind_war 148, army_offensive 114, dip_real 109, army_levy 66, sea_battle 25.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 70% rus, 70% rus, 70% rus, 71% rus, 71% rus, 72% rus, 71% rus, 70% rus, 71% rus, 70% rus, 70% rus, 70% rus, 71% rus, 70% rus, 71% rus, 71% rus; economic 92% rus, 96% rus, 98% rus, 94% rus, 92% rus, 92% rus, 94% rus, 88% rus, 93% rus, 91% rus, 90% rus, 90% rus, 93% rus, 91% rus, 95% rus, 92% rus; diplomatic 100%/38% rus, 100%/33% rus, 100%/32% rus, 100%/37% rus, 100%/32% lux, 100%/35% fra, 100%/30% lux, 100%/30% fra, 100%/30% fra, 100%/32% ott, 100%/33% fra, 100%/32% fra, 100%/28% fra, 100%/47% fra, 100%/32% rus, 100%/25% fra.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| gbr | 0 | 32→33.8 | 100% | 0.0 | 4.9/9.6 | 41% | 55.5 |
| fra | 0 | 85→85.9 | 100% | 1.9 | 15.1/15.9 | 22% | 64.4 |
| ger | 0 | 44→50.1 | 100% | 9.1 | 42.4/10.4 | 12% | 55.9 |
| aus | 0 | 60→64.9 | 100% | 5.6 | 27.4/11.4 | 4% | 60.9 |
| rus | 16 | 191→190.0 | 100% | 6.7 | 27.8/36.4 | 9% | 67.7 |
| ita | 0 | 36→35.6 | 100% | 5.1 | 21.0/7.0 | 13% | 53.1 |
| ott | 0 | 74→79.9 | 100% | 6.7 | 36.6/31.7 | 11% | 57.0 |
| spa | 0 | 39→42.6 | 100% | 2.6 | 6.9/0.6 | 24% | 55.9 |
| por | 0 | 7→3.4 | 100% | 0.0 | 0.5/6.8 | 41% | 48.2 |
| ned | 0 | 3→1.3 | 94% | 0.0 | 1.1/12.9 | 4% | 47.1 |
| bel | 0 | 2→1.0 | 100% | 0.0 | 0.9/14.6 | 16% | 47.5 |
| lux | 0 | 1→1.0 | 100% | 0.0 | 0.5/9.5 | 25% | 46.5 |
| swi | 0 | 4→0.7 | 31% | 0.0 | 1.5/13.3 | 13% | 46.1 |
| den | 0 | 4→3.1 | 100% | 0.0 | 0.8/1.5 | 69% | 47.8 |
| swe | 0 | 22→23.9 | 100% | 1.7 | 5.7/2.6 | 15% | 53.5 |
| nor | 0 | 15→12.1 | 100% | 0.0 | 7.1/8.7 | 20% | 50.8 |
| rom | 0 | 13→9.4 | 100% | 1.1 | 14.7/17.0 | 9% | 49.1 |
| bul | 0 | 10→4.8 | 94% | 0.5 | 8.3/14.1 | 7% | 48.0 |
| ser | 0 | 7→6.4 | 100% | 0.8 | 10.7/7.8 | 7% | 50.2 |
| gre | 0 | 12→11.7 | 100% | 1.1 | 14.7/9.6 | 12% | 50.5 |
| mon | 0 | 1→1.1 | 100% | 0.9 | 3.9/10.1 | 31% | 46.0 |
| alb | 0 | 2→1.1 | 100% | 0.8 | 1.8/7.9 | 49% | 47.8 |
| per | 0 | 22→22.1 | 100% | 0.0 | 0.8/0.0 | 9% | 51.6 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | easy | rus (score) | 1944.1 | 32 | 197 | swi |
| 2 | easy | rus (score) | 1944.1 | 33 | 175 | swi |
| 3 | easy | rus (score) | 1944.1 | 40 | 336 | — |
| 4 | easy | rus (score) | 1944.1 | 37 | 173 | swi |
| 1 | hard | rus (score) | 1944.1 | 52 | 307 | swi |
| 2 | hard | rus (score) | 1944.1 | 56 | 265 | — |
| 3 | hard | rus (score) | 1944.1 | 45 | 366 | swi |
| 4 | hard | rus (score) | 1944.1 | 50 | 226 | swi |
| 1 | normal | rus (score) | 1944.1 | 49 | 232 | ned, swi, bul |
| 2 | normal | rus (score) | 1944.1 | 48 | 260 | — |
| 3 | normal | rus (score) | 1944.1 | 45 | 269 | — |
| 4 | normal | rus (score) | 1944.1 | 45 | 207 | swi |
| 5 | normal | rus (score) | 1944.1 | 42 | 278 | swi |
| 6 | normal | rus (score) | 1944.1 | 42 | 222 | swi |
| 7 | normal | rus (score) | 1944.1 | 51 | 296 | swi |
| 8 | normal | rus (score) | 1944.1 | 45 | 268 | — |
