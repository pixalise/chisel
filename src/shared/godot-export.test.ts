import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { dataTableSchema, type Project } from "./schemas";
import { ColumnType } from "./types";
import { createGodotExportBundle } from "./godot-export";

describe("Godot export", () => {
  it("exports rows as enum-indexed arrays", () => {
    const displayNameColumnId = nanoid();
    const table = dataTableSchema.parse({
      columns: [
        {
          defaultValue: "",
          id: displayNameColumnId,
          name: "display_name",
          required: true,
          type: ColumnType.string,
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
          values: [{ columnId: displayNameColumnId, type: ColumnType.string, value: "Zombie" }]
        },
        {
          id: nanoid(),
          slug: "ZOMBIE_RUNNER",
          values: [{ columnId: displayNameColumnId, type: ColumnType.string, value: "Runner" }]
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
    expect(tableFile?.content).toContain(
      'const DATA := [\n\t{\n\t\t"display_name": "Zombie"\n\t},\n\t{\n\t\t"display_name": "Runner"\n\t}\n]'
    );
  });
});
