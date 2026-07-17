import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import tableService from "@/services/table-service";
import CacheUtils from "@/utils/cache-utils";
import type { AnyDataTable, DataTableRow } from "../../shared/schemas";

export interface SaveTableRowsInput {
  rows: DataTableRow[];
  tableId: string;
}

export interface UseSaveTableRowsMutation {
  isSaveTableRowsLoading: boolean;
  saveTableRows: (input: SaveTableRowsInput) => Promise<AnyDataTable>;
}

const useSaveTableRowsMutation = (): UseSaveTableRowsMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.saveTableRowsMutation],
    mutationFn: async (input: SaveTableRowsInput): Promise<AnyDataTable> => {
      const table = await tableService.saveTableRows(input.tableId, input.rows);
      CacheUtils.setInCache<AnyDataTable[]>([HookKeysEnum.listTablesQuery], (tables) => {
        if (!tables) {
          return [table];
        }
        return tables.map((entry) => (entry.id === table.id ? table : entry));
      });
      return table;
    }
  });

  return {
    isSaveTableRowsLoading: isPending,
    saveTableRows: mutateAsync
  };
};

export default useSaveTableRowsMutation;
