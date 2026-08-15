import { describe, expect, it } from "vitest";
import { findEmptyTerrainTileIds } from "./terrain-empty-tiles";

describe("empty terrain tile detection", () => {
  it("treats a tile as empty only when every pixel is fully transparent", () => {
    const pixels = new Uint8ClampedArray(4 * 2 * 4);
    pixels[(1 * 4 + 3) * 4 + 3] = 1;

    expect([...findEmptyTerrainTileIds(pixels, 4, 2, 2)]).toEqual([0]);
  });

  it("returns every tile when the sheet is fully transparent", () => {
    const pixels = new Uint8ClampedArray(4 * 4 * 4);

    expect([...findEmptyTerrainTileIds(pixels, 4, 4, 2)]).toEqual([0, 1, 2, 3]);
  });
});
