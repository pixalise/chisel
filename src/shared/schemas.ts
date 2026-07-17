import z from "zod";
import { AssetTypeEnum, ColumnType } from "./types";

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

const assetInputSchema = z.object({
  name: z.string(),
  type: z.enum(AssetTypeEnum),
  note: z.string().optional(),
  sizeBytes: z.number(),
  width: z.number(),
  height: z.number(),
  extension: z.string()
});

const assetDocumentSchema = assetInputSchema
  .extend({
    id: z.nanoid(),
    relativePath: z.string(),
    note: z.string().optional(),
    tag: z.string().optional(),
    tags: z.array(z.string()).optional()
  })
  .transform((asset) => {
    const { tag, tags, ...rest } = asset;
    void tag;
    void tags;
    return rest;
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

export const assetsJsonSchema = z.object({
  schemaVersion: z.number(),
  assets: z.array(assetSchema)
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
  name: z.string().trim().min(1, "Asset name is required").max(96, "Asset name must be at most 96 characters"),
  type: z.enum(AssetTypeEnum),
  note: z.string().optional()
});
export type ImportAssetInput = z.infer<typeof importAssetSchema>;

const pngImagePathSchema = filePathSchema.refine((value) => /\.png$/i.test(value), "Image must be a PNG file");

export const terrainTextureNameSchema = z
  .string()
  .trim()
  .min(1, "Terrain Texture name is required")
  .max(56, "Terrain Texture name must be at most 56 characters")
  .regex(/^[A-Za-z0-9]+(?:[ _-]+[A-Za-z0-9]+)*$/, "Use letters, numbers, spaces, underscores, or hyphens");

export const packBaseSchema = z.object({
  albedo: pngImagePathSchema,
  height: pngImagePathSchema
});
export type PackBase = z.infer<typeof packBaseSchema>;

export const packSurfaceSchema = z.object({
  normal: pngImagePathSchema,
  ao: pngImagePathSchema.optional(),
  roughness: pngImagePathSchema.optional(),
  normalZChannel: z.enum(["red", "green", "blue", "alpha"]),
  aoValue: z.int().min(0).max(255),
  roughnessValue: z.int().min(0).max(255)
});
export type PackSurface = z.infer<typeof packSurfaceSchema>;

export const packTerrainTextureSchema = z.object({
  albedo: pngImagePathSchema,
  ao: pngImagePathSchema.optional(),
  aoValue: z.int().min(0).max(255),
  height: pngImagePathSchema,
  name: terrainTextureNameSchema,
  normal: pngImagePathSchema,
  normalZChannel: z.enum(["red", "green", "blue", "alpha"]),
  note: z.string().optional(),
  projectPath: filePathSchema,
  roughness: pngImagePathSchema.optional(),
  roughnessValue: z.int().min(0).max(255)
});
export type PackTerrainTexture = z.infer<typeof packTerrainTextureSchema>;

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
  assetType: z.enum(AssetTypeEnum).optional(),
  max: z.number().optional(),
  maxChars: z.int().positive().optional(),
  min: z.number().optional(),
  possibleValues: z.array(z.string()).optional(),
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

export const idColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.id),
  value: z.string().nullish()
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

export const refColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.ref),
  value: z.string().nullish()
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

export const cellMaskValueSchema = z.object({
  cellSizeMeters: z.number().positive(),
  cells: z.array(z.tuple([z.int().min(0), z.int().min(0)])),
  height: z.int().min(1),
  width: z.int().min(1)
});
export type CellMaskValue = z.infer<typeof cellMaskValueSchema>;

export const heightFieldValueSchema = z
  .object({
    cellSizeMeters: z.number().positive(),
    cornerHeight: z.int().min(2),
    cornerWidth: z.int().min(2),
    height: z.int().min(1),
    values: z.array(z.number()),
    width: z.int().min(1)
  })
  .superRefine((field, context) => {
    if (field.cornerWidth !== field.width + 1) {
      context.addIssue({
        code: "custom",
        message: "Height field corner width must equal width + 1",
        path: ["cornerWidth"]
      });
    }
    if (field.cornerHeight !== field.height + 1) {
      context.addIssue({
        code: "custom",
        message: "Height field corner height must equal height + 1",
        path: ["cornerHeight"]
      });
    }
    if (field.values.length !== field.cornerWidth * field.cornerHeight) {
      context.addIssue({
        code: "custom",
        message: "Height field values must contain one value per corner",
        path: ["values"]
      });
    }
  });
export type HeightFieldValue = z.infer<typeof heightFieldValueSchema>;

export const transform3ValueSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  rotationDegrees: z.tuple([z.number(), z.number(), z.number()]),
  scale: z.tuple([z.number(), z.number(), z.number()])
});
export type Transform3Value = z.infer<typeof transform3ValueSchema>;

export const cellMaskColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.cellMask),
  value: cellMaskValueSchema.nullish()
});

export const heightFieldColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.heightField),
  value: heightFieldValueSchema.nullish()
});

export const transform3ColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.transform3),
  value: transform3ValueSchema.nullish()
});

export const terrainLayerRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.terrainLayerRef),
  value: z.string().nullish()
});

export const stampMaskRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.stampMaskRef),
  value: z.string().nullish()
});

export const heightFieldRefColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.heightFieldRef),
  value: z.string().nullish()
});

export const jsonColumnValueSchema = dataColumnValueBaseSchema.extend({
  type: z.literal(ColumnType.json),
  value: z.json().nullish()
});

export const typedDataColumnValueSchema = z.discriminatedUnion("type", [
  idColumnValueSchema,
  stringColumnValueSchema,
  textColumnValueSchema,
  integerColumnValueSchema,
  decimalColumnValueSchema,
  rangeColumnValueSchema,
  booleanColumnValueSchema,
  enumColumnValueSchema,
  enumArrayColumnValueSchema,
  assetRefColumnValueSchema,
  refColumnValueSchema,
  colorColumnValueSchema,
  vector2ColumnValueSchema,
  vector3ColumnValueSchema,
  vector4ColumnValueSchema,
  cellMaskColumnValueSchema,
  heightFieldColumnValueSchema,
  transform3ColumnValueSchema,
  terrainLayerRefColumnValueSchema,
  stampMaskRefColumnValueSchema,
  heightFieldRefColumnValueSchema,
  jsonColumnValueSchema
]);
export type TypedDataColumnValue = z.infer<typeof typedDataColumnValueSchema>;

export const dataTableRowSchema = z.object({
  id: z.nanoid(),
  values: z.array(typedDataColumnValueSchema)
});
export type DataTableRow = z.infer<typeof dataTableRowSchema>;

const schemaVersionSchema = z.int().min(1);
export const dataTableIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z0-9_-]+$/);

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

export const validatedDataTableSchema = anyDataTableSchema.superRefine((table, context) => {
  for (const duplicateColumnId of duplicateValues(table.columns.map((column) => column.id))) {
    context.addIssue({
      code: "custom",
      message: `Duplicate column id "${duplicateColumnId}"`,
      path: ["columns"]
    });
  }

  // for (const duplicateRowId of duplicateValues(table.rows.map((row) => row.id))) {
  //   context.addIssue({
  //     code: "custom",
  //     message: `Duplicate row id "${duplicateRowId}"`,
  //     path: ["rows"]
  //   });
  // }

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
