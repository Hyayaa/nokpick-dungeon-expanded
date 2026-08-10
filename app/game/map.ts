import { Point, Terrain, Tile } from "./types";
import {
  isP0RoomPreset,
  paintP0Room,
  type P0RoomPreset,
} from "./room-presets";
import {
  isSpecialRoomPreset,
  paintSpecialRoom,
  specialRoomMetadata,
  type SpecialRewardSlot,
  type SpecialRoomPreset,
} from "./special-rooms";
import type {
  BossRoom,
  DungeonSpecialRoom,
  DungeonTrap,
  GuaranteedFloorSpawn,
} from "./types";
import type { BossArenaSettings } from "./boss-definitions";
import { paintBossArena } from "./boss-arena";

const CARDINALS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const EIGHT_WAY: Point[] = [
  ...CARDINALS,
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

export type RoomPreset =
  | "entrance"
  | "exit"
  | "empty"
  | "striped"
  | "pillars"
  | "ring"
  | "sewerPipe"
  | "waterBridge"
  | "circleBasin"
  | "plants"
  | "platform"
  | "chasmBridge"
  | "chasmRoom"
  | "circlePit"
  | "cavesFissure"
  | "segmented"
  | "patch"
  | "cross"
  | "ruins"
  | "splitPools"
  | "alcoves"
  | "storage"
  | "magicalFire"
  | "toxicGas"
  | "traps"
  | "crystalChoice"
  | "crystalPath";

type Room = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: Point;
  preset: RoomPreset;
  roomValue: 1 | 2 | 3;
  purpose?: "alchemy";
};

type RoomEdge = {
  from: string;
  to: string;
};

export type GeneratedFloor = {
  width: number;
  height: number;
  tiles: Tile[][];
  start: Point;
  exit: Point;
  keyPoint: Point;
  alchemyPoint: Point;
  corridorWidths: Array<1 | 3>;
  corridorLengths: number[];
  corridorKinds: Array<"normal" | "chasm">;
  roomCount: number;
  ordinaryRoomCount: number;
  ordinaryRoomBudget: number;
  roomPresets: RoomPreset[];
  roomRegions: Array<{
    preset: RoomPreset;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }>;
  specialRooms: DungeonSpecialRoom[];
  requiredFloorSpawns: GuaranteedFloorSpawn[];
  traps: DungeonTrap[];
  specialRewards: SpecialRewardSlot[];
  toxicGasTiles: Point[];
  magicalFireTiles: Point[];
  bossRoom?: BossRoom;
  rng: number;
};

const pointKey = (point: Point) => `${point.x},${point.y}`;

const makeRandom = (seed: number) => {
  let value = seed >>> 0;
  return {
    next() {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    },
    int(min: number, max: number) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    value() {
      return value;
    },
  };
};

const inside = (tiles: Tile[][], x: number, y: number) =>
  y >= 0 && y < tiles.length && x >= 0 && x < tiles[0].length;

export const isDoor = (terrain: Terrain) =>
  terrain === "door" ||
  terrain === "openDoor" ||
  terrain === "lockedDoor" ||
  terrain === "crystalDoor" ||
  terrain === "barricade";

export const blocksSight = (terrain: Terrain) =>
  terrain === "wall" ||
  terrain === "door" ||
  terrain === "lockedDoor" ||
  terrain === "crystalDoor" ||
  terrain === "barricade" ||
  terrain === "highGrass";

export const isWalkable = (terrain: Terrain, canUnlock = false) =>
  terrain !== "wall" &&
  terrain !== "chasm" &&
  terrain !== "crystalDoor" &&
  terrain !== "barricade" &&
  (terrain !== "lockedDoor" || canUnlock);

const roomInterior = (room: Room) => {
  const points: Point[] = [];
  for (let y = room.top + 1; y < room.bottom; y += 1) {
    for (let x = room.left + 1; x < room.right; x += 1) {
      points.push({ x, y });
    }
  }
  return points;
};

const floodDistances = (
  tiles: Tile[][],
  start: Point,
  blockedPoint?: Point,
  allowLocked = true,
) => {
  const distances = new Map<string, number>();
  const queue: Point[] = [start];
  distances.set(pointKey(start), 0);
  const blockedKey = blockedPoint ? pointKey(blockedPoint) : "";

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    const distance = distances.get(pointKey(point)) ?? 0;
    for (const direction of CARDINALS) {
      const next = { x: point.x + direction.x, y: point.y + direction.y };
      const key = pointKey(next);
      if (
        !inside(tiles, next.x, next.y) ||
        key === blockedKey ||
        distances.has(key) ||
        !isWalkable(tiles[next.y][next.x].terrain, allowLocked)
      ) {
        continue;
      }
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }
  return distances;
};

const edgeKey = (from: string, to: string) =>
  from < to ? `${from}|${to}` : `${to}|${from}`;

const paintRoom = (
  tiles: Tile[][],
  room: Room,
  random: ReturnType<typeof makeRandom>,
) => {
  for (let y = room.top; y <= room.bottom; y += 1) {
    for (let x = room.left; x <= room.right; x += 1) {
      const boundary =
        x === room.left ||
        x === room.right ||
        y === room.top ||
        y === room.bottom;
      tiles[y][x].terrain = boundary ? "wall" : "floor";
    }
  }

  const interior = roomInterior(room);
  if (isP0RoomPreset(room.preset) || isSpecialRoomPreset(room.preset)) return;
  if (
    room.preset === "entrance" ||
    room.preset === "exit" ||
    room.preset === "empty"
  ) {
    return;
  }

  if (room.preset === "striped") {
    const vertical = room.right - room.left >= room.bottom - room.top;
    interior.forEach((point) => {
      const striped = vertical
        ? (point.x - room.left) % 2 === 0
        : (point.y - room.top) % 2 === 0;
      if (striped) tiles[point.y][point.x].terrain = "highGrass";
    });
    return;
  }

  if (room.preset === "pillars") {
    const pillarXs = [room.left + 2, room.right - 2];
    const pillarYs = [room.top + 2, room.bottom - 2];
    pillarXs.forEach((x) =>
      pillarYs.forEach((y) => {
        if (x !== room.center.x || y !== room.center.y) {
          tiles[y][x].terrain = "wall";
        }
      }),
    );
    return;
  }

  if (room.preset === "ring") {
    interior.forEach((point) => {
      const distance = Math.max(
        Math.abs(point.x - room.center.x),
        Math.abs(point.y - room.center.y),
      );
      if (distance === 1) tiles[point.y][point.x].terrain = "wall";
    });
    tiles[room.center.y][room.center.x + 1].terrain = "floor";
    return;
  }

  if (room.preset === "sewerPipe") {
    const vertical = random.next() < 0.5;
    interior.forEach((point) => {
      if (
        (vertical && point.x === room.center.x) ||
        (!vertical && point.y === room.center.y)
      ) {
        tiles[point.y][point.x].terrain = "water";
      }
    });
    return;
  }

  if (room.preset === "waterBridge") {
    interior.forEach((point) => {
      tiles[point.y][point.x].terrain = "water";
    });
    for (let x = room.left + 1; x < room.right; x += 1) {
      tiles[room.center.y][x].terrain = "floor";
    }
    for (let y = room.top + 1; y < room.bottom; y += 1) {
      tiles[y][room.center.x].terrain = "floor";
    }
    return;
  }

  if (room.preset === "circleBasin") {
    interior.forEach((point) => {
      const dx = (point.x - room.center.x) / Math.max(2, (room.right - room.left) / 2);
      const dy = (point.y - room.center.y) / Math.max(2, (room.bottom - room.top) / 2);
      if (dx * dx + dy * dy < 0.55) {
        tiles[point.y][point.x].terrain = "water";
      }
    });
    tiles[room.center.y][room.center.x].terrain = "floor";
    return;
  }

  if (room.preset === "plants") {
    interior.forEach((point) => {
      tiles[point.y][point.x].terrain =
        point.x === room.center.x || point.y === room.center.y
          ? "grass"
          : "highGrass";
    });
    return;
  }

  if (room.preset === "segmented") {
    const vertical = room.right - room.left >= room.bottom - room.top;
    if (vertical) {
      for (let y = room.top + 1; y < room.bottom; y += 1) {
        tiles[y][room.center.x].terrain = "wall";
      }
      tiles[room.center.y][room.center.x].terrain = "floor";
      tiles[Math.min(room.bottom - 1, room.center.y + 1)][room.center.x].terrain = "floor";
    } else {
      for (let x = room.left + 1; x < room.right; x += 1) {
        tiles[room.center.y][x].terrain = "wall";
      }
      tiles[room.center.y][room.center.x].terrain = "floor";
      tiles[room.center.y][Math.min(room.right - 1, room.center.x + 1)].terrain = "floor";
    }
    return;
  }

  if (room.preset === "cross") {
    interior.forEach((point) => {
      const onHorizontal = Math.abs(point.y - room.center.y) <= 1;
      const onVertical = Math.abs(point.x - room.center.x) <= 1;
      if (!onHorizontal && !onVertical) {
        tiles[point.y][point.x].terrain = "wall";
      }
    });
    return;
  }

  if (room.preset === "ruins") {
    interior.forEach((point) => {
      const onCenterLane =
        Math.abs(point.x - room.center.x) <= 1 ||
        Math.abs(point.y - room.center.y) <= 1;
      if (!onCenterLane && random.next() < 0.27) {
        tiles[point.y][point.x].terrain = "wall";
      } else if (random.next() < 0.22) {
        tiles[point.y][point.x].terrain = "highGrass";
      }
    });
    return;
  }

  if (room.preset === "splitPools") {
    interior.forEach((point) => {
      const dx = Math.abs(point.x - room.center.x);
      const dy = Math.abs(point.y - room.center.y);
      if (dx >= 2 && dy >= 1) tiles[point.y][point.x].terrain = "water";
    });
    return;
  }

  if (room.preset === "alcoves") {
    interior.forEach((point) => {
      const edgeInset =
        point.x === room.left + 2 ||
        point.x === room.right - 2 ||
        point.y === room.top + 2 ||
        point.y === room.bottom - 2;
      const centerLane =
        point.x === room.center.x || point.y === room.center.y;
      if (edgeInset && !centerLane && (point.x + point.y) % 2 === 0) {
        tiles[point.y][point.x].terrain = "wall";
      }
    });
    return;
  }

  interior.forEach((point) => {
    const roll = random.next();
    if (roll < 0.18) tiles[point.y][point.x].terrain = "grass";
    else if (roll < 0.28) tiles[point.y][point.x].terrain = "water";
  });
};

