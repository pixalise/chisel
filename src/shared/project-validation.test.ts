import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { assetSchema, dataTableSchema } from "./schemas";
import { findAssetReferences, findTableReferences, ProjectValidationSeverity, validateProjectContent } from "./project-validation";
import { AssetCategoryEnum, ColumnType } from "./types";

describe("project content validation", () => {
  it("reports missing reference targets and missing referenced rows", () => {
    const factionColumnId = nanoid();
    const factions = dataTableSchema.parse({
      columns: [],
      description: "Factions",
      id: "factions",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Factions",
      rows: [{ id: nanoid(), slug: "IRON_LEGION", values: [] }],
      version: 1
    });
    const units = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: factionColumnId,
          name: "faction",
          refTableId: "factions",
          required: true,
          type: ColumnType.ref,
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
          id: nanoid(),
          slug: "RIFLEMAN",
          values: [{ columnId: factionColumnId, type: ColumnType.ref, value: "MISSING_FACTION" }]
        }
      ],
      version: 1
    });

    const issues = validateProjectContent([factions, units], []);

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.error,
        message: 'Reference "MISSING_FACTION" does not exist in "Factions"'
      })
    );
    expect(findTableReferences([factions, units], "factions", new Set(["MISSING_FACTION"]))).toHaveLength(1);
  });

  it("reports asset reference misses and category mismatches", () => {
    const portraitColumnId = nanoid();
    const terrainAsset = assetSchema.parse({
      category: AssetCategoryEnum.terrainTexture,
      extension: "gppt",
      height: 1024,
      id: "FOREST_SOIL",
      name: "FOREST_SOIL",
      relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL.gppt",
      sizeBytes: 1024,
      width: 1024
    });
    const table = dataTableSchema.parse({
      columns: [
        {
          assetCategory: AssetCategoryEnum.image,
          defaultValue: "",
          id: portraitColumnId,
          name: "portrait",
          required: true,
          type: ColumnType.assetRef,
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
          id: nanoid(),
          slug: "RIFLEMAN",
          values: [{ columnId: portraitColumnId, type: ColumnType.assetRef, value: "FOREST_SOIL" }]
        },
        {
          id: nanoid(),
          slug: "ENGINEER",
          values: [{ columnId: portraitColumnId, type: ColumnType.assetRef, value: "MISSING_ASSET" }]
        }
      ],
      version: 1
    });

    const issues = validateProjectContent([table], [terrainAsset]);

    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.error,
        message: 'Asset "FOREST_SOIL" is TERRAIN_TEXTURE, expected IMAGE'
      })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.error,
        message: 'Asset "MISSING_ASSET" does not exist'
      })
    );
    expect(findAssetReferences([table], "FOREST_SOIL")).toHaveLength(1);
  });
});
