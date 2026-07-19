import { beforeEach, describe, expect, it, vi } from "vitest";
import { localizationDocumentSchema, type LocalizationDocument } from "../../shared/localization";
import type { Project } from "../../shared/schemas";

const mocks = vi.hoisted(() => {
  const project: Project = {
    id: "3JRzno-Vksr4Gf7hMa1k8",
    name: "Test Project",
    path: "/tmp/chisel-project"
  };
  return {
    document: undefined as LocalizationDocument | undefined,
    project,
    tryReadLocalizationJson: vi.fn(),
    writeLocalizationJson: vi.fn()
  };
});

vi.mock("@/stores/app-store", () => ({
  default: {
    getState: () => ({
      computed: {
        project: mocks.project
      }
    })
  }
}));

vi.mock("@/services/file-service", () => ({
  default: {
    tryReadLocalizationJson: mocks.tryReadLocalizationJson,
    writeLocalizationJson: mocks.writeLocalizationJson
  }
}));

const { default: localizationService } = await import("./localization-service");

describe("localization service", () => {
  beforeEach(() => {
    mocks.document = undefined;
    mocks.tryReadLocalizationJson.mockReset();
    mocks.writeLocalizationJson.mockReset();
    mocks.tryReadLocalizationJson.mockImplementation(async () => mocks.document);
    mocks.writeLocalizationJson.mockImplementation(async (_project: Project, document: LocalizationDocument) => {
      mocks.document = document;
    });
  });

  it("returns an empty v2 document when localization data is missing", async () => {
    await expect(localizationService.readLocalization()).resolves.toEqual({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      keys: [],
      terms: []
    });
    expect(mocks.writeLocalizationJson).not.toHaveBeenCalled();
  });

  it("reads migrated v1 data without writing it back", async () => {
    mocks.document = localizationDocumentSchema.parse({
      schemaVersion: 1,
      activeLocales: ["en", "sl_SI"],
      translations: [{ namespace: "HUD", slug: "START", sourceText: "Start", values: { en: "Start" } }]
    });

    const document = await localizationService.readLocalization();

    expect(document.schemaVersion).toBe(2);
    expect(document.keys[0]?.path).toBe("HUD.START");
    expect(document.keys[0]?.values).toEqual({ en: "Start", sl_SI: "Start" });
    expect(mocks.writeLocalizationJson).not.toHaveBeenCalled();
  });

  it("adds locales and replicates existing key values", async () => {
    mocks.document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      keys: [{ path: "HUD.START", values: { en: "Start" }, placeholders: [] }],
      terms: []
    });

    const document = await localizationService.addLocale("sl_SI");

    expect(document.locales).toEqual(["en", "sl_SI"]);
    expect(document.keys[0]?.values).toEqual({ en: "Start", sl_SI: "Start" });
    expect(mocks.writeLocalizationJson).toHaveBeenCalledWith(mocks.project, document);
  });

  it("adds keys and terms through the shared localization rules", async () => {
    mocks.document = localizationDocumentSchema.parse({
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en", "sl_SI"],
      keys: [],
      terms: []
    });

    const withKey = await localizationService.addKey({
      path: "UNIT.TOXIN_TRACTOR.DESCRIPTION",
      values: { en: "Deals {float:aoe_radius} damage." }
    });
    const withTerm = await localizationService.addTerm({ slug: "AOE_RADIUS", color: "#65C7FF" });

    expect(withKey.keys[0]?.values).toEqual({
      en: "Deals {float:aoe_radius} damage.",
      sl_SI: "Deals {float:aoe_radius} damage."
    });
    expect(withTerm.terms).toEqual([{ slug: "AOE_RADIUS", color: "#65C7FF" }]);
  });
});
