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
                │ generate fresh random batches
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
4. **Generate** — choose a template and batch size. Every **Generate** click creates a fresh random contact sheet. Anchors, stamps, zones, and per-cell tag constraints remain under **Edit advanced constraints**.
5. **Annotations** — polish approved maps with sparse cell overrides, then paint separate spatial dressings for runtime content placement.

## Tile catalog

Select a sprite in the tileset catalog to author:

- a stable tile slug;
- semantic tags used by pieces and template constraints.

Selecting a sprite creates this metadata automatically; there is no separate bind/unbound workflow. Sprite metadata never owns collision or adjacency. Collision belongs to each painted piece cell, and adjacency belongs to piece sockets, so the same sprite can behave differently in different pieces without inheriting hidden rules.

Both the Catalog sprite grid and the compact Sprite palette are searchable by local tile ID, stable sprite slug, or semantic tag.

## Socket vocabulary

Create stable socket slugs before painting pieces. A socket uses its slug as its identity and has an inspector color and optional description. Examples include `GROUND`, `WATER`, `ROAD`, and `SHORE`.

Two exposed boundary segments may touch only when their socket slugs match exactly. Interior edges of a multi-cell piece compile into private synthetic sockets, forcing all cells in that piece to appear together.

Keep the vocabulary semantic and small. Visual variants normally reuse a socket. Create a new socket only when the neighboring-terrain rule is genuinely different.

## Pieces

A piece is a rectangular module from 1×1 through 8×8 cells. It contains:

- one or more render layers; the first layer may remain unpainted for an intentional logical-only cell;
- an explicit socket for every segment along its north, east, south, and west edges;
- optional rotations and reflections;
- a positive legacy/default selection weight, overridden by collection-specific weights;
- biome tags, site tags, semantic flags, and an optional mutation family;
- per-cell movement blocking, elevation, and semantic flags.

The piece painter has two explicit modes. **Paint terrain** applies render sprites and layers. Erasing the base creates a valid logical-only cell that still carries sockets, semantic flags, elevation, and collision. **Paint collision** applies a red per-cell collision mask: left-drag blocks cells, while right-drag or Ctrl-drag clears them. A 2×2 piece may therefore block any combination of its four cells, and that mask rotates or reflects with the piece.

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

Collection setup lists every valid authored piece—both 1×1 tiles and larger modules—as a visual card. Search by slug, dimensions, tags, or mutation family; filter cards by active/inactive status; and click a card to toggle whether that piece participates in the collection. Every active card has a positive relative weight scoped to that collection, so the same piece can be common in one solve and rare in another. A collection must retain at least one active piece.

Weights are normalized by module area, so a large module does not become disproportionately common merely because it occupies more cells.

## Site templates

A site template supplies large-scale intent that local WFC cannot infer. It selects one collection and defines:

- map dimensions and candidate batch size;
- per-cell required and forbidden semantic tags;
- required piece stamps with fixed transform and location;
- entrance, exit, and extension anchors;
- validation zones with tag-count ranges.

Required stamps are placed before collapse. Their mixed-size internal states are fixed as one unit. Contradictory or overlapping stamps fail immediately.

Extension anchors must lie on the map boundary. Anchors are validated against the generated walkability graph; WFC handles local assembly, while templates and validation handle site-level intent.

The advanced constraint preview draws the latest generated candidate as a terrain backdrop, then overlays every authored constraint together: green/red tag cells, gold stamps, blue validation zones, directional entrance/exit/extension anchors, and the selected editing cell. Before a candidate exists, the same overlay remains usable on a neutral grid. Creation controls stay beside the preview; authored rules appear as cards below it. Selecting a card highlights the complete affected cell or footprint, while zone count ranges remain editable on their cards.

## Generation

Every Generate click starts from fresh randomness and replaces the current contact sheet. Random state remains an internal solver detail rather than authored template data.

1. Compile every enabled transform into per-cell states.
2. Pre-ban module origins that would clip a boundary.
3. Apply template tag constraints and required stamps.
4. Collapse the map by lowest entropy and propagate exact socket constraints.
5. Compose tile stacks, collision, elevation, and semantic metadata.
6. Validate anchors, zones, elevation steps, and walkable components.

Contradictions are retried from the current random solve. If every attempt fails, fix the grammar or constraints; the generator does not emit an invalid partial map.

## Candidate review and approval

Generate a batch rather than judging one result. The contact sheet reports validation issues and metrics including walkable components, reachable anchors, and distinct piece usage.

Approve a useful result as:

- `MAP`: a complete authored site;
- `SUBMODULE`: frozen reusable geography intended for a later composition step.

Approval deep-copies concrete tile stacks, resolved metadata, placements, anchors, and metrics. Later changes to sockets, pieces, weights, templates, or the solver cannot alter that generated base.

Every approved asset has a rendered preview under **Terrain → Terrain Annotations**. Its Terrain polish tab stores sparse per-cell overrides for tile layers, collision, elevation, and semantic tags while retaining the generated base for individual or complete reversion. The final resolved geography updates connectivity and anchor metrics immediately.

The separate Spatial annotations tab references—but never edits—the resolved geography and can define:

- painted `PLACEMENT`, `EXCLUSION`, and `RESERVED` zones with semantic tags;
- typed point markers such as POIs, quest sites, spawn hints, or landmarks, including radius and direction;
- fixed placements that reference one concrete content-table row;
- rule placements that name an engine-owned runtime rule set.

An approved asset may have multiple interchangeable dressings. This lets one polished terrain result support different quest, encounter, or prop arrangements while retaining exactly the same final geography. Chisel owns the coordinates, terrain overrides, annotation tags, references, overlays, and validation. The engine interprets rule-set slugs, instantiates content, applies runtime eligibility rules, and owns spawned instance state.

Template stamps are intentionally separate: they force terrain pieces during WFC generation and become part of the frozen geography. Spatial placements happen after approval and never rerun or modify WFC.

## Authoring and runtime data boundary

The current terrain tables are:

- `terrain_tile_bindings`
- `terrain_sockets`
- `terrain_pieces`
- `terrain_piece_sets`
- `terrain_adjacency_overrides`
- `terrain_site_templates`
- `terrain_approved_assets`
- `terrain_spatial_layouts`

All eight remain editor-owned system tables and are excluded from ordinary generated table modules. The LÖVE exporter does, however, compile `terrain_approved_assets` and `terrain_spatial_layouts` into the resolved `gamedata/terrain.lua` runtime projection. That module contains final overpainted cells, atlas metadata, annotations, and resolved fixed-content references; it never contains raw generator grammar or sparse override documents. Other export targets do not currently emit this terrain projection.

Deleting an approved asset also deletes the spatial dressings that reference it. Deleting a tileset is refused while an authored piece or approved asset uses it; if only unused tile bindings remain, Chisel removes those bindings with the asset.

## Recommended first setup for a new tileset

1. Bind ground, foliage, rock, water, and detail sprites with stable slugs and semantic tags.
2. Define the smallest useful socket vocabulary.
3. Make several 1×1 pieces to prove continuous ground and basic transitions.
4. Add 2×1, 2×2, or larger pieces for deliberate clusters and silhouettes.
5. Analyze every piece with the cart inspector until exposed dead states are intentional.
6. Create one collection and generate a small unconstrained template.
7. Add anchors, zones, tag constraints, and required stamps only after the local grammar is healthy.
8. Review a candidate batch and freeze only geography worth keeping.
9. Select an approved map, polish any terrain cells that need manual correction, create one or more spatial dressings, then paint placement/exclusion zones and add only the markers or placements the engine needs.
