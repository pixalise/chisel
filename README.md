# Chisel

Chisel is a project-data editor and generation-authoring workspace. Detailed integration, export, and WFC sample documentation lives in [FARBOUND_INTEGRATION.md](./FARBOUND_INTEGRATION.md), [EXPORTS.md](./EXPORTS.md), and [WFC_SAMPLES.md](./WFC_SAMPLES.md).

## Native terrain authoring

Terrain authoring is fully contained in Chisel. Import a PNG into the Asset Library as a **Tileset**, set its square tile size, then use **Terrain → WFC Samples** to tag its sprites and paint 3×3, 4×4, or 5×5 samples. No external map editor or intermediate map format is required.

Chisel project formats are current-only. When a schema or managed layout changes, every checked-in project is rewritten in the same change; Chisel does not carry runtime migration or legacy-compatibility code.
