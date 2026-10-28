import { nanoid } from "nanoid"
import { describe, expect, it } from "vitest"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { ColumnType } from "../enums/column-type"
import {
  emptyLocalizationDocument,
  localizationDocumentSchema,
  validateLocalizationDocument,
} from "./localization"
import { luauString, luauValue } from "./luau-serialization"
import { createRobloxExportBundle } from "./roblox-export"
import {
  assetSchema,
  dataTableSchema,
  type DataTableSchema,
  type DataColumnDefinition,
} from "./schemas"
const project = { id: nanoid(), name: "Roblox Test", path: "/tmp/roblox-test" }
const asset = assetSchema.parse({
  id: "PORTRAIT",
  name: "PORTRAIT",
  category: AssetCategoryEnum.UI,
  extension: "png",
  relativePath: ".chisel/assets/UI/PORTRAIT.png",
  width: 1,
  height: 1,
  sizeBytes: 1,
  robloxAssetId: "123456789012345678",
})
const localization = localizationDocumentSchema.parse({
  ...emptyLocalizationDocument,
  locales: ["en", "sl_SI"],
  keys: [
    { path: "UI.TITLE", values: { en: "Hello {string:name}", sl_SI: "Zdravo {string:name}" } },
  ],
})
function column(
  name: string,
  type: ColumnType,
  defaultValue: DataColumnDefinition["defaultValue"],
  extra: Partial<DataColumnDefinition> = {}
): DataColumnDefinition {
  return { id: nanoid(), name, type, defaultValue, required: true, unique: false, ...extra }
}
function table(
  columns: DataColumnDefinition[],
  values = columns.map((entry) => entry.defaultValue)
): DataTableSchema {
  return dataTableSchema.parse({
    id: "units",
    name: "Units",
    description: "",
    lastChangeAt: "",
    version: 1,
    columns,
    rows: [
      {
        id: nanoid(),
        slug: "SCOUT",
        values: columns.map((entry, index) => ({
          columnId: entry.id,
          type: entry.type,
          value: values[index],
        })),
      },
    ],
  })
}
function bundle(tables: DataTableSchema[] = []) {
  return createRobloxExportBundle(project, tables, "2026-10-28T00:00:00Z", [asset], localization)
}
describe("Roblox Luau export", () => {
  it("exports native values, stable identities, and deeply frozen arrays", () => {
    const units = table([
      column("name", ColumnType.STRING, "Scout"),
      column("health", ColumnType.INTEGER, 25),
      column("speed", ColumnType.DECIMAL, 1.5),
      column("active", ColumnType.BOOLEAN, false),
      column("position", ColumnType.VECTOR_3, [1, 2, 3]),
      column("size", ColumnType.VECTOR_2, [4, 5]),
      column("tint", ColumnType.COLOR, "#ff8000"),
      column("weights", ColumnType.VECTOR_4, [1, 2, 3, 4]),
      column("tags", ColumnType.ENUM_ARRAY, ["FAST"]),
      column("metadata", ColumnType.JSON, { armor: 2 }),
    ])
    const output = bundle([units])
    const module = output.files.find(
      (file) => file.path === "ChiselData/tables/units.luau"
    )!.content
    expect(module).toContain('TABLE_ID = "units"')
    expect(module).toContain('["SCOUT"] = 1')
    expect(module).toContain('SLUGS = table.freeze({ "SCOUT" })')
    expect(module).toContain("Vector3.new(1, 2, 3)")
    expect(module).toContain("Vector2.new(4, 5)")
    expect(module).toContain("Color3.fromRGB(255, 128, 0)")
    expect(module).toContain('["WEIGHTS"] = table.freeze({ table.freeze({ 1, 2, 3, 4 }) })')
    expect(module).toContain('["ACTIVE"] = table.freeze({ false })')
    expect(
      output.files
        .filter((file) => file.path.endsWith(".luau"))
        .every((file) => file.content.startsWith("--!strict"))
    ).toBe(true)
  })
  it("resolves row, array, asset, and localization references to dense IDs", () => {
    const units = table([
      column("portrait", ColumnType.ASSET_REF, "PORTRAIT"),
      column("title", ColumnType.TRANSLATION_REF, "UI.TITLE"),
      column("ally", ColumnType.REF, "SCOUT", { refTableId: "units" }),
      column("squad", ColumnType.ARRAY_REF, ["SCOUT"], { refTableId: "units" }),
      column("optional", ColumnType.REF, "", { refTableId: "units", required: false }),
    ])
    const content = bundle([units]).files.find((file) =>
      file.path.endsWith("tables/units.luau")
    )!.content
    for (const field of ["PORTRAIT", "TITLE", "ALLY"]) {
      expect(content).toContain(`["${field}"] = table.freeze({ 1 })`)
    }
    expect(content).toContain('["SQUAD"] = table.freeze({ table.freeze({ 1 }) })')
    expect(content).toContain('["OPTIONAL"] = table.freeze({ 0 })')
  })
  it("uses Roblox content IDs and relative ModuleScript requires", () => {
    const output = bundle([table([])])
    const assets = output.files.find((file) => file.path.endsWith("/assets.luau"))!.content
    expect(assets).toContain("rbxassetid://123456789012345678")
    expect(assets).not.toContain(".chisel/assets")
    expect(output.files.find((file) => file.path.endsWith("manifest.luau"))!.content).toContain(
      'require(script.Parent.tables["units"])'
    )
    expect(output.files.some((file) => file.path.includes("input.luau"))).toBe(false)
  })
  it("requires published asset IDs and rejects malformed IDs", () => {
    expect(() =>
      createRobloxExportBundle(
        project,
        [],
        "",
        [{ ...asset, robloxAssetId: undefined }],
        localization
      )
    ).toThrow("published Roblox asset ID")
    for (const robloxAssetId of ["0", "-1", "1.5", "rbxassetid://123", "abc"]) {
      expect(assetSchema.safeParse({ ...asset, robloxAssetId }).success).toBe(false)
    }
  })
  it("rejects broken references and missing locale values", () => {
    expect(() => bundle([table([column("portrait", ColumnType.ASSET_REF, "MISSING")])])).toThrow(
      "does not exist"
    )
    const invalid = structuredClone(localization)
    delete invalid.keys[0].values.sl_SI
    expect(() => createRobloxExportBundle(project, [], "", [asset], invalid)).toThrow(
      "missing locale"
    )
  })
  it("rejects mismatched types, duplicate cells, and unknown columns", () => {
    const units = table([column("health", ColumnType.INTEGER, 25)])
    units.rows[0].values[0] = {
      columnId: units.columns[0].id,
      type: ColumnType.STRING,
      value: "wrong",
    }
    expect(() => bundle([units])).toThrow("mismatched column")
    const duplicate = table([column("health", ColumnType.INTEGER, 25)])
    duplicate.rows[0].values.push(duplicate.rows[0].values[0])
    expect(() => bundle([duplicate])).toThrow("Duplicate cell")
    const unknown = table([])
    unknown.rows[0].values.push({ columnId: nanoid(), type: ColumnType.INTEGER, value: 1 })
    expect(() => bundle([unknown])).toThrow("Unknown")
  })
  it("enforces required, range, enum, and uniqueness constraints", () => {
    expect(() => bundle([table([column("name", ColumnType.STRING, "")])])).toThrow("required")
    expect(() => bundle([table([column("health", ColumnType.INTEGER, -1, { min: 0 })])])).toThrow(
      "minimum"
    )
    expect(() =>
      bundle([table([column("kind", ColumnType.ENUM, "BAD", { possibleValues: ["GOOD"] })])])
    ).toThrow("invalid enum")
    const units = table([column("name", ColumnType.STRING, "Scout", { unique: true })])
    units.rows.push({ ...units.rows[0], id: nanoid(), slug: "RANGER" })
    expect(() => bundle([units])).toThrow("must be unique")
  })
  it("rejects module paths and field names that collide", () => {
    const units = table([])
    expect(() => bundle([units, { ...units, id: "UNITS" }])).toThrow("Duplicate table module path")
    expect(() => bundle([table([column("id", ColumnType.INTEGER, 1)])])).toThrow(
      "Duplicate exported field"
    )
    expect(() =>
      bundle([
        table([
          column("max health", ColumnType.INTEGER, 1),
          column("max_health", ColumnType.INTEGER, 2),
        ]),
      ])
    ).toThrow("Duplicate exported field")
  })
  it("rejects JSON null instead of silently losing keys or array entries", () => {
    expect(() => bundle([table([column("metadata", ColumnType.JSON, { value: null })])])).toThrow(
      "JSON null"
    )
  })
  it("escapes control characters, strings, and source-looking text", () => {
    expect(luauString('a\u0000b\n"\\')).toBe('"a\\000b\\010\\"\\\\"')
    expect(luauValue({ end: '"); error("injection") --' })).toBe(
      'table.freeze({ ["end"] = "\\"); error(\\"injection\\") --" })'
    )
    expect(() => luauValue(Infinity)).toThrow()
  })
  it("exports localized tokens, styles, tooltips and icon content IDs", () => {
    const rich = localizationDocumentSchema.parse({
      ...emptyLocalizationDocument,
      styles: [{ slug: "BOLD", bold: true }],
      tooltips: [
        { slug: "HELP", titleKey: "UI.HELP", descriptionKey: "UI.HELP", iconAssetId: "PORTRAIT" },
      ],
      keys: [
        {
          path: "UI.HELP",
          values: {
            en: "<style:BOLD>{int:count}</style> <tooltip:HELP>help</tooltip> <icon:PORTRAIT/>",
          },
        },
      ],
    })
    const output = createRobloxExportBundle(project, [], "", [asset], rich).files.find((file) =>
      file.path.endsWith("localization.luau")
    )!.content
    expect(output).toContain('["kind"] = "styleStart"')
    expect(output).toContain('["kind"] = "tooltipStart"')
    expect(output).toContain('["kind"] = "icon"')
    expect(output).toContain('["type"] = "int"')
    expect(output).toContain("function localization.richText")
  })
  it("validates flattened localization IDs instead of obsolete engine namespaces", () => {
    const document = localizationDocumentSchema.parse({
      ...emptyLocalizationDocument,
      keys: [
        { path: "UI.CLASS", values: { en: "Class" } },
        { path: "UI.CLASS.NAME", values: { en: "Name" } },
      ],
    })
    expect(validateLocalizationDocument(document)).toEqual([])
    document.keys.push({ path: "UI_CLASS.NAME", values: { en: "Collision" }, placeholders: [] })
    expect(validateLocalizationDocument(document)).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining("collides with generated Luau ID"),
      })
    )
  })
  it("exports authored tables without adding an input runtime", () => {
    const definitions = table([column("bindings", ColumnType.ENUM_ARRAY, ["CONFIRM"])])
    definitions.id = "input_bindings"
    const output = bundle([definitions])
    expect(output.files.map((file) => file.path).sort()).toEqual([
      "ChiselData/assets.d.ts",
      "ChiselData/assets.luau",
      "ChiselData/localization.d.ts",
      "ChiselData/localization.luau",
      "ChiselData/manifest.d.ts",
      "ChiselData/manifest.luau",
      "ChiselData/tables/input_bindings.d.ts",
      "ChiselData/tables/input_bindings.luau",
      "ChiselData/types.d.ts",
    ])
    const manifest = output.files.find((file) => file.path.endsWith("/manifest.luau"))
    expect(manifest?.content).toContain('require(script.Parent.tables["input_bindings"])')
    expect(manifest?.content).not.toContain("INPUT")
    expect(output.files.some((file) => file.content.includes("UserInputService"))).toBe(false)
  })
})
