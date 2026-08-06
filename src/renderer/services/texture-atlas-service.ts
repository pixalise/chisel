import appStore from "@/stores/app-store";
import { textureAtlasDocumentSchema, type TextureAtlasBuildResult, type TextureAtlasDocument } from "../../shared/schemas";

class TextureAtlasService {
  private projectPath(): string {
    return appStore.getState().computed.project.path;
  }

  public async list(): Promise<TextureAtlasDocument[]> {
    return window.electron.listTextureAtlases(this.projectPath());
  }

  public async save(document: TextureAtlasDocument): Promise<TextureAtlasDocument> {
    const parsed = textureAtlasDocumentSchema.parse(document);
    return window.electron.saveTextureAtlas({ projectPath: this.projectPath(), document: parsed });
  }

  public async delete(atlasId: string): Promise<void> {
    return window.electron.deleteTextureAtlas({ projectPath: this.projectPath(), atlasId });
  }

  public async build(document: TextureAtlasDocument): Promise<TextureAtlasBuildResult> {
    const parsed = textureAtlasDocumentSchema.parse(document);
    return window.electron.buildTextureAtlas({ projectPath: this.projectPath(), document: parsed });
  }
}

const textureAtlasService = new TextureAtlasService();
export default textureAtlasService;
