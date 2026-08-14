import { describe, expect, it } from "vitest";
import { fileUrlFromPath } from "./file-url";

describe("file URL conversion", () => {
  it("encodes Linux paths without relying on Node URL APIs", () => {
    expect(fileUrlFromPath("/home/user/Tiled images/shore#1.png")).toBe("file:///home/user/Tiled%20images/shore%231.png");
  });

  it("supports Windows drive and UNC paths", () => {
    expect(fileUrlFromPath("C:\\Tiles\\water tile.png")).toBe("file:///C:/Tiles/water%20tile.png");
    expect(fileUrlFromPath("\\\\server\\tiles\\water.png")).toBe("file://server/tiles/water.png");
  });

  it("rejects relative paths", () => {
    expect(() => fileUrlFromPath("tiles/water.png")).toThrow("must be absolute");
  });
});
