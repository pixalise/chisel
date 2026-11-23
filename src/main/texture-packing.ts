import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { packTexturePackageSchema, type Asset, type PackTexturePackage } from "../shared/schemas"
import { PACKED_TEXTURE_EXTENSION } from "./texture-package"
import { importAsset } from "./asset-store"
import { packSharpTextureMaps } from "./sharp-worker-client"

export async function packTexturePackageAsset(input: PackTexturePackage): Promise<Asset> {
  const request = packTexturePackageSchema.parse(input)
  const buffer = await packSharpTextureMaps(request)
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mrak-zpbr-"))
  try {
    const sourcePath = path.join(scratch, `${request.name}.${PACKED_TEXTURE_EXTENSION}`)
    await fs.writeFile(sourcePath, buffer)
    return await importAsset({
      projectPath: request.projectPath,
      sourcePath,
      category: AssetCategoryEnum.TERRAIN_TEXTURE,
      name: request.name,
      note: request.note,
    })
  } finally {
    await fs.rm(scratch, { recursive: true, force: true })
  }
}
