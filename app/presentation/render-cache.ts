import { fogMasksForTile, terrainVisual, wallOverlayVisual } from "./render";
import { Companion, Enemy, GameState, Terrain } from "../game/types";

const EMPTY_FRAME = -1;
const TERRAIN_CODE: Record<Terrain, number> = {
  wall: 1,
  floor: 2,
  grass: 3,
  highGrass: 4,
  water: 5,
  entrance: 6,
  exit: 7,
  door: 8,
  openDoor: 9,
  lockedDoor: 10,
};

export type DungeonRenderCache = {
  state: GameState | null;
  tiles: GameState["tiles"] | null;
  enemies: GameState["enemies"] | null;
  companions: GameState["companions"] | null;
  width: number;
  height: number;
  terrainFrames: Int16Array;
  overlayFrames: Int16Array;
  terrainKeys: Uint16Array;
  visibleMasks: Uint8Array;
  discoveredMasks: Uint8Array;
  sortedEnemies: Enemy[];
  sortedCompanions: Companion[];
  fogRevision: number;
  stateSyncs: number;
  tileRebuilds: number;
  terrainRebuilds: number;
  visibilityRebuilds: number;
  tileCacheHits: number;
};

export function createDungeonRenderCache(): DungeonRenderCache {
  return {
    state: null,
    tiles: null,
    enemies: null,
    companions: null,
    width: 0,
    height: 0,
    terrainFrames: new Int16Array(),
    overlayFrames: new Int16Array(),
    terrainKeys: new Uint16Array(),
    visibleMasks: new Uint8Array(),
    discoveredMasks: new Uint8Array(),
    sortedEnemies: [],
    sortedCompanions: [],
    fogRevision: 0,
    stateSyncs: 0,
    tileRebuilds: 0,
    terrainRebuilds: 0,
    visibilityRebuilds: 0,
    tileCacheHits: 0,
  };
}

function allocateTileBuffers(cache: DungeonRenderCache, size: number) {
  cache.terrainFrames = new Int16Array(size);
  cache.overlayFrames = new Int16Array(size);
  cache.terrainKeys = new Uint16Array(size);
  cache.visibleMasks = new Uint8Array(size);
  cache.discoveredMasks = new Uint8Array(size);
}

/**
 * Synchronizes data used by the canvas renderer.
 *
 * Game actions use structural sharing for terrain that did not change. That
 * makes the tile-grid reference a cheap, reliable revision key: inventory,
 * quick-slot, combat, and UI actions can reuse every visual/fog lookup, while
 * movement or terrain changes rebuild the compact typed-array cache once.
 */
export function syncDungeonRenderCache(
  cache: DungeonRenderCache,
  state: GameState,
) {
  if (cache.state === state) return cache;

  cache.state = state;
  cache.stateSyncs += 1;

  if (cache.enemies !== state.enemies) {
    cache.enemies = state.enemies;
    cache.sortedEnemies = [...state.enemies].sort((a, b) => a.y - b.y);
  }
  if (cache.companions !== state.companions) {
    cache.companions = state.companions;
    cache.sortedCompanions = [...state.companions].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    );
  }

  if (
    cache.tiles === state.tiles &&
    cache.width === state.width &&
    cache.height === state.height
  ) {
    cache.tileCacheHits += 1;
    return cache;
  }

  const size = state.width * state.height;
  const dimensionsChanged =
    cache.width !== state.width ||
    cache.height !== state.height ||
    cache.terrainFrames.length !== size;
  if (dimensionsChanged) {
    allocateTileBuffers(cache, size);
  }
  cache.width = state.width;
  cache.height = state.height;
  cache.tiles = state.tiles;

  let terrainChanged = dimensionsChanged;
  if (!terrainChanged) {
    for (let y = 0; y < state.height && !terrainChanged; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const index = x + y * state.width;
        const tile = state.tiles[y][x];
        const key = (TERRAIN_CODE[tile.terrain] << 8) | (tile.variant & 0xff);
        if (cache.terrainKeys[index] !== key) {
          terrainChanged = true;
          break;
        }
      }
    }
  }

  if (terrainChanged) {
    for (let y = 0; y < state.height; y += 1) {
      for (let x = 0; x < state.width; x += 1) {
        const index = x + y * state.width;
        const tile = state.tiles[y][x];
        cache.terrainKeys[index] =
          (TERRAIN_CODE[tile.terrain] << 8) | (tile.variant & 0xff);
        cache.terrainFrames[index] =
          terrainVisual(state, x, y) ?? EMPTY_FRAME;
        cache.overlayFrames[index] =
          wallOverlayVisual(state, x, y) ?? EMPTY_FRAME;
      }
    }
    cache.terrainRebuilds += 1;
  }

  let visibilityChanged = dimensionsChanged;
  for (let y = 0; y < state.height; y += 1) {
    for (let x = 0; x < state.width; x += 1) {
      const index = x + y * state.width;
      const terrainFrame = frameAt(cache.terrainFrames, cache, x, y);
      const overlayFrame = frameAt(cache.overlayFrames, cache, x, y);
      const fogFrame = terrainFrame ?? overlayFrame;
      const masks = fogMasksForTile(state.tiles[y][x], fogFrame);
      if (
        cache.visibleMasks[index] !== masks.visibleMask ||
        cache.discoveredMasks[index] !== masks.discoveredMask
      ) {
        visibilityChanged = true;
      }
      cache.visibleMasks[index] = masks.visibleMask;
      cache.discoveredMasks[index] = masks.discoveredMask;
    }
  }

  cache.tileRebuilds += 1;
  if (visibilityChanged) {
    cache.visibilityRebuilds += 1;
    cache.fogRevision += 1;
  }
  return cache;
}

function frameAt(
  frames: Int16Array,
  cache: DungeonRenderCache,
  x: number,
  y: number,
) {
  if (x < 0 || y < 0 || x >= cache.width || y >= cache.height) {
    return null;
  }
  const frame = frames[x + y * cache.width];
  return frame === EMPTY_FRAME ? null : frame;
}

export function terrainFrameAt(
  cache: DungeonRenderCache,
  x: number,
  y: number,
) {
  return frameAt(cache.terrainFrames, cache, x, y);
}

export function overlayFrameAt(
  cache: DungeonRenderCache,
  x: number,
  y: number,
) {
  return frameAt(cache.overlayFrames, cache, x, y);
}

export function fogMaskBitAt(
  cache: DungeonRenderCache,
  cellX: number,
  cellY: number,
  field: "visible" | "discovered",
) {
  const tileX = Math.floor(cellX / 2);
  const tileY = Math.floor(cellY / 2);
  if (
    tileX < 0 ||
    tileY < 0 ||
    tileX >= cache.width ||
    tileY >= cache.height
  ) {
    return false;
  }
  const localX = cellX - tileX * 2;
  const localY = cellY - tileY * 2;
  const bit = 1 << (localX + localY * 2);
  const masks =
    field === "visible" ? cache.visibleMasks : cache.discoveredMasks;
  return Boolean(masks[tileX + tileY * cache.width] & bit);
}
