import type {
  DungeonObjectKind,
  DungeonSpecialRoom,
  DungeonTrap,
  GuaranteedFloorSpawn,
  ItemCategory,
  Point,
  SpecialRoomKind,
  Terrain,
  Tile,
} from "./types";

export type SpecialRoomPreset = SpecialRoomKind;
export type SpecialRoomCompatibilityGroup =
  | "potion-solution"
  | "crystal-key";

export const MAGICAL_FIRE_CONFIG = Object.freeze({
  power: 4,
  burningTurns: 12,
});

export type SpecialRoomMetadata = {
  preset: SpecialRoomPreset;
  compatibilityGroup: SpecialRoomCompatibilityGroup;
  requiredItemId: string;
  weight: number;
  minimumSize: number;
};

export const SPECIAL_ROOM_REGISTRY: readonly SpecialRoomMetadata[] = [
  { preset: "storage", compatibilityGroup: "potion-solution", requiredItemId: "potion_liquid_flame", weight: 3, minimumSize: 7 },
  { preset: "magicalFire", compatibilityGroup: "potion-solution", requiredItemId: "potion_frost", weight: 3, minimumSize: 7 },
  { preset: "toxicGas", compatibilityGroup: "potion-solution", requiredItemId: "potion_purity", weight: 2, minimumSize: 7 },
  { preset: "traps", compatibilityGroup: "potion-solution", requiredItemId: "potion_levitation", weight: 3, minimumSize: 7 },
  { preset: "crystalChoice", compatibilityGroup: "crystal-key", requiredItemId: "crystal_key", weight: 2, minimumSize: 9 },
  { preset: "crystalPath", compatibilityGroup: "crystal-key", requiredItemId: "crystal_key", weight: 1, minimumSize: 11 },
] as const;

export const P0_SPECIAL_ROOM_PRESETS = SPECIAL_ROOM_REGISTRY.map(
  ({ preset }) => preset,
);

const SPECIAL_ROOM_PRESET_SET = new Set<string>(P0_SPECIAL_ROOM_PRESETS);

export const isSpecialRoomPreset = (
  preset: string,
): preset is SpecialRoomPreset => SPECIAL_ROOM_PRESET_SET.has(preset);

export const specialRoomMetadata = (preset: SpecialRoomPreset) =>
  SPECIAL_ROOM_REGISTRY.find((entry) => entry.preset === preset)!;

export type SpecialRoomRandom = {
  next(): number;
  int(min: number, max: number): number;
};

export type SpecialRoomPaintArea = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: Point;
  preset: SpecialRoomPreset;
};

export type SpecialRewardSlot = {
  id: string;
  point: Point;
  source: "ground" | "object";
  categories: ItemCategory[];
  tier: 1 | 2 | 3;
  objectKind?: Exclude<DungeonObjectKind, "alchemy">;
};

export type SpecialRoomPaintResult = {
  room: DungeonSpecialRoom;
  requiredFloorSpawns: GuaranteedFloorSpawn[];
  traps: DungeonTrap[];
  rewards: SpecialRewardSlot[];
  toxicGasTiles: Point[];
  magicalFireTiles: Point[];
};

const pointKey = ({ x, y }: Point) => `${x},${y}`;

const roomInterior = (room: SpecialRoomPaintArea) => {
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
  room: SpecialRoomPaintArea,
  terrain: Terrain,
) => {
  roomInterior(room).forEach(({ x, y }) => {
    tiles[y][x].terrain = terrain;
  });
};

const setRect = (
  tiles: Tile[][],
  left: number,
  top: number,
  right: number,
  bottom: number,
  terrain: Terrain,
) => {
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      tiles[y][x].terrain = terrain;
    }
  }
};

const shuffled = <T>(values: readonly T[], random: SpecialRoomRandom) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = random.int(0, index);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
};

const entranceApproach = (
  room: SpecialRoomPaintArea,
  entrance: Point,
  distance = 1,
): Point => {
  if (entrance.x === room.left) return { x: entrance.x + distance, y: entrance.y };
  if (entrance.x === room.right) return { x: entrance.x - distance, y: entrance.y };
  if (entrance.y === room.top) return { x: entrance.x, y: entrance.y + distance };
  return { x: entrance.x, y: entrance.y - distance };
};

const farSide = (room: SpecialRoomPaintArea, entrance: Point) => {
  if (entrance.x === room.left) return "right" as const;
  if (entrance.x === room.right) return "left" as const;
  if (entrance.y === room.top) return "bottom" as const;
  return "top" as const;
};

