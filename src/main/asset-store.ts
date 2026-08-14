import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  assetSchema,
  assetCategoryForExtension,
  assetsJsonSchema,
  importAssetSchema,
  replaceAssetSourceSchema,
  type Asset,
  type AssetsJson,
  type ImportAssetInput,
  type ReplaceAssetSourceInput
} from "../shared/schemas";
import { assetSlug, chiselAssetRelativePath } from "../shared/asset-paths";
import { ColumnType, isAssetExtensionAllowed, isImageExtension } from "../shared/types";
import { readImageDimensions } from "./sharp-worker-client";

async function readAssets(filePath: string): Promise<AssetsJson> {
  try {
    return assetsJsonSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8")) as unknown);
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
    return (await fs.stat(filePath)).isFile();
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return false;
    throw error;
  }
}

function projectRelativePath(projectPath: string, relativePath: string): string {
  return path.join(projectPath, ...relativePath.split("/"));
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

function replaceAssetRefValues(value: unknown, assetIdChanges: Map<string, string>): { changed: boolean; value: unknown } {
  if (Array.isArray(value)) {
    let changed = false;
    const nextValue = value.map((entry) => {
      const result = replaceAssetRefValues(entry, assetIdChanges);
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
    const replacementAssetId = assetIdChanges.get(record.value);
    if (replacementAssetId) {
      return { changed: true, value: { ...record, value: replacementAssetId } };
    }
  }

  let changed = false;
  const nextRecord: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    const result = replaceAssetRefValues(entry, assetIdChanges);
    changed ||= result.changed;
    nextRecord[key] = result.value;
  }
  return { changed, value: nextRecord };
}

async function replaceTableAssetReferences(projectPath: string, assetIdChanges: Map<string, string>): Promise<boolean> {
  let changed = false;
  const rootTablesJsonPath = path.join(projectPath, ".chisel", "tables.json");
  const commitsJsonPath = path.join(projectPath, ".chisel", "commits.json");
  const tableJsonFiles = await listJsonFiles(path.join(projectPath, ".chisel", "tables"));
  if (await fileExists(rootTablesJsonPath)) {
    tableJsonFiles.push(rootTablesJsonPath);
  }
  if (await fileExists(commitsJsonPath)) {
    tableJsonFiles.push(commitsJsonPath);
  }
  await Promise.all(
    tableJsonFiles.map(async (filePath) => {
      const content = JSON.parse(await fs.readFile(filePath, "utf8")) as unknown;
      const result = replaceAssetRefValues(content, assetIdChanges);
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
  return replaceTableAssetReferences(path.resolve(projectPathInput), new Map(Object.entries(assetIdChangesInput)));
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
  if (!isImageExtension(path.extname(filePath).replace(/^\./, ""))) {
    return { width: 0, height: 0 };
  }
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
  const category = assetCategoryForExtension(extension, request.category);
  if (!isAssetExtensionAllowed(category, extension)) {
    throw new Error(`${category} does not support ${extension} files.`);
  }
  const relativePath = chiselAssetRelativePath(category, slug, extension);
  const destinationPath = path.join(projectPath, ...relativePath.split("/"));
  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = await readAssets(assetsPath);
  const existing = document.assets.find((asset) => asset.id === slug || asset.relativePath === relativePath);
  if (existing) {
    throw new Error(`Asset slug ${slug} already exists`);
  }
  const dimensions = await imageDimensions(sourcePath);
  const asset = assetSchema.parse({
    id: slug,
    name: slug,
    category,
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

export async function replaceAssetSource(input: ReplaceAssetSourceInput): Promise<Asset> {
  const request = replaceAssetSourceSchema.parse(input);
  const projectPath = path.resolve(request.projectPath);
  const sourcePath = path.resolve(request.sourcePath);
  const sourceStat = await fs.stat(sourcePath);
  if (!sourceStat.isFile()) {
    throw new Error("Replacement asset source must be a file");
  }
  const extension = path.extname(sourcePath).toLowerCase();
  if (!extension) {
    throw new Error("Replacement asset source must have a file extension");
  }

  const assetsPath = path.join(projectPath, ".chisel", "assets.json");
  const document = await readAssets(assetsPath);
  const existing = document.assets.find((asset) => asset.id === request.assetId);
  if (!existing) {
    throw new Error(`Asset ${request.assetId} does not exist`);
  }

  const replacementCategory = assetCategoryForExtension(extension, existing.category);
  if (replacementCategory !== existing.category) {
    throw new Error(`Replacement source is ${replacementCategory}; ${existing.id} requires ${existing.category}.`);
  }
  if (!isAssetExtensionAllowed(existing.category, extension)) {
    throw new Error(`${existing.category} does not support ${extension} files.`);
  }

  const relativePath = chiselAssetRelativePath(existing.category, existing.name, extension);
  const conflict = document.assets.find((asset) => asset.id !== existing.id && asset.relativePath === relativePath);
  if (conflict) {
    throw new Error(`Replacement destination ${relativePath} is already owned by ${conflict.id}`);
  }
  const destinationPath = projectRelativePath(projectPath, relativePath);
  const dimensions = await imageDimensions(sourcePath);
  const asset = assetSchema.parse({
    ...existing,
    relativePath,
    extension: extension.replace(/^\./, ""),
    sizeBytes: sourceStat.size,
    width: dimensions.width,
    height: dimensions.height
  });

  await writeFileAtomic(destinationPath, await fs.readFile(sourcePath));
  if (relativePath !== existing.relativePath) {
    await fs.rm(projectRelativePath(projectPath, existing.relativePath), { force: true });
  }
  const assets = document.assets.map((entry) => (entry.id === existing.id ? asset : entry));
  await writeFileAtomic(assetsPath, `${JSON.stringify(assetsJsonSchema.parse({ schemaVersion: 1, assets }), null, 2)}\n`);
  return asset;
}
