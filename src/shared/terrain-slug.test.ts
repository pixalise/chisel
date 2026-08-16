import { describe, expect, it } from "vitest";
import {
  assertUniqueTerrainSlugs,
  duplicateTerrainSlugs,
  finalizeTerrainSlug,
  isTerrainSlugAvailable,
  normalizeTerrainSlugDraft
} from "./terrain-slug";

describe("terrain slug editing", () => {
  it("keeps a trailing separator while typing and removes it when committed", () => {
    expect(normalizeTerrainSlugDraft("forest edge ")).toBe("FOREST_EDGE_");
    expect(finalizeTerrainSlug("forest edge ", "SOCKET_1")).toBe("FOREST_EDGE");
  });

  it("restores a valid fallback when an editor is left empty", () => {
    expect(finalizeTerrainSlug("", "tileset_12")).toBe("TILESET_12");
    expect(finalizeTerrainSlug("---", "socket_2")).toBe("SOCKET_2");
  });

  it("checks uniqueness without confusing the edited row with another row", () => {
    const slugs = ["WATER", "PIECE_2"];
    expect(isTerrainSlugAvailable("WATER", slugs, 0)).toBe(true);
    expect(isTerrainSlugAvailable("WATER", slugs, 1)).toBe(false);
    expect(isTerrainSlugAvailable("WATER_2X2", slugs, 1)).toBe(true);
  });

  it("reports duplicate authored identities before persistence", () => {
    expect(duplicateTerrainSlugs(["WATER", "GROUND", "WATER", "GROUND"])).toEqual(["WATER", "GROUND"]);
    expect(() => assertUniqueTerrainSlugs("piece", ["WATER", "WATER"])).toThrow(
      "Terrain piece slug 'WATER' is duplicated. Rename each piece before saving."
    );
  });
});
