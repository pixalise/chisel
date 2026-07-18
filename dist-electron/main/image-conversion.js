"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImageConversionPreview = createImageConversionPreview;
exports.convertImagesToPng = convertImagesToPng;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const schemas_1 = require("../shared/schemas");
const sharp_worker_client_1 = require("./sharp-worker-client");
async function createImageConversionPreview(inputPath) {
    return (0, sharp_worker_client_1.createSharpImagePreview)(inputPath);
}
async function convertImagesToPng(input) {
    const request = schemas_1.convertImagesSchema.parse(input);
    await promises_1.default.mkdir(request.outputFolder, { recursive: true });
    const converted = [];
    for (const inputPath of request.inputPaths) {
        const outputPath = node_path_1.default.join(request.outputFolder, `${node_path_1.default.parse(inputPath).name}.png`);
        await (0, sharp_worker_client_1.convertSharpImageToPng)(inputPath, outputPath);
        converted.push({ inputPath, outputPath });
    }
    return converted;
}
