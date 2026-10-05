# AI-only campaign report

Map: midsea. Runs: 16 (seeds 1–16, difficulties normal, 70-year limit). Node v22.22.2.

Winners: var 1, wes 4, brim 3, bri 2, kam 3, tve 2, dij 1
Victory paths: diplomatic 7, score 9
Average campaign length: 66.2 years; wars per campaign 19.9; average war 10.8 months; peace treaties 45.4; forced peaces 0.0; battles 197.
Coalitions formed per campaign: 7.6; coalition wars: 34.1.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 39.45 ms/tick average, 803 ms worst tick, heap ≈ 107 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 5.9% of all income on average (highest single realm 26.9%); check: at most 30%.
- Realms with a trade agreement: 99.3% of realm-months.
- Industry at the end: 256 of 256 surviving realms ran factories in their last month; factories 672 → 21680 (sum over runs).
- Average treasury at year 40: 2.65× monthly income; check: below 5×.
- Research: the average surviving realm finished 45.6% of the tree; 7752 technologies finished in all; at most 6 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 68.8%, cavalry 10.7%, artillery 17.8%, engineers 1.8%, armour 0.9%.
- Shortages (share of realm-months): coal 21.7%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 210 of 210 surviving coastal realms built ships; 185 of the 193 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: str ×3, bel ×2, kam ×1, wes ×1, car ×1); check: all. Never at war with a coastal realm while coastal (built only): kam ×5, var ×4, bel ×2, bri ×2, car ×2, brim ×1, wes ×1.
- Air: 256 of 256 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 609.9, naval battle sides 201.4, landings 15.4, blockade weeks 1187.8, fleet weeks at sea 10449.6, wings built 142.5, wing-weeks on missions 110822.4, bombing wing-weeks 331.3.
- Peace settlements per run: 18.2 (51 of 291 shared among several winners); demands won: cede 436, gold 183, renounce 156, reparations 78, disarm 12, sphere 3.
- Guarantees given per run 6.6 (80 of 256 realms gave one), honoured by joining a war 0 times; loans per run 10.0 (66 lenders, 9337 crowns lent per run).
- Trade blocs: 256 of 256 realms were members (93.8% of realm-months); spheres: 105 realms led one, and realms spent 4.3% of realm-months in another's sphere.
- National focus: 37.3 focuses completed per surviving realm (16% national); 256 of 256 completed national focuses, 256 a claim, 256 their ambition. First generic focuses by branch: army 266, diplomacy 195, industry 182, state 85, sea 40. Doctrines: army_prof 193, sea_raid 181, dip_concord 160, ind_consumer 157, army_fortress 152, army_offensive 104, ind_war 99, dip_real 96, army_levy 63, sea_battle 29.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 55% tve, 55% kul, 55% kul, 59% tve, 49% tve, 50% tve, 55% brim, 50% tve, 51% tve, 49% tve, 55% tve, 72% tve, 55% tve, 55% tve, 55% tve, 55% tve; economic 66% tve, 70% kul, 71% brim, 70% tve, 73% brim, 65% kam, 75% brim, 65% kam, 67% brim, 67% kam, 66% tve, 87% tve, 73% kul, 76% tve, 71% tve, 67% tve; diplomatic 100%/90% wes, 100%/100% wes, 100%/82% wes, 100%/100% wes, 100%/93% wes, 100%/97% wes, 100%/72% wes, 100%/85% wes, 100%/77% wes, 100%/87% wes, 100%/80% wes, 100%/98% wes, 100%/73% wes, 100%/77% wes, 100%/92% wes, 100%/88% wes.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| dij | 1 | 40→37.3 | 100% | 1.9 | 10.9/9.1 | 28% | 40.4 |
| cas | 0 | 37→36.6 | 100% | 2.7 | 34.8/34.9 | 30% | 31.8 |
| dor | 0 | 24→20.4 | 100% | 0.1 | 7.7/9.3 | 45% | 24.7 |
| bri | 2 | 28→35.8 | 100% | 0.2 | 8.4/8.8 | 37% | 32.6 |
| uus | 0 | 29→26.6 | 100% | 0.0 | 14.9/9.4 | 19% | 32.6 |
| str | 0 | 35→33.5 | 100% | 0.0 | 5.9/8.7 | 48% | 31.3 |
| tve | 2 | 39→47.8 | 100% | 3.4 | 16.8/13.6 | 19% | 35.5 |
| ago | 0 | 20→20.3 | 100% | 2.8 | 3.9/8.2 | 37% | 26.4 |
| wes | 4 | 29→27.8 | 100% | 0.1 | 6.2/7.6 | 49% | 33.0 |
| dre | 0 | 30→30.9 | 100% | 0.1 | 2.8/2.6 | 29% | 37.6 |
| bel | 0 | 35→35.2 | 100% | 0.2 | 6.9/4.6 | 56% | 35.0 |
| kul | 0 | 36→46.6 | 100% | 3.2 | 41.0/45.6 | 26% | 29.3 |
| brim | 3 | 33→44.7 | 100% | 4.5 | 25.1/18.5 | 23% | 35.5 |
| var | 1 | 30→33.5 | 100% | 0.0 | 2.5/4.2 | 30% | 33.5 |
| car | 0 | 28→28.5 | 100% | 0.5 | 3.2/3.3 | 45% | 37.5 |
| kam | 3 | 33→42.6 | 100% | 0.4 | 5.4/5.4 | 37% | 35.9 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | var (diplomatic) | 1923.9 | 12 | 59 | — |
| 10 | normal | wes (diplomatic) | 1943.0 | 22 | 197 | — |
| 11 | normal | brim (score) | 1945.1 | 21 | 241 | — |
| 12 | normal | bri (diplomatic) | 1945.0 | 31 | 351 | — |
| 13 | normal | wes (diplomatic) | 1941.3 | 19 | 175 | — |
| 14 | normal | kam (score) | 1945.1 | 15 | 125 | — |
| 15 | normal | brim (score) | 1945.1 | 41 | 419 | — |
| 16 | normal | wes (diplomatic) | 1924.8 | 9 | 75 | — |
| 2 | normal | brim (score) | 1945.1 | 20 | 260 | — |
| 3 | normal | kam (score) | 1945.1 | 13 | 156 | — |
| 4 | normal | kam (score) | 1945.1 | 19 | 166 | — |
| 5 | normal | bri (diplomatic) | 1941.1 | 16 | 129 | — |
| 6 | normal | tve (score) | 1945.1 | 30 | 371 | — |
| 7 | normal | dij (score) | 1945.1 | 23 | 202 | — |
| 8 | normal | tve (score) | 1945.1 | 16 | 85 | — |
| 9 | normal | wes (diplomatic) | 1933.6 | 11 | 133 | — |
