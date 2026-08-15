import {
  terrainTileKey,
  type TerrainSample,
  type TerrainSampleCell,
  type TerrainTileBinding,
  type TerrainTileRef,
  type TerrainWorkspaceView
} from "./terrain-authoring";

export const terrainWfcPatternSizes = [2, 3, 4] as const;
export type TerrainWfcPatternSize = (typeof terrainWfcPatternSizes)[number];
export const terrainWfcDefaultPatternSize: TerrainWfcPatternSize = 2;
export const terrainWfcSectorSizes = [6, 8, 10, 12, 16] as const;
export type TerrainWfcSectorSize = (typeof terrainWfcSectorSizes)[number];

export type TerrainWfcDirection = "north" | "east" | "south" | "west";

export interface TerrainWfcPattern {
  id: number;
  sampleOccurrences: Record<string, number>;
  symbols: string[];
  weight: number;
}

export interface TerrainWfcVisualVariant {
  cell: TerrainSampleCell;
  weight: number;
}

export interface TerrainWfcLibrary {
  adjacency: Record<TerrainWfcDirection, number[][]>;
  patternSize: number;
  patterns: TerrainWfcPattern[];
  sampleStats: Record<string, TerrainWfcSampleStats>;
  sampleSlugs: string[];
  visualVariants: Record<string, TerrainWfcVisualVariant[]>;
}

export interface TerrainWfcSampleStats {
  extractedOccurrences: number;
  uniquePatterns: number;
  viablePatterns: number;
}

export interface TerrainWfcPatternDirectionDiagnostic {
  compatiblePatterns: number;
  viableCompatiblePatterns: number;
}

export interface TerrainWfcPatternDiagnostic {
  directions: Record<TerrainWfcDirection, TerrainWfcPatternDirectionDiagnostic>;
  patternId: number;
  viable: boolean;
}

export interface TerrainWfcOutput {
  attempts: number;
  cells: TerrainSampleCell[];
  height: number;
  seamWidth: number;
  sectorCount: number;
  seed: number;
  width: number;
}

type Matrix = readonly [number, number, number, number];

interface GridTransform {
  matrix: Matrix;
  quarterTurns: number;
  reflected: boolean;
}

interface SolveOptions {
  constraints?: Array<string | undefined>;
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

function transformCell(cell: TerrainSampleCell, transform: GridTransform): TerrainSampleCell {
  return cell.map((tile) => (tile ? transformTile(tile, transform) : null));
}

function transformPattern(cells: TerrainSampleCell[], size: number, transform: GridTransform): TerrainSampleCell[] {
  const transformed = Array<TerrainSampleCell>(cells.length);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [targetX, targetY] = transformPoint(x, y, size, transform);
      transformed[targetY * size + targetX] = transformCell(cells[y * size + x], transform);
    }
  }
  return transformed;
}

function tileVisualKey(tile: TerrainTileRef): string {
  return `${tile.tilesetId}:${tile.localId}:${tile.orientation}`;
}

function visualCellKey(cell: TerrainSampleCell): string {
  return cell.map((tile) => (tile ? tileVisualKey(tile) : "-")).join("/");
}

function logicalCellKey(cell: TerrainSampleCell, bindings: Record<string, TerrainTileBinding>): string {
  return cell
    .map((tile) => {
      if (!tile) return "-";
      const binding = bindings[terrainTileKey(tile.tilesetId, tile.localId)];
      if (!binding) throw new Error(`Painted tile '${tile.tilesetId}:${tile.localId}' needs a tile binding and WFC symbol`);
      return `${binding.wfcSymbol}@${tile.orientation}`;
    })
    .join("/");
}

function patternOverlapKey(pattern: TerrainWfcPattern, size: number, direction: TerrainWfcDirection, side: "source" | "neighbor"): string {
  const [offsetX, offsetY] = directionOffsets[direction];
  const cells: string[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const neighborX = x - offsetX;
      const neighborY = y - offsetY;
      if (neighborX < 0 || neighborX >= size || neighborY < 0 || neighborY >= size) continue;
      cells.push(pattern.symbols[side === "source" ? y * size + x : neighborY * size + neighborX]);
    }
  }
  return cells.join("|");
}

