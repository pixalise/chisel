import type { TerrainSampleCell, TerrainTileRef, TerrainTilesetView } from "../../../../shared/terrain-authoring";
import { terrainOrientationMatrix } from "../../../../shared/terrain-wfc";

export function drawTerrainTile(
  context: CanvasRenderingContext2D,
  tile: TerrainTileRef,
  tilesets: TerrainTilesetView[],
  images: Map<string, HTMLImageElement>,
  destinationX: number,
  destinationY: number,
  destinationSize: number
): void {
  const tileset = tilesets.find((entry) => entry.id === tile.tilesetId);
  const image = images.get(tile.tilesetId);
  if (!tileset || !image?.complete || image.naturalWidth === 0 || image.naturalHeight === 0) return;
  const sourceX = (tile.localId % tileset.columns) * tileset.tileSize;
  const sourceY = Math.floor(tile.localId / tileset.columns) * tileset.tileSize;
  const matrix = terrainOrientationMatrix(tile.orientation);
  context.save();
  context.translate(destinationX + destinationSize / 2, destinationY + destinationSize / 2);
  context.transform(matrix[0], matrix[2], matrix[1], matrix[3], 0, 0);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    tileset.tileSize,
    tileset.tileSize,
    -destinationSize / 2,
    -destinationSize / 2,
    destinationSize,
    destinationSize
  );
  context.restore();
}

export function drawTerrainCell(
  context: CanvasRenderingContext2D,
  cell: TerrainSampleCell,
  tilesets: TerrainTilesetView[],
  images: Map<string, HTMLImageElement>,
  destinationX: number,
  destinationY: number,
  destinationSize: number
): void {
  for (const tile of cell) {
    if (tile) drawTerrainTile(context, tile, tilesets, images, destinationX, destinationY, destinationSize);
  }
}
