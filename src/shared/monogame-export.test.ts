import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization";
import { assetSchema, dataTableSchema, type Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";
import { createMonoGameExportBundle, monoGameAssetExportPath } from "./monogame-export";

describe("MonoGame export", () => {
  it("exports MonoGame-native scalar, vector, color, and JSON table data", () => {
    const healthId = nanoid();
    const speedId = nanoid();
    const positionId = nanoid();
    const colorId = nanoid();
    const metadataId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        { defaultValue: 1, id: healthId, name: "max_health", required: true, type: ColumnType.integer, unique: false },
        { defaultValue: 1, id: speedId, name: "move_speed", required: true, type: ColumnType.decimal, unique: false },
        { defaultValue: [0, 0], id: positionId, name: "position", required: true, type: ColumnType.vector2, unique: false },
        { defaultValue: "#000000", id: colorId, name: "tint", required: true, type: ColumnType.color, unique: false },
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
            { columnId: positionId, type: ColumnType.vector2, value: [2, 3.5] },
            { columnId: colorId, type: ColumnType.color, value: "#10203080" },
            { columnId: metadataId, type: ColumnType.json, value: { elite: true } }
          ]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "Black Torch", path: "/tmp/black-torch" };

    const bundle = createMonoGameExportBundle(project, [table], "2026-01-01T00:00:00.000Z", [], emptyLocalizationDocument);
    const file = bundle.files.find((entry) => entry.path === "GameData/Generated/ChiselEnemies.g.cs");

    expect(file?.content).toContain("public enum ChiselEnemiesId");
    expect(file?.content).toContain("ZOMBIE_BASIC = 0");
    expect(file?.content).toContain("public static readonly int[] MaxHealth = new int[] { 100 };");
    expect(file?.content).toContain("public static readonly float[] MoveSpeed = new float[] { 1.5f };");
    expect(file?.content).toContain("new Vector2(2.0f, 3.5f)");
    expect(file?.content).toContain("new Color(16, 32, 48, 128)");
    expect(file?.content).toContain('public static readonly string[] Metadata = new string[] { "{\\"elite\\":true}" };');
  });

  it("exports typed references, asset paths, localization, input, and a manifest", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.image,
      extension: "png",
      height: 32,
      id: "ignored",
      name: "UNIT_ICON",
      relativePath: ".chisel/assets/IMAGE/UNIT_ICON.png",
      sizeBytes: 100,
      width: 32
    });
    const localization = localizationDocumentSchema.parse({
      ...emptyLocalizationDocument,
      keys: [{ path: "UNITS.NAME", values: { en: "Unit" }, placeholders: [] }]
    });
    const classesColumnId = nanoid();
    const assetColumnId = nanoid();
    const translationColumnId = nanoid();
    const classTable = dataTableSchema.parse({
      columns: [],
      description: "Classes",
      id: "classes",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Classes",
      rows: [{ id: nanoid(), slug: "SCOUT", values: [] }],
      version: 1
    });
    const unitTable = dataTableSchema.parse({
      columns: [
        {
          defaultValue: [],
          id: classesColumnId,
          name: "classes",
          refTableId: classTable.id,
          required: true,
          type: ColumnType.arrayRef,
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
          slug: "SCOUT",
          values: [
            { columnId: classesColumnId, type: ColumnType.arrayRef, value: ["SCOUT"] },
            { columnId: assetColumnId, type: ColumnType.assetRef, value: asset.id },
            { columnId: translationColumnId, type: ColumnType.translationRef, value: "UNITS.NAME" }
          ]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "Black Torch", path: "/tmp/black-torch" };

    const bundle = createMonoGameExportBundle(project, [classTable, unitTable], "2026-01-01T00:00:00.000Z", [asset], localization);
    const tableFile = bundle.files.find((entry) => entry.path.endsWith("ChiselUnits.g.cs"));
    const assetsFile = bundle.files.find((entry) => entry.path.endsWith("ChiselAssets.g.cs"));
    const localizationFile = bundle.files.find((entry) => entry.path.endsWith("ChiselLocalization.g.cs"));

    expect(tableFile?.content).toContain("new ChiselClassesId[] { ChiselClassesId.SCOUT }");
    expect(tableFile?.content).toContain("ChiselAssetId.UNIT_ICON");
    expect(tableFile?.content).toContain("ChiselLocalizationId.UNITS_NAME");
    expect(monoGameAssetExportPath(asset)).toBe("Content/Chisel/image/unit_icon.png");
    expect(assetsFile?.content).toContain('"Chisel/image/unit_icon.png"');
    expect(assetsFile?.content).toContain("throw new ArgumentOutOfRangeException");
    expect(localizationFile?.content).toContain('new string[] { "Unit" }');
    expect(bundle.files.some((entry) => entry.path === "GameData/Generated/ChiselManifest.g.cs")).toBe(true);
  });
});
