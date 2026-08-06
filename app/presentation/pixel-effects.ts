import type {
  CloudKind,
} from "../game/types";
import { retainInPlace } from "./animation-runtime";
import { PIXEL_EFFECT_CELLS_PER_TILE } from "./pixel-effect-types";
import type {
  PixelCameraShake,
  PixelEffect,
  PixelEffectLayer,
  PixelEffectViewport,
  PixelParticleEffect,
} from "./pixel-effect-types";
export type {
  PixelCameraShake,
  PixelClipBounds,
  PixelEffect,
  PixelEffectBase,
  PixelEffectLayer,
  PixelEffectViewport,
  PixelParticleEffect,
  PixelRingEffect,
  PixelScreenFlashEffect,
  PixelWaterFrontierEffect,
} from "./pixel-effect-types";
export { createCompanionSkillEffects } from "./skill-particle-recipes";

type EffectOrigin = {
  idPrefix: string;
  x: number;
  y: number;
  startedAt: number;
};

const COLORS = {
  dust: ["#ead9aa", "#d1c098", "#a9946a", "#786a4f"],
  hitWarm: ["#fff4bd", "#ffcf64", "#ff7657", "#ffffff"],
  hitCold: ["#ddf8ff", "#8bdcff", "#ffffff"],
  level: ["#fff5b8", "#f2cd62", "#9ceeff", "#ffffff"],
  enchant: ["#fff4a8", "#d69cff", "#8be7ff", "#ffffff"],
} as const;

export type LogicalGridPixel = {
  x: number;
  y: number;
  size: 1 | 2;
  color: string;
  alpha: number;
};

const FIELD_PALETTES: Record<CloudKind, readonly string[]> = {
  fire: ["#fff4a8", "#ffd25f", "#ff8747", "#d94b32"],
  frost: ["#ffffff", "#d9f8ff", "#8ee9ff", "#67aeca"],
  paralytic: ["#fffbd0", "#f0e57e", "#c8b94f", "#8f803b"],
  toxic: ["#e4f29b", "#a9d56e", "#79ae58", "#426d3d"],
  corrosive: ["#fff6a8", "#d5e36c", "#9abd43", "#58732f"],
  storm: ["#ffffff", "#c8f3ff", "#8bdcff", "#4f86d8"],
};

const fieldPixelCache = new Map<string, readonly LogicalGridPixel[]>();
const burningPixelCache = new Map<string, readonly LogicalGridPixel[]>();

const pixelHash = (seed: number, index: number) => {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return (value ^ (value >>> 16)) >>> 0;
};

const gridPixel = (
  pixels: LogicalGridPixel[],
  x: number,
  y: number,
  color: string,
  alpha = 1,
  size: 1 | 2 = 1,
) => {
  pixels.push({
    x: Math.max(
      0,
      Math.min(PIXEL_EFFECT_CELLS_PER_TILE - size, Math.round(x)),
    ),
    y: Math.max(
      0,
      Math.min(PIXEL_EFFECT_CELLS_PER_TILE - size, Math.round(y)),
    ),
    size,
    color,
    alpha: Math.max(0, Math.min(1, alpha)),
  });
};

/**
 * Produces a tile-local animated field effect on the original 16×16 logical
 * pixel grid. The renderer scales these integer pixels without smoothing.
 */
