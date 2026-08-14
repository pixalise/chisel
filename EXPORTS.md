# Chisel Runtime Exports

Chisel exports only the latest committed source state. Every target runs table, reference, asset, and localization validation before replacing generated output.

## Targets

| Target     | Manifest                            | Generated root                        |
| ---------- | ----------------------------------- | ------------------------------------- |
| Godot      | `game_data/manifest.gd`             | `game_data`                           |
| HaxeFlixel | `source/gamedata/ChiselManifest.hx` | `source/gamedata` and `assets/chisel` |
| LÖVE       | `gamedata/manifest.lua`             | `gamedata`                            |
| Teal       | `gamedata/manifest.tl`              | `gamedata`                            |

## Teal Export Contract

The Teal target is an optional typed LÖVE-facing contract. It preserves the LÖVE module API and asset layout, but writes `.tl` modules for tables, assets, localization, input, and manifests. A Teal project build compiles those generated modules into Lua together with the consumer's authored Teal source. FARBOUND uses the ordinary LÖVE/Lua target because its authored runtime is YueScript compiled to Lua.

Generated table modules declare a `Data` record with typed structure-of-arrays fields. References remain 1-based integer IDs with `0` reserved for `INVALID`, matching the LÖVE target. Runtime asset paths continue to resolve beneath `gamedata/assets`.

## LÖVE Export Contract

The entire LÖVE export is contained beneath `gamedata`:

```text
gamedata/
  manifest.lua
  asset_manager.lua
  localization.lua
  input.lua                 # Present when the input_bindings system table exists.

  tables/
    <normalized_table_id>.lua

  assets/
    <category>/
      <normalized_asset_name>.<extension>
```

Re-export deletes and rebuilds the complete `gamedata` directory. It is generated-only and must not contain handwritten game code.

Table modules use Lua's native 1-based indexing. Every module exposes `ID.INVALID = 0`, stable row constants starting at `1`, `SLUGS`, and one dense array per column:

```lua
local enemies = require("gamedata.tables.enemies")

local enemyId = enemies.ID.ZOMBIE_BASIC
local health = enemies.MAX_HEALTH[enemyId]
```

Table, asset, and translation references are exported as their target's numeric ID. Empty optional references become `0`; unresolved non-empty references block export.

Assets remain inside `gamedata/assets`. Chisel generates a standalone, lazy-loading asset manager with category-scoped stable IDs:

```lua
local AssetManager = require("gamedata.asset_manager")
local portrait = AssetManager.image(AssetManager.UI.HUMAN_MALE)
local font = AssetManager.font(AssetManager.FONT.BODY, 18, 1)
```

The manager validates each loader against the authored category and caches resources only after first use. It supports managed images, linear data images, fonts, shaders, audio sources, text data, validated paths, cache cleanup, and category namespaces such as `UI`, `IMAGE`, `FONT`, `SHADER`, and `AUDIO`. `AssetManager.destroy()` releases every loaded LÖVE resource.

`UI` is the interface-image category and stores files in `.chisel/assets/UI`. Project data must already use the current category and layout. Replacing an asset source preserves its stable slug, so game code continues using the same generated ID without path changes.

## LÖVE Input Adapter

When the `input_bindings` system table exists, Chisel generates `gamedata/input.lua`. It provides:

- `actionName(action)`
- `getActionStrength(action)`
- `isActionPressed(action)`
- `isActionJustPressed(action)`
- `isActionJustReleased(action)`
- LÖVE callback capture functions
- `endFrame()` for clearing one-frame input state

The game owns the LÖVE callbacks and explicitly forwards them:

```lua
local input = require("gamedata.input")

function love.keypressed(key, scanCode, isRepeat)
	input.keypressed(key, scanCode, isRepeat)
end

function love.keyreleased(key, scanCode)
	input.keyreleased(key, scanCode)
end

function love.mousepressed(x, y, button, isTouch, presses)
	input.mousepressed(x, y, button, isTouch, presses)
end

function love.mousereleased(x, y, button, isTouch, presses)
	input.mousereleased(x, y, button, isTouch, presses)
end

function love.wheelmoved(deltaX, deltaY)
	input.wheelmoved(deltaX, deltaY)
end
```

Call `input.endFrame()` once after all gameplay input consumers have run for the frame. The adapter does not replace callbacks or install global state itself.

## FARBOUND Content Contract

FARBOUND uses Chisel as the authority for immutable card, host-family, equipment, inventory-item, encounter, event, narrative, localization, and asset definitions. Chisel does not own installed upgrades, carried item instances, enabled decks, hands, encounter state, or other mutable gameplay state.

The universal card framework deliberately exports distinct definition families:

- Upgrade cards install into compatible hosts and never enter the combat hand.
- Combat cards are reusable actions and are the only cards shuffled, drawn, and played.
- Equipment-native and upgrade-granted combat actions use explicit reference records rather than fixed `card_1`, `card_2`, and `card_3` columns.
- Consumables remain physical item definitions and never count toward deck size.
- Knowledge, evidence, magic, reputation, relationships, contracts, and law remain contextual requirements unless a definition explicitly grants a combat action.

Every exported definition uses a stable slug. References resolve to dense generated indexes for runtime use, while saves and external protocols retain stable identities. Generated numeric IDs must not become durable content identity.

See `FARBOUND_INTEGRATION.md` for the proposed table families, validation contract, source-tracing boundary, and migration from the current placeholder `cards` and `items` tables.
