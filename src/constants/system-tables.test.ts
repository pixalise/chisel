import { MATERIALS_TABLE, MODEL_MATERIALS_TABLE, SYSTEM_TABLES } from "./system-tables"
import { systemDataTableSchema } from "../shared/schemas"
import { describe, expect, it } from "vitest"
describe("Zora content system tables", () => {
  it("registers material definitions and Blender slot bindings with valid schemas", () => {
    expect(SYSTEM_TABLES.map((table) => systemDataTableSchema.parse(table).id)).toEqual([
      "materials",
      "model_materials",
    ])
    expect(
      MATERIALS_TABLE.columns.find((column) => column.name === "glow_tint")?.defaultValue
    ).toEqual([0, 0, 0])
    expect(
      MODEL_MATERIALS_TABLE.columns.find((column) => column.name === "material")?.refTableId
    ).toBe("materials")
  })
})
