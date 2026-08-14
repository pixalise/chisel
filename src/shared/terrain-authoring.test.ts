import { describe, expect, it } from "vitest";
import { terrainSampleSchema, terrainTileBindingSchema } from "./terrain-authoring";

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

  it("keeps blocking and tags in the per-tile binding", () => {
    expect(terrainTileBindingSchema.parse({ slug: "CLIFF", roleId: "GROUND", blocking: true, tags: ["MAP_EDGE"] })).toEqual({
      slug: "CLIFF",
      roleId: "GROUND",
      blocking: true,
      tags: ["MAP_EDGE"]
    });
  });
});
