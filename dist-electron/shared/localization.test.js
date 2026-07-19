"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const localization_1 = require("./localization");
const types_1 = require("./types");
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
                        en: "The unit does [icon:PHYSICAL_DAMAGE] {float:damage_toxin_percentage} damage in a [term:AOE_RADIUS]{float:aoe_radius} radius[/term] around it.",
                        sl_SI: "Enota naredi [icon:PHYSICAL_DAMAGE] {float:damage_toxin_percentage} skode v [term:AOE_RADIUS]polmeru {float:aoe_radius}[/term]."
                    }
                }
            ]
        });
        (0, vitest_1.expect)(document.locales).toEqual(["en", "sl_SI"]);
        (0, vitest_1.expect)((0, localization_1.localizationPlaceholdersForKey)(document.keys[1], document.defaultLocale).map((placeholder) => placeholder.name)).toEqual([
            "damage_toxin_percentage",
            "aoe_radius"
        ]);
        (0, vitest_1.expect)((0, localization_1.localizationIconSlugsForKey)(document.keys[1], document.defaultLocale)).toEqual(["PHYSICAL_DAMAGE"]);
        (0, vitest_1.expect)((0, localization_1.validateLocalizationDocument)(document, [
            {
                category: types_1.AssetCategoryEnum.uiIcon,
                extension: "png",
                formattedBytes: "1.0 KB",
                height: 32,
                id: "PHYSICAL_DAMAGE",
                name: "PHYSICAL_DAMAGE",
                relativePath: ".chisel/assets/UI_ICON/PHYSICAL_DAMAGE.png",
                sizeBytes: 1024,
                width: 32
            }
        ])).toEqual([]);
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
                        en: "Damage {missing} in [term:MISSING_TERM]{float:aoe_radius}[/term] [term:AOE_RADIUS]open.",
                        sl_SI: "Skoda {int:aoe_radius}."
                    }
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
            message: 'Placeholder "{missing}" must include a type like "{int:missing}", "{float:missing}", or "{string:missing}"'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Placeholder "aoe_radius" must use type float'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Translation UNIT.TOXIN_TRACTOR.DESCRIPTION references missing term "MISSING_TERM"'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Term "AOE_RADIUS" is not closed'
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
    (0, vitest_1.it)("reports localization icon asset problems", () => {
        const document = localization_1.localizationDocumentSchema.parse({
            schemaVersion: 2,
            defaultLocale: "en",
            locales: ["en", "sl_SI"],
            terms: [],
            keys: [
                {
                    path: "UNIT.RIFLEMAN.DESCRIPTION",
                    values: {
                        en: "Damage [icon:PHYSICAL_DAMAGE] {float:damage}.",
                        sl_SI: "Skoda [icon:WRONG_CATEGORY] {float:damage}."
                    }
                }
            ]
        });
        const problems = (0, localization_1.validateLocalizationDocument)(document, [
            {
                category: types_1.AssetCategoryEnum.image,
                extension: "png",
                formattedBytes: "1.0 KB",
                height: 32,
                id: "WRONG_CATEGORY",
                name: "WRONG_CATEGORY",
                relativePath: ".chisel/assets/IMAGE/WRONG_CATEGORY.png",
                sizeBytes: 1024,
                width: 32
            }
        ]);
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Translation UNIT.RIFLEMAN.DESCRIPTION references missing UI icon asset "PHYSICAL_DAMAGE"'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Translation UNIT.RIFLEMAN.DESCRIPTION has extra icon "[icon:WRONG_CATEGORY]"'
        }));
        (0, vitest_1.expect)(problems).toContainEqual(vitest_1.expect.objectContaining({
            severity: localization_1.LocalizationProblemSeverity.error,
            message: 'Translation UNIT.RIFLEMAN.DESCRIPTION references asset "WRONG_CATEGORY" as an icon but it is IMAGE, not UI_ICON'
        }));
    });
});
