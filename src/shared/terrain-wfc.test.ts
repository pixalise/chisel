import { describe, expect, it } from "vitest";
import { terrainTileKey, type TerrainSample, type TerrainTileBinding, type TerrainTileRef } from "./terrain-authoring";
import {
  compileTerrainWfcLibrary,
  generateTerrainWfcOutput,
  generateTerrainWfcSectorOutput,
  terrainWfcAdjacencyProblem,
  terrainWfcPatternDiagnostics,
  type TerrainWfcLibrary
} from "./terrain-wfc";

function tile(localId: number): TerrainTileRef {
  return { tilesetId: "TERRAIN", localId, orientation: 0 };
}

function sample(slug: string, width: number, height: number, ids: number[]): TerrainSample {
  return {
    slug,
    width,
    height,
    layerCount: 1,
    cells: ids.map((localId) => [tile(localId)]),
    periodicInput: false,
    allowRotations: false,
    allowReflections: false
  };
}

function bindings(symbols: Record<number, string>): Record<string, TerrainTileBinding> {
  return Object.fromEntries(
    Object.entries(symbols).map(([localId, wfcSymbol]) => [
      terrainTileKey("TERRAIN", Number(localId)),
      { slug: `TILE_${localId}`, wfcSymbol, blocking: false, tags: [] }
    ])
  );
}

function logicalCell(localId: number, tileBindings: Record<string, TerrainTileBinding>): string {
  return `${tileBindings[terrainTileKey("TERRAIN", localId)].wfcSymbol}@0`;
}

