import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { assetSchema, dataTableSchema, systemDataTableSchema, type Project } from "./schemas";
import { AssetCategoryEnum, ColumnType, InputKeyEnum } from "./types";
import { createGodotExportBundle } from "./godot-export";

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
    expect(inputFile?.content).toContain("String(ChiselInputBindings.SLUGS[index]).to_lower()");
    expect(inputFile?.content).not.toContain("ChiselInputBindings.ACTION");
    expect(inputFile?.content).toContain("InputMap.action_add_event(action_name, event)");
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
});