export function compileTerrainWfcLibrary(
  workspace: Pick<TerrainWorkspaceView, "samples" | "tileBindings">,
  options: { patternSize?: TerrainWfcPatternSize } = {}
): TerrainWfcLibrary {
  if (workspace.samples.length === 0) throw new Error("Create at least one WFC sample before compiling a preview");
  const patternSize = options.patternSize ?? terrainWfcDefaultPatternSize;
  if (!terrainWfcPatternSizes.includes(patternSize)) throw new Error(`Unsupported WFC overlap size ${patternSize}`);
  const patterns: TerrainWfcPattern[] = [];
  const patternByKey = new Map<string, TerrainWfcPattern>();
  const visualVariantMaps = new Map<string, Map<string, TerrainWfcVisualVariant>>();
  const sampleStats: Record<string, TerrainWfcSampleStats> = {};
  for (const sample of workspace.samples) {
    if (sample.width < patternSize || sample.height < patternSize) {
      throw new Error(`Sample '${sample.slug}' must be at least ${patternSize}×${patternSize} for a ${patternSize}×${patternSize} overlap`);
    }
    if (sample.cells.some((cell) => cell[0] === null)) {
      throw new Error(`Sample '${sample.slug}' must have its base layer fully painted before compiling`);
    }
    const occurrences: TerrainSampleCell[][] = [];
    const patternRows = sample.periodicInput ? sample.height : sample.height - patternSize + 1;
    const patternColumns = sample.periodicInput ? sample.width : sample.width - patternSize + 1;
    for (let patternY = 0; patternY < patternRows; patternY += 1) {
      for (let patternX = 0; patternX < patternColumns; patternX += 1) {
        const cells: TerrainSampleCell[] = [];
        for (let y = 0; y < patternSize; y += 1) {
          for (let x = 0; x < patternSize; x += 1) {
            const sourceX = (patternX + x) % sample.width;
            const sourceY = (patternY + y) % sample.height;
            cells.push(sample.cells[sourceY * sample.width + sourceX]);
          }
        }
        for (const transform of sampleTransforms(sample)) occurrences.push(transformPattern(cells, patternSize, transform));
      }
    }
    const contribution = 1 / occurrences.length;
    for (const cells of occurrences) {
      const symbols = cells.map((cell) => logicalCellKey(cell, workspace.tileBindings));
      const key = symbols.join("|");
      let pattern = patternByKey.get(key);
      if (!pattern) {
        pattern = { symbols, id: patterns.length, sampleOccurrences: {}, weight: 0 };
        patterns.push(pattern);
        patternByKey.set(key, pattern);
      }
      pattern.sampleOccurrences[sample.slug] = (pattern.sampleOccurrences[sample.slug] ?? 0) + 1;
      pattern.weight += contribution;
      for (const [index, symbol] of symbols.entries()) {
        let variants = visualVariantMaps.get(symbol);
        if (!variants) {
          variants = new Map();
          visualVariantMaps.set(symbol, variants);
        }
        const cell = cells[index];
        const visualKey = visualCellKey(cell);
        const variant = variants.get(visualKey);
        if (variant) variant.weight += contribution;
        else variants.set(visualKey, { cell, weight: contribution });
      }
    }
    sampleStats[sample.slug] = { extractedOccurrences: occurrences.length, uniquePatterns: 0, viablePatterns: 0 };
  }
  const adjacency = Object.fromEntries(directions.map((direction) => [direction, patterns.map(() => [] as number[])])) as Record<
    TerrainWfcDirection,
    number[][]
  >;
  for (const direction of directions) {
    const neighborsByOverlap = new Map<string, number[]>();
    for (const pattern of patterns) {
      const key = patternOverlapKey(pattern, patternSize, direction, "neighbor");
      const matching = neighborsByOverlap.get(key);
      if (matching) matching.push(pattern.id);
      else neighborsByOverlap.set(key, [pattern.id]);
    }
    for (const pattern of patterns) {
      adjacency[direction][pattern.id] = neighborsByOverlap.get(patternOverlapKey(pattern, patternSize, direction, "source")) ?? [];
    }
  }
  const viablePatternIds = terrainWfcViablePatternIds({ adjacency, patterns });
  for (const sample of workspace.samples) {
    const contributed = patterns.filter((pattern) => pattern.sampleOccurrences[sample.slug] !== undefined);
    sampleStats[sample.slug].uniquePatterns = contributed.length;
    sampleStats[sample.slug].viablePatterns = contributed.filter((pattern) => viablePatternIds.has(pattern.id)).length;
  }
  return {
    adjacency,
    patternSize,
    patterns,
    sampleStats,
    sampleSlugs: workspace.samples.map((sample) => sample.slug),
    visualVariants: Object.fromEntries([...visualVariantMaps].map(([symbol, variants]) => [symbol, [...variants.values()]]))
  };
}

