import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization";
import { assetSchema, dataTableSchema, type Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";
import { createHaxeFlixelExportBundle } from "./haxeflixel-export";

describe("HaxeFlixel export", () => {
  it("exports typed enum-indexed structure-of-arrays modules", () => {
    const healthId = nanoid();
    const speedId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        { defaultValue: 1, id: healthId, name: "max_health", required: true, type: ColumnType.integer, unique: false },
        { defaultValue: 1, id: speedId, name: "move_speed", required: true, type: ColumnType.decimal, unique: false }
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
            { columnId: speedId, type: ColumnType.decimal, value: 1.5 }
          ]
        }
      ],
      version: 1
    });
    const project: Project = { id: nanoid(), name: "Black Torch", path: "/tmp/black-torch" };

    const bundle = createHaxeFlixelExportBundle(project, [table], "2026-01-01T00:00:00.000Z", [], emptyLocalizationDocument);
    const file = bundle.files.find((entry) => entry.path === "source/gamedata/ChiselEnemies.hx");

    expect(file?.content).toContain("package gamedata;");
    expect(file?.content).toContain("enum abstract ChiselEnemiesId(Int) from Int to Int");
    expect(file?.content).toContain("var ZOMBIE_BASIC = 0;");
    expect(file?.content).toContain("public static final MAX_HEALTH:Array<Int> = [100];");
    expect(file?.content).toContain("public static final MOVE_SPEED:Array<Float> = [1.5];");
  });

  it("exports typed references, assets, localization, and a manifest", () => {
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
    const assetColumnId = nanoid();
    const translationColumnId = nanoid();
    const classesColumnId = nanoid();
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
    const table = dataTableSchema.parse({
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

    const bundle = createHaxeFlixelExportBundle(project, [classTable, table], "2026-01-01T00:00:00.000Z", [asset], localization);
    const tableFile = bundle.files.find((entry) => entry.path.endsWith("ChiselUnits.hx"));
    const assetsFile = bundle.files.find((entry) => entry.path.endsWith("ChiselAssets.hx"));
    const localizationFile = bundle.files.find((entry) => entry.path.endsWith("ChiselLocalization.hx"));

    expect(tableFile?.content).toContain("ChiselAssetId.UNIT_ICON");
    expect(tableFile?.content).toContain(
      "public static final CLASSES:Array<Array<ChiselClasses.ChiselClassesId>> = [[ChiselClasses.ChiselClassesId.SCOUT]];"
    );
    expect(tableFile?.content).toContain("ChiselLocalizationId.UNITS_NAME");
    expect(assetsFile?.content).toContain('"assets/chisel/image/unit_icon.png"');
    expect(assetsFile?.content).toContain("function path(id:ChiselAssetId):String {\n\t\treturn PATHS[id];\n\t}");
    expect(localizationFile?.content).toContain("if (localeIndex < 0) {\n\t\t\tthrow 'Unknown locale: $locale';\n\t\t}");
    expect(localizationFile?.content).toContain('public static final VALUES:Array<Array<String>> = [["Unit"]]');
    expect(bundle.files.some((entry) => entry.path === "source/gamedata/ChiselManifest.hx")).toBe(true);
  });
});
