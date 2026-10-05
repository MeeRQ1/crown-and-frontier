# Status

Last updated at **Stage E of the strategic depth expansion** (save format 4, map format 3).
Stages A–E are done in this branch. **This is not the finished expansion:** onboarding,
balance and final delivery (Stage F) are still to come
([docs/expansion/PLAN.md](docs/expansion/PLAN.md)). The
rest of this file below the expansion section describes the redesign release (0.2.0) and
is kept for its evidence. Where a stage changed a fact, it is corrected in place.

## Expansion progress

| Stage | Status |
|---|---|
| A · Foundations | **Done in this branch** (draft pull request, not merged) |
| B · Industrial economy and research | **Done in this branch** (same draft pull request) |
| C · War on land, at sea and in the air | **Done in this branch** (same draft pull request) |
| D · Maps, editor, real-world map | **Done in this branch** (same draft pull request) |
| E · Diplomacy, settlements, national focus | **Done in this branch** (same draft pull request) |
| F · Onboarding, balance, delivery | Not started |

**Stage E delivered:**
- **National focus trees replace the six policies.** Every realm has a generic tree of 37
  focuses in five branches (industry, army, sea and air, diplomacy, state) and a national
  branch of 5–7 made from its map: a heritage fitting its temperament, one or two exclusive
  claims on neighbouring regions, developing its home region, its main deposit, a navy league
  or a railway network, and an ambition that follows its victory path. Aldmere, the Reach
  and the Baltic have hand-written names; other maps, including editor maps, get names from
  their realms and regions. Focus ledger (P).
- **Peace settlements with several parties.** A war leader ends a war for everyone with a
  list of graded demands (provinces, crowns, reparations, disarmament, renouncing claims,
  entering a sphere), each from a loser to a winner. Contribution (battles, casualties,
  ships sunk, enemy land held) sets each winner's fair share; slighted allies resent the
  leader. A refused settlement names the counter-offer the other side would accept; a
  player offered one can strike demands and send it back. A side that holds a war score of
  90 for a year dictates a settlement. Peace conference in the Wars ledger.
- **Influence, spheres, guarantees, loans and trade blocs.** Influence grows from envoys,
  trade, loans, guarantees and alliances; a larger realm with enough of it holds a smaller
  one in its sphere (opinion, no hostile alliances or coalitions, defended when attacked,
  counted toward Diplomatic Leadership). Guarantees of independence call the guarantor to
  arms. Loans are repaid over two years with interest and buy influence. Trade blocs give
  members cheaper purchases, more commerce and shared blockade losses. All in the Diplomacy
  ledger and the Diplomacy map mode.
- **Save format 4:** a format-3 save converts with a notice; each realm's policy becomes the
  matching completed focus (fixture from the Stage D build).
- **AI:** chooses focuses by temperament and situation; dictates settlements by
  contribution and takes the counter-offer it can get; guarantees threatened neighbours,
  lends from large treasuries, founds, joins and grows trade blocs, and builds influence over
  smaller realms with envoys; keeps the peace while it holds a peaceful victory; once a year
  pursues the victory it is closest to among its temperament's path and the territorial and
  economic paths; on the diplomatic path sends envoys first to partners whose opinion sits
  near the bar; as a diplomatic or commercial winner demands a sphere over a smaller loser.
- **Rule changes for victory** (to reduce endings on score): diplomatic influence counts each
  partner once for its strongest bond (an alliance or our sphere 2, our guarantee 1) plus a
  trade agreement; a month in which a condition fails pauses its timer before it decays,
  and a realm within a tenth of the main measure, every other condition met, stays paused;
  allies and sphere members are not wary of a diplomatic front-runner (cap −20); economic
  shares are 80% of each map's stated share.
- **Fixes along the way:** two drafts of the peace conference (two wars led at once) no
  longer reset each other; ticking a box in a decision card redraws it at once.

**Stage E measurements** (details in PLAN.md "E (done)"):
- 183 Vitest tests pass (24 more than Stage D: settlements, influence, guarantees, loans,
  blocs, focus, the format-3 → 4 conversion with a fixture from the Stage D build, and the
  paused victory timer).
