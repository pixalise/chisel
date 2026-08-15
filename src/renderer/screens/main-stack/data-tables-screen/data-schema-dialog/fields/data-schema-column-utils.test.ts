import { describe, expect, it } from "vitest";
import { ColumnType } from "../../../../../../shared/types";
import { createDefaultValueForColumnType, isDefaultValueValidForColumnType } from "./data-schema-column-utils";

describe("data schema column utils", () => {
  describe("enum defaults", () => {
    it("uses the first enum value for required enum columns", () => {
      expect(createDefaultValueForColumnType(ColumnType.enum, ["ASPECT", "MODIFIER"], undefined, true)).toBe("ASPECT");
      expect(isDefaultValueValidForColumnType(ColumnType.enum, "ASPECT", ["ASPECT", "MODIFIER"], true)).toBe(true);
      expect(isDefaultValueValidForColumnType(ColumnType.enum, "", ["ASPECT", "MODIFIER"], true)).toBe(false);
    });

    it("allows an empty default for optional enum columns", () => {
      expect(createDefaultValueForColumnType(ColumnType.enum, ["ASPECT", "MODIFIER"], undefined, false)).toBe("");
      expect(isDefaultValueValidForColumnType(ColumnType.enum, "", ["ASPECT", "MODIFIER"], false)).toBe(true);
      expect(isDefaultValueValidForColumnType(ColumnType.enum, "UNKNOWN", ["ASPECT", "MODIFIER"], false)).toBe(false);
    });
  });

  describe("array reference defaults", () => {
    it("uses and validates arrays of row slugs", () => {
      expect(createDefaultValueForColumnType(ColumnType.arrayRef)).toEqual([]);
      expect(isDefaultValueValidForColumnType(ColumnType.arrayRef, ["FOREST_OPEN", "FOREST_RUINS"], [], false)).toBe(true);
      expect(isDefaultValueValidForColumnType(ColumnType.arrayRef, ["FOREST_OPEN", 2], [], false)).toBe(false);
      expect(isDefaultValueValidForColumnType(ColumnType.arrayRef, "FOREST_OPEN", [], false)).toBe(false);
    });
  });
});
