import { type FC, useEffect, useState } from "react";
import { Section } from "@/components/layout/section";
import { SYSTEM_TABLES } from "@/constants/system-tables";
import useDeleteTableMutation from "@/hooks/use-delete-table-mutation";
import useListTablesQuery from "@/hooks/use-list-tables-query";
import DataTable from "@/screens/main-stack/data-tables-screen/data-table/data-table";
import TableTabs from "@/screens/main-stack/data-tables-screen/data-table/table-tabs/table-tabs";
import { tableTabKey, type TableTabEntry } from "@/screens/main-stack/data-tables-screen/data-table/table-tabs/table-tab";
import type { AnyDataTable } from "../../../../shared/schemas";
import { EDITOR_ONLY_TERRAIN_TABLE_IDS, VISIBLE_TERRAIN_SYSTEM_TABLE_IDS } from "../../../../shared/terrain-tables";

export const DataTablesScreen: FC = () => {
  const [activeTableKey, setActiveTableKey] = useState<string | null>(SYSTEM_TABLES[0]?.id ?? null);
  const { tables } = useListTablesQuery();
  const { deleteTable } = useDeleteTableMutation();
  const visibleTables: AnyDataTable[] = (tables.length > 0 ? tables : SYSTEM_TABLES).filter(
    (table) => !EDITOR_ONLY_TERRAIN_TABLE_IDS.has(table.id) || VISIBLE_TERRAIN_SYSTEM_TABLE_IDS.has(table.id)
  );
  const systemTables = visibleTables.filter((table) => table.isSystemTable);
  const userTables = visibleTables.filter((table) => !table.isSystemTable);
  const activeTable = visibleTables.find((table) => tableTabKey(table) === activeTableKey) ?? null;

  useEffect(() => {
    if (activeTableKey && visibleTables.some((table) => tableTabKey(table) === activeTableKey)) {
      return;
    }
    setActiveTableKey(visibleTables[0]?.id ?? null);
  }, [activeTableKey, visibleTables]);

  async function onRequestDeleteTable(table: TableTabEntry): Promise<void> {
    if (table.isSystemTable) {
      return;
    }
    await deleteTable(table.id);
    if (activeTableKey === table.id) {
      setActiveTableKey(systemTables[0]?.id ?? null);
    }
  }

  return (
    <section className="flex min-h-full w-full min-w-0 flex-col gap-4">
      <Section title="Data Tables" copy="Create and edit user-authored table schemas for Chisel project data.">
        <div className="flex min-h-64 flex-col border border-border bg-card">
          <TableTabs
            activeTableKey={activeTableKey}
            systemTables={systemTables}
            userTables={userTables}
            onRequestDeleteTable={onRequestDeleteTable}
            onSelectTable={(table: TableTabEntry) => setActiveTableKey(tableTabKey(table))}
          />
          <DataTable table={activeTable} />
        </div>
      </Section>
    </section>
  );
};
