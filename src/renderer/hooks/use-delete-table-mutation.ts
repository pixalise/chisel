import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import tableService from "@/services/table-service";
import CacheUtils from "@/utils/cache-utils";

export interface UseDeleteTableMutation {
  deleteTable: (id: string) => Promise<void>;
  isDeleteTableLoading: boolean;
}

const useDeleteTableMutation = (): UseDeleteTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.deleteTableMutation],
    mutationFn: async (id: string): Promise<void> => {
      await tableService.deleteTable(id);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listTablesQuery]]);
    }
  });

  return {
    deleteTable: mutateAsync,
    isDeleteTableLoading: isPending
  };
};

export default useDeleteTableMutation;
