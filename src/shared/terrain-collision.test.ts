import { describe, expect, it } from "vitest";
import { setTerrainCollisionCell, transformTerrainCollision } from "./terrain-collision";

describe("terrain collision masks", () => {
  it("creates sparse subcell collision and collapses uniform masks", () => {
    const partial = setTerrainCollisionCell({ blocking: false }, 2, 0, true);
    expect(partial).toEqual({ blocking: false, collision: { resolution: 2, cells: [true, false, false, false] } });
    expect(setTerrainCollisionCell(partial, 2, 0, false)).toEqual({ blocking: false });
  });

  it("resamples existing collision when the painter detail changes", () => {
    const partial = setTerrainCollisionCell({ blocking: false }, 2, 0, true);
    expect(setTerrainCollisionCell(partial, 4, 15, true).collision?.cells).toEqual([
      true,
      true,
      false,
      false,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true
    ]);
  });

  it("rotates and reflects the collision mask with its terrain piece", () => {
    const source = { blocking: false, collision: { resolution: 2, cells: [true, false, false, false] } };
    expect(transformTerrainCollision(source, 1).collision?.cells).toEqual([false, true, false, false]);
    expect(transformTerrainCollision(source, 4).collision?.cells).toEqual([false, true, false, false]);
  });
});
