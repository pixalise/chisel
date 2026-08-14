import type { DataColumnDefinition, DataTableRow, SystemDataTable } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";

export const TERRAIN_TILE_BINDINGS_TABLE_ID = "terrain_tile_bindings";
export const TERRAIN_WFC_SAMPLES_TABLE_ID = "terrain_wfc_samples";
export const TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID = "terrain_wfc_sample_cells";
export const TERRAIN_BIOMES_TABLE_ID = "terrain_biomes";
export const TERRAIN_BIOME_PROFILES_TABLE_ID = "terrain_biome_profiles";

const SYSTEM_TABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z";

interface SystemColumnOptions {
  assetCategory?: AssetCategoryEnum;
  defaultValue?: DataColumnDefinition["defaultValue"];
  min?: number;
  refTableId?: string;
  required?: boolean;
  unique?: boolean;
}

export function terrainSystemId(seed: string): string {
  return seed
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 21)
    .padEnd(21, "0");
}

function defaultValue(type: ColumnType): DataColumnDefinition["defaultValue"] {
  if (type === ColumnType.integer || type === ColumnType.decimal) return 0;
  if (type === ColumnType.boolean) return false;
  if (type === ColumnType.color) return "#000000";
  if (type === ColumnType.enumArray) return [];
  return "";
}

function column(seed: string, name: string, type: ColumnType, options: SystemColumnOptions = {}): DataColumnDefinition {
  return {
    id: terrainSystemId(seed),
    name,
    type,
    defaultValue: options.defaultValue ?? defaultValue(type),
    required: options.required ?? true,
    unique: options.unique ?? false,
    ...(typeof options.min === "number" ? { min: options.min } : {}),
    ...(options.refTableId ? { refTableId: options.refTableId } : {}),
    ...(options.assetCategory ? { assetCategory: options.assetCategory } : {})
  };
}

function table(id: string, name: string, description: string, columns: DataColumnDefinition[], rows: DataTableRow[] = []): SystemDataTable {
  return {
    id,
    name,
    description,
    columns,
    rows,
    kind: "system",
    isSystemTable: true,
    lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
    moduleId: "terrain",
    version: 1
  };
}

export const TERRAIN_TILE_BINDING_COLUMNS = {
  tileset: column("terrain_binding_tileset", "tileset", ColumnType.assetRef, { assetCategory: AssetCategoryEnum.tileset }),
  localId: column("terrain_binding_local", "local_id", ColumnType.integer, { min: 0 }),
  tileSlug: column("terrain_binding_slug", "tile_slug", ColumnType.string),
  blocking: column("terrain_binding_block", "blocking", ColumnType.boolean),
  tags: column("terrain_binding_tags", "tags", ColumnType.enumArray, { defaultValue: [], required: false })
} as const;

export const TERRAIN_WFC_SAMPLE_COLUMNS = {
  width: column("terrain_sample_width", "width", ColumnType.integer, { min: 3 }),
  height: column("terrain_sample_height", "height", ColumnType.integer, { min: 3 }),
  layerCount: column("terrain_sample_layers", "layer_count", ColumnType.integer, { defaultValue: 1, min: 1 }),
  periodicInput: column("terrain_sample_periodic", "periodic_input", ColumnType.boolean),
  allowRotations: column("terrain_sample_rotate", "allow_rotations", ColumnType.boolean),
  allowReflections: column("terrain_sample_reflect", "allow_reflections", ColumnType.boolean)
} as const;

export const TERRAIN_WFC_SAMPLE_CELL_COLUMNS = {
  sample: column("terrain_cell_sample", "sample", ColumnType.ref, { refTableId: TERRAIN_WFC_SAMPLES_TABLE_ID }),
  x: column("terrain_cell_x", "x", ColumnType.integer, { min: 0 }),
  y: column("terrain_cell_y", "y", ColumnType.integer, { min: 0 }),
  layer: column("terrain_cell_layer", "layer", ColumnType.integer, { min: 0 }),
  tileset: column("terrain_cell_tileset", "tileset", ColumnType.assetRef, { assetCategory: AssetCategoryEnum.tileset }),
  localId: column("terrain_cell_local", "local_id", ColumnType.integer, { min: 0 })
} as const;

export const TERRAIN_BIOME_COLUMNS = {
  label: column("terrain_biome_label", "label", ColumnType.string),
  description: column("terrain_biome_desc", "description", ColumnType.text, { required: false })
} as const;

export const TERRAIN_BIOME_PROFILE_COLUMNS = {
  biome: column("terrain_profile_biome", "biome", ColumnType.ref, { refTableId: TERRAIN_BIOMES_TABLE_ID }),
  sample: column("terrain_profile_sample", "sample", ColumnType.ref, { refTableId: TERRAIN_WFC_SAMPLES_TABLE_ID }),
  weight: column("terrain_profile_weight", "weight", ColumnType.decimal, { defaultValue: 1, min: 0 })
} as const;

export const TERRAIN_TILE_BINDINGS_TABLE = table(
  TERRAIN_TILE_BINDINGS_TABLE_ID,
  "Terrain Tile Bindings",
  "Stable slugs, collision flags, and semantic tags for tileset sprites.",
  Object.values(TERRAIN_TILE_BINDING_COLUMNS)
);

export const TERRAIN_WFC_SAMPLES_TABLE = table(
  TERRAIN_WFC_SAMPLES_TABLE_ID,
  "Terrain WFC Samples",
  "Native Chisel WFC sample definitions.",
  Object.values(TERRAIN_WFC_SAMPLE_COLUMNS)
);

export const TERRAIN_WFC_SAMPLE_CELLS_TABLE = table(
  TERRAIN_WFC_SAMPLE_CELLS_TABLE_ID,
  "Terrain WFC Sample Cells",
  "Painted tileset cells belonging to native Chisel WFC samples.",
  Object.values(TERRAIN_WFC_SAMPLE_CELL_COLUMNS)
);

export const TERRAIN_BIOMES_TABLE = table(
  TERRAIN_BIOMES_TABLE_ID,
  "Terrain Biomes",
  "Biome definitions consumed by procedural terrain generation.",
  Object.values(TERRAIN_BIOME_COLUMNS)
);

export const TERRAIN_BIOME_PROFILES_TABLE = table(
  TERRAIN_BIOME_PROFILES_TABLE_ID,
  "Terrain Biome Profiles",
  "Weighted WFC sample assignments for biomes.",
  Object.values(TERRAIN_BIOME_PROFILE_COLUMNS)
);

export const SYSTEM_TERRAIN_TABLES = [
  TERRAIN_TILE_BINDINGS_TABLE,
  TERRAIN_WFC_SAMPLES_TABLE,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE,
  TERRAIN_BIOMES_TABLE,
  TERRAIN_BIOME_PROFILES_TABLE
];

export const EDITABLE_TERRAIN_TABLE_IDS = new Set([TERRAIN_BIOMES_TABLE_ID, TERRAIN_BIOME_PROFILES_TABLE_ID]);
