import z from "zod";

const constantSlugSchema = z
  .string()
  .min(1)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Use CONSTANT_CASE");

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex color");

export const tiledRoleSchema = z
  .object({
    id: constantSlugSchema,
    label: z.string().trim().min(1),
    color: colorSchema
  })
  .strict();
export type TiledRole = z.infer<typeof tiledRoleSchema>;

export const tiledBoardRegistryEntrySchema = z
  .object({
    id: constantSlugSchema,
    name: z.string().trim().min(1)
  })
  .strict();
export type TiledBoardRegistryEntry = z.infer<typeof tiledBoardRegistryEntrySchema>;

export const tiledWorkspaceConfigSchema = z
  .object({
    schemaVersion: z.literal(2),
    boards: z.array(tiledBoardRegistryEntrySchema)
  })
  .strict()
  .superRefine((value, context) => {
    const duplicate = value.boards.find((entry, index) => value.boards.findIndex((other) => other.id === entry.id) !== index);
    if (duplicate) {
      context.addIssue({ code: "custom", message: `Duplicate boards id '${duplicate.id}'`, path: ["boards"] });
    }
  });
export type TiledWorkspaceConfig = z.infer<typeof tiledWorkspaceConfigSchema>;

export const defaultTiledWorkspaceConfig = {
  schemaVersion: 2,
  boards: []
} satisfies TiledWorkspaceConfig;

export const tiledTileBindingSchema = z
  .object({
    slug: constantSlugSchema,
    roleId: constantSlugSchema,
    blocking: z.boolean(),
    tags: z.array(constantSlugSchema).default([])
  })
  .strict();
export type TiledTileBinding = z.infer<typeof tiledTileBindingSchema>;

export const tiledSampleSchema = z
  .object({
    slug: constantSlugSchema,
    layerIds: z.array(z.number().int().nonnegative()).min(1),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    allowRotations: z.boolean(),
    allowReflections: z.boolean()
  })
  .strict();
export type TiledSample = z.infer<typeof tiledSampleSchema>;

export const tiledBoardAuthoringSchema = z
  .object({
    tileBindings: z.record(z.string(), tiledTileBindingSchema),
    samples: z.array(tiledSampleSchema)
  })
  .strict()
  .superRefine((value, context) => {
    const sampleSlugs = new Set<string>();
    for (const [index, sample] of value.samples.entries()) {
      if (sampleSlugs.has(sample.slug))
        context.addIssue({ code: "custom", message: `Duplicate sample slug '${sample.slug}'`, path: ["samples", index, "slug"] });
      sampleSlugs.add(sample.slug);
    }
  });
export type TiledBoardAuthoring = z.infer<typeof tiledBoardAuthoringSchema>;

export const emptyTiledBoardAuthoring = {
  tileBindings: {},
  samples: []
} satisfies TiledBoardAuthoring;

export const tiledImportBoardInputSchema = z
  .object({
    projectPath: z.string().min(1),
    sourcePath: z.string().min(1),
    boardId: constantSlugSchema,
    name: z.string().trim().min(1)
  })
  .strict();
export type TiledImportBoardInput = z.infer<typeof tiledImportBoardInputSchema>;

export const tiledProjectInputSchema = z.object({ projectPath: z.string().min(1) }).strict();
export const tiledBoardInputSchema = tiledProjectInputSchema.extend({ boardId: constantSlugSchema }).strict();
export const tiledSaveRolesInputSchema = tiledProjectInputSchema.extend({ roles: z.array(tiledRoleSchema) }).strict();
export const tiledSaveAuthoringInputSchema = tiledBoardInputSchema.extend({ authoring: tiledBoardAuthoringSchema }).strict();
export const tiledDeleteTilesetInputSchema = tiledBoardInputSchema.extend({ tilesetId: constantSlugSchema }).strict();
export type TiledProjectInput = z.infer<typeof tiledProjectInputSchema>;
export type TiledBoardInput = z.infer<typeof tiledBoardInputSchema>;
export type TiledSaveRolesInput = z.infer<typeof tiledSaveRolesInputSchema>;
export type TiledSaveAuthoringInput = z.infer<typeof tiledSaveAuthoringInputSchema>;
export type TiledDeleteTilesetInput = z.infer<typeof tiledDeleteTilesetInputSchema>;

export interface TiledLayerView {
  id: number;
  name: string;
  visible: boolean;
  opacity: number;
  data: number[];
}

export interface TiledTilesetView {
  id: string;
  name: string;
  firstGid: number;
  tileWidth: number;
  tileHeight: number;
  tileCount: number;
  columns: number;
  margin: number;
  spacing: number;
  imageWidth: number;
  imageHeight: number;
  imagePath: string;
  imageHash: string;
}

export interface TiledBoardView {
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: TiledLayerView[];
  tilesets: TiledTilesetView[];
  authoring: TiledBoardAuthoring;
  problems: string[];
}

export interface TiledWorkspaceView {
  config: TiledWorkspaceConfig;
  roles: TiledRole[];
  boards: TiledBoardView[];
}

export const tiledSourceFileSchema = z.object({ path: z.string().min(1), content: z.string() }).strict();
export const tiledSourceImageSchema = z.object({ path: z.string().min(1), sha256: z.string().length(64) }).strict();
export const tiledSourceSnapshotSchema = z
  .object({
    config: tiledWorkspaceConfigSchema,
    files: z.array(tiledSourceFileSchema),
    images: z.array(tiledSourceImageSchema)
  })
  .strict();
export type TiledSourceSnapshot = z.infer<typeof tiledSourceSnapshotSchema>;

export const emptyTiledSourceSnapshot = {
  config: defaultTiledWorkspaceConfig,
  files: [],
  images: []
} satisfies TiledSourceSnapshot;
