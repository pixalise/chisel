import {
  terrainDirections,
  terrainPieceSchema,
  terrainPieceSetSchema,
  terrainSiteTemplateSchema,
  terrainTileKey,
  type TerrainAdjacencyOverride,
  type TerrainApprovedAsset,
  type TerrainCandidateMetric,
  type TerrainDirection,
  type TerrainPiece,
  type TerrainPieceCell,
  type TerrainPieceSet,
  type TerrainPlacement,
  type TerrainResolvedCellMetadata,
  type TerrainSiteTemplate,
  type TerrainSocketProfiles,
  type TerrainTemplateAnchor,
  type TerrainTileBinding,
  type TerrainTileRef,
  type TerrainTileStack
} from "./terrain-authoring";
import { isTerrainCollisionFullyBlocked, transformTerrainCollision } from "./terrain-collision";

type Matrix = readonly [number, number, number, number];

export interface TerrainCompiledVariant {
  id: number;
  piece: TerrainPiece;
  orientation: number;
  width: number;
  height: number;
  cells: TerrainPieceCell[];
  sockets: TerrainSocketProfiles;
  canonicalDirectionByWorld: Record<TerrainDirection, TerrainDirection>;
}

export interface TerrainCompiledState {
  id: number;
  variantId: number;
  pieceSlug: string;
  orientation: number;
  partX: number;
  partY: number;
  variantWidth: number;
  variantHeight: number;
  cell: TerrainPieceCell;
  edges: Record<TerrainDirection, string>;
  weight: number;
}

export interface TerrainCompiledLibrary {
  adjacency: Record<TerrainDirection, number[][]>;
  states: TerrainCompiledState[];
  variants: TerrainCompiledVariant[];
}

export interface TerrainCompatibilityDirection {
  compatiblePieces: string[];
  compatibleStates: number;
  socketSegments: string[];
}

export interface TerrainPieceCompatibility {
  directions: Record<TerrainDirection, TerrainCompatibilityDirection>;
  pieceSlug: string;
  viable: boolean;
}

export interface TerrainValidationIssue {
  code: string;
  message: string;
}

export interface TerrainCandidate {
  complete: boolean;
  sourceTemplate: string;
  seed: number;
  width: number;
  height: number;
  layerCount: number;
  cells: TerrainTileStack[];
  cellMetadata: TerrainResolvedCellMetadata[];
  placements: TerrainPlacement[];
  anchors: TerrainTemplateAnchor[];
  metrics: TerrainCandidateMetric;
  issues: TerrainValidationIssue[];
}

export interface TerrainCandidateResult {
  seed: number;
  candidate?: TerrainCandidate;
  error?: string;
}

interface SolveConstraint {
  allowed: (state: TerrainCompiledState, x: number, y: number) => boolean;
}

interface TerrainGenerationWorkspace {
  adjacencyOverrides: TerrainAdjacencyOverride[];
  pieceSets: TerrainPieceSet[];
  pieces: TerrainPiece[];
  tileBindings: Record<string, TerrainTileBinding>;
}

interface PreparedTerrainGeneration {
  anchorsByCell: Map<number, TerrainTemplateAnchor[]>;
  library: TerrainCompiledLibrary;
  stampRequirements: ReturnType<typeof stampStateRequirements>;
  stateTags: string[][];
  template: TerrainSiteTemplate;
}

interface SolvedPass {
  complete: boolean;
  error?: string;
  placements: TerrainPlacement[];
  stateIds: Array<number | undefined>;
}

const identityMatrix: Matrix = [1, 0, 0, 1];
const clockwiseMatrix: Matrix = [0, -1, 1, 0];
const horizontalReflectionMatrix: Matrix = [-1, 0, 0, 1];
const directionOffsets: Record<TerrainDirection, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0]
};
const oppositeDirections: Record<TerrainDirection, TerrainDirection> = {
  north: "south",
  east: "west",
  south: "north",
  west: "east"
};
const directionByVector = new Map<string, TerrainDirection>([
  ["0,-1", "north"],
  ["1,0", "east"],
  ["0,1", "south"],
  ["-1,0", "west"]
]);

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

function orientationTurns(orientation: number): number {
  return orientation % 4;
}

function orientationReflected(orientation: number): boolean {
  return orientation >= 4;
}

function pieceOrientations(piece: TerrainPiece): number[] {
  const turns = piece.allowRotations ? [0, 1, 2, 3] : [0];
  const reflections = piece.allowReflections ? [false, true] : [false];
  return reflections.flatMap((reflected) => turns.map((turn) => turn + (reflected ? 4 : 0)));
}

