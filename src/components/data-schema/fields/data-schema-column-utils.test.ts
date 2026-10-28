import {
  createDefaultValueForColumnType,
  isDefaultValueValidForColumnType,
} from "@/components/data-schema/fields/data-schema-column-utils"
import { ColumnType } from "@/enums/column-type"
import { describe, expect, it } from "vitest"
describe("data schema column utils", () => {
  describe("enum defaults", () => {
    it("uses the first enum value for required enum columns", () => {
      expect(
        createDefaultValueForColumnType(ColumnType.ENUM, ["ASPECT", "MODIFIER"], undefined, true)
      ).toBe("ASPECT")
      expect(
        isDefaultValueValidForColumnType(ColumnType.ENUM, "ASPECT", ["ASPECT", "MODIFIER"], true)
      ).toBe(true)
      expect(
        isDefaultValueValidForColumnType(ColumnType.ENUM, "", ["ASPECT", "MODIFIER"], true)
      ).toBe(false)
    })
    it("allows an empty default for optional enum columns", () => {
      expect(
        createDefaultValueForColumnType(ColumnType.ENUM, ["ASPECT", "MODIFIER"], undefined, false)
      ).toBe("")
      expect(
        isDefaultValueValidForColumnType(ColumnType.ENUM, "", ["ASPECT", "MODIFIER"], false)
      ).toBe(true)
      expect(
        isDefaultValueValidForColumnType(ColumnType.ENUM, "UNKNOWN", ["ASPECT", "MODIFIER"], false)
      ).toBe(false)
    })
  })
  describe("array reference defaults", () => {
    it("uses and validates arrays of row slugs", () => {
      expect(createDefaultValueForColumnType(ColumnType.ARRAY_REF)).toEqual([])
      expect(
        isDefaultValueValidForColumnType(
          ColumnType.ARRAY_REF,
          ["FOREST_OPEN", "FOREST_RUINS"],
          [],
          false
        )
      ).toBe(true)
      expect(
        isDefaultValueValidForColumnType(ColumnType.ARRAY_REF, ["FOREST_OPEN", 2], [], false)
      ).toBe(false)
      expect(isDefaultValueValidForColumnType(ColumnType.ARRAY_REF, "FOREST_OPEN", [], false)).toBe(
        false
      )
    })
  })
})
