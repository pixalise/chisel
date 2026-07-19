"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.constantCase = constantCase;
exports.normalizeConstantCaseInput = normalizeConstantCaseInput;
exports.assetSlug = assetSlug;
exports.legacyAssetStem = legacyAssetStem;
exports.assetExtension = assetExtension;
exports.chiselAssetRelativePath = chiselAssetRelativePath;
exports.godotAssetExportFolderPath = godotAssetExportFolderPath;
exports.godotAssetExportFilePath = godotAssetExportFilePath;
const lodash_1 = require("lodash");
function pathSegment(value, label) {
    const segment = value.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
        throw new Error(`Invalid ${label} path segment: ${value}`);
    }
    return segment;
}
function constantCase(value) {
    return (0, lodash_1.snakeCase)(value).toUpperCase();
}
function normalizeConstantCaseInput(value) {
    return constantCase(value);
}
function assetSlug(name) {
    return constantCase(name);
}
function snakePathSegment(value, label) {
    const segment = (0, lodash_1.snakeCase)(value);
    if (!/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(segment)) {
        throw new Error(`Invalid ${label} path segment: ${value}`);
    }
    return segment;
}
function chiselPathSegment(value, label) {
    const segment = constantCase(value);
    if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(segment)) {
        throw new Error(`Invalid ${label} Chisel path segment: ${value}`);
    }
    return segment;
}
function legacyAssetStem(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
function assetExtension(extension) {
    return extension.trim().toLowerCase().replace(/^\./, "");
}
function chiselAssetRelativePath(category, name, extension) {
    const categorySegment = chiselPathSegment(category, "asset category");
    const stem = chiselPathSegment(name, "asset name");
    const extensionSegment = pathSegment(assetExtension(extension), "asset extension");
    return `.chisel/assets/${categorySegment}/${stem}.${extensionSegment}`;
}
function godotAssetExportFolderPath(exportRoot, category, name) {
    const categorySegment = snakePathSegment(category, "asset category");
    const stem = snakePathSegment(name, "asset name");
    return `${exportRoot}/assets/${categorySegment}/${stem}`;
}
function godotAssetExportFilePath(exportRoot, category, name, extension) {
    const extensionSegment = pathSegment(assetExtension(extension), "asset extension");
    return `${godotAssetExportFolderPath(exportRoot, category, name)}.${extensionSegment}`;
}
