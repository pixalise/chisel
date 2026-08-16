import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { emptyLocalizationDocument } from "./localization";
import { createLove2dExportBundle } from "./love2d-export";
import { assetSchema, dataTableRowSchema, dataTableSchema, type AnyDataTable, type DataTableRow, type Project } from "./schemas";
import {
  TERRAIN_APPROVED_ASSET_COLUMNS,
  TERRAIN_APPROVED_ASSETS_TABLE,
  TERRAIN_SPATIAL_LAYOUT_COLUMNS,
  TERRAIN_SPATIAL_LAYOUTS_TABLE
} from "./terrain-tables";
import { AssetCategoryEnum } from "./types";

function value(column: { id: string; type: DataTableRow["values"][number]["type"] }, entry: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value: entry } as DataTableRow["values"][number];
}

function sourceTables(contentTable: AnyDataTable, fixedContentSlug = "OAK_CHEST"): AnyDataTable[] {
  const cells = Array.from({ length: 9 }, () => [{ tilesetId: "FOREST_TILES", localId: 0, orientation: 0 }, null]);
  const approvedDefinition = {
    kind: "MAP",
    sourceTemplate: "FOREST_TEMPLATE",
    seed: 42,
    width: 3,
    height: 3,
    layerCount: 2,
    cells,
    cellMetadata: Array.from({ length: 9 }, () => ({ blocking: false, elevation: 0, tags: ["FOREST"], piece: "GROUND" })),
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
  const layoutDefinition = {
    sourceAsset: "FOREST_SITE",
    zones: [{ slug: "INTERIOR", kind: "PLACEMENT", cells: [0, 1], tags: ["LOOT_ALLOWED"], ruleSet: "FOREST_LOOT" }],
    markers: [{ slug: "QUEST", kind: "POI", x: 1, y: 2, radius: 2, direction: "north", tags: ["QUEST_ALLOWED"] }],
    placements: [
      {
        slug: "CHEST",
        mode: "FIXED",
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        orientation: 0,
        contentTable: contentTable.id,
        contentSlug: fixedContentSlug,
        ruleSet: "",
        tags: ["GUARANTEED"]
      },
      {
        slug: "CURIOSITY",
        mode: "RULE",
        x: 2,
        y: 2,
        width: 1,
        height: 1,
        orientation: 0,
        contentTable: "",
        contentSlug: "",
        ruleSet: "FOREST_CURIOSITIES",
        tags: ["OPTIONAL"]
      }
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
  return [contentTable, approvedTable, layoutsTable];
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
    const tables = sourceTables(contentTable);
    const bundle = createLove2dExportBundle(project, [contentTable], "2026-01-01", [tileset], emptyLocalizationDocument, {
      terrainSourceTables: tables
    });
    const terrain = bundle.files.find((file) => file.path === "gamedata/terrain.lua");
    const manifest = bundle.files.find((file) => file.path === "gamedata/manifest.lua");

    expect(terrain?.content).toContain("FOREST_SITE = 1");
    expect(terrain?.content).toContain("FOREST_DRESSING = 1");
    expect(terrain?.content).toContain('slug = "FOREST_TILES", tile_size = 32, columns = 2, rows = 2');
    expect(terrain?.content).toContain("layer = 2, asset = 1, local_id = 1, orientation = 5");
    expect(terrain?.content).toContain('blocking = true, elevation = 2, tags = { "CLIFF" }');
    expect(terrain?.content).toContain('cells = { 1, 2 }, tags = { "LOOT_ALLOWED" }');
    expect(terrain?.content).toContain('content_table = "world_objects", content_id = 1, content_slug = "OAK_CHEST"');
    expect(terrain?.content).toContain('content_id = 0, content_slug = "", rule_set = "FOREST_CURIOSITIES"');
    expect(terrain?.content).not.toContain("cellOverrides");
    expect(terrain?.content).not.toContain("cell_overrides");
    expect(manifest?.content).toContain('TERRAIN = { module = "gamedata.terrain", enabled = true, asset_count = 1, layout_count = 1 }');
  });

  it("fails when a fixed placement does not resolve to an exported content row", () => {
    const { contentTable, project, tileset } = fixtures();
    expect(() =>
      createLove2dExportBundle(project, [contentTable], "2026-01-01", [tileset], emptyLocalizationDocument, {
        terrainSourceTables: sourceTables(contentTable, "MISSING_CHEST")
      })
    ).toThrow('targets missing row "MISSING_CHEST" in table "world_objects"');
  });

  it("fails when resolved geography references a missing managed tileset", () => {
    const { contentTable, project } = fixtures();
    expect(() =>
      createLove2dExportBundle(project, [contentTable], "2026-01-01", [], emptyLocalizationDocument, {
        terrainSourceTables: sourceTables(contentTable)
      })
    ).toThrow('could not find tileset asset "FOREST_TILES"');
  });
});
