"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const project_management_1 = require("./project-management");
(0, vitest_1.describe)("project management schemas", () => {
    (0, vitest_1.it)("accepts valid priorities and date-only due dates", () => {
        const todo = project_management_1.createOrUpdateProjectTodoSchema.parse({
            title: "Build camera controls",
            priority: project_management_1.ProjectTodoPriority.high,
            dueDate: "2026-07-19"
        });
        (0, vitest_1.expect)(todo).toEqual({
            title: "Build camera controls",
            priority: project_management_1.ProjectTodoPriority.high,
            dueDate: "2026-07-19"
        });
    });
    (0, vitest_1.it)("defaults priority to medium", () => {
        (0, vitest_1.expect)(project_management_1.createOrUpdateProjectTodoSchema.parse({ title: "Write notes" }).priority).toBe(project_management_1.ProjectTodoPriority.medium);
    });
    (0, vitest_1.it)("rejects invalid priorities, invalid due dates, and empty titles", () => {
        (0, vitest_1.expect)(project_management_1.createOrUpdateProjectTodoSchema.safeParse({ title: "Task", priority: "BLOCKER" }).success).toBe(false);
        (0, vitest_1.expect)(project_management_1.createOrUpdateProjectTodoSchema.safeParse({ title: "Task", dueDate: "2026-02-31" }).success).toBe(false);
        (0, vitest_1.expect)(project_management_1.createOrUpdateProjectTodoSchema.safeParse({ title: "   " }).success).toBe(false);
    });
    (0, vitest_1.it)("rejects nested subitems beyond one level", () => {
        (0, vitest_1.expect)(project_management_1.projectTodoSubitemSchema.safeParse({
            id: (0, nanoid_1.nanoid)(),
            title: "Nested work",
            completed: false,
            createdAt: "2026-07-19T00:00:00.000Z",
            updatedAt: "2026-07-19T00:00:00.000Z",
            subitems: []
        }).success).toBe(false);
    });
    (0, vitest_1.it)("accepts a project management document", () => {
        const todo = project_management_1.projectTodoSchema.parse({
            id: (0, nanoid_1.nanoid)(),
            title: "Wire UI",
            completed: false,
            priority: project_management_1.ProjectTodoPriority.medium,
            createdAt: "2026-07-19T00:00:00.000Z",
            updatedAt: "2026-07-19T00:00:00.000Z",
            subitems: [
                {
                    id: (0, nanoid_1.nanoid)(),
                    title: "Form",
                    completed: true,
                    createdAt: "2026-07-19T00:00:00.000Z",
                    updatedAt: "2026-07-19T00:00:00.000Z"
                }
            ]
        });
        (0, vitest_1.expect)(project_management_1.projectManagementJsonSchema.parse({ schemaVersion: 1, todos: [todo] }).todos).toHaveLength(1);
    });
});
