"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
const types_1 = require("./types");
const godot_export_1 = require("./godot-export");
(0, vitest_1.describe)("Godot export", () => {
    (0, vitest_1.it)("exports rows as enum-indexed structure-of-arrays", () => {
        const displayNameColumnId = (0, nanoid_1.nanoid)();
        const maxHealthColumnId = (0, nanoid_1.nanoid)();
        const table = schemas_1.dataTableSchema.parse({
            columns: [
                {
                    defaultValue: "",
                    id: displayNameColumnId,
                    name: "display_name",
                    required: true,
                    type: types_1.ColumnType.string,
                    unique: false
                },
                {
                    defaultValue: 1,
                    id: maxHealthColumnId,
                    name: "max_health",
                    required: true,
                    type: types_1.ColumnType.integer,
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
                    id: (0, nanoid_1.nanoid)(),
                    slug: "zombie_basic",
                    values: [
                        { columnId: displayNameColumnId, type: types_1.ColumnType.string, value: "Zombie" },
                        { columnId: maxHealthColumnId, type: types_1.ColumnType.integer, value: 100 }
                    ]
                },
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "zombie_runner",
                    values: [
                        { columnId: displayNameColumnId, type: types_1.ColumnType.string, value: "Runner" },
                        { columnId: maxHealthColumnId, type: types_1.ColumnType.integer, value: 80 }
                    ]
                }
            ],
            version: 1
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [table], "2026-01-01T00:00:00.000Z");
        const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemies.gd");
        (0, vitest_1.expect)(tableFile?.content).toContain("enum Id {");
        (0, vitest_1.expect)(tableFile?.content).toContain("zombie_basic = 0");
        (0, vitest_1.expect)(tableFile?.content).toContain("zombie_runner = 1");
        (0, vitest_1.expect)(tableFile?.content).toContain('const SLUGS := [\n\t"zombie_basic",\n\t"zombie_runner"\n]');
        (0, vitest_1.expect)(tableFile?.content).toContain('const DISPLAY_NAME := [\n\t"Zombie",\n\t"Runner"\n]');
        (0, vitest_1.expect)(tableFile?.content).toContain("const MAX_HEALTH := [\n\t100,\n\t80\n]");
        (0, vitest_1.expect)(tableFile?.content).not.toContain("const COLUMNS");
        (0, vitest_1.expect)(tableFile?.content).not.toContain("const DATA");
    });
    (0, vitest_1.it)("keeps generated column constants unique after normalization", () => {
        const firstColumnId = (0, nanoid_1.nanoid)();
        const secondColumnId = (0, nanoid_1.nanoid)();
        const thirdColumnId = (0, nanoid_1.nanoid)();
        const table = schemas_1.dataTableSchema.parse({
            columns: [
                {
                    defaultValue: 0,
                    id: firstColumnId,
                    name: "max-health",
                    required: true,
                    type: types_1.ColumnType.integer,
                    unique: false
                },
                {
                    defaultValue: 0,
                    id: secondColumnId,
                    name: "max health",
                    required: true,
                    type: types_1.ColumnType.integer,
                    unique: false
                },
                {
                    defaultValue: 0,
                    id: thirdColumnId,
                    name: "max_health_2",
                    required: true,
                    type: types_1.ColumnType.integer,
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
                    id: (0, nanoid_1.nanoid)(),
                    slug: "zombie_basic",
                    values: [
                        { columnId: firstColumnId, type: types_1.ColumnType.integer, value: 100 },
                        { columnId: secondColumnId, type: types_1.ColumnType.integer, value: 200 },
                        { columnId: thirdColumnId, type: types_1.ColumnType.integer, value: 300 }
                    ]
                }
            ],
            version: 1
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [table], "2026-01-01T00:00:00.000Z");
        const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemies.gd");
        (0, vitest_1.expect)(tableFile?.content).toContain("const MAX_HEALTH := [\n\t100\n]");
        (0, vitest_1.expect)(tableFile?.content).toContain("const MAX_HEALTH_2 := [\n\t200\n]");
        (0, vitest_1.expect)(tableFile?.content).toContain("const MAX_HEALTH_2_2 := [\n\t300\n]");
    });
    (0, vitest_1.it)("exports input bindings as a Godot InputMap setup script", () => {
        const sortOrderColumnId = (0, nanoid_1.nanoid)();
        const bindingsColumnId = (0, nanoid_1.nanoid)();
        const table = schemas_1.systemDataTableSchema.parse({
            columns: [
                {
                    defaultValue: 0,
                    id: sortOrderColumnId,
                    name: "sort_order",
                    required: true,
                    type: types_1.ColumnType.integer,
                    unique: false
                },
                {
                    defaultValue: [],
                    id: bindingsColumnId,
                    name: "bindings",
                    possibleValues: Object.values(types_1.InputKeyEnum),
                    required: true,
                    type: types_1.ColumnType.enumArray,
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
                    id: (0, nanoid_1.nanoid)(),
                    slug: "move_forward",
                    values: [
                        { columnId: sortOrderColumnId, type: types_1.ColumnType.integer, value: 10 },
                        { columnId: bindingsColumnId, type: types_1.ColumnType.enumArray, value: [types_1.InputKeyEnum.KeyW, types_1.InputKeyEnum.KeyUp] }
                    ]
                },
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "increase_move_speed",
                    values: [
                        { columnId: sortOrderColumnId, type: types_1.ColumnType.integer, value: 20 },
                        { columnId: bindingsColumnId, type: types_1.ColumnType.enumArray, value: [types_1.InputKeyEnum.MouseButtonWheelUp] }
                    ]
                }
            ],
            version: 1
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [table], "2026-01-01T00:00:00.000Z");
        const inputFile = bundle.files.find((file) => file.path === "game_data/input.gd");
        const tableFile = bundle.files.find((file) => file.path === "game_data/tables/input_bindings.gd");
        (0, vitest_1.expect)(tableFile?.content).not.toContain("const ACTION");
        (0, vitest_1.expect)(tableFile?.content).toContain('const BINDINGS := [\n\t["KEY_W", "KEY_UP"],\n\t["MOUSE_BUTTON_WHEEL_UP"]\n]');
        (0, vitest_1.expect)(inputFile?.content).toContain("class_name ChiselInput");
        (0, vitest_1.expect)(inputFile?.content).toContain("String(ChiselInputBindings.SLUGS[index]).to_lower()");
        (0, vitest_1.expect)(inputFile?.content).not.toContain("ChiselInputBindings.ACTION");
        (0, vitest_1.expect)(inputFile?.content).toContain("InputMap.action_add_event(action_name, event)");
        (0, vitest_1.expect)(inputFile?.content).toContain('"KEY_W": KEY_W');
        (0, vitest_1.expect)(inputFile?.content).toContain('"MOUSE_BUTTON_WHEEL_UP": MOUSE_BUTTON_WHEEL_UP');
        (0, vitest_1.expect)(inputFile?.content).toContain("return _key(int(KEY_BINDINGS[binding]))");
        (0, vitest_1.expect)(inputFile?.content).toContain("return _mouse_button(int(MOUSE_BINDINGS[binding]))");
    });
    (0, vitest_1.it)("exports assets by id with Godot asset paths", () => {
        const asset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.terrainTexture,
            extension: "gppt",
            height: 1024,
            id: "forest_soil_1",
            name: "forest_soil_1",
            relativePath: ".chisel/assets/terrain_texture/forest_soil_1.gppt",
            sizeBytes: 1024,
            width: 1024
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [], "2026-01-01T00:00:00.000Z", [asset]);
        const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");
        const assetsFile = bundle.files.find((file) => file.path === "game_data/assets.gd");
        (0, vitest_1.expect)(manifestFile?.content).toContain('"path": "res://game_data/assets.gd"');
        (0, vitest_1.expect)(manifestFile?.content).toContain('"count": 1');
        (0, vitest_1.expect)(assetsFile?.content).toContain("class_name ChiselAssets");
        (0, vitest_1.expect)(assetsFile?.content).toContain(`"${asset.id}": {`);
        (0, vitest_1.expect)(assetsFile?.content).toContain("forest_soil_1 = 0");
        (0, vitest_1.expect)(assetsFile?.content).toContain('"category": "terrain_texture"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"name": "forest_soil_1"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"path": "res://game_data/assets/terrain_texture/forest_soil_1"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"albedo_height": "res://game_data/assets/terrain_texture/forest_soil_1/albedo_height.png"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"normal_roughness": "res://game_data/assets/terrain_texture/forest_soil_1/normal_roughness.png"');
    });
});
