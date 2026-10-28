import { nanoid } from "nanoid"
import { describe, expect, it } from "vitest"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { ColumnType } from "../enums/column-type"
import { ProjectValidationSeverity } from "../enums/project-validation-severity"
import { localizationDocumentSchema } from "./localization"
import {
  findAssetReferences,
  findTableReferences,
  validateProjectContent,
} from "./project-validation"
import { assetSchema, dataTableSchema } from "./schemas"
describe("project content validation", () => {
  it("reports missing reference targets and missing referenced rows", () => {
    const factionColumnId = nanoid()
    const factions = dataTableSchema.parse({
      columns: [],
      description: "Factions",
      id: "factions",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Factions",
      rows: [{ id: nanoid(), slug: "IRON_LEGION", values: [] }],
      version: 1,
    })
    const units = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: factionColumnId,
          name: "faction",
          refTableId: "factions",
          required: true,
          type: ColumnType.REF,
          unique: false,
        },
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
          values: [{ columnId: factionColumnId, type: ColumnType.REF, value: "MISSING_FACTION" }],
        },
      ],
      version: 1,
    })
    const issues = validateProjectContent([factions, units], [])
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.ERROR,
        message: 'Reference "MISSING_FACTION" does not exist in "Factions"',
      })
    )
    expect(
      findTableReferences([factions, units], "factions", new Set(["MISSING_FACTION"]))
    ).toHaveLength(1)
  })
  it("validates every array reference and finds references to individual target rows", () => {
    const mapsColumnId = nanoid()
    const approvedMaps = dataTableSchema.parse({
      columns: [],
      description: "Approved maps",
      id: "terrain_approved_assets",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Approved Terrain Assets",
      rows: [
        { id: nanoid(), slug: "FOREST_OPEN", values: [] },
        { id: nanoid(), slug: "FOREST_RUINS", values: [] },
      ],
      version: 1,
    })
    const pools = dataTableSchema.parse({
      columns: [
        {
          defaultValue: [],
          id: mapsColumnId,
          name: "approved_maps",
          refTableId: approvedMaps.id,
          required: true,
          type: ColumnType.ARRAY_REF,
          unique: false,
        },
      ],
      description: "Map pools",
      id: "map_pools",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Map Pools",
      rows: [
        {
          id: nanoid(),
          slug: "FOREST_POOL",
          values: [
            {
              columnId: mapsColumnId,
              type: ColumnType.ARRAY_REF,
              value: ["FOREST_OPEN", "MISSING_MAP", "FOREST_OPEN"],
            },
          ],
        },
      ],
      version: 1,
    })
    const issues = validateProjectContent([approvedMaps, pools], [])
    expect(issues).toContainEqual(
      expect.objectContaining({
        message: 'Reference "MISSING_MAP" does not exist in "Approved Terrain Assets"',
      })
    )
    expect(issues).toContainEqual(
      expect.objectContaining({ message: "Array reference contains duplicate rows" })
    )
    expect(
      findTableReferences([approvedMaps, pools], approvedMaps.id, new Set(["FOREST_OPEN"]))
    ).toHaveLength(2)
  })
  it("reports asset reference misses and category mismatches", () => {
    const portraitColumnId = nanoid()
    const terrainAsset = assetSchema.parse({
      category: AssetCategoryEnum.TERRAIN_TEXTURE,
      extension: "tga",
      height: 1024,
      id: "FOREST_SOIL",
      name: "FOREST_SOIL",
      relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL.tga",
      sizeBytes: 1024,
      width: 1024,
    })
    const table = dataTableSchema.parse({
      columns: [
        {
          assetCategory: AssetCategoryEnum.IMAGE,
          defaultValue: "",
          id: portraitColumnId,
          name: "portrait",
          required: true,
          type: ColumnType.ASSET_REF,
          unique: false,
        },
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
          values: [
            { columnId: portraitColumnId, type: ColumnType.ASSET_REF, value: "FOREST_SOIL" },
          ],
        },
        {
          id: nanoid(),
          slug: "ENGINEER",
          values: [
            { columnId: portraitColumnId, type: ColumnType.ASSET_REF, value: "MISSING_ASSET" },
          ],
        },
      ],
      version: 1,
    })
    const issues = validateProjectContent([table], [terrainAsset])
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.ERROR,
        message: 'Asset "FOREST_SOIL" is TERRAIN_TEXTURE, expected IMAGE',
      })
    )
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.ERROR,
        message: 'Asset "MISSING_ASSET" does not exist',
      })
    )
    expect(findAssetReferences([table], "FOREST_SOIL")).toHaveLength(1)
  })
  it("reports missing translation references", () => {
    const descriptionColumnId = nanoid()
    const localization = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      keys: [
        {
          path: "UNIT.RIFLEMAN.NAME",
          values: {
            en: "Rifleman",
          },
        },
      ],
    })
    const table = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: descriptionColumnId,
          name: "description",
          required: true,
          type: ColumnType.TRANSLATION_REF,
          unique: false,
        },
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
          values: [
            {
              columnId: descriptionColumnId,
              type: ColumnType.TRANSLATION_REF,
              value: "UNIT.RIFLEMAN.DESCRIPTION",
            },
          ],
        },
      ],
      version: 1,
    })
    const issues = validateProjectContent([table], [], localization)
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: ProjectValidationSeverity.ERROR,
        message: 'Translation key "UNIT.RIFLEMAN.DESCRIPTION" does not exist',
      })
    )
  })
})
