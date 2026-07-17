import fileService from "@/services/file-service";
import BaseService from "@/services/base-service";
import appStore from "@/stores/app-store";
import { nanoid } from "nanoid";
import { assetSchema, addAssetSchema, type Asset, type AddAsset } from "../../shared/schemas";

class AssetService extends BaseService {
  private static schemaVersion: number = 1;

  public async getAllAssets(): Promise<Asset[]> {
    const assets = await fileService.tryReadAssetsJson(this.getPath());
    return assets?.assets ?? [];
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
    const id = nanoid();
    const asset = assetSchema.parse({ ...parsed, id, relativePath: `.chisel/assets/${id}.${parsed.extension}` });
    await fileService.writeAssetsJson(appStore.getState().computed.project, {
      schemaVersion: AssetService.schemaVersion,
      assets: [...assets.filter((entry) => entry.id !== asset.id), asset]
    });
    return asset;
  }

  public async updateAsset(assetId: string, asset: Asset): Promise<void> {
    const assets = await this.getAllAssets();
    if (!assets.some((entry) => entry.id === assetId)) {
      throw new Error(`Asset ${assetId} does not exist`);
    }
    const parsed = assetSchema.parse({ ...asset, id: assetId });
    await fileService.writeAssetsJson(appStore.getState().computed.project, {
      schemaVersion: AssetService.schemaVersion,
      assets: [...assets.filter((entry) => entry.id !== assetId), parsed]
    });
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
