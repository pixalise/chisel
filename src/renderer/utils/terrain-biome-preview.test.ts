import { describe, expect, it } from "vitest";
import { TERRAIN_BIOMES_TABLE, TERRAIN_VARIANTS_TABLE } from "@/constants/system-tables";
import type { DataTableRow, SystemDataTable } from "../../shared/schemas";
import { buildTerrainBiomePreviewConfig } from "./terrain-biome-preview";

function row(table: SystemDataTable, id: string, valuesByName: Record<string, unknown>): DataTableRow {
  return {
    id,
    values: table.columns.map((column) => ({
      columnId: column.id,
      type: column.type,
      value: valuesByName[column.name] ?? column.defaultValue
    })) as DataTableRow["values"]
  };
}

describe("terrain biome preview config", () => {
  it("emits zones-only biome and variant data", () => {
    const biomeRow = row(TERRAIN_BIOMES_TABLE, "terrain-preview-biome", {
      file_name: "tundra",
      height_blend_width: 0.2,
      id: 2,
      name: "Tundra",
      sampling_scale: 0.12,
      variant_count: 1,
      zone_blend_width: 0.04,
      zone_edge_breakup: 0.5,
      zone_seed: 42
    });
    const variantRow = row(TERRAIN_VARIANTS_TABLE, "terrain-preview-variant-a", {
      biome: "tundra",
      id: 0,
      texture_scale: [12, 8],
      zone_end: 0.65,
      zone_start: 0.25,
      zone_weight: 3
    });

    const config = buildTerrainBiomePreviewConfig({
      assets: [],
      biomeKey: "tundra",
      biomeRows: [biomeRow],
      variantRows: [variantRow]
    });

    expect(config?.variantCount).toBe(1);
    expect(config?.zoneSeed).toBe(42);
    expect(config?.zoneBlendWidth).toBe(0.04);
    expect(config?.zoneEdgeBreakup).toBe(0.5);
    expect(config?.variants[0]?.textureScale).toEqual([12, 8]);
    expect(config?.variants[0]?.zoneStart).toBe(0.25);
    expect(config?.variants[0]?.zoneEnd).toBe(0.65);
    expect(config?.variants[0]?.zoneWeight).toBe(3);
    expect(config).not.toHaveProperty("families");
  });
});
