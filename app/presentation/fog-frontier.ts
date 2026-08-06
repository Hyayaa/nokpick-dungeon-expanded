type FogRevision = object | string | number;

export const FOG_PIXELS_PER_TILE = 16;
const FOG_CELLS_PER_TILE = 2;
export const FOG_PIXELS_PER_CELL =
  FOG_PIXELS_PER_TILE / FOG_CELLS_PER_TILE;

export const FOG_OUTER_BOUNDARY_PIXELS = 3;
export const FOG_INNER_BOUNDARY_PIXELS = 3;
export const FOG_STATIC_CLEARANCE_PIXELS = FOG_PIXELS_PER_TILE;
export const FOG_UNEXPLORED_ALPHA = 1;
export const FOG_REMEMBERED_ALPHA = 0.63;
export const FOG_SIGHT_EDGE_ALPHA = 0.3;
export const FOG_VISIBLE_ALPHA = 0;

const FOG_ENGINE_VERSION = 12;
const FOG_COLOR = "#02070a";
export const FOG_RIPPLE_FRAME_MS = 320;
export const FOG_RIPPLE_AMPLITUDE_PIXELS = 0.85;
export const FOG_UNEXPLORED_EXPANSION_PIXELS = 3;
const DISCOVERY_BOUNDARY_MIN_INSET =
  FOG_UNEXPLORED_EXPANSION_PIXELS + 0.35;
const DISCOVERY_BOUNDARY_VARIATION = 1.35;
const DISCOVERY_BOUNDARY_MAX_INSET =
  DISCOVERY_BOUNDARY_MIN_INSET + DISCOVERY_BOUNDARY_VARIATION;
const DISCOVERY_BOUNDARY_DEPTH = Math.ceil(
  DISCOVERY_BOUNDARY_MAX_INSET,
);
const VISIBILITY_DISTANCE_LIMIT =
  FOG_STATIC_CLEARANCE_PIXELS +
  Math.ceil(FOG_RIPPLE_AMPLITUDE_PIXELS) +
  1;
const FOG_LAYER_STEP_MS = 90;
const REVEAL_PIXEL_DELAY_MS = 7;
const CONCEAL_PIXEL_DELAY_MS = 9;
const MAX_TRANSITION_DELAY_MS = 360;
const STATIC_SETTLE_LAG_MS = 240;
const STATIC_SETTLE_VARIATION_MS = 12;
export const FOG_DISTANCE_SLOWDOWN_PER_TILE = 0.12;
export const FOG_MAX_DISTANCE_TIME_SCALE = 2.2;
const DISTANCE_START_LAG_MS = 18;
const TRANSITION_CONTOUR_VARIATION_MS = 6;
const DISTANCE_DURATION_WEIGHT = 0.24;
const DISTANCE_SCALE = 10;
const CARDINAL_DISTANCE_COST = DISTANCE_SCALE;
const DIAGONAL_DISTANCE_COST = 14;
const FRONTIER_PROPAGATION_DEPTH_PIXELS =
  FOG_PIXELS_PER_CELL;
const REVEAL_MIN_DURATION_SCALE = 0.78;
const REVEAL_BOUNDARY_DURATION_BONUS = 0.62;
const ALPHA_LEVELS = [
  FOG_VISIBLE_ALPHA,
  FOG_SIGHT_EDGE_ALPHA,
  FOG_REMEMBERED_ALPHA,
  FOG_UNEXPLORED_ALPHA,
] as const;
const ALPHA_BYTES = ALPHA_LEVELS.map((alpha) =>
  Math.round(alpha * 255),
);
const PIXEL_NEIGHBORS = [
  { dx: -1, dy: -1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 1 },
  { dx: 1, dy: 1 },
] as const;

export type PixelFogTransition = {
  startedAt: number;
  duration: number;
  from: number;
  to: number;
  seed: number;
  rippleOnly?: boolean;
};

export type PixelFogRuntime = {
  engineVersion: number;
  initialized: boolean;
  lastRevision: FogRevision | null;
  mapKey: FogRevision | null;
  minCellX: number;
  minCellY: number;
  cellWidth: number;
  cellHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  originPixelX: number;
  originPixelY: number;
  visibleCells: Uint8Array;
  discoveredCells: Uint8Array;
  visiblePixels: Uint8Array;
  discoveredPixels: Uint8Array;
  visibilityDistance: Uint8Array;
  visibilityDistanceScratch: Uint8Array;
  visibilityActivePixels: Int32Array;
  discoveryDistance: Uint8Array;
  discoveryDistanceScratch: Uint8Array;
  discoveryActivePixels: Int32Array;
  staticTargetPixels: Uint8Array;
  staticActivePixels: Uint8Array;
  targetOpacity: Uint8Array;
  renderedOpacity: Uint8Array;
  boundaryMarks: Uint16Array;
  candidateMarks: Uint16Array;
  boundaryMarkGeneration: number;
  candidateMarkGeneration: number;
  bufferAllocationCount: number;
  boundaryPixels: number[];
  ripplePixels: number[];
  transitions: Map<number, PixelFogTransition>;
  pendingStaticSettles: Map<number, number>;
  lastRippleFrame: number;
  needsFullPaint: boolean;
  paintedWidth: number;
  paintedHeight: number;
  lastSourceCellScans: number;
  lastRippleTouched: number;
  lastTargetChangeCount: number;
  lastPaintedPixels: number;
};

export type PixelFogSyncOptions = {
  now: number;
  visibilityRevision: FogRevision;
  mapKey: FogRevision;
  originCellX: number;
  originCellY: number;
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
  isVisible: (cellX: number, cellY: number) => boolean;
  isDiscovered: (cellX: number, cellY: number) => boolean;
};

export type PixelFogTextureOptions = PixelFogSyncOptions & {
  runtime: PixelFogRuntime;
};

const emptyPixels = () => new Uint8Array(0);

export const createPixelFogRuntime = (): PixelFogRuntime => ({
  engineVersion: FOG_ENGINE_VERSION,
  initialized: false,
  lastRevision: null,
  mapKey: null,
  minCellX: 0,
  minCellY: 0,
  cellWidth: 0,
  cellHeight: 0,
  pixelWidth: 0,
  pixelHeight: 0,
  originPixelX: 0,
  originPixelY: 0,
  visibleCells: emptyPixels(),
  discoveredCells: emptyPixels(),
  visiblePixels: emptyPixels(),
  discoveredPixels: emptyPixels(),
  visibilityDistance: emptyPixels(),
  visibilityDistanceScratch: emptyPixels(),
  visibilityActivePixels: new Int32Array(0),
  discoveryDistance: emptyPixels(),
  discoveryDistanceScratch: emptyPixels(),
  discoveryActivePixels: new Int32Array(0),
  staticTargetPixels: emptyPixels(),
  staticActivePixels: emptyPixels(),
  targetOpacity: emptyPixels(),
  renderedOpacity: emptyPixels(),
  boundaryMarks: new Uint16Array(0),
  candidateMarks: new Uint16Array(0),
  boundaryMarkGeneration: 0,
  candidateMarkGeneration: 0,
  bufferAllocationCount: 0,
  boundaryPixels: [],
  ripplePixels: [],
  transitions: new Map<number, PixelFogTransition>(),
  pendingStaticSettles: new Map<number, number>(),
  lastRippleFrame: -1,
  needsFullPaint: true,
  paintedWidth: 0,
  paintedHeight: 0,
  lastSourceCellScans: 0,
  lastRippleTouched: 0,
  lastTargetChangeCount: 0,
  lastPaintedPixels: 0,
});

