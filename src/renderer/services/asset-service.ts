import fileService from "@/services/file-service";
import BaseService from "@/services/base-service";
import appStore from "@/stores/app-store";
import {
  assetCategoryForExtension,
  assetSchema,
  addAssetSchema,
  type AnyDataTable,
  type Asset,
  type AddAsset,
  type DataTableRow
} from "../../shared/schemas";
import { assetSlug, chiselAssetRelativePath } from "../../shared/asset-paths";
import { findAssetReferences, findTableReferences } from "../../shared/project-validation";
import tableService from "@/services/table-service";
import {
  TERRAIN_APPROVED_PATCH_COLUMNS,
  TERRAIN_APPROVED_PATCHES_TABLE_ID,
  TERRAIN_TILE_BINDING_COLUMNS,
  TERRAIN_TILE_BINDINGS_TABLE_ID,
  TERRAIN_TILESETS_TABLE_ID,
  TERRAIN_WFC_SAMPLE_CELL_COLUMNS,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID,
  TERRAIN_WFC_SAMPLES_TABLE_ID
} from "../../shared/terrain-tables";
import { AssetCategoryEnum } from "../../shared/types";

function rowStringValue(row: DataTableRow, columnId: string): string {
  const value = row.values.find((entry) => entry.columnId === columnId)?.value;
  if (typeof value !== "string") throw new Error(`Terrain row is missing required column '${columnId}'`);
  return value;
}

function approvedPatchUsesTileset(row: DataTableRow, assetId: string): boolean {
  const cells = row.values.find((entry) => entry.columnId === TERRAIN_APPROVED_PATCH_COLUMNS.cells.id)?.value;
  if (!Array.isArray(cells)) throw new Error(`Approved terrain patch '${row.slug}' has invalid cells`);
  return cells.some(
    (stack) =>
      Array.isArray(stack) &&
      stack.some((tile) => typeof tile === "object" && tile !== null && "tilesetId" in tile && tile.tilesetId === assetId)
  );
}

class AssetService extends BaseService {
  private static schemaVersion: number = 1;

  public async getAllAssets(): Promise<Asset[]> {
    return (await fileService.tryReadAssetsJson(this.getPath()))?.assets ?? [];
  }

  public async getAsset(assetId: string): Promise<Asset> {
    const assets = await this.getAllAssets();
    return assets.find((a) => a.id === assetId)!;
  }

  public async copyAssetFile(sourcePath: string, asset: Asset): Promise<void> {
    await fileService.copyProjectFile(appStore.getState().computed.project, sourcePath, asset.relativePath);
  }

  public async addAsset(input: AddAsset): Promise<Asset> {
    const assets = await this.getAllAssets();
    const parsed = addAssetSchema.parse(input);
    const name = assetSlug(parsed.name);
    const category = assetCategoryForExtension(parsed.extension, parsed.category);
    const relativePath = chiselAssetRelativePath(category, name, parsed.extension);
    const existing = assets.find((entry) => entry.id === name || entry.relativePath === relativePath);
    if (existing) {
      throw new Error(`Asset slug ${name} already exists`);
    }
    const asset = assetSchema.parse({ ...parsed, category, id: name, name, relativePath });
    await fileService.writeAssetsJson(appStore.getState().computed.project, {
      schemaVersion: AssetService.schemaVersion,
      assets: [...assets, asset]
    });
    return asset;
  }

  public async replaceAssetSource(assetId: string, sourcePath: string): Promise<Asset> {
    return window.electron.replaceAssetSource({
      projectPath: appStore.getState().computed.project.path,
      assetId,
      sourcePath
    });
  }

  public async updateAsset(assetId: string, asset: Asset): Promise<void> {
    const assets = await this.getAllAssets();
    const existing = assets.find((entry) => entry.id === assetId);
    if (!existing) {
      throw new Error(`Asset ${assetId} does not exist`);
    }
    const slug = assetSlug(asset.name);
    const relativePath = chiselAssetRelativePath(asset.category, slug, asset.extension);
    const conflict = assets.find((entry) => entry.id !== assetId && (entry.id === slug || entry.relativePath === relativePath));
    if (conflict) {
      throw new Error(`Asset slug ${slug} already exists`);
    }

    const parsed = assetSchema.parse({ ...asset, id: slug, name: slug, relativePath });
    const project = appStore.getState().computed.project;
    if (existing.relativePath !== parsed.relativePath) {
      await fileService.copyProjectFile(project, `${project.path}/${existing.relativePath}`, parsed.relativePath);
      await fileService.deleteProjectFile(project, existing.relativePath);
    }

    await fileService.writeAssetsJson(project, {
      schemaVersion: AssetService.schemaVersion,
      assets: [...assets.filter((entry) => entry.id !== assetId), parsed]
    });
    if (assetId !== parsed.id) {
      await window.electron.replaceAssetReferences(project.path, { [assetId]: parsed.id });
    }
  }

