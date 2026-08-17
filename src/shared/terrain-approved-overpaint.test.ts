import { describe, expect, it } from "vitest";
import type { TerrainApprovedAsset } from "./terrain-authoring";
import { resolveApprovedTerrainCell, revertApprovedTerrainCell, setApprovedTerrainCellOverride } from "./terrain-approved-overpaint";

function approvedAsset(): TerrainApprovedAsset {
  return {
    slug: "TEST_MAP",
    kind: "MAP",
    sourceTemplate: "TEST_TEMPLATE",
    seed: 1,
    width: 2,
    height: 2,
    layerCount: 1,
    cells: Array.from({ length: 4 }, () => [{ tilesetId: "TERRAIN", localId: 0, orientation: 0 }]),
    cellMetadata: Array.from({ length: 4 }, () => ({ blocking: false, elevation: 0, tags: ["GROUND"], piece: "GROUND" })),
    cellOverrides: [],
    placements: [],
    anchors: [
      { slug: "WEST", kind: "ENTRANCE", x: 0, y: 0, direction: "west", socket: "GROUND" },
      { slug: "EAST", kind: "EXIT", x: 1, y: 1, direction: "east", socket: "GROUND" }
    ],
    metrics: { walkableComponents: 1, reachableAnchors: 2, requiredAnchors: 2, distinctPieces: 1 }
  };
}

describe("approved terrain overpainting", () => {
  it("stores sparse overrides without changing generated base cells", () => {
    const base = approvedAsset();
    const painted = setApprovedTerrainCellOverride(base, 1, [{ tilesetId: "TERRAIN", localId: 9, orientation: 2 }], {
      ...base.cellMetadata[1],
      blocking: false,
      collision: { resolution: 2, cells: [true, false, false, false] },
      elevation: 1,
      tags: ["WALL"]
    });

    expect(base.cells[1][0]?.localId).toBe(0);
    expect(base.cellMetadata[1].blocking).toBe(false);
    expect(painted.cellOverrides).toHaveLength(1);
    expect(resolveApprovedTerrainCell(painted, 1)).toMatchObject({
      tiles: [{ localId: 9, orientation: 2 }],
      metadata: {
        blocking: false,
        collision: { resolution: 2, cells: [true, false, false, false] },
        elevation: 1,
        tags: ["WALL"],
        piece: "GROUND"
      }
    });
  });

  it("updates final connectivity and can revert to generated terrain", () => {
    const base = approvedAsset();
    const firstWall = setApprovedTerrainCellOverride(base, 1, base.cells[1], { ...base.cellMetadata[1], blocking: true });
    const divided = setApprovedTerrainCellOverride(firstWall, 2, base.cells[2], { ...base.cellMetadata[2], blocking: true });

    expect(divided.metrics.walkableComponents).toBe(2);
    expect(divided.metrics.reachableAnchors).toBe(1);
    expect(revertApprovedTerrainCell(divided, 1).cellOverrides).toHaveLength(1);
    expect(revertApprovedTerrainCell(revertApprovedTerrainCell(divided, 1), 2)).toMatchObject({
      cellOverrides: [],
      metrics: { walkableComponents: 1, reachableAnchors: 2 }
    });
  });
});
