import { BrowserWindow, app, dialog, ipcMain, nativeImage } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { createInterface, type Interface } from "node:readline";
import { packTerrainTextureAsset } from "./texture-packing";
import { importAsset } from "./asset-store";
import { convertImagesToPng, createImageConversionPreview } from "./image-conversion";
import { getFileMetadata } from "./file-metadata";
import type { ConvertImages, ImportAssetInput, PackTerrainTexture } from "../shared/schemas";
import type {
  GraphitePreviewEvent,
  GraphitePreviewHdriOption,
  GraphitePreviewOptionsConfig,
  GraphitePreviewResetViewInput,
  GraphitePreviewSettingsConfig,
  GraphitePreviewSettingsMode,
  GraphitePreviewSettingsState,
  GraphitePreviewSnapshotConfig,
  GraphitePreviewStartInput,
  GraphitePreviewState,
  GraphitePreviewUpdateOptionsInput,
  GraphitePreviewUpdateSettingsInput,
  GraphitePreviewUpdateSnapshotInput,
  TerrainTexturePreviewResult
} from "../shared/types";

const APP_NAME = "Chisel";
const APP_ICON_FILE = "chisel-apple.png";

let mainWindow: BrowserWindow | null = null;
let previewSettingsWindow: BrowserWindow | null = null;
let previewProcess: ChildProcessWithoutNullStreams | null = null;
let previewStdout: Interface | null = null;
let previewStderr: Interface | null = null;
let previewState: GraphitePreviewState = {
  message: "Graphite preview runtime is stopped.",
  running: false,
  status: "stopped"
};

const GRAPHITE_PREVIEW_DEFAULT_OPTIONS: GraphitePreviewOptionsConfig = {
  gridEnabled: true,
  viewMode: "terrain"
};

const GRAPHITE_PREVIEW_HDRIS: GraphitePreviewHdriOption[] = [
  { id: "docklands_01_1k", label: "Docklands 01", path: "preview-hdris/docklands_01_1k.hdr" },
  { id: "cedar_bridge_sunset_1_1k", label: "Cedar Bridge Sunset", path: "preview-hdris/cedar_bridge_sunset_1_1k.hdr" },
  { id: "qwantani_dusk_2_puresky_1k", label: "Qwantani Dusk", path: "preview-hdris/qwantani_dusk_2_puresky_1k.hdr" },
  { id: "ludwikowice_farmland_1k", label: "Ludwikowice Farmland", path: "preview-hdris/ludwikowice_farmland_1k.hdr" },
  { id: "sunset_meadow_path_1k", label: "Sunset Meadow Path", path: "preview-hdris/sunset_meadow_path_1k.hdr" },
  { id: "ferndale_studio_08_1k", label: "Ferndale Studio 08", path: "preview-hdris/ferndale_studio_08_1k.hdr" },
  { id: "wooden_studio_08_1k", label: "Wooden Studio 08", path: "preview-hdris/wooden_studio_08_1k.hdr" },
  { id: "monochrome_studio_02_1k", label: "Monochrome Studio 02", path: "preview-hdris/monochrome_studio_02_1k.hdr" },
  { id: "ferndale_studio_11_1k", label: "Ferndale Studio 11", path: "preview-hdris/ferndale_studio_11_1k.hdr" }
];

let previewSettings: GraphitePreviewSettingsConfig = {
  ambientColor: [0.58, 0.6, 0.62],
  ambientIntensity: 0.72,
  chunkCount: [5, 5],
  chunkWorldSize: 128,
  contrast: 1,
  exposure: 1,
  hdriIntensity: 1,
  hdriPath: GRAPHITE_PREVIEW_HDRIS[0]?.path ?? "",
  reflectionIntensity: 0.18,
  seed: 17,
  sunColor: [1, 0.98, 0.94],
  sunDirection: [-0.35, -0.82, -0.45],
  sunIntensity: 1.35
};

let previewSettingsMode: GraphitePreviewSettingsMode = "default";
let currentPreviewAssetRoot = "";
let currentPreviewSnapshot: GraphitePreviewSnapshotConfig | null = null;

app.setName(APP_NAME);

function appIconPath(): string {
  return path.join(__dirname, "..", "..", "assets", APP_ICON_FILE);
}

