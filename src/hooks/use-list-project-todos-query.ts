import { HookKeysEnum } from "@/enums/hook-keys-enum"
import projectManagementService from "@/services/project-management-service"
import type { ProjectTodo } from "@/shared/project-management"
import { useQuery } from "@tanstack/react-query"
export interface UseListProjectTodosQuery {
  areProjectTodosLoading: boolean
  todos: ProjectTodo[]
}
const useListProjectTodosQuery = (): UseListProjectTodosQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_PROJECT_TODOS_QUERY],
    queryFn: async () => projectManagementService.listTodos(),
  })
  return {
    areProjectTodosLoading: isLoading,
    todos: data ?? [],
  }
}
export default useListProjectTodosQuery
