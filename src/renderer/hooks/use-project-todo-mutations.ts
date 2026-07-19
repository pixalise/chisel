import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import projectManagementService from "@/services/project-management-service";
import CacheUtils from "@/utils/cache-utils";
import type {
  CreateOrUpdateProjectSubitem,
  CreateOrUpdateProjectTodo,
  ProjectTodo,
  ProjectTodoSubitem
} from "../../shared/project-management";

interface UpdateTodoInput {
  input: CreateOrUpdateProjectTodo;
  todoId: string;
}

interface ToggleTodoCompletedInput {
  completed: boolean;
  todoId: string;
}

interface AddSubitemInput {
  input: CreateOrUpdateProjectSubitem;
  todoId: string;
}

interface UpdateSubitemInput {
  input: CreateOrUpdateProjectSubitem;
  subitemId: string;
  todoId: string;
}

interface RemoveSubitemInput {
  subitemId: string;
  todoId: string;
}

interface ToggleSubitemCompletedInput {
  completed: boolean;
  subitemId: string;
  todoId: string;
}

export interface UseProjectTodoMutations {
  addSubitem: (input: AddSubitemInput) => Promise<ProjectTodoSubitem>;
  addTodo: (input: CreateOrUpdateProjectTodo) => Promise<ProjectTodo>;
  archiveTodo: (todoId: string) => Promise<ProjectTodo>;
  isProjectTodoMutating: boolean;
  removeSubitem: (input: RemoveSubitemInput) => Promise<void>;
  removeTodo: (todoId: string) => Promise<void>;
  toggleSubitemCompleted: (input: ToggleSubitemCompletedInput) => Promise<ProjectTodoSubitem>;
  toggleTodoCompleted: (input: ToggleTodoCompletedInput) => Promise<ProjectTodo>;
  unarchiveTodo: (todoId: string) => Promise<ProjectTodo>;
  updateSubitem: (input: UpdateSubitemInput) => Promise<ProjectTodoSubitem>;
  updateTodo: (input: UpdateTodoInput) => Promise<ProjectTodo>;
}

async function invalidateTodos(): Promise<void> {
  await CacheUtils.invalidateQueries([[HookKeysEnum.listProjectTodosQuery]]);
}

const useProjectTodoMutations = (): UseProjectTodoMutations => {
  const addTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "add"],
    mutationFn: async (input: CreateOrUpdateProjectTodo) => projectManagementService.addTodo(input),
    onSuccess: invalidateTodos
  });
  const updateTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "update"],
    mutationFn: async ({ todoId, input }: UpdateTodoInput) => projectManagementService.updateTodo(todoId, input),
    onSuccess: invalidateTodos
  });
  const removeTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "remove"],
    mutationFn: async (todoId: string) => projectManagementService.removeTodo(todoId),
    onSuccess: invalidateTodos
  });
  const archiveTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "archive"],
    mutationFn: async (todoId: string) => projectManagementService.archiveTodo(todoId),
    onSuccess: invalidateTodos
  });
  const unarchiveTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "unarchive"],
    mutationFn: async (todoId: string) => projectManagementService.unarchiveTodo(todoId),
    onSuccess: invalidateTodos
  });
  const toggleTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "toggle"],
    mutationFn: async ({ todoId, completed }: ToggleTodoCompletedInput) => projectManagementService.toggleTodoCompleted(todoId, completed),
    onSuccess: invalidateTodos
  });
  const addSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "addSubitem"],
    mutationFn: async ({ todoId, input }: AddSubitemInput) => projectManagementService.addSubitem(todoId, input),
    onSuccess: invalidateTodos
  });
  const updateSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "updateSubitem"],
    mutationFn: async ({ todoId, subitemId, input }: UpdateSubitemInput) =>
      projectManagementService.updateSubitem(todoId, subitemId, input),
    onSuccess: invalidateTodos
  });
  const removeSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "removeSubitem"],
    mutationFn: async ({ todoId, subitemId }: RemoveSubitemInput) => projectManagementService.removeSubitem(todoId, subitemId),
    onSuccess: invalidateTodos
  });
  const toggleSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.projectTodoMutation, "toggleSubitem"],
    mutationFn: async ({ todoId, subitemId, completed }: ToggleSubitemCompletedInput) =>
      projectManagementService.toggleSubitemCompleted(todoId, subitemId, completed),
    onSuccess: invalidateTodos
  });

  return {
    addSubitem: addSubitemMutation.mutateAsync,
    addTodo: addTodoMutation.mutateAsync,
    archiveTodo: archiveTodoMutation.mutateAsync,
    isProjectTodoMutating:
      addTodoMutation.isPending ||
      updateTodoMutation.isPending ||
      removeTodoMutation.isPending ||
      archiveTodoMutation.isPending ||
      unarchiveTodoMutation.isPending ||
      toggleTodoMutation.isPending ||
      addSubitemMutation.isPending ||
      updateSubitemMutation.isPending ||
      removeSubitemMutation.isPending ||
      toggleSubitemMutation.isPending,
    removeSubitem: removeSubitemMutation.mutateAsync,
    removeTodo: removeTodoMutation.mutateAsync,
    toggleSubitemCompleted: toggleSubitemMutation.mutateAsync,
    toggleTodoCompleted: toggleTodoMutation.mutateAsync,
    unarchiveTodo: unarchiveTodoMutation.mutateAsync,
    updateSubitem: updateSubitemMutation.mutateAsync,
    updateTodo: updateTodoMutation.mutateAsync
  };
};

export default useProjectTodoMutations;
