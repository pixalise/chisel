import { snakeCase } from "lodash";

function pathSegment(value: string, label: string): string {
  const segment = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error(`Invalid ${label} path segment: ${value}`);
  }
  return segment;
}

export function constantCase(value: string): string {
  return snakeCase(value).toUpperCase();
}

export function normalizeConstantCaseInput(value: string): string {
  return constantCase(value);
}

export function assetSlug(name: string): string {
  return constantCase(name);
}

function snakePathSegment(value: string, label: string): string {
  const segment = snakeCase(value);
  if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(segment)) {
    throw new Error(`Invalid ${label} path segment: ${value}`);
  }
  return segment;
}

function chiselPathSegment(value: string, label: string): string {
  const segment = constantCase(value);
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(segment)) {
    throw new Error(`Invalid ${label} Chisel path segment: ${value}`);
  }
  return segment;
}

export function legacyAssetStem(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function assetExtension(extension: string): string {
  return extension.trim().toLowerCase().replace(/^\./, "");
}

export function chiselAssetRelativePath(category: string, name: string, extension: string): string {
  const categorySegment = chiselPathSegment(category, "asset category");
  const stem = chiselPathSegment(name, "asset name");
  const extensionSegment = pathSegment(assetExtension(extension), "asset extension");
  return `.chisel/assets/${categorySegment}/${stem}.${extensionSegment}`;
}

export function godotAssetExportFolderPath(exportRoot: string, category: string, name: string): string {
  const categorySegment = snakePathSegment(category, "asset category");
  const stem = snakePathSegment(name, "asset name");
  return `${exportRoot}/assets/${categorySegment}/${stem}`;
}

export function godotAssetExportFilePath(exportRoot: string, category: string, name: string, extension: string): string {
  const extensionSegment = pathSegment(assetExtension(extension), "asset extension");
  return `${godotAssetExportFolderPath(exportRoot, category, name)}.${extensionSegment}`;
}
