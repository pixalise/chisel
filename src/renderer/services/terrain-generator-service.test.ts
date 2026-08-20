import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SystemDataTable } from "../../shared/schemas";
import {
  SYSTEM_TERRAIN_TABLES,
  TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID,
  TERRAIN_APPROVED_ASSETS_TABLE_ID,
  TERRAIN_PIECES_TABLE_ID,
  TERRAIN_SITE_TEMPLATES_TABLE_ID,
  TERRAIN_SPATIAL_LAYOUTS_TABLE_ID
} from "../../shared/terrain-tables";
import type { TerrainWorkspaceView } from "../../shared/terrain-authoring";

const mocks = vi.hoisted(() => ({
  saveOrder: [] as string[],
  tables: new Map<string, SystemDataTable>()
}));

vi.mock("@/services/asset-service", () => ({
  default: { getAllAssets: vi.fn(async () => []) }
}));

vi.mock("@/services/table-service", () => ({
  default: {
    getById: vi.fn(async (id: string) => mocks.tables.get(id)),
    saveSystemTableRows: vi.fn(async (id: string, rows: SystemDataTable["rows"]) => {
      if (id === TERRAIN_PIECES_TABLE_ID && mocks.tables.get(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID)?.rows.length) {
        throw new Error("piece is still referenced by an adjacency override");
      }
      if (id === TERRAIN_APPROVED_ASSETS_TABLE_ID && mocks.tables.get(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID)?.rows.length) {
        throw new Error("approved asset is still referenced by a spatial layout");
      }
      if (id === TERRAIN_SITE_TEMPLATES_TABLE_ID && mocks.tables.get(TERRAIN_APPROVED_ASSETS_TABLE_ID)?.rows.length) {
        throw new Error("template is still referenced by an approved asset");
      }
      const table = mocks.tables.get(id);
      if (!table) throw new Error(`Missing test table ${id}`);
      const saved = { ...table, rows };
      mocks.tables.set(id, saved);
      mocks.saveOrder.push(id);
      return saved;
    })
  }
}));

vi.mock("@/stores/app-store", () => ({
  default: {
    getState: () => ({ computed: { project: { id: "PROJECT", name: "Project", path: "/tmp/project" } } })
  }
}));

const { default: terrainGeneratorService } = await import("./terrain-generator-service");

const emptyWorkspace: TerrainWorkspaceView = {
  adjacencyOverrides: [],
  annotations: [],
  approvedAssets: [],
  pieceSets: [],
  pieces: [],
  problems: [],
  sockets: [],
  spatialLayouts: [],
  templates: [],
  tileBindings: {},
  tilesets: []
};

function referencedRow(slug: string): SystemDataTable["rows"][number] {
  return { id: `${slug}_ROW_00000000000`, slug, values: [] };
}

describe("terrain workspace persistence", () => {
  beforeEach(() => {
    mocks.saveOrder.length = 0;
    mocks.tables = new Map<string, SystemDataTable>(
      SYSTEM_TERRAIN_TABLES.map((table): [string, SystemDataTable] => [table.id, { ...table, rows: [] }])
    );
    mocks.tables.get(TERRAIN_PIECES_TABLE_ID)!.rows = [referencedRow("COAST_TOP_LEFT")];
    mocks.tables.get(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID)!.rows = [referencedRow("ADJACENCY_2")];
    mocks.tables.get(TERRAIN_SITE_TEMPLATES_TABLE_ID)!.rows = [referencedRow("COAST_TEMPLATE")];
    mocks.tables.get(TERRAIN_APPROVED_ASSETS_TABLE_ID)!.rows = [referencedRow("COAST_MAP")];
    mocks.tables.get(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID)!.rows = [referencedRow("COAST_MAP_ANNOTATIONS")];
  });

  it("removes dependent rows before deleting their referenced terrain rows", async () => {
    await expect(terrainGeneratorService.save(emptyWorkspace)).resolves.toMatchObject(emptyWorkspace);

    expect(mocks.saveOrder.indexOf(TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID)).toBeLessThan(mocks.saveOrder.indexOf(TERRAIN_PIECES_TABLE_ID));
    expect(mocks.saveOrder.indexOf(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID)).toBeLessThan(
      mocks.saveOrder.indexOf(TERRAIN_APPROVED_ASSETS_TABLE_ID)
    );
    expect(mocks.saveOrder.indexOf(TERRAIN_APPROVED_ASSETS_TABLE_ID)).toBeLessThan(
      mocks.saveOrder.indexOf(TERRAIN_SITE_TEMPLATES_TABLE_ID)
    );
  });
});
