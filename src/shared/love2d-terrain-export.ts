import type { AnyDataTable, Asset, DataColumnDefinition, DataTableRow } from "./schemas";
import {
  terrainAnnotationDefinitionSchema,
  terrainApprovedAssetSchema,
  terrainSpatialLayoutSchema,
  type TerrainAnnotationDefinition,
  type TerrainApprovedAsset,
  type TerrainCollisionMask,
  type TerrainSpatialLayout,
  type TerrainTileRef
} from "./terrain-authoring";
import { resolveApprovedTerrainCell, refreshApprovedTerrainMetrics } from "./terrain-approved-overpaint";
import {
  TERRAIN_APPROVED_ASSET_COLUMNS,
  TERRAIN_APPROVED_ASSETS_TABLE_ID,
  TERRAIN_ANNOTATION_COLUMNS,
  TERRAIN_ANNOTATIONS_TABLE_ID,
  TERRAIN_SPATIAL_LAYOUT_COLUMNS,
  TERRAIN_SPATIAL_LAYOUTS_TABLE_ID
} from "./terrain-tables";
import { terrainOrientationMatrix } from "./terrain-wfc";
import { AssetCategoryEnum } from "./types";

export const LOVE2D_TERRAIN_PATH = "gamedata/terrain.lua";
export const LOVE2D_TERRAIN_MODULE = "gamedata.terrain";

export interface Love2dTerrainExportFile {
  content: string;
  path: string;
}

export interface Love2dTerrainExport {
  annotationCount: number;
  assetCount: number;
  files: Love2dTerrainExportFile[];
  layoutCount: number;
}

function luaString(value: string): string {
  let result = '"';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "\\") result += "\\\\";
    else if (character === '"') result += '\\"';
    else if (character === "\n") result += "\\n";
    else if (character === "\r") result += "\\r";
    else if (character === "\t") result += "\\t";
    else if (typeof codePoint === "number" && (codePoint < 32 || codePoint === 127)) {
      result += `\\${codePoint.toString().padStart(3, "0")}`;
    } else result += character;
  }
  return `${result}"`;
}

function luaArray(values: string[]): string {
  return `{ ${values.join(", ")} }`;
}

function luaStrings(values: string[]): string {
  return luaArray(values.map(luaString));
}

function luaRecord(fields: Array<[string, string]>): string {
  return `{ ${fields.map(([key, value]) => `${key} = ${value}`).join(", ")} }`;
}

function constantCase(value: string): string {
  const words = value.match(/[A-Za-z0-9]+/g) ?? [];
  const result = words.map((word) => word.toUpperCase()).join("_");
  return /^[A-Z]/.test(result) ? result : `VALUE_${result || "UNKNOWN"}`;
}

function uniqueConstants(values: string[]): Map<string, string> {
  const names = new Map<string, string>();
  const used = new Set(["INVALID"]);
  for (const value of values) {
    const base = constantCase(value);
    let name = base;
    let suffix = 2;
    while (used.has(name)) {
      name = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(name);
    names.set(value, name);
  }
  return names;
}

function renderIdTable(slugs: string[]): string {
  const names = uniqueConstants(slugs);
  return luaRecord([["INVALID", "0"], ...slugs.map((slug, index): [string, string] => [names.get(slug)!, String(index + 1)])]);
}

function requiredCell(row: DataTableRow, column: DataColumnDefinition): unknown {
  const stored = row.values.find((entry) => entry.columnId === column.id);
  if (!stored || stored.type !== column.type) {
    throw new Error(`LÖVE terrain export row "${row.slug}" is missing current field "${column.name}".`);
  }
  return stored.value;
}

function requiredStringCell(row: DataTableRow, column: DataColumnDefinition): string {
  const value = requiredCell(row, column);
  if (typeof value !== "string") {
    throw new Error(`LÖVE terrain export row "${row.slug}" has invalid field "${column.name}".`);
  }
  return value;
}

function requiredObjectCell(row: DataTableRow, column: DataColumnDefinition): object {
  const value = requiredCell(row, column);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`LÖVE terrain export row "${row.slug}" has invalid field "${column.name}".`);
  }
  return value;
}

