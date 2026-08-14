import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parseTiledXml, renderTiledMapXml, renderTiledTilesetXml } from "./tiled-xml";
import {
  defaultTiledWorkspaceConfig,
  emptyTiledBoardEnrichment,
  tiledBoardEnrichmentSchema,
  tiledBoardInputSchema,
  tiledImportBoardInputSchema,
  tiledProjectInputSchema,
  tiledSaveConfigInputSchema,
  tiledSaveEnrichmentInputSchema,
  tiledWorkspaceConfigSchema,
  type TiledBoardEnrichment,
  type TiledBoardView,
  type TiledImportBoardInput,
  type TiledLayerView,
  type TiledSaveConfigInput,
  type TiledSaveEnrichmentInput,
  type TiledSourceSnapshot,
  type TiledTilesetView,
  type TiledWorkspaceConfig,
  type TiledWorkspaceView
} from "../shared/tiled-samples";

const horizontalFlipFlag = 0x80000000;
const verticalFlipFlag = 0x40000000;
const diagonalFlipFlag = 0x20000000;
const hexagonalRotationFlag = 0x10000000;
const gidMask = 0x0fffffff;

interface JsonObject {
  [key: string]: unknown;
}

interface ManagedTileset {
  raw: JsonObject;
  sourcePath: string;
  view: TiledTilesetView;
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function object(value: unknown, label: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value as JsonObject;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    throw new Error(`${label} must be an integer greater than or equal to ${minimum}`);
  }
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function booleanOr(value: unknown, fallback: boolean, label: string): boolean {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
  return value;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function slug(value: string, label: string): string {
  const result = value
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  if (!result || !/^[A-Z]/.test(result)) {
    throw new Error(`${label} must contain a letter and produce a CONSTANT_CASE id`);
  }
  return result;
}

function projectRoot(projectPath: string): string {
  return path.resolve(projectPath);
}

function tiledRoot(projectPath: string): string {
  return path.join(projectRoot(projectPath), ".chisel", "tiled");
}

function configPath(projectPath: string): string {
  return path.join(projectRoot(projectPath), ".chisel", "tiled.json");
}

function boardRoot(projectPath: string, boardId: string): string {
  return path.join(tiledRoot(projectPath), boardId);
}

function assertWithin(root: string, candidate: string, label: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes its managed directory`);
  }
  return resolved;
}

async function readJson(filePath: string): Promise<JsonObject> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      throw new Error(`Missing required file: ${filePath}`, { cause: error });
    }
    throw error;
  }
  try {
    return object(JSON.parse(content) as unknown, filePath);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in ${filePath}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

async function readTiledXmlDocument(filePath: string): Promise<JsonObject> {
  let content: string;
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) throw new Error(`Missing required file: ${filePath}`, { cause: error });
    throw error;
  }
  if (!content.trimStart().startsWith("<")) throw new Error(`${filePath} must contain native Tiled XML`);
  return object(parseTiledXml(content), filePath);
}

function assertExtension(filePath: string, extension: ".tmx" | ".tsx", label: string): void {
  if (path.extname(filePath).toLowerCase() !== extension) throw new Error(`${label} must use the '${extension}' extension`);
}

async function assertPng(filePath: string): Promise<void> {
  const signature = (await fs.readFile(filePath)).subarray(0, 8);
  const expected = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!signature.equals(expected)) throw new Error(`Tileset image '${filePath}' must contain PNG data`);
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function sha256(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");
}

async function readConfig(projectPath: string): Promise<TiledWorkspaceConfig> {
  try {
    return tiledWorkspaceConfigSchema.parse(await readJson(configPath(projectPath)));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required file:")) {
      await writeJson(configPath(projectPath), defaultTiledWorkspaceConfig);
      return structuredClone(defaultTiledWorkspaceConfig);
    }
    throw error;
  }
}

async function readEnrichment(projectPath: string, boardId: string): Promise<TiledBoardEnrichment> {
  const filePath = path.join(boardRoot(projectPath, boardId), "enrichment.json");
  try {
    return tiledBoardEnrichmentSchema.parse(await readJson(filePath));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing required file:")) {
      await writeJson(filePath, emptyTiledBoardEnrichment);
      return structuredClone(emptyTiledBoardEnrichment);
    }
    throw error;
  }
}

function validateMapHeader(raw: JsonObject): { width: number; height: number; tileWidth: number; tileHeight: number } {
  if (raw.type !== "map") {
    throw new Error("Tiled board must have type 'map'");
  }
  if (raw.orientation !== "orthogonal") {
    throw new Error("Only orthogonal Tiled maps are supported");
  }
  if (booleanOr(raw.infinite, false, "map.infinite")) {
    throw new Error("Infinite or chunked Tiled maps are not supported");
  }
  if (raw.renderorder !== undefined && raw.renderorder !== "right-down") {
    throw new Error("Only Tiled's right-down render order is supported");
  }
  return {
    width: integer(raw.width, "map.width", 1),
    height: integer(raw.height, "map.height", 1),
    tileWidth: integer(raw.tilewidth, "map.tilewidth", 1),
    tileHeight: integer(raw.tileheight, "map.tileheight", 1)
  };
}

async function parseTileset(
  boardDirectory: string,
  mapEntry: JsonObject,
  mapTileWidth: number,
  mapTileHeight: number
): Promise<ManagedTileset> {
  const firstGid = integer(mapEntry.firstgid, "tileset.firstgid", 1);
  if (mapEntry.source === undefined) {
    throw new Error("Inline Tiled tilesets are not supported; save every tileset as an external Tiled tileset file");
  }
  const source = string(mapEntry.source, "tileset.source");
  const sourcePath = assertWithin(boardDirectory, path.resolve(boardDirectory, source), `Tileset '${source}'`);
  assertExtension(sourcePath, ".tsx", `Tileset '${source}'`);
  const raw = await readTiledXmlDocument(sourcePath);
  if (raw.type !== "tileset") {
    throw new Error(`Tileset '${source}' must have type 'tileset'`);
  }
  if (raw.tileoffset !== undefined) {
    const offset = object(raw.tileoffset, `${source}.tileoffset`);
    if (integer(offset.x ?? 0, `${source}.tileoffset.x`) !== 0 || integer(offset.y ?? 0, `${source}.tileoffset.y`) !== 0) {
      throw new Error(`Tileset '${source}' uses tile offsets, which are not supported`);
    }
  }
  const tileWidth = integer(raw.tilewidth, `${source}.tilewidth`, 1);
  const tileHeight = integer(raw.tileheight, `${source}.tileheight`, 1);
  if (tileWidth !== mapTileWidth || tileHeight !== mapTileHeight) {
    throw new Error(`Tileset '${source}' tile dimensions must match the map grid`);
  }
  const tileCount = integer(raw.tilecount, `${source}.tilecount`, 1);
  const columns = integer(raw.columns, `${source}.columns`, 1);
  const margin = integer(raw.margin ?? 0, `${source}.margin`);
  const spacing = integer(raw.spacing ?? 0, `${source}.spacing`);
  const image = string(raw.image, `${source}.image`);
  if (raw.tiles !== undefined) {
    for (const [index, tileValue] of array(raw.tiles, `${source}.tiles`).entries()) {
      const tile = object(tileValue, `${source}.tiles[${index}]`);
      if (tile.image !== undefined) {
        throw new Error(`Tileset '${source}' is an image collection; only a single spritesheet is supported`);
      }
      if (tile.animation !== undefined) {
        throw new Error(`Tileset '${source}' contains animation, which is not supported`);
      }
    }
  }
  const imageWidth = integer(raw.imagewidth, `${source}.imagewidth`, 1);
  const imageHeight = integer(raw.imageheight, `${source}.imageheight`, 1);
  const expectedColumns = Math.floor((imageWidth - margin * 2 + spacing) / (tileWidth + spacing));
  const expectedRows = Math.floor((imageHeight - margin * 2 + spacing) / (tileHeight + spacing));
  if (columns !== expectedColumns || tileCount > expectedColumns * expectedRows) {
    throw new Error(`Tileset '${source}' spritesheet dimensions do not match its tile grid`);
  }
  const imagePath = assertWithin(boardDirectory, path.resolve(path.dirname(sourcePath), image), `Tileset image '${image}'`);
  await assertPng(imagePath);
  const id = slug(path.basename(source, path.extname(source)), `Tileset '${source}'`);
  return {
    raw,
    sourcePath,
    view: {
      id,
      name: typeof raw.name === "string" && raw.name.length > 0 ? raw.name : id,
      firstGid,
      tileWidth,
      tileHeight,
      tileCount,
      columns,
      margin,
      spacing,
      imageWidth,
      imageHeight,
      imagePath,
      imageHash: await sha256(imagePath)
    }
  };
}

function parseLayers(raw: JsonObject, width: number, height: number): TiledLayerView[] {
  return array(raw.layers, "map.layers").map((layerValue, index) => {
    const layer = object(layerValue, `map.layers[${index}]`);
    if (layer.type !== "tilelayer") {
      throw new Error(
        `Layer '${String(layer.name ?? index)}' has unsupported type '${String(layer.type)}'; only tile layers are supported`
      );
    }
    if (layer.chunks !== undefined || !Array.isArray(layer.data)) {
      throw new Error(`Layer '${String(layer.name ?? index)}' must use a raw integer data array`);
    }
    if (layer.encoding !== undefined || layer.compression !== undefined) {
      throw new Error(`Layer '${String(layer.name ?? index)}' uses encoded or compressed data, which is not supported`);
    }
    for (const field of ["x", "y", "offsetx", "offsety"] as const) {
      if (layer[field] !== undefined && finiteNumber(layer[field], `layer.${field}`) !== 0) {
        throw new Error(`Layer '${String(layer.name ?? index)}' uses an offset, which is not supported`);
      }
    }
    if (integer(layer.width, "layer.width", 1) !== width || integer(layer.height, "layer.height", 1) !== height) {
      throw new Error(`Layer '${String(layer.name ?? index)}' dimensions must match the map`);
    }
    const data = layer.data.map((gid, cellIndex) => {
      const parsed = integer(gid, `layer.data[${cellIndex}]`);
      if (parsed > 0xffffffff) throw new Error(`layer.data[${cellIndex}] exceeds Tiled's 32-bit global tile id range`);
      return parsed;
    });
    if (data.length !== width * height) {
      throw new Error(`Layer '${String(layer.name ?? index)}' data length does not match the map dimensions`);
    }
    return {
      id: integer(layer.id, `layer[${index}].id`),
      name: typeof layer.name === "string" && layer.name.length > 0 ? layer.name : `Layer ${index + 1}`,
      visible: booleanOr(layer.visible, true, `layer[${index}].visible`),
      opacity: layer.opacity === undefined ? 1 : finiteNumber(layer.opacity, `layer[${index}].opacity`),
      data
    };
  });
}