const roomFloorPoint = (
  tiles: Tile[][],
  room: Room,
  random: ReturnType<typeof makeRandom>,
) => {
  const candidates = roomInterior(room).filter(
    (point) => isWalkable(tiles[point.y][point.x].terrain, true),
  );
  const preferred = candidates.filter(
    (point) =>
      Math.abs(point.x - room.left) >= 2 &&
      Math.abs(point.x - room.right) >= 2 &&
      Math.abs(point.y - room.top) >= 2 &&
      Math.abs(point.y - room.bottom) >= 2,
  );
  const pool = preferred.length ? preferred : candidates;
  return { ...(pool[random.int(0, pool.length - 1)] ?? room.center) };
};

const planCorridorPath = (
  tiles: Tile[][],
  roomPoints: ReadonlySet<string>,
  start: Point,
  end: Point,
  width: 1 | 3,
) => {
  const minimumEdge = width === 3 ? 2 : 1;
  const maximumX = tiles[0].length - 1 - minimumEdge;
  const maximumY = tiles.length - 1 - minimumEdge;
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  if (roomPoints.has(startKey) || roomPoints.has(endKey)) return null;
  const endpoints = new Set([startKey, endKey]);
  const blocked = (point: Point) => {
    if (
      point.x < minimumEdge ||
      point.x > maximumX ||
      point.y < minimumEdge ||
      point.y > maximumY
    ) {
      return true;
    }
    if (endpoints.has(pointKey(point))) return false;
    const clearance = width === 3 ? 1 : 0;
    for (let y = point.y - clearance; y <= point.y + clearance; y += 1) {
      for (let x = point.x - clearance; x <= point.x + clearance; x += 1) {
        if (roomPoints.has(`${x},${y}`)) return true;
      }
    }
    return false;
  };

  const queue: Point[] = [{ ...start }];
  const parents = new Map<string, string | null>([[pointKey(start), null]]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    if (pointKey(current) === pointKey(end)) break;
    CARDINALS.forEach((direction) => {
      const neighbor = {
        x: current.x + direction.x,
        y: current.y + direction.y,
      };
      const key = pointKey(neighbor);
      if (parents.has(key) || blocked(neighbor)) return;
      parents.set(key, pointKey(current));
      queue.push(neighbor);
    });
  }
  if (!parents.has(pointKey(end))) return null;

  const path: Point[] = [];
  let cursor: string | null = pointKey(end);
  while (cursor) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = parents.get(cursor) ?? null;
  }
  return path.reverse();
};

const connectRooms = (
  tiles: Tile[][],
  roomPoints: ReadonlySet<string>,
  first: Room,
  second: Room,
  usedDoorPoints: Set<string>,
  width: 1 | 3,
  chasmCorridor: boolean,
) => {
  let firstDoor: Point;
  let secondDoor: Point;
  let firstOutside: Point;
  let secondOutside: Point;
  const horizontal =
    Math.abs(first.center.x - second.center.x) >=
    Math.abs(first.center.y - second.center.y);

  const nearestUnused = (
    candidates: Point[],
    target: number,
    axis: "x" | "y",
  ) =>
    [...candidates]
      .sort(
        (a, b) =>
          Math.abs(a[axis] - target) - Math.abs(b[axis] - target),
      )
      .find(
        (point) =>
          !usedDoorPoints.has(pointKey(point)) &&
          [...usedDoorPoints].every((used) => {
            const [x, y] = used.split(",").map(Number);
            return Math.max(Math.abs(point.x - x), Math.abs(point.y - y)) > 1;
          }),
      ) ??
    [...candidates].find(
      (point) => !usedDoorPoints.has(pointKey(point)),
    ) ??
    candidates[0];

  if (horizontal) {
    const left = first.center.x < second.center.x ? first : second;
    const right = left === first ? second : first;
    const leftDoor = nearestUnused(
      Array.from(
        { length: Math.max(1, left.bottom - left.top - 1) },
        (_, index) => ({ x: left.right, y: left.top + 1 + index }),
      ),
      right.center.y,
      "y",
    );
    const rightDoor = nearestUnused(
      Array.from(
        { length: Math.max(1, right.bottom - right.top - 1) },
        (_, index) => ({ x: right.left, y: right.top + 1 + index }),
      ),
      left.center.y,
      "y",
    );
    firstDoor = left === first ? leftDoor : rightDoor;
    secondDoor = left === first ? rightDoor : leftDoor;
    firstOutside = left === first
      ? { x: leftDoor.x + 1, y: leftDoor.y }
      : { x: rightDoor.x - 1, y: rightDoor.y };
    secondOutside = left === first
      ? { x: rightDoor.x - 1, y: rightDoor.y }
      : { x: leftDoor.x + 1, y: leftDoor.y };
  } else {
    const top = first.center.y < second.center.y ? first : second;
    const bottom = top === first ? second : first;
    const topDoor = nearestUnused(
      Array.from(
        { length: Math.max(1, top.right - top.left - 1) },
        (_, index) => ({ x: top.left + 1 + index, y: top.bottom }),
      ),
      bottom.center.x,
      "x",
    );
    const bottomDoor = nearestUnused(
      Array.from(
        { length: Math.max(1, bottom.right - bottom.left - 1) },
        (_, index) => ({ x: bottom.left + 1 + index, y: bottom.top }),
      ),
      top.center.x,
      "x",
    );
    firstDoor = top === first ? topDoor : bottomDoor;
    secondDoor = top === first ? bottomDoor : topDoor;
    firstOutside = top === first
      ? { x: topDoor.x, y: topDoor.y + 1 }
      : { x: bottomDoor.x, y: bottomDoor.y - 1 };
    secondOutside = top === first
      ? { x: bottomDoor.x, y: bottomDoor.y - 1 }
      : { x: topDoor.x, y: topDoor.y + 1 };
  }

  const path = planCorridorPath(
    tiles,
    roomPoints,
    firstOutside,
    secondOutside,
    width,
  );
  if (!path) return null;

  const walkwayRadius = width === 3 ? 1 : 0;
  path.forEach((point) => {
    for (let y = point.y - walkwayRadius; y <= point.y + walkwayRadius; y += 1) {
      for (let x = point.x - walkwayRadius; x <= point.x + walkwayRadius; x += 1) {
        if (
          !inside(tiles, x, y) ||
          roomPoints.has(`${x},${y}`)
        ) {
          continue;
        }
        tiles[y][x].terrain = "floor";
      }
    }
  });
  tiles[firstDoor.y][firstDoor.x].terrain = "door";
  tiles[secondDoor.y][secondDoor.x].terrain = "door";
  usedDoorPoints.add(pointKey(firstDoor));
  usedDoorPoints.add(pointKey(secondDoor));
  return {
    firstDoor,
    secondDoor,
    axis: horizontal ? ("horizontal" as const) : ("vertical" as const),
    width,
    length: path.length,
    kind: chasmCorridor ? ("chasm" as const) : ("normal" as const),
    path,
  };
};

const carveRoomAccess = (
  tiles: Tile[][],
  room: Room,
  door: Point,
) => {
  let x = door.x;
  let y = door.y;
  const carve = () => {
    if (
      (x !== door.x || y !== door.y) &&
      inside(tiles, x, y) &&
      !isDoor(tiles[y][x].terrain)
    ) {
      tiles[y][x].terrain = "floor";
    }
  };
  const entersHorizontally = door.x === room.left || door.x === room.right;
  const carveHorizontal = () => {
    while (x !== room.center.x) {
      x += Math.sign(room.center.x - x);
      carve();
    }
  };
  const carveVertical = () => {
    while (y !== room.center.y) {
      y += Math.sign(room.center.y - y);
      carve();
    }
  };
  // A top/bottom door must move vertically off the perimeter before turning.
  // Moving horizontally first carved a row of false openings along the room
  // wall and made diagonal connections look torn open.
  if (entersHorizontally) {
    carveHorizontal();
    carveVertical();
  } else {
    carveVertical();
    carveHorizontal();
  }
};

const cardinalWalkableCount = (tiles: Tile[][], point: Point) =>
  CARDINALS.reduce(
    (count, direction) =>
      count +
      Number(
        inside(tiles, point.x + direction.x, point.y + direction.y) &&
          isWalkable(
            tiles[point.y + direction.y][point.x + direction.x].terrain,
            true,
          ),
      ),
    0,
  );