function assertUniqueSlugs(entries: Array<{ slug: string }>, kind: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.slug)) throw new Error(`LÖVE terrain export contains duplicate ${kind} slug "${entry.slug}".`);
    seen.add(entry.slug);
  }
}

function parseApprovedAssets(table: AnyDataTable): TerrainApprovedAsset[] {
  const assets = table.rows.map((row) => {
    const parsed = terrainApprovedAssetSchema.parse({
      ...requiredObjectCell(row, TERRAIN_APPROVED_ASSET_COLUMNS.definition),
      slug: row.slug
    });
    const kind = requiredStringCell(row, TERRAIN_APPROVED_ASSET_COLUMNS.kind);
    const sourceTemplate = requiredStringCell(row, TERRAIN_APPROVED_ASSET_COLUMNS.sourceTemplate);
    if (kind !== parsed.kind || sourceTemplate !== parsed.sourceTemplate) {
      throw new Error(`LÖVE terrain export row "${row.slug}" disagrees with its approved terrain definition.`);
    }
    return refreshApprovedTerrainMetrics(parsed);
  });
  assertUniqueSlugs(assets, "approved asset");
  return assets;
}

function parseAnnotations(table: AnyDataTable): TerrainAnnotationDefinition[] {
  const annotations = table.rows.map((row) =>
    terrainAnnotationDefinitionSchema.parse({
      slug: row.slug,
      color: requiredStringCell(row, TERRAIN_ANNOTATION_COLUMNS.color)
    })
  );
  assertUniqueSlugs(annotations, "annotation");
  return annotations;
}

function parseSpatialLayouts(table: AnyDataTable): TerrainSpatialLayout[] {
  const layouts = table.rows.map((row) => {
    const parsed = terrainSpatialLayoutSchema.parse({
      ...requiredObjectCell(row, TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition),
      slug: row.slug
    });
    if (requiredStringCell(row, TERRAIN_SPATIAL_LAYOUT_COLUMNS.sourceAsset) !== parsed.sourceAsset) {
      throw new Error(`LÖVE terrain export row "${row.slug}" disagrees with its spatial layout definition.`);
    }
    return parsed;
  });
  assertUniqueSlugs(layouts, "spatial layout");
  return layouts;
}

function renderTile(tile: TerrainTileRef, layer: number, assetIds: Map<string, number>, assetsById: Map<string, Asset>): string {
  const asset = assetsById.get(tile.tilesetId);
  if (!asset) throw new Error(`LÖVE terrain export could not find tileset asset "${tile.tilesetId}".`);
  if (asset.category !== AssetCategoryEnum.tileset || !asset.tileSize) {
    throw new Error(`LÖVE terrain export expected "${tile.tilesetId}" to be a valid TILESET asset.`);
  }
  const tileCount = (asset.width / asset.tileSize) * (asset.height / asset.tileSize);
  if (tile.localId >= tileCount) {
    throw new Error(`LÖVE terrain export tile ${tile.localId} is outside tileset "${tile.tilesetId}".`);
  }
  const assetId = assetIds.get(asset.id);
  if (!assetId) throw new Error(`LÖVE terrain export could not assign an asset id to tileset "${tile.tilesetId}".`);
  return luaRecord([
    ["layer", String(layer)],
    ["asset", String(assetId)],
    ["local_id", String(tile.localId)],
    ["orientation", String(tile.orientation)]
  ]);
}

function renderCollision(mask: TerrainCollisionMask): string {
  const rows = Array.from({ length: mask.resolution }, (_, y) =>
    mask.cells
      .slice(y * mask.resolution, (y + 1) * mask.resolution)
      .map((blocking) => (blocking ? "1" : "0"))
      .join("")
  );
  return luaRecord([
    ["resolution", String(mask.resolution)],
    ["rows", luaStrings(rows)]
  ]);
}

