import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { Asset, ConvertImages, ConvertedImage, ImportAssetInput, PackTerrainTexture } from "../shared/schemas";
import type {
  FileMetadata,
  GraphitePreviewEvent,
  GraphitePreviewResetViewInput,
  GraphitePreviewSettingsState,
  GraphitePreviewStartInput,
  GraphitePreviewState,
  GraphitePreviewUpdateOptionsInput,
  GraphitePreviewUpdateSettingsInput,
  GraphitePreviewUpdateSnapshotInput,
  TerrainTexturePreviewResult
} from "../shared/types";

contextBridge.exposeInMainWorld("electron", {
  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke("project:open-folder-dialog") as Promise<string | null>,
  openFileDialog: (options?: Electron.OpenDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke("project:open-file-dialog", options) as Promise<string | null>,
  readFile: <TData>(path: string): Promise<TData> => ipcRenderer.invoke("file:read", path) as Promise<TData>,
  tryReadFile: <TData>(path: string): Promise<TData | null> => ipcRenderer.invoke("file:try-read", path) as Promise<TData | null>,
  writeFile: (path: string, value: unknown): Promise<void> => ipcRenderer.invoke("file:write", path, value) as Promise<void>,
  writePngFile: (path: string, dataUrl: string): Promise<void> => ipcRenderer.invoke("file:write-png", path, dataUrl) as Promise<void>,
  ensureGitignoreEntry: (path: string, entry: string): Promise<void> =>
    ipcRenderer.invoke("file:ensure-gitignore-entry", path, entry) as Promise<void>,
  copyFile: (sourcePath: string, destinationPath: string): Promise<void> =>
    ipcRenderer.invoke("file:copy", sourcePath, destinationPath) as Promise<void>,
  deleteFile: (path: string): Promise<void> => ipcRenderer.invoke("file:delete", path) as Promise<void>,
  getFileMetadata: (sourcePath: string): Promise<FileMetadata> =>
    ipcRenderer.invoke("file:get-metadata", sourcePath) as Promise<FileMetadata>,
  packTerrainTexture: (input: PackTerrainTexture): Promise<Asset> => ipcRenderer.invoke("terrain:pack-texture", input) as Promise<Asset>,
  importAsset: (input: ImportAssetInput): Promise<Asset> => ipcRenderer.invoke("asset:import", input) as Promise<Asset>,
  convertImages: (input: ConvertImages): Promise<ConvertedImage[]> =>
    ipcRenderer.invoke("image:convert-to-png", input) as Promise<ConvertedImage[]>,
  createImageConversionPreview: (inputPath: string): Promise<string> =>
    ipcRenderer.invoke("image:conversion-preview", inputPath) as Promise<string>,
  createTerrainTexturePreview: (inputPath: string): Promise<TerrainTexturePreviewResult> =>
    ipcRenderer.invoke("terrain:texture-preview", inputPath) as Promise<TerrainTexturePreviewResult>,
  getGraphitePreviewStatus: (): Promise<GraphitePreviewState> => ipcRenderer.invoke("preview:status") as Promise<GraphitePreviewState>,
  getGraphitePreviewSettings: (): Promise<GraphitePreviewSettingsState> =>
    ipcRenderer.invoke("preview:settings") as Promise<GraphitePreviewSettingsState>,
  startGraphitePreview: (input: GraphitePreviewStartInput): Promise<GraphitePreviewState> =>
    ipcRenderer.invoke("preview:start", input) as Promise<GraphitePreviewState>,
  updateGraphitePreviewOptions: (input: GraphitePreviewUpdateOptionsInput): Promise<GraphitePreviewState> =>
    ipcRenderer.invoke("preview:update-options", input) as Promise<GraphitePreviewState>,
  updateGraphitePreviewSettings: (input: GraphitePreviewUpdateSettingsInput): Promise<GraphitePreviewSettingsState> =>
    ipcRenderer.invoke("preview:update-settings", input) as Promise<GraphitePreviewSettingsState>,
  updateGraphitePreviewSnapshot: (input: GraphitePreviewUpdateSnapshotInput): Promise<GraphitePreviewState> =>
    ipcRenderer.invoke("preview:update-snapshot", input) as Promise<GraphitePreviewState>,
  resetGraphitePreviewView: (input: GraphitePreviewResetViewInput): Promise<GraphitePreviewState> =>
    ipcRenderer.invoke("preview:reset-view", input) as Promise<GraphitePreviewState>,
  stopGraphitePreview: (): Promise<GraphitePreviewState> => ipcRenderer.invoke("preview:stop") as Promise<GraphitePreviewState>,
  onGraphitePreviewEvent: (callback: (event: GraphitePreviewEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: GraphitePreviewEvent) => callback(event);
    ipcRenderer.on("preview:event", listener);
    return () => ipcRenderer.removeListener("preview:event", listener);
  },
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
});
