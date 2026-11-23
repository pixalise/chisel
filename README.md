# Mrak for Zora

Mrak is an Electron desktop workspace for importing assets and authoring typed
content tables and localization. Zora is its only runtime export target. Game
settings and mutable gameplay state belong to the game.

## Development

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run build
```

Development/build copies Zora's pinned bgfx `texturec` from the sibling
`vox_engine/vcpkg_installed/<triplet>/tools/bgfx/texturec` into `resources/texturec`.
Run the engine's setup first, or set `MRAK_TEXTUREC` to that executable elsewhere.
Keep `resources/texturec` with the built application. Sharp and texture preparation
run in the existing Node worker, outside Electron's native-module ABI.

Tests run generated Lua using Lua 5.5 (`MRAK_LUA`, default `lua`). Set `MRAK_LDC`
to Zora's pinned LDC executable and `MRAK_ZORA_ROOT` to its checkout to also compile
and execute generated D definitions against the engine's content reader.

Read [AGENTS.md](AGENTS.md), [agent.md](agent.md), and [EXPORTS.md](EXPORTS.md).
Project storage retains `.chisel`; source formats are current-only.

## Workflow

1. Export static GLB models from Blender with named objects/empties and material slots.
2. Import models, fonts, images and other content; pack PBR source maps as `.zpbr`.
3. Author Materials and Model Materials rows, plus your own content tables.
4. **Commit Draft**, then **Export Zora** in Settings.
5. Use `ZoraData` in the game. Its generated definitions expose string asset IDs,
   typed table accessors and Lua completion annotations.

Blender supplies hierarchy, transforms and attachment names. The game interprets
those names and assigns behavior. Mrak owns content preparation and references.

Material Packing creates ZPBR v1 from albedo, metallic, normal, roughness and
emissive-mask PNGs. See [TEXTURE_FORMAT.md](TEXTURE_FORMAT.md).