function renderApprovedAsset(
  asset: TerrainApprovedAsset,
  assetIds: Map<string, number>,
  assetsById: Map<string, Asset>,
  usedTilesets: Set<string>
): string {
  const cells = asset.cells.map((_, index) => {
    const resolved = resolveApprovedTerrainCell(asset, index);
    const tiles = resolved.tiles.flatMap((tile, layerIndex) => {
      if (!tile) return [];
      usedTilesets.add(tile.tilesetId);
      return [renderTile(tile, layerIndex + 1, assetIds, assetsById)];
    });
    const fields: Array<[string, string]> = [
      ["x", String(index % asset.width)],
      ["y", String(Math.floor(index / asset.width))],
      ["tiles", luaArray(tiles)],
      ["blocking", resolved.metadata.blocking ? "true" : "false"],
      ["elevation", String(resolved.metadata.elevation)],
      ["tags", luaStrings(resolved.metadata.tags)],
      ["piece", luaString(resolved.metadata.piece)]
    ];
    if (resolved.metadata.collision) fields.push(["collision", renderCollision(resolved.metadata.collision)]);
    return luaRecord(fields);
  });
  const placements = asset.placements.map((placement) =>
    luaRecord([
      ["piece", luaString(placement.piece)],
      ["x", String(placement.x)],
      ["y", String(placement.y)],
      ["orientation", String(placement.orientation)],
      ["width", String(placement.width)],
      ["height", String(placement.height)]
    ])
  );
  const anchors = asset.anchors.map((anchor) =>
    luaRecord([
      ["slug", luaString(anchor.slug)],
      ["kind", luaString(anchor.kind)],
      ["x", String(anchor.x)],
      ["y", String(anchor.y)],
      ["direction", luaString(anchor.direction)],
      ["socket", luaString(anchor.socket)]
    ])
  );
  return luaRecord([
    ["slug", luaString(asset.slug)],
    ["kind", luaString(asset.kind)],
    ["source_template", luaString(asset.sourceTemplate)],
    ["seed", typeof asset.seed === "number" ? String(asset.seed) : "false"],
    ["width", String(asset.width)],
    ["height", String(asset.height)],
    ["layer_count", String(asset.layerCount)],
    ["cells", luaArray(cells)],
    ["placements", luaArray(placements)],
    ["anchors", luaArray(anchors)],
    [
      "metrics",
      luaRecord([
        ["walkable_components", String(asset.metrics.walkableComponents)],
        ["reachable_anchors", String(asset.metrics.reachableAnchors)],
        ["required_anchors", String(asset.metrics.requiredAnchors)],
        ["distinct_pieces", String(asset.metrics.distinctPieces)]
      ])
    ]
  ]);
}

function renderSpatialLayout(
  layout: TerrainSpatialLayout,
  approvedIds: Map<string, number>,
  approvedBySlug: Map<string, TerrainApprovedAsset>,
  annotationIds: Map<string, number>
): string {
  const sourceAsset = approvedBySlug.get(layout.sourceAsset);
  const sourceAssetId = approvedIds.get(layout.sourceAsset);
  if (!sourceAsset || !sourceAssetId) {
    throw new Error(`LÖVE terrain export layout "${layout.slug}" references missing approved asset "${layout.sourceAsset}".`);
  }
  const cellCount = sourceAsset.width * sourceAsset.height;
  const cells = layout.cells.map((cell) => {
    if (cell.index >= cellCount) {
      throw new Error(`LÖVE terrain export annotated cell ${cell.index} extends outside approved asset "${sourceAsset.slug}".`);
    }
    const ids = cell.annotations.map((slug) => {
      const id = annotationIds.get(slug);
      if (!id) throw new Error(`LÖVE terrain export layout "${layout.slug}" references missing annotation "${slug}".`);
      return id;
    });
    return luaRecord([
      ["cell", String(cell.index + 1)],
      ["x", String(cell.index % sourceAsset.width)],
      ["y", String(Math.floor(cell.index / sourceAsset.width))],
      ["annotations", luaArray(ids.map(String))]
    ]);
  });
  return luaRecord([
    ["slug", luaString(layout.slug)],
    ["source_asset", String(sourceAssetId)],
    ["source_asset_slug", luaString(sourceAsset.slug)],
    ["cells", luaArray(cells)]
  ]);
}

