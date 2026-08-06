import {
  createGodotExportBundle,
  GAME_DATA_EXPORT_ROOT,
  godotAssetExportPath,
  godotPackedTextureExportPaths,
  isPackedTerrainTextureAsset
} from "../../shared/godot-export";
import {
  createHaxeFlixelExportBundle,
  HAXEFLIXEL_ASSET_EXPORT_ROOT,
  HAXEFLIXEL_GAME_DATA_EXPORT_ROOT,
  haxeFlixelAssetExportPath,
  haxeFlixelPackedTextureExportPaths,
  isHaxeFlixelPackedTextureAsset
} from "../../shared/haxeflixel-export";
import {
  createLove2dExportBundle,
  isLove2dPackedTextureAsset,
  love2dAssetExportPath,
  LOVE2D_GAME_DATA_EXPORT_ROOT,
  LOVE2D_MANIFEST_PATH,
  love2dPackedTextureExportPaths
} from "../../shared/love2d-export";
import { createLove2dAtlasTextFiles, LOVE2D_ATLAS_EXPORT_ROOT } from "../../shared/love2d-atlas-export";
import { LocalizationProblemSeverity, validateLocalizationDocument } from "../../shared/localization";
import { ProjectValidationSeverity, validateProjectContent } from "../../shared/project-validation";
import { validatedDataTableSchema, type Asset, type Project } from "../../shared/schemas";
import appStore from "@/stores/app-store";
import fileService from "@/services/file-service";
import sourceStateService from "@/services/source-state-service";
import textureAtlasService from "@/services/texture-atlas-service";
import texturePackingService from "@/services/texture-packing-service";

export enum ExportTarget {
  godot = "godot",
  haxeFlixel = "haxeFlixel",
  love2d = "love2d"
}

export interface ExportProjectResult {
  exportedAt: string;
  fileCount: number;
  manifestPath: string;
  outputPath: string;
  target: ExportTarget;
}

