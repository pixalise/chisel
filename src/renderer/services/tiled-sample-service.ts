import appStore from "@/stores/app-store";
import {
  tiledBoardEnrichmentSchema,
  tiledWorkspaceConfigSchema,
  type TiledBoardView,
  type TiledImportBoardInput,
  type TiledSourceSnapshot,
  type TiledWorkspaceConfig,
  type TiledWorkspaceView
} from "../../shared/tiled-samples";

class TiledSampleService {
  private projectPath(): string {
    return appStore.getState().computed.project.path;
  }

  public async load(): Promise<TiledWorkspaceView> {
    return window.electron.loadTiledWorkspace({ projectPath: this.projectPath() });
  }

  public async importBoard(input: Omit<TiledImportBoardInput, "projectPath">): Promise<TiledWorkspaceView> {
    return window.electron.importTiledBoard({ ...input, projectPath: this.projectPath() });
  }

  public async reloadBoard(boardId: string): Promise<TiledBoardView> {
    return window.electron.reloadTiledBoard({ projectPath: this.projectPath(), boardId });
  }

  public async saveConfig(config: TiledWorkspaceConfig): Promise<TiledWorkspaceView> {
    return window.electron.saveTiledConfig({ projectPath: this.projectPath(), config: tiledWorkspaceConfigSchema.parse(config) });
  }

  public async saveEnrichment(board: TiledBoardView): Promise<TiledBoardView> {
    return window.electron.saveTiledEnrichment({
      projectPath: this.projectPath(),
      boardId: board.id,
      enrichment: tiledBoardEnrichmentSchema.parse(board.enrichment)
    });
  }

  public async snapshot(): Promise<TiledSourceSnapshot> {
    return window.electron.snapshotTiledWorkspace({ projectPath: this.projectPath() });
  }

  public async restore(snapshot: TiledSourceSnapshot): Promise<TiledWorkspaceView> {
    return window.electron.restoreTiledWorkspace({ projectPath: this.projectPath(), snapshot });
  }
}

const tiledSampleService = new TiledSampleService();
export default tiledSampleService;
