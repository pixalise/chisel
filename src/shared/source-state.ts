import z from "zod"
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization"
import { anyDataTableSchema, assetsJsonSchema, projectFileSchema } from "./schemas"
export const committedSourceSnapshotSchema = z
  .object({
    id: z.nanoid(),
    committedAt: z.string(),
    project: projectFileSchema,
    tables: z.array(anyDataTableSchema),
    assets: assetsJsonSchema,
    assetHashes: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    localization: localizationDocumentSchema.default(emptyLocalizationDocument),
  })
  .strict()
export type CommittedSourceSnapshot = z.infer<typeof committedSourceSnapshotSchema>
export const sourceStateJsonSchema = z
  .object({
    schemaVersion: z.literal(4),
    commits: z.array(committedSourceSnapshotSchema).default([]),
  })
  .strict()
export type SourceStateJson = z.infer<typeof sourceStateJsonSchema>
export const emptySourceStateJson = {
  schemaVersion: 4,
  commits: [],
} satisfies SourceStateJson
