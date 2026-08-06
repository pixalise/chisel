import { describe, expect, it } from "vitest";
import type { TextureAtlasBuildResult, TextureAtlasSpriteManifest } from "./schemas";
import { createLove2dAtlasTextFiles, LOVE2D_ATLAS_EXPORT_ROOT } from "./love2d-atlas-export";

function sprite(assetId: string, page: number): TextureAtlasSpriteManifest {
  return {
    assetId,
    page,
    x: 2,
    y: 3,
    width: 16,
    height: 12,
    sourceWidth: 32,
    sourceHeight: 24,
    pivotX: 0.5,
    pivotY: 1,
    rotated: false,
    tintMode: "runtime",
    tint: "#AABBCCDD"
  };
}

describe("LÖVE atlas export", () => {
  it("writes deterministic JSON and Lua manifests with exported page paths", () => {
    const build: TextureAtlasBuildResult = {
      atlasId: "HUD",
      pages: [
        {
          dataUrl: "data:image/png;base64,ignored",
          file: "hud_0.png",
          width: 128,
          height: 64
        }
      ],
      sprites: {
        Z_ICON: sprite("Z_ICON", 0),
        A_ICON: sprite("A_ICON", 0)
      }
    };

    const files = createLove2dAtlasTextFiles(build);
    const json = files.find((file) => file.path.endsWith(".json"));
    const lua = files.find((file) => file.path.endsWith(".lua"));

    expect(files.map((file) => file.path)).toEqual([`${LOVE2D_ATLAS_EXPORT_ROOT}/hud.json`, `${LOVE2D_ATLAS_EXPORT_ROOT}/hud.lua`]);
    expect(json?.content).toContain('"file": "gamedata/atlases/hud_0.png"');
    expect(json?.content.indexOf('"A_ICON"')).toBeLessThan(json?.content.indexOf('"Z_ICON"') ?? 0);
    expect(lua?.content).toContain('file = "gamedata/atlases/hud_0.png"');
    expect(lua?.content).toContain("page = 1");
    expect(lua?.content.indexOf('["A_ICON"]')).toBeLessThan(lua?.content.indexOf('["Z_ICON"]') ?? 0);
  });
});
