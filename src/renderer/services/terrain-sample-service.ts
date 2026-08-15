import { nanoid } from "nanoid";
import appStore from "@/stores/app-store";
import assetService from "@/services/asset-service";
import tableService from "@/services/table-service";
import { dataTableRowSchema, type DataColumnDefinition, type DataTableRow, type SystemDataTable } from "../../shared/schemas";
import {
  TERRAIN_APPROVED_PATCH_COLUMNS,
  TERRAIN_APPROVED_PATCHES_TABLE_ID,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE_ID,
  TERRAIN_TILESET_COLUMNS,
  TERRAIN_TILESETS_TABLE_ID,
  TERRAIN_WFC_SAMPLE_CELL_COLUMNS,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID,
  TERRAIN_WFC_SAMPLE_COLUMNS,
  TERRAIN_WFC_SAMPLES_TABLE_ID
} from "../../shared/terrain-tables";
import {
  terrainApprovedPatchSchema,
  terrainSampleSchema,
  terrainTileBindingSchema,
  terrainTileKey,
  type TerrainApprovedPatch,
  type TerrainTileBinding,
  type TerrainTilesetView,
  type TerrainWorkspaceView
} from "../../shared/terrain-authoring";
import { AssetCategoryEnum } from "../../shared/types";

function cell(row: DataTableRow, column: DataColumnDefinition): unknown {
  const stored = row.values.find((entry) => entry.columnId === column.id);
  if (!stored || stored.type !== column.type) throw new Error(`Terrain row '${row.slug}' is missing '${column.name}'`);
  return stored.value;
}

