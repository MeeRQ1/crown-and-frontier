# Crown & Frontier — Design

This document describes the rules **as implemented**. Every number lives in
`src/sim/config.ts` (or the content files in `src/sim/data/`, `src/data/aldmere.ts`,
`src/data/reach.ts` and the generated `src/data/aldmere.provinces.json`); formulas are in
the module named beside each section.

## Identity

**Player fantasy.** You rule a young crown on a divided continent, the Reach.
Your heartland is rich, but every province you gain beyond it is raw
frontier: it yields little tax, provides few recruits and is restless until you
integrate it. You expand by settlement, investment or conquest, you bind the new land to
the crown before rivals exploit its weakness, and you win the Reach through dominance,
prosperity or leadership.

**Setting.** The industrial age (docs/expansion/SETTING.md): rifles and railways at the
start, machine guns, steel and engines later, the first tanks near the end. Aldmere begins in
1880 and the Reach in 1895. Every name, place and event is fictional.

| | Aldmere (standard campaign) | The Reach (quick campaign) |
|---|---|---|
| Provinces | 298 (34 unclaimed) | 99 (12 unclaimed) |
| Realms | 14 | 9 |
| Regions | 42 | 14 |
| Mountain ranges and passes | Greyspine (Northgate, Kestrel Pass, Southern Gap), Hoarfells (Glen Ardach), Frostfangs (Frostgate), Iron Teeth (the Iron Gate) | Greyspine: three passes |
| Rivers | Aldwater, Vess, Serre, Drevna, Kolva, Tarn: 65 river borders | none |
| Straits | 15 | 10 |
| Graph diameter | 26 provinces | 15 provinces |
| Start year | 1880 | 1895 |
| Default length | 60 years (40 / 60 / 70) | 40 years (25 / 40 / 60) |

The nine realms of the Reach return on Aldmere with larger holdings, joined by Carrow
(highland clans), Hrafnmark (a seafaring peninsula), Solmarre (a vineyard peninsula),
Lessia (the Aldwater valley) and the Ashmark (frontier wardens). Starts are deliberately
different: compact and defensible (Carrow, Calder, Istrel, Fenward), exposed frontier
(Vostmark, Hrafnmark, the Ashmark), wealthy and central (Aurel, Lessia, Solmarre), large
with difficult borders (Morvaine, Tarsk), and frontier to settle (Drevenholt). The setup
screen shows each start's neighbours, passes, river borders, frontier and claims.

**How Aldmere is made** (`tools/genworld.ts` from `tools/aldmere.spec.ts`, through the shared
world generator `src/maps/gen/world.ts` and core `src/maps/gen/core.ts`): the authored spec gives the coastline, islands, lakes, mountain
ridges with their passes, river courses, and regions with anchors, target province counts,
biomes and wealth. The generator rasterises land, lakes and mountain walls; grows regions
from their anchors (walls and water stop growth, so ranges and seas become region
borders); splits each region into provinces with k-means (capitals, passes and landmarks
stay pinned); builds Voronoi cells with noisy shared borders; adds peaks along each ridge
(closing any border that leaks through one); routes rivers along province borders; and
links islands by strait, always to the owner's own coast plus a sea lane to someone else's.
Terrain, resources, development, forts, claims and names follow from region, biome noise,
rivers and ranges. The output is deterministic and checked in. The Reach's geometry comes
from the same core and is byte-identical to the previous release.

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

**Core loop.** Read the world → choose a priority → commit crowns, materiel, resources
and men → observe consequences → adapt. Orders persist until they complete or
become invalid.

## Time and tick order (`src/sim/tick.ts`)

One tick is one week; four weeks make a month and twelve months a year. Speeds are
0.5, 1, 2.5 and 6 weeks per second; speed 2 (1 week/s) is "normal". A
40-year campaign is about 1,920 ticks, roughly 32 minutes of unpaused normal
speed. With pauses and faster play that comes to about 45–90 minutes.

Weekly order:

1. Proposal expiry (unanswered calls to arms are honoured).
2. AI decisions, through the same `applyCommand()` as the player.
3. Standing orders, then the **naval phase**: fleets sail; aircraft fly their sea missions
   (air cover, patrols, naval strikes); hostile fleets fight; troops land; ships repair or
   wear; blockades and raiding are counted.
4. Movement and arrivals, in army-id order; then battle detection (contact on arrival).
5. The **air phase** over land: rebasing, ground support planned for this week's battles,
   interception, flak, bombing, readiness and replacements.
6. One combat round per battle, with its air and naval fire support; coastal forts fire
   back at the ships that shelled them.
7. Sieges and changes of control. Any control change marks the supply network stale.
8. Army care on the updated map: supply level, attrition, morale recovery and reinforcement.
9. Recruitment, shipyards and hangars, then construction progress.
10. War score refresh.
9. At the end of each month: economy → research → integration and unrest →
   diplomacy → wars (exhaustion, forced peace) → events → victory.

Commands issued between ticks, for example while paused, apply immediately
and are visible to every phase of the next tick. Presentation speed never
changes outcomes: `step()` is a pure function of state.

## Economy and population (`economy.ts`)

**Units.** Crowns are the currency. A treasury is a stock of crowns; income, upkeep and
costs are crowns a month (the ledger and the HUD say "/mo"), and one-off prices are crowns.
Population is counted in units of 10,000 people (a province of 40 holds 400,000), and every
figure the player sees is in people or men.

- **Crowns per province per month:** (0.8 × dev + 0.03 × pop + 5 at the capital)
  × efficiency. Efficiency is integration factor × (1 − unrest/200), and 0 if the
  province is occupied or in revolt. An occupier levies 30% of the base value.
- **Food per province per month:** (0.5 × dev × terrain factor + 3 for a food deposit) ×
  efficiency. The food stockpile (the `supplies` field) holds 60 + 5 × total dev. Armies on a
  supply line eat from it each month (infantry 0.5, cavalry 1, artillery 0.8, engineers 0.6,
  armour 0.4 per regiment); cut-off armies forage instead.
- **Strategic resources:** coal, iron, oil, rubber and nitrates. Each province has at most one
  deposit (food or one of the five). A deposit yields its base (coal 4, the others 3) +
  0.25 × dev a month × efficiency × (1 + technology). Each resource has its own stockpile,
  capped at 40 + 3 × total dev. Together with food that makes six resources.
- **Industry:** provinces hold 0–5 factory levels (at most 1 + dev/2). Industrial capacity is
  Σ factories × efficiency × (1 + technology). Each factory level burns 0.6 coal a month;
  without coal a factory keeps 30% of its capacity (water power, short shifts), with partial
  coal it scales in between. Capacity makes 4 **materiel** a month per point, and workshops
  add 0.15 per integrated dev everywhere. Materiel is stockpiled up to 80 + 40 per factory;
  output beyond that is sold as manufactured goods at 0.35 crowns each.
- **Materiel and resources buy the army.** Raising a regiment costs crowns, materiel,
  resources and 1,000 men (table under Combat). Replacing 1,000 lost men costs half the
  regiment's materiel. Armour burns 0.6 oil a month per regiment; artillery burns 0.25
  nitrates a month while its realm is at war.
- **Shortages.** A realm covering less than 95% of a need is short, is told at once with the
  effect, and the Industry ledger shows it: coal → factories at 30%; iron → no new artillery,
  armour, factories, forts or railways; oil → armour at half strength; nitrates → artillery at
  60% in battle; rubber → no new armour.
- **Trade** (each trade agreement): every month each partner's surplus above 40% of its cap
  flows to the other's need (up to 40% of the buyer's cap), resource by resource and
  agreement by agreement in id order, at fixed prices (food 1, coal 1.5, iron 2, oil 3,
  rubber 3, nitrates 2.5; the exporter's trade modifier raises its price). The buyer pays,
  the seller earns. A realm in debt does not buy.
- **Commerce** (format 7): each trade agreement brings each partner 4% of the smaller
  partner's provincial taxes a month (less what blockades and raiders stop; +bloc bonus), and
  all of a realm's commerce together is at most 25% of its own provincial taxes. Before, every
  agreement paid a flat crown each, so small realms signed with everyone and earned more from
  commerce than from their land (Albania 73 against 7 of taxes after two years). All flows of a month are computed from the state at the start of the settlement, so
  the order of realms does not matter.
- **Expenses per month:** regiment upkeep (infantry 1, cavalry 1.6, artillery 2, engineers
  1.4, armour 3, airborne 1.6 crowns, scaled by strength), 0.6 crown per fort level, 0.4 per
  anti-aircraft battery level, an envoy 1.5 crowns × the realm's provincial taxes ÷ 25 (between
  0.75 and 3.75: a small realm can keep one), fleet and air wing upkeep, research
  funding (0 / 8 / 18 / 32% of gross income for ×1.0 / 1.4 / 1.8 / 2.2 research), resource
  purchases, and 2% interest on debt.
- **Military reserve** (format 7): 5% of the people, scaled by integration (pop × 500 ×
  (0.2 + 0.8 × integration)), less the **war dead** still missing from it. A man killed
  leaves the population and the reserve for good; new cohorts make up 1% of the missing men a
  month (about ten years to recover a war's losses). Albania (36,000 people before, 360,000
  now) had a reserve of 1,152 men against a minimum army of 3,000; it now has 12,900 in its
  pool and three regiments.
  The **manpower pool** can never exceed reserve minus men already serving
  (regiments plus recruits in training), so soldiers are never double-counted. A shrinking
  reserve shrinks the pool. It is trimmed to the cap at every monthly settlement, and at once
  when an owner loses control of a province. Recruiting moves 1,000
  men from the pool into training. Reinforcement moves men from the pool into regiments
  (10% of the missing men per week, only when supplied on friendly ground, and only as far as
  materiel allows). Disbanding returns survivors to the pool up to its limit. Casualties are
  permanent and reduce population. The pool refills at reserve/60 per month. Nothing is
  counted twice: a man is in the pool, serving (a regiment or a recruit), dead, or not called
  up; the HUD's manpower tooltip lists people, fit for service, war dead, serving and the pool
  limit.
- **Starting forces follow the realm's means.** The standing army costs at most a third of
  provincial taxes (at least three regiments if the reserve allows, never more than a quarter
  of the reserve); the home fleet only what 12% of taxes keeps afloat (transport, screen,
  cruiser, screen, battleship, in that order). No realm starts in deficit.
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
| Railway | 40 × (L+1) × (1 + L/2) + 4 iron × (L+1) | 12 wk | +1 railway level (max 3): faster movement, +30% supply capacity, +25% integration speed |
| Factory | 80 × (L+1) + 10 iron | 20 wk | +1 factory level (max 1 + dev/2, at most 5; integration ≥ 50): industrial capacity, see Economy |
| Fort | 60 × (L+1) × (1 + L/2) + 10 food + 5 iron | 16 wk | +1 fort (max 3): sieges required, +15%/level defence, supply source, 1 crown/level/month upkeep |
| Grant charters | 20 + 6 × dev | 8 wk | +25 integration, −10 unrest (provinces below 90) |
| Settle | 50 crowns, 500 men, 20 supplies | 16 wk | an unclaimed province bordering ours becomes ours at integration 20 |
| Port | 50 × (L+1) + 4 iron (Naval Bases −25%) | 16 wk | +1 port (max 3; coastal provinces only): one slipway per level, repairs 6 hp/week per level to friendly fleets on its coast |
| Airfield | 40 × (L+1) + 3 iron; needs Aviation | 12 wk | +1 airfield (max 2): two air wings per level |

The escalating costs and the soft development cap stop provinces from all becoming
equally optimal. They also keep crowns useful late in the game: the AI's treasuries now
stay in the hundreds to low thousands rather than piling up.

