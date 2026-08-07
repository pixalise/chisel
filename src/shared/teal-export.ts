import type { LocalizationDocument } from "./localization";
import {
  createLove2dExportBundle,
  LOVE2D_ASSET_EXPORT_ROOT,
  LOVE2D_GAME_DATA_EXPORT_ROOT,
  love2dTableModuleName,
  type Love2dExportFile
} from "./love2d-export";
import { createLove2dAtlasTextFiles } from "./love2d-atlas-export";
import type { AnyDataTable, DataColumnDefinition, Project, TextureAtlasBuildResult } from "./schemas";
import { ColumnType } from "./types";

export const TEAL_GAME_DATA_EXPORT_ROOT = LOVE2D_GAME_DATA_EXPORT_ROOT;
export const TEAL_ASSET_EXPORT_ROOT = LOVE2D_ASSET_EXPORT_ROOT;
export const TEAL_MANIFEST_PATH = `${TEAL_GAME_DATA_EXPORT_ROOT}/manifest.tl`;
export const TEAL_ATLAS_EXPORT_ROOT = `${TEAL_GAME_DATA_EXPORT_ROOT}/atlases`;

export interface TealExportFile {
  content: string;
  path: string;
}

export interface TealExportBundle {
  files: TealExportFile[];
}

function replaceRequired(content: string, source: string, replacement: string, filePath: string): string {
  if (!content.includes(source)) {
    throw new Error(`Teal export could not convert ${filePath}; expected generated fragment was missing: ${source}`);
  }
  return content.replace(source, replacement);
}

function tealPath(luaPath: string): string {
  return luaPath.endsWith(".lua") ? `${luaPath.slice(0, -4)}.tl` : luaPath;
}

function tealFileReferences(content: string): string {
  return content.replace(/(gamedata\/[A-Za-z0-9_./-]+)\.lua/g, "$1.tl");
}

function tealColumnArrayType(column: DataColumnDefinition): string {
  if (
    !column.required &&
    column.type !== ColumnType.ref &&
    column.type !== ColumnType.assetRef &&
    column.type !== ColumnType.translationRef
  ) {
    return "{any}";
  }

  switch (column.type) {
    case ColumnType.integer:
    case ColumnType.ref:
    case ColumnType.assetRef:
    case ColumnType.translationRef:
      return "{integer}";
    case ColumnType.decimal:
    case ColumnType.range:
      return "{number}";
    case ColumnType.boolean:
      return "{boolean}";
    case ColumnType.enumArray:
      return "{{string}}";
    case ColumnType.vector2:
    case ColumnType.vector3:
    case ColumnType.vector4:
      return "{{number}}";
    case ColumnType.json:
      return "{any}";
    case ColumnType.string:
    case ColumnType.text:
    case ColumnType.enum:
    case ColumnType.color:
      return "{string}";
  }
}

