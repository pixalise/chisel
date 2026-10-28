import { AssetCategoryEnum } from "@/enums/asset-category-enum"
import { emptyLocalizationDocument } from "@/shared/localization"
import type { CommittedSourceSnapshot } from "@/shared/source-state"
import { nanoid } from "nanoid"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ latestCommit: vi.fn(), writeRobloxExport: vi.fn() }))
vi.mock("@/stores/app-store", () => ({
  default: { getState: () => ({ computed: { project: { path: "/tmp/roblox-project" } } }) },
}))
vi.mock("@/services/source-state-service", () => ({
  default: { getLatestCommit: mocks.latestCommit },
}))
const { default: exportService } = await import("@/services/export-service")
function snapshot(): CommittedSourceSnapshot {
  return {
    id: nanoid(),
    committedAt: "2026-10-28T00:00:00Z",
    project: { id: nanoid(), name: "Roblox Game" },
    tables: [],
    assets: { schemaVersion: 1, assets: [] },
    localization: emptyLocalizationDocument,
  }
}
describe("Roblox export service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("window", { electron: { writeRobloxExport: mocks.writeRobloxExport } })
  })
  it("requires a source commit before writing anything", async () => {
    mocks.latestCommit.mockResolvedValue(undefined)
    await expect(exportService.exportProject()).rejects.toThrow("Commit")
    expect(mocks.writeRobloxExport).not.toHaveBeenCalled()
  })
  it("exports the committed data to the current project folder", async () => {
    mocks.latestCommit.mockResolvedValue(snapshot())
    const result = await exportService.exportProject()
    expect(result).toMatchObject({
      manifestPath: "ChiselData/manifest.luau",
      outputPath: "/tmp/roblox-project/ChiselData",
      fileCount: 7,
    })
    expect(mocks.writeRobloxExport).toHaveBeenCalledWith({
      projectPath: "/tmp/roblox-project",
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "ChiselData/manifest.luau",
          content: expect.stringContaining('PROJECT_NAME = "Roblox Game"'),
        }),
      ]),
    })
  })
  it("does not touch output when an asset is missing its published ID", async () => {
    const commit = snapshot()
    commit.assets.assets.push({
      id: "ICON",
      name: "ICON",
      category: AssetCategoryEnum.UI,
      extension: "png",
      width: 1,
      height: 1,
      sizeBytes: 1,
      relativePath: ".chisel/assets/UI/ICON.png",
      formattedBytes: "1 B",
    })
    mocks.latestCommit.mockResolvedValue(commit)
    await expect(exportService.exportProject()).rejects.toThrow("published Roblox asset ID")
    expect(mocks.writeRobloxExport).not.toHaveBeenCalled()
  })
  it("surfaces write failures", async () => {
    mocks.latestCommit.mockResolvedValue(snapshot())
    mocks.writeRobloxExport.mockRejectedValueOnce(new Error("Disk full"))
    await expect(exportService.exportProject()).rejects.toThrow("Disk full")
  })
})
