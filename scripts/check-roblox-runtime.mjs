import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { nanoid } from "nanoid"
import { createRobloxExportBundle } from "../src/shared/roblox-export.ts"
import {
  emptyLocalizationDocument,
  localizationDocumentSchema,
} from "../src/shared/localization.ts"
import { assetSchema, dataTableSchema } from "../src/shared/schemas.ts"
import { AssetCategoryEnum } from "../src/enums/asset-category-enum.ts"
import { ColumnType } from "../src/enums/column-type.ts"

const executable = process.argv[2] ?? "luau"
const sibling = (name) =>
  executable.includes(path.sep) ? path.join(path.dirname(executable), name) : name
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "chisel-roblox-runtime-"))
const project = { id: nanoid(), name: "Roblox Runtime Test", path: directory }
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
  locales: ["en", "sl_SI"],
  styles: [{ slug: "STRONG", bold: true, color: "#ff8000" }],
  tooltips: [
    { slug: "HELP", titleKey: "UI.HELLO", descriptionKey: "UI.HELLO", iconAssetId: "ICON" },
  ],
  keys: [
    {
      path: "UI.HELLO",
      values: {
        en: "Hello <style:STRONG>{string:name}</style> {int:count}",
        sl_SI: "Zdravo <style:STRONG>{string:name}</style> {int:count}",
      },
    },
    {
      path: "UI.ICON",
      values: {
        en: "<tooltip:HELP>Info</tooltip><icon:ICON/>",
        sl_SI: "<tooltip:HELP>Info</tooltip><icon:ICON/>",
      },
    },
  ],
})
const columns = [
  {
    id: nanoid(),
    name: "health",
    type: ColumnType.INTEGER,
    defaultValue: 25,
    required: true,
    unique: false,
  },
  {
    id: nanoid(),
    name: "position",
    type: ColumnType.VECTOR_3,
    defaultValue: [1, 2, 3],
    required: true,
    unique: false,
  },
  {
    id: nanoid(),
    name: "color",
    type: ColumnType.COLOR,
    defaultValue: "#ff8000",
    required: true,
    unique: false,
  },
  {
    id: nanoid(),
    name: "metadata",
    type: ColumnType.JSON,
    defaultValue: { nested: [1, "hello"] },
    required: true,
    unique: false,
  },
]
const units = dataTableSchema.parse({
  id: "units",
  name: "Units",
  description: "",
  lastChangeAt: "",
  version: 1,
  columns,
  rows: [
    {
      id: nanoid(),
      slug: "SCOUT",
      values: columns.map((column) => ({
        columnId: column.id,
        type: column.type,
        value: column.defaultValue,
      })),
    },
  ],
})
const bundles = [
  ["full", createRobloxExportBundle(project, [units], "2026-10-28", [asset], localization)],
  ["empty", createRobloxExportBundle(project, [], "2026-10-28", [], emptyLocalizationDocument)],
]

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" })
  if (result.error) {
    throw new Error(`Install the Luau CLI tools or pass the path to luau. ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`)
  }
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
}

