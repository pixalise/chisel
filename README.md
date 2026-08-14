# Chisel

Chisel is a project-data editor and generation-authoring workspace. Detailed integration, export, and WFC sample documentation lives in [FARBOUND_INTEGRATION.md](./FARBOUND_INTEGRATION.md), [EXPORTS.md](./EXPORTS.md), and [WFC_SAMPLES.md](./WFC_SAMPLES.md).

## Native terrain authoring

Terrain authoring is fully contained in Chisel. Import PNG spritesheets into the Asset Library as **Tileset** assets, set their square tile sizes, then use **Terrain → WFC Samples** to paint large rectangular examples with a required base layer and optional transparent overlay layers. Chisel compiles overlapping 3×3 patterns, supports deliberately periodic input, reports per-sample pattern viability, and previews seeded output. No external map editor or intermediate map format is required.

Chisel project formats are current-only. When a schema or managed layout changes, every checked-in project is rewritten in the same change; Chisel does not carry runtime migration or legacy-compatibility code.
