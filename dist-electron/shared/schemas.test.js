"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
(0, vitest_1.describe)("row slugs", () => {
    (0, vitest_1.it)("accepts uppercase snake case slugs", () => {
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("ZOMBIE_BASIC")).toBe("ZOMBIE_BASIC");
        (0, vitest_1.expect)(schemas_1.rowSlugSchema.parse("FLETCHING_BULLETS_2")).toBe("FLETCHING_BULLETS_2");
    });
    (0, vitest_1.it)("rejects non-canonical slug shapes", () => {
        for (const slug of ["zombie_basic", "ZombieBasic", "ZOMBIE-BASIC", "ZOMBIE BASIC", "ZOMBIE__BASIC", "_ZOMBIE", "ZOMBIE_"]) {
            (0, vitest_1.expect)(schemas_1.rowSlugSchema.safeParse(slug).success).toBe(false);
        }
    });
    (0, vitest_1.it)("requires every data table row to have a slug", () => {
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), values: [] })).toThrow();
        (0, vitest_1.expect)(() => schemas_1.dataTableRowSchema.parse({ id: (0, nanoid_1.nanoid)(), slug: "ZOMBIE_BASIC", values: [] })).not.toThrow();
    });
});
