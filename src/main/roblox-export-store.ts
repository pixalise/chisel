import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import z from "zod";
import { ROBLOX_EXPORT_ROOT, ROBLOX_MANIFEST_PATH } from "../shared/roblox-export";

const exportRequestSchema = z
  .object({
    projectPath: z.string().min(1),
    files: z.array(z.object({ path: z.string(), content: z.string() }).strict()).min(1)
  })
  .strict();

const activeExports = new Set<string>();

export async function writeRobloxExport(input: unknown): Promise<void> {
  const request = exportRequestSchema.parse(input);
  const projectPath = path.resolve(request.projectPath);
  if (activeExports.has(projectPath)) throw new Error("A Roblox export is already running for this project.");
  const paths = new Set<string>();
  for (const file of request.files) {
    if (!/^ChiselData\/(?:[a-z_]+|tables\/[A-Za-z0-9_-]+)\.luau$/.test(file.path))
      throw new Error(`Invalid Roblox export path: ${file.path}`);
    const normalized = file.path.toLowerCase();
    if (paths.has(normalized)) throw new Error(`Duplicate Roblox export path: ${file.path}`);
    paths.add(normalized);
  }
  if (!paths.has(ROBLOX_MANIFEST_PATH.toLowerCase())) throw new Error("Roblox export is missing its manifest.");
  activeExports.add(projectPath);
  const destination = path.join(projectPath, ROBLOX_EXPORT_ROOT);
  const token = randomUUID();
  const stage = path.join(projectPath, `.chisel-export-${token}`);
  const backup = path.join(projectPath, `.chisel-export-backup-${token}`);
  let backedUp = false;
  try {
    await fs.mkdir(stage, { recursive: true });
    const results = await Promise.allSettled(
      request.files.map(async (file) => {
        const filePath = path.join(stage, file.path.slice(ROBLOX_EXPORT_ROOT.length + 1));
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content, "utf8");
      })
    );
    for (const result of results) if (result.status === "rejected") throw result.reason;
    try {
      await fs.rename(destination, backup);
      backedUp = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
    try {
      await fs.rename(stage, destination);
    } catch (error) {
      if (backedUp) await fs.rename(backup, destination);
      throw error;
    }
    if (backedUp) await fs.rm(backup, { recursive: true, force: true });
  } finally {
    try {
      await fs.rm(stage, { recursive: true, force: true });
    } finally {
      activeExports.delete(projectPath);
    }
  }
}
