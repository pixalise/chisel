import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization";
import { assetSchema, dataTableSchema, type Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";
import {
  createLove2dExportBundle,
  love2dAssetExportPath,
  love2dPackedTextureExportPaths,
  LOVE2D_GAME_DATA_EXPORT_ROOT
} from "./love2d-export";

describe("LÖVE export", () => {
  it("exports 1-based enum-indexed Structure-of-Arrays modules", () => {
    const healthId = nanoid();
    const speedId = nanoid();
    const metadataId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        { defaultValue: 1, id: healthId, name: "max_health", required: true, type: ColumnType.integer, unique: false },
        { defaultValue: 1, id: speedId, name: "move_speed", required: true, type: ColumnType.decimal, unique: false },
        { defaultValue: {}, id: metadataId, name: "metadata", required: true, type: ColumnType.json, unique: false }
      ],
      description: "Enemy definitions",
      id: "enemies",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Enemies",
      rows: [
        {
          id: nanoid(),
          slug: "ZOMBIE_BASIC",
          values: [
            { columnId: healthId, type: ColumnType.integer, value: 100 },
            { columnId: speedId, type: ColumnType.decimal, value: 1.5 },
            { columnId: metadataId, type: ColumnType.json, value: { rank: "basic", rewards: [1, 2] } }
          ]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "DarkTorch", path: "/tmp/darktorch" };

    const bundle = createLove2dExportBundle(project, [table], "2026-01-01T00:00:00.000Z", [], emptyLocalizationDocument);
    const file = bundle.files.find((entry) => entry.path === "gamedata/tables/enemies.lua");

    expect(bundle.files.every((entry) => entry.path.startsWith(`${LOVE2D_GAME_DATA_EXPORT_ROOT}/`))).toBe(true);
    expect(file?.content).toContain("INVALID = 0");
    expect(file?.content).toContain("ZOMBIE_BASIC = 1");
    expect(file?.content).toContain("MAX_HEALTH = { 100 }");
    expect(file?.content).toContain("MOVE_SPEED = { 1.5 }");
    expect(file?.content).toContain('METADATA = { { ["rank"] = "basic", ["rewards"] = { 1, 2 } } }');
    expect(file?.content).toContain("return data");
  });

  it("exports numeric references, assets, localization, input metadata, and a manifest", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.image,
      extension: "png",
      height: 32,
      id: "ignored",
      name: "UNIT_ICON",
      relativePath: ".chisel/assets/unit.png",
      sizeBytes: 100,
      width: 32
    });
    const localization = localizationDocumentSchema.parse({
      ...emptyLocalizationDocument,
      keys: [{ path: "UNITS.NAME", values: { en: "Unit" } }]
    });
    const targetTable = dataTableSchema.parse({
      columns: [],
      description: "Classes",
      id: "classes",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Classes",
      rows: [{ id: nanoid(), slug: "SCOUT", values: [] }],
      version: 1
    });
    const classColumnId = nanoid();
    const assetColumnId = nanoid();
    const translationColumnId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: classColumnId,
          name: "class",
          refTableId: targetTable.id,
          required: true,
          type: ColumnType.ref,
          unique: false
        },
        {
          assetCategory: AssetCategoryEnum.image,
          defaultValue: "",
          id: assetColumnId,
          name: "icon",
          required: true,
          type: ColumnType.assetRef,
          unique: false
        },
        { defaultValue: "", id: translationColumnId, name: "name", required: true, type: ColumnType.translationRef, unique: false }
      ],
      description: "Units",
      id: "units",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Units",
      rows: [
        {
          id: nanoid(),
          slug: "PLAYER_SCOUT",
          values: [
            { columnId: classColumnId, type: ColumnType.ref, value: "SCOUT" },
            { columnId: assetColumnId, type: ColumnType.assetRef, value: asset.id },
            { columnId: translationColumnId, type: ColumnType.translationRef, value: "UNITS.NAME" }
          ]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "DarkTorch", path: "/tmp/darktorch" };

    const bundle = createLove2dExportBundle(project, [targetTable, table], "2026-01-01T00:00:00.000Z", [asset], localization);
    const tableFile = bundle.files.find((entry) => entry.path.endsWith("tables/units.lua"));
    const assetsFile = bundle.files.find((entry) => entry.path === "gamedata/asset_manager.lua");
    const localizationFile = bundle.files.find((entry) => entry.path === "gamedata/localization.lua");
    const manifestFile = bundle.files.find((entry) => entry.path === "gamedata/manifest.lua");

    expect(tableFile?.content).toContain("CLASS = { 1 }");
    expect(tableFile?.content).toContain("ICON = { 1 }");
    expect(tableFile?.content).toContain("NAME = { 1 }");
    expect(assetsFile?.content).toContain('path = "gamedata/assets/image/unit_icon.png"');
    expect(assetsFile?.content).toContain("function AssetManager.image(assetId)");
    expect(assetsFile?.content).toContain("IMAGE = {");
    expect(assetsFile?.content).toContain("UNIT_ICON = 1");
    expect(assetsFile?.content).toContain(
      "local caches = { images = {}, dataImages = {}, fonts = {}, shaders = {}, audio = {}, text = {} }"
    );
    expect(localizationFile?.content).toContain('VALUES = { { "Unit" } }');
    expect(localizationFile?.content).toContain("function localization.get(id, locale)");
    expect(manifestFile?.content).toContain('["units"] = { module = "gamedata.tables.units", count = 1 }');
    expect(manifestFile?.content).toContain('module = "gamedata.asset_manager"');
    expect(manifestFile?.content).toContain("INPUT = { module = nil, enabled = false }");
  });

  it("uses unpacked PNG paths beneath gamedata for packed terrain textures", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.terrainTexture,
      extension: "gppt",
      height: 16,
      id: "ignored",
      name: "GROUND",
      relativePath: ".chisel/assets/ground.gppt",
      sizeBytes: 100,
      width: 16
    });

    expect(love2dAssetExportPath(asset)).toBe("gamedata/assets/terrain_texture/ground");
    expect(love2dPackedTextureExportPaths(asset)).toEqual({
      albedoHeight: "gamedata/assets/terrain_texture/ground/albedo_height.png",
      normalRoughness: "gamedata/assets/terrain_texture/ground/normal_roughness.png"
    });
  });

  it("exports audio assets beneath the generated audio root", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.audio,
      extension: "wav",
      height: 0,
      id: "BLADE_SWING",
      name: "BLADE_SWING",
      relativePath: ".chisel/assets/AUDIO/BLADE_SWING.wav",
      sizeBytes: 100,
      width: 0
    });

    expect(love2dAssetExportPath(asset)).toBe("gamedata/assets/audio/blade_swing.wav");
  });

  it("rejects JSON null rather than emitting a lossy Lua table hole", () => {
    const metadataId = nanoid();
    const table = dataTableSchema.parse({
      columns: [{ defaultValue: {}, id: metadataId, name: "metadata", required: true, type: ColumnType.json, unique: false }],
      description: "Null metadata",
      id: "metadata",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Metadata",
      rows: [
        {
          id: nanoid(),
          slug: "ENTRY",
          values: [{ columnId: metadataId, type: ColumnType.json, value: { nullable: null } }]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "DarkTorch", path: "/tmp/darktorch" };

    expect(() => createLove2dExportBundle(project, [table], "2026-01-01", [], emptyLocalizationDocument)).toThrow(
      "LÖVE export cannot serialize JSON null without losing its meaning."
    );
  });

  it("rejects table ids that normalize to the same Lua module path", () => {
    function emptyTable(id: string) {
      return dataTableSchema.parse({
        columns: [],
        description: id,
        id,
        kind: "user",
        lastChangeAt: "2026-01-01T00:00:00.000Z",
        name: id,
        rows: [],
        version: 1
      });
    }
    const project: Project = { id: nanoid(), name: "DarkTorch", path: "/tmp/darktorch" };

    expect(() =>
      createLove2dExportBundle(project, [emptyTable("enemy-data"), emptyTable("enemy_data")], "2026-01-01", [], emptyLocalizationDocument)
    ).toThrow('both map to "gamedata/tables/enemy_data.lua"');
  });
});
