# Player-style sessions on the new maps

These sessions played the production build (`npm run build`, served as static files)
in headless Chromium at 1366 × 800, through Playwright, one action at a time: clicks
on buttons, cards and the map, and reading the screen. A few repetitive steps went
through the page's own `app` object, which sends the same commands the buttons do:
ordering a transport at each of ten ports, sailing seven squadrons to one zone, and
answering routine trade and event cards (accept the trade agreement, take an event's
first choice). Nothing was changed in the game state by hand.

Each finding below was confirmed in the session, then fixed with a test where the
rules changed, and the session continued on the fixed build (via a save, which
also exercised saving and loading). Screenshots are in
[`docs/screenshots/atlas/sessions/`](../screenshots/atlas/sessions/).

## Italy, Europe 1914 (January 1914 to May 1918)

**Setup.** Europe, 1914, Kingdom of Italy, normal difficulty, default 30 years, with
the tutorial dismissed.

1. **An old save under a changed map.** The menu offered "Continue" on an Italy
   campaign saved before the 1914 treaties changed the Europe package. The save was
   kept and converted with a notice, as required, but the notice read "saved on
   revision 1 … this version of the game has revision 1". **Fixed:** a save from
   another edition of the same revision now says so, naming both checksums
   (`7f80591`; screenshot 01 shows the old wording).
2. **The setup screen** showed Italy's claims (2 provinces) and the one province
   others claim, but not its alliances. **Fixed:** the starting position lists
   "Allied with Austria, Germany" and "Non-aggression pact: France" (`8c45dc9`;
   screenshot 02). In play, Diplomacy shows the Triple Alliance and the pact with
   France (screenshot 03).
3. **Research was very slow.** Italy made 8 points a month; Trench Warfare
   (512 points) would take five years and Tanks nine. AI batches agreed: Britain
   gained five technologies in fifty years. The generated maps' cost multiplier
   came from provinces per realm, but research follows development, and a late start
   leaves only the costly technologies. **Fixed:** the real-map generator now
   calibrates the multiplier to the hand-made maps' measured pace, 40 months per
   technology at the start (Hesperia ×1.2, Europe ×0.82, the World ×0.57), with a
   test that keeps every built-in map between 30 and 70 months (`5dc2d2b`;
   screenshot 04 shows the old pace). Assembly Line then read about 33 months.
4. **Trade.** Trade agreements and contract offers arrived steadily (Denmark,
   Serbia, Persia, Norway, Britain, the Netherlands, Greece, Russia, Belgium,
   Switzerland). A contract card ("Serbia wants to buy our iron") shows the terms,
   the delivery by sea, a stockpile projection with and without the contract, the
   iron that would be lost above the cap, and the merchants' verdict (+9)
   (screenshot 05).
5. **A guarantee that made no sense.** "Luxembourg guarantees the independence of
   the Netherlands." The documented rule is to guarantee a smaller neighbour, but
   being smaller only added to a candidate's score. **Fixed:** a realm guarantees
   only a neighbour no stronger than itself (`ace1252`).
6. **War over the Aydın claims.** The "Claim to Aydın" focus (10 months) gave claims
   on Aydın, Magnesia, Muğla, Smyrna and Uşak; Wars & Peace listed them as grounds,
   and Diplomacy offered "Press claims: Smyrna, Aydın, Magnesia" (no trust cost) or
   a war of conquest. War was declared in August 1915, while the Ottomans fought
   Bulgaria.
