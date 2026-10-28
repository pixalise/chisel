import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { nanoid } from "nanoid"
import ts from "typescript"
import { describe, expect, it } from "vitest"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { ColumnType } from "../enums/column-type"
import { emptyLocalizationDocument, localizationDocumentSchema } from "./localization"
import { createRobloxExportBundle, type RobloxExportBundle } from "./roblox-export"
import { assetSchema, dataTableSchema } from "./schemas"

function fixture(): RobloxExportBundle {
  const columns = [
    { name: "health", type: ColumnType.INTEGER, defaultValue: 25 },
    { name: "position", type: ColumnType.VECTOR_3, defaultValue: [1, 2, 3] },
    { name: "size", type: ColumnType.VECTOR_2, defaultValue: [1, 2] },
    { name: "color", type: ColumnType.COLOR, defaultValue: "#112233" },
    { name: "weights", type: ColumnType.VECTOR_4, defaultValue: [1, 2, 3, 4] },
    {
      name: "tags",
      type: ColumnType.ENUM_ARRAY,
      defaultValue: ["FAST"],
      possibleValues: ["FAST", "SLOW"],
    },
    { name: "mode", type: ColumnType.ENUM, defaultValue: "FAST", possibleValues: ["FAST", "SLOW"] },
    { name: "links", type: ColumnType.ARRAY_REF, defaultValue: ["SCOUT"], refTableId: "units" },
    { name: "metadata", type: ColumnType.JSON, defaultValue: { enabled: true } },
  ].map((column) => ({ id: nanoid(), required: true, unique: false, ...column }))
  const units = dataTableSchema.parse({
    id: "units",
    name: "Units",
    description: "",
    lastChangeAt: "",
    columns,
    rows: [{ id: nanoid(), slug: "SCOUT", values: [] }],
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
    robloxAssetId: "123",
  })
  const localization = localizationDocumentSchema.parse({
    ...emptyLocalizationDocument,
    keys: [{ path: "UI.TITLE", values: { en: "Hello {string:name}" } }],
  })
  return createRobloxExportBundle(
    { id: nanoid(), name: "Game", path: "/tmp/game" },
    [units],
    "",
    [asset],
    localization
  )
}

function checkConsumer(bundle: RobloxExportBundle, source: string): string[] {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "chisel-declarations-"))
  try {
    for (const file of bundle.files) {
      const destination = path.join(directory, file.path)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.writeFileSync(destination, file.content)
    }
    const consumer = path.join(directory, "consumer.ts")
    const globals = path.join(directory, "roblox.d.ts")
    fs.writeFileSync(consumer, source)
    fs.writeFileSync(
      globals,
      `
declare class Vector2 { readonly X: number; readonly Y: number; }
declare class Vector3 { readonly X: number; readonly Y: number; readonly Z: number; }
declare class Color3 { readonly R: number; readonly G: number; readonly B: number; }
`
    )
    const program = ts.createProgram([consumer, globals], {
      strict: true,
      noEmit: true,
      allowSyntheticDefaultImports: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      types: [],
    })
    return ts
      .getPreEmitDiagnostics(program)
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

describe("Roblox TypeScript declarations", () => {
  it("typechecks real consumers and rejects mutation, missing members, wrong types and locales", () => {
    expect(
      checkConsumer(
        fixture(),
        `
import data from "./ChiselData/manifest";
import units from "./ChiselData/tables/units";
const id: 1 = units.ID.SCOUT;
const health: number | undefined = units.HEALTH[id];
const position: Vector3 | undefined = units.POSITION[id];
const size: Vector2 | undefined = units.SIZE[id];
const color: Color3 | undefined = units.COLOR[id];
const mode: "FAST" | "SLOW" | undefined = units.MODE[id];
const tags: readonly ("FAST" | "SLOW")[] | undefined = units.TAGS[id];
const links: readonly number[] | undefined = units.LINKS[id];
const weights: readonly [number, number, number, number] | undefined = units.WEIGHTS[id];
const image: string = data.ASSETS.contentId(data.ASSETS.CATEGORY.UI.ICON, "UI");
const text: string = data.LOCALIZATION.text(data.LOCALIZATION.ID.UI_TITLE, "en", { name: "Player" });
for (const segment of data.LOCALIZATION.segments(1)) {
  if (segment.kind === "text") { const text: string = segment.text; }
  if (segment.kind === "icon") { const image: string = segment.contentId; }
}
// @ts-expect-error Frozen column data.
units.HEALTH[id] = 10;
// @ts-expect-error Numeric IDs are bounds-checked by consumers, not asserted present by declarations.
const invalid: number = units.HEALTH[0];
// @ts-expect-error Unknown generated member.
units.ID.MISSING;
// @ts-expect-error Wrong native value type.
const bad: string = units.POSITION[id];
// @ts-expect-error Nested lists are immutable.
units.TAGS[id]?.push("FAST");
// @ts-expect-error Unknown locale.
data.LOCALIZATION.text(1, "missing");
// @ts-expect-error Wrong placeholder value type.
data.LOCALIZATION.text(1, "en", { name: true });
// @ts-expect-error Unknown asset category.
data.ASSETS.contentId(1, "missing");
// @ts-expect-error Frozen localization result.
data.LOCALIZATION.segments(1).push({ kind: "text", text: "mutation" });
`
      )
    ).toEqual([])
  })

  it("emits declarations for every module, including valid empty exports", () => {
    const bundle = createRobloxExportBundle(
      { id: nanoid(), name: "Empty", path: "/tmp/empty" },
      [],
      "",
      [],
      emptyLocalizationDocument
    )
    for (const file of fixture().files.filter((entry) => entry.path.endsWith(".luau"))) {
      expect(
        fixture().files.some((entry) => entry.path === file.path.replace(/\.luau$/, ".d.ts"))
      ).toBe(true)
    }
    expect(
      checkConsumer(
        bundle,
        `
import data from "./ChiselData/manifest";
const count: 0 = data.ASSETS.COUNT;
const invalid: 0 = data.ASSETS.ID.INVALID;
// @ts-expect-error Empty exports do not invent a table.
data.TABLES.units;
// @ts-expect-error Empty exports do not invent an asset.
data.ASSETS.ID.ICON;
`
      )
    ).toEqual([])
  })
})
