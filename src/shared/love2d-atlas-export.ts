import type { TextureAtlasBuildResult, TextureAtlasSpriteManifest } from "./schemas";

export const LOVE2D_ATLAS_EXPORT_ROOT = "gamedata/atlases";

export interface Love2dAtlasTextFile {
  content: string;
  path: string;
}

function luaString(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n")}"`;
}

function luaSprite(sprite: TextureAtlasSpriteManifest): string {
  return [
    "{",
    `asset_id = ${luaString(sprite.assetId)},`,
    `page = ${sprite.page + 1},`,
    `x = ${sprite.x}, y = ${sprite.y}, width = ${sprite.width}, height = ${sprite.height},`,
    `source_width = ${sprite.sourceWidth}, source_height = ${sprite.sourceHeight},`,
    `pivot_x = ${sprite.pivotX}, pivot_y = ${sprite.pivotY},`,
    "rotated = false,",
    `tint_mode = ${luaString(sprite.tintMode)}, tint = ${luaString(sprite.tint)}`,
    "}"
  ].join(" ");
}

function jsonManifest(build: TextureAtlasBuildResult): string {
  const sprites = Object.fromEntries(Object.entries(build.sprites).sort(([left], [right]) => left.localeCompare(right)));
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      atlasId: build.atlasId,
      pages: build.pages.map((page) => ({
        file: `${LOVE2D_ATLAS_EXPORT_ROOT}/${page.file}`,
        width: page.width,
        height: page.height
      })),
      sprites
    },
    null,
    2
  )}\n`;
}

function luaManifest(build: TextureAtlasBuildResult): string {
  const lines = ["return {", "  schema_version = 1,", `  atlas_id = ${luaString(build.atlasId)},`, "  pages = {"];
  for (const page of build.pages) {
    lines.push(`    { file = ${luaString(`${LOVE2D_ATLAS_EXPORT_ROOT}/${page.file}`)}, width = ${page.width}, height = ${page.height} },`);
  }
  lines.push("  },", "  sprites = {");
  for (const [assetId, sprite] of Object.entries(build.sprites).sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`    [${luaString(assetId)}] = ${luaSprite(sprite)},`);
  }
  lines.push("  }", "}", "");
  return lines.join("\n");
}

export function createLove2dAtlasTextFiles(build: TextureAtlasBuildResult): Love2dAtlasTextFile[] {
  const baseName = build.atlasId.toLowerCase();
  return [
    {
      path: `${LOVE2D_ATLAS_EXPORT_ROOT}/${baseName}.json`,
      content: jsonManifest(build)
    },
    {
      path: `${LOVE2D_ATLAS_EXPORT_ROOT}/${baseName}.lua`,
      content: luaManifest(build)
    }
  ];
}
