import sharp from "sharp"
import fs from "node:fs/promises"
import type { TextureMaps } from "../shared/schemas"
import { readPackedTexturePackage, writePackedTexturePackage } from "./texture-package"

interface RgbaImage {
  data: Buffer
  width: number
  height: number
}

async function readMap(filePath: string): Promise<RgbaImage> {
  const image = sharp(filePath, { ignoreIcc: true, failOn: "warning" })
  const metadata = await image.metadata()
  if (metadata.format !== "png" || metadata.depth !== "uchar") {
    throw new Error("ZPBR source maps must be 8-bit PNG images.")
  }
  // Preserve authored channel values: data maps must never be gamma corrected.
  const { data, info } = await image
    .removeAlpha()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

async function packPair(rgb: RgbaImage, alpha: RgbaImage): Promise<Buffer> {
  const data = Buffer.from(rgb.data)
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset + 3] = alpha.data[offset]
  }
  return sharp(data, { raw: { width: rgb.width, height: rgb.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function packSurface(
  normal: RgbaImage,
  roughness: RgbaImage,
  emissive: RgbaImage
): Promise<Buffer> {
  const data = Buffer.alloc(normal.data.length)
  for (let offset = 0; offset < data.length; offset += 4) {
    if (normal.data[offset + 2] < 128) {
      throw new Error(
        "ZPBR requires tangent-space normals with positive Z; negative Z cannot be reconstructed."
      )
    }
    // R/B carry normal X/Y. The shader reconstructs positive normal Z.
    data[offset] = normal.data[offset]
    data[offset + 1] = roughness.data[offset]
    data[offset + 2] = normal.data[offset + 1]
    data[offset + 3] = emissive.data[offset]
  }
  return sharp(data, { raw: { width: normal.width, height: normal.height, channels: 4 } })
    .png()
    .toBuffer()
}

export async function packTextureMaps(input: TextureMaps): Promise<Buffer> {
  const [albedo, metallic, normal, roughness, emissive] = await Promise.all([
    readMap(input.albedo),
    readMap(input.metallic),
    readMap(input.normal),
    readMap(input.roughness),
    readMap(input.emissive),
  ])
  for (const image of [metallic, normal, roughness, emissive]) {
    if (image.width !== albedo.width || image.height !== albedo.height) {
      throw new Error("All five ZPBR source maps must have identical dimensions.")
    }
  }
  const [albedoMetallic, surface] = await Promise.all([
    packPair(albedo, metallic),
    packSurface(normal, roughness, emissive),
  ])
  return writePackedTexturePackage({
    width: albedo.width,
    height: albedo.height,
    albedoMetallic,
    surface,
  })
}

export async function inspectTexturePackage(
  filePath: string
): Promise<{ width: number; height: number }> {
  const packed = readPackedTexturePackage(await fs.readFile(filePath))
  // Decode both payloads before accepting an imported package, including PNG integrity.
  await Promise.all(
    [packed.albedoMetallic, packed.surface].map(async (payload) => {
      await sharp(payload, { failOn: "warning", ignoreIcc: true }).raw().toBuffer()
    })
  )
  return { width: packed.width, height: packed.height }
}

export async function createTexturePackagePreview(filePath: string): Promise<string> {
  const packed = readPackedTexturePackage(await fs.readFile(filePath))
  // Alpha stores metallicness, not opacity. Hide it only in the editor preview.
  const png = await sharp(packed.albedoMetallic, { failOn: "warning", ignoreIcc: true })
    .removeAlpha()
    .resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()
  return `data:image/png;base64,${png.toString("base64")}`
}
