import { describe, expect, it } from "vitest";
import type { TiledBoardView, TiledSample } from "./tiled-samples";
import { compileTiledWfcLibrary, generateTiledWfcOutput } from "./tiled-wfc";

function boardWithSamples(data: number[], width: number, height: number, samples: TiledSample[]): TiledBoardView {
  return {
    id: "BOARD",
    name: "Board",
    width,
    height,
    tileWidth: 16,
    tileHeight: 16,
    layers: [{ id: 1, name: "Terrain", visible: true, opacity: 1, data }],
    tilesets: [],
    authoring: { tileBindings: {}, samples },
    problems: []
  };
}

function sample(slug: string, width: number, height: number, x = 0, y = 0): TiledSample {
  return { slug, layerIds: [1], x, y, width, height, allowRotations: false, allowReflections: false };
}

describe("Tiled overlapping WFC", () => {
  it("deduplicates exact recurring 3x3 patterns while retaining occurrences", () => {
    const library = compileTiledWfcLibrary(boardWithSamples(Array(25).fill(1), 5, 5, [sample("GROUND", 5, 5)]));

    expect(library.patterns).toHaveLength(1);
    expect(library.patterns[0].sampleOccurrences).toEqual({ GROUND: 9 });
    expect(library.patterns[0].weight).toBeCloseTo(1);
    expect(library.adjacency.north[0]).toEqual([0]);
    expect(library.adjacency.east[0]).toEqual([0]);
  });

  it("deduplicates a pattern shared by samples without losing provenance", () => {
    const library = compileTiledWfcLibrary(boardWithSamples(Array(18).fill(7), 6, 3, [sample("LEFT", 3, 3), sample("RIGHT", 3, 3, 3)]));

    expect(library.patterns).toHaveLength(1);
    expect(library.patterns[0].sampleOccurrences).toEqual({ LEFT: 1, RIGHT: 1 });
    expect(library.patterns[0].weight).toBeCloseTo(2);
  });

  it("extracts every overlapping window from a sample", () => {
    const library = compileTiledWfcLibrary(
      boardWithSamples(
        Array.from({ length: 25 }, (_, index) => index + 1),
        5,
        5,
        [sample("UNIQUE", 5, 5)]
      )
    );

    expect(library.patterns).toHaveLength(9);
    expect(library.patterns[0].cells).toEqual([1, 2, 3, 6, 7, 8, 11, 12, 13]);
  });

  it("rotates pattern positions and Tiled tile orientations together", () => {
    const rotating = sample("ROTATING", 3, 3);
    rotating.allowRotations = true;
    const library = compileTiledWfcLibrary(boardWithSamples([1, 2, 3, 4, 5, 6, 7, 8, 9], 3, 3, [rotating]));

    expect(library.patterns).toHaveLength(4);
    const clockwise = library.patterns.find((pattern) => pattern.cells.map((gid) => gid & 0x0fffffff).join(",") === "7,4,1,8,5,2,9,6,3");
    expect(clockwise?.cells.every((gid) => ((gid >>> 0) & 0xe0000000) >>> 0 === 0x60000000)).toBe(true);
  });

  it("generates deterministic layered output from compiled adjacency", () => {
    const library = compileTiledWfcLibrary(boardWithSamples(Array(25).fill(4), 5, 5, [sample("GROUND", 5, 5)]));
    const first = generateTiledWfcOutput(library, { width: 12, height: 8, seed: 42 });
    const second = generateTiledWfcOutput(library, { width: 12, height: 8, seed: 42 });

    expect(first).toEqual(second);
    expect(first.layers[0].data).toEqual(Array(96).fill(4));
  });

  it("rejects undersized and layer-incompatible samples", () => {
    expect(() => compileTiledWfcLibrary(boardWithSamples(Array(9).fill(1), 3, 3, [sample("SMALL", 2, 3)]))).toThrow("at least 3×3");

    const incompatible = sample("OTHER_LAYER", 3, 3);
    incompatible.layerIds = [2];
    expect(() =>
      compileTiledWfcLibrary({
        ...boardWithSamples(Array(9).fill(1), 3, 3, [sample("GROUND", 3, 3), incompatible]),
        layers: [
          { id: 1, name: "Terrain", visible: true, opacity: 1, data: Array(9).fill(1) },
          { id: 2, name: "Detail", visible: true, opacity: 1, data: Array(9).fill(0) }
        ]
      })
    ).toThrow("same included layers");
  });
});
