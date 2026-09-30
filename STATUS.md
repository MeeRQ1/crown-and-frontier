# Status

Last updated at the release-candidate checkpoint (schema 1, version 0.1.0).

## Evidence, kept separate

| Kind | What was done | Where |
|---|---|---|
| Automated tests | 53 Vitest tests: rule boundaries, the combat worked examples, sieges, diplomacy conflicts, separate peace, stranded armies, rival reactions, elimination, progression, events, victory timing, determinism, save/load equivalence mid-war, replay of player commands, content validation, and 12-year AI campaigns with invariants | `tests/`, `npm test` |
| AI-only campaigns | 30 full 40-year campaigns (seeds 1–10 × easy/normal/hard) through the real simulation | `reports/ai-campaigns.md`, `npm run sim` |
| Browser verification | 25 automated checks in headless Chromium 141: site root, project sub-path, unpacked ZIP, iframe (resize, wheel isolation), hidden tab, audio gating, keyboard, slot save/load, export/import, damaged import, blocked storage, five laptop/Chromebook sizes and UI scaling, phone touch, performance probe | `reports/web-verification.md`, `npm run verify:web` |
| Player-style campaign (my own, not a real playtest) | One full 40-year campaign as Calder (normal, seed 2024), played decision by decision through the same command API the UI uses; the second half partly on a simple autopilot. Findings and fixes below | "Player-style campaign" section |
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

## Player-style campaign (own exercised flow)

This is my own play, not external feedback. I played Calder (normal difficulty, seed 2024,
40 years) through the simulation's command API with a small text harness: I read a digest of
the realm, chose orders, and advanced until the next decision. The harness stops for events,
proposals and urgent news, which covers the UI's default auto-pause settings. From 1648 onward a simple autopilot answered events
and kept construction and research busy, while I made the war, peace and treaty decisions
myself. I did not play it in the browser.

**What happened.**

1. **Opening, 1640–41.** Four trade agreements doubled net income in two months (9 → 21
   crowns a month). I spent the money on development and roads rather than troops.
2. **First war, 1641–42.** Vostmark (expansionist) attacked with 10 regiments against my 8
   and took Harrowgate. A raid into unfortified Faltrip pulled its army off my besieged
   capital, but I still had to cede Harrowgate after three lost battles.
3. **Diplomacy, 1643–58.** With the army capped by manpower at about 9 regiments, I turned to
   diplomacy: envoys, Diplomatic Corps, Resident Embassies and Concert of Crowns. The race for
   Diplomatic Leadership was crowded, with Serennes, Fenward, Istrel, Aurel and Tarsk all
   qualifying at times. Twice (Serennes in 1646, Fenward in 1647) I reset a rival's timer by cancelling my own
   treaties with it, and gave up my own progress to do it.
4. **Wars late in the campaign.** Twice Fenward called me to arms against Vostmark.
   - In 1658 I joined and then made a separate white peace.
   - In 1666 I stayed in instead: a separate peace would have pushed Fenward's opinion below
     the diplomatic threshold. I lost the battle at Caldris, but the war ended without
     Calder losing land.
   - In 1670 Tarsk, a trade partner reacting to my diplomatic lead, attacked. I ceded Pellin
     and 200 crowns.
5. **End, 1680.** I re-qualified and held the diplomatic conditions for 36 of the 60 months
   before the limit. Aurel won on score. Calder survived in 6th place (165 against 318).

**Did decisions matter?** Yes, in every phase:

- trade versus troops early on;
- where to give battle (the forecasts were right each time I checked them);
- raids against unfortified provinces;
- whose treaties to keep or cut in a victory race;
- whether to answer a call to arms or leave it.

**Problems found and fixed in this pass:**

- **Separate peace.** The attacker's "war goals are unmet" penalty was applied to a
  secondary defender who could never meet it. It now applies only to the war's target.
  Leaving a war early now costs 15 opinion with the allies left fighting, so joining a call
  to arms and leaving at once is not free.
- **Rival reaction to a diplomatic leader.** It added alarm, which was shown as "Alarmed by
  their expansion" and formed a coalition "because of rapid expansion" against a realm that
  had not expanded. The alarm and coalition reaction is now reserved for territorial and
  economic leaders. A diplomatic leader faces wariness instead: at most −25 opinion, with
  its own label. Coalition notices now name the real cause.
- **No defensive forecast.** The army panel only forecast battles we start. It now shows
  "Incoming attack", or "If they attack us at …" on an enemy army, from the defender's side.
- **Counterplay was invisible.** The Victory ledger now tells you how to stop the leading
  rival on each path. For diplomacy this includes which partners supply its influence.
- **Unanswerable calls to arms were silent.** When the player could not join an ally's war
  because of a conflicting treaty, only the ally was told. Now the player is told too.
- **Stranded armies.** An AI whose armies were cut off from home kept re-issuing the same
  impossible move every week. That flooded the diagnostics buffer (400 entries) and pushed
  out useful records. The AI now checks the route first. Armies of either side left in a
  friend's land with no legal route home now return under safe conduct.
- **Diplomatic path too hard after the fix above.** With wariness replacing alarm, no AI realm won
  diplomatically in a 30-campaign batch. Every broken streak was a partner's opinion slipping
  below 40, so the partner threshold is now 35. My campaign was played at 40.
- **All research done.** After every technology was researched (about year 32 for rich
  realms), the UI still demanded a new choice and AI realms kept paying for research. Both
  are fixed. The research warning now also says correctly that progress banks up to 60
  points.

**Pacing notes, not changed:**

- The first technology takes about 2 years at default funding. Higher funding is the lever.
- 60-month truces after the 1641 wars produced a 3-year lull. At the fastest speed that is
  about 25 seconds of real time, with events and envoys in between.
- Crowns pile up in peacetime for a small realm whose army is capped by manpower. With both
  construction slots busy I still ran 400–900 crowns late in the game, and nothing but
  research funding and more expensive units soaks that up.

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
