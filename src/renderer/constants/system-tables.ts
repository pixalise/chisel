import { type DataColumnDefinition, type DataTableRow, type SystemDataTable } from "../../shared/schemas";
import { AssetTypeEnum, ColumnType, InputKeyEnum } from "../../shared/types";

export const TERRAIN_BIOMES_TABLE_ID = "graphite_terrain_biomes";
export const TERRAIN_VARIANTS_TABLE_ID = "graphite_terrain_variants";
export const RENDERER_LIGHTING_TABLE_ID = "graphite_renderer_lighting_presets";
export const RENDERER_MATERIALS_TABLE_ID = "graphite_renderer_material_presets";
export const INPUT_BINDINGS_TABLE_ID = "graphite_input_bindings";
export const LEVEL_RECIPES_TABLE_ID = "graphite_level_recipes";
export const STAMPS_TABLE_ID = "graphite_stamps";
export const STAMP_MASKS_TABLE_ID = "graphite_stamp_masks";
export const STAMP_OVERLAYS_TABLE_ID = "graphite_stamp_overlays";
export const STAMP_OVERLAY_LAYERS_TABLE_ID = "graphite_stamp_overlay_layers";
export const STAMP_PREFABS_TABLE_ID = "graphite_stamp_prefabs";
export const STAMP_MARKERS_TABLE_ID = "graphite_stamp_markers";
export const STAMP_HEIGHT_FIELDS_TABLE_ID = "graphite_stamp_height_fields";
export const FOLIAGE_SPECIES_TABLE_ID = "graphite_foliage_species";
export const FOLIAGE_RULES_TABLE_ID = "graphite_foliage_rules";
export const WEATHER_PRESETS_TABLE_ID = "graphite_weather_presets";

const SYSTEM_TABLE_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const builtinTerrainLayerValues = ["builtin_soil", "builtin_grass", "builtin_sand", "builtin_rock"];
const terrainSurfaceValues = [...builtinTerrainLayerValues, "mud", "ash", "road", "concrete"];
const blockerMaskValues = ["terrain", "static_asset", "structure", "unit", "dynamic"];

interface SystemColumnOptions {
  assetType?: AssetTypeEnum;
  defaultValue?: DataColumnDefinition["defaultValue"];
  max?: number;
  maxChars?: number;
  min?: number;
  possibleValues?: string[];
  required?: boolean;
  step?: number;
  unique?: boolean;
}

function columnId(seed: string): string {
  return seed
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 21)
    .padEnd(21, "0");
}

function defaultValueForColumnType(type: ColumnType, possibleValues?: string[]): DataColumnDefinition["defaultValue"] {
  if (type === ColumnType.integer || type === ColumnType.decimal || type === ColumnType.range) {
    return 0;
  }
  if (type === ColumnType.boolean) {
    return false;
  }
  if (type === ColumnType.color) {
    return "#000000";
  }
  if (type === ColumnType.vector2) {
    return [0, 0];
  }
  if (type === ColumnType.vector3) {
    return [0, 0, 0];
  }
  if (type === ColumnType.vector4) {
    return [0, 0, 0, 0];
  }
  if (type === ColumnType.cellMask) {
    return {
      cellSizeMeters: 2,
      cells: [],
      height: 1,
      width: 1
    };
  }
  if (type === ColumnType.heightField) {
    return {
      cellSizeMeters: 2,
      cornerHeight: 2,
      cornerWidth: 2,
      height: 1,
      values: [0, 0, 0, 0],
      width: 1
    };
  }
  if (type === ColumnType.transform3) {
    return {
      position: [0, 0, 0],
      rotationDegrees: [0, 0, 0],
      scale: [1, 1, 1]
    };
  }
  if (type === ColumnType.json) {
    return {};
  }
  if (type === ColumnType.enum) {
    return possibleValues?.[0] ?? "";
  }
  if (type === ColumnType.enumArray) {
    return [];
  }
  return "";
}

function column(seed: string, name: string, type: ColumnType, options: SystemColumnOptions = {}): DataColumnDefinition {
  const definition: DataColumnDefinition = {
    defaultValue: options.defaultValue ?? defaultValueForColumnType(type, options.possibleValues),
    id: columnId(seed),
    name,
    required: options.required ?? true,
    type,
    unique: options.unique ?? false
  };
  if (typeof options.max === "number") {
    definition.max = options.max;
  }
  if (options.assetType) {
    definition.assetType = options.assetType;
  }
  if (typeof options.maxChars === "number") {
    definition.maxChars = options.maxChars;
  }
  if (typeof options.min === "number") {
    definition.min = options.min;
  }
  if (options.possibleValues) {
    definition.possibleValues = options.possibleValues;
  }
  if (typeof options.step === "number") {
    definition.step = options.step;
  }
  return definition;
}

function tableCell(seed: string, type: ColumnType, value: unknown): DataTableRow["values"][number] {
  return {
    columnId: columnId(seed),
    type,
    value
  } as DataTableRow["values"][number];
}

function tableRow(seed: string, values: DataTableRow["values"]): DataTableRow {
  return {
    id: columnId(seed),
    values
  };
}

