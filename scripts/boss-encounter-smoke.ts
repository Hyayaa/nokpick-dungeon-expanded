import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BOSS_DEFINITIONS,
  bossDefinition,
  isBossFloor,
} from "../app/game/boss-definitions";
import {
  pointInBossRoom,
  syncBossEncounterInPlace,
} from "../app/game/boss-encounter";
import {
  DUNGEON_DEFINITIONS,
  generateDungeonOffers,
} from "../app/game/campaign";
import { createDeveloperTestMap } from "../app/game/developer-test-map";
import {
  advanceExpeditionFloor,
  createExpeditionGame,
  createNewGame,
  runEnemyTurn,
} from "../app/game/engine";
import { isWalkable } from "../app/game/map";
import { cloneGame } from "../app/game/state";
import type { ExpeditionRules } from "../app/game/engine";
import type { GameState, Point } from "../app/game/types";

const seed = 0xb055f100;
const bossRules = (maxFloor = 1): ExpeditionRules => ({
  dungeonId: "developer-boss-floor",
  dungeonName: "개발자 보스 플로어",
  maxFloor,
  difficultyScale: 1,
  difficulty: 1,
  bossId: "dev_training_boss",
  mainDropIds: [],
  specialRoomPlan: [],
  lootPlan: [],
  goldPlan: [],
  quests: [],
});
const makeBossFloor = () => {
  const base = createNewGame(seed);
  return createExpeditionGame(
    seed,
    bossRules(),
    base.player,
    [],
  );
};

const registry = bossDefinition("dev_training_boss");
assert.deepEqual(Object.keys(BOSS_DEFINITIONS), ["dev_training_boss"]);
assert.equal(registry.production, false);
assert.equal(registry.enemyKind, "training_leaper");
assert.equal(registry.minionCount, 10);
assert.ok(registry.arena.minimumWidth >= 15);
assert.ok(registry.arena.minimumHeight >= 15);
assert.equal(isBossFloor(undefined, 3, 3), false);
assert.equal(isBossFloor("dev_training_boss", 2, 3), false);
assert.equal(isBossFloor("dev_training_boss", 3, 3), true);
assert.ok(DUNGEON_DEFINITIONS.every((dungeon) => !dungeon.bossId));
assert.ok(generateDungeonOffers(seed).every((dungeon) => !dungeon.bossId));

const ordinaryBase = createNewGame(seed + 1);
const ordinaryFinal = createExpeditionGame(
  seed + 1,
  { ...bossRules(), bossId: undefined },
  ordinaryBase.player,
  [],
);
assert.equal(ordinaryFinal.bossEncounter, undefined);
assert.ok(ordinaryFinal.enemies.length > 0);

const nonFinalBase = createNewGame(seed + 2);
const nonFinal = createExpeditionGame(
  seed + 2,
  bossRules(2),
  nonFinalBase.player,
  [],
);
assert.equal(nonFinal.floor, 1);
assert.equal(nonFinal.bossEncounter, undefined);
assert.ok(nonFinal.enemies.length > 0);

const first = makeBossFloor();
const repeated = makeBossFloor();
const encounter = first.bossEncounter!;
const room = encounter.room;
const boss = first.enemies.find(
  (enemy) => enemy.id === encounter.bossEnemyId,
)!;
assert.ok(room.right - room.left + 1 >= registry.arena.minimumWidth);
assert.ok(room.bottom - room.top + 1 >= registry.arena.minimumHeight);
assert.deepEqual({ x: boss.x, y: boss.y }, room.center);
assert.equal(encounter.minionIds.length, registry.minionCount);
assert.equal(first.enemies.length, registry.minionCount + 1);
assert.ok(first.enemies.every((enemy) => pointInBossRoom(enemy, room)));
assert.equal(
  first.enemies.filter(
    (enemy) => enemy.id === encounter.bossEnemyId,
  ).length,
  1,
);
assert.equal(
  first.enemies.filter(
    (enemy) =>
      enemy.id !== encounter.bossEnemyId &&
      enemy.x === room.center.x &&
      enemy.y === room.center.y,
  ).length,
  0,
);
assert.equal(
  first.objects.some(
    (object) => object.x === room.center.x && object.y === room.center.y,
  ),
  false,
);
assert.equal(
  first.groundItems.some(
    (item) => item.x === room.center.x && item.y === room.center.y,
  ),
  false,
);
assert.deepEqual(
  first.enemies.map(({ id, kind, x, y }) => ({ id, kind, x, y })),
  repeated.enemies.map(({ id, kind, x, y }) => ({ id, kind, x, y })),
  "same seed must reproduce boss/minion kinds and positions",
);