function transformedDimensions(width: number, height: number, orientation: number): readonly [number, number] {
  return orientationTurns(orientation) % 2 === 0 ? [width, height] : [height, width];
}

function transformPoint(x: number, y: number, width: number, height: number, orientation: number): readonly [number, number] {
  let transformedX = orientationReflected(orientation) ? width - 1 - x : x;
  let transformedY = y;
  let currentWidth = width;
  let currentHeight = height;
  for (let turn = 0; turn < orientationTurns(orientation); turn += 1) {
    const previousX = transformedX;
    transformedX = currentHeight - 1 - transformedY;
    transformedY = previousX;
    [currentWidth, currentHeight] = [currentHeight, currentWidth];
  }
  return [transformedX, transformedY];
}

function transformDirection(direction: TerrainDirection, orientation: number): TerrainDirection {
  const matrix = orientationMatrices[orientation];
  if (!matrix) throw new Error(`Unknown terrain orientation ${orientation}`);
  const [x, y] = directionOffsets[direction];
  const transformed = directionByVector.get(`${matrix[0] * x + matrix[1] * y},${matrix[2] * x + matrix[3] * y}`);
  if (!transformed) throw new Error(`Could not transform terrain direction '${direction}'`);
  return transformed;
}

function transformTile(tile: TerrainTileRef, orientation: number): TerrainTileRef {
  const matrix = orientationMatrices[orientation];
  const tileMatrix = orientationMatrices[tile.orientation];
  if (!matrix || !tileMatrix) throw new Error("Unknown terrain tile orientation");
  const transformed = orientationByMatrix.get(matrixKey(multiplyMatrix(matrix, tileMatrix)));
  if (transformed === undefined) throw new Error("Could not encode transformed terrain tile orientation");
  return { ...tile, orientation: transformed };
}

function transformCell(cell: TerrainPieceCell, orientation: number): TerrainPieceCell {
  return transformTerrainCollision(
    { ...cell, tiles: cell.tiles.map((tile) => (tile ? transformTile(tile, orientation) : null)) },
    orientation
  );
}

function emptySocketProfiles(width: number, height: number): TerrainSocketProfiles {
  return {
    north: Array<string>(width).fill(""),
    east: Array<string>(height).fill(""),
    south: Array<string>(width).fill(""),
    west: Array<string>(height).fill("")
  };
}

function profileIndex(direction: TerrainDirection, x: number, y: number): number {
  return direction === "north" || direction === "south" ? x : y;
}

function transformPiece(piece: TerrainPiece, orientation: number, id: number): TerrainCompiledVariant {
  const [width, height] = transformedDimensions(piece.width, piece.height, orientation);
  const cells = Array<TerrainPieceCell>(width * height);
  for (let y = 0; y < piece.height; y += 1) {
    for (let x = 0; x < piece.width; x += 1) {
      const [targetX, targetY] = transformPoint(x, y, piece.width, piece.height, orientation);
      cells[targetY * width + targetX] = transformCell(piece.cells[y * piece.width + x], orientation);
    }
  }
  const sockets = emptySocketProfiles(width, height);
  const sourceEdges: Array<readonly [TerrainDirection, number, number, string]> = [];
  for (let x = 0; x < piece.width; x += 1) {
    sourceEdges.push(["north", x, 0, piece.sockets.north[x]], ["south", x, piece.height - 1, piece.sockets.south[x]]);
  }
  for (let y = 0; y < piece.height; y += 1) {
    sourceEdges.push(["west", 0, y, piece.sockets.west[y]], ["east", piece.width - 1, y, piece.sockets.east[y]]);
  }
  for (const [direction, x, y, socket] of sourceEdges) {
    const transformedDirection = transformDirection(direction, orientation);
    const [targetX, targetY] = transformPoint(x, y, piece.width, piece.height, orientation);
    sockets[transformedDirection][profileIndex(transformedDirection, targetX, targetY)] = socket;
  }
  const canonicalDirectionByWorld = {} as Record<TerrainDirection, TerrainDirection>;
  for (const direction of terrainDirections) canonicalDirectionByWorld[transformDirection(direction, orientation)] = direction;
  return { id, piece, orientation, width, height, cells, sockets, canonicalDirectionByWorld };
}

function internalSocket(variantId: number, x: number, y: number, neighborX: number, neighborY: number): string {
  const first = y * 100 + x;
  const second = neighborY * 100 + neighborX;
  return `@INTERNAL_${variantId}_${Math.min(first, second)}_${Math.max(first, second)}`;
}

