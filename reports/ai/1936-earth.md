# AI-only campaign report

Map: earth-1936. Runs: 3 (seeds 1–3, difficulties normal, 10-year limit). Node v22.22.2.

Winners: gbr 3
Victory paths: score 3
Average campaign length: 10.1 years; wars per campaign 44.7; average war 8.4 months; peace treaties 62.7; forced peaces 0.0; battles 189.
Coalitions formed per campaign: 0.0; coalition wars: 0.0.
Eliminations per campaign: 0.00; bankruptcies per campaign: 0.00.
Performance: 161.34 ms/tick average, 410 ms worst tick, heap ≈ 192 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: n/a (no run reached year 25).
- Realms with a trade agreement: 99.3% of realm-months.
- Industry at the end: 207 of 207 surviving realms ran factories in their last month; factories 438 → 3316 (sum over runs).
- Average treasury at year 40: n/a (no run reached year 40); check: below 5×.
- Research: the average surviving realm finished 97.8% of the tree; 908 technologies finished in all; at most 0 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 59.5%, cavalry 8.3%, artillery 19.4%, engineers 5.8%, armour 6.9%.
- Shortages (share of realm-months): coal 0.2%, iron 0.0%, oil 5.4%, rubber 0.0%, nitrates 0.0%.
- Navy: 172 of 172 surviving coastal realms built ships; 109 of the 121 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops) (not: irn ×3, can ×2, sau ×2, sia ×2, irq ×1, hun ×1, yug ×1); check: all. Never at war with a coastal realm while coastal (built only): ast ×3, bel ×3, cub ×3, ecu ×3, irl ×3, jpn ×3, man ×3, nor ×3, nzl ×3, spa ×3, swe ×3, uru ×3, chn ×2, den ×2, hon ×2, nic ×2, sal ×2, can ×1, cri ×1, gua ×1, ned ×1, sia ×1.
- Air: 207 of 207 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 813.0, naval battle sides 257.3, landings 14.3, blockade weeks 1542.0, fleet weeks at sea 10401.0, wings built 425.3, wing-weeks on missions 52944.3, bombing wing-weeks 836.7.
- Peace settlements per run: 42.3 (12 of 127 shared among several winners); demands won: cede 103, reparations 86, gold 85, renounce 36, sphere 10, disarm 4.
- Guarantees given per run 52.0 (110 of 207 realms gave one), honoured by joining a war 10 times; loans per run 12.7 (23 lenders, 5427 crowns lent per run).
- Trade contracts: 1154.0 signed per run (203 of 207 realms signed at least one); realms held one in 44.3% of realm-months, 0.67 contracts in force per realm-month; per run 1057.3 ran their term, 0.0 ended in default, 0.3 were cancelled; 14467 units shipped per run.
- AI diagnostics: field armies idle in the rear while at war 35.5% of army-months at war (2.8% with the enemy in reach by land, the rest with no land route); pointless wars (no land and no demand changed hands) 0 of 134 ended (0%); idle treasuries (over 10 months of income with a builder free) 4.2% of realm-months.
- Trade blocs: 207 of 207 realms were members (67.5% of realm-months); spheres: 79 realms led one, and realms spent 22.0% of realm-months in another's sphere.
- National focus: 12.0 focuses completed per surviving realm (35% national); 207 of 207 completed national focuses, 96 a claim, 74 their ambition. First generic focuses by branch: sea 213, army 194, industry 118, state 52, diplomacy 44. Doctrines: army_prof 111, sea_raid 85, army_fortress 71, army_offensive 38, dip_concord 16, army_levy 12, sea_battle 4, ind_consumer 1.
- Closest approach to each victory (best condition progress / best timer share, by run): territorial 55% gbr, 55% gbr, 55% gbr; economic 54% gbr, 54% gbr, 54% gbr; diplomatic 100%/12% gbr, 100%/2% gbr, 100%/3% gbr.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| gbr | 3 | 175→173.3 | 100% | 2.0 | 4.3/0.3 | 94% | 73.0 |
| irl | 0 | 2→2.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.7 |
| fra | 0 | 104→102.7 | 100% | 2.7 | 4.7/17.0 | 73% | 73.0 |
| ger | 0 | 25→26.3 | 100% | 3.7 | 11.7/4.0 | 36% | 73.0 |
| ita | 0 | 25→24.0 | 100% | 4.0 | 11.3/0.3 | 62% | 73.0 |
| sov | 0 | 148→154.0 | 100% | 3.0 | 19.7/12.3 | 13% | 73.0 |
| pol | 0 | 16→16.3 | 100% | 2.3 | 7.0/0.7 | 0% | 73.0 |
| cze | 0 | 6→5.3 | 100% | 0.0 | 2.3/4.3 | 4% | 72.0 |
| aut | 0 | 5→4.3 | 100% | 0.0 | 1.3/4.0 | 0% | 71.0 |
| hun | 0 | 4→2.3 | 100% | 1.3 | 3.7/5.0 | 16% | 70.7 |
| rom | 0 | 11→11.3 | 100% | 2.0 | 3.0/2.0 | 0% | 72.0 |
| yug | 0 | 10→10.3 | 100% | 1.7 | 2.3/4.3 | 4% | 72.7 |
| bul | 0 | 4→2.7 | 100% | 0.0 | 0.0/6.7 | 11% | 70.0 |
| gre | 0 | 5→5.3 | 100% | 1.0 | 1.3/1.3 | 0% | 71.3 |
| alb | 0 | 1→1.0 | 100% | 0.0 | 0.3/0.3 | 94% | 70.0 |
| tur | 0 | 20→21.0 | 100% | 2.0 | 4.7/1.0 | 0% | 73.0 |
| spa | 0 | 22→22.0 | 100% | 0.0 | 0.0/0.0 | 0% | 73.0 |
| por | 0 | 17→16.7 | 100% | 1.0 | 4.3/2.7 | 24% | 72.3 |
| ned | 0 | 31→31.3 | 100% | 0.0 | 1.7/1.0 | 35% | 72.7 |
| bel | 0 | 13→13.0 | 100% | 0.0 | 0.0/0.0 | 0% | 72.0 |
| swi | 0 | 3→2.3 | 100% | 0.0 | 0.0/5.0 | 3% | 71.0 |
| den | 0 | 6→6.0 | 100% | 0.0 | 0.0/0.0 | 33% | 71.0 |
| swe | 0 | 6→6.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.7 |
| nor | 0 | 8→8.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.3 |
| fin | 0 | 6→4.0 | 100% | 0.0 | 0.3/8.0 | 0% | 71.0 |
| est | 0 | 2→2.0 | 100% | 0.0 | 0.0/5.0 | 29% | 70.3 |
| lat | 0 | 1→1.0 | 100% | 0.0 | 0.0/4.7 | 48% | 70.0 |
| lit | 0 | 1→1.3 | 100% | 0.0 | 0.0/3.7 | 66% | 70.0 |
| egy | 0 | 12→15.0 | 100% | 0.7 | 2.0/0.0 | 5% | 72.3 |
| irq | 0 | 8→8.7 | 100% | 1.7 | 14.7/1.0 | 0% | 71.7 |
| irn | 0 | 12→8.3 | 100% | 0.0 | 6.3/7.7 | 6% | 71.0 |
| afg | 0 | 4→3.0 | 100% | 0.0 | 1.3/4.3 | 1% | 70.7 |
| sau | 0 | 5→7.0 | 100% | 1.7 | 7.7/5.0 | 13% | 71.0 |
| yem | 0 | 2→1.7 | 100% | 0.0 | 0.0/2.0 | 0% | 70.0 |
| omn | 0 | 2→1.3 | 100% | 0.0 | 0.0/4.3 | 28% | 70.0 |
| nep | 0 | 3→3.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.0 |
| chn | 0 | 96→96.7 | 100% | 1.0 | 8.0/1.7 | 1% | 73.0 |
| man | 0 | 16→16.3 | 100% | 0.3 | 0.7/0.0 | 0% | 73.0 |
| tib | 0 | 4→4.0 | 100% | 0.0 | 0.7/1.3 | 0% | 70.0 |
| mgl | 0 | 4→3.0 | 100% | 0.0 | 0.7/3.0 | 0% | 70.7 |
| jpn | 0 | 22→22.0 | 100% | 0.0 | 0.0/0.0 | 0% | 73.0 |
| sia | 0 | 6→6.0 | 100% | 0.0 | 0.0/0.0 | 67% | 71.3 |
| eth | 0 | 6→6.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.0 |
| lbr | 0 | 1→1.0 | 100% | 0.0 | 0.3/6.0 | 2% | 70.0 |
| saf | 0 | 10→10.7 | 100% | 0.0 | 0.0/0.7 | 0% | 72.0 |
| usa | 0 | 106→106.3 | 100% | 2.0 | 10.7/12.7 | 2% | 73.0 |
| can | 0 | 49→48.7 | 100% | 0.0 | 2.3/1.7 | 0% | 73.0 |
| mex | 0 | 17→17.3 | 100% | 0.7 | 11.7/8.7 | 15% | 71.7 |
| gua | 0 | 1→1.0 | 100% | 0.0 | 0.0/2.3 | 0% | 70.0 |
| hon | 0 | 1→1.0 | 100% | 0.0 | 0.3/0.0 | 14% | 70.0 |
| sal | 0 | 1→1.0 | 100% | 0.0 | 0.7/0.3 | 1% | 70.0 |
| nic | 0 | 1→1.0 | 100% | 0.0 | 0.0/0.0 | 33% | 70.0 |
| cri | 0 | 1→1.0 | 100% | 0.7 | 1.7/0.0 | 5% | 70.3 |
| pan | 0 | 1→1.0 | 100% | 0.0 | 0.7/7.3 | 23% | 70.0 |
| cub | 0 | 1→1.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.3 |
| hai | 0 | 1→1.0 | 100% | 0.0 | 2.0/0.0 | 99% | 70.0 |
| dom | 0 | 1→1.0 | 100% | 1.0 | 0.0/2.0 | 89% | 69.7 |
| col | 0 | 11→11.0 | 100% | 1.3 | 4.3/0.0 | 2% | 72.0 |
| ven | 0 | 5→2.0 | 100% | 0.0 | 1.0/6.7 | 9% | 70.0 |
| ecu | 0 | 4→4.0 | 100% | 0.0 | 0.0/0.0 | 0% | 71.0 |
| pru | 0 | 12→12.3 | 100% | 0.7 | 3.0/4.3 | 7% | 72.0 |
| bra | 0 | 48→52.7 | 100% | 3.0 | 10.0/1.7 | 12% | 73.0 |
| bol | 0 | 8→6.7 | 100% | 0.0 | 0.3/2.3 | 0% | 71.7 |
| par | 0 | 3→3.0 | 100% | 0.0 | 0.0/1.3 | 18% | 71.0 |
| uru | 0 | 2→2.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.3 |
| arg | 0 | 21→22.7 | 100% | 2.7 | 10.3/1.7 | 0% | 73.0 |
| chi | 0 | 10→7.7 | 100% | 0.7 | 3.3/10.0 | 0% | 70.7 |
| ast | 0 | 31→31.0 | 100% | 0.0 | 0.0/0.0 | 0% | 73.0 |
| nzl | 0 | 5→5.0 | 100% | 0.0 | 0.0/0.0 | 0% | 70.7 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | gbr (score) | 1946.1 | 45 | 213 | — |
| 2 | normal | gbr (score) | 1946.1 | 47 | 185 | — |
| 3 | normal | gbr (score) | 1946.1 | 42 | 168 | — |
