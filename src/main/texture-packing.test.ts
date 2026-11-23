import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, test } from "vitest"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { packTexturePackageSchema, type TextureMaps } from "../shared/schemas"
import { importAsset, replaceAssetSource } from "./asset-store"
import { createImageConversionPreview } from "./image-conversion"
import { packTexturePackageAsset } from "./texture-packing"
import { packTextureMaps } from "./texture-packing-images"
import { readPackedTexturePackage } from "./texture-package"

let directory: string
let maps: TextureMaps

async function writePng(name: string, pixels: number[], width = 2): Promise<string> {
  const filePath = path.join(directory, `${name}.png`)
  await sharp(Buffer.from(pixels), { raw: { width, height: 1, channels: 4 } })
    .png()
    .toFile(filePath)
  return filePath
}

async function pixels(png: Buffer): Promise<number[]> {
  return Array.from(await sharp(png).ensureAlpha().raw().toBuffer())
}

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "mrak-texture-test-"))
  maps = {
    albedo: await writePng("albedo", [10, 20, 30, 6, 40, 50, 60, 7]),
    metallic: await writePng("metallic", [0, 1, 2, 3, 80, 4, 5, 6]),
    normal: await writePng("normal", [128, 64, 238, 0, 204, 128, 230, 255]),
    roughness: await writePng("roughness", [9, 2, 3, 4, 128, 6, 7, 8]),
    emissive: await writePng("emissive", [32, 99, 88, 77, 255, 66, 55, 44]),
  }
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

