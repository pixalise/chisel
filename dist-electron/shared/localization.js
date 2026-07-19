"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyLocalizationDocument = exports.localizationDocumentSchema = exports.localizationDocumentV2Schema = exports.localizationTermSchema = exports.localizationKeySchema = exports.localizationPlaceholderSchema = exports.localizationKeyPathSchema = exports.localeCodeSchema = exports.LocalizationProblemSeverity = exports.TranslationPlaceholderType = void 0;
exports.validateLocalizationDocument = validateLocalizationDocument;
exports.addLocaleToLocalization = addLocaleToLocalization;
exports.removeLocaleFromLocalization = removeLocaleFromLocalization;
exports.addLocalizationKey = addLocalizationKey;
exports.updateLocalizationKey = updateLocalizationKey;
exports.removeLocalizationKey = removeLocalizationKey;
exports.addLocalizationTerm = addLocalizationTerm;
exports.updateLocalizationTerm = updateLocalizationTerm;
exports.removeLocalizationTerm = removeLocalizationTerm;
exports.localizationKeyConstant = localizationKeyConstant;
exports.localizationTypedSegments = localizationTypedSegments;
exports.localizationPlaceholderNames = localizationPlaceholderNames;
const zod_1 = __importDefault(require("zod"));
const asset_paths_1 = require("./asset-paths");
const schemas_1 = require("./schemas");
var TranslationPlaceholderType;
(function (TranslationPlaceholderType) {
    TranslationPlaceholderType["string"] = "string";
    TranslationPlaceholderType["number"] = "number";
    TranslationPlaceholderType["integer"] = "integer";
})(TranslationPlaceholderType || (exports.TranslationPlaceholderType = TranslationPlaceholderType = {}));
var LocalizationProblemSeverity;
(function (LocalizationProblemSeverity) {
    LocalizationProblemSeverity["error"] = "error";
    LocalizationProblemSeverity["warning"] = "warning";
})(LocalizationProblemSeverity || (exports.LocalizationProblemSeverity = LocalizationProblemSeverity = {}));
exports.localeCodeSchema = zod_1.default
    .string()
    .min(2, "Locale code is required")
    .max(16, "Locale code must be at most 16 characters")
    .regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/, "Locale code must look like en or en_US");
