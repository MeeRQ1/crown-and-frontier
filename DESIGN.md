# Crown & Frontier — Design

This document describes the rules **as implemented**. Every number lives in
`src/sim/config.ts` (or the content files in `src/sim/data/` and
`src/data/reach.ts`); formulas are in the module named beside each section.

## Identity

**Player fantasy.** You rule a young crown on a divided continent, the Reach.
Your heartland is rich, but every province you gain beyond it is raw
frontier: it yields little tax, provides few recruits and is restless until you
integrate it. You expand by settlement, investment or conquest, you bind the new land to
the crown before rivals exploit its weakness, and you win the Reach through dominance,
prosperity or leadership.

**Setting.** An original early-modern (pike-and-shot) continent in 1640: nine
realms, 99 provinces (12 of them unclaimed frontier), the Greyspine mountains
with three passes (Northgate, Kestrel Pass, Southern Gap), Lake Calder, and island
straits. Every name, place and event is fictional.

**Distinguishing idea: frontier integration.** Each owned province has
integration from 0 to 100. That single value connects the economy, war, supply,
diplomacy and victory:

| Integration | Effect |
|---|---|
| 0–100 | Share of taxes and supplies reaching the crown: 25% → 100% |
| 0–100 | Military reserve it provides: 20% → 100% |
| ≥ 30 | Can raise regiments |
| ≥ 40 | Can be developed |
| ≥ 50 | Acts as a **supply source** (as do forts and capitals) |
| ≥ 75 | Counts toward Economic Prosperity |
| low | Adds unrest: (100 − integration) / 3; below 50, a province with unrest ≥ 70 and no garrison may revolt |

Conquests start at 10 (25 with a claim), settled land at 20. Every realm has an
**administrative capacity**: 3, plus 0.1 per province, plus modifiers. Its
**frontier load** is the sum of (1 − integration/100) over all provinces. When
the load exceeds the capacity, integration slows and unrest and research
penalties grow. Rapid expansion is therefore self-limiting, and the new land is
weak, restless and poor at supplying armies. That is the moment rivals and
coalitions exploit it.

**Core loop.** Read the world → choose a priority → commit crowns, supplies and
men → observe consequences → adapt. Orders persist until they complete or
become invalid.

## Time and tick order (`src/sim/tick.ts`)

One tick is one week; four weeks make a month and twelve months a year. Speeds are
0.5, 1, 2.5 and 6 weeks per second; speed 2 (1 week/s) is "normal". A
40-year campaign is about 1,920 ticks, roughly 32 minutes of unpaused normal
speed. With pauses and faster play that comes to about 45–90 minutes.

Weekly order:

1. Proposal expiry (unanswered calls to arms are honoured).
2. AI decisions, through the same `applyCommand()` as the player.
3. Movement and arrivals, in army-id order.
4. Battle detection, then one combat round per battle.
5. Sieges and changes of control. Any control change marks the supply network stale.
6. Army care on the updated map: supply level, attrition, morale recovery and reinforcement.
7. Recruitment and construction progress.
8. War score refresh.
9. At the end of each month: economy → research → integration and unrest →
   diplomacy → wars (exhaustion, forced peace) → events → victory.

Commands issued between ticks, for example while paused, apply immediately
and are visible to every phase of the next tick. Presentation speed never
changes outcomes: `step()` is a pure function of state.

## Economy and population (`economy.ts`)

- **Crowns per province per month:** (0.8 × dev + 0.012 × pop + 2 for a goods resource + 3 at the capital)
  × efficiency. Efficiency is integration factor × (1 − unrest/200), and 0 if the
  province is occupied or in revolt. An occupier levies 30% of the base value.
- **Supplies per province per month:** (0.5 × dev × terrain factor + 3 for grain) × efficiency.
  The stockpile limit is 60 + 5 × total dev. Armies on a supply line consume
  supplies each month (foot 0.5, horse 1, guns 1 per regiment); cut-off armies forage
  instead of drawing from the stockpile.
- **Expenses per month:** regiment upkeep (foot 1, horse 2, guns 2.4 crowns, scaled by
  strength), 1 crown per fort level, 1.5 per envoy, research funding (0 / 8 / 18 /
  32% of gross income for ×1.0 / 1.4 / 1.8 / 2.2 research), and 2% interest on debt.