- 53 of 53 browser checks pass in headless Chromium 141; eight are new (focus, guarantee,
  loan, trade bloc, peace conference, a settlement struck down to a counter-offer, the
  Diplomacy map's legend, no page errors).
- AI batches at each map's default length, 16 seeds per map (`reports/stage-e/`): no
  invariant failures. Campaigns ending on score at the limit: Aldmere 7 of 16 (Stage A
  baseline 14 of 30), the Reach 6 of 16 (baseline 21 of 30), the Kharan Steppe 2, the
  Baltic 6, **the Sundered Isles 9 and the Middle Sea 9** — half or fewer on four maps of
  six; the two others are Stage F balance work (below).
- System use per campaign (AI only, all maps): 4–19 peace settlements, 14–31% of them shared
  among several winners; every demand kind is used, but spheres (0–9 per 16 campaigns) and
  disarmament (0–12) are rare. 2–9 guarantees and 1–12 loans per campaign. Every realm on
  every map completed national focuses; 72–100% took a claim and 84–100% their ambition.
- Simulation benchmarks, run one at a time on a 4-core Xeon @ 2.1 GHz (`reports/perf/stageE-*.md`;
  a slower machine than Stage D's), p99 week: Aldmere 31.2, 24.7 and 20.7 ms (seeds 1–3; the
  Stage D code on the same machine 26.1, 22.3 and 22.2), the Kharan Steppe 18.2, 19.3 and
  17.5, the Baltic 20.0, 12.3 and 18.0, the Middle Sea (large) 52.7 and 52.3. In the browser
  the Middle Sea and the 900-province map keep 36 of 36 weeks at fastest speed
  (`reports/perf/web-stageE.md`).
- **Worker decision:** the median p99 of three runs is 24.7 ms on Aldmere (trigger: above
  25 ms), 18.2 on the Steppe and 18.0 on the Baltic, and the browser keeps every week on
  the large maps, so the simulation stays on the main thread. Aldmere's median is 11% above
  the Stage D code's on this machine, and one run reached 31.2 ms: Stage F measures again
  at the end.
- Fuzzer: 0 findings on the Reach and the Sundered Isles (seeds 1–3, 10 years), with focus,
  guarantee and loan commands among the accepted ones.
- Screenshots: `docs/screenshots/stage-e/`.

**Stage D delivered:**
- **Six built-in maps.** New: the Sundered Isles (116 provinces, 8 realms), the Kharan
  Steppe (263, 11) and the Middle Sea (548, 16), made by the procedural generator from
  fixed recipes; and **The Baltic, 1906** (233 provinces, 5 realms), built from Natural
  Earth (public domain) by a reproducible script with pinned checksums. Its attribution is
  shown in the game and in THIRD_PARTY_NOTICES.md.
- **Generators:** a shared world generator (Aldmere goes through it byte-identical) and a
  procedural generator. It takes a seed, size, realms, shape, climate, mountains, rivers,
  lakes and frontier; makes realm and place names from nine fictional cultures; gives
  balanced starting sizes and a deposit mix like Aldmere's, with coal for every realm; and
  scales victory thresholds. For real coastlines it adds shore seeds (the drawn coast
  follows the data), land beyond the frame (`~edge`: impassable, never sea, drawn muted)
  and naming by location.
- **Map library** (main menu): every map with a preview, size, difficulty, realms, sea
  zones, start year, style, mechanics and attribution. Play, edit or edit a copy, export,
  import (validated; a clashing id is renamed with a notice), delete. The player's maps
  are kept in the browser apart from saves.
- **Map editor:**
  - New map from the generator, in a Web Worker (6.1 s for 520 provinces in the browser).
  - Painting realms, regions, terrain and deposits; a province inspector; straits, rivers
    and ports; merging provinces; realm, region and map settings; regenerating sea zones.
  - Validation after every edit, with a Show link for each finding.
  - Undo and redo, a kept draft, save to library, export, open file, and play.
- **Level of detail:** at far zoom the realm layers come from a cached image while the
  camera pans.
- **Fixes:**
  - Confirmation dialogs on the menu screens never appeared (deleting a save from the Load
    screen after quitting asked nothing and did nothing). The app now has one dialog layer
    above every screen.
  - Transports sunk with troops aboard could leave a fleet carrying more regiments than it
    had room for (found by the first Isles AI batch). Each fix has a regression check.

**Stage D measurements** (details in PLAN.md "D (done)"):
- 159 Vitest tests pass (16 more than Stage C: editor operations, generated and real
  maps, round-trips, the transport fix).
- 45 of 45 browser checks pass in headless Chromium 141. Ten are new: the library and
  editor flows (create, edit, findings and undo, save and export, delete and re-import, a
  refused file, markup kept as text, play, edit a copy, no errors), plus the save-deletion
  confirmation.
- AI batches, 40 years (`reports/stage-d/`): no invariant failures on the Isles, the
  Steppe or the Middle Sea (3 seeds each) or the Baltic (4 seeds). Industry and air are
  used by every realm. Navy on the Middle Sea: 29 of 31 realms at war with a coastal enemy
  used their fleets.
- Far zoom on the 900-province stress map: 103.7 → 33.0 ms a frame on average with level of
  detail (`reports/perf/web-stageD.md`).
- Simulation benchmarks, run one at a time (`reports/perf/stageD-*.md`), p99 week: Aldmere
  24.1 and 18.3 ms (seeds 1–2), the Steppe 17.1, the Baltic 19.9, the Middle Sea (large)
  31.0 and 31.7. In the browser the Middle Sea and the 900-province map keep 36 of 36
  weeks at fastest speed.
- **Worker trigger:** Aldmere's rules did not change in Stage D (its rule checksums match
  Stage C), yet the same seed's p99 measured 22.0 ms (Stage C code), 24.1 and 26.2 ms
  (Stage D code) on this machine. The 25 ms trigger was therefore crossed in one of three
  runs, by run-to-run spread. The simulation stays on the main thread for now: the browser
  keeps every week, and the slowest weeks are the first AI planning weeks of a campaign. The
  decision is due again after Stage E, which adds focus and settlement planning to the AI:
  three runs per standard map, and the worker comes in Stage F if their median p99 is above
  25 ms or the browser drops a week.
