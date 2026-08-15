import { describe, expect, it } from "vitest";
import { terrainZoneBoundarySegments } from "./terrain-zone-boundary";

describe("terrainZoneBoundarySegments", () => {
  it("draws only the outside of a contiguous zone", () => {
    const segments = terrainZoneBoundarySegments([0, 1, 4, 5], 4, 4);

    expect(segments).toHaveLength(8);
    expect(segments).not.toContainEqual({ x1: 1, y1: 0, x2: 1, y2: 1 });
    expect(segments).not.toContainEqual({ x1: 1, y1: 1, x2: 1, y2: 0 });
    expect(segments).not.toContainEqual({ x1: 0, y1: 1, x2: 1, y2: 1 });
    expect(segments).not.toContainEqual({ x1: 1, y1: 1, x2: 0, y2: 1 });
  });

  it("ignores duplicate and out-of-bounds cells", () => {
    expect(terrainZoneBoundarySegments([0, 0, -1, 4], 2, 2)).toHaveLength(4);
  });
});
