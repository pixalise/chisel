import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import tableService from "@/services/table-service"
import type { CreateOrUpdateTable, DataTableSchema } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface UseUpdateTableMutation {
  isUpdateTableLoading: boolean
  updateTable: (input: CreateOrUpdateTable) => Promise<DataTableSchema>
}
const useUpdateTableMutation = (id: string): UseUpdateTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.UPDATE_TABLE_MUTATION, id],
    mutationFn: async (input: CreateOrUpdateTable): Promise<DataTableSchema> => {
      const table = await tableService.updateTable(id, input)
      await Promise.all(
        [[HookKeysEnum.LIST_TABLES_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      return table
    },
  })
  return {
    isUpdateTableLoading: isPending,
    updateTable: mutateAsync,
  }
}
export default useUpdateTableMutation