const diagonalOpeningAt = (tiles: Tile[][], x: number, y: number) => {
  const cells = [
    { x, y },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x + 1, y: y + 1 },
  ];
  const open = cells.map((point) =>
    isWalkable(tiles[point.y][point.x].terrain, true),
  );
  if (open[0] && open[3] && !open[1] && !open[2]) {
    return {
      open: [cells[0], cells[3]],
      walls: [cells[1], cells[2]],
    };
  }
  if (open[1] && open[2] && !open[0] && !open[3]) {
    return {
      open: [cells[1], cells[2]],
      walls: [cells[0], cells[3]],
    };
  }
  return null;
};

const hasDiagonalOpenings = (tiles: Tile[][]) => {
  for (let y = 0; y < tiles.length - 1; y += 1) {
    for (let x = 0; x < tiles[0].length - 1; x += 1) {
      if (diagonalOpeningAt(tiles, x, y)) return true;
    }
  }
  return false;
};

const sealDiagonalOpenings = (
  tiles: Tile[][],
  rooms: readonly Room[],
  protectedPoints: ReadonlySet<string>,
) => {
  const roomBoundaries = new Set<string>();
  const roomInteriors = new Set<string>();
  rooms.forEach((room) => {
    for (let y = room.top; y <= room.bottom; y += 1) {
      for (let x = room.left; x <= room.right; x += 1) {
        const key = pointKey({ x, y });
        if (
          x === room.left ||
          x === room.right ||
          y === room.top ||
          y === room.bottom
        ) {
          roomBoundaries.add(key);
        } else {
          roomInteriors.add(key);
        }
      }
    }
  });

  // Diagonal movement is intentionally allowed, so a checkerboard 2×2 block
  // is a real one-pixel passage. Fill an unprotected inner corner when
  // possible; otherwise close the less-connected open cell without ever
  // punching through a room perimeter.
  const maximumPasses = Math.max(8, tiles.length + tiles[0].length);
  for (let pass = 0; pass < maximumPasses; pass += 1) {
    let changed = false;
    for (let y = 1; y < tiles.length - 2; y += 1) {
      for (let x = 1; x < tiles[0].length - 2; x += 1) {
        const opening = diagonalOpeningAt(tiles, x, y);
        if (!opening) continue;
        if (
          [...opening.open, ...opening.walls].some((point) =>
            isDoor(tiles[point.y][point.x].terrain),
          )
        ) {
          continue;
        }
        const fillableCorner = opening.walls
          .filter(
            (point) =>
              tiles[point.y][point.x].terrain === "wall" &&
              !roomBoundaries.has(pointKey(point)) &&
              !protectedPoints.has(pointKey(point)),
          )
          .sort(
            (first, second) =>
              cardinalWalkableCount(tiles, second) -
              cardinalWalkableCount(tiles, first),
          )[0];
        if (fillableCorner) {
          tiles[fillableCorner.y][fillableCorner.x].terrain = "floor";
          changed = true;
          continue;
        }
        const sealableFloor = opening.open
          .filter((point) => {
            const terrain = tiles[point.y][point.x].terrain;
            return (
              !protectedPoints.has(pointKey(point)) &&
              !isDoor(terrain) &&
              terrain !== "entrance" &&
              terrain !== "exit"
            );
          })
          .sort((first, second) => {
            const interiorDifference =
              Number(roomInteriors.has(pointKey(first))) -
              Number(roomInteriors.has(pointKey(second)));
            return interiorDifference ||
              cardinalWalkableCount(tiles, first) -
                cardinalWalkableCount(tiles, second);
          })[0];
        if (sealableFloor) {
          tiles[sealableFloor.y][sealableFloor.x].terrain = "wall";
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
};

// Direct port of Shattered Pixel Dungeon's Patch.generate cellular filter.
// SewerPainter uses 30% water / 5 clustering passes and 20% grass / 4 passes.
const generatePatch = (
  width: number,
  height: number,
  fill: number,
  clustering: number,
  random: ReturnType<typeof makeRandom>,
) => {
  let source = Array.from(
    { length: width * height },
    () => random.next() < fill + (0.5 - fill) * 0.5,
  );
  let target = [...source];
  for (let pass = 0; pass < clustering; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let count = 0;
        let neighbours = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            neighbours += 1;
            if (source[ny * width + nx]) count += 1;
          }
        }
        target[y * width + x] = count * 2 >= neighbours;
      }
    }
    [source, target] = [target, source];
  }
  return source;
};

type RoomSpec = {
  id: string;
  preset: RoomPreset;
  width: number;
  height: number;
  roomValue: 1 | 2 | 3;
  purpose?: "alchemy";
};

type FloorLayout = {
  rooms: Room[];
  edges: RoomEdge[];
  lockedEdge: RoomEdge;
};

// Sewer StandardRoom weights in Shattered Pixel Dungeon v3.3.8.
const STANDARD_PRESETS: RoomPreset[] = [
  ...Array<RoomPreset>(16).fill("sewerPipe"),
  ...Array<RoomPreset>(8).fill("ring"),
  ...Array<RoomPreset>(8).fill("waterBridge"),
  ...Array<RoomPreset>(4).fill("patch"),
  ...Array<RoomPreset>(4).fill("circleBasin"),
  "plants",
  "platform",
  "chasmBridge",
  "chasmRoom",
  "circlePit",
  "cavesFissure",
  "striped",
  "segmented",
  "pillars",
  "ruins",
];

const SPECIAL_PRESETS: RoomPreset[] = [
  "plants",
  "striped",
  "segmented",
  "pillars",
  "ruins",
  "cross",
  "splitPools",
  "alcoves",
];

const SIZE_WEIGHTS: Partial<Record<RoomPreset, [number, number, number]>> = {
  sewerPipe: [3, 2, 1],
  ring: [9, 3, 1],
  circleBasin: [0, 3, 1],
  plants: [3, 1, 0],
  platform: [6, 3, 1],
  chasmBridge: [3, 1, 0],
  chasmRoom: [4, 2, 1],
  circlePit: [4, 2, 1],
  cavesFissure: [9, 3, 1],
  storage: [3, 1, 0],
  magicalFire: [3, 1, 0],
  toxicGas: [3, 1, 0],
  traps: [3, 1, 0],
  crystalChoice: [3, 1, 0],
  crystalPath: [2, 1, 0],
  striped: [2, 1, 0],
  segmented: [9, 3, 1],
  pillars: [9, 3, 1],
  ruins: [4, 2, 1],
};

const PRESET_MINIMUMS: Partial<Record<RoomPreset, number>> = {
  sewerPipe: 7,
  ring: 7,
  waterBridge: 5,
  patch: 5,
  circleBasin: 11,
  plants: 5,
  platform: 6,
  chasmBridge: 5,
  chasmRoom: 5,
  circlePit: 8,
  cavesFissure: 7,
  storage: specialRoomMetadata("storage").minimumSize,
  magicalFire: specialRoomMetadata("magicalFire").minimumSize,
  toxicGas: specialRoomMetadata("toxicGas").minimumSize,
  traps: specialRoomMetadata("traps").minimumSize,
  crystalChoice: specialRoomMetadata("crystalChoice").minimumSize,
  crystalPath: specialRoomMetadata("crystalPath").minimumSize,
  segmented: 7,
  pillars: 7,
};

const roomFromSpec = (spec: RoomSpec, center: Point): Room => {
  const left = center.x - Math.floor(spec.width / 2);
  const top = center.y - Math.floor(spec.height / 2);
  return {
    id: spec.id,
    left,
    top,
    right: left + spec.width - 1,
    bottom: top + spec.height - 1,
    center: { ...center },
    preset: spec.preset,
    roomValue: spec.roomValue,
    purpose: spec.purpose,
  };
};

const ROOM_CLEARANCE = 1;
const ATTACHED_ROOM_GAP = 2;
const MAX_CORRIDOR_LENGTH = 48;

// Expand both room rectangles on every side before comparing them. Using the
// full rectangles (rather than only side-to-side distances) makes diagonal
// corner contact part of collision detection as well.
const overlapsRoom = (
  first: Room,
  second: Room,
  margin = ROOM_CLEARANCE,
) => {
  const separatedHorizontally =
    first.right + margin < second.left ||
    second.right + margin < first.left;
  const separatedVertically =
    first.bottom + margin < second.top ||
    second.bottom + margin < first.top;
  return !separatedHorizontally && !separatedVertically;
};

const roomsHaveCornerClearance = (
  rooms: readonly Room[],
  margin = ROOM_CLEARANCE,
) =>
  rooms.every((room, index) =>
    rooms
      .slice(index + 1)
      .every((other) => !overlapsRoom(room, other, margin)),
  );

const rotatePoint = (point: Point, angle: number): Point => ({
  x: Math.round(point.x * Math.cos(angle) - point.y * Math.sin(angle)),
  y: Math.round(point.x * Math.sin(angle) + point.y * Math.cos(angle)),
});

// These are the same exponent-two curve controls used by LoopBuilder and
// FigureEightBuilder. They produce circles, broad ovals, and pinched loops
// without forcing rooms onto a rectangular grid.
const curvedLoopAngle = (
  percentAlong: number,
  intensity: number,
  offset: number,
) => {
  const shifted = percentAlong + offset;
  const exponent = 2;
  const curve =
    Math.pow(4, 2 * exponent) *
      Math.pow((shifted % 0.5) - 0.25, 2 * exponent + 1) +
    0.25 +
    0.5 * Math.floor(2 * shifted);
  return (
    Math.PI *
    2 *
    (intensity * curve + (1 - intensity) * shifted - offset)
  );
};

