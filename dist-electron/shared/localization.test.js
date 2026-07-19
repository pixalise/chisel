"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const localization_1 = require("./localization");
(0, vitest_1.describe)("localization schemas", () => {
    (0, vitest_1.it)("accepts v2 key/value localization documents", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en", "sl_SI"],
            terms: [
                {
                    slug: "AOE_RADIUS",
                    color: "#65C7FF",
                    tooltipKey: "TERM.AOE_RADIUS.TOOLTIP"
                }
            ],
            keys: [
                {
                    path: "TERM.AOE_RADIUS.TOOLTIP",
                    values: {
                        en: "Area of effect radius.",
                        sl_SI: "Polmer obmocja ucinka."
                    },
                    placeholders: []
                },
                {
                    path: "UNIT.TOXIN_TRACTOR.DESCRIPTION",
                    values: {
                        en: "The unit does {damage_toxin_percentage} damage in a {aoe_radius} radius around it.",
                        sl_SI: "Enota naredi {damage_toxin_percentage} skode v polmeru {aoe_radius}."
                    },
                    placeholders: [
                        { name: "damage_toxin_percentage", type: localization_1.TranslationPlaceholderType.number },
                        { name: "aoe_radius", type: localization_1.TranslationPlaceholderType.number, term: "AOE_RADIUS" }
                    ]
                }
            ]
        });
        (0, vitest_1.expect)(document.locales).toEqual(["en", "sl_SI"]);
        (0, vitest_1.expect)((0, localization_1.validateLocalizationDocument)(document)).toEqual([]);
    });
    (0, vitest_1.it)("migrates v1 documents to v2 in memory", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 1,
            activeLocales: ["en", "sl_SI"],
            translations: [
                {
                    namespace: "HUD",
                    slug: "START",
                    sourceText: "Start",
                    values: {
                        en: "Start"
                    }
                }
            ]
        });
        (0, vitest_1.expect)(document).toMatchObject({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en", "sl_SI"],
            keys: [
                {
                    path: "HUD.START",
                    values: {
                        en: "Start",
                        sl_SI: "Start"
                    }
                }
            ]
        });
    });
    (0, vitest_1.it)("adds locales by replicating all existing keys from the default locale", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en"],
            terms: [],
            keys: [{ path: "HUD.START", values: { en: "Start" }, placeholders: [] }]
        });
        (0, vitest_1.expect)((0, localization_1.addLocaleToLocalization)(document, "sl_SI").keys[0]?.values).toEqual({
            en: "Start",
            sl_SI: "Start"
        });
    });
    (0, vitest_1.it)("adds keys with values for all locales and removes non-default locales", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en", "sl_SI"],
            terms: [],
            keys: []
        });
        const withKey = (0, localization_1.addLocalizationKey)(document, {
            path: "HUD.START",
            values: {
                en: "Start"
            }
        });
        (0, vitest_1.expect)(withKey.keys[0]?.values).toEqual({ en: "Start", sl_SI: "Start" });
        (0, vitest_1.expect)((0, localization_1.removeLocaleFromLocalization)(withKey, "sl_SI").locales).toEqual(["en"]);
        (0, vitest_1.expect)(() => (0, localization_1.removeLocaleFromLocalization)(withKey, "en")).toThrow("Default locale");
    });
    (0, vitest_1.it)("rejects malformed keys, duplicate keys, and missing default locale", () => {
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en"],
            terms: [],
            keys: [{ path: "hud.start", values: { en: "Start" }, placeholders: [] }]
        }).success).toBe(false);
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en"],
            terms: [],
            keys: [
                { path: "HUD.START", values: { en: "Start" }, placeholders: [] },
                { path: "HUD.START", values: { en: "Begin" }, placeholders: [] }
            ]
        }).success).toBe(false);
        (0, vitest_1.expect)(localization_1.localizationDocumentSchema.safeParse({
            schemaVersion: 2,
            defaultLocale: "sl_SI",
            locales: ["en"],
            terms: [],
            keys: []
        }).success).toBe(false);
    });
    (0, vitest_1.it)("reports placeholder, term, tooltip, and generated API problems", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en", "sl_SI"],
            terms: [
                {
                    slug: "AOE_RADIUS",
                    tooltipKey: "TERM.MISSING.TOOLTIP"
                }
            ],
            keys: [
                {
                    path: "UNIT.TOXIN_TRACTOR.DESCRIPTION",
                    values: {
                        en: "Damage {missing} in {aoe_radius}.",
                        sl_SI: "Skoda {aoe_radius}."
                    },
                    placeholders: [
                        { name: "aoe_radius", type: localization_1.TranslationPlaceholderType.number, term: "AOE_RADIUS" },
                        { name: "unused_value", type: localization_1.TranslationPlaceholderType.string, term: "MISSING_TERM" }
                    ]
                },
                {
                    path: "UNIT.TOXIN_TRACTOR",
                    values: {
                        en: "Collision",
                        sl_SI: "Collision"
                    },
                    placeholders: []
                }
            ]
        });
        const problems = (0, localization_1.validateLocalizationDocument)(document);
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Placeholder "{missing}" is not declared'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Declared placeholder "{unused_value}" is not used'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Placeholder "unused_value" references missing term "MISSING_TERM"'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: "Term AOE_RADIUS references missing tooltip key TERM.MISSING.TOOLTIP"
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: "Localization key UNIT.TOXIN_TRACTOR collides with generated namespace path"
        }));
    });
});
