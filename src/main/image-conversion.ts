import fs from "node:fs/promises";
import path from "node:path";
import { convertImagesSchema, type ConvertImages, type ConvertedImage } from "../shared/schemas";
import { convertSharpImageToPng, createSharpImagePreview } from "./sharp-worker-client";

export async function createImageConversionPreview(inputPath: string): Promise<string> {
  return createSharpImagePreview(inputPath);
}

export async function convertImagesToPng(input: ConvertImages): Promise<ConvertedImage[]> {
  const request = convertImagesSchema.parse(input);
  await fs.mkdir(request.outputFolder, { recursive: true });

  const converted: ConvertedImage[] = [];
  for (const inputPath of request.inputPaths) {
    const outputPath = path.join(request.outputFolder, `${path.parse(inputPath).name}.png`);
    await convertSharpImageToPng(inputPath, outputPath);
    converted.push({ inputPath, outputPath });
  }
  return converted;
}