function validateGids(layers: TiledLayerView[], tilesets: TiledTilesetView[]): void {
  const ordered = [...tilesets].sort((a, b) => a.firstGid - b.firstGid);
  for (const layer of layers) {
    for (const encodedGid of layer.data) {
      const unsigned = encodedGid >>> 0;
      if ((unsigned & hexagonalRotationFlag) !== 0) {
        throw new Error(`Layer '${layer.name}' uses the unsupported hexagonal rotation flag`);
      }
      const gid = unsigned & gidMask;
      if (gid === 0) {
        continue;
      }
      const tileset = [...ordered].reverse().find((entry) => entry.firstGid <= gid);
      if (!tileset || gid - tileset.firstGid >= tileset.tileCount) {
        throw new Error(`Layer '${layer.name}' references unknown global tile id ${gid}`);
      }
    }
  }
}

function enrichmentProblems(
  enrichment: TiledBoardEnrichment,
  config: TiledWorkspaceConfig,
  board: Pick<TiledBoardView, "width" | "height" | "layers" | "tilesets">
): string[] {
  const problems: string[] = [];
  const roleIds = new Set(config.roles.map((entry) => entry.id));
  const layerIds = new Set(board.layers.map((entry) => entry.id));
  const tileKeys = new Set(
    board.tilesets.flatMap((tileset) => Array.from({ length: tileset.tileCount }, (_, id) => `${tileset.id}:${id}`))
  );
  const slugs = new Set<string>();
  for (const key of tileKeys) {
    if (!enrichment.tileBindings[key]) problems.push(`Tile '${key}' needs a slug and role`);
  }
  for (const [key, binding] of Object.entries(enrichment.tileBindings)) {
    if (!tileKeys.has(key)) problems.push(`Tile binding '${key}' is orphaned`);
    if (!roleIds.has(binding.roleId)) problems.push(`Tile '${binding.slug}' uses missing role '${binding.roleId}'`);
    if (slugs.has(binding.slug)) problems.push(`Tile slug '${binding.slug}' is duplicated`);
    slugs.add(binding.slug);
  }
  for (const sample of enrichment.samples) {
    if (sample.x + sample.width > board.width || sample.y + sample.height > board.height) {
      problems.push(`Sample '${sample.id}' extends outside the board`);
    }
    for (const layerId of sample.layerIds) {
      if (!layerIds.has(layerId)) problems.push(`Sample '${sample.id}' uses missing layer ${layerId}`);
    }
  }
  for (let left = 0; left < enrichment.samples.length; left += 1) {
    for (let right = left + 1; right < enrichment.samples.length; right += 1) {
      const a = enrichment.samples[left];
      const b = enrichment.samples[right];
      const overlaps = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
      if (overlaps) problems.push(`Samples '${a.id}' and '${b.id}' overlap`);
    }
  }
  return problems;
}

