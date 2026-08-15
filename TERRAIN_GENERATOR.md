# Socket terrain authoring

Chisel's terrain generator is an offline Simple-Tiled WFC tool. Authors paint explicit tiles and micro-modules, tag every outer edge with a Wang-style socket, generate constrained candidates, and freeze useful maps or submodules. Chisel owns the grammar and approved geography library; terrain-generator tables are excluded from runtime exports.

## Pipeline

```text
tileset sprites + gameplay metadata
                │
                ▼
painted terrain pieces (1×1 through 8×8)
                │ tag every N/E/S/W boundary segment
                ▼
collection + optional adjacency exceptions
                │
                ▼
site template (stamps, anchors, zones, tag constraints)
                │ generate deterministic seeds
                ▼
candidate contact sheet + validation metrics
                │ approve
                ▼
frozen MAP or SUBMODULE in Chisel's geography library
```

This is not overlapping/sample WFC. Chisel does not infer patterns by sliding a window over an image. Authored pieces and their socket profiles are the complete local grammar.

## Editor workflow

Terrain Generator is divided into five focused pages:

1. **Catalog** — bind tiles and define the socket vocabulary.
2. **Pieces** — paint modules and inspect compatibility with the cart icon.
3. **Collections** — choose the pieces solved together. Adjacency exceptions remain under Advanced.
4. **Generate** — choose a template, starting seed, and batch size. **Generate** reproduces that seed range; **Generate more** appends the next range. Anchors, stamps, zones, and per-cell tag constraints remain under **Edit advanced constraints**.
5. **Approved** — review frozen maps and submodules independently from the live grammar.

An empty project with bound sprites opens with an unsaved `EXAMPLE_FOREST_SITE`. It can immediately generate eight candidates. The example uses weighted 1×1 pieces, mixed-size transformed modules, one collection, deny and allow-only adjacency exceptions, cell tag constraints, three anchors, a required stamp, and a validation zone. Use **Reset full example** to reconstruct it after experimenting. It does not modify project files until **Save authoring** is selected.

## Tile catalog

Select a sprite in the tileset catalog to author:

- a stable tile slug;
- its default movement-blocking state;
- semantic tags used by pieces and template constraints.

Tile bindings contain sprite metadata only. Adjacency belongs to pieces, so a new tileset does not inherit hidden rules from an old sample.

## Socket vocabulary

Create stable socket slugs before painting pieces. A socket has a label, inspector color, and description. Examples include `GROUND`, `WATER`, `ROAD`, and `SHORE`.

Two exposed boundary segments may touch only when their socket slugs match exactly. Interior edges of a multi-cell piece compile into private synthetic sockets, forcing all cells in that piece to appear together.

Keep the vocabulary semantic and small. Visual variants normally reuse a socket. Create a new socket only when the neighboring-terrain rule is genuinely different.

## Pieces

A piece is a rectangular module from 1×1 through 8×8 cells. It contains:

- one or more painted render layers, with every first-layer cell filled;
- an explicit socket for every segment along its north, east, south, and west edges;
- optional rotations and reflections;
- a positive selection weight;
- biome tags, site tags, semantic flags, and an optional mutation family;
- per-cell movement blocking, elevation, and semantic flags.

For directional art, shadows, text, or asymmetrical collision, enable only visually valid transforms. The compiler transforms both artwork and socket profiles.

## Compatibility inspector

The cart icon in the active piece editor analyzes the current unsaved piece. It compiles the piece with its collection and shows, for every direction:

- the exposed socket profile;
- compatible neighboring pieces;
- dead boundary states with no possible continuation.

Use this before generating. A dead state means the grammar lacks a matching neighbor; it is not unlucky randomness. Add the missing transition piece, correct the socket, or intentionally constrain the boundary with a template.

Adjacency exceptions are a narrow escape hatch applied after socket equality:

