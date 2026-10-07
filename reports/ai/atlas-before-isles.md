# AI-only campaign report

Map: isles. Runs: 8 (seeds 1–8, difficulties normal, 50-year limit). Node v22.22.2.

Winners: san 2, ost 4, ago 2
Victory paths: diplomatic 2, economic 5, score 1
Average campaign length: 28.7 years; wars per campaign 5.9; average war 7.7 months; peace treaties 9.1; forced peaces 0.0; battles 29.
Coalitions formed per campaign: 1.6; coalition wars: 3.1.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 6.66 ms/tick average, 72 ms worst tick, heap ≈ 46 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 8.4% of all income on average (highest single realm 29.4%); check: at most 30%.
- Realms with a trade agreement: 99.4% of realm-months.
- Industry at the end: 64 of 64 surviving realms ran factories in their last month; factories 144 → 1758 (sum over runs).
- Average treasury at year 40: 4.29× monthly income; check: below 5×.
- Research: the average surviving realm finished 32.5% of the tree; 688 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 65.9%, cavalry 13.5%, artillery 17.8%, engineers 2.8%, armour 0.0%.
- Shortages (share of realm-months): coal 11.5%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 63 of 64 surviving coastal realms built ships; 48 of the 49 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: san ×1); check: all. Never at war with a coastal realm while coastal (built only): dun ×4, san ×3, dre ×2, est ×2, inv ×2, ago ×1, kal ×1.
- Air: 20 of 22 surviving realms past era III built wings and flew missions (not: san ×2); check: all.
- Totals per run: ships built 129.5, naval battle sides 50.8, landings 2.9, blockade weeks 344.5, fleet weeks at sea 8182.5, wings built 17.1, wing-weeks on missions 7542.9, bombing wing-weeks 0.0.
- Peace settlements per run: 5.6 (9 of 45 shared among several winners); demands won: cede 60, gold 34, renounce 25, reparations 22.
- Guarantees given per run 3.5 (20 of 64 realms gave one), honoured by joining a war 1 times; loans per run 0.6 (5 lenders, 187 crowns lent per run).
- Trade contracts: 0.0 signed per run (0 of 64 realms signed at least one); realms held one in 0.0% of realm-months, 0.00 contracts in force per realm-month; per run 0.0 ran their term, 0.0 ended in default, 0.0 were cancelled; 0 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 10.3% of army-months at war; pointless wars (no land and no demand changed hands) 0 of 47 ended (0%); idle treasuries (over 10 months of income with a builder free) 0.4% of realm-months.
- Trade blocs: 62 of 64 realms were members (77.0% of realm-months); spheres: 20 realms led one, and realms spent 13.1% of realm-months in another's sphere.
- National focus: 29.1 focuses completed per surviving realm (19% national); 64 of 64 completed national focuses, 45 a claim, 59 their ambition. First generic focuses by branch: army 73, sea 43, industry 31, diplomacy 29, state 16. Doctrines: army_prof 53, sea_raid 52, ind_consumer 37, dip_concord 32, army_fortress 29, army_offensive 26, dip_real 16, ind_war 9, army_levy 4, sea_battle 3.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 75% ost, 50% ost, 70% ost, 75% ost, 86% ost, 75% ost, 75% ost, 56% san; economic 90% ost, 100%/92% ago, 100%/2% ago, 100%/83% ost, 100%/100% ost, 100%/98% ost, 100%/88% ost, 85% ost; diplomatic 100%/90% san, 100%/70% san, 100%/93% san, 100%/53% san, 100%/68% san, 100%/80% san, 100%/55% san, 100%/85% san.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| ost | 4 | 15→22.4 | 100% | 2.1 | 9.4/3.8 | 3% | 24.4 |
| dun | 0 | 11→12.6 | 100% | 0.3 | 0.5/1.5 | 7% | 24.9 |
| est | 0 | 9→9.4 | 100% | 0.0 | 1.4/7.5 | 3% | 22.9 |
| dre | 0 | 9→10.4 | 100% | 0.1 | 1.5/3.1 | 1% | 22.1 |
| san | 2 | 13→16.0 | 100% | 0.0 | 0.8/0.9 | 43% | 24.3 |
| ago | 2 | 14→19.3 | 100% | 2.8 | 8.6/3.0 | 1% | 23.4 |
| kal | 0 | 12→14.6 | 100% | 0.5 | 4.6/5.5 | 2% | 25.1 |
| inv | 0 | 9→11.4 | 100% | 0.1 | 1.9/3.1 | 0% | 23.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | san (diplomatic) | 1895.5 | 3 | 14 | — |
| 2 | normal | ost (economic) | 1921.4 | 6 | 21 | — |
| 3 | normal | ago (score) | 1935.1 | 6 | 27 | — |
| 4 | normal | ost (economic) | 1916.8 | 8 | 51 | — |
| 5 | normal | ost (economic) | 1909.0 | 3 | 18 | — |
| 6 | normal | ost (economic) | 1914.1 | 8 | 38 | — |
| 7 | normal | ago (economic) | 1922.6 | 12 | 51 | — |
| 8 | normal | san (diplomatic) | 1894.8 | 1 | 9 | — |
