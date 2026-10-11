# Third-party notices

## Shipped in the game build

The production build (`dist/`, and the release ZIP) contains:

- this project's own code and content;
- two font families;
- the vector art and four landmark illustrations of the atlas pack;
- three small geometry libraries used by the map editor's generator;
- the small module-preload helper that the Vite bundler adds to its output (Vite code,
  MIT-licensed).

### Fonts

Both fonts are bundled as local `.woff2` files, so the game needs no font service at run
time. They come from the atlas pack (`Crown-Frontier-Update-Handoff.zip`, imported by
`npm run atlas:assets`).

- The pack took the binaries from the official Google Fonts repository and converted them
  losslessly to WOFF2, without subsetting or renaming.
- The fonts are under the **SIL Open Font License 1.1**. The licence texts, with the
  copyright and Reserved Font Name notices, ship with the build in `licenses/`.

| Font | Copyright | Licence | Files |
|---|---|---|---|
| Barlow Condensed (Medium, SemiBold) | 2017 The Barlow Project Authors | OFL-1.1 | `src/assets/fonts/BarlowCondensed-*.woff2` |
| Source Sans 3 (variable) | Adobe | OFL-1.1 | `src/assets/fonts/SourceSans3-Variable.woff2` |

### Atlas art

The SVG art in `src/assets/atlas/` was made for Crown & Frontier as part of the atlas pack:

- counters, markers, terrain motifs, resource icons, menu emblems, paper, sea and slate
  textures, and decorations;
- the 24×24 interface icons, drawn from `src/ui/atlas-icons.gen.ts`.

It embeds no third-party icon collection or game artwork. The pack's provenance notes are
kept in `src/assets/atlas/PROVENANCE.md`. The pack's fictional flags and insignia are not
used: realms keep their own heraldry, drawn by the game.

The four **landmark illustrations** (`src/assets/atlas/landmarks/*.webp`: a coastal fort, a
harbour, industrial works and a provincial town):

- are **AI-generated** (OpenAI image generation, 2026-10-06, following the owner's approved
  mockup);
- are not hand-drawn; the prompts are in the pack (`sources/landmark-prompts.json`);
- ship as 256-pixel WebP exports of the pack's masters;
- are decoration at local zoom, not historical depictions.

### Libraries

The map editor's "New map" generator (`src/maps/gen/`) computes Voronoi cells with
d3-delaunay, which uses delaunator and robust-predicates. They are bundled into the
editor's chunk and its generator worker. The licence texts ship with the build in
`licenses/`.

| Package | Version | Licence | Copyright |
|---|---|---|---|
| d3-delaunay | 6.0.4 | ISC | Observable, Inc.; Mapbox |
| delaunator | 5.1.0 | ISC | Mapbox |
| robust-predicates | 3.0.3 | Unlicense (public domain) | Vladimir Agafonkin |

### Map data: Natural Earth

Three real-world maps are built from **Natural Earth** (naturalearthdata.com), version 5.1.2.
Natural Earth is in the **public domain**, and no permission is needed to use it. It is
credited here and in the game: the map library, the campaign setup and the in-game menu.

| Map | Script | Authored data |
|---|---|---|
| The Baltic, 1906 | `tools/genbaltic.ts` | `tools/baltic.data.ts` |
| Europe, 1914 | `tools/genreal.ts` with `tools/realmap.ts` | `tools/europe.data.ts` |
| The World, 1914 | `tools/genreal.ts` with `tools/realmap.ts` | `tools/earth.data.ts` (and `tools/europe.data.ts` for Europe) |

- **Layers used:** `ne_50m_land`, `ne_50m_lakes`, `ne_10m_rivers_lake_centerlines`,
  `ne_10m_admin_1_states_provinces` and `ne_10m_populated_places_simple`.
- The scripts pin each layer's SHA-256. The data files are downloaded when a script runs and
  are not part of the repository. The shipped maps are the scripts' output
  (`src/data/maps/<id>.*.json`).
- **Not from Natural Earth**, and authored in the data files above:
  - the realms of the period and which present-day division belonged to which, with the
    approximations noted in each file and in `docs/atlas/MAPS.md`;
  - place names as written at the time, and town populations of about 1914;
  - mountain walls, passes and straits;
  - realm traits, and simplified arms in national colours.

### Everything else is original

- **Images:** apart from the atlas art above, the map, heraldry, terrain shading and
  favicon are drawn with Canvas or inline SVG by this project.
- **Audio:** none is bundled. All sounds are synthesised with the Web Audio API at run time.
- **Map geometry:**
  - the Reach and Aldmere come from authored geography (`tools/genmap.ts`,
    `tools/genworld.ts`);
  - the Sundered Isles, the Kharan Steppe and the Middle Sea come from the procedural
    generator with fixed parameters (`tools/genmaps.ts`);
  - Hesperia, 1890 comes from authored outlines, rivers, realms and names
    (`tools/hesperia.data.ts`) through the same pipeline as the real maps.
- **Content:** all names, realms, heraldry, events and text are original to this project,
  except the real places and realms of the three real-world maps (above).

## Development tools (not shipped)

| Package | Version | Licence | Used for |
|---|---|---|---|
| typescript | 5.9.3 | Apache-2.0 | type-checking |
| vite | 8.3.1 | MIT | dev server and bundler |
| vitest | 5.0.2 | MIT | tests |
| tsx | 4.23.15 | MIT | running TypeScript tools |
| playwright | 1.56.1 | Apache-2.0 | browser verification and screenshots |
| @types/node, @types/d3-delaunay | 22.x, 6.0.4 | MIT | type definitions |

Transitive dependencies are listed in `package-lock.json`, and each carries its own licence.
