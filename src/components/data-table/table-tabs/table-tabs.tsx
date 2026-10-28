import CreateTableDialogButton from "@/components/data-schema/create-table-dialog-button"
import TabGroupLabel from "@/components/data-table/table-tabs/tab-group-label"
import TableTab, {
  tableTabKey,
  type TableTabEntry,
} from "@/components/data-table/table-tabs/table-tab"
import { Button } from "@/components/ui/button"
import { PlusCircle, Settings, User } from "lucide-react"
import type { FC } from "react"
export interface TableTabsProps {
  activeTableKey: string | null
  systemTables: TableTabEntry[]
  userTables: TableTabEntry[]
  onRequestDeleteTable?: (table: TableTabEntry) => void
  onSelectTable: (table: TableTabEntry) => void
}
const TableTabs: FC<TableTabsProps> = (props) => {
  const { activeTableKey, systemTables, userTables, onRequestDeleteTable, onSelectTable } = props
  return (
    <div className="flex min-h-10 items-stretch overflow-x-auto border-b border-border bg-muted/60">
      <TabGroupLabel icon={<User size={16} />} label="User Tables" />
      {userTables.map((table) => (
        <TableTab
          active={tableTabKey(table) === activeTableKey}
          key={tableTabKey(table)}
          table={table}
          onRequestDeleteTable={onRequestDeleteTable}
          onSelectTable={onSelectTable}
        />
      ))}
      <div className="flex items-center justify-center border-r border-border">
        <CreateTableDialogButton>
          {(open) => (
            <Button onClick={open} size="sm" type="button" variant="ghost">
              <PlusCircle className="h-4 w-4" />
              New Table
            </Button>
          )}
        </CreateTableDialogButton>
      </div>
      <TabGroupLabel icon={<Settings size={16} />} label="System Tables" />
      {systemTables.map((table) => (
        <TableTab
          active={tableTabKey(table) === activeTableKey}
          key={tableTabKey(table)}
          table={table}
          onRequestDeleteTable={onRequestDeleteTable}
          onSelectTable={onSelectTable}
        />
      ))}
    </div>
  )
}
export default TableTabs
