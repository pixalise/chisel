import { AssetCategoryEnum } from "@/enums/asset-category-enum"
import { ColumnType } from "@/enums/column-type"
import type { DataTableSchema, Asset } from "@/shared/schemas"
import { nanoid } from "nanoid"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  deleteProjectFile: vi.fn(),
  tables: [] as DataTableSchema[],
  tryReadAssetsJson: vi.fn(),
  writeAssetsJson: vi.fn(),
}))
vi.mock("@/services/file-service", () => ({ default: mocks }))
vi.mock("@/services/table-service", () => ({
  default: { listAllTables: vi.fn(async () => mocks.tables) },
}))
vi.mock("@/stores/app-store", () => ({
  default: { getState: () => ({ computed: { project: { path: "/tmp/project" } } }) },
}))
const { default: assetService } = await import("@/services/asset-service")
const asset: Asset = {
  category: AssetCategoryEnum.UI,
  extension: "png",
  formattedBytes: "1 B",
  height: 1,
  id: "ICON",
  name: "ICON",
  relativePath: ".chisel/assets/UI/ICON.png",
  sizeBytes: 1,
  width: 1,
  robloxAssetId: "123456789",
}
describe("asset service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tables = []
    mocks.tryReadAssetsJson.mockResolvedValue({ schemaVersion: 1, assets: [asset] })
  })
  it("removes an unreferenced asset", async () => {
    await assetService.removeAsset("ICON")
    expect(mocks.deleteProjectFile).toHaveBeenCalledWith(expect.anything(), asset.relativePath)
    expect(mocks.writeAssetsJson).toHaveBeenCalledWith(expect.anything(), {
      schemaVersion: 1,
      assets: [],
    })
  })
  it("refuses to remove a referenced asset", async () => {
    const columnId = nanoid()
    mocks.tables = [
      {
        id: "items",
        name: "Items",
        kind: "user",
        description: "",
        version: 1,
        lastChangeAt: "",
        columns: [
          {
            id: columnId,
            name: "icon",
            type: ColumnType.ASSET_REF,
            defaultValue: "",
            required: true,
            unique: false,
          },
        ],
        rows: [
          {
            id: nanoid(),
            slug: "SWORD",
            values: [{ columnId, type: ColumnType.ASSET_REF, value: "ICON" }],
          },
        ],
      },
    ]
    await expect(assetService.removeAsset("ICON")).rejects.toThrow("Items.SWORD.icon")
    expect(mocks.deleteProjectFile).not.toHaveBeenCalled()
  })
  it("preserves the published Roblox ID when metadata is saved", async () => {
    await assetService.updateAsset("ICON", { ...asset, note: "Updated" })
    expect(mocks.writeAssetsJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        assets: [expect.objectContaining({ robloxAssetId: "123456789", note: "Updated" })],
      })
    )
  })
})
