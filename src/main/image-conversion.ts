import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { convertImagesSchema, type ConvertImages, type ConvertedImage } from "../shared/schemas";

export async function createImageConversionPreview(inputPath: string): Promise<string> {
  const buffer = await sharp(inputPath).resize({ width: 320, height: 200, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function convertImagesToPng(input: ConvertImages): Promise<ConvertedImage[]> {
  const request = convertImagesSchema.parse(input);
  await fs.mkdir(request.outputFolder, { recursive: true });

  const converted: ConvertedImage[] = [];
  for (const inputPath of request.inputPaths) {
    const outputPath = path.join(request.outputFolder, `${path.parse(inputPath).name}.png`);
    await sharp(inputPath).png().toFile(outputPath);
    converted.push({ inputPath, outputPath });
  }
  return converted;
}
