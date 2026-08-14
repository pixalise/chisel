import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { assetSchema, createOrUpdateAssetSchema, dataTableRowSchema, rowSlugSchema } from "./schemas";
import { AssetCategoryEnum } from "./types";

describe("row slugs", () => {
  it("accepts constant case slugs", () => {
    expect(rowSlugSchema.parse("ZOMBIE_BASIC")).toBe("ZOMBIE_BASIC");
    expect(rowSlugSchema.parse("FLETCHING_BULLETS_2")).toBe("FLETCHING_BULLETS_2");
  });

  it("rejects non-canonical slug shapes", () => {
    for (const slug of [
      "zombie_basic",
      "ZombieBasic",
      "ZOMBIE-BASIC",
      "ZOMBIE BASIC",
      "ZOMBIE__BASIC",
      "_ZOMBIE",
      "ZOMBIE_",
      " ZOMBIE",
      "ZOMBIE "
    ]) {
      expect(rowSlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it("requires every data table row to have a slug", () => {
    expect(() => dataTableRowSchema.parse({ id: nanoid(), values: [] })).toThrow();
    expect(() => dataTableRowSchema.parse({ id: nanoid(), slug: "ZOMBIE_BASIC", values: [] })).not.toThrow();
  });
});

describe("asset slugs", () => {
  it("uses the asset slug as the asset id", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.terrainTexture,
      extension: "tga",
      height: 1024,
      id: nanoid(),
      name: "forest_soil_1",
      relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL_1.tga",
      sizeBytes: 1024,
      width: 1024
    });

    expect(asset.id).toBe("FOREST_SOIL_1");
    expect(asset.name).toBe("FOREST_SOIL_1");
  });

  it("requires new asset names to be constant case", () => {
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.image,
        extension: "png",
        height: 1,
        name: "ICON_HOME",
        sizeBytes: 1,
        width: 1
      }).success
    ).toBe(true);
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.image,
        extension: "png",
        height: 1,
        name: "icon_home",
        sizeBytes: 1,
        width: 1
      }).success
    ).toBe(false);
  });

  it("requires native tilesets to be divisible PNG grids", () => {
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.tileset,
        extension: "png",
        height: 384,
        name: "FOREST_TILES",
        sizeBytes: 1024,
        tileSize: 64,
        width: 1024
      }).success
    ).toBe(true);
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.tileset,
        extension: "png",
        height: 385,
        name: "BROKEN_GRID",
        sizeBytes: 1024,
        tileSize: 64,
        width: 1024
      }).success
    ).toBe(false);
    expect(
      createOrUpdateAssetSchema.safeParse({
        category: AssetCategoryEnum.tileset,
        extension: "webp",
        height: 384,
        name: "WRONG_FORMAT",
        sizeBytes: 1024,
        tileSize: 64,
        width: 1024
      }).success
    ).toBe(false);
  });

  it("keeps HDR files in the HDRI asset category", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.image,
      extension: "hdr",
      height: 512,
      id: "SKY_CLEAR",
      name: "SKY_CLEAR",
      relativePath: ".chisel/assets/HDRI/SKY_CLEAR.hdr",
      sizeBytes: 1024,
      width: 1024
    });

    expect(asset.category).toBe(AssetCategoryEnum.hdri);
  });

  it("keeps mesh files in the mesh asset category", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.other,
      extension: "glb",
      height: 0,
      id: "WATCH_TOWER",
      name: "WATCH_TOWER",
      relativePath: ".chisel/assets/MESH/WATCH_TOWER.glb",
      sizeBytes: 1024,
      width: 0
    });

    expect(asset.category).toBe(AssetCategoryEnum.mesh);
  });

  it("keeps supported sound files in the audio asset category", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.other,
      extension: "wav",
      height: 0,
      id: "BLADE_SWING",
      name: "BLADE_SWING",
      relativePath: ".chisel/assets/AUDIO/BLADE_SWING.wav",
      sizeBytes: 1024,
      width: 0
    });

    expect(asset.category).toBe(AssetCategoryEnum.audio);
  });

  it("classifies GLSL files as managed shaders", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.other,
      extension: "glsl",
      height: 0,
      id: "UI_MATERIAL",
      name: "UI_MATERIAL",
      relativePath: ".chisel/assets/SHADER/UI_MATERIAL.glsl",
      sizeBytes: 1024,
      width: 0
    });

    expect(asset.category).toBe(AssetCategoryEnum.shader);
  });
});
