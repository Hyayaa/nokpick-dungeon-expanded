import assert from "node:assert/strict";
import {
  acceptQuest,
  claimQuestReward,
  createNewGame,
  MAX_INVENTORY_SLOTS,
  planAutoExplore,
  pickupGroundItems,
  playerStep,
  runEnemyTurn,
} from "../app/game/engine";
import {
  createDeveloperTestMap,
  DEVELOPER_TEST_MAP_ID,
} from "../app/game/developer-test-map";
import { ITEM_DEFS } from "../app/game/data";
import { questDefinition, questStateFor } from "../app/game/quests";
import type { GameState, Point } from "../app/game/types";

const seed = 0x517e57;

const stageNextTo = (state: GameState, point: Point) => {
  const candidates = [
    { x: point.x - 1, y: point.y },
    { x: point.x + 1, y: point.y },
    { x: point.x, y: point.y - 1 },
    { x: point.x, y: point.y + 1 },
  ];
  const staging = candidates.find((candidate) => {
    const terrain = state.tiles[candidate.y]?.[candidate.x]?.terrain;
    return terrain && terrain !== "wall" && terrain !== "chasm";
  });
  assert.ok(staging, "an adjacent quest interaction tile must exist");
  state.player.x = staging.x;
  state.player.y = staging.y;
  return { dx: point.x - staging.x, dy: point.y - staging.y };
};

const acceptAtNpc = (state: GameState, questId: string) => {
  const npc = state.questNpcs!.find((candidate) => candidate.questId === questId)!;
  const step = stageNextTo(state, npc);
  const offer = playerStep(state, step.dx, step.dy);
  assert.equal(offer.questInteraction?.status, "available");
  const accepted = acceptQuest(offer.state, questId);
  assert.equal(accepted.interacted, true);
  return accepted.state;
};

const firstProduction = createNewGame(seed);
const repeatedProduction = createNewGame(seed);
assert.equal(firstProduction.quests?.length, 1);
assert.equal(firstProduction.questNpcs?.length, 1);
assert.equal(firstProduction.questRooms?.length, 1);
assert.equal(firstProduction.quests?.[0].questId, repeatedProduction.quests?.[0].questId);
assert.equal(firstProduction.enemies.some((enemy) => Boolean(enemy.questId)), false);
assert.equal(firstProduction.groundItems.some((item) => Boolean(item.questId)), false);

const selectedQuestIds = new Set<string>();
for (let candidateSeed = 1; candidateSeed <= 20; candidateSeed += 1) {
  const generated = createNewGame(candidateSeed);
  assert.equal(generated.quests?.length, 1);
  assert.equal(generated.questNpcs?.length, 1);
  assert.equal(generated.questRooms?.length, 1);
  selectedQuestIds.add(generated.quests![0].questId);
  const room = generated.questRooms![0];
  assert.equal(
    (generated.specialRooms ?? []).some(
      (specialRoom) =>
        room.left <= specialRoom.right &&
        room.right >= specialRoom.left &&
        room.top <= specialRoom.bottom &&
        room.bottom >= specialRoom.top,
    ),
    false,
    "the selected quest room must not overwrite a special room",
  );
  assert.equal(
    generated.tiles.some((row, y) =>
      row.some(
        (tile, x) =>
          x >= room.left &&
          x <= room.right &&
          y >= room.top &&
          y <= room.bottom &&
          (tile.terrain === "entrance" || tile.terrain === "exit"),
      ),
    ),
    false,
    "the selected quest room must not consume a floor transition",
  );
}
assert.deepEqual(
  [...selectedQuestIds].sort(),
  ["red_fang_hunt", "sealed_relic_recovery"],
  "fixed production seeds must deterministically cover both registered quests",
);

const initialShowcase = createDeveloperTestMap(createNewGame(seed));
assert.equal(initialShowcase.dungeonId, DEVELOPER_TEST_MAP_ID);
assert.equal(initialShowcase.quests?.length, 2);
assert.equal(initialShowcase.questNpcs?.length, 2);
assert.equal(initialShowcase.questRooms?.length, 2);
assert.equal(initialShowcase.enemies.some((enemy) => Boolean(enemy.questId)), false);
assert.equal(initialShowcase.groundItems.some((item) => Boolean(item.questId)), false);
assert.ok(ITEM_DEFS.quest_sealed_relic);
assert.notEqual(
  ITEM_DEFS.quest_sealed_relic.sprite,
  445,
  "the sealed relic must not point at the transparent atlas frame",
);

{
  let game = createDeveloperTestMap(createNewGame(seed));
  game.companions = [];
  assert.equal(game.enemies.some((enemy) => enemy.questId === "red_fang_hunt"), false);
  game = acceptAtNpc(game, "red_fang_hunt");
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "active");
  let target = game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")!;
  assert.ok(target, "acceptance must create the unique target");
  assert.equal(game.tiles[target.y][target.x].visible, false);
  assert.equal(target.sleeping, false);
  assert.equal(target.alerted, false);
  assert.equal(target.behaviorState?.questRoaming, true);

  const stableTargetId = target.id;
  game = JSON.parse(JSON.stringify(game)) as GameState;
  assert.equal(game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")?.id, stableTargetId);
  game.enemies = [game.enemies.find((enemy) => enemy.id === stableTargetId)!];
  const beforeRoam = { x: game.enemies[0].x, y: game.enemies[0].y };
  game = runEnemyTurn(game).state;
  target = game.enemies[0];
  assert.notDeepEqual({ x: target.x, y: target.y }, beforeRoam);
  assert.equal(typeof target.behaviorState?.roamingX, "number");
  assert.equal(typeof target.behaviorState?.roamingY, "number");

  target.hp = 1;
  target.evasion = -100;
  game.player.baseAttack = 100;
  game.player.accuracy = 100;
  const attackStep = stageNextTo(game, target);
  const defeated = playerStep(game, attackStep.dx, attackStep.dy);
  game = defeated.state;
  assert.equal(defeated.defeatedIds?.includes(stableTargetId), true);
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "readyToTurnIn");

  const npc = game.questNpcs!.find((candidate) => candidate.questId === "red_fang_hunt")!;
  const rewardBefore = game.player.inventory.scroll_upgrade ?? 0;
  stageNextTo(game, npc);
  game = claimQuestReward(game, "red_fang_hunt").state;
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "completed");
  assert.equal(game.player.inventory.scroll_upgrade, rewardBefore + 1);
}

