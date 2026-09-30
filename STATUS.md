# Status

Last updated at the release-candidate checkpoint (schema 1, version 0.1.0).

## Evidence, kept separate

| Kind | What was done | Where |
|---|---|---|
| Automated tests | 50 Vitest tests: rule boundaries, the combat worked examples, sieges, diplomacy conflicts, elimination, progression, events, victory timing, determinism, save/load equivalence mid-war, replay of player commands, content validation, and 12-year AI campaigns with invariants | `tests/`, `npm test` |
| AI-only campaigns | 30 full 40-year campaigns (seeds 1–10 × easy/normal/hard) through the real simulation | `reports/ai-campaigns.md`, `npm run sim` |
| Browser verification | 25 automated checks in headless Chromium 141: site root, project sub-path, unpacked ZIP, iframe (resize, wheel isolation), hidden tab, audio gating, keyboard, slot save/load, export/import, damaged import, blocked storage, five laptop/Chromebook sizes and UI scaling, phone touch, performance probe | `reports/web-verification.md`, `npm run verify:web` |
| Flows I exercised by script (with screenshots reviewed) | New campaign → select capital → start a project → recruit → select army → route preview → right-click move → run time → answer proposals and events → every ledger → phone layout; declare war from Diplomacy → march via "Set destination" → battles → peace builder preview and send | `e2e/playthrough.mjs`, `e2e/war-flow.mjs` |
| External player feedback | **None yet.** Whether the game is fun, readable and well paced for real players is untested. | — |

## Requirement ledger

**Status key:** ✅ implemented and exercised · 🟡 implemented with a known gap · ⏸ deferred by design.

### World, map and economy

| Requirement | Module(s) | Status | Evidence |
|---|---|---|---|
| Territory map: ownership, terrain, borders, routes, inspection | `src/data/reach.ts`, `tools/genmap.ts`, `src/ui/map/renderer.ts`, `panels/context.ts` | ✅ | 99 provinces, 9 realms, Greyspine passes test, screenshots |
| 80–120 provinces, 8–12 nations, defensible routes | `reach.ts` | ✅ | scenario test |
| Economy: income, upkeep, investment, recruitment, stockpile limits, deficit stages | `economy.ts`, `military.ts`, `construction.ts` | ✅ | economy tests; debt-stage test |
| Population ↔ output ↔ manpower without double counting | `economy.ts`, `military.ts` | ✅ | "pool never exceeds reserve − serving", recruitment conservation tests |
| Movement: legal paths, terrain/roads/straits, arrival estimates, invalidated routes, crossings | `movement.ts` | ✅ | movement tests |
| Supply: connection, range, capacity, causes and remedies, graduated penalties | `supply.ts`, `military.ts` | ✅ | supply tests; army panel |

### Combat, infrastructure and progression

| Requirement | Module(s) | Status | Evidence |
|---|---|---|---|
| Combat: composition, numbers, morale, tech, terrain, entrenchment, supply, bounded rolls | `combat.ts` | ✅ | three worked examples as tests; `npm run examples` |
| Reinforcement, retreat, surrender, pursuit, casualty accounting, multi-nation sides | `combat.ts` | ✅ | combat tests |
| Occupation and sieges distinct from battles | `siege.ts` | ✅ | siege tests |
| Infrastructure, branching research, policies with cooldowns | `construction.ts`, `progression.ts`, `data/` | ✅ | progression tests |
| Frontier integration and occupation costs (the distinguishing system) | `integration.ts`, `economy.ts`, `supply.ts`, `victory.ts` | ✅ | integration gates in UI and tests |

### Diplomacy, events and victory

| Requirement | Module(s) | Status | Evidence |
|---|---|---|---|
| Diplomacy: relations, NAP, trade, alliance, war, peace, explained acceptance | `diplomacy.ts`, `war.ts` | ✅ | diplomacy tests; acceptance-reasons test |
| Coalitions reacting to expansion | `diplomacy.ts`, `ai/strategic.ts` | ✅ | 6.8 coalitions and 5.2 coalition wars per campaign |
| War goals, war score, exhaustion, separate peace, no unresolvable wars | `war.ts` | ✅ | 0 forced peaces in 30 campaigns; separate-peace test |
| Events with conditions, cooldowns, affordability, no save-scumming | `events.ts`, `data/events.ts` | ✅ | events tests (determinism, cooldowns, defaults) |
| Three distinct victory paths, visible progress, simultaneous and limit rules | `victory.ts`, Victory ledger | ✅ | victory tests; campaigns ended by territorial (5), diplomatic (2), economic (1) and score (22) |
| Understandable defeat; capital loss not instant; post-result continuation | `victory.ts`, `war.ts`, end screen | ✅ | elimination and capital relocation code; end screen |

### AI