- Screenshots: `docs/screenshots/stage-d/`.

**Stage C delivered:**
- **Sea zones and map format 3.** Zones are generated from each map's coastline
  (`src/maps/seazones.ts`; Aldmere 30 zones, the Reach 13) and stored in the package with
  ports. Format 1 and 2 packages get them on import. The validator checks zones, coasts,
  adjacency, strait control and ports.
- **Navy** (`src/sim/naval.ts`): ports and slipways; transports, torpedo boats,
  cruisers, battleships, submarines and carriers; fleets sailing between zones; three-round
  battles; straits closed by sea control; blockades of crowns and sea trade; armies carried by
  sea and landing under fire; fuel, repair and wear.
- **Air** (`src/sim/air.ts`): airfields; reconnaissance, fighter, ground-attack and bomber
  wings; superiority, ground support, interdiction, bombing and reconnaissance missions
  affecting battles, supply, movement and industry.
- **Research:** 19 naval and air technologies (73 in all).
- **AI** (`src/sim/ai/navy.ts`): fleets by temperament and coastline, peacetime
  stations, sorties, blockades and planned invasions; wings by mix; missions over battles,
  objectives and the border.
- **Interface:** fleets and missions on the map, fleet, sea-zone and wing cards, ports and
  airfields in province cards, "Ship by sea" and mission targeting, the Military ledger's
  Navy and air section, Help.
- **Saves:** format 3 extended; saves from before fleets get ports, home squadrons and a
  notice.
- **Fixes:** troops at sea no longer fight in the port they left (found by the fuzzer); a
  broke AI stands down its smallest army when bankruptcy is about four months away; a
  realm with no industry ranks its first factory highly.

**Stage C measurements** (details in PLAN.md "C (done)"):
- 143 Vitest tests pass (35 more than Stage B: naval 17, air 8, worked sea and air examples
  7, the combat matrix 2, save and map upgrades 1).
- 35 of 35 browser checks pass in headless Chromium 141 (new: a blockade, ground support
  under enemy and then friendly air superiority, and a landing, all through the interface;
  Esc now closes an open ledger before it clears the map selection).
- Benchmarks (`reports/perf/stageC-*.md`, `web-stageC.md`): Aldmere 8.0 and 7.7 ms a week
  on average (p99 21.3 and 19.1 ms), the Reach 2.8–3.4 ms; 36 of 36 weeks at fastest speed
  in the browser on all three maps. The worker decision is unchanged.
- AI batches, 10 seeds per map (`reports/stage-c/`): no invariant failures. Air: every
  realm past era III built wings and flew missions (85/85, 97/97). Navy: every coastal realm
  built ships (77/77, 129/129); 74 of 74 and 127 of 128 that fought a coastal enemy used
  their fleets (the exception: Vostmark's single cruiser stayed in port against Hrafnmark's
  stronger fleet).
- Combat matrix (`reports/stage-c/combat-matrix.md`): no army composition wins every
  pairing on every terrain at either technology level, and no fleet wins every pairing.
- Fuzzer, now issuing naval and air orders too: 0 findings on the Reach (seeds 1–7, 10
  years), Aldmere (seeds 1–2, 8 years), and with the whole tree from the start (`--tech
  all`: the Reach seeds 1–3, Aldmere seeds 1–2). An earlier run found troops at sea fighting
  in the port they left; that is fixed with a regression test.
- Screenshots: `docs/screenshots/stage-c/`.

**Stage B delivered:**
- **The industrial age:** Aldmere starts in 1880 (40/60/70 years), the Reach in 1895
  (25/40/60). Era texts, events (factory strikes, mine disasters, oil booms), nation traits
  and the tutorial were rewritten for the era.
- **Six resources:** food plus coal, iron, oil, rubber and nitrates from province deposits,
  with stockpiles, shortages and their effects. Map format 2 carries the deposits and
  factories; the built-in maps are at revision 2.
