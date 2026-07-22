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
    type: z.enum(TranslationPlaceholderType)
  })
  .strict();
export type LocalizationPlaceholder = z.infer<typeof localizationPlaceholderSchema>;

export interface LocalizationTextAnalysis {
  iconSlugs: string[];
  placeholders: LocalizationPlaceholder[];
  problems: LocalizationProblem[];
  styleSlugs: string[];
  tooltipSlugs: string[];
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

export const localizationStyleSchema = z
  .object({
    slug: rowSlugSchema,
    color: colorSchema.optional(),
    bold: z.boolean().default(false),
    italic: z.boolean().default(false),
    underline: z.boolean().default(false)
  })
  .strict();
export type LocalizationStyle = z.infer<typeof localizationStyleSchema>;

const optionalAssetSlugSchema = z.preprocess((value) => (value === "" ? undefined : value), rowSlugSchema.optional());

export const localizationTooltipSchema = z
  .object({
    slug: rowSlugSchema,
    iconAssetId: optionalAssetSlugSchema,
    titleKey: localizationKeyPathSchema,
    descriptionKey: localizationKeyPathSchema
  })
  .strict();
export type LocalizationTooltip = z.infer<typeof localizationTooltipSchema>;

export const localizationDocumentSchema = z
  .object({
    schemaVersion: z.literal(2),
    defaultLocale: localeCodeSchema.default("en"),
    locales: z.array(localeCodeSchema).default(["en"]),
    keys: z.array(localizationKeySchema).default([]),
    styles: z.array(localizationStyleSchema).default([]),
    tooltips: z.array(localizationTooltipSchema).default([])
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
    for (const duplicate of duplicateValues(document.styles.map((style) => style.slug))) {
      context.addIssue({
        code: "custom",
        message: `Duplicate localization style "${duplicate}"`,
        path: ["styles"]
      });
    }
    for (const duplicate of duplicateValues(document.tooltips.map((tooltip) => tooltip.slug))) {
      context.addIssue({
        code: "custom",
        message: `Duplicate localization tooltip "${duplicate}"`,
        path: ["tooltips"]
      });
    }
  });
export type LocalizationDocument = z.infer<typeof localizationDocumentSchema>;

export const emptyLocalizationDocument = {
  schemaVersion: 2,
  defaultLocale: "en",
  locales: ["en"],
  keys: [],
  styles: [],
  tooltips: []
} satisfies LocalizationDocument;

export type CreateOrUpdateLocalizationKey = Omit<LocalizationKey, "values" | "placeholders"> & {
  placeholders?: LocalizationPlaceholder[];
  values?: Record<string, string>;
};

export type CreateOrUpdateLocalizationStyle = LocalizationStyle;
export type CreateOrUpdateLocalizationTooltip = LocalizationTooltip;

export function validateLocalizationDocument(document: LocalizationDocument, assets?: Asset[]): LocalizationProblem[] {
  const parsed = localizationDocumentSchema.safeParse(document);
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
  const stylesBySlug = new Map(value.styles.map((style) => [style.slug, style]));
  const tooltipsBySlug = new Map(value.tooltips.map((tooltip) => [tooltip.slug, tooltip]));
  const assetsById = assets ? new Map(assets.map((asset) => [asset.id, asset])) : undefined;

  value.keys.forEach((key, keyIndex) => {
    const defaultAnalysis = analyzeLocalizationText(
      key.values[value.defaultLocale] ?? "",
      `keys.${keyIndex}.values.${value.defaultLocale}`
    );
    const expectedPlaceholders = new Map(defaultAnalysis.placeholders.map((placeholder) => [placeholder.name, placeholder]));
    const expectedIconSlugs = new Set(defaultAnalysis.iconSlugs);
    const expectedStyleSlugs = new Set(defaultAnalysis.styleSlugs);
    const expectedTooltipSlugs = new Set(defaultAnalysis.tooltipSlugs);
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
      const styleSlugs = new Set(analysis.styleSlugs);
      const tooltipSlugs = new Set(analysis.tooltipSlugs);
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
            message: `Translation ${key.path} is missing icon "<icon:${expectedIconSlug}/>"`
          });
        }
      }
      for (const iconSlug of iconSlugs) {
        if (!expectedIconSlugs.has(iconSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} has extra icon "<icon:${iconSlug}/>"`
          });
        }
      }
      for (const expectedStyleSlug of expectedStyleSlugs) {
        if (!styleSlugs.has(expectedStyleSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} is missing style "<style:${expectedStyleSlug}>"`
          });
        }
      }
      for (const styleSlug of styleSlugs) {
        if (!expectedStyleSlugs.has(styleSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} has extra style "<style:${styleSlug}>"`
          });
        }
      }
      for (const expectedTooltipSlug of expectedTooltipSlugs) {
        if (!tooltipSlugs.has(expectedTooltipSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} is missing tooltip "<tooltip:${expectedTooltipSlug}>"`
          });
        }
      }
      for (const tooltipSlug of tooltipSlugs) {
        if (!expectedTooltipSlugs.has(tooltipSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} has extra tooltip "<tooltip:${tooltipSlug}>"`
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
      for (const styleSlug of analysis.styleSlugs) {
        if (!stylesBySlug.has(styleSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} references missing style "${styleSlug}"`
          });
        }
      }
      for (const tooltipSlug of analysis.tooltipSlugs) {
        if (!tooltipsBySlug.has(tooltipSlug)) {
          problems.push({
            severity: LocalizationProblemSeverity.error,
            path: `keys.${keyIndex}.values.${locale}`,
            message: `Translation ${key.path} references missing tooltip "${tooltipSlug}"`
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

  value.tooltips.forEach((tooltip, tooltipIndex) => {
    if (!keySet.has(tooltip.titleKey)) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path: `tooltips.${tooltipIndex}.titleKey`,
        message: `Tooltip ${tooltip.slug} references missing tooltip title key ${tooltip.titleKey}`
      });
    }
    if (!keySet.has(tooltip.descriptionKey)) {
      problems.push({
        severity: LocalizationProblemSeverity.error,
        path: `tooltips.${tooltipIndex}.descriptionKey`,
        message: `Tooltip ${tooltip.slug} references missing tooltip description key ${tooltip.descriptionKey}`
      });
    }
    if (tooltip.iconAssetId) {
      const asset = assetsById?.get(tooltip.iconAssetId);
      if (assetsById && !asset) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path: `tooltips.${tooltipIndex}.iconAssetId`,
          message: `Tooltip ${tooltip.slug} references missing UI icon asset "${tooltip.iconAssetId}"`
        });
      } else if (asset && asset.category !== AssetCategoryEnum.uiIcon) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path: `tooltips.${tooltipIndex}.iconAssetId`,
          message: `Tooltip ${tooltip.slug} references asset "${tooltip.iconAssetId}" as an icon but it is ${asset.category}, not UI_ICON`
        });
      }
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
  return localizationDocumentSchema.parse({
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
  return localizationDocumentSchema.parse({
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
  return localizationDocumentSchema.parse({
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
  return localizationDocumentSchema.parse({
    ...document,
    keys: document.keys.map((entry) => (entry.path === path ? key : entry))
  });
}

export function removeLocalizationKey(document: LocalizationDocument, path: string): LocalizationDocument {
  if (!document.keys.some((key) => key.path === path)) {
    throw new Error(`Localization key ${path} does not exist`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    keys: document.keys.filter((key) => key.path !== path),
    tooltips: document.tooltips.filter((tooltip) => tooltip.titleKey !== path && tooltip.descriptionKey !== path)
  });
}

export function addLocalizationStyle(document: LocalizationDocument, input: CreateOrUpdateLocalizationStyle): LocalizationDocument {
  const style = localizationStyleSchema.parse(input);
  if (document.styles.some((entry) => entry.slug === style.slug)) {
    throw new Error(`Localization style ${style.slug} already exists`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    styles: [...document.styles, style]
  });
}

export function updateLocalizationStyle(
  document: LocalizationDocument,
  slug: string,
  input: CreateOrUpdateLocalizationStyle
): LocalizationDocument {
  const style = localizationStyleSchema.parse(input);
  if (!document.styles.some((entry) => entry.slug === slug)) {
    throw new Error(`Localization style ${slug} does not exist`);
  }
  if (slug !== style.slug && document.styles.some((entry) => entry.slug === style.slug)) {
    throw new Error(`Localization style ${style.slug} already exists`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    styles: document.styles.map((entry) => (entry.slug === slug ? style : entry))
  });
}

export function removeLocalizationStyle(document: LocalizationDocument, slug: string): LocalizationDocument {
  if (!document.styles.some((style) => style.slug === slug)) {
    throw new Error(`Localization style ${slug} does not exist`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    styles: document.styles.filter((style) => style.slug !== slug)
  });
}

export function addLocalizationTooltip(document: LocalizationDocument, input: CreateOrUpdateLocalizationTooltip): LocalizationDocument {
  const tooltip = localizationTooltipSchema.parse(input);
  if (document.tooltips.some((entry) => entry.slug === tooltip.slug)) {
    throw new Error(`Localization tooltip ${tooltip.slug} already exists`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    tooltips: [...document.tooltips, tooltip]
  });
}

export function updateLocalizationTooltip(
  document: LocalizationDocument,
  slug: string,
  input: CreateOrUpdateLocalizationTooltip
): LocalizationDocument {
  const tooltip = localizationTooltipSchema.parse(input);
  if (!document.tooltips.some((entry) => entry.slug === slug)) {
    throw new Error(`Localization tooltip ${slug} does not exist`);
  }
  if (slug !== tooltip.slug && document.tooltips.some((entry) => entry.slug === tooltip.slug)) {
    throw new Error(`Localization tooltip ${tooltip.slug} already exists`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    tooltips: document.tooltips.map((entry) => (entry.slug === slug ? tooltip : entry))
  });
}

export function removeLocalizationTooltip(document: LocalizationDocument, slug: string): LocalizationDocument {
  if (!document.tooltips.some((tooltip) => tooltip.slug === slug)) {
    throw new Error(`Localization tooltip ${slug} does not exist`);
  }
  return localizationDocumentSchema.parse({
    ...document,
    tooltips: document.tooltips.filter((tooltip) => tooltip.slug !== slug)
  });
}

export function localizationKeyConstant(path: string): string {
  return path.split(".").join("_");
}

// NOTE: Do not replace or "simplify" this. The generated GDScript API intentionally relies on lodash snakeCase here.
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
  const styleSlugs: string[] = [];
  const styleStack: string[] = [];
  const tooltipSlugs: string[] = [];
  const tooltipStack: string[] = [];

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

  for (const match of text.matchAll(localizationRichTagRegex)) {
    const token = match[0] ?? "";
    if (token.startsWith("<style:")) {
      const styleSlug = match[1] ?? "";
      styleSlugs.push(styleSlug);
      styleStack.push(styleSlug);
      continue;
    }
    if (token === "</style>") {
      if (styleStack.length === 0) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path,
          message: "Style close tag has no matching open tag"
        });
      } else {
        styleStack.pop();
      }
      continue;
    }
    if (token.startsWith("<tooltip:")) {
      const tooltipSlug = match[2] ?? "";
      tooltipSlugs.push(tooltipSlug);
      tooltipStack.push(tooltipSlug);
      continue;
    }
    if (token === "</tooltip>") {
      if (tooltipStack.length === 0) {
        problems.push({
          severity: LocalizationProblemSeverity.error,
          path,
          message: "Tooltip close tag has no matching open tag"
        });
      } else {
        tooltipStack.pop();
      }
      continue;
    }
    if (token.startsWith("<icon:")) {
      iconSlugs.push(match[3] ?? "");
      continue;
    }
  }

  if (/<style(?::|\s|>)/.test(text.replace(/<style:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*>/g, ""))) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: "Style open tag must look like <style:STYLE_SLUG>"
    });
  }
  if (styleStack.length > 0) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: `Style "${styleStack[styleStack.length - 1]}" is not closed`
    });
  }
  if (/<tooltip(?::|\s|>)/.test(text.replace(/<tooltip:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*>/g, ""))) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: "Tooltip open tag must look like <tooltip:TOOLTIP_SLUG>"
    });
  }
  if (tooltipStack.length > 0) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: `Tooltip "${tooltipStack[tooltipStack.length - 1]}" is not closed`
    });
  }

  if (/<icon(?::|\s|>)/.test(text.replace(/<icon:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*\s*\/>/g, ""))) {
    problems.push({
      severity: LocalizationProblemSeverity.error,
      path,
      message: "Icon tag must look like <icon:ICON_SLUG/>"
    });
  }

  return {
    iconSlugs: uniqueValues(iconSlugs),
    placeholders,
    problems,
    styleSlugs: uniqueValues(styleSlugs),
    tooltipSlugs: uniqueValues(tooltipSlugs)
  };
}