- **Military reserve:** pop × 40 men per thousand × (0.2 + 0.8 × integration).
  The **manpower pool** can never exceed reserve minus men already serving
  (regiments plus recruits in training), so soldiers are never double-counted. Recruiting moves 1,000
  men from the pool into training. Reinforcement moves men from the pool into regiments
  (10% of the missing men per week, only when supplied on friendly ground).
  Disbanding returns survivors to the pool up to its limit. Casualties are
  permanent and reduce population. The pool refills at reserve/40 per month.
- **Population** grows logistically: 0.18% per month × (1 − pop/cap), where cap =
  terrain capacity × (1 + 0.15 × dev). Occupied provinces lose 0.2% a month.
- **Debt, in stages:** a negative treasury means *in debt*, paying 2% monthly interest, and
  purchases need positive funds. After 3 months, or once debt exceeds one month's
  income, it becomes *severe debt*: half morale recovery and +3 unrest. When debt exceeds 3 months'
  income the realm goes **bankrupt**. The treasury is reset, construction and
  training are cancelled, a fifth of the regiments desert, morale halves, research
  progress halves, trust falls by 10, and income drops 25% for two years. Each stage is announced,
  and the treasury tooltip shows the months left.

## Construction and investment (`construction.ts`)

Each province can run one project at a time. A realm can run 2 + 1 per 10 provinces (+ technology)
projects at once. Costs are paid up front; cancelling refunds 50%. Projects pause
while the province is occupied or in revolt.

| Project | Cost | Time | Effect |
|---|---|---|---|
| Develop | 20 × dev × (1 + dev/4) × terrain factor; ×2.5 beyond the terrain cap | 16 wk | +1 dev (terrain cap: plains 10, hills 8, forest 7, steppe 6, marsh 5, mountains 4; up to +3 beyond it) |
| Roads | 40 × (L+1) × (1 + L/2) | 12 wk | +1 road level (max 3): faster movement, +30% supply capacity, +25% integration speed |
| Fort | 60 × (L+1) × (1 + L/2) + 10 supplies | 16 wk | +1 fort (max 3): sieges required, +15%/level defence, supply source, 1 crown/level/month upkeep |
| Grant charters | 20 + 6 × dev | 8 wk | +25 integration, −10 unrest (provinces below 90) |
| Settle | 50 crowns, 500 men, 20 supplies | 16 wk | an unclaimed province bordering ours becomes ours at integration 20 |

The escalating costs and the soft development cap stop provinces from all becoming
equally optimal. They also keep crowns useful late in the game: the AI's treasuries now
stay in the hundreds to low thousands rather than piling up.

## Movement (`movement.ts`)

Each week an army gains movement points: 1.0, or 1.5 if it is all horse, or 0.8 with guns,
× (1 + modifiers). Entering a province costs the terrain's value (plains and steppe 2,
forest and hills 3, marsh 4, mountains 5), reduced by 12% per road level (the average
of both ends); a sea strait adds 2. Paths are the cheapest legal Dijkstra
route. Armies may enter their own or their allies' land, unclaimed land, land of
co-belligerents, and land of realms they are at war with. An army stays *located in
its origin* until it arrives. An army cannot leave a province that holds a hostile
army; armies are processed in id order, so hostile armies crossing on one edge always
meet. Every step is re-validated: a blocked route is re-planned or halted with a
notice. Peace returns armies standing in no-longer-accessible land to the nearest
controlled province.

## Supply (`supply.ts`)

**Sources** are provinces owned and controlled by us or a friend (ally or same war
side) that are integrated ≥ 50, fortified, or a capital. Supply travels through
friendly-controlled provinces at 1 per step (+0.5 into mountains and marsh, −0.5 with
roads ≥ 2). An army within **range 3** (+1 with Supply Trains) is *connected*; the last
step may enter enemy land. The stockpile must not be empty.

Local capacity = terrain base × (1 + 0.3 × roads) + 0.5 × dev, ×0.75 in foreign land.
Supply level = connected ? min(1, 2 × capacity / regiments present) :
min(0.6, 0.5 × capacity / regiments present).