export function resetPixelFogRuntime(runtime: PixelFogRuntime) {
  runtime.engineVersion = FOG_ENGINE_VERSION;
  runtime.initialized = false;
  runtime.lastRevision = null;
  runtime.mapKey = null;
  runtime.minCellX = 0;
  runtime.minCellY = 0;
  runtime.cellWidth = 0;
  runtime.cellHeight = 0;
  runtime.pixelWidth = 0;
  runtime.pixelHeight = 0;
  runtime.originPixelX = 0;
  runtime.originPixelY = 0;
  runtime.visibleCells = emptyPixels();
  runtime.discoveredCells = emptyPixels();
  runtime.visiblePixels = emptyPixels();
  runtime.discoveredPixels = emptyPixels();
  runtime.visibilityDistance = emptyPixels();
  runtime.visibilityDistanceScratch = emptyPixels();
  runtime.visibilityActivePixels = new Int32Array(0);
  runtime.discoveryDistance = emptyPixels();
  runtime.discoveryDistanceScratch = emptyPixels();
  runtime.discoveryActivePixels = new Int32Array(0);
  runtime.staticTargetPixels = emptyPixels();
  runtime.staticActivePixels = emptyPixels();
  runtime.targetOpacity = emptyPixels();
  runtime.renderedOpacity = emptyPixels();
  runtime.boundaryMarks = new Uint16Array(0);
  runtime.candidateMarks = new Uint16Array(0);
  runtime.boundaryMarkGeneration = 0;
  runtime.candidateMarkGeneration = 0;
  runtime.bufferAllocationCount = 0;
  runtime.boundaryPixels = [];
  runtime.ripplePixels = [];
  runtime.transitions.clear();
  runtime.pendingStaticSettles.clear();
  runtime.lastRippleFrame = -1;
  runtime.needsFullPaint = true;
  runtime.paintedWidth = 0;
  runtime.paintedHeight = 0;
  runtime.lastSourceCellScans = 0;
  runtime.lastRippleTouched = 0;
  runtime.lastTargetChangeCount = 0;
  runtime.lastPaintedPixels = 0;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const distanceToPixels = (distance: number) =>
  distance / DISTANCE_SCALE;

const fogHash = (x: number, y: number, seed = 0) => {
  let value =
    Math.imul(x + 0x6d2b79f5, 0x1b873593) ^
    Math.imul(y + 0x85ebca6b, 0xcc9e2d51) ^
    Math.imul(seed + 0x27d4eb2d, 0x165667b1);
  value ^= value >>> 15;
  value = Math.imul(value, 0x85ebca6b);
  value ^= value >>> 13;
  return (value >>> 0) / 4_294_967_296;
};

const nearestAlphaLevel = (alpha: number) => {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ALPHA_LEVELS.length; index += 1) {
    const distance = Math.abs(ALPHA_LEVELS[index] - alpha);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  }
  return nearestIndex;
};

const alphaToByte = (alpha: number) =>
  ALPHA_BYTES[nearestAlphaLevel(alpha)];

const byteToAlpha = (byte: number) =>
  ALPHA_LEVELS[nearestAlphaLevel(byte / 255)];

const preparePixelBuffers = (
  runtime: PixelFogRuntime,
  pixelCount: number,
  cellCount: number,
) => {
  if (
    runtime.visiblePixels.length === pixelCount &&
    runtime.visibleCells.length === cellCount
  ) {
    return;
  }
  const pair = () => [new Uint8Array(pixelCount), new Uint8Array(pixelCount)] as const;
  runtime.visiblePixels = new Uint8Array(pixelCount);
  runtime.discoveredPixels = new Uint8Array(pixelCount);
  [runtime.visibilityDistance, runtime.visibilityDistanceScratch] = pair();
  runtime.visibilityActivePixels = new Int32Array(0);
  [runtime.discoveryDistance, runtime.discoveryDistanceScratch] = pair();
  runtime.discoveryActivePixels = new Int32Array(0);
  runtime.staticTargetPixels = new Uint8Array(pixelCount);
  runtime.staticActivePixels = new Uint8Array(pixelCount);
  runtime.targetOpacity = new Uint8Array(pixelCount);
  runtime.visibleCells = new Uint8Array(cellCount);
  runtime.discoveredCells = new Uint8Array(cellCount);
  runtime.renderedOpacity = new Uint8Array(pixelCount);
  runtime.boundaryMarks = new Uint16Array(pixelCount);
  runtime.candidateMarks = new Uint16Array(pixelCount);
  runtime.boundaryMarkGeneration = 0;
  runtime.candidateMarkGeneration = 0;
  runtime.bufferAllocationCount += 1;
};

const nextMarkGeneration = (
  marks: Uint16Array,
  generation: number,
) => {
  if (generation >= 0xfffe) {
    marks.fill(0);
    return 1;
  }
  return generation + 1;
};

export const pixelFogTransitionAlpha = (
  transition: PixelFogTransition,
  now: number,
) => {
  if (now <= transition.startedAt) return transition.from;
  if (now >= transition.startedAt + transition.duration) {
    return transition.to;
  }

  const fromIndex = nearestAlphaLevel(transition.from);
  const toIndex = nearestAlphaLevel(transition.to);
  const levelDistance = Math.abs(toIndex - fromIndex);
  if (levelDistance === 0) return ALPHA_LEVELS[toIndex];

  const progress =
    (now - transition.startedAt) / transition.duration;
  const completedLevels = Math.min(
    levelDistance - 1,
    Math.floor(progress * levelDistance),
  );
  const direction = Math.sign(toIndex - fromIndex);
  return ALPHA_LEVELS[
    fromIndex + direction * completedLevels
  ];
};

const boundaryWave = (
  pixelX: number,
  pixelY: number,
  rippleFrame: number,
  phase: number,
) => {
  const time = rippleFrame * 0.12;

  // Keep the field smooth enough that neighbouring contour pixels cannot
  // overtake one another. The old per-cluster noise and dark-layer dither
  // produced isolated bright pixels which looked like holes. These long
  // waves deform the silhouette itself, so a one-tile pocket still moves
  // without punching transparency into its darkest shade.
  return clamp(
    Math.sin(
      pixelX * 0.105 +
        pixelY * 0.032 +
        time +
        phase * 0.13,
    ) *
      0.46 +
      Math.sin(
        pixelX * 0.037 -
          pixelY * 0.118 -
          time * 0.61 +
          phase * 0.071,
      ) *
        0.26 +
      Math.sin(
        (pixelX + pixelY) * 0.061 +
          time * 0.34 -
          phase * 0.047,
      ) *
        0.11,
    -FOG_RIPPLE_AMPLITUDE_PIXELS,
    FOG_RIPPLE_AMPLITUDE_PIXELS,
  );
};

