# How the simulation scales with realms (stress maps)

Procedural continents from `tools/genstress.ts` (not campaign maps), benchmarked
with `tools/bench.ts`, AI only, seed 1, 15 years, on the 4-core Xeon described
in `docs/atlas/AUDIT.md`. These set the province and realm targets for the new
Earth and Europe maps (see `docs/atlas/MAPS.md`).

    npx tsx tools/genstress.ts --provinces 1100 --nations 24 --out .scratch/stress-1100-24.map.json
    node --expose-gc --import tsx tools/bench.ts --map .scratch/stress-1100-24.map.json --seeds 1-1 --years 15

| Map | Realms | Avg ms/week | p99 | Max |
|---|---|---|---|---|
| 1,093 provinces (before) | 24 | 56.7 | 114.1 | 152.7 |
| 1,093 provinces (before) | 48 | 90.5 | 193.7 | 224.6 |
| 1,093 provinces (after) | 48 | 77.7 | 170.1 | 198.3 |

The realm limit for a map package was 32; it is now 64 (`MAP_LIMITS.nations`),
so the 48-realm map could only be measured once it was raised.

Changes between "before" and "after", each measured on this map:

- `nationDistance` reads a per-realm distance field (the element-wise minimum
  of its provinces' rows in the all-pairs hop matrix) instead of comparing every
  pair of provinces through two map lookups each; a test checks the result is
  identical on Aldmere.
- The AI's threat assessment and its estimate of a trade agreement's value are
  kept for the week (`memoWeek`) rather than recomputed after every command;
  the cheap distance test now runs before the costly guarantee and claim checks.
- The monthly ledger asks only whether an army is connected to supply
  (`supplyConnected`), not for its whole supply picture.
- Victory influence reads the treaties indexed by realm.

At 6 weeks a second (the fastest speed) a week has about 166 ms. The 48-realm
map stays under that on average and at p99 on this machine; its slowest weeks
(the monthly settlement, when every realm's economy, diplomacy and victory are
settled and a quarter of the AI realms review their strategy) exceed it, and the
game then runs below its nominal top speed.