const roomSpecs = (
  random: ReturnType<typeof makeRandom>,
  forcedPresets: readonly P0RoomPreset[] = [],
  forcedSpecialPreset?: SpecialRoomPreset,
  bossArena?: BossArenaSettings,
) => {
  // Keep the large party-friendly room sizes, but use a tighter per-floor
  // graph so each expedition floor has fewer stops and shorter transfers.
  const standardRoll = random.next();
  const standardCount = forcedSpecialPreset === "crystalPath"
    ? standardRoll < 0.25
      ? 6
      : standardRoll < 0.8
        ? 7
        : 8
    : standardRoll < 0.55
      ? 5
      : 6;
  const specialCount = random.next() < 0.7 ? 1 : 2;
  const makeSpec = (
    id: string,
    preset: RoomPreset,
    role: "normal" | "special" | "transition",
    maxRoomValue = 3,
  ): RoomSpec => {
    const weights =
      role === "transition"
        ? [1, 0, 0]
        : [...(SIZE_WEIGHTS[preset] ?? [1, 0, 0])];
    for (let index = maxRoomValue; index < weights.length; index += 1) {
      weights[index] = 0;
    }
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = random.next() * Math.max(1, total);
    let category = 0;
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) {
        category = index;
        break;
      }
    }
    // Expanded size categories: even the smallest room has enough space for
    // the complete manually controlled party and the denser monster groups.
    const ranges: Array<[number, number]> = [
      [6, 12],
      [12, 17],
      [17, 23],
    ];
    const [categoryMinimum, maximum] = ranges[category];
    const minimum = Math.max(
      categoryMinimum,
      PRESET_MINIMUMS[preset] ?? categoryMinimum,
    );
    let width = random.int(Math.min(minimum, maximum), maximum);
    let height = random.int(Math.min(minimum, maximum), maximum);
    if (preset === "circleBasin" || preset === "circlePit") {
      if (width % 2 === 0) width -= 1;
      if (height % 2 === 0) height -= 1;
    }
    return {
      id,
      preset,
      width,
      height,
      roomValue: (category + 1) as 1 | 2 | 3,
    };
  };
  const entrance = makeSpec("entrance", "entrance", "transition");
  const ordinaryExit = makeSpec("exit", "exit", "transition");
  const exit = bossArena
    ? {
        ...ordinaryExit,
        id: "boss-room",
        width: Math.max(ordinaryExit.width, bossArena.minimumWidth),
        height: Math.max(ordinaryExit.height, bossArena.minimumHeight),
      }
    : ordinaryExit;
  const standards: RoomSpec[] = [];
  forcedPresets.slice(0, standardCount).forEach((preset) => {
    standards.push(
      makeSpec(`standard-${standards.length}`, preset, "normal", 3),
    );
  });
  let roomBudget = Math.max(
    0,
    standardCount - standards.reduce((total, room) => total + room.roomValue, 0),
  );
  while (roomBudget > 0) {
    let preset: RoomPreset;
    do {
      preset =
        STANDARD_PRESETS[random.int(0, STANDARD_PRESETS.length - 1)];
    } while (
      !(SIZE_WEIGHTS[preset] ?? [1, 0, 0])
        .slice(0, roomBudget)
        .some((weight) => weight > 0)
    );
    const spec = makeSpec(
      `standard-${standards.length}`,
      preset,
      "normal",
      roomBudget,
    );
    standards.push(spec);
    roomBudget -= spec.roomValue;
  }
  const selectedGimmick = forcedSpecialPreset;
  const specials: RoomSpec[] = [];
  if (selectedGimmick) {
    specials.push(
      makeSpec("special-gimmick", selectedGimmick, "special"),
    );
  }
  while (specials.length < specialCount) {
    specials.push({
      ...makeSpec(
        `special-${specials.length}`,
        SPECIAL_PRESETS[random.int(0, SPECIAL_PRESETS.length - 1)],
        "special",
      ),
      purpose: specials.some((room) => room.purpose === "alchemy")
        ? undefined
        : "alchemy",
    });
  }
  return { entrance, exit, standards, specials };
};

const placeAttachedRoom = (
  spec: RoomSpec,
  anchor: Room,
  existing: Room[],
  preferredAngle: number,
  random: ReturnType<typeof makeRandom>,
) => {
  const anchorRadius = Math.max(
    anchor.right - anchor.left + 1,
    anchor.bottom - anchor.top + 1,
  );
  const roomRadius = Math.max(spec.width, spec.height);
  for (let ring = 0; ring < 5; ring += 1) {
    const distance =
      (anchorRadius + roomRadius) / 2 + ATTACHED_ROOM_GAP + ring * 2;
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const side = attempt % 2 === 0 ? 1 : -1;
      const sweep = Math.ceil(attempt / 2) * (Math.PI / 12);
      const angle =
        preferredAngle +
        side * sweep +
        (random.next() - 0.5) * (Math.PI / 18);
      const room = roomFromSpec(spec, {
        x: Math.round(anchor.center.x + Math.cos(angle) * distance),
        y: Math.round(anchor.center.y + Math.sin(angle) * distance),
      });
      if (!existing.some((candidate) => overlapsRoom(room, candidate))) {
        return room;
      }
    }
  }
  // A crowded loop can exhaust the angled candidates. Place the fallback
  // beyond the complete layout bounds instead of relative to only its anchor;
  // the old anchor-relative fallback could overlap another branch at a corner.
  const fallbackLeft =
    Math.max(...existing.map((room) => room.right)) +
    ROOM_CLEARANCE +
    2;
  const fallbackCenterX =
    fallbackLeft + Math.floor(spec.width / 2);
  let fallbackCenterY = anchor.center.y;
  let fallback = roomFromSpec(spec, {
    x: fallbackCenterX,
    y: fallbackCenterY,
  });
  while (existing.some((candidate) => overlapsRoom(fallback, candidate))) {
    fallbackCenterY +=
      Math.max(spec.height, roomRadius) + ROOM_CLEARANCE + 2;
    fallback = roomFromSpec(spec, {
      x: fallbackCenterX,
      y: fallbackCenterY,
    });
  }
  return fallback;
};

const buildLoopLayout = (
  specs: ReturnType<typeof roomSpecs>,
  random: ReturnType<typeof makeRandom>,
): FloorLayout => {
  const coreSpecs = [specs.entrance, ...specs.standards];
  const intensity = random.next() * 0.65;
  const offset = random.next() * 0.5;
  const rotation = random.next() * Math.PI * 2;
  const xBase = random.int(10, 14) + coreSpecs.length;
  const yBase = random.int(7, 10) + Math.floor(coreSpecs.length / 2);
  let rooms: Room[] = [];

  for (let scale = 1; scale <= 1.9; scale += 0.1) {
    rooms = coreSpecs.map((spec, index) => {
      const angle =
        curvedLoopAngle(index / coreSpecs.length, intensity, offset) +
        rotation;
      return roomFromSpec(spec, {
        x: Math.round(Math.cos(angle) * xBase * scale),
        y: Math.round(Math.sin(angle) * yBase * scale),
      });
    });
    if (
      !rooms.some((room, index) =>
        rooms.slice(index + 1).some((other) => overlapsRoom(room, other)),
      )
    ) {
      break;
    }
  }

  const edges: RoomEdge[] = rooms.map((room, index) => ({
    from: room.id,
    to: rooms[(index + 1) % rooms.length].id,
  }));
  const loopCenter = rooms.reduce(
    (center, room) => ({
      x: center.x + room.center.x / rooms.length,
      y: center.y + room.center.y / rooms.length,
    }),
    { x: 0, y: 0 },
  );
  const exitAnchor =
    rooms[Math.floor(rooms.length / 2)] ?? rooms[rooms.length - 1];
  const exitAngle = Math.atan2(
    exitAnchor.center.y - loopCenter.y,
    exitAnchor.center.x - loopCenter.x,
  );
  const exitRoom = placeAttachedRoom(
    specs.exit,
    exitAnchor,
    rooms,
    exitAngle,
    random,
  );
  rooms.push(exitRoom);
  const lockedEdge = { from: exitAnchor.id, to: exitRoom.id };
  edges.push(lockedEdge);

  specs.specials.forEach((spec, index) => {
    const anchor =
      rooms[
        (random.int(0, coreSpecs.length - 1) + index * 2) %
          coreSpecs.length
      ];
    const inwardAngle = Math.atan2(
      loopCenter.y - anchor.center.y,
      loopCenter.x - anchor.center.x,
    );
    const room = placeAttachedRoom(
      spec,
      anchor,
      rooms,
      inwardAngle,
      random,
    );
    rooms.push(room);
    edges.push({ from: anchor.id, to: room.id });
  });
  return { rooms, edges, lockedEdge };
};