export function terrainWfcViablePatternIds(library: Pick<TerrainWfcLibrary, "adjacency" | "patterns">): Set<number> {
  const viable = new Set(library.patterns.map((pattern) => pattern.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const patternId of [...viable]) {
      if (directions.some((direction) => !library.adjacency[direction][patternId].some((neighbor) => viable.has(neighbor)))) {
        viable.delete(patternId);
        changed = true;
      }
    }
  }
  return viable;
}

export function terrainWfcPatternDiagnostics(library: Pick<TerrainWfcLibrary, "adjacency" | "patterns">): TerrainWfcPatternDiagnostic[] {
  const viablePatternIds = terrainWfcViablePatternIds(library);
  return library.patterns.map((pattern) => ({
    directions: Object.fromEntries(
      directions.map((direction) => {
        const compatiblePatternIds = library.adjacency[direction][pattern.id];
        return [
          direction,
          {
            compatiblePatterns: compatiblePatternIds.length,
            viableCompatiblePatterns: compatiblePatternIds.filter((patternId) => viablePatternIds.has(patternId)).length
          }
        ];
      })
    ) as Record<TerrainWfcDirection, TerrainWfcPatternDirectionDiagnostic>,
    patternId: pattern.id,
    viable: viablePatternIds.has(pattern.id)
  }));
}

export function terrainWfcAdjacencyProblem(library: TerrainWfcLibrary): string | undefined {
  if (terrainWfcViablePatternIds(library).size === 0) {
    return "No logical pattern belongs to a cycle that can continue in every direction. Paint recurring open space around features, or use periodic input only when opposite edges are intentionally compatible.";
  }
  const emptyDirections = directions.filter((direction) => library.adjacency[direction].every((neighbors) => neighbors.length === 0));
  if (emptyDirections.length === 0) return undefined;
  const labels = emptyDirections.map((direction) => direction[0].toUpperCase()).join(", ");
  return `No compatible logical overlaps were learned for ${labels}. Adjacent patterns must share the same WFC symbols across their ${library.patternSize - 1}-cell border.`;
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

interface EntropyQueueEntry {
  entropy: number;
  index: number;
  revision: number;
  tieBreaker: number;
}

class EntropyQueue {
  private readonly entries: EntropyQueueEntry[] = [];

  public push(entry: EntropyQueueEntry): void {
    this.entries.push(entry);
    let index = this.entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.precedes(this.entries[index], this.entries[parent])) break;
      [this.entries[index], this.entries[parent]] = [this.entries[parent], this.entries[index]];
      index = parent;
    }
  }

  public pop(): EntropyQueueEntry | undefined {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (!first || !last || this.entries.length === 0) return first;
    this.entries[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.entries.length && this.precedes(this.entries[left], this.entries[smallest])) smallest = left;
      if (right < this.entries.length && this.precedes(this.entries[right], this.entries[smallest])) smallest = right;
      if (smallest === index) break;
      [this.entries[index], this.entries[smallest]] = [this.entries[smallest], this.entries[index]];
      index = smallest;
    }
    return first;
  }

  private precedes(left: EntropyQueueEntry, right: EntropyQueueEntry): boolean {
    return left.entropy < right.entropy || (left.entropy === right.entropy && left.tieBreaker < right.tieBreaker);
  }
}

