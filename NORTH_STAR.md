# Chisel North Star

**Status:** North Star  
**Role:** Authoritative game-content, metadata, asset-library, localization, validation, and export workspace  
**Primary runtime consumer:** Godot project through generated Chisel exports  
**Simulation:** Native C++ GDExtension core  
**Terrain and presentation:** Godot, Terrain3D, Godot Forward+, native Controls, shaders, audio, animation, and scenes

## North-Star Statement

Chisel is the authoritative workspace for game concepts, data, metadata, asset identity, localization, validation, and export.

Chisel authors intent. Godot realizes presentation, spatial composition, rendering, input, camera, and native UI. The native C++ core simulates authoritative runtime state.

A developer or designer opening Chisel should be able to answer:

- What game concepts exist?
- How do those concepts reference each other?
- Which assets belong to each concept?
- Which translations are required?
- What will break if a field or record is removed?
- What will Godot receive on the next export?
- Is the current content valid and ready to export?

Chisel is not only a table editor. It is the content operating system for the game.

## Product Definition

Chisel is a desktop authoring application responsible for:

- typed collections and schemas
- game data and metadata
- stable slugs and canonical names
- asset-library management
- image and GPPT processing
- cross-table references
- localization
- validation
- impact analysis
- Godot-native export
- re-export workflow

Chisel should feel like a combination of:

- database editor
- asset browser
- schema editor
- localization workspace
- validation console
- content compiler
- Godot companion tool

Chisel is not intended to replace:

- Godot's 3D editor
- Blender or another DCC application
- Terrain3D
- Godot's renderer
- Godot's AnimationTree editor
- the native simulation core

## Ecosystem Architecture

```text
                         CHISEL
     +--------------------------------------------+
     | Collections, schemas and metadata          |
     | Asset library                              |
     | GPPT packing                               |
     | Localization                               |
     | Validation and re-export workflow          |
     +--------------------+-----------------------+
                          |
                          | validation-gated export
                          | generated Godot data
                          v
                  GODOT PROJECT DATABASE
     +--------------------------------------------+
     | generated types/*.gd                       |
     | generated collections/*.gd                 |
     | localization/*.csv or *.po                 |
     | images, GPPT, GLB, audio and video         |
     | manifests                                  |
     +--------------+-----------------------------+
                    |
          +---------+------------------+
          v                            v
      GODOT PROJECT              C++ SIMULATION CORE
      scenes and rendering       horde simulation
      Terrain3D generation       squad simulation
      native UI Controls         pathfinding and flow fields
      AnimationTree              AI and combat
      shaders, audio and VFX     dynamic occupancy
      input and camera           fixed-step state
```

The separation is intentional:

- Chisel owns authored definitions.
- Godot owns final presentation and spatial authoring.
- The C++ core owns runtime simulation state and rules.

## Authority Model

### Chisel Owns

Chisel is authoritative for:

- collection schemas
- collection rows
- stable row slugs
- canonical names
- game-data fields
- descriptions and metadata
- cross-table references
- asset-library records
- asset tags and import intent
- translations
- validation rules
- export manifests

### Godot Owns

Godot is authoritative for:

- final 3D scene composition
- Terrain3D generation and rendering
- terrain stamp scene composition
- resource-node scene composition
- building sockets and spatial markers
- AnimationTree and blend graphs
- Godot shaders and materials
- lighting and post-processing
- VFX and particles
- audio routing
- camera and input
- runtime UI implementation

Chisel may reference these through stable assets and declared contracts, but should not attempt to own their internal Godot node graphs.

### The C++ Simulation Owns

The simulation core is authoritative for:

- entity handles
- positions and velocities
- horde state
- squad state
- AI state
- pathfinding
- flow fields
- dynamic occupancy
- combat and health
- commands and events
- fixed-step runtime state

Chisel authors initialization definitions. It does not become a runtime database queried by every simulated entity.

## One Source of Truth

The content pipeline is:

```text
Chisel source project
    -> validated generated export
    -> generated Godot database and assets
    -> compact runtime records and presentation objects
```

Generated Godot files are projections of Chisel data.

They are not manually edited.

Godot-authored scenes remain authoritative for spatial and presentation-heavy content, while Chisel references those scenes by stable asset identity.

The governing rule is:

```text
Chisel owns definitions.
Godot owns presentation realization.
C++ owns runtime state.
```

