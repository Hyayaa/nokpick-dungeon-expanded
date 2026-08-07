import { canEnemySpawnAt } from "./enemy-combat";
import {
  createEnemyFromDefinition,
  enemyDefinition,
} from "./enemy-definitions";
import {
  findPath,
  isWalkable,
  mapPointKey,
  type RoomPreset,
} from "./map";
import { randomInt } from "./random";
import { isSpecialRoomPreset } from "./special-rooms";
import { gridDistance as distance, pointEquals } from "./spatial";
import type {
  GameState,
  Point,
  QuestDefinition,
  QuestRoom,
  QuestState,
} from "./types";

export const QUEST_RELIC_ITEM_ID = "quest_sealed_relic";

export const QUEST_DEFINITIONS = Object.freeze([
  {
    id: "red_fang_hunt",
    kind: "uniqueEnemy",
    titleKo: "붉은 송곳니 추적",
    titleEn: "Hunt the Red Fang",
    descriptionKo:
      "추적자 미라가 원정대를 습격한 놀 우두머리의 처치를 부탁합니다.",
    descriptionEn:
      "Tracker Mira asks the party to defeat the gnoll leader stalking this floor.",
    objectiveKo: "고유 적 ‘붉은 송곳니’를 처치하고 미라에게 돌아가기",
    objectiveEn: "Defeat the unique enemy Red Fang, then return to Mira",
    npcNameKo: "추적자 미라",
    npcNameEn: "Tracker Mira",
    npcClassId: "huntress",
    targetEnemyKind: "gnoll",
    targetNameKo: "붉은 송곳니",
    targetNameEn: "Red Fang",
    rewardItemId: "scroll_upgrade",
    rewardQuantity: 1,
    floor: 1,
  },
  {
    id: "sealed_relic_recovery",
    kind: "recoverItem",
    titleKo: "봉인 유물 회수",
    titleEn: "Recover the Sealed Relic",
    descriptionKo:
      "학자 세라가 붕괴된 조사실에 남겨 둔 봉인 유물을 찾아 달라고 요청합니다.",
    descriptionEn:
      "Scholar Sera asks the party to recover a sealed relic from a collapsed study.",
    objectiveKo: "봉인 유물을 회수하고 세라에게 돌아가기",
    objectiveEn: "Recover the sealed relic, then return to Sera",
    npcNameKo: "학자 세라",
    npcNameEn: "Scholar Sera",
    npcClassId: "mage",
    questItemId: QUEST_RELIC_ITEM_ID,
    rewardItemId: "potion_strength",
    rewardQuantity: 1,
    floor: 1,
  },
] satisfies readonly QuestDefinition[]);

const QUESTS_BY_ID = new Map(
  QUEST_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export const questDefinition = (questId: string) =>
  QUESTS_BY_ID.get(questId) ?? null;

export const isQuestItemDefinitionId = (itemId: string) =>
  QUEST_DEFINITIONS.some((definition) => definition.questItemId === itemId);

export const createInitialQuestStates = (): QuestState[] =>
  QUEST_DEFINITIONS.map((definition) => ({
    questId: definition.id,
    status: "available",
    progress: 0,
    required: 1,
  }));

export const selectedProductionQuestDefinition = (seed: number) => {
  let mixed = seed >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b) >>> 0;
  mixed = (mixed ^ (mixed >>> 16)) >>> 0;
  const roll = mixed / 4294967296;
  return QUEST_DEFINITIONS[
    Math.min(QUEST_DEFINITIONS.length - 1, Math.floor(roll * QUEST_DEFINITIONS.length))
  ];
};

export const createProductionQuestStates = (seed: number): QuestState[] => {
  const definition = selectedProductionQuestDefinition(seed);
  return [{
    questId: definition.id,
    status: "available",
    progress: 0,
    required: 1,
  }];
};

export const questStateFor = (state: GameState, questId: string) =>
  (state.quests ?? []).find((quest) => quest.questId === questId) ?? null;

export const isQuestActive = (state: GameState, questId: string) =>
  questStateFor(state, questId)?.status === "active";

export const canCollectQuestItem = (
  state: GameState,
  item: GameState["groundItems"][number],
) => !item.questId || isQuestActive(state, item.questId);

