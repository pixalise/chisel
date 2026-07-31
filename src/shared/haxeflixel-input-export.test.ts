import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "../renderer/constants/system-tables";
import { systemDataTableSchema, type AnyDataTable } from "./schemas";
import { ColumnType, InputKeyEnum } from "./types";
import { renderHaxeFlixelInputExport } from "./haxeflixel-input-export";

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

describe("HaxeFlixel input export", () => {
  it("does not create an input adapter without the system table", () => {
    expect(renderHaxeFlixelInputExport([], "source/gamedata")).toEqual([]);
  });

  it("exports typed keyboard and mouse action queries", () => {
    const table = inputTable([
      { bindings: ["KEY_SPACE", "KEY_ENTER", "MOUSE_BUTTON_LEFT"], slug: "ACTION" },
      { bindings: ["KEY_A", "KEY_LEFT"], slug: "MOVE_LEFT" },
      { bindings: ["MOUSE_BUTTON_WHEEL_UP"], slug: "ZOOM" }
    ]);

    const [file] = renderHaxeFlixelInputExport([table], "source/gamedata");

    expect(file.path).toBe("source/gamedata/ChiselInput.hx");
    expect(file.content).toContain("package gamedata;");
    expect(file.content).toContain("ChiselInputBindings.ChiselInputBindingsId");
    expect(file.content).toContain("[FlxKey.SPACE, FlxKey.ENTER]");
    expect(file.content).toContain("[FlxKey.A, FlxKey.LEFT]");
    expect(file.content).toContain("[ChiselMouseBinding.LEFT]");
    expect(file.content).toContain("[ChiselMouseBinding.WHEEL_UP]");
    expect(file.content).toContain("public static function isActionJustPressed");
    expect(file.content).toContain("public static function isActionJustReleased");
    expect(file.content).toContain("throw 'Invalid Chisel input action: $index'");
  });

  it("supports every binding offered by the Chisel system table", () => {
    const table = inputTable([{ bindings: Object.values(InputKeyEnum), slug: "ALL_BINDINGS" }]);

    expect(() => renderHaxeFlixelInputExport([table], "source/gamedata")).not.toThrow();
  });
  it("rejects bindings that HaxeFlixel cannot represent", () => {
    const table = inputTable([{ bindings: ["KEY_UNKNOWN"], slug: "BROKEN" }]);

    expect(() => renderHaxeFlixelInputExport([table], "source/gamedata")).toThrow(
      'Unsupported HaxeFlixel input binding "KEY_UNKNOWN" on action "BROKEN".'
    );
  });
});
