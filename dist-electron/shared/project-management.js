"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectManagementJsonSchema = exports.projectTodoSchema = exports.projectTodoSubitemSchema = exports.createOrUpdateProjectSubitemSchema = exports.createOrUpdateProjectTodoSchema = exports.projectTodoDueDateSchema = exports.projectTodoPriorityOptionValues = exports.projectTodoPriorityLabelMap = exports.ProjectTodoPriority = void 0;
const zod_1 = __importDefault(require("zod"));
var ProjectTodoPriority;
(function (ProjectTodoPriority) {
    ProjectTodoPriority["low"] = "LOW";
    ProjectTodoPriority["medium"] = "MEDIUM";
    ProjectTodoPriority["high"] = "HIGH";
    ProjectTodoPriority["urgent"] = "URGENT";
})(ProjectTodoPriority || (exports.ProjectTodoPriority = ProjectTodoPriority = {}));
exports.projectTodoPriorityLabelMap = {
    [ProjectTodoPriority.low]: "Low",
    [ProjectTodoPriority.medium]: "Medium",
    [ProjectTodoPriority.high]: "High",
    [ProjectTodoPriority.urgent]: "Urgent"
};
exports.projectTodoPriorityOptionValues = Object.values(ProjectTodoPriority).map((priority) => ({
    label: exports.projectTodoPriorityLabelMap[priority],
    value: priority
}));
function isDateOnly(value) {
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
const titleSchema = zod_1.default.string().trim().min(1, "Title is required").max(160, "Title must be at most 160 characters");
const timestampSchema = zod_1.default.string().min(1);
exports.projectTodoDueDateSchema = zod_1.default.string().refine(isDateOnly, "Due date must be YYYY-MM-DD");
const optionalDueDateSchema = zod_1.default.preprocess((value) => (value === "" || value === null ? undefined : value), exports.projectTodoDueDateSchema.optional());
exports.createOrUpdateProjectTodoSchema = zod_1.default
    .object({
    title: titleSchema,
    priority: zod_1.default.enum(ProjectTodoPriority).default(ProjectTodoPriority.medium),
    dueDate: optionalDueDateSchema
})
    .strict();
exports.createOrUpdateProjectSubitemSchema = zod_1.default
    .object({
    title: titleSchema
})
    .strict();
exports.projectTodoSubitemSchema = zod_1.default
    .object({
    id: zod_1.default.nanoid(),
    title: titleSchema,
    completed: zod_1.default.boolean().default(false),
    createdAt: timestampSchema,
    updatedAt: timestampSchema
})
    .strict();
exports.projectTodoSchema = zod_1.default
    .object({
    id: zod_1.default.nanoid(),
    title: titleSchema,
    completed: zod_1.default.boolean().default(false),
    priority: zod_1.default.enum(ProjectTodoPriority).default(ProjectTodoPriority.medium),
    dueDate: optionalDueDateSchema,
    archivedAt: zod_1.default.string().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    subitems: zod_1.default.array(exports.projectTodoSubitemSchema).default([])
})
    .strict();
exports.projectManagementJsonSchema = zod_1.default
    .object({
    schemaVersion: zod_1.default.literal(1),
    todos: zod_1.default.array(exports.projectTodoSchema).default([])
})
    .strict();
