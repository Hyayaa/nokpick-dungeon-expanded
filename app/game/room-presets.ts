import type { Point, Terrain, Tile } from "./types";

export type P0RoomPreset =
  | "chasmBridge"
  | "chasmRoom"
  | "platform"
  | "circlePit"
  | "cavesFissure";

export const P0_ROOM_PRESETS: readonly P0RoomPreset[] = [
  "chasmBridge",
  "chasmRoom",
  "platform",
  "circlePit",
  "cavesFissure",
];

export type PresetRoom = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: Point;
  preset: P0RoomPreset;
  roomValue: 1 | 2 | 3;
};

export type PresetRandom = {
  next(): number;
  int(min: number, max: number): number;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const CARDINALS: Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

const pointKey = (point: Point) => `${point.x},${point.y}`;

export const isP0RoomPreset = (preset: string): preset is P0RoomPreset =>
  (P0_ROOM_PRESETS as readonly string[]).includes(preset);

const insideInterior = (room: PresetRoom, point: Point) =>
  point.x > room.left &&
  point.x < room.right &&
  point.y > room.top &&
  point.y < room.bottom;

const roomInterior = (room: PresetRoom) => {
  const points: Point[] = [];
  for (let y = room.top + 1; y < room.bottom; y += 1) {
    for (let x = room.left + 1; x < room.right; x += 1) {
      points.push({ x, y });
    }
  }
  return points;
};

const fillInterior = (
  tiles: Tile[][],
  room: PresetRoom,
  terrain: Terrain,
) => {
  roomInterior(room).forEach(({ x, y }) => {
    tiles[y][x].terrain = terrain;
  });
};

const fillRect = (tiles: Tile[][], rect: Rect, terrain: Terrain) => {
  for (let y = rect.top; y <= rect.bottom; y += 1) {
    for (let x = rect.left; x <= rect.right; x += 1) {
      tiles[y][x].terrain = terrain;
    }
  }
};

const doorApproach = (
  room: PresetRoom,
  door: Point,
  distance = 1,
): Point => {
  if (door.x === room.left) return { x: door.x + distance, y: door.y };
  if (door.x === room.right) return { x: door.x - distance, y: door.y };
  if (door.y === room.top) return { x: door.x, y: door.y + distance };
  return { x: door.x, y: door.y - distance };
};

const carveRoute = (
  tiles: Tile[][],
  room: PresetRoom,
  door: Point,
  target: Point,
  terrainFor: (current: Terrain) => Terrain,
) => {
  const cursor = doorApproach(room, door);
  const carve = () => {
    if (insideInterior(room, cursor)) {
      tiles[cursor.y][cursor.x].terrain = terrainFor(
        tiles[cursor.y][cursor.x].terrain,
      );
    }
  };
  const moveX = () => {
    while (cursor.x !== target.x) {
      cursor.x += Math.sign(target.x - cursor.x);
      carve();
    }
  };
  const moveY = () => {
    while (cursor.y !== target.y) {
      cursor.y += Math.sign(target.y - cursor.y);
      carve();
    }
  };

  carve();
  if (door.x === room.left || door.x === room.right) {
    moveX();
    moveY();
  } else {
    moveY();
    moveX();
  }
};

const protectDoorApproaches = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  terrain: Terrain,
) => {
  doors.forEach((door) => {
    for (let distance = 1; distance <= 2; distance += 1) {
      const point = doorApproach(room, door, distance);
      if (insideInterior(room, point)) tiles[point.y][point.x].terrain = terrain;
    }
  });
};

const isRoomWalkable = (terrain: Terrain) =>
  terrain !== "wall" && terrain !== "chasm";

