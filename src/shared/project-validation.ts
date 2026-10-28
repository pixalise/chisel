import { ColumnType } from "../enums/column-type"
import { ProjectValidationSeverity } from "../enums/project-validation-severity"
import type { LocalizationDocument } from "./localization"
import type { DataTableSchema, Asset, DataColumnDefinition, DataTableRow } from "./schemas"
export interface ProjectValidationIssue {
  message: string
  path: string
  severity: ProjectValidationSeverity
}
export interface TableReferenceHit {
  column: DataColumnDefinition
  columnName: string
  sourceRowSlug?: string
  sourceTableId: string
  sourceTableName: string
  targetRowSlug?: string
}
export interface AssetReferenceHit {
  column: DataColumnDefinition
  columnName: string
  sourceRowSlug: string
  sourceTableId: string
  sourceTableName: string
}
export function validateProjectContent(
  tables: DataTableSchema[],
  assets: Asset[],
  localization?: LocalizationDocument
): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = []
  const tablesById = new Map(tables.map((table) => [table.id, table]))
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const localizationKeys = localization
    ? new Set(localization.keys.map((key) => key.path))
    : undefined
  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type === ColumnType.REF || column.type === ColumnType.ARRAY_REF) {
        const isArrayReference = column.type === ColumnType.ARRAY_REF
        if (!column.refTableId) {
          issues.push({
            severity: ProjectValidationSeverity.ERROR,
            path: `${table.id}.${column.name}`,
            message: `${isArrayReference ? "Array reference" : "Reference"} column "${column.name}" must declare a target table`,
          })
          continue
        }
        const targetTable = tablesById.get(column.refTableId)
        if (!targetTable) {
          issues.push({
            severity: ProjectValidationSeverity.ERROR,
            path: `${table.id}.${column.name}`,
            message: `${isArrayReference ? "Array reference" : "Reference"} column "${column.name}" points at missing table "${column.refTableId}"`,
          })
          continue
        }
        const targetSlugs = new Set(targetTable.rows.map((row) => row.slug))
        for (const row of table.rows) {
          const value = columnValue(row, column)
          if (isEmptyReferenceValue(value)) {
            continue
          }
          if (isArrayReference) {
            if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
              issues.push({
                severity: ProjectValidationSeverity.ERROR,
                path: `${table.id}.${row.slug}.${column.name}`,
                message: `Array reference must be an array of row slugs`,
              })
              continue
            }
            if (new Set(value).size !== value.length) {
              issues.push({
                severity: ProjectValidationSeverity.ERROR,
                path: `${table.id}.${row.slug}.${column.name}`,
                message: `Array reference contains duplicate rows`,
              })
            }
            for (const entry of value) {
              if (!targetSlugs.has(entry)) {
                issues.push({
                  severity: ProjectValidationSeverity.ERROR,
                  path: `${table.id}.${row.slug}.${column.name}`,
                  message: `Reference "${entry}" does not exist in "${targetTable.name}"`,
                })
              }
            }
          } else {
            if (typeof value !== "string" || !targetSlugs.has(value)) {
              issues.push({
                severity: ProjectValidationSeverity.ERROR,
                path: `${table.id}.${row.slug}.${column.name}`,
                message: `Reference "${String(value)}" does not exist in "${targetTable.name}"`,
              })
            }
          }
        }
      }
      if (column.type === ColumnType.ASSET_REF) {
        for (const row of table.rows) {
          const value = columnValue(row, column)
          if (isEmptyReferenceValue(value)) {
            continue
          }
          if (typeof value !== "string") {
            issues.push({
              severity: ProjectValidationSeverity.ERROR,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset reference must be an asset slug`,
            })
            continue
          }
          const asset = assetsById.get(value)
          if (!asset) {
            issues.push({
              severity: ProjectValidationSeverity.ERROR,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset "${value}" does not exist`,
            })
            continue
          }
          if (column.assetCategory && asset.category !== column.assetCategory) {
            issues.push({
              severity: ProjectValidationSeverity.ERROR,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset "${value}" is ${asset.category}, expected ${column.assetCategory}`,
            })
          }
        }
      }
      if (column.type === ColumnType.TRANSLATION_REF) {
        for (const row of table.rows) {
          const value = columnValue(row, column)
          if (isEmptyReferenceValue(value)) {
            continue
          }
          if (typeof value !== "string") {
            issues.push({
              severity: ProjectValidationSeverity.ERROR,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Translation reference must be a localization key`,
            })
            continue
          }
          if (localizationKeys && !localizationKeys.has(value)) {
            issues.push({
              severity: ProjectValidationSeverity.ERROR,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Translation key "${value}" does not exist`,
            })
          }
        }
      }
    }
  }
  return issues
}
export function findTableReferences(
  tables: DataTableSchema[],
  targetTableId: string,
  targetRowSlugs?: Set<string>
): TableReferenceHit[] {
  const hits: TableReferenceHit[] = []
  for (const table of tables) {
    for (const column of table.columns) {
      if (
        (column.type !== ColumnType.REF && column.type !== ColumnType.ARRAY_REF) ||
        column.refTableId !== targetTableId
      ) {
        continue
      }
      if (!targetRowSlugs) {
        hits.push({
          column,
          columnName: column.name,
          sourceTableId: table.id,
          sourceTableName: table.name,
        })
        continue
      }
      for (const row of table.rows) {
        const value = columnValue(row, column)
        const referencedSlugs = Array.isArray(value) ? value : [value]
        for (const referencedSlug of referencedSlugs) {
          if (typeof referencedSlug !== "string" || !targetRowSlugs.has(referencedSlug)) {
            continue
          }
          hits.push({
            column,
            columnName: column.name,
            sourceRowSlug: row.slug,
            sourceTableId: table.id,
            sourceTableName: table.name,
            targetRowSlug: referencedSlug,
          })
        }
      }
    }
  }
  return hits
}
export function findAssetReferences(
  tables: DataTableSchema[],
  assetId: string
): AssetReferenceHit[] {
  const hits: AssetReferenceHit[] = []
  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type !== ColumnType.ASSET_REF) {
        continue
      }
      for (const row of table.rows) {
        const value = columnValue(row, column)
        if (value === assetId) {
          hits.push({
            column,
            columnName: column.name,
            sourceRowSlug: row.slug,
            sourceTableId: table.id,
            sourceTableName: table.name,
          })
        }
      }
    }
  }
  return hits
}
function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue
}
function isEmptyReferenceValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === "undefined" ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}