describe("ZPBR v1 texture packing", () => {
  test("packs albedo/metallic and normal-XY/roughness/emissive in the specified channels", async () => {
    const packed = await packTextureMaps(maps)
    expect(packed.subarray(0, 4).toString("ascii")).toBe("ZPBR")
    expect([4, 8, 12].map((offset) => packed.readUInt32LE(offset))).toEqual([1, 2, 1])
    const albedoLength = packed.readUInt32LE(16)
    const normalLength = packed.readUInt32LE(20)
    expect(packed.length).toBe(24 + albedoLength + normalLength)
    expect(await pixels(packed.subarray(24, 24 + albedoLength))).toEqual([
      10, 20, 30, 0, 40, 50, 60, 80,
    ])
    expect(await pixels(packed.subarray(24 + albedoLength))).toEqual([
      128, 9, 64, 32, 204, 128, 128, 255,
    ])
  })

  test("reads the documented ZPBR header and two PNG payloads", async () => {
    const a = await fs.readFile(maps.albedo)
    const n = await fs.readFile(maps.normal)
    const header = Buffer.alloc(24)
    header.write("ZPBR", 0, "ascii")
    header.writeUInt32LE(1, 4)
    header.writeUInt32LE(2, 8)
    header.writeUInt32LE(1, 12)
    header.writeUInt32LE(a.length, 16)
    header.writeUInt32LE(n.length, 20)
    const result = readPackedTexturePackage(Buffer.concat([header, a, n]))
    expect(result).toEqual({ width: 2, height: 1, albedoMetallic: a, surface: n })
  })

  test("rejects GPPT payloads even when renamed to .zpbr", async () => {
    const oldPackage = await packTextureMaps(maps)
    oldPackage.write("GPPT", 0, "ascii")
    const sourcePath = path.join(directory, "legacy.zpbr")
    await fs.writeFile(sourcePath, oldPackage)
    expect(() => readPackedTexturePackage(oldPackage)).toThrow("not a ZPBR")
    await expect(
      importAsset({
        projectPath: directory,
        sourcePath,
        name: "OLD",
        category: AssetCategoryEnum.TERRAIN_TEXTURE,
      })
    ).rejects.toThrow("not a ZPBR")
    await expect(fs.stat(path.join(directory, ".chisel"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  test("rejects negative-Z source normals before discarding Z", async () => {
    maps.normal = await writePng("backwards", [128, 128, 0, 255, 128, 128, 255, 255])
    await expect(
      packTexturePackageAsset({ ...maps, name: "HULL", projectPath: directory })
    ).rejects.toThrow("positive Z")
    await expect(fs.stat(path.join(directory, ".chisel"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  test("rejects unequal map dimensions before creating an asset", async () => {
    maps.roughness = await writePng("small", [255, 255, 255, 255], 1)
    await expect(
      packTexturePackageAsset({ ...maps, name: "HULL", projectPath: directory })
    ).rejects.toThrow("identical dimensions")
    await expect(fs.stat(path.join(directory, ".chisel"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  test("accepts grayscale inputs without changing stored data values", async () => {
    await sharp(Buffer.from([32, 128]), { raw: { width: 2, height: 1, channels: 1 } })
      .toColourspace("b-w")
      .png()
      .toFile(maps.roughness)
    const packed = readPackedTexturePackage(await packTextureMaps(maps))
    expect(await pixels(packed.surface)).toEqual([128, 32, 64, 32, 204, 128, 128, 255])
  })

  test("creates a managed asset and previews albedo without treating metallicness as opacity", async () => {
    const asset = await packTexturePackageAsset({
      ...maps,
      name: "HULL",
      note: "restored",
      projectPath: directory,
    })
    expect(asset).toMatchObject({
      id: "HULL",
      category: AssetCategoryEnum.TERRAIN_TEXTURE,
      extension: "zpbr",
      relativePath: ".chisel/assets/TERRAIN_TEXTURE/HULL.zpbr",
      width: 2,
      height: 1,
    })
    const filePath = path.join(directory, asset.relativePath)
    const preview = await createImageConversionPreview(filePath)
    expect(await pixels(Buffer.from(preview.split(",")[1], "base64"))).toEqual([
      10, 20, 30, 255, 40, 50, 60, 255,
    ])
    const saved = JSON.parse(await fs.readFile(path.join(directory, ".chisel/assets.json"), "utf8"))
    expect(saved.assets).toHaveLength(1)
    expect(saved.assets[0].id).toBe("HULL")
    await expect(
      packTexturePackageAsset({ ...maps, name: "HULL", projectPath: directory })
    ).rejects.toThrow("already exists")
    expect(await fs.readFile(filePath)).toEqual(await packTextureMaps(maps))
  })

  test("supports package import/replacement through the existing asset store", async () => {
    const sourcePath = path.join(directory, "input.zpbr")
    await fs.writeFile(sourcePath, await packTextureMaps(maps))
    const asset = await importAsset({
      projectPath: directory,
      sourcePath,
      name: "HULL",
      category: AssetCategoryEnum.OTHER,
    })
    expect(asset.category).toBe(AssetCategoryEnum.TERRAIN_TEXTURE)
    expect(asset.width).toBe(2)
    const updated = await replaceAssetSource({
      projectPath: directory,
      assetId: asset.id,
      sourcePath,
    })
    expect(updated.id).toBe(asset.id)
    const original = await fs.readFile(path.join(directory, asset.relativePath))
    const broken = Buffer.from(original)
    broken.writeUInt32LE(99, 8)
    await fs.writeFile(sourcePath, broken)
    await expect(
      replaceAssetSource({ projectPath: directory, assetId: asset.id, sourcePath })
    ).rejects.toThrow("dimensions")
    expect(await fs.readFile(path.join(directory, asset.relativePath))).toEqual(original)
  })

  test("rejects invalid versions, lengths, PNG headers and trailing data", async () => {
    const valid = await packTextureMaps(maps)
    expect(() => readPackedTexturePackage(Buffer.alloc(23))).toThrow("not a ZPBR")
    for (const offset of [0, 4, 8, 12, 16, 20, 24]) {
      const invalid = Buffer.from(valid)
      invalid.writeUInt32LE(0, offset)
      expect(() => readPackedTexturePackage(invalid)).toThrow()
    }
    expect(() => readPackedTexturePackage(valid.subarray(0, -1))).toThrow("lengths")
    expect(() => readPackedTexturePackage(Buffer.concat([valid, Buffer.from([0])]))).toThrow(
      "lengths"
    )
  })

  test("rejects corrupt compressed data in either PNG before import", async () => {
    const packed = await packTextureMaps(maps)
    const sourcePath = path.join(directory, "broken.zpbr")
    const normalOffset = 24 + packed.readUInt32LE(16)
    const idat = packed.indexOf("IDAT", normalOffset)
    expect(idat).toBeGreaterThan(normalOffset)
    packed.fill(0, idat + 4, idat + 12)
    await fs.writeFile(sourcePath, packed)
    await expect(
      importAsset({
        projectPath: directory,
        sourcePath,
        name: "BAD",
        category: AssetCategoryEnum.TERRAIN_TEXTURE,
      })
    ).rejects.toThrow()
    await expect(fs.stat(path.join(directory, ".chisel"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  test("validates all required maps and stable asset slugs at the IPC boundary", () => {
    for (const name of ["metallic", "emissive"]) {
      expect(
        packTexturePackageSchema.safeParse({
          ...maps,
          [name]: "",
          name: "HULL",
          projectPath: directory,
        }).success
      ).toBe(false)
    }
    expect(
      packTexturePackageSchema.safeParse({ ...maps, name: "HULL", projectPath: directory }).success
    ).toBe(true)
    expect(
      packTexturePackageSchema.safeParse({
        ...maps,
        normal: "",
        name: "HULL",
        projectPath: directory,
      }).success
    ).toBe(false)
    expect(
      packTexturePackageSchema.safeParse({ ...maps, name: "../bad", projectPath: directory })
        .success
    ).toBe(false)
    expect(
      packTexturePackageSchema.safeParse({
        ...maps,
        normal: "normal.jpg",
        name: "HULL",
        projectPath: directory,
      }).success
    ).toBe(false)
  })
})