- **Industry:** factories (a construction project), coal, materiel, and surplus sold as
  manufactured goods. Units cost materiel and resources; replacements cost materiel.
- **Trade** exchanges real resource surpluses at fixed prices, plus a little commerce. It
  replaces the flat income bonus.
- **Research:** a 54-technology tree in five eras for land, industry and society, with
  horizon years (15% dearer per year early, at most 10 years early).
- **Land roster:** infantry, cavalry, artillery, engineers and armour, data-driven. Machine
  guns cut cavalry; armour breaks through forts and trenches; engineers dig in faster,
  besiege faster and bridge rivers; armour without oil and artillery without nitrates fight
  weaker.
- **AI** for every Stage B system: factories gated on its own coal, resource-aware
  research, unit mix, trade treaties by value. AI reports now include a system-usage
  section (`tools/usage.ts`).
- **Save format 3:** formats 1 and 2 convert with a notice; a save that cannot convert
  stays listed with its reason and can be exported from the load screen.
- **Interface:** an Industry & Trade ledger (I), research by era, resource and factory rows
  on province cards, recruit costs, start years on the setup screen.

**Stage B measurements** (details in PLAN.md "B (done)"):
- 108 Vitest tests pass (20 more than Stage A, among them 14 for industry, resources, trade and the roster, and 3 for format-2 conversion).
- 31 of 31 browser checks pass (new: format-2 conversion notice; an unconvertible save
  listed, refused with a reason and exported).
- AI batches, 10 seeds per map (`reports/stage-b/`): every Stage B check passes, no
  invariant failures.
- Benchmarks (`reports/perf/stageB-*.md`, `web-stageB.md`): Aldmere 8.5 and 7.2 ms a week
  on average (p99 21.4 and 16.8 ms), the Reach 2.3–3.6 ms; 36 of 36 weeks at fastest speed
  in the browser on all three maps. The worker decision is unchanged.
- Fuzzer: 0 findings on the Reach (seeds 1–7, 10 years) and Aldmere (seeds 1–2, 8 years).
- Screenshots: `docs/screenshots/stage-b/` (setup with start years, Industry ledger,
  research by era, province card, format-2 conversion notice).

**Checkpoint for continuing:**
- **Working state:** all of these pass at the end of Stage E.
  ```bash
  npm ci && npm run typecheck && npm test && npm run build && npm run package && npm run verify:web
  npm run fuzz -- --scenario reach --seeds 1-3 --years 10 && npm run fuzz -- --scenario isles --seeds 1-3 --years 10
  npm run genmaps && npm run genbaltic && git status   # regenerated maps are unchanged
  ```
- **Unresolved failures:** none known.
- **Known gaps** (tracked for later stages):
  - Oil, rubber, nitrates and iron are still never short in AI batches; coal is the
    binding resource.
  - The richest heartlands still lead, though less: Morvaine 6 of 16 on Aldmere (5 of them
    on score) and Aurel 6 of 16 on the Reach (4 on score), with five and six different
    winners (before Stage E: Lessia 6 of 10, Aurel 5 of 10). Balance is Stage F's work.
  - Hrafnmark still shrinks on Aldmere.
  - A small coal exporter can draw most of its income from trade, although the average is
    12–15%.
  - Armour stays rare in AI armies (0.1–0.3% of regiment-months): Tanks arrives in 1916,
    late in most campaigns.
  - Stage E batches (16 seeds per map): the Sundered Isles and the Middle Sea still end on
    score in 9 of 16 campaigns. On the Middle Sea no realm nears the economic or territorial
    thresholds; on the Isles Ostmark wins 11 of 16 (4 on the economy, 7 on score). Astia
    wins 9 of 16 on the Kharan Steppe. Diplomatic Leadership is the most common win on the
    Reach (8 of 16), the Middle Sea (7) and the Baltic (10).
  - Every realm joins a trade bloc (80–94% of realm-months); sphere and disarmament demands
    are rare, and guarantees are seldom called on (0–11 times in 16 campaigns per map).
  - The Baltic, 1906: Russia wins on score (6 of 16), Sweden and Denmark diplomatically, and
    Norway and Denmark rarely fight. Some 1906 borders are approximations
    (`tools/baltic.data.ts`).
  - The map editor cannot split provinces, draw coastline or reshape sea zones.
  - The Middle Sea: 2 of 31 realms at war with a coastal enemy left their fleets in port.
- **Requirement status:** PLAN.md's ledger lists every requirement with its stage and
  status. Nothing has been dropped.
- **Next steps:** Stage F, in the order listed at the end of PLAN.md.

## Evidence, kept separate