const coherentDelayUnit = (
  pixelX: number,
  pixelY: number,
  phase: number,
) =>
  clamp(
    (boundaryWave(pixelX, pixelY, 0, phase) +
      FOG_RIPPLE_AMPLITUDE_PIXELS) /
      (FOG_RIPPLE_AMPLITUDE_PIXELS * 2),
    0,
    1,
  );

const playerDistancePixelsAt = (
  runtime: Pick<
    PixelFogRuntime,
    "pixelWidth" | "originPixelX" | "originPixelY"
  >,
  index: number,
) => {
  const pixelX = index % runtime.pixelWidth;
  const pixelY = Math.floor(index / runtime.pixelWidth);
  return Math.hypot(
    pixelX + 0.5 - runtime.originPixelX,
    pixelY + 0.5 - runtime.originPixelY,
  );
};

const playerDistanceTimeScale = (
  runtime: Pick<
    PixelFogRuntime,
    "pixelWidth" | "originPixelX" | "originPixelY"
  >,
  index: number,
) =>
  Math.min(
    FOG_MAX_DISTANCE_TIME_SCALE,
    1 +
      (playerDistancePixelsAt(runtime, index) /
        FOG_PIXELS_PER_TILE) *
        FOG_DISTANCE_SLOWDOWN_PER_TILE,
  );

const rasterizeCellMasks = (
  runtime: PixelFogRuntime,
  options: PixelFogSyncOptions,
  pixelWidth: number,
  pixelHeight: number,
) => {
  const cellWidth = options.maxCellX - options.minCellX + 1;
  const cellHeight = options.maxCellY - options.minCellY + 1;
  const visiblePixels = runtime.visiblePixels;
  const discoveredPixels = runtime.discoveredPixels;
  const visibleCells = runtime.visibleCells;
  const discoveredCells = runtime.discoveredCells;
  const changedPixels: number[] = [];
  const canComparePrevious =
    runtime.initialized &&
    runtime.pixelWidth === pixelWidth &&
    runtime.pixelHeight === pixelHeight &&
    runtime.mapKey === options.mapKey;
  let sourceCellScans = 0;
  let visibilityChanged = !canComparePrevious;
  let discoveryChanged = !canComparePrevious;

  for (
    let cellY = options.minCellY;
    cellY <= options.maxCellY;
    cellY += 1
  ) {
    const startY =
      (cellY - options.minCellY) * FOG_PIXELS_PER_CELL;
    for (
      let cellX = options.minCellX;
      cellX <= options.maxCellX;
      cellX += 1
    ) {
      sourceCellScans += 1;
      const startX =
        (cellX - options.minCellX) * FOG_PIXELS_PER_CELL;
      const cellIndex =
        (cellY - options.minCellY) * cellWidth +
        (cellX - options.minCellX);
      const previousVisible = canComparePrevious
        ? visibleCells[cellIndex]
        : 0;
      const previousDiscovered = canComparePrevious
        ? discoveredCells[cellIndex]
        : 0;
      const visible = options.isVisible(cellX, cellY);
      const discovered =
        visible ||
        options.isDiscovered(cellX, cellY) ||
        Boolean(previousDiscovered);

      const cellVisibilityChanged =
        !canComparePrevious ||
        Boolean(previousVisible) !== visible;
      const cellDiscoveryChanged =
        !canComparePrevious ||
        Boolean(previousDiscovered) !== discovered;
      const cellChanged =
        cellVisibilityChanged || cellDiscoveryChanged;
      if (!cellChanged) continue;
      visibilityChanged ||= cellVisibilityChanged;
      discoveryChanged ||= cellDiscoveryChanged;
      visibleCells[cellIndex] = visible ? 1 : 0;
      discoveredCells[cellIndex] = discovered ? 1 : 0;
      for (
        let localY = 0;
        localY < FOG_PIXELS_PER_CELL;
        localY += 1
      ) {
        const rowStart = (startY + localY) * pixelWidth + startX;
        visiblePixels.fill(
          visible ? 1 : 0,
          rowStart,
          rowStart + FOG_PIXELS_PER_CELL,
        );
        discoveredPixels.fill(
          discovered ? 1 : 0,
          rowStart,
          rowStart + FOG_PIXELS_PER_CELL,
        );
        for (
          let localX = 0;
          localX < FOG_PIXELS_PER_CELL;
          localX += 1
        ) {
          changedPixels.push(rowStart + localX);
        }
      }
    }
  }

  return {
    visiblePixels,
    discoveredPixels,
    visibleCells,
    discoveredCells,
    changedPixels,
    cellWidth,
    cellHeight,
    sourceCellScans,
    visibilityChanged,
    discoveryChanged,
  };
};

