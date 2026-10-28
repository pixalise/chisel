import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { ColumnType } from "../enums/column-type"
import { LocalizationProblemSeverity } from "../enums/localization-problem-severity"
import { ProjectValidationSeverity } from "../enums/project-validation-severity"
import { constantCase } from "./asset-paths"
import { validateLocalizationDocument, type LocalizationDocument } from "./localization"
import { LUAU_HEADER, luauString, luauValue, type LuauExportFile } from "./luau-serialization"
import { validateProjectContent } from "./project-validation"
import { renderRobloxLocalization } from "./roblox-localization-export"
import { renderRobloxTypescript } from "./roblox-typescript-export"
import {
  assetsJsonSchema,
  projectSchema,
  typedDataColumnValueSchema,
  validatedDataTableSchema,
  type DataTableSchema,
  type Asset,
  type DataColumnDefinition,
  type DataTableRow,
  type Project,
} from "./schemas"
export const ROBLOX_EXPORT_ROOT = "ChiselData"
export const ROBLOX_MANIFEST_PATH = `${ROBLOX_EXPORT_ROOT}/manifest.luau`
export interface RobloxExportBundle {
  files: LuauExportFile[]
}
function valueFor(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue
}
function assertUnique(values: string[], description: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${description}: ${value}`)
    }
    seen.add(value)
  }
}
function validateTable(table: DataTableSchema): void {
  assertUnique(
    table.rows.map((row) => row.id),
    `row ID in ${table.name}`
  )
  const fields = table.columns.map((column) => constantCase(column.name))
  assertUnique(["COUNT", "ID", "SLUGS", "TABLE_ID", ...fields], `exported field in ${table.name}`)
  for (const field of fields) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid Luau column name: ${field}`)
    }
  }
  for (const row of table.rows) {
    assertUnique(
      row.values.map((value) => value.columnId),
      `cell in ${table.name}.${row.slug}`
    )
    for (const cell of row.values) {
      const column = table.columns.find((entry) => entry.id === cell.columnId)
      if (!column || column.type !== cell.type) {
        throw new Error(
          `Unknown or mismatched column in ${table.name}.${row.slug}: ${cell.columnId}`
        )
      }
    }
  }
  for (const column of table.columns) {
    const seen = new Set<string>()
    for (const row of table.rows) {
      const value = valueFor(row, column)
      const location = `${table.name}.${row.slug}.${column.name}`
      typedDataColumnValueSchema.parse({ columnId: column.id, type: column.type, value })
      const empty =
        value === "" ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0)
      if (column.required && empty) {
        throw new Error(`${location} is required.`)
      }
      if (typeof value === "number") {
        if (column.min !== undefined && value < column.min) {
          throw new Error(`${location} is below its minimum.`)
        }
        if (column.max !== undefined && value > column.max) {
          throw new Error(`${location} exceeds its maximum.`)
        }
      }
      if (Array.isArray(value) && column.type.startsWith("vector")) {
        if (
          value.some(
            (entry) =>
              (column.min !== undefined && Number(entry) < column.min) ||
              (column.max !== undefined && Number(entry) > column.max)
          )
        ) {
          throw new Error(`${location} has a vector component outside its bounds.`)
        }
      }
      if (
        (column.type === ColumnType.ENUM_ARRAY || column.type === ColumnType.ARRAY_REF) &&
        Array.isArray(value) &&
        column.max !== undefined &&
        value.length > column.max
      ) {
        throw new Error(`${location} has too many entries.`)
      }
      if (
        typeof value === "string" &&
        column.maxChars !== undefined &&
        value.length > column.maxChars
      ) {
        throw new Error(`${location} is too long.`)
      }
      if (
        column.possibleValues?.length &&
        !empty &&
        (column.type === ColumnType.ENUM || column.type === ColumnType.ENUM_ARRAY)
      ) {
        const entries = Array.isArray(value) ? value : [value]
        if (entries.some((entry) => !column.possibleValues!.includes(String(entry)))) {
          throw new Error(`${location} has an invalid enum value.`)
        }
      }
      if (column.unique && !empty) {
        const key = JSON.stringify(value)
        if (seen.has(key)) {
          throw new Error(`${location} must be unique.`)
        }
        seen.add(key)
      }
    }
  }
}
interface References {
  assets: Map<string, number>
  translations: Map<string, number>
  rows: Map<string, Map<string, number>>
}
function reference(
  value: unknown,
  ids: Map<string, number> | undefined,
  description: string
): number {
  if (value === "" || value === null || value === undefined) {
    return 0
  }
  const id = typeof value === "string" ? ids?.get(value) : undefined
  if (id === undefined) {
    throw new Error(`Unresolved ${description}: ${String(value)}`)
  }
  return id
}
function cellValue(value: unknown, column: DataColumnDefinition, refs: References): string {
  if (column.type === ColumnType.REF) {
    return String(reference(value, refs.rows.get(column.refTableId!), column.name))
  }
  if (column.type === ColumnType.ARRAY_REF) {
    if (!Array.isArray(value)) {
      throw new Error(`${column.name} requires an array of row references.`)
    }
    return luauValue(
      value.map((entry) => reference(entry, refs.rows.get(column.refTableId!), column.name))
    )
  }
  if (column.type === ColumnType.ASSET_REF) {
    return String(reference(value, refs.assets, column.name))
  }
  if (column.type === ColumnType.TRANSLATION_REF) {
    return String(reference(value, refs.translations, column.name))
  }
  if (column.type === ColumnType.VECTOR_2 || column.type === ColumnType.VECTOR_3) {
    if (!Array.isArray(value)) {
      throw new Error(`${column.name} requires a vector.`)
    }
    return `${column.type === ColumnType.VECTOR_2 ? "Vector2" : "Vector3"}.new(${value.join(", ")})`
  }
  if (column.type === ColumnType.COLOR) {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) {
      throw new Error(`${column.name} requires a #RRGGBB color.`)
    }
    return `Color3.fromRGB(${[1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16)).join(", ")})`
  }
  return luauValue(value)
}
function renderTable(table: DataTableSchema, refs: References): LuauExportFile {
  const fields = [
    `TABLE_ID = ${luauString(table.id)}`,
    `COUNT = ${table.rows.length}`,
    `ID = ${luauValue({ INVALID: 0, ...Object.fromEntries(table.rows.map((row, index) => [row.slug, index + 1])) })}`,
    `SLUGS = ${luauValue(table.rows.map((row) => row.slug))}`,
    ...table.columns.map(
      (column) =>
        `[${luauString(constantCase(column.name))}] = table.freeze({ ${table.rows.map((row) => cellValue(valueFor(row, column), column, refs)).join(", ")} })`
    ),
  ]
  if (table.rows.some((row) => row.slug === "INVALID")) {
    throw new Error(`${table.name} uses reserved row slug INVALID.`)
  }
  return {
    path: `${ROBLOX_EXPORT_ROOT}/tables/${table.id}.luau`,
    content: `${LUAU_HEADER}\nlocal data = {\n    ${fields.join(",\n    ")},\n}\n\nexport type Data = typeof(data)\nreturn table.freeze(data)\n`,
  }
}
function renderAssets(assets: Asset[]): LuauExportFile {
  const categories = Object.fromEntries(
    Object.values(AssetCategoryEnum).map((category) => [
      category,
      Object.fromEntries(
        assets.flatMap((asset, index) =>
          asset.category === category ? [[asset.id, index + 1]] : []
        )
      ),
    ])
  )
  const records = assets.map((asset) => ({
    slug: asset.id,
    category: asset.category,
    contentId: `rbxassetid://${asset.robloxAssetId}`,
  }))
  return {
    path: `${ROBLOX_EXPORT_ROOT}/assets.luau`,
    content: `${LUAU_HEADER}
local records: { { slug: string, category: string, contentId: string } } = ${luauValue(records)} :: any
local assets = {
    ID = ${luauValue({ INVALID: 0, ...Object.fromEntries(assets.map((asset, index) => [asset.id, index + 1])) })},
    CATEGORY = ${luauValue(categories)},
    COUNT = ${assets.length},
    RECORDS = records,
}
function assets.contentId(id: number, category: string?): string
    assert(id % 1 == 0 and id >= 1 and id <= assets.COUNT, "Invalid Chisel asset ID")
    local record = records[id]
    assert(category == nil or record.category == category, "Chisel asset category mismatch")
    return record.contentId
end
return table.freeze(assets)
`,
  }
}
export function createRobloxExportBundle(
  project: Project,
  tables: DataTableSchema[],
  exportedAt: string,
  assets: Asset[],
  localization: LocalizationDocument
): RobloxExportBundle {
  projectSchema.parse(project)
  const parsedTables = tables.map((table) => validatedDataTableSchema.parse(table))
  assertUnique(
    parsedTables.map((table) => table.id.toLowerCase()),
    "table module path"
  )
  parsedTables.forEach(validateTable)
  const parsedAssets = assetsJsonSchema.parse({ schemaVersion: 1, assets }).assets
  for (const asset of parsedAssets) {
    if (!asset.robloxAssetId) {
      throw new Error(`Asset ${asset.id} needs a published Roblox asset ID before export.`)
    }
    if (asset.id === "INVALID") {
      throw new Error("Asset slug INVALID is reserved.")
    }
  }
  const issues = [
    ...validateProjectContent(parsedTables, parsedAssets, localization).filter(
      (issue) => issue.severity === ProjectValidationSeverity.ERROR
    ),
    ...validateLocalizationDocument(localization, parsedAssets).filter(
      (issue) => issue.severity === LocalizationProblemSeverity.ERROR
    ),
  ]
  if (issues.length) {
    throw new Error(
      `Roblox export blocked: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`
    )
  }
  const refs: References = {
    assets: new Map(parsedAssets.map((asset, index) => [asset.id, index + 1])),
    translations: new Map(localization.keys.map((key, index) => [key.path, index + 1])),
    rows: new Map(
      parsedTables.map((table) => [
        table.id,
        new Map(table.rows.map((row, index) => [row.slug, index + 1])),
      ])
    ),
  }
  const files = [
    ...parsedTables.map((table) => renderTable(table, refs)),
    renderAssets(parsedAssets),
    renderRobloxLocalization(localization, parsedAssets, ROBLOX_EXPORT_ROOT),
  ]
  const modules = parsedTables.map(
    (table) => `[${luauString(table.id)}] = require(script.Parent.tables[${luauString(table.id)}])`
  )
  files.push({
    path: ROBLOX_MANIFEST_PATH,
    content: `${LUAU_HEADER}
return table.freeze({
    PROJECT_ID = ${luauString(project.id)},
    PROJECT_NAME = ${luauString(project.name)},
    EXPORTED_AT = ${luauString(exportedAt)},
    TABLES = table.freeze({ ${modules.join(", ")} }),
    ASSETS = require(script.Parent.assets),
    LOCALIZATION = require(script.Parent.localization),
})
`,
  })
  files.push(
    ...renderRobloxTypescript(parsedTables, parsedAssets, localization, ROBLOX_EXPORT_ROOT)
  )
  return { files }
}
