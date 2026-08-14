import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDataTable, Asset, DataTableRow } from "../../shared/schemas";
import {
  TERRAIN_BIOME_PROFILE_COLUMNS,
  TERRAIN_BIOME_PROFILES_TABLE,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE,
  TERRAIN_WFC_SAMPLE_CELL_COLUMNS,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE,
  TERRAIN_WFC_SAMPLES_TABLE
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

function tableRow(slug: string, values: DataTableRow["values"]): DataTableRow {
  return { id: `${slug}_ROW_ID_000000000`, slug, values };
}

function value(column: { id: string; type: ColumnType }, cell: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value: cell } as DataTableRow["values"][number];
}

function terrainTables(withProfile: boolean): AnyDataTable[] {
  const sample = tableRow("EDGE", []);
  const cell = tableRow("CELL", [
    value(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample, "EDGE"),
    value(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.x, 0),
    value(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.y, 0),
    value(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.tileset, "TERRAIN"),
    value(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.localId, 0)
  ]);
  const binding = tableRow("GROUND", [
    value(TERRAIN_TILE_BINDING_COLUMNS.tileset, "TERRAIN"),
    value(TERRAIN_TILE_BINDING_COLUMNS.localId, 0),
    value(TERRAIN_TILE_BINDING_COLUMNS.tileSlug, "GROUND"),
    value(TERRAIN_TILE_BINDING_COLUMNS.role, "GROUND"),
    value(TERRAIN_TILE_BINDING_COLUMNS.blocking, false),
    value(TERRAIN_TILE_BINDING_COLUMNS.tags, [])
  ]);
  const profile = tableRow("FOREST_EDGE", [
    value(TERRAIN_BIOME_PROFILE_COLUMNS.biome, "FOREST"),
    value(TERRAIN_BIOME_PROFILE_COLUMNS.sample, "EDGE"),
    value(TERRAIN_BIOME_PROFILE_COLUMNS.weight, 1)
  ]);
  return [
    { ...TERRAIN_TILE_BINDINGS_TABLE, rows: [binding] },
    { ...TERRAIN_WFC_SAMPLES_TABLE, rows: [sample] },
    { ...TERRAIN_WFC_SAMPLE_CELLS_TABLE, rows: [cell] },
    { ...TERRAIN_BIOME_PROFILES_TABLE, rows: withProfile ? [profile] : [] }
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

  it("refuses a tileset reached by a biome before mutating anything", async () => {
    mocks.tables = terrainTables(true);

    await expect(assetService.removeAsset("TERRAIN")).rejects.toThrow("biome profile FOREST_EDGE through sample EDGE");
    expect(mocks.saveSystemTableRows).not.toHaveBeenCalled();
    expect(mocks.deleteProjectFile).not.toHaveBeenCalled();
  });

  it("removes unprofiled samples, cells, and bindings before deleting the asset", async () => {
    mocks.tables = terrainTables(false);

    await assetService.removeAsset("TERRAIN");

    expect(mocks.saveSystemTableRows).toHaveBeenCalledTimes(3);
    expect(mocks.saveSystemTableRows.mock.calls.map((call) => call[0])).toEqual([
      "terrain_wfc_sample_cells",
      "terrain_wfc_samples",
      "terrain_tile_bindings"
    ]);
    expect(mocks.deleteProjectFile).toHaveBeenCalledWith(expect.anything(), tileset.relativePath);
    expect(mocks.writeAssetsJson).toHaveBeenCalledWith(expect.anything(), { schemaVersion: 1, assets: [] });
  });
});
