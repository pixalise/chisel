import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { assetSchema, dataTableSchema, systemDataTableSchema, type Project } from "./schemas";
import { AssetCategoryEnum, ColumnType, InputKeyEnum } from "./types";
import { createGodotExportBundle } from "./godot-export";
import { TranslationPlaceholderType, localizationDocumentSchema } from "./localization";

describe("Godot export", () => {
  it("exports rows as enum-indexed structure-of-arrays", () => {
    const displayNameColumnId = nanoid();
    const maxHealthColumnId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: displayNameColumnId,
          name: "display_name",
          required: true,
          type: ColumnType.string,
          unique: false
        },
        {
          defaultValue: 1,
          id: maxHealthColumnId,
          name: "max_health",
          required: true,
          type: ColumnType.integer,
          unique: false
        }
      ],
      description: "Enemy definitions",
      id: "enemies",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Enemies",
      rows: [
        {
          id: nanoid(),
          slug: "ZOMBIE_BASIC",
          values: [
            { columnId: displayNameColumnId, type: ColumnType.string, value: "Zombie" },
            { columnId: maxHealthColumnId, type: ColumnType.integer, value: 100 }
          ]
        },
        {
          id: nanoid(),
          slug: "ZOMBIE_RUNNER",
          values: [
            { columnId: displayNameColumnId, type: ColumnType.string, value: "Runner" },
            { columnId: maxHealthColumnId, type: ColumnType.integer, value: 80 }
          ]
        }
      ],
      version: 1
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [table], "2026-01-01T00:00:00.000Z");
    const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemies.gd");

    expect(tableFile?.content).toContain("enum Id {");
    expect(tableFile?.content).toContain("ZOMBIE_BASIC = 0");
    expect(tableFile?.content).toContain("ZOMBIE_RUNNER = 1");
    expect(tableFile?.content).toContain('const SLUGS := [\n\t"ZOMBIE_BASIC",\n\t"ZOMBIE_RUNNER"\n]');
    expect(tableFile?.content).toContain('const DISPLAY_NAME := [\n\t"Zombie",\n\t"Runner"\n]');
    expect(tableFile?.content).toContain("const MAX_HEALTH := [\n\t100,\n\t80\n]");
    expect(tableFile?.content).not.toContain("const COLUMNS");
    expect(tableFile?.content).not.toContain("const DATA");
  });

  it("keeps generated column constants unique after normalization", () => {
    const firstColumnId = nanoid();
    const secondColumnId = nanoid();
    const thirdColumnId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        {
          defaultValue: 0,
          id: firstColumnId,
          name: "max-health",
          required: true,
          type: ColumnType.integer,
          unique: false
        },
        {
          defaultValue: 0,
          id: secondColumnId,
          name: "max health",
          required: true,
          type: ColumnType.integer,
          unique: false
        },
        {
          defaultValue: 0,
          id: thirdColumnId,
          name: "max_health_2",
          required: true,
          type: ColumnType.integer,
          unique: false
        }
      ],
      description: "Enemy definitions",
      id: "enemies",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Enemies",
      rows: [
        {
          id: nanoid(),
          slug: "ZOMBIE_BASIC",
          values: [
            { columnId: firstColumnId, type: ColumnType.integer, value: 100 },
            { columnId: secondColumnId, type: ColumnType.integer, value: 200 },
            { columnId: thirdColumnId, type: ColumnType.integer, value: 300 }
          ]
        }
      ],
      version: 1
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [table], "2026-01-01T00:00:00.000Z");
    const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemies.gd");

    expect(tableFile?.content).toContain("const MAX_HEALTH := [\n\t100\n]");
    expect(tableFile?.content).toContain("const MAX_HEALTH_2 := [\n\t200\n]");
    expect(tableFile?.content).toContain("const MAX_HEALTH_2_2 := [\n\t300\n]");
  });

  it("uses snake case generated table paths from table names, not internal ids", () => {
    const table = dataTableSchema.parse({
      columns: [],
      description: "Enemy type definitions",
      id: nanoid(),
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Enemy Types",
      rows: [],
      version: 1
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [table], "2026-01-01T00:00:00.000Z");
    const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemy_types.gd");
    const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");

    expect(tableFile?.content).toContain("class_name ChiselEnemyTypes");
    expect(tableFile?.content).toContain(`const TABLE_ID := "${table.id}"`);
    expect(manifestFile?.content).toContain(`"${table.id}": {`);
    expect(manifestFile?.content).toContain('"path": "res://game_data/tables/enemy_types.gd"');
  });

  it("exports input bindings as a Godot InputMap setup script", () => {
    const sortOrderColumnId = nanoid();
    const bindingsColumnId = nanoid();
    const table = systemDataTableSchema.parse({
      columns: [
        {
          defaultValue: 0,
          id: sortOrderColumnId,
          name: "sort_order",
          required: true,
          type: ColumnType.integer,
          unique: false
        },
        {
          defaultValue: [],
          id: bindingsColumnId,
          name: "bindings",
          possibleValues: Object.values(InputKeyEnum),
          required: true,
          type: ColumnType.enumArray,
          unique: false
        }
      ],
      description: "Input bindings",
      id: "input_bindings",
      isSystemTable: true,
      kind: "system",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      moduleId: "input",
      name: "Input Bindings",
      rows: [
        {
          id: nanoid(),
          slug: "MOVE_FORWARD",
          values: [
            { columnId: sortOrderColumnId, type: ColumnType.integer, value: 10 },
            { columnId: bindingsColumnId, type: ColumnType.enumArray, value: [InputKeyEnum.KeyW, InputKeyEnum.KeyUp] }
          ]
        },
        {
          id: nanoid(),
          slug: "INCREASE_MOVE_SPEED",
          values: [
            { columnId: sortOrderColumnId, type: ColumnType.integer, value: 20 },
            { columnId: bindingsColumnId, type: ColumnType.enumArray, value: [InputKeyEnum.MouseButtonWheelUp] }
          ]
        }
      ],
      version: 1
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [table], "2026-01-01T00:00:00.000Z");
    const inputFile = bundle.files.find((file) => file.path === "game_data/input.gd");
    const tableFile = bundle.files.find((file) => file.path === "game_data/tables/input_bindings.gd");

    expect(tableFile?.content).not.toContain("const ACTION");
    expect(tableFile?.content).toContain('const BINDINGS := [\n\t["KEY_W", "KEY_UP"],\n\t["MOUSE_BUTTON_WHEEL_UP"]\n]');
    expect(inputFile?.content).toContain("class_name ChiselInput");
    expect(inputFile?.content).toContain('const ACTION_NAMES := [\n\t&"move_forward",\n\t&"increase_move_speed"\n]');
    expect(inputFile?.content).toContain("static func action_name(action_id: int) -> StringName:");
    expect(inputFile?.content).toContain("return ACTION_NAMES[action_id]");
    expect(inputFile?.content).toContain("static func get_action_strength(action_id: int) -> float:");
    expect(inputFile?.content).toContain("static func is_action_just_pressed(action_id: int) -> bool:");
    expect(inputFile?.content).toContain("var input_action_name := action_name(index)");
    expect(inputFile?.content).not.toContain("String(ChiselInputBindings.SLUGS[index]).to_lower()");
    expect(inputFile?.content).not.toContain("ChiselInputBindings.ACTION");
    expect(inputFile?.content).toContain("InputMap.action_add_event(input_action_name, event)");
    expect(inputFile?.content).toContain('"KEY_W": KEY_W');
    expect(inputFile?.content).toContain('"MOUSE_BUTTON_WHEEL_UP": MOUSE_BUTTON_WHEEL_UP');
    expect(inputFile?.content).toContain("return _key(int(KEY_BINDINGS[binding]))");
    expect(inputFile?.content).toContain("return _mouse_button(int(MOUSE_BINDINGS[binding]))");
  });

  it("exports assets by id with Godot asset paths", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.terrainTexture,
      extension: "gppt",
      height: 1024,
      id: "FOREST_SOIL_1",
      name: "FOREST_SOIL_1",
      relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL_1.gppt",
      sizeBytes: 1024,
      width: 1024
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [], "2026-01-01T00:00:00.000Z", [asset]);
    const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");
    const assetsFile = bundle.files.find((file) => file.path === "game_data/assets.gd");

    expect(manifestFile?.content).toContain('"path": "res://game_data/assets.gd"');
    expect(manifestFile?.content).toContain('"count": 1');
    expect(manifestFile?.content).toContain("const FILES := [");
    expect(manifestFile?.content).toContain('"hash":');
    expect(manifestFile?.content).toContain('"bytes":');
    expect(assetsFile?.content).toContain("class_name ChiselAssets");
    expect(assetsFile?.content).toContain(`"${asset.id}": {`);
    expect(assetsFile?.content).toContain("FOREST_SOIL_1 = 0");
    expect(assetsFile?.content).toContain('"category": "terrain_texture"');
    expect(assetsFile?.content).toContain('"name": "forest_soil_1"');
    expect(assetsFile?.content).toContain('"path": "res://game_data/assets/terrain_texture/forest_soil_1"');
    expect(assetsFile?.content).toContain('"albedo_height": "res://game_data/assets/terrain_texture/forest_soil_1/albedo_height.png"');
    expect(assetsFile?.content).toContain(
      '"normal_roughness": "res://game_data/assets/terrain_texture/forest_soil_1/normal_roughness.png"'
    );
  });

  it("exports HDRI assets under snake case HDRI paths", () => {
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.hdri,
      extension: "hdr",
      height: 512,
      id: "SKY_CLEAR",
      name: "SKY_CLEAR",
      relativePath: ".chisel/assets/HDRI/SKY_CLEAR.hdr",
      sizeBytes: 1024,
      width: 1024
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [], "2026-01-01T00:00:00.000Z", [asset]);
    const assetsFile = bundle.files.find((file) => file.path === "game_data/assets.gd");

    expect(assetsFile?.content).toContain("SKY_CLEAR = 0");
    expect(assetsFile?.content).toContain('"category": "hdri"');
    expect(assetsFile?.content).toContain('"path": "res://game_data/assets/hdri/sky_clear.hdr"');
  });

  it("exports typed refs and asset refs as enum values", () => {
    const factionColumnId = nanoid();
    const portraitColumnId = nanoid();
    const factionTable = dataTableSchema.parse({
      columns: [],
      description: "Factions",
      id: "factions",
      kind: "user",
      lastChangeAt: "2026-01-01T00:00:00.000Z",
      name: "Factions",
      rows: [{ id: nanoid(), slug: "IRON_LEGION", values: [] }],
      version: 1
    });
    const unitTable = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: factionColumnId,
          name: "faction",
          refTableId: "factions",
          required: true,
          type: ColumnType.ref,
          unique: false
        },
        {
          assetCategory: AssetCategoryEnum.image,
          defaultValue: "",
          id: portraitColumnId,
          name: "portrait",
          required: true,
          type: ColumnType.assetRef,
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
          id: nanoid(),
          slug: "RIFLEMAN",
          values: [
            { columnId: factionColumnId, type: ColumnType.ref, value: "IRON_LEGION" },
            { columnId: portraitColumnId, type: ColumnType.assetRef, value: "RIFLEMAN_PORTRAIT" }
          ]
        }
      ],
      version: 1
    });
    const asset = assetSchema.parse({
      category: AssetCategoryEnum.image,
      extension: "png",
      height: 64,
      id: "RIFLEMAN_PORTRAIT",
      name: "RIFLEMAN_PORTRAIT",
      relativePath: ".chisel/assets/IMAGE/RIFLEMAN_PORTRAIT.png",
      sizeBytes: 1024,
      width: 64
    });
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };

    const bundle = createGodotExportBundle(project, [factionTable, unitTable], "2026-01-01T00:00:00.000Z", [asset]);
    const unitFile = bundle.files.find((file) => file.path === "game_data/tables/units.gd");

    expect(unitFile?.content).toContain("const FACTION := [\n\tChiselFactions.Id.IRON_LEGION\n]");
    expect(unitFile?.content).toContain("const PORTRAIT := [\n\tChiselAssets.Id.RIFLEMAN_PORTRAIT\n]");
  });

  it("exports localization module and Godot translation CSV", () => {
    const project: Project = {
      id: nanoid(),
      name: "Iron Bastion",
      path: "/tmp/iron-bastion"
    };
    const localization = localizationDocumentSchema.parse({
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

    const bundle = createGodotExportBundle(project, [], "2026-01-01T00:00:00.000Z", [], localization);
    const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");
    const localizationFile = bundle.files.find((file) => file.path === "game_data/localization.gd");
    const csvFile = bundle.files.find((file) => file.path === "game_data/localization/translations.csv");

    expect(manifestFile?.content).toContain("const LOCALIZATION := {");
    expect(manifestFile?.content).toContain('"csv_path": "res://game_data/localization/translations.csv"');
    expect(localizationFile?.content).toContain("class_name ChiselLocalization");
    expect(localizationFile?.content).toContain('HUD_UNIT_COUNT = "HUD.UNIT_COUNT"');
    expect(localizationFile?.content).toContain('const LOCALES := ["en", "sl_SI"]');
    expect(csvFile?.content).toBe('"keys","en","sl_SI"\n"HUD.UNIT_COUNT","{count} units","{count} enot"');
  });
});