export function fieldTilePixels(
  kind: CloudKind,
  now: number,
  seed = 0,
): readonly LogicalGridPixel[] {
  const phase = Math.floor(now / 90) % 24;
  const variant = Math.abs(seed) % 32;
  const cacheKey = `${kind}:${phase}:${variant}`;
  const cached = fieldPixelCache.get(cacheKey);
  if (cached) return cached;
  const palette = FIELD_PALETTES[kind];
  const pixels: LogicalGridPixel[] = [];

  if (kind === "fire") {
    for (let index = 0; index < 18; index += 1) {
      const hash = pixelHash(variant, index);
      const x = 1 + (hash % 14);
      const rise = (phase * 2 + index * 3 + (hash >>> 8)) % 12;
      const y = 15 - rise;
      gridPixel(
        pixels,
        x,
        y,
        palette[(index + phase) % palette.length],
        0.52 + ((hash >>> 16) % 40) / 100,
        index % 7 === 0 ? 2 : 1,
      );
    }
  } else if (kind === "frost") {
    for (let index = 0; index < 12; index += 1) {
      const hash = pixelHash(variant + phase, index);
      const edge = index % 4;
      const offset = 1 + (hash % 14);
      const x = edge === 0 ? offset : edge === 1 ? 14 : edge === 2 ? offset : 1;
      const y = edge === 0 ? 1 : edge === 1 ? offset : edge === 2 ? 14 : offset;
      gridPixel(pixels, x, y, palette[index % palette.length], 0.62, index % 6 === 0 ? 2 : 1);
    }
    [5, 8, 11].forEach((x, index) => {
      const pulse = (phase + index * 3) % 6;
      gridPixel(pixels, x, 5 + pulse, palette[index], 0.85);
      gridPixel(pixels, x - 1, 6 + pulse, palette[1], 0.6);
      gridPixel(pixels, x + 1, 6 + pulse, palette[1], 0.6);
    });
  } else if (kind === "paralytic" || kind === "storm") {
    const verticalShift = phase % 5;
    for (let index = 0; index < 16; index += 1) {
      const x = 1 + ((index * 5 + variant) % 14);
      const y = 1 + ((index * 3 + verticalShift) % 14);
      gridPixel(
        pixels,
        x,
        y,
        palette[(index + phase) % palette.length],
        kind === "storm" ? 0.9 : 0.68,
        index % 8 === 0 ? 2 : 1,
      );
      if (index % 4 === 0) {
        gridPixel(pixels, x + 1, y + 1, palette[0], 0.75);
      }
    }
  } else {
    const corrosive = kind === "corrosive";
    for (let index = 0; index < (corrosive ? 20 : 15); index += 1) {
      const hash = pixelHash(variant, index);
      const x = 1 + (hash % 14);
      const lift = (phase + index * 2 + (hash >>> 7)) % 13;
      const y = 14 - lift;
      const size: 1 | 2 = index % (corrosive ? 5 : 7) === 0 ? 2 : 1;
      gridPixel(
        pixels,
        x,
        y,
        palette[(index + phase) % palette.length],
        corrosive ? 0.78 : 0.62,
        size,
      );
    }
  }
  fieldPixelCache.set(cacheKey, pixels);
  return pixels;
}

/** Animated 16×16 flames that stay attached to a burning actor. */
export function burningStatusPixels(
  now: number,
  seed = 0,
): readonly LogicalGridPixel[] {
  const phase = Math.floor(now / 75) % 24;
  const variant = Math.abs(seed) % 32;
  const cacheKey = `${phase}:${variant}`;
  const cached = burningPixelCache.get(cacheKey);
  if (cached) return cached;
  const palette = FIELD_PALETTES.fire;
  const pixels: LogicalGridPixel[] = [];
  for (let index = 0; index < 18; index += 1) {
    const hash = pixelHash(variant + 41, index);
    const x = 3 + (hash % 10);
    const rise = (phase * 2 + index * 3 + (hash >>> 9)) % 13;
    const y = 15 - rise;
    gridPixel(
      pixels,
      x,
      y,
      palette[(index + phase) % palette.length],
      0.68 + ((hash >>> 17) % 30) / 100,
      index % 8 === 0 ? 2 : 1,
    );
  }
  burningPixelCache.set(cacheKey, pixels);
  return pixels;
}

const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

export function createDustEffects(
  origin: EffectOrigin,
  random: () => number = Math.random,
  tileSize = 48,
): PixelEffect[] {
  const worldPixelSize = tileSize / PIXEL_EFFECT_CELLS_PER_TILE;
  const tileX = Math.floor(origin.x / tileSize) * tileSize;
  const tileY = Math.floor(origin.y / tileSize) * tileSize;
  const clipBounds = {
    x: tileX,
    y: tileY,
    width: tileSize,
    height: tileSize,
  };
  const particles: PixelEffect[] = Array.from({ length: 14 }, (_, index) => {
    const direction = random() < 0.5 ? -1 : 1;
    return {
      id: `${origin.idPrefix}-dust-${index}`,
      kind: "particle",
      layer: "ground",
      x:
        tileX +
        (2 + Math.floor(random() * 12) + 0.5) *
          worldPixelSize,
      y:
        tileY +
        (11 + Math.floor(random() * 4) + 0.5) *
          worldPixelSize,
      velocityX:
        direction * worldPixelSize * (5 + random() * 8),
      velocityY: -worldPixelSize * (5 + random() * 7),
      gravity: worldPixelSize * (15 + random() * 7),
      drag: 0.38,
      cellSize: index % 5 === 0 ? 2 : 1,
      color: COLORS.dust[Math.floor(random() * COLORS.dust.length)],
      startedAt: origin.startedAt + random() * 30,
      duration: 360 + random() * 220,
      worldPixelSize,
      clipBounds,
    };
  });
  particles.push({
    id: `${origin.idPrefix}-dust-ring`,
    kind: "ring",
    layer: "ground",
    x: origin.x,
    y: origin.y,
    startRadius: 2,
    endRadius: tileSize * 0.36,
    aspectY: 0.32,
    pixelSize: 1,
    segments: 18,
    color: "#d8c38f",
    startedAt: origin.startedAt,
    duration: 360,
    worldPixelSize,
    clipBounds,
  });
  return particles;
}