7. **Ship by sea, unavailable, said why only in a tooltip.** The 1st Army (18
   regiments) could not ship from Rome; the reason ("No fleet with room for 18
   regiments … transports carry 2 each") was only the disabled button's title, which
   a touch screen never shows. **Fixed:** a line under the orders gives the room
   offshore and the transports needed (`799fa26`; screenshot 06).
8. **Gathering transports.** One transport takes 10 weeks on a level-1 slipway, so
   transports were ordered at ten ports. Each port's first ship forms its own
   squadron, so nine one-ship squadrons had to sail to one zone and merge. Merging
   from the Home Fleet's panel named the result "Italian Second Squadron": the merge
   kept the fleet whose id sorted first as a string ("f10" before "f6"). **Fixed:**
   the fleet the order is given from keeps its name (`b869156`). Sailing each
   squadron separately is still tedious (see open findings).
9. **The landing starved.** The army landed at Smyrna unopposed and took Magnesia,
   then fell to 24% supply, morale 0.2 and 6.5k of 18k men: supply could only come
   overland, so an army landed overseas could only forage (screenshot 07). This made
   overseas wars, on the World map especially, unwinnable. **Fixed:** a coast a
   realm holds, owned or occupied, with one of its fleets stationed offshore and no
   stronger enemy warships there, is a beachhead and a supply source; supply then
   reaches inland by the usual range rules (`1397b86`). After the fix the same army
   read 96% supply (screenshot 08, which also shows the incoming-attack forecast:
   "Likely defeat", 27 Ottoman regiments in two weeks).
10. **A confusing war score.** Holding two of the three goal provinces, the war
    score showed "War goal −11 (held goal provinces)". The goal score builds month by
    month: −1 a month while the attackers hold none, which Italy had done for two
    years while it built transports. **Fixed:** the row now says it builds month by
    month and what it is doing now, "unchanged while the attackers hold 2 of the 3
    goal provinces (all: +1 a month; none: −1)" (`e566c66`; screenshot 09).
11. **Defeat and peace.** The Ottomans massed 67 regiments at Aydın, retook Smyrna
    and Magnesia, and drove the army north to Çanakkale. Their peace terms (cede
    Rhodes, renounce claims, limit the army, pay 10% of income) could be edited on
    the card: unticking the army limit gave "Ottomans would accept this counter-offer
    (+9)", unticking the payments too "(+1)" (screenshot 10). The counter-offer was
    accepted: Italy ceded Rhodes and renounced its claims, and the army withdrew home.

**Elsewhere in Europe** (AI): no war in 1914; in 1915 Russia and Austria-Hungary
attacked Romania, Germany attacked Switzerland, the Ottomans attacked Bulgaria and
Greece attacked Albania; in 1917 Germany attacked Luxembourg, Belgium and the
Netherlands; in 1918 Russia attacked Norway and Austria-Hungary attacked Bulgaria,
Greece and Romania. The alliance blocs never went to war with each other in these
four years. Britain offered Italy a defensive alliance in August 1915, which Italy
accepted while still allied to Germany and Austria-Hungary. Italy passively fell
into Austria-Hungary's sphere of influence through Austrian envoys.

No page errors or console errors were recorded in the session.

## Japan, the World 1914 (January 1914 to April 1915)

The setup screen showed Japan allied with Britain and at peace with Russia by pact.
At the fastest speed, in peacetime, the World ran 60 weeks in 20 seconds (about
3 weeks a second) in headless Chromium on the 4-core test machine; the top speed's
target is 6. Japan's home islands, Korea and the Pacific sea zones render
cleanly at this zoom, except that the open-ocean zones east of Japan have stepped,
grid-cut edges (screenshot 11).

## Earlier in this update: Italy before the 1914 diplomacy

An earlier Italy session on the first build of Europe 1914 found that the
historical maps had the borders of 1914 but none of its diplomacy: every realm
started unaligned and without claims, and the first year passed without a war.
**Fixed:** a map package may list treaties in force at the start, and Europe and
the World start with the alliances, ententes (as non-aggression pacts) and claims of
1914 (`9c5152f`). The same session bought, drafted and sent a trade contract through
Industry & Trade, which is now a browser check (`8057d9f`).

## Open findings

These were seen and are not fixed in this update:

- **Gathering a fleet is tedious.** Ships launched at different ports form separate
  squadrons, and there is no order to gather squadrons in one zone; each must be
  sailed and then merged.
- **The demand model is coarse.** Italy's goods all read "Sound" and Britain had a
  surplus of food; the trade contracts work, but shortages that would drive them
  are rarer than they should be on the historical maps.
- **The alliance blocs did not fight each other** in the Europe session's four
  years. The AI starts wars by its own war planning, which the treaties constrain but
  do not script; a Great War is not guaranteed.
- **AI invasions stay short.** The AI plans invasions of enemy coasts within eight
  sea zones of one of its ports, with the transports it keeps (it builds some
  transports by temperament), and its landed armies now draw supply from
  beachheads; it does not plan a long campaign overseas such as the one Italy's
  player mounted. How much beachheads change AI wars is measured in the AI batches
  ([`reports/ai/`](../../reports/ai/)).
- **Open-ocean sea zones on the World** have stepped edges where the zone grid meets
  deep water.
- **Event wording.** A railway event offered "a branch line to Rhodes", an island
  with no railway to join.
- **World throughput** in headless Chromium on the test machine is about half the
  fastest speed's target in peacetime; long weeks are sliced so the map never freezes,
  but the clock runs slower than the setting.