**Province batches** (`batch.ts`, format 8). Provinces are selected together: Ctrl/Cmd+click
or Ctrl/Cmd+drag on the map, or the Select tool on touch. One project, or one regiment type,
is then previewed for all of them with a running budget. Each province shows what it would
get (railway 1 → 2, a regiment) or why not:

- not ours;
- at its maximum level;
- a project already under way;
- no construction slot left;
- not enough crowns, materiel, men or a resource left after the provinces before it.

The shared pools are spent once, in a disclosed order: as selected, highest development
first, or cheapest first. Recruitment counts per province (at most 10 each) or as a total
spread over the provinces one at a time, and shows what is already training.

Confirming sends one command (`batchBuild`, `batchRecruit`) carrying exactly the previewed
provinces. Each province is checked again as it is queued, so a change since the preview
is caught and nothing is overspent. The result lists every province. A request just sent
cannot be sent again, double clicks included. Selection gestures never queue anything.

## Movement (`movement.ts`)

Each week an army gains movement points: its slowest regiment's speed (infantry and engineers
1.0, cavalry 1.5, artillery 0.8, armour 1.2),
× (1 + modifiers). Entering a province costs the terrain's value (plains and steppe 2,
forest and hills 3, marsh 4, mountains 5), reduced by 12% per road level (the average
of both ends); a sea strait adds 2 (Hrafnmark's island ferries: 0). A strait is **closed** to a
realm while enemy surface warships outgun its own in the sea zone that commands it (see The
navy); paths route around it, and armies already on the way re-plan or halt. Enemy **interdiction**
from the air slows an army by up to 30%. Armies at sea do not march: their fleet carries
them (see The navy). Paths are the cheapest legal
Dijkstra route, found with a binary heap that breaks ties by province id, so results do not
depend on the order of the search. Armies may enter their own or their allies' land, unclaimed land, land of
co-belligerents, and land of realms they are at war with. An army stays *located in
its origin* until it arrives. An army cannot leave a province that holds a hostile
army; armies are processed in id order, so hostile armies crossing on one edge always
meet. Every step is re-validated: a blocked route is re-planned or halted with a
notice. Peace returns armies standing in no-longer-accessible land to the nearest
controlled province.

**Orders.** Shift+right-click adds a waypoint after the current route. A **station order**
keeps an army's home: whenever the army is idle elsewhere (after a retreat, say) it marches
back. A new move replaces the order, and losing the station to an enemy cancels it with a
notice. **Army groups** (1–9) let the player send one move order to every army in a group;
each marches by its own best route. Groups and orders are player tools; the AI does not use
them.

## Supply (`supply.ts`)

**Sources** are provinces owned and controlled by us or a friend (ally or same war
side) that are integrated ≥ 50, fortified, or a capital, and **beachheads**: a coastal
province a realm holds (owned or occupied) with one of its fleets stationed offshore
(not under way) in a zone where enemy warships do not outgun its friends. The sea lane
home is not traced; the fleet offshore stands for it. Supply travels through
friendly-controlled provinces at 1 per step (+0.5 into mountains and marsh, −0.5 with
roads ≥ 2). An army within **range 3** (+1 with Supply Trains) is *connected*; the last
step may enter enemy land. The stockpile must not be empty.

Local capacity = terrain base × (1 + 0.3 × roads) + 0.5 × dev, ×0.75 in foreign land.
Supply level = connected ? min(1, 2 × capacity / regiments present) :
min(0.6, 0.5 × capacity / regiments present).

- **Supplied (≥ 0.8):** no penalty.
- **Strained (≥ 0.4):** no reinforcement, half morale recovery, −10% in combat.
- **Unsupplied:** 2% of men lost per week to attrition, −0.1 morale per week, −25% in combat.

Supply does not cross a strait closed by enemy warships. Enemy **interdiction** from the
air removes up to 40% of an army's supply level where it flies (see Air power).

The army panel always shows the cause (range, empty stockpile, overstacking) and a remedy.

## Combat (`combat.ts`)

**Trigger:** after movement, any province holding non-retreating armies of two hostile
nations starts or reinforces a battle. The defending side is the one friendly to the
province's controller; otherwise it is the army that has stood there longest. Other armies
join the side they are friendly with and whose opponent they are at war with. Third parties wait.

**Units** (`UNITS` in config; costs before national modifiers):

| Unit | Role | Needs | Cost | Upkeep | Attack | Shock | Speed | Notes |
|---|---|---|---|---|---|---|---|---|
| Infantry | line | — | 15 crowns, 10 materiel | 1.0 | 1.0 | 1.0 | 1.0 | fills the frontage, screens support |
| Cavalry | line | — | 30, 12 materiel | 1.6 | 1.1 | 1.5 | 1.5 | terrain bonus on open ground, pursuit; cut by enemy machine guns |
| Artillery | support | — | 30, 30 materiel, 4 iron, 2 nitrates | 2.0 | 1.7 | 1.2 | 0.8 | siege ×4; burns nitrates at war |
| Engineers | support | Engineering Corps (1885) | 25, 20 materiel, 2 iron | 1.4 | 0.6 | 0.8 | 1.0 | entrench ×2, siege, river crossings |
| Armour | breakthrough | Tanks (1916) | 50, 80 materiel, 8 iron, 3 rubber, 2 oil | 3.0 | 2.6 | 2.0 | 1.2 | breaks forts and trenches; burns oil |

**One round per week:**

- **Engagement:** up to *frontage* line and breakthrough regiments (plains 16, steppe 20,
  hills 12, forest 10, marsh 8, mountains 6) plus up to half as many support regiments
  engage. Support regiments fire at half effect if they outnumber the line ("no infantry
  screen"). The rest wait in reserve.
- **Firepower:** Σ men/1000 × unit attack × technology × supply multiplier. Cavalry gets the
  terrain cavalry modifier (+20% plains, +30% steppe, −15% to −50% in rough ground); ≥ 20%
  cavalry on open ground flanks for +15%. Enemy machine guns (technology) cut cavalry fire by
  their anti-cavalry value. Armour gets its own terrain modifier (good on plains and steppe,
  poor in forest, marsh and mountains). **Shortages:** armour without oil fires at 50%,
  artillery without nitrates at 60%. Everything is scaled by 0.6 + 0.4 × morale ratio.
- **Casualties inflicted:** firepower × 55 × roll (0.85–1.15, seeded). The
  attacker's fire is reduced by the defence bonus: terrain (forest 15%, marsh 20%, hills 25%,
  mountains 50%) + fort 15% per level if the defenders hold it + entrenchment (10% after 2
  stationary weeks, 20% after 4; engineers dig twice as fast) + technology + **river
  crossing** (20% when every attacker stepped across a river border into the province to
  open the battle; 10% if the attackers bring engineers), capped at 70%. **Breakthrough:**
  attacking armour strips forts and entrenchment by up to 50% (the full 50% at 30% armour
  among the attackers' men). Forecasts apply the river bonus when the attackers would cross one.
- **From the sea and the air:** attackers who land from the sea that week fire at 75%
  (Amphibious Warfare halves the penalty). Our ground-support wings over the battle add up to
  +40% firepower, cut to 40% of their value when the enemy holds the sky; reconnaissance adds
  5%. Both appear among the forecast's factors.
- **Morale loss:** 0.15 + (casualties / men) × 8 × the enemy's shock.
- **Ending:** a side breaks at 25% morale or at 10% of its starting men. If both break,
  the side with the lower morale ratio loses; exact ties go to the defender. After 8 rounds the
  attacker withdraws.
- **Pursuit and retreat:** the winner's cavalry (10%) and armour (15%) pursue for extra
  casualties (at most 15% of the loser). Losers retreat to an adjacent enterable province with
  no enemies, preferring friendly ground and short supply lines. **With no legal
  retreat they surrender**, and all their men are lost.
- **Accounting:** regiments below 100 men dissolve and their remainder counts as casualties.
  Every casualty, whether from fighting, pursuit or surrender, is removed from the population and
  raises war exhaustion by 40 × casualties / max(5,000, reserve). War score gains ±(2 + loss
  difference/1000, capped at 10) per battle.

**Forecasts** replay the same round function three times with unlucky, even and lucky
rolls, without touching the gameplay RNG. The result is "Likely victory",
"Uncertain" or "Likely defeat", with expected losses and the main factors.

### Worked examples (`npm run examples`, real combat code)

| Situation | Forecast | Why |
|---|---|---|
| 6 infantry + 2 cavalry vs the same on plains | **Uncertain**: 1,504 losses each with even rolls; unlucky or even → defender holds, lucky → attacker wins | Symmetric; both get cavalry flanking and the plains bonus; exact ties go to the defender |
| 9 infantry attack 5 entrenched infantry in fortified mountains | **Likely defeat** (defender holds in all three) — attacker loses 1,617, defender 550 | Mountains +50%, fort +15%, entrenchment +20% (defence capped at 70%); frontage 6 leaves 3 attacking regiments idle |
| Same 9 vs 5 on open plains | **Likely victory** — attacker loses 738, defender 1,565 | No terrain or fort bonus; the whole army engages |
| 8 supplied infantry attack 6 dug-in infantry on plains | **Likely victory** (1,168 vs 1,542) | Numbers beat a 10% entrenchment |
| Same attack with attackers at 20% supply | **Uncertain** (1,240 vs 1,152; unlucky → defender holds) | Unsupplied −25% firepower |
| 2 infantry + 6 cavalry attack 6 infantry on plains | **Likely victory** (656 vs 1,218) | Cavalry flanking and the plains bonus |
| Same, the defenders have Machine Guns | **Likely victory**, but dearer (936 vs 1,158) | Cavalry fire −35%, defence +8% |
| 8 infantry attack 6 infantry entrenched behind a level-2 fort | **Uncertain** (1,536 vs 1,002) | Fort +30% and entrenchment +20% |
| 5 infantry + 3 armour against the same line | **Likely victory** (648 vs 1,176) | Armour (38% of the men) strips half of fort and trench (−25%) and is favoured on plains |
| Same armour without oil | **Likely victory**, but dearer (920 vs 1,158) | Unfuelled armour fires at 50% |

## Sieges and occupation (`siege.ts`)

Winning a battle never transfers land. An army that is standing in a province held by
a realm it is at war with — not fighting, not retreating, not passing through —
besieges it:

- **No fort:** 50% progress per week.
- **Fort level L:** 100% takes 10 × L weeks and needs at least 2L regiments.
- **Modifiers:** +25% per artillery regiment (max 6), +50% per engineer regiment (max 2), + siege technology, ×0.5 if unsupplied,
  ×2 when the legal owner, or a friend of it, retakes its own land.

At 100 the controller changes. Captured land whose legal owner the besiegers are not
at war with returns to that owner. Occupation stops the owner's income from the province,
gives the occupier 30% contributions, adds unrest, cancels training in the
province and counts toward war score.

## Sea zones (`src/maps/seazones.ts`, map format 3)

Fleets move between **sea zones**, the nodes of a graph laid over the water. Each zone lists
its neighbouring zones, the coastal provinces it touches, and the straits it commands.
Aldmere has 30 zones and 24 starting ports; the Reach 13 and 8.

**How the zones are made.** The map is rasterised; land, lakes and peaks are not sea. Seeds
are spread along the coastal water by farthest-point sampling on distances through water,
then relaxed a few times. Every sea cell joins the nearest seed through water, so a zone
never reaches across a peninsula. Coasts, adjacency, strait control, names and label anchors
follow from the cells. The method is deterministic. The built-in maps ship the result
(`src/data/*.seas.json`, `npx tsx tools/genseas.ts`), and a test regenerates it and compares.

**Map format 3** stores the zones and the ports. Map packages in format 1 or 2 get zones
generated on import and are upgraded with a notice. The validator checks zone ids, two-way
adjacency, coasts that exist and touch water, that every strait has a commanding zone, and
size limits on zones and the zone grid.

## Maps (`src/maps/`)

Every map is a **map package** (`format.ts`): rules, realms, regions, provinces, routes, sea
zones and drawn geometry in one versioned JSON file. Built-in maps, generated maps, maps
made in the editor and imported files all pass through the same validator (`validate.ts`)
and the same conversion to the simulation's scenario and the renderer's geometry.

**Six built-in maps.**

| Map | Provinces | Realms | Start | Style | Made by |
|---|---|---|---|---|---|
| Aldmere | 298 | 14 | 1880 | Continental war on several fronts | `tools/genworld.ts` (authored spec) |
| The Reach | 99 | 9 | 1895 | Quick campaign around one mountain spine | `tools/genmap.ts` (authored) |
| The Sundered Isles | 116 | 8 | 1885 | Naval war among islands | `tools/genmaps.ts` (procedural recipe) |
| The Kharan Steppe | 263 | 11 | 1880 | War of movement across open grassland | `tools/genmaps.ts` |
| The Middle Sea | 548 | 16 | 1875 | Grand alliances around an inland sea | `tools/genmaps.ts` |
| The Baltic, 1906 | 233 | 5 | 1906 | Great powers and small kingdoms around one sea | `tools/genbaltic.ts` (Natural Earth) |

Generated maps ship as checked-in JSON (`src/data/maps/`), so every browser plays exactly the
same map; the scripts regenerate them byte for byte, and a test regenerates the Isles.

**The world generator** (`gen/world.ts`) turns a spec into a map: it rasterises land, lakes
and mountain walls; grows regions from their anchors; splits each region into provinces by
k-means (cities, capitals and passes stay pinned); builds Voronoi cells with noisy shared
borders; adds peaks along ridges and closes borders that leak through them; routes rivers
along province borders; links islands by strait; and derives terrain, deposits,
development, forts, claims and names. Aldmere goes through it unchanged.

**The procedural generator** (`gen/procedural.ts`) writes such a spec from a few parameters:
seed, provinces (40–900), realms (2–24), the shape of the land (one continent, an
archipelago, an inland sea, peninsulas, twin lands), climate, and how mountainous, wet and
wild it is. It draws a coastline from shaped noise, ranges with passes, lakes and rivers;
places capitals far apart; grows regions into realms (starting sizes within 1.5× of each
other); names realms, places and features from nine fictional cultures (`gen/names.ts`);
gives realms arms, traits and personalities; and scales victory thresholds to the number of
realms (`rules.ts`, the formulas under Victory). A curated recipe may set measured thresholds
over the scaled ones and carries its own revision: in Stage F the Isles (economic share 25%,
was 27%), the Steppe (economic share 23%, was 21%; influence 1.2 per realm, was 1.07) and the
Middle Sea (economic share 13%, was 17%) were set from 16-seed AI batches, as revision 2 of
each map. Saves from revision 1 load with a notice. **Deposits** follow Aldmere's mix (coal
14%, food 10%, iron 6.5%, nitrates 6%, oil 3.5%, rubber 3% of provinces), shifted by
climate and placed on the terrain that suits each; every realm starts with one coal field.
The same parameters always give the same map.

**The map library** (`src/ui/library.ts`, `maplib.ts`) lists the built-in maps and the
player's own maps, each with a preview, size, difficulty, realms, sea zones, start year,
style, mechanics and attribution. Built-in maps can be played, exported or copied into the
editor; the player's maps can also be edited and deleted. The player's maps live in this
browser (IndexedDB, else localStorage, else memory for the session), in a store of their
own apart from saves. Every map is validated when it is imported, when it is stored and
when it is read back. An import whose id is taken gets a new id and a notice. A stored map
that no longer validates is listed with the reason and kept until the player deletes it.
Map files are data only: unknown fields are dropped, text is drawn as text, and nothing in
a file is ever run. Campaigns on a player's map save the map inside the save, so deleting
or editing the map never breaks them; editing a stored map raises its revision.

**The map editor** (`src/ui/editor/`) works on a map package:
- **New map:** the procedural generator, in a Web Worker. Profiling justified the worker:
  in headless Chromium, generation took about 1 s for 90 provinces and 6.1 s for 520
  (8.5 s in Node for the Middle Sea's 548), long enough to freeze the page on the main
  thread.
- **Edit:** paint realms, regions, terrain and deposits by clicking or dragging; edit a
  province (name, owner, region, terrain, deposit, development, population, fort, roads,
  factories, port, claims, capital); add and remove straits and rivers; place and remove
  ports; merge two neighbouring provinces; add, rename and remove realms (colour,
  personality, capital) and regions; rename sea zones; set the map's name, id,
  description, author, start year, difficulty and style; recompute size, mechanics and
  victory thresholds; regenerate sea zones from the coastline.
- **Check:** the validator runs after every edit. The Check tab lists errors and warnings
  in plain words, and each one has a Show button that selects the province, realm or sea
  zone to fix. Errors keep a map out of the library and out of play; warnings do not.
- **Keep:** undo and redo (80 steps), an unfinished map kept in this browser, save to the
  library, export to a file (with a warning if it has errors), open a file, and Play, which
  saves the map and opens the campaign setup on it.

The editing operations are pure functions on the package (`src/maps/edit.ts`). Each keeps
the map consistent where an edit implies it: a realm that loses its capital gets its most
developed remaining province, development stays within what the terrain allows, a strait
is listed on both sides and commanded by a sea zone, and a merged province keeps one
outline. Anything an edit cannot make consistent on its own is left to the validator.
Drawn geometry is replaced, never changed in place, so the undo history can share it. Not
supported: splitting a province or drawing new coastline by hand (generate a new map
instead), and editing sea zone shapes (they follow the coastline).

**The real-world map** (`tools/genbaltic.ts`, data notes in `tools/baltic.data.ts`) is built
from **Natural Earth** 5.1.2 (public domain): coastline and islands from `ne_50m_land`, lakes
from `ne_50m_lakes`, rivers from `ne_10m_rivers_lake_centerlines`, realm and region borders
from `ne_10m_admin_1_states_provinces`, and towns from `ne_10m_populated_places_simple`.
The script downloads the layers, checks their pinned SHA-256 sums, projects them
(Lambert conformal conic), and builds the map through the world generator. Authored
additions are the realms of 1906 and the table placing each present-day division in its
1906 realm and province; that table approximates some borders (North Schleswig, the line
between Posen and Congress Poland, Memelland, the Karelian Isthmus). Also authored: names
as written in 1906 (Kristiania, Reval, Königsberg, Helsingfors…), district towns Natural
Earth lacks, the Scandes ridges and four passes, island and sea names, and realm traits.
Present-day populations stand in for those of 1906 when sizing cities and wealth.
Provinces grow larger in the thinly settled north. Deposits follow the game's usual mix,
weighted towards known mining districts (Bergslagen iron, Scanian coal, Estland's oil
shale). No rubber grows in northern Europe, so the map's three rubber deposits stand for
the rubber works and colonial trade houses of 1906 (Treugolnik in St Petersburg, Provodnik
in Riga, Hamburg). The empires start far larger than the kingdoms (Russia 101 provinces,
Denmark 12), so the victory thresholds sit at least 0.15 above the largest starting share.
The attribution is shown in the map library, the campaign setup and the in-game menu.

Two generator features exist for real coastlines, and are off for the fictional maps:
- **Shore seeds** let a province own extra Voronoi seeds along its shores, so the drawn
  coast follows the data instead of falling back by half a province. Each shore cell goes
  to the nearest province it can see over land. A cell cut off from its province is handed
  to the province around it, until every province is one piece.
- **Land beyond the frame** (side `~edge`, waste kind `edge`): where the frame cuts through
  land, the land outside is impassable, never sea and never a coast. It is drawn muted, so
  no province gains a false coast or port. Lake and off-map cells are merged into one
  outline per body.

**Level of detail.** At the far zoom tier, while the camera only pans, the realm layers
(mode washes, occupation hatching, borders, ribbons, rivers) come from a cached image of
the whole map, redrawn when realms, mode, focus or zoom change; the result is identical to
direct drawing (mean pixel difference 0.33/255). Measured on the same build with the
switch off and on (headless Chromium, software rendering): on the 900-province stress map,
far-zoom panning frames fall from 103.7 ms to 33.0 ms on average (p95 124.5 → 39.4); on the
Middle Sea from 36.5 to 25.4 ms (`reports/perf/web-stageD.md`).

## The navy (`naval.ts`)

**Ships** are laid down in a port (one slipway per port level) and join a squadron off it.
Every type has a job, things it cannot do and a counter:

| Ship | Needs | Cost | Upkeep | Guns | Torpedo | Anti-sub | AA | Bombard | Raid | Escort | Hull | Speed | Job |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Transport | — | 20, 15 materiel, 2 iron, 10 wk | 0.6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | carries 2 regiments |
| Torpedo boat (screen) | Torpedo Boats | 25, 20, 3 iron, 12 wk | 0.8 | 1 | 1 | 3 | 1 | 0 | 0 | 2 | 2 | 2 | escort: hunts submarines, shields convoys and carriers |
| Cruiser | — | 45, 40, 6 iron, 20 wk | 1.5 | 3.5 | 0.5 | 1 | 1.5 | 3.5 | 1.5 | 1.5 | 4 | 2 | patrol, raiding, escort, light bombardment |
| Battleship (capital) | — | 90, 90, 14 iron, 36 wk | 3 | 8 | 0 | 0 | 2 | 8 | 0 | 0.5 | 12 | 1.5 | the decisive surface fight; heavy bombardment |
| Submarine | Submarines | 35, 30, 4 iron, 16 wk | 1 | 0.3 | 4 | 0 | 0 | 0 | 4 | 0 | 2 | 1.5 | raids sea trade; ambushes big ships |
| Carrier | Naval Aviation | 100, 100, 12 iron, 2 rubber, 40 wk | 3.5 | 0.5 | 0 | 1 | 3 | 0 | 0 | 0 | 9 | 1.5 | a mobile air base: 2 wings (3 with Fleet Carriers) |

Ships burn coal each month (oil after Oil-Fired Boilers); a realm short of its fleet's fuel
fights at 60% and sails at half speed. Fleets at a friendly port on an uncontested zone repair 6 hp a
week per port level (half under the bombs); fleets more than four zones from every friendly port lose 2 hp a week.

**Movement.** A fleet sails one zone per movement point per week (its slowest ship). A fleet
entering a zone that holds enemy warships stops there and fights.

**Battle.** Hostile fleets sharing a zone fight up to three rounds a week; both sides fire at once:

- guns hit surface ships, spread by size; transports and carriers behind at least as many
  screens and cruisers are hit at 30%;
- submarine torpedoes go for capital ships, carriers and transports (three times the weight);
- anti-submarine fire is the only thing that hurts submarines, half as much again when a
  reconnaissance patrol of the hunters' side flies over the zone;
- aircraft take no part in the gun battle: they strike in the air phase before it (below). A
  side **struck from the air that week with no air cover of its own** (the enemy holds the sky
  over it) is out-ranged: its guns fire at 30% in the first round and 60% in the second.

Damage per ship is fire × 32 × roll ÷ its hull. A side falling below half its starting
fighting value withdraws. Regiments aboard sunk transports go down with them, and a sunk
carrier's air group flies to an airfield within reach or is lost.

**Sea control.**

- A **strait** is closed to a realm while enemy surface power in the commanding zone exceeds its
  own there: no marching or supply across it.
- A coastal province is **blockaded** when every zone on its coast holds enemy warships
  (submarines count half) at more than twice our surface power there. It loses 25% of its
  crowns, its shipyard stops, and the realm's sea trade shrinks with the blockaded share of its
  coast (Convoys resist). Realms with a land border trade overland.
- **Raiding.** Trade between realms without a land border goes by sea, on the shortest zone
  route between their trade ports (the capital if it is a port, else the biggest port).
  Raiders at war with either partner (submarines 4, cruisers 1.5 a ship) take a share of what
  passes each zone: 6% per point of raid power that gets through, at most 40% a zone and 75%
  a route. Escorts of either partner's side in the zone (screens 2, cruisers 1.5, battleships
  0.5) turn raiders away: what gets through is raid × raid ÷ (raid + 2.5 × escort). Convoys
  cut the loss by 30%. A fleet sitting elsewhere protects nothing: raiding is zone by zone,
  on the route.

**Shore bombardment.** Battleships and cruisers lying still (not sailing, carrying no troops)
in a zone on the coast of a land battle that their realm or a friend fights shell the enemy:
+2% fire per point of gun power (a battleship 16%, a cruiser 7%), at most +25% from all the
fleets offshore. Each fleet shells one battle a week (the largest it can reach). Inland
provinces, and coasts on other zones, are out of reach. Coastal forts of the province fire
back: 3 hull a week per fort level, spread over the gun ships. Air and naval fire support of a
side together never exceed +50%.

**Standing orders** (format 7). A fleet takes an order and sails there by sea at its own
speed (never jumping a zone); what it does where it lies is weighted by the order. On
station (no order) it does every duty it can, as before:

| Order | Sails to | Blockade | Raids | Protects trade | Shells |
|---|---|---|---|---|---|
| On station | — | 1 | 1 | 1 | the largest battle on its coast |
| Hold position | stays | 1 | 0 | 1 | no |
| Patrol | a zone | 1 | 0 | 1.5 | no |
| Blockade | a zone | 1.5 | 0 | 0.5 | no |
| Raid trade | a zone | 0.5 | 1.5 | 0 | no |
| Escort | follows a fleet of ours | 0 | 0 | 1 | no |
| Shell the coast | a zone off one province | 0.5 | 0 | 0.5 | only that province: battles and sieges there |
| Return to port | a port | 0 | 0 | 0 | no; repairs ×1.5 in harbour |

In transit an order counts as presence (blockade 1, protects trade at half). Sailing by hand
ends an order; carrying troops ends it too. A fleet beaten in battle is sent to port to
repair. An order that can no longer be carried out (the escorted fleet is gone, the port
lost, no route) lapses with a note. Ships shelling a fortified province under siege add 4% a
point of gun power to the siege (at most +50%), and its forts fire back. Coastal forts also
fire on ships that keep their coast blockaded close inshore (on station, hold, patrol or
blockade): half the shelling rate, never twice in a week. When a port changes hands, the
fleets based there make another port their home.

**Armies by sea.** Armies standing on a coast board a fleet with room (two regiments per
transport) lying in a zone on that coast, and name a beach: our own or a friendly coast,
unclaimed land, or an enemy's coast. Aboard, they are out of every land phase: the fleet sails
there (a week a zone for transports) and the troops land when it reaches a zone on that coast
and enemy warships do not outgun ours there; until then they wait offshore, exposed to enemy
ships, submarines and aircraft, and the fleet says why. They fight at 75% the week they land
(87% with Amphibious Warfare). Ashore they are supplied by sea only while a fleet of ours lies
off a coast they hold, uncontested (a beachhead), or once they take a port or fortified town;
until they take the beach they are unsupplied. A war fleet in the same zone sails with the
transports as their escort; strike aircraft over the route and enemy fleets on it are the
threat.

## Air power (`air.ts`)

**Airfields** (Aviation) hold two wings per level. **Carriers** hold two wings each (three with
Fleet Carriers): fighters, ground attack and reconnaissance, never bombers. A wing flies its
mission over a place within its **range, counted in steps over land and sea** from where it is
based (reach.ts): a province to a neighbour, a coastal province to a zone on its coast and a
zone to the next are one step each. From a carrier, range counts from the zone the fleet lies in
that week. A wing changes base (airfield or carrier) within twice its range; doing so costs
30 readiness.

| Wing | Needs | Cost | Upkeep | Air | Ground | Bomb | Naval | Range | Missions | Carrier |
|---|---|---|---|---|---|---|---|---|---|---|
| Reconnaissance | Aviation | 20, 15 materiel, 1 rubber, 6 wk | 0.6 | 0.5 | 0 | 0 | 0 | 3 | recon | yes |
| Fighter | Fighters | 30, 25, 1 rubber, 1 iron, 8 wk | 1 | 3 | 0.5 | 0 | 0 | 3 | superiority, support | yes |
| Ground attack | Ground Attack | 35, 30, 1 rubber, 2 iron, 10 wk | 1.2 | 1 | 3 | 0.5 | 3 | 3 | support, interdiction, naval strike | yes |
| Bomber | Strategic Bombing | 50, 45, 2 rubber, 3 iron, 14 wk | 1.8 | 0.8 | 1 | 3 | 2 | 5 | bombing, interdiction, naval strike | no |

**Missions.** Over land a mission covers its target province and the neighbours (bombing: the
target only); over the sea it covers one zone (aboard a carrier, no zone means the zone the
fleet is in, wherever it sails).

- **Air superiority** (fighters): patrols the area. Every enemy wing flying there is
  intercepted: it loses 10 × E ÷ (E + F + 0.5) strength a week (× its vulnerability: fighters
  0.7, reconnaissance 1, ground attack 1.1, bombers 1.2), where E is the enemy fighters on
  patrol there and F ours; the patrolling fighters are credited with what they shoot down.
  Over a sea zone it is the fleet's air cover.
- **Ground support** (ground attack; fighters weakly): on call over the area. Each week it joins
  **one** of our battles there, the one at its target first, else the largest, and adds
  +12% fire per point of ground value to that battle only (at most +40% from all air support).
  With no battle it stands by: it does not fly, wear or risk anything. Ground fire costs it
  1.5 strength a week.
- **Interdiction** (ground attack, bombers): enemy armies in the area lose up to 40% supply and
  30% speed.
- **Strategic bombing** (bombers): an enemy-held province's factories lose up to 60% of their
  output, its shipyard stops building and its port repairs at half rate, and wings on its
  airfield lose 12 readiness per point of bombing, for as long as the bombing goes on. Forts
  shoot back (2 strength a week per level).
- **Naval strike** (ground attack, bombers): strikes the enemy ships in the zone if it finds
  them (always under a reconnaissance patrol of our side, else 60%). Strike power is
  naval value × 4 (carrier wings × Fleet Carriers' +25%), blunted by the targets'
  anti-aircraft fire (× 20 ÷ (20 + AA)); damage is spread by size, battleships and carriers
  twice as likely to be hit, transports half as likely again, valuables behind escorts half as
  likely. The strike wings lose 0.5 strength per point of AA (at most 20).
- **Reconnaissance**: over land, our battles in the area fire 5% harder and our support and
  interdiction there strike 20% harder; over a sea zone, our strikes always find their targets
  and enemy submarines lose their cover (aircraft can hit them; escorts' anti-submarine fire
  +50%).

**The sky.** A side with 1.5× the other's air power over a place holds the sky there. What a
mission achieves is scaled by who holds the sky over it: 100% in ours, 75% contested, 40% in
the enemy's. Wings on other missions defend themselves at half their air value.

**Readiness and costs.** Each week a wing flies it loses 10 readiness; rest restores
25 × (1 − readiness) a week, so sustained operations settle near 60% and a rested wing surges.
Its values count at 50% + 50% of readiness. Below 25% a wing is grounded until it recovers, and
a realm short of oil recovers nothing. Strength lost is replaced at 8 a week at a quiet base,
paid in materiel (aboard a carrier only off a friendly port). Wings burn oil (30% while idle)
and cost their upkeep (+25% with All-Metal Monoplanes). A wing whose airfield falls flies to
the nearest airfield of ours within twice its range, or is lost.

**Transport wings and airborne operations** (Airborne Forces, 1936). A transport wing (30
crowns, upkeep 0.8, range 4, no missions) carries one **airborne** regiment (35 crowns,
upkeep 1.6, fights like good infantry: attack 1.1, morale 1.3). An army made only of airborne
regiments, at one of our airfields with a ready transport wing per regiment there, is ordered
to a province within the transports' range: our own or a friend's, unclaimed, or an enemy's at
war with us. The player reviews the risks first. It is flown in the week's movement phase,
after armies move and before battles are found: fighters take 30% of the men if the enemy holds
the sky over the target (12% contested), anti-aircraft fire 5% a level, at most half in all.
The transports lose strength in proportion and 30 readiness. The army lands as an ordinary
army: it fights at 70% that week, besieges and takes ground like any other, and is supplied
only if a supply line reaches it. **Aircraft never take ground; airborne troops do, by
siege.** The drop can be called off before it is flown; it is aborted, with the reason, if the
airfield is lost, the transports are not fit, or the army is caught in a battle first.

**Anti-aircraft defence** (Air Defence). A province's **batteries** (a construction project,
levels 0–3, 20 × (level + 1) crowns and 2 iron, 0.4 crowns a month a level) and the **mobile
guns** of artillery with Air Defence in armies there (half a level a regiment, at most 1.5)
fire at enemy aircraft over it, at most 4 levels in all. Wings bombing or interdicting it, or
supporting a battle there, lose 1.5 strength a week per level (× vulnerability) and achieve 8%
less per level (bombing, interdiction and support); a drop loses 5% of its men per level.
Batteries taken by an enemy are wrecked. Forts keep their own flak; ships keep their own AA.

**Every wing says what it did.** Each week it records whether it flew, what it achieved
(battles supported, enemy aircraft downed, hull damage, armies interdicted, industry and
shipyards hit) or exactly why not: out of range (with the steps), not ready, no oil, flight
deck out of action, no battle in the area, target no longer held by an enemy.

## Combined warfare

Land, sea and air meet in the battle round and in supply, never as a national bonus:

- **Fire support is committed, not ambient.** A wing supports one battle a week, a fleet shells
  one battle a week, and only from where they actually are; both are named in the battle with
  what they added. Together they are capped at +50%: guns and bombs cannot replace infantry.
- **Counters.** Fighters over a battle cut the enemy's support to 40% and shoot down the
  supporting wings; forts shoot back at bombers and at ships; anti-aircraft escorts and air
  cover blunt naval strikes; escorts turn raiders away; a reconnaissance patrol strips
  submarines of their cover.
- **Effects end with their conditions.** Out of range, grounded, a base or carrier lost, the
  target no longer an enemy's, peace: the next week the effect is gone (bombing orders fall idle
  with a note; other orders are kept but do nothing, and say why).

