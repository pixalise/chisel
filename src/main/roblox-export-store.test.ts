import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeRobloxExport } from "./roblox-export-store";

let projectPath: string;
const manifest = { path: "ChiselData/manifest.luau", content: "return {}\n" };

describe("Roblox output replacement", () => {
  beforeEach(async () => {
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-roblox-export-"));
    await fs.mkdir(path.join(projectPath, "ChiselData"));
    await fs.writeFile(path.join(projectPath, "ChiselData", "old.luau"), "OLD");
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(projectPath, { force: true, recursive: true });
  });
  it("replaces the entire output and leaves authored files alone", async () => {
    await fs.writeFile(path.join(projectPath, "authored.luau"), "KEEP");
    await writeRobloxExport({ projectPath, files: [manifest, { path: "ChiselData/tables/units.luau", content: "return { COUNT = 1 }" }] });
    expect(await fs.readFile(path.join(projectPath, manifest.path), "utf8")).toBe(manifest.content);
    await expect(fs.stat(path.join(projectPath, "ChiselData/old.luau"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(await fs.readFile(path.join(projectPath, "authored.luau"), "utf8")).toBe("KEEP");
    expect((await fs.readdir(projectPath)).sort()).toEqual(["ChiselData", "authored.luau"]);
  });
  it("creates output when no previous export exists", async () => {
    await fs.rm(path.join(projectPath, "ChiselData"), { recursive: true });
    await writeRobloxExport({ projectPath, files: [manifest] });
    expect(await fs.readFile(path.join(projectPath, manifest.path), "utf8")).toBe(manifest.content);
  });
  it("rejects traversal and duplicate paths before touching output", async () => {
    for (const files of [
      [manifest, { path: "ChiselData/../../authored.luau", content: "BAD" }],
      [manifest, manifest],
      [{ path: "ChiselData/assets.luau", content: "" }]
    ]) {
      await expect(writeRobloxExport({ projectPath, files })).rejects.toThrow();
      expect(await fs.readFile(path.join(projectPath, "ChiselData/old.luau"), "utf8")).toBe("OLD");
    }
  });
  it("preserves old output when a staged write fails", async () => {
    vi.spyOn(fs, "writeFile").mockRejectedValueOnce(new Error("Disk full"));
    await expect(writeRobloxExport({ projectPath, files: [manifest] })).rejects.toThrow("Disk full");
    expect(await fs.readFile(path.join(projectPath, "ChiselData/old.luau"), "utf8")).toBe("OLD");
    expect(await fs.readdir(projectPath)).toEqual(["ChiselData"]);
  });
  it("restores the backup when replacing the destination fails", async () => {
    const rename = fs.rename.bind(fs);
    vi.spyOn(fs, "rename").mockImplementation(async (source, destination) => {
      if (String(source).includes("/.chisel-export-") && !String(source).includes("backup")) throw new Error("Swap failed");
      return rename(source, destination);
    });
    await expect(writeRobloxExport({ projectPath, files: [manifest] })).rejects.toThrow("Swap failed");
    expect(await fs.readFile(path.join(projectPath, "ChiselData/old.luau"), "utf8")).toBe("OLD");
    expect(await fs.readdir(projectPath)).toEqual(["ChiselData"]);
  });
});
