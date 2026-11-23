import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { assetFingerprint, fingerprintAssets } from "./asset-fingerprints"
import { writeZoraExport } from "./zora-export-store"
let projectPath: string
const manifest = { path: "ZoraData/catalog.json", content: "{}\n" }
describe("Zora output replacement", () => {
  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-zora-export-"))
    await fs.mkdir(path.join(projectPath, "ZoraData"))
    await fs.writeFile(path.join(projectPath, "ZoraData", "old.lua"), "OLD")
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(projectPath, { force: true, recursive: true })
  })
  it("replaces the entire output and leaves authored files alone", async () => {
    await fs.writeFile(path.join(projectPath, "authored.lua"), "KEEP")
    await writeZoraExport({
      projectPath,
      assets: [],
      files: [manifest, { path: "ZoraData/lua/content.lua", content: "return { COUNT = 1 }" }],
    })
    expect(await fs.readFile(path.join(projectPath, manifest.path), "utf8")).toBe(manifest.content)
    await expect(fs.stat(path.join(projectPath, "ZoraData/old.lua"))).rejects.toMatchObject({
      code: "ENOENT",
    })
    expect(await fs.readFile(path.join(projectPath, "authored.lua"), "utf8")).toBe("KEEP")
    expect((await fs.readdir(projectPath)).sort()).toEqual(["ZoraData", "authored.lua"])
  })
  it("creates output when no previous export exists", async () => {
    await fs.rm(path.join(projectPath, "ZoraData"), { recursive: true })
    await writeZoraExport({ projectPath, assets: [], files: [manifest] })
    expect(await fs.readFile(path.join(projectPath, manifest.path), "utf8")).toBe(manifest.content)
  })
  it("rejects traversal and duplicate paths before touching output", async () => {
    for (const files of [
      [manifest, { path: "ZoraData/../../authored.lua", content: "BAD" }],
      [manifest, manifest],
      [{ path: "ZoraData/assets.lua", content: "" }],
    ]) {
      await expect(writeZoraExport({ projectPath, assets: [], files })).rejects.toThrow()
      expect(await fs.readFile(path.join(projectPath, "ZoraData/old.lua"), "utf8")).toBe("OLD")
    }
  })
  it("preserves old output when a staged write fails", async () => {
    vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("Disk full"))
    await expect(writeZoraExport({ projectPath, assets: [], files: [manifest] })).rejects.toThrow(
      "Disk full"
    )
    expect(await fs.readFile(path.join(projectPath, "ZoraData/old.lua"), "utf8")).toBe("OLD")
    expect(await fs.readdir(projectPath)).toEqual(["ZoraData"])
  })
  it("restores the backup when replacing the destination fails", async () => {
    const rename = fs.rename.bind(fs)
    vi.spyOn(fs, "rename").mockImplementation(async (source, destination) => {
      if (String(source).includes("/.chisel-export-") && !String(source).includes("backup")) {
        throw new Error("Swap failed")
      }
      return rename(source, destination)
    })
    await expect(writeZoraExport({ projectPath, assets: [], files: [manifest] })).rejects.toThrow(
      "Swap failed"
    )
    expect(await fs.readFile(path.join(projectPath, "ZoraData/old.lua"), "utf8")).toBe("OLD")
    expect(await fs.readdir(projectPath)).toEqual(["ZoraData"])
  })
  it("copies the committed bytes and refuses a changed source without replacing output", async () => {
    const source = ".chisel/assets/DATA/CONFIG.json"
    await fs.mkdir(path.dirname(path.join(projectPath, source)), { recursive: true })
    await fs.writeFile(path.join(projectPath, source), '{"health":70}')
    const hashes = await fingerprintAssets({
      projectPath,
      assets: [{ id: "CONFIG", relativePath: source }],
    })
    expect(hashes.CONFIG).toBe(assetFingerprint(Buffer.from('{"health":70}')))
    const assets = [
      { slug: "CONFIG", source, destination: "assets/CONFIG.json", sha256: hashes.CONFIG },
    ]
    await writeZoraExport({ projectPath, files: [manifest], assets })
    expect(await fs.readFile(path.join(projectPath, "ZoraData/assets/CONFIG.json"), "utf8")).toBe(
      '{"health":70}'
    )
    await fs.writeFile(path.join(projectPath, source), "CHANGED")
    await expect(writeZoraExport({ projectPath, files: [manifest], assets })).rejects.toThrow(
      "changed since the commit"
    )
    expect(await fs.readFile(path.join(projectPath, "ZoraData/assets/CONFIG.json"), "utf8")).toBe(
      '{"health":70}'
    )
  })
  it("rejects asset traversal and collisions with prepared texture outputs", async () => {
    const first = {
      slug: "MAPS",
      source: ".chisel/assets/TERRAIN_TEXTURE/MAPS.zpbr",
      destination: "assets/MAPS.zpbr",
      sha256: "a".repeat(64),
    }
    const collision = {
      slug: "MAPS_T1",
      source: ".chisel/assets/DATA/MAPS_T1.ktx",
      destination: "assets/MAPS_T1.ktx",
      sha256: "b".repeat(64),
    }
    await expect(
      writeZoraExport({ projectPath, files: [manifest], assets: [first, collision] })
    ).rejects.toThrow("Duplicate")
    await expect(
      writeZoraExport({
        projectPath,
        files: [manifest],
        assets: [{ ...first, destination: "../bad" }],
      })
    ).rejects.toThrow("Invalid")
    expect(await fs.readFile(path.join(projectPath, "ZoraData/old.lua"), "utf8")).toBe("OLD")
  })
})
