import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import z from "zod"

export async function readManagedAsset(projectPath: string, relativePath: string): Promise<Buffer> {
  if (!/^\.chisel\/assets\/[A-Z_]+\/[A-Z][A-Z0-9_]*\.[A-Za-z0-9]+$/.test(relativePath)) {
    throw new Error(`Invalid managed asset path: ${relativePath}`)
  }
  const root = await fs.realpath(path.join(projectPath, ".chisel", "assets"))
  const source = await fs.realpath(path.join(projectPath, relativePath))
  const relative = path.relative(root, source)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Asset escapes the managed source folder: ${relativePath}`)
  }
  return fs.readFile(source)
}
export function assetFingerprint(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex")
}
const requestSchema = z.object({
  projectPath: z.string().min(1),
  assets: z.array(
    z.object({
      id: z.string(),
      relativePath: z.string(),
    })
  ),
})
export async function fingerprintAssets(input: unknown): Promise<Record<string, string>> {
  const request = requestSchema.parse(input)
  const result: Record<string, string> = Object.create(null)
  for (const asset of request.assets) {
    result[asset.id] = assetFingerprint(
      await readManagedAsset(request.projectPath, asset.relativePath)
    )
  }
  return result
}