const buildBoundaryDistance = (
  mask: Uint8Array,
  cellMask: Uint8Array,
  cellWidth: number,
  cellHeight: number,
  width: number,
  height: number,
  maximumDistance: number,
  distances: Uint8Array,
) => {
  const maximumCost = maximumDistance * DISTANCE_SCALE;
  const outsideDistance = maximumCost + 1;
  distances.fill(outsideDistance);
  const distanceBuckets = Array.from(
    { length: maximumCost + 1 },
    () => [] as number[],
  );
  const activePixels: number[] = [];

  const enqueueBoundaryPixel = (pixelX: number, pixelY: number) => {
    const index = pixelY * width + pixelX;
    if (distances[index] === 0) return;
    distances[index] = 0;
    distanceBuckets[0].push(index);
    activePixels.push(index);
  };

  // Visibility still originates in the game's 2x2 sub-tile FOV mask, but
  // frontier propagation is strictly pixel based. Seeding only cell edges
  // avoids scanning every one of the tile's 16x16 fog pixels each turn.
  for (let cellY = 0; cellY < cellHeight; cellY += 1) {
    for (let cellX = 0; cellX < cellWidth; cellX += 1) {
      const state = cellMask[cellY * cellWidth + cellX];
      const startX = cellX * FOG_PIXELS_PER_CELL;
      const startY = cellY * FOG_PIXELS_PER_CELL;
      for (const neighbor of PIXEL_NEIGHBORS) {
        const neighborCellX = cellX + neighbor.dx;
        const neighborCellY = cellY + neighbor.dy;
        const neighborState =
          neighborCellX >= 0 &&
          neighborCellY >= 0 &&
          neighborCellX < cellWidth &&
          neighborCellY < cellHeight
            ? cellMask[
                neighborCellY * cellWidth + neighborCellX
              ]
            : 0;
        if (neighborState === state) continue;

        if (neighbor.dx === 0) {
          const pixelY =
            startY +
            (neighbor.dy < 0 ? 0 : FOG_PIXELS_PER_CELL - 1);
          for (
            let localX = 0;
            localX < FOG_PIXELS_PER_CELL;
            localX += 1
          ) {
            enqueueBoundaryPixel(startX + localX, pixelY);
          }
          continue;
        }
        if (neighbor.dy === 0) {
          const pixelX =
            startX +
            (neighbor.dx < 0 ? 0 : FOG_PIXELS_PER_CELL - 1);
          for (
            let localY = 0;
            localY < FOG_PIXELS_PER_CELL;
            localY += 1
          ) {
            enqueueBoundaryPixel(pixelX, startY + localY);
          }
          continue;
        }
        enqueueBoundaryPixel(
          startX +
            (neighbor.dx < 0 ? 0 : FOG_PIXELS_PER_CELL - 1),
          startY +
            (neighbor.dy < 0 ? 0 : FOG_PIXELS_PER_CELL - 1),
        );
      }
    }
  }

  // A weighted chamfer distance keeps diagonal growth close to Euclidean
  // distance. The previous equal-cost diagonal steps used Chebyshev distance,
  // which expanded every visibility corner as a square.
  for (let cost = 0; cost <= maximumCost; cost += 1) {
    const bucket = distanceBuckets[cost];
    for (let position = 0; position < bucket.length; position += 1) {
      const index = bucket[position];
      if (distances[index] !== cost) continue;
      const pixelX = index % width;
      const pixelY = Math.floor(index / width);
      for (const neighbor of PIXEL_NEIGHBORS) {
        const neighborX = pixelX + neighbor.dx;
        const neighborY = pixelY + neighbor.dy;
        if (
          neighborX < 0 ||
          neighborY < 0 ||
          neighborX >= width ||
          neighborY >= height
        ) {
          continue;
        }
        const neighborIndex = neighborY * width + neighborX;
        if (mask[neighborIndex] !== mask[index]) continue;
        const stepCost =
          neighbor.dx !== 0 && neighbor.dy !== 0
            ? DIAGONAL_DISTANCE_COST
            : CARDINAL_DISTANCE_COST;
        const nextCost = cost + stepCost;
        if (
          nextCost > maximumCost ||
          distances[neighborIndex] <= nextCost
        ) {
          continue;
        }
        if (distances[neighborIndex] === outsideDistance) {
          activePixels.push(neighborIndex);
        }
        distances[neighborIndex] = nextCost;
        distanceBuckets[nextCost].push(neighborIndex);
      }
    }
  }

  return {
    distances,
    activePixels: Int32Array.from(activePixels),
  };
};

const staticSettleTime = (
  runtime: Pick<PixelFogRuntime, "pixelWidth">,
  index: number,
  now: number,
  visibilityDistance: number,
) => {
  const pixelX = index % runtime.pixelWidth;
  const pixelY = Math.floor(index / runtime.pixelWidth);
  const distanceTimeScale = playerDistanceTimeScale(runtime, index);
  const fluidArrivalDelay =
    Math.min(VISIBILITY_DISTANCE_LIMIT + 1, visibilityDistance) *
    CONCEAL_PIXEL_DELAY_MS *
    distanceTimeScale;
  const fluidLayerDuration = FOG_LAYER_STEP_MS * 2;
  return (
    now +
    fluidArrivalDelay +
    fluidLayerDuration +
    STATIC_SETTLE_LAG_MS +
    coherentDelayUnit(pixelX, pixelY, 107) *
      STATIC_SETTLE_VARIATION_MS
  );
};

const reconcileStaticFog = (
  runtime: PixelFogRuntime,
  visiblePixels: Uint8Array,
  visibilityDistance: Uint8Array,
  changedPixels: number[],
  previousBoundaryPixels: number[],
  visibilityActivePixels: Int32Array,
  now: number,
  initialize: boolean,
  marks: Uint16Array,
  markGeneration: number,
) => {
  if (initialize) {
    for (let index = 0; index < visiblePixels.length; index += 1) {
      const target =
        !visiblePixels[index] &&
        distanceToPixels(visibilityDistance[index]) >
          FOG_STATIC_CLEARANCE_PIXELS;
      runtime.staticTargetPixels[index] = target ? 1 : 0;
      runtime.staticActivePixels[index] = target ? 1 : 0;
    }
    runtime.pendingStaticSettles.clear();
    return [] as number[];
  }

  const candidates: number[] = [];
  const includeCandidate = (index: number) => {
    if (marks[index] === markGeneration) return;
    marks[index] = markGeneration;
    candidates.push(index);
  };
  for (const index of changedPixels) includeCandidate(index);
  for (const index of previousBoundaryPixels) includeCandidate(index);
  for (const index of visibilityActivePixels) includeCandidate(index);

  const activeChanges: number[] = [];
  for (const index of candidates) {
    const target =
      !visiblePixels[index] &&
      distanceToPixels(visibilityDistance[index]) >
        FOG_STATIC_CLEARANCE_PIXELS;
    const wasActive = Boolean(runtime.staticActivePixels[index]);
    runtime.staticTargetPixels[index] = target ? 1 : 0;
    if (!target) {
      runtime.staticActivePixels[index] = 0;
      runtime.pendingStaticSettles.delete(index);
      if (wasActive) activeChanges.push(index);
      continue;
    }
    if (wasActive) {
      runtime.pendingStaticSettles.delete(index);
      continue;
    }
    if (!runtime.pendingStaticSettles.has(index)) {
      runtime.pendingStaticSettles.set(
        index,
        staticSettleTime(
          runtime,
          index,
          now,
          distanceToPixels(visibilityDistance[index]),
        ),
      );
    }
  }
  return activeChanges;
};

type PixelFogTargetSource = Pick<
  PixelFogRuntime,
  | "pixelWidth"
  | "visiblePixels"
  | "discoveredPixels"
  | "visibilityDistance"
  | "discoveryDistance"
  | "staticActivePixels"
>;

