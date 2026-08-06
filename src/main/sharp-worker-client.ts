import { fork } from "node:child_process";
import path from "node:path";
import type { TextureAtlasEntry } from "../shared/schemas";

interface ImageDimensions {
  width: number;
  height: number;
}

interface RgbaImageResult extends ImageDimensions {
  data: string;
}

interface AtlasSpriteResult extends RgbaImageResult {
  sourceWidth: number;
  sourceHeight: number;
}

type SharpWorkerJob =
  | { type: "metadata"; filePath: string }
  | { type: "preview"; inputPath: string }
  | { type: "convertToPng"; inputPath: string; outputPath: string }
  | { type: "loadRgba"; filePath: string }
  | {
      type: "processAtlasSprite";
      filePath: string;
      resizeMode: TextureAtlasEntry["resizeMode"];
      outputWidth: number | null;
      outputHeight: number | null;
      scale: number;
      trim: boolean;
    }
  | { type: "encodeRgbaPng"; data: string; width: number; height: number };

type SharpWorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

let nextRequestId = 1;
const DEFAULT_TIMEOUT_MS = 30_000;

function workerPath(): string {
  return path.join(__dirname, "sharp-worker.js");
}

function sharpFailureMessage(request: SharpWorkerJob, detail: string): string {
  const inputPath = "filePath" in request ? request.filePath : "inputPath" in request ? request.inputPath : "generated RGBA image";
  return `Could not process image with Sharp: ${inputPath}. ${detail}`;
}

function workerExecPath(): string {
  return process.env.CHISEL_NODE_EXEC_PATH || (process.versions.electron ? "node" : process.execPath);
}

function runSharpWorker<T>(request: SharpWorkerJob): Promise<T> {
  const id = nextRequestId++;
  const child = fork(workerPath(), [], {
    env: { ...process.env },
    execPath: workerExecPath(),
    silent: true
  });

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let stderr = "";
    const timeout = setTimeout(() => {
      settle(() => {
        reject(new Error(sharpFailureMessage(request, `Worker timed out after ${DEFAULT_TIMEOUT_MS}ms.`)));
      });
    }, DEFAULT_TIMEOUT_MS);

    function settle(callback: () => void): void {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill();
      callback();
    }

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("message", (message: SharpWorkerResponse) => {
      if (message.id !== id) {
        return;
      }

      settle(() => {
        if (message.ok) {
          resolve(message.value as T);
        } else {
          reject(new Error(sharpFailureMessage(request, message.error)));
        }
      });
    });

    child.on("error", (error) => {
      settle(() => {
        reject(new Error(sharpFailureMessage(request, error.message)));
      });
    });

    child.on("exit", (code, signal) => {
      settle(() => {
        const reason = signal ? `Worker exited with signal ${signal}.` : `Worker exited with code ${code ?? "unknown"}.`;
        const detail = stderr.trim() ? `${reason}\n${stderr.trim()}` : reason;
        reject(new Error(sharpFailureMessage(request, detail)));
      });
    });

    child.send({ ...request, id });
  });
}

export async function readImageDimensions(filePath: string): Promise<ImageDimensions> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(filePath).metadata();
    return { width: metadata.width ?? 0, height: metadata.height ?? 0 };
  }

  return runSharpWorker<ImageDimensions>({ type: "metadata", filePath });
}

export async function createSharpImagePreview(inputPath: string): Promise<string> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    const buffer = await sharp(inputPath).resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }

  return runSharpWorker<string>({ type: "preview", inputPath });
}

export async function convertSharpImageToPng(inputPath: string, outputPath: string): Promise<void> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    await sharp(inputPath).png().toFile(outputPath);
    return;
  }

  await runSharpWorker<null>({ type: "convertToPng", inputPath, outputPath });
}

export async function loadSharpRgba(filePath: string): Promise<{ data: Buffer; width: number; height: number }> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (!info.width || !info.height) {
      throw new Error(`Could not read image dimensions for ${filePath}`);
    }
    return { data, width: info.width, height: info.height };
  }

  const result = await runSharpWorker<RgbaImageResult>({ type: "loadRgba", filePath });
  return { data: Buffer.from(result.data, "base64"), width: result.width, height: result.height };
}

export async function processSharpAtlasSprite(
  filePath: string,
  entry: Pick<TextureAtlasEntry, "resizeMode" | "outputWidth" | "outputHeight" | "scale" | "trim">
): Promise<{ data: Buffer; width: number; height: number; sourceWidth: number; sourceHeight: number }> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    let image = sharp(filePath).ensureAlpha();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error(`Could not read image dimensions for ${filePath}`);
    }
    if (entry.trim) {
      image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    if (entry.resizeMode === "scale") {
      image = image.resize({
        width: Math.max(1, Math.round(metadata.width * entry.scale)),
        height: Math.max(1, Math.round(metadata.height * entry.scale)),
        fit: "fill"
      });
    } else if (entry.resizeMode !== "native") {
      if (entry.outputWidth === null || entry.outputHeight === null) {
        throw new Error(`${entry.resizeMode} requires output dimensions`);
      }
      const fit = entry.resizeMode === "stretch" ? "fill" : entry.resizeMode;
      image = image.resize({ width: entry.outputWidth, height: entry.outputHeight, fit });
    }
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height, sourceWidth: metadata.width, sourceHeight: metadata.height };
  }

  const result = await runSharpWorker<AtlasSpriteResult>({
    type: "processAtlasSprite",
    filePath,
    resizeMode: entry.resizeMode,
    outputWidth: entry.outputWidth,
    outputHeight: entry.outputHeight,
    scale: entry.scale,
    trim: entry.trim
  });
  return { ...result, data: Buffer.from(result.data, "base64") };
}

export async function encodeSharpRgbaPng(data: Buffer, width: number, height: number): Promise<Buffer> {
  if (process.env.VITEST) {
    const sharp = (await import("sharp")).default;
    return sharp(data, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
  }

  const encoded = await runSharpWorker<string>({ type: "encodeRgbaPng", data: data.toString("base64"), width, height });
  return Buffer.from(encoded, "base64");
}
