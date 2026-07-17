import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  assetSchema,
  assetsJsonSchema,
  packBaseSchema,
  packSurfaceSchema,
  packTerrainTextureSchema,
  type Asset,
  type AssetsJson,
  type PackBase,
  type PackSurface,
  type PackTerrainTexture
} from "../shared/schemas";
import { AssetTypeEnum, type NormalZChannel } from "../shared/types";

interface RgbaImage {
  data: Buffer;
  width: number;
  height: number;
}

const channelIndex: Record<NormalZChannel, number> = {
  red: 0,
  green: 1,
  blue: 2,
  alpha: 3
};

const terrainTexturePackageMagic = "GTTP";
const terrainTexturePackageVersion = 1;

function createNanoid(): string {
  return randomBytes(16).toString("base64url").slice(0, 21);
}

function assetStem(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function readAssets(filePath: string): Promise<AssetsJson> {
  try {
    return assetsJsonSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { schemaVersion: 1, assets: [] };
    }
    throw error;
  }
}

async function writeFileAtomic(filePath: string, content: string | Buffer): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomBytes(8).toString("hex")}.tmp`);
  try {
    await fs.writeFile(temporaryPath, content);
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function loadRgba(filePath: string): Promise<RgbaImage> {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    throw new Error(`Could not read image dimensions for ${filePath}`);
  }
  return { data, width: info.width, height: info.height };
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function validateTerrainSize(image: RgbaImage, label: string): void {
  if (image.width !== image.height || image.width < 4 || image.width > 65535 || !isPowerOfTwo(image.width)) {
    throw new Error(`${label} must be a square power-of-two image of at least 4x4; got ${image.width}x${image.height}`);
  }
}

function requireSameSize(a: RgbaImage, aLabel: string, b: RgbaImage, bLabel: string): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`${aLabel} and ${bLabel} dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

function byte(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(value)));
}

function packBasePixels(albedo: RgbaImage, height: RgbaImage): RgbaImage {
  validateTerrainSize(albedo, "albedo");
  requireSameSize(albedo, "albedo", height, "height");

  const output = Buffer.alloc(albedo.width * albedo.height * 4);
  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset] = albedo.data[offset];
    output[offset + 1] = albedo.data[offset + 1];
    output[offset + 2] = albedo.data[offset + 2];
    output[offset + 3] = height.data[offset];
  }
  return { data: output, width: albedo.width, height: albedo.height };
}

function packSurfacePixels(
  normal: RgbaImage,
  ao: RgbaImage | null,
  roughness: RgbaImage | null,
  normalZChannel: NormalZChannel,
  aoValue: number,
  roughnessValue: number
): RgbaImage {
  validateTerrainSize(normal, "normal");
  if (ao) {
    requireSameSize(normal, "normal", ao, "ao");
  }
  if (roughness) {
    requireSameSize(normal, "normal", roughness, "roughness");
  }

  const normalZIndex = channelIndex[normalZChannel];
  const output = Buffer.alloc(normal.width * normal.height * 4);
  const aoConstant = byte(aoValue);
  const roughnessConstant = byte(roughnessValue);
  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset] = normal.data[offset];
    output[offset + 1] = normal.data[offset + normalZIndex];
    output[offset + 2] = ao ? ao.data[offset] : aoConstant;
    output[offset + 3] = roughness ? roughness.data[offset] : roughnessConstant;
  }
  return { data: output, width: normal.width, height: normal.height };
}

async function rgbaPngDataUrl(image: RgbaImage): Promise<string> {
  const buffer = await rgbaPngBuffer(image);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function rgbaPngBuffer(image: RgbaImage): Promise<Buffer> {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
}

function terrainTexturePackageBuffer(width: number, height: number, basePng: Buffer, surfacePng: Buffer): Buffer {
  const headerSize = 24;
  const buffer = Buffer.alloc(headerSize + basePng.length + surfacePng.length);
  buffer.write(terrainTexturePackageMagic, 0, "ascii");
  buffer.writeUInt32LE(terrainTexturePackageVersion, 4);
  buffer.writeUInt32LE(width, 8);
  buffer.writeUInt32LE(height, 12);
  buffer.writeUInt32LE(basePng.length, 16);
  buffer.writeUInt32LE(surfacePng.length, 20);
  basePng.copy(buffer, headerSize);
  surfacePng.copy(buffer, headerSize + basePng.length);
  return buffer;
}

export async function packBaseInMemory(input: PackBase): Promise<string> {
  const request = packBaseSchema.parse(input);
  const [albedo, height] = await Promise.all([loadRgba(request.albedo), loadRgba(request.height)]);
  return rgbaPngDataUrl(packBasePixels(albedo, height));
}

export async function packSurfaceInMemory(input: PackSurface): Promise<string> {
  const request = packSurfaceSchema.parse(input);
  const [normal, ao, roughness] = await Promise.all([
    loadRgba(request.normal),
    request.ao ? loadRgba(request.ao) : null,
    request.roughness ? loadRgba(request.roughness) : null
  ]);
  return rgbaPngDataUrl(packSurfacePixels(normal, ao, roughness, request.normalZChannel, request.aoValue, request.roughnessValue));
}

export async function packTerrainTextureAsset(input: PackTerrainTexture): Promise<Asset> {
  const request = packTerrainTextureSchema.parse(input);
  const [albedo, height, normal, ao, roughness] = await Promise.all([
    loadRgba(request.albedo),
    loadRgba(request.height),
    loadRgba(request.normal),
    request.ao ? loadRgba(request.ao) : null,
    request.roughness ? loadRgba(request.roughness) : null
  ]);
  const base = packBasePixels(albedo, height);
  const surface = packSurfacePixels(normal, ao, roughness, request.normalZChannel, request.aoValue, request.roughnessValue);
  requireSameSize(base, "packed base", surface, "packed surface");

  const [basePng, surfacePng] = await Promise.all([rgbaPngBuffer(base), rgbaPngBuffer(surface)]);
  const packageBuffer = terrainTexturePackageBuffer(base.width, base.height, basePng, surfacePng);

  const projectPath = path.resolve(request.projectPath);
  const stem = assetStem(request.name);
  if (!stem) {
    throw new Error("Terrain Texture name must contain at least one letter or number");
  }

  const relativePath = path.posix.join(".chisel", "assets", "terrain_texture", `${stem}.gttp`);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = await readAssets(assetsPath);
  const existing = document.assets.find((asset) => asset.relativePath === relativePath);
  const asset = assetSchema.parse({
    extension: "gttp",
    height: base.height,
    id: existing?.id ?? createNanoid(),
    name: stem,
    note: request.note,
    relativePath,
    sizeBytes: packageBuffer.length,
    type: AssetTypeEnum.terrainTexture,
    width: base.width
  });
  const assets = [...document.assets.filter((entry) => entry.id !== asset.id && entry.relativePath !== asset.relativePath), asset];

  await writeFileAtomic(destinationPath, packageBuffer);
  await writeFileAtomic(assetsPath, `${JSON.stringify(assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
  return asset;
}
