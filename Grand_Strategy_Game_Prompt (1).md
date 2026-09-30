# Browser Grand Strategy Game — Design, Build, and GitHub Delivery Brief

<role>
Act as the lead designer and engineer for an original single-player grand strategy game. Own the integration of gameplay, simulation, AI opponents, interface, persistence, testing, and delivery. Make concrete decisions and build a playable game; do not stop at a design document or a visually impressive mockup.
</role>

<objective>
Create an approachable but strategically deep game about developing, defending, and expanding a nation in a changing world of competing AI powers. Campaigns should produce stories through interacting systems: economic investment creates military opportunities, conquest strains manpower and administration, and threatening expansion encourages diplomatic resistance.

The finished game must be an original, maintainable HTML5 browser game with a complete GitHub-ready source project. Players open a hosted HTTPS link and play without installing software, creating an account, or running a local server. Target everyday laptops and Chromebooks, including school devices where games are permitted and the host is accessible. It is not a Roblox experience or a native desktop application. Do not assume Luau or Roblox services. Use original names, maps, presentation, and assets. Broad genre conventions are acceptable; do not reproduce another game's distinctive content or interface.
</objective>

## 1. How to execute this brief

1. Inspect the available workspace, tools, runtime, existing code, and project instructions before selecting a stack. Respect an existing usable project rather than replacing it unnecessarily.
2. Identify genuine blockers. Ask only questions whose answers materially change implementation and cannot be resolved safely from context. Otherwise choose reasonable defaults, record them, and proceed.
3. Write a concise, implementable design and architecture, then build the smallest complete campaign loop in the same working session when tools permit. Do not spend the entire session planning.
4. Complete each milestone, run its checks, fix failures, and then extend the game. Maintain a runnable build throughout development.
5. Track requirements and implementation status in project files. If context or execution limits require a pause, leave a tested build and a precise continuation checkpoint.

Treat this brief as project requirements, not a request for a single giant code response. Work across multiple iterations if necessary. Never claim a system is implemented because its menu, data structure, or design exists.

If you have no filesystem or execution tools, say so briefly. Select one stack and deliver complete files for the first playable milestone, with setup commands and checks the user can run. Do not pretend to have executed them. Subsequent responses should extend that same project.

## 2. Priority and scope

When requirements compete, prioritize:

**Correct playable loop → readable decisions → credible AI → system interaction → usable interface → content variety → audiovisual polish.**

Usability and testing begin with the first milestone; they are not postponed until the end. Prefer fewer functioning systems to many unfinished systems. A necessary simplification must be explicit in the scope ledger, with its gameplay consequence and remaining work.

### Required final systems

- Strategic territory map with ownership, terrain, borders, meaningful routes, and province inspection.
- Economy, population/manpower, recruitment, army movement, context-sensitive combat, and simplified supply.
- Infrastructure, branching research, national policies, and occupation/integration costs.
- Diplomacy, wars, peace agreements, alliances, and reactions to threatening expansion.
- AI nations that use the same action rules as the player, with distinct priorities and difficulty settings.
- Conditional events with choices, multiple victory paths, understandable defeat, and an endgame that avoids repetitive cleanup.
- Onboarding, explanatory tooltips and reports, time controls, settings, save/load, and a campaign summary.
- Automated simulation checks, AI-only campaign runs, diagnostic tools, and reproducible bug reports.

### Explicitly outside the initial scope

Multiplayer, tactical battle scenes, naval warfare, espionage, character dynasties, detailed production chains, individual population simulation, 3D environments, live services, and external AI APIs. These are possible future extensions, not prerequisites. Do not add them to compensate for weak core gameplay.

## 3. Product defaults

These are initial design targets, not claims about measured performance. Keep numeric values in configuration and revise them using evidence.

| Dimension | Initial target |
|---|---|
| Setting | Original fictional world with a consistent preindustrial or early industrial military theme; choose one |
| Presentation | Browser-first 2D strategic map with pan, zoom, readable borders, and army markers; responsive desktop and touch layouts |
| World | Approximately 80–120 provinces, 8–12 nations, and several defensible regional routes |
| First playable milestone | Approximately 24–36 provinces and 4 nations |
| Campaign | Roughly 45–90 minutes at normal play; configurable campaign limit prevents endless stalemates |
| Time | Pausable real time over fixed simulation ticks; normal and accelerated speeds |
| Resources | Treasury, supplies, and manpower; research progress is a process, not another generic currency |
| Army composition | Three unit roles with understandable strengths and costs |
| Progression | Approximately 12–18 technologies across three focused branches |
| Policies | Approximately 4–6 national priorities with clear benefits, costs, and switch restrictions |
| Events | Approximately 12–20 condition-based events with meaningful choices |
| Victory | Three materially different routes, all visible in the interface |
| Difficulty | Three levels, primarily differentiated by decision quality |

