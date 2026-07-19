import { nanoid } from "nanoid";
import BaseService from "@/services/base-service";
import fileService from "@/services/file-service";
import appStore from "@/stores/app-store";
import { zodParse } from "@/utils/zod-parse";
import {
  createOrUpdateProjectSubitemSchema,
  createOrUpdateProjectTodoSchema,
  type CreateOrUpdateProjectSubitem,
  type CreateOrUpdateProjectTodo,
  projectManagementJsonSchema,
  type ProjectManagementJson,
  projectTodoSchema,
  type ProjectTodo,
  projectTodoSubitemSchema,
  type ProjectTodoSubitem
} from "../../shared/project-management";

class ProjectManagementService extends BaseService {
  private static schemaVersion = 1;

  public async listTodos(): Promise<ProjectTodo[]> {
    const document = await this.readDocument();
    return document.todos;
  }

  public async addTodo(input: CreateOrUpdateProjectTodo): Promise<ProjectTodo> {
    const parsedInput = zodParse(createOrUpdateProjectTodoSchema, input);
    const document = await this.readDocument();
    const now = this.timestamp();
    const todo = zodParse(projectTodoSchema, {
      ...parsedInput,
      id: nanoid(),
      completed: false,
      createdAt: now,
      updatedAt: now,
      subitems: []
    });

    await this.writeTodos([...document.todos, todo]);
    return todo;
  }

  public async updateTodo(id: string, input: CreateOrUpdateProjectTodo): Promise<ProjectTodo> {
    const parsedInput = zodParse(createOrUpdateProjectTodoSchema, input);
    const document = await this.readDocument();
    let updatedTodo: ProjectTodo | undefined;
    const todos = document.todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }
      updatedTodo = zodParse(projectTodoSchema, {
        ...todo,
        title: parsedInput.title,
        priority: parsedInput.priority,
        dueDate: parsedInput.dueDate,
        updatedAt: this.timestamp()
      });
      return updatedTodo;
    });

    if (!updatedTodo) {
      throw new Error(`Todo ${id} does not exist`);
    }

    await this.writeTodos(todos);
    return updatedTodo;
  }

  public async removeTodo(id: string): Promise<void> {
    const document = await this.readDocument();
    const todos = document.todos.filter((todo) => todo.id !== id);
    if (todos.length === document.todos.length) {
      throw new Error(`Todo ${id} does not exist`);
    }

    await this.writeTodos(todos);
  }

  public async archiveTodo(id: string): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      archivedAt: todo.archivedAt ?? this.timestamp(),
      updatedAt: this.timestamp()
    }));
  }

  public async unarchiveTodo(id: string): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      archivedAt: undefined,
      updatedAt: this.timestamp()
    }));
  }

  public async toggleTodoCompleted(id: string, completed: boolean): Promise<ProjectTodo> {
    return this.updateTodoState(id, (todo) => ({
      ...todo,
      completed,
      updatedAt: this.timestamp()
    }));
  }

  public async addSubitem(todoId: string, input: CreateOrUpdateProjectSubitem): Promise<ProjectTodoSubitem> {
    const parsedInput = zodParse(createOrUpdateProjectSubitemSchema, input);
    const now = this.timestamp();
    const subitem = zodParse(projectTodoSubitemSchema, {
      ...parsedInput,
      id: nanoid(),
      completed: false,
      createdAt: now,
      updatedAt: now
    });

    await this.updateTodoState(todoId, (todo) => ({
      ...todo,
      subitems: [...todo.subitems, subitem],
      updatedAt: this.timestamp()
    }));
    return subitem;
  }

  public async updateSubitem(todoId: string, subitemId: string, input: CreateOrUpdateProjectSubitem): Promise<ProjectTodoSubitem> {
    const parsedInput = zodParse(createOrUpdateProjectSubitemSchema, input);
    let updatedSubitem: ProjectTodoSubitem | undefined;
    await this.updateTodoState(todoId, (todo) => {
      const subitems = todo.subitems.map((subitem) => {
        if (subitem.id !== subitemId) {
          return subitem;
        }
        updatedSubitem = zodParse(projectTodoSubitemSchema, {
          ...subitem,
          ...parsedInput,
          updatedAt: this.timestamp()
        });
        return updatedSubitem;
      });

      if (!updatedSubitem) {
        throw new Error(`Subitem ${subitemId} does not exist`);
      }

      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp()
      };
    });

    if (!updatedSubitem) {
      throw new Error(`Subitem ${subitemId} does not exist`);
    }

    return updatedSubitem;
  }

  public async removeSubitem(todoId: string, subitemId: string): Promise<void> {
    await this.updateTodoState(todoId, (todo) => {
      let removed = false;
      const subitems = todo.subitems.filter((subitem) => {
        const keep = subitem.id !== subitemId;
        removed ||= !keep;
        return keep;
      });

      if (!removed) {
        throw new Error(`Subitem ${subitemId} does not exist`);
      }

      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp()
      };
    });
  }

  public async toggleSubitemCompleted(todoId: string, subitemId: string, completed: boolean): Promise<ProjectTodoSubitem> {
    let updatedSubitem: ProjectTodoSubitem | undefined;
    await this.updateTodoState(todoId, (todo) => {
      const subitems = todo.subitems.map((subitem) => {
        if (subitem.id !== subitemId) {
          return subitem;
        }
        updatedSubitem = zodParse(projectTodoSubitemSchema, {
          ...subitem,
          completed,
          updatedAt: this.timestamp()
        });
        return updatedSubitem;
      });

      if (!updatedSubitem) {
        throw new Error(`Subitem ${subitemId} does not exist`);
      }

      return {
        ...todo,
        subitems,
        updatedAt: this.timestamp()
      };
    });

    if (!updatedSubitem) {
      throw new Error(`Subitem ${subitemId} does not exist`);
    }

    return updatedSubitem;
  }

  private async readDocument(): Promise<ProjectManagementJson> {
    const document = await fileService.tryReadProjectManagementJson(this.getPath());
    return (
      document ??
      zodParse(projectManagementJsonSchema, {
        schemaVersion: ProjectManagementService.schemaVersion,
        todos: []
      })
    );
  }

  private async writeTodos(todos: ProjectTodo[]): Promise<ProjectManagementJson> {
    const project = appStore.getState().computed.project;
    const document = zodParse(projectManagementJsonSchema, {
      schemaVersion: ProjectManagementService.schemaVersion,
      todos
    });
    await fileService.writeProjectManagementJson(project, document);
    return document;
  }

  private async updateTodoState(id: string, update: (todo: ProjectTodo) => ProjectTodo): Promise<ProjectTodo> {
    const document = await this.readDocument();
    let updatedTodo: ProjectTodo | undefined;
    const todos = document.todos.map((todo) => {
      if (todo.id !== id) {
        return todo;
      }
      updatedTodo = zodParse(projectTodoSchema, update(todo));
      return updatedTodo;
    });

    if (!updatedTodo) {
      throw new Error(`Todo ${id} does not exist`);
    }

    await this.writeTodos(todos);
    return updatedTodo;
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}

const projectManagementService = new ProjectManagementService();
export default projectManagementService;
