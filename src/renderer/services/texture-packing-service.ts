import appStore from "@/stores/app-store";
import {
  packAlbedoHeightTextureSchema,
  packNormalRoughnessTextureSchema,
  packTexturePackageSchema,
  type Asset,
  type PackAlbedoHeightTexture,
  type PackNormalRoughnessTexture,
  type PackTexturePackage
} from "../../shared/schemas";

class TexturePackingService {
  public async packAlbedoHeight(input: PackAlbedoHeightTexture): Promise<string> {
    return window.electron.packAlbedoHeightTexture(packAlbedoHeightTextureSchema.parse(input));
  }

  public async packNormalRoughness(input: PackNormalRoughnessTexture): Promise<string> {
    return window.electron.packNormalRoughnessTexture(packNormalRoughnessTextureSchema.parse(input));
  }

  public async packPackage(input: Omit<PackTexturePackage, "projectPath">): Promise<Asset> {
    const projectPath = appStore.getState().computed.project.path;
    return window.electron.packTexturePackage(packTexturePackageSchema.parse({ ...input, projectPath }));
  }
}

const texturePackingService = new TexturePackingService();

export default texturePackingService;
