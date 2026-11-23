# Zora export

Settings → Commit Draft → Export Zora writes `ZoraData` beside `.chisel`.
Zora is the only target. The generated folder is replaced as a complete staged
bundle; a failed preparation/write preserves the previous export. Keep handwritten
code outside it.

```text
ZoraData/
  catalog.json
  d/zora_content/definitions.d
  lua/content.lua
  lua/definitions.meta.lua
  assets/<SLUG>.<extension>
  assets/<PBR_SLUG>_T1.ktx
  assets/<PBR_SLUG>_T2.ktx
```

## Identity and generated access

Slugs and asset/row/translation references stay strings. They never become array
indices or numeric IDs. Asset constants are grouped by category (`Assets.Models`,
`Assets.PbrTextures`, `Assets.Fonts`, etc.). Table names become PascalCase and
column names camelCase; constants retain UPPER_SNAKE_CASE. Naming collisions,
reserved identifiers and broken references block export.

```d
import zora_content.definitions : Assets, Tables;
auto model = AssetManager.loadModel(Assets.Models.FRIGATE);
auto definition = Tables.Units.FRIGATE;
auto ship = model.instantiate("Escort");
auto muzzle = ship.node("Muzzle");
```

Add `ZoraData/d` to D imports and load its catalog through AssetManager before
loading a scene. Generated D contains types/identifiers, not baked row values.
Accessors load/cache immutable rows from the catalog, with `get(slug)` and `all`
for lookup/enumeration. Values can change without recompiling the game; adding or
renaming D-visible members/changing column types requires regenerating and rebuilding.
AssetManager's GPU cache belongs to the active scene. Model instances share meshes
and textures but have independent mutable material values. Game code must not
release borrowed cached assets.

Each scene executes generated `lua/content.lua` in its Lua 5.5 VM. It defines
`Assets`, `Tables`, `Localization` and `Content`. Definitions use recursively
read-only proxies for trusted scripts; this is not a security sandbox. Lua `pairs`
iterates rows. JSON null and explicit absent optional cells use `Content.NULL`,
preserving nulls inside arrays. D uses Nullable for optional typed fields and
JSONValue for JSON columns. Omitted cells take their authored column default;
explicit null remains distinct. Arrays, vectors, false/zero and Unicode are retained.
Colors are authored `#RRGGBB` strings; vectors are numeric arrays. References keep
their target slug/key. `Localization.Keys` exposes translation key strings, while
localization data retains locales, placeholders, styles, tooltip/icon references
and authored text. Rendering that markup is owned by the game's UI integration.

## Models and materials

The initial model target is static, self-contained GLB. Blender names, parenting,
transforms, empty attachment nodes and material slot names are preserved. Zora's
existing static model restrictions apply; animations and arbitrary Blender shader
graph conversion are separate features. Required attachment names must be unique
within the instance; missing/ambiguous lookups fail. Cache resolved nodes in game code.

The Materials system table defines PBR textures and factors. Base color factors
and glow tint are linear RGB; glow may exceed 1. Model Materials binds a model
asset and exact Blender slot name to a material row. All tables and authored values
are exported, including user tables. Game settings/key bindings remain game-owned.

## Prepared textures and assets

ZPBR remains the PNG-based authoring format. Export creates two full BC7 KTX1 mip
chains. T1 albedo is filtered in linear light and sampled as sRGB; metallic alpha
stays linear. T2 reconstructs/normalizes normal XY in R/B; roughness G and emissive
mask A are linear. Neither map is alpha-premultiplied. Normal reconstruction keeps
positive tangent-space Z. No opacity, height or AO channel is introduced.

Each mip is edge-padded to complete 4x4 blocks before compression, then stored with
its logical dimensions in the final chain. This avoids texturec's generic mip
filter and its failing tiny-mip reverse-conversion path. Validation covers the
exported chain and the actual Zora upload/render path. This desktop profile requires
BC7 support; it never silently expands to uncompressed RGBA. Other profiles remain
separate work. At 256x256, the pair's full mip payload is 174,816 bytes, excluding
container/GPU allocation overhead. Source HDR/environment preparation is unchanged.

Other asset categories are copied into the catalog/package. Cataloging an audio or
shader asset does not implement engine playback or custom shader APIs.

Commits (source-state schema 4) record SHA-256 fingerprints of managed asset bytes.
Export verifies the exact bytes it prepares/copies. Source changes require another
commit. Rollback restores authored data/metadata, not old binary asset contents;
matching source bytes must still exist to export that commit. This is not a binary
asset versioning system. No compatibility export or automatic old-schema migration
is retained.
