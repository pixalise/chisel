import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { AssetCategoryEnum } from "../shared/types";
import { importAsset, replaceAssetSource } from "./asset-store";

describe("asset store", () => {
  test("replaces a managed UI image without changing its stable ID", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-ui-asset-project-"));
    const sourcePath = path.join(projectPath, "portrait.png");
    const replacementPath = path.join(projectPath, "replacement.png");
    await fs.writeFile(sourcePath, "FIRST");
    await fs.writeFile(replacementPath, "SECOND");

    const imported = await importAsset({
      category: AssetCategoryEnum.ui,
      name: "HUMAN_MALE",
      projectPath,
      sourcePath
    });
    const replaced = await replaceAssetSource({ assetId: imported.id, projectPath, sourcePath: replacementPath });

    expect(replaced).toMatchObject({
      category: AssetCategoryEnum.ui,
      id: "HUMAN_MALE",
      relativePath: ".chisel/assets/UI/HUMAN_MALE.png"
    });
    await expect(fs.readFile(path.join(projectPath, ".chisel", "assets", "UI", "HUMAN_MALE.png"), "utf8")).resolves.toBe("SECOND");
  });

  test("rejects a non-image replacement for a managed UI image", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-ui-replacement-project-"));
    const sourcePath = path.join(projectPath, "portrait.png");
    const replacementPath = path.join(projectPath, "replacement.txt");
    await fs.writeFile(sourcePath, "FIRST");
    await fs.writeFile(replacementPath, "SECOND");

    const imported = await importAsset({
      category: AssetCategoryEnum.ui,
      name: "HUMAN_MALE",
      projectPath,
      sourcePath
    });

    await expect(replaceAssetSource({ assetId: imported.id, projectPath, sourcePath: replacementPath })).rejects.toThrow(
      "UI does not support .txt files"
    );
    await expect(fs.readFile(path.join(projectPath, ".chisel", "assets", "UI", "HUMAN_MALE.png"), "utf8")).resolves.toBe("FIRST");
  });

  test("imports and replaces managed audio while preserving its category", async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-audio-asset-project-"));
    const sourcePath = path.join(projectPath, "source.wav");
    const replacementPath = path.join(projectPath, "replacement.ogg");
    await fs.writeFile(sourcePath, "WAVE");
    await fs.writeFile(replacementPath, "OGG");

    const imported = await importAsset({
      category: AssetCategoryEnum.other,
      name: "BLADE_SWING",
      note: "Combat swing",
      projectPath,
      sourcePath
    });

    expect(imported).toMatchObject({
      category: AssetCategoryEnum.audio,
      height: 0,
      relativePath: ".chisel/assets/AUDIO/BLADE_SWING.wav",
      width: 0
    });
    await expect(fs.readFile(path.join(projectPath, ".chisel", "assets", "AUDIO", "BLADE_SWING.wav"), "utf8")).resolves.toBe("WAVE");

    const replaced = await replaceAssetSource({ assetId: imported.id, projectPath, sourcePath: replacementPath });
    expect(replaced).toMatchObject({
      category: AssetCategoryEnum.audio,
      relativePath: ".chisel/assets/AUDIO/BLADE_SWING.ogg"
    });
    await expect(fs.readFile(path.join(projectPath, ".chisel", "assets", "AUDIO", "BLADE_SWING.ogg"), "utf8")).resolves.toBe("OGG");
  });
});
