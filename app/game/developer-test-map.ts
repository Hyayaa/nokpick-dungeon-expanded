import { ENEMY_STATS, ITEM_DEFS } from "./data";
import {
  createEquipmentInstance,
  enchantEquipmentInstance,
  upgradeEquipmentInstance,
} from "./equipment";
import { updateFieldOfView } from "./map";
import { P0_ROOM_PRESETS, paintP0Room } from "./room-presets";
import {
  MAGICAL_FIRE_CONFIG,
  P0_SPECIAL_ROOM_PRESETS,
  paintSpecialRoom,
  type SpecialRewardSlot,
} from "./special-rooms";
import { cloneGame, cloneInventoryInstance } from "./state";
import type {
  DungeonCloud,
  DungeonObject,
  DungeonSpecialRoom,
  DungeonTrap,
  Enemy,
  EnemyKind,
  GameState,
  GroundItem,
  InventoryInstance,
  Point,
  Terrain,
  Tile,
} from "./types";

export const DEVELOPER_TEST_MAP_ID = "developer-showcase";
export const DEVELOPER_TEST_MAP_SEED = 0x5a0ca5e;

const WIDTH = 122;
const HEIGHT = 66;

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
  };
};

const tile = (x: number, y: number, terrain: Terrain = "wall"): Tile => ({
  terrain,
  discovered: false,
  visible: false,
  discoveredMask: 0,
  visibleMask: 0,
  variant: (x * 37 + y * 61) % 100,
});

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

type TestRoom = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  center: Point;
};

const room = (
  id: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
): TestRoom => ({
  id,
  left,
  top,
  right,
  bottom,
  center: {
    x: Math.floor((left + right) / 2),
    y: Math.floor((top + bottom) / 2),
  },
});

const frameRoom = (
  tiles: Tile[][],
  area: TestRoom,
  entrance: Point,
) => {
  setRect(tiles, area.left, area.top, area.right, area.bottom, "wall");
  setRect(
    tiles,
    area.left + 1,
    area.top + 1,
    area.right - 1,
    area.bottom - 1,
    "floor",
  );
  tiles[entrance.y][entrance.x].terrain = "door";
};

const enemy = (kind: EnemyKind, id: string, point: Point): Enemy => {
  const stats = ENEMY_STATS[kind];
  return {
    id,
    kind,
    ...point,
    hp: stats.hp,
    maxHp: stats.hp,
    attack: stats.attack,
    defense: stats.defense,
    accuracy: stats.accuracy,
    evasion: stats.evasion,
    xp: stats.xp,
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: true,
    wakeCooldown: 0,
    lastSeenPlayer: null,
    searchTurns: 0,
    statuses: [],
    drop: null,
    goldDrop: 0,
  };
};

const rewardDefId = (slot: SpecialRewardSlot) => {
  const preferred = [
    ["weapon", "rusty_sword"],
    ["armor", "cloth_armor"],
    ["ring", "ring_accuracy"],
    ["wand", "wand_magic_missile"],
    ["potion", "potion_healing"],
    ["scroll", "scroll_upgrade"],
    ["stone", "stone_intuition"],
    ["food", "ration"],
  ] as const;
  return preferred.find(
    ([category, defId]) =>
      slot.categories.includes(category) && ITEM_DEFS[defId] !== undefined,
  )?.[1] ?? "ration";
};

const rewardInstance = (
  defId: string,
  id: string,
  random: ReturnType<typeof makeRandom>,
): InventoryInstance | undefined => {
  const definition = ITEM_DEFS[defId];
  if (!definition?.slot) return undefined;
  return createEquipmentInstance(definition, id, () => random.next(), {
    allowCurse: false,
    grade: "A",
  });
};

const addCloud = (
  clouds: DungeonCloud[],
  id: string,
  kind: DungeonCloud["kind"],
  points: Point[],
  turns: number,
  power: number,
  extras: Partial<Pick<DungeonCloud, "variant" | "roomId">> = {},
) => {
  clouds.push({
    id,
    kind,
    origin: { ...points[0] },
    tiles: points.map((point) => ({
      ...point,
      remaining: turns,
      intensity: 1,
    })),
    maxRadius: 0,
    spreadPerTurn: 0,
    tileLifetime: turns,
    turns,
    power,
    ...extras,
  });
};

