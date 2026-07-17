import { BrowserWindow, app, dialog, ipcMain, nativeImage } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { importAsset } from "./asset-store";
import { convertImagesToPng, createImageConversionPreview } from "./image-conversion";
import { getFileMetadata } from "./file-metadata";
import { packAlbedoHeightTextureInMemory, packNormalRoughnessTextureInMemory, packTexturePackageAsset } from "./texture-packing";
import type {
  ConvertImages,
  ImportAssetInput,
  PackAlbedoHeightTexture,
  PackNormalRoughnessTexture,
  PackTexturePackage
} from "../shared/schemas";

const APP_NAME = "Chisel";
const APP_ICON_FILE = "chisel-apple.png";

let mainWindow: BrowserWindow | null = null;

app.setName(APP_NAME);

function appIconPath(): string {
  return path.join(__dirname, "..", "..", "assets", APP_ICON_FILE);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    icon: appIconPath(),
    title: APP_NAME,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void mainWindow.loadFile(path.join(__dirname, "..", "..", "dist", "renderer", "index.html"));
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

function hasErrorCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === code;
}

function pngBufferFromDataUrl(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new Error("PNG data must be a data:image/png;base64 data URL.");
  }

  const buffer = Buffer.from(match[1], "base64");
  if (
    buffer.length < 8 ||
    buffer[0] !== 0x89 ||
    buffer[1] !== 0x50 ||
    buffer[2] !== 0x4e ||
    buffer[3] !== 0x47 ||
    buffer[4] !== 0x0d ||
    buffer[5] !== 0x0a ||
    buffer[6] !== 0x1a ||
    buffer[7] !== 0x0a
  ) {
    throw new Error("PNG data URL did not decode to a valid PNG file.");
  }

  return buffer;
}

async function writePngFile(filePath: string, dataUrl: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pngBufferFromDataUrl(dataUrl));
}

async function ensureGitignoreEntry(filePath: string, entry: string): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  const lines = content.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(entry)) {
    return;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const prefix = content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
  await fs.writeFile(filePath, `${prefix}${entry}\n`, "utf8");
}

async function createImagePreview(inputPath: string): Promise<string> {
  const image = nativeImage.createFromPath(inputPath);
  if (image.isEmpty()) {
    return createImageConversionPreview(inputPath);
  }

  const size = image.getSize();
  const scale = Math.min(320 / size.width, 200 / size.height, 1);
  const preview =
    scale < 1
      ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) })
      : image;
  return preview.toDataURL();
}

function registerIpc(): void {
  ipcMain.handle("file:read", async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content) as unknown;
  });

  ipcMain.handle("file:try-read", async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, "utf8");
      if (content.trim().length === 0) {
        return null;
      }

      return JSON.parse(content) as unknown;
    } catch (error) {
      if (hasErrorCode(error, "ENOENT")) {
        return null;
      }

      throw error;
    }
  });

  ipcMain.handle("file:write", async (_event, filePath: string, value: unknown) => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  });

  ipcMain.handle("file:write-png", (_event, filePath: string, dataUrl: string) => writePngFile(filePath, dataUrl));
  ipcMain.handle("file:ensure-gitignore-entry", (_event, filePath: string, entry: string) => ensureGitignoreEntry(filePath, entry));

  ipcMain.handle("file:copy", async (_event, sourcePath: string, destinationPath: string) => {
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  });

  ipcMain.handle("file:delete", async (_event, filePath: string) => {
    await fs.rm(filePath, { force: true });
  });

  ipcMain.handle("file:get-metadata", (_event, sourcePath: string) => getFileMetadata(sourcePath));

  ipcMain.handle("project:open-folder-dialog", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("project:open-file-dialog", async (_event, options?: Electron.OpenDialogOptions) => {
    const result = await dialog.showOpenDialog({
      ...options,
      properties: ["openFile"]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  ipcMain.handle("asset:import", (_event, input: ImportAssetInput) => importAsset(input));
  ipcMain.handle("texture:pack-albedo-height", (_event, input: PackAlbedoHeightTexture) => packAlbedoHeightTextureInMemory(input));
  ipcMain.handle("texture:pack-normal-roughness", (_event, input: PackNormalRoughnessTexture) => packNormalRoughnessTextureInMemory(input));
  ipcMain.handle("texture:pack-package", (_event, input: PackTexturePackage) => packTexturePackageAsset(input));
  ipcMain.handle("image:convert-to-png", (_event, input: ConvertImages) => convertImagesToPng(input));
  ipcMain.handle("image:conversion-preview", (_event, inputPath: string) => createImagePreview(inputPath));
}

app.whenReady().then(() => {
  const icon = nativeImage.createFromPath(appIconPath());
  if (process.platform === "darwin" && !icon.isEmpty()) {
    app.dock.setIcon(icon);
  }

  registerIpc();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