| Requirement | Module(s) | Status | Evidence |
|---|---|---|---|
| AI on the same rules and command path | `ai/*`, `commands.ts` | ✅ | AI issues only `applyCommand`; rejected orders logged |
| Strategic, operational and execution layers; utility scores; commitment | `ai/strategic.ts`, `ai/operational.ts` | ✅ | diagnostics; campaigns |
| Four or more personalities; three difficulties by decision quality | `data/personalities.ts`, `ai/common.ts` | ✅ | DESIGN.md tables |
| AI diagnostics | `state.diagnostics`, Chronicle → bug report | ✅ | exported in bug reports |

### Interface, persistence and delivery

| Requirement | Module(s) | Status | Evidence |
|---|---|---|---|
| UI: overview, context panel, ledgers, notifications, visible reasons, overlays | `src/ui/` | ✅ | screenshots; verify:web |
| Time controls, keyboard shortcuts, settings, reduced motion, UI scale, patterns | `app.ts`, `settings.ts` | ✅ | keyboard check; layout checks |
| Tutorial: short, skippable, legal suggestions | `tutorial.ts` | ✅ | suggestions checked against `buildProblem` / `recruitProblem` |
| Save/load, autosave, export/import, versioning, damaged-file handling | `save.ts`, `ui/storage.ts` | ✅ | persistence tests; browser save checks |
| Seeded, persisted PRNG; deterministic replay; reproducible bug reports | `rng.ts`, `replay.ts`, `tools/replay.ts` | ✅ | determinism and replay tests |
| Static build, relative paths, sub-path, iframe, ZIP, CI, Pages workflow | `vite.config.ts`, `tools/`, `.github/workflows/` | ✅ / 🟡 | verified locally; **Pages not yet enabled and no live URL** |
| Performance measured | `verify-web.ts`, `sim-cli.ts` | 🟡 | measured in a container with headless Chromium, **not on a Chromebook** |
| Fog of war | — | ⏸ | deliberately not implemented; stated in Help |
| Naval warfare, multiplayer, espionage, dynasties, production chains | — | ⏸ | out of scope per the brief |

## Milestone exit checks

1. **Playable core.** ✅ You can launch, invest, recruit, move, fight, gain control, settle a war and
   finish or lose a campaign; the AI does all of these unscripted.
2. **Interconnected strategy.**
   - ✅ Economic choices bound war capacity (the budget, manpower and supply caps on the AI army target).
   - ✅ Terrain and supply change battles (worked examples).
   - ✅ Research branches compete (about 9 of 18 techs by year 20).
   - ✅ Treaties change legal actions (pact, truce and alliance tests).
   - ✅ Save/load works mid-war.
3. **Credible opponents.** ✅ The AI fights on several fronts, ends bad wars (51 peace treaties per campaign,
   0 forced), reacts to expansion (coalitions) and pursues victory (rival reactions). 🟡 Winners are
   still concentrated (see below).
4. **Release candidate.** ✅ Tutorial, settings, reports, persistence hardening, static delivery and
   documentation. 🟡 No external playtest yet; no real-device or cross-browser testing.

## Known issues and limitations

- **Balance.** In AI-only play Aurel (14/30) and Tarsk (11/30) win most campaigns, and 22 of 30 end
  at the time limit on score. Calder, Istrel and Fenward usually shrink. Serennes (a diplomat) keeps
  armies idle during 34% of its war weeks: its fronts are usually beyond supply reach. Economic
  victory is now rare (1/30) since Aurel's starting development was lowered. These samples are
  diagnostic, not proof of balance, and **no human has played a full campaign yet**.
- **AI.** It has no naval or strait-crossing strategy beyond normal pathing. It does not anticipate
  the enemy's reinforcements in forecasts. Allies that join defensive wars far from home rarely
  contribute troops.
- **Performance.** A worst-case simulation week took 35–123 ms in CLI batches. That is fine at normal
  speed, but at the fastest speed a rare slow week may skip a frame.
- **Browsers.** Only Chromium was verified. Firefox and Safari are untested; iOS Safari may partition
  or clear storage in iframes.
- **Saves.** There is no migration path yet. Any future schema change must add a migration or refuse
  old saves, which the current code already does with a clear message.

## Next milestone

1. **External playtest:** 3–5 players, one full campaign each, noting confusion points, downtime and
   whether decisions feel consequential.
2. **Balance pass:**
   - AI-only: Aurel's plains advantage (development caps or a stronger constraint); smaller
     defensive realms (earlier alliances, forts at chokepoints).
   - Player: the economic victory threshold.
3. **Cross-browser:** Firefox and Safari runs of `verify:web` (Playwright supports both engines), and a
   check on a real Chromebook.
4. **Hosting:** enable GitHub Pages, verify the live URL, and add it to the README.

## Continuation checkpoint

- **Working state:** all commands below pass locally.
  ```bash
  npm ci && npm run typecheck && npm test && npm run build && npm run package && npm run verify:web
  npm run sim -- --seeds 1-10 --difficulty all --years 40 --out reports/ai-campaigns.md   # about 17 minutes
  ```
- **Unresolved failures:** none.
- **Next concrete task:** gather external playtest notes, then the balance pass above. Change numbers in
  `src/sim/config.ts`, `src/data/reach.ts` and `src/sim/data/personalities.ts`, and re-run the
  campaign batch after each change.
