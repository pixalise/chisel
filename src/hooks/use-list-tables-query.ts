import { HookKeysEnum } from "@/enums/hook-keys-enum"
import tableService from "@/services/table-service"
import type { DataTableSchema } from "@/shared/schemas"
import useAppStore from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
export interface UseListTablesQuery {
  areTablesLoading: boolean
  tables: DataTableSchema[]
}
const useListTablesQuery = (): UseListTablesQuery => {
  const {
    computed: { project },
  } = useAppStore()
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_TABLES_QUERY, project.id, project.path],
    queryFn: async () => {
      const tables = await tableService.listAllTables(project)
      return tables
    },
  })
  return {
    areTablesLoading: isLoading,
    tables: data ?? [],
  }
}
export default useListTablesQuery
