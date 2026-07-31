import { snakeCase } from "lodash";
import type { LocalizationDocument } from "./localization";
import { renderLove2dInputExport } from "./love2d-input-export";
import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow, Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";

export const LOVE2D_GAME_DATA_EXPORT_ROOT = "gamedata";
export const LOVE2D_ASSET_EXPORT_ROOT = `${LOVE2D_GAME_DATA_EXPORT_ROOT}/assets`;
export const LOVE2D_MANIFEST_PATH = `${LOVE2D_GAME_DATA_EXPORT_ROOT}/manifest.lua`;
const INVALID_ID = 0;

export interface Love2dExportFile {
  content: string;
  path: string;
}

export interface Love2dExportBundle {
  files: Love2dExportFile[];
}

export interface Love2dPackedTextureExportPaths {
  albedoHeight: string;
  normalRoughness: string;
}

interface Love2dValueContext {
  assetIdsById: Map<string, number>;
  localizationIdsByPath: Map<string, number>;
  rowIdsByTableId: Map<string, Map<string, number>>;
  tablesById: Map<string, AnyDataTable>;
}

function constantCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const result = words.map((word) => word.toUpperCase()).join("_");
  return /^[A-Z]/.test(result) ? result : `VALUE_${result || "UNKNOWN"}`;
}

function uniqueNames(values: Array<{ id: string; value: string }>, reserved: string[] = []): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set<string>(reserved);

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

function luaString(value: string): string {
  let result = '"';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "\\") {
      result += "\\\\";
    } else if (character === '"') {
      result += '\\"';
    } else if (character === "\n") {
      result += "\\n";
    } else if (character === "\r") {
      result += "\\r";
    } else if (character === "\t") {
      result += "\\t";
    } else if (character === "\b") {
      result += "\\b";
    } else if (character === "\f") {
      result += "\\f";
    } else if (typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)) {
      result += `\\${codePoint.toString().padStart(3, "0")}`;
    } else {
      result += character;
    }
  }
  return `${result}"`;
}

