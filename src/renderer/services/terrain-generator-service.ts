import { nanoid } from "nanoid";
import appStore from "@/stores/app-store";
import assetService from "@/services/asset-service";
import tableService from "@/services/table-service";
import { dataTableRowSchema, type DataColumnDefinition, type DataTableRow, type SystemDataTable } from "../../shared/schemas";
import {
  TERRAIN_ADJACENCY_OVERRIDE_COLUMNS,
  TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID,
  TERRAIN_APPROVED_ASSET_COLUMNS,
  TERRAIN_APPROVED_ASSETS_TABLE_ID,
  TERRAIN_PIECE_COLUMNS,
  TERRAIN_PIECES_TABLE_ID,
  TERRAIN_PIECE_SET_COLUMNS,
  TERRAIN_PIECE_SETS_TABLE_ID,
  TERRAIN_SITE_TEMPLATE_COLUMNS,
  TERRAIN_SITE_TEMPLATES_TABLE_ID,
  TERRAIN_SOCKET_COLUMNS,
  TERRAIN_SOCKETS_TABLE_ID,
  TERRAIN_SPATIAL_LAYOUT_COLUMNS,
  TERRAIN_SPATIAL_LAYOUTS_TABLE_ID,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE_ID
} from "../../shared/terrain-tables";
import {
  terrainAdjacencyOverrideSchema,
  terrainApprovedAssetSchema,
  terrainPieceSchema,
  terrainPieceSetSchema,
  terrainSiteTemplateSchema,
  terrainSocketDefinitionSchema,
  terrainSpatialLayoutSchema,
  terrainTileBindingSchema,
  terrainTileKey,
  type TerrainApprovedAsset,
  type TerrainWorkspaceView
} from "../../shared/terrain-authoring";
import { AssetCategoryEnum } from "../../shared/types";
import { refreshApprovedTerrainMetrics } from "../../shared/terrain-approved-overpaint";
import { assertUniqueTerrainSlugs, duplicateTerrainSlugs } from "../../shared/terrain-slug";

function cell(row: DataTableRow, column: DataColumnDefinition): unknown {
  const stored = row.values.find((entry) => entry.columnId === column.id);
  if (!stored || stored.type !== column.type) throw new Error(`Terrain row '${row.slug}' is missing '${column.name}'`);
  return stored.value;
}

function stringCell(row: DataTableRow, column: DataColumnDefinition): string {
  const value = cell(row, column);
  if (typeof value !== "string") throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function integerCell(row: DataTableRow, column: DataColumnDefinition): number {
  const value = cell(row, column);
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function stringArrayCell(row: DataTableRow, column: DataColumnDefinition): string[] {
  const value = cell(row, column);
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  }
  return value;
}

function rowValue(column: DataColumnDefinition, value: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value } as DataTableRow["values"][number];
}

function row(slug: string, values: DataTableRow["values"], id?: string): DataTableRow {
  return dataTableRowSchema.parse({ id: id ?? nanoid(), slug, values });
}

function idsBySlug(table: SystemDataTable): Map<string, string> {
  return new Map(table.rows.map((entry) => [entry.slug, entry.id]));
}

function parseApprovedAssets(assets: TerrainApprovedAsset[]): TerrainApprovedAsset[] {
  assertUniqueTerrainSlugs(
    "approved asset",
    assets.map((entry) => entry.slug)
  );
  return assets.map((entry) => terrainApprovedAssetSchema.parse(entry));
}

function approvedAssetRows(assets: TerrainApprovedAsset[], table: SystemDataTable): DataTableRow[] {
  const approvedIds = idsBySlug(table);
  return assets.map((entry) => {
    const { slug, ...definition } = entry;
    return row(
      slug,
      [
        rowValue(TERRAIN_APPROVED_ASSET_COLUMNS.kind, entry.kind),
        rowValue(TERRAIN_APPROVED_ASSET_COLUMNS.sourceTemplate, entry.sourceTemplate),
        rowValue(TERRAIN_APPROVED_ASSET_COLUMNS.definition, definition)
      ],
      approvedIds.get(slug)
    );
  });
}

class TerrainGeneratorService {
  private async systemTable(id: string): Promise<SystemDataTable> {
    const table = await tableService.getById(id);
    if (!table || table.kind !== "system") throw new Error(`Terrain system table '${id}' is missing`);
    return table;
  }

