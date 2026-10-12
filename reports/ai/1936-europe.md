# AI-only campaign report

Map: europe-1936. Runs: 4 (seeds 1–4, difficulties normal, 10-year limit). Node v22.22.2.

Winners: sov 4
Victory paths: score 4
Average campaign length: 10.1 years; wars per campaign 24.3; average war 7.7 months; peace treaties 33.8; forced peaces 0.0; battles 150.
Coalitions formed per campaign: 0.0; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 43.09 ms/tick average, 123 ms worst tick, heap ≈ 147 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: n/a (no run reached year 25).
- Realms with a trade agreement: 99.7% of realm-months.
- Industry at the end: 128 of 128 surviving realms ran factories in their last month; factories 384 → 2485 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 97.1% of the tree; 493 technologies finished in all; at most 0 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 59.7%, cavalry 8.2%, artillery 18.6%, engineers 6.3%, armour 7.2%.
- Shortages (share of realm-months): coal 0.0%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 104 of 104 surviving coastal realms built ships; 68 of the 84 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: gre ×4, egy ×4, irq ×4, irn ×4); check: all. Never at war with a coastal realm while coastal (built only): den ×4, irl ×4, nor ×4, swe ×4, alb ×2, fin ×2.
- Air: 128 of 128 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 224.8, naval battle sides 80.0, landings 8.5, blockade weeks 662.3, fleet weeks at sea 5595.0, wings built 218.5, wing-weeks on missions 28741.3, bombing wing-weeks 538.0.
- Peace settlements per run: 22.0 (5 of 88 shared among several winners); demands won: cede 99, gold 50, reparations 40, renounce 28, disarm 4, sphere 2.
- Guarantees given per run 26.3 (69 of 128 realms gave one), honoured by joining a war 12 times; loans per run 2.8 (9 lenders, 361 crowns lent per run).
- Trade contracts: 765.8 signed per run (128 of 128 realms signed at least one); realms held one in 62.0% of realm-months, 0.97 contracts in force per realm-month; per run 731.0 ran their term, 0.0 ended in default, 0.0 were cancelled; 7575 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 16.9% of army-months at war (1.8% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 1 of 97 ended (1%); idle treasuries (over 10 months of income with a builder free) 0.4% of realm-months.
- Trade blocs: 128 of 128 realms were members (78.2% of realm-months); spheres: 61 realms led one, and realms spent 26.3% of realm-months in another's sphere.
- National focus: 12.0 focuses completed per surviving realm (33% national); 128 of 128 completed national focuses, 42 a claim, 42 their ambition. First generic focuses by branch: army 178, sea 99, industry 46, state 38, diplomacy 23. Doctrines: army_prof 78, army_fortress 50, sea_raid 46, army_offensive 24, army_levy 17, dip_concord 8, sea_battle 1.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 64% sov, 64% sov, 66% sov, 65% sov; economic 85% sov, 83% sov, 85% sov, 85% sov; diplomatic 100%/20% fra, 94%/3% fra, 100%/7% fra, 100%/12% sov.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| gbr | 0 | 23→22.3 | 100% | 0.8 | 0.0/3.3 | 75% | 71.8 |
| irl | 0 | 6→6.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.0 |
| fra | 0 | 95→96.0 | 100% | 2.0 | 14.0/21.3 | 33% | 73.0 |
| ger | 0 | 36→37.3 | 100% | 4.8 | 15.8/8.3 | 34% | 72.8 |
| ita | 0 | 39→39.3 | 100% | 3.3 | 18.3/17.3 | 34% | 72.0 |
| sov | 4 | 146→145.3 | 100% | 2.5 | 14.0/13.5 | 12% | 73.0 |
| pol | 0 | 31→32.8 | 100% | 1.3 | 9.3/6.0 | 9% | 72.3 |
| cze | 0 | 13→12.8 | 100% | 0.3 | 4.5/6.5 | 0% | 71.0 |
| aut | 0 | 6→3.8 | 100% | 0.0 | 1.8/4.3 | 0% | 69.8 |
| hun | 0 | 8→6.3 | 100% | 1.0 | 4.0/6.0 | 8% | 70.0 |
| rom | 0 | 27→29.5 | 100% | 1.8 | 8.5/10.5 | 0% | 72.0 |
| yug | 0 | 20→21.0 | 100% | 1.3 | 3.5/1.5 | 1% | 71.0 |
| bul | 0 | 9→2.8 | 100% | 0.0 | 2.5/6.5 | 11% | 69.5 |
| gre | 0 | 13→14.0 | 100% | 1.0 | 1.0/0.8 | 0% | 71.0 |
| alb | 0 | 2→2.0 | 100% | 0.0 | 0.0/0.0 | 43% | 69.0 |
| tur | 0 | 45→48.5 | 100% | 2.0 | 5.0/0.8 | 4% | 73.0 |
| spa | 0 | 39→43.0 | 100% | 2.0 | 6.3/0.5 | 5% | 72.5 |
| por | 0 | 7→3.0 | 100% | 0.0 | 0.8/6.8 | 17% | 70.0 |
| ned | 0 | 3→2.0 | 100% | 0.0 | 0.8/5.5 | 3% | 69.3 |
| bel | 0 | 2→1.3 | 100% | 0.5 | 2.5/2.3 | 1% | 69.3 |
| lux | 0 | 1→1.0 | 100% | 0.0 | 0.5/2.8 | 7% | 69.3 |
| swi | 0 | 4→5.5 | 100% | 0.0 | 3.3/3.0 | 14% | 70.0 |
| den | 0 | 4→4.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.0 |
| swe | 0 | 22→22.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.8 |
| nor | 0 | 15→15.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.0 |
| fin | 0 | 13→13.0 | 100% | 0.0 | 2.3/0.0 | 0% | 70.8 |
| est | 0 | 5→4.8 | 100% | 0.0 | 1.8/5.3 | 3% | 70.0 |
| lat | 0 | 5→3.8 | 100% | 0.0 | 4.0/6.0 | 4% | 69.8 |
| lit | 0 | 4→3.5 | 100% | 0.0 | 2.0/4.0 | 15% | 70.0 |
| egy | 0 | 7→8.8 | 100% | 0.0 | 4.8/0.0 | 17% | 70.8 |
| irq | 0 | 17→16.5 | 100% | 0.0 | 15.3/3.8 | 0% | 71.0 |
| irn | 0 | 22→22.8 | 100% | 0.0 | 4.0/6.3 | 0% | 71.0 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | sov (score) | 1946.1 | 27 | 148 | — |
| 2 | normal | sov (score) | 1946.1 | 24 | 123 | — |
| 3 | normal | sov (score) | 1946.1 | 23 | 147 | — |
| 4 | normal | sov (score) | 1946.1 | 23 | 182 | — |
