"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const vitest_1 = require("vitest");
const types_1 = require("../shared/types");
const asset_store_1 = require("./asset-store");
function createNanoid() {
    return (0, node_crypto_1.randomBytes)(16).toString("base64url").slice(0, 21);
}
(0, vitest_1.describe)("asset store", () => {
    (0, vitest_1.test)("upgrades managed assets into category folders", async () => {
        const projectPath = await promises_1.default.mkdtemp(node_path_1.default.join(node_os_1.default.tmpdir(), "chisel-asset-store-project-"));
        const assetId = createNanoid();
        const oldRelativePath = ".chisel/assets/packed_texture/forest_soil_1.gppt";
        const oldPath = node_path_1.default.join(projectPath, ...oldRelativePath.split("/"));
        const newRelativePath = ".chisel/assets/terrain_texture/forest_soil_1.gppt";
        const newPath = node_path_1.default.join(projectPath, ...newRelativePath.split("/"));
        const tablePath = node_path_1.default.join(projectPath, ".chisel", "tables", "system", "asset_refs.json");
        await promises_1.default.mkdir(node_path_1.default.dirname(oldPath), { recursive: true });
        await promises_1.default.writeFile(oldPath, "GPPT");
        await promises_1.default.mkdir(node_path_1.default.dirname(tablePath), { recursive: true });
        await promises_1.default.writeFile(tablePath, `${JSON.stringify({ table: { rows: [{ values: [{ columnId: createNanoid(), type: types_1.ColumnType.assetRef, value: assetId }] }] } }, null, 2)}\n`, "utf8");
        await promises_1.default.writeFile(node_path_1.default.join(projectPath, ".chisel", "assets.json"), `${JSON.stringify({
            schemaVersion: 1,
            assets: [
                {
                    category: types_1.AssetCategoryEnum.terrainTexture,
                    extension: "gppt",
                    height: 1024,
                    id: assetId,
                    name: "Forest Soil 1",
                    relativePath: oldRelativePath,
                    sizeBytes: 4,
                    width: 1024
                }
            ]
        }, null, 2)}\n`, "utf8");
        const document = await (0, asset_store_1.upgradeAssetLibraryPaths)(projectPath);
        (0, vitest_1.expect)(document.assetsJson.assets[0]).toMatchObject({
            id: "forest_soil_1",
            name: "forest_soil_1",
            relativePath: newRelativePath
        });
        (0, vitest_1.expect)(document.assetIdChanges).toEqual({ [assetId]: "forest_soil_1" });
        await (0, vitest_1.expect)(promises_1.default.readFile(newPath, "utf8")).resolves.toBe("GPPT");
        await (0, vitest_1.expect)(promises_1.default.access(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
        await (0, vitest_1.expect)(promises_1.default.readFile(tablePath, "utf8")).resolves.toContain('"value": "forest_soil_1"');
    });
});