export function createDeveloperTestMap(base: GameState): GameState {
  const next = cloneGame(base);
  const random = makeRandom(DEVELOPER_TEST_MAP_SEED);
  const tiles = Array.from({ length: HEIGHT }, (_, y) =>
    Array.from({ length: WIDTH }, (_, x) => tile(x, y)),
  );

  // Three safe gallery corridors keep every test area reachable without
  // crossing a trap, hazard, special-room barrier, or enemy enclosure.
  setRect(tiles, 1, 16, WIDTH - 2, 18, "floor");
  setRect(tiles, 1, 31, WIDTH - 2, 33, "floor");
  setRect(tiles, 1, 50, WIDTH - 2, 52, "floor");
  setRect(tiles, 1, 16, 3, HEIGHT - 2, "floor");

  const terrainRoom = room("showcase-terrain", 2, 2, 18, 15);
  frameRoom(tiles, terrainRoom, { x: terrainRoom.center.x, y: 15 });
  const terrainSamples: Array<[Point, Terrain]> = [
    [{ x: 4, y: 5 }, "floor"],
    [{ x: 5, y: 5 }, "specialFloor"],
    [{ x: 6, y: 5 }, "grass"],
    [{ x: 7, y: 5 }, "highGrass"],
    [{ x: 8, y: 5 }, "water"],
  ];
  terrainSamples.forEach(([point, terrain]) => {
    tiles[point.y][point.x].terrain = terrain;
  });
  setRect(tiles, 11, 7, 15, 11, "chasm");
  tiles[6][11].terrain = "floor";
  tiles[6][12].terrain = "specialFloor";
  tiles[6][13].terrain = "wall";
  tiles[6][14].terrain = "water";
  tiles[6][15].terrain = "chasm";

  const doorsRoom = room("showcase-doors", 20, 2, 40, 15);
  frameRoom(tiles, doorsRoom, { x: doorsRoom.center.x, y: 15 });
  setRect(tiles, 27, 3, 27, 14, "wall");
  ([
    [4, "door"],
    [6, "openDoor"],
    [8, "lockedDoor"],
    [10, "crystalDoor"],
    [12, "barricade"],
  ] as const).forEach(([y, terrain]) => {
    tiles[y][27].terrain = terrain;
  });
  setRect(tiles, 31, 9, 39, 9, "wall");
  tiles[9][34].terrain = "door";
  tiles[9][36].terrain = "crystalDoor";
  tiles[9][38].terrain = "lockedDoor";

  const p0Rooms = P0_ROOM_PRESETS.map((preset, index) => {
    const left = 42 + index * 11;
    const area = room(`showcase-${preset}`, left, 2, left + 9, 15);
    const entrance = { x: area.center.x, y: area.bottom };
    frameRoom(tiles, area, entrance);
    paintP0Room(
      tiles,
      { ...area, preset, roomValue: 2 },
      [entrance],
      random,
    );
    tiles[entrance.y][entrance.x].terrain = "door";
    return area;
  });
  void p0Rooms;

  const trapsRoom = room("showcase-traps", 97, 2, 120, 15);
  frameRoom(tiles, trapsRoom, { x: trapsRoom.center.x, y: 15 });
  const trapKinds = [
    "gripping",
    "poisonDart",
    "explosive",
    "teleportation",
    "flashing",
  ] as const;
  const traps: DungeonTrap[] = trapKinds.map((kind, index) => ({
    id: `showcase-trap-${kind}`,
    kind,
    x: 101 + index * 4,
    y: 7,
    active: true,
    hidden: false,
    revealed: true,
    triggered: false,
  }));

  const hazardsRoom = room("showcase-hazards", 2, 19, 28, 30);
  frameRoom(tiles, hazardsRoom, { x: hazardsRoom.center.x, y: 19 });
  const objectsRoom = room("showcase-objects", 30, 19, 54, 30);
  frameRoom(tiles, objectsRoom, { x: objectsRoom.center.x, y: 19 });
  const enemiesRoom = room("showcase-enemies", 56, 19, 80, 30);
  frameRoom(tiles, enemiesRoom, { x: enemiesRoom.center.x, y: 19 });
  setRect(tiles, 64, 20, 64, 29, "wall");
  setRect(tiles, 72, 20, 72, 29, "wall");
  tiles[25][64].terrain = "door";
  tiles[25][72].terrain = "door";

  const specialRooms: DungeonSpecialRoom[] = [];
  const requiredFloorSpawns: NonNullable<GameState["requiredFloorSpawns"]> = [];
  const rewards: SpecialRewardSlot[] = [];
  const toxicGasTiles: Point[] = [];
  const magicalFireTiles: Array<{ roomId: string; tiles: Point[] }> = [];
  const specialAreas = P0_SPECIAL_ROOM_PRESETS.map((preset, index) => {
    const left = 2 + index * 19;
    const right = index === P0_SPECIAL_ROOM_PRESETS.length - 1
      ? WIDTH - 2
      : left + 17;
    const area = room(`showcase-special-${preset}`, left, 34, right, 49);
    const entrance = { x: area.center.x, y: area.top };
    frameRoom(tiles, area, entrance);
    const result = paintSpecialRoom(
      tiles,
      { ...area, preset },
      [entrance],
      random,
      1,
    );
    tiles[entrance.y][entrance.x].terrain = "door";
    specialRooms.push(result.room);
    requiredFloorSpawns.push(...result.requiredFloorSpawns);
    traps.push(...result.traps.map((trap) => ({ ...trap, hidden: false, revealed: true })));
    rewards.push(...result.rewards);
    toxicGasTiles.push(...result.toxicGasTiles);
    if (result.magicalFireTiles.length > 0) {
      magicalFireTiles.push({
        roomId: result.room.id,
        tiles: result.magicalFireTiles,
      });
    }
    return area;
  });

  const start = { x: 3, y: 17 };
  const exit = { x: 3, y: 63 };
  tiles[start.y][start.x].terrain = "entrance";
  tiles[exit.y][exit.x].terrain = "exit";

  const groundItems: GroundItem[] = [
    { id: "showcase-iron-key", defId: "iron_key", quantity: 1, x: 22, y: 8 },
    { id: "showcase-crystal-key", defId: "crystal_key", quantity: 1, x: 22, y: 10 },
    { id: "showcase-liquid-flame", defId: "potion_liquid_flame", quantity: 1, x: 22, y: 12 },
    { id: "showcase-hazard-frost", defId: "potion_frost", quantity: 1, x: 11, y: 28 },
    { id: "showcase-hazard-purity", defId: "potion_purity", quantity: 1, x: 20, y: 28 },
    { id: "showcase-ground-item", defId: "potion_healing", quantity: 1, x: 33, y: 23 },
    { id: "showcase-runestone", defId: "stone_intuition", quantity: 1, x: 35, y: 23 },
    { id: "showcase-levitation", defId: "potion_levitation", quantity: 1, x: 37, y: 23 },
  ];

  const majorDefinition = ITEM_DEFS.rusty_sword ?? ITEM_DEFS.worn_shortsword;
  const majorInstance = createEquipmentInstance(
    majorDefinition,
    "showcase-major-loot",
    () => random.next(),
    { allowCurse: false, grade: "A" },
  );
  enchantEquipmentInstance(
    majorInstance,
    majorDefinition,
    () => random.next(),
  );
  upgradeEquipmentInstance(majorInstance, 1);
  groundItems.push({
    id: "showcase-major-loot",
    defId: majorDefinition.id,
    quantity: 1,
    instance: majorInstance,
    x: 39,
    y: 23,
  });

  specialAreas.forEach((area, areaIndex) => {
    const roomRequirements = requiredFloorSpawns.filter((requirement) =>
      requirement.id.startsWith(area.id),
    );
    roomRequirements.forEach((requirement, requirementIndex) => {
      groundItems.push({
        id: `showcase-required-${areaIndex}-${requirementIndex}`,
        defId: requirement.defId,
        quantity: 1,
        x: Math.min(area.right - 1, area.center.x + requirementIndex),
        y: 51,
      });
    });
  });

  const objects: DungeonObject[] = [
    { id: "showcase-chest", kind: "chest", looted: false, loot: ["ration"], x: 43, y: 23 },
    { id: "showcase-crystal-chest", kind: "crystalChest", looted: false, loot: ["ring_accuracy"], x: 46, y: 23 },
    { id: "showcase-tomb", kind: "tomb", looted: false, loot: ["scroll_upgrade"], x: 49, y: 23 },
    { id: "showcase-alchemy", kind: "alchemy", looted: false, loot: [], x: 52, y: 23 },
  ];

  rewards.forEach((slot, index) => {
    const defId = rewardDefId(slot);
    const instance = rewardInstance(
      defId,
      `showcase-special-reward-instance-${index}`,
      random,
    );
    if (slot.source === "object") {
      objects.push({
        id: `showcase-special-reward-${index}`,
        kind: slot.objectKind ?? "chest",
        looted: false,
        loot: [defId],
        lootInstances: [instance ? cloneInventoryInstance(instance) : null],
        ...slot.point,
      });
    } else {
      groundItems.push({
        id: `showcase-special-reward-${index}`,
        defId,
        quantity: 1,
        instance,
        ...slot.point,
      });
    }
  });

  const clouds: DungeonCloud[] = [];
  addCloud(
    clouds,
    "showcase-fire",
    "fire",
    [{ x: 5, y: 24 }, { x: 6, y: 24 }, { x: 7, y: 24 }],
    6,
    2,
  );
  addCloud(
    clouds,
    "showcase-frost",
    "frost",
    [{ x: 9, y: 24 }, { x: 10, y: 24 }, { x: 11, y: 24 }],
    6,
    1,
  );
  addCloud(
    clouds,
    "showcase-toxic",
    "toxic",
    [{ x: 22, y: 24 }, { x: 23, y: 24 }, { x: 24, y: 24 }],
    20,
    2,
  );
  const hazardMagicalTiles = Array.from({ length: 5 }, (_, index) => ({
    x: 14 + index,
    y: 25,
  }));
  const hazardMagicalRoom: DungeonSpecialRoom = {
    id: "showcase-hazard-magical-fire",
    kind: "magicalFire",
    left: 13,
    top: 22,
    right: 19,
    bottom: 27,
    requiredItemId: "potion_frost",
  };
  specialRooms.push(hazardMagicalRoom);
  addCloud(
    clouds,
    "showcase-magical-fire",
    "fire",
    hazardMagicalTiles,
    1,
    MAGICAL_FIRE_CONFIG.power,
    { variant: "magicalFire", roomId: hazardMagicalRoom.id },
  );
  magicalFireTiles.forEach((barrier, index) =>
    addCloud(
      clouds,
      `showcase-special-magical-fire-${index}`,
      "fire",
      barrier.tiles,
      1,
      MAGICAL_FIRE_CONFIG.power,
      { variant: "magicalFire", roomId: barrier.roomId },
    ),
  );
  if (toxicGasTiles.length > 0) {
    addCloud(
      clouds,
      "showcase-special-toxic",
      "toxic",
      toxicGasTiles,
      999,
      2,
    );
  }

  next.width = WIDTH;
  next.height = HEIGHT;
  next.tiles = tiles;
  next.player = {
    ...next.player,
    ...start,
    statuses: [],
    hp: next.player.maxHp,
    inventory: { ...next.player.inventory },
  };
  delete next.player.inventory.iron_key;
  delete next.player.inventory.crystal_key;
  next.companions = next.companions.map((companion, index) => ({
    ...companion,
    x: start.x + index + 1,
    y: start.y,
    statuses: [],
    hp: companion.maxHp,
    command: "follow",
  }));
  next.companionTrail = [];
  next.enemies = [
    enemy("rat", "showcase-rat", { x: 60, y: 25 }),
    enemy("snake", "showcase-snake", { x: 68, y: 25 }),
    enemy("slime", "showcase-slime", { x: 76, y: 25 }),
  ];
  next.groundItems = groundItems;
  next.objects = objects;
  next.clouds = clouds;
  next.wards = [];
  next.traps = traps;
  next.specialRooms = specialRooms;
  next.requiredFloorSpawns = requiredFloorSpawns;
  next.floor = 1;
  next.dungeonId = DEVELOPER_TEST_MAP_ID;
  next.dungeonName = "개발자 전체 맵 요소 테스트";
  next.maxFloor = 1;
  next.mainDropIds = [majorDefinition.id];
  next.specialRoomPlan = specialRooms.map((specialRoom, index) => ({
    id: `showcase-special-plan-${index}`,
    floor: 1,
    preset: specialRoom.kind,
  }));
  next.lootPlan = [];
  next.goldPlan = [];
  next.goldCollected = 0;
  next.seed = DEVELOPER_TEST_MAP_SEED;
  next.rng = DEVELOPER_TEST_MAP_SEED;
  next.turn = 1;
  next.logs = [
    "[개발자] 전체 맵 요소 테스트 맵입니다.",
    "위쪽은 지형·문·CHASM·함정, 가운데는 환경·오브젝트·적, 아래쪽은 특수방 샘플입니다.",
    "왼쪽 안전 통로 끝의 출구로 테스트를 종료할 수 있습니다.",
  ];
  next.gameOver = false;
  next.pendingAugmentOffers = [];
  next.equipmentOffers = [];
  updateFieldOfView(next.tiles, next.player, next.player.viewDistance);
  return next;
}
