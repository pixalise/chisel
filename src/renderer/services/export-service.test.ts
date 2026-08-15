import { describe, expect, it } from "vitest";
import { INPUT_BINDINGS_TABLE } from "@/constants/system-tables";
import { SYSTEM_TERRAIN_TABLES } from "../../shared/terrain-tables";
import { runtimeExportTables } from "./export-service";

describe("runtime terrain export", () => {
  it("keeps terrain grammars and frozen geography inside Chisel", () => {
    const tables = runtimeExportTables([INPUT_BINDINGS_TABLE, ...SYSTEM_TERRAIN_TABLES]);

    expect(tables.map((table) => table.id)).toEqual(["input_bindings"]);
  });
});
