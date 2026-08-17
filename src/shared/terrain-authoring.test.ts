import { describe, expect, it } from "vitest";
import {
  appendTerrainPieceLayer,
  createTerrainPieceCell,
  createTerrainTemplateCells,
  terrainAnnotationDefinitionSchema,
  terrainApprovedAssetSchema,
  terrainPieceSchema,
  terrainPieceSetSchema,
  terrainSiteTemplateSchema,
  terrainSocketDefinitionSchema,
  terrainSpatialLayoutSchema,
  terrainTileBindingSchema
} from "./terrain-authoring";

describe("socket terrain authoring contract", () => {
  it("accepts a mixed-size layered piece with exact edge profiles", () => {
    const cells = Array.from({ length: 6 }, (_, localId) => ({
      ...createTerrainPieceCell(1),
      tiles: [{ tilesetId: "TERRAIN", localId, orientation: 0 }]
    }));
    expect(
      terrainPieceSchema.parse({
        slug: "GROUND_CORNER",
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
        width: 2,
        height: 1,
        layerCount: 1,
        cells: Array.from({ length: 2 }, (_, localId) => ({
          ...createTerrainPieceCell(1),
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

  it("creates a cell with one empty render layer and neutral metadata", () => {
    expect(createTerrainPieceCell(1)).toEqual({ tiles: [null], blocking: false, elevation: 0, semanticFlags: [] });
  });

  it("accepts sparse power-of-two collision masks and rejects uniform or malformed masks", () => {
    const cell = { ...createTerrainPieceCell(1), collision: { resolution: 2, cells: [true, false, false, false] } };
    expect(
      terrainPieceSchema.safeParse({
        slug: "QUARTER_COLLISION",
        width: 1,
        height: 1,
        layerCount: 1,
        cells: [cell],
        sockets: { north: ["GROUND"], east: ["GROUND"], south: ["GROUND"], west: ["GROUND"] },
        allowRotations: false,
        allowReflections: false,
        weight: 1,
        biomeTags: [],
        siteTags: [],
        semanticFlags: [],
        mutationFamily: ""
      }).success
    ).toBe(true);
    expect(() =>
      terrainPieceSchema.parse({
        slug: "BAD_COLLISION",
        width: 1,
        height: 1,
        layerCount: 1,
        cells: [{ ...cell, collision: { resolution: 2, cells: [true, true, true, true] } }],
        sockets: { north: ["GROUND"], east: ["GROUND"], south: ["GROUND"], west: ["GROUND"] },
        allowRotations: false,
        allowReflections: false,
        weight: 1,
        biomeTags: [],
        siteTags: [],
        semanticFlags: [],
        mutationFamily: ""
      })
    ).toThrow("Uniform collision belongs in the cell blocking flag");
  });

  it("accepts an intentionally unpainted logical first-layer cell", () => {
    expect(
      terrainPieceSchema.parse({
        slug: "LOGICAL_WATER",
        width: 1,
        height: 1,
        layerCount: 1,
        cells: [{ ...createTerrainPieceCell(1), semanticFlags: ["WATER"] }],
        sockets: { north: ["WATER"], east: ["WATER"], south: ["WATER"], west: ["WATER"] },
        allowRotations: false,
        allowReflections: false,
        weight: 1,
        biomeTags: [],
        siteTags: [],
        semanticFlags: [],
        mutationFamily: ""
      })
    ).toMatchObject({ slug: "LOGICAL_WATER", cells: [{ tiles: [null], semanticFlags: ["WATER"] }] });
  });

  it("defaults omitted collection weights and accepts normalized per-collection overrides", () => {
    expect(terrainPieceSetSchema.parse({ slug: "DEFAULT", pieceSlugs: ["GROUND"], biomeTags: [], siteTags: [] }).pieceWeights).toEqual({});
    expect(
      terrainPieceSetSchema.parse({
        slug: "WEIGHTED",
        pieceSlugs: ["GROUND", "ROCK"],
        pieceWeights: { GROUND: 0.8, ROCK: 0 },
        biomeTags: [],
        siteTags: []
      }).pieceWeights
    ).toEqual({ GROUND: 0.8, ROCK: 0 });
    expect(() =>
      terrainPieceSetSchema.parse({
        slug: "INVALID_WEIGHT",
        pieceSlugs: ["GROUND"],
        pieceWeights: { GROUND: 1.01 },
        biomeTags: [],
        siteTags: []
      })
    ).toThrow();
  });

  it("appends a transparent render layer without changing piece metadata", () => {
    const piece = terrainPieceSchema.parse({
      slug: "GROUND",
      width: 1,
      height: 1,
      layerCount: 1,
      cells: [{ ...createTerrainPieceCell(1), tiles: [{ tilesetId: "TERRAIN", localId: 1, orientation: 0 }] }],
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

  it("keeps sprite metadata free of collision and WFC grammar", () => {
    expect(terrainTileBindingSchema.parse({ slug: "BOULDER", tags: ["MAP_EDGE"] })).toEqual({
      slug: "BOULDER",
      tags: ["MAP_EDGE"]
    });
    expect(() => terrainTileBindingSchema.parse({ slug: "BOULDER", blocking: true, tags: [] })).toThrow();
  });

  it("validates extension anchors on template boundaries", () => {
    expect(() =>
      terrainSiteTemplateSchema.parse({
        slug: "SITE",
        width: 5,
        height: 5,
        pieceSet: "TERRAIN_SET",
        firstSeed: 1,
        candidateCount: 12,
        cells: createTerrainTemplateCells(5, 5),
        anchors: [{ slug: "EXTENSION", kind: "EXTENSION", x: 2, y: 2, direction: "north", socket: "GROUND" }],
        stamps: [],
        zones: []
      })
    ).toThrow("Extension anchors must lie on the map boundary");
  });

  it("accepts socket metadata and a frozen approved geography asset", () => {
    expect(terrainSocketDefinitionSchema.parse({ slug: "GROUND", color: "#8B9D5C", description: "" })).toMatchObject({
      slug: "GROUND"
    });
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
        cellMetadata: Array.from({ length: 9 }, () => ({ blocking: false, elevation: 0, tags: [], piece: "GROUND" })),
        cellOverrides: [],
        placements: [],
        anchors: [],
        metrics: { walkableComponents: 1, reachableAnchors: 0, requiredAnchors: 0, distinctPieces: 1 }
      })
    ).toMatchObject({ slug: "SITE_1", kind: "MAP" });
  });

  it("keeps global annotation definitions and sparse cell references separate from frozen geography", () => {
    expect(terrainAnnotationDefinitionSchema.parse({ slug: "ENTRANCE", color: "#22D3EE" })).toEqual({
      slug: "ENTRANCE",
      color: "#22D3EE"
    });
    expect(
      terrainSpatialLayoutSchema.parse({
        slug: "FOREST_ANNOTATIONS",
        sourceAsset: "FOREST_SITE",
        cells: [
          { index: 0, annotations: ["ENTRANCE"] },
          { index: 4, annotations: ["ENTRANCE", "QUEST"] }
        ]
      })
    ).toMatchObject({
      sourceAsset: "FOREST_SITE",
      cells: [
        { index: 0, annotations: ["ENTRANCE"] },
        { index: 4, annotations: ["ENTRANCE", "QUEST"] }
      ]
    });
  });
});