const reward = (
  room: SpecialRoomPaintArea,
  index: number,
  point: Point,
  categories: ItemCategory[],
  tier: 1 | 2 | 3,
  source: "ground" | "object" = "ground",
  objectKind?: Exclude<DungeonObjectKind, "alchemy">,
): SpecialRewardSlot => ({
  id: `${room.id}-reward-${index}`,
  point,
  categories,
  tier,
  source,
  objectKind,
});

const baseResult = (
  room: SpecialRoomPaintArea,
  requiredCount = 1,
): SpecialRoomPaintResult => {
  const metadata = specialRoomMetadata(room.preset);
  return {
    room: {
      id: room.id,
      kind: room.preset,
      left: room.left,
      top: room.top,
      right: room.right,
      bottom: room.bottom,
      requiredItemId: metadata.requiredItemId,
    },
    requiredFloorSpawns: Array.from({ length: requiredCount }, (_, index) => ({
      id: `${room.id}-required-${index}`,
      defId: metadata.requiredItemId,
      roomKind: room.preset,
    })),
    traps: [],
    rewards: [],
    toxicGasTiles: [],
    magicalFireTiles: [],
  };
};

const paintStorage = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
  random: SpecialRoomRandom,
) => {
  const result = baseResult(room);
  fillInterior(tiles, room, "specialFloor");
  tiles[entrance.y][entrance.x].terrain = "barricade";
  const approach = entranceApproach(room, entrance);
  const points = shuffled(
    roomInterior(room).filter(
      (point) =>
        Math.max(Math.abs(point.x - approach.x), Math.abs(point.y - approach.y)) > 1,
    ),
    random,
  );
  result.rewards = points.slice(0, 4).map((point, index) =>
    reward(room, index, point, ["potion", "scroll", "food", "weapon", "armor"], index === 0 ? 2 : 1),
  );
  return result;
};

const paintMagicalFire = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
  random: SpecialRoomRandom,
) => {
  const result = baseResult(room);
  fillInterior(tiles, room, "floor");
  const side = farSide(room, entrance);
  const rewardPoints: Point[] = [];
  if (side === "left" || side === "right") {
    const fireX = room.center.x;
    for (let y = room.top + 1; y < room.bottom; y += 1) {
      result.magicalFireTiles.push({ x: fireX, y });
    }
    const left = side === "right" ? fireX + 1 : room.left + 1;
    const right = side === "right" ? room.right - 1 : fireX - 1;
    setRect(tiles, left, room.top + 1, right, room.bottom - 1, "specialFloor");
    for (let y = room.top + 1; y < room.bottom; y += 1) {
      for (let x = left; x <= right; x += 1) rewardPoints.push({ x, y });
    }
  } else {
    const fireY = room.center.y;
    for (let x = room.left + 1; x < room.right; x += 1) {
      result.magicalFireTiles.push({ x, y: fireY });
    }
    const top = side === "bottom" ? fireY + 1 : room.top + 1;
    const bottom = side === "bottom" ? room.bottom - 1 : fireY - 1;
    setRect(tiles, room.left + 1, top, room.right - 1, bottom, "specialFloor");
    for (let y = top; y <= bottom; y += 1) {
      for (let x = room.left + 1; x < room.right; x += 1) rewardPoints.push({ x, y });
    }
  }
  result.rewards = shuffled(rewardPoints, random)
    .slice(0, 4)
    .map((point, index) =>
      reward(room, index, point, ["potion", "scroll", "food", "wand"], index === 0 ? 2 : 1),
    );
  return result;
};

const paintToxicGas = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
  random: SpecialRoomRandom,
) => {
  const result = baseResult(room);
  fillInterior(tiles, room, "floor");
  const approach = entranceApproach(room, entrance);
  const candidates = shuffled(
    roomInterior(room).filter(
      (point) =>
        Math.max(Math.abs(point.x - approach.x), Math.abs(point.y - approach.y)) > 2,
    ),
    random,
  );
  const ventCount = Math.max(2, Math.min(5, Math.min(room.right - room.left, room.bottom - room.top) - 2));
  result.traps = candidates.slice(0, ventCount).map((point, index) => ({
    id: `${room.id}-vent-${index}`,
    kind: "toxicVent",
    active: false,
    hidden: false,
    revealed: true,
    triggered: false,
    ...point,
  }));
  result.toxicGasTiles = roomInterior(room).filter(
    (point) => !result.traps.some((trap) => pointKey(trap) === pointKey(point)),
  );
  result.rewards = candidates.slice(ventCount, ventCount + 3).map((point, index) =>
    reward(room, index, point, index === 0 ? ["ring", "wand", "artifact"] : ["potion", "scroll", "misc"], index === 0 ? 2 : 1, "object", index === 0 ? "crystalChest" : "chest"),
  );
  return result;
};

