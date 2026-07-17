import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
  ConvertImages,
  ConvertedImage,
  ImportAssetInput,
  PackAlbedoHeightTexture,
  PackNormalRoughnessTexture,
  PackTexturePackage
} from "../shared/schemas";
import type { Asset, FileMetadata } from "../shared/types";

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
  importAsset: (input: ImportAssetInput): Promise<Asset> => ipcRenderer.invoke("asset:import", input) as Promise<Asset>,
  packAlbedoHeightTexture: (input: PackAlbedoHeightTexture): Promise<string> =>
    ipcRenderer.invoke("texture:pack-albedo-height", input) as Promise<string>,
  packNormalRoughnessTexture: (input: PackNormalRoughnessTexture): Promise<string> =>
    ipcRenderer.invoke("texture:pack-normal-roughness", input) as Promise<string>,
  packTexturePackage: (input: PackTexturePackage): Promise<Asset> => ipcRenderer.invoke("texture:pack-package", input) as Promise<Asset>,
  convertImages: (input: ConvertImages): Promise<ConvertedImage[]> =>
    ipcRenderer.invoke("image:convert-to-png", input) as Promise<ConvertedImage[]>,
  createImageConversionPreview: (inputPath: string): Promise<string> =>
    ipcRenderer.invoke("image:conversion-preview", inputPath) as Promise<string>,
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
});