## Chisel Project Model

A Chisel project should conceptually contain:

```text
.chisel/
  project.json
  schemas/
  collections/
  assets/
  localization/
  exports/
  cache/
```

Every project should define:

- project stable ID
- project schema version
- content version
- target Godot version
- active locales
- asset roots
- export root
- enabled export profiles

## Typed Collections

Collections are Chisel's central data model.

Examples include:

- Enemies
- Units
- Buildings
- Blueprints
- Waves
- Resources
- Translations
- Assets

Every collection has:

- stable collection ID
- canonical collection name
- schema version
- column definitions
- row records
- indexes
- validation constraints
- export policy

## Stable Row Identity

Every row must have a required `slug`.

The slug is the public, stable row identity. It is used for references, generated enum IDs, export manifests, and readable Godot APIs.

Slugs must always be `UPPER_SNAKE_CASE`.

Valid examples:

```text
ZOMBIE_BASIC
BARRACKS
FLETCHING_BULLETS
TUNDRA
```

Invalid examples:

```text
zombie_basic
ZombieBasic
zombie-basic
ZOMBIE BASIC
ZOMBIE__BASIC
_ZOMBIE_BASIC
ZOMBIE_BASIC_
```

Slug rules:

- required on every row
- unique within the collection
- uppercase ASCII letters, digits, and single underscores only
- must start with an uppercase letter
- no leading underscore
- no trailing underscore
- no consecutive underscores
- row order must never be considered stable identity

There is no user-authored generic `id` column. Nanoid values may exist only as private implementation details for UI state or internal persistence. They are not content identity and must not be exported as public game identifiers.

Conceptual row shape:

```text
row:
  slug: ZOMBIE_BASIC
  values:
    max_health: 100
    move_speed: 1.6
```

Generated Godot enum IDs should be derived from slugs:

```gdscript
Enemies.Id.ZOMBIE_BASIC
Buildings.Id.BARRACKS
Blueprints.Id.FLETCHING_BULLETS
```

These generated enum values may be dense local indexes. They must not be stored directly in long-lived saves or external protocols unless tied to the exact generated export they came from.

Persistent references should use slugs, stable hashes, or other stable IDs.

## Structure-of-Arrays Export

Collections should export modules where row slugs become enum keys with integer indexes and field payloads are stored in per-column arrays.

Example:

```gdscript
class_name Enemies
extends RefCounted

enum Id {
    ZOMBIE_BASIC = 0,
    ZOMBIE_RUNNER = 1,
    ZOMBIE_TANK = 2,
}

const SLUGS := [
    "ZOMBIE_BASIC",
    "ZOMBIE_RUNNER",
    "ZOMBIE_TANK",
]

const MAX_HEALTH := [100, 80, 300]
const MOVE_SPEED := [1.6, 2.2, 0.8]
```

Usage:

```gdscript
var enemy := Enemies.Id.ZOMBIE_BASIC
var hp := Enemies.MAX_HEALTH[enemy]
```

Chisel may additionally generate typed record views for editor convenience.

## Typed References

References should be typed rather than represented as arbitrary strings.

Examples:

- `Buildings.model -> Models.Id`
- `Buildings.icon -> Images.Id`
- `Localized text -> Translations.HUD.UNIT_TEXT`

Chisel must validate:

- missing targets
- wrong target collection
- removed targets
- forbidden cycles
- unresolved assets
- type mismatches

The editor should present references as searchable selectors while keeping slugs visible.

## Asset Library

Chisel is the authoritative asset library.

It owns asset identity and intent, not every engine-specific representation.

Each asset record should contain:

- stable asset ID or slug
- canonical name
- kind
- source path
- export path
- content hash
- import policy
- tags
- dependencies
- preview or thumbnail
- platform policy
- validation state
- usage references

Supported categories include:

- images
- GPPT images
- 3D models
- audio
- video
- fonts
- Godot scenes
- Godot resources
- impostor atlases

Game data should reference asset IDs or asset slugs. Raw paths should be resolved by the generated asset database.

## GPPT

GPPT is the project's image and texture-package format.

Chisel owns:

- source images
- channel packing
- layer definitions
- mip metadata
- color-space metadata
- usage type
- compression profile
- stable ID
- content hash
- preview thumbnail

GPPT may be used for:

