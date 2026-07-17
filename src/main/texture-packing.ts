import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  assetSchema,
  assetsJsonSchema,
  packAlbedoHeightTextureSchema,
  packNormalRoughnessTextureSchema,
  packTexturePackageSchema,
  type Asset,
  type AssetsJson,
  type PackAlbedoHeightTexture,
  type PackNormalRoughnessTexture,
  type PackTexturePackage
} from "../shared/schemas";
import { AssetCategoryEnum } from "../shared/types";

interface RgbaImage {
  data: Buffer;
  width: number;
  height: number;
}

const packedTexturePackageMagic = "GPPT";
const packedTexturePackageVersion = 1;
const packedTexturePackageExtension = "gppt";

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

function requireSameSize(a: RgbaImage, aLabel: string, b: RgbaImage, bLabel: string): void {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`${aLabel} and ${bLabel} dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
}

function packAlbedoHeightPixels(albedo: RgbaImage, height: RgbaImage): RgbaImage {
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

function packNormalRoughnessPixels(normal: RgbaImage, roughness: RgbaImage): RgbaImage {
  requireSameSize(normal, "normal", roughness, "roughness");

  const output = Buffer.alloc(normal.width * normal.height * 4);
  for (let offset = 0; offset < output.length; offset += 4) {
    output[offset] = normal.data[offset];
    output[offset + 1] = normal.data[offset + 1];
    output[offset + 2] = normal.data[offset + 2];
    output[offset + 3] = roughness.data[offset];
  }
  return { data: output, width: normal.width, height: normal.height };
}

async function rgbaPngBuffer(image: RgbaImage): Promise<Buffer> {
  return sharp(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
    .png()
    .toBuffer();
}

async function rgbaPngDataUrl(image: RgbaImage): Promise<string> {
  const buffer = await rgbaPngBuffer(image);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function packedTexturePackageBuffer(width: number, height: number, albedoHeightPng: Buffer, normalRoughnessPng: Buffer): Buffer {
  const headerSize = 24;
  const buffer = Buffer.alloc(headerSize + albedoHeightPng.length + normalRoughnessPng.length);
  buffer.write(packedTexturePackageMagic, 0, "ascii");
  buffer.writeUInt32LE(packedTexturePackageVersion, 4);
  buffer.writeUInt32LE(width, 8);
  buffer.writeUInt32LE(height, 12);
  buffer.writeUInt32LE(albedoHeightPng.length, 16);
  buffer.writeUInt32LE(normalRoughnessPng.length, 20);
  albedoHeightPng.copy(buffer, headerSize);
  normalRoughnessPng.copy(buffer, headerSize + albedoHeightPng.length);
  return buffer;
}

export async function packAlbedoHeightTextureInMemory(input: PackAlbedoHeightTexture): Promise<string> {
  const request = packAlbedoHeightTextureSchema.parse(input);
  const [albedo, height] = await Promise.all([loadRgba(request.albedo), loadRgba(request.height)]);
  return rgbaPngDataUrl(packAlbedoHeightPixels(albedo, height));
}

export async function packNormalRoughnessTextureInMemory(input: PackNormalRoughnessTexture): Promise<string> {
  const request = packNormalRoughnessTextureSchema.parse(input);
  const [normal, roughness] = await Promise.all([loadRgba(request.normal), loadRgba(request.roughness)]);
  return rgbaPngDataUrl(packNormalRoughnessPixels(normal, roughness));
}

export async function packTexturePackageAsset(input: PackTexturePackage): Promise<Asset> {
  const request = packTexturePackageSchema.parse(input);
  const [albedo, height, normal, roughness] = await Promise.all([
    loadRgba(request.albedo),
    loadRgba(request.height),
    loadRgba(request.normal),
    loadRgba(request.roughness)
  ]);
  const albedoHeight = packAlbedoHeightPixels(albedo, height);
  const normalRoughness = packNormalRoughnessPixels(normal, roughness);
  requireSameSize(albedoHeight, "albedo + height", normalRoughness, "normal + roughness");

  const [albedoHeightPng, normalRoughnessPng] = await Promise.all([rgbaPngBuffer(albedoHeight), rgbaPngBuffer(normalRoughness)]);
  const packageBuffer = packedTexturePackageBuffer(albedoHeight.width, albedoHeight.height, albedoHeightPng, normalRoughnessPng);

  const projectPath = path.resolve(request.projectPath);
  const stem = assetStem(request.name);
  if (!stem) {
    throw new Error("Packed texture name must contain at least one letter or number");
  }

  const relativePath = path.posix.join(".chisel", "assets", "packed_texture", `${stem}.${packedTexturePackageExtension}`);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = await readAssets(assetsPath);
  const existing = document.assets.find((asset) => asset.relativePath === relativePath);
  const asset = assetSchema.parse({
    id: existing?.id ?? createNanoid(),
    category: AssetCategoryEnum.image,
    extension: packedTexturePackageExtension,
    height: albedoHeight.height,
    name: stem,
    note: request.note,
    relativePath,
    sizeBytes: packageBuffer.length,
    width: albedoHeight.width
  });
  const assets = [...document.assets.filter((entry) => entry.id !== asset.id && entry.relativePath !== asset.relativePath), asset];

  await writeFileAtomic(destinationPath, packageBuffer);
  await writeFileAtomic(assetsPath, `${JSON.stringify(assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
  return asset;
}