try {
  const files = []
  const analysisFiles = []
  const factories = []
  for (const [prefix, bundle] of bundles) {
    const children = { tables: {} }
    for (const file of bundle.files.filter((entry) => entry.path.endsWith(".luau"))) {
      const name = file.path.replace(/^ChiselData\//, "").replace(/\.luau$/, "")
      if (name.startsWith("tables/")) {
        children.tables[name.slice(7)] = `${prefix}/${name}`
      } else {
        children[name] = `${prefix}/${name}`
      }
      const filePath = path.join(directory, prefix, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.content)
      files.push(filePath)
      if (["localization", "assets"].includes(name)) {
        analysisFiles.push(filePath)
      }
    }
    for (const file of bundle.files.filter((entry) => entry.path.endsWith(".luau"))) {
      const name = file.path.replace(/^ChiselData\//, "").replace(/\.luau$/, "")
      const tables = Object.entries(children.tables)
        .map((entry) => {
          const [key, value] = entry
          return `[${JSON.stringify(key)}] = ${JSON.stringify(value)}`
        })
        .join(", ")
      const siblings = Object.entries(children)
        .filter((entry) => {
          const [key] = entry
          return key !== "tables"
        })
        .map((entry) => {
          const [key, value] = entry
          return `[${JSON.stringify(key)}] = ${JSON.stringify(value)}`
        })
        .join(", ")
      factories.push(
        `factories[${JSON.stringify(`${prefix}/${name}`)}] = function()\nlocal script = { Parent = { tables = { ${tables} }, ${siblings} } }\nlocal require = loadModule\n${file.content}\nend`
      )
    }
  }
  run(sibling("luau-compile"), ["--null", ...files])
  run(sibling("luau-analyze"), analysisFiles)
  const harness = `--!nocheck
-- Minimal Roblox API doubles exercise generated modules in the actual Luau VM.
local Vector3 = { new = function(x, y, z) return table.freeze({ X = x, Y = y, Z = z }) end }
local Color3 = { fromRGB = function(r, g, b) return table.freeze({ R = r / 255, G = g / 255, B = b / 255 }) end }
local factories = {}
local cache = {}
local function loadModule(name)
    if cache[name] == nil then cache[name] = assert(factories[name], name)() end
    return cache[name]
end
${factories.join("\n")}
local data = loadModule("full/manifest")
assert(data.TABLES.units.HEALTH[data.TABLES.units.ID.SCOUT] == 25)
assert(data.TABLES.units.POSITION[1].Z == 3)
assert(data.TABLES.units.COLOR[1].R == 1)
assert(table.isfrozen(data.TABLES.units.METADATA[1].nested))
assert(not pcall(function() data.TABLES.units.METADATA[1].nested[1] = 2 end))
assert(data.ASSETS.contentId(data.ASSETS.CATEGORY.UI.ICON, "UI") == "rbxassetid://123456789012345678")
assert(not pcall(function() data.ASSETS.contentId(0) end))
assert(not pcall(function() data.ASSETS.contentId(1, "AUDIO") end))
local loc = data.LOCALIZATION
assert(loc.text(loc.ID.UI_HELLO, nil, { name = "Player", count = 2 }) == "Hello Player 2")
assert(loc.text(loc.ID.UI_HELLO, "sl_SI", { name = "Player", count = 2 }) == "Zdravo Player 2")
assert(loc.richText(loc.ID.UI_HELLO, "en", { name = "<b>&", count = 2 }) == 'Hello <font color="#ff8000"><b>&lt;b&gt;&amp;</b></font> 2')
assert(not pcall(function() loc.text(loc.ID.UI_HELLO, "unknown", { name = "Player", count = 2 }) end))
assert(not pcall(function() loc.text(loc.ID.UI_HELLO, "en", { name = "Player", count = 1.5 }) end))
assert(not pcall(function() loc.text(loc.ID.UI_HELLO, "en", {}) end))
assert(not pcall(function() loc.text(loc.ID.UI_ICON) end))
local segments = loc.segments(loc.ID.UI_ICON)
assert(table.isfrozen(segments) and table.isfrozen(segments[1]))
assert(segments[1].tooltip.titleId == loc.ID.UI_HELLO)
assert(segments[4].contentId == "rbxassetid://123456789012345678")
assert(data.INPUT == nil)
local empty = loadModule("empty/manifest")
assert(empty.ASSETS.COUNT == 0 and empty.INPUT == nil)
assert(not pcall(function() empty.LOCALIZATION.text(1) end))
print("Roblox Luau runtime checks passed: tables, assets, localization, empty bundles.")
`
  const harnessPath = path.join(directory, "runtime-check.luau")
  await fs.writeFile(harnessPath, harness)
  run(executable, [harnessPath])
  console.log(
    `Compiled ${files.length} generated modules and typechecked standalone asset/localization modules.`
  )
} finally {
  await fs.rm(directory, { recursive: true, force: true })
}