| Kind | What was done | Where |
|---|---|---|
| Automated tests | **Stage C: 143 Vitest tests** (naval, air, worked sea and air examples, the combat matrix, map upgrades). **Stage B: 108 Vitest tests** (resources, industry, trade, roster, format-2 conversion). **Stage A: 88 Vitest tests** (22 new: the regression tests, save format and migration, map packages, bug-report replays). At the redesign: 66 Vitest tests. The 53 from the previous release still pass, plus new ones: Aldmere's validity, connectivity and homelands; fortified passes; river borders and the river combat rule; Hrafnmark's straits; five AI years on Aldmere; army groups, station orders and waypoints; front detection for multi-front wars; and a real save from the previous release that loads on the Reach, plays a year and re-saves | `tests/`, `npm test` |
| AI-only campaigns | **Stage C:** 10 campaigns per map at normal difficulty, with navy and air usage (`reports/stage-c/`). **Stage B:** 10 campaigns per map at normal difficulty with system usage (`reports/stage-b/`). Before: 30 campaigns on each map (seeds 1–10 × easy/normal/hard): Aldmere 60 years, the Reach 40 years | `reports/ai-campaigns-aldmere.md`, `reports/ai-campaigns.md`, `npm run sim` |
| Browser verification | **Stage C: 35 automated checks, all passing** (blockade, air superiority, landing). **Stage B: 31 automated checks, all passing** (format-2 conversion; unconvertible save kept and exportable). **Stage A: 29 automated checks, all passing** (new: map mode restored after Diplomacy; a format-1 save converted on import with a notice). At the redesign: 27 automated checks, all passing, in headless Chromium 141. Covered: site root and project sub-path (both starting Aldmere), unpacked ZIP, choosing the Reach and a realm in setup, map-mode and navigation keys, iframe (resize, wheel isolation), hidden tab, audio gating, keyboard, slot save/load, export/import, damaged import, blocked storage, five laptop sizes and UI scaling, phone touch, and a performance probe | `reports/web-verification.md`, `npm run verify:web` |
| Screenshots | **Stage A:** the conversion notice for a format-1 save (`docs/screenshots/stage-a/format1-save-converted.png`). At the redesign: before (previous release) and after, from the same scripted tour (Calder, seed 7, 30 weeks), at 1366×768 and 390×844: the Reach (matching pairs) and Aldmere | `docs/screenshots/`, `e2e/capture.mjs` |
| Flows I exercised by script, with screenshots reviewed | Menu → setup (both maps, several realms) → campaign; every ledger at laptop and phone size; army groups and orders; attention list and decisions mid-war; settings, how to play, load; menu, setup and ledgers at phone size | `.scratch` scripts during development; `e2e/capture.mjs` |
| External player feedback | **None.** No one but me has played the redesign. | — |

## The redesign brief: requirement ledger

**Status key:** ✅ implemented and exercised · 🟡 implemented with a known gap · ⏸ not done.

### Interface

| Requirement | Where | Status | Evidence |
|---|---|---|---|
| Inspect the current build before designing | `docs/REDESIGN.md`, `docs/screenshots/before/` | ✅ | baseline tour and written diagnosis |
| Shared design system: tokens, type, components | `src/ui/style.css`, `fonts.ts`, `icons.ts`, `heraldry.ts` | ✅ | one token set; three OFL fonts bundled locally |
| Map-dominant layout, compact controls | `app.ts`, `style.css` | ✅ | laptop and phone screenshots |
| Resource bar: current, net, commitments, urgent problems | `panels/hud.ts` | ✅ | underline states, tooltips with breakdowns, alert chips |
| Context panels with obvious selections and primary actions | `panels/inspector.ts` | ✅ | province and army cards; "March here" |
| Faction identity: heraldry, banners, selected and hover states | `heraldry.ts`, `map/renderer.ts` | ✅ | shields on markers, lists and sheets |
| Tooltips, disabled-action reasons, battle forecasts, diplomatic feedback | `panels/common.ts`, `dom.ts`, inspector, Diplomacy | ✅ | forecasts incl. river crossings; treaty verdicts with reasons |
| Notifications that inform without interrupting | toasts, attention list, decision dock | ✅ | decisions dock above the map; "Later" folds them |
| Restrained motion with reduced-motion support | `camera.ts`, CSS | ✅ | setting plus system preference; backdrop drift stops |
| Discoverable controls and shortcuts | How to play, Help ledger, tooltips | ✅ | keys listed on screen and in the README |
| Menu and setup that communicate identity, map previews, start information | `screens.ts`, `atlas-view.ts` | ✅ | live map preview framed on the chosen realm; neighbours, passes, rivers, frontier, claims |
| Every visible control works or explains why not | throughout | ✅ | disabled buttons carry reasons; verify-web clicks through the main flows |