const trapKindsByRegion = [
  ["gripping", "teleportation"],
  ["poisonDart", "gripping", "explosive"],
  ["poisonDart", "flashing", "explosive"],
] as const;

const paintTraps = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
  random: SpecialRoomRandom,
  floor: number,
) => {
  const result = baseResult(room);
  const chasmVariant = random.int(0, 3) === 0;
  fillInterior(tiles, room, chasmVariant ? "chasm" : "floor");
  const approach = entranceApproach(room, entrance);
  tiles[approach.y][approach.x].terrain = "floor";
  const side = farSide(room, entrance);
  const rewardPoint =
    side === "right" ? { x: room.right - 1, y: room.center.y } :
    side === "left" ? { x: room.left + 1, y: room.center.y } :
    side === "bottom" ? { x: room.center.x, y: room.bottom - 1 } :
    { x: room.center.x, y: room.top + 1 };
  if (side === "right" || side === "left") {
    const x = rewardPoint.x;
    for (let y = room.top + 1; y < room.bottom; y += 1) {
      tiles[y][x].terrain = chasmVariant ? "specialFloor" : "floor";
    }
  } else {
    const y = rewardPoint.y;
    for (let x = room.left + 1; x < room.right; x += 1) {
      tiles[y][x].terrain = chasmVariant ? "specialFloor" : "floor";
    }
  }
  if (!chasmVariant) {
    const region = Math.min(trapKindsByRegion.length - 1, Math.floor(Math.max(1, floor) / 3));
    const kinds = trapKindsByRegion[region];
    result.traps = roomInterior(room)
      .filter(
        (point) =>
          pointKey(point) !== pointKey(approach) &&
          tiles[point.y][point.x].terrain === "floor" &&
          (side === "right" || side === "left" ? point.x !== rewardPoint.x : point.y !== rewardPoint.y),
      )
      .map((point, index) => ({
        id: `${room.id}-trap-${index}`,
        kind: kinds[random.int(0, kinds.length - 1)],
        active: true,
        hidden: false,
        revealed: true,
        triggered: false,
        ...point,
      }));
  }
  result.rewards = [
    reward(room, 0, rewardPoint, ["weapon", "armor", "wand", "ring"], 3, "object", "crystalChest"),
  ];
  return result;
};

const paintCrystalChoice = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
) => {
  const result = baseResult(room);
  fillInterior(tiles, room, "wall");
  const side = farSide(room, entrance);
  const rewards: SpecialRewardSlot[] = [];
  if (side === "right" || side === "left") {
    const entryLeft = side === "right" ? room.left + 1 : room.right - 2;
    const entryRight = side === "right" ? room.left + 2 : room.right - 1;
    setRect(tiles, entryLeft, room.top + 1, entryRight, room.bottom - 1, "floor");
    const doorX = side === "right" ? entryRight + 1 : entryLeft - 1;
    const chamberLeft = side === "right" ? doorX + 1 : room.left + 1;
    const chamberRight = side === "right" ? room.right - 1 : doorX - 1;
    const split = room.center.y;
    setRect(tiles, chamberLeft, room.top + 1, chamberRight, split - 1, "specialFloor");
    setRect(tiles, chamberLeft, split + 1, chamberRight, room.bottom - 1, "specialFloor");
    const doors = [{ x: doorX, y: Math.floor((room.top + 1 + split - 1) / 2) }, { x: doorX, y: Math.ceil((split + 1 + room.bottom - 1) / 2) }];
    doors.forEach(({ x, y }) => { tiles[y][x].terrain = "crystalDoor"; });
    const consumablePoint = { x: Math.floor((chamberLeft + chamberRight) / 2), y: Math.floor((room.top + split) / 2) };
    const rarePoint = { x: Math.floor((chamberLeft + chamberRight) / 2), y: Math.ceil((split + room.bottom) / 2) };
    rewards.push(
      reward(room, 0, consumablePoint, ["potion", "scroll"], 2, "object", "chest"),
      reward(room, 1, rarePoint, ["wand", "ring", "artifact", "weapon", "armor"], 3, "object", "crystalChest"),
    );
  } else {
    const entryTop = side === "bottom" ? room.top + 1 : room.bottom - 2;
    const entryBottom = side === "bottom" ? room.top + 2 : room.bottom - 1;
    setRect(tiles, room.left + 1, entryTop, room.right - 1, entryBottom, "floor");
    const doorY = side === "bottom" ? entryBottom + 1 : entryTop - 1;
    const chamberTop = side === "bottom" ? doorY + 1 : room.top + 1;
    const chamberBottom = side === "bottom" ? room.bottom - 1 : doorY - 1;
    const split = room.center.x;
    setRect(tiles, room.left + 1, chamberTop, split - 1, chamberBottom, "specialFloor");
    setRect(tiles, split + 1, chamberTop, room.right - 1, chamberBottom, "specialFloor");
    const doors = [{ x: Math.floor((room.left + 1 + split - 1) / 2), y: doorY }, { x: Math.ceil((split + 1 + room.right - 1) / 2), y: doorY }];
    doors.forEach(({ x, y }) => { tiles[y][x].terrain = "crystalDoor"; });
    rewards.push(
      reward(room, 0, { x: Math.floor((room.left + split) / 2), y: Math.floor((chamberTop + chamberBottom) / 2) }, ["potion", "scroll"], 2, "object", "chest"),
      reward(room, 1, { x: Math.ceil((split + room.right) / 2), y: Math.floor((chamberTop + chamberBottom) / 2) }, ["wand", "ring", "artifact", "weapon", "armor"], 3, "object", "crystalChest"),
    );
  }
  result.rewards = rewards;
  return result;
};

