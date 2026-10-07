# AI-only campaign report

Map: midsea. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: kul 1, tve 7
Victory paths: score 8
Average campaign length: 50.1 years; wars per campaign 11.3; average war 10.8 months; peace treaties 20.9; forced peaces 0.0; battles 97.
Coalitions formed per campaign: 4.8; coalition wars: 16.6.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 32.05 ms/tick average, 348 ms worst tick, heap ≈ 93 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 4.9% of all income on average (highest single realm 18.7%); check: at most 30%.
- Realms with a trade agreement: 99.9% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 336 → 10475 (sum over runs).
- Average treasury at year 40: 2.54× monthly income; check: below 5×.
- Research: the average surviving realm finished 35.2% of the tree; 2901 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.1%, cavalry 12.7%, artillery 17.8%, engineers 1.4%, armour 0.0%.
- Shortages (share of realm-months): coal 9.3%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 104 of 104 surviving coastal realms built ships; 82 of the 88 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: str ×3, dij ×1, bri ×1, bel ×1); check: all. Never at war with a coastal realm while coastal (built only): str ×3, bel ×2, dor ×2, kam ×2, var ×2, wes ×2, bri ×1, car ×1, tve ×1.
- Air: 124 of 127 surviving realms past era III built wings and flew missions (not: dor ×3); check: all.
- Totals per run: ships built 415.3, naval battle sides 102.1, landings 6.6, blockade weeks 567.9, fleet weeks at sea 6678.9, wings built 105.0, wing-weeks on missions 40574.9, bombing wing-weeks 1.5.
- Peace settlements per run: 10.6 (16 of 85 shared among several winners); demands won: cede 127, renounce 45, gold 45, reparations 26, disarm 2, sphere 1.
- Guarantees given per run 5.3 (32 of 128 realms gave one), honoured by joining a war 1 times; loans per run 2.4 (15 lenders, 1683 crowns lent per run).
- Trade contracts: 1517.0 signed per run (128 of 128 realms signed at least one); realms held one in 57.5% of realm-months, 0.79 contracts in force per realm-month; per run 1466.5 ran their term, 0.0 ended in default, 33.5 were cancelled; 14943 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 10.8% of army-months at war (3.9% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 1 of 89 ended (1%); idle treasuries (over 10 months of income with a builder free) 0.7% of realm-months.
- Trade blocs: 128 of 128 realms were members (92.4% of realm-months); spheres: 55 realms led one, and realms spent 4.8% of realm-months in another's sphere.
- National focus: 37.3 focuses completed per surviving realm (16% national); 128 of 128 completed national focuses, 128 a claim, 128 their ambition. First generic focuses by branch: army 136, diplomacy 100, industry 87, state 39, sea 22. Doctrines: army_prof 112, ind_consumer 103, sea_raid 100, dip_concord 80, army_fortress 78, army_offensive 50, dip_real 48, ind_war 25, army_levy 16, sea_battle 4.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 50% tve, 52% tve, 56% tve, 57% tve, 58% tve, 52% tve, 49% tve, 52% tve; economic 85% kul, 84% tve, 88% tve, 91% tve, 91% tve, 84% tve, 84% kam, 84% tve; diplomatic 100%/75% wes, 100%/77% wes, 100%/60% wes, 100%/80% wes, 100%/73% wes, 100%/87% wes, 100%/68% wes, 100%/90% wes.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 0 | 40→39.4 | 100% | 1.4 | 10.9/11.4 | 9% | 30.5 |
| cas | 0 | 37→37.6 | 100% | 1.4 | 12.8/15.8 | 9% | 24.8 |
| dor | 0 | 24→21.0 | 100% | 0.0 | 3.9/5.5 | 7% | 20.8 |
| bri | 0 | 28→35.0 | 100% | 0.3 | 2.6/3.0 | 27% | 25.8 |
| uus | 0 | 29→28.6 | 100% | 0.0 | 10.0/4.1 | 18% | 25.3 |
| str | 0 | 35→34.8 | 100% | 0.1 | 0.8/1.4 | 15% | 24.6 |
| tve | 7 | 39→46.9 | 100% | 2.5 | 6.5/3.9 | 2% | 28.6 |
| ago | 0 | 20→18.4 | 100% | 1.1 | 3.6/5.5 | 20% | 19.4 |
| wes | 0 | 29→27.8 | 100% | 0.0 | 6.1/3.8 | 11% | 26.5 |
| dre | 0 | 30→30.8 | 100% | 0.0 | 3.8/1.4 | 16% | 27.0 |
| bel | 0 | 35→35.6 | 100% | 0.4 | 2.3/1.1 | 10% | 25.3 |
| kul | 1 | 36→43.5 | 100% | 0.8 | 12.8/16.8 | 2% | 24.4 |
| brim | 0 | 33→42.4 | 100% | 2.8 | 14.6/16.0 | 8% | 27.9 |
| var | 0 | 30→35.5 | 100% | 0.0 | 0.1/0.4 | 25% | 26.9 |
| car | 0 | 28→28.4 | 100% | 0.5 | 3.9/1.9 | 24% | 27.4 |
| kam | 0 | 33→42.5 | 100% | 0.1 | 2.8/2.3 | 4% | 25.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | kul (score) | 1925.1 | 13 | 93 | — |
| 2 | normal | tve (score) | 1925.1 | 11 | 83 | — |
| 3 | normal | tve (score) | 1925.1 | 16 | 100 | — |
| 4 | normal | tve (score) | 1925.1 | 11 | 112 | — |
| 5 | normal | tve (score) | 1925.1 | 10 | 41 | — |
| 6 | normal | tve (score) | 1925.1 | 13 | 84 | — |
| 7 | normal | tve (score) | 1925.1 | 6 | 101 | — |
| 8 | normal | tve (score) | 1925.1 | 10 | 164 | — |
