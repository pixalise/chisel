"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const types_1 = require("./types");
(0, vitest_1.describe)("asset categories", () => {
    (0, vitest_1.it)("includes HDRI as a selectable asset category", () => {
        (0, vitest_1.expect)(types_1.assetCategoryLabelMap[types_1.AssetCategoryEnum.hdri]).toBe("HDRI");
        (0, vitest_1.expect)(types_1.assetCategoryOptionValues).toContainEqual({ label: "HDRI", value: types_1.AssetCategoryEnum.hdri });
    });
    (0, vitest_1.it)("recognizes HDRI file extensions without stealing terrain texture extensions", () => {
        (0, vitest_1.expect)((0, types_1.isHdriExtension)("hdr")).toBe(true);
        (0, vitest_1.expect)((0, types_1.isHdriExtension)("HDR")).toBe(true);
        (0, vitest_1.expect)((0, types_1.isHdriExtension)("exr")).toBe(false);
        (0, vitest_1.expect)((0, types_1.isTerrainTextureExtension)("exr")).toBe(true);
    });
});
