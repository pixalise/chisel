import { isEmpty } from "lodash"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { ColumnType } from "../enums/column-type"
import { constantCase } from "./asset-paths"
import type { LocalizationDocument } from "./localization"
import type { LuauExportFile } from "./luau-serialization"
import { renderRobloxLocalizationTypes } from "./roblox-localization-typescript-export"
import type { Asset, DataColumnDefinition, DataTableSchema } from "./schemas"
import { stringUnion, TYPESCRIPT_HEADER } from "./typescript-declarations"

function ids(slugs: readonly string[]): string {
  return [
    "readonly INVALID: 0;",
    ...slugs.map((slug, index) => `readonly ${JSON.stringify(slug)}: ${index + 1};`),
  ].join("\n    ")
}

function columnType(column: DataColumnDefinition): string {
  switch (column.type) {
    case ColumnType.STRING:
    case ColumnType.TEXT:
      return "string"
    case ColumnType.INTEGER:
    case ColumnType.DECIMAL:
    case ColumnType.RANGE:
    case ColumnType.REF:
    case ColumnType.ASSET_REF:
    case ColumnType.TRANSLATION_REF:
      return "number"
    case ColumnType.BOOLEAN:
      return "boolean"
    case ColumnType.COLOR:
      return "Color3"
    case ColumnType.VECTOR_2:
      return "Vector2"
    case ColumnType.VECTOR_3:
      return "Vector3"
    case ColumnType.VECTOR_4:
      return "readonly [number, number, number, number]"
    case ColumnType.ARRAY_REF:
      return "readonly number[]"
    case ColumnType.JSON:
      return "JsonValue"
    case ColumnType.ENUM:
    case ColumnType.ENUM_ARRAY: {
      let value = "string"
      if (!isEmpty(column.possibleValues)) {
        const values = [...(column.possibleValues ?? [])]
        if (!column.required && column.type === ColumnType.ENUM) {
          values.push("")
        }
        value = stringUnion(values)
      }
      if (column.type === ColumnType.ENUM_ARRAY) {
        return `ReadonlyArray<${value}>`
      }
      return value
    }
  }
}

function renderTableTypes(table: DataTableSchema, root: string): LuauExportFile {
  const slugs = table.rows.map((row) => row.slug)
  return {
    path: `${root}/tables/${table.id}.d.ts`,
    content: `${TYPESCRIPT_HEADER}
import type { IdLookup, JsonValue } from "../types";

interface Data {
  readonly TABLE_ID: ${JSON.stringify(table.id)};
  readonly COUNT: ${table.rows.length};
  readonly ID: { ${ids(slugs)} };
  readonly SLUGS: IdLookup<${stringUnion(slugs)}>;
${table.columns.map((column) => `  readonly ${JSON.stringify(constantCase(column.name))}: IdLookup<${columnType(column)}>;`).join("\n")}
}
declare const data: Data;
export = data;
`,
  }
}

function renderAssetTypes(assets: Asset[], root: string): LuauExportFile {
  const categories = Object.values(AssetCategoryEnum).map((category) => {
    const fields = assets.flatMap((asset, index) => {
      if (asset.category !== category) {
        return []
      }
      return [`readonly ${JSON.stringify(asset.id)}: ${index + 1};`]
    })
    return `    readonly ${JSON.stringify(category)}: { ${fields.join(" ")} };`
  })
  return {
    path: `${root}/assets.d.ts`,
    content: `${TYPESCRIPT_HEADER}
import type { IdLookup } from "./types";

type Category = ${stringUnion(Object.values(AssetCategoryEnum))};
interface AssetRecord {
  readonly slug: ${stringUnion(assets.map((asset) => asset.id))};
  readonly category: Category;
  readonly contentId: string;
}
interface Assets {
  readonly ID: { ${ids(assets.map((asset) => asset.id))} };
  readonly CATEGORY: {
${categories.join("\n")}
  };
  readonly COUNT: ${assets.length};
  readonly RECORDS: IdLookup<AssetRecord>;
  readonly contentId: (id: number, category?: Category) => string;
}
declare const assets: Assets;
export = assets;
`,
  }
}

export function renderRobloxTypescript(
  tables: DataTableSchema[],
  assets: Asset[],
  localization: LocalizationDocument,
  root: string
): LuauExportFile[] {
  return [
    {
      path: `${root}/types.d.ts`,
      content: `${TYPESCRIPT_HEADER}
/** Numeric definition IDs are 1-based. This is deliberately not a TypeScript array. */
export interface IdLookup<T> {
  readonly [id: number]: T | undefined;
}
/** JSON null is rejected during export. Nested definitions are immutable. */
export type JsonValue = string | number | boolean | readonly JsonValue[] | { readonly [key: string]: JsonValue | undefined };
`,
    },
    ...tables.map((table) => renderTableTypes(table, root)),
    renderAssetTypes(assets, root),
    renderRobloxLocalizationTypes(localization, root),
    {
      path: `${root}/manifest.d.ts`,
      content: `${TYPESCRIPT_HEADER}
import type Assets from "./assets";
import type Localization from "./localization";
${tables.map((table, index) => `import type Table${index} from ${JSON.stringify(`./tables/${table.id}`)};`).join("\n")}

interface Manifest {
  readonly PROJECT_ID: string;
  readonly PROJECT_NAME: string;
  readonly EXPORTED_AT: string;
  readonly TABLES: {
${tables.map((table, index) => `    readonly ${JSON.stringify(table.id)}: typeof Table${index};`).join("\n")}
  };
  readonly ASSETS: typeof Assets;
  readonly LOCALIZATION: typeof Localization;
}
declare const data: Manifest;
export = data;
`,
    },
  ]
}