export const TERRAIN_BIOMES_TABLE = {
  columns: [
    column("biomes_file_name", "file_name", ColumnType.string, { defaultValue: "temperate", maxChars: 64, unique: true }),
    column("biomes_id", "id", ColumnType.integer, { defaultValue: 1, min: 1, unique: true }),
    column("biomes_name", "name", ColumnType.string, { defaultValue: "Temperate", maxChars: 96 }),
    column("biomes_environment", "environment", ColumnType.assetRef, {
      assetType: AssetTypeEnum.texture,
      defaultValue: "",
      required: false
    }),
    column("biomes_variant_count", "variant_count", ColumnType.integer, { defaultValue: 0, max: 16, min: 0 }),
    column("biomes_sampling_mode", "sampling_mode", ColumnType.enum, {
      defaultValue: "stochastic",
      possibleValues: ["repeat", "stochastic", "wang"]
    }),
    column("biomes_uv_scale", "uv_scale", ColumnType.range, { defaultValue: 0.05, max: 0.5, min: 0.0001, step: 0.001 }),
    column("biomes_sampling_scale", "sampling_scale", ColumnType.range, { defaultValue: 0.09, max: 0.5, min: 0.0001, step: 0.001 }),
    column("biomes_sampling_offset", "sampling_offset_scale", ColumnType.range, { defaultValue: 0.32, max: 20, min: 0, step: 0.01 }),
    column("biomes_height_width", "height_blend_width", ColumnType.range, { defaultValue: 0.12, max: 1, min: 0.005, step: 0.01 }),
    column("biomes_sampling_width", "sampling_blend_width", ColumnType.range, {
      defaultValue: 0.14,
      max: 0.49,
      min: 0.02,
      step: 0.01
    }),
    column("biomes_macro_scale", "macro_scale", ColumnType.range, { defaultValue: 0.0016, max: 0.01, min: 0.00005, step: 0.00005 }),
    column("biomes_macro_strength", "macro_strength", ColumnType.range, { defaultValue: 0.24, max: 2, min: 0, step: 0.02 }),
    column("biomes_macro_tint", "macro_tint_strength", ColumnType.range, { defaultValue: 0.76, max: 4, min: 0, step: 0.05 }),
    column("biomes_zone_seed", "zone_seed", ColumnType.integer, { defaultValue: 17, min: 0 }),
    column("biomes_zone_noise", "zone_noise_scale", ColumnType.range, { defaultValue: 0.0104, max: 1, min: 0.000001, step: 0.0001 }),
    column("biomes_zone_contrast", "zone_contrast", ColumnType.range, { defaultValue: 1.25, max: 8, min: 0.01, step: 0.01 }),
    column("biomes_zone_blend", "zone_blend_width", ColumnType.range, { defaultValue: 0.08, max: 0.5, min: 0, step: 0.005 }),
    column("biomes_zone_edge", "zone_edge_breakup", ColumnType.range, { defaultValue: 0.35, max: 1, min: 0, step: 0.01 })
  ],
  description: "Graphite zones-only terrain splat globals exported to assets/config/biomes/*.biome.",
  id: TERRAIN_BIOMES_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.terrain",
  name: "Terrain Biomes",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const TERRAIN_VARIANTS_TABLE = {
  columns: [
    column("variants_biome", "biome", ColumnType.string, { defaultValue: "temperate" }),
    column("variants_id", "id", ColumnType.integer, { defaultValue: 0, max: 15, min: 0 }),
    column("variants_texture", "terrain_texture", ColumnType.assetRef, { assetType: AssetTypeEnum.terrainTexture }),
    column("variants_texture_scale", "texture_scale", ColumnType.vector2, { defaultValue: [1, 1], max: 50, min: 0.01, step: 0.01 }),
    column("variants_texture_offset", "texture_offset", ColumnType.vector2, { defaultValue: [0, 0], step: 0.01 }),
    column("variants_albedo", "albedo_multiplier", ColumnType.vector3, { defaultValue: [1, 1, 1], min: 0, step: 0.01 }),
    column("variants_albedo_tint", "albedo_tint", ColumnType.color, { defaultValue: "#ffffff" }),
    column("variants_tint_strength", "albedo_tint_strength", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("variants_saturation", "albedo_saturation", ColumnType.range, { defaultValue: 1, max: 2, min: 0, step: 0.01 }),
    column("variants_normal", "normal_strength", ColumnType.range, { defaultValue: 1, max: 4, min: 0, step: 0.01 }),
    column("variants_roughness", "roughness_multiplier", ColumnType.range, { defaultValue: 1, max: 4, min: 0.04, step: 0.01 }),
    column("variants_wetness", "wetness", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("variants_height_blend", "height_blend_strength", ColumnType.range, {
      defaultValue: 0.28,
      max: 4,
      min: 0,
      step: 0.02
    }),
    column("variants_zone_start", "zone_start", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("variants_zone_end", "zone_end", ColumnType.range, { defaultValue: 1, max: 1, min: 0, step: 0.01 }),
    column("variants_zone_weight", "zone_weight", ColumnType.range, { defaultValue: 1, max: 16, min: 0, step: 0.01 })
  ],
  description: "Graphite terrain material variants exported inside each biome manifest.",
  id: TERRAIN_VARIANTS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.terrain",
  name: "Terrain Variants",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const RENDERER_LIGHTING_TABLE = {
  columns: [
    column("lighting_name", "name", ColumnType.string, { defaultValue: "neutral_debug", maxChars: 64, unique: true }),
    column("lighting_hdri", "hdri_environment", ColumnType.assetRef, {
      assetType: AssetTypeEnum.texture,
      defaultValue: ""
    }),
    column("lighting_hdri_intensity", "hdri_intensity", ColumnType.range, { defaultValue: 1, max: 8, min: 0, step: 0.01 }),
    column("lighting_hdri_rotation", "hdri_rotation_degrees", ColumnType.range, { defaultValue: 0, max: 360, min: -360, step: 0.1 }),
    column("lighting_sun_dir", "sun_direction", ColumnType.vector3, { defaultValue: [-0.42, 0.84, -0.34], max: 1, min: -1, step: 0.01 }),
    column("lighting_sun_color", "sun_color", ColumnType.color, { defaultValue: "#fff2db" }),
    column("lighting_sun_intensity", "sun_intensity", ColumnType.range, { defaultValue: 1.2, max: 16, min: 0, step: 0.01 }),
    column("lighting_ambient_sky", "ambient_sky_color", ColumnType.color, { defaultValue: "#9ea8b3" }),
    column("lighting_ambient_ground", "ambient_ground_color", ColumnType.color, { defaultValue: "#4d4a45" }),
    column("lighting_ambient_intensity", "ambient_intensity", ColumnType.range, { defaultValue: 0.42, max: 8, min: 0, step: 0.01 }),
    column("lighting_exposure", "exposure", ColumnType.range, { defaultValue: 1, max: 8, min: 0.001, step: 0.01 }),
    column("lighting_contrast", "contrast", ColumnType.range, { defaultValue: 1, max: 4, min: 0.001, step: 0.01 }),
    column("lighting_bloom_intensity", "bloom_intensity", ColumnType.range, { defaultValue: 0, max: 8, min: 0, step: 0.01 }),
    column("lighting_bloom_threshold", "bloom_threshold", ColumnType.range, { defaultValue: 1, max: 8, min: 0, step: 0.01 }),
    column("lighting_shadow_enabled", "shadow_enabled", ColumnType.boolean, { defaultValue: true }),
    column("lighting_shadow_resolution", "shadow_resolution", ColumnType.integer, { defaultValue: 2048, max: 4096, min: 256 }),
    column("lighting_shadow_distance", "shadow_distance", ColumnType.range, { defaultValue: 92, max: 512, min: 1, step: 1 }),
    column("lighting_shadow_strength", "shadow_strength", ColumnType.range, { defaultValue: 0.58, max: 1, min: 0, step: 0.01 }),
    column("lighting_shadow_depth_bias", "shadow_depth_bias", ColumnType.range, { defaultValue: 0.004, max: 0.05, min: 0, step: 0.0005 }),
    column("lighting_shadow_normal_bias", "shadow_normal_bias", ColumnType.range, { defaultValue: 0.02, max: 0.2, min: 0, step: 0.001 }),
    column("lighting_shadow_slope_bias", "shadow_slope_bias", ColumnType.range, { defaultValue: 1.5, max: 8, min: 0, step: 0.05 }),
    column("lighting_shadow_filter", "shadow_filter_radius", ColumnType.range, { defaultValue: 1, max: 8, min: 0, step: 0.05 }),
    column("lighting_reflection_enabled", "reflection_enabled", ColumnType.boolean, { defaultValue: true }),
    column("lighting_reflection_mode", "reflection_mode", ColumnType.enum, {
      defaultValue: "analytic_sky_ground",
      possibleValues: ["none", "analytic_sky_ground", "environment_map_reserved", "screen_space_reserved"]
    }),
    column("lighting_reflection_intensity", "reflection_intensity", ColumnType.range, { defaultValue: 0.32, max: 8, min: 0, step: 0.01 }),
    column("lighting_reflect_roughness", "reflection_roughness_influence", ColumnType.range, {
      defaultValue: 1,
      max: 4,
      min: 0,
      step: 0.01
    }),
    column("lighting_reflect_metallic", "reflection_metallic_influence", ColumnType.range, { defaultValue: 1, max: 4, min: 0, step: 0.01 }),
    column("lighting_reflect_horizon", "reflection_horizon_blend", ColumnType.range, { defaultValue: 0.5, max: 1, min: 0, step: 0.01 }),
    column("lighting_reflect_sky", "reflection_sky_color", ColumnType.color, { defaultValue: "#9ea8b3" }),
    column("lighting_reflect_ground", "reflection_ground_color", ColumnType.color, { defaultValue: "#4d4a45" })
  ],
  description: "Graphite lighting presets for one HDRI environment, one sun, and ambient sky/ground response.",
  id: RENDERER_LIGHTING_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.renderer",
  name: "Renderer Lighting",
  rows: [
    tableRow("row_lighting_neutral", [
      tableCell("lighting_name", ColumnType.string, "neutral_debug"),
      tableCell("lighting_hdri", ColumnType.assetRef, ""),
      tableCell("lighting_hdri_intensity", ColumnType.range, 1),
      tableCell("lighting_hdri_rotation", ColumnType.range, 0),
      tableCell("lighting_sun_dir", ColumnType.vector3, [-0.42, 0.84, -0.34]),
      tableCell("lighting_sun_color", ColumnType.color, "#fff2db"),
      tableCell("lighting_sun_intensity", ColumnType.range, 1.2),
      tableCell("lighting_ambient_sky", ColumnType.color, "#9ea8b3"),
      tableCell("lighting_ambient_ground", ColumnType.color, "#4d4a45"),
      tableCell("lighting_ambient_intensity", ColumnType.range, 0.42),
      tableCell("lighting_exposure", ColumnType.range, 1),
      tableCell("lighting_contrast", ColumnType.range, 1),
      tableCell("lighting_bloom_intensity", ColumnType.range, 0),
      tableCell("lighting_bloom_threshold", ColumnType.range, 1),
      tableCell("lighting_shadow_enabled", ColumnType.boolean, true),
      tableCell("lighting_shadow_resolution", ColumnType.integer, 2048),
      tableCell("lighting_shadow_distance", ColumnType.range, 92),
      tableCell("lighting_shadow_strength", ColumnType.range, 0.58),
      tableCell("lighting_shadow_depth_bias", ColumnType.range, 0.004),
      tableCell("lighting_shadow_normal_bias", ColumnType.range, 0.02),
      tableCell("lighting_shadow_slope_bias", ColumnType.range, 1.5),
      tableCell("lighting_shadow_filter", ColumnType.range, 1),
      tableCell("lighting_reflection_enabled", ColumnType.boolean, true),
      tableCell("lighting_reflection_mode", ColumnType.enum, "analytic_sky_ground"),
      tableCell("lighting_reflection_intensity", ColumnType.range, 0.32),
      tableCell("lighting_reflect_roughness", ColumnType.range, 1),
      tableCell("lighting_reflect_metallic", ColumnType.range, 1),
      tableCell("lighting_reflect_horizon", ColumnType.range, 0.5),
      tableCell("lighting_reflect_sky", ColumnType.color, "#9ea8b3"),
      tableCell("lighting_reflect_ground", ColumnType.color, "#4d4a45")
    ])
  ],
  version: 1
} satisfies SystemDataTable;

export const RENDERER_MATERIALS_TABLE = {
  columns: [
    column("materials_name", "name", ColumnType.string, { defaultValue: "debug_default", maxChars: 64, unique: true }),
    column("materials_base_color", "base_color", ColumnType.color, { defaultValue: "#8c8c8c" }),
    column("materials_roughness", "roughness", ColumnType.range, { defaultValue: 0.55, max: 1, min: 0.02, step: 0.01 }),
    column("materials_metallic", "metallic", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("materials_emissive_color", "emissive_color", ColumnType.color, { defaultValue: "#ffffff" }),
    column("materials_emissive_strength", "emissive_strength", ColumnType.range, { defaultValue: 0, max: 32, min: 0, step: 0.05 }),
    column("materials_normal_strength", "normal_strength", ColumnType.range, { defaultValue: 1, max: 4, min: 0, step: 0.01 }),
    column("materials_specular", "specular_intensity", ColumnType.range, { defaultValue: 0.5, max: 4, min: 0, step: 0.01 }),
    column("materials_alpha_cutoff", "alpha_cutoff", ColumnType.range, { defaultValue: 0.5, max: 1, min: 0, step: 0.01 }),
    column("materials_flags", "flags", ColumnType.enumArray, {
      defaultValue: ["cast_shadows", "receive_shadows"],
      possibleValues: ["double_sided", "cast_shadows", "receive_shadows", "unlit", "emissive_only"]
    }),
    column("materials_alpha_mode", "alpha_mode", ColumnType.enum, {
      defaultValue: "opaque",
      possibleValues: ["opaque", "cutout", "blend_reserved"]
    })
  ],
  description: "Graphite PBR-lite material presets matching GHMaterialParams.",
  id: RENDERER_MATERIALS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.renderer",
  name: "Renderer Materials",
  rows: [
    tableRow("row_material_debug", [
      tableCell("materials_name", ColumnType.string, "debug_default"),
      tableCell("materials_base_color", ColumnType.color, "#8c8c8c"),
      tableCell("materials_roughness", ColumnType.range, 0.55),
      tableCell("materials_metallic", ColumnType.range, 0),
      tableCell("materials_emissive_color", ColumnType.color, "#ffffff"),
      tableCell("materials_emissive_strength", ColumnType.range, 0),
      tableCell("materials_normal_strength", ColumnType.range, 1),
      tableCell("materials_specular", ColumnType.range, 0.5),
      tableCell("materials_alpha_cutoff", ColumnType.range, 0.5),
      tableCell("materials_flags", ColumnType.enumArray, ["cast_shadows", "receive_shadows"]),
      tableCell("materials_alpha_mode", ColumnType.enum, "opaque")
    ])
  ],
  version: 1
} satisfies SystemDataTable;

export const INPUT_BINDINGS_TABLE = {
  columns: [
    column("input_sort_order", "sort_order", ColumnType.integer, { defaultValue: 0, min: 0 }),
    column("input_action", "action", ColumnType.string, { maxChars: 96, unique: true }),
    column("input_bindings", "bindings", ColumnType.enumArray, {
      defaultValue: [],
      max: 8,
      possibleValues: Object.values(InputKeyEnum)
    })
  ],
  description: "Graphite input bindings exported to assets/config/input.json.",
  id: INPUT_BINDINGS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.input",
  name: "Input Bindings",
  rows: [
    tableRow("row_input_00", [
      tableCell("input_sort_order", ColumnType.integer, 0),
      tableCell("input_action", ColumnType.string, "debug_toggle"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.F1])
    ]),
    tableRow("row_input_01", [
      tableCell("input_sort_order", ColumnType.integer, 1),
      tableCell("input_action", ColumnType.string, "quit"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.Escape])
    ]),
    tableRow("row_input_02", [
      tableCell("input_sort_order", ColumnType.integer, 2),
      tableCell("input_action", ColumnType.string, "camera_zoom_in"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.WheelUp])
    ]),
    tableRow("row_input_03", [
      tableCell("input_sort_order", ColumnType.integer, 3),
      tableCell("input_action", ColumnType.string, "camera_zoom_out"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.WheelDown])
    ]),
    tableRow("row_input_04", [
      tableCell("input_sort_order", ColumnType.integer, 4),
      tableCell("input_action", ColumnType.string, "camera_pan_left"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.A, InputKeyEnum.Left])
    ]),
    tableRow("row_input_05", [
      tableCell("input_sort_order", ColumnType.integer, 5),
      tableCell("input_action", ColumnType.string, "camera_pan_right"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.D, InputKeyEnum.Right])
    ]),
    tableRow("row_input_06", [
      tableCell("input_sort_order", ColumnType.integer, 6),
      tableCell("input_action", ColumnType.string, "camera_pan_up"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.W, InputKeyEnum.Up])
    ]),
    tableRow("row_input_07", [
      tableCell("input_sort_order", ColumnType.integer, 7),
      tableCell("input_action", ColumnType.string, "camera_pan_down"),
      tableCell("input_bindings", ColumnType.enumArray, [InputKeyEnum.S, InputKeyEnum.Down])
    ])
  ],
  version: 1
} satisfies SystemDataTable;

