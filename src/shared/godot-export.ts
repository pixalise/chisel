import { snakeCase } from "lodash";
import { godotAssetExportFilePath, godotAssetExportFolderPath } from "./asset-paths";
import {
  localizationIconSlugsForKey,
  localizationKeyConstant,
  localizationPlaceholdersForKey,
  localizationTypedSegments,
  placeholderSyntaxType,
  TranslationPlaceholderType,
  type LocalizationDocument,
  type LocalizationKey,
  type LocalizationPlaceholder
} from "./localization";
import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow, Project } from "./schemas";
import { AssetCategoryEnum, ColumnType, InputKeyEnum } from "./types";

export const GAME_DATA_EXPORT_ROOT = "game_data";
export const GODOT_ASSETS_MODULE_PATH = `${GAME_DATA_EXPORT_ROOT}/assets.gd`;
const INPUT_BINDINGS_TABLE_ID = "input_bindings";
const GODOT_LOCALIZATION_MODULE_PATH = `${GAME_DATA_EXPORT_ROOT}/localization.gd`;
const GODOT_TRANSLATIONS_MODULE_PATH = `${GAME_DATA_EXPORT_ROOT}/translations.gd`;

interface GodotTableExport {
  className: string;
  content: string;
  path: string;
  table: AnyDataTable;
}

interface GodotValueContext {
  assetNamesById: Map<string, string>;
  localizationNamesByPath: Map<string, string>;
  tablesById: Map<string, AnyDataTable>;
}

export interface GodotExportFile {
  content: string;
  path: string;
}

export interface GodotExportBundle {
  files: GodotExportFile[];
}

interface GodotGeneratedFileManifestEntry {
  bytes: number;
  hash: string;
  path: string;
}

export interface GodotPackedTextureExportPaths {
  albedoHeight: string;
  normalRoughness: string;
}

function pascalCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const name = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
  return name || "Table";
}

function constantCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const name = words.map((word) => word.toUpperCase()).join("_");
  return /^[A-Z]/.test(name) ? name : `COLUMN_${name || "VALUE"}`;
}

function columnConstantNames(columns: DataColumnDefinition[]): Map<string, string> {
  const nextSuffixByBase = new Map<string, number>();
  const usedNames = new Set<string>();
  const namesByColumnId = new Map<string, string>();

  for (const column of columns) {
    const baseName = constantCase(column.name);
    let suffix = nextSuffixByBase.get(baseName) ?? 1;
    let name = suffix === 1 ? baseName : `${baseName}_${suffix}`;

    while (usedNames.has(name)) {
      suffix += 1;
      name = `${baseName}_${suffix}`;
    }

    nextSuffixByBase.set(baseName, suffix + 1);
    usedNames.add(name);
    namesByColumnId.set(column.id, name);
  }

  return namesByColumnId;
}

function assetConstantNames(assets: Asset[]): Map<string, string> {
  const nextSuffixByBase = new Map<string, number>();
  const usedNames = new Set<string>();
  const namesByAssetId = new Map<string, string>();

  for (const asset of assets) {
    const baseName = constantCase(asset.name);
    let suffix = nextSuffixByBase.get(baseName) ?? 1;
    let name = suffix === 1 ? baseName : `${baseName}_${suffix}`;

    while (usedNames.has(name)) {
      suffix += 1;
      name = `${baseName}_${suffix}`;
    }

    nextSuffixByBase.set(baseName, suffix + 1);
    usedNames.add(name);
    namesByAssetId.set(asset.id, name);
  }

  return namesByAssetId;
}

function localizationConstantNames(localization?: LocalizationDocument): Map<string, string> {
  return new Map((localization?.keys ?? []).map((key) => [key.path, localizationKeyConstant(key.path)]));
}

function gdString(value: string): string {
  return JSON.stringify(value);
}

function contentHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function fileManifestEntry(file: GodotExportFile): GodotGeneratedFileManifestEntry {
  return {
    bytes: byteLength(file.content),
    hash: contentHash(file.content),
    path: `res://${file.path}`
  };
}