describe("logical overlapping terrain WFC", () => {
  it("deduplicates visual variants that share one logical WFC symbol", () => {
    const tileBindings = bindings({ 1: "GROUND", 2: "GROUND" });
    const source = sample("GROUND", 4, 4, [1, 2, 1, 2, 2, 1, 2, 1, 1, 2, 1, 2, 2, 1, 2, 1]);
    const library = compileTerrainWfcLibrary({ samples: [source], tileBindings }, { patternSize: 2 });

    expect(library.patterns).toHaveLength(1);
    expect(library.patterns[0].symbols).toEqual(Array(4).fill("GROUND@0"));
    expect(library.visualVariants["GROUND@0"]).toHaveLength(2);
  });

  it.each([
    [2, 16],
    [3, 9],
    [4, 4]
  ] as const)("extracts selectable %dx%d logical windows", (patternSize, expectedPatterns) => {
    const ids = Array.from({ length: 25 }, (_, index) => index + 1);
    const tileBindings = bindings(Object.fromEntries(ids.map((id) => [id, `SYMBOL_${id}`])));
    const library = compileTerrainWfcLibrary({ samples: [sample("UNIQUE", 5, 5, ids)], tileBindings }, { patternSize });

    expect(library.patternSize).toBe(patternSize);
    expect(library.patterns).toHaveLength(expectedPatterns);
    expect(library.patterns[0].symbols).toHaveLength(patternSize * patternSize);
  });

  it("generates only observed logical windows while resolving sprite variants afterward", () => {
    const tileBindings = bindings({ 1: "GROUND", 2: "TREE", 3: "TREE" });
    const source = sample(
      "FOREST",
      6,
      6,
      [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1]
    );
    source.periodicInput = true;
    const library = compileTerrainWfcLibrary({ samples: [source], tileBindings }, { patternSize: 2 });
    const output = generateTerrainWfcOutput(library, { width: 24, height: 24, seed: 91 });
    const patternKeys = new Set(library.patterns.map((pattern) => pattern.symbols.join("|")));
    const ids = new Set(output.cells.map((cell) => cell[0]?.localId));

    for (let anchorY = 0; anchorY < output.height - 1; anchorY += 1) {
      for (let anchorX = 0; anchorX < output.width - 1; anchorX += 1) {
        const key = [
          output.cells[anchorY * output.width + anchorX][0]?.localId,
          output.cells[anchorY * output.width + anchorX + 1][0]?.localId,
          output.cells[(anchorY + 1) * output.width + anchorX][0]?.localId,
          output.cells[(anchorY + 1) * output.width + anchorX + 1][0]?.localId
        ]
          .map((localId) => logicalCell(localId ?? 0, tileBindings))
          .join("|");
        expect(patternKeys.has(key)).toBe(true);
      }
    }
    expect(ids.has(2)).toBe(true);
    expect(ids.has(3)).toBe(true);
  });

  it("generates deterministic sectors and fills their seams with constrained WFC", () => {
    const tileBindings = bindings({ 1: "GROUND", 2: "TREE", 3: "TREE" });
    const source = sample(
      "FOREST",
      6,
      6,
      [1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 3, 1, 1, 1, 1, 2, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 2, 1, 3, 1, 1, 1, 1, 1, 1, 1]
    );
    source.periodicInput = true;
    const library = compileTerrainWfcLibrary({ samples: [source], tileBindings }, { patternSize: 2 });
    const first = generateTerrainWfcSectorOutput(library, { width: 24, height: 24, sectorSize: 8, seed: 17 });
    const second = generateTerrainWfcSectorOutput(library, { width: 24, height: 24, sectorSize: 8, seed: 17 });

    expect(first).toEqual(second);
    expect(first.sectorCount).toBeGreaterThan(1);
    expect(first.seamWidth).toBe(1);
    expect(first.cells).toHaveLength(24 * 24);
  });

  it("reports valid neighbors and the directions that make a pattern invalid", () => {
    const library: TerrainWfcLibrary = {
      adjacency: {
        north: [[0], []],
        east: [[0], [0]],
        south: [[0], [0]],
        west: [[0], [0]]
      },
      patternSize: 1,
      patterns: [
        { id: 0, sampleOccurrences: { VALID: 1 }, symbols: ["GROUND@0"], weight: 1 },
        { id: 1, sampleOccurrences: { INVALID: 1 }, symbols: ["TREE@0"], weight: 1 }
      ],
      sampleSlugs: ["VALID", "INVALID"],
      sampleStats: {
        VALID: { extractedOccurrences: 1, uniquePatterns: 1, viablePatterns: 1 },
        INVALID: { extractedOccurrences: 1, uniquePatterns: 1, viablePatterns: 0 }
      },
      visualVariants: {}
    };

    const diagnostics = terrainWfcPatternDiagnostics(library);

    expect(diagnostics[0]).toMatchObject({
      patternId: 0,
      viable: true,
      directions: { north: { compatiblePatterns: 1, viableCompatiblePatterns: 1 } }
    });
    expect(diagnostics[1]).toMatchObject({
      patternId: 1,
      viable: false,
      directions: {
        north: { compatiblePatterns: 0, viableCompatiblePatterns: 0 },
        east: { compatiblePatterns: 1, viableCompatiblePatterns: 1 }
      }
    });
  });

  it("requires every painted sprite to have a logical WFC symbol", () => {
    expect(() => compileTerrainWfcLibrary({ samples: [sample("MISSING", 3, 3, Array(9).fill(1))], tileBindings: {} })).toThrow(
      "needs a tile binding and WFC symbol"
    );
  });

  it("rejects samples smaller than the selected overlap", () => {
    expect(() =>
      compileTerrainWfcLibrary(
        { samples: [sample("SMALL", 3, 3, Array(9).fill(1))], tileBindings: bindings({ 1: "GROUND" }) },
        { patternSize: 4 }
      )
    ).toThrow("at least 4×4");
  });

  it("rotates logical positions and orientations together", () => {
    const rotating = sample("ROTATING", 3, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    rotating.allowRotations = true;
    const tileBindings = bindings(Object.fromEntries(Array.from({ length: 9 }, (_, index) => [index + 1, `S_${index + 1}`])));
    const library = compileTerrainWfcLibrary({ samples: [rotating], tileBindings }, { patternSize: 3 });

    expect(library.patterns).toHaveLength(4);
    expect(library.patterns.some((pattern) => pattern.symbols[0] === "S_7@1")).toBe(true);
  });

  it("rejects incomplete samples", () => {
    const incomplete = sample("INCOMPLETE", 3, 3, Array(9).fill(1));
    incomplete.cells[4][0] = null;
    expect(() => compileTerrainWfcLibrary({ samples: [incomplete], tileBindings: bindings({ 1: "GROUND" }) })).toThrow(
      "base layer fully painted"
    );
  });

  it("explains when isolated logical samples teach no compatible neighbors", () => {
    const first = sample("FIRST", 3, 3, [1, 1, 2, 3, 1, 1, 2, 3, 3]);
    const second = sample("SECOND", 3, 3, [3, 4, 3, 1, 2, 1, 2, 3, 2]);
    const tileBindings = bindings({ 1: "A", 2: "B", 3: "C", 4: "D" });
    const library = compileTerrainWfcLibrary({ samples: [first, second], tileBindings });

    expect(terrainWfcAdjacencyProblem(library)).toContain("No logical pattern");
    expect(() => generateTerrainWfcOutput(library, { width: 20, height: 20, seed: 1 })).toThrow("No logical pattern");
  });

  it("matches complete layered logical cells", () => {
    const layered = sample("LAYERED", 5, 5, Array(25).fill(1));
    layered.layerCount = 2;
    layered.cells = layered.cells.map((cell, index) => [cell[0], index % 2 === 0 ? tile(2) : null]);
    layered.periodicInput = true;
    const tileBindings = bindings({ 1: "GROUND", 2: "TREE" });
    const library = compileTerrainWfcLibrary({ samples: [layered], tileBindings });
    const output = generateTerrainWfcOutput(library, { width: 10, height: 10, seed: 3 });

    expect(output.cells.every((cell) => cell.length === 2 && cell[0]?.localId === 1)).toBe(true);
  });
});
