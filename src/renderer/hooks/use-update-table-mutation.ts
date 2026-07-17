import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import tableService from "@/services/table-service";
import CacheUtils from "@/utils/cache-utils";
import type { CreateOrUpdateTable, DataTableSchema } from "../../shared/schemas";

export interface UseUpdateTableMutation {
  isUpdateTableLoading: boolean;
  updateTable: (input: CreateOrUpdateTable) => Promise<DataTableSchema>;
}

const useUpdateTableMutation = (id: string): UseUpdateTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.updateTableMutation, id],
    mutationFn: async (input: CreateOrUpdateTable): Promise<DataTableSchema> => {
      const table = await tableService.updateTable(id, input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listTablesQuery]]);
      return table;
    }
  });

  return {
    isUpdateTableLoading: isPending,
    updateTable: mutateAsync
  };
};

export default useUpdateTableMutation;
