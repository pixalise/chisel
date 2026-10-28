import { ColumnType } from "../enums/column-type"
import { InputKeyEnum } from "../enums/input-key-enum"
import { type DataColumnDefinition, type SystemDataTable } from "../shared/schemas"
export const INPUT_BINDINGS_TABLE_ID = "input_bindings"
const SYSTEM_TABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z"
interface SystemColumnOptions {
  defaultValue?: DataColumnDefinition["defaultValue"]
  max?: number
  maxChars?: number
  min?: number
  possibleValues?: string[]
  required?: boolean
  step?: number
  unique?: boolean
}
function columnId(seed: string): string {
  return seed
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 21)
    .padEnd(21, "0")
}
function defaultValueForColumnType(
  type: ColumnType,
  possibleValues?: string[]
): DataColumnDefinition["defaultValue"] {
  if (type === ColumnType.INTEGER || type === ColumnType.DECIMAL || type === ColumnType.RANGE) {
    return 0
  }
  if (type === ColumnType.BOOLEAN) {
    return false
  }
  if (type === ColumnType.COLOR) {
    return "#000000"
  }
  if (type === ColumnType.VECTOR_2) {
    return [0, 0]
  }
  if (type === ColumnType.VECTOR_3) {
    return [0, 0, 0]
  }
  if (type === ColumnType.VECTOR_4) {
    return [0, 0, 0, 0]
  }
  if (type === ColumnType.JSON) {
    return {}
  }
  if (type === ColumnType.ENUM) {
    return possibleValues?.[0] ?? ""
  }
  if (type === ColumnType.ENUM_ARRAY || type === ColumnType.ARRAY_REF) {
    return []
  }
  return ""
}
function column(
  seed: string,
  name: string,
  type: ColumnType,
  options: SystemColumnOptions = {}
): DataColumnDefinition {
  const definition: DataColumnDefinition = {
    defaultValue: options.defaultValue ?? defaultValueForColumnType(type, options.possibleValues),
    id: columnId(seed),
    name,
    required: options.required ?? true,
    type,
    unique: options.unique ?? false,
  }
  if (typeof options.max === "number") {
    definition.max = options.max
  }
  if (typeof options.maxChars === "number") {
    definition.maxChars = options.maxChars
  }
  if (typeof options.min === "number") {
    definition.min = options.min
  }
  if (options.possibleValues) {
    definition.possibleValues = options.possibleValues
  }
  if (typeof options.step === "number") {
    definition.step = options.step
  }
  return definition
}
export const INPUT_BINDINGS_TABLE = {
  columns: [
    column("input_sort_order", "sort_order", ColumnType.INTEGER, { defaultValue: 0, min: 0 }),
    column("input_bindings", "bindings", ColumnType.ENUM_ARRAY, {
      defaultValue: [],
      max: 8,
      possibleValues: Object.values(InputKeyEnum),
    }),
  ],
  description: "Input actions and bindings exported to Roblox.",
  id: INPUT_BINDINGS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "input",
  name: "Input Bindings",
  rows: [],
  version: 1,
} satisfies SystemDataTable
export const SYSTEM_INPUT_TABLES = [INPUT_BINDINGS_TABLE]
export const SYSTEM_TABLES = [...SYSTEM_INPUT_TABLES]
