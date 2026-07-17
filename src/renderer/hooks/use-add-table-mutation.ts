import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import tableService from "@/services/table-service";
import CacheUtils from "@/utils/cache-utils";
import type { CreateOrUpdateTable, DataTableSchema } from "../../shared/schemas";

export interface UseAddTableMutation {
  addTable: (input: CreateOrUpdateTable) => Promise<DataTableSchema>;
  isAddTableLoading: boolean;
}

const useAddTableMutation = (): UseAddTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.addTableMutation],
    mutationFn: async (input: CreateOrUpdateTable): Promise<DataTableSchema> => {
      const table = await tableService.addTable(input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listTablesQuery]]);
      return table;
    }
  });

  return {
    addTable: mutateAsync,
    isAddTableLoading: isPending
  };
};

export default useAddTableMutation;
