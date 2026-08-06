import fs from "node:fs/promises";
import path from "node:path";
import {
  assetsJsonSchema,
  textureAtlasBuildInputSchema,
  textureAtlasDeleteInputSchema,
  textureAtlasDocumentSchema,
  textureAtlasProjectInputSchema,
  textureAtlasSaveInputSchema,
  type Asset,
  type TextureAtlasBuildInput,
  type TextureAtlasBuildResult,
  type TextureAtlasDocument,
  type TextureAtlasEntry,
  type TextureAtlasSpriteManifest
} from "../shared/schemas";
import { encodeSharpRgbaPng, processSharpAtlasSprite } from "./sharp-worker-client";

interface PreparedSprite {
  asset: Asset;
  data: Buffer;
  entry: TextureAtlasEntry;
  height: number;
  sourceHeight: number;
  sourceWidth: number;
  width: number;
}

interface Placement {
  page: number;
  sprite: PreparedSprite;
  x: number;
  y: number;
}

interface PageLayout {
  height: number;
  placements: Placement[];
  width: number;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function atlasesDirectory(projectPath: string): string {
  return path.join(projectPath, ".chisel", "atlases");
}

function atlasFilePath(projectPath: string, atlasId: string): string {
  return path.join(atlasesDirectory(projectPath), `${atlasId}.json`);
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
}

function tintBytes(data: Buffer, tint: string): void {
  const red = Number.parseInt(tint.slice(1, 3), 16) / 255;
  const green = Number.parseInt(tint.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(tint.slice(5, 7), 16) / 255;
  const alpha = Number.parseInt(tint.slice(7, 9), 16) / 255;
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = Math.round((data[offset] ?? 0) * red);
    data[offset + 1] = Math.round((data[offset + 1] ?? 0) * green);
    data[offset + 2] = Math.round((data[offset + 2] ?? 0) * blue);
    data[offset + 3] = Math.round((data[offset + 3] ?? 0) * alpha);
  }
}

function layoutSprites(sprites: PreparedSprite[], document: TextureAtlasDocument): PageLayout[] {
  const { maxPageWidth, maxPageHeight, padding, powerOfTwo } = document.settings;
  const pages: PageLayout[] = [];
  let page: PageLayout = { width: 1, height: 1, placements: [] };
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  function finishPage(): void {
    if (page.placements.length === 0) {
      return;
    }
    if (powerOfTwo) {
      page.width = nextPowerOfTwo(page.width);
      page.height = nextPowerOfTwo(page.height);
    }
    pages.push(page);
    page = { width: 1, height: 1, placements: [] };
    cursorX = 0;
    cursorY = 0;
    rowHeight = 0;
  }

  for (const sprite of sprites) {
    const cellWidth = sprite.width + padding * 2;
    const cellHeight = sprite.height + padding * 2;
    if (cellWidth > maxPageWidth || cellHeight > maxPageHeight) {
      throw new Error(
        `Atlas sprite ${sprite.asset.id} is ${sprite.width}x${sprite.height} and exceeds page bounds ${maxPageWidth}x${maxPageHeight}`
      );
    }
    if (cursorX + cellWidth > maxPageWidth) {
      cursorX = 0;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    if (cursorY + cellHeight > maxPageHeight) {
      finishPage();
    }

    const placement: Placement = {
      page: pages.length,
      sprite,
      x: cursorX + padding,
      y: cursorY + padding
    };
    page.placements.push(placement);
    cursorX += cellWidth;
    rowHeight = Math.max(rowHeight, cellHeight);
    page.width = Math.max(page.width, cursorX);
    page.height = Math.max(page.height, cursorY + cellHeight);
  }
  finishPage();
  return pages;
}

function copyPixel(source: Buffer, sourceOffset: number, target: Buffer, targetOffset: number): void {
  target[targetOffset] = source[sourceOffset] ?? 0;
  target[targetOffset + 1] = source[sourceOffset + 1] ?? 0;
  target[targetOffset + 2] = source[sourceOffset + 2] ?? 0;
  target[targetOffset + 3] = source[sourceOffset + 3] ?? 0;
}

function renderPage(page: PageLayout, extrusion: number): Buffer {
  const data = Buffer.alloc(page.width * page.height * 4);
  for (const placement of page.placements) {
    const { sprite, x, y } = placement;
    for (let targetY = y - extrusion; targetY < y + sprite.height + extrusion; targetY += 1) {
      for (let targetX = x - extrusion; targetX < x + sprite.width + extrusion; targetX += 1) {
        const sourceX = Math.max(0, Math.min(sprite.width - 1, targetX - x));
        const sourceY = Math.max(0, Math.min(sprite.height - 1, targetY - y));
        const sourceOffset = (sourceY * sprite.width + sourceX) * 4;
        const targetOffset = (targetY * page.width + targetX) * 4;
        copyPixel(sprite.data, sourceOffset, data, targetOffset);
      }
    }
  }
  return data;
}

async function readAssets(projectPath: string): Promise<Asset[]> {
  const filePath = path.join(projectPath, ".chisel", "assets.json");
  try {
    return assetsJsonSchema.parse(JSON.parse(await fs.readFile(filePath, "utf8"))).assets;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
}

function managedAssetPath(projectPath: string, asset: Asset): string {
  const resolved = path.resolve(projectPath, ...asset.relativePath.split("/"));
  const relative = path.relative(projectPath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset ${asset.id} resolves outside the project`);
  }
  return resolved;
}

async function prepareSprites(projectPath: string, document: TextureAtlasDocument): Promise<PreparedSprite[]> {
  const assets = await readAssets(projectPath);
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  const entries = [...document.entries].sort((left, right) => left.assetId.localeCompare(right.assetId));
  return Promise.all(
    entries.map(async (entry) => {
      const asset = assetsById.get(entry.assetId);
      if (!asset) {
        throw new Error(`Atlas ${document.id} references missing asset ${entry.assetId}`);
      }
      const result = await processSharpAtlasSprite(managedAssetPath(projectPath, asset), entry);
      if (entry.tintMode === "baked") {
        tintBytes(result.data, entry.tint);
      }
      return { asset, entry, ...result };
    })
  );
}

export async function listTextureAtlases(input: { projectPath: string }): Promise<TextureAtlasDocument[]> {
  const request = textureAtlasProjectInputSchema.parse(input);
  const projectPath = path.resolve(request.projectPath);
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(atlasesDirectory(projectPath), { withFileTypes: true });
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return [];
    }
    throw error;
  }
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) =>
        textureAtlasDocumentSchema.parse(JSON.parse(await fs.readFile(path.join(atlasesDirectory(projectPath), entry.name), "utf8")))
      )
  );
  return documents.sort((left, right) => left.id.localeCompare(right.id));
}

export async function saveTextureAtlas(input: { projectPath: string; document: TextureAtlasDocument }): Promise<TextureAtlasDocument> {
  const request = textureAtlasSaveInputSchema.parse(input);
  const projectPath = path.resolve(request.projectPath);
  await fs.mkdir(atlasesDirectory(projectPath), { recursive: true });
  await fs.writeFile(atlasFilePath(projectPath, request.document.id), `${JSON.stringify(request.document, null, 2)}\n`, "utf8");
  return request.document;
}

export async function deleteTextureAtlas(input: { projectPath: string; atlasId: string }): Promise<void> {
  const request = textureAtlasDeleteInputSchema.parse(input);
  await fs.rm(atlasFilePath(path.resolve(request.projectPath), request.atlasId), { force: true });
}

export async function buildTextureAtlas(input: TextureAtlasBuildInput): Promise<TextureAtlasBuildResult> {
  const request = textureAtlasBuildInputSchema.parse(input);
  if (request.document.entries.length === 0) {
    throw new Error(`Atlas ${request.document.id} has no entries`);
  }
  const projectPath = path.resolve(request.projectPath);
  const sprites = await prepareSprites(projectPath, request.document);
  const pageLayouts = layoutSprites(sprites, request.document);
  const pages = await Promise.all(
    pageLayouts.map(async (page, index) => {
      const png = await encodeSharpRgbaPng(renderPage(page, request.document.settings.extrusion), page.width, page.height);
      return {
        file: `${request.document.id.toLowerCase()}_${index}.png`,
        width: page.width,
        height: page.height,
        dataUrl: `data:image/png;base64,${png.toString("base64")}`
      };
    })
  );
  const spritesManifest: Record<string, TextureAtlasSpriteManifest> = {};
  for (const page of pageLayouts) {
    for (const placement of page.placements) {
      const { asset, entry, sourceHeight, sourceWidth, width, height } = placement.sprite;
      spritesManifest[asset.id] = {
        assetId: asset.id,
        page: placement.page,
        x: placement.x,
        y: placement.y,
        width,
        height,
        sourceWidth,
        sourceHeight,
        pivotX: entry.pivotX,
        pivotY: entry.pivotY,
        rotated: false,
        tintMode: entry.tintMode,
        tint: entry.tint
      };
    }
  }
  return { atlasId: request.document.id, pages, sprites: spritesManifest };
}