type WaterTile = {
  x: number;
  y: number;
  surfaceRows?: readonly number[];
};
type TerrainCell = { terrain: string };
const FULL_WATER_SURFACE_ROWS = Object.freeze(
  Array.from({ length: 16 }, () => 0xffff),
);

export function connectedWaterTiles(
  tiles: readonly (readonly TerrainCell[])[],
  start: WaterTile,
) {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  if (
    start.x < 0 ||
    start.y < 0 ||
    start.x >= width ||
    start.y >= height ||
    tiles[start.y]?.[start.x]?.terrain !== "water"
  ) {
    return [] as WaterTile[];
  }

  const visited = new Uint8Array(width * height);
  const queue: WaterTile[] = [start];
  const waterTiles: WaterTile[] = [];
  visited[start.y * width + start.x] = 1;
  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const point = queue[queueIndex];
    waterTiles.push(point);
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const x = point.x + dx;
      const y = point.y + dy;
      const index = y * width + x;
      if (
        x < 0 ||
        y < 0 ||
        x >= width ||
        y >= height ||
        visited[index] ||
        tiles[y]?.[x]?.terrain !== "water"
      ) {
        continue;
      }
      visited[index] = 1;
      queue.push({ x, y });
    }
  }
  return waterTiles;
}

export function createWaterRippleEffects(
  origin: EffectOrigin,
  waterTiles: readonly WaterTile[],
  tileSize = 48,
): PixelEffect[] {
  if (waterTiles.length === 0) return [];
  const pixelsPerTile = PIXEL_EFFECT_CELLS_PER_TILE;
  const worldPixelSize = tileSize / pixelsPerTile;
  let minimumTileX = waterTiles[0].x;
  let maximumTileX = waterTiles[0].x;
  let minimumTileY = waterTiles[0].y;
  let maximumTileY = waterTiles[0].y;
  for (const tile of waterTiles) {
    minimumTileX = Math.min(minimumTileX, tile.x);
    maximumTileX = Math.max(maximumTileX, tile.x);
    minimumTileY = Math.min(minimumTileY, tile.y);
    maximumTileY = Math.max(maximumTileY, tile.y);
  }
  const tileMaskWidth = maximumTileX - minimumTileX + 1;
  const tileMaskHeight = maximumTileY - minimumTileY + 1;
  const pixelMaskWidth = tileMaskWidth * pixelsPerTile;
  const pixelMaskHeight = tileMaskHeight * pixelsPerTile;
  const pixelMask = new Uint8Array(pixelMaskWidth * pixelMaskHeight);
  for (const tile of waterTiles) {
    const surfaceRows =
      tile.surfaceRows ?? FULL_WATER_SURFACE_ROWS;
    const startX = (tile.x - minimumTileX) * pixelsPerTile;
    const startY = (tile.y - minimumTileY) * pixelsPerTile;
    for (let localY = 0; localY < pixelsPerTile; localY += 1) {
      const rowMask = surfaceRows[localY] ?? 0;
      const rowStart = (startY + localY) * pixelMaskWidth + startX;
      for (let localX = 0; localX < pixelsPerTile; localX += 1) {
        if (rowMask & (1 << localX)) {
          pixelMask[rowStart + localX] = 1;
        }
      }
    }
  }
  const isWaterPixel = (pixelX: number, pixelY: number) => {
    const localX = pixelX - minimumTileX * pixelsPerTile;
    const localY = pixelY - minimumTileY * pixelsPerTile;
    if (
      localX < 0 ||
      localY < 0 ||
      localX >= pixelMaskWidth ||
      localY >= pixelMaskHeight
    ) {
      return false;
    }
    return Boolean(pixelMask[localY * pixelMaskWidth + localX]);
  };

  const originPixelX = Math.floor(origin.x / worldPixelSize);
  const originPixelY = Math.floor(origin.y / worldPixelSize);
  const ringPoints: number[][] = [];
  const edgePoints: number[][] = [];
  let maximumRadius = 0;
  for (const tile of waterTiles) {
    const startPixelX = tile.x * pixelsPerTile;
    const startPixelY = tile.y * pixelsPerTile;
    for (let localY = 0; localY < pixelsPerTile; localY += 1) {
      const pixelY = startPixelY + localY;
      for (let localX = 0; localX < pixelsPerTile; localX += 1) {
        const pixelX = startPixelX + localX;
        if (!isWaterPixel(pixelX, pixelY)) continue;
        const radius = Math.round(
          Math.hypot(
            pixelX - originPixelX,
            pixelY - originPixelY,
          ),
        );
        maximumRadius = Math.max(maximumRadius, radius);
        const ring = ringPoints[radius] ?? (ringPoints[radius] = []);
        ring.push(pixelX, pixelY);
        const onWaterEdge =
          !isWaterPixel(pixelX - 1, pixelY) ||
          !isWaterPixel(pixelX + 1, pixelY) ||
          !isWaterPixel(pixelX, pixelY - 1) ||
          !isWaterPixel(pixelX, pixelY + 1);
        if (onWaterEdge) {
          const edge =
            edgePoints[radius] ?? (edgePoints[radius] = []);
          edge.push(pixelX, pixelY);
        }
      }
    }
  }

  if (maximumRadius === 0 && !ringPoints[0]?.length) return [];
  const expansionDuration = Math.min(
    1200,
    Math.max(620, 480 + maximumRadius * 9),
  );
  // The ripple has its own lifetime from the instant it is created. A large
  // puddle can therefore outlive neither its animation budget nor the player
  // action merely because the frontier has not reached the distant bank yet.
  const holdDuration = 0;
  const fadeDuration = 70;
  const lifetimeDuration = 820;
  return [
    {
      id: `${origin.idPrefix}-water-frontier`,
      kind: "waterFrontier",
      layer: "ground",
      x: origin.x,
      y: origin.y,
      worldPixelSize,
      rings: Array.from(
        { length: maximumRadius + 1 },
        (_, index) => Uint16Array.from(ringPoints[index] ?? []),
      ),
      edgeRings: Array.from(
        { length: maximumRadius + 1 },
        (_, index) => Uint16Array.from(edgePoints[index] ?? []),
      ),
      color: "#f4fdff",
      startedAt: origin.startedAt,
      expansionDuration,
      holdDuration,
      fadeDuration,
      duration: lifetimeDuration,
    },
  ];
}