- terrain texture packs
- material packs
- impostor atlases
- packed masks
- generated control textures

Chisel should provide:

- RGBA inspection
- individual channel inspection
- layer inspection
- normal and roughness preview
- height and mask preview
- content-hash comparison
- packing validation

Godot consumes GPPT through generated export files and project-side loaders/importers.

## 3D Assets

Chisel is authoritative for 3D asset-library records.

Godot remains authoritative for final engine import and scene composition.

Recommended interchange:

- GLB/glTF for portable 3D models
- GPPT for project-specific texture packages
- Godot scenes for final spatial composition

A 3D record may define:

- model stable ID or slug
- GLB path
- skeleton profile
- LOD policy
- collision policy
- required sockets
- required nodes
- material packs
- thumbnail
- usage tags

Required sockets might include:

- `socket_muzzle`
- `socket_rally_point`
- `socket_harvest_a`
- `bounds_selection`
- `bounds_placement`

Chisel validates declared metadata. Godot validates the imported result.

Chisel must not become:

- a mesh editor
- a skin-weight editor
- an animation blend-tree editor
- a replacement for Blender

## Second Game Phase

The following systems are intentionally out of scope for the current game phase and should be revisited for the second game:

- terrain data and gameplay classifications
- biome, terrain material, terrain type, movement profile, and placement-rule collections
- dense movement-profile x terrain-type lookup exports
- animation intent and presentation metadata
- animation clips, animation sets, animation controllers, and presentation profiles
- semantic animation slots and controller-contract validation
- Chisel-authored UI component DSL
- UI slots, preview data plugs, declarative UI actions, and component nesting
- theme tokens, classes, variants, and visual theme editing

For this game phase, Godot owns terrain generation, animation playback, presentation assembly, and runtime UI implementation.

## Localization

Chisel owns translation keys and locale values.

Each translation record contains:

- translation key
- namespace
- source text
- localized strings
- description
- context
- translator notes
- placeholder schema
- length constraints
- status per locale

Example:

```text
Translations.HUD.UNIT_TEXT
```

Chisel validates:

- translation key exists
- all required arguments are supplied
- argument types match
- all locales use declared placeholders
- no unknown placeholders exist
- localized-key arguments resolve
- data bindings reference valid fields

Chisel exports Godot-compatible localization resources and generated key constants.

Godot uses its native localization system at runtime.

## Validation

Validation is one of Chisel's primary product features.

Syntax validation:

- JSON syntax
- schema syntax
- translation syntax

Schema validation:

- required fields
- allowed fields
- field types
- enum domains
- numeric ranges
- collection constraints
- slug shape
- slug uniqueness

Reference validation:

- cross-table references
- asset references
- translation keys
- Godot scene references

Semantic validation:

- building costs reference valid resources
- translation placeholders match declared schemas
- asset kind matches usage

Compatibility validation:

- Godot project requirements
- removed fields still required
- generated API compatibility

An export must be blocked while blocking errors remain.

## Removal and Impact Analysis

Chisel should report direct impact before rows, fields, assets, translation keys, or Godot scene references are removed.

Hard deletion is blocked while references remain.

Chisel should provide:

- impact analysis
- replacement target selection where useful
- automatic binding rewrite where simple and safe
- export validation after removal

There is no migration model. A rename is handled as an edit plus validation of affected references, not as a long-lived migration record.

## Godot Requirements Contract

The Godot project may provide a machine-readable requirements file.

It may declare:

- required collections
- required fields
- required translation keys
- required asset kinds

This lets Chisel detect dependencies that exist in handwritten Godot code and would not otherwise appear in Chisel's reference graph.

An export must satisfy both Chisel references and Godot consumer requirements.

## Godot Export

Chisel exports a Godot-shaped `game_data` folder beside `.chisel`.

Example:

```text
res://game_data/
  manifest.gd

  tables/
    enemies.gd
    buildings.gd
    blueprints.gd
    translations.gd

  localization/
    ui.csv
    units.csv
    buildings.csv

  assets/
    images/
    gppt/
    models/
    audio/
    videos/
    fonts/
```

Each collection is exported as one generated table module.

Generated files should contain:

- generated-by marker
- source project ID
- schema version
- content version
- generated timestamp
- generated file list

They are read-only projections.

## Re-Export Workflow

Godot consumes generated exports, not live Chisel source files.

