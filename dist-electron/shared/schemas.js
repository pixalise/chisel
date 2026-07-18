"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatedDataTableSchema = exports.tableRowsJsonSchema = exports.tablesJsonSchema = exports.dataTableJsonSchema = exports.anyDataTableSchema = exports.systemDataTableSchema = exports.dataTableSchema = exports.createOrUpdateUserTableSchema = exports.dataTableIdSchema = exports.dataTableRowSchema = exports.typedDataColumnValueSchema = exports.jsonColumnValueSchema = exports.vector4ColumnValueSchema = exports.vector3ColumnValueSchema = exports.vector2ColumnValueSchema = exports.colorColumnValueSchema = exports.refColumnValueSchema = exports.assetRefColumnValueSchema = exports.enumArrayColumnValueSchema = exports.enumColumnValueSchema = exports.booleanColumnValueSchema = exports.rangeColumnValueSchema = exports.decimalColumnValueSchema = exports.integerColumnValueSchema = exports.textColumnValueSchema = exports.stringColumnValueSchema = exports.dataColumnValueSchema = exports.dataColumnDefinitionSchema = exports.convertImagesSchema = exports.packTexturePackageSchema = exports.packNormalRoughnessTextureSchema = exports.packAlbedoHeightTextureSchema = exports.packedTextureNameSchema = exports.importAssetSchema = exports.addAssetSchema = exports.createOrUpdateAssetSchema = exports.assetsJsonSchema = exports.assetSchema = exports.assetSlugSchema = exports.rowSlugSchema = exports.createOrUpdateProjectSchema = exports.projectFileSchema = exports.projectSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const asset_paths_1 = require("./asset-paths");
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
function duplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) {
            duplicates.add(value);
        }
        seen.add(value);
    }
    return [...duplicates];
}
exports.rowSlugSchema = zod_1.default
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(96, "Slug must be at most 96 characters")
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Slug must be UPPER_SNAKE_CASE");
exports.assetSlugSchema = exports.rowSlugSchema;
function legacyAssetCategory(value) {
    const normalized = value.trim();
    const normalizedUpper = (0, asset_paths_1.assetSlug)(normalized);
    if (normalized === "texture" || normalized === "terrain_texture" || normalizedUpper === types_1.AssetCategoryEnum.terrainTexture) {
        return types_1.AssetCategoryEnum.terrainTexture;
    }
    if (["image", "material", "shader", "ui"].includes(normalized) || normalizedUpper === types_1.AssetCategoryEnum.image) {
        return types_1.AssetCategoryEnum.image;
    }
    if (normalized === "audio" || normalizedUpper === types_1.AssetCategoryEnum.audio) {
        return types_1.AssetCategoryEnum.audio;
    }
    if (normalized === "font" || normalizedUpper === types_1.AssetCategoryEnum.font) {
        return types_1.AssetCategoryEnum.font;
    }
    if (["data", "config"].includes(normalized) || normalizedUpper === types_1.AssetCategoryEnum.data) {
        return types_1.AssetCategoryEnum.data;
    }
    if (normalized === "other" || normalizedUpper === types_1.AssetCategoryEnum.other) {
        return types_1.AssetCategoryEnum.other;
    }
    return types_1.AssetCategoryEnum.other;
}
const assetCategorySchema = zod_1.default.enum(types_1.AssetCategoryEnum);
const legacyAssetCategorySchema = zod_1.default.preprocess((value) => (typeof value === "string" ? legacyAssetCategory(value) : value), assetCategorySchema);
function normalizeAssetCategoryObject(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return value;
    }
    const record = { ...value };
    if (typeof record.category !== "string" && typeof record.type === "string") {
        record.category = legacyAssetCategory(record.type);
    }
    return record;
}
function assetCategoryForExtension(extension, category) {
    if ((0, types_1.isTerrainTextureExtension)(extension)) {
        return types_1.AssetCategoryEnum.terrainTexture;
    }
    return category;
}
const assetInputFields = {
    category: assetCategorySchema,
    name: exports.assetSlugSchema,
    note: zod_1.default.string().optional(),
    sizeBytes: zod_1.default.number(),
    width: zod_1.default.number(),
    height: zod_1.default.number(),
    extension: zod_1.default.string()
};
const assetInputSchema = zod_1.default.object(assetInputFields);
const assetDocumentSchema = zod_1.default
    .preprocess(normalizeAssetCategoryObject, zod_1.default.object({
    ...assetInputFields,
    category: legacyAssetCategorySchema,
    id: zod_1.default.string(),
    name: zod_1.default.string().trim().min(1, "Asset slug is required").max(96, "Asset slug must be at most 96 characters"),
    relativePath: zod_1.default.string(),
    tag: zod_1.default.string().optional(),
    tags: zod_1.default.array(zod_1.default.string()).optional()
}))
    .transform((asset) => {
    const { tag, tags, ...rest } = asset;
    void tag;
    void tags;
    const slug = exports.assetSlugSchema.parse((0, asset_paths_1.assetSlug)(rest.name));
    return {
        ...rest,
        id: slug,
        name: slug,
        category: assetCategoryForExtension(rest.extension, rest.category)
    };
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
const _internalSchema = assetDocumentSchema.transform((a) => ({
    ...a,
    formattedBytes: calculateByteString(a.sizeBytes)
}));
exports.assetSchema = _internalSchema;
exports.assetsJsonSchema = zod_1.default
    .object({
    schemaVersion: zod_1.default.number(),
    assets: zod_1.default.array(exports.assetSchema)
})
    .superRefine((document, context) => {
    for (const duplicateAssetSlug of duplicateValues(document.assets.map((asset) => asset.id))) {
        context.addIssue({
            code: "custom",
            message: `Duplicate asset slug "${duplicateAssetSlug}"`,
            path: ["assets"]
        });
    }
});
exports.createOrUpdateAssetSchema = assetInputSchema;
exports.addAssetSchema = exports.createOrUpdateAssetSchema;
const filePathSchema = zod_1.default.string().trim().min(1);
exports.importAssetSchema = zod_1.default.object({
    projectPath: filePathSchema,
    sourcePath: filePathSchema,
    name: exports.assetSlugSchema,
    category: assetCategorySchema,
    note: zod_1.default.string().optional()
});
const pngImagePathSchema = filePathSchema.refine((value) => /\.png$/i.test(value), "Image must be a PNG file");
exports.packedTextureNameSchema = exports.assetSlugSchema;
exports.packAlbedoHeightTextureSchema = zod_1.default.object({
    albedo: pngImagePathSchema,
    height: pngImagePathSchema
});
exports.packNormalRoughnessTextureSchema = zod_1.default.object({
    normal: pngImagePathSchema,
    roughness: pngImagePathSchema
});
exports.packTexturePackageSchema = exports.packAlbedoHeightTextureSchema.merge(exports.packNormalRoughnessTextureSchema).extend({
    name: exports.packedTextureNameSchema,
    note: zod_1.default.string().optional(),
    projectPath: filePathSchema
});
exports.convertImagesSchema = zod_1.default.object({
    inputPaths: zod_1.default.array(filePathSchema).min(1, "Choose at least one image"),
    outputFolder: filePathSchema
});
exports.dataColumnDefinitionSchema = zod_1.default.preprocess((value) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return value;
    }
    const record = { ...value };
    if (typeof record.assetCategory !== "string" && typeof record.assetType === "string") {
        record.assetCategory = legacyAssetCategory(record.assetType);
    }
    return record;
}, zod_1.default.object({
    id: zod_1.default.nanoid(),
    type: zod_1.default.enum(types_1.ColumnType),
    name: zod_1.default.string().transform((name) => name.toLowerCase()),
    defaultValue: zod_1.default.json().refine((value) => value !== null, "Default value is required"),
    assetCategory: legacyAssetCategorySchema.optional(),
    max: zod_1.default.number().optional(),
    maxChars: zod_1.default.int().positive().optional(),
    min: zod_1.default.number().optional(),
    possibleValues: zod_1.default.array(zod_1.default.string()).optional(),
    required: zod_1.default.boolean().default(true),
    step: zod_1.default.number().positive().optional(),
    unique: zod_1.default.boolean().default(false)
}));
exports.dataColumnValueSchema = zod_1.default.object({
    columnId: zod_1.default.nanoid(),
    type: zod_1.default.enum(types_1.ColumnType),
    value: zod_1.default.json().nullish()
});
const dataColumnValueBaseSchema = zod_1.default.object({
    columnId: zod_1.default.nanoid()
});
exports.stringColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.string),
    value: zod_1.default.string().nullish()
});
exports.textColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.text),
    value: zod_1.default.string().nullish()
});
exports.integerColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.integer),
    value: zod_1.default.int().nullish()
});
exports.decimalColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.decimal),
    value: zod_1.default.number().nullish()
});
exports.rangeColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.range),
    value: zod_1.default.number().nullish()
});
exports.booleanColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.boolean),
    value: zod_1.default.boolean().nullish()
});
exports.enumColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.enum),
    value: zod_1.default.string().nullish()
});
exports.enumArrayColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.enumArray),
    value: zod_1.default.array(zod_1.default.string()).nullish()
});
exports.assetRefColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.assetRef),
    value: zod_1.default.string().nullish()
});
exports.refColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.ref),
    value: zod_1.default.string().nullish()
});
exports.colorColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.color),
    value: zod_1.default.string().nullish()
});
exports.vector2ColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.vector2),
    value: zod_1.default.tuple([zod_1.default.number(), zod_1.default.number()]).nullish()
});
exports.vector3ColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.vector3),
    value: zod_1.default.tuple([zod_1.default.number(), zod_1.default.number(), zod_1.default.number()]).nullish()
});
exports.vector4ColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.vector4),
    value: zod_1.default.tuple([zod_1.default.number(), zod_1.default.number(), zod_1.default.number(), zod_1.default.number()]).nullish()
});
exports.jsonColumnValueSchema = dataColumnValueBaseSchema.extend({
    type: zod_1.default.literal(types_1.ColumnType.json),
    value: zod_1.default.json().nullish()
});
exports.typedDataColumnValueSchema = zod_1.default.discriminatedUnion("type", [
    exports.stringColumnValueSchema,
    exports.textColumnValueSchema,
    exports.integerColumnValueSchema,
    exports.decimalColumnValueSchema,
    exports.rangeColumnValueSchema,
    exports.booleanColumnValueSchema,
    exports.enumColumnValueSchema,
    exports.enumArrayColumnValueSchema,
    exports.assetRefColumnValueSchema,
    exports.refColumnValueSchema,
    exports.colorColumnValueSchema,
    exports.vector2ColumnValueSchema,
    exports.vector3ColumnValueSchema,
    exports.vector4ColumnValueSchema,
    exports.jsonColumnValueSchema
]);
exports.dataTableRowSchema = zod_1.default.object({
    id: zod_1.default.nanoid(),
    slug: exports.rowSlugSchema,
    values: zod_1.default.array(exports.typedDataColumnValueSchema)
});
const schemaVersionSchema = zod_1.default.int().min(1);
exports.dataTableIdSchema = zod_1.default
    .string()
    .trim()
    .min(1)
    .max(96)
    .regex(/^[A-Za-z0-9_-]+$/);
