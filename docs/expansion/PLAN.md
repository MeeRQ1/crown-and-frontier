# Strategic depth expansion: plan and requirement ledger

This plan turns Crown & Frontier into a deeper strategy game in six stages. Each stage
ends with a runnable build, its own pull request and concrete checks. No stage is
described as the finished expansion until all of them are done. Evidence for the
priorities is in [AUDIT.md](AUDIT.md). The era and content decisions are in
[SETTING.md](SETTING.md).

## Principles

- **The rules change only on purpose.** Refactors and optimisations must match
  `npm run rulecheck` (identical yearly state checksums on fixed-seed campaigns).
  Intended rule changes are listed in the stage's pull request.
- **Each system ships with its AI, UI, tests and docs in the same stage.** A system the AI
  ignores, or the player cannot see, is not done.
- **Saves are never silently broken.** Every save-format change gets a migration with
  fixtures and a notice. A save that cannot be converted is kept and explained, never
  deleted.
- **Imports are untrusted.** Maps and saves are size-limited, sanitised and validated.
  Their text is only ever rendered as text, and nothing in them is executed.
- **Measured, not claimed.** Each stage re-runs the benchmarks, AI campaign batches, the
  fuzzer and the browser checks, and reports the numbers. Phone sizes in desktop Chromium
  are not real-device validation.
- **Everything is local.** No accounts, backend, paid services or external AI APIs.

## Stages

| Stage | Content | Depends on | Status |
|---|---|---|---|
| **A · Foundations** | Audit; confirmed bug fixes; baselines and tools; derived indexes; versioned map packages; save format 2 with migration; replayable bug reports; setting decision | — | **done** (this pull request) |
| **B · Industrial economy and research** | The new era's calendar; six resources; industry and production; trade as resource exchange; the five-era tree with horizons; data-driven land roster (infantry, cavalry, artillery, engineers, armour); save format 3 with conversion from 1640 saves; built-in maps converted; economy AI | A | **done** (this pull request) |
| **C · War on land, at sea and in the air** | Land depth (frontage by terrain, breakthrough, entrenchment lines, rail logistics, armour); map package v3 with sea zones and ports (v1 and v2 upgraded automatically); fleets, naval combat, transports and invasions, blockades; airfields and air missions (superiority, ground support, interdiction, bombing, reconnaissance); military AI for all three arms | B | **done** (this pull request) |
| **D · Maps** | Map library screen; at least three new fictional maps (small, standard, large); in-browser map editor (provinces, realms, regions, sea zones, routes, validation, export and import); a real-world regional map from Natural Earth (public domain) with attribution; level of detail for large maps | A (format), C (sea zones) | planned |
| **E · Diplomacy, settlements and national focus** | Peace settlements with several parties and graded demands; guarantees, spheres and influence; trade blocs; national focus trees (generic and per-realm), replacing the six policies; diplomacy and focus AI | B, C | planned |
| **F · Onboarding, balance and delivery** | Tutorial and onboarding for every new system; UI pass; AI system-usage reports; balance from AI batches on every map; player-style sessions; screenshots; final docs, attribution, test and performance results, known limitations | B–E | planned |

### Acceptance checks per stage

**A (done)**
- [x] All 11 confirmed bugs fixed, each with a regression test. The tests for bugs 1–5 were
  run against the unfixed simulation and fail there. The browser steps for bug 6 were run
  on a build of 2246696 and show the bug. Bugs 7–11 were confirmed by the evidence in
  AUDIT.md, because their tests use interfaces the old code does not have (save format 2,
  the map validator).
- [x] Benchmarks of three map sizes before and after, for the simulation and the
  browser (`reports/perf/`).
- [x] Six fixed-seed campaigns are rule-identical across the performance work.
- [x] Built-in maps load as validated map packages. Malformed and oversized maps and
  saves are refused with reasons.
- [x] The format-1 fixture save is converted with a notice (unit test and browser check).
  Saves of custom maps carry the map.
- [x] Bug reports from loaded, long and custom-map campaigns replay exactly.
- [x] Typecheck, unit tests, build, ZIP and browser checks pass; the fuzzer reports 0
  findings on both maps.