const buildFigureEightLayout = (
  specs: ReturnType<typeof roomSpecs>,
  random: ReturnType<typeof makeRandom>,
): FloorLayout => {
  const [landmarkSpec, ...remainingStandards] = specs.standards;
  const landmark: RoomSpec = {
    ...landmarkSpec,
    width: Math.max(10, landmarkSpec.width),
    height: Math.max(10, landmarkSpec.height),
  };
  const loopSpecs = [specs.entrance, ...remainingStandards];
  const split = Math.ceil(loopSpecs.length / 2);
  const firstSpecs = loopSpecs.slice(0, split);
  const secondSpecs = loopSpecs.slice(split);
  const intensity = 0.3 + random.next() * 0.5;
  const rotation = random.next() * Math.PI * 2;
  const xRadius = random.int(10, 14);
  const yRadius = random.int(7, 10);
  let rooms: Room[] = [];

  for (let scale = 1; scale <= 2; scale += 0.1) {
    const centerRoom = roomFromSpec(landmark, { x: 0, y: 0 });
    const firstRooms = firstSpecs.map((spec, index) => {
      const percent = (index + 1) / (firstSpecs.length + 1);
      const angle = curvedLoopAngle(percent, intensity, 0);
      return roomFromSpec(
        spec,
        rotatePoint(
          {
            x: Math.round((-xRadius + Math.cos(angle) * xRadius) * scale),
            y: Math.round(Math.sin(angle) * yRadius * scale),
          },
          rotation,
        ),
      );
    });
    const secondRooms = secondSpecs.map((spec, index) => {
      const percent = (index + 1) / (secondSpecs.length + 1);
      const angle = Math.PI + curvedLoopAngle(percent, intensity, 0);
      return roomFromSpec(
        spec,
        rotatePoint(
          {
            x: Math.round((xRadius + Math.cos(angle) * xRadius) * scale),
            y: Math.round(Math.sin(angle) * yRadius * scale),
          },
          rotation,
        ),
      );
    });
    rooms = [centerRoom, ...firstRooms, ...secondRooms];
    if (
      !rooms.some((room, index) =>
        rooms.slice(index + 1).some((other) => overlapsRoom(room, other)),
      )
    ) {
      break;
    }
  }

  const landmarkRoom = rooms[0];
  const firstRooms = rooms.slice(1, 1 + firstSpecs.length);
  const secondRooms = rooms.slice(1 + firstSpecs.length);
  const loopEdges = (loop: Room[]) => {
    const path = [landmarkRoom, ...loop, landmarkRoom];
    return path.slice(0, -1).map((room, index) => ({
      from: room.id,
      to: path[index + 1].id,
    }));
  };
  const edges = [...loopEdges(firstRooms), ...loopEdges(secondRooms)];
  const exitAnchor =
    secondRooms[Math.floor(secondRooms.length / 2)] ??
    firstRooms[firstRooms.length - 1] ??
    landmarkRoom;
  const exitAngle = Math.atan2(
    exitAnchor.center.y - landmarkRoom.center.y,
    exitAnchor.center.x - landmarkRoom.center.x,
  );
  const exitRoom = placeAttachedRoom(
    specs.exit,
    exitAnchor,
    rooms,
    exitAngle,
    random,
  );
  rooms.push(exitRoom);
  const lockedEdge = { from: exitAnchor.id, to: exitRoom.id };
  edges.push(lockedEdge);

  const branchable = [...firstRooms, ...secondRooms, landmarkRoom];
  specs.specials.forEach((spec, index) => {
    const anchor =
      branchable[
        (random.int(0, branchable.length - 1) + index * 2) %
          branchable.length
      ];
    const towardLandmark = Math.atan2(
      landmarkRoom.center.y - anchor.center.y,
      landmarkRoom.center.x - anchor.center.x,
    );
    const room = placeAttachedRoom(
      spec,
      anchor,
      rooms,
      towardLandmark,
      random,
    );
    rooms.push(room);
    edges.push({ from: anchor.id, to: room.id });
  });
  return { rooms, edges, lockedEdge };
};

const normalizeLayout = (layout: FloorLayout) => {
  const left = Math.min(...layout.rooms.map((room) => room.left)) - 3;
  const top = Math.min(...layout.rooms.map((room) => room.top)) - 3;
  layout.rooms.forEach((room) => {
    room.left -= left;
    room.right -= left;
    room.top -= top;
    room.bottom -= top;
    room.center.x -= left;
    room.center.y -= top;
  });
  return {
    width: Math.max(...layout.rooms.map((room) => room.right)) + 4,
    height: Math.max(...layout.rooms.map((room) => room.bottom)) + 4,
  };
};

