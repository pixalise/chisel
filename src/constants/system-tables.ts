import { ColumnType } from "../enums/column-type"
import { AssetCategoryEnum } from "../enums/asset-category-enum"
import { type DataColumnDefinition, type SystemDataTable } from "../shared/schemas"

const SYSTEM_TABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z"
interface SystemColumnOptions {
  defaultValue?: DataColumnDefinition["defaultValue"]
  max?: number
  maxChars?: number
  min?: number
  possibleValues?: string[]
  required?: boolean
  step?: number
  unique?: boolean
}
function columnId(seed: string): string {
  return seed
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 21)
    .padEnd(21, "0")
}
function defaultValueForColumnType(
  type: ColumnType,
  possibleValues?: string[]
): DataColumnDefinition["defaultValue"] {
  if (type === ColumnType.INTEGER || type === ColumnType.DECIMAL || type === ColumnType.RANGE) {
    return 0
  }
  if (type === ColumnType.BOOLEAN) {
    return false
  }
  if (type === ColumnType.COLOR) {
    return "#000000"
  }
  if (type === ColumnType.VECTOR_2) {
    return [0, 0]
  }
  if (type === ColumnType.VECTOR_3) {
    return [0, 0, 0]
  }
  if (type === ColumnType.VECTOR_4) {
    return [0, 0, 0, 0]
  }
  if (type === ColumnType.JSON) {
    return {}
  }
  if (type === ColumnType.ENUM) {
    return possibleValues?.[0] ?? ""
  }
  if (type === ColumnType.ENUM_ARRAY || type === ColumnType.ARRAY_REF) {
    return []
  }
  return ""
}
function column(
  seed: string,
  name: string,
  type: ColumnType,
  options: SystemColumnOptions = {}
): DataColumnDefinition {
  const definition: DataColumnDefinition = {
    defaultValue: options.defaultValue ?? defaultValueForColumnType(type, options.possibleValues),
    id: columnId(seed),
    name,
    required: options.required ?? true,
    type,
    unique: options.unique ?? false,
  }
  if (typeof options.max === "number") {
    definition.max = options.max
  }
  if (typeof options.maxChars === "number") {
    definition.maxChars = options.maxChars
  }
  if (typeof options.min === "number") {
    definition.min = options.min
  }
  if (options.possibleValues) {
    definition.possibleValues = options.possibleValues
  }
  if (typeof options.step === "number") {
    definition.step = options.step
  }
  return definition
}
export const MATERIALS_TABLE = {
  columns: [
    {
      ...column("material_textures", "textures", ColumnType.ASSET_REF),
      assetCategory: AssetCategoryEnum.TERRAIN_TEXTURE,
    },
    column("material_base_color", "base_color", ColumnType.VECTOR_3, {
      defaultValue: [1, 1, 1],
      min: 0,
    }),
    column("material_metallic", "metallic", ColumnType.DECIMAL, {
      defaultValue: 1,
      min: 0,
      max: 1,
    }),
    column("material_roughness", "roughness", ColumnType.DECIMAL, {
      defaultValue: 1,
      min: 0,
      max: 1,
    }),
    column("material_normal", "normal_strength", ColumnType.DECIMAL, { defaultValue: 1, min: 0 }),
    column("material_glow", "glow_tint", ColumnType.VECTOR_3, { defaultValue: [0, 0, 0], min: 0 }),
  ],
  description: "Zora PBR materials. Color factors and glow tint are linear RGB.",
  id: "materials",
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "rendering",
  name: "Materials",
  rows: [],
  version: 1,
} satisfies SystemDataTable
export const MODEL_MATERIALS_TABLE = {
  columns: [
    {
      ...column("binding_model", "model", ColumnType.ASSET_REF),
      assetCategory: AssetCategoryEnum.MESH,
    },
    column("binding_slot", "slot", ColumnType.STRING),
    { ...column("binding_material", "material", ColumnType.REF), refTableId: "materials" },
  ],
  description: "Bind Blender material slot names to Zora material definitions.",
  id: "model_materials",
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "rendering",
  name: "Model Materials",
  rows: [],
  version: 1,
} satisfies SystemDataTable
export const SYSTEM_TABLES = [MATERIALS_TABLE, MODEL_MATERIALS_TABLE]