const targetOpacityByteAt = (
  runtime: PixelFogTargetSource,
  index: number,
  rippleFrame: number,
) => {
  const pixelX = index % runtime.pixelWidth;
  const pixelY = Math.floor(index / runtime.pixelWidth);
  if (
    !runtime.visiblePixels[index] &&
    !runtime.discoveredPixels[index]
  ) {
    return ALPHA_BYTES[3];
  }

  const visibilityDistance = distanceToPixels(
    runtime.visibilityDistance[index],
  );
  const sightBoundary = runtime.visiblePixels[index]
    ? FOG_INNER_BOUNDARY_PIXELS
    : FOG_OUTER_BOUNDARY_PIXELS;
  const minimumSightReach = 1.25;
  const maximumSightReach =
    Math.max(
      FOG_INNER_BOUNDARY_PIXELS,
      FOG_OUTER_BOUNDARY_PIXELS,
    ) + FOG_RIPPLE_AMPLITUDE_PIXELS;
  if (visibilityDistance <= maximumSightReach) {
    if (visibilityDistance <= minimumSightReach) {
      return ALPHA_BYTES[1];
    }
    const sightBoundaryReach = clamp(
      sightBoundary +
        boundaryWave(pixelX, pixelY, rippleFrame, 17),
      minimumSightReach,
      maximumSightReach,
    );
    if (visibilityDistance <= sightBoundaryReach) {
      return ALPHA_BYTES[1];
    }
  }

  if (runtime.visiblePixels[index]) {
    return ALPHA_BYTES[0];
  }

  // Static fog and flowing fog are deliberately separate states. Static fog
  // can only draw after its delayed activation and one complete tile beyond
  // gameplay sight. Until then, coherent moving pixels own the whole region.
  let staticFogCanDraw = false;
  if (runtime.staticActivePixels[index]) {
    if (
      visibilityDistance >
      FOG_STATIC_CLEARANCE_PIXELS + FOG_RIPPLE_AMPLITUDE_PIXELS
    ) {
      staticFogCanDraw = true;
    } else if (
      visibilityDistance >
      FOG_STATIC_CLEARANCE_PIXELS - FOG_RIPPLE_AMPLITUDE_PIXELS
    ) {
      staticFogCanDraw =
        visibilityDistance >
        FOG_STATIC_CLEARANCE_PIXELS +
          boundaryWave(pixelX, pixelY, rippleFrame, 31);
    }
  }
  if (!staticFogCanDraw) {
    return ALPHA_BYTES[2];
  }

  const discoveryDistance = distanceToPixels(
    runtime.discoveryDistance[index],
  );
  if (discoveryDistance <= DISCOVERY_BOUNDARY_MIN_INSET) {
    return ALPHA_BYTES[3];
  }
  if (discoveryDistance > DISCOVERY_BOUNDARY_MAX_INSET) {
    return ALPHA_BYTES[2];
  }
  const discoveryWave = boundaryWave(
    pixelX,
    pixelY,
    rippleFrame,
    53,
  );
  const opaqueInset =
    DISCOVERY_BOUNDARY_MIN_INSET +
    ((discoveryWave + FOG_RIPPLE_AMPLITUDE_PIXELS) /
      (FOG_RIPPLE_AMPLITUDE_PIXELS * 2)) *
      DISCOVERY_BOUNDARY_VARIATION;
  if (
    discoveryDistance <= opaqueInset
  ) {
    return ALPHA_BYTES[3];
  }
  return ALPHA_BYTES[2];
};

const buildFogBoundaries = (
  runtime: PixelFogTargetSource,
  visibilityActivePixels: Int32Array,
  discoveryActivePixels: Int32Array,
  pendingStaticPixels: Iterable<number>,
  rippleFrame: number,
  boundaryMarks: Uint16Array,
  boundaryMarkGeneration: number,
) => {
  const boundaryPixels: number[] = [];
  const ripplePixels: number[] = [];
  const rippleMargin = Math.ceil(FOG_RIPPLE_AMPLITUDE_PIXELS);
  const sightCandidateDepth =
    Math.max(
      FOG_OUTER_BOUNDARY_PIXELS,
      FOG_INNER_BOUNDARY_PIXELS,
      FOG_STATIC_CLEARANCE_PIXELS,
    ) +
    Math.ceil(FOG_RIPPLE_AMPLITUDE_PIXELS);

  const includeBoundaryPixel = (index: number) => {
    if (boundaryMarks[index] === boundaryMarkGeneration) return;
    boundaryMarks[index] = boundaryMarkGeneration;
    boundaryPixels.push(index);
  };
  for (const index of visibilityActivePixels) {
    if (
      distanceToPixels(runtime.visibilityDistance[index]) <=
      sightCandidateDepth
    ) {
      includeBoundaryPixel(index);
    }
  }
  for (const index of discoveryActivePixels) {
    if (
      runtime.discoveredPixels[index] &&
      distanceToPixels(runtime.discoveryDistance[index]) <=
        DISCOVERY_BOUNDARY_DEPTH
    ) {
      includeBoundaryPixel(index);
    }
  }
  for (const index of pendingStaticPixels) {
    includeBoundaryPixel(index);
  }

  for (const index of boundaryPixels) {
    const visibilityDistance = distanceToPixels(
      runtime.visibilityDistance[index],
    );
    const sightBoundary =
      runtime.visiblePixels[index]
        ? FOG_INNER_BOUNDARY_PIXELS
        : FOG_OUTER_BOUNDARY_PIXELS;
    const nearSightBoundary =
      Math.abs(visibilityDistance - sightBoundary) <=
      rippleMargin;
    const nearStaticBoundary =
      !runtime.visiblePixels[index] &&
      Math.abs(
        visibilityDistance - FOG_STATIC_CLEARANCE_PIXELS,
      ) <= rippleMargin;
    const nearDiscoveryBoundary =
      Boolean(runtime.discoveredPixels[index]) &&
      distanceToPixels(runtime.discoveryDistance[index]) >=
        DISCOVERY_BOUNDARY_MIN_INSET - rippleMargin &&
      distanceToPixels(runtime.discoveryDistance[index]) <=
        DISCOVERY_BOUNDARY_MAX_INSET + rippleMargin;
    const canAnimateVisibilityBoundary =
      Boolean(runtime.visiblePixels[index]) ||
      Boolean(runtime.discoveredPixels[index]);
    if (
      (canAnimateVisibilityBoundary &&
        (nearSightBoundary || nearStaticBoundary)) ||
      nearDiscoveryBoundary
    ) {
      ripplePixels.push(index);
    }
  }

  return { boundaryPixels, ripplePixels };
};

const currentOpacityAt = (
  runtime: PixelFogRuntime,
  index: number,
  now: number,
) => {
  const transition = runtime.transitions.get(index);
  if (transition) return pixelFogTransitionAlpha(transition, now);
  return byteToAlpha(runtime.renderedOpacity[index] ?? ALPHA_BYTES[3]);
};

