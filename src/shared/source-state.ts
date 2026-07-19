import z from "zod";
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization";
import { assetsJsonSchema, anyDataTableSchema, projectFileSchema } from "./schemas";

export const committedSourceSnapshotSchema = z
  .object({
    id: z.nanoid(),
    committedAt: z.string(),
    project: projectFileSchema,
    tables: z.array(anyDataTableSchema),
    assets: assetsJsonSchema,
    localization: localizationDocumentSchema.default(emptyLocalizationDocument)
  })
  .strict();
export type CommittedSourceSnapshot = z.infer<typeof committedSourceSnapshotSchema>;

export const sourceStateJsonSchema = z
  .object({
    schemaVersion: z.literal(1),
    commits: z.array(committedSourceSnapshotSchema).default([])
  })
  .strict();
export type SourceStateJson = z.infer<typeof sourceStateJsonSchema>;

export const emptySourceStateJson = {
  schemaVersion: 1,
  commits: []
} satisfies SourceStateJson;
