import { bossDefinition, type BossId } from "./boss-definitions";
import {
  createEnemyFromDefinition,
  enemyDefinition,
} from "./enemy-definitions";
import {
  chooseEnemyForSpawn,
  relativeEnemyStage,
} from "./enemy-spawn";
import { isWalkable } from "./map";
import { random } from "./random";
import { initializeBossBehaviorInPlace } from "./boss-behaviors";
import type {
  BossEncounterState,
  BossRoom,
  Enemy,
  EnemyKind,
  GameState,
  Point,
} from "./types";

const pointKey = ({ x, y }: Point) => `${x},${y}`;

export const pointInBossRoom = (point: Point, room: BossRoom) =>
  point.x > room.left &&
  point.x < room.right &&
  point.y > room.top &&
  point.y < room.bottom;

const scaledStats = (
  kind: EnemyKind,
  floor: number,
  difficultyScale: number,
) => {
  const definition = enemyDefinition(kind);
  const floorScale = 1 + Math.max(0, floor - 1) * 0.2;
  const scale = floorScale * Math.max(1, difficultyScale || 1);
  const scaled = (value: number) =>
    Math.max(1, Math.round(Math.max(1, value) * scale));
  return {
    hp: scaled(definition.baseStats.hp),
    attack: scaled(definition.baseStats.attack),
    defense: scaled(definition.baseStats.defense),
    accuracy: scaled(definition.baseStats.accuracy),
    evasion: scaled(definition.baseStats.evasion),
    xp: scaled(definition.xp),
  };
};

const interiorCells = (state: GameState, room: BossRoom) => {
  const occupied = new Set([
    pointKey(state.player),
    ...state.companions.map(pointKey),
    ...state.enemies.map(pointKey),
    ...state.objects.filter((object) => !object.looted).map(pointKey),
    ...state.groundItems.map(pointKey),
  ]);
  const cells: Point[] = [];
  for (let y = room.top + 1; y < room.bottom; y += 1) {
    for (let x = room.left + 1; x < room.right; x += 1) {
      const point = { x, y };
      if (
        isWalkable(state.tiles[y][x].terrain, false) &&
        state.tiles[y][x].terrain !== "entrance" &&
        state.tiles[y][x].terrain !== "exit" &&
        pointKey(point) !== pointKey(room.center) &&
        !occupied.has(pointKey(point))
      ) {
        cells.push(point);
      }
    }
  }
  return cells;
};

const chooseCell = (state: GameState, cells: Point[]) => {
  if (!cells.length) return null;
  const index = Math.floor(random(state) * cells.length);
  return cells.splice(index, 1)[0];
};

const dormantEnemy = (
  enemy: Enemy,
  encounter: BossEncounterState,
) => {
  if (
    encounter.activated ||
    encounter.defeated ||
    (enemy.id !== encounter.bossEnemyId &&
      !encounter.minionIds.includes(enemy.id))
  ) {
    return;
  }
  enemy.alerted = false;
  enemy.sawPlayerLastTurn = false;
  enemy.sleeping = true;
  enemy.wakeCooldown = 0;
  enemy.lastSeenPlayer = null;
  enemy.searchTurns = 0;
  enemy.pendingSkill = null;
};

/** Shared registry-backed spawn used by generated Boss Floors and Showcase. */
export const spawnBossEncounterInPlace = (
  state: GameState,
  bossId: BossId,
  room: BossRoom,
) => {
  const definition = bossDefinition(bossId);
  const bossEnemyId = `boss-${bossId}-${state.floor}-${state.seed}`;
  const boss = createEnemyFromDefinition(
    definition.enemyKind,
    bossEnemyId,
    room.center,
    scaledStats(definition.enemyKind, state.floor, state.difficultyScale),
    {
      uniqueName: definition.nameKo,
      drop: null,
      sleeping: true,
    },
  );
  const cells = interiorCells(state, room);
  const minionIds: string[] = [];
  const stage = relativeEnemyStage(state.floor, state.maxFloor);
  const minions: Enemy[] = [];
  for (let index = 0; index < definition.minionCount; index += 1) {
    const point = chooseCell(state, cells);
    if (!point) break;
    const kind = chooseEnemyForSpawn(
      definition.region,
      stage,
      () => random(state),
    );
    const id = `boss-minion-${bossId}-${state.floor}-${index}-${state.seed}`;
    minionIds.push(id);
    minions.push(
      createEnemyFromDefinition(
        kind,
        id,
        point,
        scaledStats(kind, state.floor, state.difficultyScale),
        { drop: null, sleeping: true },
      ),
    );
  }
  state.enemies.push(boss, ...minions);
  state.bossId = bossId;
  state.bossEncounter = {
    bossId,
    room: {
      ...room,
      center: { ...room.center },
    },
    bossEnemyId,
    minionIds,
    activated: false,
    defeated: false,
    phase: 1,
    exitKeyDropped: false,
    exitKeyCollected: false,
  };
  initializeBossBehaviorInPlace(state, boss);
  return state.bossEncounter;
};

