import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TextureAtlasDocument } from "../shared/schemas";
import { AssetCategoryEnum } from "../shared/types";
import { buildTextureAtlas, deleteTextureAtlas, listTextureAtlases, saveTextureAtlas } from "./texture-atlas";

let projectPath = "";

function entry(assetId: string): TextureAtlasDocument["entries"][number] {
  return {
    assetId,
    outputHeight: null,
    outputWidth: null,
    pivotX: 0.5,
    pivotY: 0.5,
    resizeMode: "native",
    scale: 1,
    tint: "#FFFFFFFF",
    tintMode: "none",
    trim: false
  };
}

function document(entries: TextureAtlasDocument["entries"]): TextureAtlasDocument {
  return {
    schemaVersion: 1,
    id: "HUD",
    name: "HUD",
    entries,
    settings: {
      allowRotation: false,
      extrusion: 1,
      maxPageHeight: 64,
      maxPageWidth: 64,
      padding: 2,
      powerOfTwo: true
    }
  };
}

async function addImageAsset(assetId: string, red: number): Promise<Record<string, unknown>> {
  const relativePath = `.chisel/assets/IMAGE/${assetId}.png`;
  const filePath = path.join(projectPath, ...relativePath.split("/"));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const contents = await sharp({
    create: {
      background: { r: red, g: 0, b: 0, alpha: 1 },
      channels: 4,
      height: 4,
      width: 4
    }
  })
    .png()
    .toBuffer();
  await fs.writeFile(filePath, contents);
  return {
    category: AssetCategoryEnum.image,
    extension: "png",
    height: 4,
    id: assetId,
    name: assetId,
    relativePath,
    sizeBytes: contents.byteLength,
    width: 4
  };
}

beforeEach(async () => {
  projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-texture-atlas-"));
});

afterEach(async () => {
  await fs.rm(projectPath, { force: true, recursive: true });
});

describe("texture atlas", () => {
  it("persists atlas documents in stable slug order", async () => {
    await saveTextureAtlas({ projectPath, document: document([entry("B_ICON")]) });
    await saveTextureAtlas({
      projectPath,
      document: { ...document([entry("A_ICON")]), id: "A_ATLAS", name: "A Atlas" }
    });

    await expect(listTextureAtlases({ projectPath })).resolves.toMatchObject([{ id: "A_ATLAS" }, { id: "HUD" }]);

    await deleteTextureAtlas({ projectPath, atlasId: "HUD" });
    await expect(listTextureAtlases({ projectPath })).resolves.toMatchObject([{ id: "A_ATLAS" }]);
  });

  it("packs sprites deterministically regardless of entry order", async () => {
    const assets = [await addImageAsset("B_ICON", 120), await addImageAsset("A_ICON", 240)];
    await fs.writeFile(
      path.join(projectPath, ".chisel", "assets.json"),
      `${JSON.stringify({ schemaVersion: 1, assets }, null, 2)}\n`,
      "utf8"
    );

    const first = await buildTextureAtlas({
      projectPath,
      document: document([entry("B_ICON"), entry("A_ICON")])
    });
    const second = await buildTextureAtlas({
      projectPath,
      document: document([entry("A_ICON"), entry("B_ICON")])
    });

    expect(first).toEqual(second);
    expect(Object.keys(first.sprites)).toEqual(["A_ICON", "B_ICON"]);
    expect(first.pages).toMatchObject([{ file: "hud_0.png", width: 16, height: 8 }]);
  });

  it("fails when a configured sprite cannot fit a page", async () => {
    const assets = [await addImageAsset("A_ICON", 240)];
    await fs.writeFile(
      path.join(projectPath, ".chisel", "assets.json"),
      `${JSON.stringify({ schemaVersion: 1, assets }, null, 2)}\n`,
      "utf8"
    );
    const oversized = entry("A_ICON");
    oversized.resizeMode = "stretch";
    oversized.outputWidth = 64;
    oversized.outputHeight = 64;

    await expect(buildTextureAtlas({ projectPath, document: document([oversized]) })).rejects.toThrow("exceeds page bounds");
  });

  it("rejects mismatched power-of-two settings before packing", async () => {
    const invalid = document([entry("A_ICON")]);
    invalid.settings.maxPageWidth = 100;

    await expect(buildTextureAtlas({ projectPath, document: invalid })).rejects.toThrow("power-of-two page width");
  });
});
