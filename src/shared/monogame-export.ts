import { snakeCase } from "lodash";
import type { LocalizationDocument } from "./localization";
import { renderMonoGameInputExport } from "./monogame-input-export";
import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow, Project } from "./schemas";
import { ColumnType } from "./types";

export const MONOGAME_GAME_DATA_EXPORT_ROOT = "GameData/Generated";
export const MONOGAME_ASSET_EXPORT_ROOT = "Content/Chisel";
export const MONOGAME_MANIFEST_PATH = `${MONOGAME_GAME_DATA_EXPORT_ROOT}/ChiselManifest.g.cs`;
const INVALID_ENUM_MEMBER = "Invalid";

export interface MonoGameExportFile {
  content: string;
  path: string;
}

export interface MonoGameExportBundle {
  files: MonoGameExportFile[];
}

interface MonoGameValueContext {
  assetNamesById: Map<string, string>;
  localizationNamesByPath: Map<string, string>;
  tablesById: Map<string, AnyDataTable>;
}

function pascalCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const result = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
  return /^[A-Z]/.test(result) ? result : `Data${result || "Table"}`;
}

function constantCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const result = words.map((word) => word.toUpperCase()).join("_");
  return /^[A-Z]/.test(result) ? result : `VALUE_${result || "UNKNOWN"}`;
}

function uniqueNames(values: Array<{ id: string; value: string }>): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>([INVALID_ENUM_MEMBER]);
  for (const entry of values) {
    const base = constantCase(entry.value);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(name);
    names.set(entry.id, name);
  }
  return names;
}

function csharpString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function csharpNumber(value: unknown, suffix = ""): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`MonoGame export cannot represent numeric value ${String(value)}.`);
  }
  const rendered = Number.isInteger(value) && suffix === "f" ? `${value}.0` : String(value);
  return `${rendered}${suffix}`;
}

function csharpValue(value: unknown): string {
  if (value === null || typeof value === "undefined") {
    return "null";
  }
  if (typeof value === "string") {
    return csharpString(value);
  }
  if (typeof value === "number") {
    return csharpNumber(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return csharpString(JSON.stringify(value));
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}

function rowNames(table: AnyDataTable): Map<string, string> {
  return uniqueNames(table.rows.map((row) => ({ id: row.slug, value: row.slug })));
}

function tableClassName(table: AnyDataTable): string {
  return `Chisel${pascalCase(table.name || table.id)}`;
}

function csharpType(column: DataColumnDefinition, context: MonoGameValueContext): string {
  if (column.type === ColumnType.ref && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    return target ? `${tableClassName(target)}Id` : "int";
  }
  if (column.type === ColumnType.arrayRef && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    return target ? `${tableClassName(target)}Id[]` : "int[]";
  }
  if (column.type === ColumnType.assetRef) {
    return "ChiselAssetId";
  }
  if (column.type === ColumnType.translationRef) {
    return "ChiselLocalizationId";
  }
  if (column.type === ColumnType.integer) {
    return "int";
  }
  if (column.type === ColumnType.decimal || column.type === ColumnType.range) {
    return "float";
  }
  if (column.type === ColumnType.boolean) {
    return "bool";
  }
  if (column.type === ColumnType.enumArray) {
    return "string[]";
  }
  if (column.type === ColumnType.vector2) {
    return "Vector2";
  }
  if (column.type === ColumnType.vector3) {
    return "Vector3";
  }
  if (column.type === ColumnType.vector4) {
    return "Vector4";
  }
  if (column.type === ColumnType.color) {
    return "Color";
  }
  return "string";
}

function csharpArray(type: string, values: unknown[], item: (value: unknown) => string): string {
  return `new ${type}[] { ${values.map(item).join(", ")} }`;
}

function csharpColor(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`MonoGame color value must be a hexadecimal string, got ${String(value)}.`);
  }
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value);
  if (!match) {
    throw new Error(`MonoGame color value "${value}" must use #RRGGBB or #RRGGBBAA.`);
  }
  const rgb = match[1];
  const alpha = match[2] ?? "ff";
  return `new Color(${parseInt(rgb.slice(0, 2), 16)}, ${parseInt(rgb.slice(2, 4), 16)}, ${parseInt(rgb.slice(4, 6), 16)}, ${parseInt(alpha, 16)})`;
}

function csharpVector(value: unknown, size: number): string {
  if (!Array.isArray(value) || value.length !== size) {
    throw new Error(`MonoGame Vector${size} value must contain exactly ${size} numbers.`);
  }
  return `new Vector${size}(${value.map((entry) => csharpNumber(entry, "f")).join(", ")})`;
}