function stateEdges(variant: TerrainCompiledVariant, x: number, y: number): Record<TerrainDirection, string> {
  return Object.fromEntries(
    terrainDirections.map((direction) => {
      const [offsetX, offsetY] = directionOffsets[direction];
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      const socket =
        neighborX >= 0 && neighborX < variant.width && neighborY >= 0 && neighborY < variant.height
          ? internalSocket(variant.id, x, y, neighborX, neighborY)
          : variant.sockets[direction][profileIndex(direction, x, y)];
      return [direction, socket];
    })
  ) as Record<TerrainDirection, string>;
}

function overridesPermit(
  source: TerrainCompiledState,
  target: TerrainCompiledState,
  worldDirection: TerrainDirection,
  variants: TerrainCompiledVariant[],
  overrides: TerrainAdjacencyOverride[]
): boolean {
  if (source.edges[worldDirection].startsWith("@INTERNAL_")) return true;
  const variant = variants[source.variantId];
  const direction = variant.canonicalDirectionByWorld[worldDirection];
  const matching = overrides.filter((entry) => entry.sourcePiece === source.pieceSlug && entry.direction === direction);
  if (matching.some((entry) => entry.mode === "DENY" && entry.targetPiece === target.pieceSlug)) return false;
  const allowOnly = matching.filter((entry) => entry.mode === "ALLOW_ONLY");
  return allowOnly.length === 0 || allowOnly.some((entry) => entry.targetPiece === target.pieceSlug);
}

export function compileTerrainPieceLibrary(
  pieces: TerrainPiece[],
  pieceSet: TerrainPieceSet,
  overrides: TerrainAdjacencyOverride[]
): TerrainCompiledLibrary {
  const parsedPieceSet = terrainPieceSetSchema.parse(pieceSet);
  const selected = parsedPieceSet.pieceSlugs.map((slug) => {
    const piece = pieces.find((entry) => entry.slug === slug);
    if (!piece) throw new Error(`Collection '${parsedPieceSet.slug}' references missing piece '${slug}'`);
    const parsed = terrainPieceSchema.parse(piece);
    return parsed;
  });
  if (selected.length === 0) throw new Error(`Collection '${parsedPieceSet.slug}' contains no pieces`);
  const variants = selected.flatMap((piece) => pieceOrientations(piece).map((orientation) => transformPiece(piece, orientation, 0)));
  const variantCounts = new Map(selected.map((piece) => [piece.slug, pieceOrientations(piece).length]));
  variants.forEach((variant, id) => {
    variant.id = id;
  });
  const states: TerrainCompiledState[] = [];
  for (const variant of variants) {
    for (let y = 0; y < variant.height; y += 1) {
      for (let x = 0; x < variant.width; x += 1) {
        states.push({
          id: states.length,
          variantId: variant.id,
          pieceSlug: variant.piece.slug,
          orientation: variant.orientation,
          partX: x,
          partY: y,
          variantWidth: variant.width,
          variantHeight: variant.height,
          cell: variant.cells[y * variant.width + x],
          edges: stateEdges(variant, x, y),
          weight:
            (parsedPieceSet.pieceWeights[variant.piece.slug] ?? variant.piece.weight) /
            (variant.width * variant.height * (variantCounts.get(variant.piece.slug) ?? 1))
        });
      }
    }
  }
  if (!states.some((state) => state.weight > 0)) {
    throw new Error(`Terrain collection '${parsedPieceSet.slug}' must give at least one piece a weight above zero`);
  }
  const adjacency = Object.fromEntries(terrainDirections.map((direction) => [direction, states.map(() => [] as number[])])) as Record<
    TerrainDirection,
    number[][]
  >;
  for (const direction of terrainDirections) {
    const opposite = oppositeDirections[direction];
    const targetsBySocket = new Map<string, TerrainCompiledState[]>();
    for (const target of states) {
      const list = targetsBySocket.get(target.edges[opposite]);
      if (list) list.push(target);
      else targetsBySocket.set(target.edges[opposite], [target]);
    }
    for (const source of states) {
      adjacency[direction][source.id] = (targetsBySocket.get(source.edges[direction]) ?? [])
        .filter((target) => overridesPermit(source, target, direction, variants, overrides))
        .map((target) => target.id);
    }
  }
  return { adjacency, states, variants };
}

