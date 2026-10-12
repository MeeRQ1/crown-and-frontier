# AI batches for the atlas update

Fixed-seed AI-only campaigns run with `tools/sim-cli.ts`. Every report records the
seed, difficulty and year limit of each run, so any one can be reproduced:

    npx tsx tools/sim-cli.ts --scenario <map> --seeds <a-b> --years <n> --difficulty <d> --quiet --json <out>.json
    npx tsx tools/sim-cli.ts --merge <a>.json,<b>.json,… --out <report>.md

The batches ran three processes at once on a 4-core machine, so their ms/tick figures
are not a performance measurement; [`reports/perf/`](../perf/) holds the isolated
benchmarks.

## The 1936 maps (`1936-europe.md`, `1936-earth.md`)

Ten-year AI-only campaigns on Europe, 1936 (seeds 1–4) and the World, 1936 (seeds 1–3), on
normal difficulty, run one map after the other with nothing else busy:

    npm run sim -- --scenario europe-1936 --seeds 1-4 --years 10 --out reports/ai/1936-europe.md
    npm run sim -- --scenario earth-1936 --seeds 1-3 --years 10 --out reports/ai/1936-earth.md

No invariant failures and no realm eliminated. The Soviet Union leads Europe on score in every
run, and Britain the World. A 1936 start leaves six technologies, so realms finish about
97% of the tree within the ten years.

## The final batches (`atlas-final-<map>.md`)

Run on the final simulation code of this branch (fdb4506; later commits change only
documentation and the browser check). The three new maps run their default campaign
of 30 years; the hand-made maps run 50 years, as in the earlier reports.

| Map | Difficulty | Seeds | Years | Outcomes | Winners | Wars (avg) | Battles (avg) | Realms eliminated | Field armies idle in the rear at war | Realm-months with a contract in force | Invariant failures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| The World | hard | 1–2 | 30 | score 2 | gbr ×2 | 75.0 | 356 | 4 | 41.1% | 67% | 0 |
| The World | normal | 1–8 | 30 | score 8 | gbr ×8 | 73.0 | 342 | 13 | 39.7% | 67% | 0 |
| Europe | easy | 1–4 | 30 | score 4 | rus ×4 | 35.5 | 220 | 3 | 15.6% | 72% | 0 |
| Europe | hard | 1–4 | 30 | score 4 | rus ×4 | 50.8 | 291 | 3 | 10.5% | 70% | 0 |
| Europe | normal | 1–8 | 30 | score 8 | rus ×8 | 45.9 | 254 | 7 | 12.8% | 71% | 0 |
| Hesperia | hard | 1–4 | 30 | score 4 | var ×4 | 34.3 | 294 | 0 | 4.0% | 73% | 0 |
| Hesperia | normal | 1–8 | 30 | score 8 | var ×7, kha | 33.1 | 278 | 0 | 4.0% | 73% | 0 |
| The Middle Sea | normal | 1–8 | 50 | score 8 | tve ×6, brim ×2 | 14.8 | 142 | 0 | 2.6% | 57% | 0 |
| Aldmere | easy | 1–8 | 50 | score 4, economic 4 | les ×4, mor ×4 | 19.9 | 109 | 0 | 10.5% | 83% | 0 |
| Aldmere | normal | 1–8 | 50 | score 5, economic 3 | mor ×8 | 20.4 | 128 | 0 | 4.5% | 85% | 0 |
| Aldmere | hard | 1–8 | 50 | score 6, economic 2 | mor ×7, les | 20.0 | 114 | 0 | 9.2% | 84% | 0 |
| The Baltic | normal | 1–8 | 50 | diplomatic 1, score 7 | rus ×7, swe | 8.9 | 92 | 0 | 3.6% | 78% | 0 |
| The Kharan Steppe | normal | 1–8 | 50 | economic 3, score 5 | ast ×7, pel | 20.0 | 139 | 0 | 3.1% | 50% | 0 |
| The Sundered Isles | normal | 1–8 | 50 | economic 6, diplomatic 1, score 1 | ost ×6, san, ago | 5.4 | 32 | 0 | 5.9% | 63% | 0 |
| The Reach | normal | 1–8 | 50 | economic 4, score 3, diplomatic 1 | dre ×4, aur ×3, mor | 11.3 | 44 | 0 | 4.1% | 83% | 0 |

102 campaigns, no invariant failures. "Score" means the year limit was reached and
the realm with the highest score is named; the others are victories.

**What the batches show**

- **The three new maps end on score.** No realm meets a victory's conditions for its
  full timer within 30 years, and the realm that starts largest leads at the end:
  Britain on the World, Russia on Europe, Varenne on Hesperia in 11 of 12. The
  closest approach is diplomatic: in every campaign some realm meets its conditions
  (Britain on the World; Russia, France, the Ottomans or Luxembourg on Europe), but
  none holds them for more than about half of the 60 months. This is a known limitation: the
  historical maps reward the largest empire on score.
- **Switzerland** is eliminated in 11 of 16 Europe campaigns and 6 of 10 on the World,
  usually by Germany: a weak realm between four powers, with no guarantee that holds.
- **Idle armies on the World** (about 40% of army-months at war) are almost all armies
  with no land route to the enemy (the report separates them): island and overseas
  realms whose wars are across the sea. With the enemy in reach by land the share is
  5%.
- **Research** on the new maps now moves: the average surviving realm ends the 30 years
  with 72% of the tree on Europe and 77% on the World (they start at 56%), and 40% on
  Hesperia (which starts in 1890).

## Earlier batches in this update (`atlas-before-*`, `atlas-after-*`)

8 seeds × 50 years, normal difficulty, on Aldmere, the Reach, the Isles and the Middle
Sea:

- `atlas-before-<map>.md`: `main` at 99e0322, with only `tools/usage.ts` from this
  branch so that the same AI diagnostics are counted.
- `atlas-after-<map>.md`: this branch with trade contracts and the AI change that sends
  armies without an objective to the war.

Compared with the final batches (normal difficulty):

| Map | main (before) | after trade contracts | final |
|---|---|---|---|
| The Middle Sea | score 7, diplomatic 1; idle at war 40.0%; 12.9 wars | score 8; 10.8%; 11.3 wars | score 8; 2.6%; 14.8 wars |
| Aldmere | score 6, economic 1, diplomatic 1; 21.6%; 22.6 wars | economic 5, diplomatic 2, score 1; 10.2%; 16.9 wars | score 5, economic 3; 4.5%; 20.4 wars |
| The Sundered Isles | economic 5, diplomatic 2, score 1; 10.3%; 5.9 wars | economic 4, diplomatic 2, score 2; 8.0%; 6.5 wars | economic 6, diplomatic 1, score 1; 5.9%; 5.4 wars |
| The Reach | diplomatic 6, economic 1, score 1; 4.9%; 13.9 wars | diplomatic 8; 1.2%; 5.9 wars | economic 4, score 3, diplomatic 1; 4.1%; 11.3 wars |

The "after" column shows the side effect that the final batches correct: once a trade
agreement became only the framework for contracts it cost nothing, the AI signed one
with nearly every realm, and each counted toward diplomatic leadership. The Reach then
ended in a diplomatic victory in all eight campaigns and its wars fell from 13.9 to 5.9
a campaign; on the World, before the fix, six of seven campaigns ended in a diplomatic
victory by a small realm (Uruguay three times). Trade agreements now count only while a
contract runs under them (commit fdb4506), and the Reach's wars and outcomes are back
near `main`'s.
