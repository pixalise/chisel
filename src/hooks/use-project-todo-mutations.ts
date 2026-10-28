import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import projectManagementService from "@/services/project-management-service"
import type {
  CreateOrUpdateProjectSubitem,
  CreateOrUpdateProjectTodo,
  ProjectTodo,
  ProjectTodoMoveDirection,
  ProjectTodoSubitem,
} from "@/shared/project-management"
import { useMutation } from "@tanstack/react-query"
interface UpdateTodoInput {
  input: CreateOrUpdateProjectTodo
  todoId: string
}
interface ToggleTodoCompletedInput {
  completed: boolean
  todoId: string
}
interface AddSubitemInput {
  input: CreateOrUpdateProjectSubitem
  todoId: string
}
interface UpdateSubitemInput {
  input: CreateOrUpdateProjectSubitem
  subitemId: string
  todoId: string
}
interface RemoveSubitemInput {
  subitemId: string
  todoId: string
}
interface MoveTodoInput {
  direction: ProjectTodoMoveDirection
  todoId: string
}
interface MoveSubitemInput {
  direction: ProjectTodoMoveDirection
  subitemId: string
  todoId: string
}
interface ToggleSubitemCompletedInput {
  completed: boolean
  subitemId: string
  todoId: string
}
export interface UseProjectTodoMutations {
  addSubitem: (input: AddSubitemInput) => Promise<ProjectTodoSubitem>
  addTodo: (input: CreateOrUpdateProjectTodo) => Promise<ProjectTodo>
  archiveTodo: (todoId: string) => Promise<ProjectTodo>
  isProjectTodoMutating: boolean
  moveSubitem: (input: MoveSubitemInput) => Promise<ProjectTodoSubitem>
  moveTodo: (input: MoveTodoInput) => Promise<ProjectTodo>
  removeSubitem: (input: RemoveSubitemInput) => Promise<void>
  removeTodo: (todoId: string) => Promise<void>
  toggleSubitemCompleted: (input: ToggleSubitemCompletedInput) => Promise<ProjectTodoSubitem>
  toggleTodoCompleted: (input: ToggleTodoCompletedInput) => Promise<ProjectTodo>
  unarchiveTodo: (todoId: string) => Promise<ProjectTodo>
  updateSubitem: (input: UpdateSubitemInput) => Promise<ProjectTodoSubitem>
  updateTodo: (input: UpdateTodoInput) => Promise<ProjectTodo>
}
async function invalidateTodos(): Promise<void> {
  await Promise.all(
    [[HookKeysEnum.LIST_PROJECT_TODOS_QUERY]].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}
const useProjectTodoMutations = (): UseProjectTodoMutations => {
  const addTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "add"],
    mutationFn: async (input: CreateOrUpdateProjectTodo) => projectManagementService.addTodo(input),
    onSuccess: invalidateTodos,
  })
  const updateTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "update"],
    mutationFn: async (input1: UpdateTodoInput) => {
      const { todoId, input } = input1
      return projectManagementService.updateTodo(todoId, input)
    },
    onSuccess: invalidateTodos,
  })
  const removeTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "remove"],
    mutationFn: async (todoId: string) => projectManagementService.removeTodo(todoId),
    onSuccess: invalidateTodos,
  })
  const moveTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "move"],
    mutationFn: async (input1: MoveTodoInput) => {
      const { todoId, direction } = input1
      return projectManagementService.moveTodo(todoId, direction)
    },
    onSuccess: invalidateTodos,
  })
  const archiveTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "archive"],
    mutationFn: async (todoId: string) => projectManagementService.archiveTodo(todoId),
    onSuccess: invalidateTodos,
  })
  const unarchiveTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "unarchive"],
    mutationFn: async (todoId: string) => projectManagementService.unarchiveTodo(todoId),
    onSuccess: invalidateTodos,
  })
  const toggleTodoMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "toggle"],
    mutationFn: async (input1: ToggleTodoCompletedInput) => {
      const { todoId, completed } = input1
      return projectManagementService.toggleTodoCompleted(todoId, completed)
    },
    onSuccess: invalidateTodos,
  })
  const addSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "addSubitem"],
    mutationFn: async (input1: AddSubitemInput) => {
      const { todoId, input } = input1
      return projectManagementService.addSubitem(todoId, input)
    },
    onSuccess: invalidateTodos,
  })
  const updateSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "updateSubitem"],
    mutationFn: async (input1: UpdateSubitemInput) => {
      const { todoId, subitemId, input } = input1
      return projectManagementService.updateSubitem(todoId, subitemId, input)
    },
    onSuccess: invalidateTodos,
  })
  const removeSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "removeSubitem"],
    mutationFn: async (input1: RemoveSubitemInput) => {
      const { todoId, subitemId } = input1
      return projectManagementService.removeSubitem(todoId, subitemId)
    },
    onSuccess: invalidateTodos,
  })
  const moveSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "moveSubitem"],
    mutationFn: async (input1: MoveSubitemInput) => {
      const { todoId, subitemId, direction } = input1
      return projectManagementService.moveSubitem(todoId, subitemId, direction)
    },
    onSuccess: invalidateTodos,
  })
  const toggleSubitemMutation = useMutation({
    mutationKey: [HookKeysEnum.PROJECT_TODO_MUTATION, "toggleSubitem"],
    mutationFn: async (input1: ToggleSubitemCompletedInput) => {
      const { todoId, subitemId, completed } = input1
      return projectManagementService.toggleSubitemCompleted(todoId, subitemId, completed)
    },
    onSuccess: invalidateTodos,
  })
  return {
    addSubitem: addSubitemMutation.mutateAsync,
    addTodo: addTodoMutation.mutateAsync,
    archiveTodo: archiveTodoMutation.mutateAsync,
    isProjectTodoMutating:
      addTodoMutation.isPending ||
      updateTodoMutation.isPending ||
      removeTodoMutation.isPending ||
      moveTodoMutation.isPending ||
      archiveTodoMutation.isPending ||
      unarchiveTodoMutation.isPending ||
      toggleTodoMutation.isPending ||
      addSubitemMutation.isPending ||
      updateSubitemMutation.isPending ||
      removeSubitemMutation.isPending ||
      moveSubitemMutation.isPending ||
      toggleSubitemMutation.isPending,
    moveSubitem: moveSubitemMutation.mutateAsync,
    moveTodo: moveTodoMutation.mutateAsync,
    removeSubitem: removeSubitemMutation.mutateAsync,
    removeTodo: removeTodoMutation.mutateAsync,
    toggleSubitemCompleted: toggleSubitemMutation.mutateAsync,
    toggleTodoCompleted: toggleTodoMutation.mutateAsync,
    unarchiveTodo: unarchiveTodoMutation.mutateAsync,
    updateSubitem: updateSubitemMutation.mutateAsync,
    updateTodo: updateTodoMutation.mutateAsync,
  }
}
export default useProjectTodoMutations