export function createHitEffects(
  origin: EffectOrigin & {
    color?: string;
    cold?: boolean;
    strong?: boolean;
  },
  random: () => number = Math.random,
  tileSize = 48,
): PixelEffect[] {
  const worldPixelSize = tileSize / PIXEL_EFFECT_CELLS_PER_TILE;
  const tileX = Math.floor(origin.x / tileSize) * tileSize;
  const tileY = Math.floor(origin.y / tileSize) * tileSize;
  const clipBounds = {
    x: tileX,
    y: tileY,
    width: tileSize,
    height: tileSize,
  };
  const palette = origin.cold ? COLORS.hitCold : COLORS.hitWarm;
  const count = origin.strong ? 26 : 18;
  const effects: PixelEffect[] = Array.from({ length: count }, (_, index) => {
    const angle =
      (index / count) * Math.PI * 2 + (random() - 0.5) * 0.36;
    const speed =
      worldPixelSize *
      ((origin.strong ? 22 : 17) +
        random() * (origin.strong ? 19 : 14));
    return {
      id: `${origin.idPrefix}-hit-${index}`,
      kind: "particle",
      layer: "actor",
      x: origin.x + Math.cos(angle) * 2,
      y: origin.y + Math.sin(angle) * 2,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 10,
      gravity: worldPixelSize * 22,
      drag: 0.14,
      cellSize: index % 4 === 0 ? 2 : 1,
      color:
        origin.color ??
        palette[Math.floor(random() * palette.length)],
      startedAt: origin.startedAt + random() * 18,
      duration: 260 + random() * 180,
      worldPixelSize,
      clipBounds,
    } satisfies PixelParticleEffect;
  });
  effects.push({
    id: `${origin.idPrefix}-impact-ring`,
    kind: "ring",
    layer: "actor",
    x: origin.x,
    y: origin.y,
    startRadius: 2,
    endRadius: tileSize * (origin.strong ? 0.46 : 0.38),
    aspectY: 1,
    pixelSize: origin.strong ? 2 : 1,
    segments: origin.strong ? 28 : 22,
    color: origin.color ?? palette[0],
    startedAt: origin.startedAt,
    duration: origin.strong ? 320 : 260,
    worldPixelSize,
    clipBounds,
  });
  effects.push({
    id: `${origin.idPrefix}-impact-core`,
    kind: "ring",
    layer: "actor",
    x: origin.x,
    y: origin.y,
    startRadius: 1,
    endRadius: tileSize * (origin.strong ? 0.24 : 0.18),
    aspectY: 1,
    pixelSize: origin.strong ? 2 : 1,
    segments: origin.strong ? 12 : 8,
    color: "#ffffff",
    startedAt: origin.startedAt,
    duration: origin.strong ? 170 : 135,
    worldPixelSize,
    clipBounds,
  });
  return effects;
}