exports.localizationKeyPathSchema = zod_1.default
    .string()
    .min(3, "Localization key path is required")
    .max(160, "Localization key path must be at most 160 characters")
    .regex(/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*(?:\.[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)+$/, "Localization key path must be CONSTANT.CASE segments");
exports.localizationPlaceholderSchema = zod_1.default
    .object({
    name: zod_1.default
        .string()
        .min(1, "Placeholder name is required")
        .max(64, "Placeholder name must be at most 64 characters")
        .regex(/^[a-z][a-z0-9_]*$/, "Placeholder name must be snake_case"),
    type: zod_1.default.enum(TranslationPlaceholderType),
    term: schemas_1.rowSlugSchema.optional()
})
    .strict();
exports.localizationKeySchema = zod_1.default
    .object({
    path: exports.localizationKeyPathSchema,
    description: zod_1.default.string().optional(),
    context: zod_1.default.string().optional(),
    values: zod_1.default.record(zod_1.default.string(), zod_1.default.string()).default({}),
    placeholders: zod_1.default.array(exports.localizationPlaceholderSchema).default([])
})
    .strict();
const colorSchema = zod_1.default.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color must be #RRGGBB");
exports.localizationTermSchema = zod_1.default
    .object({
    slug: schemas_1.rowSlugSchema,
    color: colorSchema.optional(),
    tooltipKey: exports.localizationKeyPathSchema.optional()
})
    .strict();
exports.localizationDocumentV2Schema = zod_1.default
    .object({
    schemaVersion: zod_1.default.literal(2),
    defaultLocale: exports.localeCodeSchema.default("en"),
    locales: zod_1.default.array(exports.localeCodeSchema).default(["en"]),
    keys: zod_1.default.array(exports.localizationKeySchema).default([]),
    terms: zod_1.default.array(exports.localizationTermSchema).default([])
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
const legacyTranslationPlaceholderSchema = exports.localizationPlaceholderSchema.omit({ term: true });
const legacyTranslationEntrySchema = zod_1.default
    .object({
    slug: schemas_1.rowSlugSchema,
    namespace: schemas_1.rowSlugSchema,
    sourceText: zod_1.default.string(),
    description: zod_1.default.string().optional(),
    context: zod_1.default.string().optional(),
    placeholders: zod_1.default.array(legacyTranslationPlaceholderSchema).default([]),
    values: zod_1.default.record(zod_1.default.string(), zod_1.default.string()).default({})
})
    .strict();
const localizationDocumentV1Schema = zod_1.default
    .object({
    schemaVersion: zod_1.default.literal(1),
    activeLocales: zod_1.default.array(exports.localeCodeSchema).default(["en"]),
    translations: zod_1.default.array(legacyTranslationEntrySchema).default([])
})
    .strict();
exports.localizationDocumentSchema = zod_1.default.union([exports.localizationDocumentV2Schema, localizationDocumentV1Schema.transform(migrateV1ToV2)]);
exports.emptyLocalizationDocument = {
    schemaVersion: 2,
    defaultLocale: "en",
    locales: ["en"],
    keys: [],
    terms: []
};
function validateLocalizationDocument(document) {
    const parsed = exports.localizationDocumentV2Schema.safeParse(document);
    if (!parsed.success) {
        return parsed.error.issues.map((issue) => ({
            severity: LocalizationProblemSeverity.error,
            path: issue.path.join("."),
            message: issue.message
        }));
    }
    const value = parsed.data;
    const problems = [];
    const localeSet = new Set(value.locales);
    const keySet = new Set(value.keys.map((key) => key.path));
    const termsBySlug = new Map(value.terms.map((term) => [term.slug, term]));
    value.keys.forEach((key, keyIndex) => {
        const placeholderNamesForKey = key.placeholders.map((placeholder) => placeholder.name);
        for (const duplicate of duplicateValues(placeholderNamesForKey)) {
            problems.push({
                severity: LocalizationProblemSeverity.error,
                path: `keys.${keyIndex}.placeholders`,
                message: `Duplicate placeholder "${duplicate}"`
            });
        }
        for (const placeholder of key.placeholders) {
            if (placeholder.term && !termsBySlug.has(placeholder.term)) {
                problems.push({
                    severity: LocalizationProblemSeverity.error,
                    path: `keys.${keyIndex}.placeholders.${placeholder.name}.term`,
                    message: `Placeholder "${placeholder.name}" references missing term "${placeholder.term}"`
                });
            }
        }
        for (const locale of value.locales) {
            if (!Object.prototype.hasOwnProperty.call(key.values, locale)) {
                problems.push({
                    severity: LocalizationProblemSeverity.error,
                    path: `keys.${keyIndex}.values.${locale}`,
                    message: `Translation ${key.path} is missing locale ${locale}`
                });
                continue;
            }
            validatePlaceholderUsage(key.values[locale] ?? "", new Set(placeholderNamesForKey), problems, `keys.${keyIndex}.values.${locale}`);
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
function addLocaleToLocalization(document, locale) {
    const parsedLocale = exports.localeCodeSchema.parse(locale);
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
function removeLocaleFromLocalization(document, locale) {
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
function addLocalizationKey(document, input) {
    const key = normalizeLocalizationKey(document, input);
    if (document.keys.some((entry) => entry.path === key.path)) {
        throw new Error(`Localization key ${key.path} already exists`);
    }
    return parseV2({
        ...document,
        keys: [...document.keys, key]
    });
}
function updateLocalizationKey(document, path, input) {
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
function removeLocalizationKey(document, path) {
    if (!document.keys.some((key) => key.path === path)) {
        throw new Error(`Localization key ${path} does not exist`);
    }
    return parseV2({
        ...document,
        keys: document.keys.filter((key) => key.path !== path),
        terms: document.terms.map((term) => (term.tooltipKey === path ? { ...term, tooltipKey: undefined } : term))
    });
}
function addLocalizationTerm(document, input) {
    const term = exports.localizationTermSchema.parse(input);
    if (document.terms.some((entry) => entry.slug === term.slug)) {
        throw new Error(`Localization term ${term.slug} already exists`);
    }
    return parseV2({
        ...document,
        terms: [...document.terms, term]
    });
}
function updateLocalizationTerm(document, slug, input) {
    const term = exports.localizationTermSchema.parse(input);
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
            placeholders: key.placeholders.map((placeholder) => placeholder.term === slug
                ? {
                    ...placeholder,
                    term: term.slug
                }
                : placeholder)
        }))
    });
}
function removeLocalizationTerm(document, slug) {
    if (!document.terms.some((term) => term.slug === slug)) {
        throw new Error(`Localization term ${slug} does not exist`);
    }
    return parseV2({
        ...document,
        terms: document.terms.filter((term) => term.slug !== slug),
        keys: document.keys.map((key) => ({
            ...key,
            placeholders: key.placeholders.map((placeholder) => placeholder.term === slug
                ? {
                    ...placeholder,
                    term: undefined
                }
                : placeholder)
        }))
    });
}
function localizationKeyConstant(path) {
    return path.split(".").join("_");
}
function localizationTypedSegments(path) {
    return path.split(".").map((segment) => (0, asset_paths_1.snakeCase)(segment));
}
function localizationPlaceholderNames(text) {
    const matches = text.matchAll(/\{([a-z][a-z0-9_]*)\}/g);
    return new Set([...matches].map((match) => match[1]));
}
function migrateV1ToV2(document) {
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
            placeholders: translation.placeholders,
            values: Object.fromEntries(locales.map((locale) => [locale, translation.values[locale] ?? translation.sourceText]))
        }))
    });
}
function normalizeLocalizationKey(document, input) {
    return exports.localizationKeySchema.parse({
        ...input,
        values: Object.fromEntries(document.locales.map((locale) => [locale, input.values?.[locale] ?? input.values?.[document.defaultLocale] ?? ""])),
        placeholders: input.placeholders ?? []
    });
}
function parseV2(value) {
    return exports.localizationDocumentV2Schema.parse(value);
}
function validatePlaceholderUsage(text, declaredPlaceholders, problems, path) {
    const usedPlaceholders = localizationPlaceholderNames(text);
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
                severity: LocalizationProblemSeverity.error,
                path,
                message: `Declared placeholder "{${declaredPlaceholder}}" is not used`
            });
        }
    }
}
function validateGeneratedTypedPaths(keys) {
    const problems = [];
    const normalizedPaths = new Map();
    const root = { children: new Map() };
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
function duplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();
    for (const value of values) {
        if (seen.has(value)) {
            duplicates.add(value);
        }
        seen.add(value);
    }
    return [...duplicates];
}
function uniqueValues(values) {
    return [...new Set(values)];
}