**In every direction** (format 7):

| From → to | What it does | What answers it |
|---|---|---|
| Navy → ground | shells battles (+25% cap) and sieges (+50% cap) on its coast; blockades cut crowns, shipyards and trade; beachheads supply troops ashore; lands armies | coastal forts fire on shelling and close blockading ships |
| Ground → navy | taking a port moves the fleets based there to another home and stops its yards; holding the coast denies repairs; forts fire on ships | — |
| Air → ground | ground support, interdiction, bombing; airborne troops take ground | fighters; anti-aircraft batteries and mobile guns |
| Ground → air | anti-aircraft fire (losses, less achieved); taking an airfield forces its wings to rebase or be lost; taking batteries wrecks them | — |
| Air → navy | naval strikes; reconnaissance exposes submarines; air cover | ships' AA; fighters over the fleet |
| Navy → air | carriers base wings at sea; ships' AA blunts strikes | naval strikes on the carriers |

No effect is counted twice: air and naval support of a side share one +50% cap, anti-aircraft
fire one cap of 4 levels, a ship is fired on by forts once a week. A coastal assault on a
fortified port in `tests/combined-warfare.test.ts` (6 seeds) took 12.8 weeks by land alone
(1,936 men lost), 12 with aircraft (1,567), 10 with ships shelling the fort (1,617) and 9 with
both (1,261).