const roomWalkableConnected = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
) => {
  const walkable = roomInterior(room).filter(({ x, y }) =>
    isRoomWalkable(tiles[y][x].terrain),
  );
  if (!walkable.length) return false;
  const start = doors.length ? doorApproach(room, doors[0]) : walkable[0];
  if (!insideInterior(room, start) || !isRoomWalkable(tiles[start.y][start.x].terrain)) {
    return false;
  }
  const reached = new Set<string>([pointKey(start)]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    CARDINALS.forEach(({ x: dx, y: dy }) => {
      const next = { x: point.x + dx, y: point.y + dy };
      const key = pointKey(next);
      if (
        reached.has(key) ||
        !insideInterior(room, next) ||
        !isRoomWalkable(tiles[next.y][next.x].terrain)
      ) {
        return;
      }
      reached.add(key);
      queue.push(next);
    });
  }
  return (
    walkable.every((point) => reached.has(pointKey(point))) &&
    doors.every((door) => reached.has(pointKey(doorApproach(room, door))))
  );
};

// Matches PatchRoom.cleanDiagonalEdges: remove diagonal-only chasm joins so
// the game's cardinal room-connectivity check and visual edges agree.
const cleanChasmDiagonals = (tiles: Tile[][], room: PresetRoom) => {
  for (let y = room.top + 1; y < room.bottom - 1; y += 1) {
    for (let x = room.left + 1; x < room.right - 1; x += 1) {
      const cells = [
        { x, y },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ];
      const chasm = cells.map((point) => tiles[point.y][point.x].terrain === "chasm");
      if (chasm[0] && chasm[3] && !chasm[1] && !chasm[2]) {
        tiles[cells[3].y][cells[3].x].terrain = "floor";
      } else if (chasm[1] && chasm[2] && !chasm[0] && !chasm[3]) {
        tiles[cells[2].y][cells[2].x].terrain = "floor";
      }
    }
  }
};

const generatePatch = (
  width: number,
  height: number,
  fill: number,
  clustering: number,
  random: PresetRandom,
) => {
  let source = Array.from(
    { length: width * height },
    () => random.next() < fill + (0.5 - fill) * 0.5,
  );
  let target = [...source];
  for (let pass = 0; pass < clustering; pass += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let filled = 0;
        let neighbours = 0;
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
            neighbours += 1;
            if (source[ny * width + nx]) filled += 1;
          }
        }
        target[y * width + x] = filled * 2 >= neighbours;
      }
    }
    [source, target] = [target, source];
  }
  return source;
};

// Kept terrain-agnostic so WaterBridgeRoom can reuse the same segmentation
// without introducing a broader room framework.
const paintBridgeRoom = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
  spaceTerrain: Terrain,
  bridgeTerrain: Terrain,
) => {
  fillInterior(tiles, room, "floor");
  const horizontalDoors = doors.filter(
    (door) => door.x === room.left || door.x === room.right,
  ).length;
  const verticalDoors = doors.length - horizontalDoors;
  const score =
    horizontalDoors -
    verticalDoors +
    Math.trunc(((room.right - room.left) - (room.bottom - room.top)) / 2);
  const horizontalTravel = score > 0 || (score === 0 && random.next() < 0.5);
  const roomDimension = horizontalTravel
    ? room.right - room.left + 1
    : room.bottom - room.top + 1;
  const gapWidth = roomDimension >= 7 ? 2 : 1;

  let anchor: Point;
  if (horizontalTravel) {
    const firstX = room.center.x - Math.floor((gapWidth - 1) / 2);
    fillRect(
      tiles,
      {
        left: firstX,
        right: firstX + gapWidth - 1,
        top: room.top + 1,
        bottom: room.bottom - 1,
      },
      spaceTerrain,
    );
    const bridgeY = Math.max(
      room.top + 2,
      Math.min(room.bottom - 2, room.center.y + random.int(-1, 1)),
    );
    fillRect(
      tiles,
      { left: firstX, right: firstX + gapWidth - 1, top: bridgeY, bottom: bridgeY },
      bridgeTerrain,
    );
    anchor = { x: firstX, y: bridgeY };
  } else {
    const firstY = room.center.y - Math.floor((gapWidth - 1) / 2);
    fillRect(
      tiles,
      {
        left: room.left + 1,
        right: room.right - 1,
        top: firstY,
        bottom: firstY + gapWidth - 1,
      },
      spaceTerrain,
    );
    const bridgeX = Math.max(
      room.left + 2,
      Math.min(room.right - 2, room.center.x + random.int(-1, 1)),
    );
    fillRect(
      tiles,
      { left: bridgeX, right: bridgeX, top: firstY, bottom: firstY + gapWidth - 1 },
      bridgeTerrain,
    );
    anchor = { x: bridgeX, y: firstY };
  }

  doors.forEach((door) =>
    carveRoute(tiles, room, door, anchor, (terrain) =>
      terrain === spaceTerrain ? bridgeTerrain : "floor",
    ),
  );
  protectDoorApproaches(tiles, room, doors, "floor");
};