export function createEnchantEffects(
  origin: EffectOrigin,
  random: () => number = Math.random,
  tileSize = 48,
): PixelEffect[] {
  const worldPixelSize = tileSize / PIXEL_EFFECT_CELLS_PER_TILE;
  const tileX = Math.floor(origin.x / tileSize) * tileSize;
  const tileY = Math.floor(origin.y / tileSize) * tileSize;
  const clipBounds = { x: tileX, y: tileY, width: tileSize, height: tileSize };
  const effects: PixelEffect[] = Array.from({ length: 24 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2 + (random() - 0.5) * 0.2;
    const speed = worldPixelSize * (8 + random() * 10);
    return {
      id: `${origin.idPrefix}-enchant-${index}`,
      kind: "particle",
      layer: "actor",
      x: origin.x,
      y: origin.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - worldPixelSize * 5,
      gravity: worldPixelSize * 5,
      drag: 0.18,
      cellSize: index % 6 === 0 ? 2 : 1,
      color: COLORS.enchant[index % COLORS.enchant.length],
      startedAt: origin.startedAt + random() * 70,
      duration: 420 + random() * 220,
      worldPixelSize,
      clipBounds,
    } satisfies PixelParticleEffect;
  });
  [0, 80].forEach((delay, index) => {
    effects.push({
      id: `${origin.idPrefix}-enchant-ring-${index}`,
      kind: "ring",
      layer: "actor",
      x: origin.x,
      y: origin.y,
      startRadius: worldPixelSize,
      endRadius: tileSize * (index === 0 ? 0.34 : 0.46),
      aspectY: 0.72,
      pixelSize: 1,
      segments: 20,
      color: index === 0 ? "#fff4a8" : "#d69cff",
      startedAt: origin.startedAt + delay,
      duration: 430,
      worldPixelSize,
      clipBounds,
    });
  });
  return effects;
}

export function createLevelUpEffects(
  origin: EffectOrigin,
  random: () => number = Math.random,
): PixelEffect[] {
  const effects: PixelEffect[] = Array.from(
    { length: 38 },
    (_, index): PixelParticleEffect => {
      const angle = (index / 38) * Math.PI * 2 + random() * 0.2;
      const radius = 4 + random() * 16;
      const outward = 13 + random() * 34;
      return {
        id: `${origin.idPrefix}-level-${index}`,
        kind: "particle",
        layer: index % 3 === 0 ? "overlay" : "actor",
        x: origin.x + Math.cos(angle) * radius,
        y: origin.y + Math.sin(angle) * radius * 0.7,
        velocityX: Math.cos(angle) * outward,
        velocityY: -(42 + random() * 72) + Math.sin(angle) * 12,
        gravity: 12 + random() * 15,
        drag: 0.08,
        cellSize: index % 3 === 0 ? 2 : 1,
        color: COLORS.level[index % COLORS.level.length],
        startedAt: origin.startedAt + random() * 170,
        duration: 720 + random() * 520,
      };
    },
  );
  [0, 110, 230].forEach((delay, index) => {
    effects.push({
      id: `${origin.idPrefix}-level-ring-${index}`,
      kind: "ring",
      layer: "overlay",
      x: origin.x,
      y: origin.y,
      startRadius: 3 + index * 2,
      endRadius: 30 + index * 9,
      aspectY: 0.46,
      pixelSize: 2,
      segments: 28,
      color: COLORS.level[index],
      startedAt: origin.startedAt + delay,
      duration: 720,
    });
  });
  effects.push({
    id: `${origin.idPrefix}-level-flash`,
    kind: "screenFlash",
    layer: "overlay",
    color: "#fff1a5",
    strength: 0.2,
    startedAt: origin.startedAt,
    duration: 420,
  });
  return effects;
}


