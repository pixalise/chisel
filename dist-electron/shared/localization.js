"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyLocalizationDocument = exports.localizationDocumentSchema = exports.translationEntrySchema = exports.translationPlaceholderSchema = exports.localeCodeSchema = exports.LocalizationProblemSeverity = exports.TranslationPlaceholderType = void 0;
exports.translationKey = translationKey;
exports.validateLocalizationDocument = validateLocalizationDocument;
const zod_1 = __importDefault(require("zod"));
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
exports.translationPlaceholderSchema = zod_1.default
    .object({
    name: zod_1.default
        .string()
        .min(1, "Placeholder name is required")
        .max(64, "Placeholder name must be at most 64 characters")
        .regex(/^[a-z][a-z0-9_]*$/, "Placeholder name must be snake_case"),
    type: zod_1.default.enum(TranslationPlaceholderType)
})
    .strict();
exports.translationEntrySchema = zod_1.default
    .object({
    slug: schemas_1.rowSlugSchema,
    namespace: schemas_1.rowSlugSchema,
    sourceText: zod_1.default.string(),
    description: zod_1.default.string().optional(),
    context: zod_1.default.string().optional(),
    placeholders: zod_1.default.array(exports.translationPlaceholderSchema).default([]),
    values: zod_1.default.record(zod_1.default.string(), zod_1.default.string()).default({})
})
    .strict();
exports.localizationDocumentSchema = zod_1.default
    .object({
    schemaVersion: zod_1.default.literal(1),
    activeLocales: zod_1.default.array(exports.localeCodeSchema).default(["en"]),
    translations: zod_1.default.array(exports.translationEntrySchema).default([])
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
exports.emptyLocalizationDocument = {
    schemaVersion: 1,
    activeLocales: ["en"],
    translations: []
};
function translationKey(translation) {
    return `${translation.namespace}.${translation.slug}`;
}
function validateLocalizationDocument(document) {
    const problems = [];
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
function validatePlaceholderUsage(text, declaredPlaceholders, problems, path) {
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
function placeholderNames(text) {
    const matches = text.matchAll(/\{([a-z][a-z0-9_]*)\}/g);
    return new Set([...matches].map((match) => match[1]));
}
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
