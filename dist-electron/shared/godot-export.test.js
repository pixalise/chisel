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
});
