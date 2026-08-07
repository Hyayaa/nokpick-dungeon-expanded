import assert from "node:assert/strict";
import {
  acceptQuest,
  claimQuestReward,
  createNewGame,
  pathTo,
  pickupGroundItems,
  playerStep,
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

const production = createNewGame(seed);
assert.equal(production.quests?.length, 2);
assert.equal(production.questNpcs?.length, 2);
assert.equal(production.questRooms?.length, 2);
assert.ok(production.enemies.some((enemy) => enemy.questId === "red_fang_hunt"));
assert.ok(
  production.groundItems.some(
    (item) => item.questId === "sealed_relic_recovery",
  ),
);

const initialShowcase = createDeveloperTestMap(createNewGame(seed));
assert.equal(initialShowcase.dungeonId, DEVELOPER_TEST_MAP_ID);
assert.equal(initialShowcase.quests?.length, 2);
assert.equal(initialShowcase.questNpcs?.length, 2);
assert.equal(initialShowcase.questRooms?.length, 2);
assert.ok(ITEM_DEFS.quest_sealed_relic);

{
  let game = createDeveloperTestMap(createNewGame(seed));
  game.companions = [];
  const npc = game.questNpcs!.find((candidate) =>
    candidate.questId === "red_fang_hunt"
  )!;
  const target = game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")!;

  const targetPath = pathTo(game, npc);
  assert.deepEqual(targetPath.at(-1), { x: npc.x, y: npc.y });

  let step = stageNextTo(game, target);
  const protectedTarget = playerStep(game, step.dx, step.dy);
  assert.equal(protectedTarget.consumedTurn, false);
  assert.equal(
    protectedTarget.state.enemies.find((enemy) => enemy.id === target.id)?.hp,
    target.maxHp,
  );

  step = stageNextTo(game, npc);
  const offer = playerStep(game, step.dx, step.dy);
  assert.equal(offer.questInteraction?.status, "available");
  assert.equal(offer.consumedTurn, false);
  game = acceptQuest(offer.state, "red_fang_hunt").state;
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "active");

  const room = game.questRooms!.find((candidate) =>
    candidate.questId === "red_fang_hunt"
  )!;
  game.player.x = Math.floor((room.left + room.right) / 2);
  game.player.y = room.top - 1;
  const roomEntry = playerStep(game, 0, 1);
  game = roomEntry.state;
  assert.ok(questStateFor(game, "red_fang_hunt")?.roomEnteredAtTurn);

  const liveTarget = game.enemies.find((enemy) => enemy.questId === "red_fang_hunt")!;
  liveTarget.hp = 1;
  liveTarget.evasion = -100;
  game.player.baseAttack = 100;
  game.player.accuracy = 100;
  step = stageNextTo(game, liveTarget);
  const defeated = playerStep(game, step.dx, step.dy);
  game = defeated.state;
  assert.equal(defeated.defeatedIds?.includes(liveTarget.id), true);
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "readyToTurnIn");

  game = JSON.parse(JSON.stringify(game)) as GameState;
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "readyToTurnIn");
  const rewardBefore = game.player.inventory.scroll_upgrade ?? 0;
  step = stageNextTo(game, npc);
  const report = playerStep(game, step.dx, step.dy);
  assert.equal(report.questInteraction?.status, "readyToTurnIn");
  game = claimQuestReward(report.state, "red_fang_hunt").state;
  assert.equal(questStateFor(game, "red_fang_hunt")?.status, "completed");
  assert.equal(game.player.inventory.scroll_upgrade, rewardBefore + 1);
}

{
  let game = createDeveloperTestMap(createNewGame(seed + 1));
  game.companions = [];
  const npc = game.questNpcs!.find((candidate) =>
    candidate.questId === "sealed_relic_recovery"
  )!;
  const item = game.groundItems.find((candidate) =>
    candidate.questId === "sealed_relic_recovery"
  )!;

  game.player.x = item.x;
  game.player.y = item.y;
  const lockedPickup = pickupGroundItems(game);
  assert.equal(lockedPickup.consumedTurn, false);
  assert.ok(lockedPickup.state.groundItems.some((candidate) => candidate.id === item.id));

  let step = stageNextTo(game, npc);
  const offer = playerStep(game, step.dx, step.dy);
  game = acceptQuest(offer.state, "sealed_relic_recovery").state;
  assert.equal(questStateFor(game, "sealed_relic_recovery")?.status, "active");

  game.player.x = item.x;
  game.player.y = item.y;
  const recovered = pickupGroundItems(game);
  game = recovered.state;
  assert.equal(recovered.consumedTurn, true);
  assert.equal(game.player.inventory.quest_sealed_relic, 1);
  assert.equal(
    questStateFor(game, "sealed_relic_recovery")?.status,
    "readyToTurnIn",
  );

  game = JSON.parse(JSON.stringify(game)) as GameState;
  step = stageNextTo(game, npc);
  const report = playerStep(game, step.dx, step.dy);
  const rewardBefore = report.state.player.inventory.potion_strength ?? 0;
  game = claimQuestReward(report.state, "sealed_relic_recovery").state;
  assert.equal(game.player.inventory.quest_sealed_relic ?? 0, 0);
  assert.equal(game.player.inventory.potion_strength, rewardBefore + 1);
  assert.equal(
    questStateFor(game, "sealed_relic_recovery")?.status,
    "completed",
  );
}

for (const quest of initialShowcase.quests ?? []) {
  assert.ok(questDefinition(quest.questId), `missing definition for ${quest.questId}`);
}

console.log(
  "quest framework, NPC offers, unique targets, recovery items, rooms, rewards, and reload checks passed",
);

