import fs from "node:fs/promises"
import path from "node:path"
import { nativeImage } from "electron"
import type { FileMetadata } from "../shared/types"
import { readTexturePackageDimensions } from "./sharp-worker-client"
const imageExtensions = new Set(["avif", "bmp", "gif", "jpg", "jpeg", "png", "tif", "tiff", "webp"])
export async function getFileMetadata(sourcePath: string): Promise<FileMetadata> {
  const stats = await fs.stat(sourcePath)
  const extension = path.extname(sourcePath).replace(/^\./, "").toLowerCase()
  const fileName = path.basename(sourcePath)
  const stem = path.basename(sourcePath, path.extname(sourcePath))
  const image = nativeImage.createFromPath(sourcePath)
  let size = image.isEmpty() ? { width: 0, height: 0 } : image.getSize()
  if (extension === "zpbr") {
    size = await readTexturePackageDimensions(sourcePath)
  }
  const metadata: FileMetadata = {
    sourcePath,
    fileName,
    stem,
    extension,
    sizeBytes: stats.size,
    createdAt: stats.birthtime.toISOString(),
    modifiedAt: stats.mtime.toISOString(),
    isImage: imageExtensions.has(extension),
    format: imageExtensions.has(extension) ? extension : undefined,
    width: size.width,
    height: size.height,
  }
  return metadata
}
