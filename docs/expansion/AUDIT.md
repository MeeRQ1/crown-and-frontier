# Stage A audit

This audit covers `main` at 2246696 (v0.2, after the redesign). Each finding below was
confirmed with a test, a fuzzer run, a measurement or a browser session before anything
was changed. Findings fixed in Stage A list their regression test. Findings planned for
later stages list their stage in PLAN.md.

## How the audit was done

- **Read** the rules (`src/sim`), the AI (`src/sim/ai`), the tests, DESIGN.md, STATUS.md,
  the browser checks (`tools/verify-web.ts`) and the earlier campaign reports.
- **Played** the production build in headless Chromium at 1366×768: Morvaine on Aldmere,
  through realm setup, the tutorial, every ledger, recruiting, declaring war, moving an
  army, two battles, the war ledger and the chronicle. No console errors occurred. The
  screenshots and notes are kept locally and are not committed.
- **Fuzzed** the simulation through the command boundary (`npm run fuzz`). Random legal
  and illegal player commands ran on both maps (Reach seeds 1–7, Aldmere seeds 1–3, about
  8–10 years each). Every 4 weeks it checked the invariants, rejected-command purity,
  save/load continuation and determinism.
- **Measured** every phase of the weekly tick and the key calls on three map sizes,
  including a generated 900-province map (`npm run bench`, `npm run genstress`). In the
  browser it measured load, panning per zoom tier, map modes, ledgers, fastest speed,
  battles and a 10-year session (`npm run bench:web`).
- **Probed balance** with AI-only campaigns: income sources, research completion,
  treasuries and policy choices at years 10, 25 and 40 (2 seeds × 2 maps). It also used
  a combat matrix of equal-cost armies on three terrains, and the 30-campaign AI reports
  in `reports/ai-campaigns*.md`.

## Confirmed bugs, fixed in Stage A

| # | Finding | Evidence | Fix | Regression test |
|---|---|---|---|---|
| 1 | The manpower pool stayed above its cap ("reserve minus men serving") after occupation or lost integration. The Realm ledger states the cap as a rule. | Fuzzer: 357 and 360 findings in two Reach runs (seeds 1–3 and 4–7) and 197 on Aldmere (seeds 1–3), e.g. Fenward's pool 1,631 against a cap of 148. | The monthly settlement trims the pool, and the owner's pool is trimmed at once when a province is occupied. | `economy.test.ts` "a shrinking reserve shrinks a full manpower pool". The fuzzer finds 0 on Reach seeds 1–7 and Aldmere seeds 1–2; it now tolerates up to 2% + 50 men of drift, because population and integration settle after the economy within the same month |
| 2 | Men lost to pursuit and surrender did not add to war exhaustion, so a rout cost the loser less than a long fight. | `combat.ts`: only the per-round loss path added exhaustion. | All battle losses go through one `recordLosses` helper. | `combat.test.ts` "every man lost in battle adds to war exhaustion…" |
| 3 | Peace offers and calls to arms outlived the war or the separate peace they referred to, until they expired. | Fuzzer: "proposal … refers to an ended war" on both maps. | A peace or the end of a war drops proposals that no longer apply. | `siege-diplomacy.test.ts` "a peace removes offers…" |
| 4 | The yearly "you may join a coalition" notice never fired. | The check `(tick / 4) % 12 === 0` runs inside the monthly phase, which only runs when `tick % 4 === 3`. | Uses the calendar month. | `siege-diplomacy.test.ts` "…told once a year that a coalition is possible" |
| 5 | The AI's yearly "war considered" diagnostic used the same test, so it only fired for realms whose staggered turn fell in week 1. | Same expression in `ai/strategic.ts`. | Uses the calendar month. | `persistence-ai.test.ts` "every realm … explains a war it declined at most once a year" |
| 6 | Opening Diplomacy (or Wars) switched the map mode permanently and saved the switch in settings. | Browser, the same steps as the new check on a build of 2246696: terrain → diplomacy → still diplomacy after closing. | Closing the ledger restores the replaced mode, unless the player chose another one meanwhile. | `verify:web` "Closing Diplomacy restores the map mode it replaced" |
| 7 | Bug reports from a loaded game could not be replayed: the replay started from a fresh game without the earlier commands. | `tools/replay.ts` itself warned that a loaded game diverges. | The report carries the save the game was loaded from as a checkpoint. | `saves-maps.test.ts` "a report from a loaded campaign replays…" |
| 8 | The command log kept the last 2,000 commands, so reports from long campaigns could not be replayed either. | `commands.ts` spliced the oldest entries. | A full log rolls over to a checkpoint. | `saves-maps.test.ts` "a full command log rolls over…" |
| 9 | Continuing after the campaign result changed state outside the command log, so replays diverged. | `app.ts` set `continueAfterResult` directly. | It is now a logged `continueCampaign` command. | `saves-maps.test.ts` "playing on after the result is a logged command" |
| 10 | 8 visible land borders on the built-in maps were shorter than the route threshold: they were drawn as borders, but armies could not cross them. | The new map validator: "visible border is not a route". | Map generation draws such contacts as a corner. The maps were regenerated; their adjacency is unchanged. | Built-in maps validate with 0 errors (`saves-maps.test.ts`) |
| 11 | Saves recorded only the map id, so a later change to a map would silently reinterpret old campaigns. | `save.ts` stored `scenarioId` only. | Save format 2 records the map fingerprint and embeds custom maps. Format-1 saves are converted with a notice. | `saves-maps.test.ts` (8 tests); `verify:web` "A format-1 save is converted on import, with a notice" |