- **Supplied (≥ 0.8):** no penalty.
- **Strained (≥ 0.4):** no reinforcement, half morale recovery, −10% in combat.
- **Unsupplied:** 2% of men lost per week to attrition, −0.1 morale per week, −25% in combat.

The army panel always shows the cause (range, empty stockpile, overstacking) and a remedy.

## Combat (`combat.ts`)

**Trigger:** after movement, any province holding non-retreating armies of two hostile
nations starts or reinforces a battle. The defending side is the one friendly to the
province's controller; otherwise it is the army that has stood there longest. Other armies
join the side they are friendly with and whose opponent they are at war with. Third parties wait.

**One round per week:**

- **Engagement:** up to *frontage* foot and horse regiments (plains 16, steppe 20, hills 12,
  forest 10, marsh 8, mountains 6) plus up to half as many guns engage. Guns
  fire at half effect if they outnumber the front regiments. The rest wait in reserve.
- **Firepower:** Σ men/1000 × unit attack (foot 1.0, horse 1.2, guns 1.7) × technology
  × supply multiplier. Horse gets the terrain cavalry modifier (+20% plains, +30% steppe,
  −15% to −50% in rough ground); ≥ 20% horse on open ground flanks for +15%. Everything
  is scaled by 0.6 + 0.4 × morale ratio.
- **Casualties inflicted:** firepower × 55 × roll (0.85–1.15, seeded). The
  attacker's fire is reduced by the defence bonus: terrain (forest 15%, marsh 20%, hills 25%,
  mountains 50%) + fort 15% per level if the defenders hold it + entrenchment (10% after 2
  stationary weeks, 20% after 4) + technology, capped at 70%.
- **Morale loss:** 0.15 + (casualties / men) × 8 × the enemy's shock (horse 1.6, guns 1.2, foot 1.0).
- **Ending:** a side breaks at 25% morale or at 10% of its starting men. If both break,
  the side with the lower morale ratio loses; exact ties go to the defender. After 8 rounds the
  attacker withdraws.
- **Pursuit and retreat:** the winner's horse pursue for up to 10% of their men in extra
  casualties (at most 15% of the loser). Losers retreat to an adjacent enterable province with
  no enemies, preferring friendly ground and short supply lines. **With no legal
  retreat they surrender**, and all their men are lost.
- **Accounting:** regiments below 100 men dissolve and their remainder counts as casualties;
  every casualty is removed from the population. War score gains ±(2 + loss
  difference/1000, capped at 10) per battle, and war exhaustion rises with losses
  relative to the reserve.

**Forecasts** replay the same round function three times with unlucky, even and lucky
rolls, without touching the gameplay RNG. The result is "Likely victory",
"Uncertain" or "Likely defeat", with expected losses and the main factors.

### Worked examples (`npm run examples`, real combat code)

| Situation | Forecast | Why |
|---|---|---|
| 6 foot + 2 horse vs the same on plains | **Uncertain**: 1,736 losses each with even rolls; unlucky → defender holds, lucky → attacker wins | Symmetric; both get horse flanking and the plains bonus; exact ties go to the defender |
| 9 foot attack 5 entrenched foot in fortified mountains | **Likely defeat** (defender holds in all three) — attacker loses 1,425, defender 485 | Mountains +50%, fort +15%, entrenchment +20% (defence capped at 70%); frontage 6 leaves 3 attacking regiments idle |
| Same 9 vs 5 on open plains | **Likely victory** — attacker loses 657, defender 1,370 | No terrain or fort bonus; the whole army engages |
| 8 supplied foot attack 6 dug-in foot on plains | **Likely victory** (1,048 vs 1,362) | Numbers beat a 10% entrenchment |
| Same attack with attackers at 20% supply | **Uncertain** (1,296 vs 1,218; unlucky → defender holds) | Unsupplied −25% firepower |

## Sieges and occupation (`siege.ts`)

Winning a battle never transfers land. An army that is standing in a province held by
a realm it is at war with — not fighting, not retreating, not passing through —
besieges it:

- **No fort:** 50% progress per week.
- **Fort level L:** 100% takes 10 × L weeks and needs at least 2L regiments.
- **Modifiers:** +25% per guns regiment (max 6), + siege technology, ×0.5 if unsupplied,
  ×2 when the legal owner, or a friend of it, retakes its own land.

At 100 the controller changes. Captured land whose legal owner the besiegers are not
at war with returns to that owner. Occupation stops the owner's income from the province,
gives the occupier 30% contributions, adds unrest, cancels training in the
province and counts toward war score.

## Wars and peace (`war.ts`)

- **War goals:**
  - **Claim** — provinces we hold claims on. No trust cost.
  - **Conquest** — up to two bordering provinces. Costs 8 trust and alarms the target's neighbours. Forbidden under Concord Diplomacy.
  - **Coalition** — declared by a coalition member; all members join.
  Claims come from history, events, peace (the previous owner keeps one) or 12-month fabrication.
- **Blocked by:** truces (5 years after peace), non-aggression pacts, and alliances.
- **Calls to arms:** the target's defensive allies are called. AI allies join unless exhausted or
  already in two wars. A human player gets a 4-week decision that defaults to honouring the call.
  Declining breaks the alliance and costs 15 trust. Anyone allied to both sides, or in a pact with
  the attacker, sits out. The attacker's allies are **not** called: alliances are defensive only.
- **War score** (attacker's view, −100…100) = the share of the defenders' weighted land
  the attackers occupy (dev + 1, capital ×2) − the reverse + battle score (±30) + goal
  score (±25: +1/month while the attackers hold every goal province, −1/month
  after the first year if they hold none).
- **Peace:** ceding a province costs 100 × its weight / the giver's total weight (minimum 5,
  ×1.5 if not occupied); 20 crowns = 1 point.
  - **White peace:** accepted when the target's own advantage is small, it is exhausted, or the war has dragged on.
  - **Demands:** accepted when their cost ≤ the score in the proposer's favour + 0.4 × the target's exhaustion (+20 if it has no army left) − stubbornness.
  - **Concessions:** accepted when they cover about 70% of the receiver's advantage.
  Every term of this evaluation is listed in the peace builder before sending.
  A separate peace with the opposing war leader removes one participant.
- **Unresolvable wars cannot happen:** a white peace is forced after 8 years, or after 3 years
  with the score within ±10. A side holding ≥ 90 for 12 months imposes its war goal.
- **Territorial transfer:** the ceded province goes to the receiver at integration 10 (25 with a claim)
  with unrest ≥ 30, and its former owner keeps a claim. A lost capital relocates to the best
  remaining province (unrest +10, 50 crowns). A realm with no provinces is **eliminated**:
  its armies, treaties, envoys and coalition seats are removed, and wars it led end.

## Diplomacy (`diplomacy.ts`)

- **Opinion** is a visible sum of remembered actions (with decay) and situational terms:
  envoys (+2.5/month up to +35), war declared (−50), land taken (−15), treaties broken,
  calls honoured or abandoned, border friction (−5), alliance (+25), pact or trade (+10),
  common enemy (+15), −½ × alarm, the other side's trust, claims.
- **Treaties:**
  - **Non-aggression pact** — 5 years; cancelling it costs 10 trust and imposes a 12-month cooling-off.
  - **Trade** — crowns each month for both; cancelled by war.
  - **Defensive alliance** — calls to arms and military access. Blocked if a party is at war with an ally of the other.
- **Acceptance** is `score ≥ 0`, where the score is a listed sum: opinion, trust, relative strength,
  shared threats, distance, claims, existing allies and the evaluator's temperament. The
  diplomacy ledger shows the verdict and the reasons *before* you propose, and the same
  function decides for AI-to-AI deals.