export function inspectTerrainPieceCompatibility(library: TerrainCompiledLibrary, pieceSlug: string): TerrainPieceCompatibility {
  const states = library.states.filter((state) => state.pieceSlug === pieceSlug);
  if (states.length === 0) throw new Error(`Compiled library does not contain piece '${pieceSlug}'`);
  const directions = Object.fromEntries(
    terrainDirections.map((direction) => {
      const exposed = states.filter((state) => !state.edges[direction].startsWith("@INTERNAL_"));
      const compatibleStateIds = new Set(exposed.flatMap((state) => library.adjacency[direction][state.id]));
      return [
        direction,
        {
          compatiblePieces: [...new Set([...compatibleStateIds].map((id) => library.states[id].pieceSlug))].sort(),
          compatibleStates: compatibleStateIds.size,
          socketSegments: [...new Set(exposed.map((state) => state.edges[direction]))].sort()
        }
      ];
    })
  ) as Record<TerrainDirection, TerrainCompatibilityDirection>;
  return { pieceSlug, directions, viable: terrainDirections.every((direction) => directions[direction].compatibleStates > 0) };
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
  version: number;
}

function pushEntropy(queue: EntropyQueueEntry[], entry: EntropyQueueEntry): void {
  queue.push(entry);
  let index = queue.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (queue[parent].entropy <= entry.entropy) break;
    queue[index] = queue[parent];
    index = parent;
  }
  queue[index] = entry;
}

function popEntropy(queue: EntropyQueueEntry[]): EntropyQueueEntry | undefined {
  const first = queue[0];
  const last = queue.pop();
  if (!first || !last || queue.length === 0) return first;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    if (left >= queue.length) break;
    const child = right < queue.length && queue[right].entropy < queue[left].entropy ? right : left;
    if (queue[child].entropy >= last.entropy) break;
    queue[index] = queue[child];
    index = child;
  }
  queue[index] = last;
  return first;
}

