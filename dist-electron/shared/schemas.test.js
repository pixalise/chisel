"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
const types_1 = require("./types");
(0, vitest_1.describe)("row slugs", () => {
    (0, vitest_1.it)("accepts snake case slugs", () => {
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("zombie_basic")).toBe("zombie_basic");
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("fletching_bullets_2")).toBe("fletching_bullets_2");
    });
    (0, vitest_1.it)("rejects non-canonical slug shapes", () => {
        for (const slug of ["ZOMBIE_BASIC", "ZombieBasic", "zombie-basic", "zombie basic", "zombie__basic", "_zombie", "zombie_"]) {
            (0, vitest_1.expect)(schemas_1.rowSlugSchema.safeParse(slug).success).toBe(false);
        }
    });
    (0, vitest_1.it)("requires every data table row to have a slug", () => {
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), values: [] })).toThrow();
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), slug: "zombie_basic", values: [] })).not.toThrow();
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
            relativePath: ".chisel/assets/terrain_texture/forest_soil_1.gppt",
            sizeBytes: 1024,
            width: 1024
        });
        (0, vitest_1.expect)(asset.id).toBe("forest_soil_1");
        (0, vitest_1.expect)(asset.name).toBe("forest_soil_1");
    });
    (0, vitest_1.it)("requires new asset names to be snake case", () => {
        (0, vitest_1.expect)(schemas_1.createOrUpdateAssetSchema.safeParse({
            category: types_1.AssetCategoryEnum.image,
            extension: "png",
            height: 1,
            name: "icon_home",
            sizeBytes: 1,
            width: 1
        }).success).toBe(true);
        (0, vitest_1.expect)(schemas_1.createOrUpdateAssetSchema.safeParse({
            category: types_1.AssetCategoryEnum.image,
            extension: "png",
            height: 1,
            name: "ICON_HOME",
            sizeBytes: 1,
            width: 1
        }).success).toBe(false);
    });
});
