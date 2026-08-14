import { describe, expect, it } from "vitest";
import { terrainSampleSchema, terrainTileBindingSchema } from "./terrain-authoring";

describe("native terrain authoring contract", () => {
  it("accepts a fully painted current-format sample", () => {
    const cells = Array.from({ length: 9 }, (_, localId) => ({ tilesetId: "TERRAIN", localId, orientation: 0 }));
    expect(
      terrainSampleSchema.parse({
        slug: "GROUND_EDGE",
        width: 3,
        height: 3,
        cells,
        allowRotations: true,
        allowReflections: false
      })
    ).toMatchObject({ slug: "GROUND_EDGE", width: 3, height: 3 });
  });

  it("restricts authored samples to 3x3 through 5x5", () => {
    expect(() =>
      terrainSampleSchema.parse({
        slug: "TOO_LARGE",
        width: 6,
        height: 6,
        cells: Array(36).fill(null),
        allowRotations: false,
        allowReflections: false
      })
    ).toThrow();
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