{
  let game = createDeveloperTestMap(createNewGame(seed + 1));
  game.companions = [];
  assert.equal(
    game.groundItems.some((item) => item.questId === "sealed_relic_recovery"),
    false,
  );
  game = acceptAtNpc(game, "sealed_relic_recovery");
  const item = game.groundItems.find((candidate) =>
    candidate.questId === "sealed_relic_recovery"
  )!;
  assert.ok(item, "acceptance must activate the reserved relic placement");
  assert.equal(ITEM_DEFS[item.defId].description.length > 0, true);
  game.player.x = item.x;
  game.player.y = item.y;
  const recovered = pickupGroundItems(game);
  game = recovered.state;
  assert.equal(recovered.consumedTurn, true);
  assert.equal(game.player.inventory.quest_sealed_relic, 1);
  assert.equal(questStateFor(game, "sealed_relic_recovery")?.status, "readyToTurnIn");

  game = JSON.parse(JSON.stringify(game)) as GameState;
  game.enemies = [];
  game = runEnemyTurn(game).state;
  assert.equal(
    game.groundItems.some((candidate) => candidate.questId === "sealed_relic_recovery"),
    false,
    "reload must not recreate an already recovered relic",
  );
  const npc = game.questNpcs!.find((candidate) =>
    candidate.questId === "sealed_relic_recovery"
  )!;
  stageNextTo(game, npc);
  const rewardBefore = game.player.inventory.potion_strength ?? 0;
  game = claimQuestReward(game, "sealed_relic_recovery").state;
  assert.equal(game.player.inventory.quest_sealed_relic ?? 0, 0);
  assert.equal(game.player.inventory.potion_strength, rewardBefore + 1);
  assert.equal(questStateFor(game, "sealed_relic_recovery")?.status, "completed");
}

{
  let game = createDeveloperTestMap(createNewGame(seed + 2));
  game.companions = [];
  game.enemies = [];
  game.tiles.forEach((row) => row.forEach((tile) => {
    tile.visible = true;
    tile.visibleMask = 15;
  }));
  game = acceptAtNpc(game, "red_fang_hunt");
  assert.equal(game.enemies.some((enemy) => enemy.questId === "red_fang_hunt"), false);
  assert.equal(questStateFor(game, "red_fang_hunt")?.pendingContentSpawn, true);
  const reserved = questStateFor(game, "red_fang_hunt")!.contentPoint!;
  game.tiles[reserved.y][reserved.x].visible = false;
  game.tiles[reserved.y][reserved.x].visibleMask = 0;
  game = runEnemyTurn(game).state;
  const target = game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")!;
  assert.ok(target, "a pending target must spawn after an unseen safe tile becomes available");
  assert.equal(target.sleeping, false);
}

{
  let game = createDeveloperTestMap(createNewGame(seed + 3));
  game.companions = [];
  game.enemies = [];
  game.groundItems = [];
  game.objects = [];
  game.tiles.forEach((row) => row.forEach((tile) => {
    tile.discovered = true;
    tile.visible = false;
  }));
  assert.notEqual(planAutoExplore(game)?.kind, "enemy");
  game = acceptAtNpc(game, "red_fang_hunt");
  const target = game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")!;
  game.tiles[target.y][target.x].visible = true;
  assert.equal(planAutoExplore(game)?.kind, "enemy");
}

{
  let game = createDeveloperTestMap(createNewGame(seed + 4));
  game.companions = [];
  const npc = game.questNpcs!.find((candidate) => candidate.questId === "red_fang_hunt")!;
  const quest = questStateFor(game, "red_fang_hunt")!;
  quest.status = "readyToTurnIn";
  quest.progress = quest.required;
  game.player.inventory = {};
  game.player.inventoryInstances = Array.from(
    { length: MAX_INVENTORY_SLOTS },
    (_, index) => ({ id: `quest-full-bag-${index}`, defId: "rusty_sword" }),
  );
  stageNextTo(game, npc);
  const playerPosition = { x: game.player.x, y: game.player.y };
  game = claimQuestReward(game, "red_fang_hunt").state;
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "completed");
  const droppedReward = game.groundItems.find((item) =>
    item.id.startsWith("quest-reward-red_fang_hunt-")
  );
  assert.deepEqual(
    droppedReward && { x: droppedReward.x, y: droppedReward.y },
    playerPosition,
  );
}

for (const quest of initialShowcase.quests ?? []) {
  assert.ok(questDefinition(quest.questId), `missing definition for ${quest.questId}`);
}

console.log("quest selection, deferred targets, roaming, relic pickup, rewards, and reload checks passed");