const paintCrystalPath = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  entrance: Point,
) => {
  const result = baseResult(room, 3);
  fillInterior(tiles, room, "wall");
  const horizontal = entrance.x === room.left || entrance.x === room.right;
  const forwardSign = entrance.x === room.left || entrance.y === room.top ? 1 : -1;
  for (let step = 1; step < (horizontal ? room.right - room.left : room.bottom - room.top); step += 1) {
    const point = horizontal
      ? { x: entrance.x + forwardSign * step, y: room.center.y }
      : { x: room.center.x, y: entrance.y + forwardSign * step };
    if (point.x <= room.left || point.x >= room.right || point.y <= room.top || point.y >= room.bottom) break;
    tiles[point.y][point.x].terrain = "floor";
  }
  const length = horizontal ? room.right - room.left - 2 : room.bottom - room.top - 2;
  const depths = [Math.max(2, Math.floor(length * 0.25)), Math.max(4, Math.floor(length * 0.5)), Math.max(6, Math.floor(length * 0.75))];
  let rewardIndex = 0;
  depths.forEach((depth, stage) => {
    [-1, 1].forEach((side) => {
      const corridor = horizontal
        ? { x: entrance.x + forwardSign * depth, y: room.center.y }
        : { x: room.center.x, y: entrance.y + forwardSign * depth };
      const door = horizontal
        ? { x: corridor.x, y: corridor.y + side }
        : { x: corridor.x + side, y: corridor.y };
      const chamber = horizontal
        ? { x: corridor.x, y: corridor.y + side * 2 }
        : { x: corridor.x + side * 2, y: corridor.y };
      if (
        chamber.x <= room.left || chamber.x >= room.right ||
        chamber.y <= room.top || chamber.y >= room.bottom
      ) return;
      tiles[door.y][door.x].terrain = "crystalDoor";
      tiles[chamber.y][chamber.x].terrain = "specialFloor";
      result.rewards.push(
        reward(
          room,
          rewardIndex,
          chamber,
          stage === 0 ? ["potion", "scroll", "food"] : stage === 1 ? ["potion", "scroll", "bomb", "brew"] : ["potion", "scroll", "wand", "artifact"],
          (stage + 1) as 1 | 2 | 3,
        ),
      );
      rewardIndex += 1;
    });
  });
  return result;
};

export const paintSpecialRoom = (
  tiles: Tile[][],
  room: SpecialRoomPaintArea,
  doors: readonly Point[],
  random: SpecialRoomRandom,
  floor: number,
): SpecialRoomPaintResult => {
  const entrance = doors[0] ?? { x: room.left, y: room.center.y };
  if (room.preset === "storage") return paintStorage(tiles, room, entrance, random);
  if (room.preset === "magicalFire") return paintMagicalFire(tiles, room, entrance, random);
  if (room.preset === "toxicGas") return paintToxicGas(tiles, room, entrance, random);
  if (room.preset === "traps") return paintTraps(tiles, room, entrance, random, floor);
  if (room.preset === "crystalChoice") return paintCrystalChoice(tiles, room, entrance);
  return paintCrystalPath(tiles, room, entrance);
};
