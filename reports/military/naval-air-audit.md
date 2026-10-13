# Naval and air warfare: audit of the baseline (commit 41108f3)

What the code did before this update, traced from the order through the
simulation to what the player is shown, and checked in play. Each finding names
the code that causes it. The refinements are implemented in this update; the
rules that resulted are in [`DESIGN.md`](../../DESIGN.md) ("The navy", "Air
power", "Combined warfare") and the evidence is in
[`naval-air-verification.md`](naval-air-verification.md).

## How it was checked

- **Code.** I read the simulation code (`air.ts`, `naval.ts`, `combat.ts`,
  `supply.ts`, `movement.ts`, `trade.ts`, `economy.ts`, `war.ts`,
  `diplomacy.ts`, `ai/navy.ts`, `ai/strategic.ts`) and the interface code
  (`ui/panels/sea.ts`, `inspector.ts`, `ledgers.ts`, `map/renderer.ts`).
- **Browser.** In the production build of `main`:
  - As Italy on the World 1936, I built an airfield and four wings with the
    real commands, declared war on Yugoslavia, sent wings on superiority,
    support and bombing, and marched an army.
  - I opened the fleet, wing, military and province cards.
  - As Albania on the World 1914, I opened Diplomacy for Italy and Serbia.
- **AI-only campaigns.** Six years each from seed 2, sampled every week
  (`.scratch/usage-audit.ts`):

| | World 1936 | Europe 1936 | World 1914 |
|---|---|---|---|
| Weeks at war (of 288) | 216 | 196 | 216 |
| Wing-weeks; on a mission | 39,320; 21,980 | 21,524; 12,125 | 27,534; 25,514 |
| Air superiority | 18,851 (86%) | 10,034 (83%) | 2,965 |
| Ground support | 668 | 383 | 0 |
| Support with no battle in its area | **634 (95%)** | **360 (94%)** | — |
| Interdiction / bombing | 329 / 403 | 101 / 211 | 0 / 0 |
| Land battles; with any air factor | 29; 12 | 25; 13 | 23; 11 |
| Carrier ship-weeks | 4,739 | 1,764 | 0 |
| Amphibious landings | 3 | 12 | 0 |

## Inventory

### Ships (`config.ts` `SHIPS`)

| Ship | Needs | Cost | Upkeep | Guns | Torpedo | Anti-sub | AA | Air | Hull | Speed | Capacity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Transport | — | 20 cr, 15 mat, 2 iron, 10 wk | 0.6 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | 2 regiments |
| Torpedo boat (screen) | Torpedo Boats | 25, 20, 3 iron, 12 wk | 0.8 | 1 | 1 | 3 | 0.5 | 0 | 2 | 2 | — |
| Cruiser | — | 45, 40, 6 iron, 20 wk | 1.5 | 3.5 | 0.5 | 1 | 1 | 0 | 4 | 2 | — |
| Battleship | — | 90, 90, 14 iron, 36 wk | 3 | 8 | 0 | 0 | 2 | 0 | 12 | 1.5 | — |
| Submarine | Submarines | 35, 30, 4 iron, 16 wk | 1 | 0.3 | 4 | 0 | 0 | 0 | 2 | 1.5 | — |
| Carrier | Naval Aviation | 100, 100, 12 iron, 2 rubber, 40 wk | 3.5 | 0.5 | 0 | 1 | 3 | 7 | 9 | 1.5 | — |

Ships burn coal monthly, or oil after Oil-Fired Boilers. Submarines and
carriers always burn oil.

### Aircraft (`WINGS`)

| Wing | Needs | Cost | Upkeep | Air | Ground | Bomb | Range | Missions |
|---|---|---|---|---|---|---|---|---|
| Reconnaissance | Aviation | 20, 15, 1 rubber, 6 wk | 0.6 | 0.5 | 0 | 0 | 3 | recon |
| Fighter | Fighters | 30, 25, 1 rubber, 1 iron, 8 wk | 1 | 3 | 0.5 | 0 | 3 | superiority, support |
| Ground attack | Ground Attack | 35, 30, 1 rubber, 2 iron, 10 wk | 1.2 | 1 | 3 | 0.5 | 3 | support, interdiction |
| Bomber | Strategic Bombing | 50, 45, 2 rubber, 3 iron, 14 wk | 1.8 | 0.8 | 1 | 3 | 5 | bombing, interdiction |

Wings are raised at airfields, two per airfield level. Range is counted in
land-province hops from the airfield. Aircraft burn oil (30% while idle). A
wing regains 8 strength a week at a quiet base, paid in materiel.

### Missions

- **Air superiority.** Air power over the target and its neighbours. A side
  holding 1.5× the enemy's power cuts the enemy's support and interdiction
  to 40%.
- **Ground support.** +12% fire per ground point, up to +40%, for every one of
  our battles in the target area.
- **Interdiction.** Enemy armies in the area lose up to 40% supply and 30%
  speed.
- **Strategic bombing.** Factories in an enemy-held province lose up to 60%
  of their output.
- **Reconnaissance.** +5% fire for our battles in the area.

### Other mechanics

- **Carrier.** A fixed "air 7" value in the surface battle. A side without it
  is out-ranged: its guns fire at 30%, then 60%, then 100% over the rounds.
  Nothing is ever assigned to a carrier.
- **Transport and landing.** Armies on a coast board a fleet lying in a zone
  on that coast (two regiments per transport). They land when the fleet
  reaches a zone on the beach's coast and enemy surface ships do not outgun
  ours there. They fight at 75% that week (87% with Amphibious Warfare).
  Regiments that no longer fit in surviving transports drown.
- **Blockade.** A coastal province is blockaded when every zone on its coast
  holds enemy warships (submarines count half) at twice our surface power.
  It loses 25% of its crowns, and the realm's sea trade shrinks by the
  blockaded share of its coast.
- **Escort.** Transports and carriers behind at least as many screens and
  cruisers are hit at 30% in surface battles.
- **Interception.** A fleet entering a zone that holds enemy warships stops
  there and fights.
- **Straits.** Closed to a realm while enemy surface power in the commanding
  zone exceeds its own.
- **Beachhead supply.** A coastal province we hold with one of our fleets
  stationed offshore, uncontested, is a supply source.
- **Research.**
  - Torpedo Boats (screen), Submarines, Naval Aviation (carrier), Aviation
    (recon), Fighters, Ground Attack and Strategic Bombing unlock types.
  - Steel Warships (+15% naval attack, −10% ship cost), Pre-Dreadnoughts and
    Dreadnoughts (+20% / +35% battleship attack) and Oil-Fired Boilers (+25%
    fleet speed, oil fuel) improve ships.
  - Naval Bases (port cost, repair), Amphibious Warfare (landing penalty
    halved), Convoys (+40% anti-sub, 30% blockade resistance) and Sonar
    (+50% anti-sub) cover the rest of the navy.
  - All-Metal Monoplanes (+25% air attack, +1 range), Air Defence (−40% enemy
    bombing) and Radar (+20% air attack, −20% enemy bombing) improve air.
  - Fleet Carriers gives +40% carrier air.
- **Connections.**
  - Interdiction feeds supply (`supply.ts`) and movement (`movement.ts`).
  - Support and recon feed land combat (`combat.ts`).
  - Bombing feeds the monthly economy (`economy.ts`).
  - Blockades feed crowns and trade (`economy.ts`, `trade.ts`).
  - Straits feed movement and supply.
  - Beachheads feed supply.

## What was ineffective, broken, unclear or missing

1. **War needed a shared border.** War goals were either claims, or conquest
   of up to two provinces bordering our land (`war.ts` `conquestTargets`).
   Claims could only be fabricated next to our land or across one sea zone
   from a port (`diplomacy.ts` `fabricateProblem`). On the World 1914,
   Albania (one province, a level-2 port) could declare war on 1 of 56 realms
   (Serbia). On the World 1936 it could reach 2 of 68. Diplomacy told it "No
   war goal".
2. **Ground support was an area-wide, unallocated bonus.** `airCombatBonus`
   summed the support value of every wing whose seven-province area covered
   the battle. The same wing therefore buffed every battle in its area
   simultaneously, and wings piled up to the +40% cap anywhere. It cost
   nothing when no battle was there, and 95% of the AI's support wing-weeks
   were exactly that.
3. **Air superiority usually did nothing.** It only cut enemy support and
   interdiction where the enemy also flew. It was 86% of all mission time on
   the World 1936. The wing card said "Air superiority" over provinces where
   the enemy had no aircraft at all.
4. **Aircraft could not touch ships.** No mission targeted a sea zone. Land
   aircraft ignored fleets, and ships ignored aircraft except a carrier's
   fixed "air 7".
5. **Carriers had no aircraft.** A carrier was an intrinsic strike value plus
   the out-ranging rule. It held no wings, so deck capacity, aircraft losses,
   readiness and range from the carrier did not exist. A carrier's purpose
   could not be explained beyond "strikes first".
6. **Range ignored the sea.** It was counted in land-province hops only: an
   Albanian wing at Durazzo could not reach Italy across the Adriatic at any
   range.
7. **No readiness.** Wings flew every week at full value until shot down.
   Mission tempo, rest and rebasing had no cost. Oil shortages cost nothing
   but the bill.
8. **Recon promised what did not exist.** Its description said "screens find
   submarines in nearby waters". Nothing in the code read reconnaissance at
   sea. On land it gave +5% fire.
9. **Strategic bombing touched factories only.** Ports, shipyards and
   airfields under the bombs carried on as normal.
10. **No shore bombardment.** Battleships and cruisers off a coast did not
    affect a battle on that coast.
11. **No raiding.** Sea trade suffered only from blockades of whole coasts.
    Submarines and cruisers on the route between two realms did nothing to
    their trade, and escorts had no role outside a battle.
12. **Out of range or idle, silently.**
    - An out-of-range mission was cancelled to idle without a reason.
    - A support wing with no battle looked exactly like one in action.
    - No card showed what a wing had achieved: battles supported, aircraft
      downed, losses or damage.
    - Battle factors said "Air support +40%" without naming the wings.
13. **AI.**
    - Superiority went over the capital at peace and over the front at war,
      whatever the enemy flew.
    - Support went to objectives without battles.
    - No naval air at all, and carriers sailed empty.
    - Wars were only ever planned against bordering realms
      (`ai/strategic.ts` `warOptions`).

Not broken, and kept:

- **Transport capacity and landings.** Embarking needs a fleet off that
  coast, landings wait while enemy warships hold the zone, and troops on sunk
  transports drown.
- **Beachhead supply.** Supply over the sea needs a fleet kept offshore.
- **Blockades of whole coasts.**
- **Strait control.**
- **Escort screening in surface battles.**

## Assessment by type

Each row gives the type's intended role, its problem before this update, the
refinement made, and the scenario that verifies it (in
`tests/naval-air-scenarios.test.ts`).

### Transport

- **Role:** carries armies by sea.
- **Problem:** worked, but nothing threatened it except surface fleets that
  happened to be in the same zone. War could not be declared on an overseas
  realm in the first place.
- **Refinement:**
  - Wars without a shared border are allowed.
  - Naval strike aircraft and submarines now threaten transports.
  - The fleet card explains why it is waiting and what supplies the troops
    ashore.
- **Verification:** a protected and an exposed sea transport; the prepared
  Albanian landing.

### Torpedo boat (screen)

- **Role:** escort and anti-submarine warfare.
- **Problem:** shielded carriers and transports in surface battles only.
- **Refinement:**
  - Escorts in a zone shield sea trade from raiders.
  - Their AA blunts air strikes.
  - With a recon patrol overhead, their anti-sub fire finds submarines.
- **Verification:** raiding with and without escorts; air strike with and
  without AA escorts.

### Cruiser

- **Role:** patrol, escort, raiding, light bombardment.
- **Problem:** a smaller battleship.
- **Refinement:**
  - Raids trade at half a submarine's weight.
  - Escorts convoys.
  - Bombards coasts at about 7% per cruiser.
- **Verification:** raiding; bombardment.

### Battleship

- **Role:** the decisive surface fight and heavy bombardment.
- **Problem:** surface fights only.
- **Refinement:**
  - Shore bombardment of a battle on its coast: about +16% per battleship,
    at most +25% in all.
  - Coastal forts fire back.
  - Battleships are the favourite target of air strikes.
- **Verification:** coastal combat with and without bombardment.

### Submarine

- **Role:** commerce raiding and torpedo ambush.
- **Problem:** blockaded at half weight; otherwise only a battle unit.
- **Refinement:**
  - The main trade raider on routes through its zone.
  - A recon patrol over its zone exposes it to escorts and aircraft.
- **Verification:** raiding and counterplay.

### Carrier

- **Role:** a mobile air base.
- **Problem:** a fixed strike value and nothing aboard.
- **Refinement:**
  - Two decks (three with Fleet Carriers) for fighter, ground-attack and
    recon wings.
  - The aircraft aboard fly the same missions, by the same rules, from the
    carrier's position. An empty carrier strikes nothing and says why.
  - Sinking, damage, splits and merges keep the air group consistent.
- **Verification:** carrier strike beyond land-based range; an empty carrier;
  a sinking carrier.

### Reconnaissance wing

- **Role:** spotting and maritime patrol.
- **Problem:** +5% fire; its sea role was not implemented.
- **Refinement:**
  - Over land: +5% fire, and support and interdiction in its area +20%.
  - Over a sea zone: naval strikes always find their target, and submarines
    there lose their cover.
- **Verification:** naval strike detection with and without patrol.

### Fighter

- **Role:** air superiority, interception and escort.
- **Problem:** "superiority" over empty skies.
- **Refinement:**
  - Intercepts every hostile mission flown into its area: losses, and the
    air-control factor on their effect.
  - Covers fleets at sea.
  - Shows "patrolling — no enemy aircraft" when nothing came.
- **Verification:** contested airspace and interception.

### Ground-attack wing

- **Role:** close support, interdiction and naval strike.
- **Problem:** support was area-wide and unallocated.
- **Refinement:**
  - Supports one battle a week in its area, chosen and named.
  - Also flies interdiction and naval strike.
  - Exposed to enemy fighters and flak.
- **Verification:** land combat with and without air support.

### Bomber

- **Role:** strategic and logistics bombing, and long-range naval strike.
- **Problem:** factories only.
- **Refinement:**
  - Also stops shipyards and repairs in a bombed port, and grounds aircraft
    on a bombed airfield.
  - Strikes fleets at range 5.
  - Cannot use carriers.
- **Verification:** logistics strikes and their consequences.
