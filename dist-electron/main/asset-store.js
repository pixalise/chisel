"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceAssetReferences = replaceAssetReferences;
exports.upgradeAssetLibraryPaths = upgradeAssetLibraryPaths;
exports.importAsset = importAsset;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const schemas_1 = require("../shared/schemas");
const asset_paths_1 = require("../shared/asset-paths");
const types_1 = require("../shared/types");
const sharp_worker_client_1 = require("./sharp-worker-client");
async function readRawAssets(filePath) {
    try {
        const document = JSON.parse(await promises_1.default.readFile(filePath, "utf8"));
        if (typeof document !== "object" || document === null || !("assets" in document) || !Array.isArray(document.assets)) {
            return { schemaVersion: 1, assets: [] };
        }
        const schemaVersion = "schemaVersion" in document && typeof document.schemaVersion === "number" ? document.schemaVersion : 1;
        return { schemaVersion, assets: document.assets };
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return { schemaVersion: 1, assets: [] };
        }
        throw error;
    }
}
function hasErrorCode(error, code) {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
    }
    return error.code === code;
}
async function fileExists(filePath) {
    try {
        const stat = await promises_1.default.stat(filePath);
        return stat.isFile();
    }
    catch (error) {
        if (hasErrorCode(error, "ENOENT")) {
            return false;
        }
        throw error;
    }
}
function projectRelativePath(projectPath, relativePath) {
    return node_path_1.default.join(projectPath, ...relativePath.split("/"));
}
function canonicalAsset(asset) {
    const name = (0, asset_paths_1.assetSlug)(asset.name);
    const relativePath = (0, asset_paths_1.chiselAssetRelativePath)(asset.category, name, asset.extension);
    return schemas_1.assetSchema.parse({ ...asset, id: name, name, relativePath });
}
function rawAssetId(value) {
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string") {
        return undefined;
    }
    return value.id;
}
async function listJsonFiles(directoryPath) {
    let entries;
    try {
        entries = await promises_1.default.readdir(directoryPath, { withFileTypes: true });
    }
    catch (error) {
        if (hasErrorCode(error, "ENOENT")) {
            return [];
        }
        throw error;
    }
    const files = await Promise.all(entries.map((entry) => {
        const entryPath = node_path_1.default.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            return listJsonFiles(entryPath);
        }
        return Promise.resolve(entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : []);
    }));
    return files.flat();
}
function upgradeAssetRefValues(value, assetIdChanges) {
    if (Array.isArray(value)) {
        let changed = false;
        const nextValue = value.map((entry) => {
            const result = upgradeAssetRefValues(entry, assetIdChanges);
            changed ||= result.changed;
            return result.value;
        });
        return { changed, value: nextValue };
    }
    if (typeof value !== "object" || value === null) {
        return { changed: false, value };
    }
    const record = value;
    if (record.type === types_1.ColumnType.assetRef && typeof record.value === "string") {
        const upgradedAssetId = assetIdChanges.get(record.value);
        if (upgradedAssetId) {
            return { changed: true, value: { ...record, value: upgradedAssetId } };
        }
    }
    let changed = false;
    const nextRecord = {};
    for (const [key, entry] of Object.entries(record)) {
        const result = upgradeAssetRefValues(entry, assetIdChanges);
        changed ||= result.changed;
        nextRecord[key] = result.value;
    }
    return { changed, value: nextRecord };
}
async function upgradeTableAssetReferences(projectPath, assetIdChanges) {
    if (assetIdChanges.size === 0) {
        return false;
    }
    let changed = false;
    const rootTablesJsonPath = node_path_1.default.join(projectPath, ".chisel", "tables.json");
    const tableJsonFiles = await listJsonFiles(node_path_1.default.join(projectPath, ".chisel", "tables"));
    if (await fileExists(rootTablesJsonPath)) {
        tableJsonFiles.push(rootTablesJsonPath);
    }
    await Promise.all(tableJsonFiles.map(async (filePath) => {
        const content = JSON.parse(await promises_1.default.readFile(filePath, "utf8"));
        const result = upgradeAssetRefValues(content, assetIdChanges);
        if (!result.changed) {
            return;
        }
        changed = true;
        await writeFileAtomic(filePath, `${JSON.stringify(result.value, null, 2)}\n`);
    }));
    return changed;
}
async function replaceAssetReferences(projectPathInput, assetIdChangesInput) {
    return upgradeTableAssetReferences(node_path_1.default.resolve(projectPathInput), new Map(Object.entries(assetIdChangesInput)));
}
async function upgradeAssetLibraryPaths(projectPathInput) {
    const projectPath = node_path_1.default.resolve(projectPathInput);
    const assetsPath = node_path_1.default.join(projectPath, ".chisel", "assets.json");
    const rawDocument = await readRawAssets(assetsPath);
    const document = schemas_1.assetsJsonSchema.parse(rawDocument);
    const canonicalPathOwners = new Map();
    const assetIdChanges = new Map();
    const assets = [];
    let changed = false;
    for (const [index, asset] of document.assets.entries()) {
        const upgradedAsset = canonicalAsset(asset);
        const originalId = rawAssetId(rawDocument.assets[index]);
        if (originalId && originalId !== upgradedAsset.id) {
            assetIdChanges.set(originalId, upgradedAsset.id);
            changed = true;
        }
        const ownerId = canonicalPathOwners.get(upgradedAsset.relativePath);
        if (ownerId && ownerId !== upgradedAsset.id) {
            throw new Error(`Multiple assets would upgrade to ${upgradedAsset.relativePath}`);
        }
        canonicalPathOwners.set(upgradedAsset.relativePath, upgradedAsset.id);
        if (asset.relativePath !== upgradedAsset.relativePath || asset.name !== upgradedAsset.name) {
            changed = true;
            const sourcePath = projectRelativePath(projectPath, asset.relativePath);
            const destinationPath = projectRelativePath(projectPath, upgradedAsset.relativePath);
            if (sourcePath !== destinationPath) {
                const sourceExists = await fileExists(sourcePath);
                const destinationExists = await fileExists(destinationPath);
                if (!sourceExists && !destinationExists) {
                    throw new Error(`Cannot upgrade missing asset file: ${asset.relativePath}`);
                }
                if (sourceExists && destinationExists) {
                    throw new Error(`Cannot upgrade ${asset.relativePath}; destination already exists at ${upgradedAsset.relativePath}`);
                }
                if (sourceExists) {
                    await promises_1.default.mkdir(node_path_1.default.dirname(destinationPath), { recursive: true });
                    await promises_1.default.rename(sourcePath, destinationPath);
                }
            }
        }
        assets.push(upgradedAsset);
    }
    const upgradedDocument = schemas_1.assetsJsonSchema.parse({ schemaVersion: document.schemaVersion, assets });
    if (changed) {
        await writeFileAtomic(assetsPath, `${JSON.stringify(upgradedDocument, null, 2)}\n`);
    }
    await upgradeTableAssetReferences(projectPath, assetIdChanges);
    return { assetIdChanges: Object.fromEntries(assetIdChanges), assetsJson: upgradedDocument };
}
async function writeFileAtomic(filePath, content) {
    await promises_1.default.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    const temporaryPath = node_path_1.default.join(node_path_1.default.dirname(filePath), `.${node_path_1.default.basename(filePath)}.${(0, node_crypto_1.randomBytes)(8).toString("hex")}.tmp`);
    try {
        await promises_1.default.writeFile(temporaryPath, content);
        await promises_1.default.rename(temporaryPath, filePath);
    }
    catch (error) {
        await promises_1.default.rm(temporaryPath, { force: true });
        throw error;
    }
}
async function imageDimensions(filePath) {
    try {
        return await (0, sharp_worker_client_1.readImageDimensions)(filePath);
    }
    catch {
        return { width: 0, height: 0 };
    }
}
async function importAsset(input) {
    const request = schemas_1.importAssetSchema.parse(input);
    const sourcePath = node_path_1.default.resolve(request.sourcePath);
    const extension = node_path_1.default.extname(sourcePath).toLowerCase();
    if (!extension) {
        throw new Error("Imported asset source must have a file extension");
    }
    const slug = (0, asset_paths_1.assetSlug)(request.name);
    if (!slug) {
        throw new Error("Imported asset name must contain at least one letter or number");
    }
    const sourceStat = await promises_1.default.stat(sourcePath);
    if (!sourceStat.isFile()) {
        throw new Error("Imported asset source must be a file");
    }
    const projectPath = node_path_1.default.resolve(request.projectPath);
    const relativePath = (0, asset_paths_1.chiselAssetRelativePath)(request.category, slug, extension);
    const destinationPath = node_path_1.default.join(projectPath, ...relativePath.split("/"));
    const assetsPath = node_path_1.default.join(projectPath, ".chisel", "assets.json");
    const document = (await upgradeAssetLibraryPaths(projectPath)).assetsJson;
    const existing = document.assets.find((asset) => asset.id === slug || asset.relativePath === relativePath);
    if (existing) {
        throw new Error(`Asset slug ${slug} already exists`);
    }
    const dimensions = await imageDimensions(sourcePath);
    const asset = schemas_1.assetSchema.parse({
        id: slug,
        name: slug,
        category: request.category,
        relativePath,
        sizeBytes: sourceStat.size,
        width: dimensions.width,
        height: dimensions.height,
        note: request.note,
        extension: extension.replace(/^\./, "")
    });
    const assets = [...document.assets.filter((entry) => entry.id !== asset.id && entry.relativePath !== asset.relativePath), asset];
    await promises_1.default.mkdir(node_path_1.default.dirname(destinationPath), { recursive: true });
    await promises_1.default.copyFile(sourcePath, destinationPath);
    await writeFileAtomic(assetsPath, `${JSON.stringify(schemas_1.assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
    return asset;
}