/** Synchronizes activation/defeat without rebuilding any persisted actors. */
export const syncBossEncounterInPlace = (state: GameState) => {
  const encounter = state.bossEncounter;
  if (!encounter) return null;
  const boss = state.enemies.find(
    (enemy) => enemy.id === encounter.bossEnemyId && enemy.hp > 0,
  );
  if (!boss) {
    return encounter;
  }
  if (
    !encounter.activated &&
    pointInBossRoom(state.player, encounter.room)
  ) {
    encounter.activated = true;
    state.logs.push(
      `${bossDefinition(encounter.bossId).nameKo} 전투가 시작되었습니다.`,
    );
    const encounterIds = new Set([
      encounter.bossEnemyId,
      ...encounter.minionIds,
    ]);
    state.enemies.forEach((enemy) => {
      if (!encounterIds.has(enemy.id) || enemy.hp <= 0) return;
      enemy.sleeping = false;
      enemy.alerted = true;
      enemy.sawPlayerLastTurn = true;
      enemy.lastSeenPlayer = { x: state.player.x, y: state.player.y };
      enemy.searchTurns = 0;
    });
  }
  state.enemies.forEach((enemy) => dormantEnemy(enemy, encounter));
  return encounter;
};

/** Called before the boss actor is removed so its real death tile is retained. */
export const recordBossDeathInPlace = (
  state: GameState,
  enemy: Enemy,
) => {
  const encounter = state.bossEncounter;
  if (!encounter || enemy.id !== encounter.bossEnemyId || enemy.hp > 0) {
    return false;
  }
  enemy.pendingSkill = null;
  encounter.defeated = true;
  encounter.bossDeathPoint = { x: enemy.x, y: enemy.y };
  if (!encounter.exitKeyDropped) {
    const keyId = `boss-exit-key-${encounter.bossEnemyId}`;
    if (!state.groundItems.some((item) => item.id === keyId)) {
      state.groundItems.push({
        id: keyId,
        defId: "boss_exit_key",
        quantity: 1,
        lootOrigin: "dungeon",
        x: enemy.x,
        y: enemy.y,
      });
    }
    encounter.exitKeyDropped = true;
    encounter.exitKeyCollected = false;
    state.logs.push(
      encounter.bossId === "goo"
        ? "구를 쓰러뜨렸습니다."
        : `${bossDefinition(encounter.bossId).nameKo}을(를) 쓰러뜨렸습니다.`,
    );
    state.logs.push("탈출구 열쇠가 떨어졌습니다.");
  }
  return true;
};

export const recordBossExitKeyPickupInPlace = (state: GameState) => {
  if (!state.bossEncounter) return;
  state.bossEncounter.exitKeyCollected = true;
};

export type BossCompletionBlockReason = "bossAlive" | "exitKeyMissing";

export const bossCompletionBlockReason = (
  state: GameState,
): BossCompletionBlockReason | null => {
  const encounter = syncBossEncounterInPlace(state);
  if (!encounter) return null;
  if (!encounter.defeated) return "bossAlive";
  return (state.player.inventory.boss_exit_key ?? 0) > 0
    ? null
    : "exitKeyMissing";
};

export const consumeBossExitKeyInPlace = (state: GameState) => {
  if (!state.bossEncounter) return false;
  const quantity = state.player.inventory.boss_exit_key ?? 0;
  if (quantity <= 0) return false;
  if (quantity === 1) delete state.player.inventory.boss_exit_key;
  else state.player.inventory.boss_exit_key = quantity - 1;
  return true;
};

export const isDormantBossEncounterEnemy = (
  state: GameState,
  enemyId: string,
) => {
  const encounter = state.bossEncounter;
  return Boolean(
    encounter &&
      !encounter.activated &&
      !encounter.defeated &&
      (enemyId === encounter.bossEnemyId ||
        encounter.minionIds.includes(enemyId)),
  );
};

export const bossCompletionBlocked = (state: GameState) => {
  return bossCompletionBlockReason(state) !== null;
};
