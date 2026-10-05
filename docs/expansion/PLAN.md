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
| **D · Maps** | Map library screen; at least three new fictional maps (small, standard, large); in-browser map editor (provinces, realms, regions, sea zones, routes, validation, export and import); a real-world regional map from Natural Earth (public domain) with attribution; level of detail for large maps | A (format), C (sea zones) | **done** (this pull request) |
| **E · Diplomacy, settlements and national focus** | Peace settlements with several parties and graded demands; guarantees, spheres and influence; trade blocs; national focus trees (generic and per-realm), replacing the six policies; diplomacy and focus AI | B, C | **done** (this pull request) |
| **F · Onboarding, balance and delivery** | Tutorial and onboarding for every new system; UI pass; AI system-usage reports; balance from AI batches on every map; player-style sessions; screenshots; final docs, attribution, test and performance results, known limitations | B–E | **done** (this pull request) |

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

**D (done)**
- [x] Three new fictional maps validate and have their own campaign styles: the Sundered
  Isles (small, 116 provinces, naval war among islands), the Kharan Steppe (standard, 263,
  war of movement) and the Middle Sea (large, 548, 16 realms around an inland sea). They are
  made by the procedural generator from fixed recipes (`npm run genmaps`, byte for byte).
  40-year AI batches (`reports/stage-d/`, 3 seeds each) show no invariant failures.
  Industry and air are used by every realm. Navy: all coastal realms build ships, and on
  the Isles and the Steppe every realm at war with a coastal enemy used its fleet. On the
  Middle Sea 29 of 31 did; Dijkenland and Agoara did not, once each.
  The first Isles batch found a real bug: a fleet whose transports sank kept more
  regiments aboard than it had room for. It is fixed, with a regression test that fails on
  the old code.
- [x] The editor creates a map from scratch (the generator in a worker), edits an existing
  one (a library map, or a copy of a built-in map), validates it after every edit with
  findings that point at the province, realm or sea zone to fix, and exports it. Files
  import through the same validator. Editing operations are unit-tested
  (`tests/editor.test.ts`). Browser flows (`npm run verify:web`) cover:
  - create, rename, paint, undo;
  - a finding, its Show link, and undo repairing it;
  - save and export, with the file validating and keeping its checksum;
  - delete and re-import;
  - a refused broken file;
  - markup in map text shown as text;
  - playing an editor map;
  - editing a copy of a built-in map.
- [x] The Baltic, 1906 is built from Natural Earth 5.1.2 by `npm run genbaltic`, which
  downloads the layers and checks their pinned SHA-256 sums. It has 233 provinces, 5 realms
  and 42 sea zones. Its attribution shows in the map library, the campaign setup and the
  in-game menu, and is recorded in THIRD_PARTY_NOTICES.md. Four 40-year AI campaigns ran
  with no invariant failures.
- [x] Far-zoom frame time measured on the same build with level of detail off and on
  (`reports/perf/web-stageD.md`): on the 900-province stress map, 103.7 → 33.0 ms average
  (p95 124.5 → 39.4); on the Middle Sea, 36.5 → 25.4 ms.
- [x] Simulation benchmarks run one at a time (`reports/perf/stageD-*.md`): p99 week
  Aldmere 24.1 and 18.3 ms, the Steppe 17.1, the Baltic 19.9, the Middle Sea 31.0 and 31.7.
  Browser: 36 of 36 weeks at fastest speed on the Middle Sea and the 900-province map, so
  the large-map trigger is not reached. The standard-map trigger (p99 above 25 ms) was
  crossed in one of three Aldmere runs (22.0 ms on the Stage C code; 24.1 and 26.2 ms on
  Stage D, with identical rule checksums), so it sits at the edge. Decision: no worker yet;
  re-measured with three runs per standard map after Stage E, and adopted in Stage F if the
  median p99 exceeds 25 ms or the browser drops a week.
- Every built-in map exports and imports again unchanged (unit test). 159 unit tests and
  45 of 45 browser checks pass.

**E (done)**
- [x] Peace settlements with several parties and graded demands, guarantees, influence and
  spheres, loans and trade blocs are covered by tests (`tests/stage-e.test.ts`) and browser
  flows (guarantee, loan, bloc, peace conference, counter-offer, the Diplomacy map's
  legend), and the AI uses them. AI batches at each map's default length, 16 seeds per map
  (`reports/stage-e/`), no invariant failures. Per campaign: 4–19 peace settlements (14–31%
  shared among several winners), 2–9 guarantees, 1–12 loans; 80–94% of realm-months inside a
  trade bloc; 4–20% of realm-months in another realm's sphere. Every demand kind is used,
  though spheres (0–9 per 16 campaigns; none on the Isles and the Baltic) and disarmament
  (0–12) are rare, and guarantees were honoured by joining a war 0–11 times per 16 campaigns.
- [x] Focus trees for every realm on every built-in map: a generic tree of 37 focuses and a
  national branch of 5–7 made from each map (hand-written names on Aldmere, the Reach and
  the Baltic). In the batches every realm completed national focuses, 72–100% of realms took
  a claim (island realms have none to take) and 84–100% completed their ambition; 29–37 focuses per surviving
  realm per campaign.
