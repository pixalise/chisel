import type { TiledBoardView, TiledLayerView } from "./tiled-samples";

export const tiledWfcPatternSize = 3;

export type TiledWfcDirection = "north" | "east" | "south" | "west";

export interface TiledWfcPattern {
  cells: number[];
  id: number;
  sampleOccurrences: Record<string, number>;
  weight: number;
}

export interface TiledWfcLibrary {
  adjacency: Record<TiledWfcDirection, number[][]>;
  layerIds: number[];
  patternSize: number;
  patterns: TiledWfcPattern[];
  sampleSlugs: string[];
}

export interface TiledWfcOutput {
  attempts: number;
  height: number;
  layers: TiledLayerView[];
  seed: number;
  width: number;
}

interface GridTransform {
  matrix: Matrix;
  quarterTurns: number;
  reflected: boolean;
}

type Matrix = readonly [number, number, number, number];

const gidMask = 0x0fffffff;
const horizontalFlipFlag = 0x80000000;
const verticalFlipFlag = 0x40000000;
const diagonalFlipFlag = 0x20000000;
const identityMatrix: Matrix = [1, 0, 0, 1];
const clockwiseMatrix: Matrix = [0, -1, 1, 0];
const horizontalReflectionMatrix: Matrix = [-1, 0, 0, 1];
const directions: TiledWfcDirection[] = ["north", "east", "south", "west"];
const directionOffsets: Record<TiledWfcDirection, readonly [number, number]> = {
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

const orientationEntries = [
  { flags: 0, matrix: identityMatrix },
  { flags: horizontalFlipFlag, matrix: [-1, 0, 0, 1] as Matrix },
  { flags: verticalFlipFlag, matrix: [1, 0, 0, -1] as Matrix },
  { flags: (horizontalFlipFlag | verticalFlipFlag) >>> 0, matrix: [-1, 0, 0, -1] as Matrix },
  { flags: diagonalFlipFlag, matrix: [0, 1, 1, 0] as Matrix },
  { flags: (diagonalFlipFlag | horizontalFlipFlag) >>> 0, matrix: [0, 1, -1, 0] as Matrix },
  { flags: (diagonalFlipFlag | verticalFlipFlag) >>> 0, matrix: [0, -1, 1, 0] as Matrix },
  { flags: (diagonalFlipFlag | horizontalFlipFlag | verticalFlipFlag) >>> 0, matrix: [0, -1, -1, 0] as Matrix }
];
const flagsByMatrix = new Map(orientationEntries.map((entry) => [matrixKey(entry.matrix), entry.flags]));

function transformEncodedGid(encodedGid: number, transform: GridTransform): number {
  const unsigned = encodedGid >>> 0;
  const gid = unsigned & gidMask;
  if (gid === 0) return 0;
  const flags = (unsigned & ~gidMask) >>> 0;
  const orientation = orientationEntries.find((entry) => entry.flags === flags);
  if (!orientation) throw new Error(`Unsupported Tiled tile orientation flags 0x${flags.toString(16)}`);
  const transformed = multiplyMatrix(transform.matrix, orientation.matrix);
  const transformedFlags = flagsByMatrix.get(matrixKey(transformed));
  if (transformedFlags === undefined) throw new Error("Could not encode transformed Tiled tile orientation");
  return (gid | transformedFlags) >>> 0;
}

function sampleTransforms(allowRotations: boolean, allowReflections: boolean): GridTransform[] {
  const quarterTurns = allowRotations ? [0, 1, 2, 3] : [0];
  const reflectedStates = allowReflections ? [false, true] : [false];
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

function transformPattern(cells: number[], layerCount: number, transform: GridTransform): number[] {
  const size = tiledWfcPatternSize;
  const transformed = Array<number>(cells.length).fill(0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [targetX, targetY] = transformPoint(x, y, size, transform);
      for (let layer = 0; layer < layerCount; layer += 1) {
        const sourceIndex = (y * size + x) * layerCount + layer;
        const targetIndex = (targetY * size + targetX) * layerCount + layer;
        transformed[targetIndex] = transformEncodedGid(cells[sourceIndex], transform);
      }
    }
  }
  return transformed;
}

function patternCellEquals(
  left: TiledWfcPattern,
  leftX: number,
  leftY: number,
  right: TiledWfcPattern,
  rightX: number,
  rightY: number,
  layerCount: number
): boolean {
  const size = tiledWfcPatternSize;
  for (let layer = 0; layer < layerCount; layer += 1) {
    if (left.cells[(leftY * size + leftX) * layerCount + layer] !== right.cells[(rightY * size + rightX) * layerCount + layer]) {
      return false;
    }
  }
  return true;
}

function patternsFit(left: TiledWfcPattern, right: TiledWfcPattern, direction: TiledWfcDirection, layerCount: number): boolean {
  const size = tiledWfcPatternSize;
  const [offsetX, offsetY] = directionOffsets[direction];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const rightX = x - offsetX;
      const rightY = y - offsetY;
      if (rightX < 0 || rightX >= size || rightY < 0 || rightY >= size) continue;
      if (!patternCellEquals(left, x, y, right, rightX, rightY, layerCount)) return false;
    }
  }
  return true;
}