const paintChasmBridge = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
) => paintBridgeRoom(tiles, room, doors, random, "chasm", "specialFloor");

const paintChasmRoom = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
) => {
  const width = room.right - room.left - 1;
  const height = room.bottom - room.top - 1;
  const area = (room.right - room.left + 1) * (room.bottom - room.top + 1);
  const protectedCells = new Set<string>();
  doors.forEach((door) => {
    protectedCells.add(pointKey(doorApproach(room, door, 1)));
    protectedCells.add(pointKey(doorApproach(room, door, 2)));
  });

  for (let attempt = 0; attempt < 48; attempt += 1) {
    fillInterior(tiles, room, "floor");
    const fill = Math.max(0.26, 0.3 + Math.min(area, 18 * 18) / 1024 - attempt * 0.002);
    const patch = generatePatch(width, height, fill, 1, random);
    let chasmCount = 0;
    roomInterior(room).forEach((point) => {
      const local = point.x - room.left - 1 + (point.y - room.top - 1) * width;
      if (patch[local] && !protectedCells.has(pointKey(point))) {
        tiles[point.y][point.x].terrain = "chasm";
        chasmCount += 1;
      }
    });
    cleanChasmDiagonals(tiles, room);
    protectDoorApproaches(tiles, room, doors, "floor");
    if (chasmCount >= 3 && roomWalkableConnected(tiles, room, doors)) return;
  }

  fillInterior(tiles, room, "floor");
  const fallback = roomInterior(room).filter(
    (point) =>
      Math.abs(point.x - room.center.x) <= 1 &&
      Math.abs(point.y - room.center.y) <= 1 &&
      !protectedCells.has(pointKey(point)),
  );
  fallback.forEach(({ x, y }) => {
    tiles[y][x].terrain = "chasm";
  });
};

const splitPlatforms = (
  rect: Rect,
  output: Rect[],
  random: PresetRandom,
) => {
  const width = rect.right - rect.left + 1;
  const height = rect.bottom - rect.top + 1;
  const area = width * height;
  const splitChance = Math.max(0, Math.min(1, (area - 25) / 11));
  const verticalSplit = width > height || (width === height && random.next() < 0.5);

  if (random.next() < splitChance && (verticalSplit ? width >= 5 : height >= 5)) {
    if (verticalSplit) {
      const splitX = random.int(rect.left + 2, rect.right - 2);
      splitPlatforms({ ...rect, right: splitX - 1 }, output, random);
      splitPlatforms({ ...rect, left: splitX + 1 }, output, random);
      const bridgeY = Math.floor(
        (random.int(rect.top, rect.bottom) + random.int(rect.top, rect.bottom)) / 2,
      );
      output.push({ left: splitX - 1, right: splitX + 1, top: bridgeY, bottom: bridgeY });
    } else {
      const splitY = random.int(rect.top + 2, rect.bottom - 2);
      splitPlatforms({ ...rect, bottom: splitY - 1 }, output, random);
      splitPlatforms({ ...rect, top: splitY + 1 }, output, random);
      const bridgeX = Math.floor(
        (random.int(rect.left, rect.right) + random.int(rect.left, rect.right)) / 2,
      );
      output.push({ left: bridgeX, right: bridgeX, top: splitY - 1, bottom: splitY + 1 });
    }
    return;
  }
  output.push(rect);
};

