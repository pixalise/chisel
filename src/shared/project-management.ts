import z from "zod";

export enum ProjectTodoPriority {
  low = "LOW",
  medium = "MEDIUM",
  high = "HIGH",
  urgent = "URGENT"
}

export const projectTodoPriorityLabelMap: Record<ProjectTodoPriority, string> = {
  [ProjectTodoPriority.low]: "Low",
  [ProjectTodoPriority.medium]: "Medium",
  [ProjectTodoPriority.high]: "High",
  [ProjectTodoPriority.urgent]: "Urgent"
};

export const projectTodoPriorityOptionValues = Object.values(ProjectTodoPriority).map((priority) => ({
  label: projectTodoPriorityLabelMap[priority],
  value: priority
}));

function isDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const titleSchema = z.string().trim().min(1, "Title is required").max(160, "Title must be at most 160 characters");
const timestampSchema = z.string().min(1);
export const projectTodoDueDateSchema = z.string().refine(isDateOnly, "Due date must be YYYY-MM-DD");
const optionalDueDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  projectTodoDueDateSchema.optional()
);

export const createOrUpdateProjectTodoSchema = z
  .object({
    title: titleSchema,
    priority: z.enum(ProjectTodoPriority).default(ProjectTodoPriority.medium),
    dueDate: optionalDueDateSchema
  })
  .strict();
export type CreateOrUpdateProjectTodo = z.output<typeof createOrUpdateProjectTodoSchema>;

export const createOrUpdateProjectSubitemSchema = z
  .object({
    title: titleSchema
  })
  .strict();
export type CreateOrUpdateProjectSubitem = z.output<typeof createOrUpdateProjectSubitemSchema>;

export const projectTodoSubitemSchema = z
  .object({
    id: z.nanoid(),
    title: titleSchema,
    completed: z.boolean().default(false),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
  })
  .strict();
export type ProjectTodoSubitem = z.infer<typeof projectTodoSubitemSchema>;

export const projectTodoSchema = z
  .object({
    id: z.nanoid(),
    title: titleSchema,
    completed: z.boolean().default(false),
    priority: z.enum(ProjectTodoPriority).default(ProjectTodoPriority.medium),
    dueDate: optionalDueDateSchema,
    archivedAt: z.string().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    subitems: z.array(projectTodoSubitemSchema).default([])
  })
  .strict();
export type ProjectTodo = z.infer<typeof projectTodoSchema>;

export const projectManagementJsonSchema = z
  .object({
    schemaVersion: z.literal(1),
    todos: z.array(projectTodoSchema).default([])
  })
  .strict();
export type ProjectManagementJson = z.infer<typeof projectManagementJsonSchema>;