function luaValue(value: unknown): string {
  if (value === null) {
    throw new Error("LÖVE export cannot serialize JSON null without losing its meaning.");
  }
  if (typeof value === "undefined") {
    return "nil";
  }
  if (typeof value === "string") {
    return luaString(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`LÖVE export cannot serialize non-finite number ${String(value)}.`);
    }
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `{ ${value.map(luaValue).join(", ")} }`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{ ${entries.map(([key, entry]) => `[${luaString(key)}] = ${luaValue(entry)}`).join(", ")} }`;
  }
  throw new Error(`LÖVE export cannot serialize value of type ${typeof value}.`);
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  return row.values.find((entry) => entry.columnId === column.id)?.value ?? column.defaultValue;
}

function sequentialIds(values: string[]): Map<string, number> {
  return new Map(values.map((value, index) => [value, index + 1]));
}

function referenceId(value: unknown, ids: Map<string, number> | undefined, description: string): number {
  if (value === null || typeof value === "undefined" || value === "") {
    return INVALID_ID;
  }
  if (typeof value !== "string") {
    throw new Error(`LÖVE export expected ${description} to be a string reference.`);
  }

  const id = ids?.get(value);
  if (!id) {
    throw new Error(`LÖVE export could not resolve ${description} "${value}".`);
  }
  return id;
}

function love2dColumnValue(value: unknown, column: DataColumnDefinition, context: Love2dValueContext): string {
  if (column.type === ColumnType.ref) {
    if (!column.refTableId) {
      throw new Error(`LÖVE export requires ref column "${column.name}" to declare refTableId.`);
    }
    if (!context.tablesById.has(column.refTableId)) {
      throw new Error(`LÖVE export could not find referenced table "${column.refTableId}" for column "${column.name}".`);
    }
    return String(referenceId(value, context.rowIdsByTableId.get(column.refTableId), `row reference for ${column.name}`));
  }
  if (column.type === ColumnType.assetRef) {
    return String(referenceId(value, context.assetIdsById, `asset reference for ${column.name}`));
  }
  if (column.type === ColumnType.translationRef) {
    return String(referenceId(value, context.localizationIdsByPath, `translation reference for ${column.name}`));
  }
  return luaValue(value);
}

function moduleSegment(value: string): string {
  return snakeCase(value) || "data_table";
}

export function love2dTableModuleName(table: AnyDataTable): string {
  return `${LOVE2D_GAME_DATA_EXPORT_ROOT}.tables.${moduleSegment(table.id)}`;
}

function tableExportPath(table: AnyDataTable): string {
  return `${love2dTableModuleName(table).replaceAll(".", "/")}.lua`;
}

function assertUniqueTablePaths(tables: AnyDataTable[]): void {
  const tableIdByPath = new Map<string, string>();
  for (const table of tables) {
    const path = tableExportPath(table);
    const existingTableId = tableIdByPath.get(path);
    if (existingTableId) {
      throw new Error(`LÖVE export table ids "${existingTableId}" and "${table.id}" both map to "${path}".`);
    }
    tableIdByPath.set(path, table.id);
  }
}

function renderIdTable(names: Map<string, string>, values: string[]): string {
  const entries = [`\t\tINVALID = ${INVALID_ID},`];
  for (const [index, value] of values.entries()) {
    entries.push(`\t\t${names.get(value) ?? constantCase(value)} = ${index + 1},`);
  }
  return `{\n${entries.join("\n")}\n\t}`;
}

function renderTable(table: AnyDataTable, context: Love2dValueContext): Love2dExportFile {
  const rowNames = uniqueNames(
    table.rows.map((row) => ({ id: row.slug, value: row.slug })),
    ["INVALID"]
  );
  const columnNames = uniqueNames(
    table.columns.map((column) => ({ id: column.id, value: column.name })),
    ["TABLE_ID", "TABLE_NAME", "COUNT", "ID", "SLUGS"]
  );
  const fields = table.columns.map((column) => {
    const values = table.rows.map((row) => love2dColumnValue(columnValue(row, column), column, context));
    return `\t${columnNames.get(column.id)} = { ${values.join(", ")} },`;
  });
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    "local data = {",
    `\tTABLE_ID = ${luaString(table.id)},`,
    `\tTABLE_NAME = ${luaString(table.name)},`,
    `\tCOUNT = ${table.rows.length},`,
    `\tID = ${renderIdTable(
      rowNames,
      table.rows.map((row) => row.slug)
    )},`,
    `\tSLUGS = { ${table.rows.map((row) => luaString(row.slug)).join(", ")} },`,
    ...fields,
    "}",
    "",
    "return data",
    ""
  ];
  return { path: tableExportPath(table), content: lines.join("\n") };
}

function assetFolder(asset: Asset): string {
  return `${LOVE2D_ASSET_EXPORT_ROOT}/${snakeCase(asset.category)}/${snakeCase(asset.name)}`;
}

export function isLove2dPackedTextureAsset(asset: Asset): boolean {
  return asset.category === AssetCategoryEnum.terrainTexture && asset.extension.toLowerCase() === "gppt";
}

export function love2dAssetExportPath(asset: Asset): string {
  if (isLove2dPackedTextureAsset(asset)) {
    return assetFolder(asset);
  }
  return `${assetFolder(asset)}.${asset.extension.toLowerCase()}`;
}

export function love2dPackedTextureExportPaths(asset: Asset): Love2dPackedTextureExportPaths {
  const folder = assetFolder(asset);
  return {
    albedoHeight: `${folder}/albedo_height.png`,
    normalRoughness: `${folder}/normal_roughness.png`
  };
}

function renderAssets(assets: Asset[]): Love2dExportFile {
  const names = uniqueNames(
    assets.map((asset) => ({ id: asset.id, value: asset.name })),
    ["INVALID"]
  );
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    "local assets = {",
    `\tCOUNT = ${assets.length},`,
    `\tID = ${renderIdTable(
      names,
      assets.map((asset) => asset.id)
    )},`,
    `\tIDS = { ${assets.map((asset) => luaString(asset.id)).join(", ")} },`,
    `\tPATHS = { ${assets.map((asset) => luaString(love2dAssetExportPath(asset))).join(", ")} },`,
    "}",
    "",
    "function assets.path(id)",
    '\tif type(id) ~= "number" or id % 1 ~= 0 or id < 1 or id > assets.COUNT then',
    '\t\terror("Invalid Chisel asset id: " .. tostring(id), 2)',
    "\tend",
    "\treturn assets.PATHS[id]",
    "end",
    "",
    "return assets",
    ""
  ];
  return { path: `${LOVE2D_GAME_DATA_EXPORT_ROOT}/assets.lua`, content: lines.join("\n") };
}

function renderLocalization(localization: LocalizationDocument): Love2dExportFile {
  const names = uniqueNames(
    localization.keys.map((key) => ({ id: key.path, value: key.path })),
    ["INVALID"]
  );
  const localeIndexes = localization.locales.map((locale, index) => `[${luaString(locale)}] = ${index + 1}`);
  const values = localization.keys.map((key) => {
    return `{ ${localization.locales.map((locale) => luaString(key.values[locale] ?? "")).join(", ")} }`;
  });
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    `local localeIndexes = { ${localeIndexes.join(", ")} }`,
    "local localization = {",
    `\tDEFAULT_LOCALE = ${luaString(localization.defaultLocale)},`,
    `\tCOUNT = ${localization.keys.length},`,
    `\tID = ${renderIdTable(
      names,
      localization.keys.map((key) => key.path)
    )},`,
    `\tLOCALES = { ${localization.locales.map(luaString).join(", ")} },`,
    `\tKEYS = { ${localization.keys.map((key) => luaString(key.path)).join(", ")} },`,
    `\tVALUES = { ${values.join(", ")} },`,
    "}",
    "",
    "function localization.get(id, locale)",
    '\tif type(id) ~= "number" or id % 1 ~= 0 or id < 1 or id > localization.COUNT then',
    '\t\terror("Invalid Chisel localization id: " .. tostring(id), 2)',
    "\tend",
    "\tlocal localeIndex = localeIndexes[locale]",
    "\tif not localeIndex then",
    '\t\terror("Unknown locale: " .. tostring(locale), 2)',
    "\tend",
    "\treturn localization.VALUES[id][localeIndex]",
    "end",
    "",
    "return localization",
    ""
  ];
  return { path: `${LOVE2D_GAME_DATA_EXPORT_ROOT}/localization.lua`, content: lines.join("\n") };
}

function renderManifest(
  project: Project,
  tables: AnyDataTable[],
  assets: Asset[],
  localization: LocalizationDocument,
  exportedAt: string,
  generatedFiles: Love2dExportFile[]
): Love2dExportFile {
  const tableEntries = tables.map((table) => {
    return `\t\t[${luaString(table.id)}] = { module = ${luaString(love2dTableModuleName(table))}, count = ${table.rows.length} },`;
  });
  const files = [LOVE2D_MANIFEST_PATH, ...generatedFiles.map((file) => file.path)].sort();
  const hasInput = generatedFiles.some((file) => file.path === `${LOVE2D_GAME_DATA_EXPORT_ROOT}/input.lua`);
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    "return {",
    `\tPROJECT_ID = ${luaString(project.id)},`,
    `\tPROJECT_NAME = ${luaString(project.name)},`,
    `\tGENERATED_AT = ${luaString(exportedAt)},`,
    `\tFILES = { ${files.map(luaString).join(", ")} },`,
    "\tTABLES = {",
    ...tableEntries,
    "\t},",
    `\tASSETS = { module = ${luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.assets`)}, root = ${luaString(LOVE2D_ASSET_EXPORT_ROOT)}, count = ${assets.length} },`,
    `\tLOCALIZATION = { module = ${luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.localization`)}, count = ${localization.keys.length}, locales = ${localization.locales.length} },`,
    `\tINPUT = { module = ${hasInput ? luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.input`) : "nil"}, enabled = ${hasInput ? "true" : "false"} },`,
    "}",
    ""
  ];
  return { path: LOVE2D_MANIFEST_PATH, content: lines.join("\n") };
}

export function createLove2dExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Asset[],
  localization: LocalizationDocument
): Love2dExportBundle {
  assertUniqueTablePaths(tables);
  const context: Love2dValueContext = {
    assetIdsById: sequentialIds(assets.map((asset) => asset.id)),
    localizationIdsByPath: sequentialIds(localization.keys.map((key) => key.path)),
    rowIdsByTableId: new Map(tables.map((table) => [table.id, sequentialIds(table.rows.map((row) => row.slug))])),
    tablesById: new Map(tables.map((table) => [table.id, table]))
  };
  const generatedFiles = [
    ...tables.map((table) => renderTable(table, context)),
    ...renderLove2dInputExport(tables, LOVE2D_GAME_DATA_EXPORT_ROOT),
    renderAssets(assets),
    renderLocalization(localization)
  ];
  return {
    files: [renderManifest(project, tables, assets, localization, exportedAt, generatedFiles), ...generatedFiles]
  };
}