export const acceptQuestInPlace = (state: GameState, questId: string) => {
  const quest = questStateFor(state, questId);
  const definition = questDefinition(questId);
  if (!quest || !definition || quest.status !== "available") return false;
  quest.status = "active";
  quest.acceptedAtTurn = state.turn;
  quest.pendingContentSpawn = true;
  state.logs.push(`퀘스트 수락 · ${definition.titleKo}`);
  state.logs.push(definition.objectiveKo);
  activateQuestContentInPlace(state, questId);
  return true;
};

const makeReady = (state: GameState, quest: QuestState) => {
  if (quest.progress < quest.required || quest.status !== "active") return;
  quest.status = "readyToTurnIn";
  quest.readyAtTurn = state.turn;
  const definition = questDefinition(quest.questId);
  if (definition) {
    state.logs.push(`목표 완료 · ${definition.npcNameKo}에게 돌아가세요.`);
  }
};

export const recordQuestEnemyDefeat = (
  state: GameState,
  questId: string | undefined,
) => {
  if (!questId) return;
  const quest = questStateFor(state, questId);
  if (!quest || quest.status !== "active") return;
  quest.progress = Math.min(quest.required, quest.progress + 1);
  makeReady(state, quest);
};

export const recordQuestItemPickup = (
  state: GameState,
  item: GameState["groundItems"][number],
) => {
  if (!item.questId) return;
  const quest = questStateFor(state, item.questId);
  if (!quest || quest.status !== "active") return;
  quest.progress = Math.min(quest.required, quest.progress + 1);
  makeReady(state, quest);
};

export const completeQuestInPlace = (state: GameState, questId: string) => {
  const quest = questStateFor(state, questId);
  const definition = questDefinition(questId);
  if (!quest || !definition || quest.status !== "readyToTurnIn") return false;
  quest.status = "completed";
  quest.progress = quest.required;
  quest.completedAtTurn = state.turn;
  state.logs.push(`퀘스트 완료 · ${definition.titleKo}`);
  return true;
};

export const triggerQuestRoomInPlace = (state: GameState, point: Point) => {
  const room = (state.questRooms ?? []).find(
    (candidate) =>
      point.x >= candidate.left &&
      point.x <= candidate.right &&
      point.y >= candidate.top &&
      point.y <= candidate.bottom,
  );
  if (!room) return false;
  const quest = questStateFor(state, room.questId);
  const definition = questDefinition(room.questId);
  if (
    !quest ||
    !definition ||
    quest.status !== "active" ||
    quest.roomEnteredAtTurn !== undefined
  ) {
    return false;
  }
  quest.roomEnteredAtTurn = state.turn;
  state.logs.push(`퀘스트 구역 발견 · ${definition.titleKo}`);
  return true;
};

type QuestAreaPlacement = {
  questId: string;
  room: Omit<QuestRoom, "id" | "questId" | "kind">;
  npc: Point;
  target: Point;
};

const questEnemy = (
  state: GameState,
  definition: QuestDefinition,
  point: Point,
) => {
  const kind = definition.targetEnemyKind ?? "gnoll";
  const base = enemyDefinition(kind);
  const scale =
    Math.max(1, state.difficultyScale ?? 1) *
    (1 + Math.max(0, state.floor - 1) * 0.2);
  return createEnemyFromDefinition(
    kind,
    `quest-target-${definition.id}`,
    point,
    {
      hp: Math.ceil(base.baseStats.hp * 1.8 * scale),
      attack: Math.ceil(base.baseStats.attack * 1.25 * scale),
      defense: Math.max(1, Math.ceil(base.baseStats.defense * scale) + 1),
      accuracy: Math.ceil(base.baseStats.accuracy * scale) + 2,
      evasion: Math.ceil(base.baseStats.evasion * scale),
      xp: Math.ceil(base.xp * 2 * scale),
    },
    {
    alerted: false,
    sawPlayerLastTurn: false,
    sleeping: false,
    lastSeenPlayer: null,
    drop: null,
    questId: definition.id,
    uniqueName: definition.targetNameKo,
    behaviorState: { questRoaming: true },
    },
  );
};

