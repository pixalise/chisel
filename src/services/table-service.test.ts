import { ColumnType } from "@/enums/column-type"
import { dataTableSchema, type DataTableRow, type Project, type TablesJson } from "@/shared/schemas"
import { nanoid } from "nanoid"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  project: { id: "3JRzno-Vksr4Gf7hMa1k8", name: "Test", path: "/tmp/chisel-tables" },
  tables: undefined as TablesJson | undefined,
  tryReadTablesJson: vi.fn(),
  writeTablesJson: vi.fn(),
  writeUserTableJson: vi.fn(),
  writeUserTableSchemaBackupJson: vi.fn(),
  deleteUserTableJson: vi.fn(),
}))
vi.mock("@/stores/app-store", () => ({
  default: { getState: () => ({ computed: { project: mocks.project } }) },
}))
vi.mock("@/services/file-service", () => ({ default: mocks }))

const { default: tableService } = await import("@/services/table-service")

describe("authored tables", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.tables = undefined
    mocks.tryReadTablesJson.mockImplementation(async () => mocks.tables)
    mocks.writeTablesJson.mockImplementation(async (_project: Project, document: TablesJson) => {
      mocks.tables = document
    })
  })

  it("starts a new project with no built-in tables", async () => {
    await expect(tableService.listAllTables()).resolves.toEqual([])
    expect(mocks.tryReadTablesJson).toHaveBeenCalledWith(mocks.project.path)
    expect(mocks.writeTablesJson).not.toHaveBeenCalled()
  })

  it("creates, saves, and deletes authored tables", async () => {
    const column = {
      id: nanoid(),
      name: "health",
      type: ColumnType.INTEGER,
      defaultValue: 25,
      required: true,
      unique: false,
    }
    const table = await tableService.addTable({ name: "Units", description: "", columns: [column] })
    const rows: DataTableRow[] = [
      {
        id: nanoid(),
        slug: "SCOUT",
        values: [{ columnId: column.id, type: ColumnType.INTEGER, value: 50 }],
      },
    ]
    const saved = await tableService.saveTableRows(table.id, rows)
    await expect(tableService.listAllTables()).resolves.toEqual([saved])
    expect(saved.rows).toEqual(rows)
    expect(mocks.writeUserTableJson).toHaveBeenLastCalledWith(mocks.project, table.id, {
      schemaVersion: 1,
      table: saved,
    })
    await tableService.deleteTable(table.id)
    await expect(tableService.listAllTables()).resolves.toEqual([])
    expect(mocks.deleteUserTableJson).toHaveBeenCalledWith(mocks.project, table.id)
  })

  it("keeps reference checks when deleting authored tables", async () => {
    const target = await tableService.addTable({ name: "Units", description: "", columns: [] })
    const reference = dataTableSchema.parse({
      id: "squads",
      name: "Squads",
      description: "",
      lastChangeAt: "",
      columns: [
        {
          id: nanoid(),
          name: "unit",
          type: ColumnType.REF,
          refTableId: target.id,
          defaultValue: "",
        },
      ],
    })
    mocks.tables = { schemaVersion: 1, tables: [target, reference] }
    await expect(tableService.deleteTable(target.id)).rejects.toThrow("referenced by Squads.unit")
    expect(mocks.deleteUserTableJson).not.toHaveBeenCalled()
  })
})
