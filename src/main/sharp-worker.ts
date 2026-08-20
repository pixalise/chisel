import sharp from "sharp";

type SharpWorkerRequest =
  | { id: number; type: "metadata"; filePath: string }
  | { id: number; type: "preview"; inputPath: string }
  | { id: number; type: "convertToPng"; inputPath: string; outputPath: string };

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
