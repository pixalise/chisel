import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { emptyLocalizationDocument } from "./localization";
import { createLove2dExportBundle } from "./love2d-export";
import { assetSchema, dataTableRowSchema, dataTableSchema, type AnyDataTable, type DataTableRow, type Project } from "./schemas";
import {
  TERRAIN_APPROVED_ASSET_COLUMNS,
  TERRAIN_APPROVED_ASSETS_TABLE,
  TERRAIN_ANNOTATION_COLUMNS,
  TERRAIN_ANNOTATIONS_TABLE,
  TERRAIN_SPATIAL_LAYOUT_COLUMNS,
  TERRAIN_SPATIAL_LAYOUTS_TABLE
} from "./terrain-tables";
import { AssetCategoryEnum } from "./types";

function value(column: { id: string; type: DataTableRow["values"][number]["type"] }, entry: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value: entry } as DataTableRow["values"][number];
}

function sourceTables(): AnyDataTable[] {
  const cells = Array.from({ length: 9 }, () => [{ tilesetId: "FOREST_TILES", localId: 0, orientation: 0 }, null]);
  const approvedDefinition = {
    kind: "MAP",
    sourceTemplate: "FOREST_TEMPLATE",
    seed: 42,
    width: 3,
    height: 3,
    layerCount: 2,
    cells,
    cellMetadata: Array.from({ length: 9 }, (_, index) => ({
      blocking: false,
      ...(index === 0 ? { collision: { resolution: 2, cells: [true, false, false, false] } } : {}),
      elevation: 0,
      tags: ["FOREST"],
      piece: "GROUND"
    })),
    cellOverrides: [
      {
        index: 1,
        tiles: [null, { tilesetId: "FOREST_TILES", localId: 1, orientation: 5 }],
        blocking: true,
        elevation: 2,
        tags: ["CLIFF"]
      }
    ],
    placements: [{ piece: "GROUND", x: 0, y: 0, orientation: 0, width: 3, height: 3 }],
    anchors: [{ slug: "ENTRY", kind: "ENTRANCE", x: 0, y: 0, direction: "west", socket: "GROUND" }],
    metrics: { walkableComponents: 99, reachableAnchors: 99, requiredAnchors: 99, distinctPieces: 1 }
  };
  const approvedTable: AnyDataTable = {
    ...TERRAIN_APPROVED_ASSETS_TABLE,
    rows: [
      dataTableRowSchema.parse({
        id: nanoid(),
        slug: "FOREST_SITE",
        values: [
          value(TERRAIN_APPROVED_ASSET_COLUMNS.kind, approvedDefinition.kind),
          value(TERRAIN_APPROVED_ASSET_COLUMNS.sourceTemplate, approvedDefinition.sourceTemplate),
          value(TERRAIN_APPROVED_ASSET_COLUMNS.definition, approvedDefinition)
        ]
      })
    ]
  };
  const annotationsTable: AnyDataTable = {
    ...TERRAIN_ANNOTATIONS_TABLE,
    rows: [
      dataTableRowSchema.parse({
        id: nanoid(),
        slug: "ENTRANCE",
        values: [value(TERRAIN_ANNOTATION_COLUMNS.color, "#22D3EE")]
      }),
      dataTableRowSchema.parse({
        id: nanoid(),
        slug: "QUEST",
        values: [value(TERRAIN_ANNOTATION_COLUMNS.color, "#A78BFA")]
      })
    ]
  };
  const layoutDefinition = {
    sourceAsset: "FOREST_SITE",
    cells: [
      { index: 0, annotations: ["ENTRANCE"] },
      { index: 7, annotations: ["QUEST", "ENTRANCE"] }
    ]
  };
  const layoutsTable: AnyDataTable = {
    ...TERRAIN_SPATIAL_LAYOUTS_TABLE,
    rows: [
      dataTableRowSchema.parse({
        id: nanoid(),
        slug: "FOREST_DRESSING",
        values: [
          value(TERRAIN_SPATIAL_LAYOUT_COLUMNS.sourceAsset, layoutDefinition.sourceAsset),
          value(TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition, layoutDefinition)
        ]
      })
    ]
  };
  return [approvedTable, annotationsTable, layoutsTable];
}

