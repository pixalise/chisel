import type { DataColumnDefinition, DataTableRow, SystemDataTable } from "./schemas";
import { AssetCategoryEnum, ColumnType } from "./types";

export const TERRAIN_TILE_BINDINGS_TABLE_ID = "terrain_tile_bindings";
export const TERRAIN_SOCKETS_TABLE_ID = "terrain_sockets";
export const TERRAIN_PIECES_TABLE_ID = "terrain_pieces";
export const TERRAIN_PIECE_SETS_TABLE_ID = "terrain_piece_sets";
export const TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID = "terrain_adjacency_overrides";
export const TERRAIN_SITE_TEMPLATES_TABLE_ID = "terrain_site_templates";
export const TERRAIN_APPROVED_ASSETS_TABLE_ID = "terrain_approved_assets";
export const TERRAIN_SPATIAL_LAYOUTS_TABLE_ID = "terrain_spatial_layouts";
export const VISIBLE_TERRAIN_SYSTEM_TABLE_IDS = new Set<string>([TERRAIN_APPROVED_ASSETS_TABLE_ID, TERRAIN_SPATIAL_LAYOUTS_TABLE_ID]);

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
  if (type === ColumnType.enumArray || type === ColumnType.arrayRef) return [];
  if (type === ColumnType.json) return {};
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
  tags: column("terrain_binding_tags", "tags", ColumnType.enumArray, { defaultValue: [], required: false })
} as const;

export const TERRAIN_SOCKET_COLUMNS = {
  color: column("terrain_socket_color", "color", ColumnType.color),
  description: column("terrain_socket_desc", "description", ColumnType.text, { required: false })
} as const;

export const TERRAIN_PIECE_COLUMNS = {
  width: column("terrain_piece_width", "width", ColumnType.integer, { min: 1 }),
  height: column("terrain_piece_height", "height", ColumnType.integer, { min: 1 }),
  definition: column("terrain_piece_definition", "definition", ColumnType.json)
} as const;

export const TERRAIN_PIECE_SET_COLUMNS = {
  definition: column("terrain_set_definition", "definition", ColumnType.json)
} as const;

export const TERRAIN_ADJACENCY_OVERRIDE_COLUMNS = {
  sourcePiece: column("terrain_override_source", "source_piece", ColumnType.ref, { refTableId: TERRAIN_PIECES_TABLE_ID }),
  direction: column("terrain_override_direction", "direction", ColumnType.string),
  targetPiece: column("terrain_override_target", "target_piece", ColumnType.ref, { refTableId: TERRAIN_PIECES_TABLE_ID }),
  mode: column("terrain_override_mode", "mode", ColumnType.string)
} as const;

export const TERRAIN_SITE_TEMPLATE_COLUMNS = {
  width: column("terrain_template_width", "width", ColumnType.integer, { min: 3 }),
  height: column("terrain_template_height", "height", ColumnType.integer, { min: 3 }),
  definition: column("terrain_template_definition", "definition", ColumnType.json)
} as const;

export const TERRAIN_APPROVED_ASSET_COLUMNS = {
  kind: column("terrain_approved_kind", "kind", ColumnType.string),
  sourceTemplate: column("terrain_approved_template", "source_template", ColumnType.ref, { refTableId: TERRAIN_SITE_TEMPLATES_TABLE_ID }),
  definition: column("terrain_approved_definition", "definition", ColumnType.json)
} as const;

export const TERRAIN_SPATIAL_LAYOUT_COLUMNS = {
  sourceAsset: column("terrain_layout_source", "source_asset", ColumnType.ref, { refTableId: TERRAIN_APPROVED_ASSETS_TABLE_ID }),
  definition: column("terrain_layout_definition", "definition", ColumnType.json)
} as const;

export const TERRAIN_TILE_BINDINGS_TABLE = table(
  TERRAIN_TILE_BINDINGS_TABLE_ID,
  "Terrain Sprite Metadata",
  "Stable sprite slugs and semantic tags used by authored terrain pieces.",
  Object.values(TERRAIN_TILE_BINDING_COLUMNS)
);

export const TERRAIN_SOCKETS_TABLE = table(
  TERRAIN_SOCKETS_TABLE_ID,
  "Terrain Sockets",
  "Project-wide Wang edge socket vocabulary for terrain pieces.",
  Object.values(TERRAIN_SOCKET_COLUMNS)
);

export const TERRAIN_PIECES_TABLE = table(
  TERRAIN_PIECES_TABLE_ID,
  "Terrain Pieces",
  "Mixed-size, layered Simple-Tiled WFC modules with explicit edge sockets.",
  Object.values(TERRAIN_PIECE_COLUMNS)
);

export const TERRAIN_PIECE_SETS_TABLE = table(
  TERRAIN_PIECE_SETS_TABLE_ID,
  "Terrain Collections",
  "Terrain piece collections selected by site templates.",
  Object.values(TERRAIN_PIECE_SET_COLUMNS)
);

export const TERRAIN_ADJACENCY_OVERRIDES_TABLE = table(
  TERRAIN_ADJACENCY_OVERRIDES_TABLE_ID,
  "Terrain Adjacency Overrides",
  "Inspectable allow-only and deny exceptions applied after socket matching.",
  Object.values(TERRAIN_ADJACENCY_OVERRIDE_COLUMNS)
);

export const TERRAIN_SITE_TEMPLATES_TABLE = table(
  TERRAIN_SITE_TEMPLATES_TABLE_ID,
  "Terrain Site Templates",
  "Macro tag constraints, stamps, anchors, and zones used for candidate generation.",
  Object.values(TERRAIN_SITE_TEMPLATE_COLUMNS)
);

export const TERRAIN_APPROVED_ASSETS_TABLE = table(
  TERRAIN_APPROVED_ASSETS_TABLE_ID,
  "Approved Terrain Assets",
  "Approved generated bases with sparse terrain-polish overrides retained in Chisel's internal geography library.",
  Object.values(TERRAIN_APPROVED_ASSET_COLUMNS)
);

export const TERRAIN_SPATIAL_LAYOUTS_TABLE = table(
  TERRAIN_SPATIAL_LAYOUTS_TABLE_ID,
  "Terrain Spatial Layouts",
  "Post-approval zone masks, markers, and fixed or rule-driven content placements over resolved approved geography.",
  Object.values(TERRAIN_SPATIAL_LAYOUT_COLUMNS)
);

export const SYSTEM_TERRAIN_TABLES = [
  TERRAIN_TILE_BINDINGS_TABLE,
  TERRAIN_SOCKETS_TABLE,
  TERRAIN_PIECES_TABLE,
  TERRAIN_PIECE_SETS_TABLE,
  TERRAIN_ADJACENCY_OVERRIDES_TABLE,
  TERRAIN_SITE_TEMPLATES_TABLE,
  TERRAIN_APPROVED_ASSETS_TABLE,
  TERRAIN_SPATIAL_LAYOUTS_TABLE
];

export const EDITOR_ONLY_TERRAIN_TABLE_IDS = new Set(SYSTEM_TERRAIN_TABLES.map((entry) => entry.id));
export const EDITABLE_TERRAIN_TABLE_IDS = new Set<string>();
