import type { TerrainSample, TerrainTileRef, TerrainWorkspaceView } from "./terrain-authoring";

export const terrainWfcPatternSize = 3;

export type TerrainWfcDirection = "north" | "east" | "south" | "west";

export interface TerrainWfcPattern {
  cells: TerrainTileRef[];
  id: number;
  sampleOccurrences: Record<string, number>;
  weight: number;
}

export interface TerrainWfcLibrary {
  adjacency: Record<TerrainWfcDirection, number[][]>;
  patternSize: number;
  patterns: TerrainWfcPattern[];
  sampleSlugs: string[];
}

export interface TerrainWfcOutput {
  attempts: number;
  cells: TerrainTileRef[];
  height: number;
  seed: number;
  width: number;
}

type Matrix = readonly [number, number, number, number];

interface GridTransform {
  matrix: Matrix;
  quarterTurns: number;
  reflected: boolean;
}

const identityMatrix: Matrix = [1, 0, 0, 1];
const clockwiseMatrix: Matrix = [0, -1, 1, 0];
const horizontalReflectionMatrix: Matrix = [-1, 0, 0, 1];
const directions: TerrainWfcDirection[] = ["north", "east", "south", "west"];
const directionOffsets: Record<TerrainWfcDirection, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0]
};

function multiplyMatrix(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[1] * right[2],
    left[0] * right[1] + left[1] * right[3],
    left[2] * right[0] + left[3] * right[2],
    left[2] * right[1] + left[3] * right[3]
  ];
}

function matrixPower(matrix: Matrix, exponent: number): Matrix {
  let result = identityMatrix;
  for (let index = 0; index < exponent; index += 1) result = multiplyMatrix(matrix, result);
  return result;
}

function matrixKey(matrix: Matrix): string {
  return matrix.join(",");
}

const orientationMatrices: Matrix[] = [
  identityMatrix,
  matrixPower(clockwiseMatrix, 1),
  matrixPower(clockwiseMatrix, 2),
  matrixPower(clockwiseMatrix, 3),
  horizontalReflectionMatrix,
  multiplyMatrix(matrixPower(clockwiseMatrix, 1), horizontalReflectionMatrix),
  multiplyMatrix(matrixPower(clockwiseMatrix, 2), horizontalReflectionMatrix),
  multiplyMatrix(matrixPower(clockwiseMatrix, 3), horizontalReflectionMatrix)
];
const orientationByMatrix = new Map(orientationMatrices.map((matrix, index) => [matrixKey(matrix), index]));

function sampleTransforms(sample: TerrainSample): GridTransform[] {
  const quarterTurns = sample.allowRotations ? [0, 1, 2, 3] : [0];
  const reflectedStates = sample.allowReflections ? [false, true] : [false];
  return reflectedStates.flatMap((reflected) =>
    quarterTurns.map((turns) => ({
      reflected,
      quarterTurns: turns,
      matrix: multiplyMatrix(matrixPower(clockwiseMatrix, turns), reflected ? horizontalReflectionMatrix : identityMatrix)
    }))
  );
}

function transformPoint(x: number, y: number, size: number, transform: GridTransform): readonly [number, number] {
  let transformedX = transform.reflected ? size - 1 - x : x;
  let transformedY = y;
  for (let turn = 0; turn < transform.quarterTurns; turn += 1) {
    const previousX = transformedX;
    transformedX = size - 1 - transformedY;
    transformedY = previousX;
  }
  return [transformedX, transformedY];
}

function transformTile(tile: TerrainTileRef, transform: GridTransform): TerrainTileRef {
  const transformed = multiplyMatrix(transform.matrix, orientationMatrices[tile.orientation]);
  const orientation = orientationByMatrix.get(matrixKey(transformed));
  if (orientation === undefined) throw new Error("Could not encode transformed tile orientation");
  return { ...tile, orientation };
}

function transformPattern(cells: TerrainTileRef[], transform: GridTransform): TerrainTileRef[] {
  const size = terrainWfcPatternSize;
  const transformed = Array<TerrainTileRef>(cells.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [targetX, targetY] = transformPoint(x, y, size, transform);
      transformed[targetY * size + targetX] = transformTile(cells[y * size + x], transform);
    }
  }
  return transformed;
}

function tileKey(tile: TerrainTileRef): string {
  return `${tile.tilesetId}:${tile.localId}:${tile.orientation}`;
}

function patternsFit(left: TerrainWfcPattern, right: TerrainWfcPattern, direction: TerrainWfcDirection): boolean {
  const size = terrainWfcPatternSize;
  const [offsetX, offsetY] = directionOffsets[direction];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const rightX = x - offsetX;
      const rightY = y - offsetY;
      if (rightX < 0 || rightX >= size || rightY < 0 || rightY >= size) continue;
      if (tileKey(left.cells[y * size + x]) !== tileKey(right.cells[rightY * size + rightX])) return false;
    }
  }
  return true;
}