- [ ] **Partly met.** Campaigns ending on score at the limit, 16 seeds per map: Aldmere 7
  (Stage A: 14 of 30), the Reach 6 (Stage A: 21 of 30), the Kharan Steppe 2, the Baltic 6,
  the Sundered Isles 9, the Middle Sea 9. Fewer than after Stage A on both baseline maps
  (44% and 38% against 47% and 70%), and half or fewer on four maps of six. On the Middle
  Sea no realm comes near the economic or territorial thresholds (the richest holds 9–12% of
  the development against 13.6% needed) and only diplomacy decides; on the Isles Ostmark
  leads but rarely holds a win. Both are Stage F balance items, with map revisions.
  **Met after Stage F:** with the revised Isles (2 of 16) and Middle Sea (8 of 16), score
  endings are half or fewer on every map (see F).
  Rule and AI changes made for this (DESIGN.md, *Victory*): a victory timer pauses instead of
  winding back while a realm is within a tenth of the main measure with every other condition
  met; economic shares in play are 80% of each map's stated share; diplomatic influence
  counts each partner once for its strongest bond plus trade; allies and sphere members are
  not wary of a diplomatic front-runner; the AI pursues the victory it is closest to, keeps
  the peace while it holds or nearly holds a peaceful victory, sends envoys to partners near
  the opinion bar, and demands spheres as a diplomatic or commercial winner.
- [x] Save format 4: format-3 saves convert with a notice, each realm's policy becoming the
  matching completed focus (fixture: a save written by the Stage D build, with a war under
  way). Format-1 and format-2 saves still convert (browser checks).
- [x] Performance, run one at a time on a 4-core Xeon @ 2.1 GHz (`reports/perf/stageE-*`):
  p99 week Aldmere 31.2, 24.7 and 20.7 ms (Stage D code on the same machine 26.1, 22.3 and
  22.2), the Steppe 18.2, 19.3 and 17.5, the Baltic 20.0, 12.3 and 18.0, the Middle Sea 52.7
  and 52.3; 36 of 36 weeks at fastest speed in the browser on the Middle Sea and the
  900-province map (`web-stageE.md`). Median p99 on the standard maps: 24.7, 18.2 and
  18.0 ms, under the 25 ms worker trigger. 183 unit tests and 53 of 53 browser checks pass.

**F (done)**
- [x] The tutorial covers the new systems: 15 steps, each completed by doing it, including
  industry and resources, ships and aircraft, a national focus and how wars end (browser
  check). Every system has a ledger, with reasons and tooltips on its actions; resources and
  sea control have their own map modes (Shift+8, Shift+9), next to supply, economy,
  frontier, diplomacy and military.
- [x] AI batches on every map, 16 seeds each at the default length (`reports/stage-e/` for
  Aldmere, the Reach and the Baltic, `reports/stage-f/` for the three revised maps): no
  invariant failures in 96 campaigns; every system used (industry, navy, air, settlements,
  guarantees, loans, blocs, spheres, focus; sphere and disarmament demands rare). Score
  endings are half or fewer on every map (7, 6, 2, 2, 8 and 6 of 16), which also completes
  the Stage E target.
- [ ] **Partly met: wins spread across realms.** Aldmere, the Reach and the Middle Sea have
  five or six different winners in 16 campaigns; the Isles three (Ostmark 9), the Baltic
  three, and the Kharan Steppe two (Astia and Gorathia 8 each). Recorded as a known
  limitation with the measurements.
- [x] A player-style session in the browser, recorded with screenshots and findings
  (`docs/expansion/SESSIONS.md`, `docs/screenshots/stage-f/`): 13 findings, 12 fixed (eight
  with browser checks, two of which fail on the old layout), one recorded as a limitation.
- [x] Docs, attribution (THIRD_PARTY_NOTICES.md; Natural Earth in the game), final results
  (184 unit tests, 61 of 61 browser checks, fuzzer 0 findings, benchmarks from Stage E with
  unchanged rules) and known limitations (STATUS.md, README.md) are written.

## Scope decisions

- **Era:** the industrial age, 1870–1955 (SETTING.md).
- **"Settlements"** is read as negotiated **peace settlements** (Stage E). Frontier
  settlement already exists and is extended by the Stage B economy. If a different
  meaning was intended, it can be added to Stage E.
- **The real-world map** uses Natural Earth (public domain). Decided in Stage D: the
  Baltic in 1906, after Norway's independence, with five realms (Sweden, Norway, Denmark,
  the German Empire and the Russian Empire, with Finland and the Baltic provinces as part
  of Russia). Borders follow present-day first-level divisions mapped to their 1906 realm
  and province, with the approximations listed in `tools/baltic.data.ts`.
- **Policies** are replaced by national focus trees in Stage E, not extended. Two of six
  policies are never used by the AI today.
