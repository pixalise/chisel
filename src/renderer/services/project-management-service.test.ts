import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../../shared/schemas";
import { type ProjectManagementJson, ProjectTodoPriority } from "../../shared/project-management";

const mocks = vi.hoisted(() => {
  const project: Project = {
    id: "3JRzno-Vksr4Gf7hMa1k8",
    name: "Test Project",
    path: "/tmp/chisel-project"
  };
  return {
    document: undefined as ProjectManagementJson | undefined,
    project,
    tryReadProjectManagementJson: vi.fn(),
    writeProjectManagementJson: vi.fn()
  };
});

vi.mock("@/stores/app-store", () => ({
  default: {
    getState: () => ({
      computed: {
        project: mocks.project
      }
    })
  }
}));

vi.mock("@/services/file-service", () => ({
  default: {
    tryReadProjectManagementJson: mocks.tryReadProjectManagementJson,
    writeProjectManagementJson: mocks.writeProjectManagementJson
  }
}));

const { default: projectManagementService } = await import("./project-management-service");

describe("project management service", () => {
  beforeEach(() => {
    mocks.document = undefined;
    mocks.tryReadProjectManagementJson.mockReset();
    mocks.writeProjectManagementJson.mockReset();
    mocks.tryReadProjectManagementJson.mockImplementation(async () => mocks.document);
    mocks.writeProjectManagementJson.mockImplementation(async (_project: Project, document: ProjectManagementJson) => {
      mocks.document = document;
    });
  });

  it("returns an empty list when project management data is missing", async () => {
    await expect(projectManagementService.listTodos()).resolves.toEqual([]);
  });

  it("adds, updates, and removes root todos", async () => {
    const added = await projectManagementService.addTodo({
      title: "First pass",
      priority: ProjectTodoPriority.high,
      dueDate: "2026-07-19"
    });

    expect(mocks.document?.todos).toHaveLength(1);
    expect(added).toMatchObject({
      title: "First pass",
      priority: ProjectTodoPriority.high,
      dueDate: "2026-07-19",
      completed: false,
      subitems: []
    });

    const updated = await projectManagementService.updateTodo(added.id, {
      title: "Second pass",
      priority: ProjectTodoPriority.low
    });

    expect(updated).toMatchObject({
      id: added.id,
      title: "Second pass",
      priority: ProjectTodoPriority.low
    });
    expect(updated.dueDate).toBeUndefined();

    await projectManagementService.removeTodo(added.id);
    expect(mocks.document?.todos).toEqual([]);
  });

  it("archives and unarchives root todos", async () => {
    const todo = await projectManagementService.addTodo({ title: "Archive me", priority: ProjectTodoPriority.medium });

    const archived = await projectManagementService.archiveTodo(todo.id);
    expect(archived.archivedAt).toEqual(expect.any(String));
    expect((await projectManagementService.listTodos()).filter((entry) => entry.archivedAt)).toHaveLength(1);

    const active = await projectManagementService.unarchiveTodo(todo.id);
    expect(active.archivedAt).toBeUndefined();
    expect((await projectManagementService.listTodos()).filter((entry) => entry.archivedAt)).toHaveLength(0);
  });

  it("toggles root todo completion independently", async () => {
    const todo = await projectManagementService.addTodo({ title: "Toggle me", priority: ProjectTodoPriority.medium });
    await projectManagementService.addSubitem(todo.id, { title: "Child stays independent" });

    const completed = await projectManagementService.toggleTodoCompleted(todo.id, true);

    expect(completed.completed).toBe(true);
    expect(completed.subitems[0]?.completed).toBe(false);
  });

  it("moves root todos and subitems by array order", async () => {
    const firstTodo = await projectManagementService.addTodo({ title: "First", priority: ProjectTodoPriority.medium });
    const secondTodo = await projectManagementService.addTodo({ title: "Second", priority: ProjectTodoPriority.medium });
    const thirdTodo = await projectManagementService.addTodo({ title: "Third", priority: ProjectTodoPriority.medium });
    const firstSubitem = await projectManagementService.addSubitem(secondTodo.id, { title: "Subitem A" });
    const secondSubitem = await projectManagementService.addSubitem(secondTodo.id, { title: "Subitem B" });

    await projectManagementService.moveTodo(secondTodo.id, "up");
    expect((await projectManagementService.listTodos()).map((todo) => todo.id)).toEqual([secondTodo.id, firstTodo.id, thirdTodo.id]);

    await projectManagementService.moveSubitem(secondTodo.id, secondSubitem.id, "up");
    expect(mocks.document?.todos.find((todo) => todo.id === secondTodo.id)?.subitems.map((subitem) => subitem.id)).toEqual([
      secondSubitem.id,
      firstSubitem.id
    ]);
  });

  it("adds, updates, toggles, and removes subitems under the correct todo", async () => {
    const firstTodo = await projectManagementService.addTodo({ title: "Parent A", priority: ProjectTodoPriority.medium });
    const secondTodo = await projectManagementService.addTodo({ title: "Parent B", priority: ProjectTodoPriority.medium });
    const subitem = await projectManagementService.addSubitem(firstTodo.id, { title: "Subtask" });

    expect(subitem).toMatchObject({ title: "Subtask", completed: false });
    expect(mocks.document?.todos.find((todo) => todo.id === firstTodo.id)?.subitems).toHaveLength(1);
    expect(mocks.document?.todos.find((todo) => todo.id === secondTodo.id)?.subitems).toHaveLength(0);

    const toggled = await projectManagementService.toggleSubitemCompleted(firstTodo.id, subitem.id, true);
    expect(toggled.completed).toBe(true);

    const updated = await projectManagementService.updateSubitem(firstTodo.id, subitem.id, { title: "Updated subtask" });
    expect(updated.title).toBe("Updated subtask");

    await projectManagementService.removeSubitem(firstTodo.id, subitem.id);
    expect(mocks.document?.todos.find((todo) => todo.id === firstTodo.id)?.subitems).toEqual([]);
  });
});
