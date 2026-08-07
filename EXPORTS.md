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

The Teal target is the typed LÖVE-facing contract used by Farbound. It preserves the LÖVE module API and asset layout, but writes `.tl` modules for tables, assets, localization, input, manifests, and texture-atlas metadata. A Teal project build compiles those generated modules into Lua together with the game's authored Teal source.

Generated table modules declare a `Data` record with typed structure-of-arrays fields. References remain 1-based integer IDs with `0` reserved for `INVALID`, matching the LÖVE target. Runtime asset paths continue to resolve beneath `gamedata/assets`.

## LÖVE Export Contract

The entire LÖVE export is contained beneath `gamedata`:

```text
gamedata/
  manifest.lua
  assets.lua
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

Assets remain inside `gamedata/assets`. The generated asset module returns runtime paths that can be passed directly to LÖVE loaders:

```lua
local assets = require("gamedata.assets")
local icon = love.graphics.newImage(assets.path(assets.ID.UNIT_ICON))
```

GPPT terrain packages are unpacked beneath their asset directory as `albedo_height.png` and `normal_roughness.png`.

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
