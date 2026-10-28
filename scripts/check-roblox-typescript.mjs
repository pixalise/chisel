import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { nanoid } from "nanoid"
import { AssetCategoryEnum } from "../src/enums/asset-category-enum.ts"
import { ColumnType } from "../src/enums/column-type.ts"
import {
  emptyLocalizationDocument,
  localizationDocumentSchema,
} from "../src/shared/localization.ts"
import { createRobloxExportBundle } from "../src/shared/roblox-export.ts"
import { assetSchema, dataTableSchema } from "../src/shared/schemas.ts"

if (!process.argv[2]) {
  throw new Error(
    "Usage: bun run test:roblox-ts /path/to/installed/roblox-ts-project [/path/to/lune]"
  )
}
const consumer = path.resolve(process.argv[2])
const lune = process.argv[3] ?? "lune"
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-roblox-typescript-"))

function run(command, args, cwd = directory) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`)
  }
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
}

try {
  await fs.symlink(path.join(consumer, "node_modules"), path.join(directory, "node_modules"), "dir")
  const columns = [
    { name: "health", type: ColumnType.INTEGER, defaultValue: 25 },
    { name: "weights", type: ColumnType.VECTOR_4, defaultValue: [10, 20, 30, 40] },
    { name: "allies", type: ColumnType.ARRAY_REF, defaultValue: ["GUARD"], refTableId: "units" },
    { name: "position", type: ColumnType.VECTOR_3, defaultValue: [1, 2, 3] },
    { name: "color", type: ColumnType.COLOR, defaultValue: "#ff8000" },
  ].map((column) => ({ id: nanoid(), required: true, unique: false, ...column }))
  const units = dataTableSchema.parse({
    id: "units",
    name: "Units",
    description: "",
    lastChangeAt: "",
    columns,
    rows: [
      { id: nanoid(), slug: "SCOUT", values: [] },
      {
        id: nanoid(),
        slug: "GUARD",
        values: [{ columnId: columns[0].id, type: ColumnType.INTEGER, value: 50 }],
      },
    ],
  })
  const asset = assetSchema.parse({
    id: "ICON",
    name: "ICON",
    category: AssetCategoryEnum.UI,
    extension: "png",
    relativePath: ".chisel/assets/UI/ICON.png",
    width: 1,
    height: 1,
    sizeBytes: 1,
    robloxAssetId: "123456789012345678",
  })
  const localization = localizationDocumentSchema.parse({
    ...emptyLocalizationDocument,
    keys: [{ path: "UI.TITLE", values: { en: "Hello {string:name} {int:count}" } }],
  })
  const bundle = createRobloxExportBundle(
    { id: nanoid(), name: "Interop", path: directory },
    [units],
    "",
    [asset],
    localization
  )
  for (const file of bundle.files) {
    const destination = path.join(directory, file.path)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, file.content)
  }
  const project = {
    name: "Interop",
    tree: {
      $className: "DataModel",
      ServerScriptService: { Server: { $path: "out/server" } },
      ReplicatedStorage: {
        GameData: { $path: "ChiselData" },
        rbxts_include: { $path: "include", node_modules: { $path: "node_modules/@rbxts" } },
      },
    },
  }
  await fs.writeFile(path.join(directory, "default.project.json"), JSON.stringify(project))
  await fs.writeFile(
    path.join(directory, "package.json"),
    '{"name":"chisel-interop","private":true}'
  )
  await fs.writeFile(
    path.join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noLib: true,
        allowSyntheticDefaultImports: true,
        downlevelIteration: true,
        module: "commonjs",
        moduleResolution: "Node",
        moduleDetection: "force",
        target: "ESNext",
        typeRoots: ["node_modules/@rbxts"],
        rootDir: "src",
        outDir: "out",
      },
      include: ["src/**/*.ts"],
    })
  )
  const source = `