function csharpColumnValue(value: unknown, column: DataColumnDefinition, context: MonoGameValueContext): string {
  if (column.type === ColumnType.ref && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    const name = typeof value === "string" && target ? rowNames(target).get(value) : undefined;
    return `${tableClassName(target ?? ({ name: "Unknown" } as AnyDataTable))}Id.${name ?? INVALID_ENUM_MEMBER}`;
  }
  if (column.type === ColumnType.arrayRef && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    if (!target || !Array.isArray(value)) {
      return "Array.Empty<int>()";
    }
    const names = rowNames(target);
    const typeName = `${tableClassName(target)}Id`;
    return `new ${typeName}[] { ${value
      .map((entry) => `${typeName}.${typeof entry === "string" ? (names.get(entry) ?? INVALID_ENUM_MEMBER) : INVALID_ENUM_MEMBER}`)
      .join(", ")} }`;
  }
  if (column.type === ColumnType.assetRef) {
    const name = typeof value === "string" ? context.assetNamesById.get(value) : undefined;
    return `ChiselAssetId.${name ?? INVALID_ENUM_MEMBER}`;
  }
  if (column.type === ColumnType.translationRef) {
    const name = typeof value === "string" ? context.localizationNamesByPath.get(value) : undefined;
    return `ChiselLocalizationId.${name ?? INVALID_ENUM_MEMBER}`;
  }
  if (column.type === ColumnType.integer) {
    return csharpNumber(value);
  }
  if (column.type === ColumnType.decimal || column.type === ColumnType.range) {
    return csharpNumber(value, "f");
  }
  if (column.type === ColumnType.enumArray) {
    if (!Array.isArray(value)) {
      throw new Error(`MonoGame enumArray column "${column.name}" requires an array value.`);
    }
    return csharpArray("string", value, csharpValue);
  }
  if (column.type === ColumnType.vector2) {
    return csharpVector(value, 2);
  }
  if (column.type === ColumnType.vector3) {
    return csharpVector(value, 3);
  }
  if (column.type === ColumnType.vector4) {
    return csharpVector(value, 4);
  }
  if (column.type === ColumnType.color) {
    return csharpColor(value);
  }
  if (column.type === ColumnType.json) {
    return csharpString(JSON.stringify(value));
  }
  return csharpValue(value);
}

function renderEnum(name: string, entries: Array<{ name: string; value: number }>): string {
  const members = [{ name: INVALID_ENUM_MEMBER, value: -1 }, ...entries]
    .map((entry) => `        ${entry.name} = ${entry.value}`)
    .join(",\n");
  return `    public enum ${name}\n    {\n${members}\n    }`;
}

function renderTable(table: AnyDataTable, context: MonoGameValueContext): MonoGameExportFile {
  const className = tableClassName(table);
  const idTypeName = `${className}Id`;
  const names = rowNames(table);
  const columnNames = uniqueNames(table.columns.map((column) => ({ id: column.id, value: column.name })));
  const idType = renderEnum(
    idTypeName,
    table.rows.map((row, index) => ({ name: names.get(row.slug) ?? constantCase(row.slug), value: index }))
  );
  const columns = table.columns
    .map((column) => {
      const values = table.rows.map((row) => csharpColumnValue(columnValue(row, column), column, context)).join(", ");
      const columnName = pascalCase(columnNames.get(column.id) ?? column.name);
      return `        public static readonly ${csharpType(column, context)}[] ${columnName} = new ${csharpType(column, context)}[] { ${values} };`;
    })
    .join("\n");
  const slugs = table.rows.map((row) => csharpString(row.slug)).join(", ");

  return {
    path: `${MONOGAME_GAME_DATA_EXPORT_ROOT}/${className}.g.cs`,
    content: `// <auto-generated />
// Generated by Chisel. Do not edit.
using System;
using Microsoft.Xna.Framework;

namespace Chisel.Generated
{
${idType}

    public static class ${className}
    {
        public const string TableId = ${csharpString(table.id)};
        public const string TableName = ${csharpString(table.name)};
        public const int Count = ${table.rows.length};
        public static readonly string[] Slugs = new string[] { ${slugs} };${columns ? `\n${columns}` : ""}
    }
}
`
  };
}

function assetFolder(asset: Asset): string {
  return `${MONOGAME_ASSET_EXPORT_ROOT}/${snakeCase(asset.category)}/${snakeCase(asset.name)}`;
}

export function monoGameAssetExportPath(asset: Asset): string {
  return `${assetFolder(asset)}.${asset.extension.toLowerCase()}`;
}

