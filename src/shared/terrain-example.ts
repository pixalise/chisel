import {
  createTerrainPieceCell,
  createTerrainTemplateCells,
  terrainPieceSchema,
  terrainSiteTemplateSchema,
  type TerrainPiece,
  type TerrainPieceCell,
  type TerrainSocketDefinition,
  type TerrainTileRef,
  type TerrainWorkspaceView
} from "./terrain-authoring";

export const terrainExampleTemplateSlug = "EXAMPLE_FOREST_SITE";
export const terrainExamplePieceSetSlug = "EXAMPLE_FOREST_COLLECTION";

interface BoundTile {
  binding: TerrainWorkspaceView["tileBindings"][string];
  tile: TerrainTileRef;
}

function boundTiles(workspace: TerrainWorkspaceView): BoundTile[] {
  return Object.entries(workspace.tileBindings).map(([key, binding]) => {
    const separator = key.lastIndexOf(":");
    if (separator < 1) throw new Error(`Invalid terrain tile binding key '${key}'`);
    return {
      binding,
      tile: { tilesetId: key.slice(0, separator), localId: Number(key.slice(separator + 1)), orientation: 0 }
    };
  });
}

function chooseTile(tiles: BoundTile[], tags: string[], preferredLocalId: number, fallbackIndex: number): TerrainTileRef {
  const tagged = tiles.find((entry) => tags.some((tag) => entry.binding.tags.includes(tag)));
  const preferred = tiles.find((entry) => entry.tile.localId === preferredLocalId);
  const selected = tagged ?? preferred ?? tiles[fallbackIndex] ?? tiles[0];
  if (!selected) throw new Error("The complete terrain example needs metadata for at least one tileset sprite");
  return { ...selected.tile };
}

function terrainCell(ground: TerrainTileRef, detail: TerrainTileRef | null, semanticFlags: string[]): TerrainPieceCell {
  return {
    ...createTerrainPieceCell(2),
    tiles: [{ ...ground }, detail ? { ...detail } : null],
    semanticFlags
  };
}

function terrainPiece(
  slug: string,
  width: number,
  height: number,
  cells: TerrainPieceCell[],
  weight: number,
  semanticFlags: string[],
  transform: "NONE" | "ROTATE" | "REFLECT" = "NONE"
): TerrainPiece {
  return terrainPieceSchema.parse({
    slug,
    width,
    height,
    layerCount: 2,
    cells,
    sockets: {
      north: Array<string>(width).fill("GROUND"),
      east: Array<string>(height).fill("GROUND"),
      south: Array<string>(width).fill("GROUND"),
      west: Array<string>(height).fill("GROUND")
    },
    allowRotations: transform !== "NONE",
    allowReflections: transform === "REFLECT",
    weight,
    biomeTags: ["FOREST"],
    siteTags: ["OUTDOOR"],
    semanticFlags,
    mutationFamily: "FOREST_FLOOR"
  });
}

function examplePieces(ground: TerrainTileRef, tree: TerrainTileRef, rock: TerrainTileRef, bush: TerrainTileRef): TerrainPiece[] {
  const open = terrainPiece("EXAMPLE_OPEN_GROUND", 1, 1, [terrainCell(ground, null, [])], 10, ["GROUND", "WALKABLE"]);
  const treeDot = terrainPiece("EXAMPLE_TREE_DOT", 1, 1, [terrainCell(ground, tree, ["TREE"])], 4, ["GROUND", "TREE", "WALKABLE"]);
  const rockDot = terrainPiece("EXAMPLE_ROCK_DOT", 1, 1, [terrainCell(ground, rock, ["ROCK"])], 2, ["GROUND", "ROCK", "WALKABLE"]);
  const bushDot = terrainPiece("EXAMPLE_BUSH_DOT", 1, 1, [terrainCell(ground, bush, ["BUSH"])], 3, ["BUSH", "GROUND", "WALKABLE"]);
  const grove = terrainPiece(
    "EXAMPLE_GROVE",
    2,
    2,
    [
      { ...terrainCell(ground, tree, ["TREE"]), blocking: true },
      { ...terrainCell(ground, bush, ["BUSH"]), blocking: true },
      terrainCell(ground, null, []),
      { ...terrainCell(ground, tree, ["TREE"]), blocking: true }
    ],
    0.01,
    ["GROUND", "TREE", "WALKABLE"],
    "REFLECT"
  );
  const fallenLog = terrainPiece(
    "EXAMPLE_FALLEN_LOG",
    2,
    1,
    [terrainCell(ground, tree, ["LOG"]), terrainCell(ground, tree, ["LOG"])],
    0.05,
    ["GROUND", "LOG", "WALKABLE"],
    "ROTATE"
  );
  return [open, treeDot, rockDot, bushDot, grove, fallenLog];
}