import data from "../../ChiselData/manifest";
import units from "../../ChiselData/tables/units";
assert(data.TABLES.units === units);
assert(units.HEALTH[units.ID.SCOUT] === 25);
assert(units.HEALTH[units.ID.GUARD] === 50);
assert(units.HEALTH[units.ID.INVALID] === undefined);
assert(units.SLUGS[units.ID.GUARD] === "GUARD");
const weights = units.WEIGHTS[units.ID.SCOUT];
assert(weights !== undefined);
assert(weights[0] === 10 && weights[3] === 40);
const allies = units.ALLIES[units.ID.SCOUT];
assert(allies !== undefined && allies[0] === units.ID.GUARD);
const position = units.POSITION[units.ID.SCOUT];
assert(position !== undefined && position.Z === 3);
const color = units.COLOR[units.ID.SCOUT];
assert(color !== undefined && color.R === 1);
assert(data.ASSETS.contentId(data.ASSETS.CATEGORY.UI.ICON, "UI") === "rbxassetid://123456789012345678");
const record = data.ASSETS.RECORDS[data.ASSETS.ID.ICON];
assert(record !== undefined && record.slug === "ICON");
const localization = data.LOCALIZATION;
assert(localization.text(localization.ID.UI_TITLE, "en", { name: "Player", count: 2 }) === "Hello Player 2");
assert(localization.richText(localization.ID.UI_TITLE, "en", { name: "<b>", count: 2 }) === "Hello &lt;b&gt; 2");
const segments = localization.segments(localization.ID.UI_TITLE, undefined, { name: "Player", count: 2 });
assert(segments[0].kind === "text");
print("Compiled TypeScript consumer passed: direct imports, 1-based IDs, 0-based nested sequences, native values, asset/localization dot calls.");
`
  await fs.mkdir(path.join(directory, "src/server"), { recursive: true })
  await fs.writeFile(path.join(directory, "src/server/check.ts"), source)
  run("node", [path.join(consumer, "node_modules/roblox-ts/out/CLI/cli.js")])
  // Rojo runs in the supplied project's tool environment but reads the isolated fixture.
  run(
    "rojo",
    [
      "build",
      path.join(directory, "default.project.json"),
      "-o",
      path.join(directory, "check.rbxlx"),
    ],
    consumer
  )

  const modules = bundle.files.filter((file) => file.path.endsWith(".luau"))
  const names = modules.map((file) => file.path.slice("ChiselData/".length, -".luau".length))
  const tableNames = names.filter((name) => name.startsWith("tables/"))
  const siblings = names.filter((name) => !name.startsWith("tables/"))
  const parent = `{ tables = { ${tableNames.map((name) => `[${JSON.stringify(name.slice(7))}] = ${JSON.stringify(name)}`).join(", ")} }, ${siblings.map((name) => `[${JSON.stringify(name)}] = ${JSON.stringify(name)}`).join(", ")} }`
  const factories = modules.map(
    (file, index) => `factories[${JSON.stringify(names[index])}] = function()
  local script = { Parent = ${parent} }
  local require = loadModule
${file.content}
end`
  )
  const compiled = await fs.readFile(path.join(directory, "out/server/check.luau"), "utf8")
  const harness = `
local roblox = require("@lune/roblox")
local Vector3, Color3 = roblox.Vector3, roblox.Color3
local factories, cache = {}, {}
local function loadModule(name)
  if cache[name] == nil then cache[name] = assert(factories[name], name)() end
  return cache[name]
end
${factories.join("\n")}
local storage = { GameData = ${parent}, rbxts_include = { RuntimeLib = "runtime" } }
function storage:WaitForChild(name) return assert(self[name], name) end
function storage.rbxts_include:WaitForChild(name) return assert(self[name], name) end
factories.runtime = function()
  return { import = function(_script, root, ...)
    local value = root
    for _, name in { ... } do value = assert(value[name], name) end
    return loadModule(value)
  end }
end
local game = { GetService = function(_self, name) assert(name == "ReplicatedStorage"); return storage end }
local script = {}
local function consumer()
  local require = loadModule
${compiled}
end
consumer()
assert(table.isfrozen(loadModule("manifest")))
assert(table.isfrozen(loadModule("tables/units").WEIGHTS[1]))
assert(not pcall(function() loadModule("tables/units").HEALTH[1] = 99 end))
assert(not pcall(function() loadModule("assets").contentId(0) end))
assert(not pcall(function() loadModule("localization").text(1, "en", { name = "Player", count = 1.5 }) end))
`
  const runtime = path.join(directory, "runtime.luau")
  await fs.writeFile(runtime, harness)
  run(lune, ["run", runtime])
} finally {
  await fs.rm(directory, { recursive: true, force: true })
}
