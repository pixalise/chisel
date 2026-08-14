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
- zero or more optional `CONSTANT_CASE` tags.

A board may contain many non-overlapping, grid-aligned samples. Each sample has a stable id, `INTERIOR` or `BOUNDARY` kind, one or more future biome profile slugs, a positive weight, included layer ids, bounds, and rotation/reflection permissions.

Profiles are references to future biome-generation profiles; Chisel records those references but does not define or compile biome profiles yet.

## Source commits

Chisel commits the workspace registry, native `.tmx`/`.tsx` XML, enrichment JSON, managed image paths, and SHA-256 image hashes. Rollback restores the authored state while retaining managed PNGs and blocks if an expected image is missing or has changed.
