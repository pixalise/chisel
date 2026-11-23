import { ColumnType } from "../enums/column-type"
import { constantCase } from "./asset-paths"
import {
  typedDataColumnValueSchema,
  type AnyDataTable,
  type DataColumnDefinition,
  type DataTableRow,
} from "./schemas"
export function valueFor(row: DataTableRow, column: DataColumnDefinition): unknown {
  const cell = row.values.find((entry) => entry.columnId === column.id)
  if (cell && cell.value !== undefined) {
    return cell.value
  }
  return column.defaultValue
}
export function assertUnique(values: string[], description: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${description}: ${value}`)
    }
    seen.add(value)
  }
}
export function validateTable(table: AnyDataTable): void {
  assertUnique(
    table.rows.map((row) => row.id),
    `row ID in ${table.name}`
  )
  const fields = table.columns.map((column) => constantCase(column.name))
  assertUnique(["COUNT", "ID", "SLUGS", "TABLE_ID", ...fields], `exported field in ${table.name}`)
  for (const field of fields) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(field)) {
      throw new Error(`Invalid exported column name: ${field}`)
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
      const possibleValues = column.possibleValues
      if (
        possibleValues?.length &&
        !empty &&
        (column.type === ColumnType.ENUM || column.type === ColumnType.ENUM_ARRAY)
      ) {
        const entries = Array.isArray(value) ? value : [value]
        if (entries.some((entry) => !possibleValues.includes(String(entry)))) {
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
