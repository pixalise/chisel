import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import { afterEach, describe, expect, it } from "vitest";
import {
  deleteTiledTileset,
  importTiledBoard,
  loadTiledWorkspace,
  restoreTiledWorkspace,
  saveTiledAuthoring,
  snapshotTiledWorkspace
} from "./tiled-sample-board";
import { readTerrainTable, writeTerrainTableRows } from "./terrain-table-store";
import { dataTableRowSchema, type DataColumnDefinition, type DataTableRow } from "../shared/schemas";
import {
  TERRAIN_BIOME_COLUMNS,
  TERRAIN_BIOME_PROFILE_COLUMNS,
  TERRAIN_BIOME_PROFILES_TABLE,
  TERRAIN_BIOMES_TABLE,
  TERRAIN_TILESETS_TABLE
} from "../shared/terrain-tables";

const temporaryDirectories: string[] = [];
const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function sourceBoard(
  options: { data?: string; infinite?: boolean; inlineTileset?: boolean; mapExtension?: string; tilesetExtension?: string } = {}
): Promise<{
  directory: string;
  mapPath: string;
}> {
  const directory = await temporaryDirectory("chisel-tiled-source-");
  await fs.writeFile(path.join(directory, "terrain.png"), onePixelPng);
  const tilesetName = `terrain${options.tilesetExtension ?? ".tsx"}`;
  await fs.writeFile(
    path.join(directory, tilesetName),
    `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.12.2" name="Terrain" tilewidth="1" tileheight="1" tilecount="1" columns="1">
 <image source="terrain.png" width="1" height="1"/>
</tileset>
`,
    "utf8"
  );
  const mapPath = path.join(directory, `samples${options.mapExtension ?? ".tmx"}`);
  const tileset = options.inlineTileset
    ? '<tileset firstgid="1" name="Inline" tilewidth="1" tileheight="1" tilecount="1" columns="1"><image source="terrain.png" width="1" height="1"/></tileset>'
    : `<tileset firstgid="1" source="${tilesetName}"/>`;
  await fs.writeFile(
    mapPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.12.2" orientation="orthogonal" renderorder="right-down" width="2" height="1" tilewidth="1" tileheight="1" infinite="${options.infinite ? 1 : 0}">
 ${tileset}
 <layer id="1" name="Ground" width="2" height="1">
  <data encoding="csv">${options.data ?? "1,2147483649"}</data>
 </layer>
</map>
`,
    "utf8"
  );
  return { directory, mapPath };
}

function rowValue(column: DataColumnDefinition, value: unknown): DataTableRow["values"][number] {
  return { columnId: column.id, type: column.type, value } as DataTableRow["values"][number];
}

function tableRow(slug: string, values: DataTableRow["values"]): DataTableRow {
  return dataTableRowSchema.parse({ id: nanoid(), slug, values });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

describe("managed Tiled sample boards", () => {
  it("imports external spritesheets and persists authoring in system tables", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const source = await sourceBoard();
    const imported = await importTiledBoard({ projectPath, sourcePath: source.mapPath, boardId: "FOREST_SAMPLES", name: "Forest Samples" });
    const board = imported.boards[0];

    expect(board).toMatchObject({ id: "FOREST_SAMPLES", width: 2, height: 1, tileWidth: 1, tileHeight: 1 });
    expect(board.tilesets[0]).toMatchObject({ id: "TERRAIN", tileCount: 1, imageWidth: 1, imageHeight: 1 });
    expect(board.problems).toEqual(["Tile 'TERRAIN:0' needs a slug and role"]);
    const managedMap = await fs.readFile(path.join(projectPath, ".chisel", "tiled", "FOREST_SAMPLES", "map.tmx"), "utf8");
    const managedTileset = await fs.readFile(
      path.join(projectPath, ".chisel", "tiled", "FOREST_SAMPLES", "tilesets", "TERRAIN.tsx"),
      "utf8"
    );
    expect(managedMap).toContain('source="tilesets/TERRAIN.tsx"');
    expect(managedTileset).toContain('source="../images/TERRAIN/TERRAIN.png"');

    const saved = await saveTiledAuthoring({
      projectPath,
      boardId: board.id,
      authoring: {
        tileBindings: { "TERRAIN:0": { slug: "GRASS", roleId: "GROUND", blocking: false, tags: ["WALKABLE"] } },
        samples: [
          {
            slug: "FOREST_INTERIOR",
            layerIds: [1],
            x: 0,
            y: 0,
            width: 2,
            height: 1,
            allowRotations: true,
            allowReflections: false
          }
        ]
      }
    });
    expect(saved.problems).toEqual([]);
    await expect(loadTiledWorkspace({ projectPath })).resolves.toMatchObject({ boards: [{ authoring: saved.authoring }] });
  });

  it("rejects maps outside the deliberately strict supported subset", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const infinite = await sourceBoard({ infinite: true });
    await expect(importTiledBoard({ projectPath, sourcePath: infinite.mapPath, boardId: "INFINITE", name: "Infinite" })).rejects.toThrow(
      "Infinite or chunked"
    );

    const inline = await sourceBoard({ inlineTileset: true });
    await expect(importTiledBoard({ projectPath, sourcePath: inline.mapPath, boardId: "INLINE", name: "Inline" })).rejects.toThrow(
      "Inline Tiled tilesets"
    );
  });

  it("restores committed TMX and TSX while retaining and hash-checking managed images", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const source = await sourceBoard();
    await importTiledBoard({ projectPath, sourcePath: source.mapPath, boardId: "BOARD", name: "Board" });
    const snapshot = await snapshotTiledWorkspace({ projectPath });
    const imagePath = path.join(projectPath, ".chisel", "tiled", "BOARD", "images", "TERRAIN", "TERRAIN.png");
    const mapPath = path.join(projectPath, ".chisel", "tiled", "BOARD", "map.tmx");
    await fs.writeFile(mapPath, "<broken/>", "utf8");

    await restoreTiledWorkspace({ projectPath, snapshot });
    await expect(fs.readFile(imagePath)).resolves.toEqual(onePixelPng);
    expect(await fs.readFile(mapPath, "utf8")).toBe(snapshot.files.find((file) => file.path.endsWith("map.tmx"))?.content);

    await fs.writeFile(imagePath, Buffer.from("changed"));
    await expect(restoreTiledWorkspace({ projectPath, snapshot })).rejects.toThrow("has changed since this commit");
  });

  it("requires native TMX and TSX file extensions", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const wrongMapExtension = await sourceBoard({ mapExtension: ".tmj" });
    await expect(
      importTiledBoard({ projectPath, sourcePath: wrongMapExtension.mapPath, boardId: "WRONG_MAP", name: "Wrong Map" })
    ).rejects.toThrow("must use the '.tmx' extension");

    const wrongTilesetExtension = await sourceBoard({ tilesetExtension: ".tsj" });
    await expect(
      importTiledBoard({ projectPath, sourcePath: wrongTilesetExtension.mapPath, boardId: "WRONG_TILESET", name: "Wrong Tileset" })
    ).rejects.toThrow("must use the '.tsx' extension");
  });

  it("imports native TMX maps with external TSX tilesets", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const source = await sourceBoard();
    const imported = await importTiledBoard({ projectPath, sourcePath: source.mapPath, boardId: "NATIVE", name: "Native" });

    expect(imported.boards[0]).toMatchObject({ width: 2, height: 1, tilesets: [{ id: "TERRAIN", tileCount: 1 }] });
    await expect(fs.readFile(path.join(projectPath, ".chisel", "tiled", "NATIVE", "images", "TERRAIN", "TERRAIN.png"))).resolves.toEqual(
      onePixelPng
    );
  });

  it("deletes an unused managed tileset and rejects one still used by map cells", async () => {
    const usedProject = await temporaryDirectory("chisel-tiled-project-");
    const usedSource = await sourceBoard();
    await importTiledBoard({ projectPath: usedProject, sourcePath: usedSource.mapPath, boardId: "USED", name: "Used" });
    await expect(deleteTiledTileset({ projectPath: usedProject, boardId: "USED", tilesetId: "TERRAIN" })).rejects.toThrow(
      "still used by cells"
    );

    const unusedProject = await temporaryDirectory("chisel-tiled-project-");
    const unusedSource = await sourceBoard({ data: "0,0" });
    const imported = await importTiledBoard({
      projectPath: unusedProject,
      sourcePath: unusedSource.mapPath,
      boardId: "UNUSED",
      name: "Unused"
    });
    expect(imported.boards[0].tilesets).toHaveLength(1);
    const deleted = await deleteTiledTileset({ projectPath: unusedProject, boardId: "UNUSED", tilesetId: "TERRAIN" });
    expect(deleted.boards[0].tilesets).toEqual([]);
    await expect(fs.access(path.join(unusedProject, ".chisel", "tiled", "UNUSED", "tilesets", "TERRAIN.tsx"))).rejects.toThrow();
    expect((await readTerrainTable(unusedProject, TERRAIN_TILESETS_TABLE)).rows).toEqual([]);
  });

  it("blocks tileset deletion when a biome profile uses a sample containing it", async () => {
    const projectPath = await temporaryDirectory("chisel-tiled-project-");
    const source = await sourceBoard();
    await importTiledBoard({ projectPath, sourcePath: source.mapPath, boardId: "BOARD", name: "Board" });
    await saveTiledAuthoring({
      projectPath,
      boardId: "BOARD",
      authoring: {
        tileBindings: {},
        samples: [
          {
            slug: "SHORE",
            layerIds: [1],
            x: 0,
            y: 0,
            width: 2,
            height: 1,
            allowRotations: false,
            allowReflections: false
          }
        ]
      }
    });
    await writeTerrainTableRows(projectPath, TERRAIN_BIOMES_TABLE, [
      tableRow("COAST", [rowValue(TERRAIN_BIOME_COLUMNS.label, "Coast"), rowValue(TERRAIN_BIOME_COLUMNS.description, "")])
    ]);
    await writeTerrainTableRows(projectPath, TERRAIN_BIOME_PROFILES_TABLE, [
      tableRow("COAST_SHORE", [
        rowValue(TERRAIN_BIOME_PROFILE_COLUMNS.biome, "COAST"),
        rowValue(TERRAIN_BIOME_PROFILE_COLUMNS.sample, "BOARD_SHORE"),
        rowValue(TERRAIN_BIOME_PROFILE_COLUMNS.weight, 1)
      ])
    ]);

    await expect(deleteTiledTileset({ projectPath, boardId: "BOARD", tilesetId: "TERRAIN" })).rejects.toThrow(
      "used by biome profile COAST"
    );
  });
});
