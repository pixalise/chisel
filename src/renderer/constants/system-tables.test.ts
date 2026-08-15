import { describe, expect, it } from "vitest";
import { anyDataTableSchema } from "../../shared/schemas";
import { AssetCategoryEnum, ColumnType, InputKeyEnum } from "../../shared/types";
import {
  EDITOR_ONLY_TERRAIN_TABLE_IDS,
  RUNTIME_TERRAIN_TABLE_IDS,
  SYSTEM_TERRAIN_TABLES,
  TERRAIN_APPROVED_PATCHES_TABLE_ID,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILESETS_TABLE_ID,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID
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

  it("separates internal authoring tables from the two runtime terrain tables", () => {
    expect(SYSTEM_TERRAIN_TABLES.map((table) => table.id)).toContain(TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID);
    expect(SYSTEM_TERRAIN_TABLES).toHaveLength(5);
    expect(EDITOR_ONLY_TERRAIN_TABLE_IDS).toEqual(new Set(["terrain_tile_bindings", "terrain_wfc_samples", "terrain_wfc_sample_cells"]));
    expect(RUNTIME_TERRAIN_TABLE_IDS).toEqual(new Set([TERRAIN_TILESETS_TABLE_ID, TERRAIN_APPROVED_PATCHES_TABLE_ID]));
    expect(TERRAIN_TILE_BINDING_COLUMNS.tileset.assetCategory).toBe(AssetCategoryEnum.tileset);
    expect(TERRAIN_TILE_BINDING_COLUMNS.wfcSymbol.required).toBe(true);
    expect(TERRAIN_TILE_BINDING_COLUMNS.tags.required).toBe(false);
  });

  it("defines the input bindings schema without seed rows", () => {
    expect(INPUT_BINDINGS_TABLE.rows).toEqual([]);
    const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings");

    expect(bindingsColumn?.type).toBe(ColumnType.enumArray);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.KeyW);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.MouseButtonWheelUp);
  });
});