const schedulePixelTransition = (
  runtime: PixelFogRuntime,
  index: number,
  targetByte: number,
  now: number,
  delaySteps: number,
  rippleOnly: boolean,
) => {
  const from = currentOpacityAt(runtime, index, now);
  const to = byteToAlpha(targetByte);
  const fromLevel = nearestAlphaLevel(from);
  const toLevel = nearestAlphaLevel(to);
  if (fromLevel === toLevel) {
    const previousTransition = runtime.transitions.get(index);
    if (
      !previousTransition &&
      runtime.renderedOpacity[index] === targetByte
    ) {
      return false;
    }

    // Only advanceTransitions may commit renderedOpacity. Mutating it here
    // updates the backing array without painting the corresponding canvas
    // pixel, which can leave permanent clear or dark specks after a rapid
    // visibility reversal. A zero-duration transition cancels the old motion
    // while still flowing through the normal dirty-pixel paint path.
    runtime.transitions.set(index, {
      startedAt: now,
      duration: 0,
      from: ALPHA_LEVELS[fromLevel],
      to: ALPHA_LEVELS[toLevel],
      seed: previousTransition?.seed ?? 0,
      rippleOnly,
    });
    return true;
  }

  const pixelX = index % runtime.pixelWidth;
  const pixelY = Math.floor(index / runtime.pixelWidth);
  const seed = fogHash(
    Math.floor(pixelX / 4),
    Math.floor(pixelY / 4),
    71,
  );
  const clearing = to < from;
  const distanceTimeScale = rippleOnly
    ? 1
    : playerDistanceTimeScale(runtime, index);
  const baseDelay = rippleOnly
    ? 0
    : Math.min(
        VISIBILITY_DISTANCE_LIMIT,
        delaySteps,
      ) *
      (clearing ? REVEAL_PIXEL_DELAY_MS : CONCEAL_PIXEL_DELAY_MS) *
      distanceTimeScale;
  const distanceStartLag = rippleOnly
    ? 0
    : (distanceTimeScale - 1) * DISTANCE_START_LAG_MS;
  // A smooth spatial field keeps neighbouring frontier pixels in order.
  // Independent per-pixel random delays made the contour sparkle and allowed
  // isolated pixels to jump ahead of the propagation wave.
  const contourDelay =
    coherentDelayUnit(pixelX, pixelY, rippleOnly ? 149 : 131) *
    TRANSITION_CONTOUR_VARIATION_MS;
  const delay = Math.min(
    MAX_TRANSITION_DELAY_MS,
    baseDelay + distanceStartLag + contourDelay,
  );
  const boundaryProximity = clamp(
    delaySteps / FRONTIER_PROPAGATION_DEPTH_PIXELS,
    0,
    1,
  );
  const durationScale =
    clearing && !rippleOnly
      ? REVEAL_MIN_DURATION_SCALE +
        boundaryProximity * REVEAL_BOUNDARY_DURATION_BONUS
      : 1;
  const distanceDurationScale = rippleOnly
    ? 1
    : 1 +
      (distanceTimeScale - 1) *
        DISTANCE_DURATION_WEIGHT;
  runtime.transitions.set(index, {
    startedAt: now + delay,
    duration:
      Math.abs(toLevel - fromLevel) *
      FOG_LAYER_STEP_MS *
      durationScale *
      distanceDurationScale,
    from: ALPHA_LEVELS[fromLevel],
    to: ALPHA_LEVELS[toLevel],
    seed,
    rippleOnly,
  });
  return true;
};

const scheduleTargetChanges = (
  runtime: PixelFogRuntime,
  targetSource: PixelFogTargetSource,
  rippleFrame: number,
  changedPixels: number[],
  staticActiveChanges: number[],
  previousBoundaryPixels: number[],
  nextBoundaryPixels: number[],
  previousVisibilityDistance: Uint8Array,
  nextVisibilityDistance: Uint8Array,
  now: number,
  candidateMarks: Uint16Array,
  candidateMarkGeneration: number,
) => {
  const candidates: number[] = [];
  const includeCandidate = (index: number) => {
    if (candidateMarks[index] === candidateMarkGeneration) return;
    candidateMarks[index] = candidateMarkGeneration;
    candidates.push(index);
  };
  for (const index of changedPixels) includeCandidate(index);
  for (const index of staticActiveChanges) includeCandidate(index);
  for (const index of previousBoundaryPixels) {
    includeCandidate(index);
  }
  for (const index of nextBoundaryPixels) includeCandidate(index);

  let changed = 0;
  for (const index of candidates) {
    const previousTarget = runtime.targetOpacity[index];
    const nextTarget = targetOpacityByteAt(
      targetSource,
      index,
      rippleFrame,
    );
    if (previousTarget === nextTarget) continue;
    const current = currentOpacityAt(runtime, index, now);
    const clearing = byteToAlpha(nextTarget) < current;
    const distanceField = clearing
      ? previousVisibilityDistance
      : nextVisibilityDistance;
    const boundaryDistance = distanceToPixels(
      distanceField[index] ??
        VISIBILITY_DISTANCE_LIMIT * DISTANCE_SCALE,
    );
    const clampedBoundaryDistance = Math.min(
      FRONTIER_PROPAGATION_DEPTH_PIXELS,
      boundaryDistance,
    );
    // Clearing travels from the sight edge into the existing fog. Returning
    // fog uses the opposite order, advancing from the existing fog edge back
    // toward the sight edge.
    const delaySteps = clearing
      ? clampedBoundaryDistance
      : FRONTIER_PROPAGATION_DEPTH_PIXELS -
        clampedBoundaryDistance;
    if (
      schedulePixelTransition(
        runtime,
        index,
        nextTarget,
        now,
        delaySteps,
        false,
      )
    ) {
      changed += 1;
    }
    runtime.targetOpacity[index] = nextTarget;
  }
  runtime.lastTargetChangeCount = changed;
};

