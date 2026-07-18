"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const sharp_1 = __importDefault(require("sharp"));
const vitest_1 = require("vitest");
const texture_packing_1 = require("./texture-packing");
const types_1 = require("../shared/types");
async function writeRgbaPng(filePath, data, width = 2, height = 1) {
    await (0, sharp_1.default)(Buffer.from(data), { raw: { width, height, channels: 4 } })
        .png()
        .toFile(filePath);
}
async function dataUrlPixels(dataUrl) {
    const encoded = dataUrl.replace(/^data:image\/png;base64,/, "");
    const { data } = await (0, sharp_1.default)(Buffer.from(encoded, "base64")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return Array.from(data);
}
(0, vitest_1.describe)("texture packing", () => {
    (0, vitest_1.test)("packs albedo rgb with height alpha", async () => {
        const dir = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "chisel-texture-pack-"));
        const albedoPath = node_path_1.default.join(dir, "albedo.png");
        const heightPath = node_path_1.default.join(dir, "height.png");
        await writeRgbaPng(albedoPath, [10, 20, 30, 255, 40, 50, 60, 255]);
        await writeRgbaPng(heightPath, [70, 0, 0, 255, 80, 0, 0, 255]);
        const dataUrl = await (0, texture_packing_1.packAlbedoHeightTextureInMemory)({ albedo: albedoPath, height: heightPath });
        (0, vitest_1.expect)(await dataUrlPixels(dataUrl)).toEqual([10, 20, 30, 70, 40, 50, 60, 80]);
    });
    (0, vitest_1.test)("packs normal xyz with roughness alpha", async () => {
        const dir = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "chisel-texture-pack-"));
        const normalPath = node_path_1.default.join(dir, "normal.png");
        const roughnessPath = node_path_1.default.join(dir, "roughness.png");
        await writeRgbaPng(normalPath, [1, 2, 3, 255, 4, 5, 6, 255]);
        await writeRgbaPng(roughnessPath, [9, 0, 0, 255, 10, 0, 0, 255]);
        const dataUrl = await (0, texture_packing_1.packNormalRoughnessTextureInMemory)({ normal: normalPath, roughness: roughnessPath });
        (0, vitest_1.expect)(await dataUrlPixels(dataUrl)).toEqual([1, 2, 3, 9, 4, 5, 6, 10]);
    });
    (0, vitest_1.test)("writes a GPPT asset package with both packed textures", async () => {
        const projectPath = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "chisel-texture-pack-project-"));
        const albedo = node_path_1.default.join(projectPath, "albedo.png");
        const height = node_path_1.default.join(projectPath, "height.png");
        const normal = node_path_1.default.join(projectPath, "normal.png");
        const roughness = node_path_1.default.join(projectPath, "roughness.png");
        await writeRgbaPng(albedo, [10, 20, 30, 255, 40, 50, 60, 255]);
        await writeRgbaPng(height, [70, 0, 0, 255, 80, 0, 0, 255]);
        await writeRgbaPng(normal, [1, 2, 3, 255, 4, 5, 6, 255]);
        await writeRgbaPng(roughness, [9, 0, 0, 255, 10, 0, 0, 255]);
        const asset = await (0, texture_packing_1.packTexturePackageAsset)({
            albedo,
            height,
            name: "stone_wall",
            normal,
            note: "packed",
            projectPath,
            roughness
        });
        const packageBuffer = await promises_1.default.readFile(node_path_1.default.join(projectPath, ...asset.relativePath.split("/")));
        const assetsJson = JSON.parse(await promises_1.default.readFile(node_path_1.default.join(projectPath, ".chisel", "assets.json"), "utf8"));
        (0, vitest_1.expect)(asset.category).toBe(types_1.AssetCategoryEnum.terrainTexture);
        (0, vitest_1.expect)(asset.extension).toBe("gppt");
        (0, vitest_1.expect)(asset.id).toBe("stone_wall");
        (0, vitest_1.expect)(asset.relativePath).toBe(".chisel/assets/terrain_texture/stone_wall.gppt");
        (0, vitest_1.expect)(packageBuffer.subarray(0, 4).toString("ascii")).toBe("GPPT");
        (0, vitest_1.expect)(packageBuffer.readUInt32LE(4)).toBe(1);
        (0, vitest_1.expect)(packageBuffer.readUInt32LE(8)).toBe(2);
        (0, vitest_1.expect)(packageBuffer.readUInt32LE(12)).toBe(1);
        (0, vitest_1.expect)(await dataUrlPixels((0, texture_packing_1.packedTexturePackagePreviewDataUrl)(packageBuffer))).toEqual([10, 20, 30, 70, 40, 50, 60, 80]);
        (0, vitest_1.expect)(await dataUrlPixels((0, texture_packing_1.packedTexturePackagePreviewDataUrl)(packageBuffer, "normalRoughness"))).toEqual([1, 2, 3, 9, 4, 5, 6, 10]);
        (0, vitest_1.expect)(assetsJson).toMatchObject({ schemaVersion: 1, assets: [{ id: asset.id, relativePath: asset.relativePath }] });
    });
});
