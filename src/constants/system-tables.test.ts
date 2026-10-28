import { INPUT_BINDINGS_TABLE, SYSTEM_INPUT_TABLES, SYSTEM_TABLES } from "@/constants/system-tables"
import { ColumnType } from "@/enums/column-type"
import { InputKeyEnum } from "@/enums/input-key-enum"
import { anyDataTableSchema } from "@/shared/schemas"
import { describe, expect, it } from "vitest"
describe("system tables", () => {
  it("registers only Roblox input system tables", () => {
    expect(SYSTEM_TABLES).toEqual([INPUT_BINDINGS_TABLE])
    expect(SYSTEM_INPUT_TABLES).toEqual([INPUT_BINDINGS_TABLE])
  })
  it("keeps registered system tables valid", () => {
    for (const table of SYSTEM_TABLES) {
      expect(() => anyDataTableSchema.parse(table)).not.toThrow()
      expect(table.isSystemTable).toBe(true)
      expect(table.columns.length).toBeGreaterThan(0)
    }
  })
  it("defines the input bindings schema without seed rows", () => {
    expect(INPUT_BINDINGS_TABLE.rows).toEqual([])
    const bindingsColumn = INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings")
    expect(bindingsColumn?.type).toBe(ColumnType.ENUM_ARRAY)
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.KEY_W)
    expect(bindingsColumn?.possibleValues).toContain(InputKeyEnum.MOUSE_BUTTON_WHEEL_UP)
  })
})
