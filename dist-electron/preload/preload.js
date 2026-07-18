"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electron", {
    openFolderDialog: () => electron_1.ipcRenderer.invoke("project:open-folder-dialog"),
    openFileDialog: (options) => electron_1.ipcRenderer.invoke("project:open-file-dialog", options),
    readFile: (path) => electron_1.ipcRenderer.invoke("file:read", path),
    tryReadFile: (path) => electron_1.ipcRenderer.invoke("file:try-read", path),
    writeFile: (path, value) => electron_1.ipcRenderer.invoke("file:write", path, value),
    writeTextFile: (path, value) => electron_1.ipcRenderer.invoke("file:write-text", path, value),
    writePngFile: (path, dataUrl) => electron_1.ipcRenderer.invoke("file:write-png", path, dataUrl),
    ensureGitignoreEntry: (path, entry) => electron_1.ipcRenderer.invoke("file:ensure-gitignore-entry", path, entry),
    copyFile: (sourcePath, destinationPath) => electron_1.ipcRenderer.invoke("file:copy", sourcePath, destinationPath),
    deleteFile: (path) => electron_1.ipcRenderer.invoke("file:delete", path),
    getFileMetadata: (sourcePath) => electron_1.ipcRenderer.invoke("file:get-metadata", sourcePath),
    importAsset: (input) => electron_1.ipcRenderer.invoke("asset:import", input),
    packAlbedoHeightTexture: (input) => electron_1.ipcRenderer.invoke("texture:pack-albedo-height", input),
    packNormalRoughnessTexture: (input) => electron_1.ipcRenderer.invoke("texture:pack-normal-roughness", input),
    packTexturePackage: (input) => electron_1.ipcRenderer.invoke("texture:pack-package", input),
    convertImages: (input) => electron_1.ipcRenderer.invoke("image:convert-to-png", input),
    createImageConversionPreview: (inputPath, preview) => electron_1.ipcRenderer.invoke("image:conversion-preview", inputPath, preview),
    getPathForFile: (file) => electron_1.webUtils.getPathForFile(file)
});