export function compileTiledWfcLibrary(board: TiledBoardView): TiledWfcLibrary {
  const samples = board.authoring.samples;
  if (samples.length === 0) throw new Error("Create at least one WFC sample before compiling a preview");
  const layerIds = [...samples[0].layerIds].sort((left, right) => left - right);
  const layerById = new Map(board.layers.map((layer) => [layer.id, layer]));
  for (const layerId of layerIds) {
    if (!layerById.has(layerId)) throw new Error(`WFC sample layer ${layerId} does not exist on board '${board.name}'`);
  }

  const patterns: TiledWfcPattern[] = [];
  const patternByKey = new Map<string, TiledWfcPattern>();
  for (const sample of samples) {
    const sampleLayerIds = [...sample.layerIds].sort((left, right) => left - right);
    if (sampleLayerIds.join(",") !== layerIds.join(",")) {
      throw new Error(`Sample '${sample.slug}' must use the same included layers as '${samples[0].slug}'`);
    }
    if (sample.width < tiledWfcPatternSize || sample.height < tiledWfcPatternSize) {
      throw new Error(`Sample '${sample.slug}' must be at least ${tiledWfcPatternSize}×${tiledWfcPatternSize} cells`);
    }

    const occurrences: number[][] = [];
    const transforms = sampleTransforms(sample.allowRotations, sample.allowReflections);
    for (let patternY = 0; patternY <= sample.height - tiledWfcPatternSize; patternY += 1) {
      for (let patternX = 0; patternX <= sample.width - tiledWfcPatternSize; patternX += 1) {
        const cells: number[] = [];
        for (let y = 0; y < tiledWfcPatternSize; y += 1) {
          for (let x = 0; x < tiledWfcPatternSize; x += 1) {
            const boardIndex = (sample.y + patternY + y) * board.width + sample.x + patternX + x;
            for (const layerId of layerIds) cells.push(layerById.get(layerId)?.data[boardIndex] ?? 0);
          }
        }
        for (const transform of transforms) occurrences.push(transformPattern(cells, layerIds.length, transform));
      }
    }

    const contribution = 1 / occurrences.length;
    for (const cells of occurrences) {
      const key = cells.join(",");
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
    TiledWfcDirection,
    number[][]
  >;
  for (const direction of directions) {
    for (const left of patterns) {
      for (const right of patterns) {
        if (patternsFit(left, right, direction, layerIds.length)) adjacency[direction][left.id].push(right.id);
      }
    }
  }

  return {
    adjacency,
    layerIds,
    patternSize: tiledWfcPatternSize,
    patterns,
    sampleSlugs: samples.map((sample) => sample.slug)
  };
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

function weightedChoice(possibilities: Set<number>, library: TiledWfcLibrary, random: () => number): number {
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

function entropy(possibilities: Set<number>, library: TiledWfcLibrary): number {
  let sum = 0;
  let weightedLogs = 0;
  for (const patternId of possibilities) {
    const weight = library.patterns[patternId].weight;
    sum += weight;
    weightedLogs += weight * Math.log(weight);
  }
  return Math.log(sum) - weightedLogs / sum;
}

function solvePatterns(library: TiledWfcLibrary, width: number, height: number, seed: number): number[] {
  const waveWidth = width - library.patternSize + 1;
  const waveHeight = height - library.patternSize + 1;
  const allPatterns = library.patterns.map((pattern) => pattern.id);
  const wave = Array.from({ length: waveWidth * waveHeight }, () => new Set(allPatterns));
  const adjacencySets = Object.fromEntries(
    directions.map((direction) => [direction, library.adjacency[direction].map((entries) => new Set(entries))])
  ) as Record<TiledWfcDirection, Set<number>[]>;
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
    const selectedPattern = weightedChoice(wave[selectedIndex], library, random);
    wave[selectedIndex] = new Set([selectedPattern]);
    propagate([selectedIndex]);
  }

  return wave.map((possibilities) => {
    const patternId = possibilities.values().next().value;
    if (patternId === undefined) throw new Error("WFC completed with an empty cell");
    return patternId;
  });
}

function reconstructOutput(library: TiledWfcLibrary, patternIds: number[], width: number, height: number): TiledLayerView[] {
  const waveWidth = width - library.patternSize + 1;
  const layerData = library.layerIds.map(() => Array<number | undefined>(width * height).fill(undefined));
  for (const [anchorIndex, patternId] of patternIds.entries()) {
    const anchorX = anchorIndex % waveWidth;
    const anchorY = Math.floor(anchorIndex / waveWidth);
    const pattern = library.patterns[patternId];
    for (let y = 0; y < library.patternSize; y += 1) {
      for (let x = 0; x < library.patternSize; x += 1) {
        const outputIndex = (anchorY + y) * width + anchorX + x;
        for (let layer = 0; layer < library.layerIds.length; layer += 1) {
          const value = pattern.cells[(y * library.patternSize + x) * library.layerIds.length + layer];
          const existing = layerData[layer][outputIndex];
          if (existing !== undefined && existing !== value) throw new Error("Compatible WFC patterns reconstructed conflicting tiles");
          layerData[layer][outputIndex] = value;
        }
      }
    }
  }
  return library.layerIds.map((id, index) => ({
    id,
    name: `Layer ${id}`,
    visible: true,
    opacity: 1,
    data: layerData[index].map((value) => value ?? 0)
  }));
}

export function generateTiledWfcOutput(
  library: TiledWfcLibrary,
  options: { height: number; maxAttempts?: number; seed: number; width: number }
): TiledWfcOutput {
  const width = Math.floor(options.width);
  const height = Math.floor(options.height);
  if (width < library.patternSize || height < library.patternSize) {
    throw new Error(`WFC preview must be at least ${library.patternSize}×${library.patternSize} cells`);
  }
  if (library.patterns.length === 0) throw new Error("The WFC library contains no patterns");
  const maxAttempts = options.maxAttempts ?? 20;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const seed = (options.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    try {
      const patternIds = solvePatterns(library, width, height, seed);
      return { attempts: attempt + 1, height, layers: reconstructOutput(library, patternIds, width, height), seed, width };
    } catch (caught) {
      lastError = caught;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`WFC could not produce a ${width}×${height} preview after ${maxAttempts} attempts: ${detail}`);
}