async function loadBoard(projectPath: string, entry: { id: string; name: string }, config: TiledWorkspaceConfig): Promise<TiledBoardView> {
  const directory = boardRoot(projectPath, entry.id);
  const raw = await readTiledXmlDocument(path.join(directory, "map.tmx"));
  const header = validateMapHeader(raw);
  const mapTilesets = array(raw.tilesets, "map.tilesets");
  if (mapTilesets.length === 0) {
    throw new Error(`Board '${entry.id}' has no tilesets`);
  }
  const managedTilesets = await Promise.all(
    mapTilesets.map((value, index) => parseTileset(directory, object(value, `map.tilesets[${index}]`), header.tileWidth, header.tileHeight))
  );
  const tilesets = managedTilesets.map((entry) => entry.view);
  if (new Set(tilesets.map((tileset) => tileset.id)).size !== tilesets.length) {
    throw new Error(`Board '${entry.id}' contains tilesets with colliding managed ids`);
  }
  const layers = parseLayers(raw, header.width, header.height);
  validateGids(layers, tilesets);
  const enrichment = await readEnrichment(projectPath, entry.id);
  const board: TiledBoardView = { ...entry, ...header, layers, tilesets, enrichment, problems: [] };
  board.problems = enrichmentProblems(enrichment, config, board);
  return board;
}

