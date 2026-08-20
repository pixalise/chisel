import type { TerrainCollisionMask } from "./terrain-authoring";

interface TerrainCollisionCarrier {
  blocking: boolean;
  collision?: TerrainCollisionMask;
}

export const terrainCollisionResolutions = [1, 2, 4, 8, 16, 32, 64] as const;

export function terrainCollisionResolutionsUpTo(pixelLimit: number): number[] {
  return terrainCollisionResolutions.filter((resolution) => resolution <= pixelLimit);
}

export function hasTerrainCollision(carrier: TerrainCollisionCarrier): boolean {
  return carrier.collision ? carrier.collision.cells.some(Boolean) : carrier.blocking;
}

export function isTerrainCollisionFullyBlocked(carrier: TerrainCollisionCarrier): boolean {
  return carrier.collision ? carrier.collision.cells.every(Boolean) : carrier.blocking;
}

export function terrainCollisionCoverage(carrier: TerrainCollisionCarrier): number {
  if (!carrier.collision) return carrier.blocking ? 1 : 0;
  return carrier.collision.cells.filter(Boolean).length / carrier.collision.cells.length;
}

export function setTerrainCollisionCell<T extends TerrainCollisionCarrier>(
  carrier: T,
  resolution: number,
  index: number,
  blocking: boolean
): T & TerrainCollisionCarrier {
  if (!terrainCollisionResolutions.includes(resolution as (typeof terrainCollisionResolutions)[number])) {
    throw new Error(`Invalid terrain collision resolution ${resolution}`);
  }
  if (!Number.isInteger(index) || index < 0 || index >= resolution * resolution) {
    throw new Error(`Terrain collision index ${index} is outside ${resolution}×${resolution}`);
  }
  const cells = resampleTerrainCollision(carrier, resolution);
  cells[index] = blocking;
  if (cells.every((cell) => cell === cells[0])) {
    const { collision: _, ...rest } = carrier;
    return { ...rest, blocking: cells[0] } as T & TerrainCollisionCarrier;
  }
  return { ...carrier, blocking: false, collision: { resolution, cells } };
}

export function transformTerrainCollision<T extends TerrainCollisionCarrier>(carrier: T, orientation: number): T {
  const mask = carrier.collision;
  if (!mask || orientation === 0) return carrier;
  if (!Number.isInteger(orientation) || orientation < 0 || orientation > 7) {
    throw new Error(`Unknown terrain collision orientation ${orientation}`);
  }
  const cells = Array<boolean>(mask.cells.length);
  for (let y = 0; y < mask.resolution; y += 1) {
    for (let x = 0; x < mask.resolution; x += 1) {
      const [targetX, targetY] = transformPoint(x, y, mask.resolution, orientation);
      cells[targetY * mask.resolution + targetX] = mask.cells[y * mask.resolution + x];
    }
  }
  return { ...carrier, collision: { resolution: mask.resolution, cells } };
}

function resampleTerrainCollision(carrier: TerrainCollisionCarrier, resolution: number): boolean[] {
  if (!carrier.collision) return Array<boolean>(resolution * resolution).fill(carrier.blocking);
  const source = carrier.collision;
  return Array.from({ length: resolution * resolution }, (_, index) => {
    const x = index % resolution;
    const y = Math.floor(index / resolution);
    const sourceX = Math.min(source.resolution - 1, Math.floor(((x + 0.5) / resolution) * source.resolution));
    const sourceY = Math.min(source.resolution - 1, Math.floor(((y + 0.5) / resolution) * source.resolution));
    return source.cells[sourceY * source.resolution + sourceX];
  });
}

function transformPoint(x: number, y: number, size: number, orientation: number): readonly [number, number] {
  let transformedX = orientation >= 4 ? size - 1 - x : x;
  let transformedY = y;
  for (let turn = 0; turn < orientation % 4; turn += 1) {
    const previousX = transformedX;
    transformedX = size - 1 - transformedY;
    transformedY = previousX;
  }
  return [transformedX, transformedY];
}
