import z from "zod";
import { assetSlug } from "./asset-paths";
import {
  AssetCategoryEnum,
  ColumnType,
  isAudioExtension,
  isHdriExtension,
  isMeshExtension,
  isShaderExtension,
  isTerrainTextureExtension
} from "./types";

export const projectSchema = z.object({
  id: z.nanoid(),
  name: z.string(),
  description: z.string().nullish(),
  path: z.string()
});
export type Project = z.infer<typeof projectSchema>;

export const projectFileSchema = projectSchema.omit({ path: true });
export type ProjectFile = z.infer<typeof projectFileSchema>;

export const createOrUpdateProjectSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  path: z.string()
});
export type CreateOrUpdateProject = z.infer<typeof createOrUpdateProjectSchema>;

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}

export const rowSlugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(96, "Slug must be at most 96 characters")
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Slug must be CONSTANT_CASE");
export type RowSlug = z.infer<typeof rowSlugSchema>;

export const assetSlugSchema = rowSlugSchema;
export type AssetSlug = z.infer<typeof assetSlugSchema>;

const assetCategorySchema = z.enum(AssetCategoryEnum);

export function assetCategoryForExtension(extension: string, category: AssetCategoryEnum): AssetCategoryEnum {
  const normalizedExtension = extension.replace(/^\./, "");
  if (isHdriExtension(normalizedExtension)) {
    return AssetCategoryEnum.hdri;
  }

  if (isTerrainTextureExtension(normalizedExtension)) {
    return AssetCategoryEnum.terrainTexture;
  }

  if (isMeshExtension(normalizedExtension)) {
    return AssetCategoryEnum.mesh;
  }

  if (isAudioExtension(normalizedExtension)) {
    return AssetCategoryEnum.audio;
  }

  if (isShaderExtension(normalizedExtension)) {
    return AssetCategoryEnum.shader;
  }

  return category;
}

const assetInputFields = {
  category: assetCategorySchema,
  name: assetSlugSchema,
  note: z.string().optional(),
  sizeBytes: z.number(),
  width: z.number(),
  height: z.number(),
  tileSize: z.int().positive().optional(),
  extension: z.string()
};

function validateTilesetAsset(
  asset: { category: AssetCategoryEnum; extension: string; height: number; tileSize?: number; width: number },
  context: z.RefinementCtx
): void {
  if (asset.category !== AssetCategoryEnum.tileset) return;
  if (asset.extension.replace(/^\./, "").toLowerCase() !== "png") {
    context.addIssue({ code: "custom", message: "Tilesets must use PNG images", path: ["extension"] });
  }
  if (!asset.tileSize) {
    context.addIssue({ code: "custom", message: "Tile size is required", path: ["tileSize"] });
    return;
  }
  if (asset.width <= 0 || asset.height <= 0) {
    context.addIssue({ code: "custom", message: "Tileset image dimensions must be available", path: ["width"] });
    return;
  }
  if (asset.width % asset.tileSize !== 0 || asset.height % asset.tileSize !== 0) {
    context.addIssue({ code: "custom", message: "Image dimensions must be divisible by tile size", path: ["tileSize"] });
  }
}

const assetInputSchema = z.object(assetInputFields).superRefine(validateTilesetAsset);

const assetDocumentSchema = z
  .object({
    ...assetInputFields,
    id: z.string(),
    name: z.string().min(1, "Asset slug is required").max(96, "Asset slug must be at most 96 characters"),
    relativePath: z.string()
  })
  .superRefine(validateTilesetAsset)
  .transform((asset) => {
    const slug = assetSlugSchema.parse(assetSlug(asset.name));
    return {
      ...asset,
      id: slug,
      name: slug,
      category: assetCategoryForExtension(asset.extension, asset.category)
    };
  });

const kib = 1024;
const mib = kib * 1024;
const gib = mib * 1024;

const calculateByteString = (bytes: number) => {
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

export const assetSchema = _internalSchema;

export const assetsJsonSchema = z
  .object({
    schemaVersion: z.number(),
    assets: z.array(assetSchema)
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

export type Asset = z.infer<typeof assetSchema>;
export type AssetsJson = z.infer<typeof assetsJsonSchema>;

export const createOrUpdateAssetSchema = assetInputSchema;
export type CreateOrUpdateAsset = z.infer<typeof createOrUpdateAssetSchema>;
export const addAssetSchema = createOrUpdateAssetSchema;
export type AddAsset = z.infer<typeof addAssetSchema>;

const filePathSchema = z.string().trim().min(1);
export const importAssetSchema = z.object({
  projectPath: filePathSchema,
  sourcePath: filePathSchema,
  name: assetSlugSchema,
  category: assetCategorySchema,
  note: z.string().optional(),
  tileSize: z.int().positive().optional()
});
export type ImportAssetInput = z.infer<typeof importAssetSchema>;

const schemaVersionSchema = z.int().min(1);
export const dataTableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z0-9_-]+$/);

export const convertImagesSchema = z.object({
  inputPaths: z.array(filePathSchema).min(1, "Choose at least one image"),
  outputFolder: filePathSchema
});
export type ConvertImages = z.infer<typeof convertImagesSchema>;

export interface ConvertedImage {
  inputPath: string;
  outputPath: string;
}

export const dataColumnDefinitionSchema = z.object({
  id: z.nanoid(),
  type: z.enum(ColumnType),
  name: z.string().transform((name) => name.toLowerCase()),
  defaultValue: z.json().refine((value) => value !== null, "Default value is required"),
  assetCategory: assetCategorySchema.optional(),
  max: z.number().optional(),
  maxChars: z.int().positive().optional(),
  min: z.number().optional(),
  possibleValues: z.array(z.string()).optional(),
  refTableId: dataTableIdSchema.optional(),
  required: z.boolean().default(true),
  step: z.number().positive().optional(),
  unique: z.boolean().default(false)
});
export type DataColumnDefinition = z.infer<typeof dataColumnDefinitionSchema>;

export const dataColumnValueSchema = z.object({
  columnId: z.nanoid(),
  type: z.enum(ColumnType),
  value: z.json().nullish()
});
export type DataColumnValue = z.infer<typeof dataColumnValueSchema>;

const dataColumnValueBaseSchema = z.object({
  columnId: z.nanoid()
});

export const stringColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.string),
  value: z.string().nullish()
});