### Map

| Requirement | Where | Status | Evidence |
|---|---|---|---|
| Coastlines, terrain, borders, colours, labels, capitals, markers, routes, occupation | `map/basemap.ts`, `map/renderer.ts` | ✅ | screenshots at three zoom levels |
| Geographic structure: ranges, valleys, rivers, lakes, seas, landmarks | `tools/aldmere.spec.ts` | ✅ | 4 ranges, 6 passes, 6 rivers, 3 lakes, 6 named seas |
| Features presented as affecting movement or combat match rules | `movement.ts`, `combat.ts`, Terrain legend | ✅ | ranges impassable except passes; river +20%; straits +2 (Hrafnmark 0); no decorative "fords" |
| Zoom-dependent detail (far, medium, close) | `renderer.ts` tiers | ✅ | realm names far; province names, terrain, armies medium; forts, roads, sieges close |
| No overlapping labels | `renderer.ts` | ✅ | one collision list per frame, in order of precedence: markers, capital names, seas, ranges and lakes, realm names (up to four frames each, then shrunk), province names. Realm names fade out as province names take over |
| Smooth pan and zoom, limits, fit, reset, jump to capital, army, battle, alert | `camera.ts`, `mapui.ts` | ✅ | nav cluster and keys; eased flights |
| Panels leave key locations visible | camera insets | ✅ | centring accounts for drawer, inspector, legend and tutorial |

### Larger world

| Requirement | Where | Status | Evidence |
|---|---|---|---|
| About 3× the provinces | Aldmere | ✅ | 298 vs 99 |
| Distinct regions, multiple fronts, passes, interiors, frontier | Aldmere | ✅ | 42 regions; Hollow Vale interior; 34 unclaimed |
| Varied starts with viable options | realm definitions, setup sheet | 🟡 | varied by design; AI results show the wealthy central starts win most (see below) |
| Islands reachable; visible connections match legal routes | generator, `world.ts` | ✅ | test: every province reachable; every strait is an adjacency |
| Rebalanced travel, supply, economy, diplomacy, AI, victory thresholds | config, per-map rules | ✅ / 🟡 | per-map victory thresholds and tech costs; balance skews remain |
| Army grouping, persistent orders, navigation shortcuts, regional summaries | inspector, Military ledger | ✅ | groups 1–9, station orders, Shift+N, fronts and regions |
| AI manages the larger map: supply, fronts, achievable objectives | `ai/` | ✅ / 🟡 | crossroads caution, second-front refusal, front posts; see balance |
| Keep the small map as a quick campaign; shared systems and definitions | `world.ts`, `tools/mapgen/core.ts` | ✅ | one core; the Reach byte-identical |
| Existing saves keep their original map | `save.ts`, test fixture | ✅ | previous-release save loads on the Reach |
| Validate connectivity, starts, pathfinding, supply, AI, completion, saves, rendering | tests, sim batches, verify-web | ✅ | 0 invariant failures in 60 campaigns; tests check that every province is reachable, strait costs and waypoint routes |

### Map options, browser and delivery

| Requirement | Where | Status | Evidence |
|---|---|---|---|
| Map modes with legends and explanations, no hidden information revealed | `map/modes.ts` | ✅ | 7 modes; everything shown is public (as before, no fog of war) |
| Presentation controls, persisted | `settings.ts`, presentation panel | ✅ | labels, terrain detail, borders, armies, patterns, legend |
| Overlays distinct from campaign map choice | modes vs setup | ✅ | modes on the map; map choice only in setup |
| Laptops, Chromebooks, touch; no hover-only essentials | CSS, input | 🟡 | verified at 1024–1920 widths and a 390-px phone in Chromium; **no real Chromebook or touch device** |
| Fast loading; local, licensed assets | fonts, lazy map chunks | ✅ | menu shown in about 120 ms (headless); Aldmere geometry 88 KB gzipped, loaded on demand |
| Accessibility: contrast, UI scaling, ownership beyond colour | settings | ✅ | patterns, UI scale 85–130%, keyboard focus handling |
| Profile, cache, cull; worker only if justified | tiles, caches, heap pathfinding, claim index | ✅ | no worker: see Performance |
| Refreshes don't swallow clicks, reset forms or move focus | `dom.ts` `rebuild` | ✅ | focus and scroll restored; no rebuild while pointer is down |
| Static build, sub-path, iframe, export/import; no backend | unchanged | ✅ | verify-web |
| Draft PR, not merged | PR #2 | ✅ | — |

## Measured performance