  public async load(): Promise<TerrainWorkspaceView> {
    const [assets, bindingsTable, socketsTable, piecesTable, pieceSetsTable, overridesTable, templatesTable, approvedTable, layoutsTable] =
      await Promise.all([
        assetService.getAllAssets(),
        this.systemTable(TERRAIN_TILE_BINDINGS_TABLE_ID),
        this.systemTable(TERRAIN_SOCKETS_TABLE_ID),
        this.systemTable(TERRAIN_PIECES_TABLE_ID),
        this.systemTable(TERRAIN_PIECE_SETS_TABLE_ID),
        this.systemTable(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID),
        this.systemTable(TERRAIN_SITE_TEMPLATES_TABLE_ID),
        this.systemTable(TERRAIN_APPROVED_ASSETS_TABLE_ID),
        this.systemTable(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID)
      ]);
    const projectPath = appStore.getState().computed.project.path;
    const tilesets = assets
      .filter((asset) => asset.category === AssetCategoryEnum.tileset)
      .map((asset) => {
        if (!asset.tileSize) throw new Error(`Tileset asset '${asset.id}' is missing tile size`);
        return {
          id: asset.id,
          name: asset.name,
          tileSize: asset.tileSize,
          tileCount: (asset.width / asset.tileSize) * (asset.height / asset.tileSize),
          columns: asset.width / asset.tileSize,
          rows: asset.height / asset.tileSize,
          imageWidth: asset.width,
          imageHeight: asset.height,
          imagePath: `${projectPath}/${asset.relativePath}`
        };
      });
    const tileBindings = Object.fromEntries(
      bindingsTable.rows.map((entry) => {
        const tileset = stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileset);
        const localId = integerCell(entry, TERRAIN_TILE_BINDING_COLUMNS.localId);
        return [
          terrainTileKey(tileset, localId),
          terrainTileBindingSchema.parse({
            slug: stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileSlug),
            tags: stringArrayCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tags)
          })
        ];
      })
    );
    const sockets = socketsTable.rows.map((entry) =>
      terrainSocketDefinitionSchema.parse({
        slug: entry.slug,
        color: stringCell(entry, TERRAIN_SOCKET_COLUMNS.color),
        description: stringCell(entry, TERRAIN_SOCKET_COLUMNS.description)
      })
    );
    const pieces = piecesTable.rows.map((entry) =>
      terrainPieceSchema.parse({ ...(cell(entry, TERRAIN_PIECE_COLUMNS.definition) as object), slug: entry.slug })
    );
    const pieceSets = pieceSetsTable.rows.map((entry) =>
      terrainPieceSetSchema.parse({ ...(cell(entry, TERRAIN_PIECE_SET_COLUMNS.definition) as object), slug: entry.slug })
    );
    const adjacencyOverrides = overridesTable.rows.map((entry) =>
      terrainAdjacencyOverrideSchema.parse({
        slug: entry.slug,
        sourcePiece: stringCell(entry, TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.sourcePiece),
        direction: stringCell(entry, TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.direction),
        targetPiece: stringCell(entry, TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.targetPiece),
        mode: stringCell(entry, TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.mode)
      })
    );
    const templates = templatesTable.rows.map((entry) =>
      terrainSiteTemplateSchema.parse({ ...(cell(entry, TERRAIN_SITE_TEMPLATE_COLUMNS.definition) as object), slug: entry.slug })
    );
    const approvedAssets = approvedTable.rows.map((entry) =>
      refreshApprovedTerrainMetrics(
        terrainApprovedAssetSchema.parse({ ...(cell(entry, TERRAIN_APPROVED_ASSET_COLUMNS.definition) as object), slug: entry.slug })
      )
    );
    const spatialLayouts = layoutsTable.rows.map((entry) =>
      terrainSpatialLayoutSchema.parse({ ...(cell(entry, TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition) as object), slug: entry.slug })
    );
    const problems: string[] = [];
    for (const duplicate of duplicateTerrainSlugs(Object.values(tileBindings).map((entry) => entry.slug))) {
      problems.push(`Sprite metadata slug '${duplicate}' is duplicated`);
    }
    for (const [kind, slugs] of [
      ["Socket", sockets.map((entry) => entry.slug)],
      ["Piece", pieces.map((entry) => entry.slug)],
      ["Collection", pieceSets.map((entry) => entry.slug)],
      ["Adjacency override", adjacencyOverrides.map((entry) => entry.slug)],
      ["Template", templates.map((entry) => entry.slug)],
      ["Approved asset", approvedAssets.map((entry) => entry.slug)],
      ["Spatial layout", spatialLayouts.map((entry) => entry.slug)]
    ] as const) {
      for (const duplicate of duplicateTerrainSlugs(slugs)) problems.push(`${kind} slug '${duplicate}' is duplicated`);
    }
    for (const layout of spatialLayouts) {
      for (const [kind, slugs] of [
        ["zone", layout.zones.map((entry) => entry.slug)],
        ["marker", layout.markers.map((entry) => entry.slug)],
        ["placement", layout.placements.map((entry) => entry.slug)]
      ] as const) {
        for (const duplicate of duplicateTerrainSlugs(slugs)) {
          problems.push(`Spatial layout '${layout.slug}' ${kind} slug '${duplicate}' is duplicated`);
        }
      }
    }
    const socketSlugs = new Set(sockets.map((entry) => entry.slug));
    const pieceSlugs = new Set(pieces.map((entry) => entry.slug));
    const approvedBySlug = new Map(approvedAssets.map((entry) => [entry.slug, entry]));
    const setSlugs = new Set(pieceSets.map((entry) => entry.slug));
    const setsBySlug = new Map(pieceSets.map((entry) => [entry.slug, entry]));
    for (const [key, binding] of Object.entries(tileBindings)) {
      const separator = key.lastIndexOf(":");
      const tileset = tilesets.find((entry) => entry.id === key.slice(0, separator));
      if (!tileset || Number(key.slice(separator + 1)) >= tileset.tileCount) problems.push(`Sprite metadata '${binding.slug}' is orphaned`);
    }
    for (const piece of pieces) {
      for (const direction of ["north", "east", "south", "west"] as const) {
        for (const socket of piece.sockets[direction]) {
          if (!socketSlugs.has(socket)) {
            problems.push(`Piece '${piece.slug}' references missing socket '${socket}'`);
          }
        }
      }
      for (const pieceCell of piece.cells) {
        for (const tile of pieceCell.tiles) {
          if (tile && !tileBindings[terrainTileKey(tile.tilesetId, tile.localId)]) {
            problems.push(`Piece '${piece.slug}' uses sprite '${tile.tilesetId}:${tile.localId}' without metadata`);
          }
        }
      }
    }
    for (const pieceSet of pieceSets) {
      for (const piece of pieceSet.pieceSlugs)
        if (!pieceSlugs.has(piece)) problems.push(`Collection '${pieceSet.slug}' references missing piece '${piece}'`);
      for (const weightedPiece of Object.keys(pieceSet.pieceWeights)) {
        if (!pieceSet.pieceSlugs.includes(weightedPiece)) {
          problems.push(`Collection '${pieceSet.slug}' has a weight for inactive piece '${weightedPiece}'`);
        }
      }
    }
    for (const override of adjacencyOverrides) {
      if (!pieceSlugs.has(override.sourcePiece) || !pieceSlugs.has(override.targetPiece)) {
        problems.push(`Adjacency override '${override.slug}' references a missing piece`);
      }
    }
    for (const template of templates) {
      if (!setSlugs.has(template.pieceSet))
        problems.push(`Template '${template.slug}' references missing collection '${template.pieceSet}'`);
      for (const anchor of template.anchors) {
        if (!socketSlugs.has(anchor.socket))
          problems.push(`Template '${template.slug}' anchor '${anchor.slug}' uses missing socket '${anchor.socket}'`);
      }
      const pieceSet = setsBySlug.get(template.pieceSet);
      for (const stamp of template.stamps) {
        if (!pieceSlugs.has(stamp.piece)) problems.push(`Template '${template.slug}' stamp references missing piece '${stamp.piece}'`);
        else if (pieceSet && !pieceSet.pieceSlugs.includes(stamp.piece)) {
          problems.push(`Template '${template.slug}' stamp piece '${stamp.piece}' is not in collection '${pieceSet.slug}'`);
        }
      }
    }
    for (const layout of spatialLayouts) {
      const asset = approvedBySlug.get(layout.sourceAsset);
      if (!asset) {
        problems.push(`Spatial layout '${layout.slug}' references missing approved asset '${layout.sourceAsset}'`);
        continue;
      }
      for (const zone of layout.zones) {
        if (zone.cells.some((index) => index >= asset.width * asset.height)) {
          problems.push(`Spatial layout '${layout.slug}' zone '${zone.slug}' extends outside '${asset.slug}'`);
        }
      }
      for (const marker of layout.markers) {
        if (marker.x >= asset.width || marker.y >= asset.height) {
          problems.push(`Spatial layout '${layout.slug}' marker '${marker.slug}' extends outside '${asset.slug}'`);
        }
      }
      for (const placement of layout.placements) {
        if (placement.x + placement.width > asset.width || placement.y + placement.height > asset.height) {
          problems.push(`Spatial layout '${layout.slug}' placement '${placement.slug}' extends outside '${asset.slug}'`);
        }
      }
    }
    return { tilesets, tileBindings, sockets, pieces, pieceSets, adjacencyOverrides, templates, approvedAssets, spatialLayouts, problems };
  }

  public async save(workspace: TerrainWorkspaceView): Promise<TerrainWorkspaceView> {
    assertUniqueTerrainSlugs(
      "sprite metadata",
      Object.values(workspace.tileBindings).map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "socket",
      workspace.sockets.map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "piece",
      workspace.pieces.map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "collection",
      workspace.pieceSets.map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "adjacency override",
      workspace.adjacencyOverrides.map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "template",
      workspace.templates.map((entry) => entry.slug)
    );
    assertUniqueTerrainSlugs(
      "spatial layout",
      workspace.spatialLayouts.map((entry) => entry.slug)
    );
    for (const layout of workspace.spatialLayouts) {
      assertUniqueTerrainSlugs(
        `zone in '${layout.slug}'`,
        layout.zones.map((entry) => entry.slug)
      );
      assertUniqueTerrainSlugs(
        `marker in '${layout.slug}'`,
        layout.markers.map((entry) => entry.slug)
      );
      assertUniqueTerrainSlugs(
        `placement in '${layout.slug}'`,
        layout.placements.map((entry) => entry.slug)
      );
    }
    const sockets = workspace.sockets.map((entry) => terrainSocketDefinitionSchema.parse(entry));
    const pieces = workspace.pieces.map((entry) => terrainPieceSchema.parse(entry));
    const pieceSets = workspace.pieceSets.map((entry) => terrainPieceSetSchema.parse(entry));
    const overrides = workspace.adjacencyOverrides.map((entry) => terrainAdjacencyOverrideSchema.parse(entry));
    const templates = workspace.templates.map((entry) => terrainSiteTemplateSchema.parse(entry));
    const approvedAssets = parseApprovedAssets(workspace.approvedAssets);
    const spatialLayouts = workspace.spatialLayouts.map((entry) => terrainSpatialLayoutSchema.parse(entry));
    const [bindingsTable, socketsTable, piecesTable, pieceSetsTable, overridesTable, templatesTable, approvedTable, layoutsTable] =
      await Promise.all([
        this.systemTable(TERRAIN_TILE_BINDINGS_TABLE_ID),
        this.systemTable(TERRAIN_SOCKETS_TABLE_ID),
        this.systemTable(TERRAIN_PIECES_TABLE_ID),
        this.systemTable(TERRAIN_PIECE_SETS_TABLE_ID),
        this.systemTable(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID),
        this.systemTable(TERRAIN_SITE_TEMPLATES_TABLE_ID),
        this.systemTable(TERRAIN_APPROVED_ASSETS_TABLE_ID),
        this.systemTable(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID)
      ]);
    const bindingIds = idsBySlug(bindingsTable);
    const bindingRows = Object.entries(workspace.tileBindings).map(([key, binding]) => {
      const separator = key.lastIndexOf(":");
      const parsed = terrainTileBindingSchema.parse(binding);
      return row(
        parsed.slug,
        [
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileset, key.slice(0, separator)),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.localId, Number(key.slice(separator + 1))),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileSlug, parsed.slug),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tags, parsed.tags)
        ],
        bindingIds.get(parsed.slug)
      );
    });
    const socketIds = idsBySlug(socketsTable);
    const socketRows = sockets.map((entry) =>
      row(
        entry.slug,
        [rowValue(TERRAIN_SOCKET_COLUMNS.color, entry.color), rowValue(TERRAIN_SOCKET_COLUMNS.description, entry.description)],
        socketIds.get(entry.slug)
      )
    );
    const pieceIds = idsBySlug(piecesTable);
    const pieceRows = pieces.map((entry) => {
      const { slug, ...definition } = entry;
      return row(
        slug,
        [
          rowValue(TERRAIN_PIECE_COLUMNS.width, entry.width),
          rowValue(TERRAIN_PIECE_COLUMNS.height, entry.height),
          rowValue(TERRAIN_PIECE_COLUMNS.definition, definition)
        ],
        pieceIds.get(slug)
      );
    });
    const setIds = idsBySlug(pieceSetsTable);
    const setRows = pieceSets.map((entry) => {
      const { slug, ...definition } = entry;
      return row(slug, [rowValue(TERRAIN_PIECE_SET_COLUMNS.definition, definition)], setIds.get(slug));
    });
    const overrideIds = idsBySlug(overridesTable);
    const overrideRows = overrides.map((entry) =>
      row(
        entry.slug,
        [
          rowValue(TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.sourcePiece, entry.sourcePiece),
          rowValue(TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.direction, entry.direction),
          rowValue(TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.targetPiece, entry.targetPiece),
          rowValue(TERRAIN_ADJACENCY_OVERRIDE_COLUMNS.mode, entry.mode)
        ],
        overrideIds.get(entry.slug)
      )
    );
    const templateIds = idsBySlug(templatesTable);
    const templateRows = templates.map((entry) => {
      const { slug, ...definition } = entry;
      return row(
        slug,
        [
          rowValue(TERRAIN_SITE_TEMPLATE_COLUMNS.width, entry.width),
          rowValue(TERRAIN_SITE_TEMPLATE_COLUMNS.height, entry.height),
          rowValue(TERRAIN_SITE_TEMPLATE_COLUMNS.definition, definition)
        ],
        templateIds.get(slug)
      );
    });
    const approvedRows = approvedAssetRows(approvedAssets, approvedTable);
    const layoutIds = idsBySlug(layoutsTable);
    const layoutRows = spatialLayouts.map((entry) => {
      const { slug, ...definition } = entry;
      return row(
        slug,
        [
          rowValue(TERRAIN_SPATIAL_LAYOUT_COLUMNS.sourceAsset, entry.sourceAsset),
          rowValue(TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition, definition)
        ],
        layoutIds.get(slug)
      );
    });
    await tableService.saveSystemTableRows(TERRAIN_TILE_BINDINGS_TABLE_ID, bindingRows);
    await tableService.saveSystemTableRows(TERRAIN_SOCKETS_TABLE_ID, socketRows);
    await tableService.saveSystemTableRows(TERRAIN_PIECES_TABLE_ID, pieceRows);
    await tableService.saveSystemTableRows(TERRAIN_PIECE_SETS_TABLE_ID, setRows);
    await tableService.saveSystemTableRows(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID, overrideRows);
    await tableService.saveSystemTableRows(TERRAIN_SITE_TEMPLATES_TABLE_ID, templateRows);
    await tableService.saveSystemTableRows(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID, layoutRows);
    await tableService.saveSystemTableRows(TERRAIN_APPROVED_ASSETS_TABLE_ID, approvedRows);
    return this.load();
  }

  public async addApprovedAsset(existingAssets: TerrainApprovedAsset[], asset: TerrainApprovedAsset): Promise<TerrainApprovedAsset[]> {
    const approvedAssets = parseApprovedAssets([...existingAssets, asset]);
    const approvedTable = await this.systemTable(TERRAIN_APPROVED_ASSETS_TABLE_ID);
    await tableService.saveSystemTableRows(TERRAIN_APPROVED_ASSETS_TABLE_ID, approvedAssetRows(approvedAssets, approvedTable));
    return approvedAssets;
  }
}

const terrainGeneratorService = new TerrainGeneratorService();
export default terrainGeneratorService;
