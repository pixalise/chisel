import { describe, expect, it } from "vitest";
import {
  LocalizationProblemSeverity,
  TranslationPlaceholderType,
  localizationDocumentSchema,
  validateLocalizationDocument
} from "./localization";

describe("localization schemas", () => {
  it("accepts valid locales, placeholders, and values", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 1,
      activeLocales: ["en", "sl_SI"],
      translations: [
        {
          namespace: "HUD",
          slug: "UNIT_COUNT",
          sourceText: "{count} units",
          placeholders: [{ name: "count", type: TranslationPlaceholderType.integer }],
          values: {
            en: "{count} units",
            sl_SI: "{count} enot"
          }
        }
      ]
    });

    expect(document.activeLocales).toEqual(["en", "sl_SI"]);
    expect(validateLocalizationDocument(document)).toEqual([]);
  });

  it("defaults active locales and rejects duplicate translation keys", () => {
    expect(localizationDocumentSchema.parse({ schemaVersion: 1, translations: [] }).activeLocales).toEqual(["en"]);

    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 1,
        activeLocales: ["en"],
        translations: [
          { namespace: "HUD", slug: "START", sourceText: "Start" },
          { namespace: "HUD", slug: "START", sourceText: "Begin" }
        ]
      }).success
    ).toBe(false);
  });

  it("rejects invalid locale codes and non-constant translation slugs", () => {
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 1,
        activeLocales: ["english"],
        translations: []
      }).success
    ).toBe(false);
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 1,
        activeLocales: ["en"],
        translations: [{ namespace: "hud", slug: "start", sourceText: "Start" }]
      }).success
    ).toBe(false);
  });

  it("reports placeholder and locale problems", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 1,
      activeLocales: ["en", "sl_SI"],
      translations: [
        {
          namespace: "HUD",
          slug: "GREETING",
          sourceText: "Hello {name}",
          placeholders: [
            { name: "unused_value", type: TranslationPlaceholderType.string },
            { name: "count", type: TranslationPlaceholderType.integer }
          ],
          values: {
            en: "Hello {missing}",
            fr_FR: "Bonjour"
          }
        }
      ]
    });

    const problems = validateLocalizationDocument(document);

    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Placeholder "{name}" is not declared'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Placeholder "{missing}" is not declared'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.warning,
        message: "Translation HUD.GREETING is missing locale sl_SI"
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.warning,
        message: "Translation HUD.GREETING has value for inactive locale fr_FR"
      })
    );
  });
});