function solveLibrary(
  library: TerrainCompiledLibrary,
  width: number,
  height: number,
  seed: number,
  constraint: SolveConstraint,
  maxAttempts = 8,
  maxBacktracks = 128
): SolvedPass {
  let lastError: unknown;
  let bestStateIds: Array<number | undefined> = Array<number | undefined>(width * height).fill(undefined);
  let bestResolved = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b1)) >>> 0;
    try {
      const random = randomGenerator(attemptSeed);
      const domains = Array.from({ length: width * height }, (_, index) => {
        const x = index % width;
        const y = Math.floor(index / width);
        return new Set(
          library.states
            .filter((state) => {
              if (state.weight === 0) return false;
              const anchorX = x - state.partX;
              const anchorY = y - state.partY;
              return (
                anchorX >= 0 &&
                anchorY >= 0 &&
                anchorX + state.variantWidth <= width &&
                anchorY + state.variantHeight <= height &&
                constraint.allowed(state, x, y)
              );
            })
            .map((state) => state.id)
        );
      });
      if (domains.some((domain) => domain.size === 0)) throw new Error("A constrained output cell has no legal piece state");
      const queue = domains.map((_, index) => index);
      let queueHead = 0;
      const queued = new Uint8Array(domains.length).fill(1);
      const supportMarks = new Uint32Array(library.states.length);
      const domainVersions = new Uint32Array(domains.length);
      const entropyQueue: EntropyQueueEntry[] = [];
      let supportStamp = 0;
      const trail: Array<{ index: number; state: number }> = [];
      const decisions: Array<{ alternatives: number[]; index: number; trailStart: number }> = [];
      let backtracks = 0;

      function enqueue(index: number): void {
        if (queued[index] === 1) return;
        queue.push(index);
        queued[index] = 1;
      }

      function clearQueue(): void {
        queue.length = 0;
        queueHead = 0;
        queued.fill(0);
      }

      function removeState(index: number, state: number): void {
        if (!domains[index].delete(state)) return;
        trail.push({ index, state });
      }

      function entropy(index: number): number {
        let sum = 0;
        let weightedLogSum = 0;
        for (const stateId of domains[index]) {
          const weight = library.states[stateId].weight;
          sum += weight;
          weightedLogSum += weight * Math.log(weight);
        }
        return Math.log(sum) - weightedLogSum / sum + random() * 1e-8;
      }

      function touchDomain(index: number): void {
        domainVersions[index] += 1;
        if (domains[index].size > 1) {
          pushEntropy(entropyQueue, { entropy: entropy(index), index, version: domainVersions[index] });
        }
      }

      function restoreTrail(start: number): void {
        const restored = new Set<number>();
        for (let index = trail.length - 1; index >= start; index -= 1) {
          const removal = trail[index];
          domains[removal.index].add(removal.state);
          restored.add(removal.index);
        }
        trail.length = start;
        for (const index of restored) touchDomain(index);
      }

      function captureBest(): void {
        let resolved = 0;
        const stateIds = domains.map((domain) => {
          if (domain.size !== 1) return undefined;
          resolved += 1;
          return domain.values().next().value as number;
        });
        if (resolved > bestResolved) {
          bestResolved = resolved;
          bestStateIds = stateIds;
        }
      }

      function propagate(): boolean {
        while (queueHead < queue.length) {
          const sourceIndex = queue[queueHead];
          queueHead += 1;
          queued[sourceIndex] = 0;
          const sourceX = sourceIndex % width;
          const sourceY = Math.floor(sourceIndex / width);
          for (const direction of terrainDirections) {
            const [offsetX, offsetY] = directionOffsets[direction];
            const targetX = sourceX + offsetX;
            const targetY = sourceY + offsetY;
            if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) continue;
            const targetIndex = targetY * width + targetX;
            const targetDomain = domains[targetIndex];
            supportStamp += 1;
            if (supportStamp === 0xffffffff) {
              supportMarks.fill(0);
              supportStamp = 1;
            }
            for (const sourceState of domains[sourceIndex]) {
              for (const targetState of library.adjacency[direction][sourceState]) supportMarks[targetState] = supportStamp;
            }
            let changed = false;
            for (const targetState of targetDomain) {
              if (supportMarks[targetState] !== supportStamp) {
                removeState(targetIndex, targetState);
                changed = true;
              }
            }
            if (changed) touchDomain(targetIndex);
            if (targetDomain.size === 0) return false;
            if (changed) enqueue(targetIndex);
          }
        }
        queue.length = 0;
        queueHead = 0;
        return true;
      }

      function weightedOrder(domain: Set<number>): number[] {
        return [...domain]
          .map((stateId) => ({ stateId, priority: -Math.log(Math.max(Number.EPSILON, random())) / library.states[stateId].weight }))
          .sort((left, right) => left.priority - right.priority)
          .map((entry) => entry.stateId);
      }

      function collapse(index: number, chosen: number): void {
        for (const stateId of domains[index]) {
          if (stateId !== chosen) removeState(index, stateId);
        }
        touchDomain(index);
        enqueue(index);
      }

      if (!propagate()) throw new Error("Initial constraints contradict the terrain grammar");
      trail.length = 0;
      entropyQueue.length = 0;
      domains.forEach((domain, index) => {
        if (domain.size > 1) pushEntropy(entropyQueue, { entropy: entropy(index), index, version: domainVersions[index] });
      });
      captureBest();
      while (true) {
        let selectedIndex = -1;
        while (entropyQueue.length > 0) {
          const entry = popEntropy(entropyQueue)!;
          if (entry.version === domainVersions[entry.index] && domains[entry.index].size > 1) {
            selectedIndex = entry.index;
            break;
          }
        }
        if (selectedIndex < 0) break;
        const choices = weightedOrder(domains[selectedIndex]);
        const decision = { alternatives: choices.slice(1), index: selectedIndex, trailStart: trail.length };
        decisions.push(decision);
        collapse(selectedIndex, choices[0]);

        let consistent = propagate();
        while (!consistent) {
          backtracks += 1;
          if (backtracks > maxBacktracks) throw new Error(`Backtracking budget of ${maxBacktracks} was exhausted`);
          let alternativeFound = false;
          while (decisions.length > 0) {
            const active = decisions[decisions.length - 1];
            restoreTrail(active.trailStart);
            clearQueue();
            const alternative = active.alternatives.shift();
            if (alternative !== undefined) {
              collapse(active.index, alternative);
              consistent = propagate();
              if (consistent) {
                alternativeFound = true;
                break;
              }
              backtracks += 1;
              if (backtracks > maxBacktracks) throw new Error(`Backtracking budget of ${maxBacktracks} was exhausted`);
            } else {
              decisions.pop();
            }
          }
          if (!alternativeFound && !consistent) throw new Error("Every backtracking branch contradicted the terrain grammar");
        }
        captureBest();
      }
      const stateIds = domains.map((domain) => domain.values().next().value as number);
      return { complete: true, stateIds, placements: reconstructPlacements(library, stateIds, width) };
    } catch (caught) {
      lastError = caught;
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  return {
    complete: false,
    error: `Socket WFC resolved ${bestResolved}/${width * height} cells after ${maxAttempts} attempts: ${detail}`,
    stateIds: bestStateIds,
    placements: reconstructPlacements(library, bestStateIds, width)
  };
}

