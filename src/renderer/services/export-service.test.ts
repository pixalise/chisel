import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "@/constants/system-tables";
import {
  TERRAIN_APPROVED_PATCHES_TABLE,
  TERRAIN_TILE_BINDINGS_TABLE,
  TERRAIN_TILESETS_TABLE,
  TERRAIN_WFC_SAMPLE_CELLS_TABLE,
  TERRAIN_WFC_SAMPLES_TABLE
} from "../../shared/terrain-tables";
import { runtimeExportTables } from "./export-service";

describe("runtime terrain export", () => {
  it("exports approved patches and tilesets without Chisel authoring metadata", () => {
    const tables = runtimeExportTables([
      INPUT_BINDINGS_TABLE,
      TERRAIN_TILE_BINDINGS_TABLE,
      TERRAIN_WFC_SAMPLES_TABLE,
      TERRAIN_WFC_SAMPLE_CELLS_TABLE,
      TERRAIN_TILESETS_TABLE,
      TERRAIN_APPROVED_PATCHES_TABLE
    ]);

    expect(tables.map((table) => table.id)).toEqual(["input_bindings", "terrain_tilesets", "terrain_approved_patches"]);
  });
});
