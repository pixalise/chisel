"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importAsset = importAsset;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const schemas_1 = require("../shared/schemas");
const sharp_worker_client_1 = require("./sharp-worker-client");
function createNanoid() {
    return (0, node_crypto_1.randomBytes)(16).toString("base64url").slice(0, 21);
}
function assetStem(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
async function readAssets(filePath) {
    try {
        return schemas_1.assetsJsonSchema.parse(JSON.parse(await promises_1.default.readFile(filePath, "utf8")));
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
            return { schemaVersion: 1, assets: [] };
        }
        throw error;
    }
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
    const stem = assetStem(request.name);
    if (!stem) {
        throw new Error("Imported asset name must contain at least one letter or number");
    }
    const sourceStat = await promises_1.default.stat(sourcePath);
    if (!sourceStat.isFile()) {
        throw new Error("Imported asset source must be a file");
    }
    const projectPath = node_path_1.default.resolve(request.projectPath);
    const relativePath = node_path_1.default.posix.join(".chisel", "assets", request.category, `${stem}${extension}`);
    const destinationPath = node_path_1.default.join(projectPath, ...relativePath.split("/"));
    const assetsPath = node_path_1.default.join(projectPath, ".chisel", "assets.json");
    const document = await readAssets(assetsPath);
    const existing = document.assets.find((asset) => asset.relativePath === relativePath);
    const dimensions = await imageDimensions(sourcePath);
    const asset = schemas_1.assetSchema.parse({
        id: existing?.id ?? createNanoid(),
        name: stem,
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
