import type { TerrainApprovedAsset, TerrainApprovedCellOverride, TerrainResolvedCellMetadata, TerrainTileStack } from "./terrain-authoring";

export interface ResolvedApprovedTerrainCell {
  metadata: TerrainResolvedCellMetadata;
  tiles: TerrainTileStack;
}

export function resolveApprovedTerrainCell(asset: TerrainApprovedAsset, index: number): ResolvedApprovedTerrainCell {
  const baseTiles = asset.cells[index];
  const baseMetadata = asset.cellMetadata[index];
  if (!baseTiles || !baseMetadata) throw new Error(`Approved terrain cell ${index} is outside '${asset.slug}'`);
  const override = asset.cellOverrides.find((entry) => entry.index === index);
  if (!override) return { tiles: baseTiles, metadata: baseMetadata };
  return {
    tiles: override.tiles,
    metadata: {
      ...baseMetadata,
      blocking: override.blocking,
      ...(override.collision
        ? { collision: { resolution: override.collision.resolution, cells: [...override.collision.cells] } }
        : { collision: undefined }),
      elevation: override.elevation,
      tags: override.tags
    }
  };
}

export function setApprovedTerrainCellOverride(
  asset: TerrainApprovedAsset,
  index: number,
  tiles: TerrainTileStack,
  metadata: TerrainResolvedCellMetadata
): TerrainApprovedAsset {
  const baseTiles = asset.cells[index];
  const baseMetadata = asset.cellMetadata[index];
  if (!baseTiles || !baseMetadata) throw new Error(`Approved terrain cell ${index} is outside '${asset.slug}'`);
  const matchesBase =
    JSON.stringify(tiles) === JSON.stringify(baseTiles) &&
    metadata.blocking === baseMetadata.blocking &&
    JSON.stringify(metadata.collision) === JSON.stringify(baseMetadata.collision) &&
    metadata.elevation === baseMetadata.elevation &&
    JSON.stringify(metadata.tags) === JSON.stringify(baseMetadata.tags);
  const remaining = asset.cellOverrides.filter((entry) => entry.index !== index);
  const cellOverrides = matchesBase
    ? remaining
    : [
        ...remaining,
        {
          index,
          tiles: tiles.map((tile) => (tile ? { ...tile } : null)),
          blocking: metadata.blocking,
          ...(metadata.collision ? { collision: { resolution: metadata.collision.resolution, cells: [...metadata.collision.cells] } } : {}),
          elevation: metadata.elevation,
          tags: [...metadata.tags]
        }
      ].sort((left, right) => left.index - right.index);
  return refreshApprovedTerrainMetrics({ ...asset, cellOverrides });
}

export function revertApprovedTerrainCell(asset: TerrainApprovedAsset, index: number): TerrainApprovedAsset {
  return refreshApprovedTerrainMetrics({ ...asset, cellOverrides: asset.cellOverrides.filter((entry) => entry.index !== index) });
}

export function refreshApprovedTerrainMetrics(asset: TerrainApprovedAsset): TerrainApprovedAsset {
  const metadata = asset.cells.map((_, index) => resolveApprovedTerrainCell(asset, index).metadata);
  return {
    ...asset,
    metrics: {
      ...asset.metrics,
      walkableComponents: countWalkableComponents(metadata, asset.width, asset.height),
      reachableAnchors: reachableAnchorCount(asset, metadata),
      requiredAnchors: asset.anchors.length
    }
  };
}

function countWalkableComponents(metadata: TerrainResolvedCellMetadata[], width: number, height: number): number {
  const visited = new Uint8Array(metadata.length);
  let components = 0;
  for (let start = 0; start < metadata.length; start += 1) {
    if (visited[start] === 1 || metadata[start].blocking) continue;
    components += 1;
    const queue = [start];
    visited[start] = 1;
    while (queue.length > 0) {
      const index = queue.shift()!;
      const x = index % width;
      const y = Math.floor(index / width);
      for (const [offsetX, offsetY] of neighborOffsets) {
        const neighborX = x + offsetX;
        const neighborY = y + offsetY;
        if (neighborX < 0 || neighborX >= width || neighborY < 0 || neighborY >= height) continue;
        const neighbor = neighborY * width + neighborX;
        if (visited[neighbor] === 0 && !metadata[neighbor].blocking) {
          visited[neighbor] = 1;
          queue.push(neighbor);
        }
      }
    }
  }
  return components;
}

function reachableAnchorCount(asset: TerrainApprovedAsset, metadata: TerrainResolvedCellMetadata[]): number {
  if (asset.anchors.length === 0) return 0;
  const first = asset.anchors[0];
  const firstIndex = first.y * asset.width + first.x;
  if (metadata[firstIndex]?.blocking !== false) return 0;
  const visited = new Uint8Array(metadata.length);
  const queue = [firstIndex];
  visited[firstIndex] = 1;
  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % asset.width;
    const y = Math.floor(index / asset.width);
    for (const [offsetX, offsetY] of neighborOffsets) {
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (neighborX < 0 || neighborX >= asset.width || neighborY < 0 || neighborY >= asset.height) continue;
      const neighbor = neighborY * asset.width + neighborX;
      if (visited[neighbor] === 0 && !metadata[neighbor].blocking) {
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }
  return asset.anchors.filter((anchor) => visited[anchor.y * asset.width + anchor.x] === 1).length;
}

const neighborOffsets = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0]
] as const;

export function approvedTerrainOverride(asset: TerrainApprovedAsset, index: number): TerrainApprovedCellOverride | undefined {
  return asset.cellOverrides.find((entry) => entry.index === index);
}