const baseDataTableSchema = zod_1.default.object({
    id: exports.dataTableIdSchema,
    lastChangeAt: zod_1.default.string(),
    version: zod_1.default.int().min(1).default(1),
    name: zod_1.default.string(),
    description: zod_1.default.string(),
    columns: zod_1.default.array(exports.dataColumnDefinitionSchema),
    rows: zod_1.default.array(exports.dataTableRowSchema).default([])
});
exports.createOrUpdateUserTableSchema = zod_1.default.object({
    name: zod_1.default.string(),
    description: zod_1.default.string(),
    columns: zod_1.default.array(exports.dataColumnDefinitionSchema)
});
exports.dataTableSchema = baseDataTableSchema
    .extend({
    kind: zod_1.default.literal("user").default("user")
})
    .transform((t) => ({
    ...t,
    isSystemTable: false
}));
exports.systemDataTableSchema = baseDataTableSchema
    .extend({
    kind: zod_1.default.literal("system").default("system"),
    moduleId: zod_1.default.string()
})
    .transform((t) => ({
    ...t,
    isSystemTable: true
}));
exports.anyDataTableSchema = zod_1.default.union([exports.systemDataTableSchema, exports.dataTableSchema]);
exports.dataTableJsonSchema = zod_1.default.object({
    schemaVersion: schemaVersionSchema,
    table: exports.anyDataTableSchema
});
exports.tablesJsonSchema = zod_1.default.object({
    schemaVersion: schemaVersionSchema,
    tables: zod_1.default.array(exports.anyDataTableSchema)
});
exports.tableRowsJsonSchema = zod_1.default.object({
    schemaVersion: schemaVersionSchema,
    tableId: exports.dataTableIdSchema,
    rows: zod_1.default.array(exports.dataTableRowSchema)
});
exports.validatedDataTableSchema = exports.anyDataTableSchema.superRefine((table, context) => {
    for (const duplicateColumnId of duplicateValues(table.columns.map((column) => column.id))) {
        context.addIssue({
            code: "custom",
            message: `Duplicate column id "${duplicateColumnId}"`,
            path: ["columns"]
        });
    }
    for (const duplicateRowSlug of duplicateValues(table.rows.map((row) => row.slug))) {
        context.addIssue({
            code: "custom",
            message: `Duplicate row slug "${duplicateRowSlug}"`,
            path: ["rows"]
        });
    }
    // const columnTypeById = new Map(table.columns.map((column) => [column.id, column.type]));
    // table.rows.forEach((row, rowIndex) => {
    //   const valueColumnIds = row.values.map((value) => value.columnId);
    //   for (const duplicateColumnId of duplicateValues(valueColumnIds)) {
    //     context.addIssue({
    //       code: "custom",
    //       message: `Duplicate value for column "${duplicateColumnId}"`,
    //       path: ["rows", rowIndex, "values"]
    //     });
    //   }
    //
    //   row.values.forEach((value, valueIndex) => {
    //     const columnType = columnTypeById.get(value.columnId);
    //     if (!columnType) {
    //       context.addIssue({
    //         code: "custom",
    //         message: `Unknown column id "${value.columnId}"`,
    //         path: ["rows", rowIndex, "values", valueIndex, "columnId"]
    //       });
    //       return;
    //     }
    //
    //     if (columnType !== value.type) {
    //       context.addIssue({
    //         code: "custom",
    //         message: `Column value type "${value.type}" does not match column type "${columnType}"`,
    //         path: ["rows", rowIndex, "values", valueIndex, "type"]
    //       });
    //     }
    //   });
    // });
});
