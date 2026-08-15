import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDataTable, Asset, DataTableRow } from "../../shared/schemas";
import type { TerrainApprovedAsset, TerrainPiece } from "../../shared/terrain-authoring";
import {
  TERRAIN_APPROVED_ASSET_COLUMNS,
  TERRAIN_APPROVED_ASSETS_TABLE,
  TERRAIN_PIECE_COLUMNS,
  TERRAIN_PIECES_TABLE,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE
} from "../../shared/terrain-tables";
import { AssetCategoryEnum, ColumnType } from "../../shared/types";

const mocks = vi.hoisted(() => ({
  deleteProjectFile: vi.fn(),
  saveSystemTableRows: vi.fn(),
  tables: [] as AnyDataTable[],
  tryReadAssetsJson: vi.fn(),
  writeAssetsJson: vi.fn()
}));

vi.mock("@/services/file-service", () => ({
  default: {
    deleteProjectFile: mocks.deleteProjectFile,
    tryReadAssetsJson: mocks.tryReadAssetsJson,
    writeAssetsJson: mocks.writeAssetsJson
  }
}));

vi.mock("@/services/table-service", () => ({
  default: {
    listAllTables: vi.fn(async () => mocks.tables),
    saveSystemTableRows: mocks.saveSystemTableRows
  }
}));

vi.mock("@/stores/app-store", () => ({
  default: {
    getState: () => ({ computed: { project: { id: "PROJECT", name: "Project", path: "/tmp/project" } } })
  }
}));

const { default: assetService } = await import("./asset-service");

const tileset: Asset = {
  category: AssetCategoryEnum.tileset,
  extension: "png",
  formattedBytes: "1 B",
  height: 64,
  id: "TERRAIN",
  name: "TERRAIN",
  relativePath: ".chisel/assets/TILESET/TERRAIN.png",
  sizeBytes: 1,
  tileSize: 64,
  width: 64
};

const piece: TerrainPiece = {
  slug: "GROUND_MODULE",
  width: 1,
  height: 1,
  layerCount: 1,
  cells: [
    {
      tiles: [{ tilesetId: "TERRAIN", localId: 0, orientation: 0 }],
      blocking: false,
      elevation: 0,
      semanticFlags: []
    }
  ],
  sockets: { north: ["GROUND"], east: ["GROUND"], south: ["GROUND"], west: ["GROUND"] },
  allowRotations: false,
  allowReflections: false,
  weight: 1,
  biomeTags: [],
  siteTags: [],
  semanticFlags: [],
  mutationFamily: ""
};

const approved: TerrainApprovedAsset = {
  slug: "FOREST_SITE",
  kind: "MAP",
  sourceTemplate: "FOREST",
  seed: 7,
  width: 3,
  height: 3,
  layerCount: 1,
  cells: Array.from({ length: 9 }, () => [{ tilesetId: "TERRAIN", localId: 0, orientation: 0 }]),
  cellMetadata: Array.from({ length: 9 }, () => ({ blocking: false, elevation: 0, tags: [], piece: "GROUND_MODULE" })),
  placements: [],
  anchors: [],
  metrics: { walkableComponents: 1, reachableAnchors: 0, requiredAnchors: 0, distinctPieces: 1 }
};

function tableRow(slug: string, values: DataTableRow["values"]): DataTableRow {
  return { id: `${slug}_ROW_ID_000000000`, slug, values };
}

function value(column: { id: string; type: ColumnType }, cell: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value: cell } as DataTableRow["values"][number];
}

function terrainTables(options: { approved?: boolean; piece?: boolean }): AnyDataTable[] {
  const binding = tableRow("GROUND", [
    value(TERRAIN_TILE_BINDING_COLUMNS.tileset, "TERRAIN"),
    value(TERRAIN_TILE_BINDING_COLUMNS.localId, 0),
    value(TERRAIN_TILE_BINDING_COLUMNS.tileSlug, "GROUND"),
    value(TERRAIN_TILE_BINDING_COLUMNS.tags, [])
  ]);
  const pieceRow = tableRow(piece.slug, [
    value(TERRAIN_PIECE_COLUMNS.width, piece.width),
    value(TERRAIN_PIECE_COLUMNS.height, piece.height),
    value(TERRAIN_PIECE_COLUMNS.definition, piece)
  ]);
  const approvedRow = tableRow(approved.slug, [
    value(TERRAIN_APPROVED_ASSET_COLUMNS.kind, approved.kind),
    value(TERRAIN_APPROVED_ASSET_COLUMNS.sourceTemplate, approved.sourceTemplate),
    value(TERRAIN_APPROVED_ASSET_COLUMNS.definition, approved)
  ]);
  return [
    { ...TERRAIN_TILE_BINDINGS_TABLE, rows: [binding] },
    { ...TERRAIN_PIECES_TABLE, rows: options.piece ? [pieceRow] : [] },
    { ...TERRAIN_APPROVED_ASSETS_TABLE, rows: options.approved ? [approvedRow] : [] }
  ];
}

describe("tileset asset deletion", () => {
  beforeEach(() => {
    mocks.deleteProjectFile.mockReset();
    mocks.saveSystemTableRows.mockReset();
    mocks.tryReadAssetsJson.mockReset();
    mocks.writeAssetsJson.mockReset();
    mocks.tryReadAssetsJson.mockResolvedValue({ schemaVersion: 1, assets: [tileset] });
  });

  it("refuses a tileset used by an authored piece before mutating anything", async () => {
    mocks.tables = terrainTables({ piece: true });

    await expect(assetService.removeAsset("TERRAIN")).rejects.toThrow("terrain piece GROUND_MODULE");
    expect(mocks.saveSystemTableRows).not.toHaveBeenCalled();
    expect(mocks.deleteProjectFile).not.toHaveBeenCalled();
  });

  it("refuses a tileset used by a frozen terrain asset before mutating anything", async () => {
    mocks.tables = terrainTables({ approved: true });

    await expect(assetService.removeAsset("TERRAIN")).rejects.toThrow("approved terrain asset FOREST_SITE");
    expect(mocks.saveSystemTableRows).not.toHaveBeenCalled();
    expect(mocks.deleteProjectFile).not.toHaveBeenCalled();
  });

  it("removes unused tile bindings before deleting the asset", async () => {
    mocks.tables = terrainTables({});

    await assetService.removeAsset("TERRAIN");

    expect(mocks.saveSystemTableRows).toHaveBeenCalledTimes(1);
    expect(mocks.saveSystemTableRows).toHaveBeenCalledWith("terrain_tile_bindings", []);
    expect(mocks.deleteProjectFile).toHaveBeenCalledWith(expect.anything(), tileset.relativePath);
    expect(mocks.writeAssetsJson).toHaveBeenCalledWith(expect.anything(), { schemaVersion: 1, assets: [] });
  });
});
