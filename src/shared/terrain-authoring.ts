import z from "zod";

export const terrainSlugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Use CONSTANT_CASE");

export const terrainRoleSchema = z
  .object({
    id: terrainSlugSchema,
    label: z.string().trim().min(1),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex color")
  })
  .strict();
export type TerrainRole = z.infer<typeof terrainRoleSchema>;

export const terrainTileRefSchema = z
  .object({
    tilesetId: terrainSlugSchema,
    localId: z.number().int().nonnegative(),
    orientation: z.number().int().min(0).max(7).default(0)
  })
  .strict();
export type TerrainTileRef = z.infer<typeof terrainTileRefSchema>;

export const terrainTileBindingSchema = z
  .object({
    slug: terrainSlugSchema,
    roleId: terrainSlugSchema,
    blocking: z.boolean(),
    tags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainTileBinding = z.infer<typeof terrainTileBindingSchema>;

export const terrainSampleDimensionSchema = z.union([z.literal(3), z.literal(4), z.literal(5)]);
export type TerrainSampleDimension = z.infer<typeof terrainSampleDimensionSchema>;

export const terrainSampleSchema = z
  .object({
    slug: terrainSlugSchema,
    width: terrainSampleDimensionSchema,
    height: terrainSampleDimensionSchema,
    cells: z.array(terrainTileRefSchema.nullable()),
    allowRotations: z.boolean(),
    allowReflections: z.boolean()
  })
  .strict()
  .superRefine((sample, context) => {
    if (sample.cells.length !== sample.width * sample.height) {
      context.addIssue({ code: "custom", message: "Sample cell count must match its dimensions", path: ["cells"] });
    }
  });
export type TerrainSample = z.infer<typeof terrainSampleSchema>;

export interface TerrainTilesetView {
  id: string;
  name: string;
  tileSize: number;
  tileCount: number;
  columns: number;
  rows: number;
  imageWidth: number;
  imageHeight: number;
  imagePath: string;
}

export interface TerrainWorkspaceView {
  roles: TerrainRole[];
  tilesets: TerrainTilesetView[];
  tileBindings: Record<string, TerrainTileBinding>;
  samples: TerrainSample[];
  problems: string[];
}

export function terrainTileKey(tilesetId: string, localId: number): string {
  return `${tilesetId}:${localId}`;
}
