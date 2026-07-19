"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
const types_1 = require("./types");
(0, vitest_1.describe)("row slugs", () => {
    (0, vitest_1.it)("accepts constant case slugs", () => {
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("ZOMBIE_BASIC")).toBe("ZOMBIE_BASIC");
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("FLETCHING_BULLETS_2")).toBe("FLETCHING_BULLETS_2");
    });
    (0, vitest_1.it)("rejects non-canonical slug shapes", () => {
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
            (0, vitest_1.expect)(schemas_1.rowSlugSchema.safeParse(slug).success).toBe(false);
        }
    });
    (0, vitest_1.it)("requires every data table row to have a slug", () => {
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), values: [] })).toThrow();
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), slug: "ZOMBIE_BASIC", values: [] })).not.toThrow();
    });
});
(0, vitest_1.describe)("asset slugs", () => {
    (0, vitest_1.it)("uses the asset slug as the asset id", () => {
        const asset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.terrainTexture,
            extension: "gppt",
            height: 1024,
            id: (0, nanoid_1.nanoid)(),
            name: "forest_soil_1",
            relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL_1.gppt",
            sizeBytes: 1024,
            width: 1024
        });
        (0, vitest_1.expect)(asset.id).toBe("FOREST_SOIL_1");
        (0, vitest_1.expect)(asset.name).toBe("FOREST_SOIL_1");
    });
    (0, vitest_1.it)("requires new asset names to be constant case", () => {
        (0, vitest_1.expect)(schemas_1.createOrUpdateAssetSchema.safeParse({
            category: types_1.AssetCategoryEnum.image,
            extension: "png",
            height: 1,
            name: "ICON_HOME",
            sizeBytes: 1,
            width: 1
        }).success).toBe(true);
        (0, vitest_1.expect)(schemas_1.createOrUpdateAssetSchema.safeParse({
            category: types_1.AssetCategoryEnum.image,
            extension: "png",
            height: 1,
            name: "icon_home",
            sizeBytes: 1,
            width: 1
        }).success).toBe(false);
    });
    (0, vitest_1.it)("keeps HDR files in the HDRI asset category", () => {
        const asset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.image,
            extension: "hdr",
            height: 512,
            id: "SKY_CLEAR",
            name: "SKY_CLEAR",
            relativePath: ".chisel/assets/HDRI/SKY_CLEAR.hdr",
            sizeBytes: 1024,
            width: 1024
        });
        (0, vitest_1.expect)(asset.category).toBe(types_1.AssetCategoryEnum.hdri);
    });
});
