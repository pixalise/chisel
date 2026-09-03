import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "../renderer/constants/system-tables";
import { systemDataTableSchema, type AnyDataTable } from "./schemas";
import { ColumnType, InputKeyEnum } from "./types";
import { renderMonoGameInputExport } from "./monogame-input-export";

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

describe("MonoGame input export", () => {
  it("does not create an input adapter without the system table", () => {
    expect(renderMonoGameInputExport([], "GameData/Generated")).toEqual([]);
  });

  it("exports frame-based keyboard and mouse action queries", () => {
    const table = inputTable([
      { bindings: ["KEY_SPACE", "KEY_ENTER", "MOUSE_BUTTON_LEFT"], slug: "ACTION" },
      { bindings: ["KEY_SHIFT", "KEY_A"], slug: "MOVE_LEFT" },
      { bindings: ["MOUSE_BUTTON_WHEEL_UP"], slug: "ZOOM" }
    ]);

    const [file] = renderMonoGameInputExport([table], "GameData/Generated");

    expect(file.path).toBe("GameData/Generated/ChiselInput.g.cs");
    expect(file.content).toContain("namespace Chisel.Generated");
    expect(file.content).toContain("ChiselInputBindingsId action");
    expect(file.content).toContain("new Keys[] { Keys.Space, Keys.Enter }");
    expect(file.content).toContain("Keys.LeftShift, Keys.RightShift, Keys.A");
    expect(file.content).toContain("new ChiselMouseBinding[] { ChiselMouseBinding.Left }");
    expect(file.content).toContain("_currentMouse.ScrollWheelValue > _previousMouse.ScrollWheelValue");
    expect(file.content).toContain("public bool IsActionJustPressed");
    expect(file.content).toContain("public bool IsActionJustReleased");
    expect(file.content).toContain("Call ChiselInput.Update() once per game update");
  });

  it("supports every binding offered by the Chisel system table", () => {
    const table = inputTable([{ bindings: Object.values(InputKeyEnum), slug: "ALL_BINDINGS" }]);

    expect(() => renderMonoGameInputExport([table], "GameData/Generated")).not.toThrow();
  });

  it("rejects bindings that MonoGame cannot represent", () => {
    const table = inputTable([{ bindings: ["KEY_UNKNOWN"], slug: "BROKEN" }]);

    expect(() => renderMonoGameInputExport([table], "GameData/Generated")).toThrow(
      'Unsupported MonoGame input binding "KEY_UNKNOWN" on action "BROKEN".'
    );
  });
});
