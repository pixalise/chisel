import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow } from "./schemas";
import { ColumnType } from "./types";

export enum ProjectValidationSeverity {
  error = "error",
  warning = "warning"
}

export interface ProjectValidationIssue {
  message: string;
  path: string;
  severity: ProjectValidationSeverity;
}

export interface TableReferenceHit {
  column: DataColumnDefinition;
  columnName: string;
  sourceRowSlug?: string;
  sourceTableId: string;
  sourceTableName: string;
  targetRowSlug?: string;
}

export interface AssetReferenceHit {
  column: DataColumnDefinition;
  columnName: string;
  sourceRowSlug: string;
  sourceTableId: string;
  sourceTableName: string;
}

export function validateProjectContent(tables: AnyDataTable[], assets: Asset[]): ProjectValidationIssue[] {
  const issues: ProjectValidationIssue[] = [];
  const tablesById = new Map(tables.map((table) => [table.id, table]));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type === ColumnType.ref) {
        if (!column.refTableId) {
          issues.push({
            severity: ProjectValidationSeverity.error,
            path: `${table.id}.${column.name}`,
            message: `Reference column "${column.name}" must declare a target table`
          });
          continue;
        }
        const targetTable = tablesById.get(column.refTableId);
        if (!targetTable) {
          issues.push({
            severity: ProjectValidationSeverity.error,
            path: `${table.id}.${column.name}`,
            message: `Reference column "${column.name}" points at missing table "${column.refTableId}"`
          });
          continue;
        }
        const targetSlugs = new Set(targetTable.rows.map((row) => row.slug));
        for (const row of table.rows) {
          const value = columnValue(row, column);
          if (isEmptyReferenceValue(value)) {
            continue;
          }
          if (typeof value !== "string" || !targetSlugs.has(value)) {
            issues.push({
              severity: ProjectValidationSeverity.error,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Reference "${String(value)}" does not exist in "${targetTable.name}"`
            });
          }
        }
      }

      if (column.type === ColumnType.assetRef) {
        for (const row of table.rows) {
          const value = columnValue(row, column);
          if (isEmptyReferenceValue(value)) {
            continue;
          }
          if (typeof value !== "string") {
            issues.push({
              severity: ProjectValidationSeverity.error,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset reference must be an asset slug`
            });
            continue;
          }
          const asset = assetsById.get(value);
          if (!asset) {
            issues.push({
              severity: ProjectValidationSeverity.error,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset "${value}" does not exist`
            });
            continue;
          }
          if (column.assetCategory && asset.category !== column.assetCategory) {
            issues.push({
              severity: ProjectValidationSeverity.error,
              path: `${table.id}.${row.slug}.${column.name}`,
              message: `Asset "${value}" is ${asset.category}, expected ${column.assetCategory}`
            });
          }
        }
      }
    }
  }

  return issues;
}

export function findTableReferences(tables: AnyDataTable[], targetTableId: string, targetRowSlugs?: Set<string>): TableReferenceHit[] {
  const hits: TableReferenceHit[] = [];

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type !== ColumnType.ref || column.refTableId !== targetTableId) {
        continue;
      }
      if (!targetRowSlugs) {
        hits.push({
          column,
          columnName: column.name,
          sourceTableId: table.id,
          sourceTableName: table.name
        });
        continue;
      }
      for (const row of table.rows) {
        const value = columnValue(row, column);
        if (typeof value === "string" && targetRowSlugs.has(value)) {
          hits.push({
            column,
            columnName: column.name,
            sourceRowSlug: row.slug,
            sourceTableId: table.id,
            sourceTableName: table.name,
            targetRowSlug: value
          });
        }
      }
    }
  }

  return hits;
}

export function findAssetReferences(tables: AnyDataTable[], assetId: string): AssetReferenceHit[] {
  const hits: AssetReferenceHit[] = [];

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.type !== ColumnType.assetRef) {
        continue;
      }
      for (const row of table.rows) {
        const value = columnValue(row, column);
        if (value === assetId) {
          hits.push({
            column,
            columnName: column.name,
            sourceRowSlug: row.slug,
            sourceTableId: table.id,
            sourceTableName: table.name
          });
        }
      }
    }
  }

  return hits;
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}

function isEmptyReferenceValue(value: unknown): boolean {
  return value === null || typeof value === "undefined" || value === "";
}