Use a graph of provinces as the authoritative world topology. Render it as a coherent territorial map rather than a disconnected node diagram. A handcrafted map with seeded content variation is acceptable; procedural geometry is optional. Ensure every starting nation has a viable strategic choice and no accidental geographic deadlock.

Use a browser-native stack. The default is TypeScript with Vite, a Canvas 2D strategic map, and HTML/CSS interface panels. Keep the simulation independent of browser APIs so it runs headlessly in tests. Adopt an existing compatible web project where available. Use a rendering library only when it solves a concrete problem; avoid a native engine export or large dependency chain without a demonstrated need.

The production build must be static files with an `index.html` entry point and locally bundled assets. Core gameplay, AI, and saves must run client-side without a backend, API keys, remote AI, or a required CDN. Development tools may use npm, but players must never need Node.js or terminal commands. Locally serving the downloaded build is a supported developer/self-hosting option; do not promise that opening `index.html` through `file://` works unless tested. Offline caching is optional; reliable hosted browser play is mandatory.

### Browser hosting, GitHub, and game portal delivery

Deliver two distinct outputs from the same source: a GitHub-ready project for editing and rebuilding, and a production web build for playing and hosting.

- Include source, assets, dependency lockfile, useful `.gitignore`, reproducible install/build/test commands, and deployment instructions. Exclude secrets, `node_modules`, and unrelated generated files. Document original and third-party asset licenses. Leave the choice of public/private repository and source license to the owner.
- Support static hosting, including GitHub Pages project subpaths. Use configured base paths or relative assets; do not hard-code a root-domain URL. Prefer a single-page game without server-dependent routing.
- Prepare a GitHub Actions workflow to test and build the project, with a documented Pages deployment path. Do not create a repository, push code, enable public hosting, or claim a live URL unless the user authorizes it and the tools permit it. A ready-to-deploy project is still a concrete required deliverable.
- Verify the production build over HTTP, both at the site root and a project subpath. Include a portable ZIP of the production files for hosts or portals that accept HTML5 uploads, with `index.html` at its entry root.
- Support iframe embedding: adapt to container size, prevent game controls from unintentionally scrolling the page, handle focus changes, and pause appropriately when the tab is hidden. Do not assume fullscreen permission or unrestricted storage.
- Bundle essential assets, show loading progress, keep the first playable interaction quick, and profile on a modest device or clearly disclosed substitute. Avoid WebGPU-only features and high memory consumption.
- Enable audio after a user gesture. Handle resize, device-pixel-ratio changes, touch input, and interrupted sessions. Provide autosave and user-controlled save export/import. Explain that local browser saves do not automatically sync between devices or origins and may be cleared by private browsing or managed-device policies.
- Keep platform-specific services separate from the simulation so future game website integration is possible. Do not build an unused portal adapter or advertising system. The normal hosted build must work independently.
- Game website publishing is optional future work, not a release requirement. Do not target a specific portal, integrate a portal SDK, or add advertising unless requested. If the owner later chooses a portal, consult its current official requirements and identify any additional work before submission.
- Keep the production files portable across ordinary static hosts. Any future portal agreements or submission work are outside the initial scope.

The hosted game's essential flow is: **open link → load → start or resume → play → save → return later**. No installation, account creation, or paid service should be necessary.

## 4. Game identity and player decisions

Choose an original title and define a one-paragraph player fantasy. Establish one distinguishing strategic idea that connects at least three systems. For example, frontier integration could connect development, supply, and diplomacy. Select one idea and implement it rather than collecting unrelated innovations.

The central loop is:

**Read the world → choose a priority → commit resources and orders → observe consequences → adapt.**

Every major system must create a decision with a real opportunity cost. For each, specify inputs, outputs, dependencies, player actions, AI actions, and feedback. Avoid lists of hypothetical features: choose actual rules, initial numbers, and worked examples.

Campaign phases should change the player's problem:

- **Opening:** establish an economy, select research, secure a border, and choose between expansion, investment, or cooperation. Present a useful decision within the first minute.
- **Competition:** manage contested regions, specialize armies, negotiate partnerships, and recover from costly wars.
- **Endgame:** manage a large state's vulnerabilities while pursuing a declared victory objective and responding to rival coalitions or competing progress.

Do not create difficulty by requiring repeated clicking. Orders should persist until completed or invalidated. Provide army splitting/merging, repeat recruitment or templates where useful, and sensible default queues without automating the player's strategic choices.

## 5. Concrete simulation rules

Before coding a subsystem, define its units, update frequency, bounds, formula or algorithm, and failure behavior. Display major causes of outcomes in player-readable terms. Keep detailed calculations available in reports or developer inspection.

### World and nations

A province has a stable ID, owner, controller when occupied, neighbors, terrain, population, development, infrastructure, fortification, integration/unrest, and any selected resource specialization. Derive supply capacity and strategic value where possible rather than storing conflicting copies.

Distinguish legal ownership from wartime control. Define when occupation begins, how it affects output and supply, and how peace transfers ownership. Record capital relocation and elimination rules explicitly.

Each nation has treasury, supply stockpile, manpower, technologies, policy, diplomacy, war participation, armies, and strategic objectives. Starting identity should come mainly from geography and a small number of strengths or constraints. No faction may be best at economy, warfare, and diplomacy simultaneously.

### Economy and population

- Define income, upkeep, investment costs, recruitment costs, stockpile limits, and deficit consequences.
- Distinguish resources paid immediately from per-tick flows. Show current stocks, net change, commitments, and estimated sustainability.
- Connect population to output and manpower without double-counting workers or soldiers. Define how casualties, replenishment, demobilization, and growth affect each pool.
- Apply shortage and bankruptcy consequences in telegraphed stages. Never silently permit unlimited spending or debt.
- Development must compete with military spending and research. War, occupation, and instability must have visible economic costs.
- Avoid exponential growth that makes every other decision irrelevant. Use limited investment capacity, upkeep, or diminishing returns with understandable rules.

### Armies, movement, and supply

Give the three unit roles readable purposes, such as affordable line troops, mobile maneuver units, and expensive siege/support units. Choose roles compatible with the setting. Include composition tradeoffs, manpower costs, supply demand, morale, and reinforcement rules. Do not add independent statistics unless they change a meaningful decision.

Movement uses legal graph paths with terrain and infrastructure costs. Show route and arrival estimate. Define border permissions, access through allies, enemy contact, interception, movement cancellation, and what happens if territory changes hands en route.

Supply comes from an explainable connection to a friendly source through permitted territory, constrained by capacity and route distance. Show both the cause of low supply and a remedy. Unsupplied armies suffer graduated recovery, combat, or attrition penalties; they do not disappear arbitrarily. Recompute or invalidate supply when territorial control or infrastructure changes.

### Combat and occupation

Define a single coherent battle model with composition, numbers, morale, technology, terrain, entrenchment, and supply. Use bounded uncertainty if randomness is included; avoid extreme reversals unsupported by circumstances.

Specify:

- Trigger conditions, participant selection, reinforcement, and multi-nation battles.
- Deterministic ordering for simultaneous arrivals and attacks.
- Combat phase/update timing, damage calculations, losses, morale changes, and termination.
- Retreat eligibility, retreat destination, pursuit if present, and surrender when no retreat is legal.
- Occupation/siege progression and the distinction between winning a battle and taking control.
- Casualty and reinforcement accounting with no duplicated soldiers.

Include worked examples: comparable armies on plains, a smaller well-supplied defender in mountains, and a larger unsupplied attacker. Explain why outcomes differ. Battle forecasts should communicate uncertainty; reports should show the main actual contributors.

### Development, technology, and policies

Infrastructure improves a province's economic or strategic usefulness at a cost. Avoid allowing every province to become equally optimal at everything.

Research has prerequisites, opportunity costs, and competing branches. A campaign should permit specialization without making one prerequisite chain universally mandatory. All bonuses use consistent stacking rules and apply to both AI and player.

Policies express national priorities. State the benefit, drawback, duration or switch cooldown, and interaction with existing commitments. Prevent cost-free rapid switching exploits.

### Diplomacy, alliances, and wars

Implement a focused set of actions: improve relations, non-aggression pact, trade agreement, defensive alliance, war declaration, and peace proposal. Add coalition behavior once the basics work.

Use explicit relation state and remembered actions. Acceptance depends on visible factors such as trust, threat, geography, relative strength, existing commitments, and war exhaustion. Show why a proposal is accepted or rejected. Avoid hidden arbitrary dice rolls as the only determinant.