function reconstructPlacements(library: TerrainCompiledLibrary, stateIds: Array<number | undefined>, width: number): TerrainPlacement[] {
  const placements = new Map<string, TerrainPlacement>();
  stateIds.forEach((stateId, index) => {
    if (stateId === undefined) return;
    const state = library.states[stateId];
    const x = (index % width) - state.partX;
    const y = Math.floor(index / width) - state.partY;
    const key = `${state.pieceSlug}:${state.orientation}:${x}:${y}`;
    placements.set(key, {
      piece: state.pieceSlug,
      x,
      y,
      orientation: state.orientation,
      width: state.variantWidth,
      height: state.variantHeight
    });
  });
  return [...placements.values()].sort((left, right) => left.y - right.y || left.x - right.x || left.piece.localeCompare(right.piece));
}

function tagsForCell(cell: TerrainPieceCell, bindings: Record<string, TerrainTileBinding>, piece: TerrainPiece): string[] {
  const tags = new Set([...cell.semanticFlags, ...piece.semanticFlags, ...piece.biomeTags, ...piece.siteTags]);
  for (const tile of cell.tiles) {
    if (!tile) continue;
    const binding = bindings[terrainTileKey(tile.tilesetId, tile.localId)];
    if (!binding) throw new Error(`Piece '${piece.slug}' uses sprite '${tile.tilesetId}:${tile.localId}' without metadata`);
    binding.tags.forEach((tag) => tags.add(tag));
  }
  return [...tags].sort();
}

function blockingForCell(cell: TerrainPieceCell): boolean {
  return isTerrainCollisionFullyBlocked(cell);
}

function statePiece(library: TerrainCompiledLibrary, state: TerrainCompiledState): TerrainPiece {
  return library.variants[state.variantId].piece;
}

function stampStateRequirements(
  template: TerrainSiteTemplate,
  library: TerrainCompiledLibrary
): Map<number, { piece: string; orientation: number; partX: number; partY: number }> {
  const requirements = new Map<number, { piece: string; orientation: number; partX: number; partY: number }>();
  for (const stamp of template.stamps) {
    const variant = library.variants.find((entry) => entry.piece.slug === stamp.piece && entry.orientation === stamp.orientation);
    if (!variant)
      throw new Error(`Template '${template.slug}' stamp references unavailable piece/orientation '${stamp.piece}@${stamp.orientation}'`);
    if (stamp.x + variant.width > template.width || stamp.y + variant.height > template.height) {
      throw new Error(`Template '${template.slug}' stamp '${stamp.piece}' extends outside its bounds`);
    }
    for (let y = 0; y < variant.height; y += 1) {
      for (let x = 0; x < variant.width; x += 1) {
        const index = (stamp.y + y) * template.width + stamp.x + x;
        if (requirements.has(index)) throw new Error(`Template '${template.slug}' contains overlapping required stamps`);
        requirements.set(index, { piece: stamp.piece, orientation: stamp.orientation, partX: x, partY: y });
      }
    }
  }
  return requirements;
}