function gdValue(value: unknown, depth = 0): string {
  if (value === null || typeof value === "undefined") {
    return "null";
  }
  if (typeof value === "string") {
    return gdString(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => gdValue(entry, depth)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return gdDictionary(value as Record<string, unknown>, depth);
  }
  return gdString(String(value));
}

function gdDictionary(record: Record<string, unknown>, depth: number): string {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return "{}";
  }
  const indent = "\t".repeat(depth);
  const innerIndent = "\t".repeat(depth + 1);
  const lines = entries.map(([key, value]) => `${innerIndent}${gdString(key)}: ${gdValue(value, depth + 1)}`);
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

export function isPackedTerrainTextureAsset(asset: Asset): boolean {
  return asset.category === AssetCategoryEnum.terrainTexture && asset.extension.toLowerCase() === "gppt";
}

export function godotAssetExportPath(asset: Asset): string {
  if (isPackedTerrainTextureAsset(asset)) {
    return godotAssetExportFolderPath(GAME_DATA_EXPORT_ROOT, asset.category, asset.name);
  }

  return godotAssetExportFilePath(GAME_DATA_EXPORT_ROOT, asset.category, asset.name, asset.extension);
}

export function godotPackedTextureExportPaths(asset: Asset): GodotPackedTextureExportPaths {
  const folder = godotAssetExportFolderPath(GAME_DATA_EXPORT_ROOT, asset.category, asset.name);
  return {
    albedoHeight: `${folder}/albedo_height.png`,
    normalRoughness: `${folder}/normal_roughness.png`
  };
}

function columnValue(row: DataTableRow, column: DataColumnDefinition): unknown {
  const value = row.values.find((entry) => entry.columnId === column.id);
  return value?.value ?? column.defaultValue;
}

function enumBody(table: AnyDataTable): string {
  if (table.rows.length === 0) {
    return "{}";
  }
  const lines = table.rows.map((row, index) => `\t${constantCase(row.slug)} = ${index}`);
  return `{\n${lines.join(",\n")}\n}`;
}

function slugsArray(table: AnyDataTable): string {
  if (table.rows.length === 0) {
    return "[]";
  }
  return `[\n${table.rows.map((row) => `\t${gdString(row.slug)}`).join(",\n")}\n]`;
}

function gdStringName(value: string): string {
  return `&${gdString(value)}`;
}

function stringNameArray(values: string[]): string {
  if (values.length === 0) {
    return "[]";
  }
  return `[\n${values.map((value) => `\t${gdStringName(value)}`).join(",\n")}\n]`;
}

function gdColumnValue(value: unknown, column: DataColumnDefinition, context: GodotValueContext): string {
  if (column.type === ColumnType.ref && typeof value === "string" && column.refTableId) {
    const targetTable = context.tablesById.get(column.refTableId);
    if (targetTable) {
      return `${tableClassName(targetTable)}.Id.${constantCase(value)}`;
    }
  }
  if (column.type === ColumnType.assetRef && typeof value === "string") {
    const assetName = context.assetNamesById.get(value);
    if (assetName) {
      return `ChiselAssets.Id.${assetName}`;
    }
  }
  if (column.type === ColumnType.translationRef) {
    if (typeof value !== "string" || value === "") {
      return "-1";
    }
    const localizationName = context.localizationNamesByPath.get(value);
    if (localizationName) {
      return `ChiselLocalization.Id.${localizationName}`;
    }
    return "-1";
  }
  return gdValue(value);
}

function columnArray(table: AnyDataTable, column: DataColumnDefinition, context: GodotValueContext): string {
  if (table.rows.length === 0) {
    return "[]";
  }
  return `[\n${table.rows.map((row) => `\t${gdColumnValue(columnValue(row, column), column, context)}`).join(",\n")}\n]`;
}

function columnArrays(table: AnyDataTable, context: GodotValueContext): string {
  if (table.columns.length === 0) {
    return "";
  }
  const namesByColumnId = columnConstantNames(table.columns);
  return `\n${table.columns
    .map((column) => `const ${namesByColumnId.get(column.id) ?? constantCase(column.name)} := ${columnArray(table, column, context)}`)
    .join("\n")}`;
}

function tableClassName(table: AnyDataTable): string {
  return `Chisel${pascalCase(table.name || table.id)}`;
}

function tablePath(table: AnyDataTable): string {
  return `${GAME_DATA_EXPORT_ROOT}/tables/${tableFileStem(table)}.gd`;
}

function tableFileStem(table: AnyDataTable): string {
  const stem = snakeCase(table.name || table.id);
  return /^[a-z]/.test(stem) ? stem : `table_${stem || "data"}`;
}

function renderTable(table: AnyDataTable, context: GodotValueContext): GodotTableExport {
  const className = tableClassName(table);
  return {
    className,
    content: `# Generated by Chisel. Do not edit.\nclass_name ${className}\nextends RefCounted\n\nenum Id ${enumBody(table)}\n\nconst TABLE_ID := ${gdString(table.id)}\nconst TABLE_NAME := ${gdString(table.name)}\nconst TABLE_KIND := ${gdString(table.kind)}\nconst SLUGS := ${slugsArray(table)}${columnArrays(table, context)}\n`,
    path: tablePath(table),
    table
  };
}

function renderManifest(
  project: Project,
  exportedAt: string,
  tables: GodotTableExport[],
  assets: Asset[],
  generatedFiles: GodotGeneratedFileManifestEntry[],
  localization?: LocalizationDocument
): GodotExportFile {
  const entries = tables.map(
    (entry) =>
      `\t${gdString(entry.table.id)}: {\n\t\t"name": ${gdString(entry.table.name)},\n\t\t"class_name": ${gdString(entry.className)},\n\t\t"path": ${gdString(`res://${entry.path}`)},\n\t\t"rows": ${entry.table.rows.length},\n\t\t"columns": ${entry.table.columns.length}\n\t}`
  );

  return {
    content: `# Generated by Chisel. Do not edit.\nclass_name ChiselGameDataManifest\nextends RefCounted\n\nconst GENERATED_AT := ${gdString(exportedAt)}\nconst PROJECT_ID := ${gdString(project.id)}\nconst PROJECT_NAME := ${gdString(project.name)}\nconst ASSETS := {\n\t"class_name": "ChiselAssets",\n\t"path": ${gdString(`res://${GODOT_ASSETS_MODULE_PATH}`)},\n\t"count": ${assets.length}\n}\nconst LOCALIZATION := {\n\t"class_name": "ChiselLocalization",\n\t"path": ${gdString(`res://${GODOT_LOCALIZATION_MODULE_PATH}`)},\n\t"typed_class_name": "ChiselTranslations",\n\t"typed_path": ${gdString(`res://${GODOT_TRANSLATIONS_MODULE_PATH}`)},\n\t"csv_path": "res://game_data/localization/translations.csv",\n\t"translations": ${localization?.keys.length ?? 0},\n\t"locales": ${localization?.locales.length ?? 0}\n}\nconst FILES := ${gdValue(generatedFiles)}\nconst TABLES := {\n${entries.join(",\n")}\n}\n`,
    path: `${GAME_DATA_EXPORT_ROOT}/manifest.gd`
  };
}

function assetEnumBody(assets: Asset[]): string {
  if (assets.length === 0) {
    return "{}";
  }
  const namesByAssetId = assetConstantNames(assets);
  const lines = assets.map((asset, index) => `\t${namesByAssetId.get(asset.id) ?? constantCase(asset.name)} = ${index}`);
  return `{\n${lines.join(",\n")}\n}`;
}

function assetIdsArray(assets: Asset[]): string {
  if (assets.length === 0) {
    return "[]";
  }
  return `[\n${assets.map((asset) => `\t${gdString(asset.id)}`).join(",\n")}\n]`;
}

function assetExportRecord(asset: Asset): Record<string, unknown> {
  const exportPath = godotAssetExportPath(asset);
  const record: Record<string, unknown> = {
    category: snakeCase(asset.category),
    extension: asset.extension,
    height: asset.height,
    name: snakeCase(asset.name),
    path: `res://${exportPath}`,
    width: asset.width
  };

  if (isPackedTerrainTextureAsset(asset)) {
    const packedPaths = godotPackedTextureExportPaths(asset);
    record.albedo_height = `res://${packedPaths.albedoHeight}`;
    record.normal_roughness = `res://${packedPaths.normalRoughness}`;
  }

  return record;
}

function assetsById(assets: Asset[]): string {
  const records: Record<string, unknown> = {};
  for (const asset of assets) {
    records[asset.id] = assetExportRecord(asset);
  }
  return gdDictionary(records, 0);
}

function renderAssets(assets: Asset[]): GodotExportFile {
  return {
    content: `# Generated by Chisel. Do not edit.\nclass_name ChiselAssets\nextends RefCounted\n\nenum Id ${assetEnumBody(assets)}\n\nconst IDS := ${assetIdsArray(assets)}\nconst BY_ID := ${assetsById(assets)}\n`,
    path: GODOT_ASSETS_MODULE_PATH
  };
}

function renderLocalizationModule(localization: LocalizationDocument, assets: Asset[]): GodotExportFile {
  const iconSlugsByKey = localization.keys.map((key) => localizationIconSlugsForKey(key, localization.defaultLocale));
  const placeholdersByKey = localization.keys.map((key) => localizationPlaceholdersForKey(key, localization.defaultLocale));
  const content = `# Generated by Chisel. Do not edit.
class_name ChiselLocalization
extends RefCounted

class LocalizedText:
\tvar plain_text: String
\tvar bbcode_text: String
\tvar spans: Array[Dictionary]
\tvar _tooltips: Dictionary

\tfunc _init(next_plain_text: String = "", next_bbcode_text: String = "", next_spans: Array[Dictionary] = [], next_tooltips: Dictionary = {}) -> void:
\t\tplain_text = next_plain_text
\t\tbbcode_text = next_bbcode_text
\t\tspans = next_spans
\t\t_tooltips = next_tooltips

\tfunc tooltip_for(tooltip_slug: StringName) -> String:
\t\treturn tooltip_content_for(tooltip_slug).description.plain_text

\tfunc tooltip_content_for(tooltip_slug: StringName) -> TooltipContent:
\t\treturn _tooltips.get(String(tooltip_slug), TooltipContent.new(tooltip_slug))

class TooltipContent:
\tvar slug: StringName
\tvar icon_path: String
\tvar title: LocalizedText
\tvar description: LocalizedText

\tfunc _init(next_slug: StringName = &"", next_icon_path: String = "", next_title: LocalizedText = null, next_description: LocalizedText = null) -> void:
\t\tslug = next_slug
\t\ticon_path = next_icon_path
\t\ttitle = next_title if next_title != null else LocalizedText.new()
\t\tdescription = next_description if next_description != null else LocalizedText.new()

enum Id ${localizationEnumBody(localization)}

const DEFAULT_LOCALE := ${gdString(localization.defaultLocale)}
const LOCALES := ${gdValue(localization.locales)}
const KEYS := ${gdValue(localization.keys.map((key) => key.path))}
const VALUES := ${gdValue(localizationValuesByLocale(localization))}
const ICON_SLUGS := ${gdValue(iconSlugsByKey)}
const ICONS := ${localizationIconsDictionary(assets)}
const PLACEHOLDERS := ${gdValue(placeholdersByKey.map((placeholders) => placeholders.map((placeholder) => placeholder.name)))}
const PLACEHOLDER_TYPES := ${gdValue(placeholdersByKey.map((placeholders) => placeholders.map((placeholder) => placeholderSyntaxType(placeholder.type))))}
const STYLES := ${localizationStylesDictionary(localization)}
const TOOLTIPS := ${localizationTooltipsDictionary(localization, assets)}
const CSV_PATH := "res://game_data/localization/translations.csv"

static func format(id: int, arguments: Dictionary = {}, locale: String = "") -> LocalizedText:
\treturn _format(id, arguments, locale, 0)

static func tooltip_content(tooltip_slug: StringName, arguments: Dictionary = {}, locale: String = "") -> TooltipContent:
\treturn _tooltip_content(String(tooltip_slug), arguments, _locale_key(locale), 0)

static func _format(id: int, arguments: Dictionary, locale: String, depth: int) -> LocalizedText:
\tif id < 0 or id >= KEYS.size():
\t\treturn LocalizedText.new()
\tvar locale_key := _locale_key(locale)
\tvar templates: Array = VALUES.get(locale_key, VALUES[DEFAULT_LOCALE])
\tvar template := String(templates[id])
\tvar regex := RegEx.new()
\tregex.compile("<style:([A-Z][A-Z0-9_]*)>|</style>|<tooltip:([A-Z][A-Z0-9_]*)>|</tooltip>|<icon:([A-Z][A-Z0-9_]*)\\\\s*/>|\\\\[icon:([A-Z][A-Z0-9_]*)\\\\]|\\\\[term:([A-Z][A-Z0-9_]*)\\\\]|\\\\[/term\\\\]|\\\\{(int|float|string):([a-z][a-z0-9_]*)\\\\}")
\tvar cursor := 0
\tvar plain := ""
\tvar bbcode := ""
\tvar active_styles: Array[Dictionary] = []
\tvar active_tooltips: Array[Dictionary] = []
\tvar spans: Array[Dictionary] = []
\tvar tooltips := {}
\tfor result in regex.search_all(template):
\t\tvar start := result.get_start(0)
\t\tvar end := result.get_end(0)
\t\tvar prefix := template.substr(cursor, start - cursor)
\t\tplain += prefix
\t\tbbcode += _bbcode_escape(prefix)
\t\tvar token := result.get_string(0)
\t\tif token.begins_with("<style:"):
\t\t\tvar style_slug := result.get_string(1)
\t\t\tactive_styles.append({
\t\t\t\t"style": style_slug,
\t\t\t\t"start": plain.length()
\t\t\t})
\t\t\tbbcode += _style_open_bbcode(style_slug)
\t\telif token == "</style>":
\t\t\tbbcode += _style_close_bbcode(_active_style_slug(active_styles))
\t\t\t_close_style(active_styles, spans, plain.length())
\t\telif token.begins_with("<tooltip:"):
\t\t\tvar tooltip_slug := result.get_string(2)
\t\t\tactive_tooltips.append({
\t\t\t\t"tooltip": tooltip_slug,
\t\t\t\t"start": plain.length()
\t\t\t})
\t\t\tbbcode += _tooltip_open_bbcode(tooltip_slug)
\t\telif token == "</tooltip>":
\t\t\tif not active_tooltips.is_empty():
\t\t\t\tbbcode += _tooltip_close_bbcode()
\t\t\t_close_tooltip(active_tooltips, spans, tooltips, plain.length(), arguments, locale_key, depth)
\t\telif token.begins_with("<icon:"):
\t\t\tvar icon_slug := result.get_string(3)
\t\t\tvar icon_start := plain.length()
\t\t\tplain += _icon_plain(icon_slug)
\t\t\tbbcode += _icon_fragment(icon_slug)
\t\t\tvar icon: Dictionary = ICONS.get(icon_slug, {})
\t\t\tspans.append({
\t\t\t\t"type": "icon",
\t\t\t\t"icon": icon_slug,
\t\t\t\t"start": icon_start,
\t\t\t\t"end": plain.length(),
\t\t\t\t"path": String(icon.get("path", ""))
\t\t\t})
\t\telif token.begins_with("[icon:"):
\t\t\tvar icon_slug := result.get_string(4)
\t\t\tvar icon_start := plain.length()
\t\t\tplain += _icon_plain(icon_slug)
\t\t\tbbcode += _icon_fragment(icon_slug)
\t\t\tvar icon: Dictionary = ICONS.get(icon_slug, {})
\t\t\tspans.append({
\t\t\t\t"type": "icon",
\t\t\t\t"icon": icon_slug,
\t\t\t\t"start": icon_start,
\t\t\t\t"end": plain.length(),
\t\t\t\t"path": String(icon.get("path", ""))
\t\t\t})
\t\telif token.begins_with("[term:"):
\t\t\tvar style_slug := result.get_string(5)
\t\t\tactive_styles.append({
\t\t\t\t"style": style_slug,
\t\t\t\t"start": plain.length()
\t\t\t})
\t\t\tbbcode += _style_open_bbcode(style_slug)
\t\telif token == "[/term]":
\t\t\tbbcode += _style_close_bbcode(_active_style_slug(active_styles))
\t\t\t_close_style(active_styles, spans, plain.length())
\t\telse:
\t\t\tvar placeholder_type := result.get_string(6)
\t\t\tvar placeholder := result.get_string(7)
\t\t\tvar replacement := str(arguments.get(placeholder, _placeholder_default(placeholder_type)))
\t\t\tplain += replacement
\t\t\tbbcode += _bbcode_escape(replacement)
\t\tcursor = end

\tvar suffix := template.substr(cursor)
\tplain += suffix
\tbbcode += _bbcode_escape(suffix)
\twhile active_tooltips.size() > 0:
\t\tbbcode += _tooltip_close_bbcode()
\t\t_close_tooltip(active_tooltips, spans, tooltips, plain.length(), arguments, locale_key, depth)
\twhile active_styles.size() > 0:
\t\tbbcode += _style_close_bbcode(_active_style_slug(active_styles))
\t\t_close_style(active_styles, spans, plain.length())
\treturn LocalizedText.new(plain, bbcode, spans, tooltips)

static func _close_style(active_styles: Array[Dictionary], spans: Array[Dictionary], plain_length: int) -> void:
\tif active_styles.is_empty():
\t\treturn
\tvar span: Dictionary = active_styles.pop_back()
\tvar style_slug := String(span.get("style", ""))
\tspans.append({
\t\t"type": "style",
\t\t"style": style_slug,
\t\t"start": int(span.get("start", 0)),
\t\t"end": plain_length,
\t\t"color": _style_color(style_slug),
\t\t"bold": _style_bold(style_slug),
\t\t"italic": _style_italic(style_slug),
\t\t"underline": _style_underline(style_slug)
\t})

static func _close_tooltip(active_tooltips: Array[Dictionary], spans: Array[Dictionary], tooltips: Dictionary, plain_length: int, arguments: Dictionary, locale_key: String, depth: int) -> void:
\tif active_tooltips.is_empty():
\t\treturn
\tvar span: Dictionary = active_tooltips.pop_back()
\tvar tooltip_slug := String(span.get("tooltip", ""))
\tvar tooltip_content := _tooltip_content(tooltip_slug, arguments, locale_key, depth)
\ttooltips[tooltip_slug] = tooltip_content
\tspans.append({
\t\t"type": "tooltip",
\t\t"tooltip": tooltip_slug,
\t\t"start": int(span.get("start", 0)),
\t\t"end": plain_length,
\t\t"tooltip_text": tooltip_content.description.plain_text,
\t\t"tooltip_bbcode_text": tooltip_content.description.bbcode_text,
\t\t"tooltip_title_text": tooltip_content.title.plain_text,
\t\t"tooltip_title_bbcode_text": tooltip_content.title.bbcode_text,
\t\t"tooltip_icon_path": tooltip_content.icon_path
\t})

static func _tooltip_content(tooltip_slug: String, arguments: Dictionary, locale_key: String, depth: int) -> TooltipContent:
\tvar tooltip_data: Dictionary = TOOLTIPS.get(tooltip_slug, {})
\tvar title_text := LocalizedText.new()
\tvar description_text := LocalizedText.new()
\tvar title_id: Variant = tooltip_data.get("title_id", null)
\tvar description_id: Variant = tooltip_data.get("description_id", null)
\tif depth < 4:
\t\tif title_id != null:
\t\t\ttitle_text = _format(int(title_id), arguments, locale_key, depth + 1)
\t\tif description_id != null:
\t\t\tdescription_text = _format(int(description_id), arguments, locale_key, depth + 1)
\treturn TooltipContent.new(StringName(tooltip_slug), String(tooltip_data.get("icon_path", "")), title_text, description_text)

static func _style_open_bbcode(style_slug: String) -> String:
\tvar tags := ""
\tvar color := _style_color(style_slug)
\tif not color.is_empty():
\t\ttags += "[color=%s]" % color
\tif _style_bold(style_slug):
\t\ttags += "[b]"
\tif _style_italic(style_slug):
\t\ttags += "[i]"
\tif _style_underline(style_slug):
\t\ttags += "[u]"
\treturn tags

static func _style_close_bbcode(style_slug: String) -> String:
\tvar tags := ""
\tif _style_underline(style_slug):
\t\ttags += "[/u]"
\tif _style_italic(style_slug):
\t\ttags += "[/i]"
\tif _style_bold(style_slug):
\t\ttags += "[/b]"
\tvar color := _style_color(style_slug)
\tif not color.is_empty():
\t\ttags += "[/color]"
\treturn tags

static func _tooltip_open_bbcode(tooltip_slug: String) -> String:
\treturn "[hint=%s]" % tooltip_slug

static func _tooltip_close_bbcode() -> String:
\treturn "[/hint]"

static func _icon_fragment(icon_slug: String) -> String:
\tvar icon: Dictionary = ICONS.get(icon_slug, {})
\tvar icon_path := String(icon.get("path", ""))
\tif icon_path.is_empty():
\t\treturn _bbcode_escape(_icon_plain(icon_slug))
\treturn "[img=16x16]%s[/img]" % _bbcode_escape(icon_path)

static func _icon_plain(icon_slug: String) -> String:
\treturn "[%s]" % icon_slug

static func _active_style_slug(active_styles: Array[Dictionary]) -> String:
\tif active_styles.is_empty():
\t\treturn ""
\treturn String(active_styles[active_styles.size() - 1].get("style", ""))

static func _style_color(style_slug: String) -> String:
\tvar style: Dictionary = STYLES.get(style_slug, {})
\treturn String(style.get("color", ""))

static func _style_bold(style_slug: String) -> bool:
\tvar style: Dictionary = STYLES.get(style_slug, {})
\treturn bool(style.get("bold", false))

static func _style_italic(style_slug: String) -> bool:
\tvar style: Dictionary = STYLES.get(style_slug, {})
\treturn bool(style.get("italic", false))

static func _style_underline(style_slug: String) -> bool:
\tvar style: Dictionary = STYLES.get(style_slug, {})
\treturn bool(style.get("underline", false))

static func _placeholder_default(placeholder_type: String) -> Variant:
\tif placeholder_type == "int":
\t\treturn -1
\tif placeholder_type == "float":
\t\treturn -1.0
\treturn "UNKNOWN"

static func _locale_key(locale: String) -> String:
\tif not locale.is_empty() and VALUES.has(locale):
\t\treturn locale
\tvar server_locale := TranslationServer.get_locale()
\tif VALUES.has(server_locale):
\t\treturn server_locale
\tvar base_locale := server_locale.get_slice("_", 0)
\tif VALUES.has(base_locale):
\t\treturn base_locale
\treturn DEFAULT_LOCALE

static func _bbcode_escape(value: String) -> String:
\treturn value.replace("[", "\\\\[").replace("]", "\\\\]")
`;
  return {
    content,
    path: GODOT_LOCALIZATION_MODULE_PATH
  };
}

function renderLocalizationCsv(localization: LocalizationDocument): GodotExportFile {
  const header = ["keys", ...localization.locales];
  const rows = localization.keys.map((entry) => [entry.path, ...localization.locales.map((locale) => entry.values[locale] ?? "")]);
  return {
    content: [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
    path: `${GAME_DATA_EXPORT_ROOT}/localization/translations.csv`
  };
}

function renderTranslationsFacade(localization: LocalizationDocument): GodotExportFile {
  const root = localizationTree(localization.keys, localization.defaultLocale);
  const parameterClasses = translationParameterClasses(root);
  const classes = translationClasses(root);
  const rootVariables = [...root.children.values()].map((child) => `static var ${child.name} := ${child.className}.new()`).join("\n");
  const classBlocks = [...parameterClasses, ...classes];
  return {
    content: `# Generated by Chisel. Do not edit.\nclass_name ChiselTranslations\nextends RefCounted\n\n${classBlocks.join("\n\n")}\n\n${rootVariables}\n`,
    path: GODOT_TRANSLATIONS_MODULE_PATH
  };
}

function localizationEnumBody(localization: LocalizationDocument): string {
  if (localization.keys.length === 0) {
    return "{}";
  }
  return `{\n${localization.keys.map((key, index) => `\t${localizationKeyConstant(key.path)} = ${index}`).join(",\n")}\n}`;
}

function localizationValuesByLocale(localization: LocalizationDocument): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const locale of localization.locales) {
    values[locale] = localization.keys.map((key) => key.values[locale] ?? "");
  }
  return values;
}

