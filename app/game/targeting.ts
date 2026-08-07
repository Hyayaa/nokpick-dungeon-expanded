import type { DungeonObject, GameState, Point, Terrain } from "./types";

type TargetingState = Pick<
  GameState,
  "width" | "height" | "tiles" | "objects"
>;

const PROJECTILE_BLOCKING_TERRAIN = new Set<Terrain>([
  "wall",
  "door",
  "lockedDoor",
  "crystalDoor",
]);

const pointKey = (point: Point) => `${point.x},${point.y}`;

const inBounds = (state: Pick<GameState, "width" | "height">, point: Point) =>
  point.x >= 0 &&
  point.x < state.width &&
  point.y >= 0 &&
  point.y < state.height;

/**
 * Skill cast ranges use tile-center Euclidean distance. This keeps a range of
 * eight circular instead of turning it into a 17-by-17 Chebyshev square.
 */
export const isWithinCircularSkillRange = (
  origin: Point,
  target: Point,
  range: number,
) => {
  const radius = Math.max(0, range);
  const deltaX = target.x - origin.x;
  const deltaY = target.y - origin.y;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
};

/**
 * Dense grass blocks vision, but it is not a physical projectile obstacle.
 * Only solid terrain and unopened dungeon objects stop a skill projectile.
 */
export const blocksSkillProjectileTerrain = (terrain: Terrain) =>
  PROJECTILE_BLOCKING_TERRAIN.has(terrain);

const activeObjectKeys = (objects: readonly DungeonObject[]) =>
  new Set(
    objects
      .filter((object) => !object.looted)
      .map(pointKey),
  );

const linePoints = (from: Point, to: Point) => {
  const points: Point[] = [];
  let x = from.x;
  let y = from.y;
  const deltaX = Math.abs(to.x - from.x);
  const deltaY = Math.abs(to.y - from.y);
  const stepX = from.x < to.x ? 1 : -1;
  const stepY = from.y < to.y ? 1 : -1;
  let error = deltaX - deltaY;

  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) break;
    const doubled = error * 2;
    if (doubled > -deltaY) {
      error -= deltaY;
      x += stepX;
    }
    if (doubled < deltaX) {
      error += deltaX;
      y += stepY;
    }
  }
  return points;
};

const isProjectileBlockedAt = (
  state: TargetingState,
  point: Point,
  objectKeys: ReadonlySet<string>,
) =>
  !inBounds(state, point) ||
  blocksSkillProjectileTerrain(state.tiles[point.y][point.x].terrain) ||
  objectKeys.has(pointKey(point));

const hasProjectileLineOfFireWithObjects = (
  state: TargetingState,
  origin: Point,
  target: Point,
  objectKeys: ReadonlySet<string>,
) => {
  if (!inBounds(state, origin) || !inBounds(state, target)) return false;
  return linePoints(origin, target)
    .slice(1)
    .every((point) => !isProjectileBlockedAt(state, point, objectKeys));
};

export const hasProjectileLineOfFire = (
  state: TargetingState,
  origin: Point,
  target: Point,
) =>
  hasProjectileLineOfFireWithObjects(
    state,
    origin,
    target,
    activeObjectKeys(state.objects),
  );

const isSkillTargetableTileWithObjects = (
  state: TargetingState,
  origin: Point,
  target: Point,
  range: number,
  requiresLineOfFire: boolean,
  objectKeys: ReadonlySet<string>,
) => {
  if (
    !inBounds(state, target) ||
    !isWithinCircularSkillRange(origin, target, range) ||
    isProjectileBlockedAt(state, target, objectKeys)
  ) {
    return false;
  }
  return !requiresLineOfFire ||
    hasProjectileLineOfFireWithObjects(state, origin, target, objectKeys);
};

export const isSkillTargetableTile = (
  state: TargetingState,
  origin: Point,
  target: Point,
  range: number,
  requiresLineOfFire: boolean,
) =>
  isSkillTargetableTileWithObjects(
    state,
    origin,
    target,
    range,
    requiresLineOfFire,
    activeObjectKeys(state.objects),
  );

/**
 * Returns the exact gameplay-valid geographic footprint for the targeting UI.
 * Entity requirements (enemy/ally/empty landing tile) remain cast-time rules;
 * this collection only describes range and physical line of fire.
 */
export const skillTargetableTiles = (
  state: TargetingState,
  origin: Point,
  range: number,
  requiresLineOfFire: boolean,
) => {
  const radius = Math.max(0, Math.ceil(range));
  const objectKeys = activeObjectKeys(state.objects);
  const tiles: Point[] = [];
  for (
    let y = Math.max(0, origin.y - radius);
    y <= Math.min(state.height - 1, origin.y + radius);
    y += 1
  ) {
    for (
      let x = Math.max(0, origin.x - radius);
      x <= Math.min(state.width - 1, origin.x + radius);
      x += 1
    ) {
      const target = { x, y };
      if (
        isSkillTargetableTileWithObjects(
          state,
          origin,
          target,
          range,
          requiresLineOfFire,
          objectKeys,
        )
      ) {
        tiles.push(target);
      }
    }
  }
  return tiles;
};
