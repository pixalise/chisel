# Native overlapping-WFC sample pipeline

Chisel owns the complete terrain-authoring workflow: tileset assets, layered training examples, optional per-tile metadata, pattern compilation, procedural preview, and biome references.

## What overlapping WFC learns

Overlapping WFC does not place an authored sample as a stamp and does not infer semantic rules from names such as `GROUND`, `PATH`, or `FOLIAGE`. It analyzes the exact layered cells painted into a sample.

Chisel currently uses a fixed 3×3 analysis window:

1. Slide a 3×3 window across every valid position in every sample.
2. Store each distinct 3×3 window as a pattern.
3. Count repeated occurrences to derive pattern frequency.
4. Compare every pair of patterns in all four directions.
5. Permit two patterns to be neighbors when their two-cell-wide overlap is exactly equal.
6. Collapse the lowest-entropy output position and propagate its constraints.
7. Restart with a derived seed if a contradiction occurs.

For this 5×5 input:

```text
A A A A A
A A B A A
A A A A A
A C C C A
A A A A A
```

the compiler extracts nine overlapping 3×3 windows. Those windows include `B` in every relative position around its source location, the beginning and end of the `C` run, and plain `A` space. That is the key difference between a real training example and nine isolated 3×3 samples.

## Vocabulary

- **Cell**: one position in the authored or generated grid.
- **Layered cell**: the ordered stack at one position, such as grass on layer 0 and a transparent bush fragment on layer 1.
- **Sample**: a representative map painted by the author. Samples can be rectangular and range from 3×3 to 64×64.
- **Pattern**: one distinct overlapping 3×3 window extracted from a sample.
- **Occurrence**: one observation of a pattern. Repeated occurrences affect its frequency.
- **Adjacency**: a legal north, east, south, or west relationship between two overlapping patterns.
- **Viable pattern**: a pattern belonging to a constraint cycle that can continue in every direction.
- **Entropy**: uncertainty at an output position, accounting for both the remaining patterns and their weights.
- **Contradiction**: an output position whose domain has been reduced to zero patterns.

## Add tilesets

1. Open **Asset Library** and add an asset.
2. Choose the **Tileset** category.
3. Choose a PNG spritesheet and set its square tile size in pixels.

The image width and height must both be divisible by the tile size. Chisel derives grid dimensions and local tile IDs from that information. Tilesets are managed assets under `.chisel/assets/TILESET` and keep stable asset slugs.

A sample may reference multiple tilesets. This is how a base terrain sheet, a transparent plant sheet, and a transparent prop sheet participate in one training example.

## Optional tile metadata

The palette can enrich a sprite with:

- a stable semantic tile slug;
- a role;
- a movement-blocking flag;
- optional tags.

Metadata is not required for overlapping-pattern matching. The compiler compares exact layered cell contents. Roles and tags are available to biome setup and runtime enrichment, but they never make two different sprites overlap-compatible.

## Paint large layered samples

Create a sample by choosing width, height, and layer count.

- Layer 0 is the required base and must be fully painted.
- Overlay layers are optional at each position and preserve transparency.
- The painter renders all layers together.
- Select the active paint layer from the painter header.
- Left-click or drag to paint.
- Ctrl+left-click, right-click, or drag to erase the active layer.
- The painter uses a fixed cell scale and scrolls for large examples; it does not zoom.

For useful texture synthesis, start around 12×12. Samples around 20×20 through 32×32 usually provide enough repeated context for paths, clearings, clusters, and transitions while remaining understandable to edit. A 3×3 sample contributes only one observation before transformations and is primarily useful for an explicitly hand-authored rule library.

### Layered-cell example

Suppose one position contains:

```text
Layer 1: PLANTS:418
Layer 0: GRASS:0
```

That complete stack is one symbol to the WFC compiler. Neighboring fragments of the same bush occupy their own layered cells. When all required 3×3 overlaps are present, the generator can reconstruct the multi-cell bush rather than scattering unrelated fragments.

Overlay absence also matters. Grass with no overlay is different from grass with a bush fragment. Paint generous empty space around props so the compiler observes transitions from ordinary grass into every side of the prop and back out again.

## Why the video-style samples work

The included Farbound reference data uses the supplied Pixel Art Top Down tileset and contains two examples:

- `OVERLAP_VEGETATION` is 20×28 with two layers. It teaches open grass, sparse ground detail, isolated bushes, adjacent bushes, and several bush sizes.
- `OVERLAP_RUINS` is 28×20 with two layers. It teaches open grass, long paths, corners, branches, T-junctions, intersections, path endpoints at graves, vegetation near paths, and open areas between structures.

Both examples use the exact same plain-grass layered cell repeatedly. Their pattern graphs therefore connect through a shared neutral language. WFC may leave a path region, travel through ordinary grass patterns, and enter a vegetation region even though those features came from different samples.

The two examples produce:

- 936 extracted observations;
- 249 unique demo patterns after deduplication;
- 249 globally viable demo patterns.

The earlier 3×3 lattice demonstration failed aesthetically because it taught exactly one flower in every 3×3 area. That constraint has only grid-like solutions. A large example naturally contributes both feature-bearing windows and plain empty windows, allowing features to be absent as well as present.

## Authoring feature islands

The safest reusable structure is a feature island surrounded by a shared neutral cell:

```text
. . . . . . .
. . . . . . .
. . B B . . .
. . B B . . .
. . . . . . .
. . . . . . .
. . . . . . .
```

Here `.` is the exact neutral layered cell and `B` is a bush fragment stack. With a 3×3 window, at least two neutral cells around the feature let the compiler observe all entry and exit contexts. Three or four cells of breathing room are easier to reason about.

Add several forms to the same sample:

```text
isolated       pair           cluster

. B . . .      . B B .       . B B .
. . . . .      . . . .       . B B .
. . . . .      . . . .       . . B .
```

WFC can only produce arrangements represented by some chain of observed overlaps. If only the cluster is painted, isolated bushes are not automatically legal. If only isolated bushes are painted, touching bushes are not automatically legal.

## Authoring paths and rigid structures

Include each primitive that should appear in generated output, with neutral space around it.

```text
straight        corner          T-junction       cross

. P .           . P .           P P P            . P .
. P .           . P P           . P .            P P P
. P .           . . .           . P .            . P .
```

Also include intentional endpoints:

```text
. G .
. P .
. P .
```

`G` may be a gravestone layered over grass. Without an observed endpoint, a path may be forced to continue forever, terminate only at the output boundary, or make the library contradictory. Include long enough straight segments for their middle patterns to repeat, not only one copy of each junction.

For cliffs, shorelines, walls, and map edges, apply the same principle:

- teach every desired straight orientation;
- teach inner and outer corners separately;
- teach transitions into the shared interior terrain;
- teach caps or endpoints when termination is legal;
- keep forbidden transitions absent from every sample.

## Empty space is a pattern

Empty space is not a lack of authored information. A repeated 3×3 area of neutral ground is the pattern that allows WFC to produce breathing room of arbitrary size.

Compare these rule libraries:

```text
Exactly one flower per window: 9 flower-position patterns
At most one flower per window: those 9 patterns + the all-ground pattern
```

The first forces a lattice. The second permits gaps. Large samples normally capture the all-ground pattern automatically, which is why they are much easier to author successfully.

## Periodic input

Periodic input wraps sample coordinates while extracting windows. A window crossing the right edge continues at the left edge, and a window crossing the bottom continues at the top.

Enable it when:

- the sample is an intentionally seamless texture;
- opposite edges were deliberately painted to meet;
- a compact sample represents one repeating world patch.

Leave it disabled when:

- a wall, coast, path, or large prop touches an edge without a matching continuation;
- opposite edges contain unrelated features;
- the sample has a neutral border and already contains enough internal repetition.

Periodic input guarantees continuation opportunities, but it can teach false seams. It is a tool, not an automatic quality switch.

## Rotations and reflections

Transform switches create rotated or reflected observations and transform sprite orientations with them.

Enable them when:

- sprites are designed to rotate or reflect;
- the same structural rule should apply in every direction;
- orientation metadata is meaningful for runtime rendering.

Leave them disabled when:

- lighting or shadows have a fixed direction;
- text, gravestone markings, doors, or asymmetric props must remain upright;
- the tileset already provides separately authored directional art;
- the transformed sprite would be visually invalid.

Transformations multiply the pattern space. More patterns are useful only when they are visually correct and remain connected.

## Frequency, weights, and biome control

