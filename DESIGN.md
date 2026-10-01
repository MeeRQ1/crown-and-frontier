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

**How Aldmere is made** (`tools/genworld.ts` from `tools/aldmere.spec.ts`, shared core in
`tools/mapgen/core.ts`): the authored spec gives the coastline, islands, lakes, mountain
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
3. Standing orders, then the **naval phase**: fleets sail, hostile fleets fight, troops
   land, ships repair or wear, blockades are counted.
4. Movement and arrivals, in army-id order.
5. The **air phase**: air combat, flak, replenishment, rebasing.
6. Battle detection, then one combat round per battle.
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

- **Crowns per province per month:** (0.8 × dev + 0.012 × pop + 3 at the capital)
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
  the seller earns, and both get 1 crown of commerce per agreement. A realm in debt does not
  buy. All flows of a month are computed from the state at the start of the settlement, so
  the order of realms does not matter.
- **Expenses per month:** regiment upkeep (infantry 1, cavalry 1.6, artillery 2, engineers
  1.4, armour 3 crowns, scaled by strength), 1 crown per fort level, 1.5 per envoy, research
  funding (0 / 8 / 18 / 32% of gross income for ×1.0 / 1.4 / 1.8 / 2.2 research), resource
  purchases, and 2% interest on debt.
- **Military reserve:** pop × 40 men per thousand × (0.2 + 0.8 × integration).
  The **manpower pool** can never exceed reserve minus men already serving
  (regiments plus recruits in training), so soldiers are never double-counted. A shrinking
  reserve shrinks the pool. It is trimmed to the cap at every monthly settlement, and at once
  when an owner loses control of a province. Recruiting moves 1,000
  men from the pool into training. Reinforcement moves men from the pool into regiments
  (10% of the missing men per week, only when supplied on friendly ground, and only as far as
  materiel allows). Disbanding returns survivors to the pool up to its limit. Casualties are
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

## The navy (`naval.ts`)

**Ships** are laid down in a port (one slipway per port level) and join a squadron off it.

| Ship | Needs | Cost | Weeks | Upkeep | Guns | Torpedo | Anti-sub | AA | Air | Hull | Speed | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Transport | — | 20, 15 materiel, 2 iron | 10 | 0.6 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | carries 2 regiments |
| Torpedo boat (screen) | Torpedo Boats | 25, 20, 3 iron | 12 | 0.8 | 1 | 1 | 3 | 0.5 | 0 | 2 | 2 | hunts submarines, shields transports and carriers |
| Cruiser | — | 45, 40, 6 iron | 20 | 1.5 | 3.5 | 0.5 | 1 | 1 | 0 | 4 | 2 | patrols, blockades, escorts |
| Battleship (capital) | — | 90, 90, 14 iron | 36 | 3 | 8 | 0 | 0 | 2 | 0 | 12 | 1.5 | the heaviest guns afloat |
| Submarine | Submarines | 35, 30, 4 iron | 16 | 1 | 0.3 | 4 | 0 | 0 | 0 | 2 | 1.5 | only anti-sub fire hurts it; always burns oil |
| Carrier | Naval Aviation | 100, 100, 12 iron, 2 rubber | 40 | 3.5 | 0.5 | 0 | 1 | 3 | 7 | 9 | 1.5 | strikes from the air; always burns oil |

Ships burn coal each month (oil after Oil-Fired Boilers); a realm short of its fleet's fuel
fights at 60% and sails at half speed. Fleets at a friendly port on an uncontested zone repair 6 hp a
week per port level; fleets more than four zones from every friendly port lose 2 hp a week.

**Movement.** A fleet sails one zone per movement point per week (its slowest ship). A fleet
entering a zone that holds enemy warships stops there and fights.

**Battle.** Hostile fleets sharing a zone fight up to three rounds a week; both sides fire at once:

- guns hit surface ships, spread by size; transports and carriers behind at least as many
  screens and cruisers are hit at 30%;
- submarine torpedoes go for capital ships, carriers and transports (three times the weight);
- anti-submarine fire is the only thing that hurts submarines;
- carriers' aircraft strike at 1.5× in the first round, blunted by the enemy's anti-aircraft
  fire (× 20 / (20 + AA));
- a side **without carrier aircraft** against one with them is out-ranged: its guns fire at
  30% in the first round and 60% in the second.

Damage per ship is fire × 32 × roll ÷ its hull. A side falling below half its starting
fighting value withdraws. Armies aboard sunk transports are lost in proportion.

**Sea control.**

- A **strait** is closed to a realm while enemy surface power in the commanding zone exceeds its
  own there: no marching or supply across it.
