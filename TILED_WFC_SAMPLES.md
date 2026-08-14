# Tiled → Chisel WFC sample pipeline

Tiled and Chisel have deliberately separate jobs:

- **Tiled** assembles visual sample boards from ordinary tile layers and external spritesheet tilesets.
- **Chisel** manages a project-local copy, validates the supported Tiled subset, assigns semantic tile metadata, and defines WFC sample rectangles in system data tables.
- **Chisel's preview compiler** extracts fixed `3×3` overlapping patterns, deduplicates exact multi-layer arrangements, derives directional adjacency, and runs seeded test generations.
- **The game/runtime** will eventually consume an exported form of the same compiled library. Runtime export is not part of this slice.

## Project layout

```text
.chisel/
  tiled.json
  tables/system/
    terrain_tilesets.json
    terrain_roles.json
    terrain_tile_bindings.json
    terrain_wfc_samples.json
    terrain_biomes.json
    terrain_biome_profiles.json
  tiled/
    FOREST_SAMPLES/
      map.tmx
      tilesets/
        TERRAIN.tsx
      images/
        TERRAIN/
          terrain.png
```

`tiled.json` owns only the board registry. Each board owns its managed native Tiled XML and PNG spritesheets. All Chisel-authored terrain metadata lives in the registered terrain system tables, which are visible under Data Tables and are committed with every other table. Import accepts only a `.tmx` map referencing external `.tsx` tilesets, then rewrites their internal paths into this managed structure.

Tiles are identified as `<MANAGED_TILESET_ID>:<LOCAL_TILE_ID>`. Map GIDs are never persisted in tile-binding rows because Tiled may change `firstgid` values when a map changes.

## Supported Tiled subset

The importer intentionally fails fast unless a board is:

- a finite, orthogonal `.tmx` Tiled XML map using right-down rendering;
- made only from tile layers using XML CSV data;
- backed by external `.tsx` Tiled XML spritesheet tilesets;
- using uniform PNG tiles whose dimensions match the map grid;
- free of layer/tile offsets, groups, object layers, image layers, animation, chunks, compression, and inline or image-collection tilesets.

Multiple tile layers and tilesets are supported. Orthogonal horizontal, vertical, and diagonal Tiled flip flags are preserved in the preview.

In Tiled, choose **Tiled tileset files** and save each external tileset as `.tsx`; choose **Tiled map files** and save the map as `.tmx`. These are the only supported Tiled document formats. JSON `.tsj`/`.tmj` and Lua exports are deliberately unsupported.

## Terrain system-table contract

The specialized WFC Samples screen and the generic Data Tables screen read the same terrain rows. There is no parallel board metadata document. Managed tileset rows are read-only outside the Tiled workflow; role, biome, and biome-profile rows can also be edited in Data Tables. Spatial tile-binding and WFC-sample rows are edited through WFC Samples so their board coordinates remain validated.

Every tileset sprite receives:

- a stable `CONSTANT_CASE` slug;
- exactly one project-defined role, such as `GROUND`, `WATER`, or `FOLIAGE`;
- an explicit movement-blocking flag;
- zero or more optional `CONSTANT_CASE` tags.

A board may contain many non-overlapping, grid-aligned samples. Each sample has a stable slug, included layer ids, grid bounds, and rotation/reflection permissions. Biome-specific properties such as selection weight do not belong to the sample; a future biome editor will select sample slugs and configure their terrain-generation behavior.

Movement blocking belongs to the generated contents. Terrain tiles contribute their binding's blocking flag, future feature stamps will contribute explicit footprint masks, and decorative scatter can remain non-blocking.

Deleting a tileset is a managed operation. Chisel refuses deletion when a biome profile selects a sample containing that tileset or while any TMX layer cell still uses one of its GIDs. Once unused, deletion removes the map reference, managed TSX and PNG files, tileset row, and its tile-binding rows together.

## WFC adjacency contract

Chisel will learn ordinary tile compatibility from the authored samples instead of requiring a hand-written north/east/south/west rule for every sprite:

1. The sample preview currently compiles every sample on the board with a fixed `3×3` pattern size. The future biome editor will select sample slugs and apply profile weights.
2. The compiler extracts every overlapping pattern wholly contained by each selected sample. A sample edge is not implicitly joined to another sample edge.
3. Two patterns fit horizontally or vertically only when their overlapping rows or columns are identical.
4. Observed frequency and the sample weight configured by that biome profile produce the final pattern weight.

Samples compiled together may have different rectangle dimensions, but must include the same layer ids. Each sample contributes one normalized unit of pattern weight, so a larger sample supplies more local evidence without automatically outweighing a smaller sample. Exact recurring patterns are stored once while retaining per-sample occurrence counts. Rotation and reflection permissions expand each observation before this deduplication step, including the corresponding Tiled sprite orientation flags.

The preview solver accepts output dimensions from `3×3` through `64×64`, a deterministic integer seed, and retries contradictions with derived seeds. It reports the unique pattern count, attempt count, and patterns lacking a compatible neighbor in each cardinal direction.

This means cliffs and shorelines must be represented by complete authored examples: straight runs, inner corners, outer corners, starts, ends, and any legal junctions. Open water and solid ground also need enough interior area for the selected pattern size. If a transition never appears in an eligible sample, WFC does not invent it.

World-map edges are an explicit generation constraint rather than an accidental sample edge. Terrain profiles will choose which sample slugs are eligible for interiors and for each outer side/corner, and will pin the outer band to a policy such as water, cliff, or open ground. The compiler can then select only learned patterns compatible with that pinned band. Tile tags such as `CLIFF`, `SHORE`, or `OPEN_WATER` provide semantic constraints and diagnostics; they do not replace the learned visual adjacency.

Biome boundaries use the same mechanism. A boundary sample visibly contains both terrain families, the terrain setup selects that sample slug for the relevant biome pair and orientation, and overlapping-pattern equality carries the transition into generation.

## Source commits

Chisel commits the workspace registry, native `.tmx`/`.tsx` XML, terrain system tables, managed image paths, and SHA-256 image hashes. Rollback restores the authored state while retaining managed PNGs and blocks if an expected image is missing or has changed.
