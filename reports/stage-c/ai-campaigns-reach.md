# AI-only campaign report

Map: reach. Runs: 10 (seeds 1–10, difficulties normal, 40-year limit). Node v22.22.2.

Winners: fen 2, aur 5, mor 1, ser 1, dre 1
Victory paths: diplomatic 2, economic 2, score 6
Average campaign length: 38.2 years; wars per campaign 22.8; average war 8.5 months; peace treaties 37.5; forced peaces 0.0; battles 88.
Coalitions formed per campaign: 2.5; coalition wars: 3.2.
Eliminations per campaign: 0.30; bankruptcies per campaign: 0.20.
Performance: 7.48 ms/tick average, 156 ms worst tick, heap ≈ 50 MB.
Invariant failures: none

## System usage and stage checks

- Trade income at year 25: 14.5% of all income on average (highest single realm 72.2%); check: at most 30%.
- Realms with a trade agreement: 99.8% of realm-months.
- Industry at the end: 86 of 87 surviving realms ran factories in their last month; factories 180 → 1469 (sum over runs); without industry: tar (8 provinces).
- Average treasury at year 40: 3.53× monthly income; check: below 5×.
- Research: the average surviving realm finished 45.2% of the tree; 888 technologies finished in all; at most 4 years before a horizon (check: at most 10).
- Army composition (regiment-months): infantry 64.4%, cavalry 13.9%, artillery 15.5%, engineers 6.2%, armour 0.1%.
- Shortages (share of realm-months): coal 8.3%, iron 0.0%, oil 0.0%, rubber 0.0%, nitrates 0.0%.
- Navy: 77 of 77 surviving coastal realms built ships; 74 of the 74 that fought a coastal enemy while coastal used fleets (away from home waters, in battle, blockading or landing troops); check: all. Never at war with a coastal realm while coastal (built only): cal ×2, fen ×1.
- Air: 85 of 85 surviving realms past era III built wings and flew missions; check: all.
- Totals per run: ships built 109.2, naval battle sides 114.8, landings 7.5, blockade weeks 761.5, fleet weeks at sea 5374.7, wings built 44.5, wing-weeks on missions 21253.4, bombing wing-weeks 103.3.

| Nation | Wins | Avg start→end provinces | Alive % | Avg wars declared | Battles won/lost | Idle army share | Avg techs |
|---|---|---|---|---|---|---|---|
| aur | 5 | 12→16.6 | 100% | 4.9 | 12.8/2.1 | 10% | 35.4 |
| vos | 0 | 11→10.4 | 100% | 3.3 | 13.3/4.4 | 6% | 33.3 |
| ser | 1 | 9→10.0 | 100% | 0.0 | 1.0/8.6 | 37% | 34.5 |
| cal | 0 | 8→6.7 | 80% | 0.2 | 2.1/15.6 | 8% | 32.6 |
| ist | 0 | 8→5.6 | 100% | 0.4 | 2.2/18.5 | 14% | 31.7 |
| dre | 1 | 10→15.3 | 100% | 4.5 | 16.0/10.7 | 1% | 33.0 |
| mor | 1 | 10→9.8 | 90% | 4.8 | 22.8/14.9 | 3% | 31.7 |
| fen | 2 | 7→10.2 | 100% | 0.4 | 2.9/4.8 | 14% | 31.5 |
| tar | 0 | 12→14.4 | 100% | 4.3 | 15.3/9.9 | 8% | 32.1 |

| Seed | Difficulty | Result | Year | Wars | Battles | Eliminated |
|---|---|---|---|---|---|---|
| 1 | normal | fen (diplomatic) | 1929.9 | 21 | 67 | mor |
| 10 | normal | aur (economic) | 1932.4 | 14 | 68 | — |
| 2 | normal | mor (score) | 1935.1 | 20 | 79 | — |
| 3 | normal | aur (score) | 1935.1 | 29 | 77 | cal |
| 4 | normal | aur (economic) | 1932.4 | 23 | 86 | — |
| 5 | normal | ser (score) | 1935.1 | 23 | 105 | — |
| 6 | normal | aur (score) | 1935.1 | 24 | 85 | cal |
| 7 | normal | fen (diplomatic) | 1926.5 | 23 | 78 | — |
| 8 | normal | dre (score) | 1935.1 | 24 | 102 | — |
| 9 | normal | aur (score) | 1935.1 | 27 | 137 | — |