export const LEVEL_RECIPES_TABLE = {
  columns: [
    column("levels_name", "name", ColumnType.string, { defaultValue: "new_level", maxChars: 96, unique: true }),
    column("levels_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("levels_biome", "biome", ColumnType.ref, { defaultValue: "" }),
    column("levels_terrain_seed", "terrain_seed", ColumnType.integer, { defaultValue: 1, min: 0 }),
    column("levels_chunk_count", "chunk_count", ColumnType.vector2, { defaultValue: [24, 24], min: 1, step: 1 }),
    column("levels_chunk_size", "chunk_world_size", ColumnType.range, { defaultValue: 128, max: 512, min: 1, step: 1 }),
    column("levels_lighting", "lighting_preset", ColumnType.ref, { defaultValue: "neutral_debug" }),
    column("levels_weather", "weather_preset", ColumnType.ref, { defaultValue: "" }),
    column("levels_foliage", "foliage_rule_set", ColumnType.ref, { defaultValue: "", required: false }),
    column("levels_stamp_passes", "stamp_pass_set", ColumnType.ref, { defaultValue: "", required: false }),
    column("levels_prefabs", "prefab_set", ColumnType.ref, { defaultValue: "", required: false }),
    column("levels_validation", "validation_profile", ColumnType.enum, {
      defaultValue: "draft",
      possibleValues: ["draft", "vertical_slice", "shipping"]
    }),
    column("levels_notes", "notes", ColumnType.text, { defaultValue: "", maxChars: 4096, required: false })
  ],
  description: "Graphite level recipes composed by Chisel from biome, lighting, weather, foliage, stamp passes, and prefab placements.",
  id: LEVEL_RECIPES_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.levels",
  name: "Level Recipes",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMPS_TABLE = {
  columns: [
    column("stamp_key", "key", ColumnType.string, { defaultValue: "new_stamp", maxChars: 96, unique: true }),
    column("stamp_name", "name", ColumnType.string, { defaultValue: "New Stamp", maxChars: 128 }),
    column("stamp_description", "description", ColumnType.text, { defaultValue: "", maxChars: 4096, required: false }),
    column("stamp_kind", "stamp_kind", ColumnType.enum, {
      defaultValue: "terrain",
      possibleValues: ["terrain", "prefab"]
    }),
    column("stamp_cell_size", "cell_size_meters", ColumnType.range, { defaultValue: 2, max: 8, min: 0.25, step: 0.25 }),
    column("stamp_editable_size", "editable_size_cells", ColumnType.vector2, { defaultValue: [12, 12], min: 1, step: 1 }),
    column("stamp_default_biome", "default_biome", ColumnType.ref, { defaultValue: "", required: false }),
    column("stamp_can_rotate", "can_rotate", ColumnType.boolean, { defaultValue: false }),
    column("stamp_notes", "notes", ColumnType.text, { defaultValue: "", maxChars: 4096, required: false })
  ],
  description: "Root Graphite stamp records. Specialized editors must persist stamp data through this table and related stamp part tables.",
  id: STAMPS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamps",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_MASKS_TABLE = {
  columns: [
    column("stamp_mask_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_mask_key", "key", ColumnType.string, { defaultValue: "footprint", maxChars: 96 }),
    column("stamp_mask_kind", "kind", ColumnType.enum, {
      defaultValue: "footprint",
      possibleValues: ["footprint", "blocking", "foliage"]
    }),
    column("stamp_mask_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("stamp_mask_value", "mask", ColumnType.cellMask, {
      defaultValue: {
        cellSizeMeters: 2,
        cells: [],
        height: 12,
        width: 12
      }
    }),
    column("stamp_mask_blockers", "blocker_mask", ColumnType.enumArray, {
      defaultValue: [],
      possibleValues: blockerMaskValues
    }),
    column("stamp_mask_weight", "weight", ColumnType.range, { defaultValue: 1, max: 1, min: 0, step: 0.01 }),
    column("stamp_mask_cost", "traversal_cost_delta", ColumnType.range, { defaultValue: 0, max: 64, min: -64, step: 0.01 })
  ],
  description:
    "Painted Graphite stamp masks. Footprint bounds all other stamp layers; blocking and foliage masks reference cells inside it.",
  id: STAMP_MASKS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Masks",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_HEIGHT_FIELDS_TABLE = {
  columns: [
    column("stamp_height_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_height_key", "key", ColumnType.string, { defaultValue: "height_field", maxChars: 96 }),
    column("stamp_height_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("stamp_height_blend", "blend_mode", ColumnType.enum, {
      defaultValue: "add",
      possibleValues: ["add", "replace"]
    }),
    column("stamp_height_mask", "influence_mask", ColumnType.stampMaskRef, { defaultValue: "footprint" }),
    column("stamp_height_pivot", "pivot_meters", ColumnType.vector2, { defaultValue: [12, 12], min: 0, step: 0.25 }),
    column("stamp_height_field", "field", ColumnType.heightField, {
      defaultValue: {
        cellSizeMeters: 2,
        cornerHeight: 13,
        cornerWidth: 13,
        height: 12,
        values: Array.from({ length: 169 }, () => 0),
        width: 12
      }
    })
  ],
  description: "Per-stamp corner height fields used for terrain deformation and derived 2D simulation height sampling.",
  id: STAMP_HEIGHT_FIELDS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Height Fields",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_OVERLAYS_TABLE = {
  columns: [
    column("stamp_overlay_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_overlay_key", "key", ColumnType.string, { defaultValue: "overlay_0", maxChars: 96 }),
    column("stamp_overlay_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("stamp_overlay_enabled", "enabled", ColumnType.boolean, { defaultValue: false }),
    column("stamp_overlay_mask", "mask", ColumnType.stampMaskRef, { defaultValue: "footprint" }),
    column("stamp_overlay_algorithm", "algorithm", ColumnType.enum, {
      defaultValue: "height_patch_blend",
      possibleValues: ["height_patch_blend"]
    }),
    column("stamp_overlay_seed", "seed", ColumnType.integer, { defaultValue: 11, min: 0 }),
    column("stamp_overlay_bleed", "bleed", ColumnType.range, { defaultValue: 0.25, max: 8, min: 0, step: 0.05 }),
    column("stamp_overlay_texscale", "texture_scale", ColumnType.range, { defaultValue: 0.25, max: 2, min: 0.02, step: 0.01 }),
    column("stamp_overlay_patchscale", "patch_scale", ColumnType.range, { defaultValue: 0.18, max: 2, min: 0.01, step: 0.01 }),
    column("stamp_overlay_hsharp", "height_sharpness", ColumnType.range, { defaultValue: 4, max: 12, min: 0, step: 0.1 }),
    column("stamp_overlay_hblend", "height_blend_width", ColumnType.range, { defaultValue: 0.12, max: 1, min: 0.005, step: 0.005 }),
    column("stamp_overlay_edge_jitter", "edge_jitter", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("stamp_overlay_ebreak", "edge_breakup", ColumnType.range, { defaultValue: 0.45, max: 1, min: 0, step: 0.01 }),
    column("stamp_overlay_opacity", "opacity", ColumnType.range, { defaultValue: 1, max: 1, min: 0, step: 0.01 }),
    column("stamp_overlay_wetbias", "wetness_bias", ColumnType.range, { defaultValue: 0, max: 1, min: -1, step: 0.01 }),
    column("stamp_overlay_roughness_bias", "roughness_bias", ColumnType.range, { defaultValue: 0, max: 1, min: -1, step: 0.01 })
  ],
  description: "Reversible per-stamp procedural terrain overlays. These do not mutate terrain splats, simulation surfaces, or mesh data.",
  id: STAMP_OVERLAYS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Terrain Overlays",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_OVERLAY_LAYERS_TABLE = {
  columns: [
    column("stamp_ovl_layer_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_ovl_layer_ovlay", "overlay", ColumnType.ref, { defaultValue: "overlay_0" }),
    column("stamp_ovl_layer_textr", "terrain_texture", ColumnType.assetRef, {
      assetType: AssetTypeEnum.terrainTexture,
      defaultValue: ""
    }),
    column("stamp_ovl_layer_wght0", "weight", ColumnType.range, { defaultValue: 1, max: 1, min: 0, step: 0.01 }),
    column("stamp_ovl_layer_scale", "texture_scale", ColumnType.vector2, { defaultValue: [1, 1], min: 0.0001, step: 0.01 }),
    column("stamp_ovl_layer_offst", "texture_offset", ColumnType.vector2, { defaultValue: [0, 0], step: 0.01 }),
    column("stamp_ovl_layer_rotat", "texture_rotation", ColumnType.range, { defaultValue: 0, max: 180, min: -180, step: 1 }),
    column("stamp_ovl_layer_hght0", "height_influence", ColumnType.range, { defaultValue: 1, max: 4, min: 0, step: 0.01 }),
    column("stamp_ovl_layer_tint0", "albedo_tint", ColumnType.color, { defaultValue: "#ffffff" }),
    column("stamp_ovl_layer_tstr0", "albedo_tint_strength", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("stamp_ovl_layer_sat00", "albedo_saturation", ColumnType.range, { defaultValue: 1, max: 2, min: 0, step: 0.01 }),
    column("stamp_ovl_layer_order", "order", ColumnType.integer, { defaultValue: 0, min: 0 })
  ],
  description: "Terrain Texture layers mixed by a stamp terrain overlay. V1 is procedural-only and capped by the renderer budget.",
  id: STAMP_OVERLAY_LAYERS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Overlay Layers",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_PREFABS_TABLE = {
  columns: [
    column("stamp_prefab_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_prefab_key", "key", ColumnType.string, { defaultValue: "prefab", maxChars: 96 }),
    column("stamp_prefab_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("stamp_prefab_asset", "asset", ColumnType.assetRef, {
      assetType: AssetTypeEnum.other,
      defaultValue: "",
      required: false
    }),
    column("stamp_prefab_transform", "local_transform", ColumnType.transform3, {
      defaultValue: {
        position: [0, 0, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1]
      }
    }),
    column("stamp_prefab_snap", "terrain_snap", ColumnType.enum, {
      defaultValue: "lowest_vertex",
      possibleValues: ["none", "origin", "lowest_vertex", "bounds_center"]
    }),
    column("stamp_prefab_cast_shadows", "cast_shadows", ColumnType.boolean, { defaultValue: true }),
    column("stamp_prefab_visible", "visible_in_preview", ColumnType.boolean, { defaultValue: true })
  ],
  description: 'Named prefab asset refs inside a stamp. Export/runtime builds lookup maps such as stamp.prefabs.get("house1").',
  id: STAMP_PREFABS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Prefabs",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const STAMP_MARKERS_TABLE = {
  columns: [
    column("stamp_marker_stamp", "stamp", ColumnType.ref, { defaultValue: "" }),
    column("stamp_marker_key", "key", ColumnType.string, { defaultValue: "marker", maxChars: 96 }),
    column("stamp_marker_description", "description", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false }),
    column("stamp_marker_kind", "kind", ColumnType.string, { defaultValue: "anchor", maxChars: 96 }),
    column("stamp_marker_transform", "local_transform", ColumnType.transform3, {
      defaultValue: {
        position: [0, 0, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1]
      }
    }),
    column("stamp_marker_radius", "radius", ColumnType.range, { defaultValue: 1, max: 512, min: 0, step: 0.1 }),
    column("stamp_marker_visible", "visible_in_preview", ColumnType.boolean, { defaultValue: true })
  ],
  description: "Named marker transforms inside a stamp. PVZ binds gameplay semantics to marker keys and kinds.",
  id: STAMP_MARKERS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.stamps",
  name: "Stamp Markers",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const FOLIAGE_SPECIES_TABLE = {
  columns: [
    column("foliage_species_name", "name", ColumnType.string, { defaultValue: "new_foliage_species", maxChars: 96, unique: true }),
    column("foliage_species_repr", "representation", ColumnType.enum, {
      defaultValue: "card_texture",
      possibleValues: ["card_texture", "mesh"]
    }),
    column("foliage_species_texture", "card_texture_asset", ColumnType.assetRef, {
      assetType: AssetTypeEnum.texture,
      defaultValue: "",
      required: false
    }),
    column("foliage_species_mesh", "mesh_asset", ColumnType.assetRef, {
      assetType: AssetTypeEnum.other,
      defaultValue: "",
      required: false
    }),
    column("foliage_species_tint", "preview_tint", ColumnType.color, { defaultValue: "#ffffff" }),
    column("foliage_species_tint_var", "tint_variation", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("foliage_species_alpha", "alpha_cutoff", ColumnType.range, { defaultValue: 0.5, max: 1, min: 0, step: 0.01 }),
    column("foliage_species_wind", "wind_response", ColumnType.range, { defaultValue: 0.5, max: 4, min: 0, step: 0.01 }),
    column("foliage_species_notes", "notes", ColumnType.text, { defaultValue: "", maxChars: 2048, required: false })
  ],
  description: "Graphite foliage species definitions for card-texture or mesh foliage previews and scatter rules.",
  id: FOLIAGE_SPECIES_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.levels",
  name: "Foliage Species",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const FOLIAGE_RULES_TABLE = {
  columns: [
    column("foliage_name", "name", ColumnType.string, { defaultValue: "new_foliage_rule", maxChars: 96, unique: true }),
    column("foliage_biome", "biome", ColumnType.ref, { defaultValue: "", required: false }),
    column("foliage_species", "species", ColumnType.ref, { defaultValue: "" }),
    column("foliage_surfaces", "surface_filters", ColumnType.enumArray, {
      defaultValue: ["grass"],
      possibleValues: terrainSurfaceValues
    }),
    column("foliage_density", "density", ColumnType.range, { defaultValue: 0.35, max: 10, min: 0, step: 0.01 }),
    column("foliage_spacing", "min_spacing", ColumnType.range, { defaultValue: 2, max: 128, min: 0, step: 0.1 }),
    column("foliage_scale_min", "scale_min", ColumnType.range, { defaultValue: 0.8, max: 16, min: 0.01, step: 0.01 }),
    column("foliage_scale_max", "scale_max", ColumnType.range, { defaultValue: 1.4, max: 16, min: 0.01, step: 0.01 }),
    column("foliage_slope_min", "slope_min", ColumnType.range, { defaultValue: 0, max: 90, min: 0, step: 0.1 }),
    column("foliage_slope_max", "slope_max", ColumnType.range, { defaultValue: 35, max: 90, min: 0, step: 0.1 }),
    column("foliage_relation", "relation_mode", ColumnType.enum, {
      defaultValue: "none",
      possibleValues: ["none", "near_foliage_species", "near_prefab_marker", "near_stamp", "away_from_stamp"]
    }),
    column("foliage_relation_target", "relation_target", ColumnType.ref, { defaultValue: "", required: false }),
    column("foliage_relation_radius", "relation_radius", ColumnType.range, { defaultValue: 0, max: 512, min: 0, step: 0.1 }),
    column("foliage_relation_strength", "relation_strength", ColumnType.range, { defaultValue: 1, max: 8, min: 0, step: 0.01 }),
    column("foliage_wind", "wind_strength", ColumnType.range, { defaultValue: 0.2, max: 4, min: 0, step: 0.01 }),
    column("foliage_seed", "seed", ColumnType.integer, { defaultValue: 1, min: 0 })
  ],
  description: "Graphite foliage scatter rules used by biome and level recipes.",
  id: FOLIAGE_RULES_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.levels",
  name: "Foliage Rules",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const WEATHER_PRESETS_TABLE = {
  columns: [
    column("weather_name", "name", ColumnType.string, { defaultValue: "clear", maxChars: 96, unique: true }),
    column("weather_type", "weather_type", ColumnType.enum, {
      defaultValue: "clear",
      possibleValues: ["clear", "overcast", "rain", "ash", "snow", "fog", "storm"]
    }),
    column("weather_fog_color", "fog_color", ColumnType.color, { defaultValue: "#8b8b86" }),
    column("weather_fog_density", "fog_density", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.001 }),
    column("weather_rain", "rain_intensity", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("weather_ash", "ash_intensity", ColumnType.range, { defaultValue: 0, max: 1, min: 0, step: 0.01 }),
    column("weather_wetness", "wetness_multiplier", ColumnType.range, { defaultValue: 0, max: 4, min: 0, step: 0.01 }),
    column("weather_wind_dir", "wind_direction", ColumnType.vector2, { defaultValue: [1, 0], min: -1, max: 1, step: 0.01 }),
    column("weather_wind_strength", "wind_strength", ColumnType.range, { defaultValue: 0.2, max: 8, min: 0, step: 0.01 })
  ],
  description: "Graphite weather presets referenced by level recipes.",
  id: WEATHER_PRESETS_TABLE_ID,
  isSystemTable: true,
  kind: "system",
  lastChangeAt: SYSTEM_TABLE_TIMESTAMP,
  moduleId: "graphite.levels",
  name: "Weather Presets",
  rows: [],
  version: 1
} satisfies SystemDataTable;

export const SYSTEM_TERRAIN_TABLES = [TERRAIN_BIOMES_TABLE, TERRAIN_VARIANTS_TABLE];
export const SYSTEM_RENDERER_TABLES = [RENDERER_LIGHTING_TABLE, RENDERER_MATERIALS_TABLE];
export const SYSTEM_INPUT_TABLES = [INPUT_BINDINGS_TABLE];
export const SYSTEM_LEVEL_TABLES = [
  LEVEL_RECIPES_TABLE,
  STAMPS_TABLE,
  STAMP_MASKS_TABLE,
  STAMP_OVERLAYS_TABLE,
  STAMP_OVERLAY_LAYERS_TABLE,
  STAMP_HEIGHT_FIELDS_TABLE,
  STAMP_PREFABS_TABLE,
  STAMP_MARKERS_TABLE,
  FOLIAGE_SPECIES_TABLE,
  FOLIAGE_RULES_TABLE,
  WEATHER_PRESETS_TABLE
];
export const SYSTEM_TABLES = [...SYSTEM_TERRAIN_TABLES, ...SYSTEM_LEVEL_TABLES, ...SYSTEM_RENDERER_TABLES, ...SYSTEM_INPUT_TABLES];