The worked scenarios in `tests/naval-air-scenarios.test.ts` exercise each of these through the
weekly tick, and `tools/matrix.ts` checks that no fleet composition dominates (a carrier group
caught by gun ships in its own zone loses; standing off two zones away, its aircraft strike
everything but submarines).

### Worked examples (`npm run examples`, `tests/worked-sea-air.test.ts`)

The small sea map of the tests: realms a and b share a border; b's port b2 lies only on the
East Water; c is an island realm.

| Situation | Forecast or result | Why |
|---|---|---|
| 5 infantry from a2 attack 4 dug-in infantry in b1, overland | **Likely victory** (795 vs 952 losses) | numbers beat a 10% entrenchment |
| The same 5 land on b1 from the Middle Water | **Uncertain** (990 vs 840; unlucky → defender holds) | Landing from the sea −25% |
| The same landing with Amphibious Warfare | **Uncertain** (815 vs 832) | the penalty halves to −13% |
| Two of a's cruisers in the East Water, no b warships | b2 **blockaded**: crowns 2.88 → 2.16 a month; b's trade with the island cut further by the same cruisers raiding the route | every zone on b2's coast holds enemy warships at more than twice b's power |
| One b cruiser joins them | not blockaded; the cruisers still raid, less | 2 × 1 cruiser ≥ 2 cruisers; one escort turns some raiders away |
| Two of a's submarines instead of the cruisers | blockaded | submarines count half, enough against no defenders |
| 6 infantry from a2 attack 6 infantry in b1, no aircraft | **Uncertain**, defender holds with even rolls | entrenchment +10% |
| Two of a's ground-attack wings on call over b1 | attacker wins with even rolls | Air support on call +40% (2 wings) |
| Three of b's fighter wings hold the sky over b1 | support +16% | the enemy holds the sky: support falls to 40% |
| a answers with three fighter wings | support +30% | the sky is contested: 75% |

