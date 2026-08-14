import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  dataTableJsonSchema,
  dataTableRowSchema,
  systemDataTableSchema,
  type DataColumnDefinition,
  type DataTableRow,
  type SystemDataTable
} from "../shared/schemas";
import {
  TERRAIN_BIOME_PROFILE_COLUMNS,
  TERRAIN_BIOME_PROFILES_TABLE,
  TERRAIN_ROLE_COLUMNS,
  TERRAIN_ROLES_TABLE,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE,
  TERRAIN_TILESET_COLUMNS,
  TERRAIN_TILESETS_TABLE,
  TERRAIN_WFC_SAMPLE_COLUMNS,
  TERRAIN_WFC_SAMPLES_TABLE
} from "../shared/terrain-tables";
import {
  tiledBoardAuthoringSchema,
  tiledRoleSchema,
  type TiledBoardAuthoring,
  type TiledRole,
  type TiledSample,
  type TiledTilesetView
} from "../shared/tiled-samples";

function tablePath(projectPath: string, tableId: string): string {
  return path.join(path.resolve(projectPath), ".chisel", "tables", "system", `${tableId}.json`);
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

export async function readTerrainTable(projectPath: string, definition: SystemDataTable): Promise<SystemDataTable> {
  let content: string;
  try {
    content = await fs.readFile(tablePath(projectPath, definition.id), "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) return structuredClone(definition);
    throw error;
  }
  const stored = dataTableJsonSchema.parse(JSON.parse(content) as unknown).table;
  if (stored.id !== definition.id || stored.kind !== "system") {
    throw new Error(`System table '${definition.id}' contains the wrong table definition`);
  }
  return systemDataTableSchema.parse({
    ...definition,
    lastChangeAt: stored.lastChangeAt,
    rows: stored.rows,
    version: stored.version
  });
}

export async function writeTerrainTableRows(
  projectPath: string,
  definition: SystemDataTable,
  rows: DataTableRow[]
): Promise<SystemDataTable> {
  const current = await readTerrainTable(projectPath, definition);
  const table = systemDataTableSchema.parse({
    ...definition,
    lastChangeAt: new Date().toISOString(),
    rows,
    version: current.version + 1
  });
  const filePath = tablePath(projectPath, definition.id);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify({ schemaVersion: 1, table }, null, 2)}\n`, "utf8");
  return table;
}

function cell(row: DataTableRow, column: DataColumnDefinition): unknown {
  const stored = row.values.find((entry) => entry.columnId === column.id);
  if (!stored || stored.type !== column.type) {
    throw new Error(`System table row '${row.slug}' is missing '${column.name}'`);
  }
  return stored.value;
}

function stringCell(row: DataTableRow, column: DataColumnDefinition): string {
  const value = cell(row, column);
  if (typeof value !== "string") throw new Error(`System table row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function integerCell(row: DataTableRow, column: DataColumnDefinition): number {
  const value = cell(row, column);
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`System table row '${row.slug}' has invalid '${column.name}'`);
  }
  return value;
}

