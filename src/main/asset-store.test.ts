import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { AssetCategoryEnum, ColumnType } from "../shared/types";
import { upgradeAssetLibraryPaths } from "./asset-store";

function createNanoid(): string {
  return randomBytes(16).toString("base64url").slice(0, 21);
}

describe("asset store", () => {
  test("upgrades managed assets into category folders", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-asset-store-project-"));
    const assetId = createNanoid();
    const oldRelativePath = ".chisel/assets/packed_texture/forest_soil_1.gppt";
    const oldPath = path.join(projectPath, ...oldRelativePath.split("/"));
    const newRelativePath = ".chisel/assets/terrain_texture/forest_soil_1.gppt";
    const newPath = path.join(projectPath, ...newRelativePath.split("/"));
    const tablePath = path.join(projectPath, ".chisel", "tables", "system", "asset_refs.json");
    await fs.mkdir(path.dirname(oldPath), { recursive: true });
    await fs.writeFile(oldPath, "GPPT");
    await fs.mkdir(path.dirname(tablePath), { recursive: true });
    await fs.writeFile(
      tablePath,
      `${JSON.stringify({ table: { rows: [{ values: [{ columnId: createNanoid(), type: ColumnType.assetRef, value: assetId }] }] } }, null, 2)}\n`,
      "utf8"
    );
    await fs.writeFile(
      path.join(projectPath, ".chisel", "assets.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          assets: [
            {
              category: AssetCategoryEnum.terrainTexture,
              extension: "gppt",
              height: 1024,
              id: assetId,
              name: "Forest Soil 1",
              relativePath: oldRelativePath,
              sizeBytes: 4,
              width: 1024
            }
          ]
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const document = await upgradeAssetLibraryPaths(projectPath);

    expect(document.assetsJson.assets[0]).toMatchObject({
      id: "forest_soil_1",
      name: "forest_soil_1",
      relativePath: newRelativePath
    });
    expect(document.assetIdChanges).toEqual({ [assetId]: "forest_soil_1" });
    await expect(fs.readFile(newPath, "utf8")).resolves.toBe("GPPT");
    await expect(fs.access(oldPath)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(fs.readFile(tablePath, "utf8")).resolves.toContain('"value": "forest_soil_1"');
  });
});
