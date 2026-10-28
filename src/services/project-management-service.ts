import fileService from "@/services/file-service"
import {
  createOrUpdateProjectSubitemSchema,
  createOrUpdateProjectTodoSchema,
  projectManagementJsonSchema,
  projectTodoMoveDirectionSchema,
  projectTodoSchema,
  projectTodoSubitemSchema,
  type CreateOrUpdateProjectSubitem,
  type CreateOrUpdateProjectTodo,
  type ProjectManagementJson,
  type ProjectTodo,
  type ProjectTodoMoveDirection,
  type ProjectTodoSubitem,
} from "@/shared/project-management"
import appStore from "@/stores/app-store"
import { nanoid } from "nanoid"
class ProjectManagementService {
  private static schemaVersion = 1
  public async listTodos(): Promise<ProjectTodo[]> {
    const document = await this.readDocument()
    return document.todos
  }
  public async addTodo(input: CreateOrUpdateProjectTodo): Promise<ProjectTodo> {
    const parsedInput = createOrUpdateProjectTodoSchema.parse(input)
    const document = await this.readDocument()
    const now = this.timestamp()
    const todo = projectTodoSchema.parse({
      ...parsedInput,
      id: nanoid(),
      completed: false,
      createdAt: now,
      updatedAt: now,
      subitems: [],
    })
    await this.writeTodos([...document.todos, todo])
    return todo
  }
  public async updateTodo(id: string, input: CreateOrUpdateProjectTodo): Promise<ProjectTodo> {
    const parsedInput = createOrUpdateProjectTodoSchema.parse(input)
    const document = await this.readDocument()
    let updatedTodo: ProjectTodo | undefined
    const todos = document.todos.map((todo) => {
      if (todo.id !== id) {
        return todo
      }
      updatedTodo = projectTodoSchema.parse({
        ...todo,
        title: parsedInput.title,
        priority: parsedInput.priority,
        dueDate: parsedInput.dueDate,
        updatedAt: this.timestamp(),
      })
      return updatedTodo
    })
    if (!updatedTodo) {
      throw new Error(`Todo ${id} does not exist`)
    }
    await this.writeTodos(todos)
    return updatedTodo
  }
  public async removeTodo(id: string): Promise<void> {
    const document = await this.readDocument()
    const todos = document.todos.filter((todo) => todo.id !== id)
    if (todos.length === document.todos.length) {
      throw new Error(`Todo ${id} does not exist`)
    }
    await this.writeTodos(todos)
  }
  public async moveTodo(id: string, direction: ProjectTodoMoveDirection): Promise<ProjectTodo> {
    const parsedDirection = projectTodoMoveDirectionSchema.parse(direction)
    const document = await this.readDocument()
    const sourceIndex = document.todos.findIndex((todo) => todo.id === id)
    if (sourceIndex < 0) {
      throw new Error(`Todo ${id} does not exist`)
    }
    const sourceTodo = document.todos[sourceIndex]!
    const sameArchiveStateIndexes = document.todos
      .map((todo, index) => ({ index, todo }))
      .filter((entry) => Boolean(entry.todo.archivedAt) === Boolean(sourceTodo.archivedAt))
      .map((entry) => entry.index)
    const sourceGroupIndex = sameArchiveStateIndexes.indexOf(sourceIndex)
    const targetGroupIndex = sourceGroupIndex + this.moveDelta(parsedDirection)
    const targetIndex = sameArchiveStateIndexes[targetGroupIndex]
    if (typeof targetIndex !== "number") {
      return sourceTodo
    }
    const movedTodo = projectTodoSchema.parse({
      ...sourceTodo,
      updatedAt: this.timestamp(),
    })
    const todos = [...document.todos]
    todos[sourceIndex] = movedTodo
    ;[todos[sourceIndex], todos[targetIndex]] = [todos[targetIndex]!, todos[sourceIndex]!]
    await this.writeTodos(todos)
    return movedTodo
  }
  public async archiveTodo(id: string): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      archivedAt: todo.archivedAt ?? this.timestamp(),
      updatedAt: this.timestamp(),
    }))
  }
  public async unarchiveTodo(id: string): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      archivedAt: undefined,
      updatedAt: this.timestamp(),
    }))
  }
  public async toggleTodoCompleted(id: string, completed: boolean): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      completed,
      updatedAt: this.timestamp(),
    }))
  }
  public async addSubitem(
    todoId: string,
    input: CreateOrUpdateProjectSubitem
  ): Promise<ProjectTodoSubitem> {
    const parsedInput = createOrUpdateProjectSubitemSchema.parse(input)
    const now = this.timestamp()
    const subitem = projectTodoSubitemSchema.parse({
      ...parsedInput,
      id: nanoid(),
      completed: false,
      createdAt: now,
      updatedAt: now,
    })
    await this.updateTodoState(todoId, (todo) => ({
      ...todo,
      subitems: [...todo.subitems, subitem],
      updatedAt: this.timestamp(),
    }))
    return subitem
  }
  public async updateSubitem(
    todoId: string,
    subitemId: string,
    input: CreateOrUpdateProjectSubitem
  ): Promise<ProjectTodoSubitem> {
    const parsedInput = createOrUpdateProjectSubitemSchema.parse(input)
    let updatedSubitem: ProjectTodoSubitem | undefined
    await this.updateTodoState(todoId, (todo) => {
      const subitems = todo.subitems.map((subitem) => {
        if (subitem.id !== subitemId) {
          return subitem
        }
        updatedSubitem = projectTodoSubitemSchema.parse({
          ...subitem,
          ...parsedInput,
          updatedAt: this.timestamp(),
        })
        return updatedSubitem
      })
      if (!updatedSubitem) {
        throw new Error(`Subitem ${subitemId} does not exist`)
      }
      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp(),
      }
    })
    if (!updatedSubitem) {
      throw new Error(`Subitem ${subitemId} does not exist`)
    }
    return updatedSubitem
  }
  public async removeSubitem(todoId: string, subitemId: string): Promise<void> {
    await this.updateTodoState(todoId, (todo) => {
      let removed = false
      const subitems = todo.subitems.filter((subitem) => {
        const keep = subitem.id !== subitemId
        removed ||= !keep
        return keep
      })
      if (!removed) {
        throw new Error(`Subitem ${subitemId} does not exist`)
      }
      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp(),
      }
    })
  }
  public async moveSubitem(
    todoId: string,
    subitemId: string,
    direction: ProjectTodoMoveDirection
  ): Promise<ProjectTodoSubitem> {
    const parsedDirection = projectTodoMoveDirectionSchema.parse(direction)
    let movedSubitem: ProjectTodoSubitem | undefined
    await this.updateTodoState(todoId, (todo) => {
      const sourceIndex = todo.subitems.findIndex((subitem) => subitem.id === subitemId)
      if (sourceIndex < 0) {
        throw new Error(`Subitem ${subitemId} does not exist`)
      }
      const targetIndex = sourceIndex + this.moveDelta(parsedDirection)
      movedSubitem = todo.subitems[sourceIndex]
      if (targetIndex < 0 || targetIndex >= todo.subitems.length) {
        return todo
      }
      movedSubitem = projectTodoSubitemSchema.parse({
        ...todo.subitems[sourceIndex],
        updatedAt: this.timestamp(),
      })
      const subitems = [...todo.subitems]
      subitems[sourceIndex] = movedSubitem
      ;[subitems[sourceIndex], subitems[targetIndex]] = [
        subitems[targetIndex]!,
        subitems[sourceIndex]!,
      ]
      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp(),
      }
    })
    if (!movedSubitem) {
      throw new Error(`Subitem ${subitemId} does not exist`)
    }
    return movedSubitem
  }
  public async toggleSubitemCompleted(
    todoId: string,
    subitemId: string,
    completed: boolean
  ): Promise<ProjectTodoSubitem> {
    let updatedSubitem: ProjectTodoSubitem | undefined
    await this.updateTodoState(todoId, (todo) => {
      const subitems = todo.subitems.map((subitem) => {
        if (subitem.id !== subitemId) {
          return subitem
        }
        updatedSubitem = projectTodoSubitemSchema.parse({
          ...subitem,
          completed,
          updatedAt: this.timestamp(),
        })
        return updatedSubitem
      })
      if (!updatedSubitem) {
        throw new Error(`Subitem ${subitemId} does not exist`)
      }
      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp(),
      }
    })
    if (!updatedSubitem) {
      throw new Error(`Subitem ${subitemId} does not exist`)
    }
    return updatedSubitem
  }
  private async readDocument(): Promise<ProjectManagementJson> {
    const document = await fileService.tryReadProjectManagementJson(
      appStore.getState().computed.project.path
    )
    return (
      document ??
      projectManagementJsonSchema.parse({
        schemaVersion: ProjectManagementService.schemaVersion,
        todos: [],
      })
    )
  }
  private async writeTodos(todos: ProjectTodo[]): Promise<ProjectManagementJson> {
    const project = appStore.getState().computed.project
    const document = projectManagementJsonSchema.parse({
      schemaVersion: ProjectManagementService.schemaVersion,
      todos,
    })
    await fileService.writeProjectManagementJson(project, document)
    return document
  }
  private async updateTodoState(
    id: string,
    update: (todo: ProjectTodo) => ProjectTodo
  ): Promise<ProjectTodo> {
    const document = await this.readDocument()
    let updatedTodo: ProjectTodo | undefined
    const todos = document.todos.map((todo) => {
      if (todo.id !== id) {
        return todo
      }
      updatedTodo = projectTodoSchema.parse(update(todo))
      return updatedTodo
    })
    if (!updatedTodo) {
      throw new Error(`Todo ${id} does not exist`)
    }
    await this.writeTodos(todos)
    return updatedTodo
  }
  private timestamp(): string {
    return new Date().toISOString()
  }
  private moveDelta(direction: ProjectTodoMoveDirection): number {
    return direction === "up" ? -1 : 1
  }
}
const projectManagementService = new ProjectManagementService()
export default projectManagementService