async function readSourceTilesets(
  sourcePath: string,
  map: JsonObject
): Promise<Array<{ mapEntry: JsonObject; raw: JsonObject; path: string; imagePath: string }>> {
  const directory = path.dirname(sourcePath);
  return Promise.all(
    array(map.tilesets, "map.tilesets").map(async (value, index) => {
      const mapEntry = object(value, `map.tilesets[${index}]`);
      if (mapEntry.source === undefined) {
        throw new Error("Inline Tiled tilesets are not supported; save every tileset as an external Tiled tileset file");
      }
      const tilesetPath = path.resolve(directory, string(mapEntry.source, `map.tilesets[${index}].source`));
      assertExtension(tilesetPath, ".tsx", `Tileset '${String(mapEntry.source)}'`);
      const raw = await readTiledXmlDocument(tilesetPath);
      const imagePath = path.resolve(path.dirname(tilesetPath), string(raw.image, `${tilesetPath}.image`));
      return { mapEntry, raw, path: tilesetPath, imagePath };
    })
  );
}

export async function importTiledBoard(input: TiledImportBoardInput): Promise<TiledWorkspaceView> {
  const request = tiledImportBoardInputSchema.parse(input);
  const config = await readConfig(request.projectPath);
  if (config.boards.some((entry) => entry.id === request.boardId)) {
    throw new Error(`Board '${request.boardId}' already exists`);
  }
  assertExtension(request.sourcePath, ".tmx", "Tiled map");
  const sourceMap = await readTiledXmlDocument(request.sourcePath);
  validateMapHeader(sourceMap);
  const sourceTilesets = await readSourceTilesets(request.sourcePath, sourceMap);
  const staging = path.join(tiledRoot(request.projectPath), `.import-${request.boardId}-${randomUUID()}`);
  const destination = boardRoot(request.projectPath, request.boardId);
  let destinationCreated = false;
  let configWritten = false;
  try {
    await fs.access(destination);
    throw new Error(`Managed board directory '${request.boardId}' already exists but is not registered`);
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) throw error;
  }
  await fs.mkdir(staging, { recursive: true });
  try {
    const managedMap = structuredClone(sourceMap);
    const managedEntries = array(managedMap.tilesets, "map.tilesets");
    const usedIds = new Set<string>();
    for (const [index, sourceTileset] of sourceTilesets.entries()) {
      const tilesetName = typeof sourceTileset.raw.name === "string" ? sourceTileset.raw.name : path.basename(sourceTileset.path, ".tsx");
      const tilesetId = slug(tilesetName, `Tileset ${index + 1}`);
      if (usedIds.has(tilesetId)) throw new Error(`Tileset id '${tilesetId}' is duplicated`);
      usedIds.add(tilesetId);
      await assertPng(sourceTileset.imagePath);
      const imageName = `${tilesetId}.png`;
      const managedTsx = structuredClone(sourceTileset.raw);
      managedTsx.image = `../images/${tilesetId}/${imageName}`;
      const tsxRelative = `tilesets/${tilesetId}.tsx`;
      object(managedEntries[index], `map.tilesets[${index}]`).source = tsxRelative;
      await fs.mkdir(path.dirname(path.join(staging, tsxRelative)), { recursive: true });
      await fs.writeFile(path.join(staging, tsxRelative), renderTiledTilesetXml(managedTsx), "utf8");
      const imageDestination = path.join(staging, "images", tilesetId, imageName);
      await fs.mkdir(path.dirname(imageDestination), { recursive: true });
      await fs.copyFile(sourceTileset.imagePath, imageDestination);
    }
    await fs.writeFile(path.join(staging, "map.tmx"), renderTiledMapXml(managedMap), "utf8");
    await writeJson(path.join(staging, "enrichment.json"), emptyTiledBoardEnrichment);
    await fs.rename(staging, destination);
    destinationCreated = true;
    const nextConfig = tiledWorkspaceConfigSchema.parse({
      ...config,
      boards: [...config.boards, { id: request.boardId, name: request.name }]
    });
    await loadBoard(request.projectPath, { id: request.boardId, name: request.name }, nextConfig);
    await writeJson(configPath(request.projectPath), nextConfig);
    configWritten = true;
    return loadTiledWorkspace({ projectPath: request.projectPath });
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true });
    if (destinationCreated) await fs.rm(destination, { recursive: true, force: true });
    if (configWritten) await writeJson(configPath(request.projectPath), config);
    throw error;
  }
}