Define treaty durations, costs, violations, alliance entry/exit, call-to-arms behavior, separate peace, territorial claims, and conflicting commitments. Specify whether defensive guarantees extend to offensive wars. Never allow mutually contradictory war or alliance states.

Peace must work before warfare is considered complete. Define war goals, occupation value, exhaustion, settlement evaluation, surrender, and a rule that prevents unresolvable wars. Rapid conquest should provoke contextual resistance rather than automatic hostility from every nation.

### Events, victory, and defeat

Events have eligibility conditions, frequency bounds, cooldowns, choices, and explicit effects. They create opportunities or dilemmas, use the normal resource/action rules, and cannot be farmed through save/load.

Implement three distinct victory paths:

1. **Territorial dominance:** control a defined share or set of strategic regions and hold it long enough for rivals to respond.
2. **Economic development:** achieve sustained prosperity and development, with a stability requirement that makes a temporary windfall insufficient.
3. **Diplomatic leadership:** maintain meaningful partnerships or influence under rules that cannot be met by repeatedly creating and dissolving treaties.

Choose exact thresholds, evaluation timing, simultaneous-victory resolution, and AI pursuit rules. All factions can win. Track progress openly. At the campaign limit, apply a disclosed scoring/tiebreak rule and show a result; do not force endless play.

Defeat is elimination or another clearly defined, telegraphed failure. Losing a capital alone should not cause an unexplained instant loss. Provide recovery opportunities when feasible. Offer post-victory continuation if inexpensive, while preserving the recorded result.

## 6. AI opponents

Build the opponent AI into the simulation. Do not rely on an LLM API, scripted player-specific counters, or inaccessible information.

All player and AI actions pass through the same validation and execution paths. The AI follows the same costs, movement restrictions, fog-of-war rules if present, combat formulas, treaty rules, and cooldowns. Public information is public for everyone. If fog of war is deferred, state that explicitly rather than simulating asymmetric knowledge.

Use three cooperating layers:

- **Strategic:** choose a current goal, budget priorities, research direction, diplomacy, and acceptable risk.
- **Operational:** assign armies to fronts, reserve forces, select objectives, estimate supply and local strength, and coordinate arrival.
- **Execution:** issue legal orders, recruit affordable units, reinforce, retreat, and recover from invalidated plans.

A utility-based or comparable explicit decision system is sufficient. Score expected value, cost, risk, opportunity cost, and goal alignment. Define weights in data. Use commitment duration, cooldowns, and improvement thresholds to prevent oscillation; allow emergencies to interrupt plans.

At minimum, AI must:

- Preserve enough income to sustain its commitments and handle shortages.
- Defend valuable territory, recognize reachable threats, and keep useful reserves.
- Prefer plausible wars to repeatedly attacking overwhelming opponents.
- Concentrate forces when necessary and avoid sending isolated units into obvious defeats.
- Evaluate supply before advancing and retreat from losing situations.
- Reassess when a front, alliance, or economic assumption changes.
- Negotiate peace when continuation has poor value.
- Pursue victory, recognize rivals' progress, and avoid permanent inactivity.

Personalities adjust priorities and risk tolerance, not access to rules. Implement at least four distinguishable profiles, such as expansionist, defensive, commercial, and opportunistic. Their behavior remains responsive to existential threats.

Difficulty primarily adjusts evaluation breadth, planning horizon, coordination, and mistakes. Use bounded computation budgets rather than unlimited search. Any optional material assistance must be disclosed in settings and diagnostics; no hidden combat multipliers or free actions.

Record concise decision diagnostics: candidate actions, selected goal, important scores, rejected orders, and plan changes. Use them to verify behavior rather than merely labeling the AI “intelligent.”

## 7. Interface, onboarding, and presentation

Design a usable strategy interface from the first playable milestone:

- Map center with province selection, army markers, routes, borders, capital indicators, and selectable overlays for political control, terrain, supply, and diplomatic relations.
- Compact nation overview showing treasury, resource flows, manpower, time, and urgent warnings.
- Context panel for the selected province, army, nation, or battle.
- Clear access to research, diplomacy, national policy, war status, and victory progress.
- Prioritized notification history; urgent threats are prominent, routine updates are quiet.
- Tooltips with costs, requirements, consequences, and reasons an action is unavailable.

Visible buttons must perform their stated action or explain why they cannot. Do not ship decorative controls, placeholder dashboards, or silently failing orders.