function stringCell(row: DataTableRow, column: DataColumnDefinition): string {
  const value = cell(row, column);
  if (typeof value !== "string") throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function integerCell(row: DataTableRow, column: DataColumnDefinition): number {
  const value = cell(row, column);
  if (typeof value !== "number" || !Number.isInteger(value)) throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function booleanCell(row: DataTableRow, column: DataColumnDefinition): boolean {
  const value = cell(row, column);
  if (typeof value !== "boolean") throw new Error(`Terrain row '${row.slug}' has invalid '${column.name}'`);
  return value;
}

function rowValue(column: DataColumnDefinition, value: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value } as DataTableRow["values"][number];
}

function row(slug: string, values: DataTableRow["values"], id?: string): DataTableRow {
  return dataTableRowSchema.parse({ id: id ?? nanoid(), slug, values });
}

function newCellSlug(): string {
  return `CELL_${nanoid()
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()}`;
}

class TerrainSampleService {
  private async systemTable(id: string): Promise<SystemDataTable> {
    const table = await tableService.getById(id);
    if (!table || table.kind !== "system") throw new Error(`Terrain system table '${id}' is missing`);
    return table;
  }

  public async load(): Promise<TerrainWorkspaceView> {
    const [assets, bindingsTable, samplesTable, cellsTable, approvedPatchesTable] = await Promise.all([
      assetService.getAllAssets(),
      this.systemTable(TERRAIN_TILE_BINDINGS_TABLE_ID),
      this.systemTable(TERRAIN_WFC_SAMPLES_TABLE_ID),
      this.systemTable(TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID),
      this.systemTable(TERRAIN_APPROVED_PATCHES_TABLE_ID)
    ]);
    const projectPath = appStore.getState().computed.project.path;
    const tilesets: TerrainTilesetView[] = assets
      .filter((asset) => asset.category === AssetCategoryEnum.tileset)
      .map((asset) => {
        if (!asset.tileSize) throw new Error(`Tileset asset '${asset.id}' is missing tile size`);
        return {
          id: asset.id,
          name: asset.name,
          tileSize: asset.tileSize,
          tileCount: (asset.width / asset.tileSize) * (asset.height / asset.tileSize),
          columns: asset.width / asset.tileSize,
          rows: asset.height / asset.tileSize,
          imageWidth: asset.width,
          imageHeight: asset.height,
          imagePath: `${projectPath}/${asset.relativePath}`
        };
      });
    const tileBindings: Record<string, TerrainTileBinding> = {};
    for (const entry of bindingsTable.rows) {
      const tilesetId = stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileset);
      const localId = integerCell(entry, TERRAIN_TILE_BINDING_COLUMNS.localId);
      const tags = cell(entry, TERRAIN_TILE_BINDING_COLUMNS.tags);
      if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
        throw new Error(`Terrain row '${entry.slug}' has invalid 'tags'`);
      }
      tileBindings[terrainTileKey(tilesetId, localId)] = terrainTileBindingSchema.parse({
        slug: stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileSlug),
        blocking: booleanCell(entry, TERRAIN_TILE_BINDING_COLUMNS.blocking),
        tags
      });
    }
    const samples = samplesTable.rows.map((entry) =>
      terrainSampleSchema.parse({
        slug: entry.slug,
        width: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.width),
        height: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.height),
        layerCount: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.layerCount),
        cells: Array.from(
          { length: integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.width) * integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.height) },
          () => Array(integerCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.layerCount)).fill(null)
        ),
        periodicInput: booleanCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.periodicInput),
        allowRotations: booleanCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.allowRotations),
        allowReflections: booleanCell(entry, TERRAIN_WFC_SAMPLE_COLUMNS.allowReflections)
      })
    );
    const samplesBySlug = new Map(samples.map((sample) => [sample.slug, sample]));
    const approvedPatches = approvedPatchesTable.rows.map((entry) =>
      terrainApprovedPatchSchema.parse({
        slug: entry.slug,
        biome: stringCell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.biome),
        category: stringCell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.category),
        weight: cell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.weight),
        width: integerCell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.width),
        height: integerCell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.height),
        layerCount: integerCell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.layerCount),
        cells: cell(entry, TERRAIN_APPROVED_PATCH_COLUMNS.cells)
      })
    );
    const problems: string[] = [];
    for (const entry of cellsTable.rows) {
      const sampleSlug = stringCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample);
      const sample = samplesBySlug.get(sampleSlug);
      const x = integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.x);
      const y = integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.y);
      const layer = integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.layer);
      if (!sample) {
        problems.push(`Painted cell '${entry.slug}' references missing sample '${sampleSlug}'`);
        continue;
      }
      if (x >= sample.width || y >= sample.height) {
        problems.push(`Painted cell '${entry.slug}' lies outside sample '${sampleSlug}'`);
        continue;
      }
      if (layer >= sample.layerCount) {
        problems.push(`Painted cell '${entry.slug}' uses missing layer ${layer} in sample '${sampleSlug}'`);
        continue;
      }
      const index = y * sample.width + x;
      if (sample.cells[index][layer]) {
        problems.push(`Sample '${sampleSlug}' has duplicate painted cell ${x},${y}, layer ${layer}`);
        continue;
      }
      sample.cells[index][layer] = {
        tilesetId: stringCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.tileset),
        localId: integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.localId),
        orientation: 0
      };
    }
    const bindingSlugs = new Map<string, number>();
    for (const [key, binding] of Object.entries(tileBindings)) {
      const [tilesetId, localIdText] = key.split(":");
      const tileset = tilesets.find((entry) => entry.id === tilesetId);
      if (!tileset || Number(localIdText) >= tileset.tileCount) problems.push(`Tile binding '${key}' is orphaned`);
      bindingSlugs.set(binding.slug, (bindingSlugs.get(binding.slug) ?? 0) + 1);
    }
    for (const [slug, count] of bindingSlugs) {
      if (count > 1) problems.push(`Tile metadata has duplicated tile slug '${slug}' (${count} uses)`);
    }
    for (const sample of samples) {
      const blankCount = sample.cells.filter((entry) => entry[0] === null).length;
      if (blankCount > 0) problems.push(`Sample '${sample.slug}' has ${blankCount} unpainted base cells`);
      for (const stack of sample.cells) {
        for (const painted of stack) {
          if (!painted) continue;
          const tileset = tilesets.find((entry) => entry.id === painted.tilesetId);
          if (!tileset || painted.localId >= tileset.tileCount) {
            problems.push(`Sample '${sample.slug}' uses missing tile '${painted.tilesetId}:${painted.localId}'`);
          }
        }
      }
    }
    return { tilesets, tileBindings, samples, approvedPatches, problems };
  }

  public async save(workspace: TerrainWorkspaceView): Promise<TerrainWorkspaceView> {
    const samples = workspace.samples.map((sample) => terrainSampleSchema.parse(sample));
    const [bindingsTable, samplesTable, cellsTable, runtimeTilesetsTable] = await Promise.all([
      this.systemTable(TERRAIN_TILE_BINDINGS_TABLE_ID),
      this.systemTable(TERRAIN_WFC_SAMPLES_TABLE_ID),
      this.systemTable(TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID),
      this.systemTable(TERRAIN_TILESETS_TABLE_ID)
    ]);

    const bindingIds = new Map(
      bindingsTable.rows.map((entry) => [
        terrainTileKey(stringCell(entry, TERRAIN_TILE_BINDING_COLUMNS.tileset), integerCell(entry, TERRAIN_TILE_BINDING_COLUMNS.localId)),
        entry.id
      ])
    );
    const bindingRows = Object.entries(workspace.tileBindings).map(([key, binding]) => {
      const separator = key.lastIndexOf(":");
      const tilesetId = key.slice(0, separator);
      const localId = Number(key.slice(separator + 1));
      const parsed = terrainTileBindingSchema.parse(binding);
      return row(
        parsed.slug,
        [
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileset, tilesetId),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.localId, localId),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tileSlug, parsed.slug),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.blocking, parsed.blocking),
          rowValue(TERRAIN_TILE_BINDING_COLUMNS.tags, parsed.tags)
        ],
        bindingIds.get(key)
      );
    });
    const sampleIds = new Map(samplesTable.rows.map((entry) => [entry.slug, entry.id]));
    const sampleRows = samples.map((sample) =>
      row(
        sample.slug,
        [
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.width, sample.width),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.height, sample.height),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.layerCount, sample.layerCount),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.periodicInput, sample.periodicInput),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.allowRotations, sample.allowRotations),
          rowValue(TERRAIN_WFC_SAMPLE_COLUMNS.allowReflections, sample.allowReflections)
        ],
        sampleIds.get(sample.slug)
      )
    );
    const existingCells = new Map(
      cellsTable.rows.map((entry) => [
        `${stringCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample)}:${integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.x)}:${integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.y)}:${integerCell(entry, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.layer)}`,
        entry
      ])
    );
    const cellRows = samples.flatMap((sample) =>
      sample.cells.flatMap((stack, index) => {
        const x = index % sample.width;
        const y = Math.floor(index / sample.width);
        return stack.flatMap((painted, layer) => {
          if (!painted) return [];
          const existing = existingCells.get(`${sample.slug}:${x}:${y}:${layer}`);
          return [
            row(
              existing?.slug ?? newCellSlug(),
              [
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample, sample.slug),
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.x, x),
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.y, y),
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.layer, layer),
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.tileset, painted.tilesetId),
                rowValue(TERRAIN_WFC_SAMPLE_CELL_COLUMNS.localId, painted.localId)
              ],
              existing?.id
            )
          ];
        });
      })
    );
    const runtimeTilesetIds = new Map(runtimeTilesetsTable.rows.map((entry) => [entry.slug, entry.id]));
    const runtimeTilesetRows = workspace.tilesets.map((tileset) =>
      row(
        tileset.id,
        [
          rowValue(TERRAIN_TILESET_COLUMNS.asset, tileset.id),
          rowValue(TERRAIN_TILESET_COLUMNS.tileSize, tileset.tileSize),
          rowValue(TERRAIN_TILESET_COLUMNS.columns, tileset.columns),
          rowValue(TERRAIN_TILESET_COLUMNS.rows, tileset.rows),
          rowValue(
            TERRAIN_TILESET_COLUMNS.tiles,
            Object.entries(workspace.tileBindings)
              .flatMap(([key, binding]) => {
                const separator = key.lastIndexOf(":");
                if (key.slice(0, separator) !== tileset.id) return [];
                return [{ localId: Number(key.slice(separator + 1)), ...terrainTileBindingSchema.parse(binding) }];
              })
              .sort((left, right) => left.localId - right.localId)
          )
        ],
        runtimeTilesetIds.get(tileset.id)
      )
    );
    await tableService.saveSystemTableRows(TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID, cellRows);
    await tableService.saveSystemTableRows(TERRAIN_WFC_SAMPLES_TABLE_ID, sampleRows);
    await tableService.saveSystemTableRows(TERRAIN_TILE_BINDINGS_TABLE_ID, bindingRows);
    await tableService.saveSystemTableRows(TERRAIN_TILESETS_TABLE_ID, runtimeTilesetRows);
    return this.load();
  }

  public async saveApprovedPatches(patches: TerrainApprovedPatch[]): Promise<TerrainWorkspaceView> {
    const parsedPatches = patches.map((patch) => terrainApprovedPatchSchema.parse(patch));
    const table = await this.systemTable(TERRAIN_APPROVED_PATCHES_TABLE_ID);
    const ids = new Map(table.rows.map((entry) => [entry.slug, entry.id]));
    const rows = parsedPatches.map((patch) =>
      row(
        patch.slug,
        [
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.biome, patch.biome),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.category, patch.category),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.weight, patch.weight),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.width, patch.width),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.height, patch.height),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.layerCount, patch.layerCount),
          rowValue(TERRAIN_APPROVED_PATCH_COLUMNS.cells, patch.cells)
        ],
        ids.get(patch.slug)
      )
    );
    await tableService.saveSystemTableRows(TERRAIN_APPROVED_PATCHES_TABLE_ID, rows);
    return this.load();
  }
}

const terrainSampleService = new TerrainSampleService();
export default terrainSampleService;