- A coastal province is **blockaded** when every zone on its coast holds enemy warships
  (submarines count half) at more than twice our surface power there. It loses 25% of its
  crowns, and the realm's sea trade shrinks with the blockaded share of its coast
  (Convoys resist). Realms with a land border trade overland.

**Armies by sea.** Armies standing on a coast board a fleet with room (two regiments per
transport) lying in a zone on that coast, and name a beach: our own or a friendly coast,
unclaimed land, or an enemy's coast. The fleet sails there and the troops land when it
reaches a zone on that coast. They fight at 75% that week. Troops at sea cannot be ordered
and take no part in land battles; they go down with their transports.

## Air power (`air.ts`)

**Airfields** (Aviation) hold two wings per level. A wing flies a mission over a target
province within its range, counted in province hops from its base. Missions cover the target
and its neighbours (bombing: the target only).

| Wing | Needs | Cost | Weeks | Upkeep | Air | Ground | Bomb | Range | Missions |
|---|---|---|---|---|---|---|---|---|---|
| Reconnaissance | Aviation | 20, 15 materiel, 1 rubber | 6 | 0.6 | 0.5 | 0 | 0 | 3 | recon |
| Fighter | Fighters | 30, 25, 1 rubber, 1 iron | 8 | 1 | 3 | 0.5 | 0 | 3 | superiority, support |
| Ground attack | Ground Attack | 35, 30, 1 rubber, 2 iron | 10 | 1.2 | 1 | 3 | 0.5 | 3 | support, interdiction |
| Bomber | Strategic Bombing | 50, 45, 2 rubber, 3 iron | 14 | 1.8 | 0.8 | 1 | 3 | 5 | bombing, interdiction |

- **Air superiority:** a side with 1.5× the enemy's air power over a province holds the sky
  there. The enemy's support and interdiction then fall to 40%.
- **Ground support:** +12% firepower per point of ground value over our battles (at most +40%).
- **Reconnaissance:** +5% firepower.
- **Interdiction:** enemy armies in the area lose up to 40% supply and 30% speed.
- **Bombing:** factories in an enemy-held province lose up to 60% of their output.
- **Losses:** wings lose strength each week against enemy air power, and bombers over forts
  to flak. A wing at a quiet base regains 8 strength a week, paid in materiel. A wing whose
  airfield falls rebases to the nearest free one, or is lost.
- **Costs:** aircraft burn oil (30% while idle).

### Worked examples (`npm run examples`, `tests/worked-sea-air.test.ts`)

The small sea map of the tests: realms a and b share a border; b's port b2 lies only on the
East Water; c is an island realm.

| Situation | Forecast or result | Why |
|---|---|---|
| 5 infantry from a2 attack 4 dug-in infantry in b1, overland | **Likely victory** (795 vs 952 losses) | numbers beat a 10% entrenchment |
| The same 5 land on b1 from the Middle Water | **Uncertain** (990 vs 840; unlucky → defender holds) | Landing from the sea −25% |
| The same landing with Amphibious Warfare | **Uncertain** (815 vs 832) | the penalty halves to −13% |
| Two of a's cruisers in the East Water, no b warships | b2 **blockaded**: crowns 2.88 → 2.16 a month; b's trade with the island 100% → 81%; with a (land neighbour) 100% | every zone on b2's coast holds enemy warships at more than twice b's power |
| One b cruiser joins them | not blockaded | 2 × 1 cruiser ≥ 2 cruisers |
| Two of a's submarines instead of the cruisers | blockaded | submarines count half, enough against no defenders |
| 6 infantry from a2 attack 6 infantry in b1, no aircraft | **Uncertain**, defender holds with even rolls (1,248 vs 1,104) | entrenchment +10% |
| Two of a's ground-attack wings support the attack | attacker wins with even rolls (1,158 vs 1,548) | Air support +40% |
| Three of b's fighter wings hold the sky over b1 | support +16% (1,212 vs 1,272) | the enemy holds the sky: support falls to 40% |
| a answers with three fighter wings | support +40% again | the sky is contested: neither side holds it |

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
  A separate peace with the opposing war leader removes one participant. Any peace removes
  the pending peace offers and calls to arms that no longer apply.
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
  conquest wars declared, or allies abandoned.

## Research and policy (`progression.ts`, `data/techs.ts`, `data/policies.ts`)

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
- **Policies:** six national priorities, each with a benefit and a drawback: Mercantile Charter,
  Martial Levy, Frontier Settlement, Royal Academy, Fortress Doctrine and Concord Diplomacy
  (which forbids wars without a claim). A change costs 20 + half a month's income (free in the
  first month) and locks the policy for 24 months.
