import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import tableService from "@/services/table-service";
import type { AnyDataTable } from "../../shared/schemas";

export interface UseListTablesQuery {
  areTablesLoading: boolean;
  tables: AnyDataTable[];
}

const useListTablesQuery = (): UseListTablesQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listTablesQuery],
    queryFn: async () => {
      const tables = await tableService.listAllTables();
      return tables;
    }
  });

  return {
    areTablesLoading: isLoading,
    tables: data ?? []
  };
};

export default useListTablesQuery;
