import z from "zod";
import Logger from "@/utils/logger";

export const zodParse = <Schema extends z.ZodType>(schema: Schema, dto: unknown): z.output<Schema> => {
  const result = schema.safeParse(dto);

  if (result.success) {
    return result.data;
  }

  Logger.error(
    "Zod validation failed:",
    result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "<root>",
      code: issue.code,
      message: issue.message
    })),
    { dto }
  );

  throw result.error;
};
