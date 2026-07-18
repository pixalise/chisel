import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { assetSchema, createOrUpdateAssetSchema, dataTableRowSchema, rowSlugSchema } from "./schemas";
import { AssetCategoryEnum } from "./types";

describe("row slugs", () => {
  it("accepts snake case slugs", () => {
    expect(rowSlugSchema.parse("zombie_basic")).toBe("zombie_basic");
    expect(rowSlugSchema.parse("fletching_bullets_2")).toBe("fletching_bullets_2");
  });

  it("rejects non-canonical slug shapes", () => {
    for (const slug of ["ZOMBIE_BASIC", "ZombieBasic", "zombie-basic", "zombie basic", "zombie__basic", "_zombie", "zombie_"]) {
      expect(rowSlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it("requires every data table row to have a slug", () => {
    expect(() => dataTableRowSchema.parse({ id: nanoid(), values: [] })).toThrow();
    expect(() => dataTableRowSchema.parse({ id: nanoid(), slug: "zombie_basic", values: [] })).not.toThrow();
  });
});

describe("asset slugs", () => {
  it("uses the asset slug as the asset id", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.terrainTexture,
      extension: "gppt",
      height: 1024,
      id: nanoid(),
      name: "forest_soil_1",
      relativePath: ".chisel/assets/terrain_texture/forest_soil_1.gppt",
      sizeBytes: 1024,
      width: 1024
    });

    expect(asset.id).toBe("forest_soil_1");
    expect(asset.name).toBe("forest_soil_1");
  });

  it("requires new asset names to be snake case", () => {
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.image,
        extension: "png",
        height: 1,
        name: "icon_home",
        sizeBytes: 1,
        width: 1
      }).success
    ).toBe(true);
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.image,
        extension: "png",
        height: 1,
        name: "ICON_HOME",
        sizeBytes: 1,
        width: 1
      }).success
    ).toBe(false);
  });
});