**B (done)**
- [x] Every built-in map carries the six resources (map format 2, built-in revision 2), and
  the setup screen shows the new start years (map cards and campaign lengths).
- [x] Formats 1 and 2 convert to 3 with notices. A save that cannot convert stays listed and
  exportable: unit tests with three fixtures (format 1 from c29aea6; format 2 built-in and
  custom-map saves from 168569b) and browser checks for both notices and for the
  unconvertible save.
- [x] AI batches (10 seeds per map, `reports/stage-b/`): trade 12.0% (the Reach) and 11.4%
  (Aldmere) of income at year 25 (≤ 30%); 86 of 86 and 140 of 140 surviving realms run
  industry at the end; treasury 4.72× and 3.19× monthly income at year 40 (< 5×); the
  average realm finishes 56.2% and 46.2% of the tree (≤ 70%); the earliest finish was 2 and
  4 years before a horizon (≤ 10).
- [x] Standard-map week 8.48 and 7.17 ms average, p99 21.4 and 16.8 ms (Aldmere, seeds 1–2,
  30 years; ≤ 10 and ≤ 30 ms; `reports/perf/stageB-aldmere.md`). Fastest speed: 36 of 36
  weeks in the browser on the Reach, Aldmere and the 900-province map
  (`reports/perf/web-stageB.md`).

**C (done)**
- [x] Map packages v1 and v2 upgrade to v3 with sea zones: a v2 package and the v1 package
  inside the Stage A custom-map save fixture both gain the Reach's sea zones and ports
  (`tests/naval.test.ts`, `tests/saves-maps.test.ts`). The validator refuses unknown
  zones, one-way adjacency and ports off the coast, with reasons.
- [x] Worked examples (`tests/worked-sea-air.test.ts`, DESIGN.md): a landing fights at 75%
  (Amphibious Warfare halves the penalty); two enemy cruisers blockade a one-zone port
  (crowns −25%, sea trade with an island realm −19%, overland trade untouched) and one
  defending cruiser lifts it; ground support turns a held line into an attacker's win, enemy
  air superiority cuts the support to 40%. Browser flows: a blockade read from the sea-zone
  card, fleet card and Military ledger; ground support and air superiority chosen on the map
  and read from the attack forecast; an army shipped by "Ship by sea" and landed.
- [x] AI batches (10 seeds per map, `reports/stage-c/`): every realm past era III built
  wings and flew missions (85 of 85 on the Reach, 97 of 97 on Aldmere); every coastal
  realm built ships (77/77, 129/129); 74 of 74 and 127 of 128 realms that fought a coastal
  enemy while coastal used their fleets. The exception: Vostmark (Aldmere seed 10), whose
  one cruiser stayed in port against Hrafnmark's stronger fleet. Realms never at war with a
  coastal realm while coastal themselves are listed as builders only (the Reach: Calder ×2,
  Fenward; Aldmere: Istrel). No invariant failures.
- [x] Combat matrix (`tools/matrix.ts`, `tests/matrix.test.ts`,
  `reports/stage-c/combat-matrix.md`): no army composition wins every pairing on every
  terrain, around 1890 or with the whole tree; no fleet wins every pairing, and each fleet
  type wins at least one (carriers lost all four until they were given the opening strike).
- [x] Benchmarks re-run (`reports/perf/stageC-*.md`, `web-stageC.md`): Aldmere 7.97 and
  7.66 ms a week on average, p99 21.3 and 19.1 ms (under 25 ms, so the worker decision
  stands); the Reach 2.8–3.4 ms; 36 of 36 weeks at fastest speed in the browser on the
  Reach, Aldmere and the 900-province map. Three speed-ups to supply and the naval AI are
  rule-identical (`reports/perf/rulecheck-stageC-speedups.json`).
- [x] Fuzzer with naval and air orders: 0 findings on the Reach (seeds 1–7, 10 years),
  Aldmere (seeds 1–2, 8 years) and with the whole tree (`--tech all`). 35 of 35 browser
  checks and 143 unit tests pass.