Hardening with no confirmed exploit: the DOM helper's unused `innerHTML` option was
removed. Map and save text can only become text nodes. Realm colours are validated as
`#rrggbb` before they reach SVG attributes.

Fixes 1–5 change rules on purpose. The rule-equivalence record
(`reports/perf/rulecheck-2246696.json`) therefore matches only the commits before them.

## Fragile transitions

- **War endings.** Separate peace, full peace, forced peace and elimination each edited
  wars, proposals and armies in their own way. Stage A made all of them advance the state
  revision and drop stale proposals, and the derived indexes are checked against a full
  scan in every invariant check. Any new war-ending path must call `bump`. A missed
  invalidation fails `checkIndexes` in tests and AI campaigns.
- **Loading.** The UI used to trust the scenario id. Loading is now one function
  (`readSave`): parse, migrate, validate an embedded map, check the fingerprint, check
  invariants, then checkpoint.
- **Direct state edits** outside commands make replays fail. Stage A removed the only one
  in the UI. Tests that edit state directly must call `bump`/`touchArmies` (documented in
  `src/sim/index.ts`).

## Dominant strategies and balance

Measured in AI-only campaigns. These findings shape later stages; they are not changed in
Stage A.

- **Trade agreements are a dominant choice.** At years 10, 25 and 40, trade agreements
  are 47–56% of an average realm's income. A realm holds on average 6.9–7.6 pacts of a
  possible 8 on the Reach, and 11.9–12.7 of 13 on Aldmere: a pact with almost everyone.
  A pact has no cost and no exposure. *Stage B:* trade becomes an exchange of resources.
- **Research runs out.** AI realms finish on average 17.2–17.9 of the 18 technologies in
  60-year Aldmere campaigns (`reports/ai-campaigns-aldmere.md`). In the economic probe the
  average at year 40 was 17.4 and 17.3 on Aldmere, and 16.7 and 11.7 on the Reach. *Stage B:* a five-era tree of 60–80 technologies with horizons;
  *Stage E:* national focus trees.
- **Treasuries pile up.** The average treasury on Aldmere is 962–1,148 crowns at year
  10 and 8,410–9,287 at year 40. There is nothing worth buying late in a campaign.
  *Stage B:* industry and resource spending.
