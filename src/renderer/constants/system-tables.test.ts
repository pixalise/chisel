import { describe, expect, it } from "vitest";
import { anyDataTableSchema, type DataTableRow, type SystemDataTable } from "../../shared/schemas";
import { ColumnType } from "../../shared/types";
import { INPUT_BINDINGS_TABLE, SYSTEM_INPUT_TABLES, SYSTEM_TABLES } from "./system-tables";

function rowValue(table: SystemDataTable, row: DataTableRow, columnName: string): unknown {
  const column = table.columns.find((entry) => entry.name === columnName);
  expect(column).toBeDefined();
  return row.values.find((entry) => entry.columnId === column?.id)?.value;
}

describe("system tables", () => {
  it("registers only the input bindings system table", () => {
    expect(SYSTEM_TABLES).toEqual([INPUT_BINDINGS_TABLE]);
    expect(SYSTEM_INPUT_TABLES).toEqual([INPUT_BINDINGS_TABLE]);
  });

  it("keeps registered system tables valid", () => {
    for (const table of SYSTEM_TABLES) {
      expect(() => anyDataTableSchema.parse(table)).not.toThrow();
      expect(table.isSystemTable).toBe(true);
      expect(table.columns.length).toBeGreaterThan(0);
    }
  });

  it("seeds input actions from the JSON-driven PVZ runtime defaults", () => {
    const actionNames = INPUT_BINDINGS_TABLE.rows.map((row) => rowValue(INPUT_BINDINGS_TABLE, row, "action"));

    expect(actionNames).toEqual([
      "debug_toggle",
      "quit",
      "camera_zoom_in",
      "camera_zoom_out",
      "camera_pan_left",
      "camera_pan_right",
      "camera_pan_up",
      "camera_pan_down"
    ]);
    expect(rowValue(INPUT_BINDINGS_TABLE, INPUT_BINDINGS_TABLE.rows[2], "bindings")).toEqual(["WheelUp"]);
    expect(rowValue(INPUT_BINDINGS_TABLE, INPUT_BINDINGS_TABLE.rows[4], "bindings")).toEqual(["A", "Left"]);
    expect(INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings")?.type).toBe(ColumnType.enumArray);
  });
});
