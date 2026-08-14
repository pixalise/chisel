# Tiled → Chisel WFC sample pipeline

Tiled and Chisel have deliberately separate jobs:

- **Tiled** assembles visual sample boards from ordinary tile layers and external spritesheet tilesets.
- **Chisel** manages a project-local copy, validates the supported Tiled subset, assigns semantic tile metadata, and defines weighted WFC sample rectangles.
- **The game/runtime** will eventually consume a compiled generation format. Chisel does not compile WFC rules or generate maps in this slice.

## Project layout

```text
.chisel/
  tiled.json
  tiled/
    FOREST_SAMPLES/
      map.tmx
      enrichment.json
      tilesets/
        TERRAIN.tsx
      images/
        TERRAIN/
          terrain.png
```

`tiled.json` owns project roles and the board registry. Each board owns its managed native Tiled XML, PNG spritesheets, and a separate `enrichment.json`. Import accepts only a `.tmx` map referencing external `.tsx` tilesets, then rewrites their internal paths into this managed structure. Reload reads the managed files explicitly and preserves enrichment when its identities still resolve.

Tiles are identified as `<MANAGED_TILESET_ID>:<LOCAL_TILE_ID>`. Map GIDs are never persisted in enrichment because Tiled may change `firstgid` values when a map changes.

## Supported Tiled subset

The importer intentionally fails fast unless a board is:

- a finite, orthogonal `.tmx` Tiled XML map using right-down rendering;
- made only from tile layers using XML CSV data;
- backed by external `.tsx` Tiled XML spritesheet tilesets;
- using uniform PNG tiles whose dimensions match the map grid;
- free of layer/tile offsets, groups, object layers, image layers, animation, chunks, compression, and inline or image-collection tilesets.

Multiple tile layers and tilesets are supported. Orthogonal horizontal, vertical, and diagonal Tiled flip flags are preserved in the preview.

In Tiled, choose **Tiled tileset files** and save each external tileset as `.tsx`; choose **Tiled map files** and save the map as `.tmx`. These are the only supported Tiled document formats. JSON `.tsj`/`.tmj` and Lua exports are deliberately unsupported.

## Enrichment contract

Every tileset sprite receives:

- a stable `CONSTANT_CASE` slug;
- exactly one project-defined role, such as `GROUND`, `WATER`, or `FOLIAGE`;
- an explicit movement-blocking flag;
- zero or more optional `CONSTANT_CASE` tags.

A board may contain many non-overlapping, grid-aligned samples. Each sample has a stable slug, included layer ids, grid bounds, and rotation/reflection permissions. Biome-specific properties such as selection weight do not belong to the sample; a future biome editor will select sample slugs and configure their terrain-generation behavior.

Movement blocking belongs to the generated contents. Terrain tiles contribute their binding's blocking flag, future feature stamps will contribute explicit footprint masks, and decorative scatter can remain non-blocking.

## Future WFC adjacency contract

Chisel will learn ordinary tile compatibility from the authored samples instead of requiring a hand-written north/east/south/west rule for every sprite:

1. A terrain profile selects sample slugs and a pattern size, initially expected to be `3×3`.
2. The compiler extracts every overlapping pattern wholly contained by each selected sample. A sample edge is not implicitly joined to another sample edge.
3. Two patterns fit horizontally or vertically only when their overlapping rows or columns are identical.
4. Observed frequency and the sample weight configured by that biome profile produce the final pattern weight.

This means cliffs and shorelines must be represented by complete authored examples: straight runs, inner corners, outer corners, starts, ends, and any legal junctions. Open water and solid ground also need enough interior area for the selected pattern size. If a transition never appears in an eligible sample, WFC does not invent it.

World-map edges are an explicit generation constraint rather than an accidental sample edge. Terrain profiles will choose which sample slugs are eligible for interiors and for each outer side/corner, and will pin the outer band to a policy such as water, cliff, or open ground. The compiler can then select only learned patterns compatible with that pinned band. Tile tags such as `CLIFF`, `SHORE`, or `OPEN_WATER` provide semantic constraints and diagnostics; they do not replace the learned visual adjacency.

Biome boundaries use the same mechanism. A boundary sample visibly contains both terrain families, the terrain setup selects that sample slug for the relevant biome pair and orientation, and overlapping-pattern equality carries the transition into generation.

## Source commits

Chisel commits the workspace registry, native `.tmx`/`.tsx` XML, enrichment JSON, managed image paths, and SHA-256 image hashes. Rollback restores the authored state while retaining managed PNGs and blocks if an expected image is missing or has changed.
