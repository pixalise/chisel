import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import tableService from "@/services/table-service"
import type { DataTableSchema, DataTableRow } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
export interface SaveTableRowsInput {
  rows: DataTableRow[]
  tableId: string
}
export interface UseSaveTableRowsMutation {
  isSaveTableRowsLoading: boolean
  saveTableRows: (input: SaveTableRowsInput) => Promise<DataTableSchema>
}
const useSaveTableRowsMutation = (): UseSaveTableRowsMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.SAVE_TABLE_ROWS_MUTATION],
    mutationFn: async (input: SaveTableRowsInput): Promise<DataTableSchema> => {
      const table = await tableService.saveTableRows(input.tableId, input.rows)
      await queryClient.invalidateQueries({ queryKey: [HookKeysEnum.LIST_TABLES_QUERY] })
      return table
    },
  })
  return {
    isSaveTableRowsLoading: isPending,
    saveTableRows: mutateAsync,
  }
}
export default useSaveTableRowsMutation
