import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "../renderer/constants/system-tables";
import { emptyLocalizationDocument } from "./localization";
import { dataTableSchema, systemDataTableSchema, type Project } from "./schemas";
import { ColumnType, InputKeyEnum } from "./types";
import { createTealExportBundle, TEAL_MANIFEST_PATH } from "./teal-export";

const project: Project = { id: nanoid(), name: "Farbound", path: "/tmp/farbound" };

function inputTable() {
  const sortOrderColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "sort_order");
  const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings");
  if (!sortOrderColumn || !bindingsColumn) {
    throw new Error("The input bindings system table is missing required columns.");
  }
  return systemDataTableSchema.parse({
    ...INPUT_BINDINGS_TABLE,
    rows: [
      {
        id: nanoid(),
        slug: "CONFIRM",
        values: [
          { columnId: sortOrderColumn.id, type: ColumnType.integer, value: 0 },
          { columnId: bindingsColumn.id, type: ColumnType.enumArray, value: [InputKeyEnum.KeyEnter] }
        ]
      }
    ]
  });
}

describe("Teal export", () => {
  it("exports typed Teal modules with the same runtime API as the LÖVE target", () => {
    const healthColumnId = nanoid();
    const tagsColumnId = nanoid();
    const metadataColumnId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        { defaultValue: 1, id: healthColumnId, name: "max_health", required: true, type: ColumnType.integer, unique: false },
        { defaultValue: [], id: tagsColumnId, name: "tags", required: true, type: ColumnType.enumArray, unique: false },
        { defaultValue: {}, id: metadataColumnId, name: "metadata", required: true, type: ColumnType.json, unique: false }
      ],
      description: "Enemy definitions",
      id: "enemies",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Enemies",
      rows: [
        {
          id: nanoid(),
          slug: "BASIC",
          values: [
            { columnId: healthColumnId, type: ColumnType.integer, value: 10 },
            { columnId: tagsColumnId, type: ColumnType.enumArray, value: ["UNDEAD"] },
            { columnId: metadataColumnId, type: ColumnType.json, value: { rank: 1 } }
          ]
        }
      ],
      version: 1
    });

    const bundle = createTealExportBundle(project, [table, inputTable()], "2026-01-01T00:00:00.000Z", [], emptyLocalizationDocument);
    const tableFile = bundle.files.find((file) => file.path === "gamedata/tables/enemies.tl");
    const inputFile = bundle.files.find((file) => file.path === "gamedata/input.tl");
    const assetsFile = bundle.files.find((file) => file.path === "gamedata/asset_manager.tl");
    const localizationFile = bundle.files.find((file) => file.path === "gamedata/localization.tl");
    const manifestFile = bundle.files.find((file) => file.path === TEAL_MANIFEST_PATH);

    expect(bundle.files.every((file) => !file.path.endsWith(".lua"))).toBe(true);
    expect(tableFile?.content).toContain("local record Data");
    expect(tableFile?.content).toContain("MAX_HEALTH: {integer}");
    expect(tableFile?.content).toContain("TAGS: {{string}}");
    expect(tableFile?.content).toContain("METADATA: {any}");
    expect(tableFile?.content).toContain("local data: Data = {");
    expect(inputFile?.content).toContain("local input: Input = {");
    expect(inputFile?.content).toContain("function input.isActionPressed(action: integer): boolean");
    expect(inputFile?.content).toContain("function input.endFrame(): nil");
    expect(assetsFile?.content).toContain("local AssetManager = {");
    expect(assetsFile?.content).toContain("function AssetManager.image(assetId)");
    expect(localizationFile?.content).toContain("local localization: Localization = {");
    expect(localizationFile?.content).toContain("function localization.get(id: integer, locale: string): string");
    expect(manifestFile?.content).toContain('"gamedata/tables/enemies.tl"');
    expect(manifestFile?.content).not.toContain(".lua");
  });
});