- **A simulation worker** is not introduced until the measured triggers in AUDIT.md are
  reached. After Stage D the standard-map trigger is at the edge (one of three Aldmere runs
  above 25 ms, from run-to-run spread on unchanged rules). From Stage E on, it is judged by
  the median of three runs: after Stage E it is 24.7 ms on Aldmere (one run 31.2 ms), so
  the trigger is not reached, and the browser keeps every week on the large maps.
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
| 11 | Map library with ≥3 new fictional maps | D | done | Map library screen; the Sundered Isles, the Kharan Steppe, the Middle Sea (`tools/genmaps.ts`); `reports/stage-d/`; browser flows |
| 12 | In-browser map editor | D | done | `src/ui/editor/`, `src/maps/edit.ts`; `tests/editor.test.ts`; browser flows for create, edit, export and import |
| 13 | Real-world regional map with licensed data | D | done | The Baltic, 1906 from Natural Earth 5.1.2 (public domain), `tools/genbaltic.ts`; attribution in game and THIRD_PARTY_NOTICES.md |
| 14 | Deeper land warfare | B (roster: engineers, armour, machine guns, breakthrough), C | done | Terrain frontage, breakthrough, entrenchment deepened by Trench Warfare and Elastic Defence, rail and motor logistics (B); landings, air support and interdiction, straits closed by sea control (C); `tests/industry.test.ts`, `tests/worked-sea-air.test.ts`, combat matrix (`tests/matrix.test.ts`) |
| 15 | Navy | C | done | `src/sim/naval.ts`, `src/sim/ai/navy.ts`; `tests/naval.test.ts`, worked examples, browser flows, Stage C checks |
| 16 | Air | C | done | `src/sim/air.ts`; `tests/air.test.ts`, worked examples, browser flow, Stage C checks |
| 17 | About 5–7 resources | B | done | Food, coal, iron, oil, rubber, nitrates; `tests/industry.test.ts` |
| 18 | Industry | B | done | Factories, materiel, shortages; Stage B checks |
| 19 | Trade | B (resource exchange), E (trade blocs) | done | Stage B checks; trade blocs (`src/sim/influence.ts`, `tests/stage-e.test.ts`, browser flow, Stage E checks) |
| 20 | Diplomacy | E | done | Guarantees, influence and spheres, loans, trade blocs (`src/sim/influence.ts`); `tests/stage-e.test.ts`; browser flows; Stage E checks |
| 21 | Settlements | E | done | Peace settlements with several parties and graded demands (`src/sim/settlement.ts`); tests; peace conference and counter-offer browser flows; Stage E checks |
| 22 | Research | B (land, industry, society), C (naval, air) | done | 73 technologies in five branches, five eras, horizons; Stage B and C checks |
| 23 | National focus trees | E | done | Generic tree and a national branch for every realm on every map (`src/sim/focus.ts`, `src/sim/data/focus.ts`); tests; Focus ledger; Stage E checks |
| 24 | AI that uses every system | B–E, measured in F | done | System-usage section in every AI report (`tools/usage.ts`); 16-seed batches on every map (`reports/stage-e/`, `reports/stage-f/`); AI war planning stays on bordering realms (STATUS.md, known limitations) |
| 25 | UI and onboarding | every stage, F | done | 15-step tutorial for every system, nine map modes, pause settings, UI fixes from the session; Stage F checks |
| 26 | Stages A–F, each runnable with concrete checks | A–F | done | Acceptance checks above (one Stage F check partly met: wins spread across realms) |
| 27 | Tests, browser flows, AI campaigns, player-style sessions, screenshots, docs, attribution, test and performance results, known limitations | every stage, F | done | PR description, STATUS.md, `docs/expansion/SESSIONS.md`, `reports/`, `docs/screenshots/stage-*` |
| 28 | Do not merge or publish without instruction | all | followed | Draft pull requests only |
| 29 | No invented results, untested browser claims or mock interfaces | all | followed | Results come from tools in the repo |
| 30 | No accounts, backend, paid services or external AI APIs | all | followed | Static build, local storage |
| 31 | Preserve saves; versioning, migrations, notices; never silently corrupt or discard | A, B, every later stage | done | Format 2, 3 and 4 migration tests and fixtures (a format-3 save from the Stage D build); format-3 saves from before fleets get defaults and a notice; browser checks; Stage F map revisions load older saves with a notice (checked with a revision-1 Isles save from the earlier build) |
| 32 | No real-device claims from a resized desktop browser | all | followed | AUDIT.md wording |
| 33 | Reject malformed or very large imports; never execute imported scripts | A | done | Validator limits, save limit, tests, text-only rendering |
| 34 | Reviewable pull requests; no silent scope reduction | all | followed | One PR per stage; this ledger |
| 35 | If paused: tested checkpoint, next steps, failures, requirement status | all | followed | STATUS.md "Expansion progress" |
| 36 | No speculative rewrites; no optimisation that changes rules | all | followed | Rule check record |
| 37 | Worker only if profiling justifies it | all | followed | Worker decision in AUDIT.md |

## After Stage F

The expansion's stages are done. What remains is listed in STATUS.md ("Next steps"): an
external playtest, balance where wins concentrate, cross-browser and device checks, and
hosting only when you decide.
