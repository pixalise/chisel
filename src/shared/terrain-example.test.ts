import { describe, expect, it } from "vitest";
import { generateTerrainCandidateBatch } from "./terrain-wfc";
import { installCompleteTerrainExample, terrainExampleTemplateSlug } from "./terrain-example";
import type { TerrainWorkspaceView } from "./terrain-authoring";

function emptyWorkspace(): TerrainWorkspaceView {
  return {
    tilesets: [],
    tileBindings: {
      "TERRAIN:40": { slug: "GROUND", blocking: false, tags: ["GROUND"] },
      "TERRAIN:80": { slug: "TREE", blocking: false, tags: ["TREE"] },
      "TERRAIN:102": { slug: "BUSH", blocking: false, tags: ["BUSH"] },
      "TERRAIN:104": { slug: "ROCK", blocking: false, tags: ["ROCK"] }
    },
    sockets: [],
    pieces: [],
    pieceSets: [],
    adjacencyOverrides: [],
    templates: [],
    approvedAssets: [],
    problems: []
  };
}

describe("complete terrain example", () => {
  it("installs every authoring feature and produces an immediately usable candidate batch", () => {
    const workspace = installCompleteTerrainExample(emptyWorkspace());
    const template = workspace.templates.find((entry) => entry.slug === terrainExampleTemplateSlug)!;
    const results = generateTerrainCandidateBatch(workspace, template, template.firstSeed);

    expect(template.firstSeed).toBe(1);
    expect(workspace.sockets.map((entry) => entry.slug)).toEqual(["GROUND"]);
    expect(workspace.pieces.some((entry) => entry.width > 1 && entry.allowRotations)).toBe(true);
    expect(workspace.pieceSets).toHaveLength(1);
    expect(workspace.adjacencyOverrides).toHaveLength(2);
    expect(workspace.adjacencyOverrides.map((entry) => entry.mode).sort()).toEqual(["ALLOW_ONLY", "DENY"]);
    expect(template.anchors).toHaveLength(3);
    expect(template.stamps).toHaveLength(1);
    expect(template.zones).toHaveLength(1);
    expect(template.cells.some((entry) => entry.requiredTags.length > 0)).toBe(true);
    expect(template.cells.some((entry) => entry.forbiddenTags.length > 0)).toBe(true);
    expect(results).toHaveLength(8);
    expect(results.every((entry) => entry.candidate?.issues.length === 0)).toBe(true);
  });
});
