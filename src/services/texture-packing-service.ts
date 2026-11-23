import {
  packTexturePackageSchema,
  assetSchema,
  type PackTexturePackage,
  type Asset,
} from "@/shared/schemas"

class TexturePackingService {
  public async pack(input: PackTexturePackage): Promise<Asset> {
    return assetSchema.parse(
      await window.electron.packTexturePackage(packTexturePackageSchema.parse(input))
    )
  }
}

export default new TexturePackingService()