function booleanCell(row: DataTableRow, column: DataColumnDefinition): boolean {
  const value = cell(row, column);
  if (typeof value !== "boolean") throw new Error(`System table row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function rowValue(column: DataColumnDefinition, value: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value } as DataTableRow["values"][number];
}

function row(slug: string, values: DataTableRow["values"], existingId?: string): DataTableRow {
  return dataTableRowSchema.parse({ id: existingId ?? randomBytes(16).toString("base64url").slice(0, 21), slug, values });
}

export function tilesetRowSlug(boardId: string, tilesetId: string): string {
  return `${boardId}_${tilesetId}`;
}

export function sampleRowSlug(boardId: string, sampleSlug: string): string {
  return `${boardId}_${sampleSlug}`;
}

function bindingRowSlug(boardId: string, tilesetId: string, localId: number): string {
  return `${boardId}_${tilesetId}_${localId}`;
}

export async function readTerrainRoles(projectPath: string): Promise<TiledRole[]> {
  const table = await readTerrainTable(projectPath, TERRAIN_ROLES_TABLE);
  return table.rows.map((entry) =>
    tiledRoleSchema.parse({
      id: entry.slug,
      label: stringCell(entry, TERRAIN_ROLE_COLUMNS.label),
      color: stringCell(entry, TERRAIN_ROLE_COLUMNS.color)
    })
  );
}

export async function saveTerrainRoles(projectPath: string, roles: TiledRole[]): Promise<void> {
  const parsed = roles.map((role) => tiledRoleSchema.parse(role));
  const bindings = await readTerrainTable(projectPath, TERRAIN_TILE_BINDINGS_TABLE);
  const usedRoles = new Set(bindings.rows.map((entry) => stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.role)));
  const nextIds = new Set(parsed.map((role) => role.id));
  const removedUsedRole = [...usedRoles].find((roleId) => !nextIds.has(roleId));
  if (removedUsedRole) throw new Error(`Terrain role '${removedUsedRole}' is still used by tile bindings`);

  const current = await readTerrainTable(projectPath, TERRAIN_ROLES_TABLE);
  const ids = new Map(current.rows.map((entry) => [entry.slug, entry.id]));
  await writeTerrainTableRows(
    projectPath,
    TERRAIN_ROLES_TABLE,
    parsed.map((role) =>
      row(role.id, [rowValue(TERRAIN_ROLE_COLUMNS.label, role.label), rowValue(TERRAIN_ROLE_COLUMNS.color, role.color)], ids.get(role.id))
    )
  );
}

export async function readBoardAuthoring(projectPath: string, boardId: string): Promise<TiledBoardAuthoring> {
  const [bindings, samples] = await Promise.all([
    readTerrainTable(projectPath, TERRAIN_TILE_BINDINGS_TABLE),
    readTerrainTable(projectPath, TERRAIN_WFC_SAMPLES_TABLE)
  ]);
  const tileBindings: TiledBoardAuthoring["tileBindings"] = {};
  for (const entry of bindings.rows) {
    if (stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.boardId) !== boardId) continue;
    const tilesetRef = stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileset);
    const prefix = `${boardId}_`;
    if (!tilesetRef.startsWith(prefix)) throw new Error(`Tile binding '${entry.slug}' references a tileset on another board`);
    const tilesetId = tilesetRef.slice(prefix.length);
    const localId = integerCell(entry, TERRAIN_TILE_BINDING_COLUMNS.localId);
    const tags = cell(entry, TERRAIN_TILE_BINDING_COLUMNS.tags);
    if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
      throw new Error(`System table row '${entry.slug}' has invalid 'tags'`);
    }
    tileBindings[`${tilesetId}:${localId}`] = {
      slug: stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileSlug),
      roleId: stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.role),
      blocking: booleanCell(entry, TERRAIN_TILE_BINDING_COLUMNS.blocking),
      tags
    };
  }
  const boardSamples: TiledSample[] = samples.rows
    .filter((entry) => stringCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.boardId) === boardId)
    .map((entry) => {
      const layerIds = cell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.layerIds);
      if (!Array.isArray(layerIds) || layerIds.some((layerId) => typeof layerId !== "number" || !Number.isInteger(layerId))) {
        throw new Error(`System table row '${entry.slug}' has invalid 'layer_ids'`);
      }
      return {
        slug: stringCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.sampleSlug),
        layerIds,
        x: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.x),
        y: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.y),
        width: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.width),
        height: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.height),
        allowRotations: booleanCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.allowRotations),
        allowReflections: booleanCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.allowReflections)
      };
    });
  return tiledBoardAuthoringSchema.parse({ tileBindings, samples: boardSamples });
}

export async function saveBoardAuthoring(projectPath: string, boardId: string, authoring: TiledBoardAuthoring): Promise<void> {
  const parsed = tiledBoardAuthoringSchema.parse(authoring);
  const [bindings, samples, tilesets, profiles] = await Promise.all([
    readTerrainTable(projectPath, TERRAIN_TILE_BINDINGS_TABLE),
    readTerrainTable(projectPath, TERRAIN_WFC_SAMPLES_TABLE),
    readTerrainTable(projectPath, TERRAIN_TILESETS_TABLE),
    readTerrainTable(projectPath, TERRAIN_BIOME_PROFILES_TABLE)
  ]);
  const tilesetSlugs = new Set(tilesets.rows.map((entry) => entry.slug));
  const bindingIds = new Map(bindings.rows.map((entry) => [entry.slug, entry.id]));
  const nextBindingRows = bindings.rows.filter((entry) => stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.boardId) !== boardId);
  for (const [key, binding] of Object.entries(parsed.tileBindings)) {
    const match = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*):(\d+)$/.exec(key);
    if (!match) throw new Error(`Tile binding key '${key}' is invalid`);
    const [, tilesetId, localIdText] = match;
    const tileset = tilesetRowSlug(boardId, tilesetId);
    if (!tilesetSlugs.has(tileset)) throw new Error(`Tile binding '${key}' references missing managed tileset '${tilesetId}'`);
    const localId = Number(localIdText);
    const slug = bindingRowSlug(boardId, tilesetId, localId);
    nextBindingRows.push(
      row(
        slug,
        [
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.boardId, boardId),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileset, tileset),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.localId, localId),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileSlug, binding.slug),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.role, binding.roleId),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.blocking, binding.blocking),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tags, binding.tags)
        ],
        bindingIds.get(slug)
      )
    );
  }

  const sampleIds = new Map(samples.rows.map((entry) => [entry.slug, entry.id]));
  const nextSampleSlugs = new Set(parsed.samples.map((sample) => sampleRowSlug(boardId, sample.slug)));
  const removedSamples = samples.rows
    .filter((entry) => stringCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.boardId) === boardId)
    .map((entry) => entry.slug)
    .filter((slug) => !nextSampleSlugs.has(slug));
  const referencedRemoval = removedSamples.find((slug) =>
    profiles.rows.some((entry) => stringCell(entry, TERRAIN_BIOME_PROFILE_COLUMNS.sample) === slug)
  );
  if (referencedRemoval) throw new Error(`WFC sample '${referencedRemoval}' is still used by a biome profile`);
  const nextSampleRows = samples.rows.filter((entry) => stringCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.boardId) !== boardId);
  for (const sample of parsed.samples) {
    const slug = sampleRowSlug(boardId, sample.slug);
    nextSampleRows.push(
      row(
        slug,
        [
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.boardId, boardId),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.sampleSlug, sample.slug),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.layerIds, sample.layerIds),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.x, sample.x),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.y, sample.y),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.width, sample.width),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.height, sample.height),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.allowRotations, sample.allowRotations),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.allowReflections, sample.allowReflections)
        ],
        sampleIds.get(slug)
      )
    );
  }
  await writeTerrainTableRows(projectPath, TERRAIN_TILE_BINDINGS_TABLE, nextBindingRows);
  await writeTerrainTableRows(projectPath, TERRAIN_WFC_SAMPLES_TABLE, nextSampleRows);
}

export async function registerBoardTilesets(projectPath: string, boardId: string, tilesets: TiledTilesetView[]): Promise<void> {
  const current = await readTerrainTable(projectPath, TERRAIN_TILESETS_TABLE);
  const ids = new Map(current.rows.map((entry) => [entry.slug, entry.id]));
  const rows = current.rows.filter((entry) => stringCell(entry, TERRAIN_TILESET_COLUMNS.boardId) !== boardId);
  for (const tileset of tilesets) {
    const slug = tilesetRowSlug(boardId, tileset.id);
    rows.push(
      row(
        slug,
        [
          rowValue(TERRAIN_TILESET_COLUMNS.boardId, boardId),
          rowValue(TERRAIN_TILESET_COLUMNS.tilesetId, tileset.id),
          rowValue(TERRAIN_TILESET_COLUMNS.name, tileset.name)
        ],
        ids.get(slug)
      )
    );
  }
  await writeTerrainTableRows(projectPath, TERRAIN_TILESETS_TABLE, rows);
}

export async function removeTilesetTableRows(projectPath: string, boardId: string, tilesetId: string): Promise<void> {
  const tilesetSlug = tilesetRowSlug(boardId, tilesetId);
  const [tilesets, bindings] = await Promise.all([
    readTerrainTable(projectPath, TERRAIN_TILESETS_TABLE),
    readTerrainTable(projectPath, TERRAIN_TILE_BINDINGS_TABLE)
  ]);
  await writeTerrainTableRows(
    projectPath,
    TERRAIN_TILE_BINDINGS_TABLE,
    bindings.rows.filter((entry) => stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileset) !== tilesetSlug)
  );
  await writeTerrainTableRows(
    projectPath,
    TERRAIN_TILESETS_TABLE,
    tilesets.rows.filter((entry) => entry.slug !== tilesetSlug)
  );
}

export async function biomeProfilesForSamples(projectPath: string, sampleSlugs: Set<string>): Promise<string[]> {
  const profiles = await readTerrainTable(projectPath, TERRAIN_BIOME_PROFILES_TABLE);
  return profiles.rows
    .filter((entry) => sampleSlugs.has(stringCell(entry, TERRAIN_BIOME_PROFILE_COLUMNS.sample)))
    .map((entry) => `${stringCell(entry, TERRAIN_BIOME_PROFILE_COLUMNS.biome)} (${entry.slug})`);
}
