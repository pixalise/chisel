import { type DataColumnDefinition, type SystemDataTable } from "../../shared/schemas";
import { ColumnType, InputKeyEnum } from "../../shared/types";

export const INPUT_BINDINGS_TABLE_ID = "input_bindings";

const SYSTEM_TABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

interface SystemColumnOptions {
  defaultValue?: DataColumnDefinition["defaultValue"];
  max?: number;
  maxChars?: number;
  min?: number;
  possibleValues?: string[];
  required?: boolean;
  step?: number;
  unique?: boolean;
}

function columnId(seed: string): string {
  return seed
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 21)
    .padEnd(21, "0");
}

function defaultValueForColumnType(type: ColumnType, possibleValues?: string[]): DataColumnDefinition["defaultValue"] {
  if (type === ColumnType.integer || type === ColumnType.decimal || type === ColumnType.range) {
    return 0;
  }
  if (type === ColumnType.boolean) {
    return false;
  }
  if (type === ColumnType.color) {
    return "#000000";
  }
  if (type === ColumnType.vector2) {
    return [0, 0];
  }
  if (type === ColumnType.vector3) {
    return [0, 0, 0];
  }
  if (type === ColumnType.vector4) {
    return [0, 0, 0, 0];
  }
  if (type === ColumnType.json) {
    return {};
  }
  if (type === ColumnType.enum) {
    return possibleValues?.[0] ?? "";
  }
  if (type === ColumnType.enumArray) {
    return [];
  }
  return "";
}

function column(seed: string, name: string, type: ColumnType, options: SystemColumnOptions = {}): DataColumnDefinition {
  const definition: DataColumnDefinition = {
    defaultValue: options.defaultValue ?? defaultValueForColumnType(type, options.possibleValues),
    id: columnId(seed),
    name,
    required: options.required ?? true,
    type,
    unique: options.unique ?? false
  };
  if (typeof options.max === "number") {
    definition.max = options.max;
  }
  if (typeof options.maxChars === "number") {
    definition.maxChars = options.maxChars;
  }
  if (typeof options.min === "number") {
    definition.min = options.min;
  }
  if (options.possibleValues) {
    definition.possibleValues = options.possibleValues;
  }
  if (typeof options.step === "number") {
    definition.step = options.step;
  }
  return definition;
}

export const INPUT_BINDINGS_TABLE = {
  columns: [
    column("input_sort_order", "sort_order", ColumnType.integer, { defaultValue: 0, min: 0 }),
    column("input_action", "action", ColumnType.string, { maxChars: 96, unique: true }),
    column("input_bindings", "bindings", ColumnType.enumArray, {
      defaultValue: [],
      max: 8,
      possibleValues: Object.values(InputKeyEnum)
    })
  ],
  description: "Input bindings exported to Godot InputMap setup.",
  id: INPUT_BINDINGS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "input",
  name: "Input Bindings",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const SYSTEM_INPUT_TABLES = [INPUT_BINDINGS_TABLE];
export const SYSTEM_TABLES = [...SYSTEM_INPUT_TABLES];
