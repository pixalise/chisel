"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GODOT_ASSETS_MODULE_PATH = exports.GAME_DATA_EXPORT_ROOT = void 0;
exports.isPackedTerrainTextureAsset = isPackedTerrainTextureAsset;
exports.godotAssetExportPath = godotAssetExportPath;
exports.godotPackedTextureExportPaths = godotPackedTextureExportPaths;
exports.createGodotExportBundle = createGodotExportBundle;
const asset_paths_1 = require("./asset-paths");
const types_1 = require("./types");
exports.GAME_DATA_EXPORT_ROOT = "game_data";
exports.GODOT_ASSETS_MODULE_PATH = `${exports.GAME_DATA_EXPORT_ROOT}/assets.gd`;
const INPUT_BINDINGS_TABLE_ID = "input_bindings";
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
function enumIdentifier(value, fallbackPrefix) {
    const name = (0, asset_paths_1.snakeCase)(value);
    if (/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(name)) {
        return name;
    }
    return `${fallbackPrefix}_${name || "value"}`;
}
function assetEnumNames(assets) {
    const nextSuffixByBase = new Map();
    const usedNames = new Set();
    const namesByAssetId = new Map();
    for (const asset of assets) {
        const baseName = enumIdentifier(asset.name, "asset");
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
    const lines = table.rows.map((row, index) => `\t${row.slug} = ${index}`);
    return `{\n${lines.join(",\n")}\n}`;
}
function slugsArray(table) {
    if (table.rows.length === 0) {
        return "[]";
    }
    return `[\n${table.rows.map((row) => `\t${gdString(row.slug)}`).join(",\n")}\n]`;
}
function columnArray(table, column) {
    if (table.rows.length === 0) {
        return "[]";
    }
    return `[\n${table.rows.map((row) => `\t${gdValue(columnValue(row, column))}`).join(",\n")}\n]`;
}
function columnArrays(table) {
    if (table.columns.length === 0) {
        return "";
    }
    const namesByColumnId = columnConstantNames(table.columns);
    return `\n${table.columns
        .map((column) => `const ${namesByColumnId.get(column.id) ?? constantCase(column.name)} := ${columnArray(table, column)}`)
        .join("\n")}`;
}
function tableClassName(table) {
    return `Chisel${pascalCase(table.id)}`;
}
function tablePath(table) {
    return `${exports.GAME_DATA_EXPORT_ROOT}/tables/${table.id}.gd`;
}
function renderTable(table) {
    const className = tableClassName(table);
    return {
        className,
        content: `# Generated by Chisel. Do not edit.\nclass_name ${className}\nextends RefCounted\n\nenum Id ${enumBody(table)}\n\nconst TABLE_ID := ${gdString(table.id)}\nconst TABLE_NAME := ${gdString(table.name)}\nconst TABLE_KIND := ${gdString(table.kind)}\nconst SLUGS := ${slugsArray(table)}${columnArrays(table)}\n`,
        path: tablePath(table),
        table
    };
}
function renderManifest(project, exportedAt, tables, assets) {
    const entries = tables.map((entry) => `\t${gdString(entry.table.id)}: {\n\t\t"name": ${gdString(entry.table.name)},\n\t\t"class_name": ${gdString(entry.className)},\n\t\t"path": ${gdString(`res://${entry.path}`)},\n\t\t"rows": ${entry.table.rows.length},\n\t\t"columns": ${entry.table.columns.length}\n\t}`);
    return {
        content: `# Generated by Chisel. Do not edit.\nclass_name ChiselGameDataManifest\nextends RefCounted\n\nconst GENERATED_AT := ${gdString(exportedAt)}\nconst PROJECT_ID := ${gdString(project.id)}\nconst PROJECT_NAME := ${gdString(project.name)}\nconst ASSETS := {\n\t"class_name": "ChiselAssets",\n\t"path": ${gdString(`res://${exports.GODOT_ASSETS_MODULE_PATH}`)},\n\t"count": ${assets.length}\n}\nconst TABLES := {\n${entries.join(",\n")}\n}\n`,
        path: `${exports.GAME_DATA_EXPORT_ROOT}/manifest.gd`
    };
}
function assetEnumBody(assets) {
    if (assets.length === 0) {
        return "{}";
    }
    const namesByAssetId = assetEnumNames(assets);
    const lines = assets.map((asset, index) => `\t${namesByAssetId.get(asset.id) ?? enumIdentifier(asset.name, "asset")} = ${index}`);
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
    return [
        {
            content: `# Generated by Chisel. Do not edit.\nclass_name ChiselInput\nextends RefCounted\n\nconst KEY_BINDINGS := ${inputBindingConstants("KEY_")}\nconst MOUSE_BINDINGS := ${inputBindingConstants("MOUSE_BUTTON_")}\n\nfunc apply_to_input_map(clear_existing: bool = true) -> void:\n\tfor index in range(ChiselInputBindings.SLUGS.size()):\n\t\tvar action_name := String(ChiselInputBindings.SLUGS[index]).to_lower()\n\t\tif not InputMap.has_action(action_name):\n\t\t\tInputMap.add_action(action_name)\n\t\telif clear_existing:\n\t\t\tInputMap.action_erase_events(action_name)\n\t\tfor binding in ChiselInputBindings.BINDINGS[index]:\n\t\t\tvar event: Variant = _event_from_binding(String(binding))\n\t\t\tif event is InputEvent:\n\t\t\t\tInputMap.action_add_event(action_name, event)\n\nfunc _event_from_binding(binding: String) -> Variant:\n\tif KEY_BINDINGS.has(binding):\n\t\treturn _key(int(KEY_BINDINGS[binding]))\n\tif MOUSE_BINDINGS.has(binding):\n\t\treturn _mouse_button(int(MOUSE_BINDINGS[binding]))\n\n\tpush_warning("Unsupported Chisel input binding: %s" % binding)\n\treturn null\n\nfunc _key(keycode: int) -> InputEventKey:\n\tvar event := InputEventKey.new()\n\tevent.keycode = keycode\n\treturn event\n\nfunc _mouse_button(button_index: int) -> InputEventMouseButton:\n\tvar event := InputEventMouseButton.new()\n\tevent.button_index = button_index\n\treturn event\n`,
            path: `${exports.GAME_DATA_EXPORT_ROOT}/input.gd`
        }
    ];
}
function createGodotExportBundle(project, tables, exportedAt, assets = []) {
    const tableFiles = tables.map(renderTable);
    return {
        files: [
            renderManifest(project, exportedAt, tableFiles, assets),
            renderAssets(assets),
            ...renderInputExport(tableFiles),
            ...tableFiles.map(({ content, path }) => ({ content, path }))
        ]
    };
}
