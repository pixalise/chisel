/// <reference types="vite/client" />

import type { ConvertImages, ConvertedImage, ImportAssetInput, ReplaceAssetSourceInput } from "../shared/schemas";
import type { Asset, FileMetadata } from "../shared/types";

type OpenFileDialogOptions = {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: Array<{
    name: string;
    extensions: string[];
  }>;
};

declare global {
  interface Window {
    electron: {
      openFolderDialog: () => Promise<string | null>;
      openFileDialog: (options?: OpenFileDialogOptions) => Promise<string | null>;
      readFile: <TData>(path: string) => Promise<TData>;
      tryReadFile: <TData>(path: string) => Promise<TData | null>;
      writeFile: (path: string, value: unknown) => Promise<void>;
      writeTextFile: (path: string, value: string) => Promise<void>;
      writePngFile: (path: string, dataUrl: string) => Promise<void>;
      ensureGitignoreEntry: (path: string, entry: string) => Promise<void>;
      copyFile: (sourcePath: string, destinationPath: string) => Promise<void>;
      deleteFile: (path: string) => Promise<void>;
      deleteDirectory: (path: string) => Promise<void>;
      getFileMetadata: (sourcePath: string) => Promise<FileMetadata>;
      importAsset: (input: ImportAssetInput) => Promise<Asset>;
      replaceAssetSource: (input: ReplaceAssetSourceInput) => Promise<Asset>;
      replaceAssetReferences: (projectPath: string, assetIdChanges: Record<string, string>) => Promise<boolean>;
      convertImages: (input: ConvertImages) => Promise<ConvertedImage[]>;
      createImageConversionPreview: (inputPath: string) => Promise<string>;
      getPathForFile: (file: File) => string;
      toAssetUrl: (filePath: string) => string;
    };
  }
}

export {};
