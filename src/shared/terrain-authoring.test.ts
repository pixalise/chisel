import { describe, expect, it } from "vitest";
import { appendTerrainSampleLayer, terrainApprovedPatchSchema, terrainSampleSchema, terrainTileBindingSchema } from "./terrain-authoring";

describe("native terrain authoring contract", () => {
  it("accepts a fully painted current-format sample", () => {
    const cells = Array.from({ length: 9 }, (_, localId) => [{ tilesetId: "TERRAIN", localId, orientation: 0 }]);
    expect(
      terrainSampleSchema.parse({
        slug: "GROUND_EDGE",
        width: 3,
        height: 3,
        layerCount: 1,
        cells,
        periodicInput: false,
        allowRotations: true,
        allowReflections: false
      })
    ).toMatchObject({ slug: "GROUND_EDGE", width: 3, height: 3 });
  });

  it("accepts large rectangular layered training samples", () => {
    const sample = terrainSampleSchema.parse({
      slug: "RUINS_EXAMPLE",
      width: 24,
      height: 32,
      layerCount: 2,
      cells: Array.from({ length: 24 * 32 }, () => [{ tilesetId: "GRASS", localId: 0, orientation: 0 }, null]),
      periodicInput: true,
      allowRotations: false,
      allowReflections: false
    });

    expect(sample).toMatchObject({ width: 24, height: 32, layerCount: 2, periodicInput: true });
  });

  it("appends a transparent paint layer without changing painted cells", () => {
    const base = { tilesetId: "GRASS", localId: 7, orientation: 0 };
    const sample = terrainSampleSchema.parse({
      slug: "LAYER_TEST",
      width: 3,
      height: 3,
      layerCount: 1,
      cells: Array.from({ length: 9 }, () => [base]),
      periodicInput: false,
      allowRotations: false,
      allowReflections: false
    });

    const layered = appendTerrainSampleLayer(sample);

    expect(layered.layerCount).toBe(2);
    expect(layered.cells).toEqual(Array.from({ length: 9 }, () => [base, null]));
  });

  it("keeps blocking and tags in the per-tile binding", () => {
    expect(terrainTileBindingSchema.parse({ slug: "CLIFF", blocking: true, tags: ["MAP_EDGE"] })).toEqual({
      slug: "CLIFF",
      blocking: true,
      tags: ["MAP_EDGE"]
    });
  });

  it("accepts a frozen layered runtime patch", () => {
    const cells = Array.from({ length: 9 }, () => [{ tilesetId: "GRASS", localId: 2, orientation: 0 }, null]);
    expect(
      terrainApprovedPatchSchema.parse({
        slug: "FOREST_1",
        biome: "FOREST",
        category: "NATURE",
        weight: 1,
        width: 3,
        height: 3,
        layerCount: 2,
        cells
      })
    ).toMatchObject({ slug: "FOREST_1", biome: "FOREST", layerCount: 2 });
  });
});