export const populateQuestArea = (
  state: GameState,
  placement: QuestAreaPlacement,
) => {
  const definition = questDefinition(placement.questId);
  const quest = questStateFor(state, placement.questId);
  if (!definition || !quest) return false;

  state.questNpcs ??= [];
  state.questRooms ??= [];
  state.questNpcs = state.questNpcs.filter(
    (npc) => npc.questId !== definition.id,
  );
  state.questRooms = state.questRooms.filter(
    (room) => room.questId !== definition.id,
  );
  state.enemies = state.enemies.filter(
    (enemy) => enemy.questId !== definition.id,
  );
  state.groundItems = state.groundItems.filter(
    (item) => item.questId !== definition.id,
  );
  quest.contentPoint = { ...placement.target };
  quest.contentSpawned = false;
  quest.pendingContentSpawn = false;
  quest.targetId = undefined;

  state.questNpcs.push({
    id: `quest-npc-${definition.id}`,
    questId: definition.id,
    nameKo: definition.npcNameKo,
    nameEn: definition.npcNameEn,
    classId: definition.npcClassId,
    ...placement.npc,
  });
  state.questRooms.push({
    id: `quest-room-${definition.id}`,
    questId: definition.id,
    kind: definition.kind,
    ...placement.room,
  });

  return true;
};

type RoomRegion = {
  preset: RoomPreset;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const regionContains = (region: RoomRegion, point: Point) =>
  point.x >= region.left &&
  point.x <= region.right &&
  point.y >= region.top &&
  point.y <= region.bottom;

const regionPoints = (state: GameState, region: RoomRegion) => {
  const occupied = new Set([
    mapPointKey(state.player),
    ...(state.companions ?? []).map(mapPointKey),
    ...state.enemies.map(mapPointKey),
    ...state.objects.filter((object) => !object.looted).map(mapPointKey),
    ...state.groundItems.map(mapPointKey),
    ...(state.questNpcs ?? []).map(mapPointKey),
  ]);
  const points: Point[] = [];
  for (let y = region.top + 1; y < region.bottom; y += 1) {
    for (let x = region.left + 1; x < region.right; x += 1) {
      const terrain = state.tiles[y]?.[x]?.terrain;
      const point = { x, y };
      if (
        terrain &&
        isWalkable(terrain, false) &&
        !["door", "openDoor", "entrance", "exit"].includes(terrain) &&
        !occupied.has(mapPointKey(point))
      ) {
        points.push(point);
      }
    }
  }
  return points;
};

const questTraversalBlocked = (state: GameState) => new Set([
  ...state.enemies.map(mapPointKey),
  ...(state.companions ?? []).filter((companion) => companion.hp > 0).map(mapPointKey),
  ...(state.questNpcs ?? []).map(mapPointKey),
  ...state.objects.filter((object) => !object.looted).map(mapPointKey),
  ...state.groundItems.map(mapPointKey),
  ...(state.clouds ?? []).flatMap((cloud) =>
    cloud.variant === "magicalFire" || cloud.power > 0
      ? cloud.tiles.map(mapPointKey)
      : []
  ),
]);

const reachableFromParty = (state: GameState, point: Point) => {
  const blocked = questTraversalBlocked(state);
  blocked.delete(mapPointKey(point));
  const path = findPath(state.tiles, state.player, point, blocked, false);
  return pointEquals(state.player, point) || pointEquals(path.at(-1) ?? state.player, point);
};

const uniqueTargetCandidates = (
  state: GameState,
  definition: QuestDefinition,
) => {
  const kind = definition.targetEnemyKind ?? "gnoll";
  return state.tiles.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const point = { x, y };
      return !tile.visible &&
        canEnemySpawnAt(state, point, kind) &&
        reachableFromParty(state, point)
        ? [point]
        : [];
    }),
  );
};

const questRoomFor = (state: GameState, questId: string): RoomRegion | null => {
  const room = (state.questRooms ?? []).find((candidate) => candidate.questId === questId);
  if (!room) return null;
  return { preset: "empty", ...room };
};

const questItemCandidates = (state: GameState, questId: string) => {
  const room = questRoomFor(state, questId);
  if (!room) return [];
  return regionPoints(state, room).filter((point) => reachableFromParty(state, point));
};

const preferredThenRandom = (
  state: GameState,
  preferred: Point | undefined,
  candidates: readonly Point[],
) => {
  const preferredKey = preferred ? mapPointKey(preferred) : null;
  const preferredCandidate = preferredKey
    ? candidates.find((candidate) => mapPointKey(candidate) === preferredKey)
    : null;
  if (preferredCandidate) return preferredCandidate;
  if (!candidates.length) return null;
  return candidates[randomInt(state, 0, candidates.length - 1)];
};

