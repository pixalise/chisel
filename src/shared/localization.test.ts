import { describe, expect, it } from "vitest";
import {
  LocalizationProblemSeverity,
  addLocaleToLocalization,
  addLocalizationKey,
  localizationIconSlugsForKey,
  localizationDocumentSchema,
  localizationPlaceholderDefaultText,
  localizationPlaceholdersForKey,
  removeLocaleFromLocalization,
  TranslationPlaceholderType,
  validateLocalizationDocument
} from "./localization";
import { AssetCategoryEnum } from "./types";

describe("localization schemas", () => {
  it("accepts v2 key/value localization documents", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en", "sl_SI"],
      styles: [
        {
          slug: "PHYSICAL_DAMAGE_STYLE",
          color: "#65C7FF",
          bold: true,
          italic: false,
          underline: true
        }
      ],
      tooltips: [
        {
          slug: "PHYSICAL_DAMAGE",
          iconAssetId: "PHYSICAL_DAMAGE",
          titleKey: "TERM.PHYSICAL_DAMAGE.TOOLTIP",
          descriptionKey: "TERM.PHYSICAL_DAMAGE.TOOLTIP"
        }
      ],
      keys: [
        {
          path: "TERM.PHYSICAL_DAMAGE.TOOLTIP",
          values: {
            en: "Physical damage.",
            sl_SI: "Fizicna skoda."
          },
          placeholders: []
        },
        {
          path: "UNIT.TOXIN_TRACTOR.DESCRIPTION",
          values: {
            en: "The unit does <style:PHYSICAL_DAMAGE_STYLE><tooltip:PHYSICAL_DAMAGE><icon:PHYSICAL_DAMAGE/> {float:damage_toxin_percentage}</tooltip></style> damage in a {float:aoe_radius} radius around it.",
            sl_SI:
              "Enota naredi <style:PHYSICAL_DAMAGE_STYLE><tooltip:PHYSICAL_DAMAGE><icon:PHYSICAL_DAMAGE/> {float:damage_toxin_percentage}</tooltip></style> skode v polmeru {float:aoe_radius}."
          }
        }
      ]
    });

    expect(document.locales).toEqual(["en", "sl_SI"]);
    expect(localizationPlaceholdersForKey(document.keys[1]!, document.defaultLocale).map((placeholder) => placeholder.name)).toEqual([
      "damage_toxin_percentage",
      "aoe_radius"
    ]);
    expect(localizationIconSlugsForKey(document.keys[1]!, document.defaultLocale)).toEqual(["PHYSICAL_DAMAGE"]);
    expect(
      validateLocalizationDocument(document, [
        {
          category: AssetCategoryEnum.uiIcon,
          extension: "png",
          formattedBytes: "1.0 KB",
          height: 32,
          id: "PHYSICAL_DAMAGE",
          name: "PHYSICAL_DAMAGE",
          relativePath: ".chisel/assets/UI_ICON/PHYSICAL_DAMAGE.png",
          sizeBytes: 1024,
          width: 32
        }
      ])
    ).toEqual([]);
  });

  it("rejects legacy localization document shapes", () => {
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 1,
        activeLocales: ["en", "sl_SI"],
        translations: [{ namespace: "HUD", slug: "START", sourceText: "Start", values: { en: "Start" } }]
      }).success
    ).toBe(false);
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 2,
        defaultLocale: "en",
        locales: ["en"],
        keys: [],
        styles: [],
        tooltips: [],
        terms: [{ slug: "DAMAGE" }]
      }).success
    ).toBe(false);
  });

  it("adds locales by replicating all existing keys from the default locale", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      styles: [],
      tooltips: [],
      keys: [{ path: "HUD.START", values: { en: "Start" }, placeholders: [] }]
    });

    expect(addLocaleToLocalization(document, "sl_SI").keys[0]?.values).toEqual({
      en: "Start",
      sl_SI: "Start"
    });
  });

  it("adds keys with values for all locales and removes non-default locales", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en", "sl_SI"],
      styles: [],
      tooltips: [],
      keys: []
    });

    const withKey = addLocalizationKey(document, {
      path: "HUD.START",
      values: {
        en: "Start"
      }
    });
    expect(withKey.keys[0]?.values).toEqual({ en: "Start", sl_SI: "Start" });
    expect(removeLocaleFromLocalization(withKey, "sl_SI").locales).toEqual(["en"]);
    expect(() => removeLocaleFromLocalization(withKey, "en")).toThrow("Default locale");
  });

  it("keeps float placeholder defaults visibly float-shaped for preview text", () => {
    expect(localizationPlaceholderDefaultText(TranslationPlaceholderType.number)).toBe("-1.0");
    expect(localizationPlaceholderDefaultText(TranslationPlaceholderType.integer)).toBe("-1");
    expect(localizationPlaceholderDefaultText(TranslationPlaceholderType.string)).toBe("UNKNOWN");
  });

  it("validates line break rich markup", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      styles: [],
      tooltips: [],
      keys: [
        {
          path: "ITEM.OLD_REVOLVER.DESCRIPTION",
          values: {
            en: "A weapon from the olden era<br/>An old revolver with a leather handle."
          },
          placeholders: []
        }
      ]
    });

    expect(validateLocalizationDocument(document)).toEqual([]);

    const invalidDocument = localizationDocumentSchema.parse({
      ...document,
      keys: [
        {
          ...document.keys[0]!,
          values: {
            en: "A weapon from the olden era<br>An old revolver."
          }
        }
      ]
    });

    expect(validateLocalizationDocument(invalidDocument)).toContainEqual(
      expect.objectContaining({ message: "Line break tag must look like <br/>" })
    );
  });

  it("rejects malformed keys, duplicate keys, and missing default locale", () => {
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 2,
        defaultLocale: "en",
        locales: ["en"],
        styles: [],
        tooltips: [],
        keys: [{ path: "hud.start", values: { en: "Start" }, placeholders: [] }]
      }).success
    ).toBe(false);
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 2,
        defaultLocale: "en",
        locales: ["en"],
        styles: [],
        tooltips: [],
        keys: [
          { path: "HUD.START", values: { en: "Start" }, placeholders: [] },
          { path: "HUD.START", values: { en: "Begin" }, placeholders: [] }
        ]
      }).success
    ).toBe(false);
    expect(
      localizationDocumentSchema.safeParse({
        schemaVersion: 2,
        defaultLocale: "sl_SI",
        locales: ["en"],
        styles: [],
        tooltips: [],
        keys: []
      }).success
    ).toBe(false);
  });

  it("reports placeholder, style, tooltip, and generated API problems", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en", "sl_SI"],
      styles: [
        {
          slug: "AOE_RADIUS",
          bold: false,
          italic: false,
          underline: false
        }
      ],
      tooltips: [
        {
          slug: "AOE_RADIUS",
          titleKey: "TERM.MISSING.TOOLTIP",
          descriptionKey: "TERM.MISSING.TOOLTIP"
        }
      ],
      keys: [
        {
          path: "UNIT.TOXIN_TRACTOR.DESCRIPTION",
          values: {
            en: "Damage {missing} in <style:MISSING_STYLE>{float:aoe_radius}</style> <style:AOE_RADIUS><tooltip:AOE_RADIUS>open.",
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

    const problems = validateLocalizationDocument(document);

    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Placeholder "{missing}" must include a type like "{int:missing}", "{float:missing}", or "{string:missing}"'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Placeholder "aoe_radius" must use type float'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Translation UNIT.TOXIN_TRACTOR.DESCRIPTION references missing style "MISSING_STYLE"'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Style "AOE_RADIUS" is not closed'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Tooltip "AOE_RADIUS" is not closed'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: "Tooltip AOE_RADIUS references missing tooltip title key TERM.MISSING.TOOLTIP"
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: "Localization key UNIT.TOXIN_TRACTOR collides with generated namespace path"
      })
    );
  });

  it("reports localization icon asset problems", () => {
    const document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en", "sl_SI"],
      styles: [],
      tooltips: [],
      keys: [
        {
          path: "UNIT.RIFLEMAN.DESCRIPTION",
          values: {
            en: "Damage <icon:PHYSICAL_DAMAGE/> {float:damage}.",
            sl_SI: "Skoda <icon:WRONG_CATEGORY/> {float:damage}."
          }
        }
      ]
    });

    const problems = validateLocalizationDocument(document, [
      {
        category: AssetCategoryEnum.image,
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

    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Translation UNIT.RIFLEMAN.DESCRIPTION references missing UI icon asset "PHYSICAL_DAMAGE"'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Translation UNIT.RIFLEMAN.DESCRIPTION has extra icon "<icon:WRONG_CATEGORY/>"'
      })
    );
    expect(problems).toContainEqual(
      expect.objectContaining({
        severity: LocalizationProblemSeverity.error,
        message: 'Translation UNIT.RIFLEMAN.DESCRIPTION references asset "WRONG_CATEGORY" as an icon but it is IMAGE, not UI_ICON'
      })
    );
  });
});
