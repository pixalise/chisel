# Chisel

Chisel is a project-data editor and generation-authoring workspace. Detailed integration, export, and terrain generation documentation lives in [FARBOUND_INTEGRATION.md](./FARBOUND_INTEGRATION.md), [EXPORTS.md](./EXPORTS.md), and [TERRAIN_GENERATOR.md](./TERRAIN_GENERATOR.md).

## Native terrain authoring

Terrain authoring is fully contained in Chisel. Import PNG spritesheets as **Tileset** assets, bind concrete sprites to stable gameplay metadata, then paint mixed-size terrain modules under **Terrain → Terrain Generator**. Under **Terrain → Terrain Annotations**, polish approved geography with sparse cell overrides before authoring its separate zones, markers, and placements. Chisel uses exact Wang-style edge sockets, explicit collections and adjacency exceptions, macro templates, deterministic candidate batches, validation, and approved map or submodule revisions. The complete terrain grammar and approved geography library remain editor-only and are excluded from game exports.

Chisel project formats are current-only. When a schema or managed layout changes, every checked-in project is rewritten in the same change; Chisel does not carry runtime migration or legacy-compatibility code.
