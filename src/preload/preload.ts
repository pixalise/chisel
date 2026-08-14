import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ConvertImages, ConvertedImage, ImportAssetInput, ReplaceAssetSourceInput } from "../shared/schemas";
import type {
  TiledBoardInput,
  TiledBoardView,
  TiledImportBoardInput,
  TiledProjectInput,
  TiledSaveConfigInput,
  TiledSaveEnrichmentInput,
  TiledSourceSnapshot,
  TiledWorkspaceView
} from "../shared/tiled-samples";
import type { Asset, FileMetadata } from "../shared/types";

function encodePathSegments(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function fileUrlFromPath(filePath: string): string {
  if (filePath.includes("\0")) throw new Error("File path cannot contain a null byte");
  const normalized = filePath.replaceAll("\\", "/");
  const windowsDrive = /^([A-Za-z]:)(\/.*)$/.exec(normalized);
  if (windowsDrive) return `file:///${windowsDrive[1]}${encodePathSegments(windowsDrive[2])}`;
  if (normalized.startsWith("//")) {
    const [host, ...segments] = normalized.slice(2).split("/");
    if (!host) throw new Error("UNC file path must include a host");
    return `file://${encodeURIComponent(host)}/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  }
  if (!normalized.startsWith("/")) throw new Error(`File path must be absolute: ${filePath}`);
  return `file://${encodePathSegments(normalized)}`;
}

contextBridge.exposeInMainWorld("electron", {
  openFolderDialog: (): Promise<string | null> => ipcRenderer.invoke("project:open-folder-dialog") as Promise<string | null>,
  openFileDialog: (options?: Electron.OpenDialogOptions): Promise<string | null> =>
    ipcRenderer.invoke("project:open-file-dialog", options) as Promise<string | null>,
  readFile: <TData>(path: string): Promise<TData> => ipcRenderer.invoke("file:read", path) as Promise<TData>,
  tryReadFile: <TData>(path: string): Promise<TData | null> => ipcRenderer.invoke("file:try-read", path) as Promise<TData | null>,
  writeFile: (path: string, value: unknown): Promise<void> => ipcRenderer.invoke("file:write", path, value) as Promise<void>,
  writeTextFile: (path: string, value: string): Promise<void> => ipcRenderer.invoke("file:write-text", path, value) as Promise<void>,
  writePngFile: (path: string, dataUrl: string): Promise<void> => ipcRenderer.invoke("file:write-png", path, dataUrl) as Promise<void>,
  ensureGitignoreEntry: (path: string, entry: string): Promise<void> =>
    ipcRenderer.invoke("file:ensure-gitignore-entry", path, entry) as Promise<void>,
  copyFile: (sourcePath: string, destinationPath: string): Promise<void> =>
    ipcRenderer.invoke("file:copy", sourcePath, destinationPath) as Promise<void>,
  deleteFile: (path: string): Promise<void> => ipcRenderer.invoke("file:delete", path) as Promise<void>,
  deleteDirectory: (path: string): Promise<void> => ipcRenderer.invoke("file:delete-directory", path) as Promise<void>,
  getFileMetadata: (sourcePath: string): Promise<FileMetadata> =>
    ipcRenderer.invoke("file:get-metadata", sourcePath) as Promise<FileMetadata>,
  importAsset: (input: ImportAssetInput): Promise<Asset> => ipcRenderer.invoke("asset:import", input) as Promise<Asset>,
  replaceAssetSource: (input: ReplaceAssetSourceInput): Promise<Asset> =>
    ipcRenderer.invoke("asset:replace-source", input) as Promise<Asset>,
  replaceAssetReferences: (projectPath: string, assetIdChanges: Record<string, string>): Promise<boolean> =>
    ipcRenderer.invoke("asset:replace-references", projectPath, assetIdChanges) as Promise<boolean>,
  convertImages: (input: ConvertImages): Promise<ConvertedImage[]> =>
    ipcRenderer.invoke("image:convert-to-png", input) as Promise<ConvertedImage[]>,
  createImageConversionPreview: (inputPath: string): Promise<string> =>
    ipcRenderer.invoke("image:conversion-preview", inputPath) as Promise<string>,
  loadTiledWorkspace: (input: TiledProjectInput): Promise<TiledWorkspaceView> =>
    ipcRenderer.invoke("tiled:load-workspace", input) as Promise<TiledWorkspaceView>,
  importTiledBoard: (input: TiledImportBoardInput): Promise<TiledWorkspaceView> =>
    ipcRenderer.invoke("tiled:import-board", input) as Promise<TiledWorkspaceView>,
  reloadTiledBoard: (input: TiledBoardInput): Promise<TiledBoardView> =>
    ipcRenderer.invoke("tiled:reload-board", input) as Promise<TiledBoardView>,
  saveTiledConfig: (input: TiledSaveConfigInput): Promise<TiledWorkspaceView> =>
    ipcRenderer.invoke("tiled:save-config", input) as Promise<TiledWorkspaceView>,
  saveTiledEnrichment: (input: TiledSaveEnrichmentInput): Promise<TiledBoardView> =>
    ipcRenderer.invoke("tiled:save-enrichment", input) as Promise<TiledBoardView>,
  snapshotTiledWorkspace: (input: TiledProjectInput): Promise<TiledSourceSnapshot> =>
    ipcRenderer.invoke("tiled:snapshot", input) as Promise<TiledSourceSnapshot>,
  restoreTiledWorkspace: (input: TiledProjectInput & { snapshot: TiledSourceSnapshot }): Promise<TiledWorkspaceView> =>
    ipcRenderer.invoke("tiled:restore", input) as Promise<TiledWorkspaceView>,
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  toFileUrl: (filePath: string): string => fileUrlFromPath(filePath)
});
