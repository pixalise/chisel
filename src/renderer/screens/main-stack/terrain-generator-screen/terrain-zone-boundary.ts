export interface TerrainZoneBoundarySegment {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export function terrainZoneBoundarySegments(cells: number[], width: number, height: number): TerrainZoneBoundarySegment[] {
  const validCells = new Set(cells.filter((index) => Number.isInteger(index) && index >= 0 && index < width * height));
  const segments: TerrainZoneBoundarySegment[] = [];

  for (const index of validCells) {
    const x = index % width;
    const y = Math.floor(index / width);
    if (y === 0 || !validCells.has(index - width)) segments.push({ x1: x, y1: y, x2: x + 1, y2: y });
    if (x === width - 1 || !validCells.has(index + 1)) segments.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    if (y === height - 1 || !validCells.has(index + width)) segments.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
    if (x === 0 || !validCells.has(index - 1)) segments.push({ x1: x, y1: y + 1, x2: x, y2: y });
  }

  return segments;
}
