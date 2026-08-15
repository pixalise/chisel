# Logical sector-WFC authoring

Chisel uses WFC as an offline nature generator. Authors paint small examples, generate many deterministic candidates, and approve only the useful rendered patches. The game receives frozen patches and tilesets; it does not run WFC or ship its source samples.

## The pipeline

```text
painted sprite samples
        │ map each sprite to a logical WFC symbol
        ▼
logical samples such as GROUND / TREE / ROCK
        │ extract overlapping N×N patterns
        ▼
generate several small sectors independently
        │ keep sector interiors fixed
        ▼
solve the N-1-cell gaps between sectors
        │ choose concrete sprite variants deterministically
        ▼
review and approve a frozen layered patch
```

This is deliberately different from treating every sprite ID as its own WFC symbol. Four tree sprites may all use the logical symbol `TREE`. WFC decides where `TREE` is legal; after the logical layout is complete, Chisel chooses among the four observed tree sprites. That provides visual variety without multiplying the structural rule graph.

## Tile binding fields

Select a sprite in the tileset palette and author:

- **Stable slug**: the identity exported with tileset gameplay metadata.
- **WFC symbol**: the logical placement state used by the pattern compiler.
- **Blocks movement**: runtime collision meaning.
- **Semantic tags**: optional runtime or biome meaning.

Every sprite painted into a sample needs a binding and a WFC symbol. Sprites with the same symbol are visual variants only when their complete layer position has the same logical meaning.

Good groupings:

```text
GRASS_A, GRASS_B, GRASS_C       -> GROUND
PINE_A, PINE_B, PINE_C          -> TREE
ROCK_SMALL_A, ROCK_SMALL_B      -> ROCK
```

Bad grouping:

```text
GRASS, DEEP_WATER, CLIFF_CORNER -> TERRAIN
```

The bad grouping erases a structural distinction that WFC must preserve. If two sprites obey different placement rules, give them different symbols.

Orientation remains part of the logical state. `SHORE@0` and a rotated `SHORE@1` are different states because their connection directions differ.

## Layers

Layer 0 is required and must be painted everywhere. Overlay layers are optional. The logical state of one cell is the ordered stack of symbols on all layers:

```text
GROUND@0 / -             ordinary ground
GROUND@0 / TREE@0        a tree anchor over ground
GROUND@0 / ROCK@0        a rock anchor over ground
```

Overlay absence is meaningful. Ground without a tree and ground with a tree are different logical cells.

For large visual objects, paint one logical anchor or prefab reference whenever possible. Do not make WFC reconstruct a tree from unrelated crown and trunk fragments unless those fragments truly occupy separate game cells and every legal arrangement is intentionally sampled.

## What overlapping sampling learns

For a selected `N×N` size, Chisel:

1. Slides an `N×N` window across every selected sample.
2. Replaces each painted sprite with its logical WFC symbol.
3. Deduplicates identical logical windows and records their frequencies.
4. Lets two patterns touch when their shared `N-1` rows or columns match exactly.
5. Uses lowest-entropy collapse and constraint propagation to build new logical layouts.

For 2×2 sampling, horizontally adjacent patterns share one exact column:

```text
Pattern A        Pattern B
A B              B C
D E              E F
```

The shared `B/E` column must match exactly, including every logical layer and orientation.

Sampling size controls local memory:

- **2×2**: one-cell overlaps, broad recombination, best default for loose nature.
- **3×3**: two-cell overlaps, preserves small groups and short boundaries.
- **4×4**: three-cell overlaps, preserves larger local shapes but needs richer input and repeats more readily.

It does not control output size. Start with 2×2 for forests, rocks, flowers, and irregular clearings. Increase it only when the output breaks a relationship that needs more context.

## Sector generation and stitching

Chisel does not ask one monolithic solve to invent the whole candidate. It generates small square sectors independently. Between neighboring sectors it leaves a gap `N-1` cells wide, fixes the sector interiors as constraints, and runs one final WFC solve to fill those gaps.

This gives two useful properties:

- distant areas can vary independently instead of inheriting one long collapse history;
- every filled seam is checked against the same logical pattern grammar.

The **Sector** selector controls the independent interior size. Smaller sectors increase large-scale variation and the number of stitched seams. Larger sectors preserve longer structures within each solve and do less stitching. For 32×32 nature patches, begin with 8×8 sectors.

If stitching repeatedly contradicts, the sample does not teach enough ways to return to a shared neutral state. Add more open `GROUND`, more entrances and exits around clusters, or separate incompatible sample families.

## Authoring useful nature samples

Use logical anchors rather than drawing only finished showcase compositions. A compact forest sample should contain:

- a large repeatable `GROUND` region;
- isolated `TREE` cells;
- pairs and irregular clusters;
- several gaps between clusters;
- every cluster returning to ordinary `GROUND` on all sides.

Example:

```text
. . . . . . . .
. T . . . T T .
. . . . . T . .
. . T . . . . .
. . T T . . T .
. . . T . . . .
. T . . . . T .
. . . . . . . .
```

`.` is `GROUND`; `T` is `GROUND/TREE`. Use several concrete tree sprites for the `T` positions but bind them all to `TREE`. A second sparse sample and a third dense sample can use the same symbols with different spatial frequency.

The generator cannot infer a relationship that never appears. If touching trees are absent, it will not invent groves. If the all-ground pattern is absent, it may be forced to place vegetation continuously. If every tree appears at one fixed interval, that interval becomes the grammar and produces a lattice.

## Water, shores, and cliffs

Keep structurally different terrain distinct:

```text
ordinary land       GROUND
deep water          WATER
shore directions    SHORE_N, SHORE_E, SHORE_S, SHORE_W
cliff directions    CLIFF_N, CLIFF_E, CLIFF_S, CLIFF_W
```

Paint long fills, straight boundaries, every supported corner, and transitions back to shared ground. Visual variants within one directional role may share a symbol. Opposite directions may not.

Local WFC can make locally valid lake or cliff shapes, but it cannot guarantee a single connected lake, a reachable island, or a road between distant entrances. Those are world-level constraints and belong to game-side planning or candidate rejection.

## Periodic input and transformations

Periodic input wraps sample edges while extracting windows. Use it only for an intentionally seamless sample whose opposite sides were painted to meet. It is not a general fix for weak samples.

Rotations and reflections transform both pattern positions and sprite orientations. Enable them only when lighting, shadows, text, and directional art remain valid after the transform.

## Candidate review

Choose only the samples intended to contribute to a candidate family. Generate multiple fixed seeds and judge:

- local validity of boundaries and clusters;
- meaningful changes in topology between seeds;
- amount of open space;
- density of trees, rocks, and other anchors;
- absence of obvious grids or repeated showcase blocks;
- successful seam stitching in one or very few assembly attempts.

Approve a candidate only after it looks useful. Approval stores the concrete layered sprite grid. Later changes to WFC symbols, source samples, or the compiler cannot silently change that approved patch.

## Runtime boundary

Only these tables appear in Data Tables and runtime exports:

- `terrain_tilesets`: tileset dimensions and concrete per-sprite gameplay metadata;
- `terrain_approved_patches`: frozen concrete layered grids.

Bindings, WFC symbols, samples, pattern libraries, rejected candidates, sector constraints, and stitch diagnostics remain editor-only.

Deleting a tileset used by an approved patch is refused. Deleting an unapproved tileset also removes its source bindings and sample references.