export function syncPixelFogRuntime(
  runtime: PixelFogRuntime,
  options: PixelFogSyncOptions,
) {
  if (runtime.engineVersion !== FOG_ENGINE_VERSION) {
    resetPixelFogRuntime(runtime);
  }
  if (runtime.mapKey !== options.mapKey) {
    resetPixelFogRuntime(runtime);
    runtime.mapKey = options.mapKey;
  }
  runtime.originPixelX =
    (options.originCellX - options.minCellX) *
    FOG_PIXELS_PER_CELL;
  runtime.originPixelY =
    (options.originCellY - options.minCellY) *
    FOG_PIXELS_PER_CELL;
  if (runtime.lastRevision === options.visibilityRevision) {
    runtime.lastSourceCellScans = 0;
    return;
  }

  const cellWidth = options.maxCellX - options.minCellX + 1;
  const cellHeight = options.maxCellY - options.minCellY + 1;
  const pixelWidth = cellWidth * FOG_PIXELS_PER_CELL;
  const pixelHeight = cellHeight * FOG_PIXELS_PER_CELL;
  const dimensionsChanged =
    runtime.pixelWidth !== pixelWidth ||
    runtime.pixelHeight !== pixelHeight ||
    runtime.minCellX !== options.minCellX ||
    runtime.minCellY !== options.minCellY;
  if (dimensionsChanged && runtime.initialized) {
    resetPixelFogRuntime(runtime);
    runtime.mapKey = options.mapKey;
  }

  runtime.minCellX = options.minCellX;
  runtime.minCellY = options.minCellY;
  runtime.cellWidth = cellWidth;
  runtime.cellHeight = cellHeight;
  runtime.pixelWidth = pixelWidth;
  runtime.pixelHeight = pixelHeight;
  preparePixelBuffers(
    runtime,
    pixelWidth * pixelHeight,
    cellWidth * cellHeight,
  );

  const previousVisibilityDistance = runtime.visibilityDistance;
  const previousDiscoveryDistance = runtime.discoveryDistance;
  const previousBoundaryPixels = runtime.boundaryPixels;
  const {
    visiblePixels,
    discoveredPixels,
    visibleCells,
    discoveredCells,
    changedPixels,
    cellWidth: rasterCellWidth,
    cellHeight: rasterCellHeight,
    sourceCellScans,
    visibilityChanged,
    discoveryChanged,
  } = rasterizeCellMasks(
    runtime,
    options,
    pixelWidth,
    pixelHeight,
  );
  const visibilityResult = visibilityChanged
    ? buildBoundaryDistance(
        visiblePixels,
        visibleCells,
        rasterCellWidth,
        rasterCellHeight,
        pixelWidth,
        pixelHeight,
        VISIBILITY_DISTANCE_LIMIT,
        runtime.visibilityDistanceScratch,
      )
    : {
        distances: runtime.visibilityDistance,
        activePixels: runtime.visibilityActivePixels,
      };
  const visibilityDistance = visibilityResult.distances;
  const visibilityActivePixels = visibilityResult.activePixels;
  const discoveryResult = discoveryChanged
    ? buildBoundaryDistance(
        discoveredPixels,
        discoveredCells,
        rasterCellWidth,
        rasterCellHeight,
        pixelWidth,
        pixelHeight,
        DISCOVERY_BOUNDARY_DEPTH,
        runtime.discoveryDistanceScratch,
      )
    : {
        distances: runtime.discoveryDistance,
        activePixels: runtime.discoveryActivePixels,
      };
  const discoveryDistance = discoveryResult.distances;
  const discoveryActivePixels = discoveryResult.activePixels;
  runtime.candidateMarkGeneration = nextMarkGeneration(
    runtime.candidateMarks,
    runtime.candidateMarkGeneration,
  );
  const staticActiveChanges = reconcileStaticFog(
    runtime,
    visiblePixels,
    visibilityDistance,
    changedPixels,
    previousBoundaryPixels,
    visibilityActivePixels,
    options.now,
    !runtime.initialized,
    runtime.candidateMarks,
    runtime.candidateMarkGeneration,
  );
  runtime.boundaryMarkGeneration = nextMarkGeneration(
    runtime.boundaryMarks,
    runtime.boundaryMarkGeneration,
  );
  const rippleFrame = Math.floor(options.now / FOG_RIPPLE_FRAME_MS);
  const targetSource = {
    pixelWidth,
    visiblePixels,
    discoveredPixels,
    visibilityDistance,
    discoveryDistance,
    staticActivePixels: runtime.staticActivePixels,
  };
  const { boundaryPixels, ripplePixels } = buildFogBoundaries(
    targetSource,
    visibilityActivePixels,
    discoveryActivePixels,
    runtime.pendingStaticSettles.keys(),
    rippleFrame,
    runtime.boundaryMarks,
    runtime.boundaryMarkGeneration,
  );

  runtime.lastRevision = options.visibilityRevision;
  runtime.boundaryPixels = boundaryPixels;
  runtime.ripplePixels = ripplePixels;
  runtime.lastRippleFrame = rippleFrame;
  runtime.lastSourceCellScans = sourceCellScans;
  runtime.lastRippleTouched = ripplePixels.length;

  if (!runtime.initialized) {
    for (let index = 0; index < runtime.targetOpacity.length; index += 1) {
      runtime.targetOpacity[index] = targetOpacityByteAt(
        targetSource,
        index,
        rippleFrame,
      );
    }
    runtime.initialized = true;
    runtime.renderedOpacity.set(runtime.targetOpacity);
    runtime.transitions.clear();
    runtime.needsFullPaint = true;
    runtime.lastTargetChangeCount = 0;
    if (visibilityChanged) {
      runtime.visibilityDistance = visibilityDistance;
      runtime.visibilityDistanceScratch = previousVisibilityDistance;
      runtime.visibilityActivePixels = visibilityActivePixels;
    }
    if (discoveryChanged) {
      runtime.discoveryDistance = discoveryDistance;
      runtime.discoveryDistanceScratch = previousDiscoveryDistance;
      runtime.discoveryActivePixels = discoveryActivePixels;
    }
    return;
  }

  runtime.candidateMarkGeneration = nextMarkGeneration(
    runtime.candidateMarks,
    runtime.candidateMarkGeneration,
  );
  scheduleTargetChanges(
    runtime,
    targetSource,
    rippleFrame,
    changedPixels,
    staticActiveChanges,
    previousBoundaryPixels,
    boundaryPixels,
    previousVisibilityDistance,
    visibilityDistance,
    options.now,
    runtime.candidateMarks,
    runtime.candidateMarkGeneration,
  );
  if (visibilityChanged) {
    runtime.visibilityDistance = visibilityDistance;
    runtime.visibilityDistanceScratch = previousVisibilityDistance;
    runtime.visibilityActivePixels = visibilityActivePixels;
  }
  if (discoveryChanged) {
    runtime.discoveryDistance = discoveryDistance;
    runtime.discoveryDistanceScratch = previousDiscoveryDistance;
    runtime.discoveryActivePixels = discoveryActivePixels;
  }
};

const advanceStaticSettles = (
  runtime: PixelFogRuntime,
  now: number,
) => {
  if (runtime.pendingStaticSettles.size === 0) return;
  const rippleFrame = Math.floor(now / FOG_RIPPLE_FRAME_MS);
  for (const [index, readyAt] of runtime.pendingStaticSettles) {
    if (now < readyAt) continue;
    runtime.pendingStaticSettles.delete(index);
    if (!runtime.staticTargetPixels[index]) continue;

    runtime.staticActivePixels[index] = 1;
    const targetByte = targetOpacityByteAt(
      runtime,
      index,
      rippleFrame,
    );
    if (targetByte === runtime.targetOpacity[index]) continue;
    runtime.targetOpacity[index] = targetByte;
    schedulePixelTransition(
      runtime,
      index,
      targetByte,
      now,
      distanceToPixels(runtime.visibilityDistance[index]),
      false,
    );
  }
};

const updateRippleTargets = (
  runtime: PixelFogRuntime,
  now: number,
) => {
  const rippleFrame = Math.floor(now / FOG_RIPPLE_FRAME_MS);
  if (
    !runtime.initialized ||
    rippleFrame === runtime.lastRippleFrame
  ) {
    runtime.lastRippleTouched = 0;
    return;
  }
  runtime.lastRippleFrame = rippleFrame;
  runtime.lastRippleTouched = runtime.ripplePixels.length;
  let changed = 0;
  for (const index of runtime.ripplePixels) {
    const activeTransition = runtime.transitions.get(index);
    if (
      activeTransition &&
      now <
        activeTransition.startedAt + activeTransition.duration
    ) {
      // Ambient contour motion must never interrupt a visibility transition.
      // Retargeting a moving pixel every ripple frame was the main source of
      // flicker and isolated pixels that appeared to move backward.
      continue;
    }
    const targetByte = targetOpacityByteAt(
      runtime,
      index,
      rippleFrame,
    );
    if (targetByte === runtime.targetOpacity[index]) continue;
    runtime.targetOpacity[index] = targetByte;
    if (
      schedulePixelTransition(
        runtime,
        index,
        targetByte,
        now,
        0,
        true,
      )
    ) {
      changed += 1;
    }
  }
  runtime.lastTargetChangeCount = changed;
};

