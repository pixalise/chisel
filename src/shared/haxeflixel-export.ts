import { snakeCase } from "lodash";
import type { LocalizationDocument } from "./localization";
import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow, Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";

export const HAXEFLIXEL_SOURCE_EXPORT_ROOT = "source/chisel";
export const HAXEFLIXEL_ASSET_EXPORT_ROOT = "assets/chisel";
const INVALID_ENUM_MEMBER = "INVALID";

export interface HaxeFlixelExportFile {
  content: string;
  path: string;
}

export interface HaxeFlixelExportBundle {
  files: HaxeFlixelExportFile[];
}

export interface HaxeFlixelPackedTextureExportPaths {
  albedoHeight: string;
  normalRoughness: string;
}

interface HaxeValueContext {
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

function haxeString(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function haxeValue(value: unknown): string {
  if (value === null || typeof value === "undefined") return "null";
  if (typeof value === "string") return haxeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(haxeValue).join(", ")}]`;
  return haxeString(JSON.stringify(value));
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}

function haxeType(column: DataColumnDefinition, context: HaxeValueContext): string {
  if (column.type === ColumnType.ref && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    return target ? `${tableClassName(target)}.${tableClassName(target)}Id` : "Int";
  }
  if (column.type === ColumnType.assetRef) return "ChiselAssets.ChiselAssetId";
  if (column.type === ColumnType.translationRef) return "ChiselLocalization.ChiselLocalizationId";
  if (column.type === ColumnType.integer) return "Int";
  if (column.type === ColumnType.decimal || column.type === ColumnType.range) return "Float";
  if (column.type === ColumnType.boolean) return "Bool";
  if (column.type === ColumnType.enumArray) return "Array<String>";
  if ([ColumnType.vector2, ColumnType.vector3, ColumnType.vector4].includes(column.type)) return "Array<Float>";
  if (column.type === ColumnType.json) return "String";
  return "String";
}

function haxeColumnValue(value: unknown, column: DataColumnDefinition, context: HaxeValueContext): string {
  if (column.type === ColumnType.ref && column.refTableId) {
    const target = context.tablesById.get(column.refTableId);
    const name = typeof value === "string" && target ? rowNames(target).get(value) : undefined;
    const className = tableClassName(target ?? ({ name: "Unknown" } as AnyDataTable));
    return `${className}.${className}Id.${name ?? INVALID_ENUM_MEMBER}`;
  }
  if (column.type === ColumnType.assetRef) {
    const name = typeof value === "string" ? context.assetNamesById.get(value) : undefined;
    return `ChiselAssets.ChiselAssetId.${name ?? INVALID_ENUM_MEMBER}`;
  }
  if (column.type === ColumnType.translationRef) {
    const name = typeof value === "string" ? context.localizationNamesByPath.get(value) : undefined;
    return `ChiselLocalization.ChiselLocalizationId.${name ?? INVALID_ENUM_MEMBER}`;
  }
  return haxeValue(value);
}

function rowNames(table: AnyDataTable): Map<string, string> {
  return uniqueNames(table.rows.map((row) => ({ id: row.slug, value: row.slug })));
}

function tableClassName(table: AnyDataTable): string {
  return `Chisel${pascalCase(table.name || table.id)}`;
}

function enumAbstract(name: string, entries: Array<{ name: string; value: number }>): string {
  const members = [{ name: INVALID_ENUM_MEMBER, value: -1 }, ...entries].map((entry) => `\tvar ${entry.name} = ${entry.value};`).join("\n");
  return `enum abstract ${name}(Int) from Int to Int {\n${members}\n}`;
}

function renderTable(table: AnyDataTable, context: HaxeValueContext): HaxeFlixelExportFile {
  const className = tableClassName(table);
  const names = rowNames(table);
  const columnNames = uniqueNames(table.columns.map((column) => ({ id: column.id, value: column.name })));
  const idType = enumAbstract(
    `${className}Id`,
    table.rows.map((row, index) => ({ name: names.get(row.slug) ?? constantCase(row.slug), value: index }))
  );
  const columns = table.columns
    .map((column) => {
      const values = table.rows.map((row) => haxeColumnValue(columnValue(row, column), column, context)).join(", ");
      return `\tpublic static final ${columnNames.get(column.id)}:Array<${haxeType(column, context)}> = [${values}];`;
    })
    .join("\n");
  const slugs = table.rows.map((row) => haxeString(row.slug)).join(", ");
  return {
    path: `${HAXEFLIXEL_SOURCE_EXPORT_ROOT}/${className}.hx`,
    content: `// Generated by Chisel. Do not edit.\npackage chisel;\n\n${idType}\n\nclass ${className} {\n\tpublic static inline final TABLE_ID = ${haxeString(table.id)};\n\tpublic static inline final TABLE_NAME = ${haxeString(table.name)};\n\tpublic static inline final COUNT:Int = ${table.rows.length};\n\tpublic static final SLUGS:Array<String> = [${slugs}];${columns ? `\n${columns}` : ""}\n}\n`
  };
}