function generatedColumnNames(content: string): string[] {
  return [...content.matchAll(/^\t([A-Z][A-Z0-9_]*) = \{/gm)].map((match) => match[1]).filter((name) => name !== "ID" && name !== "SLUGS");
}

function tealTableContent(file: Love2dExportFile, table: AnyDataTable): string {
  const columnNames = generatedColumnNames(file.content);
  if (columnNames.length !== table.columns.length) {
    throw new Error(
      `Teal export could not match ${table.columns.length} columns from table "${table.id}" to ${columnNames.length} generated fields.`
    );
  }

  const recordLines = [
    "local record Data",
    "\tTABLE_ID: string",
    "\tTABLE_NAME: string",
    "\tCOUNT: integer",
    "\tID: {string: integer}",
    "\tSLUGS: {string}",
    ...table.columns.map((column, index) => `\t${columnNames[index]}: ${tealColumnArrayType(column)}`),
    "end",
    ""
  ];
  return replaceRequired(tealFileReferences(file.content), "local data = {", `${recordLines.join("\n")}local data: Data = {`, file.path);
}

function tealAssetsContent(file: Love2dExportFile): string {
  let content = tealFileReferences(file.content);
  const record = [
    "local record Assets",
    "\tCOUNT: integer",
    "\tID: {string: integer}",
    "\tIDS: {string}",
    "\tPATHS: {string}",
    "\tpath: function(integer): string",
    "end",
    ""
  ].join("\n");
  content = replaceRequired(content, "local assets = {", `${record}local assets: Assets = {`, file.path);
  content = replaceRequired(content, "function assets.path(id)", "function assets.path(id: integer): string", file.path);
  return content;
}

function tealLocalizationContent(file: Love2dExportFile): string {
  let content = tealFileReferences(file.content);
  const record = [
    "local record Localization",
    "\tDEFAULT_LOCALE: string",
    "\tCOUNT: integer",
    "\tID: {string: integer}",
    "\tLOCALES: {string}",
    "\tKEYS: {string}",
    "\tVALUES: {{string}}",
    "\tget: function(integer, string): string",
    "end",
    ""
  ].join("\n");
  content = replaceRequired(content, "local localeIndexes = {", "local localeIndexes: {string: integer} = {", file.path);
  content = replaceRequired(content, "local localization = {", `${record}local localization: Localization = {`, file.path);
  content = replaceRequired(
    content,
    "function localization.get(id, locale)",
    "function localization.get(id: integer, locale: string): string",
    file.path
  );
  return content;
}

function tealInputContent(file: Love2dExportFile): string {
  let content = tealFileReferences(file.content);
  const record = [
    "local record Input",
    "\tID: {string: integer}",
    "\tACTION_NAMES: {string}",
    "\tactionName: function(integer): string",
    "\tgetActionStrength: function(integer): integer",
    "\tisActionPressed: function(integer): boolean",
    "\tisActionJustPressed: function(integer): boolean",
    "\tisActionJustReleased: function(integer): boolean",
    "\tkeypressed: function(love.keyboard.KeyConstant, love.keyboard.Scancode, boolean): nil",
    "\tkeyreleased: function(love.keyboard.KeyConstant): nil",
    "\tmousepressed: function(number, number, integer): nil",
    "\tmousereleased: function(number, number, integer): nil",
    "\twheelmoved: function(number, number): nil",
    "\tendFrame: function(): nil",
    "end",
    ""
  ].join("\n");
  const replacements: Array<[string, string]> = [
    ["local input = {", `${record}local input: Input = {`],
    ["local keyBindings = {", "local keyBindings: {{love.keyboard.KeyConstant}} = {"],
    ["local mouseBindings = {", "local mouseBindings: {{integer}} = {"],
    ["local wheelBindings = {", "local wheelBindings: {{integer}} = {"],
    ["local justPressedKeys = {}", "local justPressedKeys: {love.keyboard.KeyConstant: boolean} = {}"],
    ["local justReleasedKeys = {}", "local justReleasedKeys: {love.keyboard.KeyConstant: boolean} = {}"],
    ["local justPressedMouseButtons = {}", "local justPressedMouseButtons: {integer: boolean} = {}"],
    ["local justReleasedMouseButtons = {}", "local justReleasedMouseButtons: {integer: boolean} = {}"],
    ["local wheelDelta = 0", "local wheelDelta: number = 0"],
    ["local function actionIndex(action)", "local function actionIndex(action: integer): integer"],
    ["local function requireLoveInput()", "local function requireLoveInput(): nil"],
    [
      "local function hasKeyState(keys, states)",
      "local function hasKeyState(keys: {love.keyboard.KeyConstant}, states: {love.keyboard.KeyConstant: boolean}): boolean"
    ],
    [
      "local function hasMouseState(buttons, states)",
      "local function hasMouseState(buttons: {integer}, states: {integer: boolean}): boolean"
    ],
    ["local function hasWheelState(directions)", "local function hasWheelState(directions: {integer}): boolean"],
    ["function input.actionName(action)", "function input.actionName(action: integer): string"],
    ["function input.getActionStrength(action)", "function input.getActionStrength(action: integer): integer"],
    ["function input.isActionPressed(action)", "function input.isActionPressed(action: integer): boolean"],
    ["function input.isActionJustPressed(action)", "function input.isActionJustPressed(action: integer): boolean"],
    ["function input.isActionJustReleased(action)", "function input.isActionJustReleased(action: integer): boolean"],
    [
      "function input.keypressed(key, _scanCode, isRepeat)",
      "function input.keypressed(key: love.keyboard.KeyConstant, _scanCode: love.keyboard.Scancode, isRepeat: boolean): nil"
    ],
    ["function input.keyreleased(key)", "function input.keyreleased(key: love.keyboard.KeyConstant): nil"],
    ["function input.mousepressed(_x, _y, button)", "function input.mousepressed(_x: number, _y: number, button: integer): nil"],
    ["function input.mousereleased(_x, _y, button)", "function input.mousereleased(_x: number, _y: number, button: integer): nil"],
    ["function input.wheelmoved(_deltaX, deltaY)", "function input.wheelmoved(_deltaX: number, deltaY: number): nil"],
    ["function input.endFrame()", "function input.endFrame(): nil"]
  ];

  for (const [source, replacement] of replacements) {
    content = replaceRequired(content, source, replacement, file.path);
  }
  return content;
}

function tealLooseModuleContent(file: Love2dExportFile, localName: string): string {
  let content = tealFileReferences(file.content);
  content = replaceRequired(content, "return {", `local ${localName}: any = {`, file.path);
  const finalClose = /\}\n$/;
  if (!finalClose.test(content)) {
    throw new Error(`Teal export could not convert ${file.path}; generated module did not end with a table.`);
  }
  return content.replace(finalClose, `}\n\nreturn ${localName}\n`);
}

function tealFile(file: Love2dExportFile, tablesByLuaPath: Map<string, AnyDataTable>): TealExportFile {
  const table = tablesByLuaPath.get(file.path);
  let content: string;
  if (table) {
    content = tealTableContent(file, table);
  } else if (file.path.endsWith("/assets.lua")) {
    content = tealAssetsContent(file);
  } else if (file.path.endsWith("/localization.lua")) {
    content = tealLocalizationContent(file);
  } else if (file.path.endsWith("/input.lua")) {
    content = tealInputContent(file);
  } else if (file.path.endsWith("/manifest.lua")) {
    content = tealLooseModuleContent(file, "manifest");
  } else {
    throw new Error(`Teal export does not recognize generated LÖVE module ${file.path}.`);
  }

  return { path: tealPath(file.path), content };
}

export function createTealExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Parameters<typeof createLove2dExportBundle>[3],
  localization: LocalizationDocument
): TealExportBundle {
  const luaBundle = createLove2dExportBundle(project, tables, exportedAt, assets, localization);
  const tablesByLuaPath = new Map(tables.map((table) => [`${love2dTableModuleName(table).replaceAll(".", "/")}.lua`, table] as const));
  return { files: luaBundle.files.map((file) => tealFile(file, tablesByLuaPath)) };
}

export function createTealAtlasTextFiles(build: TextureAtlasBuildResult): TealExportFile[] {
  return createLove2dAtlasTextFiles(build).map((file) => {
    if (!file.path.endsWith(".lua")) {
      return file;
    }
    return {
      path: tealPath(file.path),
      content: tealLooseModuleContent(file, "atlas")
    };
  });
}
