# Chisel North Star

**Status:** North Star  
**Role:** Authoritative game-content, metadata, asset-library, UI, localization, validation, and export workspace  
**Primary runtime consumer:** Godot project through generated Chisel exports  
**Simulation:** Native C++ GDExtension core  
**Terrain and presentation:** Godot, Terrain3D, Godot Forward+, native Controls, shaders, audio, animation, and scenes

## North-Star Statement

Chisel is the authoritative workspace for game concepts, data, metadata, asset identity, localization, data-driven UI, themes, validation, and export.

Chisel authors intent. Godot realizes presentation, spatial composition, rendering, input, camera, and native UI. The native C++ core simulates authoritative runtime state.

A developer or designer opening Chisel should be able to answer:

- What game concepts exist?
- How do those concepts reference each other?
- Which assets belong to each concept?
- Which UI components present those concepts?
- Which translations are required?
- Which animation, presentation, terrain, and audio profiles are assigned?
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
- animation metadata
- UI component authoring
- theme authoring
- localization
- validation
- impact analysis
- Godot-native export
- re-export workflow

Chisel should feel like a combination of:

- database editor
- asset browser
- schema editor
- UI component workbench
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
     | UI components and themes                   |
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
     | UI components/*.gui.json                   |
     | themes/*.theme.json                        |
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
- movement profiles
- terrain movement rules
- animation semantic slots
- animation clip references
- presentation profile references
- UI components
- UI bindings
- UI actions
- UI theme tokens and classes
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
- native UI node construction

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
  ui/
  themes/
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
- Biomes
- TerrainMaterials
- TerrainTypes
- MovementProfiles
- AnimationClips
- AnimationSets
- AnimationControllers
- PresentationProfiles
- HighlightStyles
- UIActions
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
    animation_set: ZOMBIE_BASIC
```

Generated Godot enum IDs should be derived from slugs:

```gdscript
Enemies.Id.ZOMBIE_BASIC
Buildings.Id.BARRACKS
Blueprints.Id.FLETCHING_BULLETS
Biomes.Id.TUNDRA
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
const ANIMATION_SET := [
    AnimationSets.Id.ZOMBIE_BASIC,
    AnimationSets.Id.ZOMBIE_RUNNER,
    AnimationSets.Id.ZOMBIE_TANK,
]
```

Usage:

```gdscript
var enemy := Enemies.Id.ZOMBIE_BASIC
var hp := Enemies.MAX_HEALTH[enemy]
```

Chisel may additionally generate typed record views for UI and editor convenience.

## Typed References

References should be typed rather than represented as arbitrary strings.

Examples:

- `Enemies.animation_set -> AnimationSets.Id`
- `Buildings.model -> Models.Id`
- `Buildings.icon -> Images.Id`
- `Biomes.terrain_materials -> Array<TerrainMaterials.Id>`
- `AnimationSets.run -> AnimationClips.Id`
- `UI building prop -> Buildings.Id`
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
- animations
- audio
- video
- fonts
- Godot scenes
- Godot resources
- UI icons
- terrain materials
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
- animation atlases
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

- GLB/glTF for portable 3D models and animation
- GPPT for project-specific texture packages
- Godot scenes for final spatial composition

A 3D record may define:

- model stable ID or slug
- GLB path
- skeleton profile
- animation clips
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

## Animation Metadata

Chisel owns animation intent and semantic clip references.

Godot owns actual animation blending and playback.

Recommended collections:

- Models
- AnimationClips
- AnimationSets
- AnimationControllers
- PresentationProfiles

Example enemy definition:

```text
Enemies.ZOMBIE_BASIC
  model = Models.ZOMBIE_BASIC
  animation_set = AnimationSets.ZOMBIE_BASIC
  animation_controller = AnimationControllers.ZOMBIE_BIPED
```

Animation clip metadata may include:

- source model
- GLB animation name
- loop flag
- playback speed
- root-motion policy
- semantic tags
- baked or impostor equivalents

Animation controller metadata may include:

- Godot controller scene
- required semantic slots
- supported locomotion dimensions
- supported action dimensions

Chisel validates that animation sets satisfy their controller contracts.

The C++ simulation exports only simulation facts:

- stationary
- moving
- attacking
- dying
- dead
- movement speed
- state revision

Godot maps those facts to animation semantics and drives AnimationTree.

## Data-Driven UI

Chisel should be the main authoring environment for data-driven UI components and fragments.

The source format is a constrained UI intermediate representation:

```text
*.gui.json
```

It is not arbitrary HTML or CSS.

Godot converts the UI IR into real native `Control` nodes.

Initial primitives:

- Panel
- Margin
- Row
- Column
- Grid
- Scroll
- Label
- Title
- RichText
- Image
- Button
- ProgressBar
- Separator
- Tabs
- List
- Conditional
- ForEach
- Slot
- Component

Components support:

- typed props
- subcomponents
- children
- slots
- variants
- bindings
- actions
- conditions
- loops
- theme classes

Chisel must detect recursive component dependency loops.

The UI editor should provide:

- component tree
- schema-aware JSON editor
- local preview
- problems panel
- binding inspector
- props inspector
- theme inspector
- preview-data selector
- generated Godot representation

The local preview may use Chisel's web technology, but must only implement UI behavior supported by the project UI schema.

Godot is the final representation truth.

## UI Actions

Chisel UI must not execute arbitrary runtime code.

UI components emit declarative typed actions:

```json
{
  "action": "building.build",
  "args": {
    "building": "Buildings.BARRACKS"
  }
}
```

Actions should be schema-defined:

```text
building.build(building: Buildings.Id)
unit.select(unit: Units.Id)
blueprint.unlock(blueprint: Blueprints.Id)
```

Chisel validates argument names and types.

The preferred routing hierarchy is:

- component
- screen or panel controller
- feature controller
- optional global action bus

## Themes

Themes are first-class content.

Theme definitions include:

- tokens
- classes
- variants
- inheritance
- fonts
- colors
- spacing
- radii
- panel styles
- button styles
- typography
- state styles

Example tokens:

```text
space.xs
space.sm
space.md
color.panel
color.text
color.health
radius.md
font.body
font.title_size
```

Components use semantic classes:

```text
card
unit-card
unit-card.selected
health-progress
warning
danger
```

Chisel should support both schema-aware theme JSON and a visual theme editor.

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
- theme syntax
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
- UI components
- theme classes
- translation keys
- action IDs
- animation slots
- Godot scene references

Semantic validation:

- movement profiles cover every terrain type
- animation controllers have required slots
- building costs reference valid resources
- biomes reference valid terrain materials
- translation placeholders match UI bindings
- asset kind matches usage

Compatibility validation:

- Godot project requirements
- removed fields still required
- generated API compatibility

An export must be blocked while blocking errors remain.

## Removal and Impact Analysis

Chisel should report direct impact before rows, fields, assets, actions, translation keys, UI components, props, or themes are removed.

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
- required actions
- required UI components
- required translation keys
- required asset kinds
- required animation slots

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
    biomes.gd
    animation_sets.gd
    translations.gd

  ui/
    components/
    themes/
    preview_data/
    generated/

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

## Terrain and Terrain3D

Godot and Terrain3D own terrain generation and rendering.

Chisel owns terrain presets and gameplay classifications.

Relevant collections include:

- Biomes
- TerrainGenerationPresets
- TerrainMaterials
- TerrainTypes
- MovementProfiles
- PlacementRules

Godot uses Chisel definitions to generate:

- Terrain3D heightmap
- ground depressions
- water masks
- texture control maps
- decorative placement
- categorical navigation mask

For the initial zombie survival RTS, navigation terrain may consist of:

- Ground
- Road
- Mud
- ShallowWater
- Blocked

Chisel defines movement profiles:

- Human
- Zombie
- Vehicle

and produces a dense lookup table:

```text
movement profile x terrain type
  blocked
  path cost
  speed scale
```

The C++ simulation performs direct indexed lookups rather than interpreting a large runtime configuration.

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

Godot supplies generated terrain masks and gameplay placements.

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

Godot maps those observations through Chisel-authored presentation profiles into:

- AnimationTree states
- sounds
- VFX
- selection highlights
- health bars
- unit cards

Animation clips, shaders, UI state, and highlight colors do not belong in the simulation core.

## Performance Principles

Chisel content should compile into efficient runtime forms.

- Resolve slugs and stable IDs to dense indexes at load time.
- Do not use string lookups in simulation loops.
- Do not parse Chisel tables per entity per frame.
- Compile movement rules into dense arrays.
- Compile UI bindings into validated expressions or generated code.
- Cache presentation definitions when actors are created.
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
4. Create or edit UI components.
5. Preview UI with selected data records.
6. Edit theme tokens and variants.
7. Add translations and validate placeholders.
8. Pack or inspect GPPT assets.
9. Review reference impact and validation problems.
10. Export or re-export.
11. Godot reloads generated data.
12. Inspect exact native previews or run the game.
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

### M0 - Collections and Godot Export

- typed schemas
- required `UPPER_SNAKE_CASE` row slugs
- collection editor
- reference fields
- basic validation
- Godot export skeleton
- export manifest
- `game_data` output folder

### M1 - Asset Library

- images
- GPPT
- models
- audio
- video
- hashing
- previews
- tags
- dependencies

### M2 - Godot Database Export

- one file per table
- typed enums
- enum-indexed Structure-of-Arrays exports
- generated loader helpers
- manifest

### M3 - Validation

- impact analysis
- reference validation
- Godot requirements
- blocking export errors

### M4 - UI Workbench

- UI schema
- schema-aware JSON editor
- component tree
- local preview
- props
- slots
- ForEach
- Conditional
- typed actions

### M5 - Themes and Localization

- theme token editor
- classes and variants
- translation workspace
- placeholder validation
- locale preview
- Godot localization export

### M6 - Re-Export Workflow

- content hash
- schema version
- re-export button
- Godot reload support
- generated output replacement

### M7 - Advanced Assets

- GPPT channel inspection
- GLB metadata validation
- animation clip extraction
- animation-controller validation
- LOD and impostor metadata

## Acceptance Criteria

Chisel fulfills its north star when:

- A designer can define game concepts without editing generated Godot files.
- Every concept and asset has stable identity.
- Every row has a required `UPPER_SNAKE_CASE` slug.
- Removing a field or row shows its impact before export.
- Godot receives typed table APIs with enum-style access.
- UI components can be authored and previewed in Chisel and rendered as native Godot Controls.
- Themes can be visually edited and previewed.
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
  UI
  themes
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
