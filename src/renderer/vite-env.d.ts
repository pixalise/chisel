/// <reference types="vite/client" />

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
      writePngFile: (path: string, dataUrl: string) => Promise<void>;
      ensureGitignoreEntry: (path: string, entry: string) => Promise<void>;
      copyFile: (sourcePath: string, destinationPath: string) => Promise<void>;
      deleteFile: (path: string) => Promise<void>;
      getFileMetadata: (sourcePath: string) => Promise<FileMetadata>;
      packTerrainTexture: (input: PackTerrainTexture) => Promise<Asset>;
      importAsset: (input: ImportAssetInput) => Promise<Asset>;
      convertImages: (input: ConvertImages) => Promise<ConvertedImage[]>;
      createImageConversionPreview: (inputPath: string) => Promise<string>;
      createTerrainTexturePreview: (inputPath: string) => Promise<TerrainTexturePreviewResult>;
      getGraphitePreviewStatus: () => Promise<GraphitePreviewState>;
      getGraphitePreviewSettings: () => Promise<GraphitePreviewSettingsState>;
      startGraphitePreview: (input: GraphitePreviewStartInput) => Promise<GraphitePreviewState>;
      updateGraphitePreviewOptions: (input: GraphitePreviewUpdateOptionsInput) => Promise<GraphitePreviewState>;
      updateGraphitePreviewSettings: (input: GraphitePreviewUpdateSettingsInput) => Promise<GraphitePreviewSettingsState>;
      updateGraphitePreviewSnapshot: (input: GraphitePreviewUpdateSnapshotInput) => Promise<GraphitePreviewState>;
      resetGraphitePreviewView: (input: GraphitePreviewResetViewInput) => Promise<GraphitePreviewState>;
      stopGraphitePreview: () => Promise<GraphitePreviewState>;
      onGraphitePreviewEvent: (callback: (event: GraphitePreviewEvent) => void) => () => void;
      getPathForFile: (file: File) => string;
    };
  }
}

export {};