function localizationStylesDictionary(localization: LocalizationDocument): string {
  if (localization.styles.length === 0) {
    return "{}";
  }
  const lines = localization.styles.map((style) => {
    const fields = [
      `\t\t"color": ${gdString(style.color ?? "")}`,
      `\t\t"bold": ${style.bold}`,
      `\t\t"italic": ${style.italic}`,
      `\t\t"underline": ${style.underline}`
    ];
    return `\t${gdString(style.slug)}: {\n${fields.join(",\n")}\n\t}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

function localizationTooltipsDictionary(localization: LocalizationDocument, assets: Asset[]): string {
  if (localization.tooltips.length === 0) {
    return "{}";
  }
  const keyIndexByPath = new Map(localization.keys.map((key, index) => [key.path, index]));
  const uiIconAssetsById = new Map(assets.filter((asset) => asset.category === AssetCategoryEnum.uiIcon).map((asset) => [asset.id, asset]));
  const lines = localization.tooltips.map((tooltip) => {
    const fields: string[] = [];
    const titleIndex = keyIndexByPath.get(tooltip.titleKey);
    const descriptionIndex = keyIndexByPath.get(tooltip.descriptionKey);
    const iconAsset = tooltip.iconAssetId ? uiIconAssetsById.get(tooltip.iconAssetId) : undefined;
    if (typeof titleIndex === "number") {
      fields.push(`\t\t"title_id": Id.${localizationKeyConstant(tooltip.titleKey)}`);
    } else {
      fields.push(`\t\t"title_id": null`);
      fields.push(`\t\t"missing_title_key": ${gdString(tooltip.titleKey)}`);
    }
    if (typeof descriptionIndex === "number") {
      fields.push(`\t\t"description_id": Id.${localizationKeyConstant(tooltip.descriptionKey)}`);
    } else {
      fields.push(`\t\t"description_id": null`);
      fields.push(`\t\t"missing_description_key": ${gdString(tooltip.descriptionKey)}`);
    }
    fields.push(`\t\t"icon_asset_id": ${gdString(tooltip.iconAssetId ?? "")}`);
    fields.push(`\t\t"icon_path": ${gdString(iconAsset ? `res://${godotAssetExportPath(iconAsset)}` : "")}`);
    return `\t${gdString(tooltip.slug)}: {\n${fields.join(",\n")}\n\t}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

function localizationIconsDictionary(assets: Asset[]): string {
  const iconAssets = assets.filter((asset) => asset.category === AssetCategoryEnum.uiIcon);
  if (iconAssets.length === 0) {
    return "{}";
  }

  const lines = iconAssets.map((asset) => {
    const fields = [
      `\t\t"asset_id": ${gdString(asset.id)}`,
      `\t\t"path": ${gdString(`res://${godotAssetExportPath(asset)}`)}`,
      `\t\t"width": ${asset.width}`,
      `\t\t"height": ${asset.height}`
    ];
    return `\t${gdString(asset.id)}: {\n${fields.join(",\n")}\n\t}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

interface TranslationTreeNode {
  children: Map<string, TranslationTreeNode>;
  className: string;
  methods: TranslationTreeMethod[];
  name: string;
  path: string[];
}

interface TranslationTreeMethod {
  key: LocalizationKey;
  name: string;
  parameterClassName: string;
  placeholders: LocalizationPlaceholder[];
}

function localizationTree(keys: LocalizationKey[], defaultLocale: string): TranslationTreeNode {
  const root: TranslationTreeNode = {
    children: new Map(),
    className: "RootTranslations",
    methods: [],
    name: "root",
    path: []
  };
  for (const key of keys) {
    const segments = localizationTypedSegments(key.path);
    const namespaceSegments = segments.slice(0, -1);
    const methodName = segments[segments.length - 1] ?? "translation";
    let node = root;
    namespaceSegments.forEach((segment) => {
      const path = [...node.path, segment];
      let child = node.children.get(segment);
      if (!child) {
        child = {
          children: new Map(),
          className: `${path.map((entry) => pascalCase(entry)).join("")}Translations`,
          methods: [],
          name: segment,
          path
        };
        node.children.set(segment, child);
      }
      node = child;
    });
    node.methods.push({
      key,
      name: methodName,
      parameterClassName: `${segments.map((segment) => pascalCase(segment)).join("")}Parameters`,
      placeholders: localizationPlaceholdersForKey(key, defaultLocale)
    });
  }
  return root;
}

function translationClasses(root: TranslationTreeNode): string[] {
  const nodes = [...walkTranslationNodes(root)].filter((node) => node !== root);
  return nodes.reverse().map((node) => {
    const childVariables = [...node.children.values()].map((child) => `\tvar ${child.name} := ${child.className}.new()`);
    const methods = node.methods.map((method) => translationMethod(method));
    return `class ${node.className}:\n${[...childVariables, ...methods].join("\n") || "\tpass"}`;
  });
}

function translationParameterClasses(root: TranslationTreeNode): string[] {
  const methods = [...walkTranslationNodes(root)].flatMap((node) => node.methods).filter((method) => method.placeholders.length > 0);
  return methods.map((method) => translationParameterClass(method));
}

function translationParameterClass(method: TranslationTreeMethod): string {
  const fields = method.placeholders.map(
    (placeholder) => `\tvar ${placeholder.name}: ${gdscriptPlaceholderType(placeholder)} = ${gdscriptPlaceholderDefaultValue(placeholder)}`
  );
  const assignments = method.placeholders.map(
    (placeholder) =>
      `\t\tif values.has(${gdString(placeholder.name)}):\n\t\t\t${placeholder.name} = ${gdscriptPlaceholderConversion(
        placeholder,
        `values[${gdString(placeholder.name)}]`
      )}`
  );
  return `class ${method.parameterClassName}:\n${fields.join("\n")}\n\n\tfunc _init(values: Dictionary = {}) -> void:\n${assignments.join("\n") || "\t\tpass"}\n\n\tfunc to_arguments() -> Dictionary:\n\t\treturn ${gdscriptArgumentsDictionary(method.placeholders)}`;
}

function* walkTranslationNodes(node: TranslationTreeNode): Generator<TranslationTreeNode> {
  yield node;
  for (const child of node.children.values()) {
    yield* walkTranslationNodes(child);
  }
}

function translationMethod(method: TranslationTreeMethod): string {
  const { key, name: methodName, placeholders } = method;
  if (placeholders.length === 0) {
    return `\tfunc ${methodName}() -> ChiselLocalization.LocalizedText:\n\t\treturn ChiselLocalization.format(ChiselLocalization.Id.${localizationKeyConstant(key.path)}, {})`;
  }
  return `\tfunc ${methodName}(parameters: ${method.parameterClassName} = null) -> ChiselLocalization.LocalizedText:\n\t\tif parameters == null:\n\t\t\tparameters = ${method.parameterClassName}.new()\n\t\treturn ChiselLocalization.format(ChiselLocalization.Id.${localizationKeyConstant(key.path)}, parameters.to_arguments())`;
}

function gdscriptPlaceholderType(placeholder: LocalizationPlaceholder): string {
  if (placeholder.type === TranslationPlaceholderType.integer) {
    return "int";
  }
  if (placeholder.type === TranslationPlaceholderType.number) {
    return "float";
  }
  return "String";
}

function gdscriptPlaceholderDefaultValue(placeholder: LocalizationPlaceholder): string {
  if (placeholder.type === TranslationPlaceholderType.integer) {
    return "-1";
  }
  if (placeholder.type === TranslationPlaceholderType.number) {
    return "-1.0";
  }
  return gdString("UNKNOWN");
}

function gdscriptPlaceholderConversion(placeholder: LocalizationPlaceholder, value: string): string {
  if (placeholder.type === TranslationPlaceholderType.integer) {
    return `int(${value})`;
  }
  if (placeholder.type === TranslationPlaceholderType.number) {
    return `float(${value})`;
  }
  return `str(${value})`;
}

function gdscriptArgumentsDictionary(placeholders: LocalizationPlaceholder[]): string {
  if (placeholders.length === 0) {
    return "{}";
  }
  return `{${placeholders.map((placeholder) => `${gdString(placeholder.name)}: ${placeholder.name}`).join(", ")}}`;
}

function inputBindingConstants(prefix: string): string {
  const lines = Object.values(InputKeyEnum)
    .filter((binding) => binding.startsWith(prefix))
    .map((binding) => `\t${gdString(binding)}: ${binding}`);
  return `{\n${lines.join(",\n")}\n}`;
}

function renderInputExport(tables: GodotTableExport[]): GodotExportFile[] {
  const inputTable = tables.find((entry) => entry.table.id === INPUT_BINDINGS_TABLE_ID);
  if (!inputTable) {
    return [];
  }
  const actionNames = stringNameArray(inputTable.table.rows.map((row) => snakeCase(row.slug)));

  return [
    {
      content: `# Generated by Chisel. Do not edit.\nclass_name ChiselInput\nextends RefCounted\n\nconst ACTION_NAMES := ${actionNames}\nconst KEY_BINDINGS := ${inputBindingConstants("KEY_")}\nconst MOUSE_BINDINGS := ${inputBindingConstants("MOUSE_BUTTON_")}\n\nstatic func action_name(action_id: int) -> StringName:\n\treturn ACTION_NAMES[action_id]\n\nstatic func get_action_strength(action_id: int) -> float:\n\treturn Input.get_action_strength(action_name(action_id))\n\nstatic func is_action_pressed(action_id: int) -> bool:\n\treturn Input.is_action_pressed(action_name(action_id))\n\nstatic func is_action_just_pressed(action_id: int) -> bool:\n\treturn Input.is_action_just_pressed(action_name(action_id))\n\nstatic func is_action_just_released(action_id: int) -> bool:\n\treturn Input.is_action_just_released(action_name(action_id))\n\nfunc apply_to_input_map(clear_existing: bool = true) -> void:\n\tfor index in range(ACTION_NAMES.size()):\n\t\tvar input_action_name := action_name(index)\n\t\tif not InputMap.has_action(input_action_name):\n\t\t\tInputMap.add_action(input_action_name)\n\t\telif clear_existing:\n\t\t\tInputMap.action_erase_events(input_action_name)\n\t\tfor binding in ChiselInputBindings.BINDINGS[index]:\n\t\t\tvar event: Variant = _event_from_binding(String(binding))\n\t\t\tif event is InputEvent:\n\t\t\t\tInputMap.action_add_event(input_action_name, event)\n\nfunc _event_from_binding(binding: String) -> Variant:\n\tif KEY_BINDINGS.has(binding):\n\t\treturn _key(int(KEY_BINDINGS[binding]))\n\tif MOUSE_BINDINGS.has(binding):\n\t\treturn _mouse_button(int(MOUSE_BINDINGS[binding]))\n\n\tpush_warning("Unsupported Chisel input binding: %s" % binding)\n\treturn null\n\nfunc _key(keycode: int) -> InputEventKey:\n\tvar event := InputEventKey.new()\n\tevent.keycode = keycode\n\treturn event\n\nfunc _mouse_button(button_index: int) -> InputEventMouseButton:\n\tvar event := InputEventMouseButton.new()\n\tevent.button_index = button_index\n\treturn event\n`,
      path: `${GAME_DATA_EXPORT_ROOT}/input.gd`
    }
  ];
}

export function createGodotExportBundle(
  project: Project,
  tables: AnyDataTable[],
  exportedAt: string,
  assets: Asset[] = [],
  localization?: LocalizationDocument
): GodotExportBundle {
  const context: GodotValueContext = {
    assetNamesById: assetConstantNames(assets),
    localizationNamesByPath: localizationConstantNames(localization),
    tablesById: new Map(tables.map((table) => [table.id, table]))
  };
  const tableFiles = tables.map((table) => renderTable(table, context));
  const generatedFiles = [
    renderAssets(assets),
    ...(localization
      ? [renderLocalizationModule(localization, assets), renderTranslationsFacade(localization), renderLocalizationCsv(localization)]
      : []),
    ...renderInputExport(tableFiles),
    ...tableFiles.map(({ content, path }) => ({ content, path }))
  ];
  return {
    files: [renderManifest(project, exportedAt, tableFiles, assets, generatedFiles.map(fileManifestEntry), localization), ...generatedFiles]
  };
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
