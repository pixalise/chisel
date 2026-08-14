# Native WFC sample pipeline

Chisel owns the complete terrain-authoring workflow: tileset assets, per-tile metadata, painted samples, compiler input, procedural preview, and biome references.

## Add a tileset

1. Open **Asset Library** and add an asset.
2. Choose the **Tileset** category.
3. Choose a PNG spritesheet and set its square **Tile size** in pixels.

The image width and height must both be divisible by the tile size. Chisel derives the grid dimensions and local tile ids directly from that information. A tileset is an ordinary managed asset under `.chisel/assets/TILESET` and keeps a stable asset slug.

## Tag tiles

Open **Terrain → WFC Samples**. The tileset palette exposes every sprite by its local id. Each sprite can have:

- a stable semantic tile slug;
- one required role;
- a movement-blocking flag;
- optional tags.

Roles are project-wide. Ground and foliage are seeded by default. Transparent pixels do not require a separate water role: a transparent ground sprite can represent water while retaining its exact sprite identity for pattern matching.

## Paint samples

Choose 3×3, 4×4, or 5×5 and press **Create sample**. Select a palette tile, then left-click or drag across the sample grid to paint it. Ctrl+left-click, right-click, or drag erases cells. The painter has a fixed scale and does not zoom.

Every cell stores a tileset asset reference and local tile id. The sample slug is its stable identity and is later referenced by biome profiles. Rotation and reflection switches permit the compiler to derive the corresponding transformed observations, including sprite orientation.

## System tables

Terrain authoring uses normalized system tables:

- `terrain_roles`
- `terrain_tile_bindings`
- `terrain_wfc_samples`
- `terrain_wfc_sample_cells`
- `terrain_biomes`
- `terrain_biome_profiles`

The specialized terrain editor and the Data Tables screen read the same rows. Spatial binding/sample tables are edited by the terrain workspace, while roles, biomes, and biome profiles remain available as ordinary editable system data.

## Compilation and preview

The preview compiler extracts every overlapping 3×3 pattern from each fully painted sample. Exact recurring patterns are deduplicated while their occurrence counts and source-sample identities are retained. Each authored sample contributes one normalized unit of weight; biome-specific weights belong to biome profiles, not samples.

Patterns fit when their overlapping sprite identities and orientations match. That means cliffs, shores, map edges, and other transitions are learned from the arrangements painted into the source samples. The seeded preview solver exposes contradictions and directional dead ends before runtime export.

## Tileset deletion

Deleting an unused tileset removes its tile bindings. Samples that contain it are also removed when no biome profile uses them. If a biome profile reaches the tileset through one of its samples, deletion is refused and reports the blocking profile and sample.

## Source commits

Tileset assets and every terrain system table participate in the ordinary Chisel source commit. There is no parallel terrain registry or external source snapshot.