const paintPlatformRoom = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
) => {
  fillInterior(tiles, room, "chasm");
  const root = {
    left: room.left + 2,
    top: room.top + 2,
    right: room.right - 2,
    bottom: room.bottom - 2,
  };
  const platforms: Rect[] = [];
  splitPlatforms(root, platforms, random);
  platforms.forEach((platform) => fillRect(tiles, platform, "specialFloor"));

  doors.forEach((door) => {
    const approach = doorApproach(room, door);
    const target = {
      x: Math.max(root.left, Math.min(root.right, approach.x)),
      y: Math.max(root.top, Math.min(root.bottom, approach.y)),
    };
    carveRoute(tiles, room, door, target, () => "specialFloor");
  });
  protectDoorApproaches(tiles, room, doors, "specialFloor");
};

const paintCirclePit = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
) => {
  const radiusX = Math.max(2, (room.right - room.left - 1) / 2);
  const radiusY = Math.max(2, (room.bottom - room.top - 1) / 2);
  const pitRadiusX = Math.max(1.25, radiusX - 2.25);
  const pitRadiusY = Math.max(1.25, radiusY - 2.25);
  roomInterior(room).forEach((point) => {
    const dx = point.x - room.center.x;
    const dy = point.y - room.center.y;
    const outer = (dx * dx) / (radiusX * radiusX) + (dy * dy) / (radiusY * radiusY);
    const pit =
      (dx * dx) / (pitRadiusX * pitRadiusX) +
      (dy * dy) / (pitRadiusY * pitRadiusY);
    tiles[point.y][point.x].terrain = outer > 1.05 ? "wall" : pit <= 1 ? "chasm" : "floor";
  });

  doors.forEach((door) => {
    for (let distance = 1; distance < Math.max(radiusX, radiusY); distance += 1) {
      const point = doorApproach(room, door, distance);
      if (!insideInterior(room, point)) break;
      const current = tiles[point.y][point.x].terrain;
      if (current === "chasm") break;
      tiles[point.y][point.x].terrain = "floor";
      if (current === "floor") break;
    }
  });
  cleanChasmDiagonals(tiles, room);
  protectDoorApproaches(tiles, room, doors, "floor");
};

const angleDistance = (first: number, second: number) => {
  const distance = Math.abs(first - second) % (Math.PI * 2);
  return Math.min(distance, Math.PI * 2 - distance);
};

const fissureLine = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  angle: number,
) => {
  let dx = Math.cos(angle);
  let dy = Math.sin(angle);
  const scale = Math.max(Math.abs(dx), Math.abs(dy));
  dx /= scale;
  dy /= scale;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const cells: Point[] = [];
  let x = room.center.x + 0.5;
  let y = room.center.y + 0.5;
  const maximum = Math.max(room.right - room.left, room.bottom - room.top) * 2;
  for (let step = 0; step < maximum; step += 1) {
    const point = { x: Math.floor(x), y: Math.floor(y) };
    if (!insideInterior(room, point)) break;
    cells.push(point);
    const perpendicular = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
    const offsets = room.roomValue === 3 ? [-1, 0, 1] : [0, step % 2 === 0 ? -1 : 1];
    offsets.forEach((offset) => {
      const candidate = {
        x: point.x + perpendicular.x * offset,
        y: point.y + perpendicular.y * offset,
      };
      const nearDoor = doors.some(
        (door) => {
          const approach = doorApproach(room, door);
          return Math.max(Math.abs(candidate.x - approach.x), Math.abs(candidate.y - approach.y)) <= 2;
        },
      );
      if (insideInterior(room, candidate) && !nearDoor) {
        tiles[candidate.y][candidate.x].terrain = "chasm";
      }
    });
    x += dx;
    y += dy;
  }
  return { cells, horizontal };
};