function renderAssets(assets: Asset[]): MonoGameExportFile {
  const names = uniqueNames(assets.map((asset) => ({ id: asset.id, value: asset.name })));
  const idType = renderEnum(
    "ChiselAssetId",
    assets.map((asset, index) => ({ name: names.get(asset.id) ?? constantCase(asset.name), value: index }))
  );
  const ids = assets.map((asset) => csharpString(asset.id)).join(", ");
  const paths = assets.map((asset) => csharpString(monoGameAssetExportPath(asset).replace(/^Content\//, ""))).join(", ");
  const categories = assets.map((asset) => csharpString(asset.category)).join(", ");

  return {
    path: `${MONOGAME_GAME_DATA_EXPORT_ROOT}/ChiselAssets.g.cs`,
    content: `// <auto-generated />
// Generated by Chisel. Do not edit.
using System;

namespace Chisel.Generated
{
${idType}

    public static class ChiselAssets
    {
        public const int Count = ${assets.length};
        public static readonly string[] Ids = new string[] { ${ids} };
        public static readonly string[] Paths = new string[] { ${paths} };
        public static readonly string[] Categories = new string[] { ${categories} };

        public static string Path(ChiselAssetId id)
        {
            return Paths[AssetIndex(id)];
        }

        public static string Category(ChiselAssetId id)
        {
            return Categories[AssetIndex(id)];
        }

        private static int AssetIndex(ChiselAssetId id)
        {
            int index = (int)id;
            if (index < 0 || index >= Paths.Length)
            {
                throw new ArgumentOutOfRangeException(nameof(id), id, "Invalid Chisel asset id.");
            }
            return index;
        }
    }
}
`
  };
}

function renderLocalization(localization: LocalizationDocument): MonoGameExportFile {
  const names = uniqueNames(localization.keys.map((key) => ({ id: key.path, value: key.path })));
  const idType = renderEnum(
    "ChiselLocalizationId",
    localization.keys.map((key, index) => ({ name: names.get(key.path) ?? constantCase(key.path), value: index }))
  );
  const locales = localization.locales.map(csharpString).join(", ");
  const keys = localization.keys.map((key) => csharpString(key.path)).join(", ");
  const values = localization.keys
    .map((key) => `new string[] { ${localization.locales.map((locale) => csharpString(key.values[locale] ?? "")).join(", ")} }`)
    .join(", ");

  return {
    path: `${MONOGAME_GAME_DATA_EXPORT_ROOT}/ChiselLocalization.g.cs`,
    content: `// <auto-generated />
// Generated by Chisel. Do not edit.
using System;

namespace Chisel.Generated
{
${idType}

    public static class ChiselLocalization
    {
        public const string DefaultLocale = ${csharpString(localization.defaultLocale)};
        public static readonly string[] Locales = new string[] { ${locales} };
        public static readonly string[] Keys = new string[] { ${keys} };
        public static readonly string[][] Values = new string[][] { ${values} };

        public static string Get(ChiselLocalizationId id, string locale)
        {
            int localeIndex = Array.IndexOf(Locales, locale);
            if (localeIndex < 0)
            {
                throw new ArgumentException($"Unknown Chisel locale: {locale}", nameof(locale));
            }
            int keyIndex = (int)id;
            if (keyIndex < 0 || keyIndex >= Values.Length)
            {
                throw new ArgumentOutOfRangeException(nameof(id), id, "Invalid Chisel localization id.");
            }
            return Values[keyIndex][localeIndex];
        }
    }
}
`
  };
}

function renderManifest(
  project: Project,
  tables: AnyDataTable[],
  assets: Asset[],
  localization: LocalizationDocument,
  exportedAt: string
): MonoGameExportFile {
  return {
    path: MONOGAME_MANIFEST_PATH,
    content: `// <auto-generated />
// Generated by Chisel. Do not edit.
namespace Chisel.Generated
{
    public static class ChiselManifest
    {
        public const string ProjectId = ${csharpString(project.id)};
        public const string ProjectName = ${csharpString(project.name)};
        public const string GeneratedAt = ${csharpString(exportedAt)};
        public const int TableCount = ${tables.length};
        public const int AssetCount = ${assets.length};
        public const int TranslationCount = ${localization.keys.length};
    }
}
`
  };
}

export function createMonoGameExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Asset[],
  localization: LocalizationDocument
): MonoGameExportBundle {
  const context: MonoGameValueContext = {
    assetNamesById: uniqueNames(assets.map((asset) => ({ id: asset.id, value: asset.name }))),
    localizationNamesByPath: uniqueNames(localization.keys.map((key) => ({ id: key.path, value: key.path }))),
    tablesById: new Map(tables.map((table) => [table.id, table]))
  };

  return {
    files: [
      ...tables.map((table) => renderTable(table, context)),
      ...renderMonoGameInputExport(tables, MONOGAME_GAME_DATA_EXPORT_ROOT),
      renderAssets(assets),
      renderLocalization(localization),
      renderManifest(project, tables, assets, localization, exportedAt)
    ]
  };
}
