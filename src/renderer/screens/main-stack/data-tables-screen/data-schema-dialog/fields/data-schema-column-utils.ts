import type { CreateOrUpdateTable } from "../../../../../../shared/schemas";
import { ColumnType } from "../../../../../../shared/types";

export type DataColumnDefaultValue = CreateOrUpdateTable["columns"][number]["defaultValue"];

export const columnTypeOptions = Object.values(ColumnType).map((type) => ({
  label: type,
  value: type
}));

export const vectorComponentLabels = ["x", "y", "z", "w"];

export function vectorLengthForColumnType(type: ColumnType): number {
  if (type === ColumnType.vector2) {
    return 2;
  }
  if (type === ColumnType.vector3) {
    return 3;
  }
  if (type === ColumnType.vector4) {
    return 4;
  }
  return 0;
}

export function isVectorColumnType(type: ColumnType): boolean {
  return vectorLengthForColumnType(type) > 0;
}

export function createDefaultValueForColumnType(type: ColumnType, enumValues: string[] = [], minValue?: unknown): DataColumnDefaultValue {
  const min = typeof minValue === "number" && Number.isFinite(minValue) ? minValue : 0;

  if (type === ColumnType.integer) {
    return Math.trunc(min);
  }
  if (type === ColumnType.decimal || type === ColumnType.range) {
    return min;
  }
  if (type === ColumnType.boolean) {
    return false;
  }
  if (type === ColumnType.color) {
    return "#000000";
  }
  if (isVectorColumnType(type)) {
    return Array.from({ length: vectorLengthForColumnType(type) }, () => min);
  }
  if (type === ColumnType.enum) {
    return enumValues[0] ?? "";
  }
  if (type === ColumnType.enumArray) {
    return [];
  }
  if (type === ColumnType.json) {
    return {};
  }
  return "";
}

export function isDefaultValueValidForColumnType(type: ColumnType, value: unknown, enumValues: string[]): boolean {
  if (value === null || typeof value === "undefined") {
    return false;
  }
  if (type === ColumnType.integer) {
    return Number.isInteger(value);
  }
  if (type === ColumnType.decimal || type === ColumnType.range) {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === ColumnType.boolean) {
    return typeof value === "boolean";
  }
  if (type === ColumnType.color) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  }
  if (type === ColumnType.enum) {
    return typeof value === "string" && (enumValues.length === 0 || enumValues.includes(value));
  }
  if (type === ColumnType.enumArray) {
    return (
      Array.isArray(value) && value.every((entry) => typeof entry === "string" && (enumValues.length === 0 || enumValues.includes(entry)))
    );
  }
  if (isVectorColumnType(type)) {
    return (
      Array.isArray(value) &&
      value.length === vectorLengthForColumnType(type) &&
      value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    );
  }
  return true;
}

export function defaultValueText(columnType: ColumnType, enumValues: string[], minValue: unknown, value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return String(createDefaultValueForColumnType(columnType, enumValues, minValue));
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

export function parseDefaultValue(columnType: ColumnType, enumValues: string[], minValue: unknown, value: string): unknown {
  if (!value.trim() && columnType !== ColumnType.string && columnType !== ColumnType.text) {
    return createDefaultValueForColumnType(columnType, enumValues, minValue);
  }
  if (columnType === ColumnType.integer) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : createDefaultValueForColumnType(columnType, enumValues, minValue);
  }
  if (columnType === ColumnType.decimal || columnType === ColumnType.range) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : createDefaultValueForColumnType(columnType, enumValues, minValue);
  }
  if (columnType === ColumnType.boolean) {
    return value.toLowerCase() === "true";
  }
  if (isVectorColumnType(columnType)) {
    const vectorLength = vectorLengthForColumnType(columnType);
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        const vector = parsed.slice(0, vectorLength).map((entry) => Number(entry));
        if (vector.length === vectorLength && vector.every(Number.isFinite)) {
          return vector;
        }
      }
    } catch {
      const vector = value
        .split(",")
        .map((entry) => Number(entry.trim()))
        .filter(Number.isFinite)
        .slice(0, vectorLength);
      if (vector.length === vectorLength) {
        return vector;
      }
    }
    return createDefaultValueForColumnType(columnType, enumValues, minValue);
  }
  if (columnType === ColumnType.enumArray) {
    if (!value.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((entry) => enumValues.length === 0 || enumValues.includes(entry));
      }
    } catch {
      return value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry && (enumValues.length === 0 || enumValues.includes(entry)));
    }
    return [];
  }
  if (columnType === ColumnType.json) {
    if (!value.trim()) {
      return {};
    }
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function colorDefaultValue(value: unknown): string {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
    return value;
  }
  return "#000000";
}

export function numericBound(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function numericDefaultText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

export function parseNumericDefault(
  columnType: ColumnType,
  enumValues: string[],
  minValue: unknown,
  value: string,
  integer = false
): number | undefined {
  if (!value) {
    return createDefaultValueForColumnType(columnType, enumValues, minValue) as number;
  }
  const parsed = integer ? Number.parseInt(value, 10) : Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return createDefaultValueForColumnType(columnType, enumValues, minValue) as number;
}

export function rangeDefaultNumber(value: unknown, minValue: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const min = numericBound(minValue);
  if (typeof min === "number") {
    return min;
  }
  return 0;
}

export function rangeMax(maxValue: unknown): number {
  const max = numericBound(maxValue);
  if (typeof max === "number") {
    return max;
  }
  return 1;
}

export function rangeMin(minValue: unknown): number {
  const min = numericBound(minValue);
  if (typeof min === "number") {
    return min;
  }
  return 0;
}

export function rangeStep(stepValue: unknown): number {
  const step = numericBound(stepValue);
  if (typeof step === "number" && step > 0) {
    return step;
  }
  return 0.01;
}

export function vectorDefaultValues(columnType: ColumnType, enumValues: string[], minValue: unknown, value: unknown): number[] {
  const vectorLength = vectorLengthForColumnType(columnType);
  const fallback = createDefaultValueForColumnType(columnType, enumValues, minValue);
  const fallbackValues = Array.isArray(fallback) ? fallback.map(Number) : Array.from({ length: vectorLength }, () => 0);
  if (!Array.isArray(value)) {
    return fallbackValues;
  }
  const values = value.slice(0, vectorLength).map(Number);
  if (values.length !== vectorLength || values.some((entry) => !Number.isFinite(entry))) {
    return fallbackValues;
  }
  return values;
}

export function updateVectorDefaultValue(values: number[], index: number, value: string): number[] {
  const nextValues = [...values];
  const parsed = Number(value);
  nextValues[index] = Number.isFinite(parsed) ? parsed : (values[index] ?? 0);
  return nextValues;
}
