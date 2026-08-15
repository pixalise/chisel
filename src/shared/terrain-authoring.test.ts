import { describe, expect, it } from "vitest";
import {
  appendTerrainPieceLayer,
  createTerrainPieceCell,
  createTerrainTemplateCells,
  terrainApprovedAssetSchema,
  terrainPieceSchema,
  terrainSiteTemplateSchema,
  terrainSocketDefinitionSchema,
  terrainTileBindingSchema
} from "./terrain-authoring";

describe("socket terrain authoring contract", () => {
  it("accepts a mixed-size layered base piece with exact edge profiles", () => {
    const cells = Array.from({ length: 6 }, (_, localId) => ({
      ...createTerrainPieceCell(1, "BASE"),
      tiles: [{ tilesetId: "TERRAIN", localId, orientation: 0 }]
    }));
    expect(
      terrainPieceSchema.parse({
        slug: "GROUND_CORNER",
        pass: "BASE",
        width: 3,
        height: 2,
        layerCount: 1,
        cells,
        sockets: {
          north: ["GROUND", "GROUND", "ROAD"],
          east: ["ROAD", "GROUND"],
          south: ["GROUND", "GROUND", "GROUND"],
          west: ["GROUND", "GROUND"]
        },
        allowRotations: true,
        allowReflections: false,
        weight: 1,
        biomeTags: ["FOREST"],
        siteTags: [],
        semanticFlags: ["WALKABLE"],
        mutationFamily: "GROUND"
      })
    ).toMatchObject({ slug: "GROUND_CORNER", width: 3, height: 2 });
  });

  it("rejects socket profiles that do not cover every boundary segment", () => {
    expect(() =>
      terrainPieceSchema.parse({
        slug: "BAD_EDGE",
        pass: "BASE",
        width: 2,
        height: 1,
        layerCount: 1,
        cells: Array.from({ length: 2 }, (_, localId) => ({
          ...createTerrainPieceCell(1, "BASE"),
          tiles: [{ tilesetId: "TERRAIN", localId, orientation: 0 }]
        })),
        sockets: { north: ["GROUND"], east: ["GROUND"], south: ["GROUND", "GROUND"], west: ["GROUND"] },
        allowRotations: false,
        allowReflections: false,
        weight: 1,
        biomeTags: [],
        siteTags: [],
        semanticFlags: [],
        mutationFamily: ""
      })
    ).toThrow("north socket profile must contain 2");
  });

  it("requires base coverage but permits transparent cliff overlays", () => {
    const base = createTerrainPieceCell(1, "BASE");
    const cliff = createTerrainPieceCell(1, "CLIFF");
    expect(base.tiles[0]).toBeNull();
    expect(cliff.writeMode).toBe("OVERLAY");
  });

  it("appends a transparent render layer without changing piece metadata", () => {
    const piece = terrainPieceSchema.parse({
      slug: "GROUND",
      pass: "BASE",
      width: 1,
      height: 1,
      layerCount: 1,
      cells: [{ ...createTerrainPieceCell(1, "BASE"), tiles: [{ tilesetId: "TERRAIN", localId: 1, orientation: 0 }] }],
      sockets: { north: ["GROUND"], east: ["GROUND"], south: ["GROUND"], west: ["GROUND"] },
      allowRotations: false,
      allowReflections: false,
      weight: 1,
      biomeTags: [],
      siteTags: [],
      semanticFlags: [],
      mutationFamily: ""
    });
    expect(appendTerrainPieceLayer(piece).cells[0].tiles).toEqual([{ tilesetId: "TERRAIN", localId: 1, orientation: 0 }, null]);
  });

  it("keeps tile bindings free of WFC grammar", () => {
    expect(terrainTileBindingSchema.parse({ slug: "CLIFF", blocking: true, tags: ["MAP_EDGE"] })).toEqual({
      slug: "CLIFF",
      blocking: true,
      tags: ["MAP_EDGE"]
    });
  });

  it("validates extension anchors on template boundaries", () => {
    expect(() =>
      terrainSiteTemplateSchema.parse({
        slug: "SITE",
        width: 5,
        height: 5,
        basePieceSet: "BASE_SET",
        cliffPieceSet: "",
        candidateCount: 12,
        cells: createTerrainTemplateCells(5, 5),
        anchors: [{ slug: "EXTENSION", kind: "EXTENSION", x: 2, y: 2, direction: "north", socket: "GROUND" }],
        stamps: [],
        zones: []
      })
    ).toThrow("Extension anchors must lie on the map boundary");
  });

  it("accepts socket metadata and a frozen approved geography asset", () => {
    expect(
      terrainSocketDefinitionSchema.parse({ slug: "GROUND", label: "Ground", color: "#8B9D5C", description: "", passes: ["BASE"] })
    ).toMatchObject({ slug: "GROUND" });
    expect(
      terrainApprovedAssetSchema.parse({
        slug: "SITE_1",
        kind: "MAP",
        sourceTemplate: "SITE",
        seed: 1,
        width: 3,
        height: 3,
        layerCount: 1,
        cells: Array.from({ length: 9 }, () => [{ tilesetId: "TERRAIN", localId: 0, orientation: 0 }]),
        cellMetadata: Array.from({ length: 9 }, () => ({ blocking: false, elevation: 0, tags: [], basePiece: "GROUND", cliffPiece: "" })),
        placements: [],
        anchors: [],
        metrics: { walkableComponents: 1, reachableAnchors: 0, requiredAnchors: 0, cliffCells: 0, distinctPieces: 1 }
      })
    ).toMatchObject({ slug: "SITE_1", kind: "MAP" });
  });
});
