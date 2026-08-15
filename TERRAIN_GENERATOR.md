# Socket terrain authoring

Chisel's terrain generator is an offline Simple-Tiled WFC tool. Authors paint explicit tiles and micro-modules, tag each outer edge with a Wang-style socket, generate a batch of constrained candidates, and freeze only useful maps or submodules. Chisel owns the grammar and the approved geography library; no terrain-generator tables are included in runtime exports.

## Pipeline

```text
tileset sprites + gameplay metadata
                │
                ▼
painted BASE and CLIFF pieces (1×1 through 8×8)
                │ tag every N/E/S/W boundary segment
                ▼
BASE and CLIFF piece sets + explicit adjacency exceptions
                │
                ▼
site template (cliff mask, stamps, anchors, zones)
                │ generate several deterministic seeds
                ▼
candidate contact sheet + validation metrics
                │ approve
                ▼
frozen MAP or SUBMODULE in Chisel's geography library
```

This is not overlapping/sample WFC. Chisel does not infer patterns by sliding a window over an example image. The authored pieces and their socket profiles are the complete local grammar.

## Tile catalog

Select a sprite in the tileset catalog to author:

- a stable tile slug;
- its default movement blocking state;
- semantic tags used by pieces and template constraints.

Tile bindings contain sprite metadata only. Adjacency belongs to pieces, so switching to a new tileset does not carry hidden rules from an old sample.

## Socket vocabulary

Create stable socket slugs before painting pieces. A socket has a label, inspector color, description, and a list of valid passes. Examples might include `GROUND`, `WATER`, `ROAD`, `CLIFF_FACE`, and `NO_CLIFF`.

Two exposed boundary segments may touch only when their socket slugs match exactly. Interior edges of a multi-cell piece are compiled into private synthetic sockets, forcing all of the piece's cells to appear together.

Keep the vocabulary semantic and small. A visual variant should normally reuse the same socket. Use a new socket only when the neighboring terrain rules are genuinely different.

## Pieces

A piece is a rectangular module from 1×1 through 8×8 cells. It contains:

- a `BASE` or `CLIFF` pass;
- one or more painted render layers;
- an explicit socket for every segment along its north, east, south, and west edges;
- optional rotations and reflections;
- a positive selection weight;
- biome tags, site tags, semantic flags, and an optional mutation family;
- per-cell blocking, elevation, required/forbidden base tags, and replace/overlay behavior.

Base pieces must paint every cell on layer 0 and replace their output cells. Cliff pieces are overlays and may contain transparent cells. Paint cliffs as their own pieces; they are solved only after base terrain is complete.

For directional art, shadows, text, or asymmetrical collision, enable only transforms that are visually valid. The compiler rotates/reflection-transforms both the artwork and its socket profile.

## Compatibility inspector

The cart icon in the active piece editor analyzes the current unsaved piece. It compiles that piece together with the active piece set and shows, for every direction:

- the exposed socket profile;
- compatible neighboring pieces;
- dead boundary states with no possible continuation.

Use this before generating. A dead state means the grammar lacks a matching neighbor, not that the random solver was unlucky. Add the missing transition piece, correct the socket tag, or intentionally constrain the boundary with a template.

Adjacency overrides are a narrow escape hatch applied after socket equality:

- `DENY` removes a specific source/direction/target pairing;
- `ALLOW_ONLY` limits that source edge to the named target piece.

Prefer meaningful sockets over a large override list.

## Piece sets

A piece set is the vocabulary available to one solver pass. Base sets contain only base pieces; cliff sets contain only cliff pieces. Use sets to make biome densities and transition families explicit without duplicating tiles or code.

Weights are normalized by module area, so a large module does not become disproportionately common merely because it occupies more output cells.

## Site templates

A site template supplies the large-scale intent that local WFC cannot infer. It selects a base set and an optional cliff set, then defines:

- map dimensions and candidate batch size;
- per-cell required and forbidden base tags;
- a per-cell cliff mask: forbidden, optional, or required;
- protected cells;
- required piece stamps with fixed transform and location;
- entrance, exit, and extension anchors;
- zones with tag-count ranges.

Required stamps are placed before collapse. Their mixed-size internal states are fixed as one unit. Contradictory or overlapping stamps fail immediately.

Extension anchors must lie on the map boundary. Anchors are validated against the generated walkability graph; WFC is responsible for local assembly, while the template and validator are responsible for site-level intent.

## Two-pass generation

Generation is deterministic for a template and seed:

1. Compile every enabled transform into per-cell states.
2. Pre-ban module origins that would clip a boundary.
3. Apply template tags and required base stamps.
4. Collapse the base map by lowest entropy and propagate exact socket constraints.
5. Compose tile stacks, collision, elevation, and semantic metadata.
6. Compile the cliff set plus a transparent `NO_CLIFF` state.
7. Apply the cliff mask and base-tag requirements, then solve cliff overlays independently.
8. Validate anchors, zones, elevation steps, required cliffs, and walkable components.

Contradictions are retried with deterministic derived seeds. If every attempt fails, fix the grammar or constraints; the generator does not silently emit an invalid partial map.

## Candidate review and approval

Generate a batch rather than judging one seed. The contact sheet reports validation issues and metrics including walkable components, reachable anchors, cliff cells, and distinct piece usage.

Approve a useful result as:

- `MAP`: a complete authored site;
- `SUBMODULE`: frozen reusable geography intended for a later composition step.

Approval deep-copies the concrete tile stacks, resolved metadata, placements, anchors, and metrics. Later changes to sockets, pieces, weights, templates, or the solver cannot silently alter the approved asset.

## Chisel-only data boundary

The current terrain tables are:

- `terrain_tile_bindings`
- `terrain_sockets`
- `terrain_pieces`
- `terrain_piece_sets`
- `terrain_adjacency_overrides`
- `terrain_site_templates`
- `terrain_approved_assets`

All seven are editor-only system tables. Runtime export deliberately excludes them. Deleting a tileset is refused while an authored piece or frozen approved asset still uses it; if only unused tile bindings remain, Chisel removes those bindings with the asset.

## Recommended first setup for a new tileset

1. Bind the ground, foliage, rock, and cliff sprites with stable slugs, collision, and semantic tags.
2. Define the smallest useful socket vocabulary.
3. Make several 1×1 base pieces to prove continuous ground and basic transitions.
4. Add 2×1, 2×2, or larger modules for deliberate clusters and silhouettes.
5. Analyze every piece with the cart inspector until exposed dead states are intentional.
6. Create a base set and generate a small unconstrained template.
7. Add cliff pieces and a separate cliff set, then paint a cliff mask in the template.
8. Add anchors, zones, and required stamps only after the local grammar is healthy.
9. Review a candidate batch and freeze only geography worth keeping.