const localizationSlugPattern = "[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*";
const localizationRichTagRegex = new RegExp(
  [
    `<style:(${localizationSlugPattern})>`,
    "<\\/style>",
    `<tooltip:(${localizationSlugPattern})>`,
    "<\\/tooltip>",
    `<icon:(${localizationSlugPattern})\\s*\\/>`
  ].join("|"),
  "g"
);

export function localizationPlaceholderDefault(type: TranslationPlaceholderType): string | number {
  if (type === TranslationPlaceholderType.integer) {
    return -1;
  }
  if (type === TranslationPlaceholderType.number) {
    return -1.0;
  }
  return "UNKNOWN";
}

export function localizationPlaceholderDefaultText(type: TranslationPlaceholderType): string {
  if (type === TranslationPlaceholderType.number) {
    return "-1.0";
  }
  return String(localizationPlaceholderDefault(type));
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

function normalizeLocalizationKey(document: LocalizationDocument, input: CreateOrUpdateLocalizationKey): LocalizationKey {
  return localizationKeySchema.parse({
    ...input,
    values: Object.fromEntries(
      document.locales.map((locale) => [locale, input.values?.[locale] ?? input.values?.[document.defaultLocale] ?? ""])
    ),
    placeholders: input.placeholders ?? []
  });
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
