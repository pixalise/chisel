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
import { InputKeyEnum } from "../src/enums/input-key-enum.ts"
import { INPUT_BINDINGS_TABLE } from "../src/constants/system-tables.ts"

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
const input = {
  ...INPUT_BINDINGS_TABLE,
  rows: [
    {
      id: nanoid(),
      slug: "CONFIRM",
      values: [
        {
          columnId: INPUT_BINDINGS_TABLE.columns[1].id,
          type: ColumnType.ENUM_ARRAY,
          value: [InputKeyEnum.KEY_ENTER, InputKeyEnum.MOUSE_BUTTON_LEFT],
        },
      ],
    },
    {
      id: nanoid(),
      slug: "SCROLL",
      values: [
        {
          columnId: INPUT_BINDINGS_TABLE.columns[1].id,
          type: ColumnType.ENUM_ARRAY,
          value: [InputKeyEnum.MOUSE_BUTTON_WHEEL_UP],
        },
      ],
    },
  ],
}
const bundles = [
  ["full", createRobloxExportBundle(project, [units, input], "2026-10-28", [asset], localization)],
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
    for (const file of bundle.files) {
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
    for (const file of bundle.files) {
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
local function signal()
    local callbacks = {}
    return {
        Connect = function(_, callback)
            local connection = { active = true }
            function connection:Disconnect() self.active = false end
            table.insert(callbacks, { connection, callback })
            return connection
        end,
        Fire = function(_, ...)
            for _, entry in callbacks do if entry[1].active then entry[2](...) end end
        end,
    }
end
local Enum = { UserInputType = {} }
for _, name in { "Keyboard", "MouseButton1", "MouseWheel" } do Enum.UserInputType[name] = { Name = name } end
local focused = false
local client = false
local service = { InputBegan = signal(), InputEnded = signal(), InputChanged = signal(), WindowFocusReleased = signal(), TextBoxFocused = signal(), GetFocusedTextBox = function() return if focused then {} else nil end }
local game = { GetService = function(_, name)
    if name == "RunService" then return { IsClient = function() return client end } end
    assert(name == "UserInputService")
    return service
end }
local function event(kind, key, delta)
    return { UserInputType = Enum.UserInputType[kind], KeyCode = { Name = key or "Unknown" }, Position = { Z = delta or 0 } }
end
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
assert(not pcall(data.INPUT.new)) -- Server require works; client-only controller creation fails.
client = true
local controller = data.INPUT.new()
service.InputBegan:Fire(event("Keyboard", "Return"), false)
assert(controller.isActionPressed(data.INPUT.ID.CONFIRM))
assert(controller.isActionJustPressed(data.INPUT.ID.CONFIRM))
controller.endFrame()
service.InputBegan:Fire(event("MouseButton1"), false)
service.InputEnded:Fire(event("Keyboard", "Return"), false)
assert(controller.isActionPressed(data.INPUT.ID.CONFIRM))
assert(not controller.isActionJustReleased(data.INPUT.ID.CONFIRM))
service.InputEnded:Fire(event("MouseButton1"), false)
assert(controller.isActionJustReleased(data.INPUT.ID.CONFIRM))
controller.endFrame()
service.InputBegan:Fire(event("Keyboard", "Return"), true)
assert(not controller.isActionPressed(data.INPUT.ID.CONFIRM))
service.InputBegan:Fire(event("Keyboard", "Return"), false)
service.InputEnded:Fire(event("Keyboard", "Return"), false)
assert(controller.isActionJustPressed(data.INPUT.ID.CONFIRM) and controller.isActionJustReleased(data.INPUT.ID.CONFIRM))
controller.endFrame()
service.InputChanged:Fire(event("MouseWheel", nil, 1), false)
assert(controller.isActionPressed(data.INPUT.ID.SCROLL))
controller.endFrame()
assert(not controller.isActionPressed(data.INPUT.ID.SCROLL) and controller.isActionJustReleased(data.INPUT.ID.SCROLL))
service.InputBegan:Fire(event("Keyboard", "Return"), false)
service.WindowFocusReleased:Fire()
assert(not controller.isActionPressed(data.INPUT.ID.CONFIRM))
focused = true
service.InputBegan:Fire(event("Keyboard", "Return"), false)
assert(not controller.isActionPressed(data.INPUT.ID.CONFIRM))
focused = false
controller.destroy()
service.InputBegan:Fire(event("Keyboard", "Return"), false)
assert(not pcall(function() controller.isActionPressed(data.INPUT.ID.CONFIRM) end))
local empty = loadModule("empty/manifest")
assert(empty.ASSETS.COUNT == 0 and empty.INPUT == nil)
assert(not pcall(function() empty.LOCALIZATION.text(1) end))
print("Roblox Luau runtime checks passed: tables, assets, localization, client input, empty bundles.")
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