| What | Aldmere | The Reach | How |
|---|---|---|---|
| Simulation per week, average (AI running every realm) | 16.7 ms alone; 19.6 ms in the batches | 3.8 ms | per-phase timing script (seed 1, 30 years); `npm run sim`, Node 22, three batches sharing four cores |
| Slowest weeks | p99 37 ms; worst 69 ms (the first AI week). The batches saw one 263 ms week while sharing the CPU | worst 171 ms in the batches | per-phase timing script, 30 years; batch reports |
| Map draw while panning, average (far / medium / close) | 3.0–3.7 / 6.2–6.5 / 2.2–2.3 ms | 2.7–3.8 / 2.9 / 2.5–2.8 ms | two runs, headless Chromium, software rendering, 1366×768 |
| Map draw while panning, p95 | 5.1–6.7 / 17–18 / 6–10 ms | 5–7 / 4–5 / 15–16 ms | same; the high p95 values are terrain tiles being painted as they scroll into view |
| Browser probe at fastest speed | 40–44 fps; map draw 6.4–7.4 ms average (p95 11.5–12.0 ms); 35 weeks simulated in 6.0 s (6 a second is the target); JS heap 15–19 MB | — | `verify:web`, two runs, headless Chromium, software rendering |
| Download: map geometry, gzipped | 88 KB | 75 KB | loaded when a campaign on that map starts |

At the fastest speed (6 weeks a second) Aldmere's simulation takes about 10–12% of the main
thread, so a worker was not justified. A rare slow week (40–70 ms) can drop a frame or two;
that is noted below.

## Balance on the two maps

Both batches are AI-only (every realm run by the AI), seeds 1–10 at each of easy, normal and
hard. The table below is from the redesign release (0.2.0).

**Re-run after Stage A's rule fixes** (same seeds and settings; full tables in
`reports/ai-campaigns-aldmere.md` and `reports/ai-campaigns.md`, no invariant failures):
- **Aldmere:** Lessia 15, Aurel 7, Tarsk 5, Fenward 1, Morvaine 1, Solmarre 1. 16 of 30
  were won by a victory path (economic 9, territorial 5, diplomatic 2) and 14 on score at the
  limit. 48 wars and 315 battles per campaign; no eliminations.
- **The Reach:** Aurel 15, Tarsk 11, Serennes 2, Fenward 1, Drevenholt 1. 9 of 30 were won by
  a path (territorial 6, economic 2, diplomatic 1) and 21 on score. 29 wars and 101 battles
  per campaign.
- The skew towards the richest heartland is unchanged. Stage A fixed bugs and did not
  re-balance; balance work is planned for Stages B–F (docs/expansion/PLAN.md).

| | Aldmere (60 years) | The Reach (40 years) | The Reach, previous release |
|---|---|---|---|
| Winners | Lessia 13, Tarsk 7, Aurel 5, Drevenholt 2, Vostmark 1, Morvaine 1, Solmarre 1 | Aurel 15, Tarsk 8, Fenward 3, Serennes 2, Morvaine 1, Calder 1 | Aurel 12, Tarsk 11, Serennes 2, Drevenholt 2, Fenward 2, Calder 1 |
| Won by a victory path before the limit | 13 of 30 (economic 6, territorial 6, diplomatic 1) | 12 of 30 (economic 5, territorial 4, diplomatic 3) | 7 of 30 |
| Average length | 55.6 years | 36.0 years | 38.1 years |
| Wars / battles per campaign | 45.4 / 325 | 26.8 / 95 | 30.2 / 116 |
| Coalitions formed per campaign | 12.6 | 3.9 | 4.4 |
| Realms eliminated per campaign | 0.07 (Vostmark, twice) | 0.03 | 0.03 |
| Bankruptcies, invariant failures | 0, 0 | 0, 0 | 0, 0 |
| Simulation per week, average | 19.6 ms | 3.8 ms | 3.2 ms |

**What the Aldmere batches showed, and what I changed.** In the first Aldmere batch Lessia won
all 6 campaigns on score, while Morvaine and Hrafnmark collapsed. I made four kinds of change.
Each was checked with a batch on both maps, so that a fix for Aldmere did not break the Reach:

1. *AI caution about open borders.* Realms with many unfriendly neighbours now weigh the
   potential of those neighbours before declaring war, scaled so that a realm with only one or
   two open borders is unaffected. Three other formulas were tried and rejected: counting every
   unbound neighbour gave Tarsk 5 territorial wins on the Reach; switching the weight off
   brought the Aldmere collapses back; counting only hostile neighbours let Aurel win 5 campaigns on Aldmere.
2. *Second fronts.* An AI realm already at war with war exhaustion of 25 or more now declines a
   call to arms that would open a second war.
3. *Front posts.* Idle armies in wartime now cover the front with the largest threat gap. On
   Aldmere most realms have two or three fronts, and armies used to wait at the capital.
