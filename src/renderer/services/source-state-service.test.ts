import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalizationDocument } from "../../shared/localization";
import type { Project } from "../../shared/schemas";
import type { SourceStateJson } from "../../shared/source-state";
import { AssetCategoryEnum } from "../../shared/types";

const mocks = vi.hoisted(() => {
  const project: Project = {
    id: "3JRzno-Vksr4Gf7hMa1k8",
    name: "Test Project",
    path: "/tmp/chisel-project"
  };
  return {
    assets: [
      {
        category: "IMAGE",
        extension: "png",
        height: 64,
        id: "UNIT_ICON",
        name: "UNIT_ICON",
        relativePath: ".chisel/assets/IMAGE/UNIT_ICON.png",
        sizeBytes: 1024,
        width: 64
      }
    ],
    tiled: {
      config: {
        schemaVersion: 1,
        roles: [{ id: "GROUND", label: "Ground", color: "#8B9D5C" }],
        boards: []
      },
      files: [],
      images: []
    },
    restoreTiled: vi.fn(),
    localization: {
      schemaVersion: 2,
      defaultLocale: "en",
      locales: ["en"],
      styles: [],
      tooltips: [],
      keys: [{ path: "HUD.START", placeholders: [], values: { en: "Start" } }]
    } as LocalizationDocument,
    project,
    setProject: vi.fn(),
    sourceState: undefined as SourceStateJson | undefined,
    tables: [
      {
        columns: [
          {
            defaultValue: "",
            id: "V1StGXR8_Z5jdHi6B-myT",
            name: "display_name",
            required: true,
            type: "string",
            unique: false
          }
        ],
        description: "Units",
        id: "units",
        kind: "user",
        lastChangeAt: "2026-01-01T00:00:00.000Z",
        name: "Units",
        rows: [
          {
            id: "q6s3losSto_SUl7dx057B",
            slug: "RIFLEMAN",
            values: [{ columnId: "V1StGXR8_Z5jdHi6B-myT", type: "string", value: "Rifleman" }]
          }
        ],
        version: 1
      },
      {
        columns: [
          {
            defaultValue: [],
            id: "Wu9WsaSKd5d-LGJ8lr0X3",
            name: "bindings",
            required: true,
            type: "enumArray",
            unique: false
          }
        ],
        description: "Input bindings",
        id: "input_bindings",
        kind: "system",
        lastChangeAt: "2026-01-01T00:00:00.000Z",
        moduleId: "input",
        name: "Input Bindings",
        rows: [],
        version: 1
      }
    ],
    tryReadSourceStateJson: vi.fn(),
    writeAssetsJson: vi.fn(),
    writeChiselJson: vi.fn(),
    writeLocalizationJson: vi.fn(),
    writeSourceStateJson: vi.fn(),
    writeSystemTableDataJson: vi.fn(),
    writeTablesJson: vi.fn(),
    writeUserTableJson: vi.fn()
  };
});

vi.mock("@/stores/app-store", () => ({
  default: {
    getState: () => ({
      computed: {
        project: mocks.project
      },
      setProject: mocks.setProject
    })
  }
}));

vi.mock("@/services/file-service", () => ({
  default: {
    tryReadSourceStateJson: mocks.tryReadSourceStateJson,
    writeAssetsJson: mocks.writeAssetsJson,
    writeChiselJson: mocks.writeChiselJson,
    writeLocalizationJson: mocks.writeLocalizationJson,
    writeSourceStateJson: mocks.writeSourceStateJson,
    writeSystemTableDataJson: mocks.writeSystemTableDataJson,
    writeTablesJson: mocks.writeTablesJson,
    writeUserTableJson: mocks.writeUserTableJson
  }
}));

vi.mock("@/services/table-service", () => ({
  default: {
    listAllTables: vi.fn(async () => mocks.tables)
  }
}));

vi.mock("@/services/asset-service", () => ({
  default: {
    getAllAssets: vi.fn(async () => mocks.assets)
  }
}));

vi.mock("@/services/localization-service", () => ({
  default: {
    readLocalization: vi.fn(async () => mocks.localization)
  }
}));

vi.mock("@/services/tiled-sample-service", () => ({
  default: {
    snapshot: vi.fn(async () => mocks.tiled),
    restore: mocks.restoreTiled
  }
}));

const { default: sourceStateService } = await import("./source-state-service");

describe("source state service", () => {
  beforeEach(() => {
    mocks.sourceState = undefined;
    mocks.setProject.mockReset();
    mocks.restoreTiled.mockReset();
    mocks.tryReadSourceStateJson.mockReset();
    mocks.writeAssetsJson.mockReset();
    mocks.writeChiselJson.mockReset();
    mocks.writeLocalizationJson.mockReset();
    mocks.writeSourceStateJson.mockReset();
    mocks.writeSystemTableDataJson.mockReset();
    mocks.writeTablesJson.mockReset();
    mocks.writeUserTableJson.mockReset();
    mocks.tryReadSourceStateJson.mockImplementation(async () => mocks.sourceState);
    mocks.writeSourceStateJson.mockImplementation(async (_project: Project, document: SourceStateJson) => {
      mocks.sourceState = document;
    });
  });

  it("returns an empty commit list when source state is missing", async () => {
    await expect(sourceStateService.listCommits()).resolves.toEqual([]);
  });

  it("commits draft tables, assets, localization, and Tiled samples", async () => {
    const commit = await sourceStateService.commitDraft();

    expect(commit.project).toEqual({ id: mocks.project.id, name: mocks.project.name });
    expect(commit.tables).toHaveLength(2);
    expect(commit.assets.assets[0]).toMatchObject({ id: "UNIT_ICON", category: AssetCategoryEnum.image });
    expect(commit.localization).toEqual(mocks.localization);
    expect(commit.tiled).toEqual(mocks.tiled);
    expect(mocks.sourceState?.commits[0]?.id).toBe(commit.id);
  });

  it("rolls back project source files from a commit", async () => {
    const commit = await sourceStateService.commitDraft();

    await sourceStateService.rollbackToCommit(commit.id);

    expect(mocks.writeChiselJson).toHaveBeenCalledWith(expect.objectContaining({ path: mocks.project.path }));
    expect(mocks.writeTablesJson).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tables: [expect.objectContaining({ id: "units", kind: "user" })]
      })
    );
    expect(mocks.writeUserTableJson).toHaveBeenCalledWith(expect.anything(), "units", expect.anything());
    expect(mocks.writeSystemTableDataJson).toHaveBeenCalledWith(expect.anything(), "input_bindings", expect.anything());
    expect(mocks.writeAssetsJson).toHaveBeenCalledWith(expect.anything(), commit.assets);
    expect(mocks.writeLocalizationJson).toHaveBeenCalledWith(expect.anything(), commit.localization);
    expect(mocks.restoreTiled).toHaveBeenCalledWith(commit.tiled);
    expect(mocks.setProject).toHaveBeenCalledWith(expect.objectContaining({ path: mocks.project.path }));
  });

  it("rejects rollback to a missing commit", async () => {
    await expect(sourceStateService.rollbackToCommit("missing")).rejects.toThrow("does not exist");
  });
});
