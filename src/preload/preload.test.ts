import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("sandboxed preload", () => {
  it("has no relative runtime imports", () => {
    const source = fs.readFileSync(new URL("./preload.ts", import.meta.url), "utf8");
    const relativeRuntimeImports = source
      .split("\n")
      .filter((line) => line.startsWith("import ") && !line.startsWith("import type ") && /from ["']\.\.?\//.test(line));

    expect(relativeRuntimeImports).toEqual([]);
  });
});
