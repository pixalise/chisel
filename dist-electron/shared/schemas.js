"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertImagesSchema = exports.savePackedTerrainAssetSchema = exports.terrainAssetNameSchema = exports.terrainAssetKindSchema = exports.packSurfaceSchema = exports.packBaseSchema = exports.importAssetSchema = exports.addAssetSchema = exports.createOrUpdateAssetSchema = exports.assetsJsonSchema = exports.assetSchema = exports.createOrUpdateProjectSchema = exports.projectFileSchema = exports.projectSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const types_1 = require("./types");
exports.projectSchema = zod_1.default.object({
    id: zod_1.default.nanoid(),
    name: zod_1.default.string(),
    description: zod_1.default.string().nullish(),
    path: zod_1.default.string()
});
exports.projectFileSchema = exports.projectSchema.omit({ path: true });
exports.createOrUpdateProjectSchema = zod_1.default.object({
    name: zod_1.default.string(),
    description: zod_1.default.string().nullish(),
    path: zod_1.default.string()
});
const _internalSchema = zod_1.default.object({
    id: zod_1.default.nanoid(),
    name: zod_1.default.string(),
    type: zod_1.default.enum(types_1.AssetTypeEnum),
    sizeBytes: zod_1.default.number(),
    width: zod_1.default.number(),
    height: zod_1.default.number(),
    tags: zod_1.default.array(zod_1.default.string()),
    extension: zod_1.default.string(),
    relativePath: zod_1.default.string()
});
const kib = 1024;
const mib = kib * 1024;
const gib = mib * 1024;
const calculateByteString = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "-";
    }
    if (bytes < kib) {
        return `${bytes} B`;
    }
    if (bytes < mib) {
        return `${(bytes / kib).toFixed(1)} KB`;
    }
    if (bytes < gib) {
        return `${(bytes / mib).toFixed(1)} MB`;
    }
    return `${(bytes / gib).toFixed(1)} GB`;
};
exports.assetSchema = _internalSchema.transform((a) => {
    const { sizeBytes, tags } = a;
    return {
        ...a,
        formattedBytes: calculateByteString(sizeBytes),
        formattedTags: tags.join(", ")
    };
});
exports.assetsJsonSchema = zod_1.default.object({
    schemaVersion: zod_1.default.number(),
    assets: zod_1.default.array(exports.assetSchema)
});
exports.createOrUpdateAssetSchema = _internalSchema.omit({ id: true, relativePath: true });
exports.addAssetSchema = exports.createOrUpdateAssetSchema;
const filePathSchema = zod_1.default.string().trim().min(1);
exports.importAssetSchema = zod_1.default.object({
    projectPath: filePathSchema,
    sourcePath: filePathSchema,
    name: zod_1.default.string().trim().min(1, "Asset name is required").max(96, "Asset name must be at most 96 characters"),
    type: zod_1.default.enum(types_1.AssetTypeEnum),
    tags: zod_1.default.array(zod_1.default.string())
});
const pngImagePathSchema = filePathSchema.refine((value) => /\.png$/i.test(value), "Image must be a PNG file");
exports.packBaseSchema = zod_1.default.object({
    albedo: pngImagePathSchema,
    height: pngImagePathSchema
});
exports.packSurfaceSchema = zod_1.default.object({
    normal: pngImagePathSchema,
    ao: pngImagePathSchema.optional(),
    roughness: pngImagePathSchema.optional(),
    normalZChannel: zod_1.default.enum(["red", "green", "blue", "alpha"]),
    aoValue: zod_1.default.int().min(0).max(255),
    roughnessValue: zod_1.default.int().min(0).max(255)
});
exports.terrainAssetKindSchema = zod_1.default.enum(["base", "surface"]);
exports.terrainAssetNameSchema = zod_1.default
    .string()
    .trim()
    .min(1, "Asset name is required")
    .max(56, "Asset name must be at most 56 characters")
    .regex(/^[A-Za-z0-9]+(?:[ _-]+[A-Za-z0-9]+)*$/, "Use letters, numbers, spaces, underscores, or hyphens");
exports.savePackedTerrainAssetSchema = zod_1.default.object({
    projectPath: filePathSchema,
    name: exports.terrainAssetNameSchema,
    kind: exports.terrainAssetKindSchema,
    dataUrl: zod_1.default.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/, "Packed image must be a PNG data URL")
});
exports.convertImagesSchema = zod_1.default.object({
    inputPaths: zod_1.default.array(filePathSchema).min(1, "Choose at least one image"),
    outputFolder: filePathSchema
});
