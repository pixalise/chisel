import { describe, expect, it } from "vitest";
import {
  createTerrainPieceCell,
  createTerrainTemplateCells,
  terrainPieceSchema,
  terrainTileKey,
  type TerrainPiece,
  type TerrainPieceSet,
  type TerrainSiteTemplate,
  type TerrainTileBinding,
  type TerrainTileRef
} from "./terrain-authoring";
import {
  compileTerrainPieceLibrary,
  freezeTerrainCandidate,
  generateTerrainCandidate,
  generateTerrainCandidateBatch,
  inspectTerrainPieceCompatibility
} from "./terrain-wfc";

function tile(localId: number): TerrainTileRef {
  return { tilesetId: "TERRAIN", localId, orientation: 0 };
}

function piece(
  slug: string,
  localId: number,
  socket: string,
  options: Partial<Pick<TerrainPiece, "weight" | "semanticFlags">> = {}
): TerrainPiece {
  return terrainPieceSchema.parse({
    slug,
    width: 1,
    height: 1,
    layerCount: 1,
    cells: [{ ...createTerrainPieceCell(1), tiles: [tile(localId)] }],
    sockets: { north: [socket], east: [socket], south: [socket], west: [socket] },
    allowRotations: false,
    allowReflections: false,
    weight: options.weight ?? 1,
    biomeTags: [],
    siteTags: [],
    semanticFlags: options.semanticFlags ?? [],
    mutationFamily: ""
  });
}

function set(slug: string, pieceSlugs: string[]): TerrainPieceSet {
  return { slug, pieceSlugs, biomeTags: [], siteTags: [] };
}

function bindings(): Record<string, TerrainTileBinding> {
  return Object.fromEntries([0, 1, 2, 3].map((localId) => [terrainTileKey("TERRAIN", localId), { slug: `TILE_${localId}`, tags: [] }]));
}

