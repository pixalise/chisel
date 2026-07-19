"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptySourceStateJson = exports.sourceStateJsonSchema = exports.committedSourceSnapshotSchema = void 0;
const zod_1 = __importDefault(require("zod"));
const localization_1 = require("./localization");
const schemas_1 = require("./schemas");
exports.committedSourceSnapshotSchema = zod_1.default
    .object({
    id: zod_1.default.nanoid(),
    committedAt: zod_1.default.string(),
    project: schemas_1.projectFileSchema,
    tables: zod_1.default.array(schemas_1.anyDataTableSchema),
    assets: schemas_1.assetsJsonSchema,
    localization: localization_1.localizationDocumentSchema.default(localization_1.emptyLocalizationDocument)
})
    .strict();
exports.sourceStateJsonSchema = zod_1.default
    .object({
    schemaVersion: zod_1.default.literal(1),
    commits: zod_1.default.array(exports.committedSourceSnapshotSchema).default([])
})
    .strict();
exports.emptySourceStateJson = {
    schemaVersion: 1,
    commits: []
};
