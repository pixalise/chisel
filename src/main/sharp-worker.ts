import sharp from "sharp";

type SharpWorkerRequest =
  | { id: number; type: "metadata"; filePath: string }
  | { id: number; type: "preview"; inputPath: string }
  | { id: number; type: "convertToPng"; inputPath: string; outputPath: string }
  | { id: number; type: "loadRgba"; filePath: string }
  | {
      id: number;
      type: "processAtlasSprite";
      filePath: string;
      resizeMode: "native" | "scale" | "contain" | "cover" | "stretch";
      outputWidth: number | null;
      outputHeight: number | null;
      scale: number;
      trim: boolean;
    }
  | { id: number; type: "encodeRgbaPng"; data: string; width: number; height: number };

type SharpWorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

async function handleRequest(request: SharpWorkerRequest): Promise<unknown> {
  switch (request.type) {
    case "metadata": {
      const metadata = await sharp(request.filePath).metadata();
      return { width: metadata.width ?? 0, height: metadata.height ?? 0 };
    }
    case "preview": {
      const buffer = await sharp(request.inputPath)
        .resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
    case "convertToPng":
      await sharp(request.inputPath).png().toFile(request.outputPath);
      return null;
    case "loadRgba": {
      const { data, info } = await sharp(request.filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (!info.width || !info.height) {
        throw new Error(`Could not read image dimensions for ${request.filePath}`);
      }
      return { data: data.toString("base64"), width: info.width, height: info.height };
    }
    case "processAtlasSprite": {
      let image = sharp(request.filePath).ensureAlpha();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error(`Could not read image dimensions for ${request.filePath}`);
      }
      if (request.trim) {
        image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
      }
      if (request.resizeMode === "scale") {
        image = image.resize({
          width: Math.max(1, Math.round(metadata.width * request.scale)),
          height: Math.max(1, Math.round(metadata.height * request.scale)),
          fit: "fill"
        });
      } else if (request.resizeMode !== "native") {
        if (request.outputWidth === null || request.outputHeight === null) {
          throw new Error(`${request.resizeMode} requires output dimensions`);
        }
        const fit = request.resizeMode === "stretch" ? "fill" : request.resizeMode;
        image = image.resize({ width: request.outputWidth, height: request.outputHeight, fit });
      }
      const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
      return {
        data: data.toString("base64"),
        width: info.width,
        height: info.height,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height
      };
    }
    case "encodeRgbaPng": {
      const buffer = await sharp(Buffer.from(request.data, "base64"), {
        raw: { width: request.width, height: request.height, channels: 4 }
      })
        .png()
        .toBuffer();
      return buffer.toString("base64");
    }
  }
}

function send(response: SharpWorkerResponse): void {
  if (!process.send) {
    return;
  }

  process.send(response);
}

process.on("message", (message: SharpWorkerRequest) => {
  void handleRequest(message)
    .then((value) => {
      send({ id: message.id, ok: true, value });
    })
    .catch((error: unknown) => {
      send({ id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    });
});