- `DENY` removes a source/direction/target pairing;
- `ALLOW_ONLY` limits a source edge to the named target piece.

The Advanced adjacency section previews these as rule cards in a responsive grid. Each card renders the source and target pieces, the affected direction, and a compact bottom-left X for `DENY` or lock for `ALLOW_ONLY`; its exact metadata appears below. Removing a rule always requires confirmation.

Prefer meaningful sockets over a large exception list.

## Collections

A collection is the complete vocabulary available to one solve. Use collections to make biome densities and transition families explicit without duplicating tiles or generator code.

Weights are normalized by module area, so a large module does not become disproportionately common merely because it occupies more cells.

## Site templates

A site template supplies large-scale intent that local WFC cannot infer. It selects one collection and defines:

- map dimensions, reproducible starting seed, and candidate batch size;
- per-cell required and forbidden semantic tags;
- required piece stamps with fixed transform and location;
- entrance, exit, and extension anchors;
- validation zones with tag-count ranges.

Required stamps are placed before collapse. Their mixed-size internal states are fixed as one unit. Contradictory or overlapping stamps fail immediately.

Extension anchors must lie on the map boundary. Anchors are validated against the generated walkability graph; WFC handles local assembly, while templates and validation handle site-level intent.

The advanced constraint preview draws the latest generated candidate as a terrain backdrop, then overlays every authored constraint together: green/red tag cells, gold stamps, blue validation zones, directional entrance/exit/extension anchors, and the selected editing cell. Before a candidate exists, the same overlay remains usable on a neutral grid. Creation controls stay beside the preview; authored rules appear as cards below it. Selecting a card highlights the complete affected cell or footprint, while zone count ranges remain editable on their cards.

## Generation

Generation is deterministic for a template and seed. The authored start seed always recreates the same batch; requesting more candidates continues from the next seed without replacing the current contact sheet.

1. Compile every enabled transform into per-cell states.
2. Pre-ban module origins that would clip a boundary.
3. Apply template tag constraints and required stamps.
4. Collapse the map by lowest entropy and propagate exact socket constraints.
5. Compose tile stacks, collision, elevation, and semantic metadata.
6. Validate anchors, zones, elevation steps, and walkable components.

Contradictions are retried with deterministic derived seeds. If every attempt fails, fix the grammar or constraints; the generator does not emit an invalid partial map.

## Candidate review and approval

Generate a batch rather than judging one seed. The contact sheet reports validation issues and metrics including walkable components, reachable anchors, and distinct piece usage.

Approve a useful result as:

- `MAP`: a complete authored site;
- `SUBMODULE`: frozen reusable geography intended for a later composition step.

Approval deep-copies concrete tile stacks, resolved metadata, placements, anchors, and metrics. Later changes to sockets, pieces, weights, templates, or the solver cannot alter an approved asset.

## Chisel-only data boundary

The current terrain tables are:

- `terrain_tile_bindings`
- `terrain_sockets`
- `terrain_pieces`
- `terrain_piece_sets`
- `terrain_adjacency_overrides`
- `terrain_site_templates`
- `terrain_approved_assets`

All seven are editor-only system tables. Runtime export excludes them. Deleting a tileset is refused while an authored piece or approved asset uses it; if only unused tile bindings remain, Chisel removes those bindings with the asset.

## Recommended first setup for a new tileset

1. Bind ground, foliage, rock, water, and detail sprites with stable slugs, collision, and semantic tags.
2. Define the smallest useful socket vocabulary.
3. Make several 1×1 pieces to prove continuous ground and basic transitions.
4. Add 2×1, 2×2, or larger pieces for deliberate clusters and silhouettes.
5. Analyze every piece with the cart inspector until exposed dead states are intentional.
6. Create one collection and generate a small unconstrained template.
7. Add anchors, zones, tag constraints, and required stamps only after the local grammar is healthy.
8. Review a candidate batch and freeze only geography worth keeping.
