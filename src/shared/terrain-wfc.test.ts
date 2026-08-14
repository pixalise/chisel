import { describe, expect, it } from "vitest";
import type { TerrainSample, TerrainTileRef } from "./terrain-authoring";
import { compileTerrainWfcLibrary, generateTerrainWfcOutput } from "./terrain-wfc";

function tile(localId: number): TerrainTileRef {
  return { tilesetId: "TERRAIN", localId, orientation: 0 };
}

function sample(slug: string, width: 3 | 4 | 5, height: 3 | 4 | 5, ids: number[]): TerrainSample {
  return {
    slug,
    width,
    height,
    cells: ids.map(tile),
    allowRotations: false,
    allowReflections: false
  };
}

describe("native terrain overlapping WFC", () => {
  it("deduplicates recurring 3x3 patterns while retaining occurrences", () => {
    const library = compileTerrainWfcLibrary({ samples: [sample("GROUND", 5, 5, Array(25).fill(1))] });

    expect(library.patterns).toHaveLength(1);
    expect(library.patterns[0].sampleOccurrences).toEqual({ GROUND: 9 });
    expect(library.patterns[0].weight).toBeCloseTo(1);
    expect(library.adjacency.north[0]).toEqual([0]);
  });

  it("deduplicates a pattern shared by samples without losing provenance", () => {
    const library = compileTerrainWfcLibrary({
      samples: [sample("LEFT", 3, 3, Array(9).fill(7)), sample("RIGHT", 3, 3, Array(9).fill(7))]
    });

    expect(library.patterns).toHaveLength(1);
    expect(library.patterns[0].sampleOccurrences).toEqual({ LEFT: 1, RIGHT: 1 });
    expect(library.patterns[0].weight).toBeCloseTo(2);
  });

  it("extracts every overlapping window from a sample", () => {
    const library = compileTerrainWfcLibrary({
      samples: [
        sample(
          "UNIQUE",
          5,
          5,
          Array.from({ length: 25 }, (_, index) => index + 1)
        )
      ]
    });

    expect(library.patterns).toHaveLength(9);
    expect(library.patterns[0].cells.map((entry) => entry.localId)).toEqual([1, 2, 3, 6, 7, 8, 11, 12, 13]);
  });

  it("rotates pattern positions and sprite orientations together", () => {
    const rotating = sample("ROTATING", 3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    rotating.allowRotations = true;
    const library = compileTerrainWfcLibrary({ samples: [rotating] });

    expect(library.patterns).toHaveLength(4);
    const clockwise = library.patterns.find((pattern) => pattern.cells.map((entry) => entry.localId).join(",") === "7,4,1,8,5,2,9,6,3");
    expect(clockwise?.cells.every((entry) => entry.orientation === 1)).toBe(true);
  });

  it("generates deterministic output from compiled adjacency", () => {
    const library = compileTerrainWfcLibrary({ samples: [sample("GROUND", 5, 5, Array(25).fill(4))] });
    const first = generateTerrainWfcOutput(library, { width: 12, height: 8, seed: 42 });
    const second = generateTerrainWfcOutput(library, { width: 12, height: 8, seed: 42 });

    expect(first).toEqual(second);
    expect(first.cells.map((entry) => entry.localId)).toEqual(Array(96).fill(4));
  });

  it("rejects incomplete samples", () => {
    const incomplete = sample("INCOMPLETE", 3, 3, Array(9).fill(1));
    incomplete.cells[4] = null;
    expect(() => compileTerrainWfcLibrary({ samples: [incomplete] })).toThrow("fully painted");
  });
});
