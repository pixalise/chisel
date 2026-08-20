import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "../renderer/constants/system-tables";
import { systemDataTableSchema, type AnyDataTable } from "./schemas";
import { ColumnType, InputKeyEnum } from "./types";
import { renderLove2dInputExport } from "./love2d-input-export";

function inputTable(actions: Array<{ bindings: string[]; slug: string }>): AnyDataTable {
  const sortOrderColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "sort_order");
  const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings");
  if (!sortOrderColumn || !bindingsColumn) {
    throw new Error("The input bindings system table is missing required columns.");
  }

  return systemDataTableSchema.parse({
    ...INPUT_BINDINGS_TABLE,
    rows: actions.map((action, index) => ({
      id: nanoid(),
      slug: action.slug,
      values: [
        { columnId: sortOrderColumn.id, type: ColumnType.integer, value: index },
        { columnId: bindingsColumn.id, type: ColumnType.enumArray, value: action.bindings }
      ]
    }))
  });
}

describe("LÖVE input export", () => {
  it("does not create an input adapter without the system table", () => {
    expect(renderLove2dInputExport([], "gamedata")).toEqual([]);
  });

  it("exports keyboard, mouse, wheel, and frame-state action queries", () => {
    const table = inputTable([
      { bindings: ["KEY_SPACE", "KEY_ENTER", "MOUSE_BUTTON_LEFT"], slug: "ACTION" },
      { bindings: ["KEY_A", "KEY_LEFT", "KEY_SHIFT"], slug: "MOVE_LEFT" },
      { bindings: ["MOUSE_BUTTON_WHEEL_UP"], slug: "ZOOM" }
    ]);

    const [file] = renderLove2dInputExport([table], "gamedata");

    expect(file.path).toBe("gamedata/input.lua");
    expect(file.content).toContain('local definitions = require("gamedata.tables.input_bindings")');
    expect(file.content).toContain('{ "space", "return", "kpenter" }');
    expect(file.content).toContain('{ "a", "left", "lshift", "rshift" }');
    expect(file.content).toContain("local mouseBindings = { { 1 }");
    expect(file.content).toContain("local wheelBindings = { {  }, {  }, { 1 } }");
    expect(file.content).toContain("function input.isActionJustPressed(action)");
    expect(file.content).toContain("function input.isActionJustReleased(action)");
    expect(file.content).toContain("function input.endFrame()");
    expect(file.content).toContain('error("Invalid Chisel input action: " .. tostring(action), 3)');
  });

  it("supports every binding offered by the Chisel system table", () => {
    const table = inputTable([{ bindings: Object.values(InputKeyEnum), slug: "ALL_BINDINGS" }]);

    expect(() => renderLove2dInputExport([table], "gamedata")).not.toThrow();
  });

  it("rejects bindings that LÖVE cannot represent", () => {
    const table = inputTable([{ bindings: ["KEY_UNKNOWN"], slug: "BROKEN" }]);

    expect(() => renderLove2dInputExport([table], "gamedata")).toThrow('Unsupported LÖVE input binding "KEY_UNKNOWN" on action "BROKEN".');
  });
});
