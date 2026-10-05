# AI-only campaign report

Map: midsea. Runs: 16 (seeds 1–16, difficulties normal, 70-year limit). Node v22.22.2.

Winners: bri 4, wes 2, tve 6, kul 1, brim 2, var 1
Victory paths: diplomatic 7, score 8, economic 1
Average campaign length: 64.7 years; wars per campaign 18.1; average war 10.7 months; peace treaties 31.7; forced peaces 0.0; battles 165.
Coalitions formed per campaign: 7.7; coalition wars: 14.9.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 26.93 ms/tick average, 202 ms worst tick, heap ≈ 99 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.5% of all income on average (highest single realm 15.7%); check: at most 30%.
- Realms with a trade agreement: 99.3% of realm-months.
- Industry at the end: 256 of 256 surviving realms ran factories in their last month; factories 672 → 21691 (sum over runs).
- Average treasury at year 40: 2.64× monthly income; check: below 5×.
- Research: the average surviving realm finished 45.0% of the tree; 7638 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 69.1%, cavalry 10.9%, artillery 17.9%, engineers 1.7%, armour 0.4%.
- Shortages (share of realm-months): coal 19.2%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 208 of 208 surviving coastal realms built ships; 168 of the 170 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: kam ×1, str ×1); check: all. Never at war with a coastal realm while coastal (built only): kam ×8, bri ×7, wes ×6, var ×5, bel ×3, str ×3, ago ×2, car ×2, dij ×1, dor ×1.
- Air: 255 of 256 surviving realms past era III built wings and flew missions (not: dor ×1); check: all.
- Totals per run: ships built 558.9, naval battle sides 175.5, landings 12.0, blockade weeks 968.0, fleet weeks at sea 9272.3, wings built 137.8, wing-weeks on missions 103090.8, bombing wing-weeks 332.1.
- Peace settlements per run: 16.6 (39 of 266 shared among several winners); demands won: cede 435, renounce 160, gold 108, reparations 75, disarm 9, sphere 3.
- Guarantees given per run 5.4 (71 of 256 realms gave one), honoured by joining a war 4 times; loans per run 5.6 (44 lenders, 5370 crowns lent per run).
- Trade blocs: 256 of 256 realms were members (94.7% of realm-months); spheres: 122 realms led one, and realms spent 4.1% of realm-months in another's sphere.
- National focus: 37.3 focuses completed per surviving realm (16% national); 256 of 256 completed national focuses, 256 a claim, 256 their ambition. First generic focuses by branch: army 275, diplomacy 200, industry 170, state 85, sea 38. Doctrines: army_prof 226, ind_consumer 201, sea_raid 197, dip_concord 159, army_fortress 157, army_offensive 99, dip_real 97, ind_war 55, army_levy 30, sea_battle 12.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 55% tve, 52% tve, 55% tve, 54% tve, 64% tve, 51% tve, 55% tve, 64% tve, 59% tve, 55% tve, 52% tve, 62% tve, 54% tve, 63% tve, 55% kul, 55% tve; economic 92% tve, 84% kam, 91% tve, 86% tve, 100%/95% tve, 83% tve, 100%/42% brim, 100%/85% tve, 100%/27% brim, 92% tve, 85% tve, 94% tve, 86% tve, 99% tve, 92% kul, 93% tve; diplomatic 100%/83% wes, 100%/98% wes, 100%/93% wes, 100%/80% wes, 100%/90% wes, 100%/90% bri, 100%/95% wes, 100%/78% bri, 100%/95% wes, 100%/78% wes, 100%/100% wes, 100%/83% wes, 100%/93% wes, 100%/92% bri, 100%/85% dij, 100%/83% bri.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 0 | 40→35.0 | 100% | 1.3 | 10.3/12.9 | 25% | 38.9 |
| cas | 0 | 37→36.7 | 100% | 2.2 | 28.1/20.6 | 17% | 31.2 |
| dor | 0 | 24→19.9 | 100% | 0.1 | 11.9/17.5 | 20% | 25.4 |
| bri | 4 | 28→35.7 | 100% | 0.1 | 6.9/3.0 | 36% | 32.1 |
| uus | 0 | 29→28.0 | 100% | 0.0 | 14.4/11.3 | 10% | 31.8 |
| str | 0 | 35→35.4 | 100% | 0.3 | 1.6/2.8 | 28% | 30.6 |
| tve | 6 | 39→49.7 | 100% | 5.1 | 22.8/17.3 | 17% | 36.1 |
| ago | 0 | 20→20.3 | 100% | 1.5 | 3.6/7.0 | 35% | 26.5 |
| wes | 2 | 29→28.5 | 100% | 0.0 | 2.1/2.7 | 41% | 32.9 |
| dre | 0 | 30→31.1 | 100% | 0.1 | 1.4/1.4 | 25% | 36.2 |
| bel | 0 | 35→34.6 | 100% | 0.1 | 4.6/3.3 | 52% | 33.8 |
| kul | 1 | 36→43.8 | 100% | 2.2 | 26.3/32.8 | 12% | 30.9 |
| brim | 2 | 33→45.4 | 100% | 4.6 | 19.9/20.0 | 17% | 35.4 |
| var | 1 | 30→32.7 | 100% | 0.0 | 3.3/3.3 | 12% | 32.6 |
| car | 0 | 28→28.9 | 100% | 0.4 | 4.8/4.2 | 39% | 36.4 |
| kam | 0 | 33→42.3 | 100% | 0.2 | 3.3/4.1 | 20% | 34.8 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | bri (diplomatic) | 1941.9 | 13 | 94 | — |
| 10 | normal | wes (diplomatic) | 1928.1 | 15 | 202 | — |
| 11 | normal | tve (score) | 1945.1 | 30 | 297 | — |
| 12 | normal | kul (score) | 1945.1 | 13 | 201 | — |
| 13 | normal | tve (economic) | 1934.8 | 14 | 136 | — |
| 14 | normal | bri (diplomatic) | 1936.7 | 12 | 152 | — |
| 15 | normal | wes (diplomatic) | 1935.3 | 33 | 292 | — |
| 16 | normal | tve (score) | 1945.1 | 17 | 154 | — |
| 2 | normal | brim (score) | 1945.1 | 27 | 172 | — |
| 3 | normal | brim (score) | 1945.1 | 23 | 167 | — |
| 4 | normal | var (diplomatic) | 1930.0 | 6 | 52 | — |
| 5 | normal | tve (score) | 1945.1 | 14 | 135 | — |
| 6 | normal | bri (diplomatic) | 1927.7 | 14 | 119 | — |
| 7 | normal | tve (score) | 1945.1 | 17 | 121 | — |
| 8 | normal | tve (score) | 1945.1 | 20 | 138 | — |
| 9 | normal | bri (diplomatic) | 1939.8 | 22 | 213 | — |