- **Army composition is solved.** In a combat matrix of equal-cost armies, foot with guns
  at 2:1 and the balanced 6:2:2 mix are the best compositions on every terrain. As
  attackers they beat every army without guns on plains and forest, and they inflict the
  best loss ratios everywhere. Pure guns lose every pairing. Horse only pays off on
  plains. Morvaine starts with guns at the 30% cost floor: −25% from its trait, −30% from
  three iron provinces and −15% from Martial Levy. Even then the matrix barely changes, so
  composition decides, not price. *Stage C:* roles with real trade-offs (frontage, terrain, breakthrough,
  armour, air support).
- **Two of six policies are never chosen by the AI.** Frontier Settlement and Royal
  Academy appeared in none of the 12 economic snapshots. Mercantile Charter, Martial Levy,
  Fortress Doctrine and Concord were chosen. *Stage B/E:* policies fold into the national
  focus and economy systems.
- **Campaigns are decided on points, not victory paths.** At 2246696, 17 of 30 Aldmere
  campaigns and 18 of 30 Reach campaigns ended on campaign score at the time limit
  (Stage A's re-run is in STATUS.md). One realm wins
  13 of 30 on Aldmere (Lessia) and 15 of 30 on the Reach (Aurel). Eliminations are
  rare: 0.07 and 0.03 per campaign. *Stage E/F:* victory thresholds and AI goal pursuit
  are re-tuned after the new systems land.

## AI weaknesses

- **Passive realms.** On Aldmere, Serene League, Istrel, Solmarre, Carrow and Fenward
  declare 0.0–0.1 wars in 60 years. Serene League and Solmarre keep 58–59% of their army
  idle, and Istrel keeps 44%. Their personalities ("commercial", "defensive") never find a
  war worth its risk, and they have no non-military way to grow except trade, which every
  realm already maxes.
- **No use of the economy late in a campaign.** Treasuries pile up (above), and the AI has
  no spending goal once its build slots are full.
- **Diagnostics were partly silent** (bug 5), which hid the passive realms' reasoning.
- *Planned:* every new system ships with its AI in the same stage. Stage F adds AI
  campaign reports that count how much each realm uses each system (industry, trade,
  navy, air, focus trees, diplomacy), so "the AI uses every system" is measured, not
  claimed.

## Performance

All numbers come from one machine (4-core Xeon 2.1 GHz, Node 22, headless Chromium with
software rendering). The tools and the full reports are in `reports/perf/`.

### Simulation (AI-only, all realms AI)

| Map | Version | World build | Week avg | p95 | p99 | Max | Heap at end |
|---|---|---|---|---|---|---|---|
| Reach (99 provinces, 9 realms) | 2246696 | 4.1 ms | 2.8–3.0 ms | 5.3–6.5 | 6.8–9.2 | 31 | 14 MB |
| | Stage A | 0.4 ms | 1.9–2.1 ms | 3.3–4.0 | 4.1–5.8 | 20 | 14 MB |
| Aldmere (298, 14) | 2246696 | 25 ms | 13.6–14.1 ms | 23–26 | 30–40 | 77 | 18 MB |
| | Stage A | 3.5 ms | 5.8–6.5 ms | 10.6–10.7 | 15.6–15.7 | 42 | 15 MB |
| Stress (900, 24; generated) | 2246696 | 263 ms | 125 ms | 238 | 296 | 377 | 60 MB |
| | Stage A | 34 ms | 29 ms | 52 | 66 | 89 | 18 MB |

The baseline profile of the stress map showed where the time went: full scans of armies
per province, provinces per owner and wars or treaties per pair; a per-province hop table
(the 263 ms world build and most of the 60 MB heap); and a linear-scan Dijkstra in
supply. Stage A replaced these with derived indexes, a flat hop matrix and a binary heap.
The rules are unchanged: six fixed-seed campaigns have identical yearly state checksums
before and after (`npm run rulecheck`). The AI is now about two thirds of the remaining
weekly cost on large maps (operational planning shows up in the spikes). That is the
next target if larger maps need it.

### Browser (production build)

| Map | First frame | Fastest speed (36 weeks in 6 s) | Frame p95 at fastest | Heap over 10 years |
|---|---|---|---|---|
| Reach | 339 ms | 36/36 | 21 ms | 12–16 MB |
| Aldmere | 590 ms | 36/36 | 31 ms | 18–27 MB |
| Stress 900 | 1,301 ms | 36/36 | 55 ms | 32–45 MB |

The DOM size stays at about 215 nodes for the whole session, so nothing leaks.
Every ledger opens in under 4 ms except Victory: 24–28 ms on a cold open, 8–17 ms warm.
A profile shows the Victory cost is mostly the layout forced by the inset measurement,
plus the DOM rebuild. Stage A removed a triple evaluation of victory progress. In one
profiling run on an unminified build, the cold open went from 24.7 to 19.7 ms.

**Far zoom on a 900-province map** takes 84 ms per frame while panning, but the draw call
takes only 4 ms. A CPU profile shows about 2 ms of JavaScript per frame. The rest is the
browser's native work, mostly rasterising the canvas paths in software. This is a
headless software-rendering result. It cannot stand for GPU devices, and no real-device
claim is made. *Stage D (large and real-world maps):* a level-of-detail path set for far
zoom (merged realm outlines, simplified borders) before large maps ship.

### Worker decision

The simulation stays on the main thread for now. On the built-in maps, a week at the
fastest speed costs 2–6 ms on average and at most 16 ms (p99 on Aldmere), and the game
keeps 36 of 36 weeks in the browser. Only the 900-province map shows stutter (p95 frame
55 ms), and its cost is split between AI spikes and rasterisation. A worker would help
only the first, at the price of copying the state that the UI reads directly today. This
is revisited with numbers after Stage C (navy and air add cost) and Stage D (large maps).
The trigger is a standard-map p99 week above 25 ms, or large-map fastest speed falling
below 36 of 36 weeks.

## UI findings

- Map-mode persistence after ledgers (bug 6, fixed).
- The Victory ledger is the only slow ledger (above).
- The save list could not show saves of maps outside the build. It now shows a custom
  map's name, and such saves are loadable because they carry the map.
- *Planned with each stage:* every new system gets its ledger section, map mode and
  tooltips in the same stage. Stage F revises the tutorial and onboarding for the new
  systems. Phone layouts are checked only at phone sizes in desktop Chromium, never as
  real-device validation.

## Architecture fitness for the expansion

**Holds up well:**
- A deterministic headless simulation. Every action passes `checkCommand` and
  `applyCommand`, the AI included.
- Separate PRNG streams, invariant checks, save/load continuation, and tests that ban
  wall-clock time and `Math.random` in the rules.
- After Stage A: derived indexes with checked invalidation; versioned map packages with a
  sanitising validator and import limits; save format 2 with migrations; replayable bug
  reports; measurement tools for every stage.

**Must change for the expansion** (planned in PLAN.md):
- **Unit types are hard-coded** as `foot | horse | guns`, in 34 type references and 32
  literals across combat, config, AI and UI. *Stage B/C:* a data-driven unit roster keyed
  by role and era.
- **One resource per province** (`grain | iron | horses | goods`) and a crowns, supplies
  and manpower economy. *Stage B:* six resources, production and industry.
- **No sea zones.** Straits are province-to-province edges, and fleets need their own
  nodes. *Stage C:* map package v2 adds sea zones and ports, with an automatic upgrade
  from v1.
- **No air layer.** *Stage C:* airfields and missions over provinces and sea zones.
- **A flat technology list** (18) and six policies. *Stage B/E:* era tree with horizons;
  focus trees.
- **Bilateral peace with simple terms.** *Stage E:* settlements with several parties.
- **The UI reads simulation state directly.** That is simple and fast, but it is the main
  cost of a future worker (see the worker decision above).
