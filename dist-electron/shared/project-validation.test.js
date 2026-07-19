"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
const project_validation_1 = require("./project-validation");
const types_1 = require("./types");
(0, vitest_1.describe)("project content validation", () => {
    (0, vitest_1.it)("reports missing reference targets and missing referenced rows", () => {
        const factionColumnId = (0, nanoid_1.nanoid)();
        const factions = schemas_1.dataTableSchema.parse({
            columns: [],
            description: "Factions",
            id: "factions",
            kind: "user",
            lastChangeAt: "2026-01-01T00:00:00.000Z",
            name: "Factions",
            rows: [{ id: (0, nanoid_1.nanoid)(), slug: "IRON_LEGION", values: [] }],
            version: 1
        });
        const units = schemas_1.dataTableSchema.parse({
            columns: [
                {
                    defaultValue: "",
                    id: factionColumnId,
                    name: "faction",
                    refTableId: "factions",
                    required: true,
                    type: types_1.ColumnType.ref,
                    unique: false
                }
            ],
            description: "Units",
            id: "units",
            kind: "user",
            lastChangeAt: "2026-01-01T00:00:00.000Z",
            name: "Units",
            rows: [
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "RIFLEMAN",
                    values: [{ columnId: factionColumnId, type: types_1.ColumnType.ref, value: "MISSING_FACTION" }]
                }
            ],
            version: 1
        });
        const issues = (0, project_validation_1.validateProjectContent)([factions, units], []);
        (0, vitest_1.expect)(issues).toContainEqual(vitest_1.expect.objectContaining({
            severity: project_validation_1.ProjectValidationSeverity.error,
            message: 'Reference "MISSING_FACTION" does not exist in "Factions"'
        }));
        (0, vitest_1.expect)((0, project_validation_1.findTableReferences)([factions, units], "factions", new Set(["MISSING_FACTION"]))).toHaveLength(1);
    });
    (0, vitest_1.it)("reports asset reference misses and category mismatches", () => {
        const portraitColumnId = (0, nanoid_1.nanoid)();
        const terrainAsset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.terrainTexture,
            extension: "gppt",
            height: 1024,
            id: "FOREST_SOIL",
            name: "FOREST_SOIL",
            relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL.gppt",
            sizeBytes: 1024,
            width: 1024
        });
        const table = schemas_1.dataTableSchema.parse({
            columns: [
                {
                    assetCategory: types_1.AssetCategoryEnum.image,
                    defaultValue: "",
                    id: portraitColumnId,
                    name: "portrait",
                    required: true,
                    type: types_1.ColumnType.assetRef,
                    unique: false
                }
            ],
            description: "Units",
            id: "units",
            kind: "user",
            lastChangeAt: "2026-01-01T00:00:00.000Z",
            name: "Units",
            rows: [
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "RIFLEMAN",
                    values: [{ columnId: portraitColumnId, type: types_1.ColumnType.assetRef, value: "FOREST_SOIL" }]
                },
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "ENGINEER",
                    values: [{ columnId: portraitColumnId, type: types_1.ColumnType.assetRef, value: "MISSING_ASSET" }]
                }
            ],
            version: 1
        });
        const issues = (0, project_validation_1.validateProjectContent)([table], [terrainAsset]);
        (0, vitest_1.expect)(issues).toContainEqual(vitest_1.expect.objectContaining({
            severity: project_validation_1.ProjectValidationSeverity.error,
            message: 'Asset "FOREST_SOIL" is TERRAIN_TEXTURE, expected IMAGE'
        }));
        (0, vitest_1.expect)(issues).toContainEqual(vitest_1.expect.objectContaining({
            severity: project_validation_1.ProjectValidationSeverity.error,
            message: 'Asset "MISSING_ASSET" does not exist'
        }));
        (0, vitest_1.expect)((0, project_validation_1.findAssetReferences)([table], "FOREST_SOIL")).toHaveLength(1);
    });
});
