"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.packBaseInMemory = packBaseInMemory;
exports.packSurfaceInMemory = packSurfaceInMemory;
const sharp_1 = __importDefault(require("sharp"));
const schemas_1 = require("../shared/schemas");
const channelIndex = {
    red: 0,
    green: 1,
    blue: 2,
    alpha: 3
};
async function loadRgba(filePath) {
    const { data, info } = await (0, sharp_1.default)(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) {
        throw new Error(`Could not read image dimensions for ${filePath}`);
    }
    return { data, width: info.width, height: info.height };
}
function isPowerOfTwo(value) {
    return value > 0 && (value & (value - 1)) === 0;
}
function validateTerrainSize(image, label) {
    if (image.width !== image.height || image.width < 4 || image.width > 65535 || !isPowerOfTwo(image.width)) {
        throw new Error(`${label} must be a square power-of-two image of at least 4x4; got ${image.width}x${image.height}`);
    }
}
function requireSameSize(a, aLabel, b, bLabel) {
    if (a.width !== b.width || a.height !== b.height) {
        throw new Error(`${aLabel} and ${bLabel} dimensions differ: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
    }
}
function byte(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(255, Math.round(value)));
}
function packBasePixels(albedo, height) {
    validateTerrainSize(albedo, "albedo");
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
function packSurfacePixels(normal, ao, roughness, normalZChannel, aoValue, roughnessValue) {
    validateTerrainSize(normal, "normal");
    if (ao) {
        requireSameSize(normal, "normal", ao, "ao");
    }
    if (roughness) {
        requireSameSize(normal, "normal", roughness, "roughness");
    }
    const normalZIndex = channelIndex[normalZChannel];
    const output = Buffer.alloc(normal.width * normal.height * 4);
    const aoConstant = byte(aoValue);
    const roughnessConstant = byte(roughnessValue);
    for (let offset = 0; offset < output.length; offset += 4) {
        output[offset] = normal.data[offset];
        output[offset + 1] = normal.data[offset + normalZIndex];
        output[offset + 2] = ao ? ao.data[offset] : aoConstant;
        output[offset + 3] = roughness ? roughness.data[offset] : roughnessConstant;
    }
    return { data: output, width: normal.width, height: normal.height };
}
async function rgbaPngDataUrl(image) {
    const buffer = await (0, sharp_1.default)(image.data, { raw: { width: image.width, height: image.height, channels: 4 } })
        .png()
        .toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
}
async function packBaseInMemory(input) {
    const request = schemas_1.packBaseSchema.parse(input);
    const [albedo, height] = await Promise.all([loadRgba(request.albedo), loadRgba(request.height)]);
    return rgbaPngDataUrl(packBasePixels(albedo, height));
}
async function packSurfaceInMemory(input) {
    const request = schemas_1.packSurfaceSchema.parse(input);
    const [normal, ao, roughness] = await Promise.all([
        loadRgba(request.normal),
        request.ao ? loadRgba(request.ao) : null,
        request.roughness ? loadRgba(request.roughness) : null
    ]);
    return rgbaPngDataUrl(packSurfacePixels(normal, ao, roughness, request.normalZChannel, request.aoValue, request.roughnessValue));
}