## Commanding forces (`ui/app.ts`, `ui/orders.ts`, `ui/panels/sea.ts`)

Armies, fleets and air wings are found, selected, inspected and ordered the same way:

- **Find and select.** Click a counter on the map (army, fleet, or the wings at an airfield or
  aboard a fleet; clicking a wing counter again selects the next wing there), or a row in the
  Military ledger, a province card or a fleet's air group. N cycles armies, or wings or fleets
  when one is selected; C centres the selection (a wing: its airfield or carrier). Our own
  counters are drawn at every zoom.
- **Inspect.** Each card states where the force is, what it is made of, its condition and
  readiness, its current order and what it did last week, and why it does nothing when it does
  nothing. A wing's card keeps its base apart from its mission and shows its service record
  and costs; a fleet's card its order, the armies it can embark and the threats on its route;
  an army's card the fleet that can carry it, or at sea where and when it lands.
- **Order.** A right-click (a long-press on touch; E at the pointer) on a place opens the
  orders the selected wing or fleet could take there, each with what it does or why it cannot
  be given, ground support first over a battle; armies march on a plain right-click as before.
  Card buttons start the same orders with a map pick; while a place is being chosen the
  tooltip previews it (route, weeks, range, risks or the reason it would fail) and a banner
  offers Cancel. Several wings at an airfield take one order; fleets merge; armies use groups.
- **Observe, cancel, adjust.** Routes, mission areas, the airfields and carriers a selected
  wing can move to, and a fleet's order target are drawn on the map. Orders are ended from the
  card (stand down, on station, call off a drop, halt) or replaced by another; the selection
  stays where it was.

**Several at once** (format 8):

- Shift+click or Shift+drag selects forces of ours (armies, fleets, wings).
- Ctrl/Cmd+click or Ctrl/Cmd+drag selects provinces.
- **X** is the Select tool. It selects forces, then provinces, with a switch on its banner; on touch it is the check-mark button.
- The Military ledger (**U**) has check boxes, Select all and Select idle.

A force selection can march together, become a new operation, or join an open operation's
card.

**Forces shown** (`ui/map/visibility.ts`) changes only what is drawn, never what is known.
There is no fog of war. One rule drives the map markers, the province and sea-zone lists,
box selection and the counts:

- **All** shows every realm's forces.
- **Mine + enemies** shows ours and every force of a realm at war with us, anywhere.
- **Relevant** shows ours and the forces in our wars: allies by a setting, and only near the selected force or operation when there is one. It never shows a neutral realm.

The set is the same at every zoom. Fleets are grouped by zone and realm at a distance. The
count of what a view hides is shown under it.

## Operations: delegated command (`src/sim/ops/`)

An operation is a standing objective given to forces of ours. Each week it gives the
routine orders through `applyCommand`, under the same rules, costs and timing as the
player's own orders. Its orders are not logged as player commands, and they never take a
unit under direct command.

**Workflow:**

1. Select forces.
2. Click New operation.
3. Choose the objective and the area on the map.
4. Read the preview: a dry run of the first week's orders, drawn on the map with forecasts, risks and what stands in the way.
5. Choose the posture and the limits.
6. Activate, or save to start later.
7. Monitor, change, pause, add forces, release them, take one over, or cancel.

| Objective | Area | What the planner does |
|---|---|---|
| Conquer | provinces | Takes the enemy-held provinces of the area (at most 24 targets at a time), defends its own base, our land next to the area, and the airfields and ports it uses |
| Advance | a province | Takes the corridor of enemy land on the route to it |
| Hold | provinces | Holds posts in and near the area; liberates what is lost |
| Keep the seas | sea zones | Fleets patrol, intercept enemy ships in the zones and escort our loaded ships |
| Landing | a beach | Gathers the troops and transports at a port with an escort, sails, lands, then takes the area like a conquest |

**Posture** sets how far the operation will go:

| Posture | Strength needed (× defenders) | Forecasts accepted | Wait after a failed attack | Withdraws from (× its strength) |
|---|---|---|---|---|
| Cautious | 1.5 | victory | 12 weeks | 1.2 |
| Balanced | 1.2 | victory, uncertain | 8 weeks | 1.6 |
| Aggressive | 0.95 | victory, uncertain | 4 weeks | 2.2 |

The settings are:

- priority;
- a reserve share (15%), committed to battles a forecast with the reserve says can be won, or freely;
- a readiness limit (45%), below which armies recover;
- a supply limit: no attack beyond our supply lines, except where our troops already stand or on a beachhead;
- leave to reorganise;
- leave to rebase aircraft;
- an airborne mandate (off, once or repeat) with a loss limit;
- whether a member returns after an order of ours is carried out;
- what to do when complete (hold, regroup, return, await).

**The ground planner** (`ops/ground.ts`) is shared by player operations and the AI's war
planning (`ai/operational.ts`), each with its own policy. Each week it plans in this order:

1. Recovery. Tired, depleted or unsupplied armies fall back to rest, unless they are besieging.
2. Small armies join the nearest larger one and merge.
3. The reserve is held back.
4. Targets are ranked: defence, liberation, then attack. Ranking is by value, with commitment to the current target (against churn) and distance.
5. The force each target needs is set. It comes from the defenders, the forts and the enemy troops next to the target.
6. Targets recently lost are skipped: an attack that failed is not repeated for the posture's wait, and after that only with more strength.
7. Targets beyond supply are skipped.
8. Task forces are assembled from the nearest fit armies.
9. With leave, detachments split off for weakly held targets.
10. Forces concentrate and merge before a strike.
11. The forecast gate decides whether to attack.
12. The reserve is committed.
13. Idle armies cover posts, or wait before a blocked target.
14. Idle armies standing together regroup.

Marches go around provinces holding enemy armies (a detour waypoint) or stop and say why.
Nothing teleports and nothing is captured instantly. Armies march, fight, besiege and occupy
by the ordinary rules, with no bonus.

**Splitting and regrouping.** Only whole regiments move, so men, experience, equipment and
regiment ids are conserved. The limits are:

- at least 2 regiments per detachment (3 for the AI);
- at most 6 live detachments per operation;
- a wait before an army reorganises again;
- **Keep together** on an army's card protects a formation;
- an operation without leave to reorganise never splits or merges.

**Navy, air and airborne** (`ops/forces.ts`):

- **Fleets** go to port below 50% hull and return at 90%. They shell the coast where the operation's armies fight, keep carriers on station, blockade, raid, intercept in the operation's zones, and patrol and escort.
- **Wings** rest below 35% readiness or 30% strength, and fly again at 70% readiness. Fighters keep the sky over the main efforts, and ground attack and bombers support and strike there. A wing out of range moves only with leave to rebase, to an airfield with room. Without leave, the operation asks.
- **Airborne drops** need the mandate. They land inside the area, within the loss limit, near our armies that can relieve them within two marches. They are flown only by the operation's own transports, one drop a week. "Once" ends the mandate after the drop.
- **Landings** check the threat next to the beach (limit by posture: 0.6, 1, 1.5) and forecast the landing before they sail. They report missing transports or room.

**Authority and override.** An operation may only issue movement and employment orders to
its own members: march, stop, split, merge, fleet duties and sailing, embarking, air
missions, rebasing, and airborne drops. An allowlist (`OP_ORDERS`) refuses anything else.
It never:

- declares war, makes peace, or signs or breaks a treaty;
- changes a policy or research;
- buys, builds, recruits or disbands anything;
- enters a neutral realm.

Any order the player gives a member takes that member under direct command at once
(`opHold`). The operation then leaves it alone until it is resumed, or, if set, until the
order is carried out.

- **Pausing** stops new orders, and members keep their last ones.
- **Cancelling** hands every member back with its last orders.
- **Releasing** detaches members.
- **Assigning** a member to another operation moves it there. A unit belongs to at most one operation, and the membership is stored on the unit.

**Completion and problems.**

- An operation is **complete** when its area is ours or its objective is reached. It then follows its completion rule.
- **Peace** ends a conquest, since nothing is left at war.
- **Routine events** go to the operation's log (at most 40 entries).
- **Notifications** are raised only for decisions, once per problem, each with the actions that answer it: no forces left, every member under direct command, attacks failing, a target blocked, aircraft out of range, or a landing that cannot sail.

**Limits:**

- 12 operations a realm;
- an area of 250 provinces or 30 sea zones;
- operations are planned one per week slice, so a large one never holds a frame.

## Wars and peace (`war.ts`)

- **War goals:**
  - **Claim** — provinces we hold claims on. No trust cost.
  - **Conquest** — up to two provinces of the target. **No shared border is needed**: the
    goals offered are provinces bordering our land first, then coasts by the length of the sea
    route from our ports, then the rest by distance. Costs 8 trust and alarms the target's
    neighbours. Forbidden while the Concord of Nations focus is held.
  - **Coalition** — declared by a coalition member; all members join.
  Claims come from history, events, peace (the previous owner keeps one) or 12-month fabrication
  on a province bordering ours or, from Stage F, on a coast whose sea zone holds or borders a
  zone with one of our ports (so island realms can make war across the water).
- **Blocked by:** truces (5 years after peace), non-aggression pacts, and alliances. Nothing
  else: whether our forces can reach the enemy is a separate question.
