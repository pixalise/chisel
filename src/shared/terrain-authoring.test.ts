import { describe, expect, it } from "vitest";
import {
  appendTerrainPieceLayer,
  createTerrainPieceCell,
  createTerrainTemplateCells,
  terrainApprovedAssetSchema,
  terrainPieceSchema,
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

  it("keeps post-approval spatial annotations separate from frozen geography", () => {
    expect(
      terrainSpatialLayoutSchema.parse({
        slug: "FOREST_DRESSING",
        sourceAsset: "FOREST_SITE",
        zones: [
          {
            slug: "CURIOSITY_AREA",
            kind: "PLACEMENT",
            cells: [0, 1, 3, 4],
            tags: ["FOREST_INTERIOR", "CURIOSITY_ALLOWED"],
            ruleSet: "FOREST_CURIOSITIES"
          }
        ],
        markers: [{ slug: "QUEST_HOOK", kind: "POI", x: 1, y: 1, radius: 2, direction: "north", tags: ["QUEST_ALLOWED"] }],
        placements: [
          {
            slug: "CURIOSITY_SLOT",
            mode: "RULE",
            x: 1,
            y: 1,
            width: 1,
            height: 1,
            orientation: 0,
            contentTable: "",
            contentSlug: "",
            ruleSet: "FOREST_CURIOSITIES",
            tags: ["OPTIONAL"]
          }
        ]
      })
    ).toMatchObject({ sourceAsset: "FOREST_SITE", zones: [{ cells: [0, 1, 3, 4] }] });
  });
});
