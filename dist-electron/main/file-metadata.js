"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileMetadata = getFileMetadata;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const electron_1 = require("electron");
const imageExtensions = new Set(["avif", "bmp", "gif", "jpg", "jpeg", "png", "tif", "tiff", "webp"]);
async function getFileMetadata(sourcePath) {
    const stats = await promises_1.default.stat(sourcePath);
    const extension = node_path_1.default.extname(sourcePath).replace(/^\./, "").toLowerCase();
    const fileName = node_path_1.default.basename(sourcePath);
    const stem = node_path_1.default.basename(sourcePath, node_path_1.default.extname(sourcePath));
    const image = electron_1.nativeImage.createFromPath(sourcePath);
    const size = image.isEmpty() ? { width: 0, height: 0 } : image.getSize();
    const metadata = {
        sourcePath,
        fileName,
        stem,
        extension,
        sizeBytes: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        isImage: imageExtensions.has(extension),
        format: imageExtensions.has(extension) ? extension : undefined,
        width: size.width,
        height: size.height
    };
    return metadata;
}