class ExportService {
  public async exportProject(target: ExportTarget = ExportTarget.godot): Promise<ExportProjectResult> {
    const project = appStore.getState().computed.project;
    const exportedAt = new Date().toISOString();
    const commit = await sourceStateService.getLatestCommit();
    if (!commit) {
      throw new Error("Commit the current Chisel source state before exporting game data.");
    }
    const committedProject = { ...commit.project, path: project.path };
    const tables = commit.tables.map((table) => validatedDataTableSchema.parse(table));
    const assets = commit.assets.assets;
    const validationErrors = validateProjectContent(tables, assets, commit.localization).filter(
      (issue) => issue.severity === ProjectValidationSeverity.error
    );
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

    if (target === ExportTarget.haxeFlixel) {
      return this.exportHaxeFlixel(committedProject, tables, assets, commit.localization, exportedAt);
    }
    if (target === ExportTarget.love2d) {
      return this.exportLove2d(committedProject, tables, assets, commit.localization, exportedAt, commit.atlases);
    }

    const bundle = createGodotExportBundle(committedProject, tables, exportedAt, assets, commit.localization);
    await fileService.deleteProjectDirectory(committedProject, GAME_DATA_EXPORT_ROOT);
    const exportedAssetFileCounts = await Promise.all(assets.map((asset) => this.exportGodotAsset(committedProject, asset)));
    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(committedProject, file.path, file.content)));
    return {
      exportedAt,
      fileCount: bundle.files.length + exportedAssetFileCounts.reduce((total, count) => total + count, 0),
      manifestPath: "game_data/manifest.gd",
      outputPath: `${committedProject.path}/game_data`,
      target
    };
  }

  private async exportHaxeFlixel(
    project: Project,
    tables: Parameters<typeof createHaxeFlixelExportBundle>[1],
    assets: Asset[],
    localization: Parameters<typeof createHaxeFlixelExportBundle>[4],
    exportedAt: string
  ): Promise<ExportProjectResult> {
    const bundle = createHaxeFlixelExportBundle(project, tables, exportedAt, assets, localization);
    await Promise.all([
      fileService.deleteProjectDirectory(project, HAXEFLIXEL_GAME_DATA_EXPORT_ROOT),
      fileService.deleteProjectDirectory(project, HAXEFLIXEL_ASSET_EXPORT_ROOT)
    ]);
    const assetCounts = await Promise.all(assets.map((asset) => this.exportHaxeFlixelAsset(project, asset)));
    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(project, file.path, file.content)));
    return {
      exportedAt,
      fileCount: bundle.files.length + assetCounts.reduce((total, count) => total + count, 0),
      manifestPath: `${HAXEFLIXEL_GAME_DATA_EXPORT_ROOT}/ChiselManifest.hx`,
      outputPath: `${project.path}/${HAXEFLIXEL_GAME_DATA_EXPORT_ROOT}`,
      target: ExportTarget.haxeFlixel
    };
  }

  private async exportLove2d(
    project: Project,
    tables: Parameters<typeof createLove2dExportBundle>[1],
    assets: Asset[],
    localization: Parameters<typeof createLove2dExportBundle>[4],
    exportedAt: string,
    atlasDocuments: Parameters<typeof textureAtlasService.build>[0][]
  ): Promise<ExportProjectResult> {
    const bundle = createLove2dExportBundle(project, tables, exportedAt, assets, localization);
    const committedAssetIds = new Set(assets.map((asset) => asset.id));
    for (const atlas of atlasDocuments) {
      for (const entry of atlas.entries) {
        if (!committedAssetIds.has(entry.assetId)) {
          throw new Error(`LÖVE export blocked: atlas ${atlas.id} references uncommitted or missing asset ${entry.assetId}.`);
        }
      }
    }
    const atlasBuilds = await Promise.all(atlasDocuments.map((atlas) => textureAtlasService.build(atlas)));
    await fileService.deleteProjectDirectory(project, LOVE2D_GAME_DATA_EXPORT_ROOT);
    const assetCounts = await Promise.all(assets.map((asset) => this.exportLove2dAsset(project, asset)));
    const atlasTextFiles = atlasBuilds.flatMap(createLove2dAtlasTextFiles);
    const atlasPageWrites = atlasBuilds.flatMap((build) =>
      build.pages.map((page) => fileService.writePngFile(`${project.path}/${LOVE2D_ATLAS_EXPORT_ROOT}/${page.file}`, page.dataUrl))
    );
    await Promise.all(bundle.files.map((file) => fileService.writeProjectTextFile(project, file.path, file.content)));
    await Promise.all(atlasTextFiles.map((file) => fileService.writeProjectTextFile(project, file.path, file.content)));
    await Promise.all(atlasPageWrites);
    return {
      exportedAt,
      fileCount:
        bundle.files.length + assetCounts.reduce((total, count) => total + count, 0) + atlasTextFiles.length + atlasPageWrites.length,
      manifestPath: LOVE2D_MANIFEST_PATH,
      outputPath: `${project.path}/${LOVE2D_GAME_DATA_EXPORT_ROOT}`,
      target: ExportTarget.love2d
    };
  }

  private assetSourcePath(project: Project, asset: Asset): string {
    return asset.relativePath.startsWith("/") ? asset.relativePath : `${project.path}/${asset.relativePath}`;
  }

  private async exportGodotAsset(project: Project, asset: Asset): Promise<number> {
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

  private async exportHaxeFlixelAsset(project: Project, asset: Asset): Promise<number> {
    if (isHaxeFlixelPackedTextureAsset(asset)) {
      const packedTexture = await texturePackingService.unpackPackage(this.assetSourcePath(project, asset));
      const paths = haxeFlixelPackedTextureExportPaths(asset);
      await Promise.all([
        fileService.writePngFile(`${project.path}/${paths.albedoHeight}`, packedTexture.albedoHeight),
        fileService.writePngFile(`${project.path}/${paths.normalRoughness}`, packedTexture.normalRoughness)
      ]);
      return 2;
    }
    await fileService.copyProjectFile(project, this.assetSourcePath(project, asset), haxeFlixelAssetExportPath(asset));
    return 1;
  }

  private async exportLove2dAsset(project: Project, asset: Asset): Promise<number> {
    if (isLove2dPackedTextureAsset(asset)) {
      const packedTexture = await texturePackingService.unpackPackage(this.assetSourcePath(project, asset));
      const paths = love2dPackedTextureExportPaths(asset);
      await Promise.all([
        fileService.writePngFile(`${project.path}/${paths.albedoHeight}`, packedTexture.albedoHeight),
        fileService.writePngFile(`${project.path}/${paths.normalRoughness}`, packedTexture.normalRoughness)
      ]);
      return 2;
    }
    await fileService.copyProjectFile(project, this.assetSourcePath(project, asset), love2dAssetExportPath(asset));
    return 1;
  }
}

const exportService = new ExportService();
export default exportService;