Repeated observations inside one sample increase a pattern's relative frequency. Paint more ordinary grass than graves when graves should be rare. Paint several path middles when long paths should be common.

Chisel normalizes each sample to one total unit of compiler weight. Therefore:

- frequency inside a sample controls the balance among that sample's patterns;
- adding a second sample does not automatically dominate merely because it is larger;
- biome-level sample weights belong in biome profiles, not in the WFC sample editor.

For substantially different distributions, prefer separate representative samples and assign them through biome profiles. For example:

```text
MEADOW_OPEN      mostly grass, sparse flowers
MEADOW_WOODED    more vegetation clusters
RUINS_LIGHT      occasional paths and graves
RUINS_DENSE      frequent paths, junctions, and props
```

## Read the diagnostics

The preview reports:

- **extracted**: transformed window observations collected from a sample;
- **unique**: distinct patterns to which that sample contributed;
- **viable**: contributed patterns belonging to a cycle that can continue in every direction;
- **dead ends**: patterns with no immediate compatible neighbor in one direction;
- **generation attempts**: how many seeded restarts were required.

Open **Pattern contribution by sample**. A line such as:

```text
GRASS_MEADOW_1: 0/72 viable (72 extracted)
```

means the sample is not contributing to ordinary interior generation. A headline count such as `393 unique patterns` is not evidence of variety if only 249 are viable.

Useful targets are:

- every intended primary sample has viable patterns;
- the viable count is comfortably larger than a handful of phase variants;
- multiple seeds change topology, not only rotation or translation;
- ordinary seeds finish in one attempt;
- the output includes each intended feature without fragmenting multi-cell art.

## Diagnose common failures

### Output is a checkerboard or lattice

The samples encode a fixed-count or fixed-spacing rule. Add repeated neutral windows and examples where the feature is absent. Do not create only translated copies of one tiny arrangement.

### Seeds look identical but rotated

The viable pattern graph contains one deterministic cycle plus its transforms. Paint branching alternatives: empty space, multiple cluster shapes, different path continuations, and transitions returning to common ground.

### A sample has zero viable patterns

Its windows do not form a closed continuation graph. Increase the sample size, repeat its neutral context, complete all sides of feature islands, or use periodic input only after making edges seamless.

### Paths never end

No legal endpoint was observed. Paint caps, gates, graves, doors, or deliberate transitions from path back to neutral ground.

### Props appear as fragments

The prop is larger than the learned context or lacks enough surrounding observations. Paint the complete layered prop more than once, surround it with neutral cells, and consider a larger analysis strategy if a single object is substantially larger than 3×3.

### Generation frequently contradicts

The library is highly constrained or contains incompatible sub-languages. Add shared transition regions, reduce invalid transformations, separate unrelated biomes into profiles, or author smaller coherent samples before increasing complexity.

## Practical quality checklist

1. Use a repeated neutral layered cell shared by every sample that should mix.
2. Start with a 12×12 to 24×24 example, not isolated 3×3 rules.
3. Leave at least two cells of neutral context around feature islands.
4. Include the all-neutral 3×3 pattern.
5. Paint every desired straight, corner, junction, and endpoint.
6. Show isolated, paired, and clustered forms separately when all are desired.
7. Repeat common structures and keep rare structures rare in the input.
8. Keep rotations and reflections off until transformed art is verified.
9. Use periodic input only for deliberately seamless edges.
10. Check viability per sample before judging the output.
11. Test at least ten seeds and compare topology, density, and feature integrity.
12. Increase complexity gradually; preserve a working shared neutral language.

## System tables

Terrain authoring uses normalized system tables:

- `terrain_roles`
- `terrain_tile_bindings`
- `terrain_wfc_samples`
- `terrain_wfc_sample_cells`
- `terrain_biomes`
- `terrain_biome_profiles`

`terrain_wfc_samples` stores dimensions, layer count, periodic-input policy, and transformation policy. `terrain_wfc_sample_cells` stores sample, position, layer, tileset asset, and local tile ID. The specialized terrain editor and Data Tables screen read the same rows.

## Tileset deletion and source commits

Deleting an unused tileset removes its tile bindings. If a biome profile reaches the tileset through a sample, deletion is refused and reports the blocking profile and sample.

Tileset assets and every terrain system table participate in ordinary Chisel source commits. There is no parallel terrain registry or external map format.