Chisel source content can be edited and saved freely, but it does not affect Godot until export runs.

The export workflow is:

```text
1. Edit Chisel source content.
2. Run validation.
3. If validation passes, write generated Godot files and manifest into `game_data`.
4. Godot reloads the generated data.
```

Each export should include:

- source project ID
- content version
- generated file list
- content hashes
- timestamp

Re-export replaces generated files from the current Chisel source state.

## Simulation Boundary

The native C++ GDExtension core owns:

- horde simulation
- squad simulation
- AI
- pathfinding
- flow fields
- local separation
- combat
- dynamic occupancy
- fixed timestep
- commands and events

Chisel supplies initialization definitions.

Godot supplies terrain, presentation, runtime UI, and gameplay placements for this phase.

The simulation outputs factual observations:

- position
- facing
- movement state
- action state
- health
- state revision
- spawn events
- attack events
- death events

Godot maps those observations into presentation, sound, VFX, selection, and runtime UI.

Animation clips, shaders, UI state, and highlight colors do not belong in the simulation core.

## Performance Principles

Chisel content should compile into efficient runtime forms.

- Resolve slugs and stable IDs to dense indexes at load time.
- Do not use string lookups in simulation loops.
- Do not parse Chisel tables per entity per frame.
- Cache exported definitions when actors are created.
- Load heavy assets lazily.
- Transfer simulation observations in batches.
- Keep exported content immutable during a match unless a field is explicitly hot-reloadable.

Editor-facing data can remain rich and descriptive.

Runtime data should be compact and pre-resolved.

## Core Workflow

The intended workflow is:

```text
1. Open Chisel.
2. Browse collections and assets.
3. Edit typed game data.
4. Add translations and validate placeholders.
5. Pack or inspect GPPT assets.
6. Review reference impact and validation problems.
7. Export or re-export.
8. Godot reloads generated data.
9. Inspect exact native previews or run the game.
```

The Problems panel must clearly answer:

- what is broken
- where it is referenced
- why it is invalid
- what replacement is recommended
- whether export is blocked

## Non-Goals

Chisel should not become:

- a complete 3D scene editor
- a terrain renderer
- a game runtime
- a simulation engine
- a physics engine
- an AnimationTree editor
- a mesh-authoring application
- a general code IDE
- an arbitrary HTML/CSS runtime
- a database server required by the shipped game

The shipped game must never require Chisel to be running.

## Delivery Milestones

### M1 - Committed/Draft and Rollback

- committed and draft source states
- rollback to prior committed source states
- export only from an explicit committed state

### M2 - Typed References and Impact Analysis

- typed table references
- typed asset references
- removal impact analysis
- replacement target selection
- blocking reference errors

### M3 - Asset Library

- images
- GPPT
- models
- audio
- video
- fonts
- hashing
- previews
- tags
- dependencies
- usage references

### M4 - Godot Export and Re-Export

- one file per table
- typed enums
- enum-indexed Structure-of-Arrays exports
- generated loader helpers
- manifest
- content hashes
- generated file list
- generated output replacement

### M5 - Localization

- translation workspace
- placeholder validation
- locale preview
- Godot localization export

## Acceptance Criteria

Chisel fulfills its north star when:

- A designer can define game concepts without editing generated Godot files.
- Every concept and asset has stable identity.
- Every row has a required `UPPER_SNAKE_CASE` slug.
- Removing a field or row shows its impact before export.
- Godot receives typed table APIs with enum-style access.
- Translations with typed placeholders are validated before reaching Godot.
- GPPT, images, models, video, and audio are managed through one asset library.
- 3D assets are referenced and validated in Chisel while final spatial composition remains in Godot.
- Godot consumes generated exports, not Chisel source files.
- The C++ simulation receives compact resolved data rather than editor objects.
- The shipped game runs without Chisel.

## Final Product Identity

Chisel is the place where the project defines what its content is.

```text
Chisel:
  identity
  intent
  data
  metadata
  assets
  localization
  validation
  export

Godot:
  spatial composition
  presentation
  rendering
  interaction
  runtime UI

C++ simulation:
  authoritative runtime behavior
  AI
  pathfinding
  horde and RTS state
```

Everything authored in Chisel should become safer, more discoverable, more reusable, more strongly typed, and easier to validate in Godot without forcing Chisel to become Godot or forcing Godot to become a database editor.
