import z from "zod";

export const terrainSlugSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/, "Use CONSTANT_CASE");

export const terrainDirections = ["north", "east", "south", "west"] as const;
export const terrainDirectionSchema = z.enum(terrainDirections);
export type TerrainDirection = z.infer<typeof terrainDirectionSchema>;

export const terrainTileRefSchema = z
  .object({
    tilesetId: terrainSlugSchema,
    localId: z.number().int().nonnegative(),
    orientation: z.number().int().min(0).max(7).default(0)
  })
  .strict();
export type TerrainTileRef = z.infer<typeof terrainTileRefSchema>;

export const terrainLayerCountMax = 4;
export const terrainLayerCountSchema = z.number().int().min(1).max(terrainLayerCountMax);
export type TerrainLayerCount = z.infer<typeof terrainLayerCountSchema>;

export const terrainTileStackSchema = z.array(terrainTileRefSchema.nullable()).min(1).max(terrainLayerCountMax);
export type TerrainTileStack = z.infer<typeof terrainTileStackSchema>;

export const terrainTileBindingSchema = z
  .object({
    slug: terrainSlugSchema,
    tags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainTileBinding = z.infer<typeof terrainTileBindingSchema>;

export const terrainSocketDefinitionSchema = z
  .object({
    slug: terrainSlugSchema,
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a six-digit hex color"),
    description: z.string().max(512)
  })
  .strict();
export type TerrainSocketDefinition = z.infer<typeof terrainSocketDefinitionSchema>;

export const terrainPieceDimensionSchema = z.number().int().min(1).max(8);
export type TerrainPieceDimension = z.infer<typeof terrainPieceDimensionSchema>;

export const terrainPieceCellSchema = z
  .object({
    tiles: terrainTileStackSchema,
    blocking: z.boolean(),
    elevation: z.number().int().min(-8).max(8),
    semanticFlags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainPieceCell = z.infer<typeof terrainPieceCellSchema>;

export const terrainSocketProfilesSchema = z
  .object({
    north: z.array(terrainSlugSchema),
    east: z.array(terrainSlugSchema),
    south: z.array(terrainSlugSchema),
    west: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainSocketProfiles = z.infer<typeof terrainSocketProfilesSchema>;

export const terrainPieceSchema = z
  .object({
    slug: terrainSlugSchema,
    width: terrainPieceDimensionSchema,
    height: terrainPieceDimensionSchema,
    layerCount: terrainLayerCountSchema,
    cells: z.array(terrainPieceCellSchema),
    sockets: terrainSocketProfilesSchema,
    allowRotations: z.boolean(),
    allowReflections: z.boolean(),
    weight: z.number().positive().max(1_000_000),
    biomeTags: z.array(terrainSlugSchema),
    siteTags: z.array(terrainSlugSchema),
    semanticFlags: z.array(terrainSlugSchema),
    mutationFamily: z.union([terrainSlugSchema, z.literal("")])
  })
  .strict()
  .superRefine((piece, context) => {
    if (piece.cells.length !== piece.width * piece.height) {
      context.addIssue({ code: "custom", message: "Piece cell count must match its dimensions", path: ["cells"] });
    }
    piece.cells.forEach((cell, index) => {
      if (cell.tiles.length !== piece.layerCount) {
        context.addIssue({ code: "custom", message: "Piece cell layers must match layer count", path: ["cells", index, "tiles"] });
      }
      if (cell.tiles[0] === null) {
        context.addIssue({
          code: "custom",
          message: "Terrain pieces must paint every first-layer cell",
          path: ["cells", index, "tiles", 0]
        });
      }
    });
    const expected = { north: piece.width, east: piece.height, south: piece.width, west: piece.height } as const;
    for (const direction of terrainDirections) {
      if (piece.sockets[direction].length !== expected[direction]) {
        context.addIssue({
          code: "custom",
          message: `${direction} socket profile must contain ${expected[direction]} segment(s)`,
          path: ["sockets", direction]
        });
      }
    }
  });
export type TerrainPiece = z.infer<typeof terrainPieceSchema>;

export const terrainPieceSetSchema = z
  .object({
    slug: terrainSlugSchema,
    pieceSlugs: z.array(terrainSlugSchema).min(1),
    biomeTags: z.array(terrainSlugSchema),
    siteTags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainPieceSet = z.infer<typeof terrainPieceSetSchema>;

export const terrainAdjacencyOverrideSchema = z
  .object({
    slug: terrainSlugSchema,
    sourcePiece: terrainSlugSchema,
    direction: terrainDirectionSchema,
    targetPiece: terrainSlugSchema,
    mode: z.enum(["ALLOW_ONLY", "DENY"])
  })
  .strict();
export type TerrainAdjacencyOverride = z.infer<typeof terrainAdjacencyOverrideSchema>;

export const terrainTemplateDimensionSchema = z.number().int().min(3).max(64);
export const terrainTemplateCellSchema = z
  .object({
    requiredTags: z.array(terrainSlugSchema),
    forbiddenTags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainTemplateCell = z.infer<typeof terrainTemplateCellSchema>;

export const terrainTemplateAnchorSchema = z
  .object({
    slug: terrainSlugSchema,
    kind: z.enum(["ENTRANCE", "EXIT", "EXTENSION"]),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    direction: terrainDirectionSchema,
    socket: terrainSlugSchema
  })
  .strict();
export type TerrainTemplateAnchor = z.infer<typeof terrainTemplateAnchorSchema>;

export const terrainTemplateStampSchema = z
  .object({
    piece: terrainSlugSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    orientation: z.number().int().min(0).max(7)
  })
  .strict();
export type TerrainTemplateStamp = z.infer<typeof terrainTemplateStampSchema>;

export const terrainTemplateZoneSchema = z
  .object({
    slug: terrainSlugSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    requiredTags: z.array(terrainSlugSchema),
    minCount: z.number().int().nonnegative(),
    maxCount: z.number().int().nonnegative()
  })
  .strict()
  .refine((zone) => zone.maxCount >= zone.minCount, { message: "Zone maximum must be at least its minimum", path: ["maxCount"] });
export type TerrainTemplateZone = z.infer<typeof terrainTemplateZoneSchema>;

export const terrainSiteTemplateSchema = z
  .object({
    slug: terrainSlugSchema,
    width: terrainTemplateDimensionSchema,
    height: terrainTemplateDimensionSchema,
    pieceSet: terrainSlugSchema,
    firstSeed: z.number().int().min(0).max(0xffffffff),
    candidateCount: z.number().int().min(1).max(24),
    cells: z.array(terrainTemplateCellSchema),
    anchors: z.array(terrainTemplateAnchorSchema),
    stamps: z.array(terrainTemplateStampSchema),
    zones: z.array(terrainTemplateZoneSchema)
  })
  .strict()
  .superRefine((template, context) => {
    if (template.cells.length !== template.width * template.height) {
      context.addIssue({ code: "custom", message: "Template cell count must match its dimensions", path: ["cells"] });
    }
    template.anchors.forEach((anchor, index) => {
      if (anchor.x >= template.width || anchor.y >= template.height) {
        context.addIssue({ code: "custom", message: "Anchor is outside the template", path: ["anchors", index] });
      }
      if (anchor.kind === "EXTENSION") {
        const onBoundary = anchor.x === 0 || anchor.y === 0 || anchor.x === template.width - 1 || anchor.y === template.height - 1;
        if (!onBoundary)
          context.addIssue({ code: "custom", message: "Extension anchors must lie on the map boundary", path: ["anchors", index] });
      }
    });
    template.zones.forEach((zone, index) => {
      if (zone.x + zone.width > template.width || zone.y + zone.height > template.height) {
        context.addIssue({ code: "custom", message: "Zone is outside the template", path: ["zones", index] });
      }
    });
  });
export type TerrainSiteTemplate = z.infer<typeof terrainSiteTemplateSchema>;

export const terrainPlacementSchema = z
  .object({
    piece: terrainSlugSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    orientation: z.number().int().min(0).max(7),
    width: terrainPieceDimensionSchema,
    height: terrainPieceDimensionSchema
  })
  .strict();
export type TerrainPlacement = z.infer<typeof terrainPlacementSchema>;

export const terrainResolvedCellMetadataSchema = z
  .object({
    blocking: z.boolean(),
    elevation: z.number().int().min(-8).max(8),
    tags: z.array(terrainSlugSchema),
    piece: terrainSlugSchema
  })
  .strict();
export type TerrainResolvedCellMetadata = z.infer<typeof terrainResolvedCellMetadataSchema>;

export const terrainCandidateMetricSchema = z
  .object({
    walkableComponents: z.number().int().nonnegative(),
    reachableAnchors: z.number().int().nonnegative(),
    requiredAnchors: z.number().int().nonnegative(),
    distinctPieces: z.number().int().nonnegative()
  })
  .strict();
export type TerrainCandidateMetric = z.infer<typeof terrainCandidateMetricSchema>;

export const terrainApprovedCellOverrideSchema = z
  .object({
    index: z.number().int().nonnegative(),
    tiles: terrainTileStackSchema,
    blocking: z.boolean(),
    elevation: z.number().int().min(-8).max(8),
    tags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainApprovedCellOverride = z.infer<typeof terrainApprovedCellOverrideSchema>;

export const terrainApprovedAssetSchema = z
  .object({
    slug: terrainSlugSchema,
    kind: z.enum(["MAP", "SUBMODULE"]),
    sourceTemplate: terrainSlugSchema,
    seed: z.number().int().nonnegative(),
    width: terrainTemplateDimensionSchema,
    height: terrainTemplateDimensionSchema,
    layerCount: terrainLayerCountSchema,
    cells: z.array(terrainTileStackSchema),
    cellMetadata: z.array(terrainResolvedCellMetadataSchema),
    cellOverrides: z.array(terrainApprovedCellOverrideSchema),
    placements: z.array(terrainPlacementSchema),
    anchors: z.array(terrainTemplateAnchorSchema),
    metrics: terrainCandidateMetricSchema
  })
  .strict()
  .superRefine((asset, context) => {
    const size = asset.width * asset.height;
    if (asset.cells.length !== size)
      context.addIssue({ code: "custom", message: "Approved cell count must match dimensions", path: ["cells"] });
    if (asset.cellMetadata.length !== size) {
      context.addIssue({ code: "custom", message: "Approved metadata count must match dimensions", path: ["cellMetadata"] });
    }
    asset.cells.forEach((cell, index) => {
      if (cell.length !== asset.layerCount) {
        context.addIssue({ code: "custom", message: "Approved cell layers must match layer count", path: ["cells", index] });
      }
    });
    const overrideIndexes = new Set<number>();
    asset.cellOverrides.forEach((override, index) => {
      if (override.index >= size) {
        context.addIssue({ code: "custom", message: "Approved override is outside the map", path: ["cellOverrides", index, "index"] });
      }
      if (override.tiles.length !== asset.layerCount) {
        context.addIssue({
          code: "custom",
          message: "Approved override layers must match layer count",
          path: ["cellOverrides", index, "tiles"]
        });
      }
      if (overrideIndexes.has(override.index)) {
        context.addIssue({ code: "custom", message: "Approved cell overrides must be unique", path: ["cellOverrides", index, "index"] });
      }
      overrideIndexes.add(override.index);
    });
  });
export type TerrainApprovedAsset = z.infer<typeof terrainApprovedAssetSchema>;

export const terrainSpatialZoneSchema = z
  .object({
    slug: terrainSlugSchema,
    kind: z.enum(["PLACEMENT", "EXCLUSION", "RESERVED"]),
    cells: z.array(z.number().int().nonnegative()),
    tags: z.array(terrainSlugSchema),
    ruleSet: z.union([terrainSlugSchema, z.literal("")])
  })
  .strict()
  .superRefine((zone, context) => {
    if (new Set(zone.cells).size !== zone.cells.length) {
      context.addIssue({ code: "custom", message: "Zone cells must be unique", path: ["cells"] });
    }
  });
export type TerrainSpatialZone = z.infer<typeof terrainSpatialZoneSchema>;

export const terrainSpatialMarkerSchema = z
  .object({
    slug: terrainSlugSchema,
    kind: terrainSlugSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    radius: z.number().int().min(0).max(32),
    direction: terrainDirectionSchema,
    tags: z.array(terrainSlugSchema)
  })
  .strict();
export type TerrainSpatialMarker = z.infer<typeof terrainSpatialMarkerSchema>;

export const terrainSpatialPlacementSchema = z
  .object({
    slug: terrainSlugSchema,
    mode: z.enum(["FIXED", "RULE"]),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: terrainPieceDimensionSchema,
    height: terrainPieceDimensionSchema,
    orientation: z.number().int().min(0).max(7),
    contentTable: z.string().trim().max(96),
    contentSlug: z.union([terrainSlugSchema, z.literal("")]),
    ruleSet: z.union([terrainSlugSchema, z.literal("")]),
    tags: z.array(terrainSlugSchema)
  })
  .strict()
  .superRefine((placement, context) => {
    if (placement.mode === "FIXED" && (!placement.contentTable || !placement.contentSlug)) {
      context.addIssue({ code: "custom", message: "Fixed placements require a content table and row slug" });
    }
    if (placement.mode === "RULE" && !placement.ruleSet) {
      context.addIssue({ code: "custom", message: "Rule placements require a rule-set slug" });
    }
  });
export type TerrainSpatialPlacement = z.infer<typeof terrainSpatialPlacementSchema>;

export const terrainSpatialLayoutSchema = z
  .object({
    slug: terrainSlugSchema,
    sourceAsset: terrainSlugSchema,
    zones: z.array(terrainSpatialZoneSchema),
    markers: z.array(terrainSpatialMarkerSchema),
    placements: z.array(terrainSpatialPlacementSchema)
  })
  .strict();
export type TerrainSpatialLayout = z.infer<typeof terrainSpatialLayoutSchema>;

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
  sockets: TerrainSocketDefinition[];
  pieces: TerrainPiece[];
  pieceSets: TerrainPieceSet[];
  adjacencyOverrides: TerrainAdjacencyOverride[];
  templates: TerrainSiteTemplate[];
  approvedAssets: TerrainApprovedAsset[];
  spatialLayouts: TerrainSpatialLayout[];
  problems: string[];
}

export function terrainTileKey(tilesetId: string, localId: number): string {
  return `${tilesetId}:${localId}`;
}

export function createTerrainPieceCell(layerCount: number): TerrainPieceCell {
  return {
    tiles: Array<TerrainTileRef | null>(terrainLayerCountSchema.parse(layerCount)).fill(null),
    blocking: false,
    elevation: 0,
    semanticFlags: []
  };
}

export function appendTerrainPieceLayer(piece: TerrainPiece): TerrainPiece {
  const layerCount = terrainLayerCountSchema.parse(piece.layerCount + 1);
  return terrainPieceSchema.parse({
    ...piece,
    layerCount,
    cells: piece.cells.map((cell) => ({ ...cell, tiles: [...cell.tiles, null] }))
  });
}

export function createTerrainTemplateCells(width: number, height: number): TerrainTemplateCell[] {
  return Array.from({ length: width * height }, () => ({
    requiredTags: [],
    forbiddenTags: []
  }));
}