function resolvedCellState(
  library: TerrainCompiledLibrary,
  solved: SolvedPass,
  index: number,
  bindings: Record<string, TerrainTileBinding>,
  layerCount: number
): { stack: TerrainTileStack; metadata: TerrainResolvedCellMetadata } {
  const stateId = solved.stateIds[index];
  if (stateId === undefined) {
    return {
      stack: Array<TerrainTileRef | null>(layerCount).fill(null),
      metadata: { blocking: true, elevation: 0, tags: ["UNRESOLVED"], piece: "UNRESOLVED" }
    };
  }
  const state = library.states[stateId];
  const piece = statePiece(library, state);
  return {
    stack: Array.from({ length: layerCount }, (_, layer) => {
      const tile = state.cell.tiles[layer];
      return tile ? { ...tile } : null;
    }),
    metadata: {
      blocking: blockingForCell(state.cell),
      ...(state.cell.collision
        ? { collision: { resolution: state.cell.collision.resolution, cells: [...state.cell.collision.cells] } }
        : {}),
      elevation: state.cell.elevation,
      tags: tagsForCell(state.cell, bindings, piece),
      piece: piece.slug
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
      for (const direction of terrainDirections) {
        const [offsetX, offsetY] = directionOffsets[direction];
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

function reachableAnchorCount(template: TerrainSiteTemplate, metadata: TerrainResolvedCellMetadata[]): number {
  if (template.anchors.length === 0) return 0;
  const first = template.anchors[0];
  const firstIndex = first.y * template.width + first.x;
  if (metadata[firstIndex].blocking) return 0;
  const visited = new Uint8Array(metadata.length);
  const queue = [firstIndex];
  visited[firstIndex] = 1;
  while (queue.length > 0) {
    const index = queue.shift()!;
    const x = index % template.width;
    const y = Math.floor(index / template.width);
    for (const direction of terrainDirections) {
      const [offsetX, offsetY] = directionOffsets[direction];
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (neighborX < 0 || neighborX >= template.width || neighborY < 0 || neighborY >= template.height) continue;
      const neighbor = neighborY * template.width + neighborX;
      if (visited[neighbor] === 0 && !metadata[neighbor].blocking) {
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
  }
  return template.anchors.filter((anchor) => visited[anchor.y * template.width + anchor.x] === 1).length;
}

export function validateTerrainCandidate(
  candidate: Omit<TerrainCandidate, "issues" | "metrics">,
  template: TerrainSiteTemplate
): {
  issues: TerrainValidationIssue[];
  metrics: TerrainCandidateMetric;
} {
  const issues: TerrainValidationIssue[] = [];
  const walkableComponents = countWalkableComponents(candidate.cellMetadata, candidate.width, candidate.height);
  const reachableAnchors = reachableAnchorCount(template, candidate.cellMetadata);
  if (reachableAnchors !== template.anchors.length) {
    issues.push({
      code: "ANCHOR_REACHABILITY",
      message: `${reachableAnchors}/${template.anchors.length} required anchors are mutually reachable`
    });
  }
  for (const anchor of template.anchors) {
    if (candidate.cellMetadata[anchor.y * candidate.width + anchor.x].blocking) {
      issues.push({ code: "BLOCKED_ANCHOR", message: `Anchor '${anchor.slug}' is blocked` });
    }
  }
  for (const zone of template.zones) {
    let count = 0;
    for (let y = zone.y; y < zone.y + zone.height; y += 1) {
      for (let x = zone.x; x < zone.x + zone.width; x += 1) {
        if (zone.requiredTags.every((tag) => candidate.cellMetadata[y * candidate.width + x].tags.includes(tag))) count += 1;
      }
    }
    if (count < zone.minCount || count > zone.maxCount) {
      issues.push({
        code: "ZONE_COUNT",
        message: `Zone '${zone.slug}' contains ${count} matching cells; expected ${zone.minCount}-${zone.maxCount}`
      });
    }
  }
  for (let y = 0; y < candidate.height; y += 1) {
    for (let x = 0; x < candidate.width; x += 1) {
      const index = y * candidate.width + x;
      for (const direction of ["east", "south"] as const) {
        const [offsetX, offsetY] = directionOffsets[direction];
        if (x + offsetX >= candidate.width || y + offsetY >= candidate.height) continue;
        const neighbor = (y + offsetY) * candidate.width + x + offsetX;
        if (
          !candidate.cellMetadata[index].blocking &&
          !candidate.cellMetadata[neighbor].blocking &&
          Math.abs(candidate.cellMetadata[index].elevation - candidate.cellMetadata[neighbor].elevation) > 1
        ) {
          issues.push({
            code: "ELEVATION_STEP",
            message: `Walkable cells ${x},${y} and ${x + offsetX},${y + offsetY} differ by more than one elevation`
          });
        }
      }
    }
  }
  return {
    issues,
    metrics: {
      walkableComponents,
      reachableAnchors,
      requiredAnchors: template.anchors.length,
      distinctPieces: new Set(candidate.placements.map((placement) => placement.piece)).size
    }
  };
}

function prepareTerrainGeneration(workspace: TerrainGenerationWorkspace, sourceTemplate: TerrainSiteTemplate): PreparedTerrainGeneration {
  const template = terrainSiteTemplateSchema.parse(sourceTemplate);
  const pieceSet = workspace.pieceSets.find((entry) => entry.slug === template.pieceSet);
  if (!pieceSet) throw new Error(`Template '${template.slug}' references missing collection '${template.pieceSet}'`);
  const library = compileTerrainPieceLibrary(workspace.pieces, pieceSet, workspace.adjacencyOverrides);
  const stampRequirements = stampStateRequirements(template, library);
  const stateTags = library.states.map((state) => tagsForCell(state.cell, workspace.tileBindings, statePiece(library, state)));
  const anchorsByCell = new Map<number, TerrainTemplateAnchor[]>();
  for (const anchor of template.anchors) {
    const index = anchor.y * template.width + anchor.x;
    const anchors = anchorsByCell.get(index);
    if (anchors) anchors.push(anchor);
    else anchorsByCell.set(index, [anchor]);
  }
  return { anchorsByCell, library, stampRequirements, stateTags, template };
}

function generatePreparedTerrainCandidate(
  workspace: TerrainGenerationWorkspace,
  prepared: PreparedTerrainGeneration,
  seed: number
): TerrainCandidate {
  const { anchorsByCell, library, stampRequirements, stateTags, template } = prepared;
  const solved = solveLibrary(library, template.width, template.height, seed, {
    allowed: (state, x, y) => {
      const index = y * template.width + x;
      const required = stampRequirements.get(index);
      if (
        required &&
        (state.pieceSlug !== required.piece ||
          state.orientation !== required.orientation ||
          state.partX !== required.partX ||
          state.partY !== required.partY)
      ) {
        return false;
      }
      const cell = template.cells[index];
      const tags = stateTags[state.id];
      const anchors = anchorsByCell.get(index) ?? [];
      return (
        cell.requiredTags.every((tag) => tags.includes(tag)) &&
        cell.forbiddenTags.every((tag) => !tags.includes(tag)) &&
        anchors.every((anchor) => state.edges[anchor.direction] === anchor.socket)
      );
    }
  });
  const layerCount = Math.max(...library.states.map((state) => state.cell.tiles.length));
  const resolvedCells = solved.stateIds.map((_, index) => resolvedCellState(library, solved, index, workspace.tileBindings, layerCount));
  const cells = resolvedCells.map((entry) => entry.stack);
  const cellMetadata = resolvedCells.map((entry) => entry.metadata);
  const placements = [...solved.placements];
  const candidateWithoutValidation = {
    complete: solved.complete,
    sourceTemplate: template.slug,
    seed: seed >>> 0,
    width: template.width,
    height: template.height,
    layerCount,
    cells,
    cellMetadata,
    placements,
    anchors: template.anchors
  };
  const validation = validateTerrainCandidate(candidateWithoutValidation, template);
  const partialIssue = solved.complete
    ? []
    : [
        {
          code: "PARTIAL_WFC",
          message: solved.error ?? "Socket WFC stopped before every cell was resolved"
        }
      ];
  return { ...candidateWithoutValidation, ...validation, issues: [...partialIssue, ...validation.issues] };
}

export function generateTerrainCandidate(
  workspace: TerrainGenerationWorkspace,
  sourceTemplate: TerrainSiteTemplate,
  seed: number
): TerrainCandidate {
  return generatePreparedTerrainCandidate(workspace, prepareTerrainGeneration(workspace, sourceTemplate), seed);
}

export function generateTerrainCandidateBatch(
  workspace: Parameters<typeof generateTerrainCandidate>[0],
  template: TerrainSiteTemplate,
  firstSeed: number
): TerrainCandidateResult[] {
  let prepared: PreparedTerrainGeneration;
  try {
    prepared = prepareTerrainGeneration(workspace, template);
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    return Array.from({ length: template.candidateCount }, (_, index) => ({ seed: (firstSeed + index) >>> 0, error }));
  }
  return Array.from({ length: template.candidateCount }, (_, index) => {
    const seed = (firstSeed + index) >>> 0;
    try {
      return { seed, candidate: generatePreparedTerrainCandidate(workspace, prepared, seed) };
    } catch (caught) {
      return { seed, error: caught instanceof Error ? caught.message : String(caught) };
    }
  });
}

export function freezeTerrainCandidate(candidate: TerrainCandidate, slug: string, kind: "MAP" | "SUBMODULE"): TerrainApprovedAsset {
  if (candidate.complete && candidate.issues.length > 0) {
    throw new Error("Only complete candidates that pass every validation rule or explicit partial candidates can be approved");
  }
  return {
    slug,
    kind,
    sourceTemplate: candidate.sourceTemplate,
    width: candidate.width,
    height: candidate.height,
    layerCount: candidate.layerCount,
    cells: candidate.cells.map((stack) => stack.map((tile) => (tile ? { ...tile } : null))),
    cellMetadata: candidate.cellMetadata.map((metadata) => ({ ...metadata, tags: [...metadata.tags] })),
    cellOverrides: [],
    placements: candidate.placements.map((placement) => ({ ...placement })),
    anchors: candidate.anchors.map((anchor) => ({ ...anchor })),
    metrics: { ...candidate.metrics }
  };
}

export function terrainOrientationMatrix(orientation: number): Matrix {
  const matrix = orientationMatrices[orientation];
  if (!matrix) throw new Error(`Unknown terrain orientation ${orientation}`);
  return matrix;
}