function renderTilesets(usedTilesets: Set<string>, assetIds: Map<string, number>, assetsById: Map<string, Asset>): string {
  const entries = [...usedTilesets].map((tilesetId) => {
    const asset = assetsById.get(tilesetId);
    const assetId = assetIds.get(tilesetId);
    if (!asset || !assetId || !asset.tileSize) throw new Error(`LÖVE terrain export could not resolve tileset "${tilesetId}".`);
    const columns = asset.width / asset.tileSize;
    const rows = asset.height / asset.tileSize;
    const definition = luaRecord([
      ["asset", String(assetId)],
      ["slug", luaString(asset.id)],
      ["tile_size", String(asset.tileSize)],
      ["columns", String(columns)],
      ["rows", String(rows)],
      ["width", String(asset.width)],
      ["height", String(asset.height)]
    ]);
    return `[${assetId}] = ${definition}`;
  });
  return `{ ${entries.join(", ")} }`;
}

function renderTerrainModule(
  approvedAssets: TerrainApprovedAsset[],
  annotations: TerrainAnnotationDefinition[],
  layouts: TerrainSpatialLayout[],
  assets: Asset[]
): Love2dTerrainExportFile {
  const assetIds = new Map(assets.map((asset, index) => [asset.id, index + 1]));
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const approvedIds = new Map(approvedAssets.map((asset, index) => [asset.slug, index + 1]));
  const approvedBySlug = new Map(approvedAssets.map((asset) => [asset.slug, asset]));
  const annotationIds = new Map(annotations.map((annotation, index) => [annotation.slug, index + 1]));
  const usedTilesets = new Set<string>();
  const renderedAssets = approvedAssets.map((asset) => renderApprovedAsset(asset, assetIds, assetsById, usedTilesets));
  const renderedAnnotations = annotations.map((annotation) =>
    luaRecord([
      ["slug", luaString(annotation.slug)],
      ["color", luaString(annotation.color)]
    ])
  );
  const renderedLayouts = layouts.map((layout) => renderSpatialLayout(layout, approvedIds, approvedBySlug, annotationIds));
  const matrices = Array.from({ length: 8 }, (_, orientation) => {
    const matrix = terrainOrientationMatrix(orientation);
    return `[${orientation}] = ${luaArray(matrix.map(String))}`;
  });
  const lines = [
    "-- Generated by Chisel. Do not edit.",
    "-- Coordinates and tile local_ids are 0-based; Lua cell ids and layer ids are 1-based.",
    "local terrain = {",
    `\tASSET_COUNT = ${approvedAssets.length},`,
    `\tANNOTATION_COUNT = ${annotations.length},`,
    `\tLAYOUT_COUNT = ${layouts.length},`,
    `\tASSET_ID = ${renderIdTable(approvedAssets.map((asset) => asset.slug))},`,
    `\tANNOTATION_ID = ${renderIdTable(annotations.map((annotation) => annotation.slug))},`,
    `\tLAYOUT_ID = ${renderIdTable(layouts.map((layout) => layout.slug))},`,
    `\tASSET_SLUGS = ${luaStrings(approvedAssets.map((asset) => asset.slug))},`,
    `\tANNOTATION_SLUGS = ${luaStrings(annotations.map((annotation) => annotation.slug))},`,
    `\tLAYOUT_SLUGS = ${luaStrings(layouts.map((layout) => layout.slug))},`,
    `\tORIENTATIONS = { ${matrices.join(", ")} },`,
    `\tTILESETS = ${renderTilesets(usedTilesets, assetIds, assetsById)},`,
    `\tASSETS = ${luaArray(renderedAssets)},`,
    `\tANNOTATIONS = ${luaArray(renderedAnnotations)},`,
    `\tLAYOUTS = ${luaArray(renderedLayouts)},`,
    "}",
    "",
    "local function checkedId(id, count, kind)",
    '\tif type(id) ~= "number" or id % 1 ~= 0 or id < 1 or id > count then',
    '\t\terror("Invalid Chisel terrain " .. kind .. " id: " .. tostring(id), 3)',
    "\tend",
    "\treturn id",
    "end",
    "",
    "function terrain.asset(id)",
    '\treturn terrain.ASSETS[checkedId(id, terrain.ASSET_COUNT, "asset")]',
    "end",
    "",
    "function terrain.layout(id)",
    '\treturn terrain.LAYOUTS[checkedId(id, terrain.LAYOUT_COUNT, "layout")]',
    "end",
    "",
    "function terrain.annotation(id)",
    '\treturn terrain.ANNOTATIONS[checkedId(id, terrain.ANNOTATION_COUNT, "annotation")]',
    "end",
    "",
    "function terrain.cellId(assetId, x, y)",
    "\tlocal asset = terrain.asset(assetId)",
    '\tif type(x) ~= "number" or x % 1 ~= 0 or type(y) ~= "number" or y % 1 ~= 0 or x < 0 or y < 0 or x >= asset.width or y >= asset.height then',
    '\t\terror("Terrain cell coordinates are outside asset " .. asset.slug, 2)',
    "\tend",
    "\treturn y * asset.width + x + 1",
    "end",
    "",
    "function terrain.cell(assetId, x, y)",
    "\tlocal asset = terrain.asset(assetId)",
    "\treturn asset.cells[terrain.cellId(assetId, x, y)]",
    "end",
    "",
    "function terrain.tileSource(tile)",
    "\tlocal tileset = terrain.TILESETS[tile.asset]",
    '\tif not tileset then error("Terrain tile references an unknown tileset asset: " .. tostring(tile.asset), 2) end',
    "\tlocal column = tile.local_id % tileset.columns",
    "\tlocal row = math.floor(tile.local_id / tileset.columns)",
    "\treturn column * tileset.tile_size, row * tileset.tile_size, tileset.tile_size, tileset.tile_size",
    "end",
    "",
    "return terrain",
    ""
  ];
  return { path: LOVE2D_TERRAIN_PATH, content: lines.join("\n") };
}