export async function loadTiledWorkspace(input: { projectPath: string }): Promise<TiledWorkspaceView> {
  const request = tiledProjectInputSchema.parse(input);
  const config = await readConfig(request.projectPath);
  const boards = await Promise.all(config.boards.map((entry) => loadBoard(request.projectPath, entry, config)));
  return { config, boards };
}

export async function reloadTiledBoard(input: { projectPath: string; boardId: string }): Promise<TiledBoardView> {
  const request = tiledBoardInputSchema.parse(input);
  const config = await readConfig(request.projectPath);
  const entry = config.boards.find((board) => board.id === request.boardId);
  if (!entry) throw new Error(`Board '${request.boardId}' does not exist`);
  return loadBoard(request.projectPath, entry, config);
}

export async function saveTiledConfig(input: TiledSaveConfigInput): Promise<TiledWorkspaceView> {
  const request = tiledSaveConfigInputSchema.parse(input);
  const existing = await readConfig(request.projectPath);
  const existingIds = new Set(existing.boards.map((entry) => entry.id));
  const nextIds = new Set(request.config.boards.map((entry) => entry.id));
  if (existingIds.size !== nextIds.size || [...existingIds].some((id) => !nextIds.has(id))) {
    throw new Error("Board registry entries are managed by board import and cannot be changed in role settings");
  }
  await writeJson(configPath(request.projectPath), request.config);
  return loadTiledWorkspace({ projectPath: request.projectPath });
}