Support pause, several speeds, keyboard shortcuts, sound volume if audio exists, and reduced motion. Time-sensitive decisions should offer pause or auto-pause settings. Pausing must not prevent issuing valid planning orders, and presentation speed must not change simulation outcomes.

Use readable typography, high contrast, and ownership cues beyond color. Check common laptop and Chromebook sizes, small-screen layouts, touch controls, and UI scaling. Avoid essential information that is hover-only or hidden behind unexplained icons. Validate important keyboard flows where supported by the chosen stack.

Create a short, skippable, contextual tutorial that teaches selection, resource tradeoffs, recruitment, movement, terrain/supply, diplomacy, and victory tracking. Suggested actions must be legal in the actual current state. Avoid a giant rulebook before play begins.

Use a cohesive original visual theme, modest animations, and optional sound feedback. Procedural/vector assets are acceptable. Bundle essential assets with the production build; do not require third-party asset hosts for ordinary gameplay.

## 8. Technical architecture and persistence

Keep authoritative simulation state separate from rendering and UI state. Use stable IDs and explicit schemas. Prefer straightforward modules over a premature generic engine or elaborate framework.

Suggested responsibilities: world, economy, population, armies, movement, combat, supply, diplomacy, progression, events, victory, AI, commands, persistence, and presentation. Combine small modules when doing so improves clarity; do not split files solely to match this list.

Define a fixed tick sequence and explain its dependencies. For example, validate queued commands, update commitments and production, advance movement, resolve battles and occupation, refresh affected diplomacy and supply, then evaluate events and victory. Select the actual order carefully: stale supply or ownership must not accidentally affect a phase. Document when a change becomes observable.

Use explicit command objects and a shared validation boundary. A failed command returns a reason and leaves state consistent. The simulation must run headlessly for tests and AI campaigns.

Use a seeded pseudorandom generator for gameplay randomness. Persist its complete state. Keep cosmetic randomness separate. Given the same seed, settings, tick count, and command sequence, simulation results should reproduce within the declared supported runtime. Rendering frequency, speed selection, and UI interactions must not consume gameplay randomness.

Save files must preserve all state required for consistent continuation: world, nations, armies, movement progress, battles, queues, treaties, wars, policies, research, event state, AI commitments, time, settings affecting rules, and PRNG state. Include schema version and validation. Recompute derived caches safely after load. Use IndexedDB or an appropriate browser storage mechanism; handle quota and access failures. Saves inside an embedded portal may be separate from saves on the standalone hosted origin.

Provide manual save/load, autosave, and export/import where supported. Use atomic replacement or a recoverable equivalent appropriate to the storage backend. Preserve the current campaign on invalid imports. Handle unsupported versions, truncated files, missing references, and unavailable storage with actionable messages. Never advertise migration support without an implemented migration.

Keep tunable rules and content in validated data. Validate references and prerequisites at startup. Adding a faction or event should not require rewriting unrelated simulation code.

## 9. Delivery milestones and exit checks

### Milestone 0 — Definition and foundation

Deliver a concise design, chosen stack, command/state model, tick order, milestone plan, and requirement ledger. Explain the core distinguishing idea and first campaign scenario. Set up a runnable project and headless test entry point. Keep design proportionate; do not write a book before proving the loop.

### Milestone 1 — Complete playable core

Deliver map, four nations, income/upkeep, recruitment, army selection and movement, terrain-aware combat, occupation, basic war/peace, basic AI, time controls, clear controls, and one victory/defeat route.

Exit checks: a player can launch, make an investment, recruit, move, fight, gain control, settle a war, and finish or lose a campaign. AI performs these actions without player scripting. No required path depends on developer-only controls.

### Milestone 2 — Interconnected strategy

Add population/manpower, supply, infrastructure, research, policies, integration, and functional diplomacy/alliances. Introduce readable forecasts, shortage warnings, and cause-and-effect reports.

Exit checks: economic choices affect war capacity; terrain and supply change battle outcomes; research has competing choices; treaty decisions change legal actions and strategic safety. Save/load works during ongoing movement and combat.

### Milestone 3 — Credible opponents and dynamic campaigns

Expand the world, add layered AI, personalities, difficulty, events, coalitions, and all three victory routes. Add late-game pressure and campaign-limit resolution.

Exit checks: AI manages multi-front threats, ends unfavorable wars, reacts to expansion, and pursues victory. Events and personalities produce observable variation. No victory route is merely a differently labeled conquest threshold.