function solvePatterns(library: TerrainWfcLibrary, width: number, height: number, seed: number, options: SolveOptions = {}): number[] {
  const waveWidth = width - library.patternSize + 1;
  const waveHeight = height - library.patternSize + 1;
  const cellCount = waveWidth * waveHeight;
  const patternCount = library.patterns.length;
  const viablePatternIds = [...terrainWfcViablePatternIds(library)];
  const viable = new Uint8Array(patternCount);
  for (const patternId of viablePatternIds) viable[patternId] = 1;
  const viableAdjacency = directions.map((direction) =>
    library.adjacency[direction].map((neighbors) => neighbors.filter((patternId) => viable[patternId] === 1))
  );
  const allowed = new Uint8Array(cellCount * patternCount);
  const compatible = new Uint32Array(cellCount * patternCount * directions.length);
  const remaining = new Uint32Array(cellCount);
  const weightSums = new Float64Array(cellCount);
  const weightLogSums = new Float64Array(cellCount);
  const revisions = new Uint32Array(cellCount);
  const entropyQueue = new EntropyQueue();
  const random = randomGenerator(seed);
  let initialWeightSum = 0;
  let initialWeightLogSum = 0;
  for (const patternId of viablePatternIds) {
    const weight = library.patterns[patternId].weight;
    initialWeightSum += weight;
    initialWeightLogSum += weight * Math.log(weight);
  }
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    remaining[cellIndex] = viablePatternIds.length;
    weightSums[cellIndex] = initialWeightSum;
    weightLogSums[cellIndex] = initialWeightLogSum;
    for (const patternId of viablePatternIds) {
      const stateIndex = cellIndex * patternCount + patternId;
      allowed[stateIndex] = 1;
      for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
        compatible[stateIndex * directions.length + directionIndex] = viableAdjacency[directionIndex][patternId].length;
      }
    }
  }

  function queueEntropy(index: number): void {
    if (remaining[index] <= 1) return;
    const sum = weightSums[index];
    entropyQueue.push({
      entropy: Math.log(sum) - weightLogSums[index] / sum,
      index,
      revision: revisions[index],
      tieBreaker: random()
    });
  }

  function weightedChoice(index: number): number {
    let cursor = random() * weightSums[index];
    let fallback = -1;
    const stateStart = index * patternCount;
    for (let patternId = 0; patternId < patternCount; patternId += 1) {
      if (allowed[stateStart + patternId] === 0) continue;
      fallback = patternId;
      cursor -= library.patterns[patternId].weight;
      if (cursor <= 0) return patternId;
    }
    if (fallback < 0) throw new Error("Cannot choose from an empty WFC cell");
    return fallback;
  }

  function banAndPropagate(initialBans: Array<readonly [number, number]>): number[] {
    const removedCells: number[] = [];
    const removedPatterns: number[] = [];
    const dirtyCells: number[] = [];
    const dirty = new Uint8Array(cellCount);

    function ban(cellIndex: number, patternId: number): void {
      const stateIndex = cellIndex * patternCount + patternId;
      if (allowed[stateIndex] === 0) return;
      allowed[stateIndex] = 0;
      remaining[cellIndex] -= 1;
      const weight = library.patterns[patternId].weight;
      weightSums[cellIndex] -= weight;
      weightLogSums[cellIndex] -= weight * Math.log(weight);
      revisions[cellIndex] += 1;
      removedCells.push(cellIndex);
      removedPatterns.push(patternId);
      if (dirty[cellIndex] === 0) {
        dirty[cellIndex] = 1;
        dirtyCells.push(cellIndex);
      }
      if (remaining[cellIndex] === 0) {
        throw new Error(`WFC contradiction at ${cellIndex % waveWidth},${Math.floor(cellIndex / waveWidth)}`);
      }
    }

    for (const [cellIndex, patternId] of initialBans) ban(cellIndex, patternId);
    let queueIndex = 0;
    while (queueIndex < removedCells.length) {
      const sourceIndex = removedCells[queueIndex];
      const removedPatternId = removedPatterns[queueIndex];
      queueIndex += 1;
      const x = sourceIndex % waveWidth;
      const y = Math.floor(sourceIndex / waveWidth);
      for (let directionIndex = 0; directionIndex < directions.length; directionIndex += 1) {
        const direction = directions[directionIndex];
        const [offsetX, offsetY] = directionOffsets[direction];
        const neighborX = x + offsetX;
        const neighborY = y + offsetY;
        if (neighborX < 0 || neighborX >= waveWidth || neighborY < 0 || neighborY >= waveHeight) continue;
        const neighborIndex = neighborY * waveWidth + neighborX;
        const oppositeDirectionIndex = (directionIndex + 2) % directions.length;
        for (const neighborPatternId of viableAdjacency[directionIndex][removedPatternId]) {
          const neighborStateIndex = neighborIndex * patternCount + neighborPatternId;
          if (allowed[neighborStateIndex] === 0) continue;
          const supportIndex = neighborStateIndex * directions.length + oppositeDirectionIndex;
          if (compatible[supportIndex] === 0) throw new Error("WFC support count became inconsistent");
          compatible[supportIndex] -= 1;
          if (compatible[supportIndex] === 0) ban(neighborIndex, neighborPatternId);
        }
      }
    }
    return dirtyCells;
  }

  if (options.constraints) {
    if (options.constraints.length !== width * height) throw new Error("WFC constraint grid does not match output dimensions");
    const bans: Array<readonly [number, number]> = [];
    for (let anchorY = 0; anchorY < waveHeight; anchorY += 1) {
      for (let anchorX = 0; anchorX < waveWidth; anchorX += 1) {
        const waveIndex = anchorY * waveWidth + anchorX;
        for (const patternId of viablePatternIds) {
          const pattern = library.patterns[patternId];
          let conflicts = false;
          for (let y = 0; y < library.patternSize && !conflicts; y += 1) {
            for (let x = 0; x < library.patternSize; x += 1) {
              const fixed = options.constraints[(anchorY + y) * width + anchorX + x];
              if (fixed !== undefined && fixed !== pattern.symbols[y * library.patternSize + x]) {
                conflicts = true;
                break;
              }
            }
          }
          if (conflicts) bans.push([waveIndex, patternId]);
        }
      }
    }
    banAndPropagate(bans);
  }

  for (let index = 0; index < cellCount; index += 1) queueEntropy(index);
  while (true) {
    let selected: EntropyQueueEntry | undefined;
    while ((selected = entropyQueue.pop())) {
      if (selected.revision === revisions[selected.index] && remaining[selected.index] > 1) break;
    }
    if (!selected) break;
    const chosenPatternId = weightedChoice(selected.index);
    const bans: Array<readonly [number, number]> = [];
    for (let patternId = 0; patternId < patternCount; patternId += 1) {
      if (patternId !== chosenPatternId) bans.push([selected.index, patternId]);
    }
    for (const dirtyIndex of banAndPropagate(bans)) queueEntropy(dirtyIndex);
  }
  return Array.from({ length: cellCount }, (_, cellIndex) => {
    const stateStart = cellIndex * patternCount;
    for (let patternId = 0; patternId < patternCount; patternId += 1) {
      if (allowed[stateStart + patternId] === 1) return patternId;
    }
    throw new Error("WFC completed with an empty cell");
  });
}

