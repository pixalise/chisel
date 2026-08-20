import { snakeCase } from "lodash";
import type { LocalizationDocument } from "./localization";
import { renderLove2dInputExport } from "./love2d-input-export";
import { LOVE2D_TERRAIN_MODULE, renderLove2dTerrainExport, type Love2dTerrainExport } from "./love2d-terrain-export";
import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow, Project } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";

export const LOVE2D_GAME_DATA_EXPORT_ROOT = "gamedata";
export const LOVE2D_ASSET_EXPORT_ROOT = `${LOVE2D_GAME_DATA_EXPORT_ROOT}/assets`;
export const LOVE2D_MANIFEST_PATH = `${LOVE2D_GAME_DATA_EXPORT_ROOT}/manifest.lua`;
export const LOVE2D_ASSET_MANAGER_PATH = `${LOVE2D_GAME_DATA_EXPORT_ROOT}/asset_manager.lua`;
const INVALID_ID = 0;

export interface Love2dExportFile {
  content: string;
  path: string;
}

export interface Love2dExportBundle {
  files: Love2dExportFile[];
}

export interface Love2dExportOptions {
  terrainSourceTables?: AnyDataTable[];
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
  if (column.type === ColumnType.arrayRef) {
    if (!column.refTableId) {
      throw new Error(`LÖVE export requires arrayRef column "${column.name}" to declare refTableId.`);
    }
    const refTableId = column.refTableId;
    if (!context.tablesById.has(refTableId)) {
      throw new Error(`LÖVE export could not find referenced table "${refTableId}" for column "${column.name}".`);
    }
    if (!Array.isArray(value)) {
      throw new Error(`LÖVE export expected ${column.name} to be an array of row references.`);
    }
    return luaValue(value.map((entry) => referenceId(entry, context.rowIdsByTableId.get(refTableId), `row reference for ${column.name}`)));
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

export function love2dAssetExportPath(asset: Asset): string {
  return `${assetFolder(asset)}.${asset.extension.toLowerCase()}`;
}

function renderCategoryIds(assets: Asset[], names: Map<string, string>): string[] {
  return Object.values(AssetCategoryEnum).flatMap((category) => {
    const entries = assets
      .map((asset, index) => ({ asset, id: index + 1 }))
      .filter(({ asset }) => asset.category === category)
      .map(({ asset, id }) => `\t\t${names.get(asset.id)} = ${id},`);
    return [`\t${category} = {`, ...entries, "\t},"];
  });
}

function renderAssetManager(assets: Asset[]): Love2dExportFile {
  const names = uniqueNames(
    assets.map((asset) => ({ id: asset.id, value: asset.name })),
    ["INVALID"]
  );
  const definitions = assets.map(
    (asset) =>
      `\t{ id = ${luaString(asset.id)}, category = ${luaString(asset.category)}, extension = ${luaString(asset.extension.toLowerCase())}, path = ${luaString(love2dAssetExportPath(asset))} },`
  );
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    "local definitions = {",
    ...definitions,
    "}",
    "local imageCategories = { TILESET = true, UI = true, IMAGE = true, HDRI = true }",
    "local caches = { images = {}, dataImages = {}, fonts = {}, shaders = {}, audio = {}, text = {} }",
    "",
    "local AssetManager = {",
    `\tCOUNT = ${assets.length},`,
    `\tID = ${renderIdTable(
      names,
      assets.map((asset) => asset.id)
    )},`,
    ...renderCategoryIds(assets, names),
    "}",
    "",
    "local function definition(assetId, expectedCategory)",
    '\tif type(assetId) ~= "number" or assetId % 1 ~= 0 or assetId < 1 or assetId > AssetManager.COUNT then',
    '\t\terror("Invalid Chisel asset id: " .. tostring(assetId), 2)',
    "\tend",
    "\tlocal asset = definitions[assetId]",
    "\tif expectedCategory and asset.category ~= expectedCategory then",
    '\t\terror("Asset " .. asset.id .. " is " .. asset.category .. ", expected " .. expectedCategory, 3)',
    "\tend",
    "\treturn asset",
    "end",
    "",
    "local function fileName(path)",
    '\treturn path:match("[^/\\\\]+$") or path',
    "end",
    "",
    "local function readFile(path)",
    '\tlocal projectRoot = os.getenv("FARBOUND_PROJECT_ROOT")',
    "\tif not projectRoot then",
    "\t\treturn assert(love.filesystem.read(path))",
    "\tend",
    '\tlocal file = assert(io.open(projectRoot .. "/" .. path, "rb"))',
    '\tlocal contents = assert(file:read("*a"))',
    "\tfile:close()",
    "\treturn contents",
    "end",
    "",
    "local function imageData(path)",
    '\tlocal projectRoot = os.getenv("FARBOUND_PROJECT_ROOT")',
    "\tif not projectRoot then",
    "\t\treturn path",
    "\tend",
    "\treturn love.filesystem.newFileData(readFile(path), fileName(path))",
    "end",
    "",
    "local function releaseCache(cache)",
    "\tfor key, resource in pairs(cache) do",
    "\t\tresource:release()",
    "\t\tcache[key] = nil",
    "\tend",
    "end",
    "",
    "function AssetManager.path(assetId)",
    "\treturn definition(assetId).path",
    "end",
    "",
    "function AssetManager.image(assetId)",
    "\tlocal asset = definition(assetId)",
    "\tif not imageCategories[asset.category] then",
    '\t\terror("Asset " .. asset.id .. " cannot be loaded as an image", 2)',
    "\tend",
    "\tif not caches.images[assetId] then",
    "\t\tcaches.images[assetId] = love.graphics.newImage(imageData(asset.path))",
    "\tend",
    "\treturn caches.images[assetId]",
    "end",
    "",
    "function AssetManager.dataImage(assetId)",
    "\tlocal asset = definition(assetId)",
    "\tif not imageCategories[asset.category] then",
    '\t\terror("Asset " .. asset.id .. " cannot be loaded as a data image", 2)',
    "\tend",
    "\tif not caches.dataImages[assetId] then",
    "\t\tcaches.dataImages[assetId] = love.graphics.newImage(imageData(asset.path), { linear = true })",
    "\tend",
    "\treturn caches.dataImages[assetId]",
    "end",
    "",
    "function AssetManager.font(assetId, size, renderScale)",
    '\tlocal asset = definition(assetId, "FONT")',
    '\tif type(size) ~= "number" or size <= 0 then error("Font size must be positive", 2) end',
    "\trenderScale = renderScale or 1",
    '\tlocal key = string.format("%d:%g:%g", assetId, size, renderScale)',
    "\tif not caches.fonts[key] then",
    '\t\tcaches.fonts[key] = love.graphics.newFont(imageData(asset.path), size, "normal", renderScale)',
    "\tend",
    "\treturn caches.fonts[key]",
    "end",
    "",
    "function AssetManager.clearFonts()",
    "\treleaseCache(caches.fonts)",
    "end",
    "",
    "function AssetManager.shader(assetId, vertexShaderId)",
    '\tlocal asset = definition(assetId, "SHADER")',
    '\tlocal key = tostring(assetId) .. ":" .. tostring(vertexShaderId or 0)',
    "\tif not caches.shaders[key] then",
    "\t\tif vertexShaderId then",
    '\t\t\tlocal vertexAsset = definition(vertexShaderId, "SHADER")',
    "\t\t\tcaches.shaders[key] = love.graphics.newShader(readFile(asset.path), readFile(vertexAsset.path))",
    "\t\telse",
    "\t\t\tcaches.shaders[key] = love.graphics.newShader(readFile(asset.path))",
    "\t\tend",
    "\tend",
    "\treturn caches.shaders[key]",
    "end",
    "",
    "function AssetManager.audio(assetId, sourceType)",
    '\tlocal asset = definition(assetId, "AUDIO")',
    '\tsourceType = sourceType or "static"',
    '\tlocal key = tostring(assetId) .. ":" .. sourceType',
    "\tif not caches.audio[key] then",
    "\t\tcaches.audio[key] = love.audio.newSource(imageData(asset.path), sourceType)",
    "\tend",
    "\treturn caches.audio[key]",
    "end",
    "",
    "function AssetManager.text(assetId)",
    '\tlocal asset = definition(assetId, "DATA")',
    "\tif not caches.text[assetId] then caches.text[assetId] = readFile(asset.path) end",
    "\treturn caches.text[assetId]",
    "end",
    "",
    "function AssetManager.destroy()",
    "\treleaseCache(caches.images)",
    "\treleaseCache(caches.dataImages)",
    "\treleaseCache(caches.fonts)",
    "\treleaseCache(caches.shaders)",
    "\treleaseCache(caches.audio)",
    "\tcaches.text = {}",
    "end",
    "",
    "return AssetManager",
    ""
  ];
  return { path: LOVE2D_ASSET_MANAGER_PATH, content: lines.join("\n") };
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
  generatedFiles: Love2dExportFile[],
  terrain: Love2dTerrainExport
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
    `\tASSETS = { module = ${luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.asset_manager`)}, root = ${luaString(LOVE2D_ASSET_EXPORT_ROOT)}, count = ${assets.length} },`,
    `\tLOCALIZATION = { module = ${luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.localization`)}, count = ${localization.keys.length}, locales = ${localization.locales.length} },`,
    `\tINPUT = { module = ${hasInput ? luaString(`${LOVE2D_GAME_DATA_EXPORT_ROOT}.input`) : "nil"}, enabled = ${hasInput ? "true" : "false"} },`,
    `\tTERRAIN = { module = ${terrain.files.length > 0 ? luaString(LOVE2D_TERRAIN_MODULE) : "nil"}, enabled = ${terrain.files.length > 0 ? "true" : "false"}, asset_count = ${terrain.assetCount}, annotation_count = ${terrain.annotationCount}, layout_count = ${terrain.layoutCount} },`,
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
  localization: LocalizationDocument,
  options: Love2dExportOptions = {}
): Love2dExportBundle {
  assertUniqueTablePaths(tables);
  const context: Love2dValueContext = {
    assetIdsById: sequentialIds(assets.map((asset) => asset.id)),
    localizationIdsByPath: sequentialIds(localization.keys.map((key) => key.path)),
    rowIdsByTableId: new Map(tables.map((table) => [table.id, sequentialIds(table.rows.map((row) => row.slug))])),
    tablesById: new Map(tables.map((table) => [table.id, table]))
  };
  const terrain = renderLove2dTerrainExport(options.terrainSourceTables ?? [], tables, assets);
  const generatedFiles = [
    ...tables.map((table) => renderTable(table, context)),
    ...renderLove2dInputExport(tables, LOVE2D_GAME_DATA_EXPORT_ROOT),
    ...terrain.files,
    renderAssetManager(assets),
    renderLocalization(localization)
  ];
  return {
    files: [renderManifest(project, tables, assets, localization, exportedAt, generatedFiles, terrain), ...generatedFiles]
  };
}
