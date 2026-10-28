import DataTable from "@/components/data-table/data-table"
import TableTabs from "@/components/data-table/table-tabs/table-tabs"
import { dataTableSchema, type DataTableSchema } from "@/shared/schemas"
import { createElement } from "react"
import { act, create } from "react-test-renderer"
import { expect, it, vi } from "vitest"
import { DataTablesPage } from "./data-tables-page"

const mocks = vi.hoisted(() => ({
  tables: [] as DataTableSchema[],
  deleteTable: vi.fn(),
}))
vi.mock("@/hooks/use-list-tables-query", () => ({ default: () => ({ tables: mocks.tables }) }))
vi.mock("@/hooks/use-delete-table-mutation", () => ({
  default: () => ({ deleteTable: mocks.deleteTable }),
}))
vi.mock("@/components/data-table/data-table", () => ({ default: vi.fn(() => null) }))
vi.mock("@/components/data-table/table-tabs/table-tabs", () => ({ default: vi.fn(() => null) }))

it("selects authored tables as they load and returns to an empty editor after deletion", async () => {
  const first = dataTableSchema.parse({
    id: "units",
    name: "Units",
    description: "",
    lastChangeAt: "",
    columns: [],
  })
  const second = dataTableSchema.parse({ ...first, id: "items", name: "Items" })
  mocks.tables = []
  mocks.deleteTable.mockImplementation(async (id: string) => {
    mocks.tables = mocks.tables.filter((table) => table.id !== id)
  })
  const renderer = create(createElement(DataTablesPage))
  try {
    await act(async () => {})
    expect(renderer.root.findByType(TableTabs).props.tables).toEqual([])
    expect(renderer.root.findByType(DataTable).props.table).toBeNull()
    await act(async () => {
      mocks.tables = [first, second]
      renderer.update(createElement(DataTablesPage))
    })
    expect(renderer.root.findByType(DataTable).props.table).toEqual(first)
    act(() => renderer.root.findByType(TableTabs).props.onSelectTable(second))
    expect(renderer.root.findByType(DataTable).props.table).toEqual(second)
    await act(async () => {
      await renderer.root.findByType(TableTabs).props.onRequestDeleteTable(second)
    })
    expect(renderer.root.findByType(DataTable).props.table).toEqual(first)
    await act(async () => {
      await renderer.root.findByType(TableTabs).props.onRequestDeleteTable(first)
    })
    expect(renderer.root.findByType(TableTabs).props.tables).toEqual([])
    expect(renderer.root.findByType(DataTable).props.table).toBeNull()
  } finally {
    act(() => renderer.unmount())
  }
})
