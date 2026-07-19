import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import {
  createOrUpdateProjectTodoSchema,
  projectManagementJsonSchema,
  ProjectTodoPriority,
  projectTodoSchema,
  projectTodoSubitemSchema
} from "./project-management";

describe("project management schemas", () => {
  it("accepts valid priorities and date-only due dates", () => {
    const todo = createOrUpdateProjectTodoSchema.parse({
      title: "Build camera controls",
      priority: ProjectTodoPriority.high,
      dueDate: "2026-07-19"
    });

    expect(todo).toEqual({
      title: "Build camera controls",
      priority: ProjectTodoPriority.high,
      dueDate: "2026-07-19"
    });
  });

  it("defaults priority to medium", () => {
    expect(createOrUpdateProjectTodoSchema.parse({ title: "Write notes" }).priority).toBe(ProjectTodoPriority.medium);
  });

  it("rejects invalid priorities, invalid due dates, and empty titles", () => {
    expect(createOrUpdateProjectTodoSchema.safeParse({ title: "Task", priority: "BLOCKER" }).success).toBe(false);
    expect(createOrUpdateProjectTodoSchema.safeParse({ title: "Task", dueDate: "2026-02-31" }).success).toBe(false);
    expect(createOrUpdateProjectTodoSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects nested subitems beyond one level", () => {
    expect(
      projectTodoSubitemSchema.safeParse({
        id: nanoid(),
        title: "Nested work",
        completed: false,
        createdAt: "2026-07-19T00:00:00.000Z",
        updatedAt: "2026-07-19T00:00:00.000Z",
        subitems: []
      }).success
    ).toBe(false);
  });

  it("accepts a project management document", () => {
    const todo = projectTodoSchema.parse({
      id: nanoid(),
      title: "Wire UI",
      completed: false,
      priority: ProjectTodoPriority.medium,
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
      subitems: [
        {
          id: nanoid(),
          title: "Form",
          completed: true,
          createdAt: "2026-07-19T00:00:00.000Z",
          updatedAt: "2026-07-19T00:00:00.000Z"
        }
      ]
    });

    expect(projectManagementJsonSchema.parse({ schemaVersion: 1, todos: [todo] }).todos).toHaveLength(1);
  });
});
