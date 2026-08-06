import type { Point } from "../game/types";
import type {
  PixelClipBounds,
  PixelEffect,
  PixelEffectLayer,
  PixelParticleEffect,
  PixelRingEffect,
} from "./pixel-effect-types";
import { PIXEL_EFFECT_CELLS_PER_TILE } from "./pixel-effect-types";

export type ParticleVector = Readonly<{ x: number; y: number }>;

export type ParticleEmitterContext = {
  idPrefix: string;
  point: Point;
  startedAt: number;
  palette: readonly string[];
  tileSize?: number;
  layer?: PixelEffectLayer;
  random?: () => number;
  clip?: "tile" | "none" | PixelClipBounds;
};

export type DirectionalEmission = {
  direction?: ParticleVector;
  spreadRadians?: number;
};

const TAU = Math.PI * 2;
export const MAX_FOOTPRINT_PARTICLES = 256;

export const normalizeParticleDirection = (
  direction: ParticleVector | undefined,
  fallback: ParticleVector = { x: 1, y: 0 },
): ParticleVector => {
  const candidate = direction ?? fallback;
  const length = Math.hypot(candidate.x, candidate.y);
  if (length <= 0.0001) return normalizeParticleDirection(fallback, { x: 1, y: 0 });
  return { x: candidate.x / length, y: candidate.y / length };
};

export const particleDirectionBetween = (
  from: Point,
  to: Point,
): ParticleVector => normalizeParticleDirection({
  x: to.x - from.x,
  y: to.y - from.y,
});

const effectGeometry = (context: ParticleEmitterContext) => {
  const tileSize = context.tileSize ?? 48;
  const worldPixelSize = tileSize / PIXEL_EFFECT_CELLS_PER_TILE;
  const clipBounds =
    context.clip === "none"
      ? undefined
      : typeof context.clip === "object"
        ? context.clip
        : {
            x: context.point.x * tileSize,
            y: context.point.y * tileSize,
            width: tileSize,
            height: tileSize,
          };
  return {
    tileSize,
    worldPixelSize,
    clipBounds,
    center: {
      x: (context.point.x + 0.5) * tileSize,
      y: (context.point.y + 0.5) * tileSize,
    },
  };
};

const angleForEmission = (
  random: () => number,
  direction: ParticleVector | undefined,
  spreadRadians: number,
) => {
  if (!direction) return random() * TAU;
  const normalized = normalizeParticleDirection(direction);
  return (
    Math.atan2(normalized.y, normalized.x) +
    (random() - 0.5) * spreadRadians
  );
};

export type FragmentEmitterOptions = DirectionalEmission & {
  count?: number;
  speedPixels?: readonly [number, number];
  gravityPixels?: number;
  drag?: number;
  durationMs?: readonly [number, number];
  delayMs?: number;
  spawnRadiusPixels?: number;
  upwardBiasPixels?: number;
};

/**
 * Emits sprite-free one- or two-cell fragments. All *Pixels options are
 * logical grid cells; the fixed per-tile resolution is declared separately by
 * PIXEL_EFFECT_CELLS_PER_TILE and never limits the effect to one tile.
 */
export function createFragmentParticles(
  context: ParticleEmitterContext,
  options: FragmentEmitterOptions = {},
): PixelParticleEffect[] {
  const random = context.random ?? Math.random;
  const {
    worldPixelSize,
    clipBounds,
    center,
  } = effectGeometry(context);
  const count = Math.max(1, Math.floor(options.count ?? 18));
  const speedPixels = options.speedPixels ?? [8, 20];
  const durationMs = options.durationMs ?? [260, 520];
  const spread = options.direction
    ? options.spreadRadians ?? Math.PI * 0.7
    : TAU;
  return Array.from({ length: count }, (_, index) => {
    const angle = angleForEmission(
      random,
      options.direction,
      spread,
    );
    const speed =
      worldPixelSize *
      (speedPixels[0] + random() * (speedPixels[1] - speedPixels[0]));
    const spawnRadius =
      worldPixelSize * (options.spawnRadiusPixels ?? 1) * random();
    return {
      id: `${context.idPrefix}-fragment-${index}`,
      kind: "particle",
      layer: context.layer ?? "actor",
      x: center.x + Math.cos(angle) * spawnRadius,
      y: center.y + Math.sin(angle) * spawnRadius,
      velocityX: Math.cos(angle) * speed,
      velocityY:
        Math.sin(angle) * speed -
        worldPixelSize * (options.upwardBiasPixels ?? 2),
      gravity: worldPixelSize * (options.gravityPixels ?? 9),
      drag: options.drag ?? 0.16,
      cellSize: index % 6 === 0 ? 2 : 1,
      color: context.palette[index % context.palette.length] ?? "#ffffff",
      startedAt: context.startedAt + (options.delayMs ?? 0) + random() * 34,
      duration:
        durationMs[0] + random() * (durationMs[1] - durationMs[0]),
      worldPixelSize,
      clipBounds,
    } satisfies PixelParticleEffect;
  });
}

