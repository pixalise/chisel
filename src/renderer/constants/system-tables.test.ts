import { describe, expect, it } from "vitest";
import { anyDataTableSchema } from "../../shared/schemas";
import { AssetCategoryEnum, ColumnType, InputKeyEnum } from "../../shared/types";
import {
  EDITOR_ONLY_TERRAIN_TABLE_IDS,
  SYSTEM_TERRAIN_TABLES,
  TERRAIN_APPROVED_ASSETS_TABLE_ID,
  TERRAIN_ANNOTATIONS_TABLE_ID,
  TERRAIN_PIECES_TABLE_ID,
  TERRAIN_SITE_TEMPLATES_TABLE_ID,
  TERRAIN_SPATIAL_LAYOUTS_TABLE_ID,
  TERRAIN_TILE_BINDING_COLUMNS,
  VISIBLE_TERRAIN_SYSTEM_TABLE_IDS
} from "../../shared/terrain-tables";
import { INPUT_BINDINGS_TABLE, SYSTEM_INPUT_TABLES, SYSTEM_TABLES } from "./system-tables";

describe("system tables", () => {
  it("registers input and terrain system tables", () => {
    expect(SYSTEM_TABLES).toEqual([INPUT_BINDINGS_TABLE, ...SYSTEM_TERRAIN_TABLES]);
    expect(SYSTEM_INPUT_TABLES).toEqual([INPUT_BINDINGS_TABLE]);
  });

  it("keeps registered system tables valid", () => {
    for (const table of SYSTEM_TABLES) {
      expect(() => anyDataTableSchema.parse(table)).not.toThrow();
      expect(table.isSystemTable).toBe(true);
      expect(table.columns.length).toBeGreaterThan(0);
    }
  });

  it("keeps every terrain authoring table inside Chisel", () => {
    expect(SYSTEM_TERRAIN_TABLES).toHaveLength(9);
    expect(SYSTEM_TERRAIN_TABLES.map((table) => table.id)).toEqual([
      "terrain_tile_bindings",
      "terrain_sockets",
      "terrain_pieces",
      "terrain_piece_sets",
      "terrain_adjacency_overrides",
      "terrain_site_templates",
      "terrain_approved_assets",
      "terrain_annotations",
      "terrain_spatial_layouts"
    ]);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toEqual(new Set(SYSTEM_TERRAIN_TABLES.map((table) => table.id)));
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toContain(TERRAIN_PIECES_TABLE_ID);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toContain(TERRAIN_SITE_TEMPLATES_TABLE_ID);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toContain(TERRAIN_APPROVED_ASSETS_TABLE_ID);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toContain(TERRAIN_ANNOTATIONS_TABLE_ID);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toContain(TERRAIN_SPATIAL_LAYOUTS_TABLE_ID);
    expect(VISIBLE_TERRAIN_SYSTEM_TABLE_IDS).toEqual(
      new Set([TERRAIN_APPROVED_ASSETS_TABLE_ID, TERRAIN_ANNOTATIONS_TABLE_ID, TERRAIN_SPATIAL_LAYOUTS_TABLE_ID])
    );
    expect(TERRAIN_TILE_BINDING_COLUMNS.tileset.assetCategory).toBe(AssetCategoryEnum.tileset);
    expect(TERRAIN_TILE_BINDING_COLUMNS.tags.required).toBe(false);
    expect(Object.keys(TERRAIN_TILE_BINDING_COLUMNS)).not.toContain("blocking");
    expect(Object.keys(TERRAIN_TILE_BINDING_COLUMNS)).not.toContain("wfcSymbol");
  });

  it("defines the input bindings schema without seed rows", () => {
    expect(INPUT_BINDINGS_TABLE.rows).toEqual([]);
    const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings");

    expect(bindingsColumn?.type).toBe(ColumnType.enumArray);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.KeyW);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.MouseButtonWheelUp);
  });
});
