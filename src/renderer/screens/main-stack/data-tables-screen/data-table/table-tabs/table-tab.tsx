import type { FC } from "react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import EditTableDialogButton from "@/screens/main-stack/data-tables-screen/data-schema-dialog/edit-table-dialog-button";
import type { AnyDataTable, DataTableSchema } from "../../../../../../shared/schemas";

export type TableTabEntry = AnyDataTable;

export interface TableTabProps {
  active: boolean;
  table: TableTabEntry;
  onRequestDeleteTable?: (table: TableTabEntry) => void;
  onSelectTable: (table: TableTabEntry) => void;
}

export function tableTabKey(table: TableTabEntry): string {
  return table.id;
}

function rowCount(table: TableTabEntry): number {
  return table.rows.length;
}

function isSystemTable(table: TableTabEntry): boolean {
  return table.isSystemTable;
}

function isUserTable(table: TableTabEntry): table is DataTableSchema {
  return !table.isSystemTable;
}

const TableTab: FC<TableTabProps> = (props) => {
  const { active, table, onRequestDeleteTable, onSelectTable } = props;
  const canDelete = active && !isSystemTable(table) && onRequestDeleteTable;

  return (
    <div
      className={cn("flex cursor-pointer items-center border-r border-border px-2", active && "bg-primary")}
      onClick={() => onSelectTable(table)}
    >
      <div className="flex flex-row items-center space-x-2">
        <p className={cn("text-xs", active && "font-bold text-primary-foreground")}>{table.name}</p>
        <Badge variant="secondary">{rowCount(table)}</Badge>
        {active && isUserTable(table) && (
          <EditTableDialogButton table={table}>
            {(open) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-4 w-4 cursor-pointer text-primary-foreground" type="button">
                    <EllipsisVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onSelect={open}>Edit Table</DropdownMenuItem>
                  {canDelete && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => confirm(`Permanently delete ${table.name}`) && onRequestDeleteTable(table)}
                    >
                      Delete Table
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </EditTableDialogButton>
        )}
      </div>
    </div>
  );
};

export default TableTab;
