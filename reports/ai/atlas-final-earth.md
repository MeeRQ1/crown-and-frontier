# AI-only campaign report

Map: earth. Runs: 10 (seeds 1–8, difficulties hard, normal, 30-year limit). Node v22.22.2.

Winners: gbr 10
Victory paths: score 10
Average campaign length: 30.1 years; wars per campaign 73.4; average war 10.5 months; peace treaties 117.5; forced peaces 0.0; battles 345.
Coalitions formed per campaign: 2.7; coalition wars: 4.5.
Eliminations per campaign: 1.70; bankruptcies per campaign: 0.00.
Performance: 178.15 ms/tick average, 683 ms worst tick, heap ≈ 160 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 21.8% of all income on average (highest single realm 100.0%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 553 of 553 surviving realms ran factories in their last month; factories 1170 → 21932 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 76.8% of the tree; 8430 technologies finished in all; at most 5 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 63.6%, cavalry 8.0%, artillery 18.6%, engineers 5.7%, armour 4.1%.
- Shortages (share of realm-months): coal 16.2%, iron 0.0%, oil 16.1%, rubber 0.0%, nitrates 0.0%.
- Navy: 474 of 474 surviving coastal realms built ships; 382 of the 405 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: can ×9, sia ×8, rus ×2, ita ×2, per ×1, rom ×1); check: all. Never at war with a coastal realm while coastal (built only): cub ×9, nzl ×9, uru ×9, ecu ×7, cri ×6, lbr ×6, sal ×6, gua ×4, hon ×4, jpn ×3, chn ×2, ast ×1, can ×1, omn ×1, pru ×1.
- Air: 528 of 553 surviving realms past era III built wings and flew missions (not: cub ×10, nzl ×9, ast ×6); check: all.
- Totals per run: ships built 1873.2, naval battle sides 603.1, landings 34.7, blockade weeks 4009.7, fleet weeks at sea 35152.8, wings built 463.4, wing-weeks on missions 234860.9, bombing wing-weeks 1709.4.
- Peace settlements per run: 67.1 (70 of 671 shared among several winners); demands won: cede 618, gold 379, reparations 358, renounce 322, disarm 20, sphere 20.
- Guarantees given per run 69.7 (322 of 570 realms gave one), honoured by joining a war 74 times; loans per run 60.0 (153 lenders, 35084 crowns lent per run).
- Trade contracts: 4805.3 signed per run (570 of 570 realms signed at least one); realms held one in 67.1% of realm-months, 1.45 contracts in force per realm-month; per run 4693.4 ran their term, 1.7 ended in default, 1.3 were cancelled; 69677 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 40.0% of army-months at war (5.0% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 1 of 734 ended (0%); idle treasuries (over 10 months of income with a builder free) 23.8% of realm-months.
- Trade blocs: 570 of 570 realms were members (89.5% of realm-months); spheres: 212 realms led one, and realms spent 18.1% of realm-months in another's sphere.
- National focus: 33.9 focuses completed per surviving realm (18% national); 553 of 553 completed national focuses, 533 a claim, 537 their ambition. First generic focuses by branch: sea 554, army 498, industry 363, diplomacy 153, state 91. Doctrines: army_prof 439, sea_raid 428, dip_concord 390, army_fortress 262, ind_consumer 258, ind_war 252, army_offensive 152, dip_real 151, army_levy 113, sea_battle 26.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr, 55% gbr; economic 68% gbr, 65% gbr, 66% gbr, 66% gbr, 66% gbr, 67% gbr, 66% gbr, 66% gbr, 68% gbr, 68% gbr; diplomatic 100%/28% gbr, 100%/30% gbr, 100%/30% gbr, 100%/25% gbr, 100%/28% gbr, 100%/30% gbr, 100%/28% gbr, 100%/25% gbr, 100%/27% gbr, 100%/25% gbr.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| gbr | 10 | 182→178.4 | 100% | 4.9 | 7.5/10.4 | 90% | 73.0 |
| fra | 0 | 97→97.2 | 100% | 5.8 | 26.6/14.6 | 58% | 72.6 |
| ger | 0 | 47→46.6 | 100% | 9.8 | 35.1/25.5 | 59% | 64.3 |
| aus | 0 | 31→33.5 | 100% | 4.1 | 16.3/3.9 | 1% | 62.9 |
| rus | 0 | 167→168.7 | 100% | 8.6 | 31.3/25.6 | 19% | 72.7 |
| ita | 0 | 24→23.2 | 100% | 4.6 | 9.0/4.1 | 62% | 57.5 |
| ott | 0 | 37→47.2 | 100% | 9.9 | 51.5/11.1 | 0% | 60.7 |
| spa | 0 | 21→19.8 | 100% | 0.0 | 3.5/3.4 | 67% | 59.2 |
| por | 0 | 17→18.7 | 100% | 0.2 | 6.7/6.5 | 50% | 57.2 |
| ned | 0 | 31→29.5 | 100% | 0.0 | 3.1/18.8 | 84% | 59.7 |
| bel | 0 | 11→11.4 | 100% | 0.0 | 9.0/17.0 | 36% | 56.8 |
| swi | 0 | 3→0.4 | 40% | 0.0 | 0.4/10.0 | 3% | 48.3 |
| den | 0 | 6→5.0 | 100% | 0.0 | 0.0/1.2 | 94% | 52.1 |
| swe | 0 | 6→5.5 | 100% | 0.0 | 0.6/1.5 | 79% | 54.3 |
| nor | 0 | 6→5.3 | 100% | 0.0 | 0.6/2.3 | 70% | 53.3 |
| rom | 0 | 5→1.2 | 100% | 1.1 | 3.9/20.6 | 8% | 50.9 |
| bul | 0 | 4→0.9 | 80% | 0.3 | 3.2/15.7 | 4% | 48.4 |
| ser | 0 | 4→3.7 | 100% | 1.6 | 6.1/9.7 | 15% | 53.9 |
| gre | 0 | 5→4.0 | 100% | 0.9 | 3.1/9.3 | 20% | 52.8 |
| alb | 0 | 1→1.0 | 100% | 0.0 | 0.4/7.8 | 1% | 51.8 |
| per | 0 | 12→9.3 | 100% | 0.2 | 11.1/15.1 | 3% | 54.0 |
| afg | 0 | 4→3.8 | 100% | 0.1 | 5.6/4.9 | 17% | 52.6 |
| njd | 0 | 2→2.3 | 100% | 0.0 | 5.7/17.4 | 20% | 50.6 |
| omn | 0 | 2→1.9 | 90% | 0.0 | 1.4/4.2 | 13% | 51.5 |
| nep | 0 | 3→3.0 | 100% | 0.0 | 0.0/0.0 | 0% | 54.0 |
| chn | 0 | 110→115.1 | 100% | 3.5 | 16.3/8.7 | 7% | 67.0 |
| tib | 0 | 4→3.8 | 100% | 0.0 | 4.7/5.3 | 41% | 51.8 |
| mgl | 0 | 4→0.5 | 40% | 0.0 | 5.8/10.5 | 10% | 48.9 |
| jpn | 0 | 22→21.2 | 100% | 0.6 | 0.0/5.2 | 40% | 56.4 |
| sia | 0 | 6→6.4 | 100% | 0.0 | 1.2/0.1 | 61% | 55.0 |
| eth | 0 | 6→8.2 | 100% | 0.0 | 0.5/0.3 | 73% | 53.4 |
| lbr | 0 | 1→1.1 | 100% | 0.0 | 0.0/2.0 | 0% | 51.0 |
| saf | 0 | 7→8.5 | 100% | 0.0 | 4.8/0.6 | 27% | 53.7 |
| usa | 0 | 106→113.2 | 100% | 3.5 | 14.2/6.6 | 10% | 73.0 |
| can | 0 | 49→45.0 | 100% | 0.0 | 4.8/6.4 | 0% | 63.6 |
| mex | 0 | 17→14.4 | 100% | 0.0 | 2.5/7.3 | 33% | 55.2 |
| gua | 0 | 1→1.0 | 100% | 0.2 | 1.8/1.7 | 16% | 51.0 |
| hon | 0 | 1→1.0 | 100% | 0.4 | 0.0/3.0 | 30% | 50.1 |
| sal | 0 | 1→1.0 | 100% | 0.0 | 0.0/0.0 | 33% | 50.7 |
| nic | 0 | 1→1.0 | 100% | 0.0 | 1.3/1.4 | 76% | 50.2 |
| cri | 0 | 1→1.0 | 100% | 0.0 | 0.0/0.1 | 29% | 51.0 |
| pan | 0 | 1→1.0 | 100% | 0.0 | 1.9/8.7 | 38% | 50.0 |
| cub | 0 | 1→1.0 | 100% | 0.0 | 0.0/0.0 | 10% | 50.5 |
| hai | 0 | 1→1.0 | 100% | 0.0 | 4.5/0.0 | 97% | 51.7 |
| dom | 0 | 1→1.0 | 100% | 1.6 | 0.0/4.5 | 80% | 49.1 |
| col | 0 | 11→11.2 | 100% | 2.7 | 9.4/0.2 | 25% | 56.6 |
| ven | 0 | 5→1.5 | 90% | 0.0 | 0.5/11.6 | 38% | 49.7 |
| ecu | 0 | 4→4.0 | 100% | 0.0 | 0.2/0.3 | 15% | 53.9 |
| pru | 0 | 12→12.2 | 100% | 0.2 | 1.3/1.3 | 5% | 56.2 |
| bra | 0 | 48→55.1 | 100% | 5.2 | 18.3/3.2 | 7% | 67.0 |
| bol | 0 | 8→7.8 | 100% | 0.0 | 0.0/1.0 | 10% | 56.4 |
| par | 0 | 3→2.7 | 90% | 0.0 | 0.0/0.5 | 11% | 53.8 |
| uru | 0 | 2→2.0 | 100% | 0.0 | 0.0/0.0 | 10% | 52.7 |
| arg | 0 | 21→21.0 | 100% | 2.6 | 7.6/4.6 | 1% | 58.9 |
| chi | 0 | 11→8.3 | 100% | 0.8 | 1.4/6.0 | 2% | 53.3 |
| ast | 0 | 27→27.3 | 100% | 0.0 | 0.0/0.2 | 81% | 60.3 |
| nzl | 0 | 4→4.0 | 100% | 0.0 | 0.0/0.0 | 10% | 52.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | hard | gbr (score) | 1944.1 | 76 | 402 | swi, ven |
| 2 | hard | gbr (score) | 1944.1 | 74 | 309 | swi, mgl |
| 1 | normal | gbr (score) | 1944.1 | 72 | 404 | mgl |
| 2 | normal | gbr (score) | 1944.1 | 77 | 305 | swi, mgl, par |
| 3 | normal | gbr (score) | 1944.1 | 74 | 410 | — |
| 4 | normal | gbr (score) | 1944.1 | 67 | 268 | swi, bul, omn, mgl |
| 5 | normal | gbr (score) | 1944.1 | 75 | 379 | swi |
| 6 | normal | gbr (score) | 1944.1 | 76 | 328 | mgl |
| 7 | normal | gbr (score) | 1944.1 | 75 | 344 | swi |
| 8 | normal | gbr (score) | 1944.1 | 68 | 298 | bul, mgl |
