# AI-only campaign report

Map: hesperia. Runs: 12 (seeds 1–8, difficulties hard, normal, 30-year limit). Node v22.22.2.

Winners: var 11, kha 1
Victory paths: score 12
Average campaign length: 30.1 years; wars per campaign 33.5; average war 8.9 months; peace treaties 51.8; forced peaces 0.0; battles 283.
Coalitions formed per campaign: 2.3; coalition wars: 1.3.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 33.11 ms/tick average, 148 ms worst tick, heap ≈ 161 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 7.0% of all income on average (highest single realm 64.0%); check: at most 30%.
- Realms with a trade agreement: 99.9% of realm-months.
- Industry at the end: 264 of 264 surviving realms ran factories in their last month; factories 528 → 19130 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 39.5% of the tree; 3382 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 63.8%, cavalry 13.1%, artillery 17.2%, engineers 5.8%, armour 0.2%.
- Shortages (share of realm-months): coal 0.1%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 208 of 208 surviving coastal realms built ships; 180 of the 180 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): cor ×10, sap ×7, mor ×4, amu ×3, qas ×2, osk ×1, sah ×1.
- Air: 211 of 222 surviving realms past era III built wings and flew missions (not: sap ×11); check: all.
- Totals per run: ships built 578.3, naval battle sides 194.2, landings 4.2, blockade weeks 1129.4, fleet weeks at sea 8442.7, wings built 124.2, wing-weeks on missions 31537.3, bombing wing-weeks 0.0.
- Peace settlements per run: 31.8 (39 of 381 shared among several winners); demands won: cede 610, renounce 215, gold 185, reparations 121, sphere 21, disarm 5.
- Guarantees given per run 30.3 (146 of 264 realms gave one), honoured by joining a war 26 times; loans per run 15.3 (29 lenders, 7357 crowns lent per run).
- Trade contracts: 2250.3 signed per run (264 of 264 realms signed at least one); realms held one in 73.4% of realm-months, 1.40 contracts in force per realm-month; per run 2192.8 ran their term, 0.0 ended in default, 0.0 were cancelled; 24879 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 4.0% of army-months at war (0.8% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 2 of 402 ended (0%); idle treasuries (over 10 months of income with a builder free) 4.9% of realm-months.
- Trade blocs: 264 of 264 realms were members (89.3% of realm-months); spheres: 129 realms led one, and realms spent 13.5% of realm-months in another's sphere.
- National focus: 33.8 focuses completed per surviving realm (18% national); 264 of 264 completed national focuses, 252 a claim, 264 their ambition. First generic focuses by branch: army 341, industry 192, diplomacy 95, sea 88, state 76. Doctrines: army_prof 201, dip_concord 156, sea_raid 153, ind_consumer 145, army_fortress 117, ind_war 116, army_offensive 109, dip_real 108, army_levy 62, sea_battle 37.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 57% kha, 55% var, 60% kha, 60% kha, 57% var, 56% kha, 54% var, 55% kha, 60% kha, 54% kha, 58% kha, 57% var; economic 79% var, 80% var, 82% var, 90% var, 88% var, 81% var, 80% var, 83% var, 80% kha, 77% var, 83% var, 86% var; diplomatic 100%/13% vel, 100%/27% lor, 100%/23% lor, 100%/5% lor, 100%/2% vel, 93% lor, 100%/7% tes, 100%/2% tes, 100%/10% lor, 100%/32% tes, 100%/20% tes, 100%/5% vel.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| var | 11 | 77→90.7 | 100% | 11.4 | 65.5/45.6 | 1% | 35.7 |
| skh | 0 | 39→36.4 | 100% | 0.0 | 7.3/11.9 | 2% | 28.3 |
| mor | 0 | 45→46.1 | 100% | 0.8 | 3.0/2.3 | 1% | 30.8 |
| irn | 0 | 31→30.3 | 100% | 0.0 | 8.4/12.4 | 6% | 29.4 |
| vel | 0 | 19→13.7 | 100% | 0.1 | 15.2/17.9 | 17% | 26.9 |
| lor | 0 | 46→48.3 | 100% | 2.2 | 10.5/11.3 | 11% | 34.3 |
| ast | 0 | 37→38.3 | 100% | 1.8 | 19.1/21.0 | 3% | 28.8 |
| ils | 0 | 9→4.7 | 100% | 0.0 | 4.8/8.1 | 0% | 25.8 |
| qas | 0 | 29→23.8 | 100% | 0.5 | 4.8/6.8 | 2% | 26.3 |
| cor | 0 | 21→20.9 | 100% | 0.0 | 0.2/0.2 | 9% | 28.1 |
| hsk | 0 | 3→3.0 | 100% | 0.0 | 0.3/1.8 | 26% | 22.9 |
| lys | 0 | 38→47.2 | 100% | 4.0 | 23.3/19.2 | 10% | 31.4 |
| hal | 0 | 3→1.3 | 100% | 0.0 | 0.9/4.6 | 10% | 22.7 |
| bre | 0 | 30→27.3 | 100% | 0.1 | 11.7/7.2 | 4% | 32.2 |
| kha | 1 | 72→93.0 | 100% | 7.3 | 48.0/51.8 | 4% | 29.3 |
| dor | 0 | 15→9.9 | 100% | 0.3 | 17.1/13.2 | 1% | 24.8 |
| tes | 0 | 51→56.0 | 100% | 1.8 | 7.3/6.3 | 3% | 35.5 |
| osk | 0 | 31→31.3 | 100% | 0.1 | 4.3/2.8 | 2% | 30.8 |
| tar | 0 | 49→45.8 | 100% | 1.3 | 19.8/18.2 | 3% | 25.9 |
| amu | 0 | 40→44.0 | 100% | 1.6 | 8.1/5.0 | 6% | 30.8 |
| sah | 0 | 22→22.3 | 100% | 0.5 | 3.6/11.5 | 4% | 26.3 |
| sap | 0 | 12→12.0 | 100% | 0.0 | 0.0/0.0 | 34% | 27.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | hard | var (score) | 1920.1 | 33 | 307 | — |
| 2 | hard | var (score) | 1920.1 | 32 | 265 | — |
| 3 | hard | var (score) | 1920.1 | 39 | 305 | — |
| 4 | hard | var (score) | 1920.1 | 33 | 298 | — |
| 1 | normal | var (score) | 1920.1 | 28 | 245 | — |
| 2 | normal | var (score) | 1920.1 | 28 | 234 | — |
| 3 | normal | var (score) | 1920.1 | 30 | 305 | — |
| 4 | normal | var (score) | 1920.1 | 38 | 372 | — |
| 5 | normal | kha (score) | 1920.1 | 36 | 262 | — |
| 6 | normal | var (score) | 1920.1 | 33 | 228 | — |
| 7 | normal | var (score) | 1920.1 | 38 | 292 | — |
| 8 | normal | var (score) | 1920.1 | 34 | 282 | — |