const bridgeFissure = (
  tiles: Tile[][],
  room: PresetRoom,
  line: ReturnType<typeof fissureLine>,
  random: PresetRandom,
) => {
  if (!line.cells.length) return;
  const minimum = Math.min(line.cells.length - 1, Math.max(1, Math.floor(line.cells.length * 0.4)));
  const maximum = Math.max(minimum, Math.min(line.cells.length - 1, Math.floor(line.cells.length * 0.8)));
  const pivot = line.cells[random.int(minimum, maximum)];
  if (line.horizontal) {
    let top = pivot.y;
    let bottom = pivot.y;
    while (top - 1 > room.top && tiles[top - 1][pivot.x].terrain === "chasm") top -= 1;
    while (bottom + 1 < room.bottom && tiles[bottom + 1][pivot.x].terrain === "chasm") bottom += 1;
    for (let y = top; y <= bottom; y += 1) tiles[y][pivot.x].terrain = "specialFloor";
  } else {
    let left = pivot.x;
    let right = pivot.x;
    while (left - 1 > room.left && tiles[pivot.y][left - 1].terrain === "chasm") left -= 1;
    while (right + 1 < room.right && tiles[pivot.y][right + 1].terrain === "chasm") right += 1;
    for (let x = left; x <= right; x += 1) tiles[pivot.y][x].terrain = "specialFloor";
  }
};

const paintCavesFissure = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
) => {
  const centerAngle = (point: Point) =>
    Math.atan2(point.y + 0.5 - (room.center.y + 0.5), point.x + 0.5 - (room.center.x + 0.5));
  const doorAngles = doors.map(centerAngle);
  const lineCount = 1 + room.roomValue;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    fillInterior(tiles, room, "floor");
    const angles: number[] = [];
    for (let index = 0; index < lineCount; index += 1) {
      for (let tries = 0; tries < 100; tries += 1) {
        const angle = random.next() * Math.PI * 2;
        const doorClearance = room.roomValue === 1 ? Math.PI / 6 : Math.PI / 12;
        const lineClearance = lineCount === 2 ? (Math.PI * 2) / 3 : Math.PI / 3;
        if (
          doorAngles.every((doorAngle) => angleDistance(angle, doorAngle) > doorClearance) &&
          angles.every((existing) => angleDistance(angle, existing) > lineClearance)
        ) {
          angles.push(angle);
          break;
        }
      }
    }
    if (angles.length < 2) continue;

    const lines = angles.map((angle) => fissureLine(tiles, room, doors, angle));
    if (angles.length >= 3) {
      const radius = room.roomValue === 3 ? 2 : 1;
      for (let y = room.center.y - radius; y <= room.center.y + radius; y += 1) {
        for (let x = room.center.x - radius; x <= room.center.x + radius; x += 1) {
          if (insideInterior(room, { x, y })) tiles[y][x].terrain = "chasm";
        }
      }
    }
    if (lines.length === 2) {
      bridgeFissure(tiles, room, lines[random.int(0, lines.length - 1)], random);
    } else {
      lines.forEach((line) => bridgeFissure(tiles, room, line, random));
    }
    protectDoorApproaches(tiles, room, doors, "floor");
    cleanChasmDiagonals(tiles, room);
    if (roomWalkableConnected(tiles, room, doors)) return;
  }

  paintChasmBridge(tiles, room, doors, random);
};

export const paintP0Room = (
  tiles: Tile[][],
  room: PresetRoom,
  doors: readonly Point[],
  random: PresetRandom,
) => {
  if (room.preset === "chasmBridge") {
    paintChasmBridge(tiles, room, doors, random);
  } else if (room.preset === "chasmRoom") {
    paintChasmRoom(tiles, room, doors, random);
  } else if (room.preset === "platform") {
    paintPlatformRoom(tiles, room, doors, random);
  } else if (room.preset === "circlePit") {
    paintCirclePit(tiles, room, doors);
  } else {
    paintCavesFissure(tiles, room, doors, random);
  }
};