function reconstructSymbols(library: TerrainWfcLibrary, patternIds: number[], width: number, height: number): string[] {
  const waveWidth = width - library.patternSize + 1;
  const cells = Array<string | undefined>(width * height).fill(undefined);
  for (const [anchorIndex, patternId] of patternIds.entries()) {
    const anchorX = anchorIndex % waveWidth;
    const anchorY = Math.floor(anchorIndex / waveWidth);
    const pattern = library.patterns[patternId];
    for (let y = 0; y < library.patternSize; y += 1) {
      for (let x = 0; x < library.patternSize; x += 1) {
        const outputIndex = (anchorY + y) * width + anchorX + x;
        const value = pattern.symbols[y * library.patternSize + x];
        if (cells[outputIndex] !== undefined && cells[outputIndex] !== value) {
          throw new Error("Compatible WFC patterns reconstructed conflicting logical cells");
        }
        cells[outputIndex] = value;
      }
    }
  }
  return cells.map((cell) => {
    if (cell === undefined) throw new Error("WFC output contains an unresolved logical cell");
    return cell;
  });
}

function chooseVisualCells(library: TerrainWfcLibrary, symbols: string[], seed: number): TerrainSampleCell[] {
  const random = randomGenerator(seed);
  return symbols.map((symbol) => {
    const variants = library.visualVariants[symbol];
    if (!variants?.length) throw new Error(`Logical WFC cell '${symbol}' has no visual variants`);
    const weightSum = variants.reduce((sum, variant) => sum + variant.weight, 0);
    let cursor = random() * weightSum;
    for (const variant of variants) {
      cursor -= variant.weight;
      if (cursor <= 0) return variant.cell.map((tile) => (tile ? { ...tile } : null));
    }
    return variants[variants.length - 1].cell.map((tile) => (tile ? { ...tile } : null));
  });
}

