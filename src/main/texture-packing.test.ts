import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, test } from "vitest";
import {
  packedTexturePackagePreviewDataUrl,
  packAlbedoHeightTextureInMemory,
  packNormalRoughnessTextureInMemory,
  packTexturePackageAsset
} from "./texture-packing";
import { AssetCategoryEnum } from "../shared/types";

async function writeRgbaPng(filePath: string, data: number[], width = 2, height = 1): Promise<void> {
  await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);
}

async function dataUrlPixels(dataUrl: string): Promise<number[]> {
  const encoded = dataUrl.replace(/^data:image\/png;base64,/, "");
  const { data } = await sharp(Buffer.from(encoded, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return Array.from(data);
}

describe("texture packing", () => {
  test("packs albedo rgb with height alpha", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-texture-pack-"));
    const albedoPath = path.join(dir, "albedo.png");
    const heightPath = path.join(dir, "height.png");
    await writeRgbaPng(albedoPath, [10, 20, 30, 255, 40, 50, 60, 255]);
    await writeRgbaPng(heightPath, [70, 0, 0, 255, 80, 0, 0, 255]);

    const dataUrl = await packAlbedoHeightTextureInMemory({ albedo: albedoPath, height: heightPath });

    expect(await dataUrlPixels(dataUrl)).toEqual([10, 20, 30, 70, 40, 50, 60, 80]);
  });

  test("packs normal xyz with roughness alpha", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-texture-pack-"));
    const normalPath = path.join(dir, "normal.png");
    const roughnessPath = path.join(dir, "roughness.png");
    await writeRgbaPng(normalPath, [1, 2, 3, 255, 4, 5, 6, 255]);
    await writeRgbaPng(roughnessPath, [9, 0, 0, 255, 10, 0, 0, 255]);

    const dataUrl = await packNormalRoughnessTextureInMemory({ normal: normalPath, roughness: roughnessPath });

    expect(await dataUrlPixels(dataUrl)).toEqual([1, 2, 3, 9, 4, 5, 6, 10]);
  });

  test("writes a GPPT asset package with both packed textures", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-texture-pack-project-"));
    const albedo = path.join(projectPath, "albedo.png");
    const height = path.join(projectPath, "height.png");
    const normal = path.join(projectPath, "normal.png");
    const roughness = path.join(projectPath, "roughness.png");
    await writeRgbaPng(albedo, [10, 20, 30, 255, 40, 50, 60, 255]);
    await writeRgbaPng(height, [70, 0, 0, 255, 80, 0, 0, 255]);
    await writeRgbaPng(normal, [1, 2, 3, 255, 4, 5, 6, 255]);
    await writeRgbaPng(roughness, [9, 0, 0, 255, 10, 0, 0, 255]);

    const asset = await packTexturePackageAsset({
      albedo,
      height,
      name: "Stone Wall",
      normal,
      note: "packed",
      projectPath,
      roughness
    });
    const packageBuffer = await fs.readFile(path.join(projectPath, ...asset.relativePath.split("/")));
    const assetsJson = JSON.parse(await fs.readFile(path.join(projectPath, ".chisel", "assets.json"), "utf8")) as unknown;

    expect(asset.category).toBe(AssetCategoryEnum.terrainTexture);
    expect(asset.extension).toBe("gppt");
    expect(packageBuffer.subarray(0, 4).toString("ascii")).toBe("GPPT");
    expect(packageBuffer.readUInt32LE(4)).toBe(1);
    expect(packageBuffer.readUInt32LE(8)).toBe(2);
    expect(packageBuffer.readUInt32LE(12)).toBe(1);
    expect(await dataUrlPixels(packedTexturePackagePreviewDataUrl(packageBuffer))).toEqual([10, 20, 30, 70, 40, 50, 60, 80]);
    expect(await dataUrlPixels(packedTexturePackagePreviewDataUrl(packageBuffer, "normalRoughness"))).toEqual([1, 2, 3, 9, 4, 5, 6, 10]);
    expect(assetsJson).toMatchObject({ schemaVersion: 1, assets: [{ id: asset.id, relativePath: asset.relativePath }] });
  });
});