- Stage B checks on the same batches: trade 14.5% and 12.3% of income at year 25;
  treasury 3.53× and 2.63×; 45% and 31% of the tree; nothing finished more than 4 years
  early; industry in 86 of 87 and 139 of 140 surviving realms at the end (the exceptions:
  Tarsk on the Reach lost its only factory in its last war and went bankrupt; Drevenholt on
  Aldmere was down to one province).

**D**
- At least three new fictional maps validate, have their own campaign style and pass AI
  batches without invariant failures.
- The editor can create a map from scratch, edit an existing one, validate it with
  actionable messages, and export it. Its files import through the same validator.
  Browser flows cover create, edit, export and import.
- The real-world map is built from Natural Earth by a reproducible script. Its attribution
  is shown in the game and recorded in THIRD_PARTY_NOTICES.md.
- Far-zoom frame time on a large map is measured before and after level of detail.

**E**
- Peace settlements with several parties and graded demands, guarantees and influence
  are covered by tests and the AI uses them (system-usage counts).
- Focus trees for every realm on every built-in map; the AI completes focus paths that
  fit its situation.
- Fewer campaigns end on score at the limit than after Stage A (14 of 30 on Aldmere, 21 of
  30 on the Reach); the target is half or fewer on every map.

**F**
- The tutorial covers the new systems. Every system has a ledger and tooltips, and where
  relevant a map mode.
- AI batches on every map: no invariant failures, all systems used, wins spread across
  realms.
- Player-style sessions are recorded with screenshots. Docs, attribution, final test and
  performance results, and known limitations are written.

## Scope decisions

- **Era:** the industrial age, 1870–1955 (SETTING.md).
- **"Settlements"** is read as negotiated **peace settlements** (Stage E). Frontier
  settlement already exists and is extended by the Stage B economy. If a different
  meaning was intended, it can be added to Stage E.
- **The real-world map** uses Natural Earth admin-1 boundaries (public domain; the source
  is reachable from this environment). Region, period and realm treatment are decided in
  Stage D.
- **Policies** are replaced by national focus trees in Stage E, not extended. Two of six
  policies are never used by the AI today.
- **A simulation worker** is not introduced until the measured triggers in AUDIT.md are
  reached.
- **Multiplayer, accounts and online features** are out of scope for every stage, as the
  brief requires.

## Requirement ledger

Status: **done** means implemented and verified in this pull request. **planned** means
assigned to a stage and not started. Nothing has been dropped.

