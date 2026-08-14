import { describe, expect, it } from "vitest";
import { tiledBoardEnrichmentSchema, tiledSampleSchema, tiledTileBindingSchema } from "./tiled-samples";

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

describe("current Tiled enrichment contract", () => {
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

  it("accepts only the current enrichment version", () => {
    expect(tiledBoardEnrichmentSchema.parse({ schemaVersion: 3, tileBindings: {}, samples: [] }).schemaVersion).toBe(3);
    expect(() => tiledBoardEnrichmentSchema.parse({ schemaVersion: 2, tileBindings: {}, samples: [] })).toThrow();
  });
});
