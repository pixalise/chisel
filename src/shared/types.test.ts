import { describe, expect, it } from "vitest";
import {
  AssetCategoryEnum,
  assetCategoryLabelMap,
  assetCategoryOptionValues,
  isAudioExtension,
  isHdriExtension,
  isMeshExtension,
  isTerrainTextureExtension
} from "./types";

describe("asset categories", () => {
  it("includes HDRI as a selectable asset category", () => {
    expect(assetCategoryLabelMap[AssetCategoryEnum.hdri]).toBe("HDRI");
    expect(assetCategoryOptionValues).toContainEqual({ label: "HDRI", value: AssetCategoryEnum.hdri });
    expect(assetCategoryLabelMap[AssetCategoryEnum.uiIcon]).toBe("UI Icon");
    expect(assetCategoryOptionValues).toContainEqual({ label: "UI Icon", value: AssetCategoryEnum.uiIcon });
    expect(assetCategoryLabelMap[AssetCategoryEnum.mesh]).toBe("Mesh");
    expect(assetCategoryOptionValues).toContainEqual({ label: "Mesh", value: AssetCategoryEnum.mesh });
  });

  it("recognizes HDRI file extensions without stealing terrain texture extensions", () => {
    expect(isHdriExtension("hdr")).toBe(true);
    expect(isHdriExtension("HDR")).toBe(true);
    expect(isHdriExtension("exr")).toBe(true);
    expect(isTerrainTextureExtension("exr")).toBe(true);
  });

  it("recognizes mesh file extensions", () => {
    expect(isMeshExtension("glb")).toBe(true);
    expect(isMeshExtension("GLTF")).toBe(true);
    expect(isMeshExtension("obj")).toBe(true);
    expect(isMeshExtension("png")).toBe(false);
  });

  it("recognizes audio file extensions", () => {
    expect(isAudioExtension("wav")).toBe(true);
    expect(isAudioExtension("OGG")).toBe(true);
    expect(isAudioExtension("flac")).toBe(true);
    expect(isAudioExtension("png")).toBe(false);
  });
});