### Milestone 4 — Release candidate

Complete tutorial, accessibility/settings, polished reports, presentation, persistence hardening, performance work, balancing based on test results, and the GitHub/static-hosting delivery package.

Exit checks: all required systems work in the launchable build; developer setup and hosted-play instructions are accurate; the production build works at root and subpath URLs and in an iframe; normal player flows have been exercised; remaining defects and limitations are disclosed. A smaller coherent release is preferable to concealed incompleteness.

## 10. Verification and balance

Write focused tests for rule boundaries and interactions, not tests that merely repeat implementation constants. Establish invariants such as valid references, consistent ownership/control, no duplicated armies or manpower, bounded morale, legal diplomatic state, and finite numeric values. Define exceptions, such as permitted debt, explicitly.

Required checks include:

| Area | Evidence required |
|---|---|
| Economy | Upkeep, recruitment affordability, shortages, recovery, and resource conservation where applicable |
| Movement | Legal paths, access restrictions, chokepoints, simultaneous arrival, and invalidated routes |
| Combat | Terrain/supply effects, reinforcement, retreat without a valid destination, and casualty accounting |
| Diplomacy | Treaty expiry, war declarations, alliance conflicts, separate peace, and eliminated nations |
| Progression | Prerequisites, policy switching, modifier stacking, and completed queues |
| Events/victory | Eligibility, cooldowns, event affordability, simultaneous wins, and campaign-limit results |
| Persistence | Save/load equivalence during war; continuing an original and loaded state with identical commands yields equivalent state |
| UI | Launch, new game, selection, orders, notifications, settings, save/load, and victory/defeat screens |
| Web delivery | Production build, root/subpath assets, iframe resizing, focus loss, tab hiding, touch, audio startup, and storage failure |
| Robustness | Bankruptcy, no territory, disconnected regions, outdated saves, impossible orders, and long campaigns |

Run AI-only campaigns through the real simulation. Start with a small seed set during development, then aim for at least 30 full campaigns spanning factions and difficulties for the release candidate if runtime allows. Record seed and settings for every failure.

Collect faction results, victory route, campaign length, war frequency/duration, peace frequency, bankruptcy, idle armies, personality action patterns, elimination timing, and performance. Treat small samples as diagnostic, not proof of balance. Investigate repeated runaway advantages, passive opponents, endless wars, and strategies that dominate all starting positions.

Aim for responsive map interaction, approximately 60 FPS rendering on a documented representative environment, and simulation ticks comfortably below the normal-speed tick interval at the target world size. Measure actual timing and memory; report the environment, world size, speed, and sample duration. Spread expensive AI work across ticks where appropriate. Never label performance as verified without measurements.

Automated results do not prove that the game is fun. Use a player-style campaign or real playtest to assess whether decisions matter, feedback is understandable, and downtime is tolerable. Distinguish automated checks, your own exercised flows, and external player feedback.

## 11. Project records and communication

Maintain a small set of useful records:

- `README`: developer setup, production build, browser controls, tests, saves, and known limitations.
- `DEPLOYMENT`: GitHub Pages setup, alternative static hosting, production ZIP instructions, and verified/unverified browser compatibility.
- `DESIGN`: implemented rules, system interactions, formulas/examples, and balance assumptions.
- `STATUS`: requirement-to-module mapping, acceptance checks, completed work, open defects, and next milestone.
- A continuation checkpoint when needed: current working state, exact commands, unresolved failures, and the next concrete task.

Adapt filenames to the existing project. Do not create documentation that contradicts the build.

After each milestone, report briefly: what now works, how to launch it, what you actually tested, remaining limitations, and the next task. Show concise rationale and relevant evidence; do not provide private internal reasoning or repetitive role declarations.

Do not invent test runs, screenshots, download links, assets, packaged executables, benchmarks, or completion claims. If a tool fails, distinguish a broken feature from an unavailable validation environment. Mark unverified claims clearly and finish all unaffected work.

## 12. Start now

Inspect the environment, choose the practical implementation route, establish the coherent rules and first milestone, and begin building. Continue through the milestones while capabilities and execution budget allow. Stop only at a usable, honestly described checkpoint if the complete scope cannot fit the current session.

Success is an original game in which the player can understand a changing world, make consequential choices, see why outcomes happen, compete against credible opponents, and complete a distinct campaign—not a collection of disconnected systems or a plan for a game that never becomes playable.