export const prunePixelEffects = (
  effects: PixelEffect[],
  now: number,
) =>
  retainInPlace(
    effects,
    (effect) => now < effect.startedAt + effect.duration,
  );

export type PixelEffectBuckets = Record<PixelEffectLayer, PixelEffect[]>;

export const createPixelEffectBuckets = (): PixelEffectBuckets => ({
  ground: [],
  actor: [],
  overlay: [],
});

export const syncPixelEffectBuckets = (
  effects: readonly PixelEffect[],
  buckets: PixelEffectBuckets,
) => {
  buckets.ground.length = 0;
  buckets.actor.length = 0;
  buckets.overlay.length = 0;
  for (const effect of effects) buckets[effect.layer].push(effect);
  return buckets;
};

export function drawPixelEffects(
  context: CanvasRenderingContext2D,
  effects: readonly PixelEffect[],
  now: number,
  viewport: PixelEffectViewport,
  layer?: PixelEffectLayer,
) {
  context.save();
  for (const effect of effects) {
    if ((layer && effect.layer !== layer) || now < effect.startedAt) continue;
    const progress = Math.max(
      0,
      Math.min(1, (now - effect.startedAt) / effect.duration),
    );
    const fade = Math.max(0, 1 - progress);
    if (effect.kind === "screenFlash") {
      const alpha = Math.sin(progress * Math.PI) * effect.strength;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = effect.color;
      context.fillRect(0, 0, viewport.width, viewport.height);
      context.globalAlpha = alpha * 0.55;
      const pixel = Math.max(2, Math.round(4 * viewport.zoom));
      for (let y = 0; y < viewport.height; y += pixel * 2) {
        for (let x = (y / pixel) % 4 === 0 ? 0 : pixel; x < viewport.width; x += pixel * 2) {
          context.fillRect(x, y, pixel, pixel);
        }
      }
      context.restore();
      continue;
    }

    if (effect.kind === "waterFrontier") {
      const elapsed = now - effect.startedAt;
      const maximumRadius = effect.rings.length - 1;
      const expansionProgress = Math.min(
        1,
        elapsed / effect.expansionDuration,
      );
      const currentRadius = Math.min(
        maximumRadius,
        Math.floor(expansionProgress * maximumRadius),
      );
      // The wave starts losing brightness as soon as it is created while its
      // total lifetime remains unchanged. This keeps large puddles from
      // appearing fully opaque until a late, abrupt fade.
      const alpha = Math.max(0, 1 - elapsed / effect.duration);
      const pixelSize = Math.max(
        1,
        Math.round(effect.worldPixelSize * viewport.zoom),
      );
      const drawPoints = (
        points: Uint16Array | undefined,
        pointAlpha: number,
      ) => {
        if (!points || points.length === 0 || pointAlpha <= 0) return;
        context.globalAlpha = alpha * pointAlpha;
        for (let pointIndex = 0; pointIndex < points.length; pointIndex += 2) {
          const x = Math.round(
            viewport.screenX(
              points[pointIndex] * effect.worldPixelSize,
            ),
          );
          const y = Math.round(
            viewport.screenY(
              points[pointIndex + 1] * effect.worldPixelSize,
            ),
          );
          if (
            x + pixelSize < 0 ||
            y + pixelSize < 0 ||
            x >= viewport.width ||
            y >= viewport.height
          ) {
            continue;
          }
          context.fillRect(x, y, pixelSize, pixelSize);
        }
      };

      context.save();
      context.fillStyle = effect.color;
      for (let radius = 0; radius <= currentRadius; radius += 1) {
        drawPoints(effect.edgeRings[radius], 0.72);
      }
      drawPoints(effect.rings[currentRadius], 1);
      context.restore();
      continue;
    }

    const worldPixelSize = effect.worldPixelSize ?? 1;
    const snapWorldPixel = (value: number) =>
      effect.worldPixelSize
        ? Math.floor(value / worldPixelSize) * worldPixelSize +
          worldPixelSize / 2
        : value;
    const beginClippedEffect = () => {
      if (!effect.clipBounds) return false;
      context.save();
      context.beginPath();
      context.rect(
        Math.round(viewport.screenX(effect.clipBounds.x)),
        Math.round(viewport.screenY(effect.clipBounds.y)),
        Math.ceil(effect.clipBounds.width * viewport.zoom),
        Math.ceil(effect.clipBounds.height * viewport.zoom),
      );
      context.clip();
      return true;
    };
    if (effect.kind === "ring") {
      const radius =
        effect.startRadius +
        (effect.endRadius - effect.startRadius) * easeOut(progress);
      const pixelSize = Math.max(
        1,
        Math.round(
          effect.pixelSize * worldPixelSize * viewport.zoom,
        ),
      );
      const clipped = beginClippedEffect();
      context.globalAlpha = fade * (0.72 + Math.sin(progress * Math.PI) * 0.28);
      context.fillStyle = effect.color;
      const startAngle = effect.startAngle ?? 0;
      const configuredSweep = effect.sweepAngle ?? Math.PI * 2;
      const sweepAngle = effect.revealProgress
        ? configuredSweep * easeOut(progress)
        : configuredSweep;
      const isFullRing = Math.abs(sweepAngle) >= Math.PI * 2 - 0.0001;
      const denominator = isFullRing
        ? effect.segments
        : Math.max(1, effect.segments - 1);
      for (let segment = 0; segment < effect.segments; segment += 1) {
        const angle = startAngle + (segment / denominator) * sweepAngle;
        const worldX = snapWorldPixel(
          effect.x + Math.cos(angle) * radius,
        );
        const worldY = snapWorldPixel(
          effect.y +
            Math.sin(angle) * radius * effect.aspectY,
        );
        const x = viewport.screenX(worldX);
        const y = viewport.screenY(worldY);
        context.fillRect(
          Math.round(x - pixelSize / 2),
          Math.round(y - pixelSize / 2),
          pixelSize,
          pixelSize,
        );
      }
      if (clipped) context.restore();
      continue;
    }

    const seconds = (now - effect.startedAt) / 1000;
    const damping = Math.max(0.12, 1 - effect.drag * progress);
    const worldX = snapWorldPixel(
      effect.x + effect.velocityX * seconds * damping,
    );
    const worldY = snapWorldPixel(
      effect.y +
        effect.velocityY * seconds +
        0.5 * effect.gravity * seconds * seconds,
    );
    const x = viewport.screenX(worldX);
    const y = viewport.screenY(worldY);
    const pixelSize = Math.max(
      1,
      Math.round(effect.cellSize * worldPixelSize * viewport.zoom),
    );
    const clipped = beginClippedEffect();
    context.globalAlpha = fade;
    context.fillStyle = effect.color;
    context.fillRect(
      Math.round(x - pixelSize / 2),
      Math.round(y - pixelSize / 2),
      pixelSize,
      pixelSize,
    );
    if (effect.cellSize >= 2 && progress < 0.48) {
      const trailWorldX = snapWorldPixel(
        worldX - effect.velocityX * 0.025,
      );
      const trailWorldY = snapWorldPixel(
        worldY - effect.velocityY * 0.025,
      );
      context.globalAlpha = fade * 0.42;
      context.fillRect(
        Math.round(viewport.screenX(trailWorldX) - pixelSize / 2),
        Math.round(viewport.screenY(trailWorldY) - pixelSize / 2),
        pixelSize,
        pixelSize,
      );
    }
    if (clipped) context.restore();
  }
  context.restore();
}

