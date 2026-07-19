"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const localization_1 = require("./localization");
(0, vitest_1.describe)("localization schemas", () => {
    (0, vitest_1.it)("accepts valid locales, placeholders, and values", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 1,
            activeLocales: ["en", "sl_SI"],
            translations: [
                {
                    namespace: "HUD",
                    slug: "UNIT_COUNT",
                    sourceText: "{count} units",
                    placeholders: [{ name: "count", type: localization_1.TranslationPlaceholderType.integer }],
                    values: {
                        en: "{count} units",
                        sl_SI: "{count} enot"
                    }
                }
            ]
        });
        (0, vitest_1.expect)(document.activeLocales).toEqual(["en", "sl_SI"]);
        (0, vitest_1.expect)((0, localization_1.validateLocalizationDocument)(document)).toEqual([]);
    });
    (0, vitest_1.it)("defaults active locales and rejects duplicate translation keys", () => {
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.parse({ schemaVersion: 1, translations: [] }).activeLocales).toEqual(["en"]);
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 1,
            activeLocales: ["en"],
            translations: [
                { namespace: "HUD", slug: "START", sourceText: "Start" },
                { namespace: "HUD", slug: "START", sourceText: "Begin" }
            ]
        }).success).toBe(false);
    });
    (0, vitest_1.it)("rejects invalid locale codes and non-constant translation slugs", () => {
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 1,
            activeLocales: ["english"],
            translations: []
        }).success).toBe(false);
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 1,
            activeLocales: ["en"],
            translations: [{ namespace: "hud", slug: "start", sourceText: "Start" }]
        }).success).toBe(false);
    });
    (0, vitest_1.it)("reports placeholder and locale problems", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 1,
            activeLocales: ["en", "sl_SI"],
            translations: [
                {
                    namespace: "HUD",
                    slug: "GREETING",
                    sourceText: "Hello {name}",
                    placeholders: [
                        { name: "unused_value", type: localization_1.TranslationPlaceholderType.string },
                        { name: "count", type: localization_1.TranslationPlaceholderType.integer }
                    ],
                    values: {
                        en: "Hello {missing}",
                        fr_FR: "Bonjour"
                    }
                }
            ]
        });
        const problems = (0, localization_1.validateLocalizationDocument)(document);
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Placeholder "{name}" is not declared'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Placeholder "{missing}" is not declared'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.warning,
            message: "Translation HUD.GREETING is missing locale sl_SI"
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.warning,
            message: "Translation HUD.GREETING has value for inactive locale fr_FR"
        }));
    });
});
