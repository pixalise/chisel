"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readImageDimensions = readImageDimensions;
exports.createSharpImagePreview = createSharpImagePreview;
exports.convertSharpImageToPng = convertSharpImageToPng;
exports.loadSharpRgba = loadSharpRgba;
exports.encodeSharpRgbaPng = encodeSharpRgbaPng;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
let nextRequestId = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
function workerPath() {
    return node_path_1.default.join(__dirname, "sharp-worker.js");
}
function sharpFailureMessage(request, detail) {
    const inputPath = "filePath" in request ? request.filePath : "inputPath" in request ? request.inputPath : "generated RGBA image";
    return `Could not process image with Sharp: ${inputPath}. ${detail}`;
}
function workerExecPath() {
    return process.env.CHISEL_NODE_EXEC_PATH || (process.versions.electron ? "node" : process.execPath);
}
function runSharpWorker(request) {
    const id = nextRequestId++;
    const child = (0, node_child_process_1.fork)(workerPath(), [], {
        env: { ...process.env },
        execPath: workerExecPath(),
        silent: true
    });
    return new Promise((resolve, reject) => {
        let settled = false;
        let stderr = "";
        const timeout = setTimeout(() => {
            settle(() => {
                reject(new Error(sharpFailureMessage(request, `Worker timed out after ${DEFAULT_TIMEOUT_MS}ms.`)));
            });
        }, DEFAULT_TIMEOUT_MS);
        function settle(callback) {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timeout);
            child.kill();
            callback();
        }
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });
        child.on("message", (message) => {
            if (message.id !== id) {
                return;
            }
            settle(() => {
                if (message.ok) {
                    resolve(message.value);
                }
                else {
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
async function readImageDimensions(filePath) {
    if (process.env.VITEST) {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        const metadata = await sharp(filePath).metadata();
        return { width: metadata.width ?? 0, height: metadata.height ?? 0 };
    }
    return runSharpWorker({ type: "metadata", filePath });
}
async function createSharpImagePreview(inputPath) {
    if (process.env.VITEST) {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        const buffer = await sharp(inputPath).resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        return `data:image/png;base64,${buffer.toString("base64")}`;
    }
    return runSharpWorker({ type: "preview", inputPath });
}
async function convertSharpImageToPng(inputPath, outputPath) {
    if (process.env.VITEST) {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        await sharp(inputPath).png().toFile(outputPath);
        return;
    }
    await runSharpWorker({ type: "convertToPng", inputPath, outputPath });
}
async function loadSharpRgba(filePath) {
    if (process.env.VITEST) {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        if (!info.width || !info.height) {
            throw new Error(`Could not read image dimensions for ${filePath}`);
        }
        return { data, width: info.width, height: info.height };
    }
    const result = await runSharpWorker({ type: "loadRgba", filePath });
    return { data: Buffer.from(result.data, "base64"), width: result.width, height: result.height };
}
async function encodeSharpRgbaPng(data, width, height) {
    if (process.env.VITEST) {
        const sharp = (await Promise.resolve().then(() => __importStar(require("sharp")))).default;
        return sharp(data, { raw: { width, height, channels: 4 } })
            .png()
            .toBuffer();
    }
    const encoded = await runSharpWorker({ type: "encodeRgbaPng", data: data.toString("base64"), width, height });
    return Buffer.from(encoded, "base64");
}