function assetFolder(asset: Asset): string {
  return `${HAXEFLIXEL_ASSET_EXPORT_ROOT}/${snakeCase(asset.category)}/${snakeCase(asset.name)}`;
}

export function isHaxeFlixelPackedTextureAsset(asset: Asset): boolean {
  return asset.category === AssetCategoryEnum.terrainTexture && asset.extension.toLowerCase() === "gppt";
}

export function haxeFlixelAssetExportPath(asset: Asset): string {
  return isHaxeFlixelPackedTextureAsset(asset) ? assetFolder(asset) : `${assetFolder(asset)}.${asset.extension.toLowerCase()}`;
}

export function haxeFlixelPackedTextureExportPaths(asset: Asset): HaxeFlixelPackedTextureExportPaths {
  const folder = assetFolder(asset);
  return { albedoHeight: `${folder}/albedo_height.png`, normalRoughness: `${folder}/normal_roughness.png` };
}

function renderAssets(assets: Asset[]): HaxeFlixelExportFile {
  const names = uniqueNames(assets.map((asset) => ({ id: asset.id, value: asset.name })));
  const idType = enumAbstract(
    "ChiselAssetId",
    assets.map((asset, index) => ({ name: names.get(asset.id) ?? constantCase(asset.name), value: index }))
  );
  return {
    path: `${HAXEFLIXEL_SOURCE_EXPORT_ROOT}/ChiselAssets.hx`,
    content: `// Generated by Chisel. Do not edit.\npackage chisel;\n\n${idType}\n\nclass ChiselAssets {\n\tpublic static inline final COUNT:Int = ${assets.length};\n\tpublic static final IDS:Array<String> = [${assets.map((asset) => haxeString(asset.id)).join(", ")}];\n\tpublic static final PATHS:Array<String> = [${assets.map((asset) => haxeString(haxeFlixelAssetExportPath(asset))).join(", ")}];\n\tpublic static inline function path(id:ChiselAssetId):String return PATHS[id];\n}\n`
  };
}

function renderLocalization(localization: LocalizationDocument): HaxeFlixelExportFile {
  const names = uniqueNames(localization.keys.map((key) => ({ id: key.path, value: key.path })));
  const idType = enumAbstract(
    "ChiselLocalizationId",
    localization.keys.map((key, index) => ({ name: names.get(key.path) ?? constantCase(key.path), value: index }))
  );
  const values = localization.keys.map(
    (key) => `[${localization.locales.map((locale) => haxeString(key.values[locale] ?? "")).join(", ")}]`
  );
  return {
    path: `${HAXEFLIXEL_SOURCE_EXPORT_ROOT}/ChiselLocalization.hx`,
    content: `// Generated by Chisel. Do not edit.\npackage chisel;\n\n${idType}\n\nclass ChiselLocalization {\n\tpublic static inline final DEFAULT_LOCALE = ${haxeString(localization.defaultLocale)};\n\tpublic static final LOCALES:Array<String> = [${localization.locales.map(haxeString).join(", ")}];\n\tpublic static final KEYS:Array<String> = [${localization.keys.map((key) => haxeString(key.path)).join(", ")}];\n\tpublic static final VALUES:Array<Array<String>> = [${values.join(", ")}];\n\tpublic static function get(id:ChiselLocalizationId, locale:String):String {\n\t\tvar localeIndex = LOCALES.indexOf(locale);\n\t\tif (localeIndex < 0) throw 'Unknown locale: $locale';\n\t\treturn VALUES[id][localeIndex];\n\t}\n}\n`
  };
}

function renderManifest(
  project: Project,
  tables: AnyDataTable[],
  assets: Asset[],
  localization: LocalizationDocument,
  exportedAt: string
): HaxeFlixelExportFile {
  return {
    path: `${HAXEFLIXEL_SOURCE_EXPORT_ROOT}/ChiselManifest.hx`,
    content: `// Generated by Chisel. Do not edit.\npackage chisel;\n\nclass ChiselManifest {\n\tpublic static inline final PROJECT_ID = ${haxeString(project.id)};\n\tpublic static inline final PROJECT_NAME = ${haxeString(project.name)};\n\tpublic static inline final GENERATED_AT = ${haxeString(exportedAt)};\n\tpublic static inline final TABLE_COUNT:Int = ${tables.length};\n\tpublic static inline final ASSET_COUNT:Int = ${assets.length};\n\tpublic static inline final TRANSLATION_COUNT:Int = ${localization.keys.length};\n}\n`
  };
}

export function createHaxeFlixelExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Asset[],
  localization: LocalizationDocument
): HaxeFlixelExportBundle {
  const context: HaxeValueContext = {
    assetNamesById: uniqueNames(assets.map((asset) => ({ id: asset.id, value: asset.name }))),
    localizationNamesByPath: uniqueNames(localization.keys.map((key) => ({ id: key.path, value: key.path }))),
    tablesById: new Map(tables.map((table) => [table.id, table]))
  };
  return {
    files: [
      ...tables.map((table) => renderTable(table, context)),
      renderAssets(assets),
      renderLocalization(localization),
      renderManifest(project, tables, assets, localization, exportedAt)
    ]
  };
}
