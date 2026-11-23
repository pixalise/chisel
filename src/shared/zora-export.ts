import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { LocalizationProblemSeverity } from "../enums/localization-problem-severity"
import { ProjectValidationSeverity } from "../enums/project-validation-severity"
import { validateLocalizationDocument, type LocalizationDocument } from "./localization"
import { validateProjectContent } from "./project-validation"
import { assertUnique, validateTable } from "./export-validation"
import { assetConstants, exportedRows, renderDefinitions, tableName } from "./zora-definitions"
import { LUA_PREAMBLE, luaValue, type ZoraExportFile } from "./zora-serialization"
import {
  assetsJsonSchema,
  projectSchema,
  validatedDataTableSchema,
  type AnyDataTable,
  type Asset,
  type Project,
} from "./schemas"

export const ZORA_EXPORT_ROOT = "ZoraData"
export const ZORA_MANIFEST_PATH = "ZoraData/catalog.json"
export interface ZoraAssetCopy {
  slug: string
  source: string
  destination: string
  sha256: string
}
export interface ZoraExportBundle {
  files: ZoraExportFile[]
  assets: ZoraAssetCopy[]
}

export function createZoraExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Asset[],
  localization: LocalizationDocument,
  assetHashes: Record<string, string>
): ZoraExportBundle {
  projectSchema.parse(project)
  const parsedTables = tables.map((table) => validatedDataTableSchema.parse(table))
  assertUnique(
    parsedTables.map((table) => table.id),
    "table ID"
  )
  assertUnique(parsedTables.map(tableName), "generated table name")
  parsedTables.forEach(validateTable)
  const parsedAssets = assetsJsonSchema.parse({ schemaVersion: 1, assets }).assets
  const issues = [
    ...validateProjectContent(parsedTables, parsedAssets, localization).filter(
      (issue) => issue.severity === ProjectValidationSeverity.ERROR
    ),
    ...validateLocalizationDocument(localization, parsedAssets).filter(
      (issue) => issue.severity === LocalizationProblemSeverity.ERROR
    ),
  ]
  if (issues.length > 0) {
    throw new Error(
      `Zora export blocked: ${issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`
    )
  }
  const copies: ZoraAssetCopy[] = []
  const catalogAssets: Record<string, unknown> = Object.create(null)
  for (const asset of parsedAssets) {
    const sha256 = assetHashes[asset.id]
    if (!sha256 || !/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`Commit asset ${asset.id} before exporting.`)
    }
    const extension = asset.extension.replace(/^\./, "").toLowerCase()
    if (!/^[a-z0-9]+$/.test(extension)) {
      throw new Error(`Invalid asset extension: ${asset.id}`)
    }
    if (asset.category === AssetCategoryEnum.MESH && extension !== "glb") {
      throw new Error(
        `Export ${asset.id} from Blender as a static GLB before importing it for Zora.`
      )
    }
    const destination = `assets/${asset.id}.${extension}`
    copies.push({ slug: asset.id, source: asset.relativePath, destination, sha256 })
    let entry: unknown = { category: asset.category, path: destination }
    if (extension === "zpbr") {
      entry = {
        category: asset.category,
        albedoMetallic: `assets/${asset.id}_T1.ktx`,
        surface: `assets/${asset.id}_T2.ktx`,
      }
    }
    catalogAssets[asset.id] = entry
  }
  const contentTables = Object.fromEntries(
    parsedTables.map((table) => [tableName(table), exportedRows(table)])
  )
  const materials = contentTables.Materials ?? {}
  const bindings = contentTables.ModelMaterials ?? {}
  const models: Record<string, { materials: Record<string, string> }> = Object.create(null)
  for (const asset of parsedAssets) {
    if (asset.category === AssetCategoryEnum.MESH) {
      models[asset.id] = { materials: Object.create(null) }
    }
  }
  for (const binding of Object.values(bindings)) {
    const model = models[String(binding.model)]
    const slot = String(binding.slot)
    const material = String(binding.material)
    if (!model || !materials[material] || !slot || Object.hasOwn(model.materials, slot)) {
      throw new Error(`Invalid or duplicate model material binding: ${String(binding.slug)}`)
    }
    model.materials[slot] = material
  }
  const catalog = {
    version: 1,
    projectId: project.id,
    exportedAt,
    assets: catalogAssets,
    models,
    materials,
    tables: contentTables,
    tableIds: Object.fromEntries(parsedTables.map((table) => [tableName(table), table.id])),
    tableOrder: Object.fromEntries(
      parsedTables.map((table) => [tableName(table), table.rows.map((row) => row.slug)])
    ),
    localization,
    lua: "lua/content.lua",
  }
  const files = renderDefinitions(parsedTables, parsedAssets, localization)
  files.push({ path: ZORA_MANIFEST_PATH, content: `${JSON.stringify(catalog, null, 2)}\n` })
  files.push({
    path: "ZoraData/lua/content.lua",
    content: `${LUA_PREAMBLE}
Assets = ${luaValue(assetConstants(parsedAssets))}
Tables = ${luaValue(contentTables)}
Localization = ${luaValue({ ...localization, Keys: Object.fromEntries(localization.keys.map((key) => [key.path.replaceAll(".", "_"), key.path])) })}
Content = readonly({ Assets = Assets, Tables = Tables, Localization = Localization, NULL = NULL })
return Content
`,
  })
  return { files, assets: copies }
}
