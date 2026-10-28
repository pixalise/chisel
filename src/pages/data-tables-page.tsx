import DataTable from "@/components/data-table/data-table"
import { tableTabKey, type TableTabEntry } from "@/components/data-table/table-tabs/table-tab"
import TableTabs from "@/components/data-table/table-tabs/table-tabs"
import { Section } from "@/components/layout/section"
import useDeleteTableMutation from "@/hooks/use-delete-table-mutation"
import useListTablesQuery from "@/hooks/use-list-tables-query"
import { useEffect, useState, type FC } from "react"
export const DataTablesPage: FC = () => {
  const [activeTableKey, setActiveTableKey] = useState<string | null>(null)
  const { tables } = useListTablesQuery()
  const { deleteTable } = useDeleteTableMutation()
  const activeTable = tables.find((table) => tableTabKey(table) === activeTableKey) ?? null
  useEffect(() => {
    if (activeTableKey && tables.some((table) => tableTabKey(table) === activeTableKey)) {
      return
    }
    setActiveTableKey(tables[0]?.id ?? null)
  }, [activeTableKey, tables])
  async function onRequestDeleteTable(table: TableTabEntry): Promise<void> {
    await deleteTable(table.id)
    if (activeTableKey === table.id) {
      setActiveTableKey(null)
    }
  }
  return (
    <section className="flex min-h-full w-full min-w-0 flex-col gap-4">
      <Section
        title="Data Tables"
        copy="Create and edit user-authored table schemas for Chisel project data."
      >
        <div className="flex min-h-64 flex-col border border-border bg-card">
          <TableTabs
            activeTableKey={activeTableKey}
            tables={tables}
            onRequestDeleteTable={onRequestDeleteTable}
            onSelectTable={(table: TableTabEntry) => setActiveTableKey(tableTabKey(table))}
          />
          <DataTable table={activeTable} />
        </div>
      </Section>
    </section>
  )
}
