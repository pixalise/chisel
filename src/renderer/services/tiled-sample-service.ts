import appStore from "@/stores/app-store";
import {
  tiledBoardAuthoringSchema,
  type TiledBoardView,
  type TiledImportBoardInput,
  type TiledSourceSnapshot,
  type TiledRole,
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

  public async deleteTileset(boardId: string, tilesetId: string): Promise<TiledWorkspaceView> {
    return window.electron.deleteTiledTileset({ projectPath: this.projectPath(), boardId, tilesetId });
  }

  public async reloadBoard(boardId: string): Promise<TiledBoardView> {
    return window.electron.reloadTiledBoard({ projectPath: this.projectPath(), boardId });
  }

  public async saveRoles(roles: TiledRole[]): Promise<TiledWorkspaceView> {
    return window.electron.saveTiledRoles({ projectPath: this.projectPath(), roles });
  }

  public async saveAuthoring(board: TiledBoardView): Promise<TiledBoardView> {
    return window.electron.saveTiledAuthoring({
      projectPath: this.projectPath(),
      boardId: board.id,
      authoring: tiledBoardAuthoringSchema.parse(board.authoring)
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