export function generateFloor(
  seed: number,
  attempt = 0,
  forcedPresets: readonly P0RoomPreset[] = [],
  forcedSpecialPreset?: SpecialRoomPreset,
  floor = 1,
  bossArena?: BossArenaSettings,
): GeneratedFloor {
  const random = makeRandom(seed);
  const specs = roomSpecs(
    random,
    forcedPresets,
    forcedSpecialPreset,
    bossArena,
  );
  // RegularLevel chooses evenly between LoopBuilder and FigureEightBuilder.
  const layout =
    random.next() < 0.5
      ? buildLoopLayout(specs, random)
      : buildFigureEightLayout(specs, random);
  const { width, height } = normalizeLayout(layout);
  const tiles: Tile[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain: "wall" as Terrain,
      discovered: false,
      visible: false,
      discoveredMask: 0,
      visibleMask: 0,
      variant: random.int(0, 99),
    })),
  );
  const roomById = new Map(layout.rooms.map((room) => [room.id, room]));
  const roomPoints = new Set<string>();
  layout.rooms.forEach((room) => {
    for (let y = room.top; y <= room.bottom; y += 1) {
      for (let x = room.left; x <= room.right; x += 1) {
        roomPoints.add(`${x},${y}`);
      }
    }
  });

  layout.rooms.forEach((room) => paintRoom(tiles, room, random));

  let lockedDoor: Point | null = null;
  const usedDoorPoints = new Set<string>();
  const doorAxes = new Map<string, "horizontal" | "vertical">();
  const roomDoors = new Map<string, Point[]>();
  // Figure-eight layouts may intentionally contain the same undirected room
  // pair twice. Assign widths by connection index so those passages remain
  // independent and the requested rounded 80% quota is exact.
  const shuffledEdgeIndexes = layout.edges.map((_, index) => index);
  for (let index = shuffledEdgeIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(0, index);
    [shuffledEdgeIndexes[index], shuffledEdgeIndexes[swapIndex]] = [
      shuffledEdgeIndexes[swapIndex],
      shuffledEdgeIndexes[index],
    ];
  }
  const expectedWideCorridors = Math.round(layout.edges.length * 0.8);
  const wideEdgeIndexes = new Set(
    shuffledEdgeIndexes.slice(0, expectedWideCorridors),
  );
  const corridorWidths: Array<1 | 3> = [];
  const corridorLengths: number[] = [];
  const corridorKinds: Array<"normal" | "chasm"> = [];
  const corridorPlans: Array<{
    width: 1 | 3;
    kind: "normal" | "chasm";
    path: Point[];
  }> = [];
  let corridorPlanningFailed = false;
  for (const [edgeIndex, edge] of layout.edges.entries()) {
    const first = roomById.get(edge.from);
    const second = roomById.get(edge.to);
    if (!first || !second) {
      corridorPlanningFailed = true;
      continue;
    }
    const connection = connectRooms(
      tiles,
      roomPoints,
      first,
      second,
      usedDoorPoints,
      wideEdgeIndexes.has(edgeIndex) ? 3 : 1,
      random.next() < 0.2,
    );
    if (!connection) {
      corridorPlanningFailed = true;
      continue;
    }
    corridorWidths.push(connection.width);
    corridorLengths.push(connection.length);
    corridorKinds.push(connection.kind);
    corridorPlans.push({
      width: connection.width,
      kind: connection.kind,
      path: connection.path,
    });
    carveRoomAccess(tiles, first, connection.firstDoor);
    carveRoomAccess(tiles, second, connection.secondDoor);
    roomDoors.set(first.id, [
      ...(roomDoors.get(first.id) ?? []),
      connection.firstDoor,
    ]);
    roomDoors.set(second.id, [
      ...(roomDoors.get(second.id) ?? []),
      connection.secondDoor,
    ]);
    doorAxes.set(pointKey(connection.firstDoor), connection.axis);
    doorAxes.set(pointKey(connection.secondDoor), connection.axis);
    if (
      edgeKey(edge.from, edge.to) ===
      edgeKey(layout.lockedEdge.from, layout.lockedEdge.to)
    ) {
      lockedDoor = {
        ...(edge.to === specs.exit.id
          ? connection.secondDoor
          : connection.firstDoor),
      };
      tiles[lockedDoor.y][lockedDoor.x].terrain = "lockedDoor";
    }
  }

  const generatedExitRoom = roomById.get(specs.exit.id);
  if (generatedExitRoom && lockedDoor) {
    for (
      let x = generatedExitRoom.left;
      x <= generatedExitRoom.right;
      x += 1
    ) {
      if (x !== lockedDoor.x || generatedExitRoom.top !== lockedDoor.y) {
        tiles[generatedExitRoom.top][x].terrain = "wall";
      }
      if (x !== lockedDoor.x || generatedExitRoom.bottom !== lockedDoor.y) {
        tiles[generatedExitRoom.bottom][x].terrain = "wall";
      }
    }
    for (
      let y = generatedExitRoom.top;
      y <= generatedExitRoom.bottom;
      y += 1
    ) {
      if (generatedExitRoom.left !== lockedDoor.x || y !== lockedDoor.y) {
        tiles[y][generatedExitRoom.left].terrain = "wall";
      }
      if (generatedExitRoom.right !== lockedDoor.x || y !== lockedDoor.y) {
        tiles[y][generatedExitRoom.right].terrain = "wall";
      }
    }
    tiles[lockedDoor.y][lockedDoor.x].terrain = "lockedDoor";
  }

  // Keep every doorway on exactly one tunnel axis. Apart from matching the
  // source painter, this prevents decorative patches from making fake doors.
  doorAxes.forEach((axis, key) => {
    const [x, y] = key.split(",").map(Number);
    const terrain = tiles[y][x].terrain;
    const setUnlessDoor = (px: number, py: number) => {
      if (!inside(tiles, px, py) || isDoor(tiles[py][px].terrain)) return;
      if (roomPoints.has(`${px},${py}`)) {
        tiles[py][px].terrain = "floor";
      } else if (tiles[py][px].terrain !== "specialFloor") {
        tiles[py][px].terrain = "floor";
      }
    };
    const setWallUnlessDoor = (px: number, py: number) => {
      if (!inside(tiles, px, py) || isDoor(tiles[py][px].terrain)) return;
      tiles[py][px].terrain = "wall";
    };
    if (axis === "horizontal") {
      setUnlessDoor(x - 1, y);
      setUnlessDoor(x + 1, y);
      setWallUnlessDoor(x, y - 1);
      setWallUnlessDoor(x, y + 1);
    } else {
      setUnlessDoor(x, y - 1);
      setUnlessDoor(x, y + 1);
      setWallUnlessDoor(x - 1, y);
      setWallUnlessDoor(x + 1, y);
    }
    tiles[y][x].terrain = terrain;
  });

  // These presets depend on their actual connection doors. Paint them only
  // after corridor planning, reusing the existing terrain and path rules.
  layout.rooms.forEach((room) => {
    if (!isP0RoomPreset(room.preset)) return;
    paintP0Room(
      tiles,
      { ...room, preset: room.preset },
      roomDoors.get(room.id) ?? [],
      random,
    );
  });

  const specialRooms: DungeonSpecialRoom[] = [];
  const requiredFloorSpawns: GuaranteedFloorSpawn[] = [];
  const traps: DungeonTrap[] = [];
  const specialRewards: SpecialRewardSlot[] = [];
  const toxicGasTiles: Point[] = [];
  const magicalFireTiles: Point[] = [];
  layout.rooms.forEach((room) => {
    if (!isSpecialRoomPreset(room.preset)) return;
    const result = paintSpecialRoom(
      tiles,
      { ...room, preset: room.preset },
      roomDoors.get(room.id) ?? [],
      random,
      floor,
    );
    specialRooms.push(result.room);
    requiredFloorSpawns.push(...result.requiredFloorSpawns);
    traps.push(...result.traps);
    specialRewards.push(...result.rewards);
    toxicGasTiles.push(...result.toxicGasTiles);
    magicalFireTiles.push(...result.magicalFireTiles);
  });

  const entranceRoom = roomById.get(specs.entrance.id) ?? layout.rooms[0];
  const exitRoom =
    roomById.get(specs.exit.id) ?? layout.rooms.at(-1) ?? layout.rooms[0];
  const start = roomFloorPoint(tiles, entranceRoom, random);
  const bossRoom: BossRoom | undefined = bossArena
    ? {
        id: "boss-room",
        left: exitRoom.left,
        top: exitRoom.top,
        right: exitRoom.right,
        bottom: exitRoom.bottom,
        center: { ...exitRoom.center },
      }
    : undefined;
  const exit = bossRoom
    ? { x: bossRoom.center.x, y: bossRoom.bottom - 1 }
    : roomFloorPoint(tiles, exitRoom, random);
  tiles[start.y][start.x].terrain = "entrance";
  tiles[exit.y][exit.x].terrain = "exit";
  if (bossRoom) {
    for (let y = bossRoom.top + 1; y < bossRoom.bottom; y += 1) {
      for (let x = bossRoom.left + 1; x < bossRoom.right; x += 1) {
        tiles[y][x].terrain = "floor";
      }
    }
    paintBossArena(tiles, bossRoom, bossArena?.profile ?? "plain");
    tiles[exit.y][exit.x].terrain = "exit";
    tiles[bossRoom.center.y][bossRoom.center.x].terrain = "floor";
  }

  // RegularPainter only decorates room-approved empty cells, never the
  // connecting tunnels. SewerPainter uses water 0.30/5 and grass 0.20/4.
  const roomPaintable = new Set(
    layout.rooms
      .filter(
        (room) =>
          !isSpecialRoomPreset(room.preset) &&
          (!bossRoom || room.id !== specs.exit.id),
      )
      .flatMap((room) => roomInterior(room).map(pointKey)),
  );
  const roomAnchorPoint = (room: Room) =>
    roomInterior(room)
      .filter((point) => isWalkable(tiles[point.y][point.x].terrain, true))
      .sort(
        (first, second) =>
          Math.abs(first.x - room.center.x) +
            Math.abs(first.y - room.center.y) -
            Math.abs(second.x - room.center.x) -
            Math.abs(second.y - room.center.y),
      )[0] ?? room.center;
  const roomAnchors = new Map(
    layout.rooms.map((room) => [room.id, roomAnchorPoint(room)]),
  );
  const protectedPoints = new Set<string>([
    pointKey(start),
    pointKey(exit),
    ...layout.rooms.map((room) => pointKey(roomAnchors.get(room.id) ?? room.center)),
  ]);
  doorAxes.forEach((axis, key) => {
    protectedPoints.add(key);
    const [x, y] = key.split(",").map(Number);
    CARDINALS.forEach(({ x: dx, y: dy }) =>
      protectedPoints.add(pointKey({ x: x + dx, y: y + dy })),
    );
    if (axis === "horizontal") {
      protectedPoints.add(pointKey({ x: x - 2, y }));
      protectedPoints.add(pointKey({ x: x + 2, y }));
    } else {
      protectedPoints.add(pointKey({ x, y: y - 2 }));
      protectedPoints.add(pointKey({ x, y: y + 2 }));
    }
  });

  const waterPatch = generatePatch(width, height, 0.3, 5, random);
  const grassPatch = generatePatch(width, height, 0.2, 4, random);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const tile = tiles[y][x];
      const key = pointKey({ x, y });
      if (
        tile.terrain !== "floor" ||
        !roomPaintable.has(key) ||
        protectedPoints.has(key)
      ) {
        continue;
      }
      const index = y * width + x;
      if (waterPatch[index]) {
        tile.terrain = "water";
      } else if (grassPatch[index]) {
        // Exact RegularPainter rule: height depends on the eight-cell patch
        // neighbourhood, rather than a fixed high-grass percentage.
        let count = 1;
        EIGHT_WAY.forEach(({ x: dx, y: dy }) => {
          if (grassPatch[(y + dy) * width + x + dx]) count += 1;
        });
        tile.terrain = random.next() < count / 12 ? "highGrass" : "grass";
      }
    }
  }

  sealDiagonalOpenings(tiles, layout.rooms, protectedPoints);
  const sealedRoomPerimeters = layout.rooms.every((room) => {
    for (let x = room.left; x <= room.right; x += 1) {
      if (
        !isDoor(tiles[room.top][x].terrain) &&
        tiles[room.top][x].terrain !== "wall"
      ) return false;
      if (
        !isDoor(tiles[room.bottom][x].terrain) &&
        tiles[room.bottom][x].terrain !== "wall"
      ) return false;
    }
    for (let y = room.top; y <= room.bottom; y += 1) {
      if (
        !isDoor(tiles[y][room.left].terrain) &&
        tiles[y][room.left].terrain !== "wall"
      ) return false;
      if (
        !isDoor(tiles[y][room.right].terrain) &&
        tiles[y][room.right].terrain !== "wall"
      ) return false;
    }
    return true;
  });

  const reachable = floodDistances(
    tiles,
    start,
    lockedDoor ?? undefined,
    false,
  );
  const reachableAfterUnlock = floodDistances(tiles, start, undefined, true);
  const validDoors = [...doorAxes].every(([key]) => {
    const [x, y] = key.split(",").map(Number);
    const walkable = (px: number, py: number) =>
      Boolean(
        inside(tiles, px, py) &&
          (isWalkable(tiles[py][px].terrain, true) ||
            isDoor(tiles[py][px].terrain)),
      );
    const wall = (px: number, py: number) =>
      inside(tiles, px, py) && tiles[py][px].terrain === "wall";
    const horizontal =
      walkable(x - 1, y) &&
      walkable(x + 1, y) &&
      wall(x, y - 1) &&
      wall(x, y + 1);
    const vertical =
      walkable(x, y - 1) &&
      walkable(x, y + 1) &&
      wall(x - 1, y) &&
      wall(x + 1, y);
    return horizontal !== vertical;
  });
  const validLayout =
    lockedDoor !== null &&
    roomsHaveCornerClearance(layout.rooms) &&
    !corridorPlanningFailed &&
    corridorWidths.length === layout.edges.length &&
    corridorLengths.length === layout.edges.length &&
    corridorKinds.length === layout.edges.length &&
    corridorLengths.every((length) => length <= MAX_CORRIDOR_LENGTH) &&
    corridorWidths.filter((width) => width === 3).length ===
      expectedWideCorridors &&
    validDoors &&
    sealedRoomPerimeters &&
    !hasDiagonalOpenings(tiles) &&
    !reachable.has(pointKey(exit)) &&
    reachableAfterUnlock.has(pointKey(exit)) &&
    layout.rooms.every((room) =>
      isSpecialRoomPreset(room.preset) ||
      reachableAfterUnlock.has(pointKey(roomAnchors.get(room.id) ?? room.center)),
    );
  if (!validLayout && attempt < 64) {
    // RegularLevel retries a rejected builder result. Advance deterministically
    // so one problematic placement never leaks a disconnected floor.
    return generateFloor(
      (seed + 0x9e3779b9 + attempt * 0x85ebca6b) >>> 0,
      attempt + 1,
      forcedPresets,
      forcedSpecialPreset,
      floor,
      bossArena,
    );
  }
  if (!validLayout) {
    throw new Error(
      `Unable to generate a valid floor after ${attempt + 1} attempts ` +
        `(locked=${lockedDoor !== null}, clearance=${roomsHaveCornerClearance(layout.rooms)}, ` +
        `corridors=${!corridorPlanningFailed && corridorWidths.length === layout.edges.length && corridorLengths.every((length) => length <= MAX_CORRIDOR_LENGTH)}, ` +
        `doors=${validDoors}, sealed=${sealedRoomPerimeters}, diagonal=${hasDiagonalOpenings(tiles)}, ` +
        `exitLocked=${!reachable.has(pointKey(exit))}, exitReachable=${reachableAfterUnlock.has(pointKey(exit))})`,
    );
  }

  // Corridor geometry is validated against the ordinary stone layout first.
  // Converting only existing walls to CHASM and existing floor to bridge tiles
  // cannot remove a walkable route or intrude into a room/crossing corridor.
  corridorPlans
    .filter((corridor) => corridor.kind === "chasm")
    .forEach((corridor) => {
      const walkwayRadius = corridor.width === 3 ? 1 : 0;
      corridor.path.forEach((point) => {
        const chasmRadius = walkwayRadius + 1;
        for (let y = point.y - chasmRadius; y <= point.y + chasmRadius; y += 1) {
          for (let x = point.x - chasmRadius; x <= point.x + chasmRadius; x += 1) {
            if (
              !inside(tiles, x, y) ||
              roomPoints.has(`${x},${y}`) ||
              tiles[y][x].terrain !== "wall"
            ) {
              continue;
            }
            tiles[y][x].terrain = "chasm";
          }
        }
      });
      corridor.path.forEach((point) => {
        for (let y = point.y - walkwayRadius; y <= point.y + walkwayRadius; y += 1) {
          for (let x = point.x - walkwayRadius; x <= point.x + walkwayRadius; x += 1) {
            if (
              !inside(tiles, x, y) ||
              roomPoints.has(`${x},${y}`) ||
              tiles[y][x].terrain !== "floor"
            ) {
              continue;
            }
            tiles[y][x].terrain = "specialFloor";
          }
        }
      });
    });

  const keyCandidates = tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const point = { x, y };
      const distance = reachable.get(pointKey(point));
      return distance !== undefined &&
        distance >= 4 &&
        !isDoor(tile.terrain) &&
        !specialRooms.some(
          (room) =>
            x >= room.left &&
            x <= room.right &&
            y >= room.top &&
            y <= room.bottom,
        ) &&
        tile.terrain !== "entrance" &&
        tile.terrain !== "exit"
        ? [point]
        : [];
    }),
  );
  const keyPoint = {
    ...(keyCandidates[random.int(0, keyCandidates.length - 1)] ??
      roomFloorPoint(tiles, entranceRoom, random)),
  };
  const alchemyRoom =
    layout.rooms.find((room) => room.purpose === "alchemy") ?? entranceRoom;
  const alchemyPoint = { ...alchemyRoom.center };
  tiles[alchemyPoint.y][alchemyPoint.x].terrain = "floor";

  return {
    width,
    height,
    tiles,
    start,
    exit,
    keyPoint,
    alchemyPoint,
    corridorWidths,
    corridorLengths,
    corridorKinds,
    roomCount: layout.rooms.length,
    ordinaryRoomCount: specs.standards.length,
    ordinaryRoomBudget: specs.standards.reduce(
      (total, room) => total + room.roomValue,
      0,
    ),
    roomPresets: layout.rooms.map((room) => room.preset),
    roomRegions: layout.rooms.map((room) => ({
      preset: room.preset,
      left: room.left,
      top: room.top,
      right: room.right,
      bottom: room.bottom,
    })),
    specialRooms,
    requiredFloorSpawns,
    traps,
    specialRewards,
    toxicGasTiles,
    magicalFireTiles,
    bossRoom,
    rng: random.value(),
  };
}

