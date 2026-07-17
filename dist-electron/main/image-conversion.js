"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImageConversionPreview = createImageConversionPreview;
exports.convertImagesToPng = convertImagesToPng;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const sharp_1 = __importDefault(require("sharp"));
const schemas_1 = require("../shared/schemas");
async function createImageConversionPreview(inputPath) {
    const buffer = await (0, sharp_1.default)(inputPath).resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
}
async function convertImagesToPng(input) {
    const request = schemas_1.convertImagesSchema.parse(input);
    await promises_1.default.mkdir(request.outputFolder, { recursive: true });
    const converted = [];
    for (const inputPath of request.inputPaths) {
        const outputPath = node_path_1.default.join(request.outputFolder, `${node_path_1.default.parse(inputPath).name}.png`);
        await (0, sharp_1.default)(inputPath).png().toFile(outputPath);
        converted.push({ inputPath, outputPath });
    }
    return converted;
}