function repoRootPath(): string {
  return path.resolve(__dirname, "..", "..", "..");
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

function createPreviewSettingsWindow(): void {
  if (previewSettingsWindow && !previewSettingsWindow.isDestroyed()) {
    previewSettingsWindow.focus();
    return;
  }

  previewSettingsWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 380,
    minHeight: 560,
    icon: appIconPath(),
    title: "Preview Settings Window",
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  previewSettingsWindow.on("closed", () => {
    previewSettingsWindow = null;
  });

  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    const url = new URL(rendererUrl);
    url.searchParams.set("window", "preview-settings");
    void previewSettingsWindow.loadURL(url.toString());
    return;
  }

  void previewSettingsWindow.loadFile(path.join(__dirname, "..", "..", "dist", "renderer", "index.html"), {
    query: { window: "preview-settings" }
  });
}

function closePreviewSettingsWindow(): void {
  if (!previewSettingsWindow || previewSettingsWindow.isDestroyed()) {
    previewSettingsWindow = null;
    return;
  }
  previewSettingsWindow.close();
  previewSettingsWindow = null;
}

function previewBuildDirectories(): string[] {
  const root = repoRootPath();
  return [
    path.join(root, "build-macos-debug"),
    path.join(root, "build-macos-debug-ninja"),
    path.join(root, "out", "build", "macos-debug"),
    path.join(root, "cmake-build-debug")
  ];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPreviewExecutable(): Promise<{ assetRoot: string; executablePath: string } | null> {
  const overridePath = process.env.CHISEL_GRAPHITE_PREVIEW_HOST;
  if (overridePath && (await fileExists(overridePath))) {
    return {
      assetRoot: path.join(path.dirname(overridePath), "graphite_preview_assets"),
      executablePath: overridePath
    };
  }

  const executableName = process.platform === "win32" ? "graphite_preview_host.exe" : "graphite_preview_host";
  for (const buildDir of previewBuildDirectories()) {
    const executablePath = path.join(buildDir, executableName);
    if (await fileExists(executablePath)) {
      return {
        assetRoot: path.join(buildDir, "graphite_preview_assets"),
        executablePath
      };
    }
  }

  return null;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function clampVec3(
  value: [number, number, number],
  min: number,
  max: number,
  fallback: [number, number, number]
): [number, number, number] {
  return [
    clampNumber(value[0], min, max, fallback[0]),
    clampNumber(value[1], min, max, fallback[1]),
    clampNumber(value[2], min, max, fallback[2])
  ];
}

function sanitizePreviewSettings(input: GraphitePreviewSettingsConfig): GraphitePreviewSettingsConfig {
  const selectedHdri = GRAPHITE_PREVIEW_HDRIS.find((option) => option.path === input.hdriPath);
  return {
    ambientColor: clampVec3(input.ambientColor, 0, 8, previewSettings.ambientColor),
    ambientIntensity: clampNumber(input.ambientIntensity, 0, 8, previewSettings.ambientIntensity),
    chunkCount: [
      Math.round(clampNumber(input.chunkCount[0], 1, 9, previewSettings.chunkCount[0])),
      Math.round(clampNumber(input.chunkCount[1], 1, 9, previewSettings.chunkCount[1]))
    ],
    chunkWorldSize: clampNumber(input.chunkWorldSize, 2, 512, previewSettings.chunkWorldSize),
    contrast: clampNumber(input.contrast, 0.25, 4, previewSettings.contrast),
    exposure: clampNumber(input.exposure, 0.05, 8, previewSettings.exposure),
    hdriIntensity: clampNumber(input.hdriIntensity, 0, 8, previewSettings.hdriIntensity),
    hdriPath: selectedHdri?.path ?? GRAPHITE_PREVIEW_HDRIS[0]?.path ?? "",
    reflectionIntensity: clampNumber(input.reflectionIntensity, 0, 4, previewSettings.reflectionIntensity),
    seed: Math.round(clampNumber(input.seed, 0, 4294967295, previewSettings.seed)),
    sunColor: clampVec3(input.sunColor, 0, 8, previewSettings.sunColor),
    sunDirection: clampVec3(input.sunDirection, -1, 1, previewSettings.sunDirection),
    sunIntensity: clampNumber(input.sunIntensity, 0, 16, previewSettings.sunIntensity)
  };
}

function previewSettingsState(): GraphitePreviewSettingsState {
  return {
    hdriOptions: GRAPHITE_PREVIEW_HDRIS,
    previewState,
    settings: previewSettings,
    settingsMode: previewSettingsMode
  };
}

function previewHdriSourcePath(option: GraphitePreviewHdriOption): string {
  return path.join(repoRootPath(), "editor", "assets", option.path);
}

async function ensurePreviewHdris(assetRoot: string): Promise<void> {
  for (const option of GRAPHITE_PREVIEW_HDRIS) {
    const sourcePath = previewHdriSourcePath(option);
    const destinationPath = path.join(assetRoot, option.path);
    if (!(await fileExists(sourcePath))) {
      continue;
    }
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }
}

function resolvedPreviewSettings(assetRoot: string): GraphitePreviewSettingsConfig {
  const resolved = { ...previewSettings };
  if (resolved.hdriPath.length > 0 && !path.isAbsolute(resolved.hdriPath)) {
    resolved.hdriPath = path.join(assetRoot, resolved.hdriPath);
  }
  return resolved;
}

function applyPreviewSettingsToSnapshot(snapshot: GraphitePreviewSnapshotConfig, assetRoot: string): GraphitePreviewSnapshotConfig {
  const nextSnapshot = structuredClone(snapshot);
  const terrainPreview = nextSnapshot.terrainPreview ?? {
    chunkCount: [5, 5],
    chunkWorldSize: 128,
    editableCellCount: [12, 12],
    paddingCells: 4,
    settingsControlled: true,
    slotSize: 2
  };
  nextSnapshot.previewSettings = resolvedPreviewSettings(assetRoot);
  nextSnapshot.terrainPreview = {
    ...terrainPreview,
    ...(terrainPreview.settingsControlled === false
      ? {}
      : {
          chunkCount: previewSettings.chunkCount,
          chunkWorldSize: previewSettings.chunkWorldSize
        })
  };
  return nextSnapshot;
}

function graphitePreviewSnapshotDefault(input: GraphitePreviewStartInput): GraphitePreviewSnapshotConfig {
  return {
    camera: {
      distance: 720,
      fovDegrees: 42,
      pitchDegrees: 55,
      target: [0, 8, 0],
      yawDegrees: 45
    },
    debugName: "Chisel Graphite Preview",
    kind: input.snapshotKind ?? "fixed_scene",
    previewOptions: input.previewOptions ?? GRAPHITE_PREVIEW_DEFAULT_OPTIONS,
    schemaVersion: 1,
    snapshotVersion: 1,
    stamps: [],
    terrainPreview: {
      chunkCount: [5, 5],
      chunkWorldSize: 128,
      editableCellCount: [12, 12],
      paddingCells: 4,
      settingsControlled: true,
      slotSize: 2
    }
  };
}

function emitPreviewEvent(event: GraphitePreviewEvent): void {
  mainWindow?.webContents.send("preview:event", event);
}

function updatePreviewState(event: GraphitePreviewEvent): void {
  previewState = {
    executablePath: event.executablePath ?? previewState.executablePath,
    message: event.message,
    pid: event.pid ?? previewState.pid,
    running: event.running,
    status: event.status
  };
  emitPreviewEvent(event);
}

function previewIsRunning(): boolean {
  return previewProcess !== null && previewProcess.exitCode === null && !previewProcess.killed;
}

function handlePreviewStdoutLine(line: string): void {
  try {
    const parsed = JSON.parse(line) as Partial<GraphitePreviewEvent>;
    const event: GraphitePreviewEvent = {
      executablePath: previewState.executablePath,
      generation: parsed.generation,
      message: parsed.message ?? "Graphite preview event.",
      pid: previewState.pid,
      running: parsed.status === "running",
      snapshotKind: parsed.snapshotKind,
      status: parsed.status ?? "running",
      type: parsed.type ?? "log"
    };
    updatePreviewState(event);
  } catch {
    updatePreviewState({
      executablePath: previewState.executablePath,
      message: line,
      pid: previewState.pid,
      running: previewIsRunning(),
      status: previewIsRunning() ? "running" : previewState.status,
      type: "log"
    });
  }
}

function handlePreviewStderrLine(line: string): void {
  emitPreviewEvent({
    executablePath: previewState.executablePath,
    message: line,
    pid: previewState.pid,
    running: previewIsRunning(),
    status: previewIsRunning() ? "running" : previewState.status,
    type: "log"
  });
}

function closePreviewReaders(): void {
  previewStdout?.close();
  previewStderr?.close();
  previewStdout = null;
  previewStderr = null;
}

function stopPreviewProcess(): void {
  if (!previewIsRunning()) {
    return;
  }
  previewProcess?.kill();
}

function sendPreviewCommand(command: unknown): boolean {
  if (!previewIsRunning() || !previewProcess || !previewProcess.stdin.writable) {
    return false;
  }
  previewProcess.stdin.write(`${JSON.stringify(command)}\n`);
  return true;
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

function pngDataUrlFromBuffer(buffer: Buffer): string {
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
    throw new Error("Terrain Texture package contains an invalid PNG payload.");
  }

  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function writePngFile(filePath: string, dataUrl: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, pngBufferFromDataUrl(dataUrl));
}

async function createTerrainTexturePreview(filePath: string): Promise<TerrainTexturePreviewResult> {
  const data = await fs.readFile(filePath);
  if (data.length < 24 || data.subarray(0, 4).toString("ascii") !== "GTTP") {
    throw new Error("Invalid Graphite Terrain Texture package.");
  }

  const version = data.readUInt32LE(4);
  const width = data.readUInt32LE(8);
  const height = data.readUInt32LE(12);
  const baseSize = data.readUInt32LE(16);
  const surfaceSize = data.readUInt32LE(20);
  const baseStart = 24;
  const surfaceStart = baseStart + baseSize;
  const packageEnd = surfaceStart + surfaceSize;

  if (version !== 1 || width <= 0 || height <= 0 || baseSize <= 0 || surfaceSize <= 0 || packageEnd > data.length) {
    throw new Error("Unsupported or corrupted Graphite Terrain Texture package.");
  }

  return {
    baseDataUrl: pngDataUrlFromBuffer(data.subarray(baseStart, surfaceStart)),
    height,
    surfaceDataUrl: pngDataUrlFromBuffer(data.subarray(surfaceStart, packageEnd)),
    width
  };
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

  ipcMain.handle("terrain:pack-texture", (_event, input: PackTerrainTexture) => packTerrainTextureAsset(input));
  ipcMain.handle("asset:import", (_event, input: ImportAssetInput) => importAsset(input));
  ipcMain.handle("image:convert-to-png", (_event, input: ConvertImages) => convertImagesToPng(input));
  ipcMain.handle("image:conversion-preview", (_event, inputPath: string) => createImagePreview(inputPath));
  ipcMain.handle("terrain:texture-preview", (_event, inputPath: string) => createTerrainTexturePreview(inputPath));

  ipcMain.handle("preview:status", () => previewState);
  ipcMain.handle("preview:settings", () => previewSettingsState());

  ipcMain.handle("preview:start", async (_event, input: GraphitePreviewStartInput) => {
    previewSettingsMode = input.settingsMode ?? "default";
    if (previewIsRunning()) {
      if (input.showSettingsWindow !== false) {
        createPreviewSettingsWindow();
      }
      return previewState;
    }

    const previewExecutable = await findPreviewExecutable();
    if (!previewExecutable) {
      previewState = {
        message: "Build the native target graphite_preview_host before starting the preview.",
        running: false,
        status: "error"
      };
      return previewState;
    }

    await ensurePreviewHdris(previewExecutable.assetRoot);
    currentPreviewAssetRoot = previewExecutable.assetRoot;
    currentPreviewSnapshot = input.snapshot ?? graphitePreviewSnapshotDefault(input);
    const snapshot = applyPreviewSettingsToSnapshot(currentPreviewSnapshot, previewExecutable.assetRoot);
    const snapshotKind = snapshot.kind;
    const child = spawn(
      previewExecutable.executablePath,
      ["--asset-root", previewExecutable.assetRoot, "--project-root", input.projectPath, "--snapshot-kind", snapshotKind, "--ipc-stdio"],
      {
        cwd: repoRootPath(),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: false
      }
    );

    previewProcess = child;
    previewState = {
      executablePath: previewExecutable.executablePath,
      message: "Starting Graphite preview runtime.",
      pid: child.pid,
      running: false,
      status: "starting"
    };
    emitPreviewEvent({
      ...previewState,
      type: "started"
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    previewStdout = createInterface({ input: child.stdout });
    previewStderr = createInterface({ input: child.stderr });
    previewStdout.on("line", handlePreviewStdoutLine);
    previewStderr.on("line", handlePreviewStderrLine);
    sendPreviewCommand({
      snapshot,
      type: "snapshot"
    });
    if (input.showSettingsWindow !== false) {
      createPreviewSettingsWindow();
    }
    child.on("error", (error) => {
      closePreviewReaders();
      closePreviewSettingsWindow();
      previewProcess = null;
      currentPreviewAssetRoot = "";
      currentPreviewSnapshot = null;
      previewSettingsMode = "default";
      updatePreviewState({
        executablePath: previewExecutable.executablePath,
        message: error.message,
        pid: child.pid,
        running: false,
        status: "error",
        type: "error"
      });
    });
    child.on("exit", (code, signal) => {
      closePreviewReaders();
      closePreviewSettingsWindow();
      previewProcess = null;
      currentPreviewAssetRoot = "";
      currentPreviewSnapshot = null;
      previewSettingsMode = "default";
      const cleanExit = code === 0 || signal === "SIGTERM";
      updatePreviewState({
        executablePath: previewExecutable.executablePath,
        message: cleanExit ? "Graphite preview runtime stopped." : `Graphite preview exited with code ${code ?? signal}.`,
        pid: child.pid,
        running: false,
        status: cleanExit ? "stopped" : "error",
        type: "closed"
      });
    });

    return previewState;
  });

  ipcMain.handle("preview:update-settings", (_event, input: GraphitePreviewUpdateSettingsInput) => {
    previewSettings = sanitizePreviewSettings(input.settings);
    if (previewIsRunning() && currentPreviewSnapshot && currentPreviewAssetRoot.length > 0) {
      const snapshot = applyPreviewSettingsToSnapshot(currentPreviewSnapshot, currentPreviewAssetRoot);
      sendPreviewCommand({
        snapshot,
        type: "snapshot"
      });
      previewState = {
        ...previewState,
        message: "Graphite preview settings updated.",
        running: true,
        status: "running"
      };
    }
    return previewSettingsState();
  });

  ipcMain.handle("preview:update-options", (_event, input: GraphitePreviewUpdateOptionsInput) => {
    if (
      sendPreviewCommand({
        previewOptions: input.previewOptions,
        type: "set_preview_options"
      })
    ) {
      previewState = {
        ...previewState,
        message: "Graphite preview options updated.",
        running: true,
        status: "running"
      };
      return previewState;
    }

    return {
      ...previewState,
      message: "Graphite preview runtime is not running.",
      running: false,
      status: "stopped"
    } satisfies GraphitePreviewState;
  });

  ipcMain.handle("preview:update-snapshot", (_event, input: GraphitePreviewUpdateSnapshotInput) => {
    currentPreviewSnapshot = input.snapshot;
    const snapshot =
      currentPreviewAssetRoot.length > 0 ? applyPreviewSettingsToSnapshot(input.snapshot, currentPreviewAssetRoot) : input.snapshot;
    if (
      sendPreviewCommand({
        snapshot,
        type: "snapshot"
      })
    ) {
      previewState = {
        ...previewState,
        message: "Graphite preview snapshot updated.",
        running: true,
        status: "running"
      };
      return previewState;
    }

    return {
      ...previewState,
      message: "Graphite preview runtime is not running.",
      running: false,
      status: "stopped"
    } satisfies GraphitePreviewState;
  });

  ipcMain.handle("preview:reset-view", (_event, input: GraphitePreviewResetViewInput) => {
    if (
      sendPreviewCommand({
        camera: input.camera,
        preset: input.preset,
        type: "reset_view"
      })
    ) {
      previewState = {
        ...previewState,
        message: `Graphite preview view reset to ${input.preset}.`,
        running: true,
        status: "running"
      };
      return previewState;
    }

    return {
      ...previewState,
      message: "Graphite preview runtime is not running.",
      running: false,
      status: "stopped"
    } satisfies GraphitePreviewState;
  });

  ipcMain.handle("preview:stop", () => {
    stopPreviewProcess();
    closePreviewSettingsWindow();
    if (!previewIsRunning()) {
      currentPreviewAssetRoot = "";
      currentPreviewSnapshot = null;
      previewSettingsMode = "default";
      previewState = {
        ...previewState,
        message: "Graphite preview runtime is stopped.",
        running: false,
        status: "stopped"
      };
    }
    return previewState;
  });
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
  stopPreviewProcess();
  closePreviewSettingsWindow();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
