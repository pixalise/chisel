import type { TerrainTilesetView } from "../../../../shared/terrain-authoring";

export function findEmptyTerrainTileIds(pixels: Uint8ClampedArray, imageWidth: number, imageHeight: number, tileSize: number): Set<number> {
  const columns = Math.floor(imageWidth / tileSize);
  const rows = Math.floor(imageHeight / tileSize);
  const empty = new Set<number>();

  for (let tileY = 0; tileY < rows; tileY += 1) {
    for (let tileX = 0; tileX < columns; tileX += 1) {
      let hasVisiblePixel = false;
      for (let pixelY = 0; pixelY < tileSize && !hasVisiblePixel; pixelY += 1) {
        const rowOffset = (tileY * tileSize + pixelY) * imageWidth;
        for (let pixelX = 0; pixelX < tileSize; pixelX += 1) {
          const alphaIndex = (rowOffset + tileX * tileSize + pixelX) * 4 + 3;
          if (pixels[alphaIndex] !== 0) {
            hasVisiblePixel = true;
            break;
          }
        }
      }
      if (!hasVisiblePixel) empty.add(tileY * columns + tileX);
    }
  }

  return empty;
}

export function loadEmptyTerrainTileIds(tileset: TerrainTilesetView): Promise<Set<number>> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(new Set());
          return;
        }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        resolve(findEmptyTerrainTileIds(pixels, canvas.width, canvas.height, tileset.tileSize));
      } catch {
        resolve(new Set());
      }
    };
    image.onerror = () => resolve(new Set());
    image.src = window.electron.toAssetUrl(tileset.imagePath);
  });
}