export async function saveTiledEnrichment(input: TiledSaveEnrichmentInput): Promise<TiledBoardView> {
  const request = tiledSaveEnrichmentInputSchema.parse(input);
  const config = await readConfig(request.projectPath);
  const entry = config.boards.find((board) => board.id === request.boardId);
  if (!entry) throw new Error(`Board '${request.boardId}' does not exist`);
  await writeJson(path.join(boardRoot(request.projectPath, request.boardId), "enrichment.json"), request.enrichment);
  return loadBoard(request.projectPath, entry, config);
}

async function listFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return result;
    throw error;
  }
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listFiles(child)));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

export async function snapshotTiledWorkspace(input: { projectPath: string }): Promise<TiledSourceSnapshot> {
  const request = tiledProjectInputSchema.parse(input);
  const config = await readConfig(request.projectPath);
  const root = path.join(projectRoot(request.projectPath), ".chisel");
  const files = await listFiles(tiledRoot(request.projectPath));
  const sourceFiles = files.filter((file) => [".tmx", ".tsx", ".json"].includes(path.extname(file).toLowerCase())).sort();
  const images = files.filter((file) => path.extname(file).toLowerCase() === ".png").sort();
  return {
    config,
    files: await Promise.all(
      sourceFiles.map(async (file) => ({
        path: path.relative(root, file).split(path.sep).join("/"),
        content: await fs.readFile(file, "utf8")
      }))
    ),
    images: await Promise.all(
      images.map(async (file) => ({ path: path.relative(root, file).split(path.sep).join("/"), sha256: await sha256(file) }))
    )
  };
}

export async function restoreTiledWorkspace(input: { projectPath: string; snapshot: TiledSourceSnapshot }): Promise<TiledWorkspaceView> {
  const request = tiledProjectInputSchema.parse({ projectPath: input.projectPath });
  const root = path.join(projectRoot(request.projectPath), ".chisel");
  for (const image of input.snapshot.images) {
    const imagePath = assertWithin(root, path.join(root, image.path), `Snapshot image '${image.path}'`);
    try {
      if ((await sha256(imagePath)) !== image.sha256) throw new Error(`Managed Tiled image '${image.path}' has changed since this commit`);
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) throw new Error(`Managed Tiled image '${image.path}' is missing`, { cause: error });
      throw error;
    }
  }
  for (const file of await listFiles(tiledRoot(request.projectPath))) {
    if (path.extname(file).toLowerCase() !== ".png") await fs.rm(file, { force: true });
  }
  for (const file of input.snapshot.files) {
    const filePath = assertWithin(root, path.join(root, file.path), `Snapshot file '${file.path}'`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, file.content, "utf8");
  }
  await writeJson(configPath(request.projectPath), input.snapshot.config);
  return loadTiledWorkspace(request);
}

export const tiledFlipFlags = {
  horizontal: horizontalFlipFlag,
  vertical: verticalFlipFlag,
  diagonal: diagonalFlipFlag,
  gidMask
} as const;
