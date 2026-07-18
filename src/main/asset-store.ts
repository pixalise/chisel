import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assetSchema, assetsJsonSchema, importAssetSchema, type Asset, type AssetsJson, type ImportAssetInput } from "../shared/schemas";
import { assetSlug, chiselAssetRelativePath } from "../shared/asset-paths";
import { ColumnType } from "../shared/types";
import { readImageDimensions } from "./sharp-worker-client";

export interface UpgradeAssetLibraryPathsResult {
  assetIdChanges: Record<string, string>;
  assetsJson: AssetsJson;
}

interface RawAssetsDocument {
  assets: unknown[];
  schemaVersion: number;
}

async function readRawAssets(filePath: string): Promise<RawAssetsDocument> {
  try {
    const document = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
    if (typeof document !== "object" || document === null || !("assets" in document) || !Array.isArray(document.assets)) {
      return { schemaVersion: 1, assets: [] };
    }
    const schemaVersion = "schemaVersion" in document && typeof document.schemaVersion === "number" ? document.schemaVersion : 1;
    return { schemaVersion, assets: document.assets };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { schemaVersion: 1, assets: [] };
    }
    throw error;
  }
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return false;
    }
    throw error;
  }
}

function projectRelativePath(projectPath: string, relativePath: string): string {
  return path.join(projectPath, ...relativePath.split("/"));
}

function canonicalAsset(asset: Asset): Asset {
  const name = assetSlug(asset.name);
  const relativePath = chiselAssetRelativePath(asset.category, name, asset.extension);
  return assetSchema.parse({ ...asset, id: name, name, relativePath });
}

function rawAssetId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string") {
    return undefined;
  }
  return value.id;
}

async function listJsonFiles(directoryPath: string): Promise<string[]> {
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }

  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return listJsonFiles(entryPath);
      }
      return Promise.resolve(entry.isFile() && entry.name.endsWith(".json") ? [entryPath] : []);
    })
  );
  return files.flat();
}

function upgradeAssetRefValues(value: unknown, assetIdChanges: Map<string, string>): { changed: boolean; value: unknown } {
  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.map((entry) => {
      const result = upgradeAssetRefValues(entry, assetIdChanges);
      changed ||= result.changed;
      return result.value;
    });
    return { changed, value: nextValue };
  }

  if (typeof value !== "object" || value === null) {
    return { changed: false, value };
  }

  const record = value as Record<string, unknown>;
  if (record.type === ColumnType.assetRef && typeof record.value === "string") {
    const upgradedAssetId = assetIdChanges.get(record.value);
    if (upgradedAssetId) {
      return { changed: true, value: { ...record, value: upgradedAssetId } };
    }
  }

  let changed = false;
  const nextRecord: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    const result = upgradeAssetRefValues(entry, assetIdChanges);
    changed ||= result.changed;
    nextRecord[key] = result.value;
  }
  return { changed, value: nextRecord };
}

async function upgradeTableAssetReferences(projectPath: string, assetIdChanges: Map<string, string>): Promise<boolean> {
  if (assetIdChanges.size === 0) {
    return false;
  }

  let changed = false;
  const rootTablesJsonPath = path.join(projectPath, ".chisel", "tables.json");
  const tableJsonFiles = await listJsonFiles(path.join(projectPath, ".chisel", "tables"));
  if (await fileExists(rootTablesJsonPath)) {
    tableJsonFiles.push(rootTablesJsonPath);
  }
  await Promise.all(
    tableJsonFiles.map(async (filePath) => {
      const content = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      const result = upgradeAssetRefValues(content, assetIdChanges);
      if (!result.changed) {
        return;
      }
      changed = true;
      await writeFileAtomic(filePath, `${JSON.stringify(result.value, null, 2)}\n`);
    })
  );
  return changed;
}

export async function replaceAssetReferences(projectPathInput: string, assetIdChangesInput: Record<string, string>): Promise<boolean> {
  return upgradeTableAssetReferences(path.resolve(projectPathInput), new Map(Object.entries(assetIdChangesInput)));
}

export async function upgradeAssetLibraryPaths(projectPathInput: string): Promise<UpgradeAssetLibraryPathsResult> {
  const projectPath = path.resolve(projectPathInput);
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const rawDocument = await readRawAssets(assetsPath);
  const document = assetsJsonSchema.parse(rawDocument);
  const canonicalPathOwners = new Map<string, string>();
  const assetIdChanges = new Map<string, string>();
  const assets: Asset[] = [];
  let changed = false;

  for (const [index, asset] of document.assets.entries()) {
    const upgradedAsset = canonicalAsset(asset);
    const originalId = rawAssetId(rawDocument.assets[index]);
    if (originalId && originalId !== upgradedAsset.id) {
      assetIdChanges.set(originalId, upgradedAsset.id);
      changed = true;
    }

    const ownerId = canonicalPathOwners.get(upgradedAsset.relativePath);
    if (ownerId && ownerId !== upgradedAsset.id) {
      throw new Error(`Multiple assets would upgrade to ${upgradedAsset.relativePath}`);
    }
    canonicalPathOwners.set(upgradedAsset.relativePath, upgradedAsset.id);

    if (asset.relativePath !== upgradedAsset.relativePath || asset.name !== upgradedAsset.name) {
      changed = true;
      const sourcePath = projectRelativePath(projectPath, asset.relativePath);
      const destinationPath = projectRelativePath(projectPath, upgradedAsset.relativePath);

      if (sourcePath !== destinationPath) {
        const sourceExists = await fileExists(sourcePath);
        const destinationExists = await fileExists(destinationPath);
        if (!sourceExists && !destinationExists) {
          throw new Error(`Cannot upgrade missing asset file: ${asset.relativePath}`);
        }
        if (sourceExists && destinationExists) {
          throw new Error(`Cannot upgrade ${asset.relativePath}; destination already exists at ${upgradedAsset.relativePath}`);
        }
        if (sourceExists) {
          await fs.mkdir(path.dirname(destinationPath), { recursive: true });
          await fs.rename(sourcePath, destinationPath);
        }
      }
    }

    assets.push(upgradedAsset);
  }

  const upgradedDocument = assetsJsonSchema.parse({ schemaVersion: document.schemaVersion, assets });
  if (changed) {
    await writeFileAtomic(assetsPath, `${JSON.stringify(upgradedDocument, null, 2)}\n`);
  }
  await upgradeTableAssetReferences(projectPath, assetIdChanges);

  return { assetIdChanges: Object.fromEntries(assetIdChanges), assetsJson: upgradedDocument };
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
    return await readImageDimensions(filePath);
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

  const slug = assetSlug(request.name);
  if (!slug) {
    throw new Error("Imported asset name must contain at least one letter or number");
  }

  const sourceStat = await fs.stat(sourcePath);
  if (!sourceStat.isFile()) {
    throw new Error("Imported asset source must be a file");
  }

  const projectPath = path.resolve(request.projectPath);
  const relativePath = chiselAssetRelativePath(request.category, slug, extension);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = (await upgradeAssetLibraryPaths(projectPath)).assetsJson;
  const existing = document.assets.find((asset) => asset.id === slug || asset.relativePath === relativePath);
  if (existing) {
    throw new Error(`Asset slug ${slug} already exists`);
  }
  const dimensions = await imageDimensions(sourcePath);
  const asset = assetSchema.parse({
    id: slug,
    name: slug,
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