/*
function generateFloorLegacy(
  width: number,
  height: number,
  seed: number,
): GeneratedFloor {
  const random = makeRandom(seed);
  const tiles: Tile[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain: "wall" as Terrain,
      discovered: false,
      visible: false,
      discoveredMask: 0,
      visibleMask: 0,
      variant: random.int(0, 99),
    })),
  );

  // Shattered Pixel Dungeon builds a graph of painted room presets and places
  // connection rooms between them. This browser port follows that structure:
  // a compact room graph first, then explicit tunnel endpoints and doors.
  const gridColumns = 5;
  const gridRows = 4;
  const desiredRooms = random.int(9, 12);
  const startCell: GridCell = {
    column: random.int(0, gridColumns - 1),
    row: random.int(0, gridRows - 1),
  };
  const selected = new Map<string, GridCell>([[cellKey(startCell), startCell]]);
  const treeEdges: RoomEdge[] = [];

  while (selected.size < desiredRooms) {
    const frontier = [...selected.values()].flatMap((cell) =>
      gridNeighbours(cell, gridColumns, gridRows)
        .filter((candidate) => !selected.has(cellKey(candidate)))
        .map((candidate) => ({ from: cell, to: candidate })),
    );
    if (!frontier.length) break;
    const candidate = frontier[random.int(0, frontier.length - 1)];
    const from = cellKey(candidate.from);
    const to = cellKey(candidate.to);
    selected.set(to, candidate.to);
    treeEdges.push({ from, to });
  }

  const startKey = cellKey(startCell);
  const initialGraph = graphDistances(startKey, treeEdges);
  const degrees = new Map<string, number>();
  treeEdges.forEach((edge) => {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  });
  const exitKey = [...selected.keys()]
    .filter((key) => key !== startKey && (degrees.get(key) ?? 0) === 1)
    .sort(
      (a, b) =>
        (initialGraph.distances.get(b) ?? 0) -
        (initialGraph.distances.get(a) ?? 0),
    )[0];
  const mainPath = pathFromParents(exitKey, initialGraph.parents);
  const lockIndex = Math.max(
    1,
    mainPath.length - random.int(1, Math.min(2, mainPath.length - 1)),
  );
  const nearLockKey = mainPath[lockIndex - 1];
  const farLockKey = mainPath[lockIndex];
  const lockedEdgeKey = edgeKey(nearLockKey, farLockKey);

  const farSide = new Set<string>([farLockKey]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    treeEdges.forEach((edge) => {
      if (farSide.has(edge.from) && edgeKey(edge.from, edge.to) !== lockedEdgeKey) {
        if (!farSide.has(edge.to)) {
          farSide.add(edge.to);
          expanded = true;
        }
      }
      if (farSide.has(edge.to) && edgeKey(edge.from, edge.to) !== lockedEdgeKey) {
        if (!farSide.has(edge.from)) {
          farSide.add(edge.from);
          expanded = true;
        }
      }
    });
  }

  const edges = [...treeEdges];
  const knownEdges = new Set(edges.map((edge) => edgeKey(edge.from, edge.to)));
  const extraCandidates = [...selected.values()].flatMap((cell) =>
    gridNeighbours(cell, gridColumns, gridRows)
      .filter((candidate) => selected.has(cellKey(candidate)))
      .map((candidate) => ({
        from: cellKey(cell),
        to: cellKey(candidate),
      })),
  );
  extraCandidates.forEach((edge) => {
    const key = edgeKey(edge.from, edge.to);
    const bothFar = farSide.has(edge.from) && farSide.has(edge.to);
    const bothNear = !farSide.has(edge.from) && !farSide.has(edge.to);
    if (
      !knownEdges.has(key) &&
      (bothFar || bothNear) &&
      random.next() < 0.3 &&
      edges.length < treeEdges.length + 4
    ) {
      edges.push(edge);
      knownEdges.add(key);
    }
  });

  const centerSpacing = 7;
  const firstCenterX = Math.floor(
    (width - 1 - centerSpacing * (gridColumns - 1)) / 2,
  );
  const firstCenterY = Math.floor(
    (height - 1 - centerSpacing * (gridRows - 1)) / 2,
  );
  // StandardRoom's sewer-weighted v3.3.8 preset table. The repetitions are
  // intentional: pipe 16, ring 8, water bridge 8, patch/basin 4 each.
  const standardPresets: RoomPreset[] = [
    ...Array<RoomPreset>(16).fill("sewerPipe"),
    ...Array<RoomPreset>(8).fill("ring"),
    ...Array<RoomPreset>(8).fill("waterBridge"),
    ...Array<RoomPreset>(4).fill("patch"),
    ...Array<RoomPreset>(4).fill("circleBasin"),
    "plants",
    "platform",
    "striped",
    "segmented",
    "pillars",
    "ruins",
  ];
  const rooms = [...selected.entries()].map(([key, cell]) => {
    const preset: RoomPreset =
      key === startKey
        ? "entrance"
        : key === exitKey
          ? "exit"
          : standardPresets[random.int(0, standardPresets.length - 1)];
    const largePreset = [
      "pillars",
      "ring",
      "sewerPipe",
      "waterBridge",
      "cross",
      "splitPools",
      "alcoves",
    ].includes(preset);
    const roomWidth = largePreset ? 7 : 5;
    const roomHeight = largePreset ? 7 : 5;
    const center = {
      x: firstCenterX + cell.column * centerSpacing,
      y: firstCenterY + cell.row * centerSpacing,
    };
    return {
      left: center.x - Math.floor(roomWidth / 2),
      top: center.y - Math.floor(roomHeight / 2),
      right: center.x + Math.floor(roomWidth / 2),
      bottom: center.y + Math.floor(roomHeight / 2),
      center,
      cell,
      preset,
    } satisfies Room;
  });
  const roomByCell = new Map(rooms.map((room) => [cellKey(room.cell), room]));
  rooms.forEach((room) => paintRoom(tiles, room, random));

  let lockedDoor: Point | null = null;
  const doorAxes = new Map<string, "horizontal" | "vertical">();
  edges.forEach((edge) => {
    const first = roomByCell.get(edge.from);
    const second = roomByCell.get(edge.to);
    if (!first || !second) return;
    const connection = connectRooms(tiles, first, second, random);
    const axis =
      first.cell.row === second.cell.row ? "horizontal" : "vertical";
    doorAxes.set(pointKey(connection.firstDoor), axis);
    doorAxes.set(pointKey(connection.secondDoor), axis);
    if (edgeKey(edge.from, edge.to) === lockedEdgeKey) {
      lockedDoor =
        edge.from === nearLockKey
          ? connection.firstDoor
          : connection.secondDoor;
      tiles[lockedDoor.y][lockedDoor.x].terrain = "lockedDoor";
    }
  });
  doorAxes.forEach((axis, key) => {
    const [x, y] = key.split(",").map(Number);
    const terrain = tiles[y][x].terrain;
    const setUnlessDoor = (px: number, py: number, next: Terrain) => {
      if (!isDoor(tiles[py][px].terrain)) tiles[py][px].terrain = next;
    };
    if (axis === "horizontal") {
      setUnlessDoor(x - 1, y, "floor");
      setUnlessDoor(x + 1, y, "floor");
      setUnlessDoor(x, y - 1, "wall");
      setUnlessDoor(x, y + 1, "wall");
    } else {
      setUnlessDoor(x, y - 1, "floor");
      setUnlessDoor(x, y + 1, "floor");
      setUnlessDoor(x - 1, y, "wall");
      setUnlessDoor(x + 1, y, "wall");
    }
    tiles[y][x].terrain = terrain;
  });

  const startRoom = roomByCell.get(startKey) ?? rooms[0];
  const exitRoom = roomByCell.get(exitKey) ?? rooms.at(-1) ?? rooms[0];
  const start = roomFloorPoint(tiles, startRoom, random);
  const exit = roomFloorPoint(tiles, exitRoom, random);
  tiles[start.y][start.x].terrain = "entrance";
  tiles[exit.y][exit.x].terrain = "exit";

  // RegularPainter applies clustered water first and grass second only to
  // room-approved empty cells. Door lanes and transitions stay protected.
  const protectedPoints = new Set<string>([
    pointKey(start),
    pointKey(exit),
    ...edges.flatMap((edge) => {
      const first = roomByCell.get(edge.from);
      const second = roomByCell.get(edge.to);
      return first && second ? [pointKey(first.center), pointKey(second.center)] : [];
    }),
  ]);
  const waterPatch = generatePatch(width, height, 0.3, 5, random);
  const grassPatch = generatePatch(width, height, 0.2, 4, random);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const tile = tiles[y][x];
      if (
        tile.terrain !== "floor" ||
        protectedPoints.has(pointKey({ x, y })) ||
        CARDINALS.some(({ x: dx, y: dy }) => isDoor(tiles[y + dy][x + dx].terrain))
      ) {
        continue;
      }
      const index = y * width + x;
      if (waterPatch[index]) tile.terrain = "water";
      else if (grassPatch[index]) {
        tile.terrain = random.next() < 0.72 ? "highGrass" : "grass";
      }
    }
  }

  const reachable = floodDistances(
    tiles,
    start,
    lockedDoor ?? undefined,
    false,
  );
  const keyCandidates = tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const point = { x, y };
      const distance = reachable.get(pointKey(point));
      return distance !== undefined &&
        distance >= 4 &&
        tile.terrain !== "door" &&
        tile.terrain !== "openDoor" &&
        tile.terrain !== "lockedDoor" &&
        tile.terrain !== "entrance" &&
        tile.terrain !== "exit"
        ? [point]
        : [];
    }),
  );
  const keyPoint = {
    ...(keyCandidates[random.int(0, keyCandidates.length - 1)] ??
      roomFloorPoint(tiles, startRoom, random)),
  };

  return {
    tiles,
    start,
    exit,
    keyPoint: { ...keyPoint },
    rng: random.value(),
  };
}
*/

