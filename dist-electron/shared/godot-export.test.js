"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nanoid_1 = require("nanoid");
const vitest_1 = require("vitest");
const schemas_1 = require("./schemas");
const types_1 = require("./types");
const godot_export_1 = require("./godot-export");
const localization_1 = require("./localization");
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
                    slug: "ZOMBIE_BASIC",
                    values: [
                        { columnId: displayNameColumnId, type: types_1.ColumnType.string, value: "Zombie" },
                        { columnId: maxHealthColumnId, type: types_1.ColumnType.integer, value: 100 }
                    ]
                },
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "ZOMBIE_RUNNER",
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
        (0, vitest_1.expect)(tableFile?.content).toContain("ZOMBIE_BASIC = 0");
        (0, vitest_1.expect)(tableFile?.content).toContain("ZOMBIE_RUNNER = 1");
        (0, vitest_1.expect)(tableFile?.content).toContain('const SLUGS := [\n\t"ZOMBIE_BASIC",\n\t"ZOMBIE_RUNNER"\n]');
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
                    slug: "ZOMBIE_BASIC",
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
    (0, vitest_1.it)("uses snake case generated table paths from table names, not internal ids", () => {
        const table = schemas_1.dataTableSchema.parse({
            columns: [],
            description: "Enemy type definitions",
            id: (0, nanoid_1.nanoid)(),
            kind: "user",
            lastChangeAt: "2026-01-01T00:00:00.000Z",
            name: "Enemy Types",
            rows: [],
            version: 1
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [table], "2026-01-01T00:00:00.000Z");
        const tableFile = bundle.files.find((file) => file.path === "game_data/tables/enemy_types.gd");
        const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");
        (0, vitest_1.expect)(tableFile?.content).toContain("class_name ChiselEnemyTypes");
        (0, vitest_1.expect)(tableFile?.content).toContain(`const TABLE_ID := "${table.id}"`);
        (0, vitest_1.expect)(manifestFile?.content).toContain(`"${table.id}": {`);
        (0, vitest_1.expect)(manifestFile?.content).toContain('"path": "res://game_data/tables/enemy_types.gd"');
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
                    slug: "MOVE_FORWARD",
                    values: [
                        { columnId: sortOrderColumnId, type: types_1.ColumnType.integer, value: 10 },
                        { columnId: bindingsColumnId, type: types_1.ColumnType.enumArray, value: [types_1.InputKeyEnum.KeyW, types_1.InputKeyEnum.KeyUp] }
                    ]
                },
                {
                    id: (0, nanoid_1.nanoid)(),
                    slug: "INCREASE_MOVE_SPEED",
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
        (0, vitest_1.expect)(inputFile?.content).toContain('const ACTION_NAMES := [\n\t&"move_forward",\n\t&"increase_move_speed"\n]');
        (0, vitest_1.expect)(inputFile?.content).toContain("static func action_name(action_id: int) -> StringName:");
        (0, vitest_1.expect)(inputFile?.content).toContain("return ACTION_NAMES[action_id]");
        (0, vitest_1.expect)(inputFile?.content).toContain("static func get_action_strength(action_id: int) -> float:");
        (0, vitest_1.expect)(inputFile?.content).toContain("static func is_action_just_pressed(action_id: int) -> bool:");
        (0, vitest_1.expect)(inputFile?.content).toContain("var input_action_name := action_name(index)");
        (0, vitest_1.expect)(inputFile?.content).not.toContain("String(ChiselInputBindings.SLUGS[index]).to_lower()");
        (0, vitest_1.expect)(inputFile?.content).not.toContain("ChiselInputBindings.ACTION");
        (0, vitest_1.expect)(inputFile?.content).toContain("InputMap.action_add_event(input_action_name, event)");
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
            id: "FOREST_SOIL_1",
            name: "FOREST_SOIL_1",
            relativePath: ".chisel/assets/TERRAIN_TEXTURE/FOREST_SOIL_1.gppt",
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
        (0, vitest_1.expect)(manifestFile?.content).toContain("const FILES := [");
        (0, vitest_1.expect)(manifestFile?.content).toContain('"hash":');
        (0, vitest_1.expect)(manifestFile?.content).toContain('"bytes":');
        (0, vitest_1.expect)(assetsFile?.content).toContain("class_name ChiselAssets");
        (0, vitest_1.expect)(assetsFile?.content).toContain(`"${asset.id}": {`);
        (0, vitest_1.expect)(assetsFile?.content).toContain("FOREST_SOIL_1 = 0");
        (0, vitest_1.expect)(assetsFile?.content).toContain('"category": "terrain_texture"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"name": "forest_soil_1"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"path": "res://game_data/assets/terrain_texture/forest_soil_1"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"albedo_height": "res://game_data/assets/terrain_texture/forest_soil_1/albedo_height.png"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"normal_roughness": "res://game_data/assets/terrain_texture/forest_soil_1/normal_roughness.png"');
    });
    (0, vitest_1.it)("exports HDRI assets under snake case HDRI paths", () => {
        const asset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.hdri,
            extension: "hdr",
            height: 512,
            id: "SKY_CLEAR",
            name: "SKY_CLEAR",
            relativePath: ".chisel/assets/HDRI/SKY_CLEAR.hdr",
            sizeBytes: 1024,
            width: 1024
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [], "2026-01-01T00:00:00.000Z", [asset]);
        const assetsFile = bundle.files.find((file) => file.path === "game_data/assets.gd");
        (0, vitest_1.expect)(assetsFile?.content).toContain("SKY_CLEAR = 0");
        (0, vitest_1.expect)(assetsFile?.content).toContain('"category": "hdri"');
        (0, vitest_1.expect)(assetsFile?.content).toContain('"path": "res://game_data/assets/hdri/sky_clear.hdr"');
    });
    (0, vitest_1.it)("exports typed refs and asset refs as enum values", () => {
        const factionColumnId = (0, nanoid_1.nanoid)();
        const portraitColumnId = (0, nanoid_1.nanoid)();
        const factionTable = schemas_1.dataTableSchema.parse({
            columns: [],
            description: "Factions",
            id: "factions",
            kind: "user",
            lastChangeAt: "2026-01-01T00:00:00.000Z",
            name: "Factions",
            rows: [{ id: (0, nanoid_1.nanoid)(), slug: "IRON_LEGION", values: [] }],
            version: 1
        });
        const unitTable = schemas_1.dataTableSchema.parse({
            columns: [
                {
                    defaultValue: "",
                    id: factionColumnId,
                    name: "faction",
                    refTableId: "factions",
                    required: true,
                    type: types_1.ColumnType.ref,
                    unique: false
                },
                {
                    assetCategory: types_1.AssetCategoryEnum.image,
                    defaultValue: "",
                    id: portraitColumnId,
                    name: "portrait",
                    required: true,
                    type: types_1.ColumnType.assetRef,
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
                    id: (0, nanoid_1.nanoid)(),
                    slug: "RIFLEMAN",
                    values: [
                        { columnId: factionColumnId, type: types_1.ColumnType.ref, value: "IRON_LEGION" },
                        { columnId: portraitColumnId, type: types_1.ColumnType.assetRef, value: "RIFLEMAN_PORTRAIT" }
                    ]
                }
            ],
            version: 1
        });
        const asset = schemas_1.assetSchema.parse({
            category: types_1.AssetCategoryEnum.image,
            extension: "png",
            height: 64,
            id: "RIFLEMAN_PORTRAIT",
            name: "RIFLEMAN_PORTRAIT",
            relativePath: ".chisel/assets/IMAGE/RIFLEMAN_PORTRAIT.png",
            sizeBytes: 1024,
            width: 64
        });
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [factionTable, unitTable], "2026-01-01T00:00:00.000Z", [asset]);
        const unitFile = bundle.files.find((file) => file.path === "game_data/tables/units.gd");
        (0, vitest_1.expect)(unitFile?.content).toContain("const FACTION := [\n\tChiselFactions.Id.IRON_LEGION\n]");
        (0, vitest_1.expect)(unitFile?.content).toContain("const PORTRAIT := [\n\tChiselAssets.Id.RIFLEMAN_PORTRAIT\n]");
    });
    (0, vitest_1.it)("exports localization module and Godot translation CSV", () => {
        const project = {
            id: (0, nanoid_1.nanoid)(),
            name: "Iron Bastion",
            path: "/tmp/iron-bastion"
        };
        const localization = localization_1.localizationDocumentSchema.parse({
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
                        en: "Area radius.",
                        sl_SI: "Polmer obmocja."
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
        const bundle = (0, godot_export_1.createGodotExportBundle)(project, [], "2026-01-01T00:00:00.000Z", [], localization);
        const manifestFile = bundle.files.find((file) => file.path === "game_data/manifest.gd");
        const localizationFile = bundle.files.find((file) => file.path === "game_data/localization.gd");
        const translationsFile = bundle.files.find((file) => file.path === "game_data/translations.gd");
        const csvFile = bundle.files.find((file) => file.path === "game_data/localization/translations.csv");
        (0, vitest_1.expect)(manifestFile?.content).toContain("const LOCALIZATION := {");
        (0, vitest_1.expect)(manifestFile?.content).toContain('"csv_path": "res://game_data/localization/translations.csv"');
        (0, vitest_1.expect)(manifestFile?.content).toContain('"typed_class_name": "ChiselTranslations"');
        (0, vitest_1.expect)(manifestFile?.content).toContain('"typed_path": "res://game_data/translations.gd"');
        (0, vitest_1.expect)(localizationFile?.content).toContain("class_name ChiselLocalization");
        (0, vitest_1.expect)(localizationFile?.content).toContain("enum Id {");
        (0, vitest_1.expect)(localizationFile?.content).toContain("UNIT_TOXIN_TRACTOR_DESCRIPTION = 1");
        (0, vitest_1.expect)(localizationFile?.content).toContain('const LOCALES := ["en", "sl_SI"]');
        (0, vitest_1.expect)(localizationFile?.content).toContain("const VALUES := {");
        (0, vitest_1.expect)(localizationFile?.content).toContain('const PLACEHOLDERS := [[], ["damage_toxin_percentage", "aoe_radius"]]');
        (0, vitest_1.expect)(localizationFile?.content).toContain('const PLACEHOLDER_TYPES := [[], ["number", "number"]]');
        (0, vitest_1.expect)(localizationFile?.content).toContain('const PLACEHOLDER_TERMS := [[], ["", "AOE_RADIUS"]]');
        (0, vitest_1.expect)(localizationFile?.content).toContain('"AOE_RADIUS": {');
        (0, vitest_1.expect)(localizationFile?.content).toContain('"tooltip_id": Id.TERM_AOE_RADIUS_TOOLTIP');
        (0, vitest_1.expect)(localizationFile?.content).toContain('static func format(id: int, arguments: Dictionary = {}, locale: String = "")');
        (0, vitest_1.expect)(localizationFile?.content).toContain("class LocalizedText:");
        (0, vitest_1.expect)(translationsFile?.content).toContain("class_name ChiselTranslations");
        (0, vitest_1.expect)(translationsFile?.content).toContain("static var unit := UnitTranslations.new()");
        (0, vitest_1.expect)(translationsFile?.content).toContain("var toxin_tractor := UnitToxinTractorTranslations.new()");
        (0, vitest_1.expect)(translationsFile?.content).toContain("func description(damage_toxin_percentage: float, aoe_radius: float) -> ChiselLocalization.LocalizedText:");
        (0, vitest_1.expect)(translationsFile?.content).toContain("ChiselLocalization.Id.UNIT_TOXIN_TRACTOR_DESCRIPTION");
        (0, vitest_1.expect)(csvFile?.content).toBe('"keys","en","sl_SI"\n"TERM.AOE_RADIUS.TOOLTIP","Area radius.","Polmer obmocja."\n"UNIT.TOXIN_TRACTOR.DESCRIPTION","The unit does {damage_toxin_percentage} damage in a {aoe_radius} radius around it.","Enota naredi {damage_toxin_percentage} skode v polmeru {aoe_radius}."');
    });
});
