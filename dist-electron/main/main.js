"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const asset_store_1 = require("./asset-store");
const image_conversion_1 = require("./image-conversion");
const file_metadata_1 = require("./file-metadata");
const texture_packing_1 = require("./texture-packing");
const APP_NAME = "Chisel";
const APP_ICON_FILE = "chisel-apple.png";
let mainWindow = null;
electron_1.app.setName(APP_NAME);
function appIconPath() {
    return node_path_1.default.join(__dirname, "..", "..", "assets", APP_ICON_FILE);
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1120,
        minHeight: 720,
        icon: appIconPath(),
        title: APP_NAME,
        backgroundColor: "#111111",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "..", "preload", "preload.js"),
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
    void mainWindow.loadFile(node_path_1.default.join(__dirname, "..", "..", "dist", "renderer", "index.html"));
    mainWindow.webContents.openDevTools({ mode: "detach" });
}
function hasErrorCode(error, code) {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
    }
    return error.code === code;
}
function pngBufferFromDataUrl(dataUrl) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
    if (!match) {
        throw new Error("PNG data must be a data:image/png;base64 data URL.");
    }
    const buffer = Buffer.from(match[1], "base64");
    if (buffer.length < 8 ||
        buffer[0] !== 0x89 ||
        buffer[1] !== 0x50 ||
        buffer[2] !== 0x4e ||
        buffer[3] !== 0x47 ||
        buffer[4] !== 0x0d ||
        buffer[5] !== 0x0a ||
        buffer[6] !== 0x1a ||
        buffer[7] !== 0x0a) {
        throw new Error("PNG data URL did not decode to a valid PNG file.");
    }
    return buffer;
}
async function writePngFile(filePath, dataUrl) {
    await promises_1.default.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    await promises_1.default.writeFile(filePath, pngBufferFromDataUrl(dataUrl));
}
async function ensureGitignoreEntry(filePath, entry) {
    let content = "";
    try {
        content = await promises_1.default.readFile(filePath, "utf8");
    }
    catch (error) {
        if (!hasErrorCode(error, "ENOENT")) {
            throw error;
        }
    }
    const lines = content.split(/\r?\n/).map((line) => line.trim());
    if (lines.includes(entry)) {
        return;
    }
    await promises_1.default.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    const prefix = content.length === 0 || content.endsWith("\n") ? content : `${content}\n`;
    await promises_1.default.writeFile(filePath, `${prefix}${entry}\n`, "utf8");
}
async function createImagePreview(inputPath, gpptPreview) {
    if (/\.gppt$/i.test(inputPath)) {
        return (0, texture_packing_1.packedTexturePackagePreviewDataUrl)(await promises_1.default.readFile(inputPath), gpptPreview);
    }
    const image = electron_1.nativeImage.createFromPath(inputPath);
    if (image.isEmpty()) {
        return (0, image_conversion_1.createImageConversionPreview)(inputPath);
    }
    const size = image.getSize();
    const scale = Math.min(320 / size.width, 200 / size.height, 1);
    const preview = scale < 1
        ? image.resize({ width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) })
        : image;
    return preview.toDataURL();
}
function registerIpc() {
    electron_1.ipcMain.handle("file:read", async (_event, filePath) => {
        const content = await promises_1.default.readFile(filePath, "utf8");
        return JSON.parse(content);
    });
    electron_1.ipcMain.handle("file:try-read", async (_event, filePath) => {
        try {
            const content = await promises_1.default.readFile(filePath, "utf8");
            if (content.trim().length === 0) {
                return null;
            }
            return JSON.parse(content);
        }
        catch (error) {
            if (hasErrorCode(error, "ENOENT")) {
                return null;
            }
            throw error;
        }
    });
    electron_1.ipcMain.handle("file:write", async (_event, filePath, value) => {
        await promises_1.default.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
        await promises_1.default.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    });
    electron_1.ipcMain.handle("file:write-text", async (_event, filePath, value) => {
        await promises_1.default.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
        await promises_1.default.writeFile(filePath, value, "utf8");
    });
    electron_1.ipcMain.handle("file:write-png", (_event, filePath, dataUrl) => writePngFile(filePath, dataUrl));
    electron_1.ipcMain.handle("file:ensure-gitignore-entry", (_event, filePath, entry) => ensureGitignoreEntry(filePath, entry));
    electron_1.ipcMain.handle("file:copy", async (_event, sourcePath, destinationPath) => {
        await promises_1.default.mkdir(node_path_1.default.dirname(destinationPath), { recursive: true });
        await promises_1.default.copyFile(sourcePath, destinationPath);
    });
    electron_1.ipcMain.handle("file:delete", async (_event, filePath) => {
        await promises_1.default.rm(filePath, { force: true });
    });
    electron_1.ipcMain.handle("file:delete-directory", async (_event, directoryPath) => {
        await promises_1.default.rm(directoryPath, { force: true, recursive: true });
    });
    electron_1.ipcMain.handle("file:get-metadata", (_event, sourcePath) => (0, file_metadata_1.getFileMetadata)(sourcePath));
    electron_1.ipcMain.handle("project:open-folder-dialog", async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ["openDirectory"]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });
    electron_1.ipcMain.handle("project:open-file-dialog", async (_event, options) => {
        const result = await electron_1.dialog.showOpenDialog({
            ...options,
            properties: ["openFile"]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });
    electron_1.ipcMain.handle("asset:import", (_event, input) => (0, asset_store_1.importAsset)(input));
    electron_1.ipcMain.handle("asset:upgrade-library-paths", (_event, projectPath) => (0, asset_store_1.upgradeAssetLibraryPaths)(projectPath));
    electron_1.ipcMain.handle("asset:replace-references", (_event, projectPath, assetIdChanges) => (0, asset_store_1.replaceAssetReferences)(projectPath, assetIdChanges));
    electron_1.ipcMain.handle("texture:pack-albedo-height", (_event, input) => (0, texture_packing_1.packAlbedoHeightTextureInMemory)(input));
    electron_1.ipcMain.handle("texture:pack-normal-roughness", (_event, input) => (0, texture_packing_1.packNormalRoughnessTextureInMemory)(input));
    electron_1.ipcMain.handle("texture:pack-package", (_event, input) => (0, texture_packing_1.packTexturePackageAsset)(input));
    electron_1.ipcMain.handle("texture:unpack-package", async (_event, inputPath) => (0, texture_packing_1.unpackPackedTexturePackageDataUrls)(await promises_1.default.readFile(inputPath)));
    electron_1.ipcMain.handle("image:convert-to-png", (_event, input) => (0, image_conversion_1.convertImagesToPng)(input));
    electron_1.ipcMain.handle("image:conversion-preview", (_event, inputPath, preview) => createImagePreview(inputPath, preview));
}
electron_1.app.whenReady().then(() => {
    const icon = electron_1.nativeImage.createFromPath(appIconPath());
    if (process.platform === "darwin" && !icon.isEmpty()) {
        electron_1.app.dock.setIcon(icon);
    }
    registerIpc();
    createWindow();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
