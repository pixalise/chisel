import { describe, expect, it } from "vitest";
import { groupTiledProblems } from "./tiled-problem-groups";

describe("Tiled problem groups", () => {
  it("collapses repeated validation types while retaining every detail", () => {
    const groups = groupTiledProblems([
      "Tile 'TERRAIN:0' needs a slug and role",
      "Tile 'TERRAIN:1' needs a slug and role",
      "Sample 'EDGE' extends outside the board"
    ]);

    expect(groups).toEqual([
      {
        id: "UNBOUND_TILE",
        label: "Tiles need a slug and role",
        problems: ["Tile 'TERRAIN:0' needs a slug and role", "Tile 'TERRAIN:1' needs a slug and role"]
      },
      {
        id: "SAMPLE_OUTSIDE",
        label: "Samples extend outside the board",
        problems: ["Sample 'EDGE' extends outside the board"]
      }
    ]);
  });
});