| # | Requirement (from the brief) | Stage | Status | Evidence or acceptance check |
|---|---|---|---|---|
| 1 | Audit first: instructions, rules, tests, diagnostics; play the build | A | done | AUDIT.md |
| 2 | Identify bugs, fragile transitions, dominant strategies, AI weaknesses, performance at several map sizes, UI problems, architecture fitness | A | done | AUDIT.md sections |
| 3 | Confirm issues before fixing them | A | done | AUDIT.md evidence column; bugs 1–5 also by their tests failing on the unfixed code |
| 4 | Concise plan and requirement ledger with dependencies, acceptance checks, scope decisions | A | done | This file |
| 5 | A coherent setting supporting land, naval and air warfare | A (decision), B–C | done | SETTING.md (decisions taken in Stages B and C) |
| 6 | Reproducible baselines: load and creation, tick avg/p95/p99/max, AI, pathfinding, supply, diplomacy, frame times, memory; small, standard and large maps | A | done | `reports/perf/`, `npm run bench`, `npm run bench:web` |
| 7 | Determinism | A, every stage | done | Determinism tests, rule check, fuzzer save/load and repeat checks |
| 8 | Fix important failures | A, every stage | done for all confirmed | AUDIT.md table |
| 9 | Diagnostic export | A | done | `src/sim/diagnostics.ts`, `tools/replay.ts`, tests |
| 10 | Versioned map and content schemas | A (maps v1, saves 2), B (maps v2 with deposits, saves 3), C (maps v3 with sea zones) | done for A–C | `src/maps/`, `src/sim/migrate.ts`; v1 and v2 packages upgrade to v3 (`tests/naval.test.ts`, `tests/saves-maps.test.ts`) |
| 11 | Map library with ≥3 new fictional maps | D | planned | Stage D checks |
| 12 | In-browser map editor | D | planned | Stage D checks |
| 13 | Real-world regional map with licensed data | D | planned | Natural Earth (public domain) |
| 14 | Deeper land warfare | B (roster: engineers, armour, machine guns, breakthrough), C | done | Terrain frontage, breakthrough, entrenchment deepened by Trench Warfare and Elastic Defence, rail and motor logistics (B); landings, air support and interdiction, straits closed by sea control (C); `tests/industry.test.ts`, `tests/worked-sea-air.test.ts`, combat matrix (`tests/matrix.test.ts`) |
| 15 | Navy | C | done | `src/sim/naval.ts`, `src/sim/ai/navy.ts`; `tests/naval.test.ts`, worked examples, browser flows, Stage C checks |
| 16 | Air | C | done | `src/sim/air.ts`; `tests/air.test.ts`, worked examples, browser flow, Stage C checks |
| 17 | About 5–7 resources | B | done | Food, coal, iron, oil, rubber, nitrates; `tests/industry.test.ts` |
| 18 | Industry | B | done | Factories, materiel, shortages; Stage B checks |
| 19 | Trade | B (resource exchange), E (trade blocs) | done for B | Stage B checks |
| 20 | Diplomacy | E | planned | Stage E checks |
| 21 | Settlements | E | planned | Peace settlements (scope decision) |
| 22 | Research | B (land, industry, society), C (naval, air) | done | 73 technologies in five branches, five eras, horizons; Stage B and C checks |
| 23 | National focus trees | E | planned | Stage E checks |
| 24 | AI that uses every system | B–E, measured in F | B and C systems done | System-usage section in every AI report (`tools/usage.ts`) |
| 25 | UI and onboarding | every stage, F | planned | Stage F checks |
| 26 | Stages A–F, each runnable with concrete checks | A–F | A, B and C done | Acceptance checks above |
| 27 | Tests, browser flows, AI campaigns, player-style sessions, screenshots, docs, attribution, test and performance results, known limitations | every stage, F | A–C done for their scope | PR description, STATUS.md, `reports/`, `docs/screenshots/stage-*` |
| 28 | Do not merge or publish without instruction | all | followed | Draft pull requests only |
| 29 | No invented results, untested browser claims or mock interfaces | all | followed | Results come from tools in the repo |
| 30 | No accounts, backend, paid services or external AI APIs | all | followed | Static build, local storage |
| 31 | Preserve saves; versioning, migrations, notices; never silently corrupt or discard | A, B, every later stage | done for A–C | Format 2 and 3 migration tests and fixtures; format-3 saves from before fleets get defaults and a notice; browser checks |
| 32 | No real-device claims from a resized desktop browser | all | followed | AUDIT.md wording |
| 33 | Reject malformed or very large imports; never execute imported scripts | A | done | Validator limits, save limit, tests, text-only rendering |
| 34 | Reviewable pull requests; no silent scope reduction | all | followed | One PR per stage; this ledger |
| 35 | If paused: tested checkpoint, next steps, failures, requirement status | all | followed | STATUS.md "Expansion progress" |
| 36 | No speculative rewrites; no optimisation that changes rules | all | followed | Rule check record |
| 37 | Worker only if profiling justifies it | all | followed | Worker decision in AUDIT.md |

## Next steps (Stage D)

1. A map library screen: built-in and imported maps with size, realms, start year, style
   and a preview; import, export and delete for custom maps.
2. At least three new fictional maps (small, standard, large), each with its own campaign
   style, made with the shared generator core and validated like any import.
3. An in-browser editor: create a map from scratch or edit an existing one (provinces,
   realms, regions, terrain and deposits, sea zones and ports, straits and rivers),
   validation with actionable messages, export and import through the same validator.
4. A real-world regional map built from Natural Earth by a reproducible script, with the
   attribution shown in the game and recorded in THIRD_PARTY_NOTICES.md.
5. Far-zoom level of detail for large maps, measured before and after.