const advanceTransitions = (
  runtime: PixelFogRuntime,
  now: number,
) => {
  const dirty: number[] = [];
  for (const [index, transition] of runtime.transitions) {
    const completed =
      now >= transition.startedAt + transition.duration;
    const nextByte = completed
      ? alphaToByte(transition.to)
      : alphaToByte(pixelFogTransitionAlpha(transition, now));
    if (runtime.renderedOpacity[index] !== nextByte) {
      runtime.renderedOpacity[index] = nextByte;
      dirty.push(index);
    }
    if (completed) runtime.transitions.delete(index);
  }
  return dirty;
};

const paintFullFog = (
  context: CanvasRenderingContext2D,
  runtime: PixelFogRuntime,
) => {
  context.save();
  context.globalCompositeOperation = "source-over";
  context.clearRect(
    0,
    0,
    context.canvas.width,
    context.canvas.height,
  );
  context.fillStyle = FOG_COLOR;

  for (let pixelY = 0; pixelY < runtime.pixelHeight; pixelY += 1) {
    const rowStart = pixelY * runtime.pixelWidth;
    let runStart = 0;
    let runOpacity = runtime.renderedOpacity[rowStart];
    for (
      let pixelX = 1;
      pixelX <= runtime.pixelWidth;
      pixelX += 1
    ) {
      const nextOpacity =
        pixelX < runtime.pixelWidth
          ? runtime.renderedOpacity[rowStart + pixelX]
          : -1;
      if (nextOpacity === runOpacity) continue;
      if (runOpacity > 0) {
        context.globalAlpha = runOpacity / 255;
        context.fillRect(
          runStart,
          pixelY,
          pixelX - runStart,
          1,
        );
      }
      runStart = pixelX;
      runOpacity = nextOpacity;
    }
  }
  context.restore();
};

const paintDirtyFog = (
  context: CanvasRenderingContext2D,
  runtime: PixelFogRuntime,
  dirty: number[],
) => {
  if (dirty.length === 0) return;
  const opacityGroups = ALPHA_BYTES.map(() => [] as number[]);
  context.save();
  context.globalCompositeOperation = "source-over";
  context.fillStyle = FOG_COLOR;

  for (const index of dirty) {
    const pixelX = index % runtime.pixelWidth;
    const pixelY = Math.floor(index / runtime.pixelWidth);
    context.clearRect(pixelX, pixelY, 1, 1);
    const opacity = runtime.renderedOpacity[index];
    opacityGroups[nearestAlphaLevel(byteToAlpha(opacity))].push(index);
  }

  for (
    let levelIndex = 1;
    levelIndex < opacityGroups.length;
    levelIndex += 1
  ) {
    context.globalAlpha = ALPHA_LEVELS[levelIndex];
    for (const index of opacityGroups[levelIndex]) {
      context.fillRect(
        index % runtime.pixelWidth,
        Math.floor(index / runtime.pixelWidth),
        1,
        1,
      );
    }
  }
  context.restore();
};

export function drawPixelFogTexture(
  context: CanvasRenderingContext2D,
  options: PixelFogTextureOptions,
) {
  syncPixelFogRuntime(options.runtime, options);
  advanceStaticSettles(options.runtime, options.now);
  updateRippleTargets(options.runtime, options.now);
  const dirty = advanceTransitions(options.runtime, options.now);
  const canvasChanged =
    options.runtime.paintedWidth !== context.canvas.width ||
    options.runtime.paintedHeight !== context.canvas.height;

  if (options.runtime.needsFullPaint || canvasChanged) {
    paintFullFog(context, options.runtime);
    options.runtime.needsFullPaint = false;
    options.runtime.paintedWidth = context.canvas.width;
    options.runtime.paintedHeight = context.canvas.height;
    options.runtime.lastPaintedPixels =
      options.runtime.renderedOpacity.length;
    return;
  }

  paintDirtyFog(context, options.runtime, dirty);
  options.runtime.lastPaintedPixels = dirty.length;
}

const pixelIndexFor = (
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
) => {
  if (
    pixelX < 0 ||
    pixelY < 0 ||
    pixelX >= runtime.pixelWidth ||
    pixelY >= runtime.pixelHeight
  ) {
    return -1;
  }
  return pixelY * runtime.pixelWidth + pixelX;
};

export function pixelFogMaskAlpha(
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
  now: number,
) {
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  if (index < 0) return FOG_UNEXPLORED_ALPHA;
  return currentOpacityAt(runtime, index, now);
}

export function pixelFogStableMaskAlpha(
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
  rippleFrame: number,
) {
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  if (index < 0) return FOG_UNEXPLORED_ALPHA;
  return byteToAlpha(
    targetOpacityByteAt(runtime, index, rippleFrame),
  );
}

export function pixelFogVisibilityDistance(
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
) {
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  if (index < 0) return VISIBILITY_DISTANCE_LIMIT + 1;
  return distanceToPixels(runtime.visibilityDistance[index]);
}

export function usesStaticFogAtPixel(
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
  rippleFrame: number,
) {
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  if (index < 0) return true;
  if (runtime.visiblePixels[index]) return false;
  return (
    Boolean(runtime.staticActivePixels[index]) &&
    distanceToPixels(runtime.visibilityDistance[index]) >
      FOG_STATIC_CLEARANCE_PIXELS +
      boundaryWave(pixelX, pixelY, rippleFrame, 31)
  );
}

export function pixelFogStaticSettleAt(
  runtime: PixelFogRuntime,
  pixelX: number,
  pixelY: number,
) {
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  if (index < 0) return null;
  return runtime.pendingStaticSettles.get(index) ?? null;
}

export function usesRememberedFogBase(
  runtime: PixelFogRuntime,
  cellX: number,
  cellY: number,
) {
  const pixelX =
    (cellX - runtime.minCellX) * FOG_PIXELS_PER_CELL +
    Math.floor(FOG_PIXELS_PER_CELL / 2);
  const pixelY =
    (cellY - runtime.minCellY) * FOG_PIXELS_PER_CELL +
    Math.floor(FOG_PIXELS_PER_CELL / 2);
  const index = pixelIndexFor(runtime, pixelX, pixelY);
  return (
    index >= 0 &&
    Boolean(runtime.discoveredPixels[index]) &&
    !runtime.visiblePixels[index]
  );
}

export function pixelFogBoundaryStats(runtime: PixelFogRuntime) {
  return {
    totalPixels: runtime.pixelWidth * runtime.pixelHeight,
    boundaryPixels: runtime.boundaryPixels.length,
    ripplePixels: runtime.ripplePixels.length,
    activeTransitions: runtime.transitions.size,
    pendingStaticSettles: runtime.pendingStaticSettles.size,
    sourceCellScans: runtime.lastSourceCellScans,
    rippleTouched: runtime.lastRippleTouched,
    targetChanges: runtime.lastTargetChangeCount,
    paintedPixels: runtime.lastPaintedPixels,
    bufferAllocations: runtime.bufferAllocationCount,
  };
}
