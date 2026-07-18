"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sharp_1 = __importDefault(require("sharp"));
async function handleRequest(request) {
    switch (request.type) {
        case "metadata": {
            const metadata = await (0, sharp_1.default)(request.filePath).metadata();
            return { width: metadata.width ?? 0, height: metadata.height ?? 0 };
        }
        case "preview": {
            const buffer = await (0, sharp_1.default)(request.inputPath)
                .resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true })
                .png()
                .toBuffer();
            return `data:image/png;base64,${buffer.toString("base64")}`;
        }
        case "convertToPng":
            await (0, sharp_1.default)(request.inputPath).png().toFile(request.outputPath);
            return null;
        case "loadRgba": {
            const { data, info } = await (0, sharp_1.default)(request.filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
            if (!info.width || !info.height) {
                throw new Error(`Could not read image dimensions for ${request.filePath}`);
            }
            return { data: data.toString("base64"), width: info.width, height: info.height };
        }
        case "encodeRgbaPng": {
            const buffer = await (0, sharp_1.default)(Buffer.from(request.data, "base64"), {
                raw: { width: request.width, height: request.height, channels: 4 }
            })
                .png()
                .toBuffer();
            return buffer.toString("base64");
        }
    }
}
function send(response) {
    if (!process.send) {
        return;
    }
    process.send(response);
}
process.on("message", (message) => {
    void handleRequest(message)
        .then((value) => {
        send({ id: message.id, ok: true, value });
    })
        .catch((error) => {
        send({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    });
});
