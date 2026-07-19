import { describe, expect, it } from "vitest";
import { AssetCategoryEnum, assetCategoryLabelMap, assetCategoryOptionValues, isHdriExtension, isTerrainTextureExtension } from "./types";

describe("asset categories", () => {
  it("includes HDRI as a selectable asset category", () => {
    expect(assetCategoryLabelMap[AssetCategoryEnum.hdri]).toBe("HDRI");
    expect(assetCategoryOptionValues).toContainEqual({ label: "HDRI", value: AssetCategoryEnum.hdri });
  });

  it("recognizes HDRI file extensions without stealing terrain texture extensions", () => {
    expect(isHdriExtension("hdr")).toBe(true);
    expect(isHdriExtension("HDR")).toBe(true);
    expect(isHdriExtension("exr")).toBe(true);
    expect(isTerrainTextureExtension("exr")).toBe(true);
  });
});
