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
exports.localizationPlaceholdersForKey = localizationPlaceholdersForKey;
exports.localizationIconSlugsForKey = localizationIconSlugsForKey;
exports.analyzeLocalizationText = analyzeLocalizationText;
exports.localizationPlaceholderDefault = localizationPlaceholderDefault;
exports.placeholderToken = placeholderToken;
exports.placeholderSyntaxType = placeholderSyntaxType;
const zod_1 = __importDefault(require("zod"));
const schemas_1 = require("./schemas");
const types_1 = require("./types");
const lodash_1 = require("lodash");
var TranslationPlaceholderType;
(function (TranslationPlaceholderType) {
    TranslationPlaceholderType["string"] = "string";
    TranslationPlaceholderType["number"] = "float";
    TranslationPlaceholderType["integer"] = "int";
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
    type: zod_1.default.preprocess((value) => legacyPlaceholderType(value), zod_1.default.enum(TranslationPlaceholderType)),
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
function validateLocalizationDocument(document, assets) {
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
    const assetsById = assets ? new Map(assets.map((asset) => [asset.id, asset])) : undefined;
    value.keys.forEach((key, keyIndex) => {
        const defaultAnalysis = analyzeLocalizationText(key.values[value.defaultLocale] ?? "", `keys.${keyIndex}.values.${value.defaultLocale}`);
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
            const analysis = locale === value.defaultLocale
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
                if (asset && asset.category !== types_1.AssetCategoryEnum.uiIcon) {
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
    return path.split(".").map((segment) => (0, lodash_1.snakeCase)(segment));
}
function localizationPlaceholderNames(text) {
    return new Set(analyzeLocalizationText(text, "").placeholders.map((placeholder) => placeholder.name));
}
function localizationPlaceholdersForKey(key, defaultLocale) {
    return analyzeLocalizationText(key.values[defaultLocale] ?? "", "").placeholders;
}
function localizationIconSlugsForKey(key, defaultLocale) {
    return analyzeLocalizationText(key.values[defaultLocale] ?? "", "").iconSlugs;
}
function analyzeLocalizationText(text, path) {
    const problems = [];
    const iconSlugs = [];
    const placeholders = [];
    const placeholdersByName = new Map();
    const termSlugs = [];
    const termStack = [];
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
            }
            else {
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
function localizationPlaceholderDefault(type) {
    if (type === TranslationPlaceholderType.integer) {
        return -1;
    }
    if (type === TranslationPlaceholderType.number) {
        return -1.0;
    }
    return "UNKNOWN";
}
function placeholderToken(placeholder) {
    return `${placeholderSyntaxType(placeholder.type)}:${placeholder.name}`;
}
function placeholderSyntaxType(type) {
    if (type === TranslationPlaceholderType.integer) {
        return "int";
    }
    if (type === TranslationPlaceholderType.number) {
        return "float";
    }
    return "string";
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
            placeholders: translation.placeholders.map((placeholder) => exports.localizationPlaceholderSchema.parse(placeholder)),
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
function parsePlaceholderToken(token) {
    const match = /^(int|float|string):([a-z][a-z0-9_]*)$/.exec(token);
    if (!match) {
        return undefined;
    }
    return exports.localizationPlaceholderSchema.parse({
        type: match[1],
        name: match[2]
    });
}
function legacyPlaceholderType(value) {
    if (value === "integer") {
        return TranslationPlaceholderType.integer;
    }
    if (value === "number") {
        return TranslationPlaceholderType.number;
    }
    return value;
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
