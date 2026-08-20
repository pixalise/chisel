import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ConvertImages, ConvertedImage, ImportAssetInput, ReplaceAssetSourceInput } from "../shared/schemas";
import type { Asset, FileMetadata } from "../shared/types";

function assetUrlFromPath(filePath: string): string {
  if (filePath.includes("\0")) throw new Error("File path cannot contain a null byte");
  if (!/^(?:\/|[A-Za-z]:[\\/]|\\\\)/.test(filePath)) throw new Error(`File path must be absolute: ${filePath}`);
  return `chisel-asset://local/${encodeURIComponent(filePath)}`;
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
  getPathForFile: (file: File): string => webUtils.getPathForFile(file),
  toAssetUrl: (filePath: string): string => assetUrlFromPath(filePath)
});