- **Stacking:** all modifiers from traits, technologies, policy and timed events add together
  (`modifiers.ts`) and apply identically to AI realms and the player.

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
Each month the conditions fail, a timer loses 6 months.

1. **Territorial Dominance:** own and control ≥ 75% of the provinces in *R* regions and
   ≥ *T* of all provinces, held for 24 months.
2. **Economic Prosperity:** integrated development (the dev of controlled provinces at
   integration ≥ 75) ≥ *E* of the world's development, with dev-weighted unrest ≤ 25, no debt, no
   bankruptcy and none of your land occupied, held for 60 months. A windfall cannot
   do it; rivals can break it by occupying one province.
3. **Diplomatic Leadership:** influence from treaties at least 3 years old whose
   partner's opinion of you is ≥ 35 (alliance 2, trade 1), at *D* per other surviving realm
   (minimum 6), with trust ≥ 65 and no offensive war, held for 60 months. New
   treaties do not count, so cycling treaties is pointless.

| Threshold | The Reach (9 realms) | Aldmere (14 realms) |
|---|---|---|
| *R* regions dominated | 3 of 14 | 6 of 42 |
| *T* share of all provinces | 23% (23 provinces) | 18% (54 provinces) |
| *E* share of world development | 25% | 18% |
| *D* influence per other realm | 1.25 (10 with 8 rivals) | 0.85 (12 with 13 rivals) |

Aldmere's thresholds are scaled from the Reach's by what "dominant" means among fourteen
realms rather than nine: an average realm holds 7% of Aldmere against 11% of the Reach. The
Reach's 23% is 2.1× an average share; Aldmere's 18% is 2.5×, so dominance on the larger map
is, if anything, relatively harder. Region counts scale with the number of regions.

- **Rival reactions:** AI realms react to a rival past 35% of a timer. Against a territorial or
  economic leader they raise their alarm (which feeds coalitions), arm, and lower their war
  threshold against it. Against a diplomatic leader they grow wary instead (up to −25 opinion,
  shown as its own line in the opinion breakdown) and, past halfway, may cancel trade with it.
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
| Strategic (`strategic.ts`) | monthly, staggered | goal and victory path; army size target from income, reserve and supply (a larger share when threatened or at war); research by branch weights and situation; policy (re-evaluated yearly, switching only if clearly better); construction by value per crown; envoys and treaties (mutual acceptance required); coalition wars; peace (demands up to its advantage, white peace or concessions when losing or tired); war (see below) |
| Operational (`operational.ts`) | weekly (every 2 weeks on Easy) | peace: garrisons for restless frontier, gathering and merging at a rally point; war: objectives (defend, liberate, attack), strength-based assignment of armies, staging and merging before attacks, forecast checks, withdrawal from superior enemies, recovery of battered armies |
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
  escort), falls back when outgunned, and returns to port below 55% condition.
- A monthly invasion plan picks an enemy coast that is weakly held or out of reach by land and
  a port to gather at. Transports gather there, a detachment boards and sails, and the plan is
  dropped after eight months.
- Fighters fly superiority over our battles and objectives (at peace over the capital or the
  most threatened border); attack wings support our battles or interdict enemy armies;
  bombers bomb enemy industry in range; reconnaissance watches the front or the border.

**Stability.** Commitment bonuses keep plans from flip-flopping; emergencies reassign armies at once.

**Diagnostics** go to `state.diagnostics` (the last 400): chosen research, policies, war candidates with
ratios and scores (once a year per realm), declarations, peace attempts, army objectives,
attacks held back by forecasts, and rejected orders. They are included in bug reports.

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
- **Save format 3** (`src/sim/save.ts`): versioned and checksummed JSON of the complete state,
  including movement progress, battles, queues, treaties, events, stockpiles, factories,
  fleets (with troops aboard), ports, slipways, air wings, airfields and AI commitments.
  Stage C extended format 3 instead of starting format 4: a format-3 save written before
  fleets existed loads with empty navies and air arms, starting ports from the map, and a
  notice; earlier formats convert as before and gain the same.
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
  calendar moves to the map's new start year. The notice says all of this. A save that cannot
  be converted (for example an embedded map that no longer validates) is refused with the
  reason, stays listed, and can still be exported from the load screen. The tests convert a
  save from the first release (`tests/fixtures/reach-save-main-c29aea6.json`) and two format-2
  saves written by the Stage A build (`tests/fixtures/*-format2-168569b.json`, one with a
  custom map), play them for a year and save them again. The browser checks import the
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
are in `reports/stage-b/` (10 seeds per map at normal difficulty, with the system-usage
section); the 30-campaign batches from before the industrial rules remain in
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

