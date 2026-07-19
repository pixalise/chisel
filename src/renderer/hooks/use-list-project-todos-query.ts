import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import projectManagementService from "@/services/project-management-service";
import type { ProjectTodo } from "../../shared/project-management";

export interface UseListProjectTodosQuery {
  areProjectTodosLoading: boolean;
  todos: ProjectTodo[];
}

const useListProjectTodosQuery = (): UseListProjectTodosQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listProjectTodosQuery],
    queryFn: async () => projectManagementService.listTodos()
  });

  return {
    areProjectTodosLoading: isLoading,
    todos: data ?? []
  };
};

export default useListProjectTodosQuery;