- **Eligibility, reach and sustainment are separate.** Before the declaration Diplomacy shows a
  war-reach assessment (`reach.ts`) of the forces we have now: whether our armies can march onto
  their land (through our own, friendly or unclaimed land only: declaring war grants no passage
  through neutral realms, and military access exists only between allies and co-belligerents),
  how far their nearest coast is by sea from our ports and how many regiments our transports
  afloat carry, their navy (with their allies') against ours, and how many of our wings reach
  their land. It warns when no usable route exists or the landing force or escort is too small,
  but never blocks the declaration. Holding a beach overseas needs a fleet offshore or a captured
  port (sustainment, below).
- **Calls to arms:** the target's defensive allies, the realms that guarantee its independence and
  the realm whose sphere it is in are called. AI realms join unless exhausted or already in two
  wars. A human player gets a 4-week decision that defaults to honouring the call. Declining
  breaks an alliance and costs 15 trust, ends a guarantee and costs 10 trust, or (a patron) costs
  20 influence over the realm and its good opinion. Anyone allied to both sides, or in a pact with
  the attacker, sits out. The attacker's allies are **not** called: alliances are defensive only.
- **Going to war ends ties** between the two realms: their trade agreement, loans and
  reparations between them (repudiated), a guarantee between them (breaking it costs the
  guarantor 10 trust), a trade bloc they share (the attacker leaves it), and half of the
  influence each holds over the other.
- **Contribution:** each participant's contribution to a war grows with every battle it wins (1 +
  enemy losses / 1,000, shared among the winners; losers gain half the casualties they inflict),
  every naval battle (1 for holding the sea, 1 per ship sunk) and every month it holds enemy land
  (a tenth of the land's weight). It sets the shares of a peace settlement.
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
  A separate peace with the opposing war leader removes one participant. Any peace removes
  the pending peace offers and calls to arms that no longer apply.
- **Peace settlements** (`settlement.ts`): a war leader can end the war for every participant
  at once. A settlement is a list of demands, each from a realm on the losing side to a realm on
  the winning side:

  | Demand | Effect | Cost (war-score points) |
  |---|---|---|
  | Cede a province | as above | 100 × weight / giver's total weight (min 5; × 1.5 unoccupied; × 0.8 if the receiver claims it) |
  | Pay crowns | at once | 1 per 20 crowns |
  | Reparations | 10–30% of the giver's gross income each month, for 5 years | 8 per 10% |
  | Disarm | the giver may have at most half its regiments (min 3), and no battleships or carriers, for 5 years | 12 |
  | Renounce claims | the giver drops its claims on the receiver's land and may not attack it for 10 years | 5 |
  | Enter our sphere | the receiver gains 40 influence over the giver; every rival's is halved (receiver must be larger) | 15 |

  The opposing leader accepts when its score is ≥ 0: minus the demands on it, minus 60% of the
  demands on its allies, plus the war score against it, 0.4 × its exhaustion, +20 with no army
  left, +10 after five years; minus stubbornness, pride (−5), and −5 each for being disarmed
  or drawn into a sphere; it must accept at exhaustion 100. A settlement *offered* by the
  losers is judged like concessions. When it refuses, the **counter-offer** is the settlement
  with its most expensive demands struck out until the rest would be accepted (none, if less
  than 40% of the value is left). A player offered a settlement can strike demands and send
  the rest back; the AI accepts the counter-offer when it judges the reduced terms enough.
- **Graded by contribution:** each winner's share is its contribution + 1 (the leader's × 1.25)
  over the side's total. The AI leader's budget is 0.9 × its war score + 0.3 × the losing
  leader's exhaustion − 3; each winner's part of it (the leader first in line for war-goal
  provinces) is filled in order with: occupied land next to it or claimed by it (at most 2 per
  ally, 3 for the leader, 3–4 in all, never a capital it does not claim), a sphere for a
  diplomatic or commercial realm (or one on the diplomatic path) over 1.2× the loser's
  development when no one holds the loser yet, renunciation of the loser's claims on it,
  disarmament of a dangerous neighbour, reparations (10–20%), then crowns. An ally given less than half its
  fair share resents the leader (−8 or more opinion); a winner whose claim was handed to another
  resents the receiver (−10); the losing leader resents the settlement (up to −30).
- **Unresolvable wars cannot happen:** a white peace is forced after 8 years, or after 3 years
  with the score within ±10. A side holding ≥ 90 for 12 months dictates a settlement (the AI's
  terms for its side), with no answer needed.
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
  - **Trade** — resource exchange and commerce each month (see Economy); cancelled by war.
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
  conquest wars declared, or allies or guaranteed realms abandoned.

### Influence, spheres, guarantees, loans and trade blocs (`influence.ts`)

- **Influence** (0–100) is what one realm holds over another. Each month it gains: an envoy at
  their court 1.5 × the size factor (our development / theirs, 0.5–2); a trade agreement 0.5 for
  the larger economy; an outstanding loan 1; our guarantee 0.75; an alliance 0.3 for the
  stronger partner; leading their trade bloc 0.5 — all × (1 + influence modifiers). It loses 0.5
  a month always and 3 a month while the two are at war; going to war halves it.
- **Sphere:** a realm is in the sphere of the larger realm that holds ≥ 40 influence over it and
  ≥ 1.25 × any rival's (never while they are at war). A sphere member's opinion of its patron
  is +15; it will not ally against its patron (−40 to such alliances) or join a coalition against
  it; its patron is called to arms when it is attacked. Each member counts 2 toward the
  patron's Diplomatic Leadership.
- **Guarantee of independence:** unilateral. The guarantor is called to arms when the
  guaranteed realm is attacked. A realm may give one guarantee (plus focuses: Guarantor of the
  Balance, a diplomatic ambition); it cannot guarantee a realm more than 1.2× stronger, an ally
  or a realm it is at war with. The guaranteed realm thinks better of it (+15). Revoking
  costs −15 opinion.
- **Loans:** at least 50 crowns and at most half the lender's treasury, repaid over 24 months
  with 20% interest through the monthly ledger (the instalment is an expense for the borrower
  and income for the lender; nothing is paid while they are at war). The lender gains 5
  influence per month of the borrower's income lent (at most 20) at once, and 1 a month while
  it is repaid; the borrower +10 opinion. An AI borrower accepts by a listed score: debt +25, a
  low treasury +15, at war +10, opinion × 0.3, fear of the lender −20, interest −2 per month of
  income, an already strong influence −10.