  public async removeAsset(assetId: string): Promise<void> {
    const assets = await this.getAllAssets();
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} does not exist`);
    }
    const tables = await tableService.listAllTables();
    const references = findAssetReferences(tables, assetId);
    const managedTerrainReferences = new Set([
      TERRAIN_TILE_BINDINGS_TABLE_ID,
      TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID,
      TERRAIN_TILESETS_TABLE_ID
    ]);
    const blockingReference = references.find((reference) => !managedTerrainReferences.has(reference.sourceTableId));
    if (blockingReference) {
      throw new Error(
        `Asset ${assetId} is referenced by ${blockingReference.sourceTableName}.${blockingReference.sourceRowSlug}.${blockingReference.columnName}`
      );
    }
    if (asset.category === AssetCategoryEnum.tileset) await this.removeUnusedTilesetAuthoring(assetId, tables);
    else if (references.length > 0) {
      const reference = references[0]!;
      throw new Error(`Asset ${assetId} is referenced by ${reference.sourceTableName}.${reference.sourceRowSlug}.${reference.columnName}`);
    }
    const project = appStore.getState().computed.project;
    await fileService.deleteProjectFile(project, asset.relativePath);
    await fileService.writeAssetsJson(project, {
      schemaVersion: AssetService.schemaVersion,
      assets: assets.filter((asset) => asset.id !== assetId)
    });
  }

  private async removeUnusedTilesetAuthoring(assetId: string, tables: AnyDataTable[]): Promise<void> {
    const bindings = tables.find((table) => table.id === TERRAIN_TILE_BINDINGS_TABLE_ID);
    const samples = tables.find((table) => table.id === TERRAIN_WFC_SAMPLES_TABLE_ID);
    const cells = tables.find((table) => table.id === TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID);
    const approvedPatches = tables.find((table) => table.id === TERRAIN_APPROVED_PATCHES_TABLE_ID);
    const runtimeTilesets = tables.find((table) => table.id === TERRAIN_TILESETS_TABLE_ID);
    if (!bindings || !samples || !cells || !approvedPatches || !runtimeTilesets) throw new Error("Terrain system tables are missing");

    const affectedSamples = new Set(
      cells.rows
        .filter((row) => rowStringValue(row, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.tileset.id) === assetId)
        .map((row) => rowStringValue(row, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample.id))
    );
    const blockingPatch = approvedPatches.rows.find((row) => approvedPatchUsesTileset(row, assetId));
    if (blockingPatch) {
      throw new Error(`Tileset ${assetId} is used by approved terrain patch ${blockingPatch.slug}`);
    }

    const removedCells = cells.rows.filter((row) => affectedSamples.has(rowStringValue(row, TERRAIN_WFC_SAMPLE_CELL_COLUMNS.sample.id)));
    const removedBindings = bindings.rows.filter((row) => rowStringValue(row, TERRAIN_TILE_BINDING_COLUMNS.tileset.id) === assetId);
    const blockingRowReference = [
      ...findTableReferences(tables, TERRAIN_WFC_SAMPLES_TABLE_ID, affectedSamples).filter(
        (reference) => reference.sourceTableId !== TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID
      ),
      ...findTableReferences(tables, TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID, new Set(removedCells.map((row) => row.slug))),
      ...findTableReferences(tables, TERRAIN_TILE_BINDINGS_TABLE_ID, new Set(removedBindings.map((row) => row.slug)))
    ][0];
    if (blockingRowReference) {
      throw new Error(
        `Terrain row ${blockingRowReference.targetRowSlug ?? "unknown"} is referenced by ${blockingRowReference.sourceTableName}.${blockingRowReference.sourceRowSlug}.${blockingRowReference.columnName}`
      );
    }

    if (affectedSamples.size > 0) {
      await tableService.saveSystemTableRows(
        TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID,
        cells.rows.filter((row) => !removedCells.some((removed) => removed.id === row.id))
      );
      await tableService.saveSystemTableRows(
        TERRAIN_WFC_SAMPLES_TABLE_ID,
        samples.rows.filter((row) => !affectedSamples.has(row.slug))
      );
    }
    await tableService.saveSystemTableRows(
      TERRAIN_TILE_BINDINGS_TABLE_ID,
      bindings.rows.filter((row) => !removedBindings.some((removed) => removed.id === row.id))
    );
    await tableService.saveSystemTableRows(
      TERRAIN_TILESETS_TABLE_ID,
      runtimeTilesets.rows.filter((row) => row.slug !== assetId)
    );
  }
}
const assetService = new AssetService();
export default assetService;