const linePoints = (from: Point, to: Point) => {
  const points: Point[] = [];
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let error = dx - dy;

  while (true) {
    points.push({ x, y });
    if (x === to.x && y === to.y) break;
    const doubled = error * 2;
    if (doubled > -dy) {
      error -= dy;
      x += sx;
    }
    if (doubled < dx) {
      error += dx;
      y += sy;
    }
  }
  return points;
};

export function hasLineOfSight(tiles: Tile[][], from: Point, to: Point) {
  const points = linePoints(from, to);
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    if (blocksSight(tiles[point.y][point.x].terrain)) return false;
  }
  return true;
}

export function updateFieldOfView(
  tiles: Tile[][],
  origin: Point,
  radius = 7,
  revealAll = false,
  resetVisible = true,
) {
  if (resetVisible) {
    tiles.forEach((row) =>
      row.forEach((tile) => {
        tile.visible = false;
        tile.visibleMask = 0;
      }),
    );
  }

  const subWidth = tiles[0].length * 2;
  const subHeight = tiles.length * 2;
  const visible = new Uint8Array(subWidth * subHeight);
  const sourceX = origin.x * 2 + 1;
  const sourceY = origin.y * 2 + 1;
  const opaque = (x: number, y: number) =>
    x < 0 ||
    y < 0 ||
    x >= subWidth ||
    y >= subHeight ||
    blocksSight(tiles[Math.floor(y / 2)][Math.floor(x / 2)].terrain);
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < subWidth && y < subHeight) {
      visible[y * subWidth + x] = 1;
    }
  };
  mark(sourceX, sourceY);
  const transforms = [
    [1, 0, 0, 1], [0, 1, 1, 0], [0, 1, -1, 0], [-1, 0, 0, 1],
    [-1, 0, 0, -1], [0, -1, -1, 0], [0, -1, 1, 0], [1, 0, 0, -1],
  ] as const;
  const scan = (
    row: number,
    startSlope: number,
    endSlope: number,
    xx: number,
    xy: number,
    yx: number,
    yy: number,
  ) => {
    if (startSlope < endSlope) return;
    const maxRadius = radius * 2;
    let nextStart = startSlope;
    for (let distance = row; distance <= maxRadius; distance += 1) {
      let blocked = false;
      const dy = -distance;
      for (let dx = -distance; dx <= 0; dx += 1) {
        const leftSlope = (dx - 0.5) / (dy + 0.5);
        const rightSlope = (dx + 0.5) / (dy - 0.5);
        if (startSlope < rightSlope) continue;
        if (endSlope > leftSlope) break;
        const x = sourceX + dx * xx + dy * xy;
        const y = sourceY + dx * yx + dy * yy;
        if (dx * dx + dy * dy <= maxRadius * maxRadius) mark(x, y);
        const cellOpaque = opaque(x, y);
        if (blocked) {
          if (cellOpaque) nextStart = rightSlope;
          else {
            blocked = false;
            startSlope = nextStart;
          }
        } else if (cellOpaque && distance < maxRadius) {
          blocked = true;
          scan(distance + 1, startSlope, leftSlope, xx, xy, yx, yy);
          nextStart = rightSlope;
        }
      }
      if (blocked) break;
    }
  };
  transforms.forEach(([xx, xy, yx, yy]) =>
    scan(1, 1, 0, xx, xy, yx, yy),
  );

  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[0].length; x += 1) {
      let mask = 0;
      for (let quarter = 0; quarter < 4; quarter += 1) {
        const sx = x * 2 + (quarter % 2);
        const sy = y * 2 + Math.floor(quarter / 2);
        if (visible[sy * subWidth + sx]) mask |= 1 << quarter;
      }
      if (revealAll) mask = 15;
      if (mask) {
        tiles[y][x].visibleMask =
          (tiles[y][x].visibleMask ?? 0) | mask;
        tiles[y][x].visible = true;
        tiles[y][x].discoveredMask =
          (tiles[y][x].discoveredMask ?? 0) | mask;
        tiles[y][x].discovered = true;
      }
      if (revealAll) {
        tiles[y][x].discoveredMask = 15;
        tiles[y][x].discovered = true;
      }
    }
  }
}

export function findPath(
  tiles: Tile[][],
  start: Point,
  target: Point,
  blocked: Set<string> = new Set(),
  canUnlock = false,
  canFly = false,
) {
  if (!inside(tiles, target.x, target.y)) return [] as Point[];
  const targetKey = pointKey(target);
  const startKey = pointKey(start);
  const queue: Point[] = [start];
  const previous = new Map<string, string | null>([[startKey, null]]);

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (pointKey(point) === targetKey) break;
    for (const direction of EIGHT_WAY) {
      const next = { x: point.x + direction.x, y: point.y + direction.y };
      const key = pointKey(next);
      if (
        !inside(tiles, next.x, next.y) ||
        previous.has(key) ||
        (blocked.has(key) && key !== targetKey) ||
        !(isWalkable(tiles[next.y][next.x].terrain, canUnlock) ||
          (canFly && tiles[next.y][next.x].terrain === "chasm"))
      ) {
        continue;
      }
      previous.set(key, pointKey(point));
      queue.push(next);
    }
  }

  if (!previous.has(targetKey)) return [] as Point[];
  const path: Point[] = [];
  let cursor: string | null = targetKey;
  while (cursor && cursor !== startKey) {
    const [x, y] = cursor.split(",").map(Number);
    path.push({ x, y });
    cursor = previous.get(cursor) ?? null;
  }
  return path.reverse();
}

export const mapPointKey = pointKey;