- **Alarm:** each conquered province raises neighbours' alarm by (dev + 3) × proximity
  (1 / 0.6 / 0.3 / 0.15 by distance) × (0.6 + 4 × the conqueror's share of world dev) × 2.5.
  Alarm decays 0.6 per month. Allies of the conqueror are not alarmed.
- **Coalitions:** with two or more alarmed realms (≥ 45), AI realms form a coalition; a player may
  join. Members defend each other against the target and can declare a joint coalition war
  when their combined strength is ≥ 1.3× the target's.
- **Trust** (0–100) starts at 50 and recovers slowly to 75. It falls when treaties are broken,
  conquest wars declared, or allies abandoned.

## Research and policy (`progression.ts`, `data/techs.ts`, `data/policies.ts`)

- **Research:** 18 technologies in three branches (Arms, Statecraft, Civics), each with two
  tier-1, two tier-2 and two tier-3 techs. Costs are 100, 200 and 350 points; prerequisites
  stay within a branch. Points per month = (0.5 + 0.4 × √Σ(dev × integration factor)) × funding ×
  (1 + modifiers) × (1 − overextension/2). The full tree takes most of a long campaign, so
  specialisation matters early.
- **Policies:** six national priorities, each with a benefit and a drawback: Mercantile Charter,
  Martial Levy, Frontier Settlement, Royal Academy, Fortress Doctrine and Concord Diplomacy
  (which forbids wars without a claim). A change costs 20 + half a month's income (free in the
  first month) and locks the policy for 24 months.
- **Stacking:** all modifiers from traits, technologies, policy and timed events add together
  (`modifiers.ts`) and apply identically to AI realms and the player.

## Events (`events.ts`, `data/events.ts`)

There are 17 condition-based events, among them harvests, border incidents, frontier
discontent, guild petitions, plague, desertion, veteran officers, foreign goodwill,
refugees, an inventor, bankers' loans, separatists, road-builders, frontier silver,
war weariness, a rival close to victory, and alarmed neighbours.

- Each realm draws one every 5–11 months from the gameplay RNG, weighted by eligibility.
  Events have per-event cooldowns (1–6 years).
- Every event has at least one choice that can always be taken. Unaffordable choices show why.
- The first affordable choice is taken after 8 weeks without an answer.
- Because the RNG state is saved, reloading reproduces the same event, so events cannot be farmed.

## Victory, defeat and the campaign limit (`victory.ts`)

All three paths are evaluated monthly for every realm and shown in the Victory ledger.
Each month the conditions fail, a timer loses 6 months.

1. **Territorial Dominance:** own and control ≥ 75% of the provinces in 3 regions and
   ≥ 23% of all provinces, held for 24 months.
2. **Economic Prosperity:** integrated development (the dev of controlled provinces at
   integration ≥ 75) ≥ 25% of the world's development, with dev-weighted unrest ≤ 25, no debt, no
   bankruptcy and none of your land occupied, held for 60 months. A windfall cannot
   do it; rivals can break it by occupying one province.
3. **Diplomatic Leadership:** influence from treaties at least 3 years old whose
   partner's opinion of you is ≥ 40 (alliance 2, trade 1), at 1.25 per other surviving realm
   (minimum 6), with trust ≥ 65 and no offensive war, held for 60 months. New
   treaties do not count, so cycling treaties is pointless.

- **Rival reactions:** AI realms react to a rival past 35% of a timer. They raise their alarm
  about it, arm, lower their war threshold against it, and — for a diplomatic leader past
  halfway — may cancel trade with it.
- **Simultaneous winners:** resolved by campaign score (disclosed): 3 × provinces + 0.6 ×
  integrated dev + 3 × technologies + 3 × influence + min(treasury, 2000)/100 +
  per path (20 × timer fraction + 10 × condition progress).
- **Campaign limit** (25/40/60 years): the highest score wins.
- **Defeat** is elimination, or another realm winning. Losing the capital is not fatal. After a
  result you may continue playing; the result stays recorded.

## AI (`src/sim/ai/`)

The AI uses only `applyCommand()`: the same validation, costs, movement, combat formulas,
treaties and cooldowns as the player. All information is public for everyone; fog of war is
not implemented, and this is stated in the Help ledger.

| Layer | When | Decides |
|---|---|---|
| Strategic (`strategic.ts`) | monthly, staggered | goal and victory path; army size target from income, reserve and supply (a larger share when threatened or at war); research by branch weights and situation; policy (re-evaluated yearly, switching only if clearly better); construction by value per crown; envoys and treaties (mutual acceptance required); coalition wars; peace (demands up to its advantage, white peace or concessions when losing or tired); war (see below) |
| Operational (`operational.ts`) | weekly (every 2 weeks on Easy) | peace: garrisons for restless frontier, gathering and merging at a rally point; war: objectives (defend, liberate, attack), strength-based assignment of armies, staging and merging before attacks, forecast checks, withdrawal from superior enemies, recovery of battered armies |
| Execution | inside both | recruitment toward the target composition at safe sites; issuing and re-issuing orders; recovering from rejected orders |

