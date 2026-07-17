import { describe, expect, it } from "vitest";
import { anyDataTableSchema, type DataTableRow, type SystemDataTable } from "../../shared/schemas";
import { ColumnType } from "../../shared/types";
import {
  FOLIAGE_SPECIES_TABLE,
  FOLIAGE_RULES_TABLE,
  INPUT_BINDINGS_TABLE,
  LEVEL_RECIPES_TABLE,
  RENDERER_LIGHTING_TABLE,
  RENDERER_MATERIALS_TABLE,
  STAMP_HEIGHT_FIELDS_TABLE,
  STAMP_MARKERS_TABLE,
  STAMP_MASKS_TABLE,
  STAMP_OVERLAY_LAYERS_TABLE,
  STAMP_OVERLAYS_TABLE,
  STAMP_PREFABS_TABLE,
  STAMPS_TABLE,
  SYSTEM_TABLES,
  TERRAIN_BIOMES_TABLE,
  TERRAIN_VARIANTS_TABLE,
  WEATHER_PRESETS_TABLE
} from "./system-tables";

function columnNames(table: SystemDataTable): string[] {
  return table.columns.map((column) => column.name);
}

function rowValue(table: SystemDataTable, row: DataTableRow, columnName: string): unknown {
  const column = table.columns.find((entry) => entry.name === columnName);
  expect(column).toBeDefined();
  return row.values.find((entry) => entry.columnId === column?.id)?.value;
}

function columnType(table: SystemDataTable, columnName: string): ColumnType | undefined {
  return table.columns.find((entry) => entry.name === columnName)?.type;
}

