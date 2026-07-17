import { TERRAIN_BIOMES_TABLE, TERRAIN_VARIANTS_TABLE } from "@/constants/system-tables";
import type { Asset, GraphitePreviewTerrainBiomeConfig, GraphitePreviewTerrainSamplingMode } from "../../shared/types";
import type { DataTableRow, SystemDataTable } from "../../shared/schemas";

export interface BuildTerrainBiomePreviewConfigInput {
  assets: Asset[];
  biomeKey: string;
  biomeRows: DataTableRow[];
  variantRows: DataTableRow[];
}

function cloneDefaultValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (value && typeof value === "object") {
    return { ...value };
  }
  return value;
}

function valueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): unknown {
  const column = table.columns.find((entry) => entry.name === name);
  if (!column) {
    return "";
  }
  const value = row?.values.find((entry) => entry.columnId === column.id)?.value;
  if (value === undefined || value === null) {
    return cloneDefaultValue(column.defaultValue);
  }
  return value;
}

function textValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): string {
  const value = valueByName(table, row, name);
  if (typeof value === "string") {
    return value;
  }
  return `${value ?? ""}`;
}

function numberValueByName(table: SystemDataTable, row: DataTableRow | undefined, name: string): number {
  const value = valueByName(table, row, name);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return 0;
}

function vector2ValueByName(
  table: SystemDataTable,
  row: DataTableRow | undefined,
  name: string,
  fallback: [number, number]
): [number, number] {
  const value = valueByName(table, row, name);
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]) || fallback[0], Number(value[1]) || fallback[1]];
  }
  return fallback;
}

function vector3ValueByName(
  table: SystemDataTable,
  row: DataTableRow | undefined,
  name: string,
  fallback: [number, number, number]
): [number, number, number] {
  const value = valueByName(table, row, name);
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || fallback[0], Number(value[1]) || fallback[1], Number(value[2]) || fallback[2]];
  }
  return fallback;
}

function colorValueByName(
  table: SystemDataTable,
  row: DataTableRow | undefined,
  name: string,
  fallback: [number, number, number]
): [number, number, number] {
  const value = textValueByName(table, row, name).trim();
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) {
    return fallback;
  }
  const raw = match[1];
  return [parseInt(raw.slice(0, 2), 16) / 255, parseInt(raw.slice(2, 4), 16) / 255, parseInt(raw.slice(4, 6), 16) / 255];
}

function samplingModeValue(value: string): GraphitePreviewTerrainSamplingMode {
  if (value === "repeat" || value === "wang") {
    return value;
  }
  return "stochastic";
}

export function buildTerrainBiomePreviewConfig(input: BuildTerrainBiomePreviewConfigInput): GraphitePreviewTerrainBiomeConfig | undefined {
  const biomeRow = input.biomeRows.find((row) => textValueByName(TERRAIN_BIOMES_TABLE, row, "file_name") === input.biomeKey);
  if (!biomeRow) {
    return undefined;
  }

  const assetsById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const variantRows = input.variantRows
    .filter((row) => textValueByName(TERRAIN_VARIANTS_TABLE, row, "biome") === input.biomeKey)
    .sort((left, right) => numberValueByName(TERRAIN_VARIANTS_TABLE, left, "id") - numberValueByName(TERRAIN_VARIANTS_TABLE, right, "id"));

  return {
    heightBlendWidth: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "height_blend_width"),
    id: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "id"),
    key: textValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "file_name"),
    macroTintStrength: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "macro_tint_strength"),
    macroScale: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "macro_scale"),
    macroStrength: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "macro_strength"),
    name: textValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "name"),
    samplingMode: samplingModeValue(textValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "sampling_mode")),
    samplingOffsetScale: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "sampling_offset_scale"),
    samplingScale: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "sampling_scale"),
    samplingBlendWidth: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "sampling_blend_width"),
    uvScale: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "uv_scale"),
    variantCount: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "variant_count"),
    variants: variantRows.map((row) => {
      const assetId = textValueByName(TERRAIN_VARIANTS_TABLE, row, "terrain_texture");
      return {
        albedoMultiplier: vector3ValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_multiplier", [1, 1, 1]),
        albedoSaturation: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_saturation"),
        albedoTint: colorValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_tint", [1, 1, 1]),
        albedoTintStrength: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "albedo_tint_strength"),
        heightBlendStrength: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "height_blend_strength"),
        id: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "id"),
        normalStrength: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "normal_strength"),
        roughnessMultiplier: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "roughness_multiplier"),
        terrainTexture: assetsById.get(assetId)?.relativePath ?? "",
        textureOffset: vector2ValueByName(TERRAIN_VARIANTS_TABLE, row, "texture_offset", [0, 0]),
        textureScale: vector2ValueByName(TERRAIN_VARIANTS_TABLE, row, "texture_scale", [1, 1]),
        wetness: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "wetness"),
        zoneEnd: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_end"),
        zoneStart: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_start"),
        zoneWeight: numberValueByName(TERRAIN_VARIANTS_TABLE, row, "zone_weight")
      };
    }),
    zoneBlendWidth: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "zone_blend_width"),
    zoneContrast: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "zone_contrast"),
    zoneEdgeBreakup: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "zone_edge_breakup"),
    zoneNoiseScale: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "zone_noise_scale"),
    zoneSeed: numberValueByName(TERRAIN_BIOMES_TABLE, biomeRow, "zone_seed")
  };
}
