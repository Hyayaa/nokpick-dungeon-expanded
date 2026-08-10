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
  };
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
    if (!encounter.defeated) {
      encounter.defeated = true;
      state.logs.push(
        `${bossDefinition(encounter.bossId).nameKo}을(를) 쓰러뜨렸습니다. 출구가 열렸습니다.`,
      );
    }
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
  const encounter = syncBossEncounterInPlace(state);
  return Boolean(encounter && !encounter.defeated);
};
