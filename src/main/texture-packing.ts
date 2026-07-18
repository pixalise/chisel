import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assetSchema,
  assetsJsonSchema,
  packAlbedoHeightTextureSchema,
  packNormalRoughnessTextureSchema,
  packTexturePackageSchema,
  type Asset,
  type PackAlbedoHeightTexture,
  type PackNormalRoughnessTexture,
  type PackTexturePackage
} from "../shared/schemas";
import { assetSlug, chiselAssetRelativePath } from "../shared/asset-paths";
import { AssetCategoryEnum } from "../shared/types";
import { upgradeAssetLibraryPaths } from "./asset-store";
import { encodeSharpRgbaPng, loadSharpRgba } from "./sharp-worker-client";

interface RgbaImage {
  data: Buffer;
  width: number;
  height: number;
}

const packedTexturePackageMagic = "GPPT";
const packedTexturePackageVersion = 1;
const packedTexturePackageExtension = "gppt";
const packedTexturePackageHeaderSize = 24;

export type PackedTexturePackagePreviewKind = "albedoHeight" | "normalRoughness";

export interface PackedTexturePackageDataUrls {
  albedoHeight: string;
  normalRoughness: string;
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
  return loadSharpRgba(filePath);
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
  return encodeSharpRgbaPng(image.data, image.width, image.height);
}

async function rgbaPngDataUrl(image: RgbaImage): Promise<string> {
  const buffer = await rgbaPngBuffer(image);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function packedTexturePackageBuffer(width: number, height: number, albedoHeightPng: Buffer, normalRoughnessPng: Buffer): Buffer {
  const buffer = Buffer.alloc(packedTexturePackageHeaderSize + albedoHeightPng.length + normalRoughnessPng.length);
  buffer.write(packedTexturePackageMagic, 0, "ascii");
  buffer.writeUInt32LE(packedTexturePackageVersion, 4);
  buffer.writeUInt32LE(width, 8);
  buffer.writeUInt32LE(height, 12);
  buffer.writeUInt32LE(albedoHeightPng.length, 16);
  buffer.writeUInt32LE(normalRoughnessPng.length, 20);
  albedoHeightPng.copy(buffer, packedTexturePackageHeaderSize);
  normalRoughnessPng.copy(buffer, packedTexturePackageHeaderSize + albedoHeightPng.length);
  return buffer;
}

export function packedTexturePackagePreviewDataUrl(buffer: Buffer, preview: PackedTexturePackagePreviewKind = "albedoHeight"): string {
  if (buffer.length < packedTexturePackageHeaderSize || buffer.subarray(0, 4).toString("ascii") !== packedTexturePackageMagic) {
    throw new Error("File is not a GPPT texture package.");
  }

  const version = buffer.readUInt32LE(4);
  if (version !== packedTexturePackageVersion) {
    throw new Error(`Unsupported GPPT version: ${version}`);
  }

  const albedoHeightPngLength = buffer.readUInt32LE(16);
  const normalRoughnessPngLength = buffer.readUInt32LE(20);
  const albedoHeightPngEnd = packedTexturePackageHeaderSize + albedoHeightPngLength;
  if (albedoHeightPngLength <= 0 || albedoHeightPngEnd > buffer.length) {
    throw new Error("GPPT package has an invalid albedo-height payload.");
  }

  if (preview === "albedoHeight") {
    return `data:image/png;base64,${buffer.subarray(packedTexturePackageHeaderSize, albedoHeightPngEnd).toString("base64")}`;
  }

  const normalRoughnessPngEnd = albedoHeightPngEnd + normalRoughnessPngLength;
  if (normalRoughnessPngLength <= 0 || normalRoughnessPngEnd > buffer.length) {
    throw new Error("GPPT package has an invalid normal-roughness payload.");
  }

  return `data:image/png;base64,${buffer.subarray(albedoHeightPngEnd, normalRoughnessPngEnd).toString("base64")}`;
}

export function unpackPackedTexturePackageDataUrls(buffer: Buffer): PackedTexturePackageDataUrls {
  return {
    albedoHeight: packedTexturePackagePreviewDataUrl(buffer, "albedoHeight"),
    normalRoughness: packedTexturePackagePreviewDataUrl(buffer, "normalRoughness")
  };
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
  const slug = assetSlug(request.name);
  if (!slug) {
    throw new Error("Packed texture name must contain at least one letter or number");
  }

  const relativePath = chiselAssetRelativePath(AssetCategoryEnum.terrainTexture, slug, packedTexturePackageExtension);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = (await upgradeAssetLibraryPaths(projectPath)).assetsJson;
  const existing = document.assets.find((asset) => asset.id === slug || asset.relativePath === relativePath);
  if (existing) {
    throw new Error(`Asset slug ${slug} already exists`);
  }
  const asset = assetSchema.parse({
    id: slug,
    category: AssetCategoryEnum.terrainTexture,
    extension: packedTexturePackageExtension,
    height: albedoHeight.height,
    name: slug,
    note: request.note,
    relativePath,
    sizeBytes: packageBuffer.length,
    width: albedoHeight.width
  });
  const assets = [...document.assets, asset];

  await writeFileAtomic(destinationPath, packageBuffer);
  await writeFileAtomic(assetsPath, `${JSON.stringify(assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
  return asset;
}