const reachable = (state: GameState, target: Point) => {
  const queue: Point[] = [{ x: state.player.x, y: state.player.y }];
  const visited = new Set(queue.map(({ x, y }) => `${x},${y}`));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (point.x === target.x && point.y === target.y) return true;
    for (const direction of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      const next = { x: point.x + direction.x, y: point.y + direction.y };
      const key = `${next.x},${next.y}`;
      if (
        visited.has(key) ||
        !state.tiles[next.y]?.[next.x] ||
        !isWalkable(state.tiles[next.y][next.x].terrain, true)
      ) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
};
assert.equal(reachable(first, room.center), true);

const dormantPositions = first.enemies.map(({ id, x, y }) => ({ id, x, y }));
const dormantTurn = runEnemyTurn(first, { playerInvincible: true }).state;
assert.equal(dormantTurn.bossEncounter?.activated, false);
assert.deepEqual(
  dormantTurn.enemies.map(({ id, x, y }) => ({ id, x, y })),
  dormantPositions,
  "encounter actors must not roam before room entry",
);
assert.ok(dormantTurn.enemies.every((enemy) => enemy.sleeping));

const activated = cloneGame(first);
activated.player.x = room.left + 1;
activated.player.y = room.top + 1;
syncBossEncounterInPlace(activated);
assert.equal(activated.bossEncounter?.activated, true);
assert.ok(
  activated.enemies
    .filter((enemy) =>
      enemy.id === encounter.bossEnemyId ||
      encounter.minionIds.includes(enemy.id),
    )
    .every((enemy) => !enemy.sleeping && enemy.alerted),
);

const blocked = advanceExpeditionFloor(cloneGame(first));
assert.equal(blocked.kind, "blocked");

const saved = cloneGame(activated);
const savedBoss = saved.enemies.find(
  (enemy) => enemy.id === saved.bossEncounter!.bossEnemyId,
)!;
savedBoss.hp = 321;
savedBoss.statuses = [{ id: "burning", turns: 3, power: 2 }];
const savedMinion = saved.enemies.find(
  (enemy) => enemy.id === saved.bossEncounter!.minionIds[0],
)!;
savedMinion.hp -= 4;
const restored = cloneGame(
  JSON.parse(JSON.stringify(saved)) as GameState,
);
assert.deepEqual(restored.bossEncounter, saved.bossEncounter);
assert.equal(
  restored.enemies.find(
    (enemy) => enemy.id === restored.bossEncounter!.bossEnemyId,
  )?.hp,
  321,
);
assert.deepEqual(
  restored.enemies.find(
    (enemy) => enemy.id === restored.bossEncounter!.bossEnemyId,
  )?.statuses,
  [{ id: "burning", turns: 3, power: 2 }],
);
assert.equal(
  restored.enemies.find(
    (enemy) => enemy.id === restored.bossEncounter!.minionIds[0],
  )?.hp,
  savedMinion.hp,
);

const defeated = cloneGame(activated);
defeated.enemies = defeated.enemies.filter(
  (enemy) => enemy.id !== defeated.bossEncounter!.bossEnemyId,
);
syncBossEncounterInPlace(defeated);
assert.equal(defeated.bossEncounter?.defeated, true);
assert.equal(advanceExpeditionFloor(defeated).kind, "completed");
const defeatedReload = cloneGame(
  JSON.parse(JSON.stringify(defeated)) as GameState,
);
assert.equal(defeatedReload.bossEncounter?.defeated, true);
assert.equal(
  defeatedReload.enemies.some(
    (enemy) => enemy.id === defeatedReload.bossEncounter?.bossEnemyId,
  ),
  false,
  "defeated bosses must not regenerate on reload",
);

const showcase = createDeveloperTestMap(createNewGame(seed + 3));
assert.equal(showcase.bossId, "dev_training_boss");
assert.equal(showcase.bossEncounter?.bossId, "dev_training_boss");
assert.equal(showcase.bossEncounter?.minionIds.length, 10);
assert.ok(showcase.bossEncounter);
assert.ok(
  showcase.bossEncounter!.room.right - showcase.bossEncounter!.room.left + 1 >= 15,
);

const componentSource = readFileSync("app/components/DungeonGame.tsx", "utf8");
const styleSource = readFileSync("app/globals.css", "utf8");
assert.match(componentSource, /onEnterBossFloor/);
assert.match(componentSource, /boss-health-display/);
assert.match(componentSource, /game\.tiles\[activeBoss\.y\]\?\.\[activeBoss\.x\]\?\.visible/);
assert.match(styleSource, /\.boss-health-display/);

console.log(
  "boss encounter smoke passed (registry, floor, spawn, activation, completion, save/reload, Showcase, HUD)",
);
