# Roblox Data Export

Roblox is Chisel's only runtime target. Settings → Commit Draft captures authored data; Export Roblox Data generates the latest committed source state into `ChiselData` beside `.chisel`.

## Output and installation

```text
ChiselData/
  manifest.luau
  manifest.d.ts
  assets.luau
  assets.d.ts
  localization.luau
  localization.d.ts
  types.d.ts
  tables/
    <table_id>.luau
    <table_id>.d.ts
```

Every `.luau` file is a ModuleScript. Matching `.d.ts` files describe the same immutable runtime for roblox-ts; Rojo ignores those type-only files. Preserve this hierarchy when importing into Studio. For Rojo, add this entry under your existing project's ReplicatedStorage tree, with the path relative to the Rojo project file:

```json
{
  "GameData": {
    "$path": "ChiselData"
  }
}
```

Require the manifest from a Script or LocalScript:

```luau
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local data = require(ReplicatedStorage.GameData.manifest)
local enemies = data.TABLES.enemies
local id = enemies.ID.ZOMBIE_BASIC
print(enemies.MAX_HEALTH[id], enemies.SLUGS[id])
```

Use ServerStorage instead when definitions must remain server-only. ReplicatedStorage contents are available to clients. Chisel does not modify your Rojo configuration or publish to Roblox.

The exporter validates the complete bundle before writing. It stages generated files, swaps the output folder, and restores the previous output if replacement fails. A successful export replaces the whole `ChiselData` directory, removing stale modules. Keep handwritten scripts outside that generated directory.

## TypeScript consumption

No handwritten declaration file or require cast is needed. In a conventional
roblox-ts project with `src/` → `out/`, keep the generated folder beside those
folders and map it directly to `ReplicatedStorage.GameData` as above. From
`src/server/main.server.ts` or `src/client/main.client.ts`:

```ts
import data from "../../ChiselData/manifest"

const enemies = data.TABLES.enemies
const id = enemies.ID.ZOMBIE_BASIC
const health = enemies.MAX_HEALTH[id]
assert(health !== undefined, "Missing enemy definition")
print(health, enemies.SLUGS[id])
```

The names above assume an authored enemies table with that row and column.
Import a table directly with `import enemies from "../../ChiselData/tables/enemies"`.
Use relative paths from the importing source file. roblox-ts resolves those imports
against the same explicit Rojo project used for sync; no Rompl placement rules or
additional npm package are involved. Keep the `src` and `out` roots at the same
project depth for this external-folder import layout.

Declarations expose generated table/row/asset/translation names, column types,
enum choices, native Vector2/Vector3/Color3 values, and readonly nested data.
Localization exposes known locales, typed tokens, and dot-call functions. Runtime
checks still validate numeric IDs, asset categories, translation placeholders,
and finite/integer values. Declarations are not a substitute for those checks.

**Definition IDs are 1-based.** Column data, SLUGS, asset RECORDS, translation
KEYS, and PLACEHOLDERS use a numeric `IdLookup<T>` rather than TypeScript arrays.
An ID lookup compiles directly to `values[id]`, with no index adjustment, and its
type includes `undefined` for invalid/out-of-range IDs. Check that result when
using a dynamic reference. Nested lists, Vector4 tuples, locales, and returned
localization segments are normal readonly TypeScript sequences: access their
first element with `[0]`; roblox-ts handles the Lua index adjustment there.

Export replaces runtime modules and declarations together and removes stale
pairs. The writer rejects incomplete pairs before touching the previous export.
Do not edit generated `.d.ts` files; keep handwritten adapters outside ChiselData.
Reexport after committing schema/content changes. VS Code reads the updated
declarations and Rojo syncs the matching Luau modules. Stop/restart the compiler
if necessary when a declaration change affects existing compiled consumer code.

## Tables and stable identity

Tables use structure-of-arrays data with `TABLE_ID`, `COUNT`, `ID`, `SLUGS`, and one CONSTANT_CASE array per column. Table filenames preserve the authored table ID. Row IDs are 1-based, with `ID.INVALID = 0`. References resolve to numeric row, asset, or translation IDs; array references preserve authored order. Empty optional scalar references become `0`; unresolved references fail export.

All exported definition tables, including nested arrays and JSON objects, are frozen. Keep mutable gameplay instances in consumer code. Retain source table IDs and row slugs in saved data; dense numeric IDs can change when authored order changes.

| Chisel value                      | Luau representation                    |
| --------------------------------- | -------------------------------------- |
| String, text, enum                | string                                 |
| Integer, decimal, range           | number                                 |
| Boolean                           | boolean                                |
| Vector2, Vector3                  | Roblox `Vector2`, `Vector3`            |
| Vector4                           | Frozen array of four numbers           |
| Color                             | Roblox `Color3`, authored as `#RRGGBB` |
| Enum array, JSON array/object     | Recursively frozen tables              |
| Row, asset, translation reference | Numeric ID                             |

JSON null has no lossless Luau table representation and blocks export, including nested nulls. Use explicit authored values. Column names that normalize to the same constant, names reserved by the generated table API, duplicate IDs, type mismatches, unknown columns, invalid enums, out-of-range values, missing required values, and uniqueness violations block export.

## Assets

Import source files for local previews and authoring. Each asset must have an explicitly authored **Roblox asset ID** before export. Enter the positive decimal ID in the asset editor, publish the asset separately through Roblox, and commit the updated metadata.

```luau
local assets = data.ASSETS
imageLabel.Image = assets.contentId(assets.CATEGORY.UI.HUMAN_MALE, "UI")
```

`assets.ID`, `assets.CATEGORY`, `assets.COUNT`, and `assets.RECORDS` expose immutable catalog metadata. Each record contains its stable `slug`, `category`, and `contentId` (`rbxassetid://...`). `contentId(id, category?)` checks the numeric ID and optional category.

Chisel does not export filesystem paths, copy raw source files to Roblox, upload assets, or verify cloud permissions. The experience must have permission to use each published asset, and consumers must use the appropriate Roblox property for its type. Asset IDs are stored as decimal strings to preserve precision. Source replacement preserves the authored Roblox ID; update it explicitly when publishing a new Roblox asset.

## Localization

Localization IDs flatten key paths with underscores: `HUD.WELCOME` is `localization.ID.HUD_WELCOME`.

```luau
local localization = data.LOCALIZATION
label.Text = localization.text(localization.ID.HUD_WELCOME, "en", { name = "Player" })
label.RichText = true
label.Text = localization.richText(localization.ID.HUD_WELCOME, "en", { name = "Player" })
```

`text(id, locale?, parameters?)` returns plain text. `richText(...)` escapes literal text and placeholder values and applies authored styles using Roblox RichText tags. The omitted locale selects the authored default; an explicitly unknown locale fails. Missing translations, missing placeholders, wrong placeholder types, non-finite numbers, and fractional integer placeholders fail instead of falling back.

`segments(...)` returns immutable tokens for custom rendering: text, style start/end, tooltip start/end, and icons. Icon tokens include numeric asset IDs and Roblox content IDs for ImageLabels. Style tokens include their style metadata; tooltip tokens include title/description translation IDs and an optional icon. The plain-text and RichText helpers reject inline icons; use segments for layouts containing images. Tooltip boundaries require custom UI through segments to display interactive help.

`KEYS`, `DEFAULT_LOCALE`, `LOCALES`, `STYLES`, `TOOLTIPS`, and `PLACEHOLDERS` retain the authored metadata. Colliding flattened localization constants block export.

## API references

- [Roblox assets and content IDs](https://create.roblox.com/docs/projects/assets)
- [Luau table freezing](https://luau.org/library/#table-library)
