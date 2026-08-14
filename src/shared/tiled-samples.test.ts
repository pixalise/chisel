import { describe, expect, it } from "vitest";
import { tiledBoardAuthoringSchema, tiledSampleSchema, tiledTileBindingSchema } from "./tiled-samples";

const sample = {
  slug: "FOREST_EDGE",
  layerIds: [1],
  x: 0,
  y: 0,
  width: 3,
  height: 3,
  allowRotations: true,
  allowReflections: false
};

describe("current Tiled table authoring contract", () => {
  it("keeps biome properties outside samples", () => {
    expect(tiledSampleSchema.parse(sample)).toEqual(sample);
    expect(() => tiledSampleSchema.parse({ ...sample, id: "FOREST_EDGE" })).toThrow();
    expect(() => tiledSampleSchema.parse({ ...sample, name: "Forest Edge" })).toThrow();
    expect(() => tiledSampleSchema.parse({ ...sample, weight: 1 })).toThrow();
    expect(() => tiledSampleSchema.parse({ ...sample, kind: "BOUNDARY" })).toThrow();
    expect(() => tiledSampleSchema.parse({ ...sample, profiles: ["FOREST"] })).toThrow();
  });

  it("requires explicit movement blocking on every tile binding", () => {
    expect(tiledTileBindingSchema.parse({ slug: "GRASS", roleId: "GROUND", blocking: false, tags: [] })).toMatchObject({
      blocking: false
    });
    expect(() => tiledTileBindingSchema.parse({ slug: "GRASS", roleId: "GROUND", tags: [] })).toThrow();
  });

  it("stores board authoring without a parallel file schema version", () => {
    expect(tiledBoardAuthoringSchema.parse({ tileBindings: {}, samples: [] })).toEqual({ tileBindings: {}, samples: [] });
    expect(() => tiledBoardAuthoringSchema.parse({ schemaVersion: 3, tileBindings: {}, samples: [] })).toThrow();
  });
});
