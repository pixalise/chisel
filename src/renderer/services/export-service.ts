import {
  createGodotExportBundle,
  godotAssetExportPath,
  godotPackedTextureExportPaths,
  isPackedTerrainTextureAsset
} from "../../shared/godot-export";
import { validatedDataTableSchema, type Asset, type Project } from "../../shared/schemas";
import assetService from "@/services/asset-service";
import appStore from "@/stores/app-store";
import fileService from "@/services/file-service";
import tableService from "@/services/table-service";
import texturePackingService from "@/services/texture-packing-service";

export interface ExportProjectResult {
  exportedAt: string;
  fileCount: number;
  manifestPath: string;
  outputPath: string;
}

class ExportService {
  public async exportProject(): Promise<ExportProjectResult> {
    const project = appStore.getState().computed.project;
    const exportedAt = new Date().toISOString();
    const tables = (await tableService.listAllTables()).map((table) => validatedDataTableSchema.parse(table));
    const assets = await assetService.getAllAssets();
    const bundle = createGodotExportBundle(project, tables, exportedAt, assets);

    const exportedAssetFileCounts = await Promise.all(assets.map((asset) => this.exportAsset(project, asset)));

    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(project, file.path, file.content)));

    return {
      exportedAt,
      fileCount: bundle.files.length + exportedAssetFileCounts.reduce((total, count) => total + count, 0),
      manifestPath: "game_data/manifest.gd",
      outputPath: `${project.path}/game_data`
    };
  }

  private assetSourcePath(project: Project, asset: Asset): string {
    return asset.relativePath.startsWith("/") ? asset.relativePath : `${project.path}/${asset.relativePath}`;
  }

  private async exportAsset(project: Project, asset: Asset): Promise<number> {
    if (isPackedTerrainTextureAsset(asset)) {
      const packedTexture = await texturePackingService.unpackPackage(this.assetSourcePath(project, asset));
      const paths = godotPackedTextureExportPaths(asset);
      await Promise.all([
        fileService.writePngFile(`${project.path}/${paths.albedoHeight}`, packedTexture.albedoHeight),
        fileService.writePngFile(`${project.path}/${paths.normalRoughness}`, packedTexture.normalRoughness)
      ]);
      return 2;
    }

    await fileService.copyProjectFile(project, this.assetSourcePath(project, asset), godotAssetExportPath(asset));
    return 1;
  }
}

const exportService = new ExportService();
export default exportService;
