"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GODOT_ASSETS_MODULE_PATH = exports.GAME_DATA_EXPORT_ROOT = void 0;
exports.isPackedTerrainTextureAsset = isPackedTerrainTextureAsset;
exports.godotAssetExportPath = godotAssetExportPath;
exports.godotPackedTextureExportPaths = godotPackedTextureExportPaths;
exports.createGodotExportBundle = createGodotExportBundle;
const asset_paths_1 = require("./asset-paths");
const localization_1 = require("./localization");
const types_1 = require("./types");
exports.GAME_DATA_EXPORT_ROOT = "game_data";
exports.GODOT_ASSETS_MODULE_PATH = `${exports.GAME_DATA_EXPORT_ROOT}/assets.gd`;
const INPUT_BINDINGS_TABLE_ID = "input_bindings";
const GODOT_LOCALIZATION_MODULE_PATH = `${exports.GAME_DATA_EXPORT_ROOT}/localization.gd`;
const GODOT_TRANSLATIONS_MODULE_PATH = `${exports.GAME_DATA_EXPORT_ROOT}/translations.gd`;
function pascalCase(value) {
    const words = value.match(/[A-Za-z0-9]+/g) ?? [];
    const name = words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join("");
    return name || "Table";
}
function constantCase(value) {
    const words = value.match(/[A-Za-z0-9]+/g) ?? [];
    const name = words.map((word) => word.toUpperCase()).join("_");
    return /^[A-Z]/.test(name) ? name : `COLUMN_${name || "VALUE"}`;
}
function columnConstantNames(columns) {
    const nextSuffixByBase = new Map();
    const usedNames = new Set();
    const namesByColumnId = new Map();
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
function assetConstantNames(assets) {
    const nextSuffixByBase = new Map();
    const usedNames = new Set();
    const namesByAssetId = new Map();
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
function gdString(value) {
    return JSON.stringify(value);
}
function contentHash(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}
function byteLength(value) {
    return new TextEncoder().encode(value).length;
}
function fileManifestEntry(file) {
    return {
        bytes: byteLength(file.content),
        hash: contentHash(file.content),
        path: `res://${file.path}`
    };
}
function gdValue(value, depth = 0) {
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
        return gdDictionary(value, depth);
    }
    return gdString(String(value));
}
function gdDictionary(record, depth) {
    const entries = Object.entries(record);
    if (entries.length === 0) {
        return "{}";
    }
    const indent = "\t".repeat(depth);
    const innerIndent = "\t".repeat(depth + 1);
    const lines = entries.map(([key, value]) => `${innerIndent}${gdString(key)}: ${gdValue(value, depth + 1)}`);
    return `{\n${lines.join(",\n")}\n${indent}}`;
}
function isPackedTerrainTextureAsset(asset) {
    return asset.category === types_1.AssetCategoryEnum.terrainTexture && asset.extension.toLowerCase() === "gppt";
}
function godotAssetExportPath(asset) {
    if (isPackedTerrainTextureAsset(asset)) {
        return (0, asset_paths_1.godotAssetExportFolderPath)(exports.GAME_DATA_EXPORT_ROOT, asset.category, asset.name);
    }
    return (0, asset_paths_1.godotAssetExportFilePath)(exports.GAME_DATA_EXPORT_ROOT, asset.category, asset.name, asset.extension);
}
function godotPackedTextureExportPaths(asset) {
    const folder = (0, asset_paths_1.godotAssetExportFolderPath)(exports.GAME_DATA_EXPORT_ROOT, asset.category, asset.name);
    return {
        albedoHeight: `${folder}/albedo_height.png`,
        normalRoughness: `${folder}/normal_roughness.png`
    };
}
function columnValue(row, column) {
    const value = row.values.find((entry) => entry.columnId === column.id);
    return value?.value ?? column.defaultValue;
}
function enumBody(table) {
    if (table.rows.length === 0) {
        return "{}";
    }
    const lines = table.rows.map((row, index) => `\t${constantCase(row.slug)} = ${index}`);
    return `{\n${lines.join(",\n")}\n}`;
}
function slugsArray(table) {
    if (table.rows.length === 0) {
        return "[]";
    }
    return `[\n${table.rows.map((row) => `\t${gdString(row.slug)}`).join(",\n")}\n]`;
}
function gdStringName(value) {
    return `&${gdString(value)}`;
}
function stringNameArray(values) {
    if (values.length === 0) {
        return "[]";
    }
    return `[\n${values.map((value) => `\t${gdStringName(value)}`).join(",\n")}\n]`;
}
function gdColumnValue(value, column, context) {
    if (column.type === types_1.ColumnType.ref && typeof value === "string" && column.refTableId) {
        const targetTable = context.tablesById.get(column.refTableId);
        if (targetTable) {
            return `${tableClassName(targetTable)}.Id.${constantCase(value)}`;
        }
    }
    if (column.type === types_1.ColumnType.assetRef && typeof value === "string") {
        const assetName = context.assetNamesById.get(value);
        if (assetName) {
            return `ChiselAssets.Id.${assetName}`;
        }
    }
    return gdValue(value);
}
function columnArray(table, column, context) {
    if (table.rows.length === 0) {
        return "[]";
    }
    return `[\n${table.rows.map((row) => `\t${gdColumnValue(columnValue(row, column), column, context)}`).join(",\n")}\n]`;
}
function columnArrays(table, context) {
    if (table.columns.length === 0) {
        return "";
    }
    const namesByColumnId = columnConstantNames(table.columns);
    return `\n${table.columns
        .map((column) => `const ${namesByColumnId.get(column.id) ?? constantCase(column.name)} := ${columnArray(table, column, context)}`)
        .join("\n")}`;
}
function tableClassName(table) {
    return `Chisel${pascalCase(table.name || table.id)}`;
}
function tablePath(table) {
    return `${exports.GAME_DATA_EXPORT_ROOT}/tables/${tableFileStem(table)}.gd`;
}
function tableFileStem(table) {
    const stem = (0, asset_paths_1.snakeCase)(table.name || table.id);
    return /^[a-z]/.test(stem) ? stem : `table_${stem || "data"}`;
}
function renderTable(table, context) {
    const className = tableClassName(table);
    return {
        className,
        content: `# Generated by Chisel. Do not edit.\nclass_name ${className}\nextends RefCounted\n\nenum Id ${enumBody(table)}\n\nconst TABLE_ID := ${gdString(table.id)}\nconst TABLE_NAME := ${gdString(table.name)}\nconst TABLE_KIND := ${gdString(table.kind)}\nconst SLUGS := ${slugsArray(table)}${columnArrays(table, context)}\n`,
        path: tablePath(table),
        table
    };
}
function renderManifest(project, exportedAt, tables, assets, generatedFiles, localization) {
    const entries = tables.map((entry) => `\t${gdString(entry.table.id)}: {\n\t\t"name": ${gdString(entry.table.name)},\n\t\t"class_name": ${gdString(entry.className)},\n\t\t"path": ${gdString(`res://${entry.path}`)},\n\t\t"rows": ${entry.table.rows.length},\n\t\t"columns": ${entry.table.columns.length}\n\t}`);
    return {
        content: `# Generated by Chisel. Do not edit.\nclass_name ChiselGameDataManifest\nextends RefCounted\n\nconst GENERATED_AT := ${gdString(exportedAt)}\nconst PROJECT_ID := ${gdString(project.id)}\nconst PROJECT_NAME := ${gdString(project.name)}\nconst ASSETS := {\n\t"class_name": "ChiselAssets",\n\t"path": ${gdString(`res://${exports.GODOT_ASSETS_MODULE_PATH}`)},\n\t"count": ${assets.length}\n}\nconst LOCALIZATION := {\n\t"class_name": "ChiselLocalization",\n\t"path": ${gdString(`res://${GODOT_LOCALIZATION_MODULE_PATH}`)},\n\t"typed_class_name": "ChiselTranslations",\n\t"typed_path": ${gdString(`res://${GODOT_TRANSLATIONS_MODULE_PATH}`)},\n\t"csv_path": "res://game_data/localization/translations.csv",\n\t"translations": ${localization?.keys.length ?? 0},\n\t"locales": ${localization?.locales.length ?? 0}\n}\nconst FILES := ${gdValue(generatedFiles)}\nconst TABLES := {\n${entries.join(",\n")}\n}\n`,
        path: `${exports.GAME_DATA_EXPORT_ROOT}/manifest.gd`
    };
}
function assetEnumBody(assets) {
    if (assets.length === 0) {
        return "{}";
    }
    const namesByAssetId = assetConstantNames(assets);
    const lines = assets.map((asset, index) => `\t${namesByAssetId.get(asset.id) ?? constantCase(asset.name)} = ${index}`);
    return `{\n${lines.join(",\n")}\n}`;
}
function assetIdsArray(assets) {
    if (assets.length === 0) {
        return "[]";
    }
    return `[\n${assets.map((asset) => `\t${gdString(asset.id)}`).join(",\n")}\n]`;
}
function assetExportRecord(asset) {
    const exportPath = godotAssetExportPath(asset);
    const record = {
        category: (0, asset_paths_1.snakeCase)(asset.category),
        extension: asset.extension,
        height: asset.height,
        name: (0, asset_paths_1.snakeCase)(asset.name),
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
function assetsById(assets) {
    const records = {};
    for (const asset of assets) {
        records[asset.id] = assetExportRecord(asset);
    }
    return gdDictionary(records, 0);
}
function renderAssets(assets) {
    return {
        content: `# Generated by Chisel. Do not edit.\nclass_name ChiselAssets\nextends RefCounted\n\nenum Id ${assetEnumBody(assets)}\n\nconst IDS := ${assetIdsArray(assets)}\nconst BY_ID := ${assetsById(assets)}\n`,
        path: exports.GODOT_ASSETS_MODULE_PATH
    };
}
function renderLocalizationModule(localization) {
    return {
        content: `# Generated by Chisel. Do not edit.\nclass_name ChiselLocalization\nextends RefCounted\n\nclass LocalizedText:\n\tvar plain_text: String\n\tvar bbcode_text: String\n\tvar spans: Array[Dictionary]\n\tvar _tooltips: Dictionary\n\n\tfunc _init(next_plain_text: String = "", next_bbcode_text: String = "", next_spans: Array[Dictionary] = [], next_tooltips: Dictionary = {}) -> void:\n\t\tplain_text = next_plain_text\n\t\tbbcode_text = next_bbcode_text\n\t\tspans = next_spans\n\t\t_tooltips = next_tooltips\n\n\tfunc tooltip_for(placeholder_name: StringName) -> String:\n\t\treturn String(_tooltips.get(String(placeholder_name), ""))\n\nenum Id ${localizationEnumBody(localization)}\n\nconst DEFAULT_LOCALE := ${gdString(localization.defaultLocale)}\nconst LOCALES := ${gdValue(localization.locales)}\nconst KEYS := ${gdValue(localization.keys.map((key) => key.path))}\nconst VALUES := ${gdValue(localizationValuesByLocale(localization))}\nconst PLACEHOLDERS := ${gdValue(localization.keys.map((key) => key.placeholders.map((placeholder) => placeholder.name)))}\nconst PLACEHOLDER_TYPES := ${gdValue(localization.keys.map((key) => key.placeholders.map((placeholder) => placeholder.type)))}\nconst PLACEHOLDER_TERMS := ${gdValue(localization.keys.map((key) => key.placeholders.map((placeholder) => placeholder.term ?? "")))}\nconst TERMS := ${localizationTermsDictionary(localization)}\nconst CSV_PATH := "res://game_data/localization/translations.csv"\n\nstatic func format(id: int, arguments: Dictionary = {}, locale: String = "") -> LocalizedText:\n\treturn _format(id, arguments, locale, 0)\n\nstatic func _format(id: int, arguments: Dictionary, locale: String, depth: int) -> LocalizedText:\n\tif id < 0 or id >= KEYS.size():\n\t\treturn LocalizedText.new()\n\tvar locale_key := _locale_key(locale)\n\tvar templates: Array = VALUES.get(locale_key, VALUES[DEFAULT_LOCALE])\n\tvar template := String(templates[id])\n\tvar placeholder_names: Array = PLACEHOLDERS[id]\n\tvar placeholder_terms: Array = PLACEHOLDER_TERMS[id]\n\tvar terms_by_placeholder := {}\n\tfor index in range(placeholder_names.size()):\n\t\tterms_by_placeholder[String(placeholder_names[index])] = String(placeholder_terms[index])\n\n\tvar regex := RegEx.new()\n\tregex.compile("\\\\{([a-z][a-z0-9_]*)\\\\}")\n\tvar cursor := 0\n\tvar plain := ""\n\tvar bbcode := ""\n\tvar spans: Array[Dictionary] = []\n\tvar tooltips := {}\n\tfor result in regex.search_all(template):\n\t\tvar start := result.get_start(0)\n\t\tvar end := result.get_end(0)\n\t\tvar prefix := template.substr(cursor, start - cursor)\n\t\tplain += prefix\n\t\tbbcode += _bbcode_escape(prefix)\n\t\tvar placeholder := result.get_string(1)\n\t\tvar replacement := String(arguments.get(placeholder, ""))\n\t\tvar span_start := plain.length()\n\t\tplain += replacement\n\t\tvar term_slug := String(terms_by_placeholder.get(placeholder, ""))\n\t\tvar term: Dictionary = TERMS.get(term_slug, {})\n\t\tvar color := String(term.get("color", ""))\n\t\tif color.is_empty():\n\t\t\tbbcode += _bbcode_escape(replacement)\n\t\telse:\n\t\t\tbbcode += "[color=%s]%s[/color]" % [color, _bbcode_escape(replacement)]\n\t\tvar tooltip_id: Variant = term.get("tooltip_id", null)\n\t\tif tooltip_id != null and depth < 4:\n\t\t\ttooltips[placeholder] = _format(int(tooltip_id), arguments, locale_key, depth + 1).plain_text\n\t\tspans.append({\n\t\t\t"placeholder": placeholder,\n\t\t\t"start": span_start,\n\t\t\t"end": plain.length(),\n\t\t\t"term": term_slug,\n\t\t\t"color": color\n\t\t})\n\t\tcursor = end\n\n\tvar suffix := template.substr(cursor)\n\tplain += suffix\n\tbbcode += _bbcode_escape(suffix)\n\treturn LocalizedText.new(plain, bbcode, spans, tooltips)\n\nstatic func _locale_key(locale: String) -> String:\n\tif not locale.is_empty() and VALUES.has(locale):\n\t\treturn locale\n\tvar server_locale := TranslationServer.get_locale()\n\tif VALUES.has(server_locale):\n\t\treturn server_locale\n\tvar base_locale := server_locale.get_slice("_", 0)\n\tif VALUES.has(base_locale):\n\t\treturn base_locale\n\treturn DEFAULT_LOCALE\n\nstatic func _bbcode_escape(value: String) -> String:\n\treturn value.replace("[", "\\\\[").replace("]", "\\\\]")\n`,
        path: GODOT_LOCALIZATION_MODULE_PATH
    };
}
function renderLocalizationCsv(localization) {
    const header = ["keys", ...localization.locales];
    const rows = localization.keys.map((entry) => [entry.path, ...localization.locales.map((locale) => entry.values[locale] ?? "")]);
    return {
        content: [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"),
        path: `${exports.GAME_DATA_EXPORT_ROOT}/localization/translations.csv`
    };
}
function renderTranslationsFacade(localization) {
    const root = localizationTree(localization.keys);
    const classes = translationClasses(root);
    const rootVariables = [...root.children.values()].map((child) => `static var ${child.name} := ${child.className}.new()`).join("\n");
    return {
        content: `# Generated by Chisel. Do not edit.\nclass_name ChiselTranslations\nextends RefCounted\n\n${classes.join("\n\n")}\n\n${rootVariables}\n`,
        path: GODOT_TRANSLATIONS_MODULE_PATH
    };
}
function localizationEnumBody(localization) {
    if (localization.keys.length === 0) {
        return "{}";
    }
    return `{\n${localization.keys.map((key, index) => `\t${(0, localization_1.localizationKeyConstant)(key.path)} = ${index}`).join(",\n")}\n}`;
}
function localizationValuesByLocale(localization) {
    const values = {};
    for (const locale of localization.locales) {
        values[locale] = localization.keys.map((key) => key.values[locale] ?? "");
    }
    return values;
}
function localizationTermsDictionary(localization) {
    if (localization.terms.length === 0) {
        return "{}";
    }
    const keyIndexByPath = new Map(localization.keys.map((key, index) => [key.path, index]));
    const lines = localization.terms.map((term) => {
        const fields = [`\t\t"color": ${gdString(term.color ?? "")}`];
        if (term.tooltipKey) {
            const tooltipIndex = keyIndexByPath.get(term.tooltipKey);
            fields.push(`\t\t"tooltip_id": Id.${(0, localization_1.localizationKeyConstant)(term.tooltipKey)}`);
            if (typeof tooltipIndex === "undefined") {
                fields.push(`\t\t"missing_tooltip_key": ${gdString(term.tooltipKey)}`);
            }
        }
        else {
            fields.push(`\t\t"tooltip_id": null`);
        }
        return `\t${gdString(term.slug)}: {\n${fields.join(",\n")}\n\t}`;
    });
    return `{\n${lines.join(",\n")}\n}`;
}
function localizationTree(keys) {
    const root = {
        children: new Map(),
        className: "RootTranslations",
        name: "root",
        path: []
    };
    for (const key of keys) {
        const segments = (0, localization_1.localizationTypedSegments)(key.path);
        let node = root;
        segments.forEach((segment, index) => {
            const path = [...node.path, segment];
            let child = node.children.get(segment);
            if (!child) {
                child = {
                    children: new Map(),
                    className: `${path.map((entry) => pascalCase(entry)).join("")}Translations`,
                    name: segment,
                    path
                };
                node.children.set(segment, child);
            }
            node = child;
            if (index === segments.length - 1) {
                node.key = key;
            }
        });
    }
    return root;
}
function translationClasses(root) {
    const nodes = [...walkTranslationNodes(root)].filter((node) => node !== root);
    return nodes.reverse().map((node) => {
        const childVariables = [...node.children.values()].map((child) => `\tvar ${child.name} := ${child.className}.new()`);
        const methods = node.key ? [translationMethod(node)] : [];
        return `class ${node.className}:\n${[...childVariables, ...methods].join("\n") || "\tpass"}`;
    });
}
function* walkTranslationNodes(node) {
    yield node;
    for (const child of node.children.values()) {
        yield* walkTranslationNodes(child);
    }
}
function translationMethod(node) {
    const key = node.key;
    const methodName = node.name;
    const parameters = key.placeholders.map((placeholder) => `${placeholder.name}: ${gdscriptPlaceholderType(placeholder)}`).join(", ");
    const argumentsDictionary = gdscriptArgumentsDictionary(key.placeholders);
    return `\tfunc ${methodName}(${parameters}) -> ChiselLocalization.LocalizedText:\n\t\treturn ChiselLocalization.format(ChiselLocalization.Id.${(0, localization_1.localizationKeyConstant)(key.path)}, ${argumentsDictionary})`;
}
function gdscriptPlaceholderType(placeholder) {
    if (placeholder.type === "integer") {
        return "int";
    }
    if (placeholder.type === "number") {
        return "float";
    }
    return "String";
}
function gdscriptArgumentsDictionary(placeholders) {
    if (placeholders.length === 0) {
        return "{}";
    }
    return `{${placeholders.map((placeholder) => `${gdString(placeholder.name)}: ${placeholder.name}`).join(", ")}}`;
}
function inputBindingConstants(prefix) {
    const lines = Object.values(types_1.InputKeyEnum)
        .filter((binding) => binding.startsWith(prefix))
        .map((binding) => `\t${gdString(binding)}: ${binding}`);
    return `{\n${lines.join(",\n")}\n}`;
}
function renderInputExport(tables) {
    const inputTable = tables.find((entry) => entry.table.id === INPUT_BINDINGS_TABLE_ID);
    if (!inputTable) {
        return [];
    }
    const actionNames = stringNameArray(inputTable.table.rows.map((row) => (0, asset_paths_1.snakeCase)(row.slug)));
    return [
        {
            content: `# Generated by Chisel. Do not edit.\nclass_name ChiselInput\nextends RefCounted\n\nconst ACTION_NAMES := ${actionNames}\nconst KEY_BINDINGS := ${inputBindingConstants("KEY_")}\nconst MOUSE_BINDINGS := ${inputBindingConstants("MOUSE_BUTTON_")}\n\nstatic func action_name(action_id: int) -> StringName:\n\treturn ACTION_NAMES[action_id]\n\nstatic func get_action_strength(action_id: int) -> float:\n\treturn Input.get_action_strength(action_name(action_id))\n\nstatic func is_action_pressed(action_id: int) -> bool:\n\treturn Input.is_action_pressed(action_name(action_id))\n\nstatic func is_action_just_pressed(action_id: int) -> bool:\n\treturn Input.is_action_just_pressed(action_name(action_id))\n\nstatic func is_action_just_released(action_id: int) -> bool:\n\treturn Input.is_action_just_released(action_name(action_id))\n\nfunc apply_to_input_map(clear_existing: bool = true) -> void:\n\tfor index in range(ACTION_NAMES.size()):\n\t\tvar input_action_name := action_name(index)\n\t\tif not InputMap.has_action(input_action_name):\n\t\t\tInputMap.add_action(input_action_name)\n\t\telif clear_existing:\n\t\t\tInputMap.action_erase_events(input_action_name)\n\t\tfor binding in ChiselInputBindings.BINDINGS[index]:\n\t\t\tvar event: Variant = _event_from_binding(String(binding))\n\t\t\tif event is InputEvent:\n\t\t\t\tInputMap.action_add_event(input_action_name, event)\n\nfunc _event_from_binding(binding: String) -> Variant:\n\tif KEY_BINDINGS.has(binding):\n\t\treturn _key(int(KEY_BINDINGS[binding]))\n\tif MOUSE_BINDINGS.has(binding):\n\t\treturn _mouse_button(int(MOUSE_BINDINGS[binding]))\n\n\tpush_warning("Unsupported Chisel input binding: %s" % binding)\n\treturn null\n\nfunc _key(keycode: int) -> InputEventKey:\n\tvar event := InputEventKey.new()\n\tevent.keycode = keycode\n\treturn event\n\nfunc _mouse_button(button_index: int) -> InputEventMouseButton:\n\tvar event := InputEventMouseButton.new()\n\tevent.button_index = button_index\n\treturn event\n`,
            path: `${exports.GAME_DATA_EXPORT_ROOT}/input.gd`
        }
    ];
}
function createGodotExportBundle(project, tables, exportedAt, assets = [], localization) {
    const context = {
        assetNamesById: assetConstantNames(assets),
        tablesById: new Map(tables.map((table) => [table.id, table]))
    };
    const tableFiles = tables.map((table) => renderTable(table, context));
    const generatedFiles = [
        renderAssets(assets),
        ...(localization
            ? [renderLocalizationModule(localization), renderTranslationsFacade(localization), renderLocalizationCsv(localization)]
            : []),
        ...renderInputExport(tableFiles),
        ...tableFiles.map(({ content, path }) => ({ content, path }))
    ];
    return {
        files: [renderManifest(project, exportedAt, tableFiles, assets, generatedFiles.map(fileManifestEntry), localization), ...generatedFiles]
    };
}
function csvCell(value) {
    return `"${value.replace(/"/g, '""')}"`;
}
