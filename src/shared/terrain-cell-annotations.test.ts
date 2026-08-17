import { describe, expect, it } from "vitest";
import type { TerrainSpatialLayout } from "./terrain-authoring";
import { isTerrainAnnotationReferenced, renameTerrainAnnotationReferences, setTerrainCellAnnotation } from "./terrain-cell-annotations";

describe("terrain cell annotations", () => {
  it("adds several global tags to one cell and removes only the selected tag", () => {
    let cells = setTerrainCellAnnotation([], 3, "ENTRANCE", false);
    cells = setTerrainCellAnnotation(cells, 3, "QUEST", false);
    expect(cells).toEqual([{ index: 3, annotations: ["ENTRANCE", "QUEST"] }]);

    cells = setTerrainCellAnnotation(cells, 3, "ENTRANCE", true);
    expect(cells).toEqual([{ index: 3, annotations: ["QUEST"] }]);

    cells = setTerrainCellAnnotation(cells, 3, "QUEST", true);
    expect(cells).toEqual([]);
  });

  it("tracks references and renames them across layouts by definition index", () => {
    const layouts: TerrainSpatialLayout[] = [
      { slug: "MAP_ANNOTATIONS", sourceAsset: "MAP", cells: [{ index: 0, annotations: ["ENTRANCE", "QUEST"] }] }
    ];
    expect(isTerrainAnnotationReferenced(layouts, "ENTRANCE")).toBe(true);
    expect(isTerrainAnnotationReferenced(layouts, "EXIT")).toBe(false);
    expect(renameTerrainAnnotationReferences(layouts, "ENTRANCE", "EXIT")[0].cells[0].annotations).toEqual(["EXIT", "QUEST"]);
  });
});
