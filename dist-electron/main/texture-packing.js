"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packedTexturePackagePreviewDataUrl = packedTexturePackagePreviewDataUrl;
exports.packAlbedoHeightTextureInMemory = packAlbedoHeightTextureInMemory;
exports.packNormalRoughnessTextureInMemory = packNormalRoughnessTextureInMemory;
exports.packTexturePackageAsset = packTexturePackageAsset;
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const schemas_1 = require("../shared/schemas");
const types_1 = require("../shared/types");
const sharp_worker_client_1 = require("./sharp-worker-client");
const packedTexturePackageMagic = "GPPT";
const packedTexturePackageVersion = 1;
const packedTexturePackageExtension = "gppt";
const packedTexturePackageHeaderSize = 24;
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
async function loadRgba(filePath) {
    return (0, sharp_worker_client_1.loadSharpRgba)(filePath);
}
function requireSameSize(a, aLabel, b, bLabel) {
    if (a.width !== b.width || a.height !== b.height) {
        throw new Error(`${aLabel} and ${bLabel} dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    }
}
function packAlbedoHeightPixels(albedo, height) {
    requireSameSize(albedo, "albedo", height, "height");
    const output = Buffer.alloc(albedo.width * albedo.height * 4);
    for (let offset = 0; offset < output.length; offset += 4) {
        output[offset] = albedo.data[offset];
        output[offset + 1] = albedo.data[offset + 1];
        output[offset + 2] = albedo.data[offset + 2];
        output[offset + 3] = height.data[offset];
    }
    return { data: output, width: albedo.width, height: albedo.height };
}
function packNormalRoughnessPixels(normal, roughness) {
    requireSameSize(normal, "normal", roughness, "roughness");
    const output = Buffer.alloc(normal.width * normal.height * 4);
    for (let offset = 0; offset < output.length; offset += 4) {
        output[offset] = normal.data[offset];
        output[offset + 1] = normal.data[offset + 1];
        output[offset + 2] = normal.data[offset + 2];
        output[offset + 3] = roughness.data[offset];
    }
    return { data: output, width: normal.width, height: normal.height };
}
async function rgbaPngBuffer(image) {
    return (0, sharp_worker_client_1.encodeSharpRgbaPng)(image.data, image.width, image.height);
}
async function rgbaPngDataUrl(image) {
    const buffer = await rgbaPngBuffer(image);
    return `data:image/png;base64,${buffer.toString("base64")}`;
}
function packedTexturePackageBuffer(width, height, albedoHeightPng, normalRoughnessPng) {
    const buffer = Buffer.alloc(packedTexturePackageHeaderSize + albedoHeightPng.length + normalRoughnessPng.length);
    buffer.write(packedTexturePackageMagic, 0, "ascii");
    buffer.writeUInt32LE(packedTexturePackageVersion, 4);
    buffer.writeUInt32LE(width, 8);
    buffer.writeUInt32LE(height, 12);
    buffer.writeUInt32LE(albedoHeightPng.length, 16);
    buffer.writeUInt32LE(normalRoughnessPng.length, 20);
    albedoHeightPng.copy(buffer, packedTexturePackageHeaderSize);
    normalRoughnessPng.copy(buffer, packedTexturePackageHeaderSize + albedoHeightPng.length);
    return buffer;
}
function packedTexturePackagePreviewDataUrl(buffer, preview = "albedoHeight") {
    if (buffer.length < packedTexturePackageHeaderSize || buffer.subarray(0, 4).toString("ascii") !== packedTexturePackageMagic) {
        throw new Error("File is not a GPPT texture package.");
    }
    const version = buffer.readUInt32LE(4);
    if (version !== packedTexturePackageVersion) {
        throw new Error(`Unsupported GPPT version: ${version}`);
    }
    const albedoHeightPngLength = buffer.readUInt32LE(16);
    const normalRoughnessPngLength = buffer.readUInt32LE(20);
    const albedoHeightPngEnd = packedTexturePackageHeaderSize + albedoHeightPngLength;
    if (albedoHeightPngLength <= 0 || albedoHeightPngEnd > buffer.length) {
        throw new Error("GPPT package has an invalid albedo-height payload.");
    }
    if (preview === "albedoHeight") {
        return `data:image/png;base64,${buffer.subarray(packedTexturePackageHeaderSize, albedoHeightPngEnd).toString("base64")}`;
    }
    const normalRoughnessPngEnd = albedoHeightPngEnd + normalRoughnessPngLength;
    if (normalRoughnessPngLength <= 0 || normalRoughnessPngEnd > buffer.length) {
        throw new Error("GPPT package has an invalid normal-roughness payload.");
    }
    return `data:image/png;base64,${buffer.subarray(albedoHeightPngEnd, normalRoughnessPngEnd).toString("base64")}`;
}
async function packAlbedoHeightTextureInMemory(input) {
    const request = schemas_1.packAlbedoHeightTextureSchema.parse(input);
    const [albedo, height] = await Promise.all([loadRgba(request.albedo), loadRgba(request.height)]);
    return rgbaPngDataUrl(packAlbedoHeightPixels(albedo, height));
}
async function packNormalRoughnessTextureInMemory(input) {
    const request = schemas_1.packNormalRoughnessTextureSchema.parse(input);
    const [normal, roughness] = await Promise.all([loadRgba(request.normal), loadRgba(request.roughness)]);
    return rgbaPngDataUrl(packNormalRoughnessPixels(normal, roughness));
}
async function packTexturePackageAsset(input) {
    const request = schemas_1.packTexturePackageSchema.parse(input);
    const [albedo, height, normal, roughness] = await Promise.all([
        loadRgba(request.albedo),
        loadRgba(request.height),
        loadRgba(request.normal),
        loadRgba(request.roughness)
    ]);
    const albedoHeight = packAlbedoHeightPixels(albedo, height);
    const normalRoughness = packNormalRoughnessPixels(normal, roughness);
    requireSameSize(albedoHeight, "albedo + height", normalRoughness, "normal + roughness");
    const [albedoHeightPng, normalRoughnessPng] = await Promise.all([rgbaPngBuffer(albedoHeight), rgbaPngBuffer(normalRoughness)]);
    const packageBuffer = packedTexturePackageBuffer(albedoHeight.width, albedoHeight.height, albedoHeightPng, normalRoughnessPng);
    const projectPath = node_path_1.default.resolve(request.projectPath);
    const stem = assetStem(request.name);
    if (!stem) {
        throw new Error("Packed texture name must contain at least one letter or number");
    }
    const relativePath = node_path_1.default.posix.join(".chisel", "assets", "packed_texture", `${stem}.${packedTexturePackageExtension}`);
    const destinationPath = node_path_1.default.join(projectPath, ...relativePath.split("/"));
    const assetsPath = node_path_1.default.join(projectPath, ".chisel", "assets.json");
    const document = await readAssets(assetsPath);
    const existing = document.assets.find((asset) => asset.relativePath === relativePath);
    const asset = schemas_1.assetSchema.parse({
        id: existing?.id ?? createNanoid(),
        category: types_1.AssetCategoryEnum.terrainTexture,
        extension: packedTexturePackageExtension,
        height: albedoHeight.height,
        name: stem,
        note: request.note,
        relativePath,
        sizeBytes: packageBuffer.length,
        width: albedoHeight.width
    });
    const assets = [...document.assets.filter((entry) => entry.id !== asset.id && entry.relativePath !== asset.relativePath), asset];
    await writeFileAtomic(destinationPath, packageBuffer);
    await writeFileAtomic(assetsPath, `${JSON.stringify(schemas_1.assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
    return asset;
}