describe("Graphite system tables", () => {
  it("remain valid data tables", () => {
    for (const table of SYSTEM_TABLES) {
      expect(() => anyDataTableSchema.parse(table)).not.toThrow();
      expect(table.isSystemTable).toBe(true);
      expect(table.columns.length).toBeGreaterThan(0);
    }
  });

  it("models the current terrain biome runtime fields", () => {
    expect(columnNames(TERRAIN_BIOMES_TABLE)).toEqual(
      expect.arrayContaining([
        "environment",
        "variant_count",
        "sampling_mode",
        "uv_scale",
        "sampling_scale",
        "sampling_offset_scale",
        "height_blend_width",
        "sampling_blend_width",
        "macro_scale",
        "macro_strength",
        "macro_tint_strength",
        "zone_seed",
        "zone_noise_scale",
        "zone_contrast",
        "zone_blend_width",
        "zone_edge_breakup"
      ])
    );
    expect(columnNames(TERRAIN_VARIANTS_TABLE)).toEqual(
      expect.arrayContaining([
        "terrain_texture",
        "texture_scale",
        "texture_offset",
        "albedo_multiplier",
        "albedo_tint",
        "albedo_tint_strength",
        "albedo_saturation",
        "normal_strength",
        "roughness_multiplier",
        "wetness",
        "height_blend_strength",
        "zone_start",
        "zone_end",
        "zone_weight"
      ])
    );
    expect(columnNames(TERRAIN_BIOMES_TABLE)).not.toContain("terrain_shader_mode");
    expect(columnNames(TERRAIN_BIOMES_TABLE)).not.toContain("max_blend_layers");
    expect(columnNames(TERRAIN_BIOMES_TABLE)).not.toContain("min_layer_weight");
    expect(columnNames(TERRAIN_BIOMES_TABLE)).not.toContain("mask_hardness");
    expect(columnNames(TERRAIN_BIOMES_TABLE)).not.toContain("edge_blend_width");
    expect(TERRAIN_BIOMES_TABLE.columns.find((column) => column.name === "variant_count")?.max).toBe(16);
    expect(TERRAIN_VARIANTS_TABLE.columns.find((column) => column.name === "id")?.max).toBe(15);
    expect(TERRAIN_VARIANTS_TABLE.columns.find((column) => column.name === "texture_scale")?.max).toBe(50);
  });

  it("models the cleaned renderer lighting and material contracts", () => {
    expect(columnNames(RENDERER_LIGHTING_TABLE)).toEqual(
      expect.arrayContaining([
        "sun_direction",
        "sun_color",
        "sun_intensity",
        "hdri_environment",
        "hdri_intensity",
        "ambient_sky_color",
        "shadow_enabled",
        "shadow_depth_bias",
        "reflection_enabled",
        "reflection_mode",
        "reflection_intensity"
      ])
    );
    expect(columnNames(RENDERER_MATERIALS_TABLE)).toEqual(
      expect.arrayContaining([
        "base_color",
        "roughness",
        "metallic",
        "emissive_color",
        "emissive_strength",
        "normal_strength",
        "specular_intensity",
        "alpha_mode"
      ])
    );
    expect(columnType(RENDERER_LIGHTING_TABLE, "sun_color")).toBe(ColumnType.color);
    expect(columnType(RENDERER_LIGHTING_TABLE, "hdri_environment")).toBe(ColumnType.assetRef);
    expect(columnType(RENDERER_LIGHTING_TABLE, "ambient_sky_color")).toBe(ColumnType.color);
    expect(columnType(RENDERER_LIGHTING_TABLE, "ambient_ground_color")).toBe(ColumnType.color);
    expect(columnType(RENDERER_LIGHTING_TABLE, "reflection_sky_color")).toBe(ColumnType.color);
    expect(columnType(RENDERER_LIGHTING_TABLE, "reflection_ground_color")).toBe(ColumnType.color);
    expect(columnNames(RENDERER_MATERIALS_TABLE)).not.toContain("emissive");
  });

  it("seeds input actions from the JSON-driven PVZ runtime defaults", () => {
    const actionNames = INPUT_BINDINGS_TABLE.rows.map((row) => rowValue(INPUT_BINDINGS_TABLE, row, "action"));
    expect(actionNames).toEqual([
      "debug_toggle",
      "quit",
      "camera_zoom_in",
      "camera_zoom_out",
      "camera_pan_left",
      "camera_pan_right",
      "camera_pan_up",
      "camera_pan_down"
    ]);
    expect(rowValue(INPUT_BINDINGS_TABLE, INPUT_BINDINGS_TABLE.rows[2], "bindings")).toEqual(["WheelUp"]);
    expect(rowValue(INPUT_BINDINGS_TABLE, INPUT_BINDINGS_TABLE.rows[4], "bindings")).toEqual(["A", "Left"]);
    expect(INPUT_BINDINGS_TABLE.columns.find((column) => column.name === "bindings")?.type).toBe(ColumnType.enumArray);
  });

  it("models level, stamp, prefab, foliage, and weather authoring tables", () => {
    expect(SYSTEM_TABLES).toEqual(
      expect.arrayContaining([
        LEVEL_RECIPES_TABLE,
        STAMPS_TABLE,
        STAMP_MASKS_TABLE,
        STAMP_OVERLAYS_TABLE,
        STAMP_OVERLAY_LAYERS_TABLE,
        STAMP_PREFABS_TABLE,
        STAMP_MARKERS_TABLE,
        STAMP_HEIGHT_FIELDS_TABLE,
        FOLIAGE_SPECIES_TABLE,
        FOLIAGE_RULES_TABLE,
        WEATHER_PRESETS_TABLE
      ])
    );
    expect(columnNames(LEVEL_RECIPES_TABLE)).toEqual(
      expect.arrayContaining([
        "biome",
        "lighting_preset",
        "weather_preset",
        "foliage_rule_set",
        "stamp_pass_set",
        "prefab_set",
        "validation_profile"
      ])
    );
    expect(columnNames(STAMPS_TABLE)).toEqual(
      expect.arrayContaining([
        "key",
        "name",
        "description",
        "stamp_kind",
        "cell_size_meters",
        "editable_size_cells",
        "default_biome",
        "can_rotate"
      ])
    );
    expect(columnNames(STAMP_MASKS_TABLE)).toEqual(
      expect.arrayContaining(["stamp", "key", "kind", "description", "mask", "blocker_mask", "weight", "traversal_cost_delta"])
    );
    expect(columnNames(STAMP_OVERLAYS_TABLE)).toEqual(
      expect.arrayContaining([
        "stamp",
        "key",
        "mask",
        "enabled",
        "algorithm",
        "seed",
        "bleed",
        "texture_scale",
        "patch_scale",
        "height_sharpness",
        "height_blend_width",
        "edge_jitter",
        "edge_breakup",
        "opacity",
        "wetness_bias",
        "roughness_bias"
      ])
    );
    expect(columnNames(STAMP_OVERLAY_LAYERS_TABLE)).toEqual(
      expect.arrayContaining([
        "stamp",
        "overlay",
        "terrain_texture",
        "weight",
        "texture_scale",
        "texture_offset",
        "texture_rotation",
        "height_influence",
        "albedo_tint",
        "albedo_tint_strength",
        "albedo_saturation",
        "order"
      ])
    );
    expect(columnNames(STAMP_PREFABS_TABLE)).toEqual(
      expect.arrayContaining(["stamp", "key", "asset", "local_transform", "terrain_snap", "visible_in_preview"])
    );
    expect(columnNames(STAMP_MARKERS_TABLE)).toEqual(
      expect.arrayContaining(["stamp", "key", "kind", "local_transform", "radius", "visible_in_preview"])
    );
    expect(columnNames(STAMP_HEIGHT_FIELDS_TABLE)).toEqual(
      expect.arrayContaining(["stamp", "key", "description", "blend_mode", "influence_mask", "pivot_meters", "field"])
    );
    expect(columnNames(FOLIAGE_SPECIES_TABLE)).toEqual(
      expect.arrayContaining(["representation", "card_texture_asset", "mesh_asset", "preview_tint", "tint_variation", "alpha_cutoff"])
    );
    expect(columnNames(FOLIAGE_RULES_TABLE)).toEqual(
      expect.arrayContaining([
        "species",
        "surface_filters",
        "density",
        "min_spacing",
        "scale_min",
        "scale_max",
        "relation_mode",
        "relation_radius"
      ])
    );
    expect(columnNames(WEATHER_PRESETS_TABLE)).toEqual(
      expect.arrayContaining(["weather_type", "fog_density", "rain_intensity", "wetness_multiplier", "wind_direction"])
    );
    expect(SYSTEM_TABLES.map((table) => table.id)).not.toEqual(expect.arrayContaining(["graphite_objectives", "graphite_resource_nodes"]));
    expect(SYSTEM_TABLES.map((table) => table.id)).not.toEqual(expect.arrayContaining(["graphite_stamp_terrain_layers"]));
    expect(columnType(STAMP_MASKS_TABLE, "mask")).toBe(ColumnType.cellMask);
    expect(columnType(TERRAIN_VARIANTS_TABLE, "terrain_texture")).toBe(ColumnType.assetRef);
    expect(columnType(STAMP_OVERLAYS_TABLE, "mask")).toBe(ColumnType.stampMaskRef);
    expect(columnType(STAMP_OVERLAY_LAYERS_TABLE, "terrain_texture")).toBe(ColumnType.assetRef);
    expect(columnType(STAMP_PREFABS_TABLE, "local_transform")).toBe(ColumnType.transform3);
    expect(columnType(STAMP_MARKERS_TABLE, "local_transform")).toBe(ColumnType.transform3);
    expect(columnType(STAMP_HEIGHT_FIELDS_TABLE, "field")).toBe(ColumnType.heightField);
    expect(columnType(FOLIAGE_SPECIES_TABLE, "preview_tint")).toBe(ColumnType.color);
    expect(columnType(WEATHER_PRESETS_TABLE, "fog_color")).toBe(ColumnType.color);
  });

  it("keeps new authored level content empty until Chisel writes rows", () => {
    expect(LEVEL_RECIPES_TABLE.rows).toEqual([]);
    expect(STAMPS_TABLE.rows).toEqual([]);
    expect(STAMP_MASKS_TABLE.rows).toEqual([]);
    expect(STAMP_OVERLAYS_TABLE.rows).toEqual([]);
    expect(STAMP_OVERLAY_LAYERS_TABLE.rows).toEqual([]);
    expect(STAMP_PREFABS_TABLE.rows).toEqual([]);
    expect(STAMP_MARKERS_TABLE.rows).toEqual([]);
    expect(STAMP_HEIGHT_FIELDS_TABLE.rows).toEqual([]);
    expect(FOLIAGE_SPECIES_TABLE.rows).toEqual([]);
    expect(FOLIAGE_RULES_TABLE.rows).toEqual([]);
    expect(WEATHER_PRESETS_TABLE.rows).toEqual([]);
  });
});
