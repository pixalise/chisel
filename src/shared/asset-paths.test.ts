import { describe, expect, it } from "vitest";
import { normalizeConstantCaseInput } from "./asset-paths";
import { snakeCase } from "lodash";

describe("slug formatting", () => {
  it("formats separators before trimming edge separators", () => {
    expect(normalizeConstantCaseInput("forest soil 1")).toBe("FOREST_SOIL_1");
    expect(normalizeConstantCaseInput("  forest soil 1  ")).toBe("FOREST_SOIL_1");
    expect(normalizeConstantCaseInput("forest   soil___1")).toBe("FOREST_SOIL_1");
  });

  it("keeps exported path segments snake case with the same separator rules", () => {
    expect(snakeCase("Forest Soil 1")).toBe("forest_soil_1");
  });
});