export function activateQuestContentInPlace(
  state: GameState,
  questId: string,
) {
  const quest = questStateFor(state, questId);
  const definition = questDefinition(questId);
  if (!quest || !definition || quest.status !== "active") return false;
  if (quest.contentSpawned && !quest.pendingContentSpawn) return true;

  if (definition.kind === "uniqueEnemy") {
    const existing = state.enemies.find((enemy) => enemy.questId === questId && enemy.hp > 0);
    if (existing) {
      quest.targetId = existing.id;
      quest.contentSpawned = true;
      quest.pendingContentSpawn = false;
      return true;
    }
    const point = preferredThenRandom(
      state,
      quest.contentPoint,
      uniqueTargetCandidates(state, definition),
    );
    if (!point) {
      quest.pendingContentSpawn = true;
      return false;
    }
    const target = questEnemy(state, definition, point);
    state.enemies.push(target);
    quest.targetId = target.id;
    quest.contentPoint = { ...point };
  } else if (definition.questItemId) {
    const existing = state.groundItems.find((item) => item.questId === questId);
    if (existing) {
      quest.contentSpawned = true;
      quest.pendingContentSpawn = false;
      return true;
    }
    const point = preferredThenRandom(
      state,
      quest.contentPoint,
      questItemCandidates(state, questId),
    );
    if (!point) {
      quest.pendingContentSpawn = true;
      return false;
    }
    state.groundItems.push({
      id: `quest-item-${definition.id}`,
      defId: definition.questItemId,
      quantity: 1,
      lootOrigin: "dungeon",
      questId: definition.id,
      ...point,
    });
    quest.contentPoint = { ...point };
  }

  quest.contentSpawned = true;
  quest.pendingContentSpawn = false;
  return true;
}

export const activatePendingQuestContentInPlace = (state: GameState) => {
  for (const quest of state.quests ?? []) {
    if (quest.status === "active" && quest.pendingContentSpawn) {
      activateQuestContentInPlace(state, quest.questId);
    }
  }
};

export const populateProductionQuestAreas = (
  state: GameState,
  roomRegions: readonly RoomRegion[],
) => {
  if (state.floor !== 1) return;
  const selectedId = selectedProductionQuestDefinition(state.seed).id;
  const selectedState = (state.quests ?? []).find(
    (quest) => quest.questId === selectedId,
  );
  state.quests = [
    selectedState
      ? { ...selectedState }
      : createProductionQuestStates(state.seed)[0],
  ];
  state.questNpcs = [];
  state.questRooms = [];

  const regions = roomRegions
    .filter(
      (region) =>
        region.preset !== "entrance" &&
        region.preset !== "exit" &&
        !isSpecialRoomPreset(region.preset) &&
        !regionContains(region, state.player) &&
        regionPoints(state, region).length >= 2,
    )
    .sort((first, second) => {
      const enemyCount = (region: RoomRegion) =>
        state.enemies.filter((enemy) => regionContains(region, enemy)).length;
      const center = (region: RoomRegion) => ({
        x: Math.floor((region.left + region.right) / 2),
        y: Math.floor((region.top + region.bottom) / 2),
      });
      return (
        enemyCount(first) - enemyCount(second) ||
        distance(center(second), state.player) -
          distance(center(first), state.player)
      );
    });

  state.quests.forEach((quest, index) => {
    const definition = questDefinition(quest.questId);
    if (!definition) return;
    const region = regions[index];
    if (!region) return;
    const points = regionPoints(state, region);
    if (points.length < 2) return;
    const center = {
      x: Math.floor((region.left + region.right) / 2),
      y: Math.floor((region.top + region.bottom) / 2),
    };
    const npc = [...points].sort(
      (first, second) => distance(first, center) - distance(second, center),
    )[0];
    const target = [...points]
      .filter((point) => !pointEquals(point, npc))
      .sort((first, second) => distance(second, npc) - distance(first, npc))[0];
    if (!npc || !target) return;
    populateQuestArea(state, {
      questId: definition.id,
      room: region,
      npc,
      target,
    });
  });
};
