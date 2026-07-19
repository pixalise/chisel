"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const asset_paths_1 = require("./asset-paths");
(0, vitest_1.describe)("slug formatting", () => {
    (0, vitest_1.it)("formats separators before trimming edge separators", () => {
        (0, vitest_1.expect)((0, asset_paths_1.normalizeConstantCaseInput)("forest soil 1")).toBe("FOREST_SOIL_1");
        (0, vitest_1.expect)((0, asset_paths_1.normalizeConstantCaseInput)("  forest soil 1  ")).toBe("FOREST_SOIL_1");
        (0, vitest_1.expect)((0, asset_paths_1.normalizeConstantCaseInput)("forest   soil___1")).toBe("FOREST_SOIL_1");
    });
    (0, vitest_1.it)("keeps exported path segments snake case with the same separator rules", () => {
        (0, vitest_1.expect)((0, asset_paths_1.snakeCase)("Forest Soil 1")).toBe("forest_soil_1");
    });
});