export const pruneCameraShakes = (
  shakes: PixelCameraShake[],
  now: number,
) =>
  retainInPlace(
    shakes,
    (shake) => now < shake.startedAt + shake.duration,
  );

export function cameraShakeOffset(
  shakes: PixelCameraShake[],
  now: number,
) {
  let x = 0;
  let y = 0;
  for (const shake of shakes) {
    if (now < shake.startedAt) continue;
    const progress = Math.max(
      0,
      Math.min(1, (now - shake.startedAt) / shake.duration),
    );
    const strength = shake.amplitude * (1 - progress) ** 2;
    const phase = (now - shake.startedAt) * 0.095 + shake.seed;
    x += Math.sin(phase * 1.7) * strength;
    y += Math.cos(phase * 2.15) * strength * 0.72;
  }
  return { x: Math.round(x), y: Math.round(y) };
}

export type PixelFogSurfaceOptions = {
  now: number;
  zoom: number;
  minCellX: number;
  maxCellX: number;
  minCellY: number;
  maxCellY: number;
  cellWorldSize: number;
  screenX: (worldX: number) => number;
  screenY: (worldY: number) => number;
  isVisible: (cellX: number, cellY: number) => boolean;
  isDiscovered: (cellX: number, cellY: number) => boolean;
};

const fogWave = (cellX: number, cellY: number, now: number) =>
  (Math.sin(now / 470 + cellX * 0.73 + cellY * 0.41) +
    Math.sin(now / 730 - cellX * 0.29 + cellY * 0.67)) *
  0.5;

