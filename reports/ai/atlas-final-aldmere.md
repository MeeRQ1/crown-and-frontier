# AI-only campaign report

Map: aldmere. Runs: 24 (seeds 1–8, difficulties easy, hard, normal, 50-year limit). Node v22.22.2.

Winners: les 5, mor 19
Victory paths: score 15, economic 9
Average campaign length: 43.5 years; wars per campaign 20.1; average war 11.4 months; peace treaties 31.0; forced peaces 0.0; battles 117.
Coalitions formed per campaign: 1.6; coalition wars: 7.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 9.39 ms/tick average, 84 ms worst tick, heap ≈ 74 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 7.1% of all income on average (highest single realm 23.6%); check: at most 30%.
- Realms with a trade agreement: 99.5% of realm-months.
- Industry at the end: 336 of 336 surviving realms ran factories in their last month; factories 768 → 15934 (sum over runs).
- Average treasury at year 40: 3.22× monthly income; check: below 5×.
- Research: the average surviving realm finished 35.2% of the tree; 6271 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 67.2%, cavalry 12.4%, artillery 17.8%, engineers 2.5%, armour 0.2%.
- Shortages (share of realm-months): coal 11.0%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 312 of 312 surviving coastal realms built ships; 284 of the 284 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): ist ×12, fen ×5, ash ×4, ser ×4, car ×1, les ×1, sol ×1.
- Air: 251 of 251 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 363.4, naval battle sides 185.0, landings 6.1, blockade weeks 1132.8, fleet weeks at sea 8422.4, wings built 76.8, wing-weeks on missions 35589.1, bombing wing-weeks 51.0.
- Peace settlements per run: 17.9 (51 of 430 shared among several winners); demands won: cede 468, renounce 329, gold 249, reparations 165, sphere 7, disarm 4.
- Guarantees given per run 9.1 (103 of 336 realms gave one), honoured by joining a war 12 times; loans per run 3.7 (45 lenders, 1562 crowns lent per run).
- Trade contracts: 2129.7 signed per run (336 of 336 realms signed at least one); realms held one in 83.9% of realm-months, 1.53 contracts in force per realm-month; per run 2090.6 ran their term, 0.0 ended in default, 1.3 were cancelled; 20539 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 8.0% of army-months at war (1.2% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 16 of 481 ended (3%); idle treasuries (over 10 months of income with a builder free) 0.3% of realm-months.
- Trade blocs: 335 of 336 realms were members (87.1% of realm-months); spheres: 104 realms led one, and realms spent 9.0% of realm-months in another's sphere.
- National focus: 35.7 focuses completed per surviving realm (17% national); 336 of 336 completed national focuses, 336 a claim, 332 their ambition. First generic focuses by branch: army 504, diplomacy 240, industry 195, state 59, sea 10. Doctrines: sea_raid 266, army_prof 249, dip_concord 210, army_fortress 199, ind_consumer 197, army_offensive 128, ind_war 122, dip_real 119, army_levy 80, sea_battle 35.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 67% tar, 67% mor, 67% tar, 62% tar, 63% tar, 65% tar, 63% tar, 67% tar, 63% tar, 67% mor, 67% mor, 63% tar, 67% mor, 63% tar, 67% tar, 67% tar, 65% tar, 60% tar, 65% tar, 67% mor, 63% tar, 65% tar, 63% tar, 67% mor; economic 100% les, 100%/85% les, 100%/85% les, 100%/47% mor, 100%/95% les, 100%/52% les, 100%/90% les, 94% mor, 100%/52% mor, 100%/98% mor, 100%/55% mor, 100%/53% mor, 98% mor, 100%/98% mor, 94% mor, 96% mor, 94% les, 95% mor, 100%/53% mor, 100%/87% mor, 100%/27% mor, 100%/100% les, 99% mor, 100%/93% mor; diplomatic 100%/33% ser, 100%/37% ser, 100%/32% les, 100%/3% les, 92%/2% aur, 100%/18% ser, 100%/22% les, 92%/2% les, 100%/33% ser, 100%/38% les, 100%/48% ser, 100%/52% ser, 100%/30% ser, 100%/45% les, 100%/23% ser, 100%/32% ser, 100%/30% les, 100%/27% ser, 100%/55% les, 100%/5% les, 100%/5% les, 100%/70% aur, 100%/22% aur, 100%/15% ser.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 0 | 25→29.9 | 100% | 2.0 | 8.5/5.3 | 8% | 28.2 |
| vos | 0 | 20→21.2 | 100% | 1.6 | 10.3/19.2 | 16% | 23.1 |
| ser | 0 | 20→20.0 | 100% | 0.0 | 0.4/0.4 | 42% | 28.2 |
| cal | 0 | 16→16.5 | 100% | 0.0 | 3.0/3.9 | 6% | 28.2 |
| ist | 0 | 17→17.0 | 100% | 0.0 | 0.8/0.6 | 1% | 25.3 |
| dre | 0 | 21→23.8 | 100% | 5.5 | 26.9/11.2 | 2% | 24.4 |
| mor | 19 | 25→39.6 | 100% | 7.1 | 31.2/15.0 | 1% | 29.9 |
| fen | 0 | 12→15.3 | 100% | 0.0 | 0.8/3.0 | 3% | 23.6 |
| tar | 0 | 30→33.8 | 100% | 0.3 | 5.7/11.4 | 2% | 25.9 |
| car | 0 | 13→12.4 | 100% | 0.2 | 3.6/3.5 | 13% | 22.7 |
| hra | 0 | 14→10.1 | 100% | 0.1 | 7.6/27.0 | 9% | 20.3 |
| sol | 0 | 12→10.8 | 100% | 0.0 | 1.5/4.2 | 38% | 24.2 |
| les | 5 | 24→30.1 | 100% | 2.5 | 13.0/6.1 | 2% | 29.3 |
| ash | 0 | 15→17.7 | 100% | 0.7 | 3.8/5.9 | 3% | 26.1 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | easy | les (score) | 1930.1 | 25 | 122 | — |
| 2 | easy | les (economic) | 1896.8 | 14 | 57 | — |
| 3 | easy | mor (economic) | 1923.8 | 23 | 133 | — |
| 4 | easy | mor (score) | 1930.1 | 25 | 146 | — |
| 5 | easy | les (economic) | 1902.3 | 13 | 63 | — |
| 6 | easy | les (score) | 1930.1 | 26 | 179 | — |
| 7 | easy | mor (economic) | 1911.5 | 18 | 77 | — |
| 8 | easy | mor (score) | 1930.1 | 15 | 94 | — |
| 1 | hard | les (score) | 1930.1 | 23 | 121 | — |
| 2 | hard | mor (economic) | 1907.1 | 15 | 75 | — |
| 3 | hard | mor (score) | 1930.1 | 18 | 137 | — |
| 4 | hard | mor (score) | 1930.1 | 19 | 124 | — |
| 5 | hard | mor (score) | 1930.1 | 19 | 154 | — |
| 6 | hard | mor (economic) | 1920.1 | 21 | 75 | — |
| 7 | hard | mor (score) | 1930.1 | 25 | 144 | — |
| 8 | hard | mor (score) | 1930.1 | 20 | 84 | — |
| 1 | normal | mor (score) | 1930.1 | 19 | 113 | — |
| 2 | normal | mor (score) | 1930.1 | 18 | 103 | — |
| 3 | normal | mor (score) | 1930.1 | 22 | 146 | — |
| 4 | normal | mor (economic) | 1915.7 | 18 | 103 | — |
| 5 | normal | mor (score) | 1930.1 | 16 | 128 | — |
| 6 | normal | mor (economic) | 1923.0 | 22 | 145 | — |
| 7 | normal | mor (score) | 1930.1 | 28 | 211 | — |
| 8 | normal | mor (economic) | 1912.3 | 20 | 76 | — |
