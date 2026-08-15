import z from "zod";

export const terrainSlugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Use CONSTANT_CASE");

export const terrainTileRefSchema = z
  .object({
    tilesetId: terrainSlugSchema,
    localId: z.number().int().nonnegative(),
    orientation: z.number().int().min(0).max(7).default(0)
  })
  .strict();
export type TerrainTileRef = z.infer<typeof terrainTileRefSchema>;

export const terrainSampleLayerCountMax = 4;
export const terrainSampleLayerCountSchema = z.number().int().min(1).max(terrainSampleLayerCountMax);
export type TerrainSampleLayerCount = z.infer<typeof terrainSampleLayerCountSchema>;

export const terrainSampleCellSchema = z.array(terrainTileRefSchema.nullable()).min(1).max(4);
export type TerrainSampleCell = z.infer<typeof terrainSampleCellSchema>;

export const terrainTileBindingSchema = z
  .object({
    slug: terrainSlugSchema,
    blocking: z.boolean(),
    tags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainTileBinding = z.infer<typeof terrainTileBindingSchema>;

export const terrainSampleDimensionSchema = z.number().int().min(3).max(64);
export type TerrainSampleDimension = z.infer<typeof terrainSampleDimensionSchema>;

export const terrainSampleSchema = z
  .object({
    slug: terrainSlugSchema,
    width: terrainSampleDimensionSchema,
    height: terrainSampleDimensionSchema,
    layerCount: terrainSampleLayerCountSchema,
    cells: z.array(terrainSampleCellSchema),
    periodicInput: z.boolean(),
    allowRotations: z.boolean(),
    allowReflections: z.boolean()
  })
  .strict()
  .superRefine((sample, context) => {
    if (sample.cells.length !== sample.width * sample.height) {
      context.addIssue({ code: "custom", message: "Sample cell count must match its dimensions", path: ["cells"] });
    }
    sample.cells.forEach((cell, index) => {
      if (cell.length !== sample.layerCount) {
        context.addIssue({ code: "custom", message: "Sample cell layer count must match the sample", path: ["cells", index] });
      }
    });
  });
export type TerrainSample = z.infer<typeof terrainSampleSchema>;

export const terrainApprovedPatchSchema = z
  .object({
    slug: terrainSlugSchema,
    biome: terrainSlugSchema,
    category: terrainSlugSchema,
    weight: z.number().nonnegative(),
    width: terrainSampleDimensionSchema,
    height: terrainSampleDimensionSchema,
    layerCount: terrainSampleLayerCountSchema,
    cells: z.array(terrainSampleCellSchema)
  })
  .strict()
  .superRefine((patch, context) => {
    if (patch.cells.length !== patch.width * patch.height) {
      context.addIssue({ code: "custom", message: "Patch cell count must match its dimensions", path: ["cells"] });
    }
    patch.cells.forEach((cell, index) => {
      if (cell.length !== patch.layerCount) {
        context.addIssue({ code: "custom", message: "Patch cell layer count must match the patch", path: ["cells", index] });
      }
    });
  });
export type TerrainApprovedPatch = z.infer<typeof terrainApprovedPatchSchema>;

export function appendTerrainSampleLayer(sample: TerrainSample): TerrainSample {
  const layerCount = terrainSampleLayerCountSchema.parse(sample.layerCount + 1);
  return terrainSampleSchema.parse({
    ...sample,
    layerCount,
    cells: sample.cells.map((cell) => [...cell, null])
  });
}

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
  tilesets: TerrainTilesetView[];
  tileBindings: Record<string, TerrainTileBinding>;
  samples: TerrainSample[];
  approvedPatches: TerrainApprovedPatch[];
  problems: string[];
}

export function terrainTileKey(tilesetId: string, localId: number): string {
  return `${tilesetId}:${localId}`;
}
