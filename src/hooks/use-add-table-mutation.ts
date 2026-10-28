import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import tableService from "@/services/table-service"
import type { CreateOrUpdateTable, DataTableSchema } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface UseAddTableMutation {
  addTable: (input: CreateOrUpdateTable) => Promise<DataTableSchema>
  isAddTableLoading: boolean
}
const useAddTableMutation = (): UseAddTableMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.ADD_TABLE_MUTATION],
    mutationFn: async (input: CreateOrUpdateTable): Promise<DataTableSchema> => {
      const table = await tableService.addTable(input)
      await Promise.all(
        [[HookKeysEnum.LIST_TABLES_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      return table
    },
  })
  return {
    addTable: mutateAsync,
    isAddTableLoading: isPending,
  }
}
export default useAddTableMutation
