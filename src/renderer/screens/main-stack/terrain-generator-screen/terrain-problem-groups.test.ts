import { describe, expect, it } from "vitest";
import { groupTerrainProblems } from "./terrain-problem-groups";

describe("terrain problem groups", () => {
  it("collapses repeated problems by their actionable type", () => {
    const groups = groupTerrainProblems([
      "Tile binding 'A:0' is orphaned",
      "Tile binding 'A:1' is orphaned",
      "Sample 'EDGE' has 2 unpainted cells"
    ]);
    expect(groups).toMatchObject([
      { count: 2, label: "Tile bindings are orphaned" },
      { count: 1, label: "Samples have unpainted cells" }
    ]);
  });
});