export function compileTerrainWfcLibrary(workspace: Pick<TerrainWorkspaceView, "samples">): TerrainWfcLibrary {
  if (workspace.samples.length === 0) throw new Error("Create at least one WFC sample before compiling a preview");
  const patterns: TerrainWfcPattern[] = [];
  const patternByKey = new Map<string, TerrainWfcPattern>();
  for (const sample of workspace.samples) {
    if (sample.cells.some((cell) => cell === null)) throw new Error(`Sample '${sample.slug}' must be fully painted before compiling`);
    const occurrences: TerrainTileRef[][] = [];
    for (let patternY = 0; patternY <= sample.height - terrainWfcPatternSize; patternY += 1) {
      for (let patternX = 0; patternX <= sample.width - terrainWfcPatternSize; patternX += 1) {
        const cells: TerrainTileRef[] = [];
        for (let y = 0; y < terrainWfcPatternSize; y += 1) {
          for (let x = 0; x < terrainWfcPatternSize; x += 1) {
            const cell = sample.cells[(patternY + y) * sample.width + patternX + x];
            if (!cell) throw new Error(`Sample '${sample.slug}' must be fully painted before compiling`);
            cells.push(cell);
          }
        }
        for (const transform of sampleTransforms(sample)) occurrences.push(transformPattern(cells, transform));
      }
    }
    const contribution = 1 / occurrences.length;
    for (const cells of occurrences) {
      const key = cells.map(tileKey).join("|");
      let pattern = patternByKey.get(key);
      if (!pattern) {
        pattern = { cells, id: patterns.length, sampleOccurrences: {}, weight: 0 };
        patterns.push(pattern);
        patternByKey.set(key, pattern);
      }
      pattern.sampleOccurrences[sample.slug] = (pattern.sampleOccurrences[sample.slug] ?? 0) + 1;
      pattern.weight += contribution;
    }
  }
  const adjacency = Object.fromEntries(directions.map((direction) => [direction, patterns.map(() => [] as number[])])) as Record<
    TerrainWfcDirection,
    number[][]
  >;
  for (const direction of directions) {
    for (const left of patterns) {
      for (const right of patterns) {
        if (patternsFit(left, right, direction)) adjacency[direction][left.id].push(right.id);
      }
    }
  }
  return {
    adjacency,
    patternSize: terrainWfcPatternSize,
    patterns,
    sampleSlugs: workspace.samples.map((sample) => sample.slug)
  };
}

