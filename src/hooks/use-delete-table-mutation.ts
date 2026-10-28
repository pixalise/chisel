import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import tableService from "@/services/table-service"
import { useMutation } from "@tanstack/react-query"
export interface UseDeleteTableMutation {
  deleteTable: (id: string) => Promise<void>
  isDeleteTableLoading: boolean
}
const useDeleteTableMutation = (): UseDeleteTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.DELETE_TABLE_MUTATION],
    mutationFn: async (id: string): Promise<void> => {
      await tableService.deleteTable(id)
      await Promise.all(
        [[HookKeysEnum.LIST_TABLES_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })
  return {
    deleteTable: mutateAsync,
    isDeleteTableLoading: isPending,
  }
}
export default useDeleteTableMutation
