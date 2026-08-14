# Chisel

Chisel is a project-data editor and generation-authoring workspace. Detailed integration, export, and WFC sample documentation lives in [FARBOUND_INTEGRATION.md](./FARBOUND_INTEGRATION.md), [EXPORTS.md](./EXPORTS.md), and [TILED_WFC_SAMPLES.md](./TILED_WFC_SAMPLES.md).

## Tiled export note

For WFC sample boards, the only supported Tiled source pair is:

- **Tiled tileset files** with the `.tsx` extension;
- **Tiled map files** with the `.tmx` extension.

Save tilesets externally so the map references the `.tsx` file, and keep the map, tileset, and referenced PNG spritesheets accessible relative to one another during import.

Choose **Tiled map files** and save the map with a `.tmx` extension. In the tileset editor, choose **Tiled tileset files** and save each external tileset with a `.tsx` extension. Chisel rejects JSON `.tmj`/`.tsj`, missing or misleading extensions, and non-XML content. Imported source remains native XML in Chisel's managed project structure.

Do not use CSV, GameMaker, JavaScript, or Lua exports for Chisel. CSV loses the complete map and tileset structure, while code-oriented exports add an unnecessary language representation. See [TILED_WFC_SAMPLES.md](./TILED_WFC_SAMPLES.md) for the supported Tiled feature subset and enrichment workflow.

Chisel project formats are current-only. When a schema or managed layout changes, every checked-in project is rewritten in the same change; Chisel does not carry runtime migration or legacy-compatibility code.