function solveSymbolsWithRetries(
  library: TerrainWfcLibrary,
  width: number,
  height: number,
  seed: number,
  maxAttempts: number,
  constraints?: Array<string | undefined>
): { attempts: number; seed: number; symbols: string[] } {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    try {
      return {
        attempts: attempt + 1,
        seed: attemptSeed,
        symbols: reconstructSymbols(library, solvePatterns(library, width, height, attemptSeed, { constraints }), width, height)
      };
    } catch (caught) {
      lastError = caught;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`WFC could not produce a ${width}×${height} result after ${maxAttempts} attempts: ${detail}`);
}

function validateOutputRequest(library: TerrainWfcLibrary, width: number, height: number): void {
  if (width < library.patternSize || height < library.patternSize) {
    throw new Error(`WFC preview must be at least ${library.patternSize}×${library.patternSize} cells`);
  }
  if (library.patterns.length === 0) throw new Error("The WFC library contains no patterns");
  const adjacencyProblem = terrainWfcAdjacencyProblem(library);
  if (adjacencyProblem) throw new Error(adjacencyProblem);
}

export function generateTerrainWfcOutput(
  library: TerrainWfcLibrary,
  options: { height: number; maxAttempts?: number; seed: number; width: number }
): TerrainWfcOutput {
  const width = Math.floor(options.width);
  const height = Math.floor(options.height);
  validateOutputRequest(library, width, height);
  const solved = solveSymbolsWithRetries(library, width, height, options.seed, options.maxAttempts ?? 20);
  return {
    attempts: solved.attempts,
    cells: chooseVisualCells(library, solved.symbols, solved.seed ^ 0x85ebca6b),
    height,
    seamWidth: 0,
    sectorCount: 1,
    seed: solved.seed,
    width
  };
}

export function generateTerrainWfcSectorOutput(
  library: TerrainWfcLibrary,
  options: { height: number; maxAttempts?: number; sectorSize: TerrainWfcSectorSize; seed: number; width: number }
): TerrainWfcOutput {
  const width = Math.floor(options.width);
  const height = Math.floor(options.height);
  validateOutputRequest(library, width, height);
  if (!terrainWfcSectorSizes.includes(options.sectorSize)) throw new Error(`Unsupported WFC sector size ${options.sectorSize}`);
  if (options.sectorSize < library.patternSize) throw new Error("Sector size must be at least the WFC sampling size");
  const seamWidth = library.patternSize - 1;
  const stride = options.sectorSize + seamWidth;
  const maxAttempts = options.maxAttempts ?? 20;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const assemblySeed = (options.seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    const constraints = Array<string | undefined>(width * height).fill(undefined);
    let sectorCount = 0;
    try {
      for (let sectorY = 0; sectorY < height; sectorY += stride) {
        for (let sectorX = 0; sectorX < width; sectorX += stride) {
          const sectorWidth = Math.min(options.sectorSize, width - sectorX);
          const sectorHeight = Math.min(options.sectorSize, height - sectorY);
          if (sectorWidth < library.patternSize || sectorHeight < library.patternSize) continue;
          const sectorSeed = (assemblySeed ^ Math.imul(sectorX + 1, 0x85ebca6b) ^ Math.imul(sectorY + 1, 0xc2b2ae35)) >>> 0;
          const sector = solveSymbolsWithRetries(library, sectorWidth, sectorHeight, sectorSeed, 8);
          sectorCount += 1;
          for (let y = 0; y < sectorHeight; y += 1) {
            for (let x = 0; x < sectorWidth; x += 1) {
              constraints[(sectorY + y) * width + sectorX + x] = sector.symbols[y * sectorWidth + x];
            }
          }
        }
      }
      const stitched = solveSymbolsWithRetries(library, width, height, assemblySeed ^ 0x27d4eb2f, 1, constraints);
      return {
        attempts: attempt + 1,
        cells: chooseVisualCells(library, stitched.symbols, assemblySeed ^ 0x165667b1),
        height,
        seamWidth,
        sectorCount,
        seed: assemblySeed,
        width
      };
    } catch (caught) {
      lastError = caught;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Sector stitching could not produce a ${width}×${height} result after ${maxAttempts} assemblies: ${detail}`);
}

export function terrainOrientationMatrix(orientation: number): Matrix {
  const matrix = orientationMatrices[orientation];
  if (!matrix) throw new Error(`Unknown tile orientation ${orientation}`);
  return matrix;
}