function fixtures() {
  const contentTable = dataTableSchema.parse({
    columns: [],
    description: "World objects",
    id: "world_objects",
    kind: "user",
    lastChangeAt: "2026-01-01T00:00:00.000Z",
    name: "World Objects",
    rows: [{ id: nanoid(), slug: "OAK_CHEST", values: [] }],
    version: 1
  });
  const tileset = assetSchema.parse({
    category: AssetCategoryEnum.tileset,
    extension: "png",
    height: 64,
    id: "FOREST_TILES",
    name: "FOREST_TILES",
    relativePath: ".chisel/assets/TILESET/FOREST_TILES.png",
    sizeBytes: 100,
    tileSize: 32,
    width: 64
  });
  const project: Project = { id: nanoid(), name: "Terrain Test", path: "/tmp/terrain-test" };
  return { contentTable, project, tileset };
}

describe("LÖVE terrain export", () => {
  it("exports resolved approved geography and spatial annotations without raw editor definitions", () => {
    const { contentTable, project, tileset } = fixtures();
    const tables = sourceTables();
    const bundle = createLove2dExportBundle(project, [contentTable], "2026-01-01", [tileset], emptyLocalizationDocument, {
      terrainSourceTables: tables
    });
    const terrain = bundle.files.find((file) => file.path === "gamedata/terrain.lua");
    const manifest = bundle.files.find((file) => file.path === "gamedata/manifest.lua");

    expect(terrain?.content).toContain("FOREST_SITE = 1");
    expect(terrain?.content).toContain("ENTRANCE = 1");
    expect(terrain?.content).toContain("QUEST = 2");
    expect(terrain?.content).toContain("FOREST_DRESSING = 1");
    expect(terrain?.content).toContain('slug = "FOREST_TILES", tile_size = 32, columns = 2, rows = 2');
    expect(terrain?.content).toContain("layer = 2, asset = 1, local_id = 1, orientation = 5");
    expect(terrain?.content).toContain('blocking = true, elevation = 2, tags = { "CLIFF" }');
    expect(terrain?.content).toContain('collision = { resolution = 2, rows = { "10", "00" } }');
    expect(terrain?.content).toContain('slug = "ENTRANCE", color = "#22D3EE"');
    expect(terrain?.content).toContain("cell = 1, x = 0, y = 0, annotations = { 1 }");
    expect(terrain?.content).toContain("cell = 8, x = 1, y = 2, annotations = { 2, 1 }");
    expect(terrain?.content).not.toContain("cellOverrides");
    expect(terrain?.content).not.toContain("cell_overrides");
    expect(manifest?.content).toContain(
      'TERRAIN = { module = "gamedata.terrain", enabled = true, asset_count = 1, annotation_count = 2, layout_count = 1 }'
    );
  });

  it("fails when a cell references an undefined global annotation", () => {
    const { contentTable, project, tileset } = fixtures();
    const tables = sourceTables();
    const layoutsTable = tables.find((table) => table.id === TERRAIN_SPATIAL_LAYOUTS_TABLE.id)!;
    const definition = layoutsTable.rows[0].values.find((entry) => entry.columnId === TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition.id)!;
    if (definition.type !== TERRAIN_SPATIAL_LAYOUT_COLUMNS.definition.type || typeof definition.value !== "object") {
      throw new Error("Invalid test fixture");
    }
    definition.value = { sourceAsset: "FOREST_SITE", cells: [{ index: 0, annotations: ["MISSING"] }] };
    expect(() =>
      createLove2dExportBundle(project, [contentTable], "2026-01-01", [tileset], emptyLocalizationDocument, {
        terrainSourceTables: tables
      })
    ).toThrow('references missing annotation "MISSING"');
  });

  it("fails when resolved geography references a missing managed tileset", () => {
    const { contentTable, project } = fixtures();
    expect(() =>
      createLove2dExportBundle(project, [contentTable], "2026-01-01", [], emptyLocalizationDocument, {
        terrainSourceTables: sourceTables()
      })
    ).toThrow('could not find tileset asset "FOREST_TILES"');
  });
});