describe("Simple-Tiled socket WFC", () => {
  it("derives adjacency from exact Wang socket equality", () => {
    const ground = piece("GROUND", 0, "GROUND");
    const water = piece("WATER", 1, "WATER");
    const library = compileTerrainPieceLibrary([ground, water], set("TERRAIN", [ground.slug, water.slug]), []);
    const groundState = library.states.find((state) => state.pieceSlug === "GROUND")!;
    expect(library.adjacency.east[groundState.id].map((id) => library.states[id].pieceSlug)).toEqual(["GROUND"]);
    expect(inspectTerrainPieceCompatibility(library, "WATER").directions.north.compatiblePieces).toEqual(["WATER"]);
  });

  it("compiles mixed-size modules into forced internal cell states", () => {
    const wide = terrainPieceSchema.parse({
      slug: "WIDE_GROUND",
      width: 2,
      height: 1,
      layerCount: 1,
      cells: [0, 1].map((localId) => ({ ...createTerrainPieceCell(1), blocking: localId === 0, tiles: [tile(localId)] })),
      sockets: { north: ["GROUND", "GROUND"], east: ["GROUND"], south: ["GROUND", "GROUND"], west: ["GROUND"] },
      allowRotations: true,
      allowReflections: false,
      weight: 10,
      biomeTags: [],
      siteTags: [],
      semanticFlags: [],
      mutationFamily: ""
    });
    const library = compileTerrainPieceLibrary([wide], set("TERRAIN", [wide.slug]), []);
    expect(library.variants.map((variant) => [variant.width, variant.height])).toEqual([
      [2, 1],
      [1, 2],
      [2, 1],
      [1, 2]
    ]);
    expect(library.states.some((state) => state.edges.east.startsWith("@INTERNAL_"))).toBe(true);
    expect(library.variants.every((variant) => variant.cells.filter((cell) => cell.blocking).length === 1)).toBe(true);
  });

  it("applies deny and allow-only exceptions after socket matching", () => {
    const a = piece("A", 0, "GROUND");
    const b = piece("B", 1, "GROUND");
    const library = compileTerrainPieceLibrary([a, b], set("TERRAIN", ["A", "B"]), [
      { slug: "DENY_A_B", sourcePiece: "A", direction: "east", targetPiece: "B", mode: "DENY" },
      { slug: "ONLY_A", sourcePiece: "B", direction: "west", targetPiece: "A", mode: "ALLOW_ONLY" }
    ]);
    const aState = library.states.find((state) => state.pieceSlug === "A")!;
    const bState = library.states.find((state) => state.pieceSlug === "B")!;
    expect(library.adjacency.east[aState.id].map((id) => library.states[id].pieceSlug)).toEqual(["A"]);
    expect(library.adjacency.west[bState.id].map((id) => library.states[id].pieceSlug)).toEqual(["A"]);
  });

  it("generates deterministically and preserves frozen approval", () => {
    const ground = piece("GROUND", 0, "GROUND", { semanticFlags: ["WALKABLE"] });
    const alternate = piece("ALT", 1, "GROUND", { weight: 2, semanticFlags: ["WALKABLE"] });
    const template: TerrainSiteTemplate = {
      slug: "SITE",
      width: 5,
      height: 5,
      pieceSet: "TERRAIN_SET",
      firstSeed: 1,
      candidateCount: 2,
      cells: createTerrainTemplateCells(5, 5),
      anchors: [],
      stamps: [],
      zones: []
    };
    const workspace = {
      pieces: [ground, alternate],
      pieceSets: [set("TERRAIN_SET", [ground.slug, alternate.slug])],
      adjacencyOverrides: [],
      tileBindings: bindings()
    };
    const first = generateTerrainCandidate(workspace, template, 42);
    const second = generateTerrainCandidate(workspace, template, 42);
    expect(first).toEqual(second);
    expect(generateTerrainCandidateBatch(workspace, template, template.firstSeed).map((result) => result.seed)).toEqual([1, 2]);
    const frozen = freezeTerrainCandidate(first, "APPROVED", "MAP");
    first.cells[0][0] = tile(3);
    expect(frozen.cells[0][0]).not.toEqual(tile(3));
  });

  it("uses resolved cell tags and anchor sockets as macro constraints", () => {
    const plain = piece("PLAIN", 0, "GROUND");
    const tagged = piece("TAGGED", 1, "GROUND");
    tagged.cells[0].semanticFlags = ["ENTRANCE_GROUND"];
    tagged.sockets.west = ["ENTRANCE"];
    const cells = createTerrainTemplateCells(3, 3);
    cells[3] = { ...cells[3], requiredTags: ["ENTRANCE_GROUND"] };
    const candidate = generateTerrainCandidate(
      {
        pieces: [plain, tagged],
        pieceSets: [set("TERRAIN_SET", [plain.slug, tagged.slug])],
        adjacencyOverrides: [],
        tileBindings: bindings()
      },
      {
        slug: "ANCHORED_SITE",
        width: 3,
        height: 3,
        pieceSet: "TERRAIN_SET",
        firstSeed: 1,
        candidateCount: 1,
        cells,
        anchors: [{ slug: "ENTRY", kind: "ENTRANCE", x: 0, y: 1, direction: "west", socket: "ENTRANCE" }],
        stamps: [],
        zones: []
      },
      9
    );
    expect(candidate.cellMetadata[3].piece).toBe("TAGGED");
    expect(candidate.anchors[0].socket).toBe("ENTRANCE");
  });

  it("rejects unreachable required anchors", () => {
    const blocked = piece("BLOCKED", 0, "GROUND");
    blocked.cells[0].blocking = true;
    const candidate = generateTerrainCandidate(
      { pieces: [blocked], pieceSets: [set("TERRAIN_SET", [blocked.slug])], adjacencyOverrides: [], tileBindings: bindings() },
      {
        slug: "BLOCKED_SITE",
        width: 3,
        height: 3,
        pieceSet: "TERRAIN_SET",
        firstSeed: 1,
        candidateCount: 1,
        cells: createTerrainTemplateCells(3, 3),
        anchors: [{ slug: "ENTRY", kind: "ENTRANCE", x: 0, y: 0, direction: "west", socket: "GROUND" }],
        stamps: [],
        zones: []
      },
      1
    );
    expect(candidate.issues.map((issue) => issue.code)).toContain("BLOCKED_ANCHOR");
  });

  it("preserves a mixed-size piece collision mask in generated cell metadata", () => {
    const masked = terrainPieceSchema.parse({
      slug: "MASKED_BLOCKER",
      width: 2,
      height: 2,
      layerCount: 1,
      cells: [true, true, false, true].map((blocking, localId) => ({
        ...createTerrainPieceCell(1),
        blocking,
        tiles: [tile(localId)]
      })),
      sockets: { north: ["GROUND", "GROUND"], east: ["GROUND", "GROUND"], south: ["GROUND", "GROUND"], west: ["GROUND", "GROUND"] },
      allowRotations: false,
      allowReflections: false,
      weight: 1,
      biomeTags: [],
      siteTags: [],
      semanticFlags: [],
      mutationFamily: ""
    });
    const candidate = generateTerrainCandidate(
      {
        pieces: [masked],
        pieceSets: [set("TERRAIN_SET", [masked.slug])],
        adjacencyOverrides: [],
        tileBindings: bindings()
      },
      {
        slug: "MASKED_SITE",
        width: 4,
        height: 4,
        pieceSet: "TERRAIN_SET",
        firstSeed: 1,
        candidateCount: 1,
        cells: createTerrainTemplateCells(4, 4),
        anchors: [],
        stamps: [],
        zones: []
      },
      1
    );
    expect(candidate.cellMetadata.filter((cell) => cell.blocking)).toHaveLength(12);
    expect(candidate.cellMetadata.filter((cell) => !cell.blocking)).toHaveLength(4);
  });
});