- **Trade blocs:** a customs union founded with a trade partner (50 crowns) and led by its
  founder, up to 6 members, joined by invitation or request. Inside the bloc purchases cost
  20% less and commerce between members earns 50% more; the crowns blockades take from any
  member are shared by all members in proportion to their taxes ("Bloc solidarity" in the
  ledger). Members think better of each other (+5). An AI realm judges membership by a listed
  score: −30 (its own tariffs), −2 per member, opinion × 0.4, +15 if it trades with the leader,
  +5 per other member it trades with, its trade with the leader (the leader's view), fear −20,
  +15 in the leader's sphere, +10 commercial.

## Research and national focus (`progression.ts`, `focus.ts`, `data/techs.ts`, `data/focus.ts`)

- **Research:** 73 technologies in five branches (land warfare 19, industry 18, society 17,
  naval 12, air 7) across five eras: I Rifle & Rail (1870), II Steel & Breech (1885),
  III Dreadnought & Engine (1900), IV Total War (1915) and V Mechanised (1925). Each technology has a **horizon year**. Era costs are 150 / 220 / 320 / 440 / 560
  points (×1.35 on Aldmere). Researching before the horizon costs 15% more per year early,
  and nothing can be finished more than 10 years early. Every realm knows the technologies
  whose horizon is at least five years before the campaign starts (7 on Aldmere, 23 on the
  Reach). Points per month = (0.5 + 0.4 × √Σ(dev × integration factor)) × funding ×
  (1 + modifiers) × (1 − overextension/2). Nine technologies unlock units: Engineering Corps
  (engineers), Tanks (armour), Torpedo Boats, Submarines and Naval Aviation (ships), and
  Aviation, Fighters, Ground Attack and Strategic Bombing (air wings). Transports, cruisers
  and battleships need none.
- **National focus** replaces the six policies of earlier versions. A realm works on one focus at
  a time, one month of work a month; a finished focus is permanent. A focus may require others
  (all of, or any of), exclude others (both ways), wait for a year, or need a coast. Switching
  loses the work done on the current focus.
  - **The generic tree** (37 focuses in five branches): *Industry* (National Railways, Mining
    Concessions, Heavy Industry, Chemical Works, Steel Programme, Motor Industry, and Consumer
    Goods *or* War Economy); *Army* (General Staff, then Martial Levy *or* Professional Army
    and Fortress Doctrine *or* Spirit of the Offensive, Artillery Parks, Mobile Warfare,
    General Mobilisation); *Sea and air* (Naval Programme, Battle Fleet *or* Cruiser Warfare,
    Marine Corps, Air Corps, Strategic Air Doctrine, Naval Aviation); *Diplomacy* (Diplomatic
    Service, Mercantile Charter, Concord of Nations *or* Realpolitik, Overseas Banking,
    Guarantor of the Balance, Sphere of Influence); *State* (Royal Academy, Frontier
    Settlement, Technical Universities, Civil Service, Social Insurance, National Press,
    Planning Bureau). Durations are 9–14 months; effects are the size of a technology's.
    Rewards: factories, railways, development, stockpiles, crowns, a port, an airfield, trust.
  - **The national branch** (5–7 focuses) is made for each realm from its map when the campaign
    starts: a *heritage* fitting its temperament; one or two mutually exclusive *claims* on the
    neighbouring regions held mostly by others (claims on every province of the region held by
    another realm when completed); *develop* its home region (+1 development in four
    provinces); its most common *resource* (+30% output and a stockpile); a *navy league*
    (coastal) or a *railway network*; and an *ambition* that follows its victory path
    (Greater … with claims on its four richest foreign border provinces; … Prosperity; or a
    Concert with guarantees and influence). The realms of Aldmere, the Reach and the Baltic
    have hand-written names; every other map, including maps from the editor, gets names made
    from its realms and regions.
  - **Concord of Nations** allows wars only over claims while it is held.
- **Stacking:** all modifiers from traits, technologies, completed focuses and timed events add
  together (`modifiers.ts`) and apply identically to AI realms and the player.

## Events (`events.ts`, `data/events.ts`)

There are 20 condition-based events, among them factory strikes, mine disasters, oil booms, harvests, border incidents, frontier
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
A month in which a path's conditions fail pauses its timer; from the second failing month in
a row it loses 6 months a month. A realm that falls short only on the main measure, and by at
most a tenth (≥ 90% of the territorial share with the regions held, of the economic share, or
of the influence needed), with every other condition met, keeps its timer paused instead:
the knife-edge flickers of an opinion or a treaty no longer wind back years of standing.

1. **Territorial Dominance:** own and control ≥ 75% of the provinces in *R* regions and
   ≥ *T* of all provinces, held for 24 months.
2. **Economic Prosperity:** integrated development (the dev of controlled provinces at
   integration ≥ 75) ≥ *E* of the world's development, with dev-weighted unrest ≤ 25, no debt, no
   bankruptcy and none of your land occupied, held for 60 months. A windfall cannot
   do it; rivals can break it by occupying one province.
3. **Diplomatic Leadership:** influence over partners whose opinion of you is ≥ 35, each
   counted once for its strongest bond — an alliance at least 3 years old or being in your
   sphere 2, your guarantee (a year old) 1 — plus 1 for a trade agreement at least 3 years
   old with a contract in force under it (an agreement alone is only the framework for
   contracts, and the AI signs one with nearly every realm); at *D* per other surviving realm (minimum 6), with trust ≥ 65 and no offensive war,
   held for 60 months. New treaties do not count, so cycling treaties is pointless.

| Threshold | The Reach (9 realms) | Aldmere (14 realms) |
|---|---|---|
| *R* regions dominated | 3 of 14 | 6 of 42 |
| *T* share of all provinces | 23% (23 provinces) | 18% (54 provinces) |
| *E* share of world development | 20% (the stated 25% × 0.8) | 14.4% (18% × 0.8) |
| *D* influence per other realm | 1.25 (10 with 8 rivals) | 0.85 (12 with 13 rivals) |

Every map's stated economic share is multiplied by 0.8 in play (Stage E): focus trees develop
every realm, so a leader's share of the world's development runs lower than before; the
Victory ledger and the map editor show the share in play.

Aldmere's thresholds are scaled from the Reach's by what "dominant" means among fourteen
realms rather than nine: an average realm holds 7% of Aldmere against 11% of the Reach. The
Reach's 23% is 2.1× an average share; Aldmere's 18% is 2.5×, so dominance on the larger map
is, if anything, relatively harder. Region counts scale with the number of regions.

- **Rival reactions:** AI realms react to a rival past 35% of a timer. Against a territorial or
  economic leader they raise their alarm (which feeds coalitions), arm, and lower their war
  threshold against it. Against a diplomatic leader they grow wary instead (up to −20 opinion,
  shown as its own line in the opinion breakdown; its allies and the realms in its sphere do
  not) and, past halfway, may cancel trade with it.
  Coalition notices name the cause: expansion or a bid for victory.
- **Separate peace:** a secondary participant can leave a war with the opposing leader. The war
  goal penalty applies only to the war's actual target, and allies left fighting lose 15 opinion
  of the realm that left.
- **Simultaneous winners:** resolved by campaign score (disclosed): 3 × provinces + 0.6 ×
  integrated dev + 3 × technologies + 3 × influence + min(treasury, 2000)/100 +
  per path (20 × timer fraction + 10 × condition progress).
- **Campaign limit** (the Reach 25/40/60 years from 1895, default 40; Aldmere 40/60/70 years from 1880, default 60): the highest score wins.
- **Defeat** is elimination, or another realm winning. Losing the capital is not fatal. After a
  result you may continue playing; the result stays recorded.

## AI (`src/sim/ai/`)

The AI uses only `applyCommand()`: the same validation, costs, movement, combat formulas,
treaties and cooldowns as the player. All information is public for everyone; fog of war is
not implemented, and this is stated in the Help ledger.

| Layer | When | Decides |
|---|---|---|
| Strategic (`strategic.ts`) | monthly, staggered | goal and victory path (once a year it pursues the path it is closest to among its temperament's and the two material paths — condition progress + half its timer, leaning to its temperament's path; only diplomatic temperaments pursue diplomatic leadership); army size target from income, reserve and supply (a larger share when threatened or at war); research by branch weights and situation; national focus (when none is under way: the temperament's branch weight × how well the focus's tags fit — war, threat, coast, shortages, frontier load, victory path — preferring the national branch and earlier rows); construction by value per crown; envoys and treaties (mutual acceptance required; envoys also toward smaller realms it could draw into its sphere and, on the diplomatic path, toward partners that count toward leadership whose opinion sits within 10 of the bar); guarantees (once a year, of a smaller neighbour threatened by a realm it fears), loans (once a year, from a treasury above 4× income, to a realm in debt or one it wants in its sphere) and trade blocs (join a bloc whose leader it trades with, or found one with its best trade partner; leaders invite partners); coalition wars; peace (as war leader, a settlement for its side by contribution, or the counter-offer it would get; an ally on the winning side leaves the spoils to the settlement; white peace or concessions when losing or tired); war (see below; never while holding the conditions of a diplomatic or economic victory, or while that timer is paused just short of them) |
| Operational (`operational.ts`) | weekly (every 2 weeks on Easy) | peace: garrisons for restless frontier, gathering and merging at a rally point; war: objectives (defend, liberate, attack) planned by the ground planner the player's operations use (`ops/ground.ts`, see Operations) with its own policy — commitment to targets, a memory of failed attacks, task forces sized to the opposition, staging and merging before attacks, forecast checks by difficulty, a reserve by personality, bounded detachments, regrouping of small armies, routes around enemy stacks, withdrawal and recovery |
| Execution | inside both | recruitment toward the target composition at safe sites; issuing and re-issuing orders; recovering from rejected orders |

**Deciding on war.** The AI scores each bordering realm as value × (strength ratio / required ratio − 1) × aggression.

- *Strength* counts the potential of both sides, with allies weighted by whether they can reach the fight and coalitions included.
- *Value* comes from the goal provinces' development, claims and whether the target is a rival close to victory. It is halved when the AI's neighbours are alarmed and when the target is already beset.
- *Supply feasibility* is checked first.
- *Required ratios* come from the personality. Aggressive temperaments grow restless during long peace and as the campaign advances.
- *Exposure* (crossroads realms): unfriendly neighbours not bound by a pact or alliance count
  against a war plan, at 15% of their strength, scaled by (open borders − 2) / open borders.
  A realm with two open borders ignores them; one with six weighs two thirds of them. This
  stopped crossroads realms such as Morvaine from starting a war nearly every year and being
  carved up by the neighbours they had left open.
- *Second fronts:* an AI already at war and at 25+ war exhaustion refuses an ally's call to a
  new front (breaking the alliance, as a player would).

**War planning** (format 8). The AI plans its armies with the same ground planner as the
player's operations. Its policy:

- a reserve by personality: defensive 20%, expansionist 5%, opportunist 10%, others 15%, none on Easy;
- detachments of at least 3 regiments, at most 3 at a time;
- a wait after a failed attack: 10 weeks on Hard, 8 on Normal, 4 on Easy.

Attack objectives get a seeded ±5% variation in value, so realms are less predictable
without breaking replays. Failed attacks, target changes and targets left alone are written
to the decision trace. Measured over 40 weeks and four seeds on two maps, failed attacks
repeated within 8 weeks fell from 11 and 7 to 1 and 0, and target churn fell (Aldmere: 1.3
to 0.3 per army-month), with fewer men lost on both sides
(`reports/qol/verification.md`).

**Several fronts.** In war, armies without an objective no longer all gather at one rally
point. For each enemy the AI picks a front post (the border province best placed to face
that enemy's armies, preferring forts and development) and weighs the strength of the enemy
armies within three marches. Idle armies go where the threat is least matched by armies
already there.

**Navy and air** (`navy.ts`). Monthly, each coastal realm spends a share of its income on
ships (by temperament and coastline, more at war) toward a target mix: transports first,
then screens, cruisers, capital ships, submarines (more against battleship navies) and
carriers. It never launches ships into waters the enemy holds. A first port, and airfields
once Aviation is known, are chosen with the other construction projects. Wings follow a mix
of fighters, ground attack and bombers, with one or two reconnaissance wings. Weekly:

- At peace fleets keep station off the realm it plans to fight, off coasts it claims, or on a
  strait beside its shores; otherwise at home.
- At war the main fleet seeks the zone within reach where it does the most good and can hold
  (enemy coasts to blockade, straits, enemy fleets it outguns by 20%, its own troopships to
  escort, our blockaded coasts and raided trade to set free, coastal battles of ours to shell),
  avoids waters where enemy aircraft hold the sky unless it has fighters aboard, falls back when
  outgunned, and returns to port below 55% condition. Submarines are detached as raider
  squadrons and lie on the routes of enemy sea trade where enemy escorts are weaker.
- A monthly invasion plan picks an enemy coast that is weakly held or out of reach by land and
  a port to gather at. Transports gather there and a detachment boards; it sails under the
  escort of a war fleet in the port's zone, or waits (calling the nearest war fleet) while
  enemy ships or aircraft watch the route; the plan is dropped after eight months.
- Each wing flies the most useful mission it can reach: support for our battles, and support on
  call where a battle is about to begin (an army marching onto enemy troops, standing beside
  them, or about to land: most land battles are fought out in a week, and on call costs
  nothing until they start), naval strikes on enemy fleets (troopships first), fighters against enemy aircraft over our land, battles and
  fleets, interdiction of enemy armies at our borders, bombing of enemy airfields, shipyards and
  factories, reconnaissance with our strikes. At peace every wing rests: a patrol meets nothing
  and would only wear down the readiness a war's first weeks need. A working order is kept
  unless another scores a third better, so orders do not flip week to week.
- Empty carrier decks are filled with fighter and ground-attack wings from airfields within
  reach (a fighter for each carrier first); carriers are only built with such aircraft to fly.
- Wars on realms it does not border are considered only with transports afloat for six
  regiments, a navy 1.2× theirs (with their allies'), and a coast within four sea zones of its
  ports; their value is discounted for the trouble of holding a beach overseas.

**War assessment and peace** (`assess.ts`, format 7). Each month, for each war, a realm
assesses where it stands from what any realm can see: the weighted share of its land the enemy
holds and of theirs it holds (a province weighs dev + 1, a capital twice), field strength of
both sides (allies at 70%) and what each could still raise from its pool and treasury, whether
the lost land can be retaken (our strength in and next to it, half of our armies elsewhere,
against theirs there), exhaustion, capitals and the war score. *Leverage* is where it stands
now, *outlook* where the war is heading; their average, the *standing*, is how it judges any
terms, the player's included.

- **Winning** (outlook ≥ 20, standing ≥ 15): the war leader settles once its goals are held,
  the enemy is close to collapse, another threat needs its armies, it is tired, or the advance
  has stalled; otherwise it presses on and logs the settlement it set aside. Its demands grow
  with its daring (risk) and the enemy's exhaustion; after a refusal they come back more
  moderate unless its position improved. It offers the player too.
- **Losing** (outlook ≤ −20 or standing ≤ −25): it fights on while the lost land can be
  retaken; otherwise it concedes land it has lost (the capital only when exhausted) and gold,
  enough to close the gap, more after a refusal. It never repeats a refused offer, and a white
  peace is no longer the first and only offer of a realm that has lost half its land (the
  reported case: `tools/half-country.ts`, before and after in `reports/military/`).
- **Stalemate:** a white peace once both sides are worn down, or it is exhausted.
- **Memory:** each war remembers the last offer, its value, the standing then, and the answer;
  a refusal is not repeated until the standing moves by 10 or its patience runs out.

**Treaties for stated reasons** (format 7). An alliance is proposed to a realm within two of
a threat both fear, to a realm fighting the same enemy, to a neighbour of a realm threatening
us (for temperaments that seek allies), or to an old friend on the diplomatic path; a pact to
the realm threatening us, to a stronger neighbour (cautious temperaments), or to a neighbour
whose border should stay quiet while our armies are needed against someone else; trade for the
commerce and goods it would bring, counted only where present partners do not already cover
them. The reason goes with the proposal and the player's dialog shows it. The recipient
weighs its own interests by the same rules: an alliance's obligations (it would be drawn
against every realm the proposer fights or fears and it does not, more so if it has a treaty
with them), a pact that frees the proposer's armies against a realm it stands by. A realm
sounds others out before a formal offer; a refusal is remembered with its reason and the same
request waits 12 months × patience (24 for a human). Once a year a realm leaves an alliance
whose partner it now fears, who claims its land or with whom relations have soured, unless they
share a threat or a war.

**National management.** The army target is the least of what crowns (a share of income by
temperament and danger), men (three quarters of the reserve) and supplies allow; its marked
changes are logged with the limit that binds. Envoys are kept within about a tenth of income.
Anti-aircraft batteries go where enemy aircraft fly or could (industry, airfields, the capital);
air missions weigh the anti-aircraft fire they would fly through.

**Personality.** Risk tolerance (expansionist 1.25, opportunist 1.15, diplomat 0.9, commercial
0.85, defensive 0.8) scales demands and how far a realm presses; patience (defensive 1.3,
expansionist 1.1, diplomat 0.9, opportunist 0.8, commercial 0.7) how long it waits before
repeating an offer, settling a stalemate, or asking again.

**Stability.** Commitment bonuses keep plans from flip-flopping; emergencies reassign armies at once.

**Diagnostics** go to `state.diagnostics` (the last 400): chosen research, policies, war candidates with
ratios and scores (once a year per realm), declarations, peace decisions with the assessment
behind them and the options rejected (fighting on, holding out, pressing on, offers and
settlements), treaties proposed and sounded out with their reasons and the recipient's
objections, alliances left, army-target changes, army objectives, attacks held back by
forecasts, and rejected orders. They are included in bug reports.

| Personality | War ratio | Aggression | Preferred path | Realms |
|---|---|---|---|---|
| Expansionist | 1.15 | 1.4 | territorial | Vostmark, Morvaine |
| Opportunist | 1.2 (0.9 vs a realm already at war) | 1.1 | territorial | Drevenholt, Tarsk, Hrafnmark |
| Commercial | 1.45 | 0.7 | economic | Aurel, Lessia |
| Defensive | 1.8 | 0.5 | economic | Calder, Istrel, Carrow, the Ashmark |
| Diplomat | 2.0 | 0.4 | diplomatic | Serennes, Fenward, Solmarre |

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
- **Save format 8** (`src/sim/save.ts`): versioned and checksummed JSON of the complete state,
  including movement progress, battles, queues, treaties, events, stockpiles, factories,
  fleets (with troops aboard and last week's report), ports, slipways, air wings (base or
  carrier, mission, sea target, readiness, last week's report), airfields, national focus,
  influence, guarantees, loans, trade blocs, reparations, army limits, war contributions and
  AI commitments; format 7 adds the war dead missing from each reserve, fleet orders,
  anti-aircraft batteries, airborne operations under way, wings' service records, and the
  AI's memory of peace offers and treaty answers; format 8 adds operations (objective, area,
  settings, tasks, planner memory, log, statistics), each unit's membership and direct-command
  flag, protected formations, and the AI's memory of failed attacks and reorganisations. (Stage C extended format 3 rather than starting a new one: a format-3 save
  written before fleets existed loads with empty navies and air arms, starting ports from the
  map, and a notice.)
- **Saves keep their map.** The state records the map's fingerprint: its id, content revision and
  a checksum of its gameplay content (`src/maps/format.ts`). A save whose map has changed
  since then loads only if the provinces and realms are the same, with a notice. Otherwise it is
  refused with both revision numbers. A save of a map that does not ship with the game embeds
  the whole map package. On load, the package is sanitised and validated like an import. It must
  not reuse a built-in id and must match the recorded checksum.
- **Migrations** (`src/sim/migrate.ts`) convert older formats step by step and say so. Format 1
  (the first two releases) becomes format 2 by recording the built-in map's fingerprint
  (revision 1). Format 2 (the 17th-century rules) becomes format 3 (the industrial age): foot,
  horse and guns become infantry, cavalry and artillery; researched technologies map to their
  nearest equivalents and every realm learns the start-year technologies; factories,
  stockpiles and materiel are added from each province's development; a built-in map moves to
  its current revision and an embedded map package is upgraded to the current map format; the
  calendar moves to the map's new start year. Format 3 becomes format 4 (Stage E): each realm's
  national policy becomes the matching completed focus (with the focus it requires: Mercantile
  Charter, Martial Levy, Frontier Settlement, Royal Academy, Fortress Doctrine, Concord of
  Nations), every realm then chooses a focus, wars under way start recording contribution, the
  new diplomacy starts empty, and policy changes are dropped from the command log (they can no
  longer be replayed). Format 4 becomes format 5 (trade contracts): running exchanges become
  12-month contracts at list price. Format 5 becomes format 6 (the naval and air update): every
  wing starts fully ready at its airfield with its mission kept, carriers start with empty
  decks, and the new force statistics start at zero. Format 6 becomes format 7 (military
  control and national scale): nothing is paid out or refilled (treasuries, pools, stocks and
  forces stay as they were; no war dead are charged retroactively), fleets are on station with
  no order, there are no batteries and no drops under way, and the AI's offer memory starts
  empty; population now reads in people and commerce follows the partners' economies from the
  next month (`tests/format7.test.ts`). Format 7 becomes format 8 (operations): there are no
  operations and no unit belongs to one, and the AI's memory of failed attacks starts
  empty. The notice says all of this. A save that cannot
  be converted (for example an embedded map that no longer validates) is refused with the
  reason, stays listed, and can still be exported from the load screen. The tests convert a
  save from the first release (`tests/fixtures/reach-save-main-c29aea6.json`) and two format-2
  saves written by the Stage A build (`tests/fixtures/*-format2-168569b.json`, one with a
  custom map) and a format-3 save written by the Stage D build with a war under way
  (`tests/fixtures/aldmere-save-format3-9e67015.json`), play them on and save them again. The browser checks import the
  format-1 and format-2 files and expect the notices.
- **Loading:** damaged, truncated, foreign, newer or oversized (> 20 MB) files are rejected with a
  message, and the current campaign is kept.
- **Bug reports** (`src/sim/diagnostics.ts`) replay exactly. A campaign started in the session
  replays from a fresh game with the same settings. A campaign loaded from a save replays from
  that save, carried in the report as a checkpoint. When the player command log reaches 2,000
  entries, it rolls over to a new checkpoint instead of dropping early commands. Playing on
  after the result is a logged command. `npx tsx tools/replay.ts <report>` checks the final
  state checksum.

## Balance assumptions and evidence

The numbers above were tuned against AI-only campaigns (`npm run sim`). The latest batches
are in `reports/stage-c/` (10 seeds per map at normal difficulty, with the system-usage
section; Stage B's are in `reports/stage-b/`); the 30-campaign batches from before the industrial rules remain in
`reports/ai-campaigns-aldmere.md` and `reports/ai-campaigns.md`. They record seeds,
difficulties, winners, war counts, bankruptcies, idle-army share and performance.
Observations that drove the tuning:

- **Too easy to win diplomatically:** diplomatic victory in about 6 years. Fixed with older-treaty influence, trust 65, a 60-month hold and rival counter-play.
- **Frozen world:** pacts everywhere meant no wars. Fixed so aggressive temperaments refuse pacts that bind them, and pacts last 5 years.
- **Useless late-game money:** treasuries of 30k+ because every province maxed its development by year 20. Fixed with escalating costs, the soft cap and charters.
- **Alliance deterrence froze the map:** fixed by weighting allies by reach and adding restlessness.
- **Then too hard to win diplomatically:** once rival wariness replaced alarm, no AI realm won diplomatically in 30 campaigns. Every broken streak was a partner's opinion slipping below 40 under small stacked penalties (border friction, claims, alarm from the diplomat's own conquests, wariness). The partner threshold is now 35.
- **Aldmere, first batches:** Lessia won every early campaign on score, and Morvaine and
  Hrafnmark collapsed between neighbours who could all attack them at once. The fixes were:
  - crossroads caution (the *Exposure* term under AI);
  - declining second fronts;
  - front posts for idle armies;
  - poorer Lessian lands and stronger Carrow and Hrafnmark (fortresses, wealth, morale).

  Three other exposure formulas were tried and rejected, because each broke one map while
  fixing the other. They are listed in STATUS.md.
- **Large peaces on Aldmere:** a beaten AI realm concedes the land its enemy occupies. On
  Aldmere that can be 10 provinces in one treaty. A province's cost is its share of the giving
  realm's weight (floor 5), so this is the same share of a realm as 3 or 4 provinces on the
  Reach. The rule was left as it is.
- **Remaining skew:** the richest heartland wins most AI-only campaigns on both maps:
  - Aldmere: Lessia 15 of 30, Aurel 7, Tarsk 5 (13, 5 and 7 before Stage A's rule fixes).
  - The Reach: Aurel 15 of 30, Tarsk 11 (15 and 8 before).

  On Aldmere, Hrafnmark, Vostmark, the Ashmark and Carrow shrink on average. Serennes, Istrel
  and Solmarre rarely go to war. See STATUS.md for the tables. These are small samples and
  diagnostic, not proof of balance.
- **Stage B, the industrial economy** (`reports/stage-b/`, 10 seeds per map):
  - The first batches showed coal running out in 17–30% of realm-months and factories
    growing twentyfold. The AI counted coal it imported at full value and ignored the
    factories it was already building, so importers overbuilt and then idled when exporters
    burned their own coal. The AI now counts only its own coal, half its imports and the
    factories under construction, and a factory without coal keeps 30% of its capacity.
    Coal shortages fell to 8% (the Reach) and 13% (Aldmere) of realm-months, and every
    surviving realm runs industry at the end.
  - Trade is 12% (the Reach) and 11% (Aldmere) of income at year 25, down from about half
    under the flat trade bonus. A small coal exporter can still draw most of its income
    from trade (the highest single realm was 64% and 78%).
  - The average realm finishes 56% (the Reach, 40 years) and 46% (Aldmere, 60 years) of
    the 54-technology tree; nothing finished more than 4 years before its horizon.
  - Treasuries at year 40 average 4.7× (the Reach) and 3.2× (Aldmere) monthly income.
  - Winners spread more than before: the Reach Fenward 3, Aurel 2, Tarsk 2, Serennes,
    Drevenholt and Morvaine 1 each; Aldmere Morvaine 4, Tarsk 4, Lessia 2. Hrafnmark still
    shrinks on Aldmere (14 → 6.5 provinces on average); it should gain from fleets in Stage C.
  - Oil, rubber, nitrates and iron were never short in these batches: before armour (1916)
    and before fleets and aircraft (Stage C) little burns them. Coal is the binding
    resource in Stage B.
- **Stage C, navy and air** (`reports/stage-c/`, 10 seeds per map; the combat matrix in
  `reports/stage-c/combat-matrix.md`):
  - Carrier groups lost every equal-cost pairing at first. Carriers now strike before the
    guns close (enemy guns at 30% and 60% in the first two rounds), anti-aircraft fire
    halves a strike at 20 points instead of 10, carrier air is 7 and cruiser guns 3.5.
    Every fleet type now wins at least one pairing and none wins all.
  - At first only a third of the realms past era III flew aircraft: the AI rarely
    researched Aviation and its first wings were reconnaissance that idled at peace. Aviation
    is now weighted up, fighters lead the mix once known, and at peace fighters and
    reconnaissance watch the capital and the most threatened border. Every such realm now
    flies missions. (Since the naval and air update a flight wears readiness, so at peace the
    wings rest instead.)
  - Fleets at peace keep station off the realm they plan to fight, off claimed coasts, on
    a strait beside their shores, or off a rival navy's home waters.
  - Bankruptcies tripled on Aldmere in the first batch (a collapsing realm kept a large
    army). A broke AI now stands down its smallest army when bankruptcy is about four
    months away at the current deficit; bankruptcies are back to 0.2 per campaign on both
    maps.
  - Winners: Aldmere Lessia 6, Morvaine 3, Solmarre 1; the Reach Aurel 5, Fenward 2,
    Serennes, Morvaine and Drevenholt 1 each. The richest heartlands win most often again
    (Stage B spread the wins more). Balance across realms is Stage F's work.
  - Armour stays rare (0.1–0.3% of regiment-months) because Tanks arrives in 1916, late in
    most campaigns; oil and rubber are still never short.