export function drawPixelFogSurface(
  context: CanvasRenderingContext2D,
  options: PixelFogSurfaceOptions,
) {
  const cellScreenSize = options.cellWorldSize * options.zoom;
  const pixel = Math.max(1, Math.round(2 * options.zoom));
  const textureStep = Math.max(pixel * 2, Math.round(5 * options.zoom));

  for (
    let cellY = options.minCellY;
    cellY <= options.maxCellY;
    cellY += 1
  ) {
    for (
      let cellX = options.minCellX;
      cellX <= options.maxCellX;
      cellX += 1
    ) {
      const visible = options.isVisible(cellX, cellY);
      const discovered = options.isDiscovered(cellX, cellY);
      const left = options.screenX(cellX * options.cellWorldSize);
      const top = options.screenY(cellY * options.cellWorldSize);
      const wave = fogWave(cellX, cellY, options.now);

      if (discovered && !visible) {
        context.save();
        context.fillStyle = `rgba(1, 8, 11, ${0.05 + (wave + 1) * 0.035})`;
        const phase =
          Math.floor(options.now / 115 + cellX * 3 + cellY * 5) % 3;
        for (
          let localY = -phase * pixel;
          localY < cellScreenSize;
          localY += textureStep
        ) {
          for (
            let localX = ((cellX + cellY + phase) % 2) * textureStep;
            localX < cellScreenSize;
            localX += textureStep * 2
          ) {
            context.fillRect(
              Math.round(left + localX),
              Math.round(top + localY),
              pixel,
              pixel,
            );
          }
        }
        context.restore();
      }

      if (!visible) continue;
      const neighbors = [
        { dx: -1, dy: 0, side: "left" },
        { dx: 1, dy: 0, side: "right" },
        { dx: 0, dy: -1, side: "top" },
        { dx: 0, dy: 1, side: "bottom" },
      ] as const;
      for (const neighbor of neighbors) {
        if (options.isVisible(cellX + neighbor.dx, cellY + neighbor.dy)) {
          continue;
        }
        const depth =
          Math.max(pixel, Math.round((3.2 + wave * 1.2) * options.zoom));
        context.save();
        context.fillStyle = `rgba(1, 5, 7, ${0.18 + (wave + 1) * 0.055})`;
        for (
          let along = (Math.abs(cellX * 7 + cellY * 11) % 3) * pixel;
          along < cellScreenSize;
          along += pixel * 3
        ) {
          const flutter =
            Math.round(
              (Math.sin(
                options.now / 150 +
                  cellX * 1.3 +
                  cellY * 0.9 +
                  along,
              ) +
                1) *
                0.5,
            ) * pixel;
          if (neighbor.side === "left" || neighbor.side === "right") {
            context.fillRect(
              Math.round(
                neighbor.side === "left"
                  ? left
                  : left + cellScreenSize - depth - flutter,
              ),
              Math.round(top + along),
              depth + flutter,
              pixel,
            );
          } else {
            context.fillRect(
              Math.round(left + along),
              Math.round(
                neighbor.side === "top"
                  ? top
                  : top + cellScreenSize - depth - flutter,
              ),
              pixel,
              depth + flutter,
            );
          }
        }
        context.restore();
      }
    }
  }
}
