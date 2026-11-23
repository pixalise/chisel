import { AssetCategoryEnum } from "@/enums/asset-category-enum"
import { emptyLocalizationDocument } from "@/shared/localization"
import type { CommittedSourceSnapshot } from "@/shared/source-state"
import { nanoid } from "nanoid"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ latestCommit: vi.fn(), writeZoraExport: vi.fn() }))
vi.mock("@/stores/app-store", () => ({
  default: { getState: () => ({ computed: { project: { path: "/tmp/zora-project" } } }) },
}))
vi.mock("@/services/source-state-service", () => ({
  default: { getLatestCommit: mocks.latestCommit },
}))
const { default: exportService } = await import("@/services/export-service")
function snapshot(): CommittedSourceSnapshot {
  return {
    id: nanoid(),
    committedAt: "2026-10-28T00:00:00Z",
    project: { id: nanoid(), name: "Zora Game" },
    tables: [],
    assets: { schemaVersion: 1, assets: [] },
    assetHashes: {},
    localization: emptyLocalizationDocument,
  }
}
describe("Zora export service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("window", { electron: { writeZoraExport: mocks.writeZoraExport } })
  })
  it("requires a source commit before writing anything", async () => {
    mocks.latestCommit.mockResolvedValue(undefined)
    await expect(exportService.exportProject()).rejects.toThrow("Commit")
    expect(mocks.writeZoraExport).not.toHaveBeenCalled()
  })
  it("exports the committed data to the current project folder", async () => {
    mocks.latestCommit.mockResolvedValue(snapshot())
    const result = await exportService.exportProject()
    expect(result).toMatchObject({
      manifestPath: "ZoraData/catalog.json",
      outputPath: "/tmp/zora-project/ZoraData",
      fileCount: 4,
    })
    expect(mocks.writeZoraExport).toHaveBeenCalledWith({
      projectPath: "/tmp/zora-project",
      assets: [],
      files: expect.arrayContaining([
        expect.objectContaining({
          path: "ZoraData/catalog.json",
          content: expect.stringContaining('"version": 1'),
        }),
      ]),
    })
  })
  it("does not touch output when an asset is missing its committed fingerprint", async () => {
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
    await expect(exportService.exportProject()).rejects.toThrow("Commit asset")
    expect(mocks.writeZoraExport).not.toHaveBeenCalled()
  })
  it("surfaces write failures", async () => {
    mocks.latestCommit.mockResolvedValue(snapshot())
    mocks.writeZoraExport.mockRejectedValueOnce(new Error("Disk full"))
    await expect(exportService.exportProject()).rejects.toThrow("Disk full")
  })
})