export function terrainWfcAdjacencyProblem(library: TerrainWfcLibrary): string | undefined {
  const emptyDirections = directions.filter((direction) => library.adjacency[direction].every((neighbors) => neighbors.length === 0));
  if (emptyDirections.length === 0) return undefined;
  const labels = emptyDirections.map((direction) => direction[0].toUpperCase()).join(", ");
  return `No compatible pattern overlaps were learned for ${labels}. WFC matches exact sprite ids and orientations, not tile roles or tags. A 3×3 sample contributes only one pattern, so author a 4×4 or 5×5 sample containing repeated overlaps that form usable cycles, or add 3×3 samples whose two-cell borders overlap exactly.`;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedChoice(possibilities: Set<number>, library: TerrainWfcLibrary, random: () => number): number {
  const total = [...possibilities].reduce((sum, patternId) => sum + library.patterns[patternId].weight, 0);
  let cursor = random() * total;
  for (const patternId of possibilities) {
    cursor -= library.patterns[patternId].weight;
    if (cursor <= 0) return patternId;
  }
  const fallback = possibilities.values().next().value;
  if (fallback === undefined) throw new Error("Cannot choose from an empty WFC cell");
  return fallback;
}

function entropy(possibilities: Set<number>, library: TerrainWfcLibrary): number {
  let sum = 0;
  let weightedLogs = 0;
  for (const patternId of possibilities) {
    const weight = library.patterns[patternId].weight;
    sum += weight;
    weightedLogs += weight * Math.log(weight);
  }
  return Math.log(sum) - weightedLogs / sum;
}

function solvePatterns(library: TerrainWfcLibrary, width: number, height: number, seed: number): number[] {
  const waveWidth = width - library.patternSize + 1;
  const waveHeight = height - library.patternSize + 1;
  const wave = Array.from({ length: waveWidth * waveHeight }, () => new Set(library.patterns.map((pattern) => pattern.id)));
  const adjacencySets = Object.fromEntries(
    directions.map((direction) => [direction, library.adjacency[direction].map((entries) => new Set(entries))])
  ) as Record<TerrainWfcDirection, Set<number>[]>;
  const random = randomGenerator(seed);

  function propagate(initialIndices: number[]): void {
    const queue = [...initialIndices];
    const queued = new Set(queue);
    while (queue.length > 0) {
      const index = queue.shift();
      if (index === undefined) break;
      queued.delete(index);
      const x = index % waveWidth;
      const y = Math.floor(index / waveWidth);
      for (const direction of directions) {
        const [offsetX, offsetY] = directionOffsets[direction];
        const neighborX = x + offsetX;
        const neighborY = y + offsetY;
        if (neighborX < 0 || neighborX >= waveWidth || neighborY < 0 || neighborY >= waveHeight) continue;
        const neighborIndex = neighborY * waveWidth + neighborX;
        const neighbor = wave[neighborIndex];
        let changed = false;
        for (const candidate of [...neighbor]) {
          const supported = [...wave[index]].some((patternId) => adjacencySets[direction][patternId].has(candidate));
          if (!supported) {
            neighbor.delete(candidate);
            changed = true;
          }
        }
        if (neighbor.size === 0) throw new Error(`WFC contradiction at ${neighborX},${neighborY}`);
        if (changed && !queued.has(neighborIndex)) {
          queue.push(neighborIndex);
          queued.add(neighborIndex);
        }
      }
    }
  }

  propagate(wave.map((_, index) => index));
  while (true) {
    let selectedIndex = -1;
    let selectedEntropy = Number.POSITIVE_INFINITY;
    for (const [index, possibilities] of wave.entries()) {
      if (possibilities.size <= 1) continue;
      const value = entropy(possibilities, library) + random() * 1e-9;
      if (value < selectedEntropy) {
        selectedEntropy = value;
        selectedIndex = index;
      }
    }
    if (selectedIndex < 0) break;
    wave[selectedIndex] = new Set([weightedChoice(wave[selectedIndex], library, random)]);
    propagate([selectedIndex]);
  }
  return wave.map((possibilities) => {
    const patternId = possibilities.values().next().value;
    if (patternId === undefined) throw new Error("WFC completed with an empty cell");
    return patternId;
  });
}

function reconstructOutput(library: TerrainWfcLibrary, patternIds: number[], width: number, height: number): TerrainTileRef[] {
  const waveWidth = width - library.patternSize + 1;
  const cells = Array<TerrainTileRef | undefined>(width * height).fill(undefined);
  for (const [anchorIndex, patternId] of patternIds.entries()) {
    const anchorX = anchorIndex % waveWidth;
    const anchorY = Math.floor(anchorIndex / waveWidth);
    const pattern = library.patterns[patternId];
    for (let y = 0; y < library.patternSize; y += 1) {
      for (let x = 0; x < library.patternSize; x += 1) {
        const outputIndex = (anchorY + y) * width + anchorX + x;
        const value = pattern.cells[y * library.patternSize + x];
        const existing = cells[outputIndex];
        if (existing && tileKey(existing) !== tileKey(value)) throw new Error("Compatible WFC patterns reconstructed conflicting tiles");
        cells[outputIndex] = value;
      }
    }
  }
  return cells.map((cell) => {
    if (!cell) throw new Error("WFC output contains an unresolved cell");
    return cell;
  });
}

export function generateTerrainWfcOutput(
  library: TerrainWfcLibrary,
  options: { height: number; maxAttempts?: number; seed: number; width: number }
): TerrainWfcOutput {
  const width = Math.floor(options.width);
  const height = Math.floor(options.height);
  if (width < library.patternSize || height < library.patternSize) {
    throw new Error(`WFC preview must be at least ${library.patternSize}×${library.patternSize} cells`);
  }
  if (library.patterns.length === 0) throw new Error("The WFC library contains no patterns");
  const adjacencyProblem = terrainWfcAdjacencyProblem(library);
  if (adjacencyProblem) throw new Error(adjacencyProblem);
  const maxAttempts = options.maxAttempts ?? 20;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const seed = (options.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    try {
      return {
        attempts: attempt + 1,
        cells: reconstructOutput(library, solvePatterns(library, width, height, seed), width, height),
        height,
        seed,
        width
      };
    } catch (caught) {
      lastError = caught;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`WFC could not produce a ${width}×${height} preview after ${maxAttempts} attempts: ${detail}`);
}

export function terrainOrientationMatrix(orientation: number): Matrix {
  const matrix = orientationMatrices[orientation];
  if (!matrix) throw new Error(`Unknown tile orientation ${orientation}`);
  return matrix;
}
