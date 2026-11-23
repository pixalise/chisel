import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { execFileSync } from "node:child_process"
import { nanoid } from "nanoid"
import { describe, expect, it } from "vitest"
import { ColumnType } from "../enums/column-type"
import { emptyLocalizationDocument } from "./localization"
import { assetSchema, dataTableSchema, type DataColumnDefinition } from "./schemas"
import { createZoraExportBundle } from "./zora-export"

const project = { id: nanoid(), name: "Zora", path: "/tmp/zora" }
const asset = assetSchema.parse({
  name: "FRIGATE",
  id: "FRIGATE",
  category: "MESH",
  extension: "glb",
  relativePath: ".chisel/assets/MESH/FRIGATE.glb",
  width: 0,
  height: 0,
  sizeBytes: 1,
})
function table(columns: DataColumnDefinition[]) {
  return dataTableSchema.parse({
    id: "units",
    name: "Units",
    description: "",
    lastChangeAt: "",
    columns,
    rows: [{ id: nanoid(), slug: "FRIGATE", values: [] }],
  })
}
function column(
  name: string,
  type: ColumnType,
  defaultValue: DataColumnDefinition["defaultValue"]
): DataColumnDefinition {
  return { id: nanoid(), name, type, defaultValue, required: true, unique: false }
}
describe("Zora generated definitions", () => {
  it("keeps string references, scalar values, vectors and nested JSON null", async () => {
    const columns = [
      column("model", ColumnType.ASSET_REF, "FRIGATE"),
      column("health", ColumnType.INTEGER, 70),
      column("active", ColumnType.BOOLEAN, false),
      column("scale", ColumnType.VECTOR_3, [1, 2, 3]),
      column("tint", ColumnType.COLOR, "#ff8000"),
      column("metadata", ColumnType.JSON, { nullable: null, entries: [null, 0, false] }),
      { ...column("targets", ColumnType.ARRAY_REF, ["FRIGATE"]), refTableId: "units" },
      { ...column("target", ColumnType.REF, "FRIGATE"), refTableId: "units" },
      column("caption", ColumnType.TEXT, 'Quote " \\ \n 🌌'),
      column("weight", ColumnType.DECIMAL, 1.25),
      column("distance", ColumnType.RANGE, 3),
      column("mode", ColumnType.ENUM, "PATROL"),
      column("modes", ColumnType.ENUM_ARRAY, ["PATROL"]),
      { ...column("optional_text", ColumnType.STRING, ""), required: false },
      { ...column("optional_weight", ColumnType.DECIMAL, 1.25), required: false },
      column("uv", ColumnType.VECTOR_2, [1, 2]),
      column("rotation", ColumnType.VECTOR_4, [0, 0, 0, 1]),
    ]
    const bundle = createZoraExportBundle(
      project,
      [table(columns)],
      "now",
      [asset],
      emptyLocalizationDocument,
      { FRIGATE: "a".repeat(64) }
    )
    const catalog = JSON.parse(
      bundle.files.find((file) => file.path.endsWith("catalog.json"))?.content ?? ""
    )
    expect(catalog.tables.Units.FRIGATE).toMatchObject({
      model: "FRIGATE",
      target: "FRIGATE",
      targets: ["FRIGATE"],
      active: false,
      health: 70,
      metadata: { nullable: null },
    })
    const d = bundle.files.find((file) => file.path.endsWith(".d"))?.content
    expect(d).toContain('enum string FRIGATE = "FRIGATE";')
    expect(d).toContain("long health;")
    expect(d).toContain("double[3] scale;")
    expect(d).toContain("static @property immutable(Row) FRIGATE()")
    const lua = bundle.files.find((file) => file.path.endsWith("content.lua"))?.content
    expect(lua).toContain('["model"] = "FRIGATE"')
    expect(lua).toContain('["nullable"] = NULL')
    expect(lua).not.toContain("table.freeze")
    const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "mrak-definitions-"))
    try {
      for (const file of bundle.files) {
        const target = path.join(scratch, file.path)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await fs.writeFile(target, file.content)
      }
      await fs.writeFile(
        path.join(scratch, "check.lua"),
        `dofile(${JSON.stringify(path.join(scratch, "ZoraData/lua/content.lua"))})
assert(Assets.Models.FRIGATE == "FRIGATE")
assert(Tables.Units.FRIGATE.health == 70 and Tables.Units.FRIGATE.active == false)
assert(Tables.Units.FRIGATE.metadata.nullable == Content.NULL)
assert(#Tables.Units.FRIGATE.metadata.entries == 3)
assert(not pcall(function() Tables.Units.FRIGATE.health = 2 end))
assert(not pcall(function() Tables.Units.FRIGATE.metadata.entries[2] = 9 end))
`
      )
      execFileSync(process.env.MRAK_LUA ?? "lua", [path.join(scratch, "check.lua")])
      if (process.env.MRAK_LDC) {
        await fs.writeFile(
          path.join(scratch, "check.d"),
          `module engine.generated_content_test;
import zora_content.definitions;
import engine.assets.content;
import std.json : JSONType, parseJSON;
import std.file : readText, write;
void main() {
Content.load(${JSON.stringify(path.join(scratch, "ZoraData/catalog.json"))});
assert(Assets.Models.FRIGATE == "FRIGATE");
assert(Tables.Units.FRIGATE.health == 70 && !Tables.Units.FRIGATE.active);
assert(Tables.Units.FRIGATE.metadata["entries"][0].type == JSONType.null_);
assert(Tables.Units.get("FRIGATE").target == "FRIGATE");
static assert(!__traits(compiles, Tables.Units.FRIGATE.health = 1));
assert(Tables.Units.FRIGATE.optionalWeight.get == 1.25);
auto catalog = parseJSON(readText(${JSON.stringify(path.join(scratch, "ZoraData/catalog.json"))}));
catalog["tables"]["Units"]["FRIGATE"]["health"] = 99;
write(${JSON.stringify(path.join(scratch, "ZoraData/catalog.json"))}, catalog.toString());
Content.load(${JSON.stringify(path.join(scratch, "ZoraData/catalog.json"))});
assert(Tables.Units.FRIGATE.health == 99);
}
`
        )
        const executable = path.join(scratch, "check")
        execFileSync(process.env.MRAK_LDC, [
          "-i",
          `-I${process.env.MRAK_ZORA_ROOT}`,
          `-I${process.env.MRAK_ZORA_ROOT}/libs/xassert`,
          `-I${path.join(scratch, "ZoraData/d")}`,
          path.join(scratch, "check.d"),
          `-of=${executable}`,
        ])
        execFileSync(executable)
      }
    } finally {
      await fs.rm(scratch, { recursive: true, force: true })
    }
  })
  it("rejects unresolved references and generated-name collisions", () => {
    const invalid = table([column("model", ColumnType.ASSET_REF, "MISSING")])
    expect(() =>
      createZoraExportBundle(project, [invalid], "now", [asset], emptyLocalizationDocument, {
        FRIGATE: "a".repeat(64),
      })
    ).toThrow("does not exist")
    const collision = table([
      column("max_health", ColumnType.INTEGER, 1),
      column("max health", ColumnType.INTEGER, 2),
    ])
    expect(() =>
      createZoraExportBundle(project, [collision], "now", [], emptyLocalizationDocument, {})
    ).toThrow("Duplicate")
  })
  it("preserves explicit null separately from an omitted optional cell", () => {
    const nullable = { ...column("caption", ColumnType.STRING, "Default"), required: false }
    const source = table([nullable])
    source.rows[0].values = [{ columnId: nullable.id, type: ColumnType.STRING, value: null }]
    const bundle = createZoraExportBundle(
      project,
      [source],
      "now",
      [],
      emptyLocalizationDocument,
      {}
    )
    expect(bundle.files.find((file) => file.path.endsWith(".d"))?.content).toContain(
      "Nullable!(string) caption;"
    )
  })
})
