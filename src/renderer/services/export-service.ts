import {
  createGodotExportBundle,
  GAME_DATA_EXPORT_ROOT,
  godotAssetExportPath,
  godotPackedTextureExportPaths,
  isPackedTerrainTextureAsset
} from "../../shared/godot-export";
import { LocalizationProblemSeverity, validateLocalizationDocument } from "../../shared/localization";
import { ProjectValidationSeverity, validateProjectContent } from "../../shared/project-validation";
import { validatedDataTableSchema, type Asset, type Project } from "../../shared/schemas";
import appStore from "@/stores/app-store";
import fileService from "@/services/file-service";
import sourceStateService from "@/services/source-state-service";
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
    const commit = await sourceStateService.getLatestCommit();
    if (!commit) {
      throw new Error("Commit the current Chisel source state before exporting game data.");
    }
    const committedProject = {
      ...commit.project,
      path: project.path
    };
    const tables = commit.tables.map((table) => validatedDataTableSchema.parse(table));
    const assets = commit.assets.assets;
    const validationErrors = validateProjectContent(tables, assets).filter((issue) => issue.severity === ProjectValidationSeverity.error);
    if (validationErrors.length > 0) {
      throw new Error(
        `Export blocked by ${validationErrors.length} content error(s): ${validationErrors[0]?.message ?? "Invalid content"}`
      );
    }
    const localizationErrors = validateLocalizationDocument(commit.localization, assets).filter(
      (issue) => issue.severity === LocalizationProblemSeverity.error
    );
    if (localizationErrors.length > 0) {
      throw new Error(
        `Export blocked by ${localizationErrors.length} localization error(s): ${localizationErrors[0]?.message ?? "Invalid localization"}`
      );
    }
    const bundle = createGodotExportBundle(committedProject, tables, exportedAt, assets, commit.localization);

    await fileService.deleteProjectDirectory(committedProject, GAME_DATA_EXPORT_ROOT);
    const exportedAssetFileCounts = await Promise.all(assets.map((asset) => this.exportAsset(committedProject, asset)));

    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(committedProject, file.path, file.content)));

    return {
      exportedAt,
      fileCount: bundle.files.length + exportedAssetFileCounts.reduce((total, count) => total + count, 0),
      manifestPath: "game_data/manifest.gd",
      outputPath: `${committedProject.path}/game_data`
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