export type ParticleTileFootprintOptions = {
  radiusTiles: number;
  includeCenter?: boolean;
  direction?: ParticleVector;
  sweepRadians?: number;
};

/**
 * Produces the exact Chebyshev tile footprint used by area-skill rules. A
 * direction and sweep can restrict that same footprint to a one-sided sector.
 */
export function particleFootprintTiles(
  center: Point,
  options: ParticleTileFootprintOptions,
): Point[] {
  const radius = Math.max(0, Math.floor(options.radiusTiles));
  const includeCenter = options.includeCenter ?? true;
  const direction = options.direction
    ? normalizeParticleDirection(options.direction)
    : null;
  const sweep = Math.max(
    0,
    Math.min(TAU, Math.abs(options.sweepRadians ?? TAU)),
  );
  const directionAngle = direction
    ? Math.atan2(direction.y, direction.x)
    : 0;
  const points: Point[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
      if (dx === 0 && dy === 0) {
        if (includeCenter) points.push({ x, y });
        continue;
      }
      if (direction && sweep < TAU - 0.0001) {
        const pointAngle = Math.atan2(dy, dx);
        const delta = Math.atan2(
          Math.sin(pointAngle - directionAngle),
          Math.cos(pointAngle - directionAngle),
        );
        if (Math.abs(delta) > sweep / 2 + 0.0001) continue;
      }
      points.push({ x, y });
    }
  }
  return points.sort((left, right) => {
    const leftDistance = Math.max(
      Math.abs(left.x - center.x),
      Math.abs(left.y - center.y),
    );
    const rightDistance = Math.max(
      Math.abs(right.x - center.x),
      Math.abs(right.y - center.y),
    );
    return leftDistance - rightDistance || left.y - right.y || left.x - right.x;
  });
}

export type FootprintFragmentEmitterOptions = Omit<
  FragmentEmitterOptions,
  "count" | "delayMs"
> & {
  tiles?: readonly Point[];
  radiusTiles?: number;
  includeCenter?: boolean;
  footprintDirection?: ParticleVector;
  footprintSweepRadians?: number;
  countPerTile?: number;
  delayPerTileMs?: number;
  maxParticles?: number;
};

/**
 * Scatters marks over a multi-tile footprint. The budget is distributed before
 * generation, guaranteeing at least one mark in every affected tile instead of
 * truncating the outer edge after creation.
 */
