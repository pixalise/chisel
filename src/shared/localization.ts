import z from "zod";
import { rowSlugSchema } from "./schemas";

export enum TranslationPlaceholderType {
  string = "string",
  number = "number",
  integer = "integer"
}

export enum LocalizationProblemSeverity {
  error = "error",
  warning = "warning"
}

export interface LocalizationProblem {
  message: string;
  path: string;
  severity: LocalizationProblemSeverity;
}

export const localeCodeSchema = z
  .string()
  .min(2, "Locale code is required")
  .max(16, "Locale code must be at most 16 characters")
  .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/, "Locale code must look like en or en_US");

export const translationPlaceholderSchema = z
  .object({
    name: z
      .string()
      .min(1, "Placeholder name is required")
      .max(64, "Placeholder name must be at most 64 characters")
      .regex(/^[a-z][a-z0-9_]*$/, "Placeholder name must be snake_case"),
    type: z.enum(TranslationPlaceholderType)
  })
  .strict();
export type TranslationPlaceholder = z.infer<typeof translationPlaceholderSchema>;

export const translationEntrySchema = z
  .object({
    slug: rowSlugSchema,
    namespace: rowSlugSchema,
    sourceText: z.string(),
    description: z.string().optional(),
    context: z.string().optional(),
    placeholders: z.array(translationPlaceholderSchema).default([]),
    values: z.record(z.string(), z.string()).default({})
  })
  .strict();
export type TranslationEntry = z.infer<typeof translationEntrySchema>;

export const localizationDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    activeLocales: z.array(localeCodeSchema).default(["en"]),
    translations: z.array(translationEntrySchema).default([])
  })
  .strict()
  .superRefine((document, context) => {
    for (const duplicate of duplicateValues(document.translations.map((translation) => translationKey(translation)))) {
      context.addIssue({
        code: "custom",
        message: `Duplicate translation key "${duplicate}"`,
        path: ["translations"]
      });
    }
  });
export type LocalizationDocument = z.infer<typeof localizationDocumentSchema>;

export const emptyLocalizationDocument = {
  schemaVersion: 1,
  activeLocales: ["en"],
  translations: []
} satisfies LocalizationDocument;

export function translationKey(translation: Pick<TranslationEntry, "namespace" | "slug">): string {
  return `${translation.namespace}.${translation.slug}`;
}

export function validateLocalizationDocument(document: LocalizationDocument): LocalizationProblem[] {
  const problems: LocalizationProblem[] = [];
  const locales = new Set(document.activeLocales);

  document.translations.forEach((translation, index) => {
    const declaredPlaceholders = new Set(translation.placeholders.map((placeholder) => placeholder.name));
    validatePlaceholderUsage(translation.sourceText, declaredPlaceholders, problems, `translations.${index}.sourceText`);
    for (const locale of document.activeLocales) {
      if (!Object.prototype.hasOwnProperty.call(translation.values, locale)) {
        problems.push({
          severity: LocalizationProblemSeverity.warning,
          path: `translations.${index}.values.${locale}`,
          message: `Translation ${translationKey(translation)} is missing locale ${locale}`
        });
        continue;
      }
      validatePlaceholderUsage(translation.values[locale] ?? "", declaredPlaceholders, problems, `translations.${index}.values.${locale}`);
    }
    for (const locale of Object.keys(translation.values)) {
      if (!locales.has(locale)) {
        problems.push({
          severity: LocalizationProblemSeverity.warning,
          path: `translations.${index}.values.${locale}`,
          message: `Translation ${translationKey(translation)} has value for inactive locale ${locale}`
        });
      }
    }
  });

  return problems;
}

function validatePlaceholderUsage(text: string, declaredPlaceholders: Set<string>, problems: LocalizationProblem[], path: string): void {
  const usedPlaceholders = placeholderNames(text);
  for (const usedPlaceholder of usedPlaceholders) {
    if (!declaredPlaceholders.has(usedPlaceholder)) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path,
        message: `Placeholder "{${usedPlaceholder}}" is not declared`
      });
    }
  }
  for (const declaredPlaceholder of declaredPlaceholders) {
    if (!usedPlaceholders.has(declaredPlaceholder)) {
      problems.push({
        severity: LocalizationProblemSeverity.warning,
        path,
        message: `Declared placeholder "{${declaredPlaceholder}}" is not used`
      });
    }
  }
}

function placeholderNames(text: string): Set<string> {
  const matches = text.matchAll(/\{([a-z][a-z0-9_]*)\}/g);
  return new Set([...matches].map((match) => match[1]!));
}

function duplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
}
