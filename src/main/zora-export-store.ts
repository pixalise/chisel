import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import z from "zod"
import { ZORA_EXPORT_ROOT, ZORA_MANIFEST_PATH } from "../shared/zora-export"
import { assetFingerprint, readManagedAsset } from "./asset-fingerprints"
import { prepareSharpZoraTextures } from "./sharp-worker-client"
const exportRequestSchema = z
  .object({
    projectPath: z.string().min(1),
    assets: z.array(
      z
        .object({
          slug: z.string(),
          source: z.string(),
          destination: z.string(),
          sha256: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict()
    ),
    files: z.array(z.object({ path: z.string(), content: z.string() }).strict()).min(1),
  })
  .strict()
const activeExports = new Set<string>()
export async function writeZoraExport(input: unknown): Promise<void> {
  const request = exportRequestSchema.parse(input)
  const projectPath = path.resolve(request.projectPath)
  if (activeExports.has(projectPath)) {
    throw new Error("A Zora export is already running for this project.")
  }
  const paths = new Set<string>()
  for (const file of request.files) {
    if (
      !/^ZoraData\/(?:catalog\.json|lua\/(?:content|definitions\.meta)\.lua|d\/zora_content\/definitions\.d)$/.test(
        file.path
      )
    ) {
      throw new Error(`Invalid Zora export path: ${file.path}`)
    }
    const normalized = file.path.toLowerCase()
    if (paths.has(normalized)) {
      throw new Error(`Duplicate Zora export path: ${file.path}`)
    }
    paths.add(normalized)
  }
  if (!paths.has(ZORA_MANIFEST_PATH.toLowerCase())) {
    throw new Error("Zora export is missing its manifest.")
  }
  for (const asset of request.assets) {
    if (
      !/^[A-Z][A-Z0-9_]*$/.test(asset.slug) ||
      !/^assets\/[A-Z][A-Z0-9_]*\.[a-z0-9]+$/.test(asset.destination) ||
      !asset.destination.startsWith(`assets/${asset.slug}.`)
    ) {
      throw new Error(`Invalid Zora asset destination: ${asset.destination}`)
    }
    let outputs = [asset.destination]
    if (asset.destination.endsWith(".zpbr")) {
      outputs = [`assets/${asset.slug}_T1.ktx`, `assets/${asset.slug}_T2.ktx`]
    }
    for (const output of outputs) {
      if (paths.has(output.toLowerCase())) {
        throw new Error(`Duplicate Zora asset output: ${output}`)
      }
      paths.add(output.toLowerCase())
    }
  }
  activeExports.add(projectPath)
  const destination = path.join(projectPath, ZORA_EXPORT_ROOT)
  const token = randomUUID()
  const stage = path.join(projectPath, `.chisel-export-${token}`)
  const backup = path.join(projectPath, `.chisel-export-backup-${token}`)
  let backedUp = false
  try {
    await fs.mkdir(stage, { recursive: true })
    const results = await Promise.allSettled(
      request.files.map(async (file) => {
        const filePath = path.join(stage, file.path.slice(ZORA_EXPORT_ROOT.length + 1))
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content, "utf8")
      })
    )
    for (const result of results) {
      if (result.status === "rejected") {
        throw result.reason
      }
    }
    for (const asset of request.assets) {
      const data = await readManagedAsset(projectPath, asset.source)
      if (assetFingerprint(data) !== asset.sha256) {
        throw new Error(
          `Asset ${asset.slug} changed since the commit. Commit the current draft again.`
        )
      }
      const assetPath = path.join(stage, asset.destination)
      await fs.mkdir(path.dirname(assetPath), { recursive: true })
      if (asset.destination.endsWith(".zpbr")) {
        const compiler =
          process.env.MRAK_TEXTUREC ?? path.resolve(__dirname, "../../resources/texturec")
        await prepareSharpZoraTextures(data, path.dirname(assetPath), asset.slug, compiler)
      } else {
        await fs.writeFile(assetPath, data)
      }
    }
    // AGENT: Allowed Try-Catch
    try {
      await fs.rename(destination, backup)
      backedUp = true
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw error
      }
    }
    // AGENT: Allowed Try-Catch
    try {
      await fs.rename(stage, destination)
    } catch (error) {
      if (backedUp) {
        await fs.rename(backup, destination)
      }
      throw error
    }
    if (backedUp) {
      await fs.rm(backup, { recursive: true, force: true })
    }
  } finally {
    try {
      await fs.rm(stage, { recursive: true, force: true })
    } finally {
      activeExports.delete(projectPath)
    }
  }
}