export const textColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.text),
  value: z.string().nullish()
});

export const integerColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.integer),
  value: z.int().nullish()
});

export const decimalColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.decimal),
  value: z.number().nullish()
});

export const rangeColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.range),
  value: z.number().nullish()
});

export const booleanColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.boolean),
  value: z.boolean().nullish()
});

export const enumColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.enum),
  value: z.string().nullish()
});

export const enumArrayColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.enumArray),
  value: z.array(z.string()).nullish()
});

export const assetRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.assetRef),
  value: z.string().nullish()
});

export const translationRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.translationRef),
  value: z.string().nullish()
});

export const refColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.ref),
  value: z.string().nullish()
});

export const arrayRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.arrayRef),
  value: z.array(z.string()).nullish()
});

export const colorColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.color),
  value: z.string().nullish()
});

export const vector2ColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.vector2),
  value: z.tuple([z.number(), z.number()]).nullish()
});

export const vector3ColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.vector3),
  value: z.tuple([z.number(), z.number(), z.number()]).nullish()
});

export const vector4ColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.vector4),
  value: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullish()
});

export const jsonColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.json),
  value: z.json().nullish()
});

export const typedDataColumnValueSchema = z.discriminatedUnion("type", [
  stringColumnValueSchema,
  textColumnValueSchema,
  integerColumnValueSchema,
  decimalColumnValueSchema,
  rangeColumnValueSchema,
  booleanColumnValueSchema,
  enumColumnValueSchema,
  enumArrayColumnValueSchema,
  assetRefColumnValueSchema,
  translationRefColumnValueSchema,
  refColumnValueSchema,
  arrayRefColumnValueSchema,
  colorColumnValueSchema,
  vector2ColumnValueSchema,
  vector3ColumnValueSchema,
  vector4ColumnValueSchema,
  jsonColumnValueSchema
]);
export type TypedDataColumnValue = z.infer<typeof typedDataColumnValueSchema>;

export const dataTableRowSchema = z.object({
  id: z.nanoid(),
  slug: rowSlugSchema,
  values: z.array(typedDataColumnValueSchema)
});
export type DataTableRow = z.infer<typeof dataTableRowSchema>;

const baseDataTableSchema = z.object({
  id: dataTableIdSchema,
  lastChangeAt: z.string(),
  version: z.int().min(1).default(1),
  name: z.string(),
  description: z.string(),
  columns: z.array(dataColumnDefinitionSchema),
  rows: z.array(dataTableRowSchema).default([])
});

export const createOrUpdateUserTableSchema = z.object({
  name: z.string(),
  description: z.string(),
  columns: z.array(dataColumnDefinitionSchema)
});
export type CreateOrUpdateTable = z.infer<typeof createOrUpdateUserTableSchema>;

export const dataTableSchema = baseDataTableSchema
  .extend({
    kind: z.literal("user").default("user")
  })
  .transform((t) => ({
    ...t,
    isSystemTable: false
  }));
export type DataTableSchema = z.infer<typeof dataTableSchema>;

export const systemDataTableSchema = baseDataTableSchema
  .extend({
    kind: z.literal("system").default("system"),
    moduleId: z.string()
  })
  .transform((t) => ({
    ...t,
    isSystemTable: true
  }));
export type SystemDataTable = z.infer<typeof systemDataTableSchema>;

export const anyDataTableSchema = z.union([systemDataTableSchema, dataTableSchema]);
export type AnyDataTable = z.infer<typeof anyDataTableSchema>;

export const dataTableJsonSchema = z.object({
  schemaVersion: schemaVersionSchema,
  table: anyDataTableSchema
});
export type DataTableJson = z.infer<typeof dataTableJsonSchema>;

export const tablesJsonSchema = z.object({
  schemaVersion: schemaVersionSchema,
  tables: z.array(anyDataTableSchema)
});
export type TablesJson = z.infer<typeof tablesJsonSchema>;

export const tableRowsJsonSchema = z.object({
  schemaVersion: schemaVersionSchema,
  tableId: dataTableIdSchema,
  rows: z.array(dataTableRowSchema)
});
export type TableRowsJson = z.infer<typeof tableRowsJsonSchema>;

export const validatedDataTableSchema = anyDataTableSchema.superRefine((table, context) => {
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
export type ValidatedDataTable = z.infer<typeof validatedDataTableSchema>;

export const replaceAssetSourceSchema = z.object({
  projectPath: filePathSchema,
  assetId: assetSlugSchema,
  sourcePath: filePathSchema
});
export type ReplaceAssetSourceInput = z.infer<typeof replaceAssetSourceSchema>;