export function renderLove2dTerrainExport(
  sourceTables: AnyDataTable[],
  _runtimeTables: AnyDataTable[],
  assets: Asset[]
): Love2dTerrainExport {
  const approvedTable = sourceTables.find((table) => table.id === TERRAIN_APPROVED_ASSETS_TABLE_ID);
  const annotationsTable = sourceTables.find((table) => table.id === TERRAIN_ANNOTATIONS_TABLE_ID);
  const layoutsTable = sourceTables.find((table) => table.id === TERRAIN_SPATIAL_LAYOUTS_TABLE_ID);
  if (!approvedTable && !annotationsTable && !layoutsTable) return { annotationCount: 0, assetCount: 0, files: [], layoutCount: 0 };
  if (!approvedTable || !annotationsTable || !layoutsTable) {
    throw new Error("LÖVE terrain export requires current approved-assets, annotations, and spatial-layout system tables.");
  }
  const approvedAssets = parseApprovedAssets(approvedTable);
  const annotations = parseAnnotations(annotationsTable);
  const layouts = parseSpatialLayouts(layoutsTable);
  const duplicateSourceAsset = layouts.find(
    (layout, index) => layouts.findIndex((entry) => entry.sourceAsset === layout.sourceAsset) !== index
  );
  if (duplicateSourceAsset) {
    throw new Error(`LÖVE terrain export approved asset "${duplicateSourceAsset.sourceAsset}" has more than one annotation layout.`);
  }
  return {
    annotationCount: annotations.length,
    assetCount: approvedAssets.length,
    files: [renderTerrainModule(approvedAssets, annotations, layouts, assets)],
    layoutCount: layouts.length
  };
}
