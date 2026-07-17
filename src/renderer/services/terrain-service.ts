import BaseService from "@/services/base-service";
import { packTerrainTextureSchema, type Asset, type PackTerrainTexture } from "../../shared/schemas";

class TerrainService extends BaseService {
  public async packTerrainTexture(input: Omit<PackTerrainTexture, "projectPath">): Promise<Asset> {
    return window.electron.packTerrainTexture(
      packTerrainTextureSchema.parse({
        ...input,
        projectPath: this.getPath()
      })
    );
  }
}

const terrainService = new TerrainService();

export default terrainService;
