import fileService from "@/services/file-service";
import BaseService from "@/services/base-service";
import appStore from "@/stores/app-store";
import { assetSchema, addAssetSchema, type Asset, type AddAsset } from "../../shared/schemas";
import { assetSlug, chiselAssetRelativePath } from "../../shared/asset-paths";

class AssetService extends BaseService {
  private static schemaVersion: number = 1;

  public async getAllAssets(): Promise<Asset[]> {
    try {
      const result = await window.electron.upgradeAssetLibraryPaths(this.getPath());
      return result.assetsJson.assets;
    } catch {
      const assets = await fileService.tryReadAssetsJson(this.getPath());
      return assets?.assets ?? [];
    }
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
    const relativePath = chiselAssetRelativePath(parsed.category, name, parsed.extension);
    const existing = assets.find((entry) => entry.id === name || entry.relativePath === relativePath);
    if (existing) {
      throw new Error(`Asset slug ${name} already exists`);
    }
    const asset = assetSchema.parse({ ...parsed, id: name, name, relativePath });
    await fileService.writeAssetsJson(appStore.getState().computed.project, {
      schemaVersion: AssetService.schemaVersion,
      assets: [...assets, asset]
    });
    return asset;
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
    const project = appStore.getState().computed.project;
    await fileService.deleteProjectFile(project, asset.relativePath);
    await fileService.writeAssetsJson(project, {
      schemaVersion: AssetService.schemaVersion,
      assets: assets.filter((asset) => asset.id !== assetId)
    });
  }
}
const assetService = new AssetService();
export default assetService;
