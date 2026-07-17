import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assetSchema, assetsJsonSchema, importAssetSchema, type Asset, type AssetsJson, type ImportAssetInput } from "../shared/schemas";

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

async function imageDimensions(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width ?? 0,
      height: metadata.height ?? 0
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

export async function importAsset(input: ImportAssetInput): Promise<Asset> {
  const request = importAssetSchema.parse(input);
  const sourcePath = path.resolve(request.sourcePath);
  const extension = path.extname(sourcePath).toLowerCase();
  if (!extension) {
    throw new Error("Imported asset source must have a file extension");
  }

  const stem = assetStem(request.name);
  if (!stem) {
    throw new Error("Imported asset name must contain at least one letter or number");
  }

  const sourceStat = await fs.stat(sourcePath);
  if (!sourceStat.isFile()) {
    throw new Error("Imported asset source must be a file");
  }

  const projectPath = path.resolve(request.projectPath);
  const relativePath = path.posix.join(".chisel", "assets", request.category, `${stem}${extension}`);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = await readAssets(assetsPath);
  const existing = document.assets.find((asset) => asset.relativePath === relativePath);
  const dimensions = await imageDimensions(sourcePath);
  const asset = assetSchema.parse({
    id: existing?.id ?? createNanoid(),
    name: stem,
    category: request.category,
    relativePath,
    sizeBytes: sourceStat.size,
    width: dimensions.width,
    height: dimensions.height,
    note: request.note,
    extension: extension.replace(/^\./, "")
  });
  const assets = [...document.assets.filter((entry) => entry.id !== asset.id && entry.relativePath !== asset.relativePath), asset];

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
  await writeFileAtomic(assetsPath, `${JSON.stringify(assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
  return asset;
}
