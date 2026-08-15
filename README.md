# Chisel

Chisel is a project-data editor and generation-authoring workspace. Detailed integration, export, and WFC sample documentation lives in [FARBOUND_INTEGRATION.md](./FARBOUND_INTEGRATION.md), [EXPORTS.md](./EXPORTS.md), and [WFC_SAMPLES.md](./WFC_SAMPLES.md).

## Native terrain authoring

Terrain authoring is fully contained in Chisel. Import PNG spritesheets as **Tileset** assets, bind concrete sprites to logical WFC symbols such as `GROUND`, `TREE`, and `ROCK`, then paint layered examples under **Terrain → WFC Samples**. Chisel compiles selectable overlapping 2×2, 3×3, or 4×4 logical patterns, generates independent sectors, constraint-solves the gaps between them, and resolves concrete sprite variants only after the terrain structure is complete. Only approved frozen patches and compact tileset metadata appear in Data Tables and game exports; WFC symbols and source samples remain editor-only.

Chisel project formats are current-only. When a schema or managed layout changes, every checked-in project is rewritten in the same change; Chisel does not carry runtime migration or legacy-compatibility code.
