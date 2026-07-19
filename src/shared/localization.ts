import z from "zod";
import { rowSlugSchema, type Asset } from "./schemas";
import { AssetCategoryEnum } from "./types";
import { snakeCase } from "lodash";

export enum TranslationPlaceholderType {
  string = "string",
  number = "float",
  integer = "int"
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

export const localizationKeyPathSchema = z
  .string()
  .min(3, "Localization key path is required")
  .max(160, "Localization key path must be at most 160 characters")
  .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*(?:\.[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)+$/, "Localization key path must be CONSTANT.CASE segments");
export type LocalizationKeyPath = z.infer<typeof localizationKeyPathSchema>;

export const localizationPlaceholderSchema = z
  .object({
    name: z
      .string()
      .min(1, "Placeholder name is required")
      .max(64, "Placeholder name must be at most 64 characters")
      .regex(/^[a-z][a-z0-9_]*$/, "Placeholder name must be snake_case"),
    type: z.preprocess((value) => legacyPlaceholderType(value), z.enum(TranslationPlaceholderType)),
    term: rowSlugSchema.optional()
  })
  .strict();
export type LocalizationPlaceholder = z.infer<typeof localizationPlaceholderSchema>;

export interface LocalizationTextAnalysis {
  iconSlugs: string[];
  placeholders: LocalizationPlaceholder[];
  problems: LocalizationProblem[];
  termSlugs: string[];
}

export const localizationKeySchema = z
  .object({
    path: localizationKeyPathSchema,
    description: z.string().optional(),
    context: z.string().optional(),
    values: z.record(z.string(), z.string()).default({}),
    placeholders: z.array(localizationPlaceholderSchema).default([])
  })
  .strict();
export type LocalizationKey = z.infer<typeof localizationKeySchema>;

const colorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be #RRGGBB");

export const localizationTermSchema = z
  .object({
    slug: rowSlugSchema,
    color: colorSchema.optional(),
    tooltipKey: localizationKeyPathSchema.optional()
  })
  .strict();
export type LocalizationTerm = z.infer<typeof localizationTermSchema>;

export const localizationDocumentV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    defaultLocale: localeCodeSchema.default("en"),
    locales: z.array(localeCodeSchema).default(["en"]),
    keys: z.array(localizationKeySchema).default([]),
    terms: z.array(localizationTermSchema).default([])
  })
  .strict()
  .superRefine((document, context) => {
    for (const duplicate of duplicateValues(document.locales)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate locale "${duplicate}"`,
        path: ["locales"]
      });
    }
    if (!document.locales.includes(document.defaultLocale)) {
      context.addIssue({
        code: "custom",
        message: `Default locale "${document.defaultLocale}" must exist in locales`,
        path: ["defaultLocale"]
      });
    }
    for (const duplicate of duplicateValues(document.keys.map((key) => key.path))) {
      context.addIssue({
        code: "custom",
        message: `Duplicate localization key "${duplicate}"`,
        path: ["keys"]
      });
    }
    for (const duplicate of duplicateValues(document.terms.map((term) => term.slug))) {
      context.addIssue({
        code: "custom",
        message: `Duplicate localization term "${duplicate}"`,
        path: ["terms"]
      });
    }
  });
export type LocalizationDocumentV2 = z.infer<typeof localizationDocumentV2Schema>;

const legacyTranslationPlaceholderSchema = localizationPlaceholderSchema.omit({ term: true });
const legacyTranslationEntrySchema = z
  .object({
    slug: rowSlugSchema,
    namespace: rowSlugSchema,
    sourceText: z.string(),
    description: z.string().optional(),
    context: z.string().optional(),
    placeholders: z.array(legacyTranslationPlaceholderSchema).default([]),
    values: z.record(z.string(), z.string()).default({})
  })
  .strict();

const localizationDocumentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    activeLocales: z.array(localeCodeSchema).default(["en"]),
    translations: z.array(legacyTranslationEntrySchema).default([])
  })
  .strict();

export const localizationDocumentSchema = z.union([localizationDocumentV2Schema, localizationDocumentV1Schema.transform(migrateV1ToV2)]);
export type LocalizationDocument = z.infer<typeof localizationDocumentSchema>;

export const emptyLocalizationDocument = {
  schemaVersion: 2,
  defaultLocale: "en",
  locales: ["en"],
  keys: [],
  terms: []
} satisfies LocalizationDocumentV2;

export type CreateOrUpdateLocalizationKey = Omit<LocalizationKey, "values" | "placeholders"> & {
  placeholders?: LocalizationPlaceholder[];
  values?: Record<string, string>;
};

export type CreateOrUpdateLocalizationTerm = LocalizationTerm;

export function validateLocalizationDocument(document: LocalizationDocument, assets?: Asset[]): LocalizationProblem[] {
  const parsed = localizationDocumentV2Schema.safeParse(document);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => ({
      severity: LocalizationProblemSeverity.error,
      path: issue.path.join("."),
      message: issue.message
    }));
  }

  const value = parsed.data;
  const problems: LocalizationProblem[] = [];
  const localeSet = new Set(value.locales);
  const keySet = new Set(value.keys.map((key) => key.path));
  const termsBySlug = new Map(value.terms.map((term) => [term.slug, term]));
  const assetsById = assets ? new Map(assets.map((asset) => [asset.id, asset])) : undefined;

  value.keys.forEach((key, keyIndex) => {
    const defaultAnalysis = analyzeLocalizationText(
      key.values[value.defaultLocale] ?? "",
      `keys.${keyIndex}.values.${value.defaultLocale}`
    );
    const expectedPlaceholders = new Map(defaultAnalysis.placeholders.map((placeholder) => [placeholder.name, placeholder]));
    const expectedIconSlugs = new Set(defaultAnalysis.iconSlugs);
    problems.push(...defaultAnalysis.problems);

    for (const locale of value.locales) {
      if (!Object.prototype.hasOwnProperty.call(key.values, locale)) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path: `keys.${keyIndex}.values.${locale}`,
          message: `Translation ${key.path} is missing locale ${locale}`
        });
        continue;
      }
      const analysis =
        locale === value.defaultLocale
          ? defaultAnalysis
          : analyzeLocalizationText(key.values[locale] ?? "", `keys.${keyIndex}.values.${locale}`);
      const placeholders = new Map(analysis.placeholders.map((placeholder) => [placeholder.name, placeholder]));
      if (locale !== value.defaultLocale) {
        problems.push(...analysis.problems);
      }
      const iconSlugs = new Set(analysis.iconSlugs);
      for (const expectedPlaceholder of expectedPlaceholders.values()) {
        const actualPlaceholder = placeholders.get(expectedPlaceholder.name);
        if (!actualPlaceholder) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} is missing placeholder "{${placeholderToken(expectedPlaceholder)}}"`
          });
          continue;
        }
        if (actualPlaceholder.type !== expectedPlaceholder.type) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Placeholder "${expectedPlaceholder.name}" must use type ${placeholderSyntaxType(expectedPlaceholder.type)}`
          });
        }
      }
      for (const actualPlaceholder of placeholders.values()) {
        if (!expectedPlaceholders.has(actualPlaceholder.name)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} has extra placeholder "{${placeholderToken(actualPlaceholder)}}"`
          });
        }
      }
      for (const expectedIconSlug of expectedIconSlugs) {
        if (!iconSlugs.has(expectedIconSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} is missing icon "[icon:${expectedIconSlug}]"`
          });
        }
      }
      for (const iconSlug of iconSlugs) {
        if (!expectedIconSlugs.has(iconSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} has extra icon "[icon:${iconSlug}]"`
          });
        }
      }
      for (const iconSlug of analysis.iconSlugs) {
        const asset = assetsById?.get(iconSlug);
        if (assetsById && !asset) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} references missing UI icon asset "${iconSlug}"`
          });
          continue;
        }
        if (asset && asset.category !== AssetCategoryEnum.uiIcon) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} references asset "${iconSlug}" as an icon but it is ${asset.category}, not UI_ICON`
          });
        }
      }
      for (const termSlug of analysis.termSlugs) {
        if (!termsBySlug.has(termSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} references missing term "${termSlug}"`
          });
        }
      }
    }

    for (const locale of Object.keys(key.values)) {
      if (!localeSet.has(locale)) {
        problems.push({
          severity: LocalizationProblemSeverity.warning,
          path: `keys.${keyIndex}.values.${locale}`,
          message: `Translation ${key.path} has value for inactive locale ${locale}`
        });
      }
    }
  });

  value.terms.forEach((term, termIndex) => {
    if (term.tooltipKey && !keySet.has(term.tooltipKey)) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path: `terms.${termIndex}.tooltipKey`,
        message: `Term ${term.slug} references missing tooltip key ${term.tooltipKey}`
      });
    }
  });

  problems.push(...validateGeneratedTypedPaths(value.keys));

  return problems;
}

export function addLocaleToLocalization(document: LocalizationDocument, locale: string): LocalizationDocument {
  const parsedLocale = localeCodeSchema.parse(locale);
  if (document.locales.includes(parsedLocale)) {
    throw new Error(`Locale ${parsedLocale} already exists`);
  }
  return parseV2({
    ...document,
    locales: [...document.locales, parsedLocale],
    keys: document.keys.map((key) => ({
      ...key,
      values: {
        ...key.values,
        [parsedLocale]: key.values[document.defaultLocale] ?? ""
      }
    }))
  });
}

export function removeLocaleFromLocalization(document: LocalizationDocument, locale: string): LocalizationDocument {
  if (locale === document.defaultLocale) {
    throw new Error(`Default locale ${locale} cannot be removed`);
  }
  if (!document.locales.includes(locale)) {
    throw new Error(`Locale ${locale} does not exist`);
  }
  return parseV2({
    ...document,
    locales: document.locales.filter((entry) => entry !== locale),
    keys: document.keys.map((key) => {
      const { [locale]: _removed, ...values } = key.values;
      void _removed;
      return { ...key, values };
    })
  });
}

export function addLocalizationKey(document: LocalizationDocument, input: CreateOrUpdateLocalizationKey): LocalizationDocument {
  const key = normalizeLocalizationKey(document, input);
  if (document.keys.some((entry) => entry.path === key.path)) {
    throw new Error(`Localization key ${key.path} already exists`);
  }
  return parseV2({
    ...document,
    keys: [...document.keys, key]
  });
}

export function updateLocalizationKey(
  document: LocalizationDocument,
  path: string,
  input: CreateOrUpdateLocalizationKey
): LocalizationDocument {
  if (!document.keys.some((key) => key.path === path)) {
    throw new Error(`Localization key ${path} does not exist`);
  }
  const key = normalizeLocalizationKey(document, input);
  if (path !== key.path && document.keys.some((entry) => entry.path === key.path)) {
    throw new Error(`Localization key ${key.path} already exists`);
  }
  return parseV2({
    ...document,
    keys: document.keys.map((entry) => (entry.path === path ? key : entry))
  });
}

export function removeLocalizationKey(document: LocalizationDocument, path: string): LocalizationDocument {
  if (!document.keys.some((key) => key.path === path)) {
    throw new Error(`Localization key ${path} does not exist`);
  }
  return parseV2({
    ...document,
    keys: document.keys.filter((key) => key.path !== path),
    terms: document.terms.map((term) => (term.tooltipKey === path ? { ...term, tooltipKey: undefined } : term))
  });
}

export function addLocalizationTerm(document: LocalizationDocument, input: CreateOrUpdateLocalizationTerm): LocalizationDocument {
  const term = localizationTermSchema.parse(input);
  if (document.terms.some((entry) => entry.slug === term.slug)) {
    throw new Error(`Localization term ${term.slug} already exists`);
  }
  return parseV2({
    ...document,
    terms: [...document.terms, term]
  });
}

export function updateLocalizationTerm(
  document: LocalizationDocument,
  slug: string,
  input: CreateOrUpdateLocalizationTerm
): LocalizationDocument {
  const term = localizationTermSchema.parse(input);
  if (!document.terms.some((entry) => entry.slug === slug)) {
    throw new Error(`Localization term ${slug} does not exist`);
  }
  if (slug !== term.slug && document.terms.some((entry) => entry.slug === term.slug)) {
    throw new Error(`Localization term ${term.slug} already exists`);
  }
  return parseV2({
    ...document,
    terms: document.terms.map((entry) => (entry.slug === slug ? term : entry)),
    keys: document.keys.map((key) => ({
      ...key,
      placeholders: key.placeholders.map((placeholder) =>
        placeholder.term === slug
          ? {
              ...placeholder,
              term: term.slug
            }
          : placeholder
      )
    }))
  });
}

export function removeLocalizationTerm(document: LocalizationDocument, slug: string): LocalizationDocument {
  if (!document.terms.some((term) => term.slug === slug)) {
    throw new Error(`Localization term ${slug} does not exist`);
  }
  return parseV2({
    ...document,
    terms: document.terms.filter((term) => term.slug !== slug),
    keys: document.keys.map((key) => ({
      ...key,
      placeholders: key.placeholders.map((placeholder) =>
        placeholder.term === slug
          ? {
              ...placeholder,
              term: undefined
            }
          : placeholder
      )
    }))
  });
}

export function localizationKeyConstant(path: string): string {
  return path.split(".").join("_");
}

export function localizationTypedSegments(path: string): string[] {
  return path.split(".").map((segment) => snakeCase(segment));
}

export function localizationPlaceholderNames(text: string): Set<string> {
  return new Set(analyzeLocalizationText(text, "").placeholders.map((placeholder) => placeholder.name));
}

export function localizationPlaceholdersForKey(key: LocalizationKey, defaultLocale: string): LocalizationPlaceholder[] {
  return analyzeLocalizationText(key.values[defaultLocale] ?? "", "").placeholders;
}

export function localizationIconSlugsForKey(key: LocalizationKey, defaultLocale: string): string[] {
  return analyzeLocalizationText(key.values[defaultLocale] ?? "", "").iconSlugs;
}

export function analyzeLocalizationText(text: string, path: string): LocalizationTextAnalysis {
  const problems: LocalizationProblem[] = [];
  const iconSlugs: string[] = [];
  const placeholders: LocalizationPlaceholder[] = [];
  const placeholdersByName = new Map<string, LocalizationPlaceholder>();
  const termSlugs: string[] = [];
  const termStack: string[] = [];

  for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
    const token = match[1] ?? "";
    const placeholder = parsePlaceholderToken(token);
    if (!placeholder) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path,
        message: `Placeholder "{${token}}" must include a type like "{int:${token}}", "{float:${token}}", or "{string:${token}}"`
      });
      continue;
    }
    const existing = placeholdersByName.get(placeholder.name);
    if (existing && existing.type !== placeholder.type) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path,
        message: `Placeholder "${placeholder.name}" uses conflicting types ${placeholderSyntaxType(existing.type)} and ${placeholderSyntaxType(placeholder.type)}`
      });
      continue;
    }
    if (!existing) {
      placeholdersByName.set(placeholder.name, placeholder);
      placeholders.push(placeholder);
    }
  }

  for (const match of text.matchAll(/\[(\/term|term:([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*))\]/g)) {
    const token = match[1] ?? "";
    if (token === "/term") {
      if (termStack.length === 0) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path,
          message: "Term close tag has no matching open tag"
        });
      } else {
        termStack.pop();
      }
      continue;
    }
    const termSlug = match[2] ?? "";
    termSlugs.push(termSlug);
    termStack.push(termSlug);
  }

  if (/\[term(?::|\])/.test(text.replace(/\[term:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\]/g, ""))) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: "Term open tag must look like [term:TERM_SLUG]"
    });
  }
  if (termStack.length > 0) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: `Term "${termStack[termStack.length - 1]}" is not closed`
    });
  }

  for (const match of text.matchAll(/\[icon:([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)\]/g)) {
    iconSlugs.push(match[1] ?? "");
  }

  if (/\[icon(?::|\])/.test(text.replace(/\[icon:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\]/g, ""))) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: "Icon tag must look like [icon:ICON_SLUG]"
    });
  }

  return {
    iconSlugs: uniqueValues(iconSlugs),
    placeholders,
    problems,
    termSlugs: uniqueValues(termSlugs)
  };
}

export function localizationPlaceholderDefault(type: TranslationPlaceholderType): string | number {
  if (type === TranslationPlaceholderType.integer) {
    return -1;
  }
  if (type === TranslationPlaceholderType.number) {
    return -1.0;
  }
  return "UNKNOWN";
}

export function placeholderToken(placeholder: LocalizationPlaceholder): string {
  return `${placeholderSyntaxType(placeholder.type)}:${placeholder.name}`;
}

export function placeholderSyntaxType(type: TranslationPlaceholderType): "float" | "int" | "string" {
  if (type === TranslationPlaceholderType.integer) {
    return "int";
  }
  if (type === TranslationPlaceholderType.number) {
    return "float";
  }
  return "string";
}

function migrateV1ToV2(document: z.infer<typeof localizationDocumentV1Schema>): LocalizationDocumentV2 {
  const locales = uniqueValues(document.activeLocales.length > 0 ? document.activeLocales : ["en"]);
  const defaultLocale = locales[0] ?? "en";
  return parseV2({
    schemaVersion: 2,
    defaultLocale,
    locales,
    terms: [],
    keys: document.translations.map((translation) => ({
      path: `${translation.namespace}.${translation.slug}`,
      description: translation.description,
      context: translation.context,
      placeholders: translation.placeholders.map((placeholder) => localizationPlaceholderSchema.parse(placeholder)),
      values: Object.fromEntries(locales.map((locale) => [locale, translation.values[locale] ?? translation.sourceText]))
    }))
  });
}

function normalizeLocalizationKey(document: LocalizationDocument, input: CreateOrUpdateLocalizationKey): LocalizationKey {
  return localizationKeySchema.parse({
    ...input,
    values: Object.fromEntries(
      document.locales.map((locale) => [locale, input.values?.[locale] ?? input.values?.[document.defaultLocale] ?? ""])
    ),
    placeholders: input.placeholders ?? []
  });
}

function parseV2(value: unknown): LocalizationDocumentV2 {
  return localizationDocumentV2Schema.parse(value);
}

function parsePlaceholderToken(token: string): LocalizationPlaceholder | undefined {
  const match = /^(int|float|string):([a-z][a-z0-9_]*)$/.exec(token);
  if (!match) {
    return undefined;
  }
  return localizationPlaceholderSchema.parse({
    type: match[1],
    name: match[2]
  });
}

function legacyPlaceholderType(value: unknown): unknown {
  if (value === "integer") {
    return TranslationPlaceholderType.integer;
  }
  if (value === "number") {
    return TranslationPlaceholderType.number;
  }
  return value;
}

function validateGeneratedTypedPaths(keys: LocalizationKey[]): LocalizationProblem[] {
  const problems: LocalizationProblem[] = [];
  const normalizedPaths = new Map<string, string>();
  const root: GeneratedPathNode = { children: new Map() };

  keys.forEach((key, index) => {
    const segments = localizationTypedSegments(key.path);
    for (const segment of segments) {
      if (gdscriptReservedWords.has(segment)) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path: `keys.${index}.path`,
          message: `Localization key ${key.path} generates reserved GDScript name "${segment}"`
        });
      }
    }

    const normalizedPath = segments.join(".");
    const existingPath = normalizedPaths.get(normalizedPath);
    if (existingPath) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path: `keys.${index}.path`,
        message: `Localization key ${key.path} collides with generated path ${existingPath}`
      });
    }
    normalizedPaths.set(normalizedPath, key.path);

    let node = root;
    segments.forEach((segment, segmentIndex) => {
      if (node.leafPath) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path: `keys.${index}.path`,
          message: `Localization key ${key.path} collides with generated method path ${node.leafPath}`
        });
      }
      let child = node.children.get(segment);
      if (!child) {
        child = { children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
      if (segmentIndex === segments.length - 1) {
        if (node.children.size > 0) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${index}.path`,
            message: `Localization key ${key.path} collides with generated namespace path`
          });
        }
        node.leafPath = key.path;
      }
    });
  });

  return problems;
}

interface GeneratedPathNode {
  children: Map<string, GeneratedPathNode>;
  leafPath?: string;
}

const gdscriptReservedWords = new Set([
  "as",
  "assert",
  "await",
  "break",
  "class",
  "class_name",
  "const",
  "continue",
  "elif",
  "else",
  "enum",
  "extends",
  "false",
  "for",
  "func",
  "if",
  "in",
  "is",
  "match",
  "null",
  "pass",
  "return",
  "self",
  "signal",
  "static",
  "super",
  "true",
  "var",
  "void",
  "while"
]);

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

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}