export function createFootprintFragmentParticles(
  context: ParticleEmitterContext,
  options: FootprintFragmentEmitterOptions,
): PixelParticleEffect[] {
  const sourceTiles = options.tiles ?? particleFootprintTiles(context.point, {
    radiusTiles: options.radiusTiles ?? 0,
    includeCenter: options.includeCenter,
    direction: options.footprintDirection,
    sweepRadians: options.footprintSweepRadians,
  });
  const seen = new Set<string>();
  const orderedTiles = sourceTiles
    .filter((point) => {
      if (
        options.includeCenter === false &&
        point.x === context.point.x &&
        point.y === context.point.y
      ) return false;
      const key = `${point.x},${point.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => {
      const leftDistance = Math.max(
        Math.abs(left.x - context.point.x),
        Math.abs(left.y - context.point.y),
      );
      const rightDistance = Math.max(
        Math.abs(right.x - context.point.x),
        Math.abs(right.y - context.point.y),
      );
      return leftDistance - rightDistance || left.y - right.y || left.x - right.x;
    });
  const tiles = orderedTiles.slice(0, MAX_FOOTPRINT_PARTICLES);
  if (!tiles.length) return [];

  const requestedPerTile = Math.max(1, Math.floor(options.countPerTile ?? 4));
  const maximum = Math.min(
    MAX_FOOTPRINT_PARTICLES,
    Math.max(tiles.length, Math.floor(options.maxParticles ?? 144)),
  );
  const total = Math.min(maximum, tiles.length * requestedPerTile);
  const baseCount = Math.floor(total / tiles.length);
  const remainder = total % tiles.length;
  return tiles.flatMap((point, index) => {
    const distanceFromCenter = Math.max(
      Math.abs(point.x - context.point.x),
      Math.abs(point.y - context.point.y),
    );
    return createFragmentParticles(
      {
        ...context,
        idPrefix: `${context.idPrefix}-footprint-${index}`,
        point,
        startedAt:
          context.startedAt +
          distanceFromCenter * (options.delayPerTileMs ?? 42),
        clip: context.clip === undefined ? "none" : context.clip,
      },
      {
        direction: options.direction,
        spreadRadians: options.spreadRadians,
        count: baseCount + (index < remainder ? 1 : 0),
        speedPixels: options.speedPixels,
        gravityPixels: options.gravityPixels,
        drag: options.drag,
        durationMs: options.durationMs,
        spawnRadiusPixels: options.spawnRadiusPixels,
        upwardBiasPixels: options.upwardBiasPixels,
      },
    );
  });
}

export type ShockwaveEmitterOptions = DirectionalEmission & {
  sweepRadians?: number;
  fronts?: number;
  startRadiusPixels?: number;
  endRadiusPixels?: number;
  startRadiusTiles?: number;
  endRadiusTiles?: number;
  aspectY?: number;
  durationMs?: number;
  delayMs?: number;
  segments?: number;
  revealProgress?: boolean;
};

/**
 * Creates a full radial wave when direction is omitted, or a one-sided wave
 * when a direction and sweep are provided.
 */
export function createShockwaveParticles(
  context: ParticleEmitterContext,
  options: ShockwaveEmitterOptions = {},
): PixelRingEffect[] {
  const { tileSize, worldPixelSize, clipBounds, center } = effectGeometry(context);
  const fronts = Math.max(1, Math.floor(options.fronts ?? 2));
  const sweep = options.direction
    ? options.sweepRadians ?? Math.PI * 0.8
    : TAU;
  const centerAngle = options.direction
    ? Math.atan2(
        normalizeParticleDirection(options.direction).y,
        normalizeParticleDirection(options.direction).x,
      )
    : 0;
  const startRadiusCells = options.startRadiusTiles === undefined
    ? options.startRadiusPixels ?? 1
    : options.startRadiusTiles * PIXEL_EFFECT_CELLS_PER_TILE;
  const endRadiusCells = options.endRadiusTiles === undefined
    ? options.endRadiusPixels ?? 7.25
    : options.endRadiusTiles * PIXEL_EFFECT_CELLS_PER_TILE;
  return Array.from({ length: fronts }, (_, index) => ({
    id: `${context.idPrefix}-shockwave-${index}`,
    kind: "ring",
    layer: context.layer ?? "actor",
    x: center.x,
    y: center.y,
    startRadius:
      worldPixelSize * (startRadiusCells + index),
    endRadius:
      worldPixelSize * endRadiusCells *
      (1 - index * 0.08),
    aspectY: options.aspectY ?? 0.76,
    pixelSize: index === 0 ? 2 : 1,
    segments: Math.max(6, Math.floor(options.segments ?? (sweep >= TAU ? 26 : 14))),
    startAngle: centerAngle - sweep / 2,
    sweepAngle: sweep,
    revealProgress: options.revealProgress,
    color: context.palette[index % context.palette.length] ?? "#ffffff",
    startedAt: context.startedAt + (options.delayMs ?? 0) + index * 55,
    duration: (options.durationMs ?? 360) + index * 70,
    worldPixelSize,
    clipBounds:
      context.clip === "none"
        ? undefined
        : clipBounds ?? {
            x: center.x - tileSize / 2,
            y: center.y - tileSize / 2,
            width: tileSize,
            height: tileSize,
          },
  } satisfies PixelRingEffect));
}

const lineTiles = (from: Point, to: Point) => {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  if (steps === 0) return [{ ...from }];
  const points: Point[] = [];
  const seen = new Set<string>();
  for (let index = 0; index <= steps; index += 1) {
    const point = {
      x: Math.round(from.x + ((to.x - from.x) * index) / steps),
      y: Math.round(from.y + ((to.y - from.y) * index) / steps),
    };
    const key = `${point.x},${point.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      points.push(point);
    }
  }
  return points;
};

export type ThrustEmitterOptions = {
  densityPerTile?: number;
  widthPixels?: number;
  delayPerTileMs?: number;
  durationMs?: number;
};

/** Creates a narrow pixel thrust along each crossed tile. */
export function createThrustParticles(
  context: Omit<ParticleEmitterContext, "point"> & {
    from: Point;
    to: Point;
  },
  options: ThrustEmitterOptions = {},
): PixelEffect[] {
  const tileSize = context.tileSize ?? 48;
  const worldPixelSize = tileSize / PIXEL_EFFECT_CELLS_PER_TILE;
  const direction = particleDirectionBetween(context.from, context.to);
  const perpendicular = { x: -direction.y, y: direction.x };
  const random = context.random ?? Math.random;
  const density = Math.max(1, Math.floor(options.densityPerTile ?? 5));
  const points = lineTiles(context.from, context.to);
  const effects: PixelEffect[] = [];
  points.forEach((point, pathIndex) => {
    const center = {
      x: (point.x + 0.5) * tileSize,
      y: (point.y + 0.5) * tileSize,
    };
    const clipBounds = context.clip === "none"
      ? undefined
      : typeof context.clip === "object"
        ? context.clip
        : {
            x: point.x * tileSize,
            y: point.y * tileSize,
            width: tileSize,
            height: tileSize,
          };
    for (let index = 0; index < density; index += 1) {
      const side =
        (random() - 0.5) * worldPixelSize * (options.widthPixels ?? 3);
      effects.push({
        id: `${context.idPrefix}-thrust-${pathIndex}-${index}`,
        kind: "particle",
        layer: context.layer ?? "actor",
        x: center.x + perpendicular.x * side,
        y: center.y + perpendicular.y * side,
        velocityX: direction.x * worldPixelSize * (12 + random() * 8),
        velocityY: direction.y * worldPixelSize * (12 + random() * 8),
        gravity: 0,
        drag: 0.24,
        cellSize: index === 0 ? 2 : 1,
        color:
          context.palette[(pathIndex + index) % context.palette.length] ??
          "#ffffff",
        startedAt:
          context.startedAt +
          pathIndex * (options.delayPerTileMs ?? 24) +
          index * 7,
        duration: options.durationMs ?? 220,
        worldPixelSize,
        clipBounds,
      });
    }
  });
  return effects;
}

export type SlashEmitterOptions = {
  direction?: ParticleVector;
  sweepRadians?: number;
  clockwise?: boolean;
  repetitions?: number;
  delayBetweenMs?: number;
  radiusPixels?: number;
  radiusTiles?: number;
};

/** Creates one or more crisp curved slash fronts plus tangential fragments. */
export function createSlashParticles(
  context: ParticleEmitterContext,
  options: SlashEmitterOptions = {},
): PixelEffect[] {
  const direction = normalizeParticleDirection(options.direction);
  const sweepMagnitude = Math.abs(options.sweepRadians ?? Math.PI * 0.9);
  const sweep = (options.clockwise === false ? -1 : 1) * sweepMagnitude;
  const repetitions = Math.max(1, Math.floor(options.repetitions ?? 1));
  const radiusCells = options.radiusTiles === undefined
    ? options.radiusPixels ?? 6
    : options.radiusTiles * PIXEL_EFFECT_CELLS_PER_TILE;
  const effects: PixelEffect[] = [];
  for (let index = 0; index < repetitions; index += 1) {
    const startedAt =
      context.startedAt + index * (options.delayBetweenMs ?? 90);
    effects.push(
      ...createShockwaveParticles(
        {
          ...context,
          idPrefix: `${context.idPrefix}-slash-${index}`,
          startedAt,
        },
        {
          direction,
          sweepRadians: sweep,
          fronts: 1,
          startRadiusPixels: Math.max(1, radiusCells * 0.35),
          endRadiusPixels: radiusCells,
          aspectY: 1,
          durationMs: 190,
          segments: 15,
          revealProgress: true,
        },
      ),
      ...createFragmentParticles(
        {
          ...context,
          idPrefix: `${context.idPrefix}-slash-sparks-${index}`,
          startedAt,
        },
        {
          direction,
          spreadRadians: Math.PI * 0.45,
          count: 8,
          speedPixels: [9, 17],
          gravityPixels: 4,
          durationMs: [180, 310],
        },
      ),
    );
  }
  return effects;
}

export type TeleportEmitterOptions = {
  arrivalDelayMs?: number;
  includeArrivalBurst?: boolean;
};

export function createTeleportParticles(
  context: Omit<ParticleEmitterContext, "point"> & {
    from: Point;
    to: Point;
  },
  options: TeleportEmitterOptions = {},
): PixelEffect[] {
  const tileSize = context.tileSize ?? 48;
  const sourceContext: ParticleEmitterContext = {
    ...context,
    point: context.from,
    idPrefix: `${context.idPrefix}-depart`,
  };
  const destinationContext: ParticleEmitterContext = {
    ...context,
    point: context.to,
    idPrefix: `${context.idPrefix}-arrive`,
    startedAt: context.startedAt + (options.arrivalDelayMs ?? 135),
  };
  const sourceGeometry = effectGeometry(sourceContext);
  const inward = createFragmentParticles(sourceContext, {
    count: 20,
    speedPixels: [-16, -7],
    gravityPixels: 0,
    upwardBiasPixels: 0,
    spawnRadiusPixels: 6,
    durationMs: [180, 300],
  });
  const collapse: PixelRingEffect = {
    id: `${context.idPrefix}-collapse`,
    kind: "ring",
    layer: context.layer ?? "actor",
    x: sourceGeometry.center.x,
    y: sourceGeometry.center.y,
    startRadius: tileSize * 0.46,
    endRadius: sourceGeometry.worldPixelSize,
    aspectY: 0.82,
    pixelSize: 1,
    segments: 24,
    color: context.palette[1] ?? context.palette[0] ?? "#ffffff",
    startedAt: context.startedAt,
    duration: 190,
    worldPixelSize: sourceGeometry.worldPixelSize,
    clipBounds: sourceGeometry.clipBounds,
  };
  const arrival = options.includeArrivalBurst === false
    ? []
    : [
        ...createShockwaveParticles(destinationContext, {
          fronts: 2,
          endRadiusPixels: 7,
          durationMs: 300,
        }),
        ...createFragmentParticles(destinationContext, {
          count: 24,
          speedPixels: [8, 22],
          gravityPixels: -2,
          upwardBiasPixels: 1,
          durationMs: [280, 480],
        }),
      ];
  return [
    ...inward,
    collapse,
    ...arrival,
  ];
}

export type LeapEmitterOptions = {
  directionalImpact?: boolean;
  impactDelayMs?: number;
  includeLandingImpact?: boolean;
  impactRadiusTiles?: number;
};

export function createLeapParticles(
  context: Omit<ParticleEmitterContext, "point"> & {
    from: Point;
    to: Point;
  },
  options: LeapEmitterOptions = {},
): PixelEffect[] {
  const direction = particleDirectionBetween(context.from, context.to);
  const impactDelayMs = options.impactDelayMs ?? 250;
  const landing = options.includeLandingImpact === false
    ? []
    : [
        ...createShockwaveParticles(
          {
            ...context,
            point: context.to,
            idPrefix: `${context.idPrefix}-landing`,
            startedAt: context.startedAt + impactDelayMs,
          },
          options.directionalImpact
            ? {
                direction,
                sweepRadians: Math.PI * 0.9,
                fronts: 2,
                endRadiusTiles: options.impactRadiusTiles,
              }
            : {
                fronts: 2,
                endRadiusTiles: options.impactRadiusTiles,
              },
        ),
        ...createFragmentParticles(
          {
            ...context,
            point: context.to,
            idPrefix: `${context.idPrefix}-landing-debris`,
            startedAt: context.startedAt + impactDelayMs,
          },
          {
            direction: options.directionalImpact ? direction : undefined,
            spreadRadians: options.directionalImpact ? Math.PI * 0.8 : TAU,
            count: 20,
            speedPixels: [8, 21],
            gravityPixels: 13,
            durationMs: [260, 470],
          },
        ),
      ];
  return [
    ...createFragmentParticles(
      {
        ...context,
        point: context.from,
        idPrefix: `${context.idPrefix}-takeoff`,
      },
      {
        direction: { x: -direction.x, y: -direction.y },
        spreadRadians: Math.PI * 0.75,
        count: 14,
        speedPixels: [7, 16],
        gravityPixels: 12,
        durationMs: [250, 420],
      },
    ),
    ...landing,
  ];
}