**Deciding on war.** The AI scores each bordering realm as value × (strength ratio / required ratio − 1) × aggression.

- *Strength* counts the potential of both sides, with allies weighted by whether they can reach the fight and coalitions included.
- *Value* comes from the goal provinces' development, claims and whether the target is a rival close to victory. It is halved when the AI's neighbours are alarmed and when the target is already beset.
- *Supply feasibility* is checked first.
- *Required ratios* come from the personality. Aggressive temperaments grow restless during long peace and as the campaign advances.

**Stability.** Commitment bonuses keep plans from flip-flopping; emergencies reassign armies at once.

**Diagnostics** go to `state.diagnostics` (the last 400): chosen research, policies, war candidates with
ratios and scores, declarations, peace attempts, army objectives, attacks held back by
forecasts, and rejected orders. They are included in bug reports.

| Personality | War ratio | Aggression | Preferred path | Realms |
|---|---|---|---|---|
| Expansionist | 1.15 | 1.4 | territorial | Vostmark, Morvaine |
| Opportunist | 1.2 (0.9 vs a realm already at war) | 1.1 | territorial | Drevenholt, Tarsk |
| Commercial | 1.45 | 0.7 | economic | Aurel |
| Defensive | 1.8 | 0.5 | economic | Calder, Istrel |
| Diplomat | 2.0 | 0.4 | diplomatic | Serennes, Fenward |

| Difficulty | Operational cadence | Objectives weighed | Coordinated attacks | Mistake chance | Attack margin | Accepts uncertain odds |
|---|---|---|---|---|---|---|
| Easy | every 2 weeks | 3 | no | 30% | 0.9× | yes |
| Normal | weekly | 6 | yes | 10% | 1.15× | yes |
| Hard | weekly | 12 | yes | 0% | 1.3× | no |

Difficulty changes decision quality only. The optional "+15% AI income" assistance is off by
default and disclosed in the setup screen and the game menu.

## Determinism and persistence

- **Randomness:** gameplay randomness uses two seeded sfc32 streams, `rng` for combat, revolts and
  events and `aiRng` for AI choices. Their full state is saved. Cosmetic randomness (sound
  noise) lives only in the UI. A test forbids `Math.random` and wall-clock time in `src/sim`.
- **Reproducibility:** the same seed, settings and command sequence reproduce identical states.
  Tests assert this, and that a game saved mid-war continues exactly like the original.
- **Save format:** versioned (`schema: 1`) and checksummed JSON of the complete state, including
  movement progress, battles, queues, treaties, events and AI commitments.
- **Loading:** damaged, truncated, foreign or newer files are rejected with a message, and the
  current campaign is kept. No migrations exist yet; other schema versions are refused rather
  than loaded incorrectly.

## Balance assumptions and evidence

The numbers above were tuned against AI-only campaigns (`npm run sim`). The latest batch is in
`reports/ai-campaigns.md` (seeds, difficulties, winners, war counts, bankruptcies, idle-army
share, performance). Observations that drove the tuning:

- **Too easy to win diplomatically:** diplomatic victory in about 6 years. Fixed with older-treaty influence, trust 65, a 60-month hold and rival counter-play.
- **Frozen world:** pacts everywhere meant no wars. Fixed so aggressive temperaments refuse pacts that bind them, and pacts last 5 years.
- **Useless late-game money:** treasuries of 30k+ because every province maxed its development by year 20. Fixed with escalating costs, the soft cap and charters.
- **Alliance deterrence froze the map:** fixed by weighting allies by reach and adding restlessness.
- **Remaining skew:** Aurel's plains economy and Tarsk's steppe geography win most AI-only
  campaigns. Small defensive realms (Calder, Istrel, Fenward) tend to shrink. See STATUS.md.
  These are small samples and diagnostic, not proof of balance.
