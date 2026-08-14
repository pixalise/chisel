import { describe, expect, it } from "vitest";
import { groupTerrainProblems } from "./terrain-problem-groups";

describe("terrain problem groups", () => {
  it("collapses repeated problems by their actionable type", () => {
    const groups = groupTerrainProblems([
      "Tile 'A:0' needs a slug and role",
      "Tile 'A:1' needs a slug and role",
      "Sample 'EDGE' has 2 unpainted cells"
    ]);
    expect(groups).toMatchObject([
      { count: 2, label: "Tiles need metadata" },
      { count: 1, label: "Samples have unpainted cells" }
    ]);
  });
});