function exampleSockets(existing: TerrainSocketDefinition[]): TerrainSocketDefinition[] {
  const sockets = existing.filter((entry) => entry.slug !== "GROUND");
  return [
    ...sockets,
    {
      slug: "GROUND",
      color: "#8B9D5C",
      description: "Terrain modules with this edge may meet as uninterrupted traversable ground."
    }
  ];
}

function exampleTemplate() {
  const width = 12;
  const height = 12;
  const cells = createTerrainTemplateCells(width, height);
  cells[1 * width + 1] = { ...cells[1 * width + 1], requiredTags: ["TREE"] };
  cells[6 * width] = { ...cells[6 * width], forbiddenTags: ["ROCK"] };
  cells[6 * width + width - 1] = { ...cells[6 * width + width - 1], forbiddenTags: ["ROCK"] };
  return terrainSiteTemplateSchema.parse({
    slug: terrainExampleTemplateSlug,
    width,
    height,
    pieceSet: terrainExamplePieceSetSlug,
    firstSeed: 1,
    candidateCount: 8,
    cells,
    anchors: [
      { slug: "WEST_ENTRANCE", kind: "ENTRANCE", x: 0, y: 6, direction: "west", socket: "GROUND" },
      { slug: "EAST_EXIT", kind: "EXIT", x: 11, y: 6, direction: "east", socket: "GROUND" },
      { slug: "NORTH_EXTENSION", kind: "EXTENSION", x: 6, y: 0, direction: "north", socket: "GROUND" }
    ],
    stamps: [{ piece: "EXAMPLE_GROVE", x: 4, y: 4, orientation: 0 }],
    zones: [{ slug: "NORTHWEST_TREES", x: 0, y: 0, width: 6, height: 6, requiredTags: ["TREE"], minCount: 1, maxCount: 36 }]
  });
}

export function installCompleteTerrainExample(workspace: TerrainWorkspaceView): TerrainWorkspaceView {
  const tiles = boundTiles(workspace);
  const ground = chooseTile(tiles, ["GROUND"], 40, 0);
  const tree = chooseTile(tiles, ["TREE", "FOLIAGE"], 80, 1);
  const rock = chooseTile(tiles, ["ROCK"], 104, 2);
  const bush = chooseTile(tiles, ["BUSH"], 102, 3);
  const pieces = examplePieces(ground, tree, rock, bush);
  const examplePieceSlugs = new Set(pieces.map((entry) => entry.slug));
  return {
    ...workspace,
    sockets: exampleSockets(workspace.sockets),
    pieces: [...workspace.pieces.filter((entry) => !entry.slug.startsWith("EXAMPLE_")), ...pieces],
    pieceSets: [
      ...workspace.pieceSets.filter((entry) => !entry.slug.startsWith("EXAMPLE_")),
      {
        slug: terrainExamplePieceSetSlug,
        pieceSlugs: pieces.map((entry) => entry.slug),
        biomeTags: ["FOREST"],
        siteTags: ["OUTDOOR"]
      }
    ],
    adjacencyOverrides: [
      ...workspace.adjacencyOverrides.filter(
        (entry) =>
          !entry.slug.startsWith("EXAMPLE_") && !examplePieceSlugs.has(entry.sourcePiece) && !examplePieceSlugs.has(entry.targetPiece)
      ),
      {
        slug: "EXAMPLE_NO_ROCK_ROWS",
        sourcePiece: "EXAMPLE_ROCK_DOT",
        direction: "east",
        targetPiece: "EXAMPLE_ROCK_DOT",
        mode: "DENY"
      },
      {
        slug: "EXAMPLE_LOG_NEEDS_OPEN_NORTH",
        sourcePiece: "EXAMPLE_FALLEN_LOG",
        direction: "north",
        targetPiece: "EXAMPLE_OPEN_GROUND",
        mode: "ALLOW_ONLY"
      }
    ],
    templates: [...workspace.templates.filter((entry) => entry.slug !== terrainExampleTemplateSlug), exampleTemplate()],
    problems: workspace.problems.filter((problem) => !problem.includes("EXAMPLE_"))
  };
}
