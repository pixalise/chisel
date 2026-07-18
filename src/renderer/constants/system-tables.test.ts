import { describe, expect, it } from "vitest";
import { anyDataTableSchema } from "../../shared/schemas";
import { ColumnType, InputKeyEnum } from "../../shared/types";
import { INPUT_BINDINGS_TABLE, SYSTEM_INPUT_TABLES, SYSTEM_TABLES } from "./system-tables";

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

  it("defines the input bindings schema without seed rows", () => {
    expect(INPUT_BINDINGS_TABLE.rows).toEqual([]);
    const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings");

    expect(bindingsColumn?.type).toBe(ColumnType.enumArray);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.KeyW);
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.MouseButtonWheelUp);
  });
});
