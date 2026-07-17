import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { dataTableRowSchema, rowSlugSchema } from "./schemas";

describe("row slugs", () => {
  it("accepts uppercase snake case slugs", () => {
    expect(rowSlugSchema.parse("ZOMBIE_BASIC")).toBe("ZOMBIE_BASIC");
    expect(rowSlugSchema.parse("FLETCHING_BULLETS_2")).toBe("FLETCHING_BULLETS_2");
  });

  it("rejects non-canonical slug shapes", () => {
    for (const slug of ["zombie_basic", "ZombieBasic", "ZOMBIE-BASIC", "ZOMBIE BASIC", "ZOMBIE__BASIC", "_ZOMBIE", "ZOMBIE_"]) {
      expect(rowSlugSchema.safeParse(slug).success).toBe(false);
    }
  });

  it("requires every data table row to have a slug", () => {
    expect(() => dataTableRowSchema.parse({ id: nanoid(), values: [] })).toThrow();
    expect(() => dataTableRowSchema.parse({ id: nanoid(), slug: "ZOMBIE_BASIC", values: [] })).not.toThrow();
  });
});