4. *Realm and map tuning.*
   - Lessia's lands were made less rich: the Lessian Vale went from wealth 3.5 to 2.7, the
     delta from 3.0 to 2.4, and the upper Aldwater from 2.6 to 2.4 with one province fewer.
     Its barge income fell from +15% to +10%, and it took −15% manpower.
   - Carrow's glens and firths became richer. Its income penalty fell from −15% to −10%, and
     it gained a fortified hill province, Carrick Fell, facing Vostmark.
   - Hrafnmark gained a peninsula province and a fortress on the neck of its peninsula
     (Skjoldheim), plus +0.25 morale.
   - The Ashmark became defensive rather than expansionist.

Between the last two batches the Aldmere winners went from 4 realms to 7, and eliminations
from 0.17 to 0.07 per campaign. Lessia's wins on hard went from 7 of 10 to 2 of 10.

**What remains.** Lessia still wins 13 of 30. I traced two of its wins with
`tools/trace-realm.ts`. In seed 1 it took 29 provinces from Tarsk in three wars, and the
largest single peace gave it 10 provinces. In seed 4 it took 13 from Tarsk and 6 from
Morvaine. The large peaces are Tarsk conceding land that Lessia already occupies. A province's
peace cost is its share of the giving realm's weight, with a floor of 5, so this is the same
proportion a 10-province realm on the Reach concedes. It is not an effect of map size, and I
left the rule unchanged. The underlying cause is economic: the Aldwater valley is the richest
land on the continent, and Lessia fields the largest armies next to Tarsk, whose steppe is
poor. The Reach has the same pattern with Aurel's plains, and so did the previous release.

Three other skews remain:
- **Shrinking realms:** Hrafnmark (14 → 9.3 provinces on average), Vostmark (20 → 15.3), the
  Ashmark (15 → 11.8) and Carrow (13 → 11.9) lose ground on average.
- **Passive realms:** Serennes, Istrel and Solmarre declare almost no wars.
- **Victory thresholds:** I did not lower them to force more path victories; 17 of 30 Aldmere
  campaigns still ended on score at the limit in 0.2.0 (14 of 30 after Stage A).

## Known issues and limitations

- **Balance:** Lessia wins 15 of 30 AI-only campaigns on Aldmere and Aurel 15 of 30 on the Reach (after Stage A; 13 and 15 in 0.2.0): the
  richest heartland wins most often on both maps. Hrafnmark, Vostmark, the Ashmark and Carrow
  shrink on average. The investigation and the rejected fixes are under *Balance on the two
  maps*. These are AI-only samples, not proof of balance, and **no one
  other than me has played either map**.
- **Passive diplomats:** Serennes, Istrel and Solmarre rarely declare war on Aldmere and keep
  armies idle about half of the time. That fits their temperaments, but it means those realms
  rarely take part in the continent's wars unless attacked.
- **Late-game money:** AI treasuries pile up (tens of thousands of crowns by year 60 on
  Aldmere) once development caps and the tech tree run out. Crowns have no late-game sink.
- **Slow weeks:** after Stage A, a simulation week on Aldmere averages about 6 ms with a p99
  of 16 ms, and the slowest week in 30 years was 42 ms (it was 40–77 ms before). See
  `reports/perf/`.
- **Browsers:** only Chromium was verified. There was no Firefox or Safari run, and no real
  Chromebook or touch device.
- **Army glide:** armies move along their route by progress between weeks. There is no
  per-frame animation between ticks.
- **Hosting:** GitHub Pages is still not enabled and no live URL exists.

## Next steps

1. **External playtest** on both maps (3–5 players): readability of the atlas at each zoom,
   whether the setup screen explains starts well enough, and pacing on Aldmere.
2. **Balance:** the wealthy central starts on Aldmere (Lessia, Aurel); small defensive realms
   (Carrow, Hrafnmark); a late-game sink for crowns.
3. **Cross-browser and devices:** Firefox and WebKit runs of `verify:web`; a real Chromebook
   and a tablet.
4. **Hosting:** enable GitHub Pages and verify the live URL.

## Continuation checkpoint

- **Working state:** all of these pass locally.
  ```bash
  npm ci && npm run typecheck && npm test && npm run build && npm run package && npm run verify:web
  npm run sim -- --scenario aldmere --seeds 1-10 --difficulty all --years 60 --out reports/ai-campaigns-aldmere.md
  npm run sim -- --scenario reach --seeds 1-10 --difficulty all --years 40 --out reports/ai-campaigns.md
  ```
- **Unresolved failures:** none.
- **Map changes:** edit `tools/aldmere.spec.ts` (geography, regions, fixed provinces) or
  `src/data/aldmere.ts` (realms), run `npm run genworld`, then `npm test` and an AI batch.
  `tools/trace-realm.ts` follows one realm's wars and gains or losses through a campaign.
