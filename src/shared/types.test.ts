import { describe, expect, it } from "vitest";
import {
  AssetCategoryEnum,
  assetCategoryLabelMap,
  assetCategoryOptionValues,
  isAssetExtensionAllowed,
  isAudioExtension,
  isFontExtension,
  isHdriExtension,
  isImageExtension,
  isMeshExtension,
  isShaderExtension,
  isTerrainTextureExtension
} from "./types";

describe("asset categories", () => {
  it("includes HDRI as a selectable asset category", () => {
    expect(assetCategoryLabelMap[AssetCategoryEnum.hdri]).toBe("HDRI");
    expect(assetCategoryOptionValues).toContainEqual({ label: "HDRI", value: AssetCategoryEnum.hdri });
    expect(assetCategoryLabelMap[AssetCategoryEnum.ui]).toBe("UI");
    expect(assetCategoryOptionValues).toContainEqual({ label: "UI", value: AssetCategoryEnum.ui });
    expect(assetCategoryLabelMap[AssetCategoryEnum.mesh]).toBe("Mesh");
    expect(assetCategoryOptionValues).toContainEqual({ label: "Mesh", value: AssetCategoryEnum.mesh });
    expect(assetCategoryOptionValues).toContainEqual({ label: "Shader", value: AssetCategoryEnum.shader });
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

  it("recognizes managed shader and image extensions", () => {
    expect(isShaderExtension("GLSL")).toBe(true);
    expect(isShaderExtension("png")).toBe(false);
    expect(isImageExtension("png")).toBe(true);
    expect(isImageExtension("WEBP")).toBe(true);
    expect(isImageExtension("wav")).toBe(false);
    expect(isFontExtension("TTF")).toBe(true);
    expect(isFontExtension("png")).toBe(false);
    expect(isAssetExtensionAllowed(AssetCategoryEnum.ui, "png")).toBe(true);
    expect(isAssetExtensionAllowed(AssetCategoryEnum.ui, "txt")).toBe(false);
  });
});
